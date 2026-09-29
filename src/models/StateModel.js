/**
 * src/models/StateModel.js (v3.16.0)
 * Data model helpers and getters for decoupled profile preferences.
 * Calculates distinct per-meal calorie and protein targets with zero hardcoded defaults.
 */

/**
 * Calculates distinct per-meal calorie and protein targets for a profile.
 * - Kcal Target = (calorieSplits[mealType] / 100) * dailyKcal
 * - Protein Target = (proteinSplits[mealType] / 100) * dailyProtein
 *
 * @param {string} profileId Identifier ('elliott', 'chloe', etc.)
 * @param {string} mealType Meal name ('breakfast', 'lunch', 'snack', 'dinner')
 * @param {Object} [customProfiles=null] Optional profiles dictionary to read from
 * @returns {{ kcal: number, protein: number, calorieSplitPct: number, proteinSplitPct: number, profileName: string }}
 */
export function getProfileMealTargets(profileId, mealType, customProfiles = null) {
  const profiles = customProfiles ||
    (typeof window !== 'undefined' && (
      window.state?.preferences?.profiles ||
      window.state?.userPrefs?.profiles
    )) || {};

  const profile = profiles[profileId] || null;
  const profileName = profile?.name || (typeof profileId === 'string' ? profileId.charAt(0).toUpperCase() + profileId.slice(1) : 'Profile');

  const dailyKcal = Number(profile?.dailyKcal || 0);
  const dailyProtein = Number(profile?.dailyProtein || 0);

  const normMeal = String(mealType || '').toLowerCase();
  const mealKey = normMeal === 'snacking' ? 'snack' : normMeal;

  const calSplits = profile?.calorieSplits || {};
  const protSplits = profile?.proteinSplits || {};

  const calSplitPct = Number(calSplits[mealKey] ?? calSplits[normMeal] ?? 0);
  const protSplitPct = Number(protSplits[mealKey] ?? protSplits[normMeal] ?? 0);

  // Exact formulas as specified
  const kcal = Math.round((calSplitPct / 100) * dailyKcal);
  const protein = Math.round((protSplitPct / 100) * dailyProtein);

  return {
    kcal,
    protein,
    calorieSplitPct: calSplitPct,
    proteinSplitPct: protSplitPct,
    dailyKcal,
    dailyProtein,
    profileName
  };
}

/**
 * Normalizes raw profile object from Firestore into the canonical StateModel structure.
 * Zero hardcoded fallback numbers are used.
 *
 * @param {string} profileId
 * @param {Object} rawData
 * @returns {Object}
 */
export function normalizeProfileData(profileId, rawData = {}) {
  const id = String(profileId || '').toLowerCase();
  const name = rawData.name || (id.charAt(0).toUpperCase() + id.slice(1));
  const dailyKcal = Number(rawData.dailyKcal || 0);
  const dailyProtein = Number(rawData.dailyProtein || 0);

  const calSrc = rawData.calorieSplits || rawData.splits || {};
  const protSrc = rawData.proteinSplits || rawData.splits || {};

  const parseSplit = (src, meal) => {
    if (src[meal] !== undefined && src[meal] !== null) return Number(src[meal]) || 0;
    if (meal === 'snack' && src.snacking !== undefined) return Number(src.snacking) || 0;
    if (meal === 'snacking' && src.snack !== undefined) return Number(src.snack) || 0;
    return 0;
  };

  const calBf = parseSplit(calSrc, 'breakfast');
  const calLu = parseSplit(calSrc, 'lunch');
  const calSn = parseSplit(calSrc, 'snack');
  const calDi = calSrc.dinner !== undefined ? Number(calSrc.dinner) || 0 : Math.max(0, 100 - (calBf + calLu + calSn));

  const protBf = parseSplit(protSrc, 'breakfast');
  const protLu = parseSplit(protSrc, 'lunch');
  const protSn = parseSplit(protSrc, 'snack');
  const protDi = protSrc.dinner !== undefined ? Number(protSrc.dinner) || 0 : Math.max(0, 100 - (protBf + protLu + protSn));

  return {
    enabled: rawData.enabled !== undefined ? Boolean(rawData.enabled) : true,
    name,
    dailyKcal,
    dailyProtein,
    calorieSplits: {
      breakfast: calBf,
      lunch: calLu,
      snack: calSn,
      dinner: calDi
    },
    proteinSplits: {
      breakfast: protBf,
      lunch: protLu,
      snack: protSn,
      dinner: protDi
    }
  };
}

/**
 * Returns all active profiles from state.
 * @returns {Object}
 */
export function getProfilesFromState() {
  if (typeof window === 'undefined') return {};
  return (
    window.state?.preferences?.profiles ||
    window.state?.userPrefs?.profiles ||
    {}
  );
}

if (typeof window !== 'undefined') {
  window.getProfileMealTargets = getProfileMealTargets;
  window.normalizeProfileData = normalizeProfileData;
  window.getProfilesFromState = getProfilesFromState;
}
