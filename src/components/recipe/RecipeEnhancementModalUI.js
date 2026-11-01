/**
 * src/components/recipe/RecipeEnhancementModalUI.js
 * Apple HIG compliant interactive sheet for reviewing and approving 85+ Fit Score recipe enhancements.
 */

import { getFitScoreTierMeta } from '../../utils/fitScoreWeights.js';
import { generateEnhancementPlan, buildEnhancedRecipePayload } from '../../services/RecipeEnhancementService.js';
import { calculateMealFitScore } from '../../utils/fitScoreCalculator.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

let currentPlan = null;
let currentOnApply = null;

function ensureEnhancementModalDOM() {
  let wrap = document.getElementById('enhancement-modal-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'enhancement-modal-wrap';
    wrap.className = 'modal-wrap';
    document.body.appendChild(wrap);
  }
  // Guarantee z-index is strictly above view-modal-wrap (25005)
  wrap.style.setProperty('position', 'fixed', 'important');
  wrap.style.setProperty('inset', '0', 'important');
  wrap.style.setProperty('z-index', '50000', 'important');
  wrap.style.setProperty('background', 'rgba(0, 0, 0, 0.65)', 'important');
  wrap.style.setProperty('backdrop-filter', 'blur(6px)', 'important');
  wrap.style.setProperty('-webkit-backdrop-filter', 'blur(6px)', 'important');
  wrap.style.setProperty('padding', '16px', 'important');
  wrap.style.setProperty('align-items', 'center', 'important');
  wrap.style.setProperty('justify-content', 'center', 'important');
  wrap.style.setProperty('display', 'none');
  return wrap;
}

export function closeEnhancementModal() {
  const wrap = document.getElementById('enhancement-modal-wrap');
  if (wrap) {
    wrap.style.setProperty('display', 'none', 'important');
    wrap.classList.remove('open');
    document.body.style.overflow = '';
  }
}

/**
 * Opens the Apple HIG compliant interactive enhancement review modal.
 */
