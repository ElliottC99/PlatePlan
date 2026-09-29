/**
 * sw.js (v3.9.0)
 * Service Worker for PlatePlan PWA offline support & asset caching.
 * Caches core app shell, modern ES6 modules, stylesheets, and icons.
 */

const PLATEPLAN_CACHE = 'plateplan-shell-v3.14.4';
const PLATEPLAN_APP_VERSION = '3.14.4';
const PLATEPLAN_BUILD_ID = '3.14.4-v142';

const PLATEPLAN_PRECACHE_ASSETS = [
  '/',
  '/PlatePlan.html',
  '/manifest.json',
  '/firebase-config.js',
  '/styles/tokens.css?v=3.3.0',
  '/styles/components.css?v=3.3.0',
  '/styles/responsive.css?v=3.3.0',
  '/styles/print.css?v=3.3.0',
  '/src/main.js',
  '/src/store/store.js',
  '/src/config/firebase.js',
  '/src/services/AuthService.js',
  '/src/services/HydrationService.js',
  '/src/services/HouseholdRepository.js',
  '/src/services/TescoImportService.js',
  '/src/services/RecipeOcrService.js',
  '/src/services/NutritionService.js',
  '/src/services/FitScoreService.js',
  '/src/services/DataQualityService.js',
  '/src/services/TodayViewService.js',
  '/src/services/RecipeAuthoringService.js',
  '/src/components/analytics/MacroTrendChart.js',
  '/src/components/analytics/NutriScoreBadgeCard.js',
  '/src/components/analytics/WeeklySummaryToolbar.js',
  '/src/components/prep/PrepStepCard.js',
  '/src/components/prep/PrepContainerPlanner.js',
  '/src/components/prep/PrepSummaryToolbar.js',
  '/src/components/data-quality/DataQualityDrawer.js',
  '/src/components/data-quality/DataQualityIssueRow.js',
  '/src/components/data-quality/DataQualityFixModal.js',
  '/src/components/recipe-editor/RecipeEditorModal.js',
  '/src/components/recipe-editor/RecipeIngredientRow.js',
  '/src/components/recipe-editor/RecipeStepRow.js',
  '/src/components/recipe-editor/IngredientEditorRows.js',
  '/src/components/recipe-editor/RecipeImportParserForm.js',
  '/src/components/shopping/ShoppingBatchToolbar.js',
  '/src/components/shopping/ShoppingCategoryGroup.js',
  '/src/components/shopping/ShoppingItemRow.js',
  '/src/components/shopping/ShoppingAisleGroup.js',
  '/src/components/shopping/ShoppingListToolbar.js',
  '/src/components/planner/PlannerDayCard.js',
  '/src/components/planner/PlannerMealSlot.js',
  '/src/components/planner/PlannerGridToolbar.js',
  '/src/components/profile/ProfileMacroEditor.js',
  '/src/components/profile/ProfilePreferencesForm.js',
  '/src/components/profile/ProfileSettingsModal.js',
  '/src/components/generator/GeneratorWizardModal.js',
  '/src/components/generator/GeneratorConstraintsForm.js',
  '/src/components/generator/GeneratorCandidateDrawer.js',
  '/src/components/analytics/RecipeNutritionCard.js',
  '/src/components/analytics/RecipePortionScaler.js',
  '/src/components/analytics/RecipeCostBreakdown.js',
  '/src/components/vault/VaultFilterToolbar.js',
  '/src/components/vault/VaultRecipeCard.js',
  '/src/components/vault/VaultGridContainer.js',
  '/src/components/vault/VaultGridUI.js',
  '/src/components/recipe/RecipeDetailModalUI.js',
  '/src/components/recipe/RecipeEditorModalUI.js',
  '/src/components/pantry/PantryItemRow.js',
  '/src/components/pantry/PantryCategoryGroup.js',
  '/src/components/pantry/PantryToolbar.js',
  '/src/components/pantry/PantryInventoryUI.js',
  '/src/components/shopping/ShoppingListUI.js',
  '/src/components/shopping/ShoppingSubstUI.js',
  '/src/components/pantry/UseUpEditorUI.js',
  '/src/components/pantry/UseUpFinderModalUI.js',
  '/src/components/planner/PlannerGridUI.js',
  '/src/components/planner/PlannerModalsUI.js',
  '/src/components/planner/PlannerWizardUI.js',
  '/src/components/planner/PlannerSwapModalUI.js',
  '/src/components/settings/SettingsMacroUI.js',
  '/src/components/settings/SettingsExclusionsUI.js',
  '/src/components/profile/SettingsHouseholdUI.js',
  '/src/components/settings/DietaryExclusionManager.js',
  '/src/components/settings/HouseholdSyncCard.js',
  '/src/components/settings/ProfileAllocationCard.js',
  '/src/utils/safeJson.js',
  '/src/components/shell/HeaderUI.js',
  '/src/components/shell/NavigationUI.js',
  '/src/core/AppRouter.js',
  '/src/core/AppInitializer.js',
  '/src/utils/unitConverter.js',
  '/src/services/ActionBridge.js',
  '/src/views/SettingsView.js',
  '/src/views/ShoppingView.js',
  '/src/views/PlannerView.js',
  '/src/views/RecipeVaultView.js',
  '/src/components/ProductSwapModal.js',
  '/scripts/plateplan-app.js?v=3.3.0',
  '/scripts/bootstrap.js?v=3.3.0',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png'
];

