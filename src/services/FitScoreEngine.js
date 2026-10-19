/**
 * src/services/FitScoreEngine.js (v3.35.22)
 * Asymmetric Fit Score Formula Engine with strict 85-point hard caps outside good ranges.
 * Fully isolated pure functional math module with standard ES6 exports.
 */

export {
  calculateCalorieScore,
  calculateProteinScore,
  calculateMealFitScore,
  calculateRecipeFit,
  getFitScoreTierMeta,
  extractRecipeMacros
} from '../utils/fitScoreCalculator.js';

import {
  calculateCalorieScore,
  calculateProteinScore,
  calculateMealFitScore,
  getFitScoreTierMeta
} from '../utils/fitScoreCalculator.js';

/**
 * Calculates household aggregate score: exactly (userA_score + userB_score) / 2
 * @param {number} userA_score
 * @param {number} userB_score
 * @returns {number}
 */
export function calculateHouseholdScore(userA_score, userB_score) {
  const a = Number(userA_score) || 0;
  const b = Number(userB_score) || 0;
  return Math.round((a + b) / 2);
}

/**
 * Computes standard fit score evaluation for a recipe against meal slot and active profile.
 * @param {Object} recipe
 * @param {string} [mealType='dinner']
 * @param {Object} [options={}]
 * @returns {Object}
 */
export function computeFitScore(recipe, mealType = 'dinner', options = {}) {
  return calculateMealFitScore(recipe, mealType, options);
}

if (typeof window !== 'undefined') {
  window.FitScoreEngine = {
    calculateCalorieScore,
    calculateProteinScore,
    calculateHouseholdScore,
    computeFitScore,
    calculateMealFitScore,
    getFitScoreTierMeta
  };
}
