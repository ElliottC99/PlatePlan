/**
 * src/services/DataQualityScanner.js
 * Canonical owner for PlatePlan Data Quality Audits and Diagnostics.
 * Consolidates all scanner rules, anomaly detection, dynamic macro calculation,
 * and liquid-aware density checks into a pure, testable service layer.
 * Zero direct DOM references.
 */

import { calculateItemNutrition, rollupNutritionTotals } from './NutritionService.js';
import { isLiquidIngredient, getIngredientDensity, findDensity } from './UnitConversionService.js';
import { DQ_CONFIDENCE_THRESHOLD } from '../config/businessRules.js';
import { resolveDynamicProductForIngredient } from './PantryTaxonomyService.js';
import { getState, setIngredients, setRecipes, setPreferences, runOptimisticMutation } from '../store/store.js';
import {
  dismissAdvisoryInDb,
  savePreferencesWithAutoPrune,
  clearReviewedRecipeMetadataInDb,
  saveRecipe,
  isDbAvailable
} from './HouseholdRepository.js';
import { saveRootItem as saveIngredient } from './PantryTaxonomyService.js';
import {
  calculateMealFitScore,
  extractRecipeMacros,
  getVaultTargetMacros
} from '../utils/fitScoreCalculator.js';

export { getIngredientDensity, findDensity };

/**
 * Calculates string similarity using Sorensen-Dice coefficient.
 * Returns a value between 0.0 and 1.0.
 */
