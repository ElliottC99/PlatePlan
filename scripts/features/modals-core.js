/**
 * PlatePlan Modals Core
 */
window.PlatePlanModals = window.PlatePlanModals || {};
window.PlatePlanModals.ppEscapeHtml = window.ppEscapeHtml || (s => s);
window.PlatePlanModals.ppEscapeAttr = window.ppEscapeAttr || (s => s);
window.PlatePlanModals.getProductIndexRecipe = window.findRecipeByIdOrInstance || (() => null);

window.PlatePlanModals.State = {
  stack: [],
  backdrop: null,
  currentRecognisedRecipe: null,
  platePlanUseUpFinder: { meal: 'dinner', who: 'both', productIds: [], assign: null },
  platePlanChoiceAction: null,
  recipePhotoFiles: [],
  recipePhotoObjectUrls: [],
  platePlanLastMobileFocus: null
};

window.PlatePlanModals.loadState = function(stateData) {
  if (stateData && typeof stateData === 'object') {
    Object.assign(window.PlatePlanModals.State, stateData);
  }
};
window.loadState = window.PlatePlanModals.loadState;

// == ACTION SHEETS & DISPATCHERS ==
function openMobileActionSheet(title, actions) {
  const host = document.getElementById('mobile-action-sheet');
  if (!host) return;
  const titleId = 'mobile-action-sheet-title';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-labelledby', titleId);
  host.innerHTML = `
    <div class="mobile-sheet-handle"></div>
    <div class="row-between" style="align-items:center;margin-bottom:10px">
      <h3 id="${titleId}" style="margin:0">${window.PlatePlanModals.ppEscapeHtml(title || 'Actions')}</h3>
      <button class="btn sm ghost" onclick="closeMobileActionSheet()">Close</button>
    </div>
    <div style="display:grid;gap:6px">
      ${actions.map(action => `<button class="btn ${action.danger ? 'danger' : ''}" onclick="executeSheetAction(function(){ ${action.onclick}; })">${window.PlatePlanModals.ppEscapeHtml(action.label)}</button>`).join('')}
    </div>
  `;
  const wrap = document.getElementById('mobile-action-sheet-wrap');
  window.PlatePlanModals.State.platePlanLastMobileFocus = document.activeElement;
  wrap?.classList.add('open');
  if (typeof window.markMobileLayerForBack === 'function') {
    window.markMobileLayerForBack(wrap, 'actions');
  }
  setTimeout(() => host.querySelector('button')?.focus(), 0);
}
window.PlatePlanModals.openMobileActionSheet = openMobileActionSheet;

function closeMobileActionSheet() {
  const wrap = document.getElementById('mobile-action-sheet-wrap');
  wrap?.classList.remove('open');
}
window.PlatePlanModals.closeMobileActionSheet = closeMobileActionSheet;

function openRecipeActions(recipeId) {
  const recipe = window.PlatePlanModals.getProductIndexRecipe(recipeId) || (window.state?.recipes || []).find(r => r.id === recipeId);
  if (!recipe) return;
  const wrap = document.getElementById('mobile-action-sheet-wrap');
  const sheet = document.getElementById('mobile-action-sheet');
  if (!sheet) return;
  const titleId = 'mobile-action-sheet-title';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', titleId);
  sheet.innerHTML = `
    <div class="mobile-sheet-handle"></div>
    <div class="row-between" style="align-items:center;margin-bottom:10px">
      <h3 id="${titleId}" style="margin:0">${window.PlatePlanModals.ppEscapeHtml(recipe.name || 'Actions')}</h3>
      <button type="button" class="btn sm ghost" onclick="closeMobileActionSheet()">Close</button>
    </div>
    <div style="display:grid;gap:6px">
      <button type="button" class="btn" onclick="executeSheetAction('editRecipeModalView', '${window.PlatePlanModals.ppEscapeAttr(recipeId)}')">Review recipe</button>
      <button type="button" class="btn" onclick="executeSheetAction('downloadRecipeCard', '${window.PlatePlanModals.ppEscapeAttr(recipeId)}')">Recipe card</button>
      <button type="button" class="btn" onclick="executeSheetAction('duplicateRecipe', '${window.PlatePlanModals.ppEscapeAttr(recipeId)}')">Duplicate</button>
      <button type="button" class="btn" onclick="executeSheetAction('editRecipe', '${window.PlatePlanModals.ppEscapeAttr(recipeId)}')">Edit source recipe</button>
      <button type="button" class="btn danger" onclick="executeSheetAction('deleteRecipe', '${window.PlatePlanModals.ppEscapeAttr(recipeId)}')">Delete</button>
    </div>
  `;
  if (wrap) {
    wrap.classList.add('open');
    if (typeof window.markMobileLayerForBack === 'function') {
      window.markMobileLayerForBack(wrap, 'actions');
    }
  }
  setTimeout(() => sheet.querySelector('button')?.focus(), 0);
}
window.PlatePlanModals.openRecipeActions = openRecipeActions;

