/* PlatePlan Recipe Editor Calculations & Utilities Module
 * Safe extraction of pure math, scaling, normalization, diffing, and formatting helpers.
 */
(() => {
  window.PlatePlanRecipeEditor = window.PlatePlanRecipeEditor || {};

  function safeFileName(name) {
    return String(name || 'recipe').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'recipe';
  }

  function normaliseRecipeIngredientSection(section) {
    const normAlias = window.normaliseAliasText || ((s) => String(s || '').trim().toLowerCase());
    return normAlias(section || '');
  }

  function orderRecipeIngredientsBySection(ingredients) {
    const rows = Array.isArray(ingredients) ? ingredients.slice() : [];
    const named = new Map();
    const blank = [];
    rows.forEach(item => {
      const section = normaliseRecipeIngredientSection(item?.section);
      if (!section) { blank.push(item); return; }
      if (!named.has(section)) named.set(section, []);
      named.get(section).push(item);
    });
    return [...named.values()].flat().concat(blank);
  }

  function uniqueSectionNames(values) {
    const seen = new Set();
    const groupKeyFn = window.canonicalGroupKey || ((s) => String(s || '').trim().toLowerCase());
    return (values || []).map(v => normaliseRecipeIngredientSection(v)).filter(v => {
      const key = groupKeyFn(v);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normaliseReviewCompareText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function comparableReviewIngredients(prefix) {
    const extractFn = window.extractModalList || (typeof extractModalList === 'function' ? extractModalList : null);
    const list = extractFn ? extractFn(prefix) : { ings: [] };
    return (list.ings || []).map(ing => ({
      qty: Math.round((+ing.qty || 0) * 1000) / 1000,
      unit: ing.unit || '',
      name: normaliseReviewCompareText(ing.name),
      section: normaliseReviewCompareText(ing.section),
      groupId: ing.groupId || '',
      bankId: ing.bankId || '',
      ingredientId: ing.ingredientId || '',
      mappedViaIngredient: !!ing.mappedViaIngredient,
      excludeNutrition: !!ing.excludeNutrition,
      stockWaterMl: +ing.stockWaterMl || 0
    }));
  }

  function comparableReviewSteps(prefix) {
    return Array.from(document.querySelectorAll(`#${prefix}-method-list .r-step`))
      .map(el => normaliseReviewCompareText(el.value))
      .filter(Boolean);
  }

  function applyReviewContextToIngredients(ings, context = {}) {
    const isRemoved = window.isIngredientRemovedInContext || (() => false);
    const getAdjusted = window.getAdjustedIngredientForContext || ((i) => i);
    const getKey = window.getRecipeIngredientKey || ((i) => i.name || '');

    return (ings || []).filter(ing => !isRemoved(ing, context)).map(ing => {
      const adjusted = typeof ing === 'object' ? getAdjusted(ing, context) : ing;
      if (typeof adjusted === 'object' && adjusted !== ing) {
        return {
          ...adjusted,
          isSubstituted: true,
          originalName: ing.name,
          originalBankId: ing.bankId,
          originalGroupId: ing.groupId,
          originalKey: getKey(ing)
        };
      }
      return adjusted;
    });
  }

  function renderProteinEfficiencyAnalysisSection(modalIngs, recipe, prefix = 'enh') {
    if (!modalIngs || !modalIngs.length) return '';
    const items = [];
    modalIngs.forEach((ing, idx) => {
      if (ing.excludeNutrition) return;
      const contribFn = window.getIngredientContribution || (typeof getIngredientContribution === 'function' ? getIngredientContribution : (() => null));
      const c = contribFn(ing, recipe, recipe.serves);
      if (!c) return;
      const cal = c.total?.cal || 0;
      const prot = c.total?.prot || 0;
      if (cal <= 0) return;
      const pPer100 = (prot / cal) * 100;
      items.push({
        ing,
        idx,
        name: c.bankIng?.name || ing.name || 'Ingredient',
        raw: ing.raw || ing.name || '',
        cal,
        prot,
        pPer100
      });
    });
    if (!items.length) return '';
    const sortedWorst = [...items].sort((a, b) => a.pPer100 - b.pPer100);
    const sortedBest = [...items].sort((a, b) => b.pPer100 - a.pPer100);
    const topBest = sortedBest.slice(0, 5);
    const topWorst = sortedWorst.slice(0, 5);

    const escHtml = window.ppEscapeHtml || ((s) => String(s || ''));
    const escAttr = window.ppEscapeAttr || ((s) => String(s || ''));
    const r1 = window.round1 || ((n) => Math.round((n || 0) * 10) / 10);

    const renderItemRow = (item, rank, isBest) => {
      const tagClass = isBest 
         ? (item.pPer100 >= 10 ? 'badge-purple' : (item.pPer100 >= 5 ? 'good' : 'warn'))
        : (item.pPer100 < 2 ? 'badge-coral' : (item.pPer100 < 5 ? 'warn' : 'good'));
      const displayPPer100 = Math.round(item.pPer100 * 10) / 10;
      
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              <span style="color:var(--text2);margin-right:4px">#${rank+1}</span> ${escHtml(item.name)}
            </div>
            <div style="font-size:11px;color:var(--text2)">${Math.round(item.cal)} kcal · ${r1(item.prot)}g protein</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="badge ${tagClass}" style="font-size:11px">${displayPPer100}g P / 100 kcal</span>
            ${!isBest ? `<button type="button" class="btn sm ghost" onclick="searchSubstituteForIngredient('${escAttr(prefix)}', '${escAttr(item.name)}')">Replace</button>` : ''}
            <button type="button" class="btn sm ghost" onclick="highlightReviewIngredientRow('${escAttr(prefix)}', ${item.idx})">Locate</button>
          </div>
        </div>
      `;
    };

    const bestRows = topBest.map((item, idx) => renderItemRow(item, idx, true)).join('');
    const worstRows = topWorst.map((item, idx) => renderItemRow(item, idx, false)).join('');

    return `
      <details class="review-secondary-section protein-efficiency-tool" open style="margin-top:12px;border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--surface2)">
        <summary style="font-weight:600;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:space-between">
          <span>Protein per kcal Efficiency Analysis</span>
          <span class="tag purple" style="font-size:10px">Best &amp; Worst Ingredients</span>
        </summary>
        <div style="font-size:12px;color:var(--text2);margin:6px 0 10px;line-height:1.4">
          Identifies ingredients driving protein density versus those adding calories with low protein yield. Use this breakdown to optimize recipe macros.
        </div>
        <div class="grid2" style="gap:12px;align-items:start">
          <div style="background:var(--surface);padding:10px;border-radius:6px;border:1px solid var(--border)">
            <div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:6px;display:flex;align-items:center;gap:4px">
              <span>★ Most Protein-Efficient (Best)</span>
            </div>
            <div class="best-protein-rows">
              ${bestRows}
            </div>
          </div>
          <div style="background:var(--surface);padding:10px;border-radius:6px;border:1px solid var(--border)">
            <div style="font-size:12px;font-weight:700;color:var(--coral, #e11d48);margin-bottom:6px;display:flex;align-items:center;gap:4px">
              <span>⚠️ Least Protein-Efficient (Worst)</span>
            </div>
            <div class="worst-protein-rows">
              ${worstRows}
            </div>
          </div>
        </div>
      </details>
    `;
  }

  const renderLeastProteinEfficientSection = renderProteinEfficiencyAnalysisSection;

  function applyScaleToRecipeDefinition(targetServes, baseRecipe = null) {
    const base = baseRecipe || window.PlatePlanRecipeEditor?.State?.previewBaseRecipe || window.previewBaseRecipe;
    if (!base || !base.serves) return null;
    const scale = targetServes / base.serves;
    const cloner = window.clonePlatePlanValue || ((v) => JSON.parse(JSON.stringify(v)));
    const r = cloner(base);
    r.serves = targetServes;
    const gramsCalc = window.toGrams || ((q) => q);
    r.ingredients.forEach(i => {
      if (i.qty) {
        i.qty = Math.round((i.qty * scale) * 100) / 100;
        i.grams = typeof gramsCalc === 'function' ? gramsCalc(i.qty, i.unit) : i.qty;
        i.raw = `${i.qty} ${i.unit !== 'qty' ? i.unit : ''} ${i.name}`.trim();
      }
    });
    const nutCalc = window.calcRecipeNutrition || (typeof calcRecipeNutrition === 'function' ? calcRecipeNutrition : (() => ({ cal: 0, prot: 0, carb: 0, fat: 0, fibre: 0 })));
    const n = nutCalc(r.ingredients, r.serves);
    r.cal = n.cal; r.prot = n.prot; r.carb = n.carb; r.fat = n.fat; r.fibre = n.fibre;
    const mtRoot = (r.types && r.types[0]) || 'dinner';
    const prefs = window.state?.prefs || {};
    const portCalc = window.calcPortions || (typeof calcPortions === 'function' ? calcPortions : (() => ({ e: null, c: null })));
    r.portions = portCalc(n, prefs, r.serves, r.who, mtRoot);

    if (r.enhanced) {
      r.enhanced.ingredients.forEach(i => {
        if (i.qty) {
          i.qty = Math.round((i.qty * scale) * 100) / 100;
          i.grams = typeof gramsCalc === 'function' ? gramsCalc(i.qty, i.unit) : i.qty;
          i.raw = `${i.qty} ${i.unit !== 'qty' ? i.unit : ''} ${i.name}`.trim();
        }
      });
      const ne = nutCalc(r.enhanced.ingredients, r.serves);
      r.enhanced.cal = ne.cal; r.enhanced.prot = ne.prot; r.enhanced.carb = ne.carb; r.enhanced.fat = ne.fat; r.enhanced.fibre = ne.fibre;
      const ePortions = portCalc(ne, prefs, r.serves, r.who, mtRoot);
      r.enhanced.portionE = ePortions.e;
      r.enhanced.portionC = ePortions.c;
    }
    return r;
  }

  // Attach to domain namespace
  const exports = {
    safeFileName,
    normaliseRecipeIngredientSection,
    orderRecipeIngredientsBySection,
    uniqueSectionNames,
    normaliseReviewCompareText,
    comparableReviewIngredients,
    comparableReviewSteps,
    applyReviewContextToIngredients,
    renderProteinEfficiencyAnalysisSection,
    renderLeastProteinEfficientSection,
    applyScaleToRecipeDefinition
  };

  Object.assign(window.PlatePlanRecipeEditor, exports);

  // Attach to global window
  Object.keys(exports).forEach(key => {
    window[key] = exports[key];
  });
})();