const PLATEPLAN_OPTIONAL_SHELL = [
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js'
];

let platePlanActivationRequested = false;

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(PLATEPLAN_CACHE).then(async cache => {
      console.log(`[SW v3.6.0] Precaching shell and core ES6 modules...`);
      await cache.addAll(PLATEPLAN_PRECACHE_ASSETS).catch(err => {
        console.warn('[SW v3.6.0] Non-fatal precache warning:', err);
      });
      await Promise.allSettled(PLATEPLAN_OPTIONAL_SHELL.map(url => cache.add(url)));
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== PLATEPLAN_CACHE)
          .map(key => {
            console.log('[SW v3.6.0] Purging previous shell cache:', key);
            return caches.delete(key);
          })
      );
    })
      .then(() => self.clients.claim())
      .then(async () => {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const detail = {
          cacheName: PLATEPLAN_CACHE,
          appVersion: PLATEPLAN_APP_VERSION,
          buildId: PLATEPLAN_BUILD_ID,
          requested: platePlanActivationRequested
        };
        clients.forEach(client => {
          client.postMessage({ type: 'PLATEPLAN_UPDATE_ACTIVE', ...detail });
          client.postMessage({ type: 'PLATEPLAN_UPDATE_ACTIVATED', ...detail });
        });
      })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // Stale-While-Revalidate / Network-First with Cache Fallback for app assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(PLATEPLAN_CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
              return caches.match('/PlatePlan.html') || caches.match('/');
            }
            return new Response('Offline resource not found', { status: 503, statusText: 'Service Unavailable' });
          });
        })
    );
    return;
  }

  // Cache-first for external CDN resources (Firebase SDKs, etc.)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(PLATEPLAN_CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => new Response('', { status: 408, statusText: 'Offline or network error' }));
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'PLATEPLAN_ACTIVATE_UPDATE' || event.data?.type === 'SKIP_WAITING') {
    platePlanActivationRequested = true;
    if (event.ports?.[0]) {
      event.ports[0].postMessage({
        type: 'PLATEPLAN_ACTIVATION_ACCEPTED',
        cacheName: PLATEPLAN_CACHE,
        appVersion: PLATEPLAN_APP_VERSION,
        buildId: PLATEPLAN_BUILD_ID
      });
    }
    event.waitUntil(self.skipWaiting());
  }
  if (event.data?.type === 'PLATEPLAN_GET_VERSION' || event.data?.type === 'GET_VERSION') {
    const message = {
      type: 'PLATEPLAN_VERSION',
      cacheName: PLATEPLAN_CACHE,
      appVersion: PLATEPLAN_APP_VERSION,
      buildId: PLATEPLAN_BUILD_ID
    };
    if (event.ports?.[0]) event.ports[0].postMessage(message);
    else event.source?.postMessage(message);
  }
});
