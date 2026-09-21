export default {
  render: async (context) => {
    if (typeof window.renderIngredients === 'function') await window.renderIngredients();
  }
};