export function getStringSimilarity(str1, str2) {
  const s1 = String(str1 || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const s2 = String(str2 || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const s1Bigrams = new Map();
  for (let i = 0; i < s1.length - 1; i++) {
    const bigram = s1.substr(i, 2);
    const count = s1Bigrams.has(bigram) ? s1Bigrams.get(bigram) + 1 : 1;
    s1Bigrams.set(bigram, count);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substr(i, 2);
    const count = s1Bigrams.get(bigram) || 0;
    if (count > 0) {
      intersection++;
      s1Bigrams.set(bigram, count - 1);
    }
  }

  return (2.0 * intersection) / (s1.length + s2.length - 2);
}

/**
 * Fallback Macro Resolution Helper
 * Resolves effective macros for an ingredient, falling back to defaultProduct if root specs are missing.
 */
export function getEffectiveIngredientMacros(ingredient, productStore = []) {
  if (!ingredient || typeof ingredient !== 'object') return null;
  if (ingredient.calories != null && ingredient.protein != null) {
    return { calories: Number(ingredient.calories), protein: Number(ingredient.protein), source: 'ingredient' };
  }
  if (ingredient.cal != null && ingredient.prot != null) {
    return { calories: Number(ingredient.cal), protein: Number(ingredient.prot), source: 'ingredient' };
  }
  const defaultProductId = ingredient.defaultProductId || ingredient.defaultProduct;
  const defaultProduct = defaultProductId && productStore ? (
    typeof productStore.get === 'function' 
      ? productStore.get(defaultProductId) 
      : (Array.isArray(productStore) ? productStore.find(p => String(p.id) === String(defaultProductId)) : null)
  ) : null;

  if (defaultProduct && (defaultProduct.calories != null || defaultProduct.cal != null)) {
    return { 
      calories: Number(defaultProduct.calories ?? defaultProduct.cal), 
      protein: Number(defaultProduct.protein ?? defaultProduct.prot), 
      source: 'default_product' 
    };
  }
  return null;
}

/**
 * Dynamically computes per-serving nutrition for a recipe by rolling up its items.
 */
export function calculateRecipeDynamicMacros(recipe, ingredientsList = [], productsList = []) {
  if (!recipe || typeof recipe !== 'object') return null;
  const rawIngs = recipe.ingredients || recipe.recipe?.ingredients || recipe.parsedIngredients || [];
  const items = Array.isArray(rawIngs) ? rawIngs : (typeof rawIngs === 'object' ? Object.values(rawIngs) : []);
  if (!items.length) return null;

  const productMap = new Map();
  (productsList || []).forEach(p => { if (p?.id) productMap.set(String(p.id), p); });

  const ingredientMap = new Map();
  (ingredientsList || []).forEach(i => { if (i?.id) ingredientMap.set(String(i.id), i); });

  const nutritionList = [];

  items.forEach(item => {
    if (item.excludeNutrition) return;
    let matchedSource = null;
    if (item.productId && productMap.has(String(item.productId))) {
      matchedSource = productMap.get(String(item.productId));
    }
    if (!matchedSource && item.ingredientId) {
      const ing = ingredientMap.get(String(item.ingredientId));
      if (ing) {
        if (item.subtypeId && Array.isArray(ing.subtypes)) {
          const sub = ing.subtypes.find(s => String(s.id) === String(item.subtypeId));
          const subDefaultId = sub?.defaultProductId || sub?.defaultProduct;
          if (subDefaultId && productMap.has(String(subDefaultId))) {
            matchedSource = productMap.get(String(subDefaultId));
          }
        }
        if (!matchedSource) {
          const ingDefaultId = ing.defaultProductId || ing.defaultProduct;
          if (ingDefaultId && productMap.has(String(ingDefaultId))) {
            matchedSource = productMap.get(String(ingDefaultId));
          }
        }
        if (!matchedSource) {
          const effective = getEffectiveIngredientMacros(ing, productsList);
          if (effective) {
            matchedSource = {
              ...ing,
              cal: effective.calories,
              prot: effective.protein,
              carb: ing.carb ?? ing.carbs ?? 0,
              fat: ing.fat ?? 0,
              fibre: ing.fibre ?? ing.fiber ?? 0
            };
          }
        }
      }
    }
    if (!matchedSource && item.name) {
      const qName = String(item.name).toLowerCase().trim();
      matchedSource = (productsList || []).find(p => String(p.name || '').toLowerCase().includes(qName)) ||
                      (ingredientsList || []).find(i => String(i.name || '').toLowerCase().includes(qName));
    }

    if (matchedSource) {
      const qty = Number(item.qty ?? item.amount ?? item.quantity ?? 1) || 1;
      const unit = item.unit || item.measure || 'g';
      nutritionList.push(calculateItemNutrition(matchedSource, qty, unit));
    }
  });

  if (!nutritionList.length) return null;
  const serves = Number(recipe.serves ?? recipe.recipe?.serves ?? recipe.servings ?? 2) || 2;
  return rollupNutritionTotals(nutritionList, serves);
}

/**
 * Automated Macro Drift Recalibration Helper
 */
export function autoRecalibrateRecipeDrift(recipe, ingredientStore = [], productStore = []) {
  const calculated = calculateRecipeDynamicMacros(recipe, ingredientStore, productStore) || { perServing: { cal: 0, prot: 0, carb: 0, fat: 0 } };
  const perServing = calculated.perServing || calculated;
  const calcCalories = perServing.cal ?? perServing.calories ?? 0;
  const calcProtein = perServing.prot ?? perServing.protein ?? 0;
  const calcCarbs = perServing.carb ?? perServing.carbs ?? 0;
  const calcFat = perServing.fat ?? 0;

  const storedCalories = Number(recipe.macros?.calories ?? recipe.macros?.cal ?? recipe.calories ?? recipe.cal ?? 0);
  const storedProtein = Number(recipe.macros?.protein ?? recipe.macros?.prot ?? recipe.protein ?? recipe.prot ?? 0);
  const storedCarbs = Number(recipe.macros?.carbs ?? recipe.macros?.carb ?? recipe.carbs ?? recipe.carb ?? 0);
  const storedFat = Number(recipe.macros?.fat ?? recipe.fat ?? 0);

  const calDiff = Math.abs(storedCalories - calcCalories) / Math.max(1, calcCalories);
  const protDiff = Math.abs(storedProtein - calcProtein) / Math.max(1, calcProtein);
  const carbDiff = Math.abs(storedCarbs - calcCarbs) / Math.max(1, calcCarbs);
  const fatDiff = Math.abs(storedFat - calcFat) / Math.max(1, calcFat);

  if (calDiff > 0.02 || protDiff > 0.02 || carbDiff > 0.02 || fatDiff > 0.02) {
    recipe.macros = {
      calories: Math.round(calcCalories),
      protein: Number(calcProtein.toFixed(1)),
      carbs: Number(calcCarbs.toFixed(1)),
      fat: Number(calcFat.toFixed(1))
    };
    return { updated: true, recipe };
  }
  return { updated: false, recipe };
}

/**
 * Runs the full catalogue audit scan across recipes, products, and ingredients.
 * Features liquid-aware volume filtering and ingredient-grouped anomalies.
 * @param {Object} state - Current application state snapshot
 * @returns {Object} Comprehensive categorized issues and totalCount
 */
export function runAudit(state = {}) {
  const recipes = Array.isArray(state.recipes) ? state.recipes : Object.values(state.recipes || {});
  const ingredients = Array.isArray(state.rootItems) 
    ? state.rootItems 
    : (Array.isArray(state.ingredients) ? state.ingredients : Object.values(state.ingredients || {}));
  const products = Array.isArray(state.products) ? state.products : Object.values(state.products || {});
  const currentPlan = state.currentPlan || null;
  const preferences = state.preferences || state.userPrefs || {};

  const dismissed = Array.isArray(preferences.dismissedQualityAdvisories)
    ? preferences.dismissedQualityAdvisories
    : [];

  const results = {
    macroDrift: [],
    planDesync: [],
    incompleteMacros: [],
    densityMismatch: [],
    orphans: [],
    unmappedItems: [],
    duplicates: [],
    storageHealth: [],
    totalCount: 0
  };

  const volumeUnits = ['ml', 'l', 'tbsp', 'tsp', 'cup', 'teaspoon', 'tablespoon', 'liquid', 'fl oz'];

  // 1. Recipe Macro Drift (> 2% diff between stored and calculated macros)
  recipes.forEach(r => {
    const dynamic = calculateRecipeDynamicMacros(r, ingredients, products);
    if (!dynamic || !dynamic.perServing) return;

    const storedCal = Number(r.macros?.calories ?? r.calories ?? r.cal ?? 0);
    const storedProt = Number(r.macros?.protein ?? r.protein ?? r.prot ?? 0);
    const storedCarb = Number(r.macros?.carbs ?? r.carbs ?? r.carb ?? 0);
    const storedFat = Number(r.macros?.fat ?? r.fat ?? 0);

    const calcCal = dynamic.perServing.cal;
    const calcProt = dynamic.perServing.prot;
    const calcCarb = dynamic.perServing.carb;
    const calcFat = dynamic.perServing.fat;

    const calDiff = Math.abs(storedCal - calcCal) / Math.max(1, calcCal);
    const protDiff = Math.abs(storedProt - calcProt) / Math.max(1, calcProt);
    const carbDiff = Math.abs(storedCarb - calcCarb) / Math.max(1, calcCarb);
    const fatDiff = Math.abs(storedFat - calcFat) / Math.max(1, calcFat);

    if (calDiff > 0.02 || protDiff > 0.02 || carbDiff > 0.02 || fatDiff > 0.02) {
      const driftedParts = [];
      if (calDiff > 0.02) driftedParts.push(`Calories: ${Math.round(storedCal)} vs ${Math.round(calcCal)} kcal (${(calDiff * 100).toFixed(1)}%)`);
      if (protDiff > 0.02) driftedParts.push(`Protein: ${storedProt.toFixed(1)}g vs ${calcProt.toFixed(1)}g (${(protDiff * 100).toFixed(1)}%)`);
      if (carbDiff > 0.02) driftedParts.push(`Carbs: ${storedCarb.toFixed(1)}g vs ${calcCarb.toFixed(1)}g (${(carbDiff * 100).toFixed(1)}%)`);
      if (fatDiff > 0.02) driftedParts.push(`Fat: ${storedFat.toFixed(1)}g vs ${calcFat.toFixed(1)}g (${(fatDiff * 100).toFixed(1)}%)`);

      results.macroDrift.push({
        key: `drift:recipe:${r.id}`,
        recipeId: r.id,
        recipeName: r.name || r.title || 'Untitled Recipe',
        stored: { cal: storedCal, prot: storedProt, carb: storedCarb, fat: storedFat },
        calculated: { cal: calcCal, prot: calcProt, carb: calcCarb, fat: calcFat },
        message: `Stored macros differ from active ingredient defaults: ${driftedParts.join(' · ')}`,
        severity: 'advisory'
      });
    }
  });

  // 2. Active Meal Plan Desync
  if (currentPlan && currentPlan.slots) {
    Object.keys(currentPlan.slots).forEach(dayKey => {
      const dayObj = currentPlan.slots[dayKey];
      if (!dayObj || typeof dayObj !== 'object') return;

      Object.keys(dayObj).forEach(mealKey => {
        const node = dayObj[mealKey];
        if (!node || typeof node !== 'object' || node.isSkipped) return;

        const rId = node.recipeId || node.id;
        if (!rId) return;

        const template = recipes.find(r => String(r.id) === String(rId));
        if (template) {
          const nodeCal = node.cal ?? node.calories ?? node.macros?.calories ?? node.macros?.cal;
          const nodeProt = node.prot ?? node.protein ?? node.macros?.protein ?? node.macros?.prot;

          const tempCal = template.cal ?? template.calories ?? template.macros?.calories ?? template.macros?.cal ?? 0;
          const tempProt = template.prot ?? template.protein ?? template.macros?.protein ?? template.macros?.prot ?? 0;

          if (nodeCal !== undefined && (Math.abs(nodeCal - tempCal) > 1 || Math.abs((nodeProt ?? 0) - tempProt) > 0.5)) {
            results.planDesync.push({
              key: `desync:plan:${dayKey}:${mealKey}:${rId}`,
              dayKey,
              mealKey,
              recipeId: rId,
              recipeName: template.name || template.title || 'Unnamed Recipe',
              nodeCal,
              nodeProt,
              tempCal,
              tempProt,
              message: `Active slot for "${template.name || template.title}" on Day ${dayKey} has outdated macros (${Math.round(nodeCal)} kcal vs current template ${Math.round(tempCal)} kcal).`,
              severity: 'advisory'
            });
          }
        }
      });
    });
  }

  // 3. Incomplete Macro Specifications (Retired: Subsumed under Pantry Items Lacking Store Products)
  // Effective macros are derived from Auto-Default Products; items without products are handled by unmappedItems.

  // 4. Liquid-Aware Density Mismatch (Grouped by Ingredient ID, silencing kitchen liquids)
  const densityByIng = new Map();
  recipes.forEach(r => {
    const rawIngs = r.ingredients || r.recipe?.ingredients || r.parsedIngredients || [];
    const items = Array.isArray(rawIngs) ? rawIngs : (typeof rawIngs === 'object' ? Object.values(rawIngs) : []);

    items.forEach(item => {
      if (!item.ingredientId) return;
      const unit = String(item.unit || item.measure || '').toLowerCase().trim();
      if (!volumeUnits.includes(unit)) return;

      const baseIng = ingredients.find(ing => String(ing.id) === String(item.ingredientId));
      if (!baseIng) return;

      // 1. Explicit density set
      if (baseIng.density && Number(baseIng.density) > 0) return;

      // 2. Recognized liquid in UnitConversionService or word "liquid" in name
      const ingNameLower = String(baseIng.name || '').toLowerCase();
      if (isLiquidIngredient(ingNameLower) || ingNameLower.includes('liquid')) return;

      // 3. Known pantry staple density in UnitConversionService (sugar, flour, rice, oats, lentils, etc.)
      if (findDensity(ingNameLower) != null) return;

      // 4. Linked product has volume packaging (ml, l)
      const hasLiquidProd = products.some(p => String(p.ingredientId) === String(baseIng.id) && (p.packUnit === 'ml' || p.packUnit === 'l'));
      if (hasLiquidProd) return;

      // If dry good measured in volume, group by ingredient
      if (!densityByIng.has(baseIng.id)) {
        densityByIng.set(baseIng.id, {
          key: `density:ing:${baseIng.id}`,
          ingredientId: baseIng.id,
          ingredientName: baseIng.name,
          units: new Set(),
          recipes: [],
          severity: 'gap'
        });
      }
      const entry = densityByIng.get(baseIng.id);
      entry.units.add(unit);
      const rTitle = r.name || r.title || 'Recipe';
      if (!entry.recipes.includes(rTitle)) entry.recipes.push(rTitle);
    });
  });

  densityByIng.forEach(entry => {
    results.densityMismatch.push({
      key: entry.key,
      ingredientId: entry.ingredientId,
      ingredientName: entry.ingredientName,
      recipes: entry.recipes,
      units: Array.from(entry.units),
      message: `Ingredient "${entry.ingredientName}" is measured in volume (${Array.from(entry.units).join(', ')}) across ${entry.recipes.length} recipe(s) but lacks a density conversion factor.`,
      severity: 'gap'
    });
  });

  // 5. Orphaned Products / Broken Subtypes
  const ingMap = new Map();
  ingredients.forEach(i => { if (i?.id) ingMap.set(String(i.id), i); });

  products.forEach(p => {
    if (p.ingredientId) {
      const parentIng = ingMap.get(String(p.ingredientId));
      if (!parentIng) {
        results.orphans.push({
          key: `orphan:product:${p.id}:no-ing`,
          productId: p.id,
          productName: p.name || 'Unnamed Product',
          parentId: p.ingredientId,
          subtypeId: p.subtypeId,
          type: 'no-ingredient',
          message: `Product "${p.name}" references parent ingredient ID "${p.ingredientId}" which does not exist in the database.`,
          severity: 'blocker'
        });
        return;
      }

      if (p.subtypeId) {
        const hasSubtype = Array.isArray(parentIng.subtypes) && parentIng.subtypes.some(s => String(s.id) === String(p.subtypeId));
        if (!hasSubtype) {
          results.orphans.push({
            key: `orphan:product:${p.id}:no-sub`,
            productId: p.id,
            productName: p.name || 'Unnamed Product',
            subtypeId: p.subtypeId,
            parentId: parentIng.id,
            parentName: parentIng.name,
            type: 'no-subtype',
            message: `Product "${p.name}" references sub-type ID "${p.subtypeId}" which is missing from parent ingredient "${parentIng.name}".`,
            severity: 'blocker'
          });
        }
      }
    }
  });


  // 6. Recipe Ingredients Lacking Pantry Taxonomy Linkage
  recipes.forEach(r => {
    const rawIngs = (r.ingredientSections && r.ingredientSections.length > 0)
      ? r.ingredientSections.flatMap(s => s.ingredients || [])
      : (Array.isArray(r.ingredients) ? r.ingredients : []);

    rawIngs.forEach((item, idx) => {
      if (!item || item.excludeNutrition) return;
      const isUnlinked = item.needsSubtypeMapping || (!item.subtypeId && !item.ingredientId && !item.categoryId);
      if (isUnlinked) {
        const resolved = resolveDynamicProductForIngredient(item, { products, ingredients });
        if (!resolved) {
          const ingName = item.name || item.raw || `Ingredient #${idx + 1}`;
          const rTitle = r.name || r.title || 'Untitled Recipe';
          results.unmappedItems.push({
            key: `unmapped:recipe:${r.id}:${item.id || idx}`,
            recipeId: r.id,
            recipeName: rTitle,
            ingredientName: ingName,
            ingredientIndex: idx,
            message: `Recipe "${rTitle}" has unlinked ingredient "${ingName}" with no matching Pantry Category, Item, or Sub-Type.`,
            severity: 'gap'
          });
        }
      }
    });
  });

  // 7. Duplicate Ingredient Detection (> 85% similarity)
  for (let i = 0; i < ingredients.length; i++) {
    for (let j = i + 1; j < ingredients.length; j++) {
      const ing1 = ingredients[i];
      const ing2 = ingredients[j];
      const score = getStringSimilarity(ing1.name, ing2.name);
      if (score > DQ_CONFIDENCE_THRESHOLD) {
        results.duplicates.push({
          key: `duplicate:ing:${ing1.id}:${ing2.id}`,
          ing1Id: ing1.id,
          ing1Name: ing1.name,
          ing2Id: ing2.id,
          ing2Name: ing2.name,
          score,
          message: `Potential duplicates: "${ing1.name}" and "${ing2.name}" have a similarity score of ${Math.round(score * 100)}%.`,
          severity: 'advisory'
        });
      }
    }
  }

  // 8. Storage Health (Retired: Silently auto-pruned in background by DataQualityTableRenderService)

  // Filter out dismissed advisories across all audit categories
  Object.keys(results).forEach(cat => {
    if (Array.isArray(results[cat])) {
      results[cat] = results[cat].filter(issue => !dismissed.includes(issue.key));
      results.totalCount += results[cat].length;
    }
  });

  return results;
}

/**
 * Fast summary scanner for badge counter.
 * @param {Object} state 
 * @returns {{ totalCount: number, categories: Object }}
 */
export function scanDataQualitySummary(state = {}) {
  const audit = runAudit(state);
  return {
    totalCount: audit.totalCount || 0,
    categories: {
      macroDrift: (audit.macroDrift || []).length,
      planDesync: (audit.planDesync || []).length,
      incompleteMacros: (audit.incompleteMacros || []).length,
      densityMismatch: (audit.densityMismatch || []).length,
      orphans: (audit.orphans || []).length,
      unmappedItems: (audit.unmappedItems || []).length,
      duplicates: (audit.duplicates || []).length,
      storageHealth: (audit.storageHealth || []).length
    }
  };
}

export async function dismissDataQualityAdvisory(issueKey, rerenderCallback) {
  const state = getState();
  const currentPrefs = state.preferences || state.userPrefs || {};
  const previousPrefs = JSON.parse(JSON.stringify(currentPrefs));

  const mutateFn = (currentState) => {
    const prefs = currentState.preferences || currentState.userPrefs || {};
    const dismissed = Array.isArray(prefs.dismissedQualityAdvisories)
      ? [...prefs.dismissedQualityAdvisories]
      : [];
    if (!dismissed.includes(issueKey)) {
      dismissed.push(issueKey);
    }
    currentState.preferences = {
      ...prefs,
      dismissedQualityAdvisories: dismissed
    };
    currentState.userPrefs = currentState.preferences;
  };

  const rollbackFn = (currentState) => {
    currentState.preferences = previousPrefs;
    currentState.userPrefs = previousPrefs;
  };

  try {
    await runOptimisticMutation(
      'preferences',
      mutateFn,
      dismissAdvisoryInDb(issueKey),
      rollbackFn,
      'Failed to dismiss advisory. Reverted.'
    );
    if (typeof rerenderCallback === 'function') rerenderCallback();
  } catch (err) {
    console.error('[DataQualityScanner] dismissDataQualityAdvisory error:', err);
  }
}

export async function performGlobalProductRelink(ingredients = [], products = []) {
  let modifiedCount = 0;
  const resolvedProducts = products.map(p => {
    if (p.ingredientId) return p;

    const pName = String(p.name || '').toLowerCase().trim();
    const matchedIng = ingredients.find(ing => {
      const ingName = String(ing.name || '').toLowerCase().trim();
      return pName.includes(ingName) || ingName.includes(pName);
    });

    if (matchedIng) {
      modifiedCount++;
      return {
        ...p,
        ingredientId: matchedIng.id,
        updatedAt: new Date().toISOString()
      };
    }
    return p;
  });

  return { resolvedProducts, modifiedCount };
}

export async function verifyZeroCalorieIngredient(ingredientId, ingredients = []) {
  const ingIndex = ingredients.findIndex(i => String(i.id) === String(ingredientId));
  if (ingIndex < 0) return null;

  const originalIng = ingredients[ingIndex];
  const updatedIng = {
    ...originalIng,
    cal: 0,
    calories: 0,
    prot: 0,
    protein: 0,
    carb: 0,
    carbs: 0,
    fat: 0,
    isVerifiedZero: true,
    isVerifiedZeroCal: true,
    updatedAt: new Date().toISOString()
  };

  ingredients[ingIndex] = updatedIng;
  setIngredients(ingredients);

  try {
    await saveIngredient(updatedIng);
    return updatedIng;
  } catch (err) {
    console.error('[DataQualityScanner] verifyZeroCalorieIngredient error:', err);
    throw err;
  }
}

export const MEAL_TYPE_OPTIONS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacking' }
];

const MEAL_TYPE_DISPLAY_MAP = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacking'
};

