const renderPreferences = async () => {
  // Logic to render preferences
  console.log('Rendering preferences');
};
window.renderPreferences = renderPreferences;

export { renderPreferences };

export default {
  render: async (context) => {
    await renderPreferences();
  }
};
