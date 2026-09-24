/**
 * PlatePlan Recipes Actions (CRUD & Favorites)
 */
(function() {
  window.PlatePlanRecipes = window.PlatePlanRecipes || {};

  function favoriteRecipe(recipeId, variantKey = 'original') {
    const list = (window.ensureVariantFavoritingPrefs || (() => []))();
    const key = `${recipeId}_${variantKey}`;
    const idx = list.indexOf(key);
    if (idx > -1) {
      list.splice(idx, 1);
    } else {
      list.push(key);
    }
    if (typeof saveState === 'function') saveState(true);
    if (typeof renderVault === 'function') renderVault();
  }

  function deleteRecipe(recipeId) {
    const openConfirm = window.openAppConfirmModal || (() => {});
    const recipes = window.state?.recipes || [];
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    openConfirm(
      `Delete ${recipe.name}?`, 
      'This will permanently remove this recipe from your vault.', 
      'Delete recipe', 
      () => {
        const idx = recipes.findIndex(r => r.id === recipeId);
        if (idx > -1) {
          recipes.splice(idx, 1);
          if (typeof saveState === 'function') saveState(true);
          if (typeof showPlatePlanToast === 'function') showPlatePlanToast('Recipe deleted');
          if (typeof renderVault === 'function') renderVault();
        }
      }
    );
  }

  function duplicateRecipe(recipeId) {
    const recipes = window.state?.recipes || [];
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const newRecipe = JSON.parse(JSON.stringify(recipe));
    newRecipe.id = 'rec_' + Date.now();
    newRecipe.name = (newRecipe.name || 'Recipe') + ' (Copy)';
    newRecipe.createdAt = new Date().toISOString();
    
    recipes.push(newRecipe);
    if (typeof saveState === 'function') saveState(true);
    if (typeof showPlatePlanToast === 'function') showPlatePlanToast('Recipe duplicated');
    if (typeof renderVault === 'function') renderVault();
  }

  function editRecipe(recipeId) {
    window.showView('add');
    if (typeof window.loadRecipeIntoForm === 'function') {
      window.loadRecipeIntoForm(recipeId);
    }
  }

  function downloadRecipeCard(recipeId, mode = 'original') {
    if (typeof window.PlatePlanRecipeEditor?.downloadRecipeCard === 'function') {
      return window.PlatePlanRecipeEditor.downloadRecipeCard(recipeId, mode);
    }
    console.warn('[Recipes] Download recipe card not implemented in this module.');
  }

  Object.assign(window.PlatePlanRecipes, {
    favoriteRecipe,
    deleteRecipe,
    duplicateRecipe,
    editRecipe,
    downloadRecipeCard
  });

  window.favoriteRecipe = favoriteRecipe;
  window.deleteRecipe = deleteRecipe;
  window.duplicateRecipe = duplicateRecipe;
  window.editRecipe = editRecipe;
  window.downloadRecipeCard = downloadRecipeCard;
})();
