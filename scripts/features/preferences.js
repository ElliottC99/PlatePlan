export default {
  render: async (context) => {
    if (typeof window.renderPrefs === 'function') await window.renderPrefs();
  }
};
