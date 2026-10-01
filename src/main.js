if (typeof window !== 'undefined') {
  window.APP_VERSION = 'v3.19.16';
}

/**
 * src/main.js (v3.19.16)
 * Modern ES6 Architecture Entry Point & Atomic Lifecycle Coordinator.
 * Manages unidirectional state subscriptions, cross-view reactive synchronization,
 * instant offline caching, global error telemetry, and PWA service worker registration.
 */
import { waitForAuth } from './services/AuthService.js';
import { hydrateHouseholdData } from './services/HydrationService.js';
import { subscribe, getState } from './store/store.js';
import { setupActionBridge } from './services/ActionBridge.js';
import { saveCurrentPlan } from './services/HouseholdRepository.js';
import { AppState } from './state/AppState.js';
import { renderToday } from './views/TodayView.js';
import { renderIngredientBank, renderProductBank } from './views/PantryBankView.js';
import { renderSettingsView } from './views/SettingsView.js';
import { renderShoppingListUI, renderScrollableSwapModal, toggleShoppingItemAcquired, getShoppingLineStateKey } from './views/ShoppingView.js';
import { renderPlanner } from './views/PlannerView.js';
import { renderRecipeVault } from './views/RecipeVaultView.js';
import { renderDataQualityView } from './views/DataQualityView.js';
import './components/data-quality/ResolveUnlinkedModalUI.js';
import { calculateMealFitScore } from './utils/fitScoreCalculator.js';
import { renderFitScoreBadge } from './components/FitScoreBadge.js';

// Global Compatibility Shims for Legacy References
if (typeof window !== 'undefined') {
  window.saveState = window.saveState || function(stateData) {
    console.warn('[Compatibility] Global saveState() invoked. Delegating to persistence layer.');
    if (typeof saveCurrentPlan === 'function') {
      saveCurrentPlan(stateData || AppState.getState());
    }
  };

  window.loadState = window.loadState || function() {
    console.warn('[Compatibility] Global loadState() invoked.');
    return AppState.getState();
  };
}
import * as MealPlanGeneratorService from './services/MealPlanGeneratorService.js';
import * as RecipeDetailModalService from './services/RecipeDetailModalService.js';
import * as PortionCalculationService from './services/PortionCalculationService.js';
import * as TescoImportService from './services/TescoImportService.js';
import * as ShoppingCalculationService from './services/ShoppingCalculationService.js';
import * as UnitConverter from './utils/unitConverter.js';
import * as NutritionService from './services/NutritionService.js';
import * as FitScoreService from './services/FitScoreService.js';
import * as DataQualityService from './services/DataQualityService.js';
import * as TodayViewService from './services/TodayViewService.js';
import * as RecipeAuthoringService from './services/RecipeAuthoringService.js';
import { registeredComponents } from './components/componentRegistry.js';
import * as AppRouter from './core/AppRouter.js';
import * as AppInitializer from './core/AppInitializer.js';
import { safeClone, safeJsonStringify } from './utils/safeJson.js';

// Global Sync Status State Machine
let inSyncStatusTransition = false;
export function setSyncStatus(status, detail = '') {
  if (typeof window === 'undefined') return;
  if (inSyncStatusTransition) return;
  inSyncStatusTransition = true;
  try {
    if (typeof window.updatePlatePlanSyncStatus === 'function' && window.updatePlatePlanSyncStatus !== setSyncStatus) {
      window.updatePlatePlanSyncStatus(status, detail);
    }
  } catch(e) {}

  const el = document.getElementById('sync-status');
  if (el) {
    let label = '• Synced';
    if (status === 'synced') label = '• Synced';
    else if (status === 'saving') label = 'Saving…';
    else if (status === 'offline') label = 'Offline';
    else if (status === 'connecting') label = 'Connecting…';
    else if (status === 'local' || status === 'local-only') label = 'Local only';
    else if (status === 'error') label = 'Sync error';

    el.dataset.status = status === 'synced' ? 'synced' : (status === 'offline' ? 'offline' : (status === 'connecting' ? 'connecting' : 'local'));
    el.textContent = label;
    if (detail) el.title = detail;
  }
  inSyncStatusTransition = false;
}