const SERVINGS_CANDIDATES = [1, 2, 3, 4, 5, 6, 8];

const MEAL_TYPE_TITLE_PATTERNS = {
  breakfast: /\b(oats|oatmeal|porridge|granola|pancakes?|waffles?|smoothie|bagel|breakfast|frittata|shakshuka|french toast|muesli|overnight\s+(?:oats|chia|porridge)|bircher|omelette|scrambled eggs?|poached eggs?|avocado toast|acai|chia pudding|weetabix|cereal)\b/i,
  snack: /\b(snack|protein balls?|energy balls?|bites?|flapjacks?|brownies?|cookies?|muffins?|protein bars?|cereal bars?|granola bars?|traybake|truffles?|protein shake|mug cake)\b/i,
  lunch: /\b(sandwich|sandwiches|wrap|wraps|toastie|toasties|panini|baguette|pitta|pita|quesadilla|soup|salad bowl|lunch|ciabatta|focaccia|flatbread|bento)\b/i
};

export function normalizeMealTypeKey(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'snacking' || s === 'snacks' || s === 'snack') return 'snack';
  if (s === 'breakfast' || s === 'lunch' || s === 'dinner') return s;
  return null;
}

export function formatMealTypeLabel(key) {
  const norm = normalizeMealTypeKey(key) || 'dinner';
  return MEAL_TYPE_DISPLAY_MAP[norm] || 'Dinner';
}

