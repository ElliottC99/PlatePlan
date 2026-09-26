/**
 * src/main.js (v3.3.37)
 * Phase 5.4 Hotfix: Action bridge argument sanitization & version alignment to v3.3.37.
 */
import { waitForAuth } from './services/AuthService.js';
import { hydrateHouseholdData } from './services/HydrationService.js';
import { savePreferences } from './services/HouseholdRepository.js';
import { getState } from './store/store.js';
import { renderSettingsView } from './views/SettingsView.js';
import { renderShoppingListUI, renderScrollableSwapModal } from './views/ShoppingView.js';
import { renderPlanner } from './views/PlannerView.js';
import { renderRecipeVault } from './views/RecipeVaultView.js';

// 1. STRICT TYPE SANITIZATION
if (typeof window !== 'undefined') {
  if (typeof window.state !== 'object' || window.state === null) window.state = {};
  if (typeof window.state.userPrefs !== 'object' || window.state.userPrefs === null) window.state.userPrefs = {};
  if (typeof window.state.settings !== 'object' || window.state.settings === null) window.state.settings = {};

  window.state.recipes = Array.isArray(window.state.recipes) ? window.state.recipes : [];
  window.state.favourites = Array.isArray(window.state.favourites) ? window.state.favourites : [];
  window.state.userFavourites = Array.isArray(window.state.userFavourites) ? window.state.userFavourites : [];
  window.state.ingredients = Array.isArray(window.state.ingredients) ? window.state.ingredients : [];
  window.state.confirmedShopping = Array.isArray(window.state.confirmedShopping) ? window.state.confirmedShopping : [];

  window.state.userPrefs.favouriteVariantIds = Array.isArray(window.state.userPrefs.favouriteVariantIds) ? window.state.userPrefs.favouriteVariantIds : [];
  window.state.userPrefs.favourites = Array.isArray(window.state.userPrefs.favourites) ? window.state.userPrefs.favourites : [];

  window.favourites = window.state.favourites;
  window.userFavourites = window.state.userFavourites;
}

// Helper: Rename "Swap Brand" to "Swap Product" across DOM nodes
function patchSwapLabels() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = walker.nextNode()) {
    if (node.nodeValue && node.nodeValue.includes('Swap Brand')) {
      node.nodeValue = node.nodeValue.replace(/Swap Brand/g, 'Swap Product');
    }
  }
  document.querySelectorAll('button, a, span, label, div').forEach(el => {
    if (el.title && el.title.includes('Swap Brand')) {
      el.title = el.title.replace(/Swap Brand/g, 'Swap Product');
    }
    if (el.placeholder && el.placeholder.includes('Swap Brand')) {
      el.placeholder = el.placeholder.replace(/Swap Brand/g, 'Swap Product');
    }
  });
}