// Expose services globally for seamless classic script interop
if (typeof window !== 'undefined') {
  window.setSyncStatus = setSyncStatus;
  window.updateSyncStatus = setSyncStatus;
  window.calculateMealFitScore = calculateMealFitScore;
  window.renderFitScoreBadge = renderFitScoreBadge;

  Object.assign(window, {
    MealPlanGeneratorService, RecipeDetailModalService,
    PortionCalculationService, TescoImportService, ShoppingCalculationService, UnitConverter, NutritionService,
    FitScoreService, DataQualityService, TodayViewService, RecipeAuthoringService,
    ...registeredComponents,
    AppRouter, AppInitializer,

    // Core Router & View Helpers
    showView: window.showView || AppRouter.showView,
    syncMobileNavigation: window.syncMobileNavigation || AppRouter.syncMobileNavigation,
    requestPlatePlanViewRender: window.requestPlatePlanViewRender || AppRouter.requestPlatePlanViewRender,
    showPlatePlanToast: window.showPlatePlanToast || AppInitializer.showPlatePlanToast,

    // View Renders
    renderToday,
    renderPlanner,
    renderVault: renderRecipeVault,
    renderRecipeVault,
    renderVaultGrid: renderRecipeVault,
    renderSettings: renderSettingsView,
    renderSettingsView,
    renderShopping: renderShoppingListUI,
    renderShoppingList: renderShoppingListUI,
    renderShoppingListUI,
    renderIngredientBank,
    renderProductBank,
    renderBank: renderProductBank,
    renderPlatePlanView(viewId) {
      switch (viewId) {
        case 'today': return renderToday();
        case 'vault': case 'recipes': return renderRecipeVault();
        case 'planner': case 'plan': return renderPlanner();
        case 'shopping': return renderShoppingListUI();
        case 'settings': case 'prefs': return renderSettingsView();
        case 'ingredients': return renderIngredientBank();
        case 'bank': return renderProductBank();
        default: {
          const viewEl = document.getElementById('view-' + viewId);
          if (viewEl && AppRouter.viewModuleMap?.[viewId]?.mount) {
            return AppRouter.viewModuleMap[viewId].mount(viewEl);
          }
        }
      }
    },

    // Actions & Modal Handlers
    viewRecipe: RecipeDetailModalService.viewRecipe,
    closeRecipePreview: RecipeDetailModalService.closeRecipePreview,
    switchViewTab: RecipeDetailModalService.switchViewTab,
    switchPreviewServingMode: RecipeDetailModalService.switchPreviewServingMode,
    updateRecipePreviewScale: RecipeDetailModalService.updateRecipePreviewScale,
    updateSinglePersonServes: RecipeDetailModalService.updateSinglePersonServes,
    renderRecipePreview: RecipeDetailModalService.renderRecipePreview,
    generatePlan: MealPlanGeneratorService.generatePlan,
    generateMealPlan: MealPlanGeneratorService.generateMealPlan,
    getPlanSlotInfo: MealPlanGeneratorService.getPlanSlotInfo,
    getPlannedSlotNutrition: MealPlanGeneratorService.getPlannedSlotNutrition,
    getShoppingLineStateKey,
    renderScrollableSwapModal,
    toggleInlineShoppingSubst: renderScrollableSwapModal,
    toggleShoppingItemAcquired,
    toggleShoppingAtHome: toggleShoppingItemAcquired,
    openSearchableRecipeSwapModal: registeredComponents.PlannerMealSlot.openSearchableRecipeSwapModal,
    closeSearchableRecipeSwapModal: registeredComponents.PlannerMealSlot.closeSearchableRecipeSwapModal,
    filterSearchableRecipeSwapModal: registeredComponents.PlannerMealSlot.filterSearchableRecipeSwapModal,
    selectAndSwapRecipe: registeredComponents.PlannerMealSlot.selectAndSwapRecipe,

    openRecipeModal(id, instanceId, variant, targetPerson) {
      if (typeof window.viewRecipe === 'function') {
        return window.viewRecipe(id, instanceId, variant, targetPerson);
      }
      console.warn('[main.js] viewRecipe not found on window');
    },

    openMobileMore() {
      const el = document.getElementById('mobile-more-wrap');
      if (el) el.classList.add('open');
    },
    closeMobileMore() {
      const el = document.getElementById('mobile-more-wrap');
      if (el) el.classList.remove('open');
    },
    mobileMoreView(viewName) {
      const el = document.getElementById('mobile-more-wrap');
      if (el) el.classList.remove('open');
      if (typeof window.showView === 'function') {
        window.showView(viewName);
      }
    },
    openPlatePlanSyncPanel() {
      let modal = document.getElementById('sync-panel-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sync-panel-modal';
        modal.className = 'modal-wrap';
        modal.style = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;pointer-events:none;transition:opacity 0.2s ease;';
        document.body.appendChild(modal);
      }
      const s = getState() || {}, isOnline = navigator.onLine;
      modal.innerHTML = `
        <div class="card" style="width:100%;max-width:320px;background:var(--surface,#fff);padding:16px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.1)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 style="margin:0;font-size:15px;font-weight:750">Cloud Sync</h3>
            <button class="btn sm ghost" onclick="closePlatePlanSyncPanel()" style="padding:2px 6px;font-size:16px">&times;</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;font-size:12.5px">
            <div style="display:flex;justify-content:space-between;padding-bottom:4px;border-bottom:1px solid var(--border,#e7e5e4)">
              <span style="color:var(--text2,#78716c)">Routing</span>
              <span style="font-weight:600;font-family:monospace">elliott-chloe</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding-bottom:4px;border-bottom:1px solid var(--border,#e7e5e4)">
              <span style="color:var(--text2,#78716c)">Network</span>
              <span style="font-weight:700;color:${isOnline ? 'var(--green,#10b981)' : 'var(--red,#ef4444)'}">${isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding-bottom:4px;border-bottom:1px solid var(--border,#e7e5e4)">
              <span style="color:var(--text2,#78716c)">Ingredients</span>
              <span style="font-weight:600">${Array.isArray(s.ingredients) ? s.ingredients.length : 0} items</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding-bottom:4px;border-bottom:1px solid var(--border,#e7e5e4)">
              <span style="color:var(--text2,#78716c)">Products</span>
              <span style="font-weight:600">${Array.isArray(s.products) ? s.products.length : 0} items</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn ghost sm" onclick="closePlatePlanSyncPanel()" style="padding:4px 8px;font-size:12px">Close</button>
            <button class="btn primary sm" onclick="closePlatePlanSyncPanel(); window.syncNow()" style="padding:4px 8px;font-size:12px">Sync Now</button>
          </div>
        </div>
      `;
      modal.style.opacity = '1'; modal.style.pointerEvents = 'all'; modal.classList.add('open');
    },
    closePlatePlanSyncPanel() {
      const modal = document.getElementById('sync-panel-modal');
      if (modal) {
        modal.style.opacity = '0'; modal.style.pointerEvents = 'none'; modal.classList.remove('open');
      }
    },

    logout() {
      if (window.firebase && window.firebase.auth) {
        try { window.firebase.auth().signOut(); } catch(e) {}
      }
      try { localStorage.clear(); } catch(e) {}
      try { sessionStorage.clear(); } catch(e) {}
      window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
    },

    async syncNow() {
      console.log('[MANUAL SYNC TRIGGERED]');
      setSyncStatus('connecting', 'Syncing...');
      try {
        await hydrateHouseholdData();
        setSyncStatus(navigator.onLine ? 'synced' : 'offline', 'Synced with Cloud');
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Synced with Cloud! ☁️', 'success');
        }
      } catch(e) {
        setSyncStatus('error', 'Sync Failed');
      }
    }
  });

  window.renderPlatePlanLegacyView = window.renderPlatePlanView;
  window.showRecipeModal = window.openRecipeModal;
  window.openRecipeDetailModal = window.openRecipeModal;
}

