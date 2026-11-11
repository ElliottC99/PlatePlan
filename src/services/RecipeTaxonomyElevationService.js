/**
 * src/services/RecipeTaxonomyElevationService.js
 * Domain service for retrospective recipe taxonomy level elevation.
 * Handles reverse-engineering auto-default collisions, candidate partitioning,
 * atomic pointer stripping, and synchronized macro/fit score recalculation.
 * Pure browser-safe ES6 module with zero Node.js dependencies.
 */

import { HOUSEHOLD_ID } from '../config/firebase.js';
import { getState, setRecipes, saveStateCache } from '../store/store.js';
import { compareProductsByStrategy } from './PantryHierarchyService.js';
import { resolveDynamicProductForIngredient } from './PantryTaxonomyService.js';
import { calculateItemNutrition } from './NutritionService.js';
import { calculateMealFitScore } from '../utils/fitScoreCalculator.js';
import { batchUpdateRecipesInDb } from './HouseholdRepository.js';
import { invalidateHierarchyCache } from '../models/PantryHierarchyModel.js';

export { HOUSEHOLD_ID };

/**
 * Resolves the effective auto-default product for a target (Root Item or Sub-type),
 * identifying whether it was explicitly assigned or strategy-derived.
 * @param {Object} target - Root item or sub-type
 * @param {Array} products - Products list
 * @param {string} criterion - Sorting criterion (e.g. 'highest_protein_per_kcal')
 * @returns {{ product: Object|null, matchType: 'explicit_default'|'strategy_rank' }}
 */
export function resolveEffectiveDefaultProduct(target, products = [], criterion = 'highest_protein_per_kcal') {
  if (!target) return { product: null, matchType: 'strategy_rank' };
  const list = Array.isArray(products) ? products : [];

  // 1. Explicit defaultProductId on the entity
  if (target.defaultProductId) {
    const explicit = list.find(p => String(p.id) === String(target.defaultProductId));
    if (explicit) return { product: explicit, matchType: 'explicit_default' };
  }

  // 2. Candidate pool linked to this entity or its sub-types
  const subIds = new Set((target.subtypes || []).map(s => String(s.id)));
  const pool = list.filter(p =>
    String(p.ingredientId) === String(target.id) ||
    String(p.subtypeId) === String(target.id) ||
    (p.subtypeId && subIds.has(String(p.subtypeId)))
  );

  if (pool.length === 0) return { product: null, matchType: 'strategy_rank' };

  // Explicit isAutoDefault flag on product
  const explicitAuto = pool.find(p => p && p.isAutoDefault);
  if (explicitAuto) return { product: explicitAuto, matchType: 'explicit_default' };

  // Strategy sorting
  const sorted = [...pool].sort((a, b) => compareProductsByStrategy(a, b, criterion));
  return { product: sorted[0] || null, matchType: 'strategy_rank' };
}

/**
 * Resolves the effective auto-default product for an entire Category.
 * @param {string} categoryName
 * @param {Array} ingredients
 * @param {Array} products
 * @param {string} criterion
 * @returns {{ product: Object|null, rootItem: Object|null, subtype: Object|null, matchType: 'explicit_default'|'strategy_rank' }}
 */
export function resolveCategoryDefaultProduct(categoryName, ingredients = [], products = [], criterion = 'highest_protein_per_kcal') {
  if (!categoryName) return { product: null, rootItem: null, subtype: null, matchType: 'strategy_rank' };
  const normCat = String(categoryName).trim().toLowerCase();
  const roots = (ingredients || []).filter(i => String(i?.category || '').trim().toLowerCase() === normCat);

  if (roots.length === 0) return { product: null, rootItem: null, subtype: null, matchType: 'strategy_rank' };

  const rootIds = new Set(roots.map(r => String(r.id)));
  const subIds = new Set();
  roots.forEach(r => (r.subtypes || []).forEach(s => subIds.add(String(s.id))));

  const pool = (products || []).filter(p =>
    (p.ingredientId && rootIds.has(String(p.ingredientId))) ||
    (p.subtypeId && subIds.has(String(p.subtypeId)))
  );

  if (pool.length === 0) return { product: null, rootItem: null, subtype: null, matchType: 'strategy_rank' };

  const explicitAuto = pool.find(p => p && p.isAutoDefault);
  const bestProd = explicitAuto || [...pool].sort((a, b) => compareProductsByStrategy(a, b, criterion))[0];
  const matchType = explicitAuto ? 'explicit_default' : 'strategy_rank';

  const parentRoot = roots.find(r =>
    String(r.id) === String(bestProd.ingredientId) ||
    (r.subtypes || []).some(s => String(s.id) === String(bestProd.subtypeId))
  ) || null;

  const parentSub = parentRoot?.subtypes?.find(s => String(s.id) === String(bestProd.subtypeId)) || null;

  return { product: bestProd, rootItem: parentRoot, subtype: parentSub, matchType };
}

