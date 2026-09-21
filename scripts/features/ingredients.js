const renderIngredients = async () => {
  // Logic to render the ingredients
  console.log('Rendering ingredients');
};
window.renderIngredients = renderIngredients;

export { renderIngredients as renderIngredientBank };

export default {
  render: async (context) => {
    await renderIngredients();
  }
};