// 1. STATE INITIALIZATION VIA ENCAPSULATED STORE
if (typeof window !== 'undefined') {
  const storeState = getState();
}

// 2. EXPORTS & GLOBAL COMPATIBILITY ALIASES
export { renderToday, renderSettingsView, renderShoppingListUI, renderScrollableSwapModal, toggleShoppingItemAcquired, renderPlanner, renderRecipeVault, setupActionBridge, getShoppingLineStateKey, calculateMealFitScore, renderFitScoreBadge, PortionCalculationService };


// 3. GLOBAL ERROR TELEMETRY & TOAST BRIDGE
let lastErrorMessage = '';
let lastErrorTime = 0;

function reportAppError(m, type = 'error') {
  if (m === lastErrorMessage && Date.now() - lastErrorTime < 4000) return;
  lastErrorMessage = m; lastErrorTime = Date.now();
  console.error(`[PlatePlan Error Telemetry v3.12.3]`, m);
  if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast(m, type);
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', e => {
    if (e.message && !/Converting circular structure/i.test(e.message)) reportAppError(`App Error: ${e.message}`);
  });
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason?.message || String(e.reason || '');
    if (/client is offline|Failed to get document because the client is offline/i.test(r)) {
      setSyncStatus('offline', 'Offline mode');
    } else reportAppError(`Async Error: ${r}`);
  });
  window.addEventListener('offline', () => { setSyncStatus('offline', 'Offline'); reportAppError('Offline mode active.', 'warning'); });
  window.addEventListener('online', () => { setSyncStatus('connecting', 'Restoring...'); reportAppError('Connection restored.', 'success'); hydrateHouseholdData(); });
}

