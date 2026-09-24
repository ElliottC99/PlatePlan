/**
 * PlatePlan Recipes Core (Filtering & Logic)
 */
(function() {
  window.PlatePlanRecipes = window.PlatePlanRecipes || {};
  window.PlatePlanRecipes.State = window.PlatePlanRecipes.State || {
    vaultFavOnly: false,
    activeFilterType: 'all',
    activeFilterWho: 'all',
    searchQuery: '',
    activeSort: 'name'
  };

  const RecipesState = window.PlatePlanRecipes.State;

  function getRecipesState() {
    return { ...RecipesState };
  }

  function getFilteredRecipes(allRecipes) {
    const isFavOnly = RecipesState.vaultFavOnly;
    const ft = RecipesState.activeFilterType;
    const fw = RecipesState.activeFilterWho;
    const q = (RecipesState.searchQuery || '').toLowerCase().trim();
    
    const isFavFn = window.isRecipeVariantFavourite || window.PlatePlanVault?.isRecipeVariantFavourite || (() => false);
    const ingRawFn = window.ingRaw || window.PlatePlanVault?.ingRaw || (i => String(i || ''));

    return (allRecipes || []).filter(r => {
      if (!r) return false;
      if (isFavOnly) {
        const isFav = !!(r.isFavorite || r.isFavourite || isFavFn(r.id, 'original') || isFavFn(r.id, 'enhanced'));
        if (!isFav) return false;
      }
      const types = r.types || [r.type || 'dinner'];
      const searchable = [
        r.name, 
        r.source, 
        r.who, 
        ...(types || []), 
        ...(r.ingredients || []).map(ing => ingRawFn(ing))
      ].join(' ').toLowerCase();
      
      const typeMatch = (ft === 'all' || types.includes(ft));
      const whoMatch = (fw === 'all' || r.who === fw);
      const queryMatch = (!q || searchable.includes(q));
      
      return typeMatch && whoMatch && queryMatch;
    });
  }

  function getSortedRecipes(recipes, sortKey = 'name', mealType = 'dinner') {
    const sorted = [...(recipes || [])];
    const getFit = (r) => {
      if (!window.calculateRecipeDisplayNutrition) return 0;
      const bundle = window.calculateRecipeDisplayNutrition({ recipe: r, variant: 'original', mealType });
      const targets = (window.getBudgets || (() => ({cal:2400, prot:130})))('e', mealType);
      const score = (window.computeProfileFitScore || (() => 0))(bundle?.portions?.eCal, targets.cal, bundle?.portions?.eProt, targets.prot);
      return score;
    };

    sorted.sort((a, b) => {
      if (sortKey === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortKey === 'fit') return getFit(b) - getFit(a);
      if (sortKey === 'newest') return (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0));
      return 0;
    });
    return sorted;
  }

  function calculateVaultTargetMacros(prefs, mealType = 'dinner') {
    const getB = window.getBudgets || (() => ({ cal: 0, prot: 0 }));
    return {
      e: getB('e', mealType, prefs),
      c: getB('c', mealType, prefs)
    };
  }

  Object.assign(window.PlatePlanRecipes, {
    getRecipesState,
    getFilteredRecipes,
    getSortedRecipes,
    calculateVaultTargetMacros
  });

  window.getRecipesState = getRecipesState;
  window.getSortedRecipes = getSortedRecipes;
  window.calculateVaultTargetMacros = calculateVaultTargetMacros;
})();
