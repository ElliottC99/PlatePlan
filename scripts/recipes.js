/**
 * PlatePlan v3.3.5-mod - Recipes and Recipe Modal Engine
 */

window.viewRecipe = function(id, instanceId = null, tab = 'ingredients', servingMode = null) {
  const r = (window.state?.recipes || (typeof state !== 'undefined' ? state?.recipes : []) || []).find(x => x && x.id === id);
  if (!r) {
    console.error('[viewRecipe] Recipe not found:', id);
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
  }
  if (content) {
    content.style.setProperty('display', 'block', 'important');
    content.style.setProperty('visibility', 'visible', 'important');
    content.style.setProperty('opacity', '1', 'important');
  }
  document.body.classList.add('modal-open');
};

window.editRecipeModalView = function(id, initialTab = 'ingredients') {
  const r = (window.state?.recipes || (typeof state !== 'undefined' ? state?.recipes : []) || []).find(x => x && x.id === id);
  if (!r) {
    console.error('[editRecipeModalView] Recipe not found:', id);
    return;
  }
  if (typeof window.openModal === 'function') {
    window.openModal(r.name, r, false, { instanceId: null, tab: initialTab });
  } else if (typeof openModal === 'function') {
    openModal(r.name, r, false, { instanceId: null, tab: initialTab });
  }
};
