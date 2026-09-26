/**
 * src/main.js (v3.3.7)
 * Secure ES6 data bridge with deep recursive object normalization for legacy UI safety.
 */

import { waitForAuth } from './services/AuthService.js';
import { hydrateHouseholdData } from './services/HydrationService.js';
import { getState } from './store/store.js';

// Deep recursive normalizer to guarantee no nested property is undefined when legacy code calls .includes()
function deepSanitize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitize(item));
  }
  const sanitized = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    // If it looks like an array field that might be checked with .includes(), default to [] if undefined/null
    if (val === undefined || val === null) {
      if (['tags', 'categories', 'favourites', 'labels', 'ingredients', 'variants', 'steps', 'allergens'].includes(key)) {
        sanitized[key] = [];
      } else {
        sanitized[key] = null;
      }
    } else {
      sanitized[key] = deepSanitize(val);
    }
  }
  // Ensure mandatory top-level or variant array properties exist even if missing entirely
  sanitized.tags = Array.isArray(sanitized.tags) ? sanitized.tags : [];
  sanitized.categories = Array.isArray(sanitized.categories) ? sanitized.categories : [];
  sanitized.variants = Array.isArray(sanitized.variants) ? sanitized.variants : [];
  
  return sanitized;
}

function sanitizeRecipes(recipes) {
  if (!Array.isArray(recipes)) return [];
  return recipes.map(recipe => deepSanitize(recipe));
}

function updateVersionBadge() {
  const footerEl = document.getElementById('app-version');
  if (footerEl) {
    footerEl.textContent = 'v3.3.7 (ES6 Modern)';
  }
}

document.addEventListener('plateplan:state:recipes', (e) => {
  const cleanRecipes = sanitizeRecipes(e.detail || []);
  console.log(`[Modern Bridge v3.3.7] Deep-sanitized and synced ${cleanRecipes.length} recipes to app UI.`);
  
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
  console.log('[Modern Bridge v3.3.7] Initializing secure ES6 bridge & authenticating...');
  updateVersionBadge();
  await waitForAuth();
  await hydrateHouseholdData();
}

initApp();