/**
 * Evaluates recipe ingredients for taxonomy elevation opportunities.
 * Strictly partitions Category Candidates away from Stage 1 Root Elevations.
 * @param {Array} recipes - List of recipe objects
 * @param {Array} ingredients - Ingredients/Root items catalog
 * @param {Array} products - Products catalog
 * @param {Object} [options={}] - Options (e.g. preferences, strategy criterion)
 * @returns {{ rootElevations: Array, categoryCandidates: Array, summary: Object }}
 */
export function scanRecipeTaxonomyElevations(recipes = [], ingredients = [], products = [], options = {}) {
  const rootElevations = [];
  const categoryCandidates = [];

  const state = typeof getState === 'function' ? (getState() || {}) : {};
  const prefs = options.preferences || state.preferences || state.settings || state.userPrefs || {};
  const criterion = options.criterion || prefs.autoDefaultStrategy || prefs.autoDefaultCriterion || prefs.productPriority || 'highest_protein_per_kcal';

  const ingMap = new Map();
  (ingredients || []).forEach(i => { if (i?.id) ingMap.set(String(i.id), i); });

  const prodMap = new Map();
  (products || []).forEach(p => { if (p?.id) prodMap.set(String(p.id), p); });

  // Memoize category defaults
  const categoryDefaultsMap = new Map();
  const getCatDefault = (catName) => {
    if (!catName) return null;
    const key = catName.trim().toLowerCase();
    if (!categoryDefaultsMap.has(key)) {
      categoryDefaultsMap.set(key, resolveCategoryDefaultProduct(catName, ingredients, products, criterion));
    }
    return categoryDefaultsMap.get(key);
  };

  // Memoize root item defaults
  const rootDefaultsMap = new Map();
  const getRootDefault = (rootItem) => {
    if (!rootItem || !rootItem.id) return null;
    const key = String(rootItem.id);
    if (!rootDefaultsMap.has(key)) {
      rootDefaultsMap.set(key, resolveEffectiveDefaultProduct(rootItem, products, criterion));
    }
    return rootDefaultsMap.get(key);
  };

  (recipes || []).forEach(recipe => {
    if (!recipe || typeof recipe !== 'object') return;
    const rId = recipe.id || 'unknown';
    const rTitle = recipe.title || recipe.name || 'Untitled Recipe';

    const checkItem = (item, sIdx, iIdx, variant = 'original') => {
      if (!item || !item.subtypeId) return;

      const subId = String(item.subtypeId);
      const ingId = item.ingredientId ? String(item.ingredientId) : null;

      let root = ingId ? ingMap.get(ingId) : null;
      if (!root) {
        root = (ingredients || []).find(i => (i.subtypes || []).some(s => String(s.id) === subId));
      }
      if (!root) return;

      const sub = (root.subtypes || []).find(s => String(s.id) === subId);
      const subName = sub?.name || item.name || '';
      const rootName = root.name || '';
      const catName = root.category || item.category || 'General';

      // Find the sub-type's active/default product
      const subEffective = resolveEffectiveDefaultProduct(sub, products, criterion);
      const subProdId = subEffective.product?.id || sub?.defaultProductId || item.productId;

      // Check Category Default match
      const catDef = getCatDefault(catName);
      const isCategoryAutoDefault = Boolean(
        catDef?.product &&
        (String(catDef.product.subtypeId) === subId || (subProdId && String(catDef.product.id) === String(subProdId)))
      );

      const key = `${rId}:${variant}:${sIdx}:${iIdx}`;

      if (isCategoryAutoDefault) {
        // High-confidence Category Candidate -> Strictly isolate in categoryCandidates (Candidate Partitioning)
        categoryCandidates.push({
          key,
          recipeId: rId,
          recipeTitle: rTitle,
          variant,
          sectionIndex: sIdx,
          ingredientIndex: iIdx,
          ingredientName: item.name || rootName,
          rootId: root.id,
          rootName: root.name,
          currentSubtypeId: subId,
          currentSubtypeName: subName,
          category: catName,
          matchType: catDef.matchType,
          matchedProductId: catDef.product?.id,
          matchedProductName: catDef.product?.name,
          reason: `Matches auto-default product for Category "${catName}" (${catDef.matchType === 'explicit_default' ? 'Explicit Default' : 'Strategy Rank'})`
        });
        return; // Excluded from rootElevations
      }

      // Check Root Item Default match
      const rootDef = getRootDefault(root);
      const isRootAutoDefault = Boolean(
        rootDef?.product &&
        (String(rootDef.product.subtypeId) === subId || (subProdId && String(rootDef.product.id) === String(subProdId)))
      );

      const isSingleSubtype = (root.subtypes || []).length <= 1;
      const isGenericName = /^(standard|regular|default|plain)$/i.test(subName.trim()) || subName.trim().toLowerCase() === rootName.trim().toLowerCase();

      if (isRootAutoDefault || isSingleSubtype || isGenericName) {
        const matchType = (rootDef?.matchType === 'explicit_default' || isSingleSubtype) ? 'explicit_default' : 'strategy_rank';
        rootElevations.push({
          key,
          recipeId: rId,
          recipeTitle: rTitle,
          variant,
          sectionIndex: sIdx,
          ingredientIndex: iIdx,
          ingredientName: item.name || subName,
          rootId: root.id,
          rootName: root.name,
          currentSubtypeId: subId,
          currentSubtypeName: subName,
          category: catName,
          matchType,
          reason: isSingleSubtype
            ? 'Single sub-type under root item'
            : isRootAutoDefault
              ? `Matches auto-default for Root Item (${matchType === 'explicit_default' ? 'Explicit Default' : 'Strategy Rank'})`
              : 'Generic sub-type naming'
        });
      }
    };

    // Scan original variant
    (recipe.ingredientSections || [{ sectionTitle: 'Main', ingredients: recipe.ingredients || [] }]).forEach((sec, sIdx) => {
      (sec.ingredients || []).forEach((item, iIdx) => {
        checkItem(item, sIdx, iIdx, 'original');
      });
    });

    // Scan enhanced variant if present
    if (recipe.enhanced) {
      (recipe.enhanced.ingredientSections || [{ sectionTitle: 'Main', ingredients: recipe.enhanced.ingredients || [] }]).forEach((sec, sIdx) => {
        (sec.ingredients || []).forEach((item, iIdx) => {
          checkItem(item, sIdx, iIdx, 'enhanced');
        });
      });
    }
  });

  return {
    rootElevations,
    categoryCandidates,
    summary: {
      totalRecipesScanned: (recipes || []).length,
      rootElevationsCount: rootElevations.length,
      categoryCandidatesCount: categoryCandidates.length
    }
  };
}

