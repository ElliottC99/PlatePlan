/**
 * scripts/services/cloud-hydrate-merge.js
 * State reconciliation, conflict resolution, and local hydration.
 */
  window.mergeCloudState = async function(remoteData) {
    if (!remoteData) return;

    console.log('[CloudMerge] Merging remote data...');

    // Simple strategy: remote wins if it exists, but we could be smarter
    if (remoteData.settings) {
      localStorage.setItem('plateplan_prefs', JSON.stringify(remoteData.settings));
      if (window.state) window.state.prefs = remoteData.settings;
    }

    if (remoteData.plan) {
      localStorage.setItem('plateplan_current_plan', JSON.stringify(remoteData.plan));
      if (window.state) window.state.plan = remoteData.plan;
    }

    if (remoteData.recipes && remoteData.recipes.length > 0) {
      localStorage.setItem('plateplan_recipes', JSON.stringify(remoteData.recipes));
      if (window.state) window.state.recipes = remoteData.recipes;
    }

    if (remoteData.ingredients && remoteData.ingredients.length > 0) {
      localStorage.setItem('plateplan_ingredients', JSON.stringify(remoteData.ingredients));
      if (window.state) window.state.ingredients = remoteData.ingredients;
    }

    if (window.state) window.state.isCloudHydrated = true;

    console.log('[CloudMerge] Local storage updated from cloud. Dispatching plateplan:hydrated event...');

    try {
      const hydrationEvent = new CustomEvent('plateplan:hydrated', {
        detail: {
          timestamp: Date.now(),
          remoteData
        }
      });
      window.dispatchEvent(hydrationEvent);
      document.dispatchEvent(hydrationEvent);
    } catch (err) {
      console.warn('[CloudMerge] Custom event dispatch warning:', err);
    }
    
    // Trigger single-pass app re-render
    if (typeof window.refreshPlatePlanDerivedState === 'function') {
      await window.refreshPlatePlanDerivedState();
    }

    if (typeof window.renderMealPlannerWizard === 'function') {
      window.renderMealPlannerWizard();
    }
    
    if (typeof window.renderPlannerView === 'function') {
      window.renderPlannerView();
    } else if (typeof window.renderPlan === 'function') {
      window.renderPlan();
    }

    if (typeof window.renderAll === 'function') {
      window.renderAll();
    }
  };
