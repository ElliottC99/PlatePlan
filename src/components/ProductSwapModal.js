import { getCanonicalIngredientId, calculateShoppingItemCost } from '../services/ShoppingCalculationService.js';
import { store, setActivePlan, setShoppingList } from '../store/store.js';
import { getEffectiveRecipeFitScore } from '../services/FitScoreService.js';
import { UnitConverter } from '../services/UnitConverter.js';

/**
 * src/components/ProductSwapModal.js (v3.31.32)
 * Relational 3-tier product swap modal with native Fit Score delta calculations,
 * Store action dispatching, and pure ES6 module architecture.
 */

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function escapeAttr(str) { return escapeHtml(str); }

export function inferSubtype(item) {
  if (!item) return 'Produce & Staples';
  const state = store.getState();
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : Object.values(state.ingredientsBank || {});
  const target = item.bankIng || item;
  const ingId = target.ingredientId || target.groupId || target.familyId;
  const subId = target.subTypeId || target.subtypeId;

  let parentIng = ingId ? ingredients.find(i => String(i.id) === String(ingId)) : null;
  if (!parentIng && subId) {
    parentIng = ingredients.find(i => Array.isArray(i.subtypes) && i.subtypes.some(s => String(s.id) === String(subId))) || null;
  }
  const subObj = (parentIng?.subtypes || []).find(s => String(s.id) === String(subId));
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
  const state = store.getState();

  const sources = [
    state.shoppingList,
    state.confirmedShopping,
    state.generatedList
  ];

  for (const items of sources) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item) continue;
      for (const k of keys) {
        if (item.key === k || item.id === k || item.name === k || item.groupId === k || item.ingredientId === k || String(item.name).toLowerCase() === k.toLowerCase()) {
          return { item, group: null, source: items };
        }
      }
    }
  }

  const products = Array.isArray(state.products) ? state.products : Object.values(state.productsBank || {});
  const fallbackProd = products[0] || { name: keys[0] || 'Selected Product', id: 'item_unknown', groupId: 'ing_1791021416243' };
  return { item: fallbackProd, group: null, source: null };
}

export async function executeSwapInState(targetItem, newProduct, ctx = {}) {
  if (!targetItem || !newProduct) return;
  const state = store.getState();
  const canonicalIngId = getCanonicalIngredientId(targetItem, state.ingredients || []);
  const updatedPlan = JSON.parse(JSON.stringify(state.currentPlan || state.plan || {}));

  updatedPlan.substitutions = updatedPlan.substitutions || {};
  updatedPlan.productSelections = updatedPlan.productSelections || {};

  const subPayload = {
    productId: newProduct.id,
    productName: newProduct.name,
    brand: newProduct.brand || '',
    price: newProduct.price || 0,
    timestamp: Date.now()
  };

  if (ctx.cookingEventId && canonicalIngId) {
    updatedPlan.substitutions[`${ctx.cookingEventId}:${canonicalIngId}`] = subPayload;
  } else if (canonicalIngId) {
    updatedPlan.substitutions[canonicalIngId] = subPayload;
  }
  if (canonicalIngId) {
    updatedPlan.productSelections[canonicalIngId] = newProduct.id;
  }

  setActivePlan(updatedPlan);
}

