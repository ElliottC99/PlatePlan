import './config/firebase.js';

if (typeof window !== 'undefined') {
  window.showTescoImport = () => {
    import('./components/pantry/SubtypeActionModalsUI.js').then(m => m.openTescoImportModal?.(null, null)).catch(err => console.error('[PlatePlan]', err));
  };
  window.createIngredientFamilyPrompt = () => {
    import('./components/pantry/AddToBankModalUI.js').then(m => m.openAddToBankModal?.()).catch(err => console.error('[PlatePlan]', err));
  };
  window.openCreateActionSheet = () => {
    import('./components/navigation/ActionSheetUI.js').then(m => m.openCreateActionSheet?.()).catch(err => console.error('[PlatePlan]', err));
  };
}

/**
 * src/main.js (v3.39.2)
 * Modern ES6 Architecture Entry Point & Atomic Lifecycle Coordinator.
 */
import { waitForAuth } from './services/AuthService.js';
import { hydrateHouseholdData } from './services/HydrationService.js';
import { subscribe, getState, initStoreCache, setActivePlan } from './store/store.js';
import { setupActionBridge } from './services/ActionBridge.js';
import { saveCurrentPlan, stripPlanPayload, getCategories, saveCategories } from './services/HouseholdRepository.js';
import { saveIngredient, getIngredients } from './services/IngredientRepository.js';
import { saveProduct, getProducts } from './services/ProductRepository.js';
import { AppState } from './state/AppState.js';
import { renderToday } from './views/TodayView.js';
import { renderIngredientBank, renderProductBank } from './views/PantryBankView.js';
import { renderSettingsView } from './views/SettingsView.js';
import { renderShoppingListUI, renderScrollableSwapModal, toggleShoppingItemAcquired, getShoppingLineStateKey } from './views/ShoppingView.js';
import { renderPlanner } from './views/PlannerView.js';
import { renderRecipeVault } from './views/RecipeVaultView.js';
import { renderDataQualityView } from './views/DataQualityView.js';
import './components/data-quality/ResolveUnlinkedModalUI.js';
import './components/data-quality/UnlinkedSweeperUI.js';
import { calculateMealFitScore } from './utils/fitScoreCalculator.js';
import { renderFitScoreBadge } from './components/FitScoreBadge.js';
import { renderSyncPanelModal, closeSyncPanelModal } from './components/sync/SyncPanelUI.js';
import './components/recipe/BulkRecipeImporterModal.js';
import './components/recipe/RecipeWizardModal.js';
import './components/recipe/RecipeAuditModal.js';
import './components/shell/OfflineBanner.js';

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
import * as MaintenanceService from './services/MaintenanceService.js';
import { alignAllFitScores } from './services/MaintenanceService.js';
import { registeredComponents } from './components/componentRegistry.js';
import * as AppRouter from './core/AppRouter.js';
import * as AppInitializer from './core/AppInitializer.js';

const safeClone = (obj) => {
  if (!obj) return obj;
  try {
    return structuredClone(obj);
  } catch (e) {
    return JSON.parse(JSON.stringify(obj));
  }
};

// Global Compatibility Shims & Persistence Delegation
if (typeof window !== 'undefined') {
  window.stripPlanPayload = stripPlanPayload;
  window.saveState = function(stateData) {
    const rawPlan = stateData?.plan || stateData?.currentPlan || stateData .currentPlan ?.currentPlan;
    if (!rawPlan) return;

    // 1. Dispatch into official store orchestrator
    if (typeof setActivePlan === 'function') {
      setActivePlan(rawPlan);
    } else if (window.store && typeof window.store.setActivePlan === 'function') {
      window.store.setActivePlan(rawPlan);
    }

    // 2. Commit directly to repository if available
    if (window.HouseholdRepository && typeof window.HouseholdRepository.saveCurrentPlan === 'function') {
      window.HouseholdRepository.saveCurrentPlan(rawPlan).catch(err => {
        console.error('[Persistence] Error delegating plan to HouseholdRepository:', err);
      });
    }
  };

  window.loadState = window.loadState || function() {
    console.warn('[Compatibility] Global loadState() invoked.');
    return AppState.getState();
  };
}