/**
 * Recomputes calories, protein, and Universal Fit Score for a recipe object across original and enhanced variants.
 * @param {Object} recipe
 * @param {Object} [context={}]
 * @returns {Object} Updated clone of recipe with synchronized macros and fitScore
 */
export function recalculateRecipeNutritionAndFit(recipe, context = {}) {
  if (!recipe || typeof recipe !== 'object') return recipe;
  const clone = JSON.parse(JSON.stringify(recipe));

  const state = context.state || (typeof getState === 'function' ? getState() : {});
  const products = context.products || state.products || [];
  const ingredients = context.ingredients || state.rootItems || state.ingredients || [];
  const preferences = context.preferences || state.preferences || state.settings || {};

  function computeNodeMacros(node, serves = 4) {
    const allIngredients = (node.ingredientSections && node.ingredientSections.length > 0)
      ? node.ingredientSections.flatMap(s => s.ingredients || [])
      : (Array.isArray(node.ingredients) ? node.ingredients : []);

    let totalCal = 0, totalProt = 0, totalCarb = 0, totalFat = 0;

    allIngredients.forEach(item => {
      if (!item || item.excludeNutrition) return;
      const matchedProd = resolveDynamicProductForIngredient(item, {
        products,
        ingredients,
        preferences
      });

      if (matchedProd) {
        const qty = Number(item.qty ?? item.amount ?? 1) || 1;
        const unit = item.unit || 'g';
        const nut = calculateItemNutrition(matchedProd, qty, unit);
        totalCal += (nut.kcal ?? nut.cal ?? 0);
        totalProt += (nut.protein ?? nut.prot ?? 0);
        totalCarb += (nut.carbs ?? nut.carb ?? 0);
        totalFat += (nut.fat ?? 0);
      }
    });

    const s = Math.max(1, serves);
    return {
      perServing: {
        calories: Math.round(totalCal / s),
        protein: Math.round((totalProt / s) * 10) / 10,
        carbs: Math.round((totalCarb / s) * 10) / 10,
        fat: Math.round((totalFat / s) * 10) / 10
      },
      total: {
        cal: Math.round(totalCal),
        prot: Math.round(totalProt * 10) / 10,
        carb: Math.round(totalCarb * 10) / 10,
        fat: Math.round(totalFat * 10) / 10
      }
    };
  }

  const serves = Number(clone.servings || clone.serves || 4) || 4;
  const origMacros = computeNodeMacros(clone, serves);

  clone.macros = origMacros.perServing;
  clone.calories = origMacros.perServing.calories;
  clone.protein = origMacros.perServing.protein;
  clone.carbs = origMacros.perServing.carbs;
  clone.fat = origMacros.perServing.fat;
  clone.nutrition = {
    ...origMacros.perServing,
    cal: origMacros.perServing.calories,
    prot: origMacros.perServing.protein,
    perServing: { ...origMacros.perServing, cal: origMacros.perServing.calories, prot: origMacros.perServing.protein },
    total: origMacros.total
  };

  const targetMealType = clone.mealSuitability?.[0] || clone.types?.[0] || clone.type || 'dinner';
  const fitResult = calculateMealFitScore(clone, targetMealType, {
    activeProfile: 'everyone',
    portionScaled: true,
    variant: 'original'
  });
  const newScore = Math.round(Number(fitResult?.score) || 0);
  clone.fitScore = newScore;
  clone._computedFitScore = newScore;

  if (clone.enhanced) {
    const enhServes = Number(clone.enhanced.servings || clone.enhanced.serves || serves) || serves;
    const enhMacros = computeNodeMacros(clone.enhanced, enhServes);
    clone.enhanced.macros = enhMacros.perServing;
    clone.enhanced.calories = enhMacros.perServing.calories;
    clone.enhanced.protein = enhMacros.perServing.protein;
    clone.enhanced.carbs = enhMacros.perServing.carbs;
    clone.enhanced.fat = enhMacros.perServing.fat;
    clone.enhanced.nutrition = {
      ...enhMacros.perServing,
      cal: enhMacros.perServing.calories,
      prot: enhMacros.perServing.protein,
      perServing: { ...enhMacros.perServing, cal: enhMacros.perServing.calories, prot: enhMacros.perServing.protein },
      total: enhMacros.total
    };

    const enhFitResult = calculateMealFitScore(clone, targetMealType, {
      activeProfile: 'everyone',
      portionScaled: true,
      variant: 'enhanced'
    });
    const newEnhScore = Math.round(Number(enhFitResult?.score) || 0);
    clone.enhanced.fitScore = newEnhScore;
    clone.enhancedFitScore = newEnhScore;
  }

  clone.updatedAt = new Date().toISOString();
  return clone;
}

