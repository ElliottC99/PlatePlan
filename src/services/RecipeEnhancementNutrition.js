/**
 * src/services/RecipeEnhancementNutrition.js
 * Taxonomy resolution, quantity quantization, ingredient role classification,
 * target macro resolution, and batch macro calculation for recipe enhancement.
 */

import { getState } from "../store/coreState.js";
import { getTarget } from "../utils/fitScoreCalculator.js";
import { calculateItemNutrition, normalizeEnergyKcal, resolveProductItemWeight, classifyIngredientRole } from "./NutritionService.js";
export { classifyIngredientRole };
import { toGrams } from "./UnitConversionService.js";
import { resolveProductForIngredient } from "../components/recipe/RecipeWizardStep3Handlers.js";

/**
 * Resolves full Pantry Bank taxonomy (Category / Root Item / Sub-type) and Linked Product.
 */
export function resolvePantryTaxonomy(item, { ingredients = [], products = [] } = {}) {
  if (!item || typeof item !== 'object') {
    return { category: 'General', rootItem: 'Unknown', subtype: 'Standard', productName: 'None' };
  }

  // 1. Resolve product
  let prod = item._matchedProduct || null;
  if (!prod && item.productId) {
    prod = products.find(p => String(p.id) === String(item.productId));
  }
  if (!prod && item.bankId) {
    prod = products.find(p => String(p.id) === String(item.bankId));
  }
  if (!prod && item.productName) {
    prod = products.find(p => p.name && p.name.toLowerCase() === String(item.productName).toLowerCase());
  }
  if (!prod) {
    prod = resolveProductForIngredient(item, { products, ingredients });
  }

  // 2. Resolve root ingredient
  let rootIng = null;
  if (item.ingredientId) {
    rootIng = ingredients.find(i => String(i.id) === String(item.ingredientId));
  }
  if (!rootIng && prod?.ingredientId) {
    rootIng = ingredients.find(i => String(i.id) === String(prod.ingredientId));
  }
  if (!rootIng && (prod?.groupId || item.groupId)) {
    const gId = prod?.groupId || item.groupId;
    rootIng = ingredients.find(i => String(i.groupId || i.id) === String(gId));
  }
  if (!rootIng && item.name) {
    const cleanName = String(item.name).trim().toLowerCase();
    rootIng = ingredients.find(i => i.name && (i.name.toLowerCase() === cleanName || cleanName.includes(i.name.toLowerCase())));
  }

  // 3. Resolve subtype
  let subtypeName = item.subtypeName || null;
  if (!subtypeName && item.subtypeId && rootIng?.subtypes) {
    const st = rootIng.subtypes.find(s => String(s.id) === String(item.subtypeId));
    if (st) subtypeName = st.name;
  }
  if (!subtypeName && prod?.subtypeId && rootIng?.subtypes) {
    const st = rootIng.subtypes.find(s => String(s.id) === String(prod.subtypeId));
    if (st) subtypeName = st.name;
  }
  if (!subtypeName) {
    if (rootIng?.name && item.name && rootIng.name.toLowerCase() !== item.name.toLowerCase()) {
      subtypeName = item.name;
    } else {
      subtypeName = 'Standard';
    }
  }

  const category = rootIng?.category || prod?.category || item.category || 'General';
  const rootItem = rootIng?.name || item.name || 'Unknown';
  const productName = prod?.name || item.productName || item.productMatch?.name || 'Default Product';

  return {
    category,
    rootItem,
    subtype: subtypeName,
    productName,
    productId: prod?.id || item.productId || null,
    ingredientId: rootIng?.id || item.ingredientId || null,
    subtypeId: prod?.subtypeId || item.subtypeId || null
  };
}

/**
 * Resolves post-swap Pantry Bank taxonomy (Category / Root Item / Sub-type) and Linked Product.
 */