export function renderScrollableSwapModal(param1, param2, param3, optionalContext = {}) {
  const existing = document.getElementById('pp-swap-product-modal');
  if (existing) existing.remove();

  const ctx = optionalContext || {};
  const state = store.getState();
  const { item: targetItem } = resolveTargetItem(param1, param2, param3);
  const products = Array.isArray(state.products) ? state.products : Object.values(state.productsBank || {});
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : Object.values(state.ingredientsBank || {});

  const canonicalIngId = getCanonicalIngredientId(targetItem, ingredients);
  const targetIngId = canonicalIngId || targetItem?.groupId || targetItem?.ingredientId;

  let targetSubId = targetItem?.bankIng?.subTypeId || targetItem?.bankIng?.subtypeId || targetItem?.subTypeId || targetItem?.subtypeId;
  if (!targetSubId && targetIngId) {
    const parentIng = ingredients.find(i => String(i.id) === String(targetIngId));
    if (parentIng && Array.isArray(parentIng.subtypes)) {
      const matchedSub = parentIng.subtypes.find(s => s.name === targetItem.name) || parentIng.subtypes[0];
      targetSubId = matchedSub?.id;
    }
  }

  const tier1Items = products.filter(p => p.id !== targetItem?.id && targetSubId && (p.subTypeId === targetSubId || p.subtypeId === targetSubId));
  const tier2Items = products.filter(p => p.id !== targetItem?.id && !tier1Items.some(t => t.id === p.id) && targetIngId && (p.ingredientId === targetIngId || p.groupId === targetIngId));
  const tier3Items = products;
  const targetSubtype = inferSubtype(targetItem);

  let currentSort = 'relevance', currentTierTab = 'tier1', selectedSubstituteProduct = null;

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
    <div style="padding:12px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
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
      <button type="button" class="pp-tier-tab" data-tier="tier2" style="border:none;background:none;padding:6px 12px;font-size:12px;font-weight:600;color:#64748b;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;">Tier 2: Item Family</button>
      <button type="button" class="pp-tier-tab" data-tier="tier3" style="border:none;background:none;padding:6px 12px;font-size:12px;font-weight:600;color:#64748b;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;">Tier 3: Global Catalog</button>
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
  const applyBtn = container.querySelector('#pp-apply-substitution');
  const closeBtn = container.querySelector('#pp-modal-close');
  const selectedPreviewEl = container.querySelector('#pp-selected-preview');

  closeBtn.addEventListener('click', () => overlay.remove());

  container.querySelectorAll('.pp-tier-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTierTab = tab.dataset.tier;
      container.querySelectorAll('.pp-tier-tab').forEach(t => {
        const isActive = t === tab;
        t.style.fontWeight = isActive ? '700' : '600';
        t.style.color = isActive ? '#2563eb' : '#64748b';
        t.style.borderBottom = isActive ? '2px solid #2563eb' : '2px solid transparent';
      });
      renderList(searchInput?.value || '');
    });
  });

  searchInput.addEventListener('input', () => renderList(searchInput.value));
  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    renderList(searchInput.value);
  });

  applyBtn.addEventListener('click', async () => {
    if (!selectedSubstituteProduct) return;
    await executeSwapInState(targetItem, selectedSubstituteProduct, ctx);
    overlay.remove();
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
      displayItems = sortItems(tier1Items.filter(matchesQuery));
    } else if (currentTierTab === 'tier2') {
      displayItems = sortItems(tier2Items.filter(matchesQuery));
    } else {
      displayItems = sortItems(tier3Items.filter(p => p.id !== targetItem?.id && matchesQuery(p))).slice(0, 50);
    }

    if (displayItems.length === 0) {
      listEl.innerHTML = `<div style="text-align:center;padding:28px;color:#94a3b8;font-size:13px;">No substitute products found in this tier.</div>`;
      return;
    }

    const recipes = Array.isArray(state.recipes) ? state.recipes : [];
    const recipe = recipes.find(r => r && (String(r.id) === String(targetItem?.recipeId) || String(r.id) === String(ctx?.recipeId))) || recipes[0] || null;

    listEl.innerHTML = displayItems.map(item => {
      const metrics = calculateMetrics(item);
      const isSelected = selectedSubstituteProduct && (selectedSubstituteProduct.id === item.id || selectedSubstituteProduct.name === item.name);

      let diffBadge = '';
      if (recipe && typeof getEffectiveRecipeFitScore === 'function') {
        const baseScore = Math.round(getEffectiveRecipeFitScore(recipe, 'dinner').score || 0);
        const servingGrams = (UnitConverter.toGrams(targetItem?.needQty || targetItem?.grams || 100, targetItem?.unit || 'g') || 100) / (recipe.serves || 4);
        const deltaProt = ((Number(item.protein || item.prot || 0) - Number(targetItem?.protein || targetItem?.bankIng?.protein || 0)) / 100) * servingGrams;
        const deltaCal = ((Number(item.calories || item.kcal || item.cal || 0) - Number(targetItem?.calories || targetItem?.bankIng?.kcal || 0)) / 100) * servingGrams;

        const baseProt = Number(recipe.perServing?.protein || recipe.protein || 0);
        const baseCal = Number(recipe.perServing?.calories || recipe.calories || 0);
        const simulatedRecipe = {
          ...recipe,
          perServing: { ...recipe.perServing, protein: Math.max(0, baseProt + deltaProt), calories: Math.max(0, baseCal + deltaCal) }
        };
        const newScore = Math.round(getEffectiveRecipeFitScore(simulatedRecipe, 'dinner').score || 0);
        const diff = newScore - baseScore;
        diffBadge = `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:${diff >= 0 ? '#dcfce7' : '#fef3c7'};color:${diff >= 0 ? '#15803d' : '#b45309'};margin-left:auto;">[${diff >= 0 ? '+' + diff : diff} - ${baseScore} &rarr; ${newScore}]</span>`;
      }

      return `<div class="pp-swap-card" data-ing-id="${escapeAttr(item.id || item.name)}" style="padding:12px 14px;border:2px solid ${isSelected ? '#2563eb' : '#e2e8f0'};border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all 0.15s ease;background:${isSelected ? '#eff6ff' : '#fff'};"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><div><span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">${escapeAttr(item.brand || '')}</span><div style="font-weight:650;color:#1e293b;font-size:14px;margin-top:1px;">${escapeHtml(item.name)}</div></div><div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:#e0f2fe;color:#0369a1;">${escapeHtml(inferSubtype(item))}</span>${diffBadge}</div></div><div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">${metrics.price ? `<span style="font-size:11px;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;">£${metrics.price.toFixed(2)}</span>` : ''}${metrics.protein ? `<span style="font-size:11px;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;">${metrics.protein}g protein</span>` : ''}</div></div>`;
    }).join('');

    listEl.querySelectorAll('.pp-swap-card').forEach(card => {
      card.addEventListener('click', () => {
        const item = displayItems.find(p => String(p.id || p.name) === String(card.dataset.ingId));
        if (!item) return;
        selectedSubstituteProduct = item;
        selectedPreviewEl.innerHTML = `<strong style="color:#0f172a;">${escapeHtml(item.brand ? item.brand + ' - ' + item.name : item.name)}</strong> selected`;
        applyBtn.disabled = false;
        applyBtn.style.opacity = '1';
        applyBtn.style.cursor = 'pointer';
        renderList(searchInput.value);
      });
    });
  }

  renderList();
}

export function toggleInlineShoppingSubst(itemId) {
  renderScrollableSwapModal(itemId);
}
