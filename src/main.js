/**
 * src/main.js (v3.3.9)
 * Secure ES6 data bridge with exhaustive deep mutation for legacy UI stability.
 */

import { waitForAuth } from './services/AuthService.js';
import { hydrateHouseholdData } from './services/HydrationService.js';
import { getState } from './store/store.js';

// Exhaustively mutates any object/array to ensure no property is undefined
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
      // Default array-like or collection properties to []
      if (['tags', 'categories', 'favourites', 'labels', 'ingredients', 'variants', 'steps', 'allergens', 'favouritedBy', 'userFavourites'].includes(key)) {
        obj[key] = [];
      } else {
        obj[key] = '';
      }
    } else {
      obj[key] = deepMutate(obj[key]);
    }
  }
  
  // Guarantee baseline array properties exist on every recipe/variant
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
    footerEl.textContent = 'v3.3.9 (ES6 Modern)';
  }
}

document.addEventListener('plateplan:state:recipes', (e) => {
  const rawRecipes = e.detail || [];
  const cleanRecipes = sanitizeRecipes(rawRecipes);
  console.log(`[Modern Bridge v3.3.9] Deep-mutated and synced ${cleanRecipes.length} recipes to app UI.`);
  
  if (typeof window !== 'undefined') {
    window.allRecipes = cleanRecipes;
    if (window.state) window.state.recipes = cleanRecipes;
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
  console.log('[Modern Bridge v3.3.9] Initializing secure ES6 bridge & authenticating...');
  updateVersionBadge();
  await waitForAuth();
  await hydrateHouseholdData();
}

initApp();
