/**
 * src/utils/RecipeAuditService.js (v3.30.0)
 * Diagnostic and repair utility for Recipe Mapping & Master Catalog relational integrity.
 * Audits recipes for orphaned IDs, legacy strings, and unlinked ingredients.
 */

import { getState, setRecipes } from '../store/store.js';
import { saveRecipe, batchUpdateRecipesInDb } from '../services/HouseholdRepository.js';

/**
 * Normalizes text for comparison.
 */
function normalizeText(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

/**
 * Calculates dice similarity coefficient.
 */
function calculateSimilarity(str1, str2) {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const intersection = words1.filter(w => words2.includes(w) && w.length > 2);
  if (intersection.length > 0) {
    return (2.0 * intersection.length) / (words1.length + words2.length);
  }
  return 0;
}

/**
 * Suggests best Master Catalog item or sub-type for a raw ingredient name.
 */
export function findBestCatalogMatch(rawName, ingredients = []) {
  if (!rawName || !Array.isArray(ingredients)) return null;
  const target = normalizeText(rawName);
  let bestMatch = null;
  let highestScore = 0;

  for (const ing of ingredients) {
    if (!ing || !ing.name) continue;
    const ingScore = calculateSimilarity(target, ing.name);
    if (ingScore > highestScore) {
      highestScore = ingScore;
      bestMatch = {
        ingredientId: ing.id,
        ingredientName: ing.name,
        category: ing.category || 'Pantry',
        subtypeId: null,
        subtypeName: null,
        displayName: ing.name,
        score: ingScore
      };
    }

    if (Array.isArray(ing.subtypes)) {
      for (const sub of ing.subtypes) {
        if (!sub || !sub.name) continue;
        const subScore = calculateSimilarity(target, `${ing.name} ${sub.name}`);
        if (subScore > highestScore) {
          highestScore = subScore;
          bestMatch = {
            ingredientId: ing.id,
            ingredientName: ing.name,
            category: ing.category || 'Pantry',
            subtypeId: sub.id,
            subtypeName: sub.name,
            displayName: `${ing.name} ➔ ${sub.name}`,
            score: subScore
          };
        }
      }
    }
  }

  return highestScore >= 0.5 ? bestMatch : null;
}

/**
 * Audits every recipe in state.recipes against state.ingredients and nested subtypes.
 * Identifies:
 *  a. Orphaned references (ingredientId or subtypeId not found in state).
 *  b. Legacy string-only ingredients lacking valid relational IDs.
 *  c. Mismatched or unlinked items.
 */
export function auditRecipeMappings(stateData = null) {
  const state = stateData ;
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];

  const ingredientById = new Map();
  const subtypeMap = new Map();

  ingredients.forEach(ing => {
    if (ing && ing.id) {
      ingredientById.set(String(ing.id), ing);
      if (Array.isArray(ing.subtypes)) {
        ing.subtypes.forEach(sub => {
          if (sub && sub.id) {
            subtypeMap.set(String(sub.id), { subtype: sub, parentId: String(ing.id), parentName: ing.name });
          }
        });
      }
    }
  });

  const issues = [];

  recipes.forEach(recipe => {
    if (!recipe || typeof recipe !== 'object') return;
    const rawIngs = (recipe.ingredientSections && recipe.ingredientSections.length > 0)
      ? recipe.ingredientSections.flatMap(s => s.ingredients || [])
      : (Array.isArray(recipe.ingredients) ? recipe.ingredients : (recipe.recipe?.ingredients || recipe.parsedIngredients || []));
    const items = Array.isArray(rawIngs) ? rawIngs : (typeof rawIngs === 'object' ? Object.values(rawIngs) : []);

    items.forEach((item, index) => {
      let issueType = null;
      let message = '';
      let itemName = '';
      let currentIngredientId = null;
      let currentSubtypeId = null;
      let currentIngredientName = null;

      if (typeof item === 'string') {
        issueType = 'legacy_string';
        itemName = item.trim();
        message = 'Legacy string format lacking relational IDs.';
      } else if (item && typeof item === 'object') {
        itemName = String(item.name || item.ingredient || item.ingredientName || 'Unnamed Ingredient').trim();
        currentIngredientId = item.ingredientId || null;
        currentSubtypeId = item.subtypeId || item.subTypeId || null;
        let currentCategoryId = item.categoryId || (item.cat ? String(item.cat) : null);

        if (currentIngredientId && String(currentIngredientId).startsWith('cat:')) {
          currentCategoryId = String(currentIngredientId).replace('cat:', '');
          currentIngredientId = null;
        }

        if (!currentIngredientId && !currentSubtypeId && !currentCategoryId) {
          issueType = 'unlinked';
          message = 'Ingredient lacks Master Catalog link.';
        } else if (currentIngredientId && !ingredientById.has(String(currentIngredientId))) {
          issueType = 'orphaned';
          message = `Orphaned ingredient ID "${currentIngredientId}" not in Master Catalog.`;
        } else if (currentIngredientId && ingredientById.has(String(currentIngredientId))) {
          const parent = ingredientById.get(String(currentIngredientId));
          currentIngredientName = parent.name;
          if (currentSubtypeId) {
            const hasSub = Array.isArray(parent.subtypes) && parent.subtypes.some(s => String(s.id) === String(currentSubtypeId));
            if (!hasSub) {
              issueType = 'orphaned';
              message = `Sub-type ID "${currentSubtypeId}" does not exist under "${parent.name}".`;
            }
          }
        } else if (currentSubtypeId && !subtypeMap.has(String(currentSubtypeId))) {
          issueType = 'orphaned';
          message = `Orphaned sub-type ID "${currentSubtypeId}".`;
        }
      }

      if (issueType) {
        const suggestion = findBestCatalogMatch(itemName, ingredients);
        issues.push({
          id: `audit_issue_${recipe.id}_${index}`,
          recipeId: String(recipe.id),
          recipeName: recipe.name || recipe.title || 'Untitled Recipe',
          itemIndex: index,
          itemRaw: item,
          itemName,
          qty: typeof item === 'object' ? (item.qty ?? item.amount ?? '') : '',
          unit: typeof item === 'object' ? (item.unit ?? item.measure ?? '') : '',
          currentIngredientId,
          currentSubtypeId,
          currentIngredientName,
          issueType,
          message,
          suggestedMatch: suggestion
        });
      }
    });
  });

  const flaggedRecipeIds = new Set(issues.map(i => i.recipeId));

  return {
    issues,
    summary: {
      totalRecipes: recipes.length,
      flaggedRecipesCount: flaggedRecipeIds.size,
      cleanRecipesCount: Math.max(0, recipes.length - flaggedRecipeIds.size),
      orphanedCount: issues.filter(i => i.issueType === 'orphaned').length,
      legacyCount: issues.filter(i => i.issueType === 'legacy_string').length,
      unlinkedCount: issues.filter(i => i.issueType === 'unlinked').length,
      mismatchedCount: issues.filter(i => i.issueType === 'mismatched').length,
      totalIssues: issues.length
    }
  };
}

