export function createRecoveryService(legacy) {
  return Object.freeze({
    create: reason => legacy?.createRecoveryPoint?.(reason) || (typeof window.createRecoveryPoint === 'function' ? window.createRecoveryPoint(reason) : null),
    render: () => legacy?.renderRecoveryPanel?.() || (typeof window.renderRecoveryPanel === 'function' ? window.renderRecoveryPanel() : null),
  });
}