function openEnhancedRecipeActions(recipeId) {
  const recipe = window.PlatePlanModals.getProductIndexRecipe(recipeId) || (window.state?.recipes || []).find(r => r.id === recipeId);
  if (!recipe) return;
  const wrap = document.getElementById('mobile-action-sheet-wrap');
  const sheet = document.getElementById('mobile-action-sheet');
  if (!sheet) return;
  const titleId = 'mobile-action-sheet-title';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', titleId);
  const title = !recipe.enhanced ? (recipe.name || 'Actions') : `${recipe.name || 'Recipe'} · Enhanced`;
  sheet.innerHTML = `
    <div class="mobile-sheet-handle"></div>
    <div class="row-between" style="align-items:center;margin-bottom:10px">
      <h3 id="${titleId}" style="margin:0">${window.PlatePlanModals.ppEscapeHtml(title)}</h3>
      <button type="button" class="btn sm ghost" onclick="closeMobileActionSheet()">Close</button>
    </div>
    <div style="display:grid;gap:6px">
      ${!recipe.enhanced ? `
        <button type="button" class="btn" onclick="executeSheetAction('editEnhancedRecipe', '${window.PlatePlanModals.ppEscapeAttr(recipeId)}')">Create enhanced version</button>
        <button type="button" class="btn" onclick="executeSheetAction('editRecipeModalView', '${window.PlatePlanModals.ppEscapeAttr(recipeId)}')">Review recipe</button>
      ` : `
        <button type="button" class="btn" onclick="executeSheetAction('reviewEnhancedRecipe', '${window.PlatePlanModals.ppEscapeAttr(recipeId)}')">Review enhanced recipe</button>
        <button type="button" class="btn" onclick="executeSheetAction('downloadRecipeCard', '${window.PlatePlanModals.ppEscapeAttr(recipeId)}', 'enhanced')">Recipe card</button>
        <button type="button" class="btn" onclick="executeSheetAction('duplicateRecipe', '${window.PlatePlanModals.ppEscapeAttr(recipeId)}')">Duplicate complete recipe</button>
        <button type="button" class="btn" onclick="executeSheetAction('editEnhancedRecipe', '${window.PlatePlanModals.ppEscapeAttr(recipeId)}')">Edit enhanced recipe</button>
        <button type="button" class="btn danger" onclick="executeSheetAction('deleteEnhancedRecipe', '${window.PlatePlanModals.ppEscapeAttr(recipeId)}')">Delete enhanced version</button>
      `}
    </div>
  `;
  if (wrap) {
    wrap.classList.add('open');
    if (typeof window.markMobileLayerForBack === 'function') {
      window.markMobileLayerForBack(wrap, 'actions');
    }
  }
  setTimeout(() => sheet.querySelector('button')?.focus(), 0);
}
window.PlatePlanModals.openEnhancedRecipeActions = openEnhancedRecipeActions;
