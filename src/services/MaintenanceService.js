/**
 * src/services/MaintenanceService.js (v3.35.22)
 * One-off database maintenance and migration utilities.
 * Dedicated service for data alignment, fit score recalculation, and batch migrations.
 */

import { getState, setRecipes } from '../store/store.js';
import { calculateMealFitScore } from '../utils/fitScoreCalculator.js';
import { batchUpdateRecipesInDb } from './HouseholdRepository.js';

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

if (typeof window !== 'undefined') {
  window.MaintenanceService = {
    alignAllFitScores
  };
  window.alignAllFitScores = alignAllFitScores;
}
