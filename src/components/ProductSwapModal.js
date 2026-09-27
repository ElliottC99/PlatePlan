/**
 * src/components/ProductSwapModal.js (v3.7.4)
 * Granular modal component for ingredient & product substitution.
 * Quarantined from direct database operations, handles state update dispatching cleanly.
 */

import { saveCurrentPlan } from '../services/HouseholdRepository.js';

export function calculateMetrics(item) {
  const protein = Number(item.protein || item.macros?.protein || 0);
  const kcal = Number(item.calories || item.kcal || item.macros?.calories || 0);
  const price = Number(item.price || item.cost || 0);

  const proteinPerKcal = kcal > 0 ? (protein / kcal) : 0;
  const proteinPerPound = price > 0 ? (protein / price) : 0;

  return { protein, kcal, price, proteinPerKcal, proteinPerPound };
}

export function resolveTargetItem(groupKey, itemKey) {
  const sources = [
    window.state?.confirmedShopping,
    window.state?.shoppingList,
    window.state?.generatedList
  ];

  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const group of source) {
      if (!group) continue;
      if (group.key === groupKey || group.id === groupKey || group.name === groupKey) {
        const item = group.items?.find(i => i.key === itemKey || i.id === itemKey || i.name === itemKey);
        if (item) return { item, group, source };
      }
      const item = group.items?.find(i => i.key === itemKey || i.id === itemKey);
      if (item) return { item, group, source };
    }
  }

  const ing = (Array.isArray(window.state?.ingredients) ? window.state.ingredients : []).find(
    i => i.id === itemKey || i.key === itemKey || i.name === itemKey
  );
  if (ing) return { item: ing, group: null, source: null };

  return { item: { name: itemKey || 'Selected Item' }, group: null, source: null };
}

