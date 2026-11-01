export function createRecoveryService(legacy) {
  return Object.freeze({
    create: reason => legacy.createRecoveryPoint?.(reason),
    render: () => legacy.renderRecoveryPanel?.(),
  });
}
