/**
 * PlatePlan Core Bootstrapper & Main App Entry Point
 * Orchestrates PlatePlan startup by coordinating Cloud, State, Router and Views.
 */

window.platePlanApplicationInitialized = false;

function initializePlatePlanApplication() {
  if (window.platePlanApplicationInitialized) return;
  window.platePlanApplicationInitialized = true;
  console.log('[PlatePlan v3.3.7-mod] Initializing core application with standardized startup sequence...');
  performance.mark?.('plateplan-start');

  if (typeof window.installPlatePlanModalHistory === 'function') {
    window.installPlatePlanModalHistory();
  }
  if (typeof window.clearVolatileSavedDom === 'function') {
    window.clearVolatileSavedDom(document);
  }
  if (typeof window.syncPlatePlanVersionDisplay === 'function') {
    window.syncPlatePlanVersionDisplay();
  }

  // 1. Initialize default global state (window.state)
  window.state = window.state || {};

  // Initialize hydration and readiness state flags
  window.isPlatePlanHydrated = false;
  if (!window.PlatePlanState) window.PlatePlanState = {};
  window.PlatePlanState.isReady = false;
  window.PlatePlanState.isHydrated = false;

  // 2. Call window.PlatePlanCloud.initPlatePlanCloudSync()
  if (window.PlatePlanCloud && typeof window.PlatePlanCloud.initPlatePlanCloudSync === 'function') {
    window.PlatePlanCloud.initPlatePlanCloudSync();
  } else if (typeof window.initPlatePlanCloudSync === 'function') {
    window.initPlatePlanCloudSync();
  }

  // Define window.PlatePlanState.hydrateState wrapper
  if (window.PlatePlanState) {
    window.PlatePlanState.hydrateState = function() {
      window.isHydrating = true;
      window.state = window.PlatePlanModals?.loadState() || {};
      window.appState = window.state;
      window.isHydrating = false;
      return window.state;
    };
  }

  // 3. Hydrate state from local/cloud storage via window.PlatePlanState
  window.isHydrating = true;
  if (window.PlatePlanState && typeof window.PlatePlanState.hydrateState === 'function') {
    window.PlatePlanState.hydrateState();
  } else {
    window.state = window.PlatePlanModals?.loadState() || {};
    window.appState = window.state;
  }
  window.isHydrating = false;

  const bootHouseholdId = window.activeHouseholdId || window.state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  window.activeHouseholdId = bootHouseholdId;
  window.activeHousehold = { id: bootHouseholdId };
  if (!window.state.meta) window.state.meta = {};
  window.state.meta.householdId = bootHouseholdId;

  if (typeof window.preserveStateBeforeModularMigration === 'function') {
    window.preserveStateBeforeModularMigration();
  }
  if (typeof window.applyPlatePlanAppearance === 'function') {
    window.applyPlatePlanAppearance();
  }
  if (typeof window.installPlatePlanSidebarState === 'function') {
    window.installPlatePlanSidebarState();
  }
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (typeof window.getPlatePlanAppearance === 'function' && window.getPlatePlanAppearance() === 'system') {
      if (typeof window.applyPlatePlanAppearance === 'function') window.applyPlatePlanAppearance();
    }
  });

  if (typeof window.renderCatOptions === 'function') {
    window.renderCatOptions('mi-cat', 'other');
    window.renderCatOptions('pp-cat', 'other');
    window.renderCatOptions('tp-cat', 'other');
    window.renderCatOptions('mini-cat', 'other');
  }
  if (typeof window.hideLegacyCategoryAndMeatFields === 'function') {
    window.hideLegacyCategoryAndMeatFields();
  }
  if (typeof window.installPackModelSummaryListeners === 'function') {
    window.installPackModelSummaryListeners();
  }

  const shopGroupByEl = document.getElementById('shop-group-by');
  if (shopGroupByEl && window.state.prefs) {
    shopGroupByEl.value = window.state.prefs.shopGroupBy || 'family';
  }
  const planProductPriorityEl = document.getElementById('plan-product-priority');
  if (planProductPriorityEl && window.state.prefs) {
    planProductPriorityEl.value = window.state.prefs.productPriority || 'protein';
  }
  if (typeof window.setMealRepeatControlValues === 'function') {
    window.setMealRepeatControlValues();
  }
  if (typeof window.setPlanTrafficSelectValues === 'function') {
    window.setPlanTrafficSelectValues();
  }
  if (window.PlatePlanPlanner && typeof window.PlatePlanPlanner.ensurePlannerShell === 'function') {
    window.PlatePlanPlanner.ensurePlannerShell();
  } else if (typeof window.ensurePlannerShell === 'function') {
    window.ensurePlannerShell();
  }
  if (window.PlatePlanPlanner && typeof window.PlatePlanPlanner.installPlannerSummaryObserver === 'function') {
    window.PlatePlanPlanner.installPlannerSummaryObserver();
  } else if (typeof window.installPlannerSummaryObserver === 'function') {
    window.installPlannerSummaryObserver();
  }

  // 4. Build initial indexes (refreshPlatePlanDerivedState)
  if (typeof window.refreshPlatePlanDerivedState === 'function') {
    window.refreshPlatePlanDerivedState({ persist: true, render: false });
  } else {
    window.PlatePlanModals?.rebuildPlatePlanIndexes();
    if (typeof window.refreshAllProductDefaultsAndRecipeNutrition === 'function') {
      window.refreshAllProductDefaultsAndRecipeNutrition();
    }
    window.PlatePlanModals?.rebuildPlatePlanIndexes();
  }

  // Set clear ready flags BEFORE calling renderAll
  window.isHydrating = false;
  window.isPlatePlanHydrated = true;
  if (window.PlatePlanState) {
    window.PlatePlanState.isReady = true;
    window.PlatePlanState.isHydrated = true;
  }
  if (typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('plateplan:state-ready', { detail: { state: window.state } }));
    } catch (_evErr) {}
  }

  if (window.PlatePlanState && typeof window.PlatePlanState.safeLocalStorageSet === 'function') {
    const SK = window.PLATEPLAN_STORAGE_KEY || 'plateplan_state_backup';
    const rawVal = window.state;
    window.PlatePlanState.safeLocalStorageSet(SK, rawVal);
  }
  if (window.PlatePlanState && typeof window.PlatePlanState.checkStartupPlanRecovery === 'function') {
    window.PlatePlanState.checkStartupPlanRecovery(window.state?.plan);
  }

  if (window.PlatePlanPlanner && typeof window.PlatePlanPlanner.resetTodayDate === 'function') {
    window.PlatePlanPlanner.resetTodayDate({ render: false });
  } else if (typeof window.resetTodayDate === 'function') {
    window.resetTodayDate({ render: false });
  }
  if (window.PlatePlanPlanner && typeof window.PlatePlanPlanner.scheduleTodayMidnightRefresh === 'function') {
    window.PlatePlanPlanner.scheduleTodayMidnightRefresh();
  } else if (typeof window.scheduleTodayMidnightRefresh === 'function') {
    window.scheduleTodayMidnightRefresh();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const actualDate = typeof window.getPlatePlanLocalToday === 'function' ? window.getPlatePlanLocalToday() : '';
    const dateChanged = !!window.platePlanLastActualDate && window.platePlanLastActualDate !== actualDate;
    window.platePlanLastActualDate = actualDate;
    if (document.getElementById('view-today')?.classList.contains('active')) {
      if (dateChanged) window.platePlanTodayDate = actualDate;
      if (typeof window.renderToday === 'function') window.renderToday();
    }
    if (typeof window.scheduleTodayMidnightRefresh === 'function') window.scheduleTodayMidnightRefresh();
  });

  // 5. Mount router event listeners via window.PlatePlanRouter.bindTopBarActionListeners()
  if (window.PlatePlanRouter && typeof window.PlatePlanRouter.bindTopBarActionListeners === 'function') {
    window.PlatePlanRouter.bindTopBarActionListeners();
  } else if (typeof window.bindTopBarActionListeners === 'function') {
    window.bindTopBarActionListeners();
  }

  // 6. Trigger initial view render via window.PlatePlanRouter.renderAll()
  if (window.PlatePlanRouter && typeof window.PlatePlanRouter.renderAll === 'function') {
    window.PlatePlanRouter.renderAll();
  } else if (typeof window.renderAll === 'function') {
    window.renderAll();
  }

  performance.mark?.('plateplan-usable');
  try { performance.measure?.('plateplan-local-startup', 'plateplan-start', 'plateplan-usable'); } catch (e) {}

  if (typeof window.setPlatePlanStartupInert === 'function') {
    window.setPlatePlanStartupInert(false);
  }

  window.addEventListener('online', () => {
    if (typeof window.updatePlatePlanSyncStatus === 'function') {
      const outboxLen = typeof window.getPlatePlanSyncOutbox === 'function' ? window.getPlatePlanSyncOutbox().length : 0;
      window.updatePlatePlanSyncStatus(outboxLen ? 'saving' : 'connecting');
    }
    if (typeof window.flushPlatePlanSyncOutbox === 'function') {
      window.flushPlatePlanSyncOutbox();
    }
  });
  window.addEventListener('offline', () => {
    if (typeof window.updatePlatePlanSyncStatus === 'function') {
      window.updatePlatePlanSyncStatus('offline');
    }
  });

  // Sync Original Serves to Target Servings unless manually edited
  const origServesInput = document.getElementById('r-serves-orig');
  const targetServesInput = document.getElementById('r-serves');
  if (origServesInput && targetServesInput) {
    origServesInput.addEventListener('input', () => {
      if (!targetServesInput.dataset.manuallyChanged || !targetServesInput.value) {
        targetServesInput.value = origServesInput.value;
      }
    });
    targetServesInput.addEventListener('input', () => {
      targetServesInput.dataset.manuallyChanged = 'true';
    });
  }

  // Close map and recipe search dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.mapping-search-container')) {
      document.querySelectorAll('.map-dropdown').forEach(d => d.style.display = 'none');
    }
    if (!e.target.closest('.recipe-search-wrap')) {
      document.querySelectorAll('.recipe-search-drop').forEach(d => d.style.display = 'none');
      document.querySelectorAll('.recipe-search-wrap').forEach(w => w.classList.remove('is-open'));
      document.querySelectorAll('.slot-row').forEach(sr => sr.classList.remove('has-open-drop'));
    }
  });
}

window.initializePlatePlanApplication = initializePlatePlanApplication;
window.initApp = initializePlatePlanApplication;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePlatePlanApplication, { once: true });
} else {
  queueMicrotask(initializePlatePlanApplication);
}
