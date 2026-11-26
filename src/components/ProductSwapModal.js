import { getState } from '../store/coreState.js';
import { getCanonicalIngredientId, calculateShoppingItemCost, aggregateShoppingListFromPlan } from '../services/ShoppingCalculationService.js';
import { store, setActivePlan, setShoppingList } from '../store/store.js';
import { saveCurrentPlan } from '../services/HouseholdRepository.js';
import { calculateMealFitScore } from '../utils/fitScoreCalculator.js';
import { calculateItemNutrition } from '../services/NutritionService.js';
import { matchesSearchQuery } from '../utils/searchUtils.js';

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
  const cachedList = Array.isArray(state.shoppingList) ? state.shoppingList : [];
  const products = Array.isArray(state.products) ? state.products : Object.values(state.productsBank || {});
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : Object.values(state.ingredientsBank || {});

  const idQuery = String(param1 || '').trim().toLowerCase();
  const baseIdQuery = idQuery.includes(':') ? idQuery.split(':')[0] : idQuery;
  const nameQuery = String(param2 || '').trim().toLowerCase();

  const findInList = (list) => list.find(item => {
    if (!item) return false;
    const itemId = String(item.id || '').toLowerCase();
    const itemKey = String(item.key || '').toLowerCase();
    const bankId = String(item.bankIng?.id || '').toLowerCase();
    const ingId = String(item.ingredientId || item.groupId || '').toLowerCase();
    const itemName = String(item.name || '').toLowerCase();
    const prodName = String(item.productName || item.bankIng?.name || '').toLowerCase();
    return (
      (idQuery && (itemId === idQuery || itemKey === idQuery || itemKey === baseIdQuery || bankId === idQuery || bankId === baseIdQuery || ingId === idQuery)) ||
      (nameQuery && (itemName === nameQuery || prodName === nameQuery)) ||
      (idQuery && itemName === idQuery)
    );
  });

  let matched = findInList(cachedList);
  if (!matched || !Array.isArray(matched.recipeBreakdown) || matched.recipeBreakdown.length === 0) {
    const activePlan = state.isDraftPlan ? (state.draftPlan || state.currentPlan || state.plan) : (state.currentPlan || state.plan);
    if (activePlan && activePlan.slots) {
      const liveAgg = aggregateShoppingListFromPlan(activePlan, state);
      const liveItems = Array.isArray(liveAgg?.items) ? liveAgg.items : [];
      const liveMatch = findInList(liveItems);
      if (liveMatch) matched = liveMatch;
    }
  }

  if (!matched && idQuery) {
    const prod = products.find(p => String(p.id).toLowerCase() === idQuery || String(p.id).toLowerCase() === baseIdQuery || String(p.name).toLowerCase() === nameQuery);
    if (prod) matched = { id: prod.id, key: prod.id, name: prod.name, bankIng: prod, ingredientId: prod.ingredientId || prod.groupId, subtypeId: prod.subtypeId || prod.subTypeId || null, buyQty: 1, recipeBreakdown: [] };
  }

  if (!matched && (idQuery || nameQuery)) {
    const ing = ingredients.find(i => String(i.id).toLowerCase() === idQuery || String(i.id).toLowerCase() === baseIdQuery || String(i.name).toLowerCase() === nameQuery);
    if (ing) {
      const defaultProd = products.find(p => String(p.id) === String(ing.defaultProductId)) || products.find(p => String(p.ingredientId) === String(ing.id));
      matched = { id: ing.id, key: ing.id, name: ing.name, bankIng: defaultProd || ing, ingredientId: ing.id, buyQty: 1, recipeBreakdown: [] };
    }
  }

  return { item: matched || { id: param1 || 'unknown', key: param1 || 'unknown', name: param2 || param1 || 'Item', bankIng: null, buyQty: 1, recipeBreakdown: [] } };
}

