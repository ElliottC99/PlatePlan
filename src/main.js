/**
 * src/main.js (v3.3.16)
 * Native Delegated Action Bridge via window.runPlatePlanDelegatedAction.
 */
import { waitForAuth } from './services/AuthService.js';
import { hydrateHouseholdData } from './services/HydrationService.js';
import { getState } from './store/store.js';

// 1. STRICT TYPE SANITIZATION
if (typeof window !== 'undefined') {
  if (typeof window.state !== 'object' || window.state === null) window.state = {};
  if (typeof window.state.userPrefs !== 'object' || window.state.userPrefs === null) window.state.userPrefs = {};
  if (typeof window.state.settings !== 'object' || window.state.settings === null) window.state.settings = {};

  window.state.recipes = Array.isArray(window.state.recipes) ? window.state.recipes : [];
  window.state.favourites = Array.isArray(window.state.favourites) ? window.state.favourites : [];
  window.state.userFavourites = Array.isArray(window.state.userFavourites) ? window.state.userFavourites : [];
  window.state.ingredients = Array.isArray(window.state.ingredients) ? window.state.ingredients : [];
  
  window.state.userPrefs.favouriteVariantIds = Array.isArray(window.state.userPrefs.favouriteVariantIds) ? window.state.userPrefs.favouriteVariantIds : [];
  window.state.userPrefs.favourites = Array.isArray(window.state.userPrefs.favourites) ? window.state.userPrefs.favourites : [];

  window.favourites = window.state.favourites;
  window.userFavourites = window.state.userFavourites;
}

// 2. NATIVE DELEGATED ACTION BRIDGE
function setupRecipeActionBridge() {
  if (typeof window === 'undefined' || window.__plateplan_action_bridge_attached) return;
  window.__plateplan_action_bridge_attached = true;

  document.addEventListener('click', (event) => {
    const actionBtn = event.target.closest('[data-pp-click]');
    if (!actionBtn) return;

    const actionStr = actionBtn.dataset.ppClick || actionBtn.getAttribute('data-pp-click');
    if (!actionStr) return;

    event.preventDefault();
    console.log(`[Action Bridge v3.3.16] Delegating action: "${actionStr}"`);

    try {
      if (typeof window.runPlatePlanDelegatedAction === 'function') {
        window.runPlatePlanDelegatedAction(actionStr, event, actionBtn);
      } else {
        const execFn = new Function('event', `with(window) { ${actionStr} }`);
        execFn.call(actionBtn, event);
      }

      // Unhide modal wraps if triggered
      setTimeout(() => {
        const modalWrap = document.querySelector('#view-modal-wrap.open, .modal-wrap.open, .modal.open');
        if (modalWrap) {
          modalWrap.style.display = 'flex';
          modalWrap.style.visibility = 'visible';
          modalWrap.style.opacity = '1';
          modalWrap.style.zIndex = '99999';
        }
      }, 50);

    } catch (err) {
      console.error(`[Action Bridge v3.3.16] Execution error for: ${actionStr}`, err);
    }
  }, true);
}

// Deep mutator to ensure clean recipes and variants
function deepMutate(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => deepMutate(item));
  
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
    footerEl.textContent = 'v3.3.16 (ES6 Modern)';
  }
}

document.addEventListener('plateplan:state:recipes', (e) => {
  const rawRecipes = e.detail || [];
  const cleanRecipes = sanitizeRecipes(rawRecipes);
  
  if (typeof window !== 'undefined') {
    window.state.recipes = cleanRecipes;
    window.allRecipes = cleanRecipes;
    if (typeof window.renderAll === 'function') {
      try { window.renderAll(); } catch (err) { console.warn('[Modern Bridge] renderAll warning:', err); }
    }
  }
  console.log(`[Modern Bridge v3.3.16] Action bridge synchronized with ${cleanRecipes.length} recipes.`);
});

async function initApp() {
  console.log('[Modern Bridge v3.3.16] Initializing secure ES6 bridge & authenticating...');
  updateVersionBadge();
  setupRecipeActionBridge();
  await waitForAuth();
  await hydrateHouseholdData();
}

initApp();
