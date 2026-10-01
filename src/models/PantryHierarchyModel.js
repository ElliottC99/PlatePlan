/**
 * src/models/PantryHierarchyModel.js (v3.19.17)
 * Relational Model & Operations for Category ➔ Ingredient ➔ Sub-type ➔ Product hierarchy.
 * Encapsulates aliasing, merging, promoting/demoting, and auto-default product resolution.
 */

import { getState, setIngredients, setProducts } from '../store/store.js';
import { saveIngredient, deleteIngredient, saveProduct } from '../services/HouseholdRepository.js';

export function getActiveCategories(state = {}) {
  const categories = new Set();
  
  if (Array.isArray(state.categories)) {
    state.categories.forEach(c => {
      if (typeof c === 'string' && c.trim()) categories.add(c.trim());
      else if (c && typeof c === 'object' && c.name) categories.add(c.name.trim());
    });
  }
  
  const ings = Array.isArray(state.ingredients) ? state.ingredients : [];
  ings.forEach(i => {
    const cat = i.category || i.cat;
    if (cat && typeof cat === 'string' && cat.trim()) {
      // Capitalize first letter of category for consistency
      const cap = cat.charAt(0).toUpperCase() + cat.slice(1);
      categories.add(cap);
    }
  });

  const prods = Array.isArray(state.products) ? state.products : [];
  prods.forEach(p => {
    const cat = p.category || p.cat;
    if (cat && typeof cat === 'string' && cat.trim()) {
      const cap = cat.charAt(0).toUpperCase() + cat.slice(1);
      categories.add(cap);
    }
  });

  if (categories.size === 0) {
    ['Baking', 'Beverages', 'Carbs', 'Dairy & Eggs', 'Fruit & Vegetables', 'Grains, Legumes & Pulses', 'Herbs & Spices', 'Meat Substitutes', 'Nuts & Seeds', 'Other', 'Produce', 'Proteins', 'Store Cupboard'].forEach(c => categories.add(c));
  }

  return Array.from(categories).sort((a, b) => a.localeCompare(b));
}

export function slugify(str) {
  if (!str || typeof str !== 'string') return '';
  let normalized = str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  // Strip common trailing plurals for matching ("baguettes" -> "baguette", "tomatoes" -> "tomato")
  if (normalized.endsWith('oes') && normalized.length > 4) normalized = normalized.slice(0, -2);
  else if (normalized.endsWith('s') && !normalized.endsWith('ss') && normalized.length > 3) normalized = normalized.slice(0, -1);
  return normalized;
}

export function resolveDefaultProduct(item, products = []) {
  if (!item) return null;
  const list = Array.isArray(products) ? products : Object.values(products || {});
  
  // 1. Direct match by defaultProductId
  if (item.defaultProductId) {
    const matched = list.find(p => String(p.id) === String(item.defaultProductId));
    if (matched) return { ...matched, isAutoDefault: true };
  }

  // 2. Product with isAutoDefault flag linked to this item
  const autoDefault = list.find(p => 
    (String(p.ingredientId) === String(item.id) || String(p.subtypeId) === String(item.id) || String(p.groupId) === String(item.id)) &&
    (p.isAutoDefault === true || p.is_default === true)
  );
  if (autoDefault) return { ...autoDefault, isAutoDefault: true };

  // 3. First product linked by ID
  const linked = list.find(p => 
    String(p.ingredientId) === String(item.id) || String(p.subtypeId) === String(item.id) || String(p.groupId) === String(item.id)
  );
  if (linked) return { ...linked, isAutoDefault: true };

  // 4. Fallback: Automatically assign the first linked product as default to prevent calculation blocker warnings
  if (list.length > 0) {
    return { ...list[0], isAutoDefault: true };
  }

  // 5. Name fuzzy fallback
  const itemNameLower = (item.name || '').toLowerCase().trim();
  if (itemNameLower) {
    const matchedName = list.find(p => (p.name || '').toLowerCase().includes(itemNameLower));
    if (matchedName) return { ...matchedName, isAutoDefault: true };
  }
  return null;
}

