const FEATURE_LOADERS = Object.freeze({
  today: () => import('../features/today.js?v=2.3.7'),
  vault: () => import('../features/recipes.js?v=2.3.7'),
  add: () => import('../features/recipe-add.js?v=2.3.7'),
  ingredients: () => import('../features/ingredients.js?v=2.3.7'),
  bank: () => import('../features/products.js?v=2.3.7'),
  planner: () => import('../features/planner.js?v=2.3.7'),
  planlib: () => import('../features/library.js?v=2.3.7'),
  shopping: () => import('../features/shopping.js?v=2.3.7'),
  search: () => import('../features/search.js?v=2.3.7'),
  data: () => import('../features/data-quality.js?v=2.3.7'),
  prefs: () => import('../features/preferences.js?v=2.3.7'),
});

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
