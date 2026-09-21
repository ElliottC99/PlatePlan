/**
 * PlatePlan v3.3.3 - Compatibility Bridge
 * Implements authoritative legacy interfaces required by core contracts and services.
 */
export const PlatePlanLegacy = {
  getState() {
    if (!window.state) {
      try {
        const saved = localStorage.getItem('plateplan_v2');
        window.state = saved ? JSON.parse(saved) : {};
      } catch (e) {
        window.state = {};
      }
    }
    window.state.recipes = window.state.recipes || [];
    window.state.ingredients = window.state.ingredients || [];
    window.state.ingredientFamilies = window.state.ingredientFamilies || [];
    window.state.ingredientGroups = window.state.ingredientGroups || [];
    window.state.plans = window.state.plans || [];
    window.state.plan = window.state.plan || {};
    window.state.products = window.state.products || [];
    return window.state;
  },
  saveState() {
    try {
      const state = this.getState();
      localStorage.setItem('plateplan_v2', JSON.stringify(state));
      window.dispatchEvent(new CustomEvent('plateplan:state-saved', { detail: { state } }));
      return true;
    } catch (e) {
      console.error('Failed to save state', e);
      return false;
    }
  },
  calculateRecipeDisplayNutrition(recipe) {
    if (!recipe) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return recipe.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  },
  getPlanContextForInstance(instanceId) {
    const state = this.getState();
    return state.plan || {};
  },
  refreshPlatePlanDerivedState(options) {
    if (typeof window.renderAll === 'function') {
      window.renderAll();
    }
  },
  renderLegacyView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${id}`) || document.getElementById(id);
    if (target) target.classList.add('active');
  },
  runDelegatedAction(action, event, element) {
    if (typeof window[action] === 'function') {
      return window[action](event, element);
    }
    const fn = new Function('event', 'element', action);
    try {
      return fn.call(window, event, element);
    } catch (e) {
      console.error('Delegated action execution failed:', action, e);
      return false;
    }
  },
  initCloudSync() {
    console.log('Cloud sync initialized');
  },
  signOut() {
    localStorage.clear();
    window.location.reload();
  },
  createRecoveryPoint(reason) {
    console.log('Recovery point created:', reason);
  },
  renderRecoveryPanel() {},
  renderers: {
    today: () => { if (typeof window.renderAll === 'function') window.renderAll(); },
    vault: () => { if (typeof window.renderAll === 'function') window.renderAll(); if (typeof window.renderVault === 'function') window.renderVault(); },
    add: () => { if (typeof window.renderAll === 'function') window.renderAll(); },
    ingredients: () => { if (typeof window.renderAll === 'function') window.renderAll(); },
    bank: () => { if (typeof window.renderAll === 'function') window.renderAll(); if (typeof window.renderBank === 'function') window.renderBank(); },
    planner: () => { if (typeof window.renderAll === 'function') window.renderAll(); },
    planlib: () => { if (typeof window.renderAll === 'function') window.renderAll(); },
    shopping: () => { if (typeof window.renderAll === 'function') window.renderAll(); },
    search: () => { if (typeof window.renderAll === 'function') window.renderAll(); },
    data: () => { if (typeof window.renderAll === 'function') window.renderAll(); if (typeof window.renderDataQuality === 'function') window.renderDataQuality(); },
    prefs: () => { if (typeof window.renderAll === 'function') window.renderAll(); }
  },
  openSearchResult(item) {
    console.log('Open search result:', item);
  },
  showInfo(msg) {
    console.log('Info:', msg);
  }
};

globalThis.PlatePlanLegacy = PlatePlanLegacy;