export function getRecipeMealTypes(recipe) {
  const r = recipe?.recipe || recipe || {};
  const rawList = Array.isArray(r.types) && r.types.length > 0
    ? r.types
    : (Array.isArray(r.mealSuitability) && r.mealSuitability.length > 0
      ? r.mealSuitability
      : [r.mealType || r.type || 'dinner']);
  const cleaned = rawList.map(normalizeMealTypeKey).filter(Boolean);
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : ['dinner'];
}

export function getRecipeServings(recipe) {
  const r = recipe?.recipe || recipe || {};
  const raw = Number(r.serves ?? r.servings ?? r.yield ?? 2);
  return Number.isFinite(raw) && raw > 0 ? raw : 2;
}

function getAverageMealTargetKcal(mealType, preferences = {}) {
  const targets = getVaultTargetMacros(mealType || 'dinner', preferences);
  const eCal = Number(targets?.targetCal_E || 0);
  const cCal = Number(targets?.targetCal_C || 0);
  if (eCal > 0 && cCal > 0) return (eCal + cCal) / 2;
  return eCal || cCal || 550;
}

function getBasePerServingMacros(recipe, ingredients = [], products = []) {
  const dynamic = calculateRecipeDynamicMacros(recipe, ingredients, products);
  if (dynamic?.perServing && dynamic.perServing.cal > 0) {
    return {
      cal: Number(dynamic.perServing.cal) || 0,
      prot: Number(dynamic.perServing.prot) || 0,
      carb: Number(dynamic.perServing.carb) || 0,
      fat: Number(dynamic.perServing.fat) || 0,
      source: 'dynamic'
    };
  }
  const extracted = extractRecipeMacros(recipe, 'original', { useStaticOnly: true });
  const cal = Number(extracted?.cal ?? recipe?.macros?.calories ?? recipe?.macros?.cal ?? recipe?.calories ?? recipe?.cal ?? 0) || 0;
  const prot = Number(extracted?.prot ?? recipe?.macros?.protein ?? recipe?.macros?.prot ?? recipe?.protein ?? recipe?.prot ?? 0) || 0;
  const carb = Number(recipe?.macros?.carbs ?? recipe?.macros?.carb ?? recipe?.carbs ?? recipe?.carb ?? 0) || 0;
  const fat = Number(recipe?.macros?.fat ?? recipe?.fat ?? 0) || 0;
  return { cal, prot, carb, fat, source: 'stored' };
}

