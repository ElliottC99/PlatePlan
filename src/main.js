/**
 * src/main.js (v3.3.6)
 * Secure ES6 data bridge with legacy UI object normalization and v3.3.6 version binding.
 */

import { waitForAuth } from './services/AuthService.js';
import { hydrateHouseholdData } from './services/HydrationService.js';
import { getState } from './store/store.js';

function sanitizeRecipes(recipes) {
  if (!Array.isArray(recipes)) return [];
  return recipes.map(recipe => ({
    ...recipe,
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    categories: Array.isArray(recipe.categories) ? recipe.categories : [],
    variants: Array.isArray(recipe.variants) ? recipe.variants.map(v => ({
      ...v,
      tags: Array.isArray(v.tags) ? v.tags : []
    })) : []
  }));
}

// Update version footer badge in the DOM if present
function updateVersionBadge() {
  const footerEl = document.getElementById('app-version');
  if (footerEl) {
    footerEl.textContent = 'v3.3.6 (ES6 Modern)';
  }
}

document.addEventListener('plateplan:state:recipes', (e) => {
  const cleanRecipes = sanitizeRecipes(e.detail || []);
  console.log(`[Modern Bridge v3.3.6] Sanitized and synced ${cleanRecipes.length} recipes to app UI.`);
  
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
  console.log('[Modern Bridge v3.3.6] Initializing secure ES6 bridge & authenticating...');
  updateVersionBadge();
  await waitForAuth();
  await hydrateHouseholdData();
}

initApp();