// Global Sync Status State Machine
let inSyncStatusTransition = false;
export function setSyncStatus(status, detail = '') {
  if (typeof window === 'undefined' || inSyncStatusTransition) return;
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
    MealPlanGeneratorService, RecipeDetailModalService, PortionCalculationService, TescoImportService,
    ShoppingCalculationService, UnitConverter, NutritionService, FitScoreService, DataQualityService,
    TodayViewService, RecipeAuthoringService, MaintenanceService, alignAllFitScores, ...registeredComponents, AppRouter, AppInitializer,

    showView: window.showView || AppRouter.showView,
    syncMobileNavigation: window.syncMobileNavigation || AppRouter.syncMobileNavigation,
    requestPlatePlanViewRender: window.requestPlatePlanViewRender || AppRouter.requestPlatePlanViewRender,
    showPlatePlanToast: window.showPlatePlanToast || AppInitializer.showPlatePlanToast,

    renderToday, renderPlanner, renderVault: renderRecipeVault, renderRecipeVault, renderVaultGrid: renderRecipeVault,
    renderSettings: renderSettingsView, renderSettingsView, renderShopping: renderShoppingListUI, renderShoppingList: renderShoppingListUI,
    renderShoppingListUI, renderIngredientBank, renderProductBank, renderBank: renderProductBank,
    renderPlatePlanView(viewId) {
      switch (viewId) {
        case 'today': return renderToday();
        case 'vault': case 'recipes': return renderRecipeVault();
        case 'planner': case 'plan': return renderPlanner();
        case 'shopping': return renderShoppingListUI();
        case 'settings': case 'prefs': return renderSettingsView();
        case 'ingredients': return renderIngredientBank();
        case 'bank': return renderProductBank();
        default: return AppRouter.viewModuleMap?.[viewId]?.mount?.(document.getElementById('view-' + viewId));
      }
    },

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
    getShoppingLineStateKey, renderScrollableSwapModal, toggleInlineShoppingSubst,
    toggleShoppingItemAcquired, toggleShoppingAtHome: toggleShoppingItemAcquired,

    openSearchableRecipeSwapModal: (...a) => registeredComponents.PlannerMealSlot?.openSearchableRecipeSwapModal?.(...a),
    closeSearchableRecipeSwapModal: (...a) => registeredComponents.PlannerMealSlot?.closeSearchableRecipeSwapModal?.(...a),
    filterSearchableRecipeSwapModal: (...a) => registeredComponents.PlannerMealSlot?.filterSearchableRecipeSwapModal?.(...a),
    selectAndSwapRecipe: (...a) => registeredComponents.PlannerMealSlot?.selectAndSwapRecipe?.(...a),

    openRecipeModal(id, instanceId, variant, targetPerson) {
      if (typeof window.viewRecipe === 'function') return window.viewRecipe(id, instanceId, variant, targetPerson);
    },
    openMobileMore: () => document.getElementById('mobile-more-wrap')?.classList.add('open'),
    closeMobileMore: () => document.getElementById('mobile-more-wrap')?.classList.remove('open'),
    mobileMoreView(v) {
      document.getElementById('mobile-more-wrap')?.classList.remove('open');
      if (typeof window.showView === 'function') window.showView(v);
    },
    openPlatePlanSyncPanel: renderSyncPanelModal,
    closePlatePlanSyncPanel: closeSyncPanelModal,

    logout() {
      if (window.firebase && window.firebase.auth) { try { window.firebase.auth().signOut(); } catch(e) {} }
      try { localStorage.clear(); } catch(e) {}
      try { sessionStorage.clear(); } catch(e) {}
      window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
    },

    async syncNow() {
      setSyncStatus('connecting', 'Syncing...');
      try {
        await hydrateHouseholdData();
        setSyncStatus(navigator.onLine ? 'synced' : 'offline', 'Synced with Cloud');
        if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast('Synced with Cloud! ☁️', 'success');
        
        // Force UI redraw after manual sync
        import('./core/AppRouter.js').then(router => {
          if (typeof router.mountCurrentView === 'function') router.mountCurrentView();
        });
      } catch(e) {
        setSyncStatus('error', 'Sync Failed');
      }
    }
  });

  window.renderPlatePlanLegacyView = window.renderPlatePlanView;
  window.showRecipeModal = window.openRecipeModal;
  window.openRecipeDetailModal = window.openRecipeModal;
}

export function toggleInlineShoppingSubst(itemKey, groupId = '', instanceId = null) {
  renderScrollableSwapModal(itemKey, groupId, null, { instanceId });
}

export { renderToday, renderSettingsView, renderShoppingListUI, renderScrollableSwapModal, toggleShoppingItemAcquired, renderPlanner, renderRecipeVault, setupActionBridge, getShoppingLineStateKey, calculateMealFitScore, renderFitScoreBadge, PortionCalculationService };