/**
 * Computes scaled per-serving macros and Fit Score preview for a recipe under
 * candidate servings and meal types without mutating the original recipe.
 */
export function computeScaledRecipePreview(recipe, newServes, mealTypes, context = {}) {
  const currentServes = getRecipeServings(recipe);
  const safeServes = Math.max(1, Number(newServes) || currentServes);
  const normTypes = (Array.isArray(mealTypes) && mealTypes.length > 0
    ? mealTypes.map(normalizeMealTypeKey).filter(Boolean)
    : getRecipeMealTypes(recipe));
  const safeTypes = normTypes.length > 0 ? Array.from(new Set(normTypes)) : ['dinner'];
  const ingredients = context.ingredients || context.rootItems || [];
  const products = context.products || [];
  const preferences = context.preferences || context.userPrefs || {};

  let perServing = null;
  const dynamicWithNewServes = calculateRecipeDynamicMacros(
    { ...recipe, serves: safeServes, servings: safeServes },
    ingredients,
    products
  );
  if (dynamicWithNewServes?.perServing && dynamicWithNewServes.perServing.cal > 0) {
    perServing = {
      cal: Math.round(dynamicWithNewServes.perServing.cal),
      prot: Math.round(dynamicWithNewServes.perServing.prot * 10) / 10,
      carb: Math.round(dynamicWithNewServes.perServing.carb * 10) / 10,
      fat: Math.round(dynamicWithNewServes.perServing.fat * 10) / 10
    };
  } else {
    const base = context.baseMacros || getBasePerServingMacros(recipe, ingredients, products);
    const ratio = currentServes / safeServes;
    perServing = {
      cal: Math.round(base.cal * ratio),
      prot: Math.round(base.prot * ratio * 10) / 10,
      carb: Math.round(base.carb * ratio * 10) / 10,
      fat: Math.round(base.fat * ratio * 10) / 10
    };
  }

  const baseRecipe = recipe?.recipe || recipe || {};
  const { nutrition: _ignoredNut, perServing: _ignoredPerServ, recipe: _ignoredNested, ...cleanBase } = baseRecipe;

  const candidateRecipe = {
    ...cleanBase,
    serves: safeServes,
    servings: safeServes,
    types: safeTypes,
    mealSuitability: safeTypes.map(formatMealTypeLabel),
    mealType: safeTypes[0],
    type: safeTypes[0],
    macros: {
      ...(baseRecipe?.macros || {}),
      calories: perServing.cal,
      cal: perServing.cal,
      protein: perServing.prot,
      prot: perServing.prot,
      carbs: perServing.carb,
      carb: perServing.carb,
      fat: perServing.fat
    },
    cal: perServing.cal,
    calories: perServing.cal,
    prot: perServing.prot,
    protein: perServing.prot,
    carb: perServing.carb,
    carbs: perServing.carb,
    fat: perServing.fat
  };

  let bestFit = null;
  for (const mt of safeTypes) {
    const res = calculateMealFitScore(candidateRecipe, mt, {
      useStaticOnly: true,
      preferences
    });
    if (!bestFit || res.score > bestFit.score) {
      bestFit = res;
    }
  }

  return {
    serves: safeServes,
    mealTypes: safeTypes,
    macros: perServing,
    fitResult: bestFit || { score: 0, tier: 'red', tierIcon: '🔴', tierLabel: 'Missing Macros', color: '#ef4444' },
    fitScore: bestFit?.score ?? 0
  };
}

