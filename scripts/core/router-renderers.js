/**
 * scripts/core/router-renderers.js
 * PlatePlan View Renderers & Delegation
 */
(function() {
  window.PlatePlanRouter = window.PlatePlanRouter || {};

  const platePlanFeatureRenderers = Object.freeze({
    today() {
      (window.resetTodayDate || (() => {}))({ render: false });
      if (typeof window.PlatePlanViews?.renderToday === 'function') return window.PlatePlanViews.renderToday();
      return typeof renderToday === 'function' ? renderToday() : null;
    },
    vault() {
      if (typeof window.PlatePlanRecipes?.renderVault === 'function') return window.PlatePlanRecipes.renderVault();
      if (typeof window.PlatePlanViews?.renderVault === 'function') return window.PlatePlanViews.renderVault();
      return typeof renderVault === 'function' ? renderVault() : null;
    },
    add() {
      if (window.platePlanPendingRecipePreFill) {
        if (typeof applyPendingRecipePreFillToForm === 'function') applyPendingRecipePreFillToForm();
      } else if (!window.editId && !window.platePlanPreserveAddForm) {
        if (typeof clearForm === 'function') clearForm();
      }
      window.platePlanPreserveAddForm = false;
    },
    ingredients() {
      return (window.PlatePlanIngredientBank?.renderIngredientBank || window.renderIngredientBank || (() => null))();
    },
    bank() {
      return (window.PlatePlanIngredientBank?.renderProductBank || window.renderBank || (() => null))();
    },
    planner() {
      (window.ensurePlannerShell || (() => {}))();
      const daySel = document.getElementById('plan-days');
      if (daySel && window.state?.plan?.days) daySel.value = String(window.state.plan.days);
      if (typeof buildExclGrid === 'function') buildExclGrid();
      return (window.PlatePlanPlanner?.renderPlannerView || window.renderPlan || (() => null))();
    },
    planlib() {
      (window.ensurePlannerShell || (() => {}))();
      return (window.PlatePlanPlanner?.renderPlanHistoryPanel || window.renderPlanHistoryPanel || (() => null))();
    },
    shopping() {
      return (window.PlatePlanShoppingList?.renderShopping || window.renderShopping || (() => null))();
    },
    prefs() {
      if (typeof window.PlatePlanSettings?.renderPreferences === 'function') return window.PlatePlanSettings.renderPreferences();
      return (window.loadPrefs || (() => null))();
    },
    data() {
      return (window.PlatePlanDataQuality?.renderDataQuality || window.renderDataQuality || (() => null))();
    }
  });

  function renderPlatePlanLegacyView(id) {
    const renderer = platePlanFeatureRenderers[id];
    if (renderer) {
      renderer();
    } else {
      console.warn(`[Router] No renderer found for view: ${id}`);
    }
  }

  function requestPlatePlanViewRender(id) {
    if (globalThis.PlatePlanModules?.renderView) {
      globalThis.PlatePlanModules.renderView(id);
      return;
    }
    renderPlatePlanLegacyView(id);
  }

  function runPlatePlanDelegatedAction(code, event, element) {
    if (!code || typeof code !== 'string') return undefined;
    const delegatedEvent = (event && typeof event === 'object') ? new Proxy(event, {
      get(target, prop) {
        if (prop === 'currentTarget') return element;
        const val = target[prop];
        return typeof val === 'function' ? val.bind(target) : val;
      }
    }) : event;
    
    return (function delegatedPlatePlanAction(event) {
      const targetElement = element || (event && (event.currentTarget || event.target));
      if (code.includes('viewRecipe')) {
        const viewMatch = code.match(/viewRecipe\s*\(\s*(['"][^'"]+['"]|[^\s,]+)(?:\s*,\s*([^)]*))?\)/);
        if (viewMatch) {
          const recId = viewMatch[1].replace(/['"]/g, '');
          if (typeof window.viewRecipe === 'function') return window.viewRecipe(recId);
        }
      }
      return eval(code);
    }).call(element, delegatedEvent);
  }

  Object.assign(window.PlatePlanRouter, {
    platePlanFeatureRenderers,
    renderPlatePlanLegacyView,
    requestPlatePlanViewRender,
    runPlatePlanDelegatedAction
  });

  window.platePlanFeatureRenderers = platePlanFeatureRenderers;
  window.renderPlatePlanLegacyView = renderPlatePlanLegacyView;
  window.runPlatePlanDelegatedAction = runPlatePlanDelegatedAction;
})();
