/**
 * PlatePlan v3.3.7-mod - Recipes and Recipe Modal Engine
 */

window.findRecipeByIdOrInstance = function(targetId) {
  if (!targetId) return null;

  // 1. Check base recipe library
  const baseRecipes = window.state?.recipes || (typeof state !== 'undefined' ? state?.recipes : []) || [];
  let found = baseRecipes.find(r => r && (r.id === targetId || String(r.id) === String(targetId)));
  if (found) return found;

  // 2. Search active meal plan items (currentPlan / plan)
  const currentPlan = window.state?.currentPlan || window.state?.plan || (typeof state !== 'undefined' ? (state?.currentPlan || state?.plan) : {}) || {};
  const planDays = currentPlan.days || currentPlan.slots || currentPlan;
  if (typeof planDays === 'object' && planDays !== null) {
    for (const day in planDays) {
      const meals = Array.isArray(planDays[day]) ? planDays[day] : [];
      for (const meal of meals) {
        if (!meal) continue;
        if (meal.id === targetId || meal.instanceId === targetId || String(meal.id) === String(targetId) || String(meal.instanceId) === String(targetId)) {
          // Resolve base recipe by recipeId if available
          if (meal.recipeId) {
            const matchedBase = baseRecipes.find(r => r && (r.id === meal.recipeId || String(r.id) === String(meal.recipeId)));
            if (matchedBase) return { ...matchedBase, ...meal };
          }
          return meal;
        }
      }
    }
  }

  // 3. Search saved plan history
  const history = window.state?.planHistory || (typeof state !== 'undefined' ? state?.planHistory : []) || [];
  for (const plan of history) {
    if (!plan) continue;
    const days = plan.days || plan.plan || plan.slots || {};
    if (typeof days === 'object' && days !== null) {
      for (const day in days) {
        const meals = Array.isArray(days[day]) ? days[day] : [];
        for (const meal of meals) {
          if (!meal) continue;
          if (meal.id === targetId || meal.instanceId === targetId || String(meal.id) === String(targetId) || String(meal.instanceId) === String(targetId)) {
            if (meal.recipeId) {
              const matchedBase = baseRecipes.find(r => r && (r.id === meal.recipeId || String(r.id) === String(meal.recipeId)));
              if (matchedBase) return { ...matchedBase, ...meal };
            }
            return meal;
          }
        }
      }
    }
  }

  return null;
};

window.viewRecipe = function(id, instanceId = null, tab = 'ingredients', servingMode = null) {
  const r = (typeof window.findRecipeByIdOrInstance === 'function')
    ? window.findRecipeByIdOrInstance(id || instanceId)
    : (window.state?.recipes || (typeof state !== 'undefined' ? state?.recipes : []) || []).find(x => x && (x.id === id || x.id === instanceId));

  if (!r) {
    console.error('[viewRecipe] Recipe not found:', id, instanceId);
    return;
  }

  // Ensure modal wrap is attached to body
  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (wrap && wrap.parentElement && wrap.parentElement !== document.body && wrap.parentElement.id !== 'app-container') {
    document.body.appendChild(wrap);
  }

  const cloneFn = typeof window.clonePlatePlanValue === 'function'
    ? window.clonePlatePlanValue
    : (typeof clonePlatePlanValue === 'function' ? clonePlatePlanValue : (val => JSON.parse(JSON.stringify(val))));

  window.previewBaseRecipe = cloneFn(r);
  window.currentPreviewInstanceId = instanceId;
  window.currentViewTab = (tab === 'enhanced' && r.enhanced) ? 'enhanced' : (tab === 'original' ? 'original' : tab);
  window.currentPreviewServingMode = servingMode || 'both';
  window.currentPreviewSingleServes = 1;

  if (typeof window.renderRecipePreview === 'function') {
    window.renderRecipePreview(r.serves || 2);
  } else if (typeof renderRecipePreview === 'function') {
    renderRecipePreview(r.serves || 2);
  }

  if (wrap) {
    wrap.classList.add('open', 'active');
    wrap.style.setProperty('display', 'flex', 'important');
    wrap.style.setProperty('visibility', 'visible', 'important');
    wrap.style.setProperty('opacity', '1', 'important');
    wrap.style.setProperty('z-index', '99999', 'important');
    wrap.style.setProperty('overflow-y', 'auto', 'important');
  }
  if (content) {
    content.style.setProperty('display', 'block', 'important');
    content.style.setProperty('visibility', 'visible', 'important');
    content.style.setProperty('opacity', '1', 'important');
  }
  document.body.classList.add('modal-open');
};

window.editRecipeModalView = function(id, initialTab = 'ingredients') {
  const recipeData = (typeof window.findRecipeByIdOrInstance === 'function')
    ? window.findRecipeByIdOrInstance(id)
    : (window.state?.recipes || (typeof state !== 'undefined' ? state?.recipes : []) || []).find(x => x && x.id === id);

  if (!recipeData) {
    console.error('[editRecipeModalView] Failed to resolve recipe data for ID:', id);
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Recipe data could not be loaded', 'error');
    }
    return;
  }

  if (typeof window.openModal === 'function') {
    window.openModal(recipeData.name || 'Recipe Details', recipeData, false, { instanceId: id, tab: initialTab });
  } else if (typeof openModal === 'function') {
    openModal(recipeData.name || 'Recipe Details', recipeData, false, { instanceId: id, tab: initialTab });
  }
};