/**
 * Smart scanner for recipe servings and meal-type mismatches.
 * Respects preferences.reviewedRecipeMetadata unless options.includeReviewed is true.
 */
export function scanServingsAndMealTypeMismatches(state = {}, options = {}) {
  const recipes = Array.isArray(state.recipes) ? state.recipes : Object.values(state.recipes || {});
  const ingredients = Array.isArray(state.rootItems)
    ? state.rootItems
    : (Array.isArray(state.ingredients) ? state.ingredients : Object.values(state.ingredients || {}));
  const products = Array.isArray(state.products) ? state.products : Object.values(state.products || {});
  const preferences = state.preferences || state.userPrefs || {};
  const reviewedMap = (preferences.reviewedRecipeMetadata && typeof preferences.reviewedRecipeMetadata === 'object')
    ? preferences.reviewedRecipeMetadata
    : {};

  const flagged = [];

  for (const recipe of recipes) {
    if (!recipe || !recipe.id) continue;
    const recipeId = String(recipe.id);
    if (!options.includeReviewed && reviewedMap[recipeId]) continue;

    const recipeName = String(recipe.name || recipe.title || 'Untitled Recipe').trim();
    const currentServes = getRecipeServings(recipe);
    const currentMealTypes = getRecipeMealTypes(recipe);
    const baseMacros = getBasePerServingMacros(recipe, ingredients, products);
    const hasMacros = baseMacros.cal > 0;
    const ctx = { ingredients, products, preferences, baseMacros };

    const currentPreview = computeScaledRecipePreview(recipe, currentServes, currentMealTypes, ctx);

    // 1. Meal-type mismatch detection (Title keywords first, then macro Fit Score lift)
    let hasMealTypeMismatch = false;
    let suggestedMealTypes = [...currentMealTypes];
    let mealTypeReason = '';

    const titleMatchedTypes = [];
    for (const [mt, regex] of Object.entries(MEAL_TYPE_TITLE_PATTERNS)) {
      if (regex.test(recipeName)) titleMatchedTypes.push(mt);
    }

    const missingTitleTypes = titleMatchedTypes.filter(mt => !currentMealTypes.includes(mt));
    if (missingTitleTypes.length > 0) {
      hasMealTypeMismatch = true;
      const primaryTitleType = missingTitleTypes[0];
      if (currentMealTypes.length === 1 && currentMealTypes[0] === 'dinner' && (primaryTitleType === 'breakfast' || primaryTitleType === 'snack')) {
        suggestedMealTypes = [primaryTitleType];
      } else {
        suggestedMealTypes = Array.from(new Set([...currentMealTypes, ...missingTitleTypes]));
      }
      mealTypeReason = `Title suggests ${missingTitleTypes.map(formatMealTypeLabel).join(' / ')} (currently tagged ${currentMealTypes.map(formatMealTypeLabel).join(', ')}).`;
    }

    // 2. Servings mismatch detection (evaluated against effective/suggested meal type)
    let hasServingsMismatch = false;
    let suggestedServes = currentServes;
    let servingsReason = '';

    if (hasMacros) {
      const evalMealTypes = suggestedMealTypes.length > 0 ? suggestedMealTypes : currentMealTypes;
      const primaryEvalType = evalMealTypes[0] || 'dinner';
      const targetKcal = getAverageMealTargetKcal(primaryEvalType, preferences);
      const currentEvalPreview = computeScaledRecipePreview(recipe, currentServes, evalMealTypes, ctx);
      const currentCal = currentEvalPreview.macros.cal;
      const isCalorieOutlier = currentCal > targetKcal * 1.45 || currentCal < targetKcal * 0.55;

      let bestCandidate = null;
      for (const candidateServes of SERVINGS_CANDIDATES) {
        if (candidateServes === currentServes) continue;
        const preview = computeScaledRecipePreview(recipe, candidateServes, evalMealTypes, ctx);
        const distFromTarget = Math.abs(preview.macros.cal - targetKcal);
        if (
          !bestCandidate
          || preview.fitScore > bestCandidate.fitScore
          || (preview.fitScore === bestCandidate.fitScore && distFromTarget < bestCandidate.distFromTarget)
        ) {
          bestCandidate = {
            serves: candidateServes,
            fitScore: preview.fitScore,
            cal: preview.macros.cal,
            distFromTarget
          };
        }
      }

      if (bestCandidate) {
        const fitGain = bestCandidate.fitScore - currentEvalPreview.fitScore;
        const currentDist = Math.abs(currentCal - targetKcal);
        const improvesOutlier = isCalorieOutlier && bestCandidate.distFromTarget < currentDist * 0.75 && bestCandidate.fitScore >= currentEvalPreview.fitScore;

        if (fitGain >= 12 || improvesOutlier) {
          hasServingsMismatch = true;
          suggestedServes = bestCandidate.serves;
          if (isCalorieOutlier) {
            const direction = currentCal > targetKcal ? 'high' : 'low';
            servingsReason = `Per-serving calories (${currentCal} kcal) look ${direction} for ${formatMealTypeLabel(primaryEvalType)} (target ~${Math.round(targetKcal)} kcal); ${suggestedServes} servings gives ${bestCandidate.cal} kcal/serving.`;
          } else {
            servingsReason = `Adjusting from ${currentServes} to ${suggestedServes} servings lifts Fit Score by +${fitGain} pts (${currentEvalPreview.fitScore} → ${bestCandidate.fitScore}).`;
          }
        }
      }
    }

    // 3. Macro-based meal-type mismatch check (if title didn't already flag one)
    if (!hasMealTypeMismatch && hasMacros) {
      const evalServes = suggestedServes || currentServes;
      const baselineForCurrentTypes = computeScaledRecipePreview(recipe, evalServes, currentMealTypes, ctx);
      let bestAltType = null;
      for (const opt of MEAL_TYPE_OPTIONS) {
        if (currentMealTypes.includes(opt.key)) continue;
        const altPreview = computeScaledRecipePreview(recipe, evalServes, [opt.key], ctx);
        const gain = altPreview.fitScore - baselineForCurrentTypes.fitScore;
        if (gain >= 15 && (!bestAltType || altPreview.fitScore > bestAltType.fitScore)) {
          bestAltType = { key: opt.key, score: altPreview.fitScore, gain };
        }
      }
      if (bestAltType) {
        hasMealTypeMismatch = true;
        suggestedMealTypes = [bestAltType.key];
        mealTypeReason = `Macros fit ${formatMealTypeLabel(bestAltType.key)} much better (+${bestAltType.gain} pts: ${baselineForCurrentTypes.fitScore} → ${bestAltType.score}).`;
      }
    }

    if (hasServingsMismatch || hasMealTypeMismatch) {
      const suggestedPreview = computeScaledRecipePreview(recipe, suggestedServes, suggestedMealTypes, ctx);
      flagged.push({
        key: `meta:recipe:${recipeId}`,
        recipeId,
        recipeName,
        recipe,
        currentServes,
        suggestedServes,
        hasServingsMismatch,
        servingsReason,
        currentMealTypes,
        suggestedMealTypes,
        hasMealTypeMismatch,
        mealTypeReason,
        currentMacros: currentPreview.macros,
        suggestedMacros: suggestedPreview.macros,
        currentFitScore: currentPreview.fitScore,
        suggestedFitScore: suggestedPreview.fitScore,
        severity: 'advisory'
      });
    }
  }

  return flagged;
}