/**
 * Applies Root Item promotions to a recipe object in-memory.
 * Strips subtypeId and productId while preserving ingredientId.
 * Synchronizes sections and flattened ingredients array, and auto-recalculates macros.
 * @param {Object} recipe
 * @param {Set<string>|Array<string>} keysToElevate - Set of elevation keys `${recipeId}:${variant}:${sIdx}:${iIdx}`
 * @param {Object} [context={}]
 * @returns {Object} Updated clone of recipe
 */
export function applyRootElevationsToRecipe(recipe, keysToElevate, context = {}) {
  if (!recipe || typeof recipe !== 'object') return recipe;
  const clone = JSON.parse(JSON.stringify(recipe));
  const keySet = keysToElevate instanceof Set ? keysToElevate : new Set(keysToElevate || []);
  const rId = clone.id;

  const stripSubtypePointers = (item) => {
    delete item.subtypeId;
    delete item.subTypeId;
    delete item.productId;
    delete item.bankId;
  };

  const updateSectionList = (sections, variant) => {
    if (!Array.isArray(sections)) return;
    sections.forEach((sec, sIdx) => {
      (sec.ingredients || []).forEach((item, iIdx) => {
        const key = `${rId}:${variant}:${sIdx}:${iIdx}`;
        if (keySet.has(key)) {
          stripSubtypePointers(item);
        }
      });
    });
  };

  if (clone.ingredientSections) {
    updateSectionList(clone.ingredientSections, 'original');
    clone.ingredients = clone.ingredientSections.flatMap(s => s.ingredients || []);
  } else if (Array.isArray(clone.ingredients)) {
    clone.ingredients.forEach((item, iIdx) => {
      const key = `${rId}:original:0:${iIdx}`;
      if (keySet.has(key)) stripSubtypePointers(item);
    });
  }

  if (clone.enhanced) {
    if (clone.enhanced.ingredientSections) {
      updateSectionList(clone.enhanced.ingredientSections, 'enhanced');
      clone.enhanced.ingredients = clone.enhanced.ingredientSections.flatMap(s => s.ingredients || []);
    } else if (Array.isArray(clone.enhanced.ingredients)) {
      clone.enhanced.ingredients.forEach((item, iIdx) => {
        const key = `${rId}:enhanced:0:${iIdx}`;
        if (keySet.has(key)) stripSubtypePointers(item);
      });
    }
  }

  return recalculateRecipeNutritionAndFit(clone, context);
}

