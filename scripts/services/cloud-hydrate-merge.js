/**
 * scripts/services/cloud-hydrate-merge.js
 * State reconciliation, conflict resolution, and local hydration.
 */
  window.mergeCloudState = async function(remoteData) {
    if (!remoteData) return;

    console.log('[CloudMerge] Merging remote data into domain namespaces...');

    // 1. Explicit Domain Namespace Mapping
    if (remoteData.recipes) {
      window.PlatePlanRecipes = window.PlatePlanRecipes || {};
      window.PlatePlanRecipes.State = window.PlatePlanRecipes.State || {};
      window.PlatePlanRecipes.State.recipes = remoteData.recipes;
      
      if (window.state) window.state.recipes = remoteData.recipes;
      localStorage.setItem('plateplan_recipes', JSON.stringify(remoteData.recipes));
    }

    if (remoteData.ingredients) {
      window.PlatePlanBank = window.PlatePlanBank || {};
      window.PlatePlanBank.State = window.PlatePlanBank.State || {};
      window.PlatePlanBank.State.ingredients = remoteData.ingredients;

      window.PlatePlanIngredientBank = window.PlatePlanIngredientBank || {};
      window.PlatePlanIngredientBank.State = window.PlatePlanIngredientBank.State || {};
      window.PlatePlanIngredientBank.State.ingredients = remoteData.ingredients;

      if (window.state) window.state.ingredients = remoteData.ingredients;
      localStorage.setItem('plateplan_ingredients', JSON.stringify(remoteData.ingredients));
    }

    if (remoteData.settings) {
      window.PlatePlanCloud = window.PlatePlanCloud || {};
      window.PlatePlanCloud.State = window.PlatePlanCloud.State || {};
      window.PlatePlanCloud.State.settings = remoteData.settings;

      if (window.state) window.state.prefs = remoteData.settings;
      localStorage.setItem('plateplan_prefs', JSON.stringify(remoteData.settings));
    }

    if (remoteData.plan) {
      if (window.state) window.state.plan = remoteData.plan;
      localStorage.setItem('plateplan_current_plan', JSON.stringify(remoteData.plan));
    }

    if (window.state) window.state.isCloudHydrated = true;
    if (window.PlatePlanCloud?.State) window.PlatePlanCloud.State.isCloudHydrated = true;

    console.log('[CloudMerge] Local storage and domain namespaces updated. Dispatching plateplan:hydrated event...');

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
    
    // 2. Trigger UI Renders in exact required order
    if (typeof window.refreshPlatePlanDerivedState === 'function') {
      await window.refreshPlatePlanDerivedState();
    }

    if (typeof window.PlatePlanRecipes?.renderVault === 'function') {
      window.PlatePlanRecipes.renderVault();
    } else if (typeof window.renderVault === 'function') {
      window.renderVault();
    }

    if (typeof window.PlatePlanIngredientBank?.renderProductBank === 'function') {
      window.PlatePlanIngredientBank.renderProductBank();
    } else if (typeof window.renderBank === 'function') {
      window.renderBank();
    }

    if (typeof window.PlatePlanSettings?.renderPreferences === 'function') {
      window.PlatePlanSettings.renderPreferences();
    } else if (typeof window.renderPreferences === 'function') {
      window.renderPreferences();
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
