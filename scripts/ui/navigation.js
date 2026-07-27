export function installNavigation(runtime) {
  const requestView = event => {
    const id = event.detail?.id;
    if (id) runtime.renderView(id);
  };
  window.addEventListener('plateplan:view-requested', requestView);
  return () => window.removeEventListener('plateplan:view-requested', requestView);
}
