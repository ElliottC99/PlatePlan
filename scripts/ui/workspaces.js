export function createWorkspaceService() {
  return Object.freeze({
    active: () => document.querySelector('.modal-wrap.open,.mobile-action-sheet-wrap.open,.mobile-more-wrap.open'),
    closeActive: () => {
      const active = document.querySelector('.modal-wrap.open,.mobile-action-sheet-wrap.open,.mobile-more-wrap.open');
      active?.querySelector('[data-close],button[aria-label^="Close"]')?.click();
      return Boolean(active);
    },
  });
}
