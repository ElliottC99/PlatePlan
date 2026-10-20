/**
 * src/services/DataQualityService.js (v3.38.8)
 * Handles data quality rules, orphan detection payloads, and automated remediation helpers.
 */

import { getState, setIngredients, runOptimisticMutation } from '../store/store.js';
import { dismissAdvisoryInDb } from './HouseholdRepository.js';
import { saveIngredient } from './IngredientRepository.js';

export async function dismissDataQualityAdvisory(issueKey, rerenderCallback) {
  const state = getState() || {};
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
    console.error('[DataQualityService] dismissDataQualityAdvisory error:', err);
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
    console.error('[DataQualityService] verifyZeroCalorieIngredient error:', err);
    throw err;
  }
}
