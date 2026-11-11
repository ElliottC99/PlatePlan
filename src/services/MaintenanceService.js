/**
 * src/services/MaintenanceService.js (v3.35.22)
 * One-off database maintenance and migration utilities.
 * Dedicated service for data alignment, fit score recalculation, and batch migrations.
 */

import { getState, setRecipes } from '../store/store.js';
import { calculateMealFitScore } from '../utils/fitScoreCalculator.js';
import { batchUpdateRecipesInDb } from './HouseholdRepository.js';
import { calculateItemNutrition } from './NutritionService.js';
import { resolveDefaultProduct } from './PantryHierarchyService.js';
import { resolveDynamicProductForIngredient } from './PantryTaxonomyService.js';

/**
 * Re-aligns fit scores for all existing recipes using the current FitScoreEngine formulas,
 * updates local Store state, and commits a batched update to Firestore.
 *
 * @param {Object} [options={}]
 * @param {boolean} [options.dryRun=false] - If true, computes without committing to Firestore
 * @returns {Promise<{ success: boolean, updatedCount: number, updates: Array<Object> }>}
 */
export async function alignAllFitScores(options = {}) {
  const isDryRun = Boolean(options.dryRun);
  const state = getState();
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];

  if (recipes.length === 0) {
    console.log('[MaintenanceService] alignAllFitScores: No recipes found in store.');
    return { success: true, updatedCount: 0, updates: [] };
  }

  console.log(`[MaintenanceService] alignAllFitScores: Processing ${recipes.length} recipes...`);

  const updates = [];
  const updatedRecipesForStore = [];

  for (const r of recipes) {
    if (!r || !r.id) continue;

    const targetMealType = r.types?.[0] || r.type || 'dinner';

    // Compute live fit score using household aggregate 'everyone'
    const fitResult = calculateMealFitScore(r, targetMealType, {
      activeProfile: 'everyone',
      portionScaled: true,
      variant: 'original'
    });

    const newScore = Math.round(Number(fitResult?.score) || 0);

    const updatePayload = {
      id: r.id,
      fitScore: newScore,
      _computedFitScore: newScore
    };

    // If enhanced variant exists, also compute enhanced fit
    if (r.enhanced) {
      const enhancedResult = calculateMealFitScore(r, targetMealType, {
        activeProfile: 'everyone',
        portionScaled: true,
        variant: 'enhanced'
      });
      const newEnhancedScore = Math.round(Number(enhancedResult?.score) || 0);
      updatePayload.enhancedFitScore = newEnhancedScore;
    }

    updates.push(updatePayload);

    updatedRecipesForStore.push({
      ...r,
      fitScore: newScore,
      _computedFitScore: newScore,
      ...(updatePayload.enhancedFitScore !== undefined ? { enhancedFitScore: updatePayload.enhancedFitScore } : {})
    });
  }

  // Update in-memory Store so UI reacts immediately
  if (updatedRecipesForStore.length > 0) {
    setRecipes(updatedRecipesForStore);
  }

  if (isDryRun) {
    console.log(`[MaintenanceService] alignAllFitScores (DRY RUN): Computed ${updates.length} recipe fit scores.`);
    return { success: true, updatedCount: updates.length, updates };
  }

  try {
    const res = await batchUpdateRecipesInDb(updates);
    console.log(`[MaintenanceService] alignAllFitScores committed to Firestore: ${res.count || updates.length} recipes updated.`);
    return {
      success: true,
      updatedCount: res.count || updates.length,
      updates
    };
  } catch (err) {
    console.error('[MaintenanceService] alignAllFitScores commit failed:', err);
    return {
      success: false,
      error: err.message || err,
      updatedCount: 0,
      updates
    };
  }
}

/**
 * Recalculates nutrition macros, calories, protein, and fit scores for all existing recipes
 * using the optimal default products from the Pantry Bank, updates local Store,
 * and commits a batched update to Firestore.
 *
 * @param {Object} [options={}]
 * @param {boolean} [options.dryRun=false] - If true, computes without committing to Firestore
 * @returns {Promise<{ success: boolean, updatedCount: number, updates: Array<Object> }>}
 */
