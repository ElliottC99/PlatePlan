/**
 * src/components/ProductSwapModal.js (v3.31.21)
 * Robust modal component for 3-tier product & brand substitution.
 * Features relational tier filtering using window.state.products,
 * tabbed tier navigation, "Apply Substitution" button, and reactive UI refresh.
 */

import { saveCurrentPlan } from '../services/HouseholdRepository.js';
import { calculateShoppingItemCost } from '../services/ShoppingCalculationService.js';
import { setShoppingList } from '../store/store.js';

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function escapeAttr(str) { return escapeHtml(str); }

export function inferSubtype(item) {
  if (!item) return 'Produce & Staples';
  const ingredients = Array.isArray(window.state?.ingredients) ? window.state.ingredients : [];

  // Safely drill into bankIng if the item is a shopping list wrapper
  const target = item.bankIng || item;
  const prodIngId = target.ingredientId || target.groupId || target.familyId;
  const prodSubId = target.subtypeId || target.subTypeId;

  let parentIng = prodIngId ? ingredients.find(i => String(i.id) === String(prodIngId)) : null;
  if (!parentIng && prodSubId) {
    parentIng = ingredients.find(i => Array.isArray(i.subtypes) && i.subtypes.some(s => String(s.id) === String(prodSubId))) || null;
  }

  const subObj = (parentIng?.subtypes || []).find(s => String(s.id) === String(prodSubId));
  return subObj?.name || parentIng?.name || target.subtype || target.category || target.cat || 'Produce & Staples';
}

export function calculateMetrics(item) {
  const protein = Number(item?.protein || item?.macros?.protein || 0);
  const kcal = Number(item?.calories || item?.kcal || item?.macros?.calories || 0);
  const price = Number(item?.price || item?.cost || 0);
  return { protein, kcal, price, proteinPerKcal: kcal > 0 ? (protein / kcal) : 0, proteinPerPound: price > 0 ? (protein / price) : 0 };
}

export function resolveTargetItem(param1, param2, param3) {
  const keys = [param1, param2, param3].filter(k => k && typeof k === 'string' && k.trim() !== '');
  const sources = [window.state?.confirmedShopping, window.state?.shoppingList, window.state?.generatedList];

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
  return { item: { name: keys[0] || 'Selected Product', id: keys[0] || 'item_unknown' }, group: null, source: null };
}

