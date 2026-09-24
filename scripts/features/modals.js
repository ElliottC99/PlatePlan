/**
 * PlatePlan Features Modals & Secondary UI Helper Module
 * Extracted from monolith for modular maintenance.
 */

// Global state variables for modals
window.currentRecognisedRecipe = null;
window.platePlanUseUpFinder = { meal: 'dinner', who: 'both', productIds: [], assign: null };
window.platePlanChoiceAction = null;
window.recipePhotoFiles = [];
window.recipePhotoObjectUrls = [];
window.platePlanLastMobileFocus = null;

const PLATEPLAN_LIST_BATCH = 24;
window.platePlanListSignatures = {};
window.platePlanListLimits = { vault: PLATEPLAN_LIST_BATCH, bank: PLATEPLAN_LIST_BATCH, ingredients: PLATEPLAN_LIST_BATCH };
window.platePlanListSearchTimers = {};

// == TEXT FORMATTING HELPERS ==
function toAPTitleCase(str) {
  if (!str) return '';
  const lowercaseWords = ['and', 'but', 'or', 'for', 'nor', 'a', 'an', 'the', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'per', 'to', 'with'];
  return str.split(' ').map((word, idx) => {
    if (idx !== 0 && lowercaseWords.includes(word.toLowerCase())) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}
window.toAPTitleCase = toAPTitleCase;

function toTitleCase(str) {
  if (!str) return '';
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
window.toTitleCase = toTitleCase;

function ppEscapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
window.ppEscapeHtml = ppEscapeHtml;

function ppEscapeAttr(value) {
  return ppEscapeHtml(value).replace(/`/g, '&#96;');
}
window.ppEscapeAttr = ppEscapeAttr;

// == ACTION SHEETS & DISPATCHERS ==
function openMobileActionSheet(title, actions) {
  const host = document.getElementById('mobile-action-sheet');
  if (!host) return;
  const titleId = 'mobile-action-sheet-title';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-labelledby', titleId);
  host.innerHTML = `
    <div class="mobile-sheet-handle"></div>
    <div class="row-between" style="align-items:center;margin-bottom:10px">
      <h3 id="${titleId}" style="margin:0">${ppEscapeHtml(title || 'Actions')}</h3>
      <button class="btn sm ghost" onclick="closeMobileActionSheet()">Close</button>
    </div>
    <div style="display:grid;gap:6px">
      ${actions.map(action => `<button class="btn ${action.danger ? 'danger' : ''}" onclick="executeSheetAction(function(){ ${action.onclick}; })">${ppEscapeHtml(action.label)}</button>`).join('')}
    </div>
  `;
  const wrap = document.getElementById('mobile-action-sheet-wrap');
  window.platePlanLastMobileFocus = document.activeElement;
  wrap?.classList.add('open');
  if (typeof window.markMobileLayerForBack === 'function') {
    window.markMobileLayerForBack(wrap, 'actions');
  }
  setTimeout(() => host.querySelector('button')?.focus(), 0);
}
window.openMobileActionSheet = openMobileActionSheet;

function closeMobileActionSheet() {
  const wrap = document.getElementById('mobile-action-sheet-wrap');
  wrap?.classList.remove('open');
}
window.closeMobileActionSheet = closeMobileActionSheet;

function openCreateActionSheet() {
  openMobileActionSheet('Add a recipe', [
    { label: 'Add manually', onclick: `openManualRecipeEntry()` },
    { label: 'Scan recipe photos', onclick: `openRecipeCaptureFromToolbar()` },
    { label: 'Paste recipe text', onclick: `openRecipeTextFromToolbar()` }
  ]);
}
window.openCreateActionSheet = openCreateActionSheet;

function openRecipeActions(recipeId) {
  const recipe = getProductIndexRecipe(recipeId) || (window.state?.recipes || []).find(r => r.id === recipeId);
  if (!recipe) return;
  const wrap = document.getElementById('mobile-action-sheet-wrap');
  const sheet = document.getElementById('mobile-action-sheet');
  if (!sheet) return;
  const titleId = 'mobile-action-sheet-title';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', titleId);
  sheet.innerHTML = `
    <div class="mobile-sheet-handle"></div>
    <div class="row-between" style="align-items:center;margin-bottom:10px">
      <h3 id="${titleId}" style="margin:0">${ppEscapeHtml(recipe.name || 'Actions')}</h3>
      <button type="button" class="btn sm ghost" onclick="closeMobileActionSheet()">Close</button>
    </div>
    <div style="display:grid;gap:6px">
      <button type="button" class="btn" onclick="executeSheetAction('editRecipeModalView', '${ppEscapeAttr(recipeId)}')">Review recipe</button>
      <button type="button" class="btn" onclick="executeSheetAction('downloadRecipeCard', '${ppEscapeAttr(recipeId)}')">Recipe card</button>
      <button type="button" class="btn" onclick="executeSheetAction('duplicateRecipe', '${ppEscapeAttr(recipeId)}')">Duplicate</button>
      <button type="button" class="btn" onclick="executeSheetAction('editRecipe', '${ppEscapeAttr(recipeId)}')">Edit source recipe</button>
      <button type="button" class="btn danger" onclick="executeSheetAction('deleteRecipe', '${ppEscapeAttr(recipeId)}')">Delete</button>
    </div>
  `;
  if (wrap) {
    wrap.classList.add('open');
    if (typeof window.markMobileLayerForBack === 'function') {
      window.markMobileLayerForBack(wrap, 'actions');
    }
  }
  setTimeout(() => sheet.querySelector('button')?.focus(), 0);
}
window.openRecipeActions = openRecipeActions;

function openEnhancedRecipeActions(recipeId) {
  const recipe = getProductIndexRecipe(recipeId) || (window.state?.recipes || []).find(r => r.id === recipeId);
  if (!recipe) return;
  const wrap = document.getElementById('mobile-action-sheet-wrap');
  const sheet = document.getElementById('mobile-action-sheet');
  if (!sheet) return;
  const titleId = 'mobile-action-sheet-title';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', titleId);
  const title = !recipe.enhanced ? (recipe.name || 'Actions') : `${recipe.name || 'Recipe'} · Enhanced`;
  sheet.innerHTML = `
    <div class="mobile-sheet-handle"></div>
    <div class="row-between" style="align-items:center;margin-bottom:10px">
      <h3 id="${titleId}" style="margin:0">${ppEscapeHtml(title)}</h3>
      <button type="button" class="btn sm ghost" onclick="closeMobileActionSheet()">Close</button>
    </div>
    <div style="display:grid;gap:6px">
      ${!recipe.enhanced ? `
        <button type="button" class="btn" onclick="executeSheetAction('editEnhancedRecipe', '${ppEscapeAttr(recipeId)}')">Create enhanced version</button>
        <button type="button" class="btn" onclick="executeSheetAction('editRecipeModalView', '${ppEscapeAttr(recipeId)}')">Review recipe</button>
      ` : `
        <button type="button" class="btn" onclick="executeSheetAction('reviewEnhancedRecipe', '${ppEscapeAttr(recipeId)}')">Review enhanced recipe</button>
        <button type="button" class="btn" onclick="executeSheetAction('downloadRecipeCard', '${ppEscapeAttr(recipeId)}', 'enhanced')">Recipe card</button>
        <button type="button" class="btn" onclick="executeSheetAction('duplicateRecipe', '${ppEscapeAttr(recipeId)}')">Duplicate complete recipe</button>
        <button type="button" class="btn" onclick="executeSheetAction('editEnhancedRecipe', '${ppEscapeAttr(recipeId)}')">Edit enhanced recipe</button>
        <button type="button" class="btn danger" onclick="executeSheetAction('deleteEnhancedRecipe', '${ppEscapeAttr(recipeId)}')">Delete enhanced version</button>
      `}
    </div>
  `;
  if (wrap) {
    wrap.classList.add('open');
    if (typeof window.markMobileLayerForBack === 'function') {
      window.markMobileLayerForBack(wrap, 'actions');
    }
  }
  setTimeout(() => sheet.querySelector('button')?.focus(), 0);
}
window.openEnhancedRecipeActions = openEnhancedRecipeActions;

function openManualRecipeEntry() {
  if (typeof window.showView === 'function') window.showView('add');
  setTimeout(() => document.getElementById('r-name')?.focus(), 0);
}
window.openManualRecipeEntry = openManualRecipeEntry;

function openRecipeCaptureFromToolbar() {
  if (typeof window.showView === 'function') window.showView('add');
  setTimeout(() => openRecipePhotoPicker('library'), 0);
}
window.openRecipeCaptureFromToolbar = openRecipeCaptureFromToolbar;

function openRecipeTextFromToolbar() {
  if (typeof window.showView === 'function') window.showView('add');
  setTimeout(() => openRecipeTextPaste(), 0);
}
window.openRecipeTextFromToolbar = openRecipeTextFromToolbar;

function openProductBankActions(productId) {
  const product = getProduct(productId);
  if (!product) return;
  const group = getIngredientGroup(product.groupId);
  const actions = [
    { label: 'Reallocate / Change Ingredient', onclick: `openProductReallocationModal('${ppEscapeAttr(productId)}')` },
  ];
  if (group) {
    actions.push({ label: 'Delink from Ingredient', onclick: `confirmDelinkProduct('${ppEscapeAttr(productId)}')` });
  }
  actions.push({ label: 'Delete product', onclick: `deleteIng('${ppEscapeAttr(productId)}')`, danger: true });
  openMobileActionSheet(product.name || 'Product actions', actions);
}
window.openProductBankActions = openProductBankActions;

function openIngredientFamilyActions(familyId) {
  const family = getIngredientFamily(familyId);
  if (!family) return;
  openMobileActionSheet(family.name || 'Ingredient actions', [
    { label: 'Edit aliases', onclick: `openIngredientFamilyAliasesModal('${ppEscapeAttr(familyId)}')` },
    { label: 'Add sub-type', onclick: `addSubTypeToFamilyPrompt('${ppEscapeAttr(familyId)}')` },
    { label: 'Merge ingredient', onclick: `mergeIngredientFamilyPrompt('${ppEscapeAttr(familyId)}')` },
    { label: 'Make sub-type', onclick: `openIngredientToSubTypeModal('${ppEscapeAttr(familyId)}')` },
    { label: 'Manage products', onclick: `openProductDefaultPicker('family','${ppEscapeAttr(familyId)}')` },
    { label: 'Delete ingredient', onclick: `deleteIngredientFamilyPrompt('${ppEscapeAttr(familyId)}')`, danger: true }
  ]);
}
window.openIngredientFamilyActions = openIngredientFamilyActions;

function openIngredientGroupActions(groupId) {
  const group = getIngredientGroup(groupId);
  if (!group) return;
  openMobileActionSheet(getGroupTypeName(group) || 'Sub-type actions', [
    { label: 'Edit aliases', onclick: `editGroupAliasesPrompt('${ppEscapeAttr(groupId)}')` },
    { label: 'Merge sub-type', onclick: `mergeIngredientGroupPrompt('${ppEscapeAttr(groupId)}')` },
    { label: 'Make ingredient', onclick: `convertSubTypeToIngredient('${ppEscapeAttr(groupId)}')` },
    { label: 'Manage products', onclick: `openProductDefaultPicker('group','${ppEscapeAttr(groupId)}')` },
    { label: 'Delete sub-type', onclick: `deleteIngredientGroupPrompt('${ppEscapeAttr(groupId)}')`, danger: true }
  ]);
}
window.openIngredientGroupActions = openIngredientGroupActions;

// == PROGRESSIVE LISTS & RENDERING ==
function getProductIndexRecipe(id) {
  return (window.platePlanIndexes?.recipes?.get(id)) || (window.state?.recipes || []).find(recipe => recipe.id === id) || null;
}
window.getProductIndexRecipe = getProductIndexRecipe;

function resetProgressiveList(name, signature) {
  if (window.platePlanListSignatures[name] !== signature) {
    window.platePlanListSignatures[name] = signature;
    window.platePlanListLimits[name] = PLATEPLAN_LIST_BATCH;
  }
}
window.resetProgressiveList = resetProgressiveList;

function showMorePlatePlanList(name) {
  window.platePlanListLimits[name] = (window.platePlanListLimits[name] || PLATEPLAN_LIST_BATCH) + PLATEPLAN_LIST_BATCH;
  const fnMap = {
    vault: window.renderVault,
    bank: window.renderBank,
    ingredients: window.renderIngredientBank
  };
  fnMap[name]?.();
}
window.showMorePlatePlanList = showMorePlatePlanList;

function schedulePlatePlanListRender(name) {
  clearTimeout(window.platePlanListSearchTimers[name]);
  window.platePlanListSearchTimers[name] = setTimeout(() => requestAnimationFrame(() => {
    const fnMap = {
      vault: window.renderVault,
      bank: window.renderBank,
      ingredients: window.renderIngredientBank
    };
    fnMap[name]?.();
  }), 120);
}
window.schedulePlatePlanListRender = schedulePlatePlanListRender;

function progressiveListButton(name, total, shown) {
  const remaining = Math.max(0, total - shown);
  if (!remaining) return '';
  return `<div class="progressive-more"><button class="btn" onclick="showMorePlatePlanList('${name}')">Show ${Math.min(PLATEPLAN_LIST_BATCH, remaining)} more</button><span style="font-size:12px;color:var(--text2)">${remaining} remaining</span></div>`;
}
window.progressiveListButton = progressiveListButton;

function rebuildPlatePlanIndexes() {
  if (!window.platePlanIndexes) {
    window.platePlanIndexes = {
      recipes: new Map(),
      groups: new Map(),
      products: new Map(),
      families: new Map()
    };
  }
  window.platePlanIndexes.recipes.clear();
  window.platePlanIndexes.groups.clear();
  window.platePlanIndexes.products.clear();
  window.platePlanIndexes.families.clear();

  const targetState = window.state || {};
  (targetState.recipes || []).forEach(r => { if (r?.id) window.platePlanIndexes.recipes.set(r.id, r); });
  (targetState.ingredientGroups || []).forEach(g => { if (g?.id) window.platePlanIndexes.groups.set(g.id, g); });
  (targetState.ingredients || []).forEach(p => { if (p?.id) window.platePlanIndexes.products.set(p.id, p); });
  (targetState.ingredientFamilies || []).forEach(f => { if (f?.id) window.platePlanIndexes.families.set(f.id, f); });
}
window.rebuildPlatePlanIndexes = rebuildPlatePlanIndexes;

function markPlatePlanViewsDirty() {
  // Clear any cached views or trigger render sweeps if needed
  if (window.platePlanNutritionCache) {
    window.platePlanNutritionCache.clear();
  }
}
window.markPlatePlanViewsDirty = markPlatePlanViewsDirty;

// == PERSISTENCE LOAD & BACKUPS ==
function normalizeLoadedState(loaded) {
  const s = { ...loaded };
  if (!s.recipes) s.recipes = [];
  if (!s.ingredients) s.ingredients = [];
  if (!s.ingredientGroups) s.ingredientGroups = [];
  if (!s.ingredientFamilies) s.ingredientFamilies = [];
  if (!s.history) s.history = [];
  if (!s.plan) s.plan = { id: 'active_plan', days: 7, slots: {}, confirmedShopping: false };
  if (!s.prefs) s.prefs = { ecal: 2400, eprot: 130, ccal: 1700, cprot: 100, productPriority: 'protein_per_kcal' };
  if (!s.customCats) s.customCats = {};
  if (!s.overrides) s.overrides = {};
  if (!s.useUpProducts) s.useUpProducts = {};
  return s;
}
window.normalizeLoadedState = normalizeLoadedState;

function loadState() {
  window.isHydrating = true;
  let loaded = null;
  try {
    const raw = localStorage.getItem('plateplan_plan_backup');
    if (raw) loaded = JSON.parse(raw);
  } catch (e) {
    console.warn('[State Hydration Engine] LocalStorage backup reading failed.', e);
  }

  const normalized = normalizeLoadedState(loaded || {});
  window.state = normalized;
  rebuildPlatePlanIndexes();
  window.isHydrating = false;
  return normalized;
}
window.loadState = loadState;

function saveState(immediate = true) {
  if (window.isHydrating) return;
  try {
    localStorage.setItem('plateplan_plan_backup', JSON.stringify(window.state));
    if (typeof window.pushStateToCloud === 'function') {
      window.pushStateToCloud();
    }
  } catch (e) {
    console.warn('[State Hydration Engine] LocalStorage save failed.', e);
  }
}
window.saveState = saveState;

// == SEARCH VARIANT RESOLVERS ==
function getSearchVariants(str) {
  const q = (str || '').toLowerCase().trim();
  if (!q) return [];
  const alt1 = q.replace(/hummus/g, 'houmous').replace(/yogurt/g, 'yoghurt');
  const alt2 = q.replace(/houmous/g, 'hummus').replace(/yoghurt/g, 'yogurt');
  return [...new Set([q, alt1, alt2])];
}
window.getSearchVariants = getSearchVariants;

function toGrams(qty, unit, itemWeight = 100) {
  const u = (unit || '').toLowerCase().replace(/s$/, '');
  if (u === 'qty' || u === 'clove' || u === 'head' || u === 'bulb') {
    return Math.round(qty * (u === 'clove' ? 6 : (u === 'head' || u === 'bulb' ? 65 : itemWeight)));
  }
  const factor = window.PlatePlanConfig?.UNIT_TO_GRAMS?.[u] || itemWeight;
  return Math.round(qty * factor);
}
window.toGrams = toGrams;

function isLikelyLiquidIngredientName(name) {
  const text = (name || '').toLowerCase();
  if (/\b(paste|pastes|puree|purees|purée|purées)\b/.test(text)) return false;
  return /oil|vinegar|sauce|milk|water|stock|juice|tamari|soy|maple|syrup|cream|yoghurt|yogurt|coconut milk|passata|dressing|mustard|ketchup|mayo/.test(text);
}
window.isLikelyLiquidIngredientName = isLikelyLiquidIngredientName;

function isLikelyCountableIngredientName(name) {
  const text = (name || '').toLowerCase();
  if (/gnocchi|rice|pasta|noodle|noodles|grain|grains|couscous|bulgur|orzo|flour|sugar|salt|seasoning|spice|spices|herb|herbs|ground|powder|flakes|paprika|cumin|coriander|nutmeg|oregano|parsley|basil|thyme|rosemary|peppercorn|black pepper|white pepper|oil|vinegar|sauce|pesto|paste|chutney|honey|syrup/.test(text)) return false;
  if (/\bchilli\b/.test(text) && !/fresh|red|green|jalapeno|jalapeño|pepper/.test(text)) return false;
  if (/\bpepper\b/.test(text) && /black|white|ground|cracked|corn/.test(text)) return false;
  if (/\b(each|per item|per serving)\b/.test(text)) return true;
  if (/\b\d+\s*[x×]\s*\d+(?:\.\d+)?\s*(g|kg|ml|l)\b/.test(text)) return true;
  if (/\b\d+\s*(pack|packs|burger|burgers|sausage|sausages|roll|rolls|bun|buns|wrap|wraps|tortilla|tortillas|egg|eggs|fillet|fillets)\b/.test(text)) return true;
  return /garlic|clove|egg|avocado|potato|sweet potato|onion|\bpepper\b|\bchilli\b|lime|lemon|mango|burger|sausage|wrap|tortilla|bun|roll|bagel|fillet|slice|piece|block|ball/.test(text);
}
window.isLikelyCountableIngredientName = isLikelyCountableIngredientName;

function shouldClearAutoItemWeight(ing) {
  if (!ing || isLikelyCountableIngredientName(ing.name)) return false;
  const weight = +ing.itemWeight || 0;
  if (!weight) return false;
  const packSize = +ing.drainedWeight || +ing.packSize || 0;
  const itemCount = +ing.itemCount || 0;
  if (itemCount > 1) return false;
  return weight === 100 || itemCount === 1 || (packSize > 0 && Math.abs(weight - packSize) < 0.01);
}
window.shouldClearAutoItemWeight = shouldClearAutoItemWeight;

function inferParsedUnitForIngredient(ing) {
  const unit = (ing?.unit || '').toLowerCase().replace(/s$/, '');
  const name = ing?.name || ing?.raw || '';
  if (unit === 'g' || unit === 'kg') return 'g';
  if (unit === 'ml' || unit === 'l') return 'ml';
  if (unit === 'qty') return 'qty';
  if (['clove', 'head', 'bulb', 'slice', 'piece', 'stalk', 'sprig', 'leaf'].includes(unit)) return 'qty';
  if (['tsp', 'tbsp', 'cup'].includes(unit)) return isLikelyLiquidIngredientName(name) ? 'ml' : 'g';
  if (ing?.isStock) return 'qty';
  if (isLikelyLiquidIngredientName(name)) return 'ml';
  if (isLikelyCountableIngredientName(name)) return 'qty';
  return unit || 'g';
}
window.inferParsedUnitForIngredient = inferParsedUnitForIngredient;

function normaliseRecipeAmountForUi(ing = {}) {
  const name = ing.name || ing.raw || '';
  let qty = parseFloat(ing.qty);
  if (!isFinite(qty)) qty = 1;
  let unit = (ing.unit || '').toLowerCase().replace(/s$/, '') || inferParsedUnitForIngredient(ing);
  if (unit === 'kg') return { qty: Math.round(qty * 1000 * 10) / 10, unit: 'g' };
  if (unit === 'l') return { qty: Math.round(qty * 1000 * 10) / 10, unit: 'ml' };
  if (['tsp', 'tbsp', 'cup'].includes(unit)) {
    return { qty: toGrams(qty, unit), unit: isLikelyLiquidIngredientName(name) ? 'ml' : 'g' };
  }
  if (unit === 'clove') return { qty, unit: 'qty' };
  if (unit === 'head' || unit === 'bulb') return { qty: Math.round(qty * 11 * 10) / 10, unit: 'qty' };
  if (['slice', 'piece', 'stalk', 'sprig', 'leaf', 'tin', 'can'].includes(unit)) return { qty, unit: 'qty' };
  if (unit === 'ml') return { qty, unit: 'ml' };
  if (unit === 'qty') return { qty, unit: 'qty' };
  return { qty, unit: 'g' };
}
window.normaliseRecipeAmountForUi = normaliseRecipeAmountForUi;

// == PRODUCT PACK CALCULATIONS ==
function normalisePackMeasure(value, unit, itemAmount = 0) {
  const amount = +value || 0;
  const key = String(unit || 'g').toLowerCase();
  if (!amount) return 0;
  if (key === 'g' || key === 'ml') return amount;
  if (key === 'kg' || key === 'l') return amount * 1000;
  if (key === 'qty') return itemAmount > 0 ? amount * itemAmount : 0;
  return toGrams(amount, key, itemAmount || 100);
}
window.normalisePackMeasure = normalisePackMeasure;

function getProductItemAmount(product) {
  if (!product) return 0;
  return normalisePackMeasure(product.itemWeight, product.itemWeightUnit || 'g');
}
window.getProductItemAmount = getProductItemAmount;

function getProductGrossPackAmount(product) {
  if (!product) return 0;
  const itemAmount = getProductItemAmount(product);
  return normalisePackMeasure(product.packSize, product.packUnit || 'g', itemAmount);
}
window.getProductGrossPackAmount = getProductGrossPackAmount;

function getProductUsablePackAmount(product) {
  if (!product) return 0;
  const itemAmount = getProductItemAmount(product);
  const drained = normalisePackMeasure(product.drainedWeight, product.drainedWeightUnit || product.packUnit || 'g', itemAmount);
  return drained > 0 ? drained : getProductGrossPackAmount(product);
}
window.getProductUsablePackAmount = getProductUsablePackAmount;

function getProductDerivedItemCount(product) {
  const usable = getProductUsablePackAmount(product);
  const item = getProductItemAmount(product);
  return usable > 0 && item > 0 ? usable / item : 0;
}
window.getProductDerivedItemCount = getProductDerivedItemCount;

function productPackGrams(product) {
  return getProductUsablePackAmount(product);
}
window.productPackGrams = productPackGrams;

function isUsableProduct(product) {
  if (!product) return false;
  return !!((+product.cal || 0) || (+product.prot || 0) || (+product.carb || 0) || (+product.fat || 0) || (+product.fibre || 0));
}
window.isUsableProduct = isUsableProduct;

// == CLOUD AND RECOVERY MODULES ==
function getPlanContextForInstance(instanceId, planContext = window.state?.plan, overrideStore = window.state?.overrides) {
  const ov = instanceId ? ((overrideStore || {})[instanceId] || {}) : {};
  return {
    instanceId,
    productSelections: planContext?.productSelections || {},
    productOverrides: ov.productOverrides || {},
    substitutions: ov.substitutions || {},
    removeIngredientKeys: ov.removeIngredientKeys || {},
    ingredientReplacements: ov.ingredientReplacements || {},
    mergeInto: ov.mergeInto || {},
    ingredientQuantityOverrides: ov.ingredientQuantityOverrides || {}
  };
}
window.getPlanContextForInstance = getPlanContextForInstance;

function getPlanOverride(instanceId) {
  if (!instanceId) return {};
  if (!window.state.overrides) window.state.overrides = {};
  if (!window.state.overrides[instanceId]) {
    window.state.overrides[instanceId] = {
      planMealId: instanceId,
      substitutions: {},
      productOverrides: {},
      removeIngredientKeys: {},
      ingredientReplacements: {},
      mergeInto: {},
      ingredientQuantityOverrides: {}
    };
  }
  const ov = window.state.overrides[instanceId];
  if (!ov.substitutions) ov.substitutions = {};
  if (!ov.productOverrides) ov.productOverrides = {};
  if (!ov.removeIngredientKeys) ov.removeIngredientKeys = {};
  if (!ov.ingredientReplacements) ov.ingredientReplacements = {};
  if (!ov.mergeInto) ov.mergeInto = {};
  if (!ov.ingredientQuantityOverrides) ov.ingredientQuantityOverrides = {};
  return ov;
}
window.getPlanOverride = getPlanOverride;

// == MODAL CONFIRMS AND NOTICES ==
function openAppChoiceModal(title, copy, choices, onChoose) {
  let wrap = document.getElementById('app-choice-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'app-choice-wrap';
    wrap.className = 'modal-wrap sheet-mobile';
    document.body.appendChild(wrap);
  }
  window.platePlanChoiceAction = onChoose;
  wrap.innerHTML = `
    <div class="modal">
      <h3>${ppEscapeHtml(title)}</h3>
      <p>${ppEscapeHtml(copy)}</p>
      <div class="btn-row">
        ${(choices || []).map((choice, index) => `<button class="btn ${index === choices.length - 1 ? 'danger' : 'primary'}" onclick="chooseAppChoice('${ppEscapeAttr(choice.value)}')">${ppEscapeHtml(choice.label)}</button>`).join('')}
        <button class="btn ghost" onclick="closeAppChoiceModal()">Cancel</button>
      </div>
    </div>
  `;
  wrap.classList.add('open');
}
window.openAppChoiceModal = openAppChoiceModal;

function chooseAppChoice(value) {
  const action = window.platePlanChoiceAction;
  closeAppChoiceModal();
  if (typeof action === 'function') action(value);
}
window.chooseAppChoice = chooseAppChoice;

function closeAppChoiceModal() {
  document.getElementById('app-choice-wrap')?.classList.remove('open');
  window.platePlanChoiceAction = null;
}
window.closeAppChoiceModal = closeAppChoiceModal;

// == OCR / PHOTO RECOGNITION SYSTEM ==
function openRecipePhotoPicker(mode = 'library') {
  document.getElementById(mode === 'camera' ? 'recipe-photo-camera-input' : 'recipe-photo-input')?.click();
}
window.openRecipePhotoPicker = openRecipePhotoPicker;

function revokeRecipePhotoUrls() {
  window.recipePhotoObjectUrls.forEach(url => URL.revokeObjectURL(url));
  window.recipePhotoObjectUrls = [];
}
window.revokeRecipePhotoUrls = revokeRecipePhotoUrls;

function renderRecipePhotoPreviews() {
  const host = document.getElementById('recipe-photo-previews');
  const actions = document.getElementById('recipe-photo-actions');
  if (!host || !actions) return;
  revokeRecipePhotoUrls();
  if (!window.recipePhotoFiles.length) {
    host.innerHTML = '';
    host.style.display = 'none';
    actions.style.display = 'none';
    return;
  }
  host.style.display = 'grid';
  actions.style.display = 'flex';
  host.innerHTML = window.recipePhotoFiles.map((file, index) => {
    const url = URL.createObjectURL(file);
    window.recipePhotoObjectUrls.push(url);
    return `<div class="photo-preview"><img src="${url}" alt="Recipe page ${index + 1}"><button type="button" aria-label="Remove page ${index + 1}" onclick="removeRecipePhoto(${index})">×</button></div>`;
  }).join('');
}
window.renderRecipePhotoPreviews = renderRecipePhotoPreviews;

function handleRecipePhotoSelection(event) {
  const incoming = [...(event.target.files || [])].filter(file => file.type.startsWith('image/'));
  if (window.recipePhotoFiles.length + incoming.length > 4) {
    if (typeof window.showMsg === 'function') window.showMsg('recipe-photo-msg', 'PlatePlan can process up to four recipe photos at a time.', 'warn');
  }
  window.recipePhotoFiles = [...window.recipePhotoFiles, ...incoming].slice(0, 4);
  event.target.value = '';
  renderRecipePhotoPreviews();
}
window.handleRecipePhotoSelection = handleRecipePhotoSelection;

function removeRecipePhoto(index) {
  window.recipePhotoFiles.splice(index, 1);
  renderRecipePhotoPreviews();
}
window.removeRecipePhoto = removeRecipePhoto;

function clearRecipePhotos() {
  window.recipePhotoFiles = [];
  revokeRecipePhotoUrls();
  renderRecipePhotoPreviews();
  if (typeof window.showMsg === 'function') window.showMsg('recipe-photo-msg', '', 'info');
}
window.clearRecipePhotos = clearRecipePhotos;

// == PARSE INGREDIENTS MODAL & VERIFICATION ==
function openParseModal(ings, steps) {
  const ingList = document.getElementById('parse-ing-list');
  if (ingList) {
    ingList.innerHTML = ings.map(renderParseIngredientRow).join('') + '<datalist id="parse-section-options"></datalist>';
    if (typeof window.refreshParseSectionOptions === 'function') {
      window.refreshParseSectionOptions();
    }
    if (!document.getElementById('parse-add-ingredient-btn')) {
      ingList.insertAdjacentHTML('afterend', '<button id="parse-add-ingredient-btn" class="btn sm ghost" style="margin-top:8px" onclick="addParseIngredientRow()">+ Add ingredient</button>');
    }
  }

  const methodList = document.getElementById('parse-method-list');
  if (methodList) {
    methodList.innerHTML = steps.map((step, i) => `
      <div class="parse-method-row" style="display:flex; gap:5px; align-items:flex-start;">
        <span class="step-num" style="font-weight:600; font-size:12px; margin-top:8px; width:20px;">${i + 1}.</span>
        <textarea class="p-step" style="flex:1; min-height:40px;">${step.replace(/"/g, '&quot;')}</textarea>
        <button class="btn sm danger ghost" onclick="this.parentElement.remove(); reindexMethodSteps();" style="padding:4px 8px;">&times;</button>
      </div>
    `).join('');
  }

  document.getElementById('parse-modal-wrap')?.classList.add('open');
  if (typeof window.updateBatchUiBanners === 'function') {
    window.updateBatchUiBanners();
  }
}
window.openParseModal = openParseModal;

function renderParseIngredientRow(ing = {}) {
  const normalised = normaliseRecipeAmountForUi(ing);
  const displayUnit = normalised.unit;
  const stockWater = ing.stockWaterMl || '';
  const sectionHtml = typeof window.renderSectionInput === 'function'
    ? window.renderSectionInput('p-section', ing.section || '', 'parse-section-options', 'refreshParseSectionOptions()', '130px')
    : `<input type="text" class="p-section" value="${ing.section || ''}" style="width:130px;">`;

  return `
    <div class="parse-ing-row" style="display:flex; gap:5px; align-items:center;">
      <input type="number" class="p-qty" value="${normalised.qty || 1}" style="width:65px;" step="0.1" min="0">
      <select class="p-unit" style="width:85px; border:1px solid var(--border); border-radius:8px; padding:0 5px;">
        <option value="g" ${displayUnit === 'g' ? 'selected' : ''}>g</option>
        <option value="ml" ${displayUnit === 'ml' ? 'selected' : ''}>ml</option>
        <option value="qty" ${displayUnit === 'qty' ? 'selected' : ''}>qty</option>
      </select>
      ${sectionHtml}
      <input type="text" class="p-name" value="${(ing.name || '').replace(/"/g, '&quot;')}" style="flex:1;" oninput="refreshParseIngredientUnit(this)">
      <input type="number" class="p-stock-water" value="${stockWater}" placeholder="Water ml" title="Water used to make stock; displayed in recipe cards but not counted in nutrition or shopping." style="width:92px; display:${ing.isStock || stockWater ? 'block' : 'none'};" step="1" min="0">
      <button class="btn sm danger ghost" onclick="this.parentElement.remove()" style="padding:4px 8px;">&times;</button>
    </div>
  `;
}
window.renderParseIngredientRow = renderParseIngredientRow;

function refreshParseIngredientUnit(input) {
  const row = input.closest('.parse-ing-row');
  if (!row) return;
  const unit = row.querySelector('.p-unit');
  const water = row.querySelector('.p-stock-water');
  const name = input.value || '';
  if (/\bstock\b/i.test(name)) {
    if (unit) unit.value = 'qty';
    if (water) water.style.display = 'block';
  } else if (unit && (!unit.value || unit.value === 'g')) {
    unit.value = inferParsedUnitForIngredient({ name });
  }
}
window.refreshParseIngredientUnit = refreshParseIngredientUnit;

function addParseIngredientRow() {
  const container = document.getElementById('parse-ing-list');
  if (!container) return;
  const datalist = document.getElementById('parse-section-options');
  if (datalist) datalist.remove();
  container.insertAdjacentHTML('beforeend', renderParseIngredientRow({ qty: 1, unit: 'qty', name: '' }) + '<datalist id="parse-section-options"></datalist>');
  if (typeof window.refreshParseSectionOptions === 'function') {
    window.refreshParseSectionOptions();
  }
}
window.addParseIngredientRow = addParseIngredientRow;

function reindexMethodSteps() {
  const rows = document.querySelectorAll('.parse-method-row');
  rows.forEach((r, i) => {
    const span = r.querySelector('.step-num');
    if (span) span.textContent = (i + 1) + '.';
  });
}
window.reindexMethodSteps = reindexMethodSteps;

// == CATEGORIES, MERGES AND USE-UPS ==
function getIngredientGroup(groupId) {
  if (!groupId) return null;
  return window.platePlanIndexes?.groups?.get(groupId) || (window.state?.ingredientGroups || []).find(g => g.id === groupId) || null;
}
window.getIngredientGroup = getIngredientGroup;

function getIngredientFamily(familyId) {
  if (!familyId) return null;
  return window.platePlanIndexes?.families?.get(familyId) || (window.state?.ingredientFamilies || []).find(f => f.id === familyId) || null;
}
window.getIngredientFamily = getIngredientFamily;

function getGroupIngredientFamily(groupOrId, targetState = null) {
  if (!groupOrId) return null;
  const s = targetState || (typeof window !== 'undefined' ? window.state : null) || null;
  const families = s?.ingredientFamilies || [];
  const groups = s?.ingredientGroups || [];

  let group = groupOrId;
  if (typeof group === 'string' || typeof group === 'number') {
    const strId = String(group);
    if (typeof window !== 'undefined' && window.platePlanIndexes?.groups) {
      group = window.platePlanIndexes.groups.get(strId) || window.platePlanIndexes.groups.get(group);
    }
    if (!group || typeof group !== 'object') {
      group = groups.find(g => g && (String(g.id) === strId || g.name === groupOrId));
    }
    if (!group) {
      if (typeof window !== 'undefined' && window.platePlanIndexes?.families) {
        const directFam = window.platePlanIndexes.families.get(strId) || window.platePlanIndexes.families.get(groupOrId);
        if (directFam) return directFam;
      }
      return families.find(f => f && (String(f.id) === strId || f.name === groupOrId)) || null;
    }
  }

  if (!group || typeof group !== 'object') return null;

  const familyId = group.ingredientId || group.familyId;
  if (familyId) {
    if (typeof window !== 'undefined' && window.platePlanIndexes?.families) {
      const found = window.platePlanIndexes.families.get(String(familyId)) || window.platePlanIndexes.families.get(familyId);
      if (found) return found;
    }
    const found = families.find(f => f && (String(f.id) === String(familyId) || f.name === familyId));
    if (found) return found;
  }

  if (group.family) {
    const famStr = String(group.family).trim().toLowerCase();
    const found = families.find(f => f && (String(f.id) === group.family || String(f.name || '').trim().toLowerCase() === famStr));
    if (found) return found;
    return { id: group.ingredientId || group.familyId || group.family, name: group.family, cat: group.cat || 'other' };
  }

  if (group.cat) {
    const found = families.find(f => f && (f.cat === group.cat || f.id === group.cat));
    if (found) return found;
  }

  return null;
}
window.getGroupIngredientFamily = getGroupIngredientFamily;

function getProduct(productId) {
  if (!productId) return null;
  return window.platePlanIndexes?.products?.get(productId) || (window.state?.ingredients || []).find(i => i.id === productId) || null;
}
window.getProduct = getProduct;

function getGroupTypeName(group) {
  return (group?.name || '').replace(/\s+/g, ' ').trim() || 'Unnamed sub-type';
}
window.getGroupTypeName = getGroupTypeName;

// Export PlatePlanModals API Group
window.PlatePlanModals = {
  toAPTitleCase,
  toTitleCase,
  ppEscapeHtml,
  ppEscapeAttr,
  openMobileActionSheet,
  closeMobileActionSheet,
  openCreateActionSheet,
  openRecipeActions,
  openEnhancedRecipeActions,
  openManualRecipeEntry,
  openRecipeCaptureFromToolbar,
  openRecipeTextFromToolbar,
  openProductBankActions,
  openIngredientFamilyActions,
  openIngredientGroupActions,
  getProductIndexRecipe,
  resetProgressiveList,
  showMorePlatePlanList,
  schedulePlatePlanListRender,
  progressiveListButton,
  rebuildPlatePlanIndexes,
  normalizeLoadedState,
  loadState,
  saveState,
  getSearchVariants,
  toGrams,
  isLikelyLiquidIngredientName,
  isLikelyCountableIngredientName,
  shouldClearAutoItemWeight,
  inferParsedUnitForIngredient,
  normaliseRecipeAmountForUi,
  normalisePackMeasure,
  getProductItemAmount,
  getProductGrossPackAmount,
  getProductUsablePackAmount,
  getProductDerivedItemCount,
  productPackGrams,
  isUsableProduct,
  getPlanContextForInstance,
  getPlanOverride,
  openAppChoiceModal,
  chooseAppChoice,
  closeAppChoiceModal,
  openRecipePhotoPicker,
  revokeRecipePhotoUrls,
  renderRecipePhotoPreviews,
  handleRecipePhotoSelection,
  removeRecipePhoto,
  clearRecipePhotos,
  openParseModal,
  renderParseIngredientRow,
  refreshParseIngredientUnit,
  addParseIngredientRow,
  reindexMethodSteps,
  getIngredientGroup,
  getIngredientFamily,
  getProduct,
  getGroupTypeName
};
