/**
 * src/components/ProductSwapModal.js (v3.15.4)
 * Robust modal component for 3-tier product & brand substitution.
 * Features tabbed tier navigation, responsive toolbar layout,
 * standardized close buttons, recipe vs global scoping, and reactive re-renders.
 */

import { saveCurrentPlan } from '../services/HouseholdRepository.js';
import { calculateShoppingItemCost } from '../services/ShoppingCalculationService.js';

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

export function renderScrollableSwapModal(param1, param2, param3, optionalContext = {}) {
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
  let currentScope = (optionalContext?.instanceId || window.currentPreviewInstanceId) ? 'recipe' : 'global';
  let currentTierTab = 'all';

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
      <button id="pp-modal-close" class="modal-close-btn" aria-label="Close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#94a3b8;line-height:1;padding:4px 8px;border-radius:6px;">&times;</button>
    </div>

    <div style="padding:12px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <span style="font-size:12px;font-weight:600;color:#475569;">Apply Substitution:</span>
        <div style="display:flex;gap:4px;background:#e2e8f0;padding:2px;border-radius:8px;">
          <button type="button" id="pp-scope-recipe" class="pp-scope-btn ${currentScope === 'recipe' ? 'active' : ''}" style="border:none;background:${currentScope === 'recipe' ? '#fff' : 'transparent'};color:${currentScope === 'recipe' ? '#2563eb' : '#64748b'};padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:${currentScope === 'recipe' ? '700' : '600'};box-shadow:${currentScope === 'recipe' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'};">Recipe Specific</button>
          <button type="button" id="pp-scope-global" class="pp-scope-btn ${currentScope === 'global' ? 'active' : ''}" style="border:none;background:${currentScope === 'global' ? '#fff' : 'transparent'};color:${currentScope === 'global' ? '#2563eb' : '#64748b'};padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:${currentScope === 'global' ? '700' : '600'};box-shadow:${currentScope === 'global' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'};">Global Shopping List</button>
        </div>
      </div>

      <div style="display:flex;gap:10px;align-items:center;">
        <label for="pp-product-search" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Search substitute products</label>
        <input type="text" id="pp-product-search" name="productSubstituteSearch" aria-label="Search substitute products" placeholder="🔍 Search substitute products..." style="flex:1;min-width:0;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;outline:none;">
        <select id="pp-product-sort" name="productSubstituteSort" aria-label="Sort options" style="flex:0 0 140px;max-width:140px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;background:#fff;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          <option value="relevance">Sort: Default</option>
          <option value="name">Sort: Name (A-Z)</option>
          <option value="proteinPerKcal">Sort: Protein / kcal</option>
          <option value="proteinPerPound">Sort: Protein / £</option>
          <option value="price">Sort: Price (Low to High)</option>
        </select>
      </div>
    </div>

    <div id="pp-tier-tabs" style="display:flex;gap:4px;padding:8px 20px 0 20px;border-bottom:1px solid #e2e8f0;background:#fff;overflow-x:auto;">
      <button type="button" class="pp-tier-tab" data-tier="all" style="border:none;background:none;padding:6px 12px;font-size:12px;font-weight:700;color:#2563eb;border-bottom:2px solid #2563eb;cursor:pointer;white-space:nowrap;">All</button>
      <button type="button" class="pp-tier-tab" data-tier="tier1" style="border:none;background:none;padding:6px 12px;font-size:12px;font-weight:600;color:#64748b;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;">Tier 1: Subtype</button>
      <button type="button" class="pp-tier-tab" data-tier="tier2" style="border:none;background:none;padding:6px 12px;font-size:12px;font-weight:600;color:#64748b;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;">Tier 2: Family</button>
      <button type="button" class="pp-tier-tab" data-tier="tier3" style="border:none;background:none;padding:6px 12px;font-size:12px;font-weight:600;color:#64748b;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;">Tier 3: All Catalog</button>
    </div>

    <div id="pp-product-list" style="padding:16px 20px;overflow-y:auto;flex-grow:1;"></div>
  `;

  overlay.appendChild(container);
  document.body.appendChild(overlay);

  const listEl = container.querySelector('#pp-product-list');
  const searchInput = container.querySelector('#pp-product-search');
  const sortSelect = container.querySelector('#pp-product-sort');
  const scopeRecipeBtn = container.querySelector('#pp-scope-recipe');
  const scopeGlobalBtn = container.querySelector('#pp-scope-global');

  const updateScopeButtons = () => {
    if (scopeRecipeBtn && scopeGlobalBtn) {
      scopeRecipeBtn.style.background = currentScope === 'recipe' ? '#fff' : 'transparent';
      scopeRecipeBtn.style.color = currentScope === 'recipe' ? '#2563eb' : '#64748b';
      scopeRecipeBtn.style.fontWeight = currentScope === 'recipe' ? '700' : '600';
      scopeRecipeBtn.style.boxShadow = currentScope === 'recipe' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none';

      scopeGlobalBtn.style.background = currentScope === 'global' ? '#fff' : 'transparent';
      scopeGlobalBtn.style.color = currentScope === 'global' ? '#2563eb' : '#64748b';
      scopeGlobalBtn.style.fontWeight = currentScope === 'global' ? '700' : '600';
      scopeGlobalBtn.style.boxShadow = currentScope === 'global' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none';
    }
  };

  if (scopeRecipeBtn) scopeRecipeBtn.onclick = () => { currentScope = 'recipe'; updateScopeButtons(); };
  if (scopeGlobalBtn) scopeGlobalBtn.onclick = () => { currentScope = 'global'; updateScopeButtons(); };

  container.querySelectorAll('.pp-tier-tab').forEach(tab => {
    tab.onclick = () => {
      currentTierTab = tab.dataset.tier;
      container.querySelectorAll('.pp-tier-tab').forEach(t => {
        const isActive = t === tab;
        t.style.fontWeight = isActive ? '700' : '600';
        t.style.color = isActive ? '#2563eb' : '#64748b';
        t.style.borderBottom = isActive ? '2px solid #2563eb' : '2px solid transparent';
      });
      renderList(searchInput?.value || '');
    };
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

    const matchesQuery = (item) => !cleanQ || (item.name?.toLowerCase().includes(cleanQ) || item.brand?.toLowerCase().includes(cleanQ) || inferSubtype(item).toLowerCase().includes(cleanQ));

    const filteredT1 = sortItems(tier1SameSubtype.filter(matchesQuery));
    const filteredT2 = sortItems(tier2SameIngredient.filter(matchesQuery));

    const globalCatalog = ingredients.filter(i => {
      if ((i.id && i.id === targetItem?.id) || (i.name && i.name.toLowerCase() === targetName)) return false;
      if (!cleanQ && (tier1SameSubtype.includes(i) || tier2SameIngredient.includes(i))) return false;
      return matchesQuery(i);
    });
    const filteredT3 = sortItems(globalCatalog).slice(0, 40);

    if (currentTierTab === 'tier1' || currentTierTab === 'all') {
      if (filteredT1.length > 0) {
        if (currentTierTab === 'all') html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#2563eb;margin-bottom:8px;">Tier 1: Same Subtype (${targetSubtype})</div>`;
        filteredT1.forEach(item => { html += renderCardHTML(item, 'Subtype Match', '#dbeafe', '#1e40af'); });
      } else if (currentTierTab === 'tier1') {
        html += `<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">No subtype matches found.</div>`;
      }
    }

    if (currentTierTab === 'tier2' || currentTierTab === 'all') {
      if (filteredT2.length > 0) {
        if (currentTierTab === 'all') html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#059669;margin:16px 0 8px 0;">Tier 2: Same Ingredient Family</div>`;
        filteredT2.forEach(item => { html += renderCardHTML(item, 'Family Match', '#d1fae5', '#065f46'); });
      } else if (currentTierTab === 'tier2') {
        html += `<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">No family matches found.</div>`;
      }
    }

    if (currentTierTab === 'tier3' || currentTierTab === 'all') {
      if (filteredT3.length > 0) {
        if (currentTierTab === 'all') {
          html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;margin:16px 0 8px 0;">Tier 3: Catalog Substitutes (${filteredT3.length})</div>`;
        }
        filteredT3.forEach(item => { html += renderCardHTML(item, inferSubtype(item), '#f1f5f9', '#475569'); });
      } else if (currentTierTab === 'tier3') {
        html += `<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">No catalog substitutes found.</div>`;
      }
    }

    if (!html) {
      html = `<div style="text-align:center;padding:30px;color:#94a3b8;font-size:14px;">No matching substitute products found.</div>`;
    }

    listEl.innerHTML = html;

    listEl.querySelectorAll('.pp-swap-card').forEach(card => {
      card.onclick = () => {
        const selectedId = card.dataset.ingId;
        const selectedProduct = ingredients.find(i => (i.id || i.name) === selectedId) || { name: selectedId };
        executeSwapInState(param1, param2, selectedProduct, currentScope, targetItem, optionalContext);
        overlay.remove();
      };
    });
  }

  renderList();

  if (searchInput) searchInput.oninput = (e) => renderList(e.target.value);
  if (sortSelect) sortSelect.onchange = (e) => { currentSort = e.target.value; renderList(searchInput?.value || ''); };
  
  const closeBtn = container.querySelector('#pp-modal-close');
  if (closeBtn) closeBtn.onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

