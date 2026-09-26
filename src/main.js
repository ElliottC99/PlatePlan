/**
 * src/main.js (v3.6.0)
 * Modern ES6 Architecture Entry Point & Atomic Lifecycle Coordinator.
 * Manages unidirectional state subscriptions, cross-view reactive synchronization,
 * instant offline caching, global error telemetry, and PWA service worker registration.
 */
import { waitForAuth } from './services/AuthService.js';
import { hydrateHouseholdData } from './services/HydrationService.js';
import { subscribe, getState } from './store/store.js';
import { setupActionBridge } from './services/ActionBridge.js';
import { renderSettingsView } from './views/SettingsView.js';
import { renderShoppingListUI, renderScrollableSwapModal, toggleShoppingItemAcquired } from './views/ShoppingView.js';
import { renderPlanner } from './views/PlannerView.js';
import { renderRecipeVault } from './views/RecipeVaultView.js';

// 1. STRICT STATE INITIALIZATION & SANITIZATION
if (typeof window !== 'undefined') {
  if (typeof window.state !== 'object' || window.state === null) window.state = {};
  if (typeof window.state.userPrefs !== 'object' || window.state.userPrefs === null) window.state.userPrefs = {};
  if (typeof window.state.settings !== 'object' || window.state.settings === null) window.state.settings = {};

  const storeState = getState();
  window.state.recipes = Array.isArray(window.state.recipes) && window.state.recipes.length ? window.state.recipes : (storeState.recipes || []);
  window.state.favourites = Array.isArray(window.state.favourites) ? window.state.favourites : [];
  window.state.userFavourites = Array.isArray(window.state.userFavourites) ? window.state.userFavourites : [];
  window.state.ingredients = Array.isArray(window.state.ingredients) && window.state.ingredients.length ? window.state.ingredients : (storeState.ingredients || []);
  window.state.confirmedShopping = Array.isArray(window.state.confirmedShopping) ? window.state.confirmedShopping : [];

  window.state.userPrefs.favouriteVariantIds = Array.isArray(window.state.userPrefs.favouriteVariantIds) ? window.state.userPrefs.favouriteVariantIds : [];
  window.state.userPrefs.favourites = Array.isArray(window.state.userPrefs.favourites) ? window.state.userPrefs.favourites : [];

  window.favourites = window.state.favourites;
  window.userFavourites = window.state.userFavourites;
}

// 2. EXPORTS & GLOBAL COMPATIBILITY ALIASES
export { renderSettingsView, renderShoppingListUI, renderScrollableSwapModal, toggleShoppingItemAcquired, renderPlanner, renderRecipeVault, setupActionBridge };

if (typeof window !== 'undefined') {
  window.renderSettings = renderSettingsView;
  window.renderShopping = renderShoppingListUI;
  window.renderShoppingList = renderShoppingListUI;
  window.toggleInlineShoppingSubst = renderScrollableSwapModal;
  window.toggleShoppingItemAcquired = toggleShoppingItemAcquired;
  window.toggleShoppingAtHome = toggleShoppingItemAcquired;
  window.renderPlanner = renderPlanner;
  window.renderVault = renderRecipeVault;
  window.renderRecipeVault = renderRecipeVault;
  window.renderVaultGrid = renderRecipeVault;

  window.openRecipeModal = function(id, instanceId, variant, targetPerson) {
    if (typeof window.viewRecipe === 'function') {
      return window.viewRecipe(id, instanceId, variant, targetPerson);
    }
    console.warn('[main.js v3.6.0] viewRecipe not found on window');
  };
  window.showRecipeModal = window.openRecipeModal;
  window.openRecipeDetailModal = window.openRecipeModal;
}

// 3. GLOBAL ERROR TELEMETRY & TOAST BRIDGE
let lastErrorMessage = '';
let lastErrorTime = 0;

function reportAppError(message, type = 'error') {
  const now = Date.now();
  if (message === lastErrorMessage && now - lastErrorTime < 4000) return;
  lastErrorMessage = message;
  lastErrorTime = now;

  console.error(`[PlatePlan Error Telemetry v3.6.0]`, message);
  if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast(message, type);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.message) {
      reportAppError(`App Error: ${event.message}`);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || event.reason || 'Network or asynchronous error';
    reportAppError(`Async Error: ${reason}`);
  });

  window.addEventListener('offline', () => {
    reportAppError('Offline mode active. Using local cached data.', 'warning');
  });

  window.addEventListener('online', () => {
    reportAppError('Online connection restored. Syncing with cloud...', 'success');
    hydrateHouseholdData();
  });
}

// 4. SERVICE WORKER REGISTRATION FOR PWA OFFLINE CAPABILITY
function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.log('[SW v3.6.0] Service worker registered successfully with scope:', reg.scope);
        })
        .catch(err => {
          console.warn('[SW v3.6.0] Service worker registration failed:', err);
        });
    });
  }
}

// 5. SANITIZATION HELPERS
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

export function updateVersionBadge() {
  const footerEl = document.getElementById('app-version') || document.getElementById('plateplan-update-version');
  if (footerEl) {
    footerEl.textContent = 'v3.6.0 (ES6 Modern)';
  }
}

// 6. UNIDIRECTIONAL STATE DISPATCH LISTENERS & SUBSCRIPTIONS
let isSubscribed = false;
function setupSubscriptions() {
  if (isSubscribed) return;
  isSubscribed = true;

  subscribe('recipes', (recipes) => {
    const cleanRecipes = sanitizeRecipes(recipes);
    if (typeof window !== 'undefined') {
      window.state.recipes = cleanRecipes;
      window.allRecipes = cleanRecipes;
    }
    renderRecipeVault();
    if (window.state?.plan && typeof renderPlanner === 'function') {
      renderPlanner();
    }
  });

  subscribe('ingredients', (ingredients) => {
    if (typeof window !== 'undefined') {
      window.state.ingredients = Array.isArray(ingredients) ? ingredients : [];
    }
    renderShoppingListUI();
  });

  subscribe('shopping', () => {
    renderShoppingListUI();
  });

  subscribe('preferences', () => {
    renderSettingsView();
  });

  subscribe('plan', () => {
    renderPlanner();
    renderShoppingListUI();
  });
}

// 7. APPLICATION BOOTSTRAP
let isAppInitialized = false;
async function initApp() {
  if (isAppInitialized) return;
  isAppInitialized = true;

  console.log('[Modern Bridge v3.6.0] Initializing secure ES6 bridge & authenticating...');
  updateVersionBadge();
  setupActionBridge();
  setupSubscriptions();
  registerServiceWorker();
  
  // Fast initial render from cached state if available
  if (window.state?.recipes?.length) {
    renderRecipeVault();
  }
  if (window.state?.ingredients?.length) {
    renderShoppingListUI();
  }

  await waitForAuth();
  await hydrateHouseholdData();
}

initApp();
