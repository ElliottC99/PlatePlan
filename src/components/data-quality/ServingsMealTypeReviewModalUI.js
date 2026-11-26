/**
 * src/components/data-quality/ServingsMealTypeReviewModalUI.js
 * Guided Data Quality wizard to review and adjust suspicious recipe servings
 * and meal-type tags with live per-serving macro and Fit Score previews.
 */

import { getState } from '../../store/store.js';
import {
  MEAL_TYPE_OPTIONS,
  formatMealTypeLabel,
  scanServingsAndMealTypeMismatches,
  computeScaledRecipePreview,
  applyRecipeMetadataReview,
  markRecipeMetadataReviewed,
  resetReviewedRecipeMetadata
} from '../../services/DataQualityScanner.js';
import { showConfirm } from '../ui/DialogHelpers.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[ch]));

let reviewQueue = [];
let currentIndex = 0;
let draftServes = 2;
let draftMealTypes = ['dinner'];
let isBusy = false;

function getReviewedCount(state) {
  const map = state?.preferences?.reviewedRecipeMetadata || state?.userPrefs?.reviewedRecipeMetadata || {};
  return map && typeof map === 'object' ? Object.keys(map).length : 0;
}

function loadDraftFromCurrentItem() {
  const item = reviewQueue[currentIndex];
  if (!item) return;
  draftServes = item.suggestedServes || item.currentServes || 2;
  draftMealTypes = Array.isArray(item.suggestedMealTypes) && item.suggestedMealTypes.length > 0
    ? [...item.suggestedMealTypes]
    : [...item.currentMealTypes];
}

function refreshDataQualitySurface() {
  if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
  if (typeof window.updateDataQualityBadge === 'function') window.updateDataQualityBadge();
}

function ensureModalElement() {
  let modal = document.getElementById('dq-servings-mealtype-review-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dq-servings-mealtype-review-modal';
    document.body.appendChild(modal);
  }
  modal.className = 'modal active';
  modal.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;padding:16px;';
  return modal;
}

function renderLivePreviewHtml(item, state) {
  const preview = computeScaledRecipePreview(item.recipe, draftServes, draftMealTypes, {
    ingredients: state.rootItems || state.ingredients || [],
    products: state.products || [],
    preferences: state.preferences || state.userPrefs || {}
  });
  const fitDelta = preview.fitScore - item.currentFitScore;
  const deltaText = fitDelta > 0 ? `+${fitDelta}` : `${fitDelta}`;
  const deltaColor = fitDelta > 0 ? 'var(--green,#16a34a)' : (fitDelta < 0 ? 'var(--red,#dc2626)' : 'var(--text2,#78716c)');

  return `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px;">
      <div style="padding:12px; border-radius:10px; background:var(--surface2,#f5f5f4); border:1px solid var(--border,#e7e5e4);">
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--text2,#78716c); margin-bottom:4px;">Current</div>
        <div style="font-size:15px; font-weight:750; color:var(--text,#1c1917);">${item.currentMacros.cal} kcal <span style="font-size:12px; font-weight:600; color:var(--text2,#78716c);">· ${item.currentMacros.prot}g P</span></div>
        <div style="font-size:11.5px; color:var(--text2,#78716c); margin-top:3px;">
          ${item.currentServes} serving${item.currentServes === 1 ? '' : 's'} · ${item.currentMealTypes.map(formatMealTypeLabel).join(', ')}
        </div>
        <div style="font-size:12px; font-weight:700; margin-top:6px; color:var(--text,#1c1917);">Fit Score: ${item.currentFitScore}</div>
      </div>

      <div style="padding:12px; border-radius:10px; background:var(--surface,#fff); border:2px solid var(--primary,#4f46e5);">
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--primary,#4f46e5); margin-bottom:4px;">Live Preview</div>
        <div style="font-size:15px; font-weight:750; color:var(--text,#1c1917);">${preview.macros.cal} kcal <span style="font-size:12px; font-weight:600; color:var(--text2,#78716c);">· ${preview.macros.prot}g P</span></div>
        <div style="font-size:11.5px; color:var(--text2,#78716c); margin-top:3px;">
          ${preview.serves} serving${preview.serves === 1 ? '' : 's'} · ${preview.mealTypes.map(formatMealTypeLabel).join(', ')}
        </div>
        <div style="font-size:12px; font-weight:750; margin-top:6px; color:${preview.fitResult?.color || 'var(--text,#1c1917)'};">
          Fit Score: ${preview.fitScore} <span style="color:${deltaColor}; font-weight:700;">(${deltaText} pts)</span>
        </div>
      </div>
    </div>
  `;
}

