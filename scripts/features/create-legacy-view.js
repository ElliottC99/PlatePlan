/**
 * Feature lifecycle used while domain renderers are progressively extracted
 * from the authoritative compatibility layer. Each feature owns activation,
 * dirty-state invalidation and render timing; hidden features never render in
 * response to state changes.
 */
export function createLegacyView(configuration) {
  const config = typeof configuration === 'string'
    ? { id: configuration }
    : configuration;
  const id = config.id;
  let context = null;
  let installed = false;
  let rendering = false;
  let renderAgain = false;

  const root = () => typeof document === 'undefined'
    ? null
    : document.getElementById(config.rootId || `view-${id}`);

  const markDirty = () => {
    const element = root();
    if (element) element.dataset.featureDirty = 'true';
  };

  const performRender = async () => {
    if (!context) return null;
    if (rendering) {
      renderAgain = true;
      return null;
    }
    rendering = true;
    const element = root();
    element?.setAttribute('aria-busy', 'true');
    try {
      await new Promise(resolve => {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(resolve);
        else resolve();
      });
      const renderer = context.legacy.renderers?.[id];
      if (typeof renderer !== 'function') {
        throw new Error(`PlatePlan feature ${id} has no registered renderer`);
      }
      const result = await renderer();
      if (element) delete element.dataset.featureDirty;
      config.afterRender?.(context, element);
      window.dispatchEvent(new CustomEvent('plateplan:feature-rendered', {
        detail: { id },
      }));
      return result;
    } finally {
      element?.removeAttribute('aria-busy');
      rendering = false;
      if (renderAgain) {
        renderAgain = false;
        performRender();
      }
    }
  };

  return Object.freeze({
    id,
    install(nextContext) {
      if (installed) return;
      installed = true;
      context = nextContext;
      config.install?.(context, root());
      context.store.subscribe(() => {
        markDirty();
        if (root()?.classList.contains('active')) performRender();
      });
    },
    render(nextContext) {
      context ||= nextContext;
      return performRender();
    },
    markDirty,
  });
}
