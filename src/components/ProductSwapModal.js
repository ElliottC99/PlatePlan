/**
 * src/components/ProductSwapModal.js (v3.14.2)
 * Robust modal component for 3-tier product & brand substitution.
 * Handles polymorphic key lookups, persistent subtype mapping,
 * state mutations, Firestore persistence, and reactive re-rendering.
 */

import { saveCurrentPlan } from '../services/HouseholdRepository.js';

const DEFAULT_SUBTYPE_MAP = {
  onion: 'Alliums', garlic: 'Alliums', shallot: 'Alliums', leek: 'Alliums',
  carrot: 'Root Vegetables', potato: 'Root Vegetables', parsnip: 'Root Vegetables',
  broccoli: 'Brassicas', cauliflower: 'Brassicas', cabbage: 'Brassicas', kale: 'Brassicas',
  spinach: 'Leafy Greens', lettuce: 'Leafy Greens', rocket: 'Leafy Greens', salad: 'Leafy Greens',
  tomato: 'Nightshades & Peppers', pepper: 'Nightshades & Peppers', chilli: 'Nightshades & Peppers',
  mushroom: 'Fungi', lemon: 'Citrus & Fruit', lime: 'Citrus & Fruit', apple: 'Citrus & Fruit',
  chicken: 'Poultry', turkey: 'Poultry', beef: 'Red Meat', mince: 'Red Meat',
  pork: 'Red Meat', lamb: 'Red Meat', bacon: 'Red Meat', sausage: 'Red Meat',
  salmon: 'Fish & Seafood', cod: 'Fish & Seafood', tuna: 'Fish & Seafood', prawn: 'Fish & Seafood',
  tofu: 'Plant Protein', tempeh: 'Plant Protein', lentils: 'Beans & Legumes', chickpeas: 'Beans & Legumes',
  egg: 'Eggs', milk: 'Milk & Creams', cream: 'Milk & Creams', yogurt: 'Yogurt', cheese: 'Cheese',
  rice: 'Grains & Rice', pasta: 'Pasta & Noodles', noodles: 'Pasta & Noodles', bread: 'Bakery & Bread',
  oil: 'Oils & Fats', butter: 'Butter & Fats'
};

export function inferSubtype(item) {
  if (!item) return 'General Products';
  if (item.subtype) return item.subtype;
  const name = String(item.name || item.ingredient || item.raw || '').toLowerCase();
  for (const [kw, sub] of Object.entries(DEFAULT_SUBTYPE_MAP)) {
    if (name.includes(kw)) return sub;
  }
  return item.cat || item.category || 'General Products';
}

export function calculateMetrics(item) {
  const protein = Number(item?.protein || item?.macros?.protein || 0);
  const kcal = Number(item?.calories || item?.kcal || item?.macros?.calories || 0);
  const price = Number(item?.price || item?.cost || 0);
  const proteinPerKcal = kcal > 0 ? (protein / kcal) : 0;
  const proteinPerPound = price > 0 ? (protein / price) : 0;
  return { protein, kcal, price, proteinPerKcal, proteinPerPound };
}

export function resolveTargetItem(param1, param2, param3) {
  const keys = [param1, param2, param3].filter(k => k && typeof k === 'string' && k.trim() !== '');
  const sources = [
    window.state?.confirmedShopping,
    window.state?.shoppingList,
    window.state?.generatedList
  ];

  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const group of source) {
      if (!group) continue;
      const items = Array.isArray(group.items) ? group.items : (Array.isArray(group) ? group : []);
      for (const item of items) {
        if (!item) continue;
        for (const k of keys) {
          if (item.key === k || item.id === k || item.name === k || item.groupId === k || item.ingredientId === k || String(item.name).toLowerCase() === k.toLowerCase()) {
            return { item, group, source };
          }
        }
      }
    }
  }

  const ingredients = Array.isArray(window.state?.ingredients) ? window.state.ingredients : [];
  for (const k of keys) {
    const ing = ingredients.find(i => i.id === k || i.key === k || i.name === k || i.groupId === k || String(i.name).toLowerCase() === k.toLowerCase());
    if (ing) return { item: ing, group: null, source: null };
  }

  const fallbackName = keys[0] || 'Selected Product';
  return { item: { name: fallbackName, id: keys[0] || 'item_unknown' }, group: null, source: null };
}