export function evaluateSwapFitScoreForTarget(targetItem, candidateProduct, state = {}, ctx = {}) {
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const allBreakdowns = Array.isArray(targetItem?.recipeBreakdown) ? targetItem.recipeBreakdown : [];
  const scopedEventId = ctx?.cookingEventId || ctx?.instanceId || ctx?.prepEventId || null;
  const breakdowns = scopedEventId
    ? allBreakdowns.filter(b => String(b.cookingEventId) === String(scopedEventId) || (Array.isArray(b.candidateEventIds) && b.candidateEventIds.includes(String(scopedEventId))))
    : allBreakdowns;

  // Resolve unique affected (recipe, mealType, lineKey) usages — never fall back to recipes[0]
  const seenUsage = new Set();
  const usages = [];
  for (const b of breakdowns) {
    const rec = (b.recipeId ? recipes.find(r => String(r.id) === String(b.recipeId)) : null)
      || recipes.find(r => {
        const rName = String(r.title || r.name || '').toLowerCase().trim();
        const bName = String(b.recipeName || b.title || '').toLowerCase().trim();
        return bName && (rName === bName || rName.includes(bName) || bName.includes(rName));
      });
    if (!rec) continue;
    const mt = b.mealType || 'dinner';
    const variant = b.variant || 'original';
    const profile = b.activeProfile || 'everyone';
    const uKey = `${rec.id}::${variant}::${mt}::${profile}::${b.lineKey || ''}`;
    if (seenUsage.has(uKey)) continue;
    seenUsage.add(uKey);
    usages.push({ recipe: rec, mealType: mt, variant, activeProfile: profile, lineKey: b.lineKey || null, usage: b });
  }

  if (usages.length === 0 || !candidateProduct?.id || typeof calculateMealFitScore !== 'function') {
    return { hasValidRecipe: false, baseScore: 0, newScore: 0, delta: 0, recipeCount: 0 };
  }

  const currentBank = targetItem?.bankIng || {};
  const currentProductId = currentBank?.id || null;
  const targetSubId = targetItem?.subtypeId || targetItem?.subTypeId || currentBank?.subtypeId || currentBank?.subTypeId || null;
  const stateProducts = Array.isArray(state.products) ? state.products : [];
  const stateIngredients = Array.isArray(state.rootItems) ? state.rootItems : (Array.isArray(state.ingredients) ? state.ingredients : []);
  const prefs = state.preferences || state.userPrefs || {};

  let baseSum = 0;
  let newSum = 0;

  for (const { recipe, mealType, variant, activeProfile, lineKey } of usages) {
    // Keep sub-type swaps isolated from sibling sub-types under the same root item
    const overrideKeys = targetSubId
      ? Array.from(new Set([lineKey, targetSubId, currentProductId].filter(Boolean).map(String)))
      : Array.from(new Set([
          lineKey,
          targetItem?.ingredientId,
          targetItem?.groupId,
          targetItem?.name
        ].filter(Boolean).map(String)));

    const buildOverrideMap = (prodId) => {
      if (!prodId) return null;
      const map = {};
      overrideKeys.forEach(k => { map[k] = prodId; });
      return map;
    };

    const baseRes = calculateMealFitScore(recipe, mealType, {
      activeProfile,
      variant,
      preferences: prefs,
      products: stateProducts,
      ingredients: stateIngredients,
      ...(currentProductId ? { productOverrides: buildOverrideMap(currentProductId) } : {})
    });
    const newRes = calculateMealFitScore(recipe, mealType, {
      activeProfile,
      variant,
      preferences: prefs,
      products: stateProducts,
      ingredients: stateIngredients,
      productOverrides: buildOverrideMap(candidateProduct.id)
    });

    const bScore = typeof baseRes === 'number' ? baseRes : (baseRes?.score ?? 0);
    const nScore = typeof newRes === 'number' ? newRes : (newRes?.score ?? bScore);
    baseSum += bScore;
    newSum += nScore;
  }

  const baseScore = Math.round(baseSum / usages.length);
  const newScore = Math.round(newSum / usages.length);
  return {
    hasValidRecipe: true,
    baseScore,
    newScore,
    delta: newScore - baseScore,
    recipeCount: usages.length
  };
}

