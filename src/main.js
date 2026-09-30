if (typeof window !== 'undefined') {
  window.APP_VERSION = 'v3.19.3';
}

/**
 * src/main.js (v3.19.3)
 * Modern ES6 Architecture Entry Point & Atomic Lifecycle Coordinator.
 * Manages unidirectional state subscriptions, cross-view reactive synchronization,
 * instant offline caching, global error telemetry, and PWA service worker registration.
 */
import { waitForAuth } from './services/AuthService.js';
import { hydrateHouseholdData } from './services/HydrationService.js';
import { subscribe, getState } from './store/store.js';
import { setupActionBridge } from './services/ActionBridge.js';
import { renderSettingsView } from './views/SettingsView.js';
import { renderShoppingListUI, renderScrollableSwapModal, toggleShoppingItemAcquired, getShoppingLineStateKey } from './views/ShoppingView.js';
import { renderPlanner } from './views/PlannerView.js';
import { renderRecipeVault } from './views/RecipeVaultView.js';
import { calculateMealFitScore } from './utils/fitScoreCalculator.js';
import { renderFitScoreBadge } from './components/FitScoreBadge.js';
import * as PortionCalculationService from './services/PortionCalculationService.js';
import * as TescoImportService from './services/TescoImportService.js';
import * as ShoppingCalculationService from './services/ShoppingCalculationService.js';
import * as UnitConverter from './utils/unitConverter.js';
import * as NutritionService from './services/NutritionService.js';
import * as FitScoreService from './services/FitScoreService.js';
import * as DataQualityService from './services/DataQualityService.js';
import * as TodayViewService from './services/TodayViewService.js';
import * as RecipeAuthoringService from './services/RecipeAuthoringService.js';
import * as DataQualityDrawer from './components/data-quality/DataQualityDrawer.js';
import * as DataQualityIssueRow from './components/data-quality/DataQualityIssueRow.js';
import * as DataQualityFixModal from './components/data-quality/DataQualityFixModal.js';
import * as RecipeEditorModal from './components/recipe-editor/RecipeEditorModal.js';
import * as RecipeIngredientRow from './components/recipe-editor/RecipeIngredientRow.js';
import * as RecipeStepRow from './components/recipe-editor/RecipeStepRow.js';
import * as IngredientEditorRows from './components/recipe-editor/IngredientEditorRows.js';
import * as RecipeImportParserForm from './components/recipe-editor/RecipeImportParserForm.js';
import * as ShoppingBatchToolbar from './components/shopping/ShoppingBatchToolbar.js';
import * as ShoppingCategoryGroup from './components/shopping/ShoppingCategoryGroup.js';
import * as ShoppingItemRow from './components/shopping/ShoppingItemRow.js';
import * as ShoppingAisleGroup from './components/shopping/ShoppingAisleGroup.js';
import * as ShoppingListToolbar from './components/shopping/ShoppingListToolbar.js';
import * as PlannerDayCard from './components/planner/PlannerDayCard.js';
import * as PlannerMealSlot from './components/planner/PlannerMealSlot.js';
import * as PlannerGridToolbar from './components/planner/PlannerGridToolbar.js';
import * as ProfileMacroEditor from './components/profile/ProfileMacroEditor.js';
import * as ProfilePreferencesForm from './components/profile/ProfilePreferencesForm.js';
import * as ProfileSettingsModal from './components/profile/ProfileSettingsModal.js';
import * as GeneratorWizardModal from './components/generator/GeneratorWizardModal.js';
import * as GeneratorConstraintsForm from './components/generator/GeneratorConstraintsForm.js';
import * as GeneratorCandidateDrawer from './components/generator/GeneratorCandidateDrawer.js';
import * as RecipeNutritionCard from './components/analytics/RecipeNutritionCard.js';
import * as RecipePortionScaler from './components/analytics/RecipePortionScaler.js';
import * as RecipeCostBreakdown from './components/analytics/RecipeCostBreakdown.js';
import * as MacroTrendChart from './components/analytics/MacroTrendChart.js';
import * as NutriScoreBadgeCard from './components/analytics/NutriScoreBadgeCard.js';
import * as WeeklySummaryToolbar from './components/analytics/WeeklySummaryToolbar.js';
import * as VaultFilterToolbar from './components/vault/VaultFilterToolbar.js';
import * as VaultRecipeCard from './components/vault/VaultRecipeCard.js';
import * as VaultGridContainer from './components/vault/VaultGridContainer.js';
import * as VaultGridUI from './components/vault/VaultGridUI.js';
import * as RecipeDetailModalUI from './components/recipe/RecipeDetailModalUI.js';
import * as RecipeEditorModalUI from './components/recipe/RecipeEditorModalUI.js';
import * as PantryItemRow from './components/pantry/PantryItemRow.js';
import * as PantryCategoryGroup from './components/pantry/PantryCategoryGroup.js';
import * as PantryToolbar from './components/pantry/PantryToolbar.js';
import * as PantryInventoryUI from './components/pantry/PantryInventoryUI.js';
import * as ShoppingListUI from './components/shopping/ShoppingListUI.js';
import * as ShoppingSubstUI from './components/shopping/ShoppingSubstUI.js';
import * as UseUpEditorUI from './components/pantry/UseUpEditorUI.js';
import * as UseUpFinderModalUI from './components/pantry/UseUpFinderModalUI.js';
import * as PlannerGridUI from './components/planner/PlannerGridUI.js';
import * as PlannerModalsUI from './components/planner/PlannerModalsUI.js';
import * as PlannerWizardUI from './components/planner/PlannerWizardUI.js';
import * as PlannerSwapModalUI from './components/planner/PlannerSwapModalUI.js';
import * as PrepStepCard from './components/prep/PrepStepCard.js';
import * as PrepContainerPlanner from './components/prep/PrepContainerPlanner.js';
import * as PrepSummaryToolbar from './components/prep/PrepSummaryToolbar.js';
import * as ProfileAllocationCard from './components/settings/ProfileAllocationCard.js';
import * as DietaryExclusionManager from './components/settings/DietaryExclusionManager.js';
import * as HouseholdSyncCard from './components/settings/HouseholdSyncCard.js';
import * as SettingsMacroUI from './components/settings/SettingsMacroUI.js';
import * as SettingsExclusionsUI from './components/settings/SettingsExclusionsUI.js';
import * as SettingsHouseholdUI from './components/profile/SettingsHouseholdUI.js';
import * as HeaderUI from './components/shell/HeaderUI.js';
import * as NavigationUI from './components/shell/NavigationUI.js';
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
    PortionCalculationService, TescoImportService, ShoppingCalculationService, UnitConverter, NutritionService,
    FitScoreService, DataQualityService, TodayViewService, RecipeAuthoringService,
    DataQualityDrawer, DataQualityIssueRow, DataQualityFixModal, RecipeEditorModal,
    RecipeIngredientRow, RecipeStepRow, IngredientEditorRows, RecipeImportParserForm,
    ShoppingBatchToolbar, ShoppingCategoryGroup, ShoppingItemRow, ShoppingAisleGroup,
    ShoppingListToolbar, PlannerDayCard, PlannerMealSlot, PlannerGridToolbar,
    ProfileMacroEditor, ProfilePreferencesForm, ProfileSettingsModal, GeneratorWizardModal,
    GeneratorConstraintsForm, GeneratorCandidateDrawer, RecipeNutritionCard, RecipePortionScaler,
    RecipeCostBreakdown, MacroTrendChart, NutriScoreBadgeCard, WeeklySummaryToolbar,
    VaultFilterToolbar, VaultRecipeCard, VaultGridContainer, VaultGridUI,
    RecipeDetailModalUI, RecipeEditorModalUI, PantryItemRow, PantryCategoryGroup,
    PantryToolbar, PantryInventoryUI, ShoppingListUI, ShoppingSubstUI, UseUpEditorUI,
    UseUpFinderModalUI, PlannerGridUI, PlannerModalsUI, PlannerWizardUI, PlannerSwapModalUI,
    PrepStepCard, PrepContainerPlanner, PrepSummaryToolbar, ProfileAllocationCard,
    DietaryExclusionManager, HouseholdSyncCard, SettingsMacroUI, SettingsExclusionsUI,
    SettingsHouseholdUI, HeaderUI, NavigationUI, AppRouter, AppInitializer
  });

  window.renderMacroTrendChart = MacroTrendChart.renderMacroTrendChart;
  window.renderNutriScoreBadgeCard = NutriScoreBadgeCard.renderNutriScoreBadgeCard;
  window.renderWeeklySummaryToolbar = WeeklySummaryToolbar.renderWeeklySummaryToolbar;
  window.renderPrepStepCard = PrepStepCard.renderPrepStepCard;
  window.renderPrepContainerPlanner = PrepContainerPlanner.renderPrepContainerPlanner;
  window.renderPrepSummaryToolbar = PrepSummaryToolbar.renderPrepSummaryToolbar;
  window.showView = window.showView || AppRouter.showView;
  window.syncMobileNavigation = window.syncMobileNavigation || AppRouter.syncMobileNavigation;
  window.requestPlatePlanViewRender = window.requestPlatePlanViewRender || AppRouter.requestPlatePlanViewRender;
  window.showPlatePlanToast = window.showPlatePlanToast || AppInitializer.showPlatePlanToast;
  window.renderProfileAllocationCard = ProfileAllocationCard.renderProfileAllocationCard;
  window.renderDietaryExclusionManager = DietaryExclusionManager.renderDietaryExclusionManager;
  window.renderHouseholdSyncCard = HouseholdSyncCard.renderHouseholdSyncCard;
  window.openSearchableRecipeSwapModal = PlannerMealSlot.openSearchableRecipeSwapModal;
  window.closeSearchableRecipeSwapModal = PlannerMealSlot.closeSearchableRecipeSwapModal;
  window.filterSearchableRecipeSwapModal = PlannerMealSlot.filterSearchableRecipeSwapModal;
  window.selectAndSwapRecipe = PlannerMealSlot.selectAndSwapRecipe;
}

