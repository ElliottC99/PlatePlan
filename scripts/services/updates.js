export function createUpdateService(legacy) {
  return Object.freeze({
    register: () => legacy.registerServiceWorker?.(),
    apply: () => legacy.applyUpdate?.(),
  });
}
