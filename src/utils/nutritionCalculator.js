/**
 * src/utils/nutritionCalculator.js (v3.15.3)
 * Preference-driven macro division and zero-drift remainder engine.
 * Calculates exact meal calorie and protein targets with zero rounding drift
 * by anchoring dinner to the exact mathematical remainder of the daily targets.
 */

export const DEFAULT_MEAL_SPLITS = Object.freeze({
  breakfast: 25,
  lunch: 30,
  snacking: 10,
  dinner: 35
});

/**
 * Resolves meal split percentages for calories and protein.
 * Reads dynamically from state.preferences.mealSplits or passed userPreferences.
 * Falls back to 25% Breakfast, 30% Lunch, 10% Snacking, 35% Dinner.
 *
 * @param {Object} [userPreferences={}]
 * @param {string|null} [person=null] Optional person identifier ('elliott' | 'chloe')
 * @returns {{ calories: Object, protein: Object }}
 */
export function resolveMealSplitPercentages(userPreferences = {}, person = null) {
  const globalStatePrefs = (typeof window !== 'undefined' && (
    window.state?.preferences?.mealSplits ||
    window.state?.userPrefs?.mealSplits ||
    window.state?.preferences ||
    window.state?.userPrefs
  )) || {};

  const passedSplits = userPreferences?.mealSplits || userPreferences?.splits || userPreferences || {};

  // Check state.preferences.profiles first for decoupled splits
  const profile = (person && (
    passedSplits.profiles?.[person] ||
    globalStatePrefs.profiles?.[person] ||
    (typeof window !== 'undefined' && (window.state?.preferences?.profiles?.[person] || window.state?.userPrefs?.profiles?.[person]))
  )) || null;

  if (profile) {
    const calBf = Number(profile.calorieSplits?.breakfast ?? 0);
    const calLu = Number(profile.calorieSplits?.lunch ?? 0);
    const calSn = Number(profile.calorieSplits?.snack ?? profile.calorieSplits?.snacking ?? 0);
    const calDi = profile.calorieSplits?.dinner !== undefined ? Number(profile.calorieSplits.dinner) : Math.max(0, 100 - (calBf + calLu + calSn));

    const protBf = Number(profile.proteinSplits?.breakfast ?? 0);
    const protLu = Number(profile.proteinSplits?.lunch ?? 0);
    const protSn = Number(profile.proteinSplits?.snack ?? profile.proteinSplits?.snacking ?? 0);
    const protDi = profile.proteinSplits?.dinner !== undefined ? Number(profile.proteinSplits.dinner) : Math.max(0, 100 - (protBf + protLu + protSn));

    return {
      calories: { breakfast: calBf, lunch: calLu, snacking: calSn, dinner: calDi },
      protein: { breakfast: protBf, lunch: protLu, snacking: protSn, dinner: protDi }
    };
  }

  // Check for person-specific splits if available
  const personSplits = (person && (passedSplits[person] || globalStatePrefs.mealSplits?.[person] || globalStatePrefs[person])) || {};

  // Calorie split source resolution
  const calSource = personSplits.calories || personSplits || passedSplits.calories || passedSplits || globalStatePrefs.mealSplits?.calories || globalStatePrefs.mealSplits || globalStatePrefs;
  const bfCal = Number(calSource.breakfast ?? calSource.bf ?? DEFAULT_MEAL_SPLITS.breakfast);
  const luCal = Number(calSource.lunch ?? calSource.lu ?? DEFAULT_MEAL_SPLITS.lunch);
  const snCal = Number(calSource.snacking ?? calSource.snack ?? calSource.sn ?? DEFAULT_MEAL_SPLITS.snacking);
  const diCal = Number(calSource.dinner ?? calSource.di ?? (100 - (bfCal + luCal + snCal)));

  // Protein split source resolution (calculates independently)
  const protSource = personSplits.protein || personSplits || passedSplits.protein || passedSplits || globalStatePrefs.mealSplits?.protein || globalStatePrefs.mealSplits || globalStatePrefs;
  const bfProt = Number(protSource.breakfast ?? protSource.bf ?? bfCal);
  const luProt = Number(protSource.lunch ?? protSource.lu ?? luCal);
  const snProt = Number(protSource.snacking ?? protSource.snack ?? protSource.sn ?? snCal);
  const diProt = Number(protSource.dinner ?? protSource.di ?? (100 - (bfProt + luProt + snProt)));

  return {
    calories: { breakfast: bfCal, lunch: luCal, snacking: snCal, dinner: diCal },
    protein: { breakfast: bfProt, lunch: luProt, snacking: snProt, dinner: diProt }
  };
}

/**
 * Calculates zero-drift meal calorie and protein distribution.
 * 
 * - Breakfast, Lunch, and Snacking targets use Math.round((pct / 100) * target).
 * - Dinner (primary anchor meal) is calculated dynamically as the exact remainder:
 *     Kcal_dinner = dailyKcal - (Kcal_breakfast + Kcal_lunch + Kcal_snack)
 *     Protein_dinner = dailyProtein - (Protein_breakfast + Protein_lunch + Protein_snack)
 * - Calorie and protein splits calculate independently so meal sums always equal 100% of daily targets.
 *
 * @param {number} dailyKcal Total daily calorie target
 * @param {number} dailyProtein Total daily protein target (grams)
 * @param {Object} [userPreferences={}] Optional preferences payload
 * @returns {Object} Structured meal targets: { breakfast, lunch, dinner, snacking }
 */
export function calculateMealSplit(dailyKcal, dailyProtein, userPreferences = {}) {
  const targetKcal = Math.max(0, Math.round(Number(dailyKcal) || 0));
  const targetProtein = Math.max(0, Math.round(Number(dailyProtein) || 0));
  const person = userPreferences?.person || null;

  const { calories: calPct, protein: protPct } = resolveMealSplitPercentages(userPreferences, person);

  // 1. Compute Breakfast, Lunch, and Snacking targets using Math.round((pct / 100) * target)
  const bfKcal = Math.round((calPct.breakfast / 100) * targetKcal);
  const luKcal = Math.round((calPct.lunch / 100) * targetKcal);
  const snKcal = Math.round((calPct.snacking / 100) * targetKcal);

  const bfProt = Math.round((protPct.breakfast / 100) * targetProtein);
  const luProt = Math.round((protPct.lunch / 100) * targetProtein);
  const snProt = Math.round((protPct.snacking / 100) * targetProtein);

  // 2. Compute Dinner dynamically as the exact remainder to eliminate any rounding drift
  const diKcal = targetKcal - (bfKcal + luKcal + snKcal);
  const diProt = targetProtein - (bfProt + luProt + snProt);

  return {
    breakfast: {
      kcal: Math.max(0, bfKcal),
      protein: Math.max(0, bfProt)
    },
    lunch: {
      kcal: Math.max(0, luKcal),
      protein: Math.max(0, luProt)
    },
    dinner: {
      kcal: Math.max(0, diKcal),
      protein: Math.max(0, diProt)
    },
    snacking: {
      kcal: Math.max(0, snKcal),
      protein: Math.max(0, snProt)
    }
  };
}

if (typeof window !== 'undefined') {
  window.calculateMealSplit = calculateMealSplit;
  window.resolveMealSplitPercentages = resolveMealSplitPercentages;
}