/**
 * Applies a single Category candidate decision to an ingredient in a recipe.
 * Synchronizes sections, flattened ingredients array, and recalculates nutrition.
 * @param {Object} recipe
 * @param {Object} params
 * @param {string} params.action - 'category' | 'root' | 'subtype'
 * @param {string} [params.variant='original']
 * @param {number} [params.sectionIndex=0]
 * @param {number} [params.ingredientIndex=0]
 * @param {string} params.targetCategory
 * @param {string} [params.rootId]
 * @param {Object} [context={}]
 * @returns {Object} Updated clone of recipe
 */
export function applyCategoryElevationToRecipe(recipe, { action, variant = 'original', sectionIndex = 0, ingredientIndex = 0, targetCategory, rootId }, context = {}) {
  if (!recipe || typeof recipe !== 'object') return recipe;
  if (action === 'subtype') return recipe; // No-op, keep locked to sub-type

  const clone = JSON.parse(JSON.stringify(recipe));

  const mutateItem = (item) => {
    delete item.productId;
    delete item.bankId;

    if (action === 'category') {
      item.categoryId = targetCategory;
      item.category = targetCategory;
      delete item.ingredientId;
      delete item.subtypeId;
      delete item.subTypeId;
      item.isCategoryDefault = true;
    } else if (action === 'root') {
      if (rootId) item.ingredientId = rootId;
      delete item.subtypeId;
      delete item.subTypeId;
    }
  };

  const targetNode = (variant === 'enhanced' && clone.enhanced) ? clone.enhanced : clone;

  if (targetNode.ingredientSections && targetNode.ingredientSections[sectionIndex]?.ingredients?.[ingredientIndex]) {
    mutateItem(targetNode.ingredientSections[sectionIndex].ingredients[ingredientIndex]);
    targetNode.ingredients = targetNode.ingredientSections.flatMap(s => s.ingredients || []);
  } else if (Array.isArray(targetNode.ingredients) && targetNode.ingredients[ingredientIndex]) {
    mutateItem(targetNode.ingredients[ingredientIndex]);
  }

  return recalculateRecipeNutritionAndFit(clone, context);
}

// Backward compatible alias
export const applyCategoryPromotionToRecipe = applyCategoryElevationToRecipe;

/**
 * Persists an array of updated recipe objects into Firestore using atomic chunked batches,
 * updates local Store state, and busts the hierarchy cache.
 * @param {Array<Object>} modifiedRecipes
 * @returns {Promise<{ success: boolean, count: number }>}
 */
export async function commitRecipeElevations(modifiedRecipes = []) {
  if (!Array.isArray(modifiedRecipes) || modifiedRecipes.length === 0) {
    return { success: true, count: 0 };
  }

  // 1. Commit to Firestore in safe chunks
  const res = await batchUpdateRecipesInDb(modifiedRecipes);

  // 2. Update local Store state
  const state = typeof getState === 'function' ? getState() : {};
  const currentRecipes = Array.isArray(state.recipes) ? [...state.recipes] : [];
  const modifiedMap = new Map(modifiedRecipes.map(r => [String(r.id), r]));

  const updatedStoreRecipes = currentRecipes.map(r => modifiedMap.get(String(r.id)) || r);
  setRecipes(updatedStoreRecipes);
  saveStateCache(state);

  // 3. Invalidate taxonomy hierarchy cache
  if (typeof invalidateHierarchyCache === 'function') {
    invalidateHierarchyCache();
  }

  return { success: true, count: res?.count || modifiedRecipes.length };
}
