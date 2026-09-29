/**
 * src/components/analytics/RecipeCostBreakdown.js (v3.8.5)
 * Modular UI component for Recipe Costing & Pricing Engine:
 * - Itemized ingredient cost breakdown tables & unit prices
 * - Price per serving vs total batch cost metrics
 * - Supermarket price tags (Tesco / Sainsbury's / Aldi estimates)
 */

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Renders itemized ingredient cost breakdown table.
 */
export function renderItemizedCostTable(ingredients = []) {
  if (!ingredients || ingredients.length === 0) {
    return `<div style="font-size:12px;color:var(--text2);padding:8px 0">No itemized costs available.</div>`;
  }

  const rows = ingredients.map(ing => {
    const name = ing.name || ing.item || 'Ingredient';
    const amount = ing.amount || ing.qty || '';
    const unit = ing.unit || '';
    const cost = +ing.cost || +ing.estimatedCost || 0;
    return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:8px 6px;font-size:12px;font-weight:600">${escapeHtml(name)}</td>
        <td style="padding:8px 6px;font-size:12px;color:var(--text2);text-align:right">${escapeHtml(amount)} ${escapeHtml(unit)}</td>
        <td style="padding:8px 6px;font-size:12px;font-weight:700;text-align:right">£${cost.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="overflow-x:auto;max-height:220px;margin-top:8px">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:2px solid var(--border);text-align:left;font-size:11px;color:var(--text2)">
            <th style="padding:6px">INGREDIENT</th>
            <th style="padding:6px;text-align:right">QUANTITY</th>
            <th style="padding:6px;text-align:right">COST</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Renders supermarket price tags & comparative batch metrics.
 */
export function renderSupermarketPriceTags(totalCost = 0) {
  const tesoEst = (totalCost * 1.02).toFixed(2);
  const aldiEst = (totalCost * 0.82).toFixed(2);
  const sainsEst = (totalCost * 1.05).toFixed(2);

  return `
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <span class="tag" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);font-size:11px;padding:4px 8px;border-radius:6px">
        🛒 Tesco est. <strong>£${tesoEst}</strong>
      </span>
      <span class="tag" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);font-size:11px;padding:4px 8px;border-radius:6px">
        🏷️ Aldi est. <strong>£${aldiEst}</strong>
      </span>
      <span class="tag" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);font-size:11px;padding:4px 8px;border-radius:6px">
        🛍️ Sainsbury's est. <strong>£${sainsEst}</strong>
      </span>
    </div>
  `;
}

/**
 * Renders the full Recipe Cost Breakdown component.
 */
export function renderRecipeCostBreakdown(nutrition = {}, portions = {}, ingredients = []) {
  const totalCost = +nutrition?.totalNutrition?.cost || +nutrition?.cost || 0;
  const perServingCost = +nutrition?.perServing?.cost || (+totalCost / Math.max(1, (+portions?.serves || 2))) || 0;
  const eCost = perServingCost * (+portions?.eSingleServ || 1);
  const cCost = perServingCost * (+portions?.cSingleServ || 1);

  return `
    <div class="card pp-recipe-cost-breakdown" style="padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div>
          <h3 style="margin:0;font-size:15px;font-weight:700">Cost Breakdown & Supermarket Estimates</h3>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">Itemized ingredient pricing and portion expense</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(110px, 1fr));gap:8px;margin-bottom:12px">
        <div style="background:var(--surface2);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:11px;color:var(--text2);font-weight:600">TOTAL BATCH</div>
          <div style="font-size:15px;font-weight:750;color:var(--text);margin-top:2px">£${totalCost.toFixed(2)}</div>
        </div>
        <div style="background:var(--surface2);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:11px;color:var(--text2);font-weight:600">PER SERVING</div>
          <div style="font-size:15px;font-weight:750;color:var(--text);margin-top:2px">£${perServingCost.toFixed(2)}</div>
        </div>
        <div style="background:var(--surface2);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:11px;color:var(--text2);font-weight:600">ELLIOTT SHARE</div>
          <div style="font-size:15px;font-weight:750;color:var(--blue);margin-top:2px">£${eCost.toFixed(2)}</div>
        </div>
        <div style="background:var(--surface2);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:11px;color:var(--text2);font-weight:600">CHLOE SHARE</div>
          <div style="font-size:15px;font-weight:750;color:var(--purple);margin-top:2px">£${cCost.toFixed(2)}</div>
        </div>
      </div>

      ${renderSupermarketPriceTags(totalCost)}
      ${renderItemizedCostTable(ingredients)}
    </div>
  `;
}