export async function recalculateAllRecipeMacros(options = {}) {
  const isDryRun = Boolean(options.dryRun);
  const state = typeof getState === 'function' ? getState() : {};
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
  const products = Array.isArray(state.products) ? state.products : [];

  if (recipes.length === 0) {
    return { success: true, updatedCount: 0, updates: [] };
  }

  const ingMap = new Map(ingredients.map(i => [String(i.id), i]));
  const prodMap = new Map(products.map(p => [String(p.id), p]));

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
        preferences: state.preferences || state.settings
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
    const perServing = {
      calories: Math.round(totalCal / s),
      protein: Math.round((totalProt / s) * 10) / 10,
      carbs: Math.round((totalCarb / s) * 10) / 10,
      fat: Math.round((totalFat / s) * 10) / 10
    };

    return {
      perServing,
      total: {
        cal: Math.round(totalCal),
        prot: Math.round(totalProt * 10) / 10,
        carb: Math.round(totalCarb * 10) / 10,
        fat: Math.round(totalFat * 10) / 10
      }
    };
  }

  const updates = [];
  const updatedRecipesForStore = [];

  for (const r of recipes) {
    if (!r || !r.id) continue;
    const serves = Number(r.servings || r.serves || 4) || 4;
    const originalRes = computeNodeMacros(r, serves);

    const updatedOriginal = {
      ...r,
      macros: originalRes.perServing,
      calories: originalRes.perServing.calories,
      protein: originalRes.perServing.protein,
      carbs: originalRes.perServing.carbs,
      fat: originalRes.perServing.fat,
      nutrition: {
        ...originalRes.perServing,
        cal: originalRes.perServing.calories,
        prot: originalRes.perServing.protein,
        perServing: { ...originalRes.perServing, cal: originalRes.perServing.calories, prot: originalRes.perServing.protein },
        total: originalRes.total
      }
    };

    const targetMealType = updatedOriginal.mealSuitability?.[0] || updatedOriginal.types?.[0] || updatedOriginal.type || 'dinner';
    const fitResult = calculateMealFitScore(updatedOriginal, targetMealType, {
      activeProfile: 'everyone',
      portionScaled: true,
      variant: 'original'
    });
    const newScore = Math.round(Number(fitResult?.score) || 0);
    updatedOriginal.fitScore = newScore;
    updatedOriginal._computedFitScore = newScore;

    const updatePayload = {
      id: r.id,
      macros: updatedOriginal.macros,
      calories: updatedOriginal.calories,
      protein: updatedOriginal.protein,
      carbs: updatedOriginal.carbs,
      fat: updatedOriginal.fat,
      nutrition: updatedOriginal.nutrition,
      fitScore: newScore,
      _computedFitScore: newScore,
      updatedAt: new Date().toISOString()
    };

    if (r.enhanced) {
      const enhancedServes = Number(r.enhanced.servings || r.enhanced.serves || serves) || serves;
      const enhancedRes = computeNodeMacros(r.enhanced, enhancedServes);
      const updatedEnhanced = {
        ...r.enhanced,
        macros: enhancedRes.perServing,
        calories: enhancedRes.perServing.calories,
        protein: enhancedRes.perServing.protein,
        carbs: enhancedRes.perServing.carbs,
        fat: enhancedRes.perServing.fat,
        nutrition: {
          ...enhancedRes.perServing,
          cal: enhancedRes.perServing.calories,
          prot: enhancedRes.perServing.protein,
          perServing: { ...enhancedRes.perServing, cal: enhancedRes.perServing.calories, prot: enhancedRes.perServing.protein },
          total: enhancedRes.total
        }
      };
      const enhFitResult = calculateMealFitScore({ ...updatedOriginal, enhanced: updatedEnhanced }, targetMealType, {
        activeProfile: 'everyone',
        portionScaled: true,
        variant: 'enhanced'
      });
      const newEnhScore = Math.round(Number(enhFitResult?.score) || 0);
      updatedEnhanced.fitScore = newEnhScore;
      updatedOriginal.enhanced = updatedEnhanced;
      updatedOriginal.enhancedFitScore = newEnhScore;

      updatePayload.enhanced = updatedEnhanced;
      updatePayload.enhancedFitScore = newEnhScore;
    }

    // Delta-detection: Only push to Firestore write updates if macros or fit scores meaningfully changed
    const oldCal = Number(r.nutrition?.perServing?.cal ?? r.macros?.calories ?? r.calories ?? 0);
    const oldProt = Number(r.nutrition?.perServing?.prot ?? r.macros?.protein ?? r.protein ?? 0);
    const oldScore = Number(r.fitScore ?? r._computedFitScore ?? 0);
    const hasOrigChange = Math.abs(oldCal - updatedOriginal.calories) > 0.5 ||
                          Math.abs(oldProt - updatedOriginal.protein) > 0.2 ||
                          oldScore !== newScore;

    let hasEnhChange = false;
    if (r.enhanced && updatedOriginal.enhanced) {
      const oldEnhCal = Number(r.enhanced.nutrition?.perServing?.cal ?? r.enhanced.macros?.calories ?? r.enhanced.calories ?? 0);
      const oldEnhProt = Number(r.enhanced.nutrition?.perServing?.prot ?? r.enhanced.macros?.protein ?? r.enhanced.protein ?? 0);
      const oldEnhScore = Number(r.enhancedFitScore ?? r.enhanced.fitScore ?? 0);
      hasEnhChange = Math.abs(oldEnhCal - updatedOriginal.enhanced.calories) > 0.5 ||
                     Math.abs(oldEnhProt - updatedOriginal.enhanced.protein) > 0.2 ||
                     oldEnhScore !== updatedOriginal.enhancedFitScore;
    }

    if (options.forceAll || hasOrigChange || hasEnhChange) {
      updates.push(updatePayload);
    }
    updatedRecipesForStore.push(updatedOriginal);
  }

  if (updatedRecipesForStore.length > 0) {
    setRecipes(updatedRecipesForStore);
    if (getState()) getState().recipes = updatedRecipesForStore;
  }

  if (isDryRun) {
    return { success: true, updatedCount: updates.length, updates };
  }

  try {
    const res = await batchUpdateRecipesInDb(updates);
    return {
      success: true,
      updatedCount: res.count || updates.length,
      updates
    };
  } catch (err) {
    console.error('[MaintenanceService] recalculateAllRecipeMacros failed:', err);
    return {
      success: false,
      error: err.message || err,
      updatedCount: 0,
      updates
    };
  }
}

