/**
 * src/store/state.js
 * Centralized application state and event handling.
 */

export const state = {
  version: 'v3.35.3', // Needs updating later
  recipes: [],
  draftRecipes: [],
  ingredients: [],
  products: [],
  categories: [],
  inventory: [],
  preferences: null,
  userPrefs: {},
  settings: {},
  currentPlan: null,
  shoppingList: [],
  isCachedHydrated: false,
  isCloudHydrated: false
};

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

export const getState = () => state;
export function updateState(patch) {
  if (!patch || typeof patch !== 'object') return;
  Object.assign(state, patch);
  // Need to import saveStateCache here, but that causes circular dependency.
  // Maybe move saveStateCache to a separate utility or accept that some functions need to be passed in.
}