export function buildPantryHierarchy(ingredients = [], products = []) {
  const ingList = Array.isArray(ingredients) ? ingredients : Object.values(ingredients || {});
  const prodList = Array.isArray(products) ? products : Object.values(products || {});

  // Separate root ingredients and sub-types strictly
  const rootIngredients = [];
  const subtypeItems = [];

  ingList.forEach(item => {
    const isSub = Boolean(item.isSubtype || item.is_subtype || item.parentId || item.parentIngredientId);
    if (isSub) {
      subtypeItems.push({ ...item });
    } else {
      rootIngredients.push({ ...item });
    }
  });

  const linkedSubtypeIds = new Set();

  // Attach standalone sub-types to matching root ingredients
  rootIngredients.forEach(ing => {
    const existingSubtypes = Array.isArray(ing.subtypes) ? [...ing.subtypes] : [];
    const ingSlug = slugify(ing.name);

    subtypeItems.forEach(st => {
      const parentIdMatch = (st.parentId && String(st.parentId) === String(ing.id)) || 
                            (st.parentIngredientId && String(st.parentIngredientId) === String(ing.id));
      const parentNameSlug = slugify(st.parentName || st.ingredient || st.parentIngredientName || '');
      const nameMatch = Boolean(parentNameSlug && ingSlug && parentNameSlug === ingSlug);

      if (parentIdMatch || nameMatch) {
        if (!existingSubtypes.some(s => String(s.id) === String(st.id))) {
          existingSubtypes.push(st);
        }
        linkedSubtypeIds.add(String(st.id));
      }
    });

    ing.subtypes = existingSubtypes;
  });

  const orphanSubtypes = subtypeItems.filter(st => !linkedSubtypeIds.has(String(st.id)));
  const categoryMap = new Map();

  rootIngredients.forEach(ing => {
    const catRaw = ing.category || ing.cat || 'Other';
    const cat = catRaw.charAt(0).toUpperCase() + catRaw.slice(1);
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, []);
    }

    // Step 2: Ingredient Direct Matching with fuzzy matches across brand names, titles and sub-types
    const directProducts = prodList.filter(p => {
      const hasDirectIngredientId = (p.ingredientId && String(p.ingredientId) === String(ing.id)) || (p.ingredient_id && String(p.ingredient_id) === String(ing.id));
      const inIngProductIds = (Array.isArray(ing.productIds) && ing.productIds.map(String).includes(String(p.id))) || (Array.isArray(ing.products) && ing.products.map(String).includes(String(p.id)));
      
      const pIngSlug = slugify(p.ingredient || p.ingredientName || p.name || '');
      const ingNameSlug = slugify(ing.name);
      const brandSlug = slugify(p.brand || '');
      const ingAliasesSlugs = (Array.isArray(ing.aliases) ? ing.aliases : (ing.alias ? [ing.alias] : [])).map(slugify);

      const fuzzyMatch = (ingNameSlug && (pIngSlug.includes(ingNameSlug) || brandSlug === ingNameSlug)) || 
                         ingAliasesSlugs.some(s => s && pIngSlug.includes(s));

      return hasDirectIngredientId || inIngProductIds || fuzzyMatch;
    });

    // Step 1: Sub-Type Direct Matching with fuzzy matches
    const subtypes = (Array.isArray(ing.subtypes) ? ing.subtypes : []).map(st => {
      const stProducts = prodList.filter(p => {
        const hasDirectSubtypeId = (p.subtypeId && String(p.subtypeId) === String(st.id)) || (p.sub_type_id && String(p.sub_type_id) === String(st.id));
        const inSubtypeProductIds = Array.isArray(st.productIds) && st.productIds.map(String).includes(String(p.id));
        
        const pSubtypeSlug = slugify(p.subtypeName || p.type || p.name || '');
        const stNameSlug = slugify(st.name);
        const brandSlug = slugify(p.brand || '');
        const stAliasesSlugs = (Array.isArray(st.aliases) ? st.aliases : (st.alias ? [st.alias] : [])).map(slugify);

        const fuzzyMatch = (stNameSlug && (pSubtypeSlug.includes(stNameSlug) || brandSlug === stNameSlug)) ||
                           stAliasesSlugs.some(s => s && pSubtypeSlug.includes(s));

        return hasDirectSubtypeId || inSubtypeProductIds || fuzzyMatch;
      });

      const defaultProd = resolveDefaultProduct(st, stProducts);

      return {
        ...st,
        products: stProducts,
        defaultProduct: defaultProd
      };
    });

    // Step 3: Parent Ingredient Bubble-Up (Crucial)
    const allSubtypeProducts = [];
    subtypes.forEach(st => {
      st.products.forEach(p => {
        if (!allSubtypeProducts.some(existing => String(existing.id) === String(p.id))) {
          allSubtypeProducts.push(p);
        }
      });
    });

    const combinedProducts = [...directProducts];
    allSubtypeProducts.forEach(p => {
      if (!combinedProducts.some(existing => String(existing.id) === String(p.id))) {
        combinedProducts.push(p);
      }
    });

    const defaultProduct = resolveDefaultProduct(ing, combinedProducts);

    categoryMap.get(cat).push({
      ...ing,
      aliases: Array.isArray(ing.aliases) ? ing.aliases : (ing.alias ? [ing.alias] : []),
      subtypes,
      directProducts,
      products: combinedProducts,
      defaultProduct
    });
  });

  if (orphanSubtypes.length > 0) {
    const unlinkedCat = "Unlinked Sub-types";
    categoryMap.set(unlinkedCat, [{
      id: 'orphan-subtypes-container',
      name: 'Unlinked Sub-types',
      category: unlinkedCat,
      aliases: [],
      subtypes: orphanSubtypes.map(st => ({
        ...st,
        products: prodList.filter(p => (p.subtypeId && String(p.subtypeId) === String(st.id)) || (p.sub_type_id && String(p.sub_type_id) === String(st.id))),
        defaultProduct: resolveDefaultProduct(st, prodList)
      })),
      directProducts: [],
      products: [],
      defaultProduct: null
    }]);
  }

  return Array.from(categoryMap.entries())
    .map(([category, items]) => ({
      category,
      ingredients: items.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export async function aliasIngredient(ingredientId, aliasName) {
  const cleanAlias = (aliasName || '').trim();
  if (!ingredientId || !cleanAlias) return false;
  const state = getState() || {}, ings = [...(state.ingredients || [])], ing = ings.find(i => String(i.id) === String(ingredientId));
  if (!ing) return false;
  const existing = Array.isArray(ing.aliases) ? [...ing.aliases] : (ing.alias ? [ing.alias] : []);
  if (!existing.some(a => a.toLowerCase() === cleanAlias.toLowerCase())) existing.push(cleanAlias);
  ing.aliases = existing; ing.updatedAt = new Date().toISOString();
  setIngredients(ings); await saveIngredient(ing);
  return true;
}

export async function removeAlias(ingredientId, aliasToRemove) {
  const state = getState() || {}, ings = [...(state.ingredients || [])], ing = ings.find(i => String(i.id) === String(ingredientId));
  if (!ing || !Array.isArray(ing.aliases)) return false;
  ing.aliases = ing.aliases.filter(a => a.toLowerCase() !== (aliasToRemove || '').toLowerCase());
  ing.updatedAt = new Date().toISOString();
  setIngredients(ings); await saveIngredient(ing);
  return true;
}

export async function addSubtypeToIngredient(parentIngredientId, subtypeName, subtypeNotes = '') {
  const cleanName = (subtypeName || '').trim();
  if (!parentIngredientId || !cleanName) return false;
  const state = getState() || {}, ings = [...(state.ingredients || [])], ing = ings.find(i => String(i.id) === String(parentIngredientId));
  if (!ing) return false;
  const currentSubtypes = Array.isArray(ing.subtypes) ? [...ing.subtypes] : [];
  const newSubtype = { id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, name: cleanName, notes: subtypeNotes.trim(), aliases: [], defaultProductId: null, createdAt: new Date().toISOString() };
  currentSubtypes.push(newSubtype); ing.subtypes = currentSubtypes; ing.updatedAt = new Date().toISOString();
  setIngredients(ings); await saveIngredient(ing);
  return newSubtype;
}

export async function promoteToIngredient(subtypeId, parentIngredientId) {
  const state = getState() || {}, ings = [...(state.ingredients || [])], prods = [...(state.products || [])];
  const parent = ings.find(i => String(i.id) === String(parentIngredientId));
  if (!parent || !Array.isArray(parent.subtypes)) return false;
  const subtypeIndex = parent.subtypes.findIndex(s => String(s.id) === String(subtypeId));
  if (subtypeIndex < 0) return false;
  const [subtype] = parent.subtypes.splice(subtypeIndex, 1);
  parent.updatedAt = new Date().toISOString();
  const newIngredient = { id: subtype.id || `ing_${Date.now()}`, name: subtype.name, category: parent.category || 'Other', notes: subtype.notes || '', aliases: Array.isArray(subtype.aliases) ? subtype.aliases : [], subtypes: [], defaultProductId: subtype.defaultProductId || null, updatedAt: new Date().toISOString() };
  ings.push(newIngredient);
  const updatedProds = prods.map(p => {
    if (String(p.subtypeId) === String(subtypeId) || String(p.ingredientId) === String(subtypeId)) {
      return { ...p, ingredientId: newIngredient.id, subtypeId: null, updatedAt: new Date().toISOString() };
    }
    return p;
  });
  setIngredients(ings); setProducts(updatedProds);
  await Promise.all([
    saveIngredient(parent),
    saveIngredient(newIngredient),
    ...updatedProds.filter(p => String(p.ingredientId) === String(newIngredient.id)).map(p => saveProduct(p))
  ]);
  return true;
}

export async function demoteToSubtype(ingredientId, targetParentIngredientId) {
  const state = getState() || {}, ings = [...(state.ingredients || [])], prods = [...(state.products || [])];
  const sourceIdx = ings.findIndex(i => String(i.id) === String(ingredientId));
  const targetParent = ings.find(i => String(i.id) === String(targetParentIngredientId));
  if (sourceIdx < 0 || !targetParent) return false;
  const [source] = ings.splice(sourceIdx, 1);
  const targetSubtypes = Array.isArray(targetParent.subtypes) ? [...targetParent.subtypes] : [];
  const newSubtype = { id: source.id, name: source.name, notes: source.notes || '', aliases: Array.isArray(source.aliases) ? source.aliases : [], defaultProductId: source.defaultProductId || null, createdAt: new Date().toISOString() };
  targetSubtypes.push(newSubtype); targetParent.subtypes = targetSubtypes; targetParent.updatedAt = new Date().toISOString();
  const updatedProds = prods.map(p => {
    if (String(p.ingredientId) === String(source.id)) {
      return { ...p, ingredientId: targetParent.id, subtypeId: source.id, updatedAt: new Date().toISOString() };
    }
    return p;
  });
  setIngredients(ings); setProducts(updatedProds);
  await Promise.all([
    deleteIngredient(source.id),
    saveIngredient(targetParent),
    ...updatedProds.filter(p => String(p.subtypeId) === String(source.id)).map(p => saveProduct(p))
  ]);
  return true;
}

export async function mergeIngredients(sourceId, targetId) {
  const state = getState() || {}, ings = [...(state.ingredients || [])], prods = [...(state.products || [])];
  const sourceIdx = ings.findIndex(i => String(i.id) === String(sourceId));
  const target = ings.find(i => String(i.id) === String(targetId));
  if (sourceIdx < 0 || !target || String(sourceId) === String(targetId)) return false;
  const [source] = ings.splice(sourceIdx, 1);
  const targetAliases = new Set(Array.isArray(target.aliases) ? target.aliases : []);
  if (source.name) targetAliases.add(source.name);
  if (Array.isArray(source.aliases)) source.aliases.forEach(a => targetAliases.add(a));
  target.aliases = Array.from(targetAliases);
  const targetSubtypes = Array.isArray(target.subtypes) ? [...target.subtypes] : [];
  if (Array.isArray(source.subtypes)) source.subtypes.forEach(st => targetSubtypes.push(st));
  target.subtypes = targetSubtypes; target.updatedAt = new Date().toISOString();
  const updatedProds = prods.map(p => {
    if (String(p.ingredientId) === String(source.id) || String(p.groupId) === String(source.id)) {
      return { ...p, ingredientId: target.id, updatedAt: new Date().toISOString() };
    }
    return p;
  });
  setIngredients(ings); setProducts(updatedProds);
  await Promise.all([
    deleteIngredient(source.id),
    saveIngredient(target),
    ...updatedProds.filter(p => String(p.ingredientId) === String(target.id)).map(p => saveProduct(p))
  ]);
  return true;
}

export async function reallocateProduct(productId, newIngredientId, newSubtypeId = null, newCategory = null) {
  const state = getState() || {}, prods = [...(state.products || [])], ings = state.ingredients || [];
  const prod = prods.find(p => String(p.id) === String(productId));
  if (!prod) return false;
  const targetIng = ings.find(i => String(i.id) === String(newIngredientId));
  prod.ingredientId = newIngredientId || null; prod.subtypeId = newSubtypeId || null;
  if (newCategory) prod.category = newCategory;
  else if (targetIng?.category) prod.category = targetIng.category;
  prod.updatedAt = new Date().toISOString();
  setProducts(prods); await saveProduct(prod);
  return true;
}

export async function setAutoDefaultProduct(productId, parentIngredientId, subtypeId = null) {
  const state = getState() || {}, prods = [...(state.products || [])], ings = [...(state.ingredients || [])];
  const parent = ings.find(i => String(i.id) === String(parentIngredientId));
  if (parent) {
    if (subtypeId && Array.isArray(parent.subtypes)) {
      const st = parent.subtypes.find(s => String(s.id) === String(subtypeId));
      if (st) st.defaultProductId = productId;
    } else parent.defaultProductId = productId;
    parent.updatedAt = new Date().toISOString(); await saveIngredient(parent);
  }
  const updatedProds = prods.map(p => {
    if (String(p.ingredientId) === String(parentIngredientId) || String(p.subtypeId) === String(subtypeId)) {
      return { ...p, isAutoDefault: String(p.id) === String(productId), updatedAt: new Date().toISOString() };
    }
    return p;
  });
  setIngredients(ings); setProducts(updatedProds);
  const targetProd = updatedProds.find(p => String(p.id) === String(productId));
  if (targetProd) await saveProduct(targetProd);
  return true;
}
