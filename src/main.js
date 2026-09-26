/**
 * src/main.js (v3.3.8)
 * Secure ES6 data bridge featuring a JavaScript Proxy Data Shield for legacy UI bulletproofing.
 */

import { waitForAuth } from './services/AuthService.js';
import { hydrateHouseholdData } from './services/HydrationService.js';
import { getState } from './store/store.js';

// Creates a recursive Proxy that traps undefined property lookups and returns [] for array-like checks
function createRecipeProxy(target) {
  return new Proxy(target, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      
      // If property doesn't exist or is null/undefined, protect against .includes() or iterator crashes
      if (value === undefined || value === null) {
        // If it sounds like an array property, return empty array
        if (typeof prop === 'string' && (prop.includes('tag') || prop.includes('favourite') || prop.includes('category') || prop.includes('variant') || prop.includes('ingredient') || prop.includes('label'))) {
          return [];
        }
        return [];
      }
      
      // If it's a nested object or array, wrap it recursively in a Proxy as well
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          return value.map(item => (typeof item === 'object' && item !== null ? createRecipeProxy(item) : item));
        }
        return createRecipeProxy(value);
      }
      
      return value;
    }
  });
}

function shieldRecipes(recipes) {
  if (!Array.isArray(recipes)) return [];
  return recipes.map(recipe => createRecipeProxy(recipe));
}

function updateVersionBadge() {
  const footerEl = document.getElementById('app-version');
  if (footerEl) {
    footerEl.textContent = 'v3.3.8 (ES6 Modern)';
  }
}

document.addEventListener('plateplan:state:recipes', (e) => {
  const rawRecipes = e.detail || [];
  const shieldedRecipes = shieldRecipes(rawRecipes);
  console.log(`[Modern Bridge v3.3.8] Shielded ${shieldedRecipes.length} recipes via Proxy into app UI.`);
  
  if (typeof window !== 'undefined') {
    window.allRecipes = shieldedRecipes;
    if (window.state) window.state.recipes = shieldedRecipes;
    if (window.PlatePlanRecipes) {
      window.PlatePlanRecipes.State = window.PlatePlanRecipes.State || {};
      window.PlatePlanRecipes.State.recipes = shieldedRecipes;
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
  console.log('[Modern Bridge v3.3.8] Initializing secure ES6 bridge & authenticating...');
  updateVersionBadge();
  await waitForAuth();
  await hydrateHouseholdData();
}

initApp();