/**
 * Transforms an ingredient line with new catalog mapping and strips legacy identifiers.
 */
function applyRelinkToIngredient(item, { isCat, catName, parentIng, effectiveIngName, effectiveSubName, newIngredientId, newSubtypeId, effQty, effUnit }) {
  const updated = {
    ...item,
    name: isCat ? (item.name || catName) : (effectiveSubName ? `${effectiveIngName} (${effectiveSubName})` : effectiveIngName),
    ingredientName: isCat ? '' : effectiveIngName,
    ingredientId: isCat ? null : (newIngredientId ? String(newIngredientId) : null),
    pantryItemId: isCat ? null : (newIngredientId ? String(newIngredientId) : null),
    categoryId: isCat ? catName : (parentIng?.category || item.categoryId || null),
    cat: isCat ? catName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : (parentIng?.category || item.cat || null),
    subtypeId: isCat ? null : (newSubtypeId ? String(newSubtypeId) : null),
    subtypeName: isCat ? null : (effectiveSubName || null),
    qty: effQty,
    unit: effUnit
  };
  delete updated.subTypeId;
  delete updated.productId;
  delete updated.bankId;
  delete updated.needsSubtypeMapping;
  return updated;
}

/**
 * Synchronizes an ingredient mapping fix across all recipe structures
 * (sections, flat list, enhanced sections, and enhanced flat list).
 */