export function resolvePantryTaxonomyForSwap(swap, originalItem, { ingredients = [], products = [] } = {}) {
  const searchRegex = swap.productSearchRegex || new RegExp(swap.swapTo.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
  const matchedProd = products.find(p => p.name && searchRegex.test(p.name));

  if (matchedProd) {
    let rootIng = null;
    if (matchedProd.ingredientId) {
      rootIng = ingredients.find(i => String(i.id) === String(matchedProd.ingredientId));
    }
    if (!rootIng && matchedProd.groupId) {
      rootIng = ingredients.find(i => String(i.groupId || i.id) === String(matchedProd.groupId));
    }

    let subtypeName = null;
    if (matchedProd.subtypeId && rootIng?.subtypes) {
      const st = rootIng.subtypes.find(s => String(s.id) === String(matchedProd.subtypeId));
      if (st) subtypeName = st.name;
    }
    if (!subtypeName) {
      subtypeName = swap.targetTaxonomy?.subtype || swap.swapTo;
    }

    return {
      category: matchedProd.category || rootIng?.category || swap.targetTaxonomy?.category || 'Store Cupboard',
      rootItem: rootIng?.name || swap.targetTaxonomy?.rootItem || swap.swapTo,
      subtype: subtypeName,
      productName: matchedProd.name,
      productId: matchedProd.id,
      ingredientId: rootIng?.id || null,
      subtypeId: matchedProd.subtypeId || null
    };
  }

  const matchedIng = ingredients.find(i => i.name && searchRegex.test(i.name));
  if (matchedIng) {
    let defProd = null;
    if (matchedIng.defaultProductId) {
      defProd = products.find(p => String(p.id) === String(matchedIng.defaultProductId));
    }
    return {
      category: matchedIng.category || swap.targetTaxonomy?.category || 'Store Cupboard',
      rootItem: matchedIng.name,
      subtype: swap.targetTaxonomy?.subtype || 'Standard',
      productName: defProd?.name || swap.targetTaxonomy?.productName || swap.swapTo,
      productId: defProd?.id || null,
      ingredientId: matchedIng.id,
      subtypeId: null
    };
  }

  if (swap.targetTaxonomy) {
    return { ...swap.targetTaxonomy };
  }

  return {
    category: 'Store Cupboard',
    rootItem: swap.swapTo,
    subtype: 'Standard',
    productName: swap.swapTo,
    productId: null,
    ingredientId: null,
    subtypeId: null
  };
}

/**
 * Quantizes ingredient quantities to natural culinary increments.
 */
export function quantizeQuantity(qty, unit = 'g') {
  const num = Number(qty);
  if (!Number.isFinite(num) || num <= 0) return 0;
  const u = String(unit || 'g').trim().toLowerCase().replace(/s$/, '');

  if (u === 'g' || u === 'ml') {
    if (num < 50) return Math.max(5, Math.round(num / 5) * 5);
    return Math.round(num / 10) * 10;
  }
  if (u === 'tbsp' || u === 'tsp' || u === 'tablespoon' || u === 'teaspoon') {
    return Math.max(0.5, Math.round(num * 2) / 2);
  }
  if (u === 'can' || u === 'tin' || u === 'pack' || u === 'pot') {
    return Math.max(0.5, Math.round(num * 2) / 2);
  }
  if (u === 'qty' || u === 'piece' || u === 'clove' || u === 'item' || u === 'egg' || u === 'breast' || u === 'fillet') {
    if (num <= 1) return 1;
    return Math.round(num);
  }
  return Math.round(num * 10) / 10;
}

/**
 * Resolves specific macro targets for a recipe based on its audience and meal type.
 */
export function resolveRecipeTargets(recipe, options = {}) {
  const winState = typeof getState === 'function' ? (getState() || {}) : {};
  const rawProfiles = options?.userPrefs?.profiles || winState.preferences?.profiles || winState.userPrefs?.profiles || {};
  const eRaw = rawProfiles.elliott || rawProfiles.e || {};
  const cRaw = rawProfiles.chloe || rawProfiles.c || {};

  const profileE = {
    ...eRaw,
    dailyKcal: Number(eRaw.dailyKcal ?? 2100) || 2100,
    dailyProtein: Number(eRaw.dailyProtein ?? 140) || 140
  };
  const profileC = {
    ...cRaw,
    dailyKcal: Number(cRaw.dailyKcal ?? 1650) || 1650,
    dailyProtein: Number(cRaw.dailyProtein ?? 105) || 105
  };

  const mealType = String(options.mealType || recipe?.mealSuitability?.[0] || recipe?.types?.[0] || recipe?.type || 'dinner').toLowerCase();
  const who = String(options.activeProfile || recipe?.who || 'both').toLowerCase();

  const eTargetKcal = getTarget(profileE, 'kcal', mealType) || 735;
  const eTargetProt = getTarget(profileE, 'protein', mealType) || 49;
  const cTargetKcal = getTarget(profileC, 'kcal', mealType) || 578;
  const cTargetProt = getTarget(profileC, 'protein', mealType) || 37;

  let targetKcal = 656;
  let targetProt = 43;

  if (who === 'elliott' || who === 'e') {
    targetKcal = Math.round(eTargetKcal);
    targetProt = Math.round(eTargetProt);
  } else if (who === 'chloe' || who === 'c') {
    targetKcal = Math.round(cTargetKcal);
    targetProt = Math.round(cTargetProt);
  } else {
    // Weighted household batch targets
    const totalDaily = profileE.dailyKcal + profileC.dailyKcal;
    const shareE = totalDaily > 0 ? (profileE.dailyKcal / totalDaily) : 0.56;
    const shareC = totalDaily > 0 ? (profileC.dailyKcal / totalDaily) : 0.44;
    targetKcal = Math.round((eTargetKcal * shareE) + (cTargetKcal * shareC));
    targetProt = Math.round((eTargetProt * shareE) + (cTargetProt * shareC));
  }

  return {
    mealType,
    who,
    targetKcal,
    targetProt,
    minKcal: Math.round(targetKcal * 0.85),
    maxKcal: Math.round(targetKcal * 1.05),
    minProt: Math.round(targetProt * 0.95),
    maxProt: Math.round(targetProt * 1.30)
  };
}

/**
 * Recursively maps and updates ingredients while preserving sections.
 */
export function cloneAndTraverseIngredients(recipe, mutatorFn) {
  let hasSections = Array.isArray(recipe.ingredientSections) && recipe.ingredientSections.length > 0;
  
  if (hasSections) {
    const updatedSections = recipe.ingredientSections.map(sec => ({
      ...sec,
      ingredients: (sec.ingredients || []).map(ing => mutatorFn({ ...ing }))
    }));
    const flatIngredients = updatedSections.flatMap(s => s.ingredients);
    return { ingredientSections: updatedSections, ingredients: flatIngredients };
  }

  const flatList = (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map(ing => mutatorFn({ ...ing }));
  return { ingredientSections: [], ingredients: flatList };
}

/**
 * Calculates per-serving macros for an ingredient list.
 */
export function calculateBatchMacros(ingredients, serves, { products = [], allIngredients = [] }) {
  let totalCal = 0, totalProt = 0, totalCarb = 0, totalFat = 0;

  ingredients.forEach(item => {
    if (!item || item.excludeNutrition) return;
    const matched = resolveProductForIngredient(item, { products, ingredients: allIngredients });
    if (matched) {
      const q = Number(item.qty ?? item.amount ?? 1) || 1;
      const u = item.unit || 'g';
      const nut = calculateItemNutrition(matched, q, u);
      totalCal += (nut.kcal ?? nut.cal ?? 0);
      totalProt += (nut.protein ?? nut.prot ?? 0);
      totalCarb += (nut.carbs ?? nut.carb ?? 0);
      totalFat += (nut.fat ?? 0);
    }
  });

  const s = Math.max(1, Number(serves) || 2);
  return {
    total: { cal: Math.round(totalCal), prot: Math.round(totalProt), carb: Math.round(totalCarb), fat: Math.round(totalFat) },
    perServing: {
      calories: Math.round(totalCal / s),
      protein: Math.round((totalProt / s) * 10) / 10,
      carbs: Math.round((totalCarb / s) * 10) / 10,
      fat: Math.round((totalFat / s) * 10) / 10,
      cal: Math.round(totalCal / s),
      prot: Math.round((totalProt / s) * 10) / 10
    }
  };
}
