export const state = {
  version: 'v3.35.3',
  recipes: [],
  draftRecipes: [],
  ingredients: [],
  rootItems: [],
  products: [],
  categories: [],
  preferences: null,
  userPrefs: {},
  settings: {},
  currentPlan: null,
  shoppingList: [],
  isCachedHydrated: false,
  isCloudHydrated: false
};

export const getState = () => state;

/**
 * Dispatch a custom event on the document in a safe microtask.
 */
export function dispatchStateEvent(eventName, detail) {
  if (typeof document !== 'undefined') {
    Promise.resolve().then(() => {
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
    });
  }
}

/**
 * Subscribe to state changes on a specific domain or globally.
 */
export function subscribe(domainOrCallback, maybeCallback) {
  if (typeof document === 'undefined') return () => {};
  if (typeof domainOrCallback === 'function') {
    const listener = domainOrCallback;
    const handler = (e) => listener(state, e.detail);
    document.addEventListener('plateplan:state:patch', handler);
    return () => {
      document.removeEventListener('plateplan:state:patch', handler);
    };
  }
  const domain = domainOrCallback;
  const callback = maybeCallback;
  if (typeof callback !== 'function') return () => {};
  const eventName = `plateplan:state:${domain}`;
  const handler = (e) => callback(e.detail);
  document.addEventListener(eventName, handler);
  return () => {
    document.removeEventListener(eventName, handler);
  };
}

export function updateState(patch) {
  if (!patch || typeof patch !== 'object') return;
  Object.assign(state, patch);
}

/**
 * Calculates distinct per-meal calorie and protein targets for a profile.
 */
export function getProfileMealTargets(profileId, mealType, customProfiles = null) {
  const profiles = customProfiles ||
    (typeof window !== 'undefined' && (
      getState()?.preferences?.profiles ||
      getState()?.userPrefs?.profiles
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

  const kcal = profile?.meals?.[mealKey]?.kcal ??
               profile?.meals?.[normMeal]?.kcal ??
               Math.round((calSplitPct / 100) * dailyKcal);

  const protein = profile?.meals?.[mealKey]?.protein ??
                  profile?.meals?.[normMeal]?.protein ??
                  Math.round((protSplitPct / 100) * dailyProtein);

  return {
    kcal: Number(kcal) || 0,
    protein: Number(protein) || 0,
    calorieSplitPct: calSplitPct,
    proteinSplitPct: protSplitPct,
    dailyKcal,
    dailyProtein,
    profileName
  };
}

/**
 * Normalizes raw profile object from Firestore into the canonical profile structure.
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
 */
export function getProfilesFromState() {
  if (typeof window === 'undefined') return {};
  return (
    getState()?.preferences?.profiles ||
    getState()?.userPrefs?.profiles ||
    {}
  );
}

if (typeof window !== 'undefined') {
  window.getProfileMealTargets = getProfileMealTargets;
  window.normalizeProfileData = normalizeProfileData;
  window.getProfilesFromState = getProfilesFromState;
}
