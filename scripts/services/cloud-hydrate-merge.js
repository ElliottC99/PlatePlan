/**
 * scripts/services/cloud-hydrate-merge.js
 * State reconciliation, conflict resolution, and local hydration.
 */
  window.mergeCloudState = async function(remoteData) {
    if (!remoteData) return;

    console.log('[CloudMerge] Merging remote data into domain namespaces...');

    // Ensure global state root is initialized
    window.state = window.state || {};

    // 1. Explicit Domain Namespace Mapping
    if (remoteData.recipes) {
      window.PlatePlanRecipes = window.PlatePlanRecipes || { State: {} };
      window.PlatePlanRecipes.State = window.PlatePlanRecipes.State || {};
      window.PlatePlanRecipes.State.recipes = remoteData.recipes;
      
      window.state.recipes = remoteData.recipes;
      try {
        localStorage.setItem('plateplan_recipes', JSON.stringify(remoteData.recipes));
      } catch (err) {
        console.warn('[CloudHydrate] LocalStorage quota exceeded for recipes. Skipping local storage write; relying on Firestore offline persistence.');
      }
    }

    if (remoteData.ingredients) {
      window.PlatePlanBank = window.PlatePlanBank || { State: {} };
      window.PlatePlanBank.State = window.PlatePlanBank.State || {};
      window.PlatePlanBank.State.ingredients = remoteData.ingredients;

      window.PlatePlanIngredientBank = window.PlatePlanIngredientBank || { State: {} };
      window.PlatePlanIngredientBank.State = window.PlatePlanIngredientBank.State || {};
      window.PlatePlanIngredientBank.State.ingredients = remoteData.ingredients;

      window.state.ingredients = remoteData.ingredients;
      try {
        localStorage.setItem('plateplan_ingredients', JSON.stringify(remoteData.ingredients));
      } catch (err) {
        console.warn('[CloudHydrate] LocalStorage quota exceeded for ingredients. Skipping local storage write; relying on Firestore offline persistence.');
      }
    }

    if (remoteData.settings) {
      window.PlatePlanCloud = window.PlatePlanCloud || { State: {} };
      window.PlatePlanCloud.State = window.PlatePlanCloud.State || {};
      window.PlatePlanCloud.State.settings = remoteData.settings;

      window.state.prefs = remoteData.settings;
      try {
        localStorage.setItem('plateplan_prefs', JSON.stringify(remoteData.settings));
      } catch (err) {
        console.warn('[CloudHydrate] LocalStorage quota exceeded for preferences. Skipping local storage write; relying on Firestore offline persistence.');
      }
    }

    if (remoteData.plan) {
      window.state.plan = remoteData.plan;
      try {
        localStorage.setItem('plateplan_current_plan', JSON.stringify(remoteData.plan));
      } catch (err) {
        console.warn('[CloudHydrate] LocalStorage quota exceeded for current plan. Skipping local storage write; relying on Firestore offline persistence.');
      }
    }

    window.state.isCloudHydrated = true;
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
    
    // 2. Trigger UI Renders in exact required order & re-attach event bindings
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

    // Ensure interactive event listeners are attached / re-bound
    if (typeof window.bindPlatePlanEvents === 'function') {
      try { window.bindPlatePlanEvents(); } catch (e) { console.warn('Events bind warning:', e); }
    }
    if (typeof window.PlatePlanBankEvents?.bindEvents === 'function') {
      try { window.PlatePlanBankEvents.bindEvents(); } catch (e) { console.warn('Bank events bind warning:', e); }
    }
  };