export async function executeSwapInState(param1, param2, newProduct, scope = 'global', resolvedTarget = null, context = {}) {
  const targetItem = resolvedTarget || resolveTargetItem(param1, param2).item;
  const targetName = targetItem?.name || '';
  const targetKey = targetItem?.key || targetItem?.id || param1 || param2;
  const instanceId = context?.instanceId || window.currentPreviewInstanceId || targetItem?.instanceId || null;

  const priceDelta = Math.round((Number(newProduct.price || newProduct.cost || 0) - Number(targetItem?.price || targetItem?.cost || 0)) * 100) / 100;

  const subPayload = {
    id: newProduct.id || newProduct.name,
    productId: newProduct.id,
    name: newProduct.name,
    brand: newProduct.brand || 'Generic',
    price: Number(newProduct.price || newProduct.cost || 0),
    priceDelta,
    scope,
    instanceId,
    timestamp: Date.now()
  };

  if (!window.state) {
    try { window.state = {}; } catch (e) {}
  }
  if (!window.state.plan || typeof window.state.plan !== 'object') window.state.plan = {};

  if (scope === 'recipe' && instanceId) {
    window.state.plan.substitutions = window.state.plan.substitutions || {};
    window.state.plan.substitutions[`${instanceId}:${targetKey}`] = subPayload;
    window.state.overrides = window.state.overrides || {};
    window.state.overrides[instanceId] = window.state.overrides[instanceId] || { substitutions: {}, productOverrides: {} };
    window.state.overrides[instanceId].substitutions[targetKey] = newProduct.id || newProduct.name;
    window.state.overrides[instanceId].productOverrides[targetKey] = newProduct.id || newProduct.name;
  } else {
    window.state.plan.productSelections = window.state.plan.productSelections || {};
    if (targetKey) window.state.plan.productSelections[targetKey] = newProduct.id || newProduct.name;
    if (targetItem?.id) window.state.plan.productSelections[targetItem.id] = newProduct.id || newProduct.name;
    if (targetName) window.state.plan.productSelections[targetName] = newProduct.id || newProduct.name;

    window.state.plan.substitutions = window.state.plan.substitutions || {};
    window.state.plan.substitutions[targetKey || targetName] = subPayload;
  }

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
          
          const costCalc = calculateShoppingItemCost(item, newProduct);
          item.price = Number(costCalc.price);
          item.cost = Number(costCalc.cost);
          item.packsNeeded = costCalc.packsNeeded;
          item.protein = Number(newProduct.protein || item.protein || 0);
          item.calories = Number(newProduct.calories || newProduct.kcal || item.calories || 0);
          if (newProduct.subtype) item.subtype = newProduct.subtype;
          if (newProduct.packSize && newProduct.packUnit) {
            item.quantity = `${costCalc.packsNeeded > 1 ? costCalc.packsNeeded + 'x ' : ''}${newProduct.packSize}${newProduct.packUnit}`;
          }
        }
      });
    });
  });

  saveCurrentPlan(window.state.plan).catch(e => console.warn('[ProductSwapModal] Plan save error:', e));

  // Dispatch shopping and plan state change events
  document.dispatchEvent(new CustomEvent('plateplan:state:shopping', { detail: window.state?.confirmedShopping || window.state?.shoppingList }));
  document.dispatchEvent(new CustomEvent('plateplan:state:plan', { detail: window.state?.plan }));

  // Immediately invoke active shopping list rendering routines
  if (typeof window.renderShoppingListUI === 'function') {
    window.renderShoppingListUI();
  } else if (typeof window.renderShoppingList === 'function') {
    window.renderShoppingList();
  } else if (typeof window.renderShopping === 'function') {
    window.renderShopping();
  }

  if (typeof window.renderRecipePreview === 'function' && window.previewBaseRecipe) {
    try { window.renderRecipePreview(); } catch(_e) {}
  }

  if (typeof window.showPlatePlanToast === 'function') {
    const scopeLabel = scope === 'recipe' ? 'for this recipe' : 'across shopping list';
    window.showPlatePlanToast(`Swapped to "${newProduct.name}" ${scopeLabel}`);
  }
}
