export function createLegacyView(id) {
  return Object.freeze({
    id,
    install() {},
    render(context) {
      return context.legacy.renderLegacyView(id);
    },
  });
}