export async function executeSwapInState(targetItem, newProduct, ctx = {}) {
  if (!targetItem || !newProduct) return;
  const storeState = (typeof store !== 'undefined' && store.getState) ? store.getState() : (getState());
  const bank = targetItem.bankIng || {};
  const breakdowns = Array.isArray(targetItem.recipeBreakdown) ? targetItem.recipeBreakdown : [];
  const lineKeysFromBreakdown = breakdowns.map(b => b?.lineKey).filter(Boolean);
  const targetSubId = targetItem.subtypeId || targetItem.subTypeId || bank.subtypeId || bank.subTypeId || null;

  // Sub-type swaps stay scoped to sub-type/line/product keys so sibling sub-types under the same root item are never overwritten
  const candidateKeys = targetSubId
    ? Array.from(new Set([...lineKeysFromBreakdown, targetSubId, bank.id].filter(Boolean).map(String)))
    : Array.from(new Set([
        ...lineKeysFromBreakdown,
        targetItem.canonicalIngId, bank.ingredientId, bank.groupId, bank.id,
        targetItem.ingredientId !== targetItem.id ? targetItem.ingredientId : null,
        targetItem.name
      ].filter(Boolean).map(String)));

  if (candidateKeys.length === 0) {
    if (targetItem.id) candidateKeys.push(String(targetItem.id));
    if (targetItem.key && targetItem.key !== targetItem.id) candidateKeys.push(String(targetItem.key));
  }

  const activePlanKey = storeState.isDraftPlan ? 'draftPlan' : (storeState.currentPlan ? 'currentPlan' : 'plan');
  const basePlan = storeState[activePlanKey] || storeState.currentPlan || storeState.plan || {};
  const updatedPlan = JSON.parse(JSON.stringify(basePlan));

  updatedPlan.shoppingAtHome = {
    ...(storeState.currentPlan?.shoppingAtHome || {}),
    ...(updatedPlan.shoppingAtHome || {})
  };
  updatedPlan.substitutions = updatedPlan.substitutions || {};
  updatedPlan.productSelections = updatedPlan.productSelections || {};
  const subPayload = { productId: newProduct.id, productName: newProduct.name, brand: newProduct.brand || '', price: newProduct.price || 0, timestamp: Date.now() };

  const eventId = ctx?.cookingEventId || ctx?.instanceId || ctx?.prepEventId || null;
  if (eventId) {
    const matchedBreakdowns = breakdowns.filter(b =>
      String(b.cookingEventId) === String(eventId) ||
      (b.slotEventId && String(b.slotEventId) === String(eventId))
    );
    // Write ONLY to the specific cookingEventId and slotEventId (dayKey_slotKey) — never broad day_meal keys that could bleed between E/C split meals
    const eventIdsToWrite = Array.from(new Set([
      String(eventId),
      ...matchedBreakdowns.map(b => b.slotEventId).filter(Boolean).map(String)
    ]));
    const scopedKeys = Array.from(new Set([
      ...matchedBreakdowns.map(b => b.lineKey).filter(Boolean).map(String),
      ...candidateKeys
    ]));
    eventIdsToWrite.forEach(evId => {
      scopedKeys.forEach(k => {
        updatedPlan.substitutions[`${evId}:${k}`] = subPayload;
        updatedPlan.productSelections[`${evId}:${k}`] = newProduct.id;
      });
    });
  } else {
    // Global swap: write unscoped keys AND overwrite matching pre-frozen event-scoped keys so they never shadow the swap
    candidateKeys.forEach(k => {
      updatedPlan.substitutions[k] = subPayload;
      updatedPlan.productSelections[k] = newProduct.id;
    });
    const allEventIds = Array.from(new Set(
      breakdowns.flatMap(b => [b.cookingEventId, b.slotEventId].filter(Boolean)).map(String)
    ));
    allEventIds.forEach(evId => {
      candidateKeys.forEach(k => {
        updatedPlan.substitutions[`${evId}:${k}`] = subPayload;
        updatedPlan.productSelections[`${evId}:${k}`] = newProduct.id;
      });
    });
    const keySet = new Set(candidateKeys);
    Object.keys(updatedPlan.productSelections).forEach(existingKey => {
      const colonIdx = existingKey.indexOf(':');
      if (colonIdx > 0) {
        const suffix = existingKey.slice(colonIdx + 1);
        if (keySet.has(suffix)) {
          updatedPlan.productSelections[existingKey] = newProduct.id;
        }
      }
    });
  }

  if (typeof store !== 'undefined' && typeof store.setState === 'function') {
    store.setState(storeState.isDraftPlan
      ? { draftPlan: updatedPlan }
      : { [activePlanKey]: updatedPlan, currentPlan: updatedPlan, plan: updatedPlan });
  }
  if (!storeState.isDraftPlan) {
    if (typeof setActivePlan === 'function') setActivePlan(updatedPlan);
    else if (window.store?.setActivePlan) window.store.setActivePlan(updatedPlan);
    if (typeof saveCurrentPlan === 'function') {
      saveCurrentPlan(updatedPlan).catch(err => console.warn('[ProductSwapModal] Failed saving plan swap:', err));
    }
  }

  let updatedItems = [];
  if (typeof window.computeWizardShoppingAgg === 'function') {
    const aggResult = window.computeWizardShoppingAgg(updatedPlan);
    updatedItems = Array.isArray(aggResult) ? aggResult : (aggResult?.items || []);
  } else {
    const aggResult = aggregateShoppingListFromPlan(updatedPlan, storeState);
    updatedItems = Array.isArray(aggResult?.items) ? aggResult.items : [];
  }

  if (updatedItems.length > 0) {
    if (typeof setShoppingList === 'function') setShoppingList(updatedItems);
    else if (window.store?.setShoppingList) window.store.setShoppingList(updatedItems);
  }

  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('plateplan:state:plan', { detail: updatedPlan }));
    document.dispatchEvent(new CustomEvent('plateplan:state:shopping', { detail: updatedItems }));
  }
  if (typeof window !== 'undefined' && typeof window.patchWizardStep3Shopping === 'function') {
    window.patchWizardStep3Shopping(updatedPlan);
  } else if (typeof window !== 'undefined' && typeof window.renderPlannerWizard === 'function') {
    window.renderPlannerWizard();
  }
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
  const currentProductId = String(currentBank.id || targetItem?.bankIng?.id || targetItem?.id || '');

  let targetSubId = currentBank.subTypeId || currentBank.subtypeId || targetItem?.subTypeId || targetItem?.subtypeId || null;
  if (!targetSubId && typeof targetItem?.atHomeKey === 'string' && targetItem.atHomeKey.includes(':')) {
    const [, keySubPart] = targetItem.atHomeKey.split(':');
    if (keySubPart && keySubPart.startsWith('sub_')) targetSubId = keySubPart;
  }
  if (!targetSubId && targetIngId) {
    const parentIng = ingredients.find(i => String(i.id) === String(targetIngId));
    if (parentIng && Array.isArray(parentIng.subtypes)) {
      targetSubId = (parentIng.subtypes.find(s => String(s.name || '').toLowerCase() === String(targetItem?.name || '').toLowerCase()) || parentIng.subtypes[0])?.id || null;
    }
  }

  const tier1Items = products.filter(p =>
    String(p.id) !== currentProductId &&
    targetSubId &&
    String(p.subTypeId || p.subtypeId || '') === String(targetSubId)
  );
  const tier2Items = products.filter(p => {
    if (String(p.id) === currentProductId || tier1Items.some(t => String(t.id) === String(p.id))) return false;
    return Boolean((p.ingredientId && currentBank.ingredientId && String(p.ingredientId) === String(currentBank.ingredientId)) || (p.groupId && currentBank.groupId && String(p.groupId) === String(currentBank.groupId)) || (targetIngId && (String(p.ingredientId) === String(targetIngId) || String(p.groupId) === String(targetIngId))));
  });

  const tier3Items = products;
  const targetSubtype = inferSubtype(targetItem);
  let currentSort = 'fitScore', currentTierTab = 'tier1', selectedSubstituteProduct = null;

  const overlay = document.createElement('div');
  overlay.id = 'pp-swap-product-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:999999;display:flex;align-items:center;justify-content:center;';

  const container = document.createElement('div');
  container.style.cssText = 'background:var(--surface);width:94%;max-width:620px;max-height:88vh;border-radius:16px;display:flex;flex-direction:column;box-shadow:0 24px 48px rgba(0,0,0,0.22);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  const currentProductName = targetItem?.brand ? `${targetItem.brand} - ${targetItem.name}` : (targetItem?.name || 'Item');

  container.innerHTML = `
    <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--surface2);">
      <div><h3 style="margin:0;font-size:16px;font-weight:700;color:var(--text);">Swap Product / Brand</h3><p style="margin:2px 0 0;font-size:13px;color:var(--text2);">Swapping ${escapeHtml(targetSubtype)} &rarr; <strong style="color:var(--system-blue);">${escapeHtml(currentProductName)}</strong></p></div>
      <button id="pp-modal-close" class="modal-close-btn" aria-label="Close" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--text3);line-height:1;padding:4px 8px;border-radius:6px;">&times;</button>
    </div>
    <div style="padding:12px 20px;background:var(--surface2);border-bottom:1px solid var(--border);">
      <div style="display:flex;gap:10px;align-items:center;">
        <label for="pp-product-search" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Search substitute products</label>
        <input type="text" id="pp-product-search" name="productSubstituteSearch" aria-label="Search substitute products" placeholder="🔍 Search substitute products..." style="flex:1;min-width:0;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;outline:none;background:var(--surface);color:var(--text);">
        <select id="pp-product-sort" name="productSubstituteSort" aria-label="Sort options" style="flex:0 0 140px;max-width:140px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:var(--surface);color:var(--text);cursor:pointer;">
          <option value="fitScore">Sort: Fit Score</option>
          <option value="relevance">Sort: Default</option>
          <option value="name">Sort: Name (A-Z)</option>
          <option value="proteinPerKcal">Sort: Protein / kcal</option>
          <option value="proteinPerPound">Sort: Protein / £</option>
          <option value="price">Sort: Price (Low to High)</option>
        </select>
      </div>
    </div>
    <div id="pp-tier-tabs" style="display:flex;gap:4px;padding:8px 20px 0 20px;border-bottom:1px solid var(--border);background:var(--surface);overflow-x:auto;">
      <button type="button" class="pp-tier-tab" data-tier="tier1" style="border:none;background:none;padding:6px 12px;font-size:12px;font-weight:700;color:var(--system-blue);border-bottom:2px solid var(--system-blue);cursor:pointer;white-space:nowrap;">Tier 1: Sub-Types</button>
      <button type="button" class="pp-tier-tab" data-tier="tier2" style="border:none;background:none;padding:6px 12px;font-size:12px;font-weight:600;color:var(--text2);border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;">Tier 2: Item Family</button>
      <button type="button" class="pp-tier-tab" data-tier="tier3" style="border:none;background:none;padding:6px 12px;font-size:12px;font-weight:600;color:var(--text2);border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;">Tier 3: Global Catalog</button>
    </div>
    <div id="pp-product-list" style="padding:16px 20px;overflow-y:auto;flex-grow:1;max-height:40vh;"></div>
    <div style="padding:14px 20px;border-top:1px solid var(--border);background:var(--surface2);display:flex;justify-content:space-between;align-items:center;">
      <div id="pp-selected-preview" style="font-size:12px;color:var(--text2);">No substitute selected</div>
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

  if (closeBtn) closeBtn.addEventListener('click', () => overlay.remove());

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

  if (searchInput) searchInput.addEventListener('input', () => renderList(searchInput.value));
  if (sortSelect) sortSelect.addEventListener('change', () => { currentSort = sortSelect.value; renderList(searchInput?.value || ''); });
  if (applyBtn) {
    applyBtn.addEventListener('click', async () => {
      if (!selectedSubstituteProduct) return;
      await executeSwapInState(targetItem, selectedSubstituteProduct, ctx);
      overlay.remove();
    });
  }

  const evalCache = new Map();
  function evaluateSwapFitScore(item) {
    const cacheKey = String(item?.id || item?.name || '');
    if (evalCache.has(cacheKey)) return evalCache.get(cacheKey);
    const res = evaluateSwapFitScoreForTarget(targetItem, item, state, ctx);
    evalCache.set(cacheKey, res);
    return res;
  }

  function sortItems(items) {
    const sorted = [...items];
    switch (currentSort) {
      case 'fitScore':
        return sorted.sort((a, b) => {
          const scoreDiff = evaluateSwapFitScore(b).newScore - evaluateSwapFitScore(a).newScore;
          if (scoreDiff !== 0) return scoreDiff;
          return calculateMetrics(b).proteinPerKcal - calculateMetrics(a).proteinPerKcal;
        });
      case 'name': return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      case 'proteinPerKcal': return sorted.sort((a, b) => calculateMetrics(b).proteinPerKcal - calculateMetrics(a).proteinPerKcal);
      case 'proteinPerPound': return sorted.sort((a, b) => calculateMetrics(b).proteinPerPound - calculateMetrics(a).proteinPerPound);
      case 'price': return sorted.sort((a, b) => calculateMetrics(a).price - calculateMetrics(b).price);
      default: return sorted;
    }
  }

  function renderList(query = '') {
    const matchesQuery = (item) => !query || matchesSearchQuery(query, [
      item.name,
      item.brand,
      inferSubtype(item)
    ]);
    let displayItems = [];
    if (currentTierTab === 'tier1') displayItems = sortItems(tier1Items.filter(matchesQuery));
    else if (currentTierTab === 'tier2') displayItems = sortItems(tier2Items.filter(matchesQuery));
    else displayItems = sortItems(tier3Items.filter(p => String(p.id) !== currentProductId && matchesQuery(p))).slice(0, MAX_SWAP_RESULTS);

    if (displayItems.length === 0) {
      listEl.innerHTML = `<div style="text-align:center;padding:28px;color:#94a3b8;font-size:13px;">No substitute products found in this tier.</div>`;
      return;
    }

    listEl.innerHTML = displayItems.map(item => {
      const isSelected = selectedSubstituteProduct && (selectedSubstituteProduct.id === item.id || selectedSubstituteProduct.name === item.name);

      let badgeHtml = '';
      const evalRes = evaluateSwapFitScore(item);
      if (evalRes.hasValidRecipe) {
        const { baseScore: bScore, newScore, delta } = evalRes;
        const sign = delta > 0 ? '+' : '';
        const badgeBg = delta > 0 ? 'var(--badge-green-bg)' : (delta < 0 ? 'var(--badge-red-bg)' : 'var(--badge-neutral-bg)');
        const badgeFg = delta > 0 ? 'var(--badge-green-text)' : (delta < 0 ? 'var(--badge-red-text)' : 'var(--badge-neutral-text)');
        badgeHtml = `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:${badgeBg};color:${badgeFg};margin-left:auto;">[${sign}${delta} · ${bScore} &rarr; ${newScore}]</span>`;
      } else {
        const packDisplay = item.packSize ? `${item.packSize}${item.packUnit || 'g'}` : '';
        const protDisplay = (item.protein || item.prot) ? `${item.protein || item.prot}g protein` : '';
        const subInfo = [packDisplay, protDisplay].filter(Boolean).join(' • ');
        if (subInfo) badgeHtml = `<span style="font-size:11px;color:var(--text2);margin-left:auto;">${escapeHtml(subInfo)}</span>`;
      }

      const priceDisplay = item.price ? `£${Number(item.price).toFixed(2)}` : '';

      return `<div class="pp-swap-card" data-ing-id="${escapeAttr(item.id || item.name)}" style="padding:12px 14px;border:2px solid ${isSelected ? 'var(--system-blue)' : 'var(--border)'};border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all 0.15s ease;background:${isSelected ? 'var(--badge-blue-bg)' : 'var(--surface)'};"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><div><span style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;">${escapeAttr(item.brand || '')}</span><div style="font-weight:650;color:var(--text);font-size:14px;margin-top:1px;">${escapeHtml(item.name)}</div></div><div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:var(--badge-blue-bg);color:var(--badge-blue-text);">${escapeHtml(inferSubtype(item))}</span>${badgeHtml}</div></div><div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">${priceDisplay ? `<span style="font-size:11px;background:var(--badge-neutral-bg);color:var(--badge-neutral-text);padding:2px 6px;border-radius:4px;">${priceDisplay}</span>` : ''}</div></div>`;
    }).join('');

    listEl.querySelectorAll('.pp-swap-card').forEach(card => {
      card.addEventListener('click', () => {
        const item = displayItems.find(p => String(p.id || p.name) === String(card.dataset.ingId));
        if (!item) return;
        selectedSubstituteProduct = item;
        selectedPreviewEl.innerHTML = `<strong style="color:var(--text);">${escapeHtml(item.brand ? item.brand + ' - ' + item.name : item.name)}</strong> selected`;
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
