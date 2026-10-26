import { getState } from '../store/coreState.js';
import { getCanonicalIngredientId, calculateShoppingItemCost } from '../services/ShoppingCalculationService.js';
import { store, setActivePlan, setShoppingList } from '../store/store.js';
import { calculateMealFitScore } from '../utils/fitScoreCalculator.js';
import { UnitConverter } from '../services/UnitConverter.js';

/**
 * src/components/ProductSwapModal.js (v3.31.41)
 * Relational 3-tier product swap modal with unified scope identifiers,
 * root and .enhanced macro delta injection, and strict fit score badge formatting.
 */

const MAX_SWAP_RESULTS = 50;

function escapeHtml(str) { return str == null ? '' : String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function escapeAttr(str) { return escapeHtml(str); }

export function inferSubtype(item) {
  if (!item) return 'Produce & Staples';
  const state = (typeof store !== 'undefined' && store.getState) ? store.getState() : {};
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : Object.values(state.ingredientsBank || {});
  const target = item.bankIng || item;
  const ingId = target.ingredientId || target.groupId || target.familyId;
  const subId = target.subTypeId || target.subtypeId;

  let parentIng = ingId ? ingredients.find(i => String(i.id) === String(ingId)) : null;
  if (!parentIng && subId) parentIng = ingredients.find(i => Array.isArray(i.subtypes) && i.subtypes.some(s => String(s.id) === String(subId))) || null;
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
  if (param1 && typeof param1 === 'object') return { item: param1 };
  const state = (typeof store !== 'undefined' && store.getState) ? store.getState() : (getState());
  const list = Array.isArray(state.shoppingList) ? state.shoppingList : [];
  const products = Array.isArray(state.products) ? state.products : Object.values(state.productsBank || {});
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : Object.values(state.ingredientsBank || {});

  const idQuery = String(param1 || '').trim().toLowerCase();
  const nameQuery = String(param2 || '').trim().toLowerCase();

  let matched = list.find(item => {
    if (!item) return false;
    const itemId = String(item.id || '').toLowerCase();
    const itemKey = String(item.key || '').toLowerCase();
    const bankId = String(item.bankIng?.id || '').toLowerCase();
    const ingId = String(item.ingredientId || item.groupId || '').toLowerCase();
    const itemName = String(item.name || '').toLowerCase();
    const prodName = String(item.productName || item.bankIng?.name || '').toLowerCase();
    return (idQuery && (itemId === idQuery || itemKey === idQuery || bankId === idQuery || ingId === idQuery)) || (nameQuery && (itemName === nameQuery || prodName === nameQuery)) || (idQuery && itemName === idQuery);
  });

  if (!matched && idQuery) {
    const prod = products.find(p => String(p.id).toLowerCase() === idQuery || String(p.name).toLowerCase() === nameQuery);
    if (prod) matched = { id: prod.id, key: prod.id, name: prod.name, bankIng: prod, ingredientId: prod.ingredientId || prod.groupId, buyQty: 1, recipeBreakdown: [] };
  }

  if (!matched && (idQuery || nameQuery)) {
    const ing = ingredients.find(i => String(i.id).toLowerCase() === idQuery || String(i.name).toLowerCase() === nameQuery);
    if (ing) {
      const defaultProd = products.find(p => String(p.id) === String(ing.defaultProductId)) || products.find(p => String(p.ingredientId) === String(ing.id));
      matched = { id: ing.id, key: ing.id, name: ing.name, bankIng: defaultProd || ing, ingredientId: ing.id, buyQty: 1, recipeBreakdown: [] };
    }
  }

  return { item: matched || { id: param1 || 'unknown', key: param1 || 'unknown', name: param2 || param1 || 'Item', bankIng: null, buyQty: 1, recipeBreakdown: [] } };
}

export async function executeSwapInState(targetItem, newProduct, ctx = {}) {
  if (!targetItem || !newProduct) return;
  const storeState = (typeof store !== 'undefined' && store.getState) ? store.getState() : (getState());
  const bank = targetItem.bankIng || {};
  const candidateKeys = [targetItem.canonicalIngId, bank.ingredientId, bank.groupId, bank.id, targetItem.ingredientId !== targetItem.id ? targetItem.ingredientId : null, targetItem.name].filter(Boolean).map(String);

  if (candidateKeys.length === 0) {
    if (targetItem.id) candidateKeys.push(String(targetItem.id));
    if (targetItem.key && targetItem.key !== targetItem.id) candidateKeys.push(String(targetItem.key));
  }

  const activePlanKey = storeState.isDraftPlan ? 'draftPlan' : (storeState.plan ? 'plan' : 'currentPlan');
  const basePlan = storeState[activePlanKey] || storeState.currentPlan || storeState.plan || {};
  const updatedPlan = JSON.parse(JSON.stringify(basePlan));

  updatedPlan.substitutions = updatedPlan.substitutions || {};
  updatedPlan.productSelections = updatedPlan.productSelections || {};
  const subPayload = { productId: newProduct.id, productName: newProduct.name, brand: newProduct.brand || '', price: newProduct.price || 0, timestamp: Date.now() };

  const eventId = ctx?.cookingEventId || ctx?.instanceId || ctx?.prepEventId || null;
  if (eventId) {
    candidateKeys.forEach(k => { updatedPlan.substitutions[`${eventId}:${k}`] = subPayload; });
  } else {
    candidateKeys.forEach(k => {
      updatedPlan.substitutions[k] = subPayload;
      if (!updatedPlan.productSelections) updatedPlan.productSelections = {};
      updatedPlan.productSelections[k] = newProduct.id;
    });
  }

  if (typeof store !== 'undefined' && typeof store.setState === 'function') store.setState({ [activePlanKey]: updatedPlan, currentPlan: updatedPlan, plan: updatedPlan });
  if (typeof setActivePlan === 'function') setActivePlan(updatedPlan);
  else if (window.store?.setActivePlan) window.store.setActivePlan(updatedPlan);

  let updatedItems = [];
  if (typeof window.computeWizardShoppingAgg === 'function') {
    const aggResult = window.computeWizardShoppingAgg(updatedPlan);
    updatedItems = Array.isArray(aggResult) ? aggResult : (aggResult?.items || []);
  }

  if (updatedItems.length > 0) {
    if (typeof setShoppingList === 'function') setShoppingList(updatedItems);
    else if (window.store?.setShoppingList) window.store.setShoppingList(updatedItems);
  }

  document.dispatchEvent(new CustomEvent('plateplan:state:plan', { detail: updatedPlan }));
  document.dispatchEvent(new CustomEvent('plateplan:state:shopping', { detail: updatedItems }));
  if (typeof window.renderPlannerWizard === 'function') window.renderPlannerWizard();
  if (typeof window.renderShoppingListUI === 'function') window.renderShoppingListUI();
}

export function renderScrollableSwapModal(param1, param2, param3, optionalContext = {}) {
  const existing = document.getElementById('pp-swap-product-modal');
  if (existing) existing.remove();

  const ctx = optionalContext || {};
  const state = (typeof store !== 'undefined' && store.getState) ? store.getState() : {};
  const { item: targetItem } = resolveTargetItem(param1, param2, param3);
  const products = Array.isArray(state.products) ? state.products : Object.values(state.productsBank || {});
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : Object.values(state.ingredientsBank || {});

  const canonicalIngId = getCanonicalIngredientId(targetItem, ingredients);
  const targetIngId = canonicalIngId || targetItem?.groupId || targetItem?.ingredientId;
  const currentBank = targetItem?.bankIng || {};

  let targetSubId = currentBank.subTypeId || currentBank.subtypeId || targetItem?.subTypeId || targetItem?.subtypeId;
  if (!targetSubId && targetIngId) {
    const parentIng = ingredients.find(i => String(i.id) === String(targetIngId));
    if (parentIng && Array.isArray(parentIng.subtypes)) {
      targetSubId = (parentIng.subtypes.find(s => s.name === targetItem.name) || parentIng.subtypes[0])?.id;
    }
  }

  const tier1Items = products.filter(p => p.id !== targetItem?.id && targetSubId && (p.subTypeId === targetSubId || p.subtypeId === targetSubId));
  const tier2Items = products.filter(p => {
    if (p.id === targetItem?.id || tier1Items.some(t => t.id === p.id)) return false;
    return Boolean((p.ingredientId && currentBank.ingredientId && String(p.ingredientId) === String(currentBank.ingredientId)) || (p.groupId && currentBank.groupId && String(p.groupId) === String(currentBank.groupId)) || (targetIngId && (String(p.ingredientId) === String(targetIngId) || String(p.groupId) === String(targetIngId))));
  });

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
      <div><h3 style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">Swap Product / Brand</h3><p style="margin:2px 0 0;font-size:13px;color:#64748b;">Swapping ${escapeHtml(targetSubtype)} &rarr; <strong style="color:#2563eb;">${escapeHtml(currentProductName)}</strong></p></div>
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
  sortSelect.addEventListener('change', () => { currentSort = sortSelect.value; renderList(searchInput.value); });
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
    if (currentTierTab === 'tier1') displayItems = sortItems(tier1Items.filter(matchesQuery));
    else if (currentTierTab === 'tier2') displayItems = sortItems(tier2Items.filter(matchesQuery));
    else displayItems = sortItems(tier3Items.filter(p => p.id !== targetItem?.id && matchesQuery(p))).slice(0, MAX_SWAP_RESULTS);

    if (displayItems.length === 0) {
      listEl.innerHTML = `<div style="text-align:center;padding:28px;color:#94a3b8;font-size:13px;">No substitute products found in this tier.</div>`;
      return;
    }

    const breakdowns = Array.isArray(targetItem?.recipeBreakdown) ? targetItem.recipeBreakdown : [];
    const primaryUsage = breakdowns[0] || {};
    const mealType = primaryUsage.mealType || 'dinner';
    const targetRecipe = (state.recipes || []).find(r => {
      const rName = String(r.title || r.name || '').toLowerCase().trim();
      return breakdowns.some(b => {
        const bName = String(b.recipeName || b.title || '').toLowerCase().trim();
        return bName && (rName === bName || rName.includes(bName) || bName.includes(rName));
      });
    }) || (state.recipes || [])[0];

    let baseScore = 50;
    let hasValidRecipe = false;
    if (targetRecipe && typeof calculateMealFitScore === 'function') {
      hasValidRecipe = true;
      const baseScoreResult = calculateMealFitScore(targetRecipe, mealType, { activeProfile: 'everyone', preferences: state.preferences || state.userPrefs });
      baseScore = typeof baseScoreResult === 'number' ? baseScoreResult : (baseScoreResult?.score || 50);
    }

    listEl.innerHTML = displayItems.map(item => {
      const metrics = calculateMetrics(item);
      const isSelected = selectedSubstituteProduct && (selectedSubstituteProduct.id === item.id || selectedSubstituteProduct.name === item.name);

      let badgeHtml = '';
      if (hasValidRecipe && targetRecipe) {
        const currentProt = Number(targetItem.bankIng?.protein || targetItem.bankIng?.prot || 0);
        const currentCal = Number(targetItem.bankIng?.calories || targetItem.bankIng?.cal || targetItem.bankIng?.kcal || 0);
        const candProt = Number(item.protein || item.prot || 0);
        const candCal = Number(item.calories || item.cal || item.kcal || 0);

        const protDiff = Math.round((candProt - currentProt) * 10) / 10;
        const calDiff = Math.round(candCal - currentCal);

        const clonedRecipe = JSON.parse(JSON.stringify(targetRecipe));

        const applyDeltasToNode = (node) => {
          if (!node || typeof node !== 'object') return;
          if (node.perServing) {
            if (typeof node.perServing.prot === 'number') node.perServing.prot += protDiff;
            if (typeof node.perServing.protein === 'number') node.perServing.protein += protDiff;
            if (typeof node.perServing.cal === 'number') node.perServing.cal += calDiff;
            if (typeof node.perServing.calories === 'number') node.perServing.calories += calDiff;
          }
          if (node.nutrition?.perServing) {
            if (typeof node.nutrition.perServing.prot === 'number') node.nutrition.perServing.prot += protDiff;
            if (typeof node.nutrition.perServing.protein === 'number') node.nutrition.perServing.protein += protDiff;
            if (typeof node.nutrition.perServing.cal === 'number') node.nutrition.perServing.cal += calDiff;
            if (typeof node.nutrition.perServing.calories === 'number') node.nutrition.perServing.calories += calDiff;
          }
          if (typeof node.prot === 'number') node.prot += protDiff;
          if (typeof node.protein === 'number') node.protein += protDiff;
          if (typeof node.cal === 'number') node.cal += calDiff;
          if (typeof node.calories === 'number') node.calories += calDiff;
          if (typeof node.kcal === 'number') node.kcal += calDiff;
        };

        applyDeltasToNode(clonedRecipe);
        if (clonedRecipe.enhanced) applyDeltasToNode(clonedRecipe.enhanced);

        const newScoreResult = calculateMealFitScore(clonedRecipe, mealType, { activeProfile: 'everyone', preferences: state.preferences || state.userPrefs });
        const newScore = typeof newScoreResult === 'number' ? newScoreResult : (newScoreResult?.score || baseScore);
        const delta = newScore - baseScore;

        const sign = delta > 0 ? '+' : '';
        const badgeBg = delta > 0 ? '#dcfce7' : (delta < 0 ? '#ffe4e6' : '#f1f5f9');
        const badgeFg = delta > 0 ? '#15803d' : (delta < 0 ? '#be123c' : '#475569');
        badgeHtml = `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:${badgeBg};color:${badgeFg};margin-left:auto;">[${sign}${delta} - ${baseScore} &rarr; ${newScore}]</span>`;
      } else {
        const packDisplay = item.packSize ? `${item.packSize}${item.packUnit || 'g'}` : '';
        const protDisplay = (item.protein || item.prot) ? `${item.protein || item.prot}g protein` : '';
        const subInfo = [packDisplay, protDisplay].filter(Boolean).join(' • ');
        if (subInfo) badgeHtml = `<span style="font-size:11px;color:#64748b;margin-left:auto;">${escapeHtml(subInfo)}</span>`;
      }

      const priceDisplay = item.price ? `£${Number(item.price).toFixed(2)}` : '';

      return `<div class="pp-swap-card" data-ing-id="${escapeAttr(item.id || item.name)}" style="padding:12px 14px;border:2px solid ${isSelected ? '#2563eb' : '#e2e8f0'};border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all 0.15s ease;background:${isSelected ? '#eff6ff' : '#fff'};"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><div><span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">${escapeAttr(item.brand || '')}</span><div style="font-weight:650;color:#1e293b;font-size:14px;margin-top:1px;">${escapeHtml(item.name)}</div></div><div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:#e0f2fe;color:#0369a1;">${escapeHtml(inferSubtype(item))}</span>${badgeHtml}</div></div><div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">${priceDisplay ? `<span style="font-size:11px;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;">${priceDisplay}</span>` : ''}</div></div>`;
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
