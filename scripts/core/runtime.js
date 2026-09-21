['plateplan_plan_backup', 'plateplan_offline_backup', 'plateplan_history_v2', 'plateplan_v1'].forEach(key => {
  localStorage.removeItem(key);
});
console.log('[PlatePlan v3.0.9] Engine initialized. Legacy keys purged.');

const FEATURE_LOADERS = Object.freeze({
  today: () => import('../features/today.js?v=3.0.9'),
  vault: () => import('../features/recipes.js?v=3.0.9'),
  add: () => import('../features/recipe-add.js?v=3.0.9'),
  ingredients: () => import('../features/ingredients.js?v=3.0.9'),
  bank: () => import('../features/products.js?v=3.0.9'),
  planner: () => import('../features/planner.js?v=3.0.9'),
  planlib: () => import('../features/library.js?v=3.0.9'),
  shopping: () => import('../features/shopping.js?v=3.0.9'),
  search: () => import('../features/search.js?v=3.0.9'),
  data: () => import('../features/data-quality.js?v=3.0.9'),
  prefs: () => import('../features/preferences.js?v=3.0.9'),
});

// Scan localStorage keys and remove obsolete legacy keys on startup
try {
  const obsoleteKeys = ['app_version', 'data:chloe', 'data:elliott', 'plateplan_v1', 'plateplan_v1_chloe', 'plateplan_v1_elliott', 'plateplan_v1_device_id', 'plateplan_v1_recovery', 'plateplan_history_backup'];
  obsoleteKeys.forEach(key => {
    try {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
      }
    } catch (_err) {}
  });
} catch (_e) {}

/**
 * Native lazy feature runtime. Import promises are cached so each view module
 * is evaluated at most once per application session.
 */
export function createPlatePlanRuntime(context) {
  const loaded = new Map();
  const loading = new Map();

  const loadFeature = async id => {
    if (loaded.has(id)) return loaded.get(id);
    if (!FEATURE_LOADERS[id]) return null;
    if (!loading.has(id)) {
      loading.set(id, FEATURE_LOADERS[id]().then(module => {
        const feature = module.default || module.feature;
        if (!feature || typeof feature.render !== 'function') {
          throw new Error(`PlatePlan view module ${id} has no render function`);
        }
        feature.install?.(context);
        loaded.set(id, feature);
        loading.delete(id);
        window.dispatchEvent(new CustomEvent('plateplan:feature-loaded', { detail: { id } }));
        return feature;
      }));
    }
    return loading.get(id);
  };

  const renderView = async id => {
    try {
      if (!FEATURE_LOADERS[id]) {
        context.legacy.renderLegacyView(id);
        return null;
      }
      const feature = await loadFeature(id);
      if (feature) {
        return await feature.render(context);
      }
      context.legacy.renderLegacyView(id);
      return null;
    } catch (error) {
      console.error(`PlatePlan could not load ${id}`, error);
      context.legacy.renderLegacyView(id);
      return null;
    }
  };

  return Object.freeze({
    context,
    loadFeature,
    renderView,
    isLoaded: id => loaded.has(id),
    loadedViews: () => [...loaded.keys()],
  });
}
