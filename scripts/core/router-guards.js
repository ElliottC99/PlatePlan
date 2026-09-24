/**
 * scripts/core/router-guards.js
 * PlatePlan Router Guards & Hydration Checks
 */
(function() {
  window.PlatePlanRouter = window.PlatePlanRouter || {};

  /**
   * Check if the application state is hydrated and ready for rendering.
   */
  function isPlatePlanStateReady() {
    if (typeof window === 'undefined') return true;
    if (window.isHydrating) return false;
    if (window.PlatePlanState?.isReady || window.isPlatePlanHydrated || window.PlatePlanState?.isHydrated) return true;
    if (window.platePlanApplicationInitialized && window.platePlanIndexes?.products) return true;
    
    const s = window.state || (typeof state !== 'undefined' ? state : null);
    return !!(s && ((s.recipes && s.recipes.length > 0) || (s.plan?.slots && Object.keys(s.plan.slots).length > 0)));
  }

  /**
   * Guard a view transition, ensuring data is available or showing a loading state.
   */
  function guardViewTransition(id, transitionFn) {
    if (!isPlatePlanStateReady()) {
      console.log(`[Router] Guarding ${id}: State not ready.`);
      const subtitle = document.getElementById('today-subtitle');
      if (id === 'today' && subtitle) subtitle.textContent = 'Loading your planned meals…';
      
      window.addEventListener('plateplan:state-ready', () => {
        const activeView = document.querySelector('.view.active');
        if (activeView?.id === `view-${id}`) transitionFn();
      }, { once: true });
      return false;
    }
    return true;
  }

  /**
   * Validate if a route ID is recognized by the system.
   */
  function isValidRoute(id) {
    const valid = ['today', 'vault', 'add', 'ingredients', 'bank', 'planner', 'planlib', 'shopping', 'prefs', 'data', 'search'];
    return valid.includes(id);
  }

  // Register on namespace
  Object.assign(window.PlatePlanRouter, {
    isPlatePlanStateReady,
    guardViewTransition,
    isValidRoute
  });

  // Global bindings for legacy compat
  window.isPlatePlanStateReady = isPlatePlanStateReady;
})();
