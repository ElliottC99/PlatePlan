export default {
  render: async (context) => {
    if (typeof window.renderAdd === 'function') await window.renderAdd();
  }
};
