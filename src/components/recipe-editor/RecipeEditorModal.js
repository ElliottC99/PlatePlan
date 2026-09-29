/**
 * src/components/recipe-editor/RecipeEditorModal.js (v3.8.1)
 * Recipe editor modal lifecycle, tab switching, cost summaries,
 * protein efficiency analysis, and recalculation coordinator.
 */

import { renderModalIngredientsList } from './RecipeIngredientRow.js';
import { renderModalMethodList } from './RecipeStepRow.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export function switchModalTab(tab) {
  document.querySelectorAll('.mt2').forEach((t, i) => t.classList.toggle('active', ['original', 'enhanced', 'compare'][i] === tab));
  document.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
  document.getElementById('mtab-' + tab)?.classList.add('active');
}

export function closeModal(preserveEditorReturn = false) {
  document.getElementById('modal-wrap')?.classList.remove('open');
  window.currentReviewMealTypes = null;
  window.currentReviewWho = null;
  window.currentReviewServes = null;
  window.currentReviewInstanceId = null;
  window.currentReviewVariant = 'original';
  if (typeof window.hideReviewTooltip === 'function') window.hideReviewTooltip();
  if (typeof window.closeModalIngredientReplace === 'function') window.closeModalIngredientReplace();
  if (!preserveEditorReturn && typeof window.abandonEditorReturn === 'function') window.abandonEditorReturn();
}

export function renderReviewCostSummary(nutrition, portions) {
  const totalCost = +nutrition?.totalNutrition?.cost || 0;
  const perServingCost = +nutrition?.perServing?.cost || 0;
  const eCost = perServingCost * (+portions?.eSingleServ || 0);
  const cCost = perServingCost * (+portions?.cSingleServ || 0);
  if (!totalCost && !perServingCost) return '';
  return `<div class="card-inner" style="margin:10px 0 12px;padding:10px;background:var(--surface2)">
    <div style="font-weight:700;font-size:12px;margin-bottom:6px">Estimated recipe cost</div>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;font-size:12px">
      <div><span style="color:var(--text2)">Total</span><br><strong>£${totalCost.toFixed(2)}</strong></div>
      <div><span style="color:var(--text2)">Per serving</span><br><strong>£${perServingCost.toFixed(2)}</strong></div>
      <div><span style="color:var(--text2)">Elliott portion</span><br><strong>£${eCost ? eCost.toFixed(2) : '0.00'}</strong></div>
      <div><span style="color:var(--text2)">Chloe portion</span><br><strong>£${cCost ? cCost.toFixed(2) : '0.00'}</strong></div>
    </div>
  </div>`;
}

export function openModal(name, result, isFallback = false, options = {}) {
  const { instanceId = null, tab = 'original' } = options;
  const existing = window.editId ? (window.state?.recipes || []).find(x => x.id === window.editId) : null;
  const isTemporaryReview = !!instanceId;
  const o = result.original || existing || {};
  const e = result.enhanced || existing?.enhanced || {};
  const hasCreatedEnhanced = !!(result.enhanced || existing?.enhanced);

  window.currentReviewInstanceId = instanceId;
  window.currentReviewVariant = tab === 'enhanced' ? 'enhanced' : 'original';
  window.currentReviewMealTypes = o.types || result.types || (typeof window.getMealTypes === 'function' ? window.getMealTypes() : ['dinner']);
  window.currentReviewWho = o.who || result.who || (document.getElementById('r-who') ? document.getElementById('r-who').value : 'both');
  window.currentReviewServes = +o.serves || +result.serves || parseFloat(document.getElementById('r-serves')?.value) || 2;

  const infoEl = document.getElementById('review-info');
  if (infoEl) {
    infoEl.innerHTML = isTemporaryReview
      ? '<span class="tag" style="background:var(--purple-bg);color:var(--purple);margin-right:6px">Temporary meal-plan version</span>Shopping-list changes are shown for this planned meal only. The Recipe Vault recipe will not be overwritten.'
      : 'Nutrition calculated from mapped ingredient bank items. Edit mapped ingredients if anything looks wrong.';
  }

  const origNameEl = document.getElementById('orig-name');
  if (origNameEl) origNameEl.value = name || o.name || 'Untitled recipe';
  
  const origList = document.getElementById('orig-ings-list');
  if (origList) origList.innerHTML = renderModalIngredientsList('orig', o.ingredients || []);
  const origMethod = document.getElementById('orig-method-list');
  if (origMethod) origMethod.innerHTML = renderModalMethodList('orig', o.steps || o.method || []);
  if (typeof window.recalcModal === 'function') window.recalcModal('orig');

  const enhNameEl = document.getElementById('enh-name');
  if (enhNameEl) enhNameEl.value = e.name || (name ? name + ' (enhanced)' : 'Enhanced recipe');
  const enhChangesEl = document.getElementById('enh-changes');
  if (enhChangesEl) enhChangesEl.value = e.changes || '';
  
  const enhList = document.getElementById('enh-ings-list');
  if (enhList) enhList.innerHTML = renderModalIngredientsList('enh', e.ingredients || o.ingredients || []);
  const enhMethod = document.getElementById('enh-method-list');
  if (enhMethod) enhMethod.innerHTML = renderModalMethodList('enh', e.method || e.steps || o.steps || o.method || []);
  if (typeof window.recalcModal === 'function') window.recalcModal('enh');

  const tabBtnEnh = document.getElementById('tab-btn-enhanced');
  if (tabBtnEnh) tabBtnEnh.style.display = 'block';
  const tabBtnCmp = document.getElementById('tab-btn-compare');
  if (tabBtnCmp) tabBtnCmp.style.display = 'block';
  const saveBothBtn = document.getElementById('save-both-btn');
  if (saveBothBtn) saveBothBtn.style.display = isTemporaryReview ? 'none' : (hasCreatedEnhanced ? '' : 'none');
  const saveTempBtn = document.getElementById('save-temp-plan-btn');
  const saveOrigOnlyBtn = document.getElementById('save-orig-only-btn');
  if (saveTempBtn) saveTempBtn.style.display = isTemporaryReview ? '' : 'none';
  if (saveOrigOnlyBtn) saveOrigOnlyBtn.style.display = isTemporaryReview ? 'none' : '';
  
  if (typeof window.updateSaveBothVisibility === 'function') window.updateSaveBothVisibility();
  document.getElementById('modal-wrap')?.classList.add('open');
  if (typeof window.updateBatchUiBanners === 'function') window.updateBatchUiBanners();
  switchModalTab(window.currentReviewVariant === 'enhanced' && (result.enhanced || existing?.enhanced) ? 'enhanced' : 'original');
}