// 1. STATE INITIALIZATION VIA ENCAPSULATED STORE
if (typeof window !== 'undefined') {
  const storeState = getState();
}

// 2. EXPORTS & GLOBAL COMPATIBILITY ALIASES
export { renderSettingsView, renderShoppingListUI, renderScrollableSwapModal, toggleShoppingItemAcquired, renderPlanner, renderRecipeVault, setupActionBridge, getShoppingLineStateKey, calculateMealFitScore, renderFitScoreBadge, PortionCalculationService };

if (typeof window !== 'undefined') {
  window.getShoppingLineStateKey = getShoppingLineStateKey;
  window.renderSettings = renderSettingsView;
  window.renderShopping = renderShoppingListUI;
  window.renderShoppingList = renderShoppingListUI;
  window.renderScrollableSwapModal = renderScrollableSwapModal;
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
    console.warn('[main.js v3.8.1] viewRecipe not found on window');
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

  console.error(`[PlatePlan Error Telemetry v3.12.3]`, message);
  if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast(message, type);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.message) {
      if (/Converting circular structure to JSON/i.test(event.message)) {
        console.warn('[PlatePlan Error Telemetry v3.9.4] Intercepted circular JSON error:', event.message);
        return;
      }
      reportAppError(`App Error: ${event.message}`);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || event.reason || 'Network or asynchronous error';
    const reasonStr = typeof reason === 'string' ? reason : (reason?.message || String(reason || ''));
    if (/client is offline|Failed to get document because the client is offline|Could not reach Cloud Firestore backend|offline mode/i.test(reasonStr)) {
      console.warn('[PlatePlan Offline Handler]', reasonStr);
      setSyncStatus('offline', 'Offline mode');
      return;
    }
    reportAppError(`Async Error: ${reasonStr}`);
  });

  window.addEventListener('offline', () => {
    setSyncStatus('offline', 'Offline mode');
    reportAppError('Offline mode active. Using local cached data.', 'warning');
  });

  window.addEventListener('online', () => {
    setSyncStatus('connecting', 'Restoring connection...');
    reportAppError('Online connection restored. Syncing with cloud...', 'success');
    hydrateHouseholdData();
  });
}

