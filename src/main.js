/**
 * src/main.js (v3.3.13)
 * Secure ES6 data bridge with strict type-sanitized global state initialization.
 */
import { waitForAuth } from './services/AuthService.js';
import { hydrateHouseholdData } from './services/HydrationService.js';
import { getState } from './store/store.js';

// 1. STRICT TYPE SANITIZATION (Wipes string pollution like '[Circular]' from window.state)
if (typeof window !== 'undefined') {
  // Ensure window.state is a valid, non-null object
  if (typeof window.state !== 'object' || window.state === null) {
    window.state = {};
  }

  // Ensure window.state.userPrefs is a valid, non-null object
  if (typeof window.state.userPrefs !== 'object' || window.state.userPrefs === null) {
    window.state.userPrefs = {};
  }

  // Ensure window.state.settings is a valid object
  if (typeof window.state.settings !== 'object' || window.state.settings === null) {
    window.state.settings = {};
  }

  // Instantiate concrete array targets for legacy lookups
  window.state.recipes = Array.isArray(window.state.recipes) ? window.state.recipes : [];
  window.state.favourites = Array.isArray(window.state.favourites) ? window.state.favourites : [];
  window.state.userFavourites = Array.isArray(window.state.userFavourites) ? window.state.userFavourites : [];
  window.state.ingredients = Array.isArray(window.state.ingredients) ? window.state.ingredients : [];
  
  window.state.userPrefs.favouriteVariantIds = Array.isArray(window.state.userPrefs.favouriteVariantIds)
    ? window.state.userPrefs.favouriteVariantIds
    : [];
  window.state.userPrefs.favourites = Array.isArray(window.state.userPrefs.favourites)
    ? window.state.userPrefs.favourites
    : [];

  // Global top-level aliases read directly by legacy functions
  window.favourites = window.state.favourites;
  window.userFavourites = window.state.userFavourites;

  // Monkey-patch or wrap isRecipeVariantFavourite in legacy window space if present, to prevent unhandled crashes
  if (typeof window.isRecipeVariantFavourite === 'function') {
    const origFavCheck = window.isRecipeVariantFavourite;
    window.isRecipeVariantFavourite = function(...args) {
      try {
        return origFavCheck.apply(this, args);
      } catch (e) {
        return false;
      }
    };
  }
}

// Deep mutator to ensure clean recipes and variants
function deepMutate(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepMutate(item));
  }
  
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (obj[key] === undefined || obj[key] === null) {
      if (['tags', 'categories', 'favourites', 'labels', 'ingredients', 'variants', 'steps', 'allergens', 'favouritedBy', 'userFavourites'].includes(key)) {
        obj[key] = [];
      } else {
        obj[key] = '';
      }
    } else {
      obj[key] = deepMutate(obj[key]);
    }
  }
  
  if (!Array.isArray(obj.tags)) obj.tags = [];
  if (!Array.isArray(obj.categories)) obj.categories = [];
  if (!Array.isArray(obj.variants)) obj.variants = [];
  if (!Array.isArray(obj.favourites)) obj.favourites = [];
  
  return obj;
}

function sanitizeRecipes(recipes) {
  if (!Array.isArray(recipes)) return [];
  return recipes.map(recipe => deepMutate(JSON.parse(JSON.stringify(recipe))));
}

function updateVersionBadge() {
  const footerEl = document.getElementById('app-version');
  if (footerEl) {
    footerEl.textContent = 'v3.3.13 (ES6 Modern)';
  }
}

document.addEventListener('plateplan:state:recipes', (e) => {
  const rawRecipes = e.detail || [];
  const cleanRecipes = sanitizeRecipes(rawRecipes);
  
  if (typeof window !== 'undefined') {
    window.state.recipes = cleanRecipes;
    window.allRecipes = cleanRecipes;
    if (window.PlatePlanRecipes) {
      window.PlatePlanRecipes.State = window.PlatePlanRecipes.State || {};
      window.PlatePlanRecipes.State.recipes = cleanRecipes;
    }
    if (typeof window.renderAll === 'function') {
      try { window.renderAll(); } catch (err) { console.warn('[Modern Bridge] renderAll warning:', err); }
    }
    if (typeof window.PlatePlanRecipes?.renderVault === 'function') {
      try { window.PlatePlanRecipes.renderVault(); } catch (err) { console.warn('[Modern Bridge] renderVault warning:', err); }
    }
    if (typeof window.schedulePlatePlanListRender === 'function') {
      try { window.schedulePlatePlanListRender('vault'); } catch (err) { console.warn('[Modern Bridge] schedulePlatePlanListRender warning:', err); }
    }
  }
  console.log(`[Modern Bridge v3.3.13] Type-sanitized state synchronized with ${cleanRecipes.length} recipes.`);
});

// Sync ingredients, preferences, and plans when they change
document.addEventListener('plateplan:state:ingredients', (e) => {
  if (typeof window !== 'undefined') {
    window.allIngredients = e.detail || [];
    if (window.state) window.state.ingredients = e.detail || [];
    if (window.PlatePlanBank) {
      window.PlatePlanBank.State = window.PlatePlanBank.State || {};
      window.PlatePlanBank.State.ingredients = e.detail || [];
    }
    if (typeof window.PlatePlanIngredientBank?.renderProductBank === 'function') {
      try { window.PlatePlanIngredientBank.renderProductBank(); } catch (err) { console.warn('[Modern Bridge] renderProductBank warning:', err); }
    }
  }
});

document.addEventListener('plateplan:state:preferences', (e) => {
  if (typeof window !== 'undefined' && e.detail) {
    if (window.state) window.state.settings = e.detail;
    if (window.PlatePlanCloud) {
      window.PlatePlanCloud.State = window.PlatePlanCloud.State || {};
      window.PlatePlanCloud.State.settings = e.detail;
    }
    if (typeof window.PlatePlanSettings?.renderPreferences === 'function') {
      try { window.PlatePlanSettings.renderPreferences(); } catch (err) { console.warn('[Modern Bridge] renderPreferences warning:', err); }
    }
  }
});

document.addEventListener('plateplan:state:plan', (e) => {
  if (typeof window !== 'undefined' && e.detail) {
    if (window.state) window.state.plan = e.detail;
    if (window.PlatePlan) {
      window.PlatePlan.State = window.PlatePlan.State || {};
      window.PlatePlan.State.plan = e.detail;
    }
  }
});

async function initApp() {
  console.log('[Modern Bridge v3.3.13] Initializing secure ES6 bridge & authenticating...');
  updateVersionBadge();
  await waitForAuth();
  await hydrateHouseholdData();
}

initApp();