export async function markRecipeMetadataReviewed(recipeId, decision = {}) {
  if (!recipeId) return null;
  const state = getState();
  const currentPrefs = state.preferences || state.userPrefs || {};
  const previousPrefs = JSON.parse(JSON.stringify(currentPrefs));
  const existingMap = (currentPrefs.reviewedRecipeMetadata && typeof currentPrefs.reviewedRecipeMetadata === 'object')
    ? currentPrefs.reviewedRecipeMetadata
    : {};

  const entry = {
    status: decision.status || 'kept',
    serves: decision.serves ?? null,
    mealTypes: Array.isArray(decision.mealTypes) ? decision.mealTypes : null,
    reviewedAt: new Date().toISOString()
  };

  const updatedPrefs = {
    ...currentPrefs,
    reviewedRecipeMetadata: {
      ...existingMap,
      [String(recipeId)]: entry
    }
  };

  setPreferences(updatedPrefs);
  try {
    await savePreferencesWithAutoPrune(updatedPrefs);
    return entry;
  } catch (err) {
    setPreferences(previousPrefs);
    throw err;
  }
}

export async function resetReviewedRecipeMetadata() {
  const state = getState();
  const currentPrefs = state.preferences || state.userPrefs || {};
  const previousPrefs = JSON.parse(JSON.stringify(currentPrefs));
  const updatedPrefs = {
    ...currentPrefs,
    reviewedRecipeMetadata: {}
  };
  setPreferences(updatedPrefs);
  try {
    if (isDbAvailable()) {
      const cleared = await clearReviewedRecipeMetadataInDb();
      if (!cleared) {
        throw new Error('Failed to clear reviewedRecipeMetadata in Firestore.');
      }
    }
    await savePreferencesWithAutoPrune(updatedPrefs);
    return updatedPrefs;
  } catch (err) {
    setPreferences(previousPrefs);
    throw err;
  }
}

