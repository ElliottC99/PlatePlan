const FEATURE_LOADERS = Object.freeze({
  today: () => import('../features/today.js?v=21.3.1'),
  vault: () => import('../features/recipes.js?v=21.3.1'),
  ingredients: () => import('../features/ingredients.js?v=21.3.1'),
  bank: () => import('../features/products.js?v=21.3.1'),
  planner: () => import('../features/planner.js?v=21.3.1'),
  planlib: () => import('../features/library.js?v=21.3.1'),
  shopping: () => import('../features/shopping.js?v=21.3.1'),
  data: () => import('../features/data-quality.js?v=21.3.1'),
  prefs: () => import('../features/preferences.js?v=21.3.1'),
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
    if (!FEATURE_LOADERS[id]) throw new Error(`Unknown PlatePlan view: ${id}`);
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
      const feature = await loadFeature(id);
      return await feature.render(context);
    } catch (error) {
      console.error(`PlatePlan could not load ${id}`, error);
      context.legacy.renderLegacyView(id);
      context.legacy.showInfo?.(
        'A screen could not finish loading',
        'PlatePlan used its compatibility view instead. Your data has not been changed.'
      );
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