let lastErrorMessage = '';
let lastErrorTime = 0;
function reportAppError(m, type = 'error') {
  if (m === lastErrorMessage && Date.now() - lastErrorTime < 4000) return;
  lastErrorMessage = m; lastErrorTime = Date.now();
  console.error(`[PlatePlan Error Telemetry]`, m);
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

let isSubscribed = false;
function setupSubscriptions() {
  if (isSubscribed) return;
  isSubscribed = true;

  subscribe('recipes', (recipes) => {
    const clean = sanitizeRecipes(recipes);
    if (typeof window !== 'undefined') { getState().recipes = clean; window.allRecipes = clean; window.recipes = clean; }
    renderRecipeVault(); renderToday(); if (getState().currentPlan && typeof renderPlanner === 'function') renderPlanner();
    renderDataQualityView();
  });
  subscribe('ingredients', (ings) => {
    if (typeof window !== 'undefined' && getState()) getState().ingredients = Array.isArray(ings) ? ings : [];
    renderShoppingListUI(); renderIngredientBank(); renderDataQualityView();
  });
  subscribe('products', (prods) => {
    if (typeof window !== 'undefined' && getState()) getState().products = Array.isArray(prods) ? prods : [];
    renderProductBank(); renderDataQualityView();
  });
  subscribe('shopping', () => renderShoppingListUI());
  subscribe('preferences', () => { renderSettingsView(); renderToday(); });
  subscribe('plan', () => { renderToday(); renderPlanner(); renderShoppingListUI(); });
}

export const APP_VERSION = 'v3.42.15';
let isAppInitialized = false;
async function initApp() {
  if (isAppInitialized || (typeof window !== 'undefined' && window.__plateplan_app_booted)) return;
  isAppInitialized = true;
  if (typeof window !== 'undefined') window.__plateplan_app_booted = true;

  try {
    setupActionBridge();
  } catch (e) {
    console.error('[ActionBridge] Early attachment failed:', e);
  }

  const initialRender = () => {
    try {
      renderToday(); renderRecipeVault(); renderPlanner(); renderShoppingListUI();
      renderIngredientBank(); renderProductBank(); renderDataQualityView();
    } catch (renderErr) {
      console.warn('[initApp] initialRender warning:', renderErr);
    }
  };

  try {
    const versionEl = document.getElementById('app-header-version');
    if (versionEl) versionEl.textContent = APP_VERSION;
    
    // Explicitly sync store version to runtime version
    const currentState = getState();
    if (currentState && currentState.version !== APP_VERSION) {
      AppState.updateState({ version: APP_VERSION });
    }

    try { await initStoreCache(); } catch (cacheErr) {}
    try { setupActionBridge(); setupSubscriptions(); } catch (bridgeErr) {}
    try { AppInitializer.registerServiceWorker(); AppInitializer.initPlatePlanApp(); } catch (initErr) {}

    setSyncStatus('connecting', 'Connecting...');

    let hydrationRes = null;
    try {
      await waitForAuth();
      hydrationRes = await hydrateHouseholdData({ force: true });
    } catch (syncErr) {
      console.error('[Boot] Hydration sequence failed:', syncErr);
    }

    initialRender();

    if (hydrationRes && hydrationRes.success) {
      setSyncStatus(navigator.onLine ? 'synced' : 'offline', navigator.onLine ? 'Synced with Cloud' : 'Offline Mode');
      
      // Force the UI to consume the newly hydrated data
      import('./core/AppRouter.js')
        .then(router => {
          if (typeof router.mountCurrentView === 'function') {
            router.mountCurrentView();
          }
        })
        .catch(err => console.error('[Boot] Failed to load AppRouter for redraw:', err));
    } else if (hydrationRes && hydrationRes.unauthenticated) {
      setSyncStatus('local', 'Local only (Sign in to sync)');
    } else {
      setSyncStatus(navigator.onLine ? 'synced' : 'offline', 'Local Cache Active');
    }
  } catch (err) {
    setSyncStatus(navigator.onLine ? 'synced' : 'offline', 'Local Cache Active');
  }
}

// Service Worker Update Listener
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.info('[PlatePlan PWA] New Service Worker controller detected. Reloading for fresh assets...');
    window.location.reload();
  });
}
if ('caches' in window) {
  caches.keys().then((keyList) => {
    return Promise.all(keyList.map((key) => caches.delete(key)));
  });
}

initApp().catch(err => console.error('[PlatePlan Bootstrapper Error]:', err));