export function renderScrollableSwapModal(param1, param2, param3) {
  const existing = document.getElementById('pp-swap-product-modal');
  if (existing) existing.remove();

  const { item: targetItem, group: targetGroup } = resolveTargetItem(param1, param2, param3);
  const ingredients = Array.isArray(window.state?.ingredients) ? window.state.ingredients : [];
  const targetSubtype = inferSubtype(targetItem);
  const targetName = String(targetItem?.name || '').toLowerCase();
  const targetGroupId = targetItem?.groupId || targetGroup?.groupId || '';

  const tier1SameSubtype = ingredients.filter(i => {
    if ((i.id && i.id === targetItem?.id) || (i.name && i.name.toLowerCase() === targetName)) return false;
    return inferSubtype(i) === targetSubtype;
  });

  const tier2SameIngredient = ingredients.filter(i => {
    if ((i.id && i.id === targetItem?.id) || (i.name && i.name.toLowerCase() === targetName)) return false;
    if (tier1SameSubtype.includes(i)) return false;
    if (targetGroupId && (i.groupId === targetGroupId || i.id === targetGroupId)) return true;
    return targetName.length > 2 && (i.name?.toLowerCase().includes(targetName) || targetName.includes(i.name?.toLowerCase()));
  });

  let currentSort = 'relevance';
  let currentScope = 'global';

  const overlay = document.createElement('div');
  overlay.id = 'pp-swap-product-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:999999;display:flex;align-items:center;justify-content:center;';

  const container = document.createElement('div');
  container.style.cssText = 'background:#fff;width:94%;max-width:620px;max-height:88vh;border-radius:16px;display:flex;flex-direction:column;box-shadow:0 24px 48px rgba(0,0,0,0.22);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

  container.innerHTML = `
    <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;background:#fafafa;">
      <div>
        <h3 style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">Swap Product / Brand</h3>
        <p style="margin:2px 0 0;font-size:13px;color:#64748b;">
          Swapping: <strong style="color:#2563eb;">${targetItem?.brand ? targetItem.brand + ' - ' : ''}${targetItem?.name || 'Item'}</strong> <span style="font-size:11px;background:#e2e8f0;padding:2px 6px;border-radius:6px;color:#475569;margin-left:4px;">${targetSubtype}</span>
        </p>
      </div>
      <button id="pp-modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#94a3b8;line-height:1;">&times;</button>
    </div>

    <div style="padding:12px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;gap:10px;">
        <input type="text" id="pp-product-search" placeholder="🔍 Search substitute products..." style="flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;outline:none;">
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

  function renderCardHTML(item, badgeText, badgeColor = '#dbeafe', textColor = '#1e40af') {
    const metrics = calculateMetrics(item);
    return `
      <div class="pp-swap-card" data-ing-id="${item.id || item.name}" style="padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all 0.15s ease;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">${item.brand || 'Generic'}</span>
            <div style="font-weight:600;color:#1e293b;font-size:14px;margin-top:1px;">${item.name}</div>
          </div>
          ${badgeText ? `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:${badgeColor};color:${textColor};">${badgeText}</span>` : ''}
        </div>
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
          ${metrics.price ? `<span style="font-size:11px;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;">£${metrics.price.toFixed(2)}</span>` : ''}
          ${metrics.protein ? `<span style="font-size:11px;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;">${metrics.protein}g protein</span>` : ''}
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
        sortedT1.forEach(item => { html += renderCardHTML(item, 'Subtype Match', '#dbeafe', '#1e40af'); });
      }

      const sortedT2 = sortItems(tier2SameIngredient);
      if (sortedT2.length > 0) {
        html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#059669;margin:16px 0 8px 0;">Tier 2: Same Ingredient Family</div>`;
        sortedT2.forEach(item => { html += renderCardHTML(item, 'Family Match', '#d1fae5', '#065f46'); });
      }
    }

    const globalList = ingredients.filter(i => {
      if ((i.id && i.id === targetItem?.id) || (i.name && i.name.toLowerCase() === targetName)) return false;
      return !cleanQ ? (!tier1SameSubtype.includes(i) && !tier2SameIngredient.includes(i)) :
        (i.name?.toLowerCase().includes(cleanQ) || i.brand?.toLowerCase().includes(cleanQ) || inferSubtype(i).toLowerCase().includes(cleanQ));
    });

    const sortedT3 = sortItems(globalList).slice(0, 35);
    if (sortedT3.length > 0) {
      html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;margin:16px 0 8px 0;">
        ${cleanQ ? 'Search Results' : 'Tier 3: Catalog Substitutes'} (${sortedT3.length})
      </div>`;
      sortedT3.forEach(item => { html += renderCardHTML(item, inferSubtype(item), '#f1f5f9', '#475569'); });
    }

    if (!html) {
      html = `<div style="text-align:center;padding:30px;color:#94a3b8;font-size:14px;">No matching products found.</div>`;
    }

    listEl.innerHTML = html;

    listEl.querySelectorAll('.pp-swap-card').forEach(card => {
      card.onclick = () => {
        const selectedId = card.dataset.ingId;
        const selectedProduct = ingredients.find(i => (i.id || i.name) === selectedId) || { name: selectedId };
        executeSwapInState(param1, param2, selectedProduct, currentScope, targetItem);
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

export async function executeSwapInState(param1, param2, newProduct, scope = 'global', resolvedTarget = null) {
  const targetItem = resolvedTarget || resolveTargetItem(param1, param2).item;
  const targetName = targetItem?.name || '';
  const targetKey = targetItem?.key || targetItem?.id || param1 || param2;

  const shoppingLists = ['confirmedShopping', 'shoppingList', 'generatedList'];
  shoppingLists.forEach(listKey => {
    if (!Array.isArray(window.state?.[listKey])) return;
    window.state[listKey].forEach(group => {
      if (!group) return;
      const items = Array.isArray(group.items) ? group.items : (Array.isArray(group) ? group : []);
      items.forEach(item => {
        if (!item) return;
        if (item.key === targetKey || item.id === targetKey || (targetName && item.name === targetName)) {
          item.name = newProduct.name;
          item.brand = newProduct.brand || '';
          item.ingredientId = newProduct.id || item.ingredientId;
          item.bankIng = newProduct;
          item.price = Number(newProduct.price || newProduct.cost || item.price || 0);
          item.cost = Number(newProduct.price || newProduct.cost || item.cost || 0);
          item.protein = Number(newProduct.protein || item.protein || 0);
          item.calories = Number(newProduct.calories || newProduct.kcal || item.calories || 0);
          if (newProduct.subtype) item.subtype = newProduct.subtype;
        }
      });
    });
  });

  if (window.state?.plan && typeof window.state.plan === 'object') {
    window.state.plan.productSelections = window.state.plan.productSelections || {};
    if (targetKey) window.state.plan.productSelections[targetKey] = newProduct.id || newProduct.name;
    if (targetItem?.id) window.state.plan.productSelections[targetItem.id] = newProduct.id || newProduct.name;
    saveCurrentPlan(window.state.plan).catch(e => console.warn('[ProductSwapModal] Plan save error:', e));
  }

  document.dispatchEvent(new CustomEvent('plateplan:state:shopping', { detail: window.state?.confirmedShopping || window.state?.shoppingList }));
  document.dispatchEvent(new CustomEvent('plateplan:state:plan', { detail: window.state?.plan }));

  if (typeof window.renderShoppingList === 'function') {
    window.renderShoppingList();
  } else if (typeof window.renderShopping === 'function') {
    window.renderShopping();
  }

  if (typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast(`Swapped to "${newProduct.name}" (${newProduct.brand || 'Generic'})`);
  }
}
