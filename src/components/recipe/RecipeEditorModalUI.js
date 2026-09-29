/**
 * src/components/recipe/RecipeEditorModalUI.js (v3.9.6)
 * Modular Presentation Component for Recipe Authoring & Editor Modal Rows
 */

function escapeHtml(str) {
  if (typeof window !== 'undefined' && window.ppEscapeHtml) {
    return window.ppEscapeHtml(str);
  }
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (typeof window !== 'undefined' && window.ppEscapeAttr) {
    return window.ppEscapeAttr(str);
  }
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function round1(val) {
  if (typeof window !== 'undefined' && window.round1) {
    return window.round1(val);
  }
  return Math.round((val || 0) * 10) / 10;
}

/**
 * Render Protein Efficiency Analysis Section HTML
 */
export function renderProteinEfficiencyAnalysisSection(modalIngs = [], recipe = {}, prefix = 'enh') {
  if (!modalIngs || !modalIngs.length) return '';
  const items = [];

  modalIngs.forEach((ing, idx) => {
    if (ing.excludeNutrition) return;
    const c = typeof window !== 'undefined' && window.getIngredientContribution
      ? window.getIngredientContribution(ing, recipe, recipe.serves)
      : null;
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

  const renderItemRow = (item, rank, isBest) => {
    const tagClass = isBest
      ? (item.pPer100 >= 10 ? 'badge-purple' : (item.pPer100 >= 5 ? 'good' : 'warn'))
      : (item.pPer100 < 2 ? 'badge-coral' : (item.pPer100 < 5 ? 'warn' : 'good'));
    const displayPPer100 = Math.round(item.pPer100 * 10) / 10;

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            <span style="color:var(--text2);margin-right:4px">#${rank + 1}</span> ${escapeHtml(item.name)}
          </div>
          <div style="font-size:11px;color:var(--text2)">${Math.round(item.cal)} kcal · ${round1(item.prot)}g protein</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="badge ${tagClass}" style="font-size:11px">${displayPPer100}g P / 100 kcal</span>
          ${!isBest ? `<button type="button" class="btn sm ghost" onclick="searchSubstituteForIngredient('${escapeAttr(prefix)}', '${escapeAttr(item.name)}')">Replace</button>` : ''}
          <button type="button" class="btn sm ghost" onclick="highlightReviewIngredientRow('${escapeAttr(prefix)}', ${item.idx})">Locate</button>
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