export function renderScrollableSwapModal(param1, param2, param3, optionalContext = {}) {
  const existing = document.getElementById('pp-swap-product-modal');
  if (existing) existing.remove();

  let ctx = optionalContext || {};
  if (typeof param3 === 'object' && param3 !== null) {
    ctx = { ...ctx, ...param3 }; param3 = null;
  } else if (typeof param3 === 'string' && !ctx.instanceId && (param3.startsWith('prep_') || param3.startsWith('instance_') || param3.includes('_') || param3.includes(':'))) {
    ctx = { ...ctx, instanceId: param3 }; param3 = null;
  }

  const { item: targetItem, group: targetGroup } = resolveTargetItem(param1, param2, param3);
  const products = Array.isArray(window.state?.products) ? window.state.products : [];
  const targetSubId = targetItem?.bankIng?.subTypeId || targetItem?.bankIng?.subtypeId || targetItem?.subTypeId || targetItem?.subtypeId;
  const targetIngId = targetItem?.bankIng?.ingredientId || targetItem?.groupId || targetItem?.ingredientId;

  const tier1Subtypes = products.filter(p => p.id !== targetItem?.id && targetSubId && (p.subTypeId === targetSubId || p.subtypeId === targetSubId));
  const tier2Items = products.filter(p => p.id !== targetItem?.id && !tier1Subtypes.some(t => t.id === p.id) && targetIngId && (p.ingredientId === targetIngId || p.groupId === targetIngId));
  const targetSubtype = inferSubtype(targetItem);

  let currentSort = 'relevance', currentScope = (ctx?.instanceId || window.currentPreviewInstanceId) ? 'recipe' : 'global', currentTierTab = 'tier1', selectedSubstituteProduct = null;

  const overlay = document.createElement('div');
  overlay.id = 'pp-swap-product-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:999999;display:flex;align-items:center;justify-content:center;';

  const container = document.createElement('div');
  container.style.cssText = 'background:#fff;width:94%;max-width:620px;max-height:88vh;border-radius:16px;display:flex;flex-direction:column;box-shadow:0 24px 48px rgba(0,0,0,0.22);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

  const currentProductName = targetItem?.brand ? `${targetItem.brand} - ${targetItem.name}` : (targetItem?.name || 'Item');

  container.innerHTML = `
    <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;background:#fafafa;">
      <div>
        <h3 style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">Swap Product / Brand</h3>
        <p style="margin:2px 0 0;font-size:13px;color:#64748b;">Swapping ${escapeHtml(targetSubtype)} &rarr; <strong style="color:#2563eb;">${escapeHtml(currentProductName)}</strong></p>
      </div>
      <button id="pp-modal-close" class="modal-close-btn" aria-label="Close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#94a3b8;line-height:1;padding:4px 8px;border-radius:6px;">&times;</button>
    </div>
    <div style="padding:12px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <span style="font-size:12px;font-weight:600;color:#475569;">Apply Substitution:</span>
        <div style="display:flex;gap:4px;background:#e2e8f0;padding:2px;border-radius:8px;">
          <button type="button" id="pp-scope-recipe" class="pp-scope-btn" style="border:none;background:${currentScope === 'recipe' ? '#fff' : 'transparent'};color:${currentScope === 'recipe' ? '#2563eb' : '#64748b'};padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:${currentScope === 'recipe' ? '700' : '600'};">Recipe Specific</button>
          <button type="button" id="pp-scope-global" class="pp-scope-btn" style="border:none;background:${currentScope === 'global' ? '#fff' : 'transparent'};color:${currentScope === 'global' ? '#2563eb' : '#64748b'};padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:${currentScope === 'global' ? '700' : '600'};">Global Shopping List</button>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <label for="pp-product-search" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Search substitute products</label>
        <input type="text" id="pp-product-search" name="productSubstituteSearch" aria-label="Search substitute products" placeholder="🔍 Search substitute products..." style="flex:1;min-width:0;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;outline:none;">
        <select id="pp-product-sort" name="productSubstituteSort" aria-label="Sort options" style="flex:0 0 140px;max-width:140px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;background:#fff;cursor:pointer;">
          <option value="relevance">Sort: Default</option>
          <option value="name">Sort: Name (A-Z)</option>
          <option value="proteinPerKcal">Sort: Protein / kcal</option>
          <option value="proteinPerPound">Sort: Protein / £</option>
          <option value="price">Sort: Price (Low to High)</option>
        </select>
      </div>
    </div>
    <div id="pp-tier-tabs" style="display:flex;gap:4px;padding:8px 20px 0 20px;border-bottom:1px solid #e2e8f0;background:#fff;overflow-x:auto;">
      <button type="button" class="pp-tier-tab" data-tier="tier1" style="border:none;background:none;padding:6px 12px;font-size:12px;font-weight:700;color:#2563eb;border-bottom:2px solid #2563eb;cursor:pointer;white-space:nowrap;">Tier 1: Sub-Types</button>
      <button type="button" class="pp-tier-tab" data-tier="tier2" style="border:none;background:none;padding:6px 12px;font-size:12px;font-weight:600;color:#64748b;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;">Tier 2: Items</button>
      <button type="button" class="pp-tier-tab" data-tier="tier3" style="border:none;background:none;padding:6px 12px;font-size:12px;font-weight:600;color:#64748b;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;">Tier 3: Global</button>
    </div>
    <div id="pp-product-list" style="padding:16px 20px;overflow-y:auto;flex-grow:1;max-height:40vh;"></div>
    <div style="padding:14px 20px;border-top:1px solid #e2e8f0;background:#fafafa;display:flex;justify-content:space-between;align-items:center;">
      <div id="pp-selected-preview" style="font-size:12px;color:#64748b;">No substitute selected</div>
      <button type="button" id="pp-apply-substitution" class="btn primary" disabled style="opacity:0.5;cursor:not-allowed;font-weight:700;padding:8px 18px;border-radius:8px;">Apply Substitution</button>
    </div>`;

  overlay.appendChild(container);
  document.body.appendChild(overlay);

  const listEl = container.querySelector('#pp-product-list');
  const searchInput = container.querySelector('#pp-product-search');
  const sortSelect = container.querySelector('#pp-product-sort');
  const scopeRecipeBtn = container.querySelector('#pp-scope-recipe');
  const scopeGlobalBtn = container.querySelector('#pp-scope-global');
  const applyBtn = container.querySelector('#pp-apply-substitution');
  const selectedPreviewEl = container.querySelector('#pp-selected-preview');

  const updateScopeButtons = () => {
    if (!scopeRecipeBtn || !scopeGlobalBtn) return;
    scopeRecipeBtn.style.background = currentScope === 'recipe' ? '#fff' : 'transparent';
    scopeRecipeBtn.style.color = currentScope === 'recipe' ? '#2563eb' : '#64748b';
    scopeGlobalBtn.style.background = currentScope === 'global' ? '#fff' : 'transparent';
    scopeGlobalBtn.style.color = currentScope === 'global' ? '#2563eb' : '#64748b';
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

  function renderList(query = '') {
    const cleanQ = query.toLowerCase().trim();
    const matchesQuery = (item) => !cleanQ || (item.name?.toLowerCase().includes(cleanQ) || item.brand?.toLowerCase().includes(cleanQ) || inferSubtype(item).toLowerCase().includes(cleanQ));
    let displayItems = [];
    if (currentTierTab === 'tier1') {
      displayItems = sortItems(tier1Subtypes.filter(matchesQuery));
    } else if (currentTierTab === 'tier2') {
      displayItems = sortItems(tier2Items.filter(matchesQuery));
    } else {
      displayItems = sortItems(products.filter(p => p.id !== targetItem?.id && matchesQuery(p))).slice(0, 50);
    }

    if (displayItems.length === 0) {
      listEl.innerHTML = `<div style="text-align:center;padding:28px;color:#94a3b8;font-size:13px;">No substitute products found in this tier.</div>`;
      return;
    }

    listEl.innerHTML = displayItems.map(item => {
      const metrics = calculateMetrics(item);
      const isSelected = selectedSubstituteProduct && (selectedSubstituteProduct.id === item.id || selectedSubstituteProduct.name === item.name);
      return `<div class="pp-swap-card" data-ing-id="${escapeAttr(item.id || item.name)}" style="padding:12px 14px;border:2px solid ${isSelected ? '#2563eb' : '#e2e8f0'};border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all 0.15s ease;background:${isSelected ? '#eff6ff' : '#fff'};"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><div><span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">${escapeAttr(item.brand || '')}</span><div style="font-weight:650;color:#1e293b;font-size:14px;margin-top:1px;">${escapeHtml(item.name)}</div></div><span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:#e0f2fe;color:#0369a1;">${escapeHtml(inferSubtype(item))}</span></div><div style="margin-top:8px;display:flex;flex-wrap:gap:6px;">${metrics.price ? `<span style="font-size:11px;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;">£${metrics.price.toFixed(2)}</span>` : ''}${metrics.protein ? `<span style="font-size:11px;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;">${metrics.protein}g protein</span>` : ''}</div></div>`;
    }).join('');

    listEl.querySelectorAll('.pp-swap-card').forEach(card => {
      card.onclick = () => {
        const selectedId = card.dataset.ingId;
        selectedSubstituteProduct = products.find(p => String(p.id) === String(selectedId) || p.name === selectedId) || { name: selectedId };
        listEl.querySelectorAll('.pp-swap-card').forEach(c => { c.style.borderColor = '#e2e8f0'; c.style.background = '#fff'; });
        card.style.borderColor = '#2563eb'; card.style.background = '#eff6ff';
        if (selectedPreviewEl) {
          selectedPreviewEl.innerHTML = `Selected: <strong style="color:#0f172a;">${escapeHtml(selectedSubstituteProduct.brand ? selectedSubstituteProduct.brand + ' - ' : '')}${escapeHtml(selectedSubstituteProduct.name)}</strong>`;
        }
        if (applyBtn) { applyBtn.disabled = false; applyBtn.style.opacity = '1'; applyBtn.style.cursor = 'pointer'; }
      };
    });
  }

  renderList();
  if (searchInput) searchInput.oninput = (e) => renderList(e.target.value);
  if (sortSelect) sortSelect.onchange = (e) => { currentSort = e.target.value; renderList(searchInput?.value || ''); };

  if (applyBtn) {
    applyBtn.onclick = () => {
      if (!selectedSubstituteProduct) return;
      executeSwapInState(param1, param2, selectedSubstituteProduct, currentScope, targetItem, ctx);
      overlay.remove();
    };
  }

  const closeBtn = container.querySelector('#pp-modal-close');
  if (closeBtn) closeBtn.onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

export async function executeSwapInState(param1, param2, newProduct, scope = 'global', resolvedTarget = null, context = {}) {
  const targetItem = resolvedTarget || resolveTargetItem(param1, param2).item;
  const targetName = targetItem?.name || '';
  const targetKey = targetItem?.key || targetItem?.id || targetItem?.ingredientId || param1 || param2;
  const instanceId = context?.instanceId || window.currentPreviewInstanceId || targetItem?.instanceId || null;

  const priceDelta = Math.round((Number(newProduct.price || newProduct.cost || 0) - Number(targetItem?.price || targetItem?.cost || 0)) * 100) / 100;

  const subPayload = {
    id: newProduct.id || newProduct.name,
    productId: newProduct.id,
    name: newProduct.name,
    brand: newProduct.brand || '',
    price: Number(newProduct.price || newProduct.cost || 0),
    priceDelta,
    scope,
    instanceId,
    timestamp: Date.now()
  };

  if (!window.state) window.state = {};
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

  // Update shopping lists in state and trigger reactive store dispatch
  const shoppingLists = ['confirmedShopping', 'shoppingList', 'generatedList'];
  shoppingLists.forEach(listKey => {
    if (!Array.isArray(window.state?.[listKey])) return;
    window.state[listKey].forEach(group => {
      if (!group) return;
      const items = Array.isArray(group.items) ? group.items : (Array.isArray(group) ? group : []);
      items.forEach(item => {
        if (!item) return;
        if (item.id === targetKey || item.key === targetKey || item.ingredientId === targetKey || (targetName && item.name === targetName)) {
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

  if (Array.isArray(window.state.shoppingList)) {
    setShoppingList(window.state.shoppingList);
  }

  saveCurrentPlan(window.state.plan).catch(e => console.warn('[ProductSwapModal] Plan save error:', e));

  document.dispatchEvent(new CustomEvent('plateplan:state:shopping', { detail: window.state?.confirmedShopping || window.state?.shoppingList }));
  document.dispatchEvent(new CustomEvent('plateplan:state:plan', { detail: window.state?.plan }));

  if (typeof window.renderPlannerWizard === 'function') {
    window.renderPlannerWizard();
  }

  if (typeof window.renderShoppingListUI === 'function') {
    window.renderShoppingListUI();
  } else if (typeof window.renderShoppingList === 'function') {
    window.renderShoppingList();
  } else if (typeof window.renderShopping === 'function') {
    window.renderShopping();
  }

  if (typeof window.renderPlan === 'function') {
    window.renderPlan();
  }
  if (typeof window.renderRecipePreview === 'function' && window.previewBaseRecipe) {
    try { window.renderRecipePreview(); } catch (_e) {}
  }

  if (typeof window.showPlatePlanToast === 'function') {
    const scopeLabel = scope === 'recipe' ? 'for this recipe' : 'across shopping list';
    window.showPlatePlanToast(`Swapped to "${newProduct.name}" ${scopeLabel}`);
  }
}

export function toggleInlineShoppingSubst(itemKey, groupId = '', instanceId = null) {
  renderScrollableSwapModal(itemKey, groupId, null, { instanceId });
}

if (typeof window !== 'undefined') {
  window.toggleInlineShoppingSubst = toggleInlineShoppingSubst;
}