export function openEnhancementModal(recipe, { onApply, options = {} } = {}) {
  if (!recipe) return;
  const wrap = ensureEnhancementModalDOM();
  currentOnApply = onApply;

  const plan = generateEnhancementPlan(recipe, options);
  if (!plan) {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Could not calculate recipe adjustments.');
    }
    return;
  }
  currentPlan = plan;

  renderEnhancementModalContent(wrap, plan);
  wrap.style.setProperty('display', 'flex', 'important');
  wrap.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderEnhancementModalContent(wrap, plan) {
  const beforeMeta = getFitScoreTierMeta(plan.beforeScore);
  const predMeta = getFitScoreTierMeta(plan.predictedScore);

  const deltaKcalTotal = plan.adjustments.reduce((acc, a) => acc + (a.deltaKcal || 0), 0);
  const deltaProtTotal = Math.round(plan.adjustments.reduce((acc, a) => acc + (a.deltaProt || 0), 0) * 10) / 10;

  const adjRowsHtml = plan.adjustments.map((adj, idx) => {
    const isLast = idx === plan.adjustments.length - 1;
    const borderStyle = isLast ? '' : 'border-bottom: 1px solid var(--border, rgba(120,120,128,0.18));';

    let tagHtml = '';
    if (adj.deltaProt && adj.deltaProt > 0) {
      tagHtml = `<span style="font-size:11px;font-weight:700;color:#16a34a;background:rgba(22,163,74,0.12);padding:2px 6px;border-radius:6px;white-space:nowrap;">+${adj.deltaProt}g prot</span>`;
    } else if (adj.deltaKcal && adj.deltaKcal < 0) {
      tagHtml = `<span style="font-size:11px;font-weight:700;color:#2563eb;background:rgba(37,99,235,0.12);padding:2px 6px;border-radius:6px;white-space:nowrap;">${adj.deltaKcal} kcal</span>`;
    }

    let taxonomyHtml = '';
    if (adj.type === 'swap' && adj.preTaxonomy && adj.postTaxonomy) {
      taxonomyHtml = `
        <div class="enh-taxonomy-box" style="margin-top:9px;background:var(--surface2, #fbfaf8);border:1px solid var(--border, rgba(120,120,128,0.18));border-radius:10px;padding:9px 12px;font-size:11.5px;line-height:1.4;">
          <!-- Pre-Swap -->
          <div style="display:flex;align-items:flex-start;gap:8px;">
            <span style="font-size:10px;font-weight:700;color:#ef4444;background:rgba(239,68,68,0.12);padding:1px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;margin-top:2px;">
              Pre-Swap
            </span>
            <div style="flex:1;min-width:0;">
              <div style="color:var(--text, #1c1917);word-break:break-word;">
                <span style="color:var(--text2, #78716c);font-size:11px;">Pantry:</span>
                <strong style="font-weight:600;">${escapeHtml(adj.preTaxonomy.category)}</strong>
                <span style="color:var(--text2, #78716c);margin:0 3px;">/</span>
                <strong style="font-weight:600;">${escapeHtml(adj.preTaxonomy.rootItem)}</strong>
                <span style="color:var(--text2, #78716c);margin:0 3px;">/</span>
                <span>${escapeHtml(adj.preTaxonomy.subtype)}</span>
              </div>
              <div style="color:var(--text2, #78716c);font-size:11px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                <span>Linked Product:</span>
                <span style="color:var(--text, #1c1917);font-weight:500;">${escapeHtml(adj.preTaxonomy.productName)}</span>
              </div>
            </div>
          </div>

          <div style="height:1px;background:var(--border, rgba(120,120,128,0.14));margin:7px 0;"></div>

          <!-- Post-Swap -->
          <div style="display:flex;align-items:flex-start;gap:8px;">
            <span style="font-size:10px;font-weight:700;color:#16a34a;background:rgba(22,163,74,0.14);padding:1px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;margin-top:2px;">
              Post-Swap
            </span>
            <div style="flex:1;min-width:0;">
              <div style="color:var(--text, #1c1917);word-break:break-word;">
                <span style="color:var(--text2, #78716c);font-size:11px;">Pantry:</span>
                <strong style="font-weight:600;color:#16a34a;">${escapeHtml(adj.postTaxonomy.category)}</strong>
                <span style="color:var(--text2, #78716c);margin:0 3px;">/</span>
                <strong style="font-weight:600;color:#16a34a;">${escapeHtml(adj.postTaxonomy.rootItem)}</strong>
                <span style="color:var(--text2, #78716c);margin:0 3px;">/</span>
                <span style="color:#16a34a;font-weight:600;">${escapeHtml(adj.postTaxonomy.subtype)}</span>
              </div>
              <div style="color:var(--text2, #78716c);font-size:11px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                <span>Linked Product:</span>
                <span style="color:var(--text, #1c1917);font-weight:600;">${escapeHtml(adj.postTaxonomy.productName)}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (adj.taxonomy) {
      taxonomyHtml = `
        <div class="enh-taxonomy-box" style="margin-top:8px;background:var(--surface2, #fbfaf8);border:1px solid var(--border, rgba(120,120,128,0.14));border-radius:8px;padding:6px 10px;font-size:11px;line-height:1.4;">
          <div style="color:var(--text, #1c1917);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            <span style="color:var(--text2, #78716c);">Pantry:</span>
            <strong style="font-weight:600;">${escapeHtml(adj.taxonomy.category)}</strong>
            <span style="color:var(--text2, #78716c);margin:0 3px;">/</span>
            <strong style="font-weight:600;">${escapeHtml(adj.taxonomy.rootItem)}</strong>
            <span style="color:var(--text2, #78716c);margin:0 3px;">/</span>
            <span>${escapeHtml(adj.taxonomy.subtype)}</span>
          </div>
          <div style="color:var(--text2, #78716c);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            <span>Linked Product:</span>
            <span style="color:var(--text, #1c1917);font-weight:500;">${escapeHtml(adj.taxonomy.productName)}</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="enh-adj-row" style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:var(--surface,#fff);${borderStyle}">
        <input 
          type="checkbox" 
          class="enh-adj-cb" 
          data-adj-id="${escapeHtml(adj.id)}" 
          checked 
          style="width:20px!important;height:20px!important;min-width:20px!important;max-width:20px!important;min-height:20px!important;max-height:20px!important;flex:0 0 20px!important;margin:2px 0 0 0!important;padding:0!important;border-radius:6px;cursor:pointer;accent-color:var(--action,#007aff);"
        />
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
            <div style="font-weight:600;font-size:13.5px;color:var(--text,#1c1917);line-height:1.35;word-break:break-word;">
              ${escapeHtml(adj.label)}
            </div>
            ${tagHtml ? `<div style="flex:0 0 auto;">${tagHtml}</div>` : ''}
          </div>
          <div style="font-size:12px;color:var(--text2,#78716c);margin-top:2px;line-height:1.35;">
            ${escapeHtml(adj.detail)}
          </div>
          ${taxonomyHtml}
        </div>
      </div>
    `;
  }).join('');

  wrap.innerHTML = `
    <div class="modal enhancement-modal-sheet" style="
      background: var(--surface, #ffffff);
      border-radius: 20px;
      max-width: 540px;
      width: 100%;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border, rgba(120, 120, 128, 0.2));
      overflow: hidden;
      animation: ppPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    ">
      
      <!-- Apple HIG Header -->
      <div style="
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--border, rgba(120, 120, 128, 0.18));
        background: var(--surface2, #fbfaf8);
      ">
        <div style="min-width: 0; flex: 1;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--action, #007aff); margin-bottom: 2px;">
            Nutritional Optimizer
          </div>
          <h3 style="margin: 0; font-size: 17px; font-weight: 700; color: var(--text, #1c1917); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(plan.recipeTitle)}
          </h3>
        </div>
        <button type="button" id="btn-close-enh-modal" aria-label="Close" style="
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: none;
          background: var(--border, rgba(120, 120, 128, 0.15));
          color: var(--text2, #78716c);
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 12px;
          transition: background 0.15s ease;
        ">&times;</button>
      </div>

      <!-- Scrollable Body -->
      <div style="
        padding: 20px;
        overflow-y: auto;
        flex: 1;
        -webkit-overflow-scrolling: touch;
      ">
        
        <!-- Apple Health Style Hero Card -->
        <div style="
          background: var(--surface2, #f5f4f0);
          border: 1px solid var(--border, rgba(120, 120, 128, 0.18));
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 20px;
        ">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <div>
              <div style="font-size: 11px; font-weight: 600; color: var(--text2, #78716c); margin-bottom: 3px;">Current Match</div>
              <span class="badge ${beforeMeta.tier}" style="background:${beforeMeta.bg};color:${beforeMeta.text};border:1px solid ${beforeMeta.border};font-weight:700;padding:3px 8px;border-radius:6px;font-size:12px;">
                ${beforeMeta.icon} ${plan.beforeScore}%
              </span>
            </div>
            
            <div style="font-size: 18px; font-weight: 700; color: var(--text3, #a8a29e);">➔</div>

            <div style="text-align: right;">
              <div style="font-size: 11px; font-weight: 600; color: var(--text2, #78716c); margin-bottom: 3px;">Enhanced Goal</div>
              <span id="enh-pred-badge" class="badge ${predMeta.tier}" style="background:${predMeta.bg};color:${predMeta.text};border:1px solid ${predMeta.border};font-weight:700;padding:3px 8px;border-radius:6px;font-size:12px;">
                ${predMeta.icon} <span id="enh-pred-score">${plan.predictedScore}</span>% - ${predMeta.label}
              </span>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border, rgba(120, 120, 128, 0.12)); padding-top: 8px; font-size: 12px; color: var(--text2, #78716c);">
            <span>Household Target Impact:</span>
            <span id="enh-impact-text" style="font-weight: 650; color: var(--text, #1c1917);">
              ${deltaKcalTotal !== 0 ? `🔥 ${deltaKcalTotal > 0 ? '+' : ''}${deltaKcalTotal} kcal ` : ''}
              ${deltaProtTotal !== 0 ? `💪 ${deltaProtTotal > 0 ? '+' : ''}${deltaProtTotal}g protein` : ''}
            </span>
          </div>
        </div>

        <!-- Inset Grouped Adjustments List -->
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text2, #78716c); margin-bottom: 8px; padding-left: 2px;">
          Recommended Adjustments
        </div>

        <div id="enh-adj-list" style="
          border: 1px solid var(--border, rgba(120, 120, 128, 0.2));
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 16px;
          background: var(--surface, #ffffff);
        ">
          ${adjRowsHtml || '<div style="padding:16px;text-align:center;font-size:13px;color:var(--text2);">Recipe already meets 85%+ Fit Score targets!</div>'}
        </div>

        <!-- Serving Note Callout -->
        ${plan.proposedServings !== plan.originalServings ? `
          <div style="background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.2); border-radius: 12px; padding: 10px 14px; font-size: 12.5px; color: #2563eb; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <span>ℹ️</span>
            <div><strong>Servings rebalanced:</strong> Adjusted from ${plan.originalServings} to ${plan.proposedServings} portions to bring batch calories into ideal ranges.</div>
          </div>
        ` : ''}

        <!-- Apple HIG Footnote -->
        <div style="font-size: 12px; color: var(--text3, #a8a29e); line-height: 1.45; text-align: center; padding: 0 8px;">
          🔒 Your original recipe remains 100% untouched. These adjustments will be saved exclusively to the <strong>Enhanced variant</strong>.
        </div>
      </div>

      <!-- Apple HIG Actions Footer -->
      <div style="
        padding: 14px 20px;
        border-top: 1px solid var(--border, rgba(120, 120, 128, 0.18));
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        background: var(--surface2, #fbfaf8);
      ">
        <button type="button" class="btn secondary" id="btn-cancel-enh" style="
          padding: 8px 16px;
          font-size: 13.5px;
          font-weight: 600;
          border-radius: 10px;
          border: 1px solid var(--border, #ccc);
          background: var(--surface, #fff);
          color: var(--text, #1c1917);
          cursor: pointer;
        ">
          Cancel
        </button>
        <button type="button" class="btn primary" id="btn-apply-enh" style="
          padding: 8px 18px;
          font-size: 13.5px;
          font-weight: 650;
          border-radius: 10px;
          background: var(--action, #007aff);
          border: 1px solid #0062cc;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(0, 122, 255, 0.25);
          cursor: pointer;
        ">
          Accept & Apply Enhanced Variant
        </button>
      </div>

    </div>
  `;

  // Wire Close & Cancel
  const btnClose = wrap.querySelector('#btn-close-enh-modal');
  if (btnClose) btnClose.onclick = closeEnhancementModal;
  const btnCancel = wrap.querySelector('#btn-cancel-enh');
  if (btnCancel) btnCancel.onclick = closeEnhancementModal;

  // Wire Checkboxes live re-scoring
  const checkboxes = wrap.querySelectorAll('.enh-adj-cb');
  checkboxes.forEach(cb => {
    cb.onchange = () => {
      const adjId = cb.getAttribute('data-adj-id');
      const targetAdj = plan.adjustments.find(a => a.id === adjId);
      if (targetAdj) {
        targetAdj.active = cb.checked;
      }
      recomputeModalPredictedScore(wrap, plan);
    };
  });

  // Wire Apply Button
  const btnApply = wrap.querySelector('#btn-apply-enh');
  if (btnApply) {
    btnApply.onclick = () => {
      closeEnhancementModal();
      if (typeof currentOnApply === 'function') {
        currentOnApply(plan.enhancedRecipePayload);
      }
    };
  }
}

function recomputeModalPredictedScore(wrap, plan) {
  const targetMeal = plan.targets?.mealType || 'dinner';
  const activeAdjs = plan.adjustments.filter(a => a.active);
  const deltaKcalTotal = activeAdjs.reduce((acc, a) => acc + (a.deltaKcal || 0), 0);
  const deltaProtTotal = Math.round(activeAdjs.reduce((acc, a) => acc + (a.deltaProt || 0), 0) * 10) / 10;

  const baseKcal = plan.enhancedRecipePayload?.nutrition?.perServing?.cal || plan.targets?.targetKcal || 650;
  const baseProt = plan.enhancedRecipePayload?.nutrition?.perServing?.prot || plan.targets?.targetProt || 42;

  const simulated = {
    ...plan.enhancedRecipePayload,
    perServing: {
      cal: baseKcal,
      prot: baseProt,
      calories: baseKcal,
      protein: baseProt
    }
  };

  const simFit = calculateMealFitScore(simulated, targetMeal, { variant: 'enhanced' });
  const newScore = Math.max(plan.beforeScore, Math.round(Number(simFit?.score) || plan.beforeScore));
  const newMeta = getFitScoreTierMeta(newScore);

  const badgeElem = wrap.querySelector('#enh-pred-badge');
  const scoreElem = wrap.querySelector('#enh-pred-score');
  if (badgeElem && scoreElem) {
    scoreElem.textContent = newScore;
    badgeElem.className = `badge ${newMeta.tier}`;
    badgeElem.style.background = newMeta.bg;
    badgeElem.style.color = newMeta.text;
    badgeElem.style.borderColor = newMeta.border;
  }

  const impactElem = wrap.querySelector('#enh-impact-text');
  if (impactElem) {
    const parts = [];
    if (deltaKcalTotal !== 0) parts.push(`🔥 ${deltaKcalTotal > 0 ? '+' : ''}${deltaKcalTotal} kcal`);
    if (deltaProtTotal !== 0) parts.push(`💪 ${deltaProtTotal > 0 ? '+' : ''}${deltaProtTotal}g protein`);
    impactElem.textContent = parts.join('   ') || 'Optimal match reached';
  }
}

if (typeof window !== 'undefined') {
  window.openEnhancementModal = openEnhancementModal;
  window.closeEnhancementModal = closeEnhancementModal;
}