export function renderScrollableSwapModal(groupKey, itemKey) {
  const existing = document.getElementById('pp-swap-product-modal');
  if (existing) existing.remove();

  const { item: targetItem, group: targetGroup } = resolveTargetItem(groupKey, itemKey);
  const ingredients = Array.isArray(window.state?.ingredients) ? window.state.ingredients : [];

  const targetSubtype = targetItem?.subtype || targetItem?.category || '';
  const targetName = targetItem?.name || targetItem?.ingredient || '';

  const tier1SameSubtype = ingredients.filter(i => 
    targetSubtype && (i.subtype === targetSubtype || i.category === targetSubtype) && i.name !== targetName
  );

  const tier2SameIngredient = ingredients.filter(i => 
    targetName && (i.name?.toLowerCase().includes(targetName.toLowerCase()) || i.ingredient?.toLowerCase().includes(targetName.toLowerCase())) &&
    !tier1SameSubtype.includes(i)
  );

  let currentSort = 'relevance';
  let currentScope = 'global';

  const overlay = document.createElement('div');
  overlay.id = 'pp-swap-product-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);backdrop-filter:blur(3px);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

  const container = document.createElement('div');
  container.style.cssText = 'background:#fff;width:94%;max-width:620px;max-height:88vh;border-radius:16px;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;';

  container.innerHTML = `
    <div style="padding:18px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;background:#fafafa;">
      <div>
        <h3 style="margin:0;font-size:17px;font-weight:700;color:#0f172a;">Swap Product</h3>
        <p style="margin:2px 0 0 0;font-size:13px;color:#64748b;">
          Swapping: <strong style="color:#2563eb;">${targetItem?.brand ? targetItem.brand + ' - ' : ''}${targetItem?.name || 'Item'}</strong>
        </p>
      </div>
      <button id="pp-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#94a3b8;line-height:1;">&times;</button>
    </div>

    <div style="padding:12px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;flex-direction:column;gap:10px;">
      ${targetGroup?.recipeName ? `
      <div style="display:flex;gap:10px;align-items:center;font-size:12px;background:#fff;padding:6px 10px;border-radius:8px;border:1px solid #cbd5e1;">
        <span style="font-weight:600;color:#334155;">Swap Scope:</span>
        <label style="cursor:pointer;display:flex;align-items:center;gap:4px;">
          <input type="radio" name="pp-swap-scope" value="global" checked> All recipes
        </label>
        <label style="cursor:pointer;display:flex;align-items:center;gap:4px;margin-left:10px;">
          <input type="radio" name="pp-swap-scope" value="recipe"> Only for "${targetGroup.recipeName}"
        </label>
      </div>
      ` : ''}

      <div style="display:flex;gap:10px;">
        <input type="text" id="pp-product-search" placeholder="🔍 Search catalog..." style="flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;outline:none;">
        <select id="pp-product-sort" style="padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;background:#fff;cursor:pointer;">
          <option value="relevance">Sort: Default</option>
          <option value="name">Sort: Name (A-Z)</option>
          <option value="proteinPerKcal">Sort: Protein / kcal</option>
          <option value="proteinPerPound">Sort: Protein / £</option>
          <option value="price">Sort: Price (Low to High)</option>
        </select>
      </div>
    </div>

    <div id="pp-product-list" style="padding:16px 20px;overflow-y:auto;flex-grow:1;"></div>
  `;

  overlay.appendChild(container);
  document.body.appendChild(overlay);

  const listEl = container.querySelector('#pp-product-list');
  const searchInput = container.querySelector('#pp-product-search');
  const sortSelect = container.querySelector('#pp-product-sort');

  container.querySelectorAll('input[name="pp-swap-scope"]').forEach(radio => {
    radio.addEventListener('change', (e) => { currentScope = e.target.value; });
  });

  function sortItems(items) {
    const sorted = [...items];
    switch (currentSort) {
      case 'name': return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      case 'proteinPerKcal': return sorted.sort((a, b) => calculateMetrics(b).proteinPerKcal - calculateMetrics(a).proteinPerKcal);
      case 'proteinPerPound': return sorted.sort((a, b) => calculateMetrics(b).proteinPerPound - calculateMetrics(a).proteinPerPound);
      case 'price': return sorted.sort((a, b) => calculateMetrics(a).price - calculateMetrics(b).price);
      default: return sorted;
    }
  }

  function renderCardHTML(item, badgeText) {
    const metrics = calculateMetrics(item);
    return `
      <div class="pp-swap-card" data-ing-id="${item.id || item.name}" style="padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all 0.15s ease;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">${item.brand || 'Generic'}</span>
            <div style="font-weight:600;color:#1e293b;font-size:14px;margin-top:1px;">${item.name}</div>
          </div>
          ${badgeText ? `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:#dbeafe;color:#1e40af;">${badgeText}</span>` : ''}
        </div>
        <div style="margin-top:8px;display:flex;flex-wrap:gap:4px;">
          ${metrics.price ? `<span style="font-size:11px;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;margin-right:4px;">£${metrics.price.toFixed(2)}</span>` : ''}
          ${metrics.protein ? `<span style="font-size:11px;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;margin-right:4px;">${metrics.protein}g protein</span>` : ''}
          ${metrics.proteinPerKcal ? `<span style="font-size:11px;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;">${(metrics.proteinPerKcal * 100).toFixed(1)}g prot/100kcal</span>` : ''}
        </div>
      </div>`;
  }

  function renderList(query = '') {
    let html = '';
    const cleanQ = query.toLowerCase().trim();

    if (!cleanQ) {
      const sortedT1 = sortItems(tier1SameSubtype);
      if (sortedT1.length > 0) {
        html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#2563eb;margin-bottom:8px;">Tier 1: Same Subtype (${targetSubtype})</div>`;
        sortedT1.forEach(item => { html += renderCardHTML(item, 'Subtype Match'); });
      }

      const sortedT2 = sortItems(tier2SameIngredient);
      if (sortedT2.length > 0) {
        html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#475569;margin:16px 0 8px 0;">Tier 2: Same Ingredient Family</div>`;
        sortedT2.forEach(item => { html += renderCardHTML(item, 'Ingredient Match'); });
      }
    }

    const globalList = ingredients.filter(i => 
      !cleanQ ? (!tier1SameSubtype.includes(i) && !tier2SameIngredient.includes(i)) :
      (i.name?.toLowerCase().includes(cleanQ) || i.brand?.toLowerCase().includes(cleanQ) || i.subtype?.toLowerCase().includes(cleanQ))
    );

    const sortedT3 = sortItems(globalList).slice(0, 30);
    if (sortedT3.length > 0) {
      html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;margin:16px 0 8px 0;">
        ${cleanQ ? 'Search Results' : 'Tier 3: Full Product Catalog'} (${sortedT3.length})
      </div>`;
      sortedT3.forEach(item => { html += renderCardHTML(item, item.subtype || ''); });
    }

    if (!html) {
      html = `<div style="text-align:center;padding:30px;color:#94a3b8;font-size:14px;">No matching products found.</div>`;
    }

    listEl.innerHTML = html;

    listEl.querySelectorAll('.pp-swap-card').forEach(card => {
      card.onclick = () => {
        const selectedId = card.dataset.ingId;
        const selectedProduct = ingredients.find(i => (i.id || i.name) === selectedId) || { name: selectedId };
        executeSwapInState(groupKey, itemKey, selectedProduct, currentScope);
        overlay.remove();
      };
    });
  }

  renderList();

  if (searchInput) searchInput.oninput = (e) => renderList(e.target.value);
  if (sortSelect) sortSelect.onchange = (e) => { currentSort = e.target.value; renderList(searchInput.value); };
  
  const closeBtn = container.querySelector('#pp-modal-close');
  if (closeBtn) closeBtn.onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

export async function executeSwapInState(groupKey, itemKey, newProduct, scope) {
  console.log(`[Swap Executed v3.7.4] Scope: ${scope}, Target Group: ${groupKey}, Item: ${itemKey}, Replacement:`, newProduct);

  const shoppingLists = ['confirmedShopping', 'shoppingList', 'generatedList'];

  shoppingLists.forEach(listKey => {
    if (!Array.isArray(window.state?.[listKey])) return;

    window.state[listKey].forEach(group => {
      if (!group) return;
      if (scope === 'recipe' && group.key !== groupKey && group.id !== groupKey) return;

      if (Array.isArray(group.items)) {
        group.items.forEach(item => {
          if (!item) return;
          const { item: targetItem } = resolveTargetItem(groupKey, itemKey);
          if (item.key === itemKey || item.id === itemKey || (targetItem && item.name === targetItem.name)) {
            item.name = newProduct.name;
            item.brand = newProduct.brand || '';
            item.ingredientId = newProduct.id || item.ingredientId;
            item.price = newProduct.price || item.price;
            item.protein = newProduct.protein || item.protein;
            item.calories = newProduct.calories || item.calories;
          }
        });
      }
    });
  });

  if (window.state?.plan && typeof window.state.plan === 'object') {
    window.state.plan.productSelections = window.state.plan.productSelections || {};
    window.state.plan.productSelections[itemKey] = newProduct.id || newProduct.name;
    saveCurrentPlan(window.state.plan).catch(e => console.warn('[ProductSwapModal v3.7.4] Error updating plan with swapped product:', e));
  }

  document.dispatchEvent(new CustomEvent('plateplan:state:shopping', { detail: window.state?.confirmedShopping }));
  document.dispatchEvent(new CustomEvent('plateplan:state:plan', { detail: window.state?.plan }));

  if (typeof window.renderShoppingList === 'function') {
    window.renderShoppingList();
  }

  if (typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast(`Swapped to "${newProduct.name}" (${newProduct.brand || 'Generic'})`);
  }
}
