export default {
  render: async (context) => {
    if (typeof window.renderShopping === 'function') await window.renderShopping();
  }
};
