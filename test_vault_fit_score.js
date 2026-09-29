import { calculateMealFitScore } from './src/utils/fitScoreCalculator.js';

// Mock getProfileMealTargets globally
globalThis.getProfileMealTargets = (person, meal) => ({ kcal: 500, protein: 35 });

const mockRecipe = {
  id: 'test-recipe',
  name: 'Nduja Pesto Scrambled Eggs',
  perServing: { kcal: 564, protein: 25 },
  portions: { eCal: 564, eProt: 25, cCal: 564, cProt: 25 }
};

console.log('--- Diagnostic Run: Vault Context ---');
const result = calculateMealFitScore(mockRecipe, 'dinner', {
  activeProfile: 'everyone',
  portionScaled: true,
  variant: 'original'
});

console.log('Result:', JSON.stringify(result, null, 2));