/**
 * Migrates legacy recipes with static productId/bankId bindings to dynamic pantry taxonomy.
 * Resolves child subtypes or parent root items, strips product IDs, and routes orphans to Data Quality.
 *
 * @param {Object} [options={}]
 * @param {boolean} [options.dryRun=false]
 * @returns {Promise<{ success: boolean, migratedCount: number, updates: Array<Object> }>}
 */
export async function migrateLegacyRecipeProductBindings(options = {}) {
  const isDryRun = Boolean(options.dryRun);
  const state = typeof getState === 'function' ? getState() : {};
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const ingredients = Array.isArray(state.rootItems) ? state.rootItems : (Array.isArray(state.ingredients) ? state.ingredients : []);
  const products = Array.isArray(state.products) ? state.products : [];

  if (recipes.length === 0) {
    return { success: true, migratedCount: 0, updates: [] };
  }

  const prodMap = new Map(products.map(p => [String(p.id), p]));
  const updates = [];
  const updatedRecipesForStore = [];

  for (const r of recipes) {
    if (!r || !r.id) continue;
    let recipeChanged = false;

    const migrateLine = (line) => {
      if (!line || typeof line !== 'object') return line;
      let newLine = { ...line };
      const hasDirectProduct = Boolean(line.productId || line.bankId);
      const isMissingTaxonomy = !line.subtypeId && !line.ingredientId;

      if (hasDirectProduct || isMissingTaxonomy) {
        const prodId = line.productId || line.bankId;
        const matchedProd = prodId ? prodMap.get(String(prodId)) : resolveDynamicProductForIngredient(line, { products, ingredients });

        if (matchedProd) {
          newLine.subtypeId = newLine.subtypeId || matchedProd.subtypeId || null;
          newLine.ingredientId = newLine.ingredientId || matchedProd.ingredientId || null;
          newLine.category = newLine.category || matchedProd.category || matchedProd.cat || null;
          if (newLine.needsSubtypeMapping) delete newLine.needsSubtypeMapping;
        } else {
          if (!newLine.subtypeId && !newLine.ingredientId) {
            newLine.needsSubtypeMapping = true;
          }
        }

        if (hasDirectProduct) {
          delete newLine.productId;
          delete newLine.bankId;
          recipeChanged = true;
        }
      }
      return newLine;
    };

    let updatedIngredients = null;
    if (Array.isArray(r.ingredients)) {
      updatedIngredients = r.ingredients.map(migrateLine);
    }

    let updatedSections = null;
    if (Array.isArray(r.ingredientSections)) {
      updatedSections = r.ingredientSections.map(sec => ({
        ...sec,
        ingredients: Array.isArray(sec.ingredients) ? sec.ingredients.map(migrateLine) : []
      }));
    }

    let updatedEnhanced = null;
    if (r.enhanced && typeof r.enhanced === 'object') {
      const enh = { ...r.enhanced };
      if (Array.isArray(enh.ingredients)) {
        enh.ingredients = enh.ingredients.map(migrateLine);
      }
      if (Array.isArray(enh.ingredientSections)) {
        enh.ingredientSections = enh.ingredientSections.map(sec => ({
          ...sec,
          ingredients: Array.isArray(sec.ingredients) ? sec.ingredients.map(migrateLine) : []
        }));
      }
      updatedEnhanced = enh;
    }

    if (recipeChanged) {
      const updatedRecipe = {
        ...r,
        ingredients: updatedIngredients || r.ingredients,
        ...(updatedSections ? { ingredientSections: updatedSections } : {}),
        ...(updatedEnhanced ? { enhanced: updatedEnhanced } : {}),
        schemaVersion: 2,
        updatedAt: new Date().toISOString()
      };
      updates.push(updatedRecipe);
      updatedRecipesForStore.push(updatedRecipe);
    }
  }

  if (updates.length > 0 && !isDryRun) {
    await batchUpdateRecipesInDb(updates);
    const recipeMap = new Map(recipes.map(r => [r.id, r]));
    updatedRecipesForStore.forEach(u => recipeMap.set(u.id, u));
    setRecipes(Array.from(recipeMap.values()));
  }

  return { success: true, migratedCount: updates.length, updates };
}

if (typeof window !== 'undefined') {
  window.MaintenanceService = {
    alignAllFitScores,
    recalculateAllRecipeMacros,
    migrateLegacyRecipeProductBindings
  };
  window.alignAllFitScores = alignAllFitScores;
  window.recalculateAllRecipeMacros = recalculateAllRecipeMacros;
  window.migrateLegacyRecipeProductBindings = migrateLegacyRecipeProductBindings;
}