function applyFixToRecipe(recipe, fix, ingredients) {
  const isCat = String(fix.newIngredientId || '').startsWith('cat:');
  const catName = isCat ? String(fix.newIngredientId).replace('cat:', '') : '';
  const parentIng = !isCat ? ingredients.find(i => String(i.id) === String(fix.newIngredientId)) : null;
  const subType = parentIng && fix.newSubtypeId && Array.isArray(parentIng.subtypes)
    ? parentIng.subtypes.find(s => String(s.id) === String(fix.newSubtypeId))
    : null;

  const effectiveIngName = isCat ? catName : (parentIng?.name || fix.newIngredientName || '');
  const effectiveSubName = isCat ? '' : (subType?.name || fix.newSubtypeName || '');

  const normTarget = normalizeText(fix.itemName);
  const matchesItem = (item, idx) => {
    if (!item) return false;
    if (normTarget) {
      const itemNorm = normalizeText(item.name || item.raw || item.ingredientName || '');
      if (itemNorm === normTarget || (normTarget.length > 3 && (itemNorm.includes(normTarget) || normTarget.includes(itemNorm)))) {
        return true;
      }
    }
    if (fix.originalSubtypeId && String(item.subtypeId || item.subTypeId || '') === String(fix.originalSubtypeId)) {
      return true;
    }
    if (fix.originalIngredientId && String(item.ingredientId || item.pantryItemId || '') === String(fix.originalIngredientId)) {
      return true;
    }
    return idx === fix.itemIndex;
  };

  let fixApplied = false;

  // 1. Synchronize sections if present
  if (Array.isArray(recipe.ingredientSections) && recipe.ingredientSections.length) {
    let gIdx = 0;
    for (const sec of recipe.ingredientSections) {
      if (!Array.isArray(sec.ingredients)) continue;
      for (let i = 0; i < sec.ingredients.length; i++) {
        const item = sec.ingredients[i];
        if (matchesItem(item, gIdx)) {
          const origQty = typeof item === 'object' ? (item.qty ?? item.amount ?? 1) : 1;
          const origUnit = typeof item === 'object' ? (item.unit ?? item.measure ?? 'g') : 'g';
          const effQty = fix.qty !== null && fix.qty !== undefined && fix.qty !== '' ? Number(fix.qty) || fix.qty : origQty;
          const effUnit = fix.unit !== null && fix.unit !== undefined && fix.unit !== '' ? fix.unit : origUnit;

          sec.ingredients[i] = applyRelinkToIngredient(item, {
            isCat, catName, parentIng, effectiveIngName, effectiveSubName,
            newIngredientId: fix.newIngredientId, newSubtypeId: fix.newSubtypeId,
            effQty, effUnit
          });
          fixApplied = true;
        }
        gIdx++;
      }
    }
  }

  // 2. Synchronize flat ingredients if present
  if (Array.isArray(recipe.ingredients)) {
    for (let i = 0; i < recipe.ingredients.length; i++) {
      const item = recipe.ingredients[i];
      if (matchesItem(item, i)) {
        const origQty = typeof item === 'object' ? (item.qty ?? item.amount ?? 1) : 1;
        const origUnit = typeof item === 'object' ? (item.unit ?? item.measure ?? 'g') : 'g';
        const effQty = fix.qty !== null && fix.qty !== undefined && fix.qty !== '' ? Number(fix.qty) || fix.qty : origQty;
        const effUnit = fix.unit !== null && fix.unit !== undefined && fix.unit !== '' ? fix.unit : origUnit;

        recipe.ingredients[i] = applyRelinkToIngredient(item, {
          isCat, catName, parentIng, effectiveIngName, effectiveSubName,
          newIngredientId: fix.newIngredientId, newSubtypeId: fix.newSubtypeId,
          effQty, effUnit
        });
        fixApplied = true;
      }
    }
  }

  // 3. Synchronize enhanced variant if present
  if (recipe.enhanced && typeof recipe.enhanced === 'object') {
    if (Array.isArray(recipe.enhanced.ingredientSections)) {
      let egIdx = 0;
      for (const sec of recipe.enhanced.ingredientSections) {
        if (!Array.isArray(sec.ingredients)) continue;
        for (let i = 0; i < sec.ingredients.length; i++) {
          const item = sec.ingredients[i];
          if (matchesItem(item, egIdx)) {
            const origQty = typeof item === 'object' ? (item.qty ?? item.amount ?? 1) : 1;
            const origUnit = typeof item === 'object' ? (item.unit ?? item.measure ?? 'g') : 'g';
            const effQty = fix.qty !== null && fix.qty !== undefined && fix.qty !== '' ? Number(fix.qty) || fix.qty : origQty;
            const effUnit = fix.unit !== null && fix.unit !== undefined && fix.unit !== '' ? fix.unit : origUnit;

            sec.ingredients[i] = applyRelinkToIngredient(item, {
              isCat, catName, parentIng, effectiveIngName, effectiveSubName,
              newIngredientId: fix.newIngredientId, newSubtypeId: fix.newSubtypeId,
              effQty, effUnit
            });
            fixApplied = true;
          }
          egIdx++;
        }
      }
    }
    if (Array.isArray(recipe.enhanced.ingredients)) {
      for (let i = 0; i < recipe.enhanced.ingredients.length; i++) {
        const item = recipe.enhanced.ingredients[i];
        if (matchesItem(item, i)) {
          const origQty = typeof item === 'object' ? (item.qty ?? item.amount ?? 1) : 1;
          const origUnit = typeof item === 'object' ? (item.unit ?? item.measure ?? 'g') : 'g';
          const effQty = fix.qty !== null && fix.qty !== undefined && fix.qty !== '' ? Number(fix.qty) || fix.qty : origQty;
          const effUnit = fix.unit !== null && fix.unit !== undefined && fix.unit !== '' ? fix.unit : origUnit;

          recipe.enhanced.ingredients[i] = applyRelinkToIngredient(item, {
            isCat, catName, parentIng, effectiveIngName, effectiveSubName,
            newIngredientId: fix.newIngredientId, newSubtypeId: fix.newSubtypeId,
            effQty, effUnit
          });
          fixApplied = true;
        }
      }
    }
  }

  return fixApplied;
}