// Initialize Real-Time Label Patching Observer
function initLabelObserver() {
  if (typeof window === 'undefined' || window.__pp_label_observer_active) return;
  window.__pp_label_observer_active = true;

  const observer = new MutationObserver(() => {
    patchSwapLabels();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  patchSwapLabels();
}

// ----------------------------------------------------------------------------
// EXPORTS & GLOBAL ALIASES FOR VIEWS
// ----------------------------------------------------------------------------
export { renderSettingsView };
export { renderShoppingListUI, renderScrollableSwapModal };
export { renderPlanner };
export { renderRecipeVault };

window.renderSettings = function() {
  renderSettingsView();
};

window.renderShopping = function() {
  renderShoppingListUI();
};
window.renderShoppingList = function() {
  renderShoppingListUI();
};

window.toggleInlineShoppingSubst = function(groupKey, itemKey) {
  renderScrollableSwapModal(groupKey, itemKey);
};

window.renderPlanner = function() {
  renderPlanner();
};

window.renderVault = function() {
  renderRecipeVault();
};
window.renderRecipeVault = function() {
  renderRecipeVault();
};
window.renderVaultGrid = function() {
  renderRecipeVault();
};

window.openRecipeModal = function(id, instanceId, variant) {
  if (typeof window.viewRecipe === 'function') return window.viewRecipe(id, instanceId, variant);
  console.warn('[main.js v3.3.37] viewRecipe not found on window');
};
window.showRecipeModal = window.openRecipeModal;
window.openRecipeDetailModal = window.openRecipeModal;

// ----------------------------------------------------------------------------
// NATIVE DELEGATED ACTION BRIDGE
// ----------------------------------------------------------------------------
function setupRecipeActionBridge() {
  if (typeof window === 'undefined' || window.__plateplan_action_bridge_attached) return;
  window.__plateplan_action_bridge_attached = true;

  initLabelObserver();

  document.addEventListener('click', (event) => {
    patchSwapLabels();

    const target = event.target.closest('[data-pp-click], [onclick*="toggleInlineShoppingSubst"], [onclick*="viewRecipe"], [onclick*="openRecipeModal"], button');
    if (!target) return;

    const onclickStr = target.getAttribute('onclick') || '';
    const ppClickStr = target.dataset.ppClick || target.getAttribute('data-pp-click') || '';
    const actionStr = ppClickStr || onclickStr;

    if (actionStr.includes('toggleInlineShoppingSubst')) {
      event.preventDefault();
      event.stopPropagation();

      const rawArgs = actionStr.substring(actionStr.indexOf('(') + 1, actionStr.lastIndexOf(')'));
      const args = rawArgs.split(',').map(s => {
        let val = s.trim().replace(/^['"]|['"]$/g, '');
        return (val === 'null' || val === 'undefined') ? null : val;
      });

      console.log(`[Action Bridge v3.3.37] Intercepted Swap Action:`, args);
      window.toggleInlineShoppingSubst(args[0] || '', args[1] || '');
      return;
    }

    if (actionStr.includes('openRecipeModal') || actionStr.includes('viewRecipe') || actionStr.includes('showRecipeModal') || actionStr.includes('openRecipeDetailModal')) {
      event.preventDefault();
      event.stopPropagation();

      const rawArgs = actionStr.substring(actionStr.indexOf('(') + 1, actionStr.lastIndexOf(')'));
      const args = rawArgs.split(',').map(s => {
        let val = s.trim().replace(/^['"]|['"]$/g, '');
        return (val === 'null' || val === 'undefined' || val === '') ? null : val;
      });

      console.log(`[Action Bridge v3.3.37] Intercepted Recipe Modal Action:`, args);
      if (typeof window.viewRecipe === 'function') {
        window.viewRecipe(args[0] || '', args[1] || null, args[2] || 'original', args[3] || 'both');
      } else if (typeof window.openRecipeModal === 'function') {
        window.openRecipeModal(args[0] || '', args[1] || null, args[2] || 'original', args[3] || 'both');
      }
      return;
    }

    if (actionStr.includes('shopping') || actionStr.includes("showView('shopping')")) {
      setTimeout(() => {
        renderShoppingListUI();
      }, 50);
    }

    if (actionStr.includes('prefs') || actionStr.includes('settings') || actionStr.includes("showView('prefs')")) {
      setTimeout(() => {
        renderSettingsView();
      }, 50);
    }

    if (actionStr.includes('planner') || actionStr.includes("showView('planner')")) {
      setTimeout(() => {
        renderPlanner();
      }, 50);
    }

    if (actionStr.includes('vault') || actionStr.includes("showView('vault')")) {
      setTimeout(() => {
        renderRecipeVault();
      }, 50);
    }

    if (ppClickStr) {
      event.preventDefault();
      if (typeof window.runPlatePlanDelegatedAction === 'function') {
        window.runPlatePlanDelegatedAction(ppClickStr, event, target);
      } else {
        const execFn = new Function('event', `with(window) { ${ppClickStr} }`);
        execFn.call(target, event);
      }
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
  return obj;
}

function sanitizeRecipes(recipes) {
  if (!Array.isArray(recipes)) return [];
  return recipes.map(recipe => deepMutate(JSON.parse(JSON.stringify(recipe))));
}

function updateVersionBadge() {
  const footerEl = document.getElementById('app-version') || document.getElementById('plateplan-update-version');
  if (footerEl) {
    footerEl.textContent = 'v3.3.37 (ES6 Modern)';
  }
}

document.addEventListener('plateplan:state:recipes', (e) => {
  const rawRecipes = e.detail || [];
  const cleanRecipes = sanitizeRecipes(rawRecipes);
  if (typeof window !== 'undefined') {
    window.state.recipes = cleanRecipes;
    window.allRecipes = cleanRecipes;
  }
  renderRecipeVault();
});

document.addEventListener('plateplan:state:shopping', () => {
  renderShoppingListUI();
});

document.addEventListener('plateplan:state:preferences', () => {
  renderSettingsView();
});

document.addEventListener('plateplan:state:planner', () => {
  renderPlanner();
});

async function initApp() {
  console.log('[Modern Bridge v3.3.37] Initializing secure ES6 bridge & authenticating...');
  updateVersionBadge();
  setupRecipeActionBridge();
  await waitForAuth();
  await hydrateHouseholdData();
}

initApp();