// 4. SERVICE WORKER REGISTRATION HANDLED BY AppInitializer
// (Duplicate definition removed)

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
  return recipes.map(recipe => deepMutate(safeClone(recipe)));
}

export function updateVersionBadge() {
  const footerEl = document.getElementById('app-version') || document.getElementById('plateplan-update-version');
  if (footerEl) {
    footerEl.textContent = 'v3.19.3 (ES6 Modern)';
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
  if (isAppInitialized || (typeof window !== 'undefined' && window.__plateplan_app_booted)) return;
  isAppInitialized = true;
  if (typeof window !== 'undefined') window.__plateplan_app_booted = true;

  updateVersionBadge();
  setupActionBridge();
  setupSubscriptions();
  AppInitializer.registerServiceWorker();
  AppInitializer.initPlatePlanApp();
  
  setSyncStatus('connecting', 'Connecting to Cloud...');
  try {
    const user = await waitForAuth();
    const hydrationRes = await hydrateHouseholdData();
    
    // Perform initial render ONLY AFTER hydration is complete
    renderRecipeVault();
    renderShoppingListUI();
    
    if (hydrationRes && hydrationRes.success) {
      setSyncStatus(navigator.onLine ? 'synced' : 'offline', navigator.onLine ? 'Synced with Cloud' : 'Offline Mode');
    } else {
      setSyncStatus(navigator.onLine ? 'synced' : 'offline', 'Local Cache Active');
    }
  } catch (err) {
    console.warn('[initApp] Auth or Hydration fallback:', err);
    // Even if hydration fails, try to render with cached data
    renderRecipeVault();
    renderShoppingListUI();
    setSyncStatus(navigator.onLine ? 'synced' : 'offline', 'Local Cache Active');
  }
}

initApp();