export async function applyRecipeMetadataReview(recipeId, { serves, mealTypes } = {}) {
  const state = getState();
  const previousRecipes = Array.isArray(state.recipes) ? [...state.recipes] : [];
  const recipes = [...previousRecipes];
  const idx = recipes.findIndex(r => String(r.id) === String(recipeId));
  if (idx < 0) return null;

  const original = recipes[idx];
  const safeServes = Math.max(1, Number(serves) || getRecipeServings(original));
  const safeMealTypes = (Array.isArray(mealTypes) && mealTypes.length > 0
    ? Array.from(new Set(mealTypes.map(normalizeMealTypeKey).filter(Boolean)))
    : getRecipeMealTypes(original));
  const finalTypes = safeMealTypes.length > 0 ? safeMealTypes : ['dinner'];

  const preview = computeScaledRecipePreview(original, safeServes, finalTypes, {
    ingredients: state.rootItems || state.ingredients || [],
    products: state.products || [],
    preferences: state.preferences || state.userPrefs || {}
  });

  const { nutrition: _ignoredNut, perServing: _ignoredPerServ, ...cleanOriginal } = original;
  const updatedRecipe = {
    ...cleanOriginal,
    serves: safeServes,
    servings: safeServes,
    types: finalTypes,
    mealSuitability: finalTypes.map(formatMealTypeLabel),
    mealType: finalTypes[0],
    type: finalTypes[0],
    macros: {
      ...(original.macros || {}),
      calories: preview.macros.cal,
      cal: preview.macros.cal,
      protein: preview.macros.prot,
      prot: preview.macros.prot,
      carbs: preview.macros.carb,
      carb: preview.macros.carb,
      fat: preview.macros.fat
    },
    cal: preview.macros.cal,
    calories: preview.macros.cal,
    prot: preview.macros.prot,
    protein: preview.macros.prot,
    carb: preview.macros.carb,
    carbs: preview.macros.carb,
    fat: preview.macros.fat,
    updatedAt: new Date().toISOString()
  };

  recipes[idx] = updatedRecipe;
  setRecipes(recipes);

  try {
    if (isDbAvailable()) {
      const saveRes = await saveRecipe(updatedRecipe);
      if (saveRes && saveRes.success === false) {
        throw new Error(saveRes.error || 'Failed to save updated recipe metadata.');
      }
    }
    await markRecipeMetadataReviewed(recipeId, {
      status: 'applied',
      serves: safeServes,
      mealTypes: finalTypes
    });
    return updatedRecipe;
  } catch (err) {
    setRecipes(previousRecipes);
    throw err;
  }
}

if (typeof window !== 'undefined') {
  window.DataQualityScanner = {
    runAudit,
    scanDataQualitySummary,
    scanServingsAndMealTypeMismatches,
    computeScaledRecipePreview,
    markRecipeMetadataReviewed,
    resetReviewedRecipeMetadata,
    applyRecipeMetadataReview,
    getEffectiveIngredientMacros,
    calculateRecipeDynamicMacros,
    autoRecalibrateRecipeDrift,
    dismissDataQualityAdvisory,
    performGlobalProductRelink,
    verifyZeroCalorieIngredient
  };
  window.DataQualityEngine = window.DataQualityScanner;
  window.DataQualityScannerService = window.DataQualityScanner;
}