function renderModalContent() {
  const modal = ensureModalElement();
  const state = getState();
  const reviewedCount = getReviewedCount(state);

  if (reviewQueue.length === 0) {
    modal.innerHTML = `
      <div class="card" style="width:100%; max-width:520px; padding:24px; border-radius:14px; background:var(--surface,#fff); box-shadow:0 12px 36px rgba(0,0,0,0.25); box-sizing:border-box;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px;">
          <div>
            <h2 style="font-size:18px; font-weight:750; margin:0; color:var(--text,#1c1917);">Servings &amp; Meal-Type Review</h2>
            <p style="font-size:12.5px; color:var(--text2,#78716c); margin:4px 0 0 0;">All flagged recipes have been reviewed.</p>
          </div>
          <button type="button" class="btn sm ghost" data-smr-action="close" aria-label="Close modal" style="padding:4px 8px; font-size:16px; line-height:1;">✕</button>
        </div>

        <div style="padding:18px; border-radius:10px; background:var(--surface2,#f5f5f4); border:1px solid var(--border,#e7e5e4); text-align:center; margin-bottom:18px;">
          <div style="font-size:28px; margin-bottom:6px;">✅</div>
          <div style="font-size:14px; font-weight:700; color:var(--text,#1c1917);">No unreviewed servings or meal-type mismatches</div>
          <div style="font-size:12px; color:var(--text2,#78716c); margin-top:4px;">
            ${reviewedCount > 0 ? `${reviewedCount} recipe decision${reviewedCount === 1 ? '' : 's'} remembered.` : 'Your recipe metadata looks consistent with household targets.'}
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
          ${reviewedCount > 0
            ? `<button type="button" class="btn sm ghost" data-smr-action="reset-reviewed" style="color:var(--text2,#78716c); font-weight:600;">↺ Reset Reviewed (${reviewedCount})</button>`
            : '<span></span>'}
          <button type="button" class="btn sm primary" data-smr-action="close" style="font-weight:700; background:var(--primary,#4f46e5); color:#fff;">Done</button>
        </div>
      </div>
    `;
    bindModalEvents(modal);
    return;
  }

  if (currentIndex >= reviewQueue.length) currentIndex = 0;
  const item = reviewQueue[currentIndex];
  const reasons = [
    item.hasServingsMismatch ? `<li><strong>Servings:</strong> ${escapeHtml(item.servingsReason)}</li>` : '',
    item.hasMealTypeMismatch ? `<li><strong>Meal Type:</strong> ${escapeHtml(item.mealTypeReason)}</li>` : ''
  ].filter(Boolean).join('');

  const mealPillsHtml = MEAL_TYPE_OPTIONS.map(opt => {
    const active = draftMealTypes.includes(opt.key);
    return `
      <button type="button" class="btn sm" data-smr-meal-type="${opt.key}"
        aria-pressed="${active ? 'true' : 'false'}"
        style="font-weight:700; border-radius:999px; padding:6px 12px; ${active
          ? 'background:var(--primary,#4f46e5); color:#fff; border:1px solid var(--primary,#4f46e5);'
          : 'background:var(--surface2,#f5f5f4); color:var(--text,#1c1917); border:1px solid var(--border,#e7e5e4);'}">
        ${escapeHtml(opt.label)}
      </button>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:600px; padding:22px; border-radius:14px; background:var(--surface,#fff); box-shadow:0 12px 36px rgba(0,0,0,0.25); display:flex; flex-direction:column; max-height:90vh; box-sizing:border-box;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px;">
        <div>
          <div style="font-size:11px; font-weight:750; text-transform:uppercase; letter-spacing:0.04em; color:var(--primary,#4f46e5);">
            Recipe ${currentIndex + 1} of ${reviewQueue.length}
          </div>
          <h2 style="font-size:18px; font-weight:800; margin:2px 0 0 0; color:var(--text,#1c1917);">${escapeHtml(item.recipeName)}</h2>
        </div>
        <button type="button" class="btn sm ghost" data-smr-action="close" aria-label="Close modal" style="padding:4px 8px; font-size:16px; line-height:1;">✕</button>
      </div>

      <div style="flex:1; overflow-y:auto; padding-right:2px;">
        <div style="padding:10px 12px; border-radius:10px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.35); margin-bottom:14px;">
          <div style="font-size:11.5px; font-weight:750; color:var(--amber,#b45309); margin-bottom:4px;">Why this recipe was flagged</div>
          <ul style="margin:0; padding-left:18px; font-size:12.5px; color:var(--text,#1c1917); line-height:1.45;">
            ${reasons}
          </ul>
        </div>

        <div style="display:grid; grid-template-columns:1fr; gap:14px;">
          <div>
            <label for="smr-serves-input" style="display:block; font-size:12px; font-weight:700; color:var(--text,#1c1917); margin-bottom:6px;">
              Servings (Current: ${item.currentServes}${item.hasServingsMismatch ? ` · Suggested: ${item.suggestedServes}` : ''})
            </label>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <button type="button" class="btn sm ghost" data-smr-action="serves-dec" aria-label="Decrease servings" style="min-width:34px; font-weight:800;">−</button>
              <input id="smr-serves-input" name="smr-serves-input" type="number" min="1" max="24" step="1" value="${draftServes}"
                style="width:76px; text-align:center; padding:6px 8px; border-radius:8px; border:1px solid var(--border,#e7e5e4); font-size:14px; font-weight:700; background:var(--surface,#fff); color:var(--text,#1c1917);" />
              <button type="button" class="btn sm ghost" data-smr-action="serves-inc" aria-label="Increase servings" style="min-width:34px; font-weight:800;">+</button>
              ${item.hasServingsMismatch && draftServes !== item.suggestedServes
                ? `<button type="button" class="btn sm ghost" data-smr-action="use-suggested-serves" style="font-size:11.5px; color:var(--primary,#4f46e5);">Use suggested (${item.suggestedServes})</button>`
                : ''}
            </div>
          </div>

          <div>
            <div style="font-size:12px; font-weight:700; color:var(--text,#1c1917); margin-bottom:6px;">
              Meal Types (Current: ${escapeHtml(item.currentMealTypes.map(formatMealTypeLabel).join(', '))})
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${mealPillsHtml}
            </div>
          </div>
        </div>

        <div id="smr-live-preview-container">
          ${renderLivePreviewHtml(item, state)}
        </div>
      </div>

      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-top:16px; padding-top:12px; border-top:1px solid var(--border,#e7e5e4);">
        <div style="display:flex; gap:6px; align-items:center;">
          ${reviewQueue.length > 1
            ? `<button type="button" class="btn sm ghost" data-smr-action="prev" ${currentIndex === 0 ? 'disabled' : ''}>← Prev</button>
               <button type="button" class="btn sm ghost" data-smr-action="next" ${currentIndex >= reviewQueue.length - 1 ? 'disabled' : ''}>Skip →</button>`
            : ''}
          ${reviewedCount > 0
            ? `<button type="button" class="btn sm ghost" data-smr-action="reset-reviewed" style="font-size:11.5px; color:var(--text2,#78716c);">↺ Reset Reviewed (${reviewedCount})</button>`
            : ''}
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <button type="button" class="btn sm secondary" data-smr-action="keep-remember" ${isBusy ? 'disabled' : ''} style="font-weight:650;">
            Keep Current &amp; Remember
          </button>
          <button type="button" class="btn sm primary" data-smr-action="apply-remember" ${isBusy ? 'disabled' : ''} style="font-weight:700; background:var(--primary,#4f46e5); color:#fff;">
            Apply &amp; Remember
          </button>
        </div>
      </div>
    </div>
  `;

  bindModalEvents(modal);
}

function updateLivePreviewOnly(modal) {
  const item = reviewQueue[currentIndex];
  const container = modal?.querySelector('#smr-live-preview-container');
  if (!item || !container) return;
  container.innerHTML = renderLivePreviewHtml(item, getState());
}

function bindModalEvents(modal) {
  const servesInput = modal.querySelector('#smr-serves-input');
  if (servesInput) {
    servesInput.oninput = () => {
      if (isBusy) return;
      const parsed = parseInt(servesInput.value, 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 24) {
        draftServes = parsed;
        updateLivePreviewOnly(modal);
      }
    };
    servesInput.onblur = () => {
      const parsed = parseInt(servesInput.value, 10);
      const clamped = Number.isFinite(parsed) ? Math.min(24, Math.max(1, parsed)) : draftServes;
      draftServes = clamped;
      servesInput.value = String(clamped);
      renderModalContent();
    };
  }

  modal.onclick = async (e) => {
    const actionBtn = e.target.closest('[data-smr-action]');
    const action = actionBtn?.dataset.smrAction;

    if (action === 'close') {
      closeServingsMealTypeReviewModal();
      return;
    }

    if (isBusy) return;

    const mealBtn = e.target.closest('[data-smr-meal-type]');
    if (mealBtn) {
      const key = mealBtn.dataset.smrMealType;
      if (draftMealTypes.includes(key)) {
        if (draftMealTypes.length > 1) {
          draftMealTypes = draftMealTypes.filter(t => t !== key);
        }
      } else {
        draftMealTypes = [...draftMealTypes, key];
      }
      renderModalContent();
      return;
    }

    if (!actionBtn) return;

    if (action === 'serves-dec') {
      draftServes = Math.max(1, draftServes - 1);
      renderModalContent();
      return;
    }
    if (action === 'serves-inc') {
      draftServes = Math.min(24, draftServes + 1);
      renderModalContent();
      return;
    }
    if (action === 'use-suggested-serves') {
      const item = reviewQueue[currentIndex];
      if (item) {
        draftServes = item.suggestedServes;
        renderModalContent();
      }
      return;
    }
    if (action === 'prev') {
      if (currentIndex > 0) {
        currentIndex--;
        loadDraftFromCurrentItem();
        renderModalContent();
      }
      return;
    }
    if (action === 'next') {
      if (currentIndex < reviewQueue.length - 1) {
        currentIndex++;
        loadDraftFromCurrentItem();
        renderModalContent();
      }
      return;
    }

    if (action === 'keep-remember') {
      const item = reviewQueue[currentIndex];
      if (!item) return;
      const targetId = String(item.recipeId);
      const targetName = item.recipeName;
      isBusy = true;
      renderModalContent();
      try {
        await markRecipeMetadataReviewed(targetId, {
          status: 'kept',
          serves: item.currentServes,
          mealTypes: item.currentMealTypes
        });
        reviewQueue = reviewQueue.filter(q => String(q.recipeId) !== targetId);
        if (currentIndex >= reviewQueue.length) currentIndex = Math.max(0, reviewQueue.length - 1);
        loadDraftFromCurrentItem();
        refreshDataQualitySurface();
        window.showPlatePlanToast?.(`Remembered current settings for "${targetName}".`, 'info');
      } catch (err) {
        console.error('[ServingsMealTypeReviewModalUI] keep-remember failed:', err);
        window.showPlatePlanToast?.('Failed to save review choice. Please try again.', 'error');
      } finally {
        isBusy = false;
        renderModalContent();
      }
      return;
    }

    if (action === 'apply-remember') {
      const item = reviewQueue[currentIndex];
      if (!item) return;
      const targetId = String(item.recipeId);
      const targetName = item.recipeName;
      const targetServes = draftServes;
      const targetMealTypes = [...draftMealTypes];
      isBusy = true;
      renderModalContent();
      try {
        await applyRecipeMetadataReview(targetId, {
          serves: targetServes,
          mealTypes: targetMealTypes
        });
        reviewQueue = reviewQueue.filter(q => String(q.recipeId) !== targetId);
        if (currentIndex >= reviewQueue.length) currentIndex = Math.max(0, reviewQueue.length - 1);
        loadDraftFromCurrentItem();
        refreshDataQualitySurface();
        window.showPlatePlanToast?.(`Updated "${targetName}" (${targetServes} servings · ${targetMealTypes.map(formatMealTypeLabel).join(', ')}).`, 'success');
      } catch (err) {
        console.error('[ServingsMealTypeReviewModalUI] apply-remember failed:', err);
        window.showPlatePlanToast?.('Failed to save recipe changes. Reverted.', 'error');
      } finally {
        isBusy = false;
        renderModalContent();
      }
      return;
    }

    if (action === 'reset-reviewed') {
      const confirmed = await showConfirm({
        title: 'Reset Reviewed Recipes?',
        message: 'This clears all remembered servings and meal-type review decisions so previously settled recipes can be checked again.',
        confirmLabel: 'Reset Reviewed',
        cancelLabel: 'Cancel'
      });
      if (!confirmed) return;
      isBusy = true;
      renderModalContent();
      try {
        await resetReviewedRecipeMetadata();
        reviewQueue = scanServingsAndMealTypeMismatches(getState());
        currentIndex = 0;
        loadDraftFromCurrentItem();
        refreshDataQualitySurface();
        window.showPlatePlanToast?.('Cleared remembered review decisions.', 'info');
      } catch (err) {
        console.error('[ServingsMealTypeReviewModalUI] reset-reviewed failed:', err);
        window.showPlatePlanToast?.('Failed to reset reviewed decisions. Please try again.', 'error');
      } finally {
        isBusy = false;
        renderModalContent();
      }
    }
  };
}

export function openServingsMealTypeReviewModal(initialRecipeId = null) {
  const state = getState();
  reviewQueue = scanServingsAndMealTypeMismatches(state);
  currentIndex = 0;
  if (initialRecipeId) {
    const idx = reviewQueue.findIndex(item => String(item.recipeId) === String(initialRecipeId));
    if (idx >= 0) currentIndex = idx;
  }
  loadDraftFromCurrentItem();
  renderModalContent();
}

export function closeServingsMealTypeReviewModal() {
  const modal = document.getElementById('dq-servings-mealtype-review-modal');
  if (modal) {
    modal.className = 'modal';
    modal.style.display = 'none';
  }
}

if (typeof window !== 'undefined') {
  window.openServingsMealTypeReviewModal = openServingsMealTypeReviewModal;
  window.closeServingsMealTypeReviewModal = closeServingsMealTypeReviewModal;
}