// 4. SERVICE WORKER REGISTRATION HANDLED BY AppInitializer

// 5. SANITIZATION HELPERS
function deepMutate(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepMutate);
  Object.keys(obj).forEach(k => {
    if (obj[k] === undefined || obj[k] === null) {
      obj[k] = ['tags', 'categories', 'favourites', 'labels', 'ingredients', 'variants', 'steps', 'allergens', 'favouritedBy', 'userFavourites'].includes(k) ? [] : '';
    } else obj[k] = deepMutate(obj[k]);
  });
  return obj;
}

function sanitizeRecipes(recipes) {
  if (!Array.isArray(recipes)) return [];
  return recipes.map(recipe => deepMutate(safeClone(recipe)));
}

export function updateVersionBadge() {
  const footerEl = document.getElementById('app-version') || document.getElementById('plateplan-update-version');
  if (footerEl) {
    footerEl.textContent = 'v3.19.16 (ES6 Modern)';
  }
}

// 6. UNIDIRECTIONAL STATE DISPATCH LISTENERS & SUBSCRIPTIONS
let isSubscribed = false;
function setupSubscriptions() {
  if (isSubscribed) return;
  isSubscribed = true;

  subscribe('recipes', (recipes) => {
    const clean = sanitizeRecipes(recipes);
    if (typeof window !== 'undefined') { window.state.recipes = clean; window.allRecipes = clean; }
    renderRecipeVault(); renderToday(); if (window.state?.plan && typeof renderPlanner === 'function') renderPlanner();
    renderDataQualityView();
  });
  subscribe('ingredients', (ings) => {
    if (typeof window !== 'undefined' && window.state) window.state.ingredients = Array.isArray(ings) ? ings : [];
    renderShoppingListUI(); renderIngredientBank(); renderDataQualityView();
  });
  subscribe('products', (prods) => {
    if (typeof window !== 'undefined' && window.state) window.state.products = Array.isArray(prods) ? prods : [];
    renderProductBank(); renderDataQualityView();
  });
  subscribe('shopping', () => renderShoppingListUI());
  subscribe('preferences', () => { renderSettingsView(); renderToday(); });
  subscribe('plan', () => { renderToday(); renderPlanner(); renderShoppingListUI(); });
}

// 7. APPLICATION BOOTSTRAP
let isAppInitialized = false;
async function initApp() {
  if (isAppInitialized || (typeof window !== 'undefined' && window.__plateplan_app_booted)) return;
  isAppInitialized = true; if (typeof window !== 'undefined') window.__plateplan_app_booted = true;
  updateVersionBadge(); setupActionBridge(); setupSubscriptions();
  AppInitializer.registerServiceWorker(); AppInitializer.initPlatePlanApp();
  setSyncStatus('connecting', 'Connecting...');
  const initialRender = () => {
    renderToday(); renderRecipeVault(); renderPlanner(); renderShoppingListUI();
    renderIngredientBank(); renderProductBank(); renderDataQualityView();
  };
  try {
    await waitForAuth();
    const hydrationRes = await hydrateHouseholdData();
    initialRender();
    if (hydrationRes && hydrationRes.success) {
      setSyncStatus(navigator.onLine ? 'synced' : 'offline', navigator.onLine ? 'Synced with Cloud' : 'Offline Mode');
    } else setSyncStatus(navigator.onLine ? 'synced' : 'offline', 'Local Cache Active');
  } catch (err) {
    console.warn('[initApp] Auth/Hydration fallback:', err);
    initialRender();
    setSyncStatus(navigator.onLine ? 'synced' : 'offline', 'Local Cache Active');
  }
}

initApp();