/**
 * Relinks a single recipe ingredient item to the Master Catalog.
 */
export async function relinkRecipeIngredient({ recipeId, itemIndex, itemName = '', originalIngredientId = null, originalSubtypeId = null, newIngredientId, newSubtypeId = null, newIngredientName = '', newSubtypeName = '', qty = null, unit = null }) {
  const state = getState();
  const recipes = Array.isArray(state.recipes) ? [...state.recipes] : [];
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];

  const recIndex = recipes.findIndex(r => String(r.id) === String(recipeId));
  if (recIndex < 0) {
    throw new Error(`Recipe ID "${recipeId}" not found in state.`);
  }

  const recipe = JSON.parse(JSON.stringify(recipes[recIndex]));
  const fixApplied = applyFixToRecipe(recipe, {
    itemIndex,
    itemName,
    originalIngredientId,
    originalSubtypeId,
    newIngredientId,
    newSubtypeId,
    newIngredientName,
    newSubtypeName,
    qty,
    unit
  }, ingredients);

  if (!fixApplied) {
    throw new Error(`Target ingredient could not be resolved for recipe "${recipe.name}".`);
  }

  recipe.updatedAt = new Date().toISOString();

  // Optimistic store update
  recipes[recIndex] = recipe;
  setRecipes(recipes);

  if (typeof document !== 'undefined' && typeof CustomEvent !== 'undefined') {
    document.dispatchEvent(new CustomEvent('plateplan:state:recipes', { detail: recipes }));
    document.dispatchEvent(new CustomEvent('plateplan:recipes-updated', { detail: recipes }));
  }

  // Firestore write
  await saveRecipe(recipe);
  return { success: true, recipe };
}

/**
 * Batch relinks multiple recipe ingredient mapping issues atomically.
 * Updates in-memory store and commits all modified recipes in 1 atomic Firestore batch.
 */
export async function batchRelinkRecipeMappings(fixes = []) {
  if (!Array.isArray(fixes) || fixes.length === 0) return { success: true, count: 0, modifiedCount: 0 };
  const state = getState();
  const recipes = Array.isArray(state.recipes) ? [...state.recipes] : [];
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];

  const recipeMap = new Map();
  recipes.forEach(r => { if (r?.id) recipeMap.set(String(r.id), JSON.parse(JSON.stringify(r))); });

  let appliedCount = 0;
  const modifiedRecipeIds = new Set();

  for (const fix of fixes) {
    const rId = String(fix.recipeId);
    const recipe = recipeMap.get(rId);
    if (!recipe) continue;

    const fixApplied = applyFixToRecipe(recipe, fix, ingredients);
    if (fixApplied) {
      recipe.updatedAt = new Date().toISOString();
      modifiedRecipeIds.add(rId);
      appliedCount++;
    }
  }

  const modifiedRecipes = Array.from(modifiedRecipeIds).map(id => recipeMap.get(id));
  const updatedAllRecipes = recipes.map(r => recipeMap.get(String(r.id)) || r);

  // Optimistic local state update
  setRecipes(updatedAllRecipes);
  if (typeof document !== 'undefined' && typeof CustomEvent !== 'undefined') {
    document.dispatchEvent(new CustomEvent('plateplan:state:recipes', { detail: updatedAllRecipes }));
    document.dispatchEvent(new CustomEvent('plateplan:recipes-updated', { detail: updatedAllRecipes }));
  }

  // Atomic 1-batch Firestore commit
  try {
    await batchUpdateRecipesInDb(modifiedRecipes);
  } catch (err) {
    console.error('[RecipeAuditService] Batch commit failed:', err);
    throw err;
  }

  return { success: true, count: appliedCount, modifiedCount: modifiedRecipes.length };
}
