/**
 * src/components/recipe/RecipeEnhancementModalUI.js
 * Apple HIG compliant interactive sheet for reviewing and approving 85+ Fit Score recipe enhancements.
 */

import { getFitScoreTierMeta } from '../../utils/fitScoreWeights.js';
import { 
  generateEnhancementPlan, 
  buildEnhancedRecipePayload,
  cloneAndTraverseIngredients,
  calculateBatchMacros
} from '../../services/RecipeEnhancementService.js';
import { calculateMealFitScore } from '../../utils/fitScoreCalculator.js';
import { saveHouseholdSwapPreference } from '../../services/HouseholdRepository.js';
import { getState } from '../../store/store.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

let currentPlan = null;
let currentOnApply = null;
let currentSelectedRouteId = null;

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
 * Dynamically synthesizes the live enhanced recipe from strictly active user adjustments.
 */
export function buildLiveEnhancedRecipe(route, originalRecipe) {
  const orig = originalRecipe || currentPlan?.originalRecipe || route?.originalRecipe;
  if (!orig) return null;

  // Filter ONLY active adjustments (guarantees unchecked adjustments are excluded)
  const activeAdjs = (route.adjustments || []).filter(a => a.active !== false);

  // Deep clone original ingredients
  const { ingredients } = cloneAndTraverseIngredients(orig, i => ({ ...i }));
  let workingIngredients = JSON.parse(JSON.stringify(ingredients));

  // Determine servings
  const yieldAdj = activeAdjs.find(a => a.type === 'yield');
  const serves = yieldAdj 
    ? (Number(route.proposedServings) || Number(orig.servings || orig.serves || 2) || 2)
    : (Number(orig.servings || orig.serves || 2) || 2);

  // Apply active quantity adjustments
  activeAdjs.filter(a => a.type === 'quantity').forEach(qAdj => {
    const targetName = String(qAdj.ingredientName || '').toLowerCase().trim();
    const item = workingIngredients.find(i => String(i.name || '').toLowerCase().trim() === targetName);
    if (item) {
      item.qty = Number(qAdj.proposedQty) || item.qty;
      item.amount = item.qty;
      if (qAdj.unit) item.unit = qAdj.unit;
    }
  });

  // Apply active swaps
  activeAdjs.filter(a => a.type === 'swap').forEach(sAdj => {
    const targetName = String(sAdj.ingredientName || '').toLowerCase().trim();
    const item = workingIngredients.find(i => String(i.name || '').toLowerCase().trim() === targetName);
    if (item) {
      item.name = sAdj.swapTo;
      if (sAdj.postTaxonomy) {
        if (sAdj.postTaxonomy.productId) item.productId = sAdj.postTaxonomy.productId;
        if (sAdj.postTaxonomy.productName) item.productName = sAdj.postTaxonomy.productName;
        if (sAdj.postTaxonomy.ingredientId) item.ingredientId = sAdj.postTaxonomy.ingredientId;
        if (sAdj.postTaxonomy.subtypeId) item.subtypeId = sAdj.postTaxonomy.subtypeId;
        if (sAdj.postTaxonomy.subtype) item.subtypeName = sAdj.postTaxonomy.subtype;
        if (sAdj.postTaxonomy.category) item.category = sAdj.postTaxonomy.category;
      }
    }
  });

  // Also handle inline swap selectors if an adjustment has selectedSwap
  activeAdjs.filter(a => a.selectedSwap).forEach(sAdj => {
    const targetName = String(sAdj.ingredientName || '').toLowerCase().trim();
    const item = workingIngredients.find(i => String(i.name || '').toLowerCase().trim() === targetName);
    if (item && sAdj.selectedSwap) {
      item.name = sAdj.selectedSwap.productName || sAdj.selectedSwap.subtype || item.name;
      if (sAdj.postTaxonomy) {
        if (sAdj.postTaxonomy.productId) item.productId = sAdj.postTaxonomy.productId;
        if (sAdj.postTaxonomy.productName) item.productName = sAdj.postTaxonomy.productName;
        if (sAdj.postTaxonomy.ingredientId) item.ingredientId = sAdj.postTaxonomy.ingredientId;
        if (sAdj.postTaxonomy.subtypeId) item.subtypeId = sAdj.postTaxonomy.subtypeId;
        if (sAdj.postTaxonomy.subtype) item.subtypeName = sAdj.postTaxonomy.subtype;
        if (sAdj.postTaxonomy.category) item.category = sAdj.postTaxonomy.category;
      }
    }
  });

  // Calculate true batch macros
  const state = (typeof getState === 'function' ? getState() : (typeof window !== 'undefined' && window.getState ? window.getState() : {})) || {};
  const products = state.products || [];
  const allIngs = state.rootItems || state.ingredients || [];
  const macros = calculateBatchMacros(workingIngredients, serves, { products, allIngredients: allIngs });

  // Build the enhanced recipe payload using canonical helper
  const livePayload = buildEnhancedRecipePayload(orig, workingIngredients, serves, activeAdjs, macros);

  // Calculate live fit score
  const targetMeal = route.targets?.mealType || orig.mealSuitability?.[0] || orig.types?.[0] || orig.type || 'dinner';
  const liveFit = calculateMealFitScore(livePayload, targetMeal, { variant: 'enhanced' });
  const liveScore = Math.round(Number(liveFit?.score) || 0);

  // Compute delta against original recipe baseline
  const origKcal = Math.round(Number(orig.macros?.calories || orig.calories || orig.nutrition?.cal || 0));
  const origProt = Math.round(Number(orig.macros?.protein || orig.protein || orig.nutrition?.prot || 0) * 10) / 10;
  const deltaKcalTotal = origKcal > 0 ? (macros.perServing.calories - origKcal) : activeAdjs.reduce((acc, a) => acc + (a.deltaKcal || 0) + (a.swapDeltaKcal || 0), 0);
  const deltaProtTotal = origProt > 0 ? Math.round((macros.perServing.protein - origProt) * 10) / 10 : Math.round(activeAdjs.reduce((acc, a) => acc + (a.deltaProt || 0) + (a.swapDeltaProt || 0), 0) * 10) / 10;

  return {
    livePayload,
    liveScore,
    liveFit,
    liveMacros: macros.perServing,
    servings: serves,
    activeAdjs,
    deltaKcalTotal,
    deltaProtTotal
  };
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
  currentSelectedRouteId = plan.selectedRouteId || (plan.routes && plan.routes.length > 0 ? plan.routes[0].id : null);

  renderEnhancementModalContent(wrap, plan);
  wrap.style.setProperty('display', 'flex', 'important');
  wrap.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderEnhancementModalContent(wrap, plan) {
  const activeRoute = (plan.routes && plan.routes.find(r => r.id === currentSelectedRouteId)) || plan.routes?.[0] || plan;
  const liveData = buildLiveEnhancedRecipe(activeRoute, plan.originalRecipe);
  const beforeMeta = getFitScoreTierMeta(activeRoute.beforeScore ?? plan.beforeScore);
  const currentPredScore = liveData ? liveData.liveScore : (activeRoute.predictedScore ?? plan.predictedScore);
  const predMeta = getFitScoreTierMeta(currentPredScore);

  const activeAdjs = activeRoute.adjustments || [];

  let routeNavHtml = '';
  if (plan.routes && plan.routes.length > 1) {
    routeNavHtml = `
      <div class="enh-route-nav" role="tablist" style="
        display: flex;
        background: var(--surface2, #f0eee9);
        padding: 4px;
        border-radius: 12px;
        margin-bottom: 16px;
        gap: 6px;
      ">
        ${plan.routes.map(r => {
          const isSelected = r.id === activeRoute.id;
          return `
            <button type="button" class="enh-route-tab" data-route-id="${escapeHtml(r.id)}" role="tab" aria-selected="${isSelected ? 'true' : 'false'}" style="
              flex: 1;
              padding: 8px 12px;
              font-size: 12.5px;
              font-weight: ${isSelected ? '700' : '500'};
              border: none;
              border-radius: 9px;
              background: ${isSelected ? 'var(--surface, #ffffff)' : 'transparent'};
              color: ${isSelected ? 'var(--text, #1c1917)' : 'var(--text2, #78716c)'};
              box-shadow: ${isSelected ? '0 2px 6px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)' : 'none'};
              cursor: pointer;
              transition: all 0.15s ease;
              white-space: nowrap;
              text-align: center;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
            ">
              <span>${escapeHtml(r.badge)}</span>
              <span style="font-weight:700;color:${isSelected ? 'var(--action, #007aff)' : 'inherit'};">${escapeHtml(r.predictedScore)}%</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  const adjRowsHtml = activeAdjs.map((adj, idx) => {
    const isLast = idx === activeAdjs.length - 1;
    const borderStyle = isLast ? '' : 'border-bottom: 1px solid var(--border, rgba(120,120,128,0.18));';

    let tagHtml = '';
    const totalProt = Math.round(((adj.deltaProt || 0) + (adj.swapDeltaProt || 0)) * 10) / 10;
    const totalKcal = (adj.deltaKcal || 0) + (adj.swapDeltaKcal || 0);
    if (totalProt > 0) {
      tagHtml = `<span style="font-size:11px;font-weight:700;color:#16a34a;background:rgba(22,163,74,0.12);padding:2px 6px;border-radius:6px;white-space:nowrap;">+${totalProt}g prot</span>`;
    } else if (totalKcal < 0) {
      tagHtml = `<span style="font-size:11px;font-weight:700;color:#2563eb;background:rgba(37,99,235,0.12);padding:2px 6px;border-radius:6px;white-space:nowrap;">${totalKcal} kcal</span>`;
    }

    let volumeStepperHtml = '';
    if (adj.type === 'quantity' && adj.proposedQty !== undefined) {
      const stepUnit = String(adj.unit || 'g').toLowerCase();
      const stepVal = (stepUnit === 'ml' || stepUnit === 'g') ? (stepUnit === 'ml' ? 5 : 10) : 1;
      volumeStepperHtml = `
        <div class="enh-volume-stepper" style="margin-top:8px;display:inline-flex;align-items:center;gap:6px;background:var(--surface2,#fbfaf8);border:1px solid var(--border,rgba(120,120,128,0.2));border-radius:8px;padding:3px 8px;">
          <span style="font-size:11px;font-weight:600;color:var(--text2,#78716c);">Adjust Volume:</span>
          <button type="button" class="enh-stepper-btn enh-stepper-minus" data-adj-id="${escapeHtml(adj.id)}" data-step="${stepVal}" style="width:24px;height:24px;border:1px solid var(--border,#ccc);border-radius:6px;background:var(--surface,#fff);cursor:pointer;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;color:var(--text);">-</button>
          <input type="number" class="enh-stepper-input" data-adj-id="${escapeHtml(adj.id)}" value="${adj.proposedQty}" style="width:58px;padding:2px 4px;font-size:12px;font-weight:700;text-align:center;border:1px solid var(--border,#ccc);border-radius:6px;background:var(--surface,#fff);color:var(--text);" />
          <span style="font-size:11.5px;color:var(--text2,#78716c);font-weight:600;">${escapeHtml(adj.unit || 'g')}</span>
          <button type="button" class="enh-stepper-btn enh-stepper-plus" data-adj-id="${escapeHtml(adj.id)}" data-step="${stepVal}" style="width:24px;height:24px;border:1px solid var(--border,#ccc);border-radius:6px;background:var(--surface,#fff);cursor:pointer;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;color:var(--text);">+</button>
        </div>
      `;
    }

    let taxonomyHtml = '';
    if (adj.selectedSwap && adj.postTaxonomy) {
      taxonomyHtml = `
        <div class="enh-taxonomy-box" style="margin-top:9px;background:var(--surface2, #fbfaf8);border:1px solid var(--border, rgba(120,120,128,0.18));border-radius:10px;padding:9px 12px;font-size:11.5px;line-height:1.4;">
          <div style="display:flex;align-items:flex-start;gap:8px;">
            <span style="font-size:10px;font-weight:700;color:#16a34a;background:rgba(22,163,74,0.14);padding:1px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;margin-top:2px;">
              Substitute
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

    let swapPickerHtml = '';
    if (Array.isArray(adj.swapCandidates) && adj.swapCandidates.length > 0) {
      swapPickerHtml = `
        <div class="enh-inline-swap-row" style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--surface2,#fbfaf8);border:1px solid var(--border,rgba(120,120,128,0.18));border-radius:8px;padding:6px 10px;">
          <span style="font-size:11px;font-weight:600;color:var(--text2,#78716c);white-space:nowrap;">🔄 Substitute:</span>
          <select class="enh-swap-select" data-adj-id="${escapeHtml(adj.id)}" data-ing-name="${escapeHtml(adj.ingredientName || '')}" style="flex:1;min-width:0;padding:4px 6px;font-size:11.5px;font-weight:550;border-radius:6px;border:1px solid var(--border,#ccc);background:var(--surface,#fff);color:var(--text,#1c1917);outline:none;cursor:pointer;">
            <option value="">Keep Original (${escapeHtml(adj.originalQty || adj.proposedQty || '')}${escapeHtml(adj.unit || '')})</option>
            ${adj.swapCandidates.map(c => `
              <option value="${escapeHtml(c.productId || c.productName)}" ${adj.selectedSwapProduct === (c.productId || c.productName) ? 'selected' : ''}>
                ${escapeHtml(c.label)} [1:1 volume]
              </option>
            `).join('')}
          </select>
        </div>
      `;
    }

    const isChecked = adj.type === 'optional_swap' ? Boolean(adj.active) : (adj.active !== false);

    return `
      <div class="enh-adj-row" style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:var(--surface,#fff);${borderStyle}">
        <input 
          type="checkbox" 
          class="enh-adj-cb" 
          data-adj-id="${escapeHtml(adj.id)}" 
          ${isChecked ? 'checked' : ''} 
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
          ${volumeStepperHtml}
          ${taxonomyHtml}
          ${swapPickerHtml}
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
        
        <!-- Apple HIG Route Nav Switcher -->
        ${routeNavHtml}

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
                ${beforeMeta.icon} ${activeRoute.beforeScore ?? plan.beforeScore}%
              </span>
            </div>
            
            <div style="font-size: 18px; font-weight: 700; color: var(--text3, #a8a29e);">➔</div>

            <div style="text-align: right;">
              <div style="font-size: 11px; font-weight: 600; color: var(--text2, #78716c); margin-bottom: 3px;">Enhanced Goal</div>
              <span id="enh-pred-badge" class="badge ${predMeta.tier}" style="background:${predMeta.bg};color:${predMeta.text};border:1px solid ${predMeta.border};font-weight:700;padding:3px 8px;border-radius:6px;font-size:12px;">
                ${predMeta.icon} <span id="enh-pred-score">${currentPredScore}</span>% - <span id="enh-pred-tier-label">${predMeta.label}</span>
              </span>
            </div>
          </div>

          <!-- Live Macros Row -->
          <div id="enh-live-macros-row" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; font-size: 11.5px; font-weight: 600;">
            <span id="enh-macro-kcal" style="background:var(--surface,#fff);padding:3px 8px;border-radius:6px;border:1px solid var(--border,#ddd);color:var(--text,#111);">
              🔥 ${liveData?.liveMacros?.calories ?? 0} kcal
            </span>
            <span id="enh-macro-prot" style="background:var(--surface,#fff);padding:3px 8px;border-radius:6px;border:1px solid var(--border,#ddd);color:#16a34a;">
              💪 ${liveData?.liveMacros?.protein ?? 0}g prot
            </span>
            <span id="enh-macro-carb" style="background:var(--surface,#fff);padding:3px 8px;border-radius:6px;border:1px solid var(--border,#ddd);color:#2563eb;">
              🌾 ${liveData?.liveMacros?.carbs ?? 0}g carbs
            </span>
            <span id="enh-macro-fat" style="background:var(--surface,#fff);padding:3px 8px;border-radius:6px;border:1px solid var(--border,#ddd);color:#d97706;">
              🥑 ${liveData?.liveMacros?.fat ?? 0}g fat
            </span>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border, rgba(120, 120, 128, 0.12)); padding-top: 8px; font-size: 12px; color: var(--text2, #78716c);">
            <span>Household Target Impact:</span>
            <span id="enh-impact-text" style="font-weight: 650; color: var(--text, #1c1917);">
              ${liveData && liveData.deltaKcalTotal !== 0 ? `🔥 ${liveData.deltaKcalTotal > 0 ? '+' : ''}${liveData.deltaKcalTotal} kcal ` : ''}
              ${liveData && liveData.deltaProtTotal !== 0 ? `💪 ${liveData.deltaProtTotal > 0 ? '+' : ''}${liveData.deltaProtTotal}g protein` : ''}
            </span>
          </div>

          ${activeRoute.description ? `
            <div style="font-size: 11.5px; font-style: italic; color: var(--text2, #78716c); margin-top: 6px; border-top: 1px solid var(--border, rgba(120, 120, 128, 0.12)); padding-top: 6px;">
              Route: ${escapeHtml(activeRoute.description)}
            </div>
          ` : ''}
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
        ${(activeRoute.proposedServings || plan.proposedServings) !== (activeRoute.originalServings || plan.originalServings) ? `
          <div style="background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.2); border-radius: 12px; padding: 10px 14px; font-size: 12.5px; color: #2563eb; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <span>ℹ️</span>
            <div><strong>Servings rebalanced:</strong> Adjusted from ${activeRoute.originalServings || plan.originalServings} to ${activeRoute.proposedServings || plan.proposedServings} portions to bring batch calories into ideal ranges.</div>
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

  // Wire Route Segmented Switcher
  const routeTabs = wrap.querySelectorAll('.enh-route-tab');
  routeTabs.forEach(tab => {
    tab.onclick = () => {
      const routeId = tab.getAttribute('data-route-id');
      if (routeId && routeId !== currentSelectedRouteId) {
        currentSelectedRouteId = routeId;
        renderEnhancementModalContent(wrap, plan);
      }
    };
  });

  // Wire Checkboxes live re-scoring
  const checkboxes = wrap.querySelectorAll('.enh-adj-cb');
  checkboxes.forEach(cb => {
    cb.onchange = () => {
      const adjId = cb.getAttribute('data-adj-id');
      const targetAdj = (activeRoute.adjustments || []).find(a => a.id === adjId);
      if (targetAdj) {
        targetAdj.active = cb.checked;
      }
      recomputeModalPredictedScore(wrap, activeRoute);
    };
  });

  // Wire Volume Stepper Buttons
  wrap.querySelectorAll('.enh-stepper-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const adjId = btn.getAttribute('data-adj-id');
      const step = Number(btn.getAttribute('data-step')) || 5;
      const isMinus = btn.classList.contains('enh-stepper-minus');
      const targetAdj = (activeRoute.adjustments || []).find(a => a.id === adjId);
      if (!targetAdj) return;

      const currentVal = Number(targetAdj.proposedQty) || 10;
      const minVal = step;
      targetAdj.proposedQty = isMinus ? Math.max(minVal, currentVal - step) : (currentVal + step);

      const input = wrap.querySelector(`.enh-stepper-input[data-adj-id="${adjId}"]`);
      if (input) input.value = targetAdj.proposedQty;

      // Ensure the adjustment is checked if user adjusts volume
      targetAdj.active = true;
      const cb = wrap.querySelector(`.enh-adj-cb[data-adj-id="${adjId}"]`);
      if (cb) cb.checked = true;

      recomputeModalPredictedScore(wrap, activeRoute);
    };
  });

  // Wire Volume Stepper Direct Input
  wrap.querySelectorAll('.enh-stepper-input').forEach(input => {
    input.onchange = () => {
      const adjId = input.getAttribute('data-adj-id');
      const targetAdj = (activeRoute.adjustments || []).find(a => a.id === adjId);
      if (!targetAdj) return;

      const val = Math.max(1, Number(input.value) || 1);
      targetAdj.proposedQty = val;
      input.value = val;

      targetAdj.active = true;
      const cb = wrap.querySelector(`.enh-adj-cb[data-adj-id="${adjId}"]`);
      if (cb) cb.checked = true;

      recomputeModalPredictedScore(wrap, activeRoute);
    };
  });

  // Wire Inline Swap Selectors
  const swapSelects = wrap.querySelectorAll('.enh-swap-select');
  swapSelects.forEach(sel => {
    sel.onchange = () => {
      const adjId = sel.getAttribute('data-adj-id');
      const targetAdj = (activeRoute.adjustments || []).find(a => a.id === adjId);
      if (!targetAdj) return;
      const selectedVal = sel.value;
      if (selectedVal) {
        const candidate = (targetAdj.swapCandidates || []).find(c => (c.productId || c.productName) === selectedVal);
        if (candidate) {
          targetAdj.selectedSwap = candidate;
          targetAdj.selectedSwapProduct = selectedVal;
          targetAdj.active = true;
          targetAdj.postTaxonomy = {
            category: candidate.category,
            rootItem: candidate.rootItem,
            subtype: candidate.subtype,
            productName: candidate.productName
          };
        }
      } else {
        delete targetAdj.selectedSwap;
        delete targetAdj.selectedSwapProduct;
        delete targetAdj.postTaxonomy;
        if (targetAdj.type === 'optional_swap') {
          targetAdj.active = false;
        }
      }
      const cb = wrap.querySelector(`.enh-adj-cb[data-adj-id="${adjId}"]`);
      if (cb) cb.checked = targetAdj.active;
      recomputeModalPredictedScore(wrap, activeRoute);
    };
  });

  // Wire Apply Button (strictly builds payload from active adjustments)
  const btnApply = wrap.querySelector('#btn-apply-enh');
  if (btnApply) {
    btnApply.onclick = () => {
      closeEnhancementModal();
      // Persist chosen swaps to household swap memory
      const chosenSwaps = (activeRoute.adjustments || []).filter(a => a.selectedSwap && a.active !== false);
      chosenSwaps.forEach(a => {
        const ingKey = String(a.ingredientName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
        const swapData = {
          originalName: a.ingredientName,
          preferredProductId: a.selectedSwap.productId,
          preferredSubtype: a.selectedSwap.subtype,
          preferredProductName: a.selectedSwap.productName,
          preferredRootItem: a.selectedSwap.rootItem
        };
        saveHouseholdSwapPreference(ingKey, swapData).catch(err => {
          console.warn('[RecipeEnhancement] Failed to save swap preference:', err);
        });
      });

      const liveData = buildLiveEnhancedRecipe(activeRoute, plan.originalRecipe);
      const finalPayload = liveData?.livePayload || activeRoute.enhancedRecipePayload || plan.enhancedRecipePayload;

      if (typeof currentOnApply === 'function') {
        currentOnApply(finalPayload);
      }
    };
  }
}

function recomputeModalPredictedScore(wrap, route) {
  const liveData = buildLiveEnhancedRecipe(route, currentPlan?.originalRecipe || route.originalRecipe);
  if (!liveData) return;

  const newScore = liveData.liveScore;
  const newMeta = getFitScoreTierMeta(newScore);

  const badgeElem = wrap.querySelector('#enh-pred-badge');
  const scoreElem = wrap.querySelector('#enh-pred-score');
  const tierLabelElem = wrap.querySelector('#enh-pred-tier-label');
  if (badgeElem && scoreElem) {
    scoreElem.textContent = newScore;
    badgeElem.className = `badge ${newMeta.tier}`;
    badgeElem.style.background = newMeta.bg;
    badgeElem.style.color = newMeta.text;
    badgeElem.style.borderColor = newMeta.border;
    if (tierLabelElem) tierLabelElem.textContent = newMeta.label;
  }

  const impactElem = wrap.querySelector('#enh-impact-text');
  if (impactElem) {
    const parts = [];
    if (liveData.deltaKcalTotal !== 0) parts.push(`🔥 ${liveData.deltaKcalTotal > 0 ? '+' : ''}${liveData.deltaKcalTotal} kcal`);
    if (liveData.deltaProtTotal !== 0) parts.push(`💪 ${liveData.deltaProtTotal > 0 ? '+' : ''}${liveData.deltaProtTotal}g protein`);
    impactElem.textContent = parts.join('   ') || 'Optimal match reached';
  }

  const kcalElem = wrap.querySelector('#enh-macro-kcal');
  const protElem = wrap.querySelector('#enh-macro-prot');
  const carbElem = wrap.querySelector('#enh-macro-carb');
  const fatElem = wrap.querySelector('#enh-macro-fat');
  if (kcalElem) kcalElem.textContent = `🔥 ${liveData.liveMacros.calories} kcal`;
  if (protElem) protElem.textContent = `💪 ${liveData.liveMacros.protein}g prot`;
  if (carbElem) carbElem.textContent = `🌾 ${liveData.liveMacros.carbs}g carbs`;
  if (fatElem) fatElem.textContent = `🥑 ${liveData.liveMacros.fat}g fat`;
}

if (typeof window !== 'undefined') {
  window.openEnhancementModal = openEnhancementModal;
  window.closeEnhancementModal = closeEnhancementModal;
}

if (typeof window !== 'undefined') {
  window.openEnhancementModal = openEnhancementModal;
  window.closeEnhancementModal = closeEnhancementModal;
}
