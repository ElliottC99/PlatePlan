var platePlanFeatureRenderers = platePlanFeatureRenderers || undefined;

function renderShopping(...args) {
  if (typeof window !== 'undefined' && typeof window.renderShopping === 'function' && window.renderShopping !== renderShopping) {
    return window.renderShopping(...args);
  }
  if (typeof window !== 'undefined' && typeof window.renderShoppingList === 'function') {
    return window.renderShoppingList(...args);
  }
}

function renderVault(...args) {
  if (typeof window !== 'undefined' && typeof window.renderVault === 'function' && window.renderVault !== renderVault) {
    return window.renderVault(...args);
  }
  if (typeof window !== 'undefined' && typeof window.renderRecipeVault === 'function') {
    return window.renderRecipeVault(...args);
  }
}

window.renderShopping = window.renderShopping || renderShopping;
window.renderVault = window.renderVault || renderVault;

globalThis.PlatePlanLegacy = globalThis.PlatePlanLegacy || {
  getState: () => (typeof state !== 'undefined' ? state : {}),
  saveState: (imm) => (typeof saveState === 'function' ? saveState(imm) : null),
  calculateRecipeDisplayNutrition: (opts) => (typeof calculateRecipeDisplayNutrition === 'function' ? calculateRecipeDisplayNutrition(opts) : {}),
  getPlanContextForInstance: (id) => (typeof getPlanContextForInstance === 'function' ? getPlanContextForInstance(id) : null),
  refreshPlatePlanDerivedState: () => (typeof refreshPlatePlanDerivedState === 'function' ? refreshPlatePlanDerivedState() : null),
  renderLegacyView: (id) => (typeof renderPlatePlanLegacyView === 'function' ? renderPlatePlanLegacyView(id) : null),
  runDelegatedAction: (code, ev, el) => (typeof runPlatePlanDelegatedAction === 'function' ? runPlatePlanDelegatedAction(code, ev, el) : null),
  get renderers() { return typeof platePlanFeatureRenderers !== 'undefined' ? platePlanFeatureRenderers : {}; }
};
window.logout = function() {
  if (typeof signOutPlatePlan === 'function') {
    try { signOutPlatePlan(); } catch(e) {}
  } else if (window.firebase && firebase.auth) {
    try { firebase.auth().signOut(); } catch(e) {}
  }
  try { localStorage.clear(); } catch(e) {}
  try { sessionStorage.clear(); } catch(e) {}
  window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
};
window.syncNow = async function() {
  console.log('[MANUAL SYNC TRIGGERED]');
  if (typeof pushStateToCloud === 'function') { await pushStateToCloud(true); } else if (typeof loadSharedPlatePlan === 'function') { await loadSharedPlatePlan(); }
};
function bindTopBarActionListeners() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = 'true';
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      window.logout();
    });
  }
  document.querySelectorAll('.sync-now-btn').forEach(btn => {
    if (!btn.dataset.bound) {
      btn.dataset.bound = 'true';
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        window.syncNow();
      });
    }
  });
  const syncBadge = document.getElementById('sync-status');
  if (syncBadge && !syncBadge.dataset.bound) {
    syncBadge.dataset.bound = 'true';
    syncBadge.addEventListener('click', function(e) {
      if (typeof openPlatePlanSyncPanel === 'function') { openPlatePlanSyncPanel(); } else { window.syncNow(); }
    });
  }
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bindTopBarActionListeners); } else { bindTopBarActionListeners(); }
}
const NUTRITION_CANONICAL_MAP = {
  "carbohydrates": "carb", "carbs": "carb", "available carbohydrate": "carb", "available carbohydrates": "carb", "total carbohydrate": "carb",
  "sugar": "sugar", "sugars": "sugar", "of which sugars": "sugar",
  "energy": "cal", "calories": "cal", "kcal": "cal", "energy (kcal)": "cal",
  "protein": "prot", "proteins": "prot",
  "fat": "fat", "total fat": "fat", "saturates": "sat", "saturated fat": "sat", "of which saturates": "sat",
  "fibre": "fibre", "fiber": "fibre", "dietary fibre": "fibre",
  "salt": "salt", "sodium": "salt"
};
function normalizeNutrientKey(key) { return window.NutritionService?.normalizeNutrientKey(key) || key; }
function numericNutritionValues(value) { return window.NutritionService?.numericNutritionValues(value) || []; }
function normalizeEnergyKcal(value) { return window.NutritionService?.normalizeEnergyKcal(value) || 0; }
function normalizeNutritionPayload(raw){
  return window.NutritionService?.normalizeNutritionPayload(raw) || (raw || {});
}
function toAPTitleCase(str) {
  if (!str || typeof str !== 'string') return '';
  const lowerWords = new Set(['a', 'an', 'the', 'in', 'on', 'at', 'to', 'from', 'by', 'with', 'of', 'for', 'and', 'but', 'or', 'nor']);
  return str.trim().split(/\s+/).map((word, index, words) => {
    if (word.includes('-')) return word.split('-').map((part, pIdx, parts) => (!part || (!pIdx && index === 0) || (pIdx === parts.length - 1 && index === words.length - 1) || !lowerWords.has(part.toLowerCase().replace(/[^a-z0-9]/g, '')) ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part.toLowerCase())).join('-');
    const match = word.match(/^([^\w]*)([\w']+)([^\w]*)$/);
    if (!match) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    const [, leading, core, trailing] = match, lowerCore = core.toLowerCase();
    const isFirst = index === 0 || /[:.!?\-–—]$/.test(words[index - 1] || '');
    return leading + ((!isFirst && index !== words.length - 1 && lowerWords.has(lowerCore)) ? lowerCore : core.charAt(0).toUpperCase() + core.slice(1).toLowerCase()) + trailing;
  }).join(' ');
}
function toTitleCase(str) { return (!str || typeof str !== 'string') ? '' : ((str.includes(' ') || str.includes('-')) ? toAPTitleCase(str) : str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()); }
const STANDARD_CATS = {
  'meat-substitute': 'Meat substitutes',
  'legume': 'Legumes & pulses',
  'dairy-alternative': 'Dairy & alternatives',
  'tofu-tempeh': 'Tofu & tempeh',
  'egg': 'Eggs',
  'nuts-seeds': 'Nuts & seeds',
  'supplement': 'Supplements',
  'grain': 'Grains',
  'vegetables': 'Vegetables',
  'fruit': 'Fruit',
  'carbs-pasta-rice': 'Carbs (Pasta/Rice/Potato)',
  'sauces-condiments': 'Sauces & Condiments',
  'baking-spices': 'Baking & Spices',
  'beverages': 'Beverages',
  'store-cupboard': 'Store Cupboard',
  'other': 'Other'
};
let CAT = { ...STANDARD_CATS };
const SK='plateplan_v2';
const BAKED_CANDIDATE_SK='plateplan_v2_baked_candidate';
const RECOVERY_SK='plateplan_v2_recovery';
const PLATEPLAN_APPEARANCE_SK='plateplan_appearance';
const PLATEPLAN_SIDEBAR_SK='plateplan_sidebar_groups';
const PLATEPLAN_MODULAR_MIGRATION_SK='plateplan_modular_migration_20_4';
const PLATEPLAN_SCHEMA_VERSION=1;
const PLATEPLAN_APP_VERSION='3.9.0';
const PLATEPLAN_EXPECTED_CACHE='plateplan-shell-v89';
window.APP_VERSION = '3.1.0';
window._hydrationLogged = false;
window.state = window.state || {};
window.state.deletedPlanIds = window.state.deletedPlanIds || [];
window.deletedPlanIds = window.deletedPlanIds || window.state.deletedPlanIds;
try {
  const OBSOLETE_KEYS = ['app_version', 'data:chloe', 'data:elliott', 'plateplan_v1', 'plateplan_v1_baked_candidate', 'plateplan_v1_chloe', 'plateplan_v1_elliott', 'plateplan_v1_device_id', 'plateplan_v1_recovery', 'plateplan_history_backup'];
  OBSOLETE_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch(e) {} });
} catch(_e) {}
let isHydrating = false;
window.isHydrating = false;
let lastPersistedStateJson = null;
const SEED=[];
let lastLoadedDataRecipesDoc = [];
function parseRecipeDocumentToCleanArray(docData) {
  if (!docData || typeof docData !== 'object') return [];
  let rawList = [];
  if (Array.isArray(docData.recipes)) {
    rawList = docData.recipes;
  } else if (docData.recipes && typeof docData.recipes === 'object') {
    rawList = Object.entries(docData.recipes).map(([k, v]) => (v && typeof v === 'object' ? { id: v.id || k, ...v } : v));
  } else if (Array.isArray(docData.list)) {
    rawList = docData.list;
  } else {
    rawList = Object.entries(docData).map(([k, v]) => {
      if (!v || typeof v !== 'object') return null;
      return { id: v.id || k, ...v };
    }).filter(Boolean);
  }
  return rawList.map(item => unwrapAndCleanItem(item)).filter(item => item && (item.name || item.title || item.ingredients));
}
window.parseRecipeDocumentToCleanArray = parseRecipeDocumentToCleanArray;
window.isCloudHydrated = false;
function safeJsonStringify(value, space = null, fallback = '{}') {
  if (value === undefined || value === null) { return (space !== null && space !== undefined) ? 'null' : fallback; }
  try {
    const seen = new WeakSet();
    const replacer = (k, v) => {
      if (typeof v === 'number') return (isNaN(v) || !isFinite(v)) ? null : v;
      if (v === undefined) return undefined;
      if (typeof v === 'function' || typeof v === 'symbol') return undefined;
      if (typeof BigInt !== 'undefined' && typeof v === 'bigint') return String(v);
      if (typeof Node !== 'undefined' && (v instanceof Node || v instanceof Window)) return undefined;
      if (typeof Event !== 'undefined' && v instanceof Event) return undefined;
      if (typeof v === 'object' && v !== null) {
        if (v.constructor && (
          v.constructor.name === 'un' ||
          v.constructor.name === 'P' ||
          v.constructor.name === 'HTMLImageElement' ||
          v.constructor.name === 'HTMLCanvasElement' ||
          v.constructor.name === 'SyntheticBaseEvent'
        )) {
          return undefined;
        }
        if ('nodeType' in v || 'ownerDocument' in v) return undefined;
        if (seen.has(v)) return undefined;
        seen.add(v);
      }
      return v;
    };
    const str = (space !== null && space !== undefined) ? JSON.stringify(value, replacer, space) : JSON.stringify(value, replacer);
    return str !== undefined ? str : fallback;
  } catch (_e) {
    return fallback;
  }
}
window.safeJsonStringify = safeJsonStringify;
function clonePlatePlanValue(value) {
  if (value === null || value === undefined) return value;
  try {
    const str = safeJsonStringify(value, null, 'null');
    return str === 'null' ? value : JSON.parse(str);
  } catch (e) {
    return value;
  }
}
window.clonePlatePlanValue = clonePlatePlanValue;
function unwrapAndCleanItem(item){
  if(!item || typeof item !== 'object') return item;
  let target = item;
  if(target.value && typeof target.value === 'object'){
    target = { ...target.value, ...target };
    delete target.value;
  }
  const clean = { ...target };
  delete clean.deviceId;
  delete clean.operationId;
  delete clean.revision;
  delete clean.updatedBy;
  delete clean._syncStatus;
  delete clean._dirty;
  delete clean.totalKcal;
  delete clean.totalProtein;
  delete clean.totalCarb;
  delete clean.totalFat;
  delete clean.totalNutrition;
  if(clean.ingredients && Array.isArray(clean.ingredients)){
    clean.isFavorite = (clean.isFavorite !== undefined) ? !!clean.isFavorite : false;
    clean.isFavourite = clean.isFavorite;
  }
  return clean;
}
window.unwrapAndCleanItem = unwrapAndCleanItem;
function stripUndefinedValues(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefinedValues);
  const copy = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) { copy[k] = stripUndefinedValues(v); }
  }
  return copy;
}
window.stripUndefinedValues = stripUndefinedValues;
function sanitizePayloadForFirestore(data){
  if(data === undefined) return null;
  try {
    const cleaned = stripUndefinedValues(data);
    const jsonStr = safeJsonStringify(cleaned, null, 'null');
    return JSON.parse(jsonStr);
  } catch(err) {
    console.error('[PAYLOAD SANITIZATION ERROR]', err);
    return data;
  }
}
window.sanitizePayloadForFirestore = sanitizePayloadForFirestore;
function getMealTypeTargets(mealType = 'dinner') {
  return window.FitScoreService?.getMealTypeTargets(mealType) || { mealType: mealType || 'dinner', targetCal_E: 840, targetProt_E: 45.5, targetCal_C: 595, targetProt_C: 35 };
}
window.getMealTypeTargets = getMealTypeTargets;
function getVaultTargetMacros(mealType = 'dinner') { return getMealTypeTargets(mealType); }
window.getVaultTargetMacros = getVaultTargetMacros;
function computeProfileFitScore(actualCal, targetCal, actualProt, targetProt) { return window.FitScoreService?.computeProfileFitScore(actualCal, targetCal, actualProt, targetProt) ?? 100; }
window.computeProfileFitScore = computeProfileFitScore;
function calculateMacroFitTierAndScore(calActualOrRecipe, mealTypeOrTargets, protAct, protTgt) {
  return window.FitScoreService?.calculateMacroFitTierAndScore(calActualOrRecipe, mealTypeOrTargets, protAct, protTgt) || {
    tier: 'amber-green', score: 75, raw: 75, color: '#84CC16', label: 'Acceptable Fit', colors: 'background-color:#84CC16;color:#FFFFFF;', badgeStyle: '', score_E: 75, score_C: 75
  };
}
window.calculateMacroFitTierAndScore = calculateMacroFitTierAndScore;
function getEffectiveRecipeFitScore(recipe, targetSlot = 'dinner') {
  return window.FitScoreService?.getEffectiveRecipeFitScore(recipe, targetSlot) || { score: 0, bestVariant: 'original', scoreOriginal: 0, scoreEnhanced: 0 };
}
window.getEffectiveRecipeFitScore = getEffectiveRecipeFitScore;
function attachComputedFitScores(recipes = [], targetSlot = 'dinner') { return window.FitScoreService?.attachComputedFitScores(recipes, targetSlot) || recipes; }
window.attachComputedFitScores = attachComputedFitScores;
window.hydrateScoresForSorting = attachComputedFitScores;
function getSortedRecipes(recipes = [], sortOption = 'name', activeSlotTargets = 'dinner') { return window.FitScoreService?.getSortedRecipes(recipes, sortOption, activeSlotTargets) || recipes; }
window.getSortedRecipes = getSortedRecipes;
window.sortRecipesByFit = getSortedRecipes;
async function runGlobalProductRelink() {
  if (!state) return { success: false, updatedCount: 0 };
  const recipesList = Array.isArray(state.recipes) ? state.recipes : (state.recipes && typeof state.recipes === 'object' ? Object.values(state.recipes) : []);
  if (!recipesList.length) {
    showPlatePlanToast('No recipes found to relink.');
    return { success: true, updatedCount: 0 };
  }
  const productsList = Array.isArray(state.products) ? state.products : (Array.isArray(state.bank) ? state.bank : (Array.isArray(state.ingredients) ? state.ingredients : []));
  const productMap = new Map();
  const aliasMap = new Map();
  productsList.forEach(p => {
    if (!p) return;
    if (p.id) productMap.set(String(p.id).toLowerCase(), p);
    if (p.name) {
      const norm = normaliseAliasText(p.name);
      if (norm) aliasMap.set(norm, p);
    }
  });
  let relinkedCount = 0;
  for (const recipe of recipesList) {
    if (!recipe) continue;
    let modified = false;
    const processIngList = (ingList) => {
      if (!Array.isArray(ingList)) return;
      ingList.forEach(ing => {
        if (!ing) return;
        let matchedProduct = null;
        if (ing.productId && productMap.has(String(ing.productId).toLowerCase())) {
          matchedProduct = productMap.get(String(ing.productId).toLowerCase());
        } else if (ing.bankId && productMap.has(String(ing.bankId).toLowerCase())) {
          matchedProduct = productMap.get(String(ing.bankId).toLowerCase());
        } else if (ing.groupId) { matchedProduct = resolveProductForIngredient(ing)?.product || null; }
        if (!matchedProduct) {
          const normName = normaliseAliasText(ing.name || ing.raw || '');
          if (normName && aliasMap.has(normName)) {
            matchedProduct = aliasMap.get(normName);
          }
        }
        if (matchedProduct) {
          if (ing.productId !== matchedProduct.id || ing.bankId !== matchedProduct.id) {
            ing.productId = matchedProduct.id;
            ing.bankId = matchedProduct.id;
            if (matchedProduct.groupId && !ing.groupId) ing.groupId = matchedProduct.groupId;
            if (matchedProduct.name && !ing.productName) ing.productName = matchedProduct.name;
            modified = true;
          }
        }
      });
    };
    processIngList(recipe.ingredients);
    if (recipe.enhanced && recipe.enhanced.ingredients) { processIngList(recipe.enhanced.ingredients); }
    if (recipe.variants) {
      Object.values(recipe.variants).forEach(v => {
        if (v && v.ingredients) processIngList(v.ingredients);
      });
    }
    if (modified) {
      recipe.updatedAt = new Date().toISOString();
      relinkedCount++;
      try {
        await saveRecipe(recipe);
      } catch (err) {
        console.warn('[RELINK ENGINE] Error syncing recipe:', recipe.id, err);
      }
    }
  }
  saveState();
  rebuildPlatePlanIndexes();
  renderAll();
  showPlatePlanToast(`Relink complete! Updated ${relinkedCount} recipes. ✓`);
  return { success: true, updatedCount: relinkedCount };
}
window.runGlobalProductRelink = runGlobalProductRelink;
let state = null;
let browserStateBeforeBakedComparison = null;
let editId=null,editIngId=null,activeFamily='all',mappingContext=null,pendingRecipeNutritionFix=null,currentReviewInstanceId=null,currentReviewVariant='original';
let productEditorReturnToReview=false;
let productBankFamilySearchText = '';
let activeCat='all';
let currentReviewMealTypes=null;
let currentReviewWho=null;
let currentReviewServes=null;
let currentMiniEditId = null;
let platePlanIndexes = { products:new Map(), groups:new Map(), families:new Map(), recipes:new Map(), recipeDependencies:new Map() };
let platePlanNutritionCache = new Map();
let platePlanDirtyViews = new Set(['today','vault','ingredients','bank','planner','planlib','shopping','data','prefs']);
let platePlanRemoteRefreshTimer = null;
let platePlanRemoteChanges = { products:new Set(), groups:new Set(), recipes:new Set(), full:false, renderOnly:false };
let editorNavigationStack = [];
let platePlanListLimits = { vault:24, bank:24, ingredients:24 };
let platePlanListSignatures = { vault:'', bank:'', ingredients:'' };
let platePlanListSearchTimers = {};
let platePlanRescheduleSource = null;
let platePlanRescheduleUndo = null;
let platePlanRescheduleDraft = null;
let platePlanEarlierDaysExpanded = false;
const PLATEPLAN_LIST_BATCH = 24;
function safeSaveHistoryBackup() {}
function safeLocalStorageSet(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : safeJsonStringify(v)); return true; } catch(e){ return false; } }
function sanitizePlanForFirestore(plan) { return plan || {}; }
function doc(dbInstance, ...pathSegments) { return { path: pathSegments.join('/') }; }
function setDoc(docRef, data, options) { return Promise.resolve(true); }
function serverTimestamp() { return new Date().toISOString(); }
function updatePlanHistory() {}
function getPlanSaveState() { return { status: 'saved' }; }
function updateUIState() {}
function updatePlanSaveUI() {}
function queuePlanSave() {}
function savePlanTransactional() { return Promise.resolve(true); }
function checkStartupPlanRecovery() { return false; }
function renderPlanRecoveryBanner() {}
function restorePlanDraft() {}
function discardPlanDraft() {}
function dismissPlanRecoveryBanner() {}
window.safeSaveHistoryBackup = safeSaveHistoryBackup; window.safeLocalStorageSet = safeLocalStorageSet; window.sanitizePlanForFirestore = sanitizePlanForFirestore;
window.doc = doc; window.setDoc = setDoc; window.serverTimestamp = serverTimestamp; window.savePlanTransactional = savePlanTransactional; window.checkStartupPlanRecovery = checkStartupPlanRecovery;
const URL_TYPES=['tiktok','website','youtube','instagram'];
let recipePhotoFiles=[];
let recipePhotoObjectUrls=[];
let platePlanAiModules=null;
let platePlanPreserveAddForm=false;
let platePlanPendingRecipePreFill=null;
const SLOTS=[
  {key:'breakfastE',short:'Brekkie E',color:'var(--green)',cls:'badge-green'},
  {key:'breakfastC',short:'Brekkie C',color:'var(--green)',cls:'badge-green'},
  {key:'lunchE',short:'Lunch E',color:'var(--purple)',cls:'badge-purple'},
  {key:'lunchC',short:'Lunch C',color:'var(--purple)',cls:'badge-purple'},
  {key:'dinnerE',short:'Dinner E',color:'var(--coral)',cls:'badge-coral'},
  {key:'dinnerC',short:'Dinner C',color:'var(--coral)',cls:'badge-coral'},
];
const SLOT_LABELS={breakfastE:'Breakfast\nElliott',breakfastC:'Breakfast\nChloe',lunchE:'Lunch\nElliott',lunchC:'Lunch\nChloe',dinnerE:'Dinner\nElliott',dinnerC:'Dinner\nChloe'};
const SLOT_COLORS={breakfastE:'var(--green)',breakfastC:'var(--green)',lunchE:'var(--purple)',lunchC:'var(--purple)',dinnerE:'var(--coral)',dinnerC:'var(--coral)'};
const UNIT_TO_GRAMS={
  g:1, kg:1000, ml:1, l:1000,
  tsp:5, teaspoon:5, teaspoons:5,
  tbsp:15, tablespoon:15, tablespoons:15,
  cup:240, cups:240,
  oz:28.35, ounce:28.35, ounces:28.35,
  lb:453.6, lbs:453.6, pound:453.6, pounds:453.6,
  'fl oz':30, 'fl. oz':30, 'fl. oz.':30, 'fluid oz':30, 'floz':30,
  tin:400, can:400,
  handful:30, handfuls:30,
  'small bunch':15, 'small bunches':15,
  'large bunch':30, 'large bunches':30,
  bunch:20, bunches:20,
  pinch:1, dash:1,
  slice:30, slices:30, piece:100, pieces:100, stalk:50, stalks:50,
  sprig:2, sprigs:2, leaf:1, leaves:2
};
function isMobilePlatePlan() { return window.matchMedia('(max-width:839px)').matches; }
let platePlanLastMobileFocus = null;
let platePlanReturningFromUiClose = false;
let platePlanHandlingHistoryPop = false;
function returnFromPlatePlanUiHistory(){
  platePlanReturningFromUiClose=true;
  history.back();
}
function markMobileLayerForBack(wrap, kind){
  if(!wrap || !isMobilePlatePlan() || wrap.dataset.historyEntry === '1') return;
  try {
    const activeMarked=document.querySelector('.modal-wrap.open[data-history-entry="1"],.mobile-more-wrap.open[data-history-entry="1"],.mobile-action-sheet-wrap.open[data-history-entry="1"]');
    const nextState={ ...(history.state || {}), platePlanLayer:kind };
    if(history.state?.platePlanLayer && !activeMarked) history.replaceState(nextState,'');
    else history.pushState(nextState, '');
    wrap.dataset.historyEntry = '1';
  } catch(_err) {}
}
function restoreMobileLayerFocus(){
  const target=platePlanLastMobileFocus;
  platePlanLastMobileFocus=null;
  if(target && document.contains(target)) setTimeout(()=>target.focus?.(),0);
}
function openMobileMore(){
  const wrap=document.getElementById('mobile-more-wrap'); if(!wrap) return;
  platePlanLastMobileFocus=document.activeElement;
  wrap.classList.add('open');
  markMobileLayerForBack(wrap,'more');
  setTimeout(()=>wrap.querySelector('button')?.focus(),0);
}
function closeMobileMore(fromHistory=false){
  const wrap=document.getElementById('mobile-more-wrap'); if(!wrap) return;
  const marked=wrap.dataset.historyEntry==='1';
  wrap.classList.remove('open'); delete wrap.dataset.historyEntry;
  restoreMobileLayerFocus();
  if(marked && !fromHistory) returnFromPlatePlanUiHistory();
}
function mobileMoreView(id) { closeMobileMore(); showView(id); }
function syncMobileNavigation(id){
  const primary = ['today','vault','planner','data','search'].includes(id) ? id : '';
  document.querySelectorAll('#mobile-nav button').forEach(button=>button.classList.toggle('active',button.dataset.view===primary));
}
function closeMobileActionSheet(fromHistory=false){
  const wrap=document.getElementById('mobile-action-sheet-wrap'); if(!wrap) return;
  const marked=wrap.dataset.historyEntry==='1';
  wrap.classList.remove('open'); delete wrap.dataset.historyEntry;
  restoreMobileLayerFocus();
  if(marked && !fromHistory) returnFromPlatePlanUiHistory();
}
function openMobileActionSheet(title, actions){
  const host=document.getElementById('mobile-action-sheet'); if(!host) return;
  const titleId='mobile-action-sheet-title';
  host.setAttribute('role','dialog'); host.setAttribute('aria-modal','true'); host.setAttribute('aria-labelledby',titleId);
  host.innerHTML=`<div class="mobile-sheet-handle"></div><div class="row-between" style="align-items:center;margin-bottom:10px"><h3 id="${titleId}" style="margin:0">${ppEscapeHtml(title||'Actions')}</h3><button class="btn sm ghost" onclick="closeMobileActionSheet()">Close</button></div><div style="display:grid;gap:6px">${actions.map(action=>`<button class="btn ${action.danger?'danger':''}" onclick="closeMobileActionSheet(true);${action.onclick}">${ppEscapeHtml(action.label)}</button>`).join('')}</div>`;
  const wrap=document.getElementById('mobile-action-sheet-wrap');
  platePlanLastMobileFocus=document.activeElement;
  wrap?.classList.add('open');
  markMobileLayerForBack(wrap,'actions');
  setTimeout(()=>host.querySelector('button')?.focus(),0);
}
function openCreateActionSheet(){
  openMobileActionSheet('Add a recipe',[
    {label:'Add manually',onclick:`openManualRecipeEntry()`},
    {label:'Scan recipe photos',onclick:`openRecipeCaptureFromToolbar()`},
    {label:'Paste recipe text',onclick:`openRecipeTextFromToolbar()`}
  ]);
}
function openManualRecipeEntry() { showView('add'); setTimeout(()=>document.getElementById('r-name')?.focus(),0); }
function openRecipeCaptureFromToolbar() { showView('add'); setTimeout(()=>openRecipePhotoPicker('library'),0); }
function openRecipeTextFromToolbar() { showView('add'); setTimeout(()=>openRecipeTextPaste(),0); }
function installPlatePlanModalHistory(){
  if(!isMobilePlatePlan() || !document.body || document.body.dataset.modalHistoryReady==='1') return;
  document.body.dataset.modalHistoryReady='1';
  new MutationObserver(records=>records.forEach(record=>{
    const wrap=record.target;
    if(!(wrap instanceof HTMLElement) || !wrap.classList.contains('modal-wrap')) return;
    if(wrap.classList.contains('open')) markMobileLayerForBack(wrap,'modal');
    else if(wrap.dataset.historyEntry==='1'){
      delete wrap.dataset.historyEntry;
      if(!platePlanHandlingHistoryPop) returnFromPlatePlanUiHistory();
    }
  })).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
}
window.addEventListener('popstate',()=>{
  if (platePlanReturningFromUiClose) { platePlanReturningFromUiClose=false;return; }
  platePlanHandlingHistoryPop=true;
  const action=document.getElementById('mobile-action-sheet-wrap');
  if(action?.classList.contains('open')){closeMobileActionSheet(true);setTimeout(()=>platePlanHandlingHistoryPop=false,0);return;}
  const more=document.getElementById('mobile-more-wrap');
  if(more?.classList.contains('open')){closeMobileMore(true);setTimeout(()=>platePlanHandlingHistoryPop=false,0);return;}
  const modal=Array.from(document.querySelectorAll('.modal-wrap.open')).pop();
  const close=modal?.querySelector('button[onclick*="close" i]');
  if(close) close.click(); else modal?.classList.remove('open');
  setTimeout(()=>platePlanHandlingHistoryPop=false,0);
});
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape') return;
  const action=document.getElementById('mobile-action-sheet-wrap');
  if(action?.classList.contains('open')){event.preventDefault();closeMobileActionSheet();return;}
  const more=document.getElementById('mobile-more-wrap');
  if(more?.classList.contains('open')){event.preventDefault();closeMobileMore();return;}
  const modal=Array.from(document.querySelectorAll('.modal-wrap.open')).pop();
  const close=modal?.querySelector('button[onclick*="close" i]');
  if (close) { event.preventDefault();close.click(); }
});
function openRecipeActions(recipeId){
  const recipe=getProductIndexRecipe(recipeId) || (state?.recipes||[]).find(r=>r.id===recipeId);
  if(!recipe) return;
  openMobileActionSheet(recipe.name,[
    {label:'Review recipe',onclick:`editRecipeModalView('${ppEscapeAttr(recipeId)}')`},
    {label:'Recipe card',onclick:`downloadRecipeCard('${ppEscapeAttr(recipeId)}')`},
    {label:'Duplicate',onclick:`duplicateRecipe('${ppEscapeAttr(recipeId)}')`},
    {label:'Edit source recipe',onclick:`editRecipe('${ppEscapeAttr(recipeId)}')`},
    {label:'Delete',onclick:`deleteRecipe('${ppEscapeAttr(recipeId)}')`,danger:true}
  ]);
}
function openEnhancedRecipeActions(recipeId){
  const recipe=getProductIndexRecipe(recipeId) || (state?.recipes||[]).find(r=>r.id===recipeId);
  if(!recipe) return;
  if(!recipe.enhanced){
    openMobileActionSheet(recipe.name,[
      {label:'Create enhanced version',onclick:`editEnhancedRecipe('${ppEscapeAttr(recipeId)}')`},
      {label:'Review recipe',onclick:`editRecipeModalView('${ppEscapeAttr(recipeId)}')`}
    ]);
    return;
  }
  openMobileActionSheet(`${recipe.name} · Enhanced`,[
    {label:'Review enhanced recipe',onclick:`reviewEnhancedRecipe('${ppEscapeAttr(recipeId)}')`},
    {label:'Recipe card',onclick:`downloadRecipeCard('${ppEscapeAttr(recipeId)}','enhanced')`},
    {label:'Duplicate complete recipe',onclick:`duplicateRecipe('${ppEscapeAttr(recipeId)}')`},
    {label:'Edit enhanced recipe',onclick:`editEnhancedRecipe('${ppEscapeAttr(recipeId)}')`},
    {label:'Delete enhanced version',onclick:`deleteEnhancedRecipe('${ppEscapeAttr(recipeId)}')`,danger:true}
  ]);
}
function openProductBankActions(productId){
  const product=getProduct(productId); if(!product) return;
  const group=getIngredientGroup(product.groupId);
  const actions = [
    {label:'Reallocate / Change Ingredient',onclick:`openProductReallocationModal('${ppEscapeAttr(productId)}')`},
  ];
  if(group){
    actions.push({label:'Delink from Ingredient',onclick:`confirmDelinkProduct('${ppEscapeAttr(productId)}')`});
  }
  actions.push({label:'Delete product',onclick:`deleteIng('${ppEscapeAttr(productId)}')`,danger:true});
  openMobileActionSheet(product.name || 'Product actions', actions);
}
function openIngredientFamilyActions(familyId){
  const family=getIngredientFamily(familyId); if(!family) return;
  openMobileActionSheet(family.name || 'Ingredient actions',[
    {label:'Edit aliases',onclick:`openIngredientFamilyAliasesModal('${ppEscapeAttr(familyId)}')`},
    {label:'Add sub-type',onclick:`addSubTypeToFamilyPrompt('${ppEscapeAttr(familyId)}')`},
    {label:'Merge ingredient',onclick:`mergeIngredientFamilyPrompt('${ppEscapeAttr(familyId)}')`},
    {label:'Make sub-type',onclick:`openIngredientToSubTypeModal('${ppEscapeAttr(familyId)}')`},
    {label:'Manage products',onclick:`openProductDefaultPicker('family','${ppEscapeAttr(familyId)}')`},
    {label:'Delete ingredient',onclick:`deleteIngredientFamilyPrompt('${ppEscapeAttr(familyId)}')`,danger:true}
  ]);
}
function openIngredientGroupActions(groupId){
  const group=getIngredientGroup(groupId); if(!group) return;
  openMobileActionSheet(getGroupTypeName(group) || 'Sub-type actions',[
    {label:'Edit aliases',onclick:`editGroupAliasesPrompt('${ppEscapeAttr(groupId)}')`},
    {label:'Merge sub-type',onclick:`mergeIngredientGroupPrompt('${ppEscapeAttr(groupId)}')`},
    {label:'Make ingredient',onclick:`convertSubTypeToIngredient('${ppEscapeAttr(groupId)}')`},
    {label:'Manage products',onclick:`openProductDefaultPicker('group','${ppEscapeAttr(groupId)}')`},
    {label:'Delete sub-type',onclick:`deleteIngredientGroupPrompt('${ppEscapeAttr(groupId)}')`,danger:true}
  ]);
}
function getProductIndexRecipe(id) { return platePlanIndexes.recipes.get(id) || (state?.recipes||[]).find(recipe=>recipe.id===id) || null; }
function resetProgressiveList(name,signature){
  if (platePlanListSignatures[name]!==signature) { platePlanListSignatures[name]=signature; platePlanListLimits[name]=PLATEPLAN_LIST_BATCH; }
}
function showMorePlatePlanList(name){ platePlanListLimits[name]=(platePlanListLimits[name]||PLATEPLAN_LIST_BATCH)+PLATEPLAN_LIST_BATCH; ({vault:renderVault,bank:renderBank,ingredients:renderIngredientBank}[name])?.(); }
function schedulePlatePlanListRender(name){
  clearTimeout(platePlanListSearchTimers[name]);
  platePlanListSearchTimers[name]=setTimeout(()=>requestAnimationFrame(()=>({vault:renderVault,bank:renderBank,ingredients:renderIngredientBank}[name])?.()),120);
}
function progressiveListButton(name,total,shown){
  const remaining=Math.max(0,total-shown); if(!remaining) return '';
  return `<div class="progressive-more"><button class="btn" onclick="showMorePlatePlanList('${name}')">Show ${Math.min(PLATEPLAN_LIST_BATCH,remaining)} more</button><span style="font-size:12px;color:var(--text2)">${remaining} remaining</span></div>`;
}
function rebuildPlatePlanIndexes(){
  const products=new Map((state?.ingredients||[]).map(item=>[item.id,item]));
  const groups=new Map((state?.ingredientGroups||[]).map(item=>[item.id,item]));
  const families=new Map((state?.ingredientFamilies||[]).map(item=>[item.id,item]));
  const recipes=new Map((state?.recipes||[]).map(item=>[item.id,item]));
  const recipeDependencies=new Map();
  const remember=(key,id)=>{ if(!key) return; if(!recipeDependencies.has(key)) recipeDependencies.set(key,new Set()); recipeDependencies.get(key).add(id); };
  recipes.forEach(recipe=>[...(recipe.ingredients||[]),...(recipe.enhanced?.ingredients||[])].forEach(ing=>{ remember(ing?.bankId,recipe.id); remember(ing?.groupId,recipe.id); }));
  platePlanIndexes={products,groups,families,recipes,recipeDependencies};
}
function markPlatePlanViewsDirty(...names) { (names.length?names:['today','vault','ingredients','bank','planner','planlib','shopping','data','prefs']).forEach(name=>platePlanDirtyViews.add(name)); }
function loadBakedState(){
  try{
    const el=document.getElementById('baked-state');
    if(!el)return;
    el.textContent='{}';
  }catch(e){console.warn('Baked state load skipped',e);}
}
function stableStateComparisonValue(value, seen = new WeakSet()){
  if(value && typeof value === 'object'){
    if (seen.has(value)) return null;
    seen.add(value);
  }
  if(Array.isArray(value)) return value.map(v => stableStateComparisonValue(v, seen));
  if(value && typeof value === 'object'){
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stableStateComparisonValue(value[key], seen);
      return out;
    }, {});
  }
  return value;
}
function stateValuesMatch(a, b){
  try {
    return safeJsonStringify(stableStateComparisonValue(a)) === safeJsonStringify(stableStateComparisonValue(b));
  } catch(_e) {
    return false;
  }
}
function describeVersionCollection(browserItems, fileItems, label, nameForItem){
  const browserList = Array.isArray(browserItems) ? browserItems : [];
  const fileList = Array.isArray(fileItems) ? fileItems : [];
  const keyFor = (item, index) => String(item?.id || item?.key || item?.name || index);
  const browserMap = new Map(browserList.map((item, index) => [keyFor(item, index), item]));
  const fileMap = new Map(fileList.map((item, index) => [keyFor(item, index), item]));
  const onlyFile = [], onlyBrowser = [], changed = [];
  fileMap.forEach((item, key) => {
    if(!browserMap.has(key)) onlyFile.push(nameForItem(item));
    else if(!stateValuesMatch(browserMap.get(key), item)) changed.push(nameForItem(item) || nameForItem(browserMap.get(key)));
  });
  browserMap.forEach((item, key) => { if(!fileMap.has(key)) onlyBrowser.push(nameForItem(item)); });
  if(!onlyFile.length && !onlyBrowser.length && !changed.length) return '';
  const brief = (heading, names) => {
    if(!names.length) return '';
    const visible = names.slice(0, 4).map(ppEscapeHtml).join(', ');
    return `${heading} ${names.length}${visible ? ` (${visible}${names.length > 4 ? ` +${names.length - 4} more` : ''})` : ''}`;
  };
  const parts = [brief('only in file:', onlyFile), brief('only in browser:', onlyBrowser), brief('changed:', changed)].filter(Boolean);
  return `<div><strong>${label}:</strong> file ${fileList.length}, browser ${browserList.length}<div style="color:var(--text3);margin-top:2px">${parts.join(' &middot; ')}</div></div>`;
}
function countPlannedMeals(plan){
  return Object.values(plan?.slots || {}).reduce((total, day) => total + Object.values(day || {}).filter(Boolean).length, 0);
}
function renderBakedStateDifferenceSummary(browserState, fileState){
  const rows = [
    describeVersionCollection(browserState?.recipes, fileState?.recipes, 'Recipes', item => item?.name || 'Unnamed recipe'),
    describeVersionCollection(browserState?.ingredients, fileState?.ingredients, 'Products', item => item?.name || 'Unnamed product'),
    describeVersionCollection(browserState?.ingredientFamilies, fileState?.ingredientFamilies, 'Ingredients', item => item?.name || 'Unnamed ingredient'),
    describeVersionCollection(browserState?.ingredientGroups, fileState?.ingredientGroups, 'Sub-types', item => item?.name || item?.family || 'Unnamed sub-type')
  ].filter(Boolean);
  const browserCats = browserState?.customCats || {};
  const fileCats = fileState?.customCats || {};
  if(!stateValuesMatch(browserCats, fileCats)){
    rows.push(`<div><strong>Categories:</strong> file ${Object.keys(fileCats).length}, browser ${Object.keys(browserCats).length} <span style="color:var(--text3)">(category definitions differ)</span></div>`);
  }
  if(!stateValuesMatch(browserState?.plan || {}, fileState?.plan || {})){
    rows.push(`<div><strong>Current meal plan:</strong> file ${countPlannedMeals(fileState?.plan)} planned meals, browser ${countPlannedMeals(browserState?.plan)} planned meals</div>`);
  }
  if(!stateValuesMatch(browserState?.overrides || {}, fileState?.overrides || {})) rows.push('<div><strong>Shopping/meal overrides:</strong> differ</div>');
  if(!stateValuesMatch(browserState?.prefs || {}, fileState?.prefs || {})) rows.push('<div><strong>Preferences and targets:</strong> differ</div>');
  if(!stateValuesMatch(browserState?.planHistory || [], fileState?.planHistory || [])){
    rows.push(`<div><strong>Plan history:</strong> file ${(fileState?.planHistory || []).length}, browser ${(browserState?.planHistory || []).length}</div>`);
  }
  if(!rows.length) return '<div style="color:var(--text2)">No content differences were found; only JSON formatting or property order differs.</div>';
  return rows.join('');
}
function renderBakedStateRecoveryBanner(){
  let pendingRaw = null;
  try{ pendingRaw = localStorage.getItem(BAKED_CANDIDATE_SK); }catch(e){}
  if(!pendingRaw) return;
  let pending = null;
  try{ pending = JSON.parse(pendingRaw); }catch(e){ try{ localStorage.removeItem(BAKED_CANDIDATE_SK); }catch(_){} return; }
  const browserVersion = browserStateBeforeBakedComparison || state || {};
  const differences = renderBakedStateDifferenceSummary(browserVersion, pending);
  const existing = document.getElementById('baked-state-recovery-banner');
  if(existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'baked-state-recovery-banner';
  banner.setAttribute('role','dialog');
  banner.setAttribute('aria-modal','true');
  banner.setAttribute('aria-label','Choose the PlatePlan data to keep');
  banner.style.cssText = 'position:sticky;top:0;z-index:500;background:var(--amber-bg);border:1px solid var(--amber);color:var(--text);padding:10px 14px;margin:0 0 12px;border-radius:8px;display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;';
  banner.innerHTML = `
    <div style="font-size:13px;line-height:1.35;flex:1;min-width:280px">
      <strong>PlatePlan found different saved data in this file.</strong>
      <div style="color:var(--text2);margin-top:2px">Review the differences before choosing which version to keep.</div>
      <div style="display:grid;gap:5px;margin-top:8px;padding:8px 10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;max-height:190px;overflow:auto">${differences}</div>
    </div>
    <div class="btn-row" style="margin:0">
      <button class="btn sm" onclick="useBakedFileState()">Use File Data</button>
      <button class="btn sm ghost" onclick="dismissBakedFileState()">Keep Browser Data</button>
    </div>`;
  document.body.prepend(banner);
  setPlatePlanStartupInert(true,banner.id);
}
function useBakedFileState() { runWithRecoveryPoint('Before switching to file data', applyBakedFileState); }
function applyBakedFileState(){
  try{
    const raw = localStorage.getItem(BAKED_CANDIDATE_SK);
    if(!raw) return;
    const baked = JSON.parse(raw);
    safeLocalStorageSet(SK, safeJsonStringify(baked));
    localStorage.removeItem(BAKED_CANDIDATE_SK);
    state = loadState();
    refreshPlatePlanDerivedState({ persist:true, render:true });
    document.getElementById('baked-state-recovery-banner')?.remove();
    setPlatePlanStartupInert(false);
  }catch(e){ openAppInfoModal('File data unavailable','PlatePlan could not load the data embedded in this file. Your browser data has not been replaced.'); }
}
function dismissBakedFileState(){
  try{ localStorage.removeItem(BAKED_CANDIDATE_SK); }catch(e){}
  document.getElementById('baked-state-recovery-banner')?.remove();
  setPlatePlanStartupInert(false);
}
const RECIPES_BACKUP_SK='plateplan_recipes_backup_v2';
function normalizeLoadedState(s, { injectSeed = false, restoreRecipeBackup = false } = {}){
  if (!s || typeof s !== 'object') return s;
  if (injectSeed && (!Array.isArray(s.ingredients) || s.ingredients.length === 0)) {
    s.ingredients = [...SEED];
  }
  if (restoreRecipeBackup && (!Array.isArray(s.recipes) || s.recipes.length === 0)) {
    try {
      const backupRaw = localStorage.getItem(RECIPES_BACKUP_SK);
      if (backupRaw) {
        const backupRecipes = JSON.parse(backupRaw);
        if (Array.isArray(backupRecipes) && backupRecipes.length > 0) {
          s.recipes = backupRecipes;
        }
      }
    } catch (_e) {}
  }
  if (s.plan && s.plan.slots) {
      for (let d in s.plan.slots) {
          for (let k in s.plan.slots[d]) {
              let val = s.plan.slots[d][k];
              if (typeof val === 'string' && val) {
                  const parsed = parsePlanRecipeValue(val);
                  s.plan.slots[d][k] = { id: parsed.id, instanceId: 'pm-' + Date.now() + Math.random().toString(36).substring(2,7), ...(parsed.variant === 'enhanced' ? { variant: 'enhanced' } : {}) };
              }
          }
      }
  }
  if (!s.overrides) s.overrides = {};
  if (!s.packPicks) s.packPicks = {};
  if (!Array.isArray(s.planHistory)) s.planHistory = [];
  if (!Array.isArray(s.ignoredGroupMergeSuggestions)) s.ignoredGroupMergeSuggestions = [];
  if (!Array.isArray(s.ignoredDataQualityWarnings)) s.ignoredDataQualityWarnings = [];
  if (!s.useUpProducts || typeof s.useUpProducts !== 'object' || Array.isArray(s.useUpProducts)) s.useUpProducts = {};
  if (!s.dataQualityDismissals || typeof s.dataQualityDismissals !== 'object' || Array.isArray(s.dataQualityDismissals)) s.dataQualityDismissals = {};
  if(!s.meta || typeof s.meta !== 'object') s.meta = {};
  s.meta.schemaVersion = +s.meta.schemaVersion || 1;
  const targetHouseholdId = s.meta.householdId || window.activeHouseholdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  s.meta.householdId = targetHouseholdId;
  window.activeHouseholdId = targetHouseholdId;
  window.activeHousehold = { id: targetHouseholdId };
  if(!Array.isArray(s.meta.deletedProductIds)) s.meta.deletedProductIds = [];
  if(!Array.isArray(s.meta.deletedCategoryIds)) s.meta.deletedCategoryIds = [];
  if(s.meta.deletedProductIds.length > 0){
    const delSet = new Set(s.meta.deletedProductIds);
    s.ingredients = (s.ingredients || []).filter(i => !delSet.has(i.id));
  }
  if(s.meta.deletedCategoryIds.length > 0){
    const delCatSet = new Set(s.meta.deletedCategoryIds);
    delCatSet.forEach(cid => { delete s.customCats[cid]; });
  }
  if (!Array.isArray(s.ingredientGroups)) s.ingredientGroups = [];
  if (!Array.isArray(s.ingredientFamilies)) s.ingredientFamilies = [];
  if (s.plan && typeof s.plan === 'object') {
    if (!Array.isArray(s.plan.mealPrepGroups)) s.plan.mealPrepGroups = [];
    if (!Array.isArray(s.plan.declinedMealPrepGroups)) s.plan.declinedMealPrepGroups = [];
    if (!s.plan.shoppingAtHome || typeof s.plan.shoppingAtHome !== 'object' || Array.isArray(s.plan.shoppingAtHome)) s.plan.shoppingAtHome = {};
    if (!s.plan.slotReasons || typeof s.plan.slotReasons !== 'object' || Array.isArray(s.plan.slotReasons)) s.plan.slotReasons = {};
  }
  s.planHistory.forEach(plan => {
    if(plan && (!plan.shoppingAtHome || typeof plan.shoppingAtHome !== 'object' || Array.isArray(plan.shoppingAtHome))) plan.shoppingAtHome = {};
    if(plan && (!plan.slotReasons || typeof plan.slotReasons !== 'object' || Array.isArray(plan.slotReasons))) plan.slotReasons = {};
  });
  if (!s.prefs || typeof s.prefs !== 'object') s.prefs = {};
  if (!s.prefs.productPriority) s.prefs.productPriority = 'protein';
  s.prefs.prioritiseUseUpProducts = !!s.prefs.prioritiseUseUpProducts;
  if (!s.prefs.planTrafficFilter) s.prefs.planTrafficFilter = 'any';
  if (!Array.isArray(s.prefs.planTrafficE)) s.prefs.planTrafficE = ['green','amber','red'];
  if (!Array.isArray(s.prefs.planTrafficC)) s.prefs.planTrafficC = ['green','amber','red'];
  if (!['family','category','storage'].includes(s.prefs.shopGroupBy)) s.prefs.shopGroupBy = 'family';
  if (!s.prefs.exclusions || typeof s.prefs.exclusions !== 'object') s.prefs.exclusions = { shared: [], elliott: [], chloe: [] };
  ['shared','elliott','chloe'].forEach(k => { if(!Array.isArray(s.prefs.exclusions[k])) s.prefs.exclusions[k] = []; });
  const legacyExclusions = String(s.prefs.exclude || '').split(',').map(x => x.trim()).filter(Boolean);
  legacyExclusions.forEach(name => {
    if(!s.prefs.exclusions.shared.some(x => normaliseAliasText(x.name || x) === normaliseAliasText(name))) {
      s.prefs.exclusions.shared.push({ name });
    }
  });
  if(!s.customCats) s.customCats = {};
  if(!s.prefs.eAlloc) s.prefs.eAlloc = {b: 15, l: 25, d: 45, s: 15};
  if(!s.prefs.cAlloc) s.prefs.cAlloc = {b: 25, l: 30, d: 35, s: 10};
  (s.ingredients || []).forEach(ing => {
    if((ing.name || '').toLowerCase().includes('garlic') && (!+ing.itemWeight || +ing.itemWeight === 100)) {
      ing.itemWeight = 6;
    }
    if(shouldClearAutoItemWeight(ing)) {
      ing.itemWeight = null;
      ing.itemWeightUnit = 'g';
    }
  });
  (s.recipes || []).forEach(r => {
    if (!r.nutrition) {
      const serves = r.serves || 1;
      const ps = { cal: r.cal||0, prot: r.prot||0, carb: r.carb||0, fat: r.fat||0, fibre: r.fibre||0 };
      const tot = {
        cal:   Math.round(ps.cal   * serves),
        prot:  Math.round(ps.prot  * serves * 10) / 10,
        carb:  Math.round(ps.carb  * serves * 10) / 10,
        fat:   Math.round(ps.fat   * serves * 10) / 10,
        fibre: Math.round(ps.fibre * serves * 10) / 10
      };
      r.nutrition = { total: tot, perServing: ps };
    }
    if (r.enhanced && !r.enhanced.nutrition) {
      const serves = r.serves || 1;
      const eps = { cal: r.enhanced.cal||0, prot: r.enhanced.prot||0, carb: r.enhanced.carb||0, fat: r.enhanced.fat||0, fibre: r.enhanced.fibre||0 };
      const etot = {
        cal:   Math.round(eps.cal   * serves),
        prot:  Math.round(eps.prot  * serves * 10) / 10,
        carb:  Math.round(eps.carb  * serves * 10) / 10,
        fat:   Math.round(eps.fat   * serves * 10) / 10,
        fibre: Math.round(eps.fibre * serves * 10) / 10
      };
      r.enhanced.nutrition = { total: etot, perServing: eps };
    }
  });
  if(!s.meta || typeof s.meta !== 'object') s.meta = {};
  if(!Array.isArray(s.meta.deletedProductIds)) s.meta.deletedProductIds = [];
  if(!Array.isArray(s.meta.deletedCategoryIds)) s.meta.deletedCategoryIds = [];
  if(s.meta.deletedProductIds.length > 0){
    const delSet = new Set(s.meta.deletedProductIds);
    s.ingredients = (s.ingredients || []).filter(i => !delSet.has(i.id));
  }
  if(s.meta.deletedCategoryIds.length > 0){
    const delCatSet = new Set(s.meta.deletedCategoryIds);
    delCatSet.forEach(cid => { delete s.customCats[cid]; });
  }
  ensureIngredientGroups(s);
  CAT = { ...STANDARD_CATS, ...s.customCats };
  Object.keys(CAT).forEach(k => { if(!CAT[k] || s.meta.deletedCategoryIds.includes(k)) delete CAT[k]; });
  return s;
}
function loadState(){
  let s = {recipes:[],ingredients:[...SEED],ingredientGroups:[],ingredientFamilies:[],ignoredGroupMergeSuggestions:[],ignoredDataQualityWarnings:[],dataQualityDismissals:{},useUpProducts:{},plan:{},planHistory:[],excluded:{},prefs:{exclude:'mushrooms, courgette',exclusions:{shared:[],elliott:[],chloe:[]},diet:'vegetarian',ecal:2400,eprot:130,ccal:1700,cprot:100, shopGroupBy: 'family', productPriority:'protein',prioritiseUseUpProducts:false}, customCats:{}, isCloudHydrated: false};
  try{
    const d=localStorage.getItem(SK);
    if(d){
      const parsed = JSON.parse(d);
      s = { ...s, ...parsed };
      if (!Array.isArray(s.ingredients) || s.ingredients.length === 0) {
        const offlineBackup = localStorage.getItem('plateplan_offline_backup');
        if (offlineBackup) {
          try {
            const parsedBackup = JSON.parse(offlineBackup);
            if (Array.isArray(parsedBackup) && parsedBackup.length > 0) {
              s.ingredients = parsedBackup;
            }
          } catch(_e) {}
        }
        if (!Array.isArray(s.ingredients) || s.ingredients.length === 0) {
          s.ingredients = [...SEED];
        }
      }
    }
    const backupRaw = localStorage.getItem(RECIPES_BACKUP_SK);
    if(backupRaw && (!Array.isArray(s.recipes) || s.recipes.length === 0)){
      const backupRecipes = JSON.parse(backupRaw);
      if(Array.isArray(backupRecipes) && backupRecipes.length > 0){
        s.recipes = backupRecipes;
      }
    }
    const planBackupRaw = localStorage.getItem('plateplan_plan_backup');
    if(planBackupRaw && (!s.plan || typeof s.plan !== 'object' || Object.keys(s.plan).length === 0)){
      try {
        const parsedPlan = JSON.parse(planBackupRaw);
        if(parsedPlan && typeof parsedPlan === 'object' && Object.keys(parsedPlan).length > 0){
          s.plan = parsedPlan;
        }
      } catch(_e) {}
    }
    const historyBackupRaw = localStorage.getItem('plateplan_history_v2') || localStorage.getItem('plateplan_history_backup');
    if(historyBackupRaw && (!Array.isArray(s.planHistory) || s.planHistory.length === 0)){
      try {
        const parsedHist = JSON.parse(historyBackupRaw);
        if(Array.isArray(parsedHist) && parsedHist.length > 0){
          s.planHistory = parsedHist;
        }
      } catch(_e) {}
    }
    if((!s.plan || typeof s.plan !== 'object' || Object.keys(s.plan).length === 0) || (!Array.isArray(s.planHistory) || s.planHistory.length === 0)){
      try {
        const recList = JSON.parse(localStorage.getItem(RECOVERY_SK) || '[]');
        if(Array.isArray(recList)){
          for(const point of recList){
            if((!s.plan || typeof s.plan !== 'object' || Object.keys(s.plan).length === 0) && point?.state?.plan && Object.keys(point.state.plan).length > 0){
              s.plan = point.state.plan;
            }
            if((!Array.isArray(s.planHistory) || s.planHistory.length === 0) && Array.isArray(point?.state?.planHistory) && point.state.planHistory.length > 0){
              s.planHistory = point.state.planHistory;
            }
          }
        }
      } catch(_e) {}
    }
  }catch(e){}
  return normalizeLoadedState(s, { injectSeed: false, restoreRecipeBackup: false });
}
const SYNC_OUTBOX_SK='plateplan_v1_sync_outbox';
const SYNC_DEVICE_SK='plateplan_v1_device_id';
let platePlanCloudReady=false;
let platePlanSyncSuppress=false;
let platePlanSyncTimer=null;
let platePlanFirebaseApp=null;
let platePlanAuth=null;
let platePlanDb=null;
let platePlanCloudUser=null;
let platePlanMemberRole='member';
let platePlanLastProjection={};
let platePlanCloudRevisions={};
let platePlanSyncUnsubscribers=[];
let platePlanPendingConflict=null;
let platePlanLastSyncError=null;
let platePlanLastSyncedAt=null;
let platePlanIsPushing=false;
let platePlanPendingPush=false;
let platePlanSyncErrorCount=0;
let platePlanBackoffUntil=0;
let platePlanLastPushCompletedAt=0;
let platePlanLegacyStateDeleted=false;
let platePlanLastPushedSignatures={
  meta:'',
  recipes:'',
  products:'',
  taxonomy:'',
  planner:'',
  history:''
};
function computePayloadSignature(obj){
  if(!obj || typeof obj !== 'object') return '';
  try {
    return JSON.stringify(obj);
  } catch(e){
    return String(Date.now());
  }
}
function capturePlatePlanEditBaseline(key) { return true; }
function getPlatePlanDeviceId(){
  try{
    let id=localStorage.getItem(SYNC_DEVICE_SK);
    if(!id){
      id='dev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
      localStorage.setItem(SYNC_DEVICE_SK,id);
    }
    return id;
  }catch(e){
    return 'dev-session-'+Date.now().toString(36);
  }
}
function getPlatePlanSyncOutbox() { return []; }
function setPlatePlanSyncOutbox(_value){
}
function cleanCloudValue(value){
  if(value===undefined||value===null) return null;
  if(typeof value !== 'object') return value;
  try {
    const seen = new WeakSet();
    const jsonStr = JSON.stringify(value, (k, v) => {
      if (typeof v === 'number' && (isNaN(v) || !isFinite(v))) return null;
      if (v === undefined) return undefined;
      if (typeof v === 'function') return undefined;
      if (typeof Node !== 'undefined' && v instanceof Node) return undefined;
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return undefined;
        seen.add(v);
      }
      return v;
    });
    return jsonStr ? JSON.parse(jsonStr) : null;
  } catch(e) {
    return null;
  }
}
function syncValuesEqual(a,b){
  if(a===b) return true;
  if(a==null && b==null) return true;
  if(a==null || b==null) return false;
  return safeJsonStringify(a)===safeJsonStringify(b);
}
function platePlanStateProjection(source=state){
  const out={};
  (source?.recipes||[]).forEach(item=>{ if(item?.id) out['recipes/'+item.id]=item; });
  (source?.ingredients||[]).forEach(item=>{ if(item?.id) out['products/'+item.id]=item; });
  (source?.ingredientFamilies||[]).forEach(item=>{ if(item?.id) out['ingredientFamilies/'+item.id]=item; });
  (source?.ingredientGroups||[]).forEach(item=>{ if(item?.id) out['ingredientGroups/'+item.id]=item; });
  Object.entries(source?.overrides||{}).forEach(([id,value])=>{ out['overrides/'+id]=value; });
  out['plans/current']=source?.plan||{};
  out['plans/history']=source?.planHistory||[];
  out['settings/shared']={
    prefs:source?.prefs||{},customCats:source?.customCats||{},excluded:source?.excluded||{},
    useUpProducts:source?.useUpProducts||{},
    ignoredGroupMergeSuggestions:source?.ignoredGroupMergeSuggestions||[],
    ignoredDataQualityWarnings:source?.ignoredDataQualityWarnings||[],
    dataQualityDismissals:source?.dataQualityDismissals||{},packPicks:source?.packPicks||{},meta:source?.meta||{}
  };
  return out;
}
function getPlatePlanHouseholdId(){
  const hid = window.CURRENT_HOUSEHOLD_ID || window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  window.CURRENT_HOUSEHOLD_ID = hid;
  if (!window.activeHouseholdId && hid) {
    window.activeHouseholdId = hid;
    window.activeHousehold = { id: hid };
  }
  if (state?.meta && !state.meta.householdId && hid) { state.meta.householdId = hid; }
  return hid;
}
function getHouseholdDocRef(db, householdId) {
  const database = db || platePlanDb;
  const hid = householdId || window.CURRENT_HOUSEHOLD_ID || getPlatePlanHouseholdId();
  window.CURRENT_HOUSEHOLD_ID = hid;
  return database.collection('households').doc(hid);
}
window.getHouseholdDocRef = getHouseholdDocRef;
function getPlatePlanDataCollection(explicitHouseholdId){
  const hid = explicitHouseholdId || getPlatePlanHouseholdId();
  return getHouseholdDocRef(platePlanDb, hid).collection('data');
}
function platePlanCloudRef(key, explicitHouseholdId){
  const hid = explicitHouseholdId || getPlatePlanHouseholdId();
  const parts=String(key).split('/');
  return platePlanDb.collection('households').doc(hid).collection(parts[0]).doc(encodeURIComponent(parts.slice(1).join('/')));
}
let platePlanCurrentPushPromise = null;
async function persistPlatePlanDataQualityFix(reason = 'Data quality update'){
  platePlanTransactionShield.inFlight = true;
  try {
    saveState(true);
    const result = await pushStateToCloud(true);
    platePlanTransactionShield.lastCompletedAt = Date.now();
    return result;
  } catch(error) {
    console.warn(`persistPlatePlanDataQualityFix failed (${reason}):`, error);
    showPlatePlanToast('Save Failed: Database update could not be committed.');
    throw error;
  } finally {
    platePlanTransactionShield.inFlight = false;
  }
}
function renderAll(){
  rebuildPlatePlanIndexes();
  platePlanNutritionCache.clear();
  refreshPlatePlanDerivedState({ persist: false, render: true, full: true });
}
window.renderAll = renderAll;
async function saveIngredient(item){
  if(!item || !item.id) throw new Error('Product item must have an id');
  const householdId = window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  const db = platePlanDb || (window.firebase && firebase.firestore && firebase.firestore());
  if(db && platePlanCloudReady && platePlanCloudUser && navigator.onLine){
    if(Date.now() < platePlanBackoffUntil){
      console.warn('[FIRESTORE] Throttling direct ingredient write during active backoff.');
      return;
    }
    const cleaned = sanitizePayloadForFirestore(unwrapAndCleanItem(item));
    await db.collection('households').doc(householdId).collection('ingredients').doc(item.id).set(cleaned, { merge: true }).catch(err => {
      console.warn('saveIngredient cloud error:', err);
    });
  }
}
window.saveIngredient = saveIngredient;
async function addIngredient(item) { return saveIngredient(item); }
window.addIngredient = addIngredient;
async function deleteIngredient(id){
  if(!id) return;
  const householdId = window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  const db = platePlanDb || (window.firebase && firebase.firestore && firebase.firestore());
  if(db){
    await db.collection('households').doc(householdId).collection('ingredients').doc(id).delete().catch(err => {
      console.warn('deleteIngredient cloud error:', err);
    });
  }
}
window.deleteIngredient = deleteIngredient;
async function saveRecipe(recipe){
  if(!recipe || !recipe.id) throw new Error('Recipe must have an id');
  recipe.updatedAt = Date.now();
  if (Array.isArray(state?.recipes)) {
    const idx = state.recipes.findIndex(r => r && r.id === recipe.id);
    if (idx > -1) state.recipes[idx] = recipe;
    else state.recipes.push(recipe);
  }
  if (Array.isArray(window.state?.recipes)) {
    const idx = window.state.recipes.findIndex(r => r && r.id === recipe.id);
    if (idx > -1) window.state.recipes[idx] = recipe;
    else window.state.recipes.push(recipe);
  }
  if (typeof saveState === 'function') saveState();
  const householdId = window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  const db = platePlanDb || (window.firebase && firebase.firestore && firebase.firestore());
  if(db && platePlanCloudReady && platePlanCloudUser && navigator.onLine){
    if(Date.now() < platePlanBackoffUntil){
      console.warn('[FIRESTORE] Throttling direct recipe write during active backoff.');
      return;
    }
    const cleaned = sanitizePayloadForFirestore(unwrapAndCleanItem(recipe));
    await db.collection('households').doc(householdId).collection('recipes').doc(recipe.id).set(cleaned, { merge: true }).catch(err => {
      console.warn('saveRecipe cloud error:', err);
    });
  }
}
window.saveRecipe = saveRecipe;
async function deleteRecipeFromCloud(recipeId){
  if(!recipeId) return;
  const householdId = window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  const db = platePlanDb || (window.firebase && firebase.firestore && firebase.firestore());
  if (db) { await db.collection('households').doc(householdId).collection('recipes').doc(recipeId).delete().catch(err => console.warn('deleteRecipeFromCloud error:', err)); }
}
window.deleteRecipeFromCloud = deleteRecipeFromCloud;
async function updateIngredientMappingGlobal(ingredientId, mappingData){
  if(!ingredientId) return;
  const householdId = window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  const db = platePlanDb || (window.firebase && firebase.firestore && firebase.firestore());
  if(!db) return;
  const batch = db.batch();
  const householdDocRef = db.collection('households').doc(householdId);
  let targetIng = null;
  if(Array.isArray(state?.ingredients)){
    targetIng = state.ingredients.find(i => i && i.id === ingredientId);
  }
  if (!targetIng && state?.ingredients && typeof state.ingredients === 'object') { targetIng = state.ingredients[ingredientId]; }
  if(!targetIng){
    targetIng = { id: ingredientId };
    if(Array.isArray(state.ingredients)) state.ingredients.push(targetIng);
    if(state.ingredients && typeof state.ingredients === 'object') state.ingredients[ingredientId] = targetIng;
  }
  targetIng.productId = mappingData.productId || targetIng.productId || '';
  if(mappingData.productName) targetIng.productName = mappingData.productName;
  if(mappingData.tescoProductId || mappingData.tpnb) targetIng.tescoProductId = mappingData.tescoProductId || mappingData.tpnb;
  if(mappingData.packOptions) targetIng.packOptions = mappingData.packOptions;
  if(mappingData.sourceUrl || mappingData.url) targetIng.sourceUrl = mappingData.sourceUrl || mappingData.url;
  if(mappingData.groupId) targetIng.groupId = mappingData.groupId;
  targetIng.updatedAt = new Date().toISOString();
  const cleanIng = sanitizePayloadForFirestore(unwrapAndCleanItem(targetIng));
  batch.set(householdDocRef.collection('ingredients').doc(ingredientId), cleanIng, { merge: true });
  const recipesList = Array.isArray(state?.recipes) ? state.recipes : (state?.recipes && typeof state.recipes === 'object' ? Object.values(state.recipes) : []);
  recipesList.forEach(recipe => {
    if(!recipe) return;
    let modified = false;
    ['original', 'enhanced'].forEach(variantKey => {
      const variant = recipe.variants?.[variantKey] || (variantKey === 'original' ? recipe : null);
      if(variant && Array.isArray(variant.ingredients)){
        variant.ingredients.forEach(ing => {
          if(ing && (ing.bankId === ingredientId || ing.productId === ingredientId || ing.id === ingredientId)){
            ing.bankId = mappingData.productId || ing.bankId || '';
            if(mappingData.productId) ing.productId = mappingData.productId;
            if(mappingData.productName) ing.productName = mappingData.productName;
            if(mappingData.tescoProductId || mappingData.tpnb) ing.tescoProductId = mappingData.tescoProductId || mappingData.tpnb;
            if(mappingData.packOptions) ing.packOptions = mappingData.packOptions;
            if(mappingData.sourceUrl || mappingData.url) ing.sourceUrl = mappingData.sourceUrl || mappingData.url;
            if(mappingData.groupId) ing.groupId = mappingData.groupId;
            modified = true;
          }
        });
      }
    });
    if(modified && recipe.id){
      recipe.updatedAt = new Date().toISOString();
      const cleanRecipe = sanitizePayloadForFirestore(unwrapAndCleanItem(recipe));
      batch.set(householdDocRef.collection('recipes').doc(recipe.id), cleanRecipe, { merge: true });
    }
  });
  await batch.commit();
  rebuildPlatePlanIndexes();
  renderAll();
}
window.updateIngredientMappingGlobal = updateIngredientMappingGlobal;
function rehydrateActiveRecipeAndStateCache(options = {}){
  const { changedProductIds = [], recipeId = null } = options;
  if (typeof platePlanNutritionCache !== 'undefined' && platePlanNutritionCache.clear) { platePlanNutritionCache.clear(); }
  rebuildPlatePlanIndexes();
  if (recipeId) { recalcRecipeNutrition(recipeId); } else { recalcAllRecipes(); }
  refreshPlatePlanDerivedState({ changedProductIds, persist: false, render: false });
  if(document.getElementById('modal-wrap')?.classList.contains('open')){
    if(typeof recalcModal === 'function'){
      recalcModal('orig');
      recalcModal('enh');
    }
  }
  if(document.getElementById('view-vault')?.classList.contains('active')){
    renderVault();
  }
  if(document.getElementById('view-data')?.classList.contains('active')){
    renderDataQuality();
  }
  if(document.getElementById('view-bank')?.classList.contains('active')){
    renderBank();
  }
  if(document.getElementById('view-today')?.classList.contains('active') && typeof renderToday === 'function'){
    renderToday();
  }
}
window.saveIngredient = saveIngredient;
window.addIngredient = addIngredient;
window.deleteIngredient = deleteIngredient;
window.rehydrateActiveRecipeAndStateCache = rehydrateActiveRecipeAndStateCache;
let platePlanCloudDebounceTimer = null;
let platePlanDebounceResolvers = [];
async function pushStateToCloud(force=false) { return Promise.resolve(true); }
window.pushStateToCloud = pushStateToCloud;
const platePlanTransactionShield = {
  inFlight: false,
  lastCompletedAt: 0,
  cooldownMs: 4000
};
function createSafeStateSnapshot(sourceState) {
  if (!sourceState || typeof sourceState !== 'object') return {};
  const targetHouseholdId = window.activeHouseholdId || sourceState?.meta?.householdId || 'elliott-chloe';
  try {
    const clone = clonePlatePlanValue(sourceState) || {};
    if (!clone.meta) clone.meta = {};
    clone.meta.householdId = targetHouseholdId;
    return clone;
  } catch (err) {
    console.warn('createSafeStateSnapshot fallback clone:', err);
    return {
      schemaVersion: sourceState.schemaVersion || PLATEPLAN_SCHEMA_VERSION,
      updatedAt: sourceState.updatedAt || new Date().toISOString(),
      prefs: sourceState.prefs ? { ...sourceState.prefs } : {},
      customCats: sourceState.customCats ? { ...sourceState.customCats } : {},
      excluded: sourceState.excluded ? { ...sourceState.excluded } : {},
      useUpProducts: sourceState.useUpProducts ? { ...sourceState.useUpProducts } : {},
      ignoredGroupMergeSuggestions: Array.isArray(sourceState.ignoredGroupMergeSuggestions) ? [...sourceState.ignoredGroupMergeSuggestions] : [],
      ignoredDataQualityWarnings: Array.isArray(sourceState.ignoredDataQualityWarnings) ? [...sourceState.ignoredDataQualityWarnings] : [],
      dataQualityDismissals: sourceState.dataQualityDismissals ? { ...sourceState.dataQualityDismissals } : {},
      packPicks: sourceState.packPicks ? { ...sourceState.packPicks } : {},
      meta: {
        ...(sourceState.meta || {}),
        householdId: targetHouseholdId
      },
      recipes: Array.isArray(sourceState.recipes) ? sourceState.recipes.map(r => ({ ...r })) : [],
      ingredients: Array.isArray(sourceState.ingredients) ? sourceState.ingredients.map(i => ({ ...i })) : [],
      ingredientGroups: Array.isArray(sourceState.ingredientGroups) ? sourceState.ingredientGroups.map(g => ({ ...g })) : [],
      ingredientFamilies: Array.isArray(sourceState.ingredientFamilies) ? sourceState.ingredientFamilies.map(f => ({ ...f })) : [],
      plan: sourceState.plan ? { ...sourceState.plan } : {},
      overrides: sourceState.overrides ? { ...sourceState.overrides } : {},
      planHistory: Array.isArray(sourceState.planHistory) ? [...sourceState.planHistory] : []
    };
  }
}
/**
 * Unified atomic execution pipeline for Data Quality operations.
 * Single source of truth operating directly on root store (`state`).
 */
async function executeDataQualityTransaction(mutationType, payload = {}, options = {}) {
  const householdId = window.CURRENT_HOUSEHOLD_ID || window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  window.CURRENT_HOUSEHOLD_ID = householdId;
  window.activeHouseholdId = householdId;
  const { modalWrapId = null, submitButtonId = null, errorContainerId = null, successMessage = null } = options;
  const submitBtn = submitButtonId ? document.getElementById(submitButtonId) : null;
  const originalBtnText = submitBtn ? submitBtn.textContent : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }
  platePlanTransactionShield.inFlight = true;
  if (errorContainerId) {
    const errEl = document.getElementById(errorContainerId);
    if (errEl) errEl.innerHTML = '';
  }
  const rollbackState = createSafeStateSnapshot(state);
  const nowIso = new Date().toISOString();
  try {
    switch (mutationType) {
      case 'UPDATE_PRODUCT': {
        const { product, isNew, groupUpdate } = payload;
        if (!product || !product.id) throw new Error('Invalid product payload');
        product.updatedAt = nowIso;
        const targetGroup = (product.groupId ? (state.ingredientGroups || []).find(g => g.id === product.groupId) : null)
          || (groupUpdate && groupUpdate.id ? groupUpdate : null)
          || (product.subTypeId ? (state.ingredientGroups || []).find(g => g.id === product.subTypeId) : null);
        if (targetGroup) {
          product.groupId = targetGroup.id;
          product.subTypeId = targetGroup.id;
          if (targetGroup.name) product.subType = targetGroup.name;
          const familyId = targetGroup.ingredientId
            || (typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily(targetGroup)?.id : '')
            || payload.ingredientId
            || product.ingredientId
            || '';
          if (familyId) product.ingredientId = familyId;
        } else if (payload.ingredientId || product.ingredientId) {
          product.ingredientId = payload.ingredientId || product.ingredientId;
          if (payload.subTypeId || product.subTypeId) {
            product.subTypeId = payload.subTypeId || product.subTypeId;
            product.groupId = product.subTypeId;
          }
        }
        if (isNew) {
          const existingIdx = state.ingredients.findIndex(x => x.id === product.id);
          if (existingIdx > -1) state.ingredients[existingIdx] = product;
          else state.ingredients.push(product);
        } else {
          const idx = state.ingredients.findIndex(x => x.id === product.id);
          if (idx > -1) state.ingredients[idx] = product;
          else state.ingredients.push(product);
        }
        if (groupUpdate && groupUpdate.id) {
          const grp = (state.ingredientGroups || []).find(g => g.id === groupUpdate.id);
          if (grp) {
            Object.assign(grp, groupUpdate);
            grp.updatedAt = nowIso;
          } else { state.ingredientGroups.push(groupUpdate); }
        }
        if (product.groupId) {
          const grp = (state.ingredientGroups || []).find(g => g.id === product.groupId);
          if (grp) {
            if (!Array.isArray(grp.productIds)) grp.productIds = [];
            if (!grp.productIds.includes(product.id)) grp.productIds.push(product.id);
            if (!grp.defaultProductId) grp.defaultProductId = product.id;
            grp.updatedAt = nowIso;
          }
        }
        await saveIngredient(product);
        break;
      }
      case 'MERGE_PRODUCTS': {
        const { primaryId, oldIds, primaryGroup } = payload;
        if (!primaryId || !Array.isArray(oldIds) || oldIds.length === 0) throw new Error('Invalid merge payload');
        (state.recipes || []).forEach(r => {
          (r.ingredients || []).forEach(ing => {
            if (oldIds.includes(ing.bankId)) {
              ing.bankId = primaryId;
              ing.groupId = primaryGroup?.id || ing.groupId || '';
            }
          });
          if (r.enhanced && Array.isArray(r.enhanced.ingredients)) {
            r.enhanced.ingredients.forEach(ing => {
              if (oldIds.includes(ing.bankId)) {
                ing.bankId = primaryId;
                ing.groupId = primaryGroup?.id || ing.groupId || '';
              }
            });
          }
        });
        for (const instance in state.overrides) {
          if (state.overrides[instance]?.productOverrides) {
            const po = state.overrides[instance].productOverrides;
            for (const gId in po) if (oldIds.includes(po[gId])) po[gId] = primaryId;
          }
          if (state.overrides[instance]?.substitutions) {
            const subs = state.overrides[instance].substitutions;
            for (const oId in subs) {
              if (oldIds.includes(subs[oId])) subs[oId] = primaryId;
            }
          }
        }
        (state.ingredientGroups || []).forEach(g => {
          if (!Array.isArray(g.productIds)) g.productIds = [];
          if (g.productIds.some(id => oldIds.includes(id)) && !g.productIds.includes(primaryId)) {
            g.productIds.push(primaryId);
          }
          g.productIds = g.productIds.filter(id => !oldIds.includes(id));
          if (oldIds.includes(g.defaultProductId)) g.defaultProductId = primaryId;
          g.updatedAt = nowIso;
        });
        state.meta = state.meta || {};
        if (!Array.isArray(state.meta.deletedProductIds)) state.meta.deletedProductIds = [];
        oldIds.forEach(id => {
          if (!state.meta.deletedProductIds.includes(id)) state.meta.deletedProductIds.push(id);
        });
        state.ingredients = state.ingredients.filter(i => !oldIds.includes(i.id));
        const primaryProd = (state.ingredients || []).find(p => p.id === primaryId);
        if (primaryProd) primaryProd.updatedAt = nowIso;
        for (const oldId of oldIds) {
          await deleteIngredient(oldId);
        }
        if (primaryProd) { await saveIngredient(primaryProd); }
        break;
      }
      case 'REASSIGN_CATEGORY': {
        const { oldSlug, targetSlug } = payload;
        if (!oldSlug || !targetSlug) throw new Error('Invalid category reassign payload');
        state.ingredients.forEach(i => {
          if (i.cat === oldSlug) {
            i.cat = targetSlug;
            i.updatedAt = nowIso;
          }
        });
        (state.ingredientGroups || []).forEach(g => {
          if (g.cat === oldSlug) {
            g.cat = targetSlug;
            g.updatedAt = nowIso;
          }
        });
        (state.ingredientFamilies || []).forEach(f => {
          if (f.cat === oldSlug) {
            f.cat = targetSlug;
            f.updatedAt = nowIso;
          }
        });
        delete state.customCats[oldSlug];
        delete CAT[oldSlug];
        state.meta = state.meta || {};
        if (!Array.isArray(state.meta.deletedCategoryIds)) state.meta.deletedCategoryIds = [];
        if (!state.meta.deletedCategoryIds.includes(oldSlug)) state.meta.deletedCategoryIds.push(oldSlug);
        break;
      }
      case 'DELETE_CATEGORY': {
        const { slug } = payload;
        if (!slug) throw new Error('Invalid delete category payload');
        delete state.customCats[slug];
        delete CAT[slug];
        state.meta = state.meta || {};
        if (!Array.isArray(state.meta.deletedCategoryIds)) state.meta.deletedCategoryIds = [];
        if (!state.meta.deletedCategoryIds.includes(slug)) state.meta.deletedCategoryIds.push(slug);
        break;
      }
      case 'RENAME_CATEGORY': {
        const { slug, newName } = payload;
        if (!slug || !newName) throw new Error('Invalid rename category payload');
        state.customCats[slug] = newName.trim();
        CAT[slug] = newName.trim();
        break;
      }
      case 'SAVE_SUBTYPE_GROUP': {
        const { groupData, isNew, affectedProducts = [], affectedFamily = null } = payload;
        if (!groupData || !groupData.id) throw new Error('Invalid subtype group payload');
        groupData.updatedAt = nowIso;
        if (isNew) { state.ingredientGroups.push(groupData); } else {
          const idx = state.ingredientGroups.findIndex(g => g.id === groupData.id);
          if (idx > -1) state.ingredientGroups[idx] = groupData;
          else state.ingredientGroups.push(groupData);
        }
        if (affectedFamily) {
          affectedFamily.updatedAt = nowIso;
          const fIdx = (state.ingredientFamilies || []).findIndex(f => f.id === affectedFamily.id);
          if (fIdx > -1) state.ingredientFamilies[fIdx] = affectedFamily;
          else state.ingredientFamilies.push(affectedFamily);
        }
        (affectedProducts || []).forEach(prod => {
          prod.updatedAt = nowIso;
          const pIdx = state.ingredients.findIndex(p => p.id === prod.id);
          if (pIdx > -1) state.ingredients[pIdx] = prod;
        });
        for (const prod of (affectedProducts || [])) {
          await saveIngredient(prod);
        }
        break;
      }
      case 'SAVE_INGREDIENT_FAMILY': {
        const { familyData, isNew, newGroup = null, affectedGroups = [], affectedProducts = [] } = payload;
        if (!familyData || !familyData.id) throw new Error('Invalid ingredient family payload');
        familyData.updatedAt = nowIso;
        if (isNew) { state.ingredientFamilies.push(familyData); } else {
          const idx = state.ingredientFamilies.findIndex(f => f.id === familyData.id);
          if (idx > -1) state.ingredientFamilies[idx] = familyData;
          else state.ingredientFamilies.push(familyData);
        }
        if (newGroup) {
          newGroup.updatedAt = nowIso;
          state.ingredientGroups.push(newGroup);
        }
        (affectedGroups || []).forEach(g => {
          g.updatedAt = nowIso;
          const gIdx = state.ingredientGroups.findIndex(x => x.id === g.id);
          if (gIdx > -1) state.ingredientGroups[gIdx] = g;
        });
        (affectedProducts || []).forEach(p => {
          p.updatedAt = nowIso;
          const pIdx = state.ingredients.findIndex(x => x.id === p.id);
          if (pIdx > -1) state.ingredients[pIdx] = p;
        });
        for (const prod of (affectedProducts || [])) {
          await saveIngredient(prod);
        }
        break;
      }
      case 'DELETE_PRODUCT': {
        const { id } = payload;
        if (!id) throw new Error('Invalid delete product payload');
        (state.ingredientGroups || []).forEach(group => {
          if (Array.isArray(group.productIds)) group.productIds = group.productIds.filter(pid => pid !== id);
          if (group.defaultProductId === id) refreshAutoDefaultProductForGroup(group.id);
        });
        state.meta = state.meta || {};
        if (!Array.isArray(state.meta.deletedProductIds)) state.meta.deletedProductIds = [];
        if (!state.meta.deletedProductIds.includes(id)) state.meta.deletedProductIds.push(id);
        state.ingredients = state.ingredients.filter(i => i.id !== id);
        await deleteIngredient(id);
        break;
      }
      case 'REPLACE_AND_DELETE_PRODUCT': {
        const { targetId, replacements } = payload;
        if (!targetId) throw new Error('Invalid replace and delete payload');
        (replacements || []).forEach(r => {
          const rec = (state.recipes || []).find(rc => rc.id === r.recipeId);
          if (rec && rec[r.key] && rec[r.key][r.idx]) { rec[r.key][r.idx].bankId = r.replacementId; }
        });
        const firstReplacement = (replacements && replacements[0]) ? replacements[0].replacementId : null;
        (state.ingredientGroups || []).forEach(group => {
          if (Array.isArray(group.productIds)) group.productIds = group.productIds.filter(id => id !== targetId);
          if (group.defaultProductId === targetId) { group.defaultProductId = firstReplacement || group.productIds[0] || null; }
        });
        state.meta = state.meta || {};
        if (!Array.isArray(state.meta.deletedProductIds)) state.meta.deletedProductIds = [];
        if (!state.meta.deletedProductIds.includes(targetId)) state.meta.deletedProductIds.push(targetId);
        state.ingredients = state.ingredients.filter(i => i.id !== targetId);
        await deleteIngredient(targetId);
        if (firstReplacement) {
          const repProd = (state.ingredients || []).find(p => p.id === firstReplacement);
          if (repProd) {
            repProd.updatedAt = nowIso;
            await saveIngredient(repProd);
          }
        }
        break;
      }
      case 'DISMISS_WARNING': {
        const { key, fingerprint } = payload;
        if (!key) throw new Error('Invalid dismiss payload');
        if (!state.dataQualityDismissals || typeof state.dataQualityDismissals !== 'object') state.dataQualityDismissals = {};
        if (!Array.isArray(state.ignoredDataQualityWarnings)) state.ignoredDataQualityWarnings = [];
        if (!state.ignoredDataQualityWarnings.includes(key)) state.ignoredDataQualityWarnings.push(key);
        state.dataQualityDismissals[key] = fingerprint;
        break;
      }
      default:
        throw new Error(`Unknown mutationType: ${mutationType}`);
    }
    state.updatedAt = nowIso;
    rebuildPlatePlanIndexes();
    platePlanNutritionCache.clear();
    safeLocalStorageSet(SK, safeJsonStringify(state));
    try {
      await pushStateToCloud(true);
    } catch (cloudErr) {
      console.warn(`[executeDataQualityTransaction] Cloud push deferred or failed (${mutationType}), local mutation preserved:`, cloudErr);
      if (typeof schedulePlatePlanCloudDiff === 'function') { schedulePlatePlanCloudDiff(1000); }
    }
    platePlanTransactionShield.lastCompletedAt = Date.now();
    if (modalWrapId) {
      const modal = document.getElementById(modalWrapId);
      if (modal) {
        modal.classList.remove('open');
        if (modal.dataset.modalWrapped === '1' || modal.id === 'manual-ing-panel') { modal.style.display = 'none'; }
      }
    }
    if (successMessage) { showPlatePlanToast(successMessage); }
    try {
      if (typeof runDataQualityAudits === 'function') { runDataQualityAudits(true); }
    } catch(auditErr) {
      console.warn('Reactive audit error in executeDataQualityTransaction:', auditErr);
    }
    return true;
  } catch (error) {
    console.error(`[DataQuality Transaction Failed] ${mutationType}:`, error);
    state = rollbackState;
    if (state) {
      if (!state.meta) state.meta = {};
      const hid = window.activeHouseholdId || rollbackState?.meta?.householdId || 'elliott-chloe';
      state.meta.householdId = hid;
      window.activeHouseholdId = hid;
      window.activeHousehold = { id: hid };
    }
    safeLocalStorageSet(SK, safeJsonStringify(state));
    rebuildPlatePlanIndexes();
    platePlanNutritionCache.clear();
    const errHtml = '<div class="msg error" style="margin:10px 0;font-weight:600">Database Write Failed: Changes were not saved.</div>';
    if (errorContainerId) {
      const errEl = document.getElementById(errorContainerId);
      if (errEl) { errEl.innerHTML = errHtml; }
    }
    showPlatePlanToast('Database Write Failed: Changes were not saved.');
    throw error;
  } finally {
    platePlanTransactionShield.inFlight = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  }
}
function queuePlatePlanCloudDiff(immediateFlush=false){
  if(platePlanSyncSuppress || isHydrating || window.isHydrating) return;
  if(immediateFlush){
    clearTimeout(platePlanSyncTimer);
    pushStateToCloud();
  }else { schedulePlatePlanCloudDiff(1000); }
}
function schedulePlatePlanCloudDiff(delay=1000){
  if(platePlanSyncSuppress || isHydrating || window.isHydrating) return;
  clearTimeout(platePlanSyncTimer);
  const effectiveDelay = Math.max(delay, platePlanBackoffUntil > Date.now() ? (platePlanBackoffUntil - Date.now() + 200) : 0);
  platePlanSyncTimer=setTimeout(()=>{
    pushStateToCloud();
  },effectiveDelay);
}
function flushPlatePlanSyncOutbox(){
  if(isHydrating || window.isHydrating) return;
  pushStateToCloud();
}
function saveState(immediate=false){
  window.dispatchEvent(new CustomEvent('plateplan:state-saved',{detail:{source:'cloud',savedAt:Date.now()}}));
  if(state) {
    state.updatedAt=new Date().toISOString();
    state.version = '3.0.6';
    if (state.plan && typeof state.plan === 'object') { state.plan.version = '3.0.6'; }
  }
  window.state = state;
  window.appState = state;
  try{
    safeLocalStorageSet(SK, safeJsonStringify(state));
    if(state && state.plan && typeof state.plan === 'object' && Object.keys(state.plan).length > 0){
      safeLocalStorageSet('plateplan_plan_backup', sanitizePlanForFirestore(state.plan));
    }
    if(state && Array.isArray(state.planHistory) && state.planHistory.length > 0){
      safeSaveHistoryBackup(state.planHistory);
    }
  }catch(e){
    console.warn('Local storage write warning:',e);
  }
  try {
    if (typeof runDataQualityAudits === 'function') { runDataQualityAudits(document.getElementById('view-data')?.classList.contains('active')); }
  } catch(auditErr) {
    console.warn('Reactive audit error in saveState:', auditErr);
  }
  if (isHydrating || window.isHydrating) {
    console.log('[v3.0.6 STATE PERSISTENCE] saveState called during hydration; cloud diff skipped.');
    return true;
  }
  const isInsidePlannerDraft = (document.getElementById('view-planner')?.classList.contains('active') || (typeof currentTab !== 'undefined' && currentTab === 'planner')) && (typeof getPlannerWizardStep === 'function' ? getPlannerWizardStep() < 4 : false);
  if (isInsidePlannerDraft && !immediate) { return true; }
  if (state?.plan && typeof state.plan === 'object' && Object.keys(state.plan).length > 0) {
    queuePlanSave(state.plan, immediate);
  }
  if(!platePlanSyncSuppress && platePlanCloudReady && platePlanCloudUser){
    if(immediate){
      clearTimeout(platePlanSyncTimer);
      pushStateToCloud(true);
    }else { schedulePlatePlanCloudDiff(1000); }
  }else if (!platePlanCloudUser) { updatePlatePlanSyncStatus('local'); }
  return true;
}
if(typeof window!=='undefined'){
  window.addEventListener('beforeunload',()=>{
    try{
      safeLocalStorageSet(SK, safeJsonStringify(state));
      if(state?.plan && typeof state.plan === 'object' && Object.keys(state.plan).length > 0) {
        safeLocalStorageSet('plateplan_plan_backup', sanitizePlanForFirestore(state.plan));
      }
      if(Array.isArray(state?.planHistory) && state.planHistory.length > 0) {
        safeLocalStorageSet('plateplan_history_backup', safeJsonStringify(state.planHistory));
      }
    }catch(_e){}
  });
}
function updatePlatePlanSyncStatus(status,detail=''){
  if (typeof window !== 'undefined' && typeof window.setSyncStatus === 'function') {
    const el = document.getElementById('sync-status');
    if (el && el.dataset.status === status) return;
  }
  const el=document.getElementById('sync-status');
  if(!el) return;
  let label='• Synced';
  if (status==='synced') { label='• Synced'; }else if (status==='saving') { label='Saving…'; }else if (status==='offline') { label='Offline'; }else if (status==='connecting') { label='Connecting…'; }else if (status==='local') { label='Local only'; }else if (status==='error') { label='Sync error'; }
  el.dataset.status=status;
  el.textContent=label;
  el.title=detail||label||'';
  if (typeof window !== 'undefined' && typeof window.setSyncStatus === 'function') {
    try { window.setSyncStatus(status, detail); } catch(e) {}
  }
}
window.updatePlatePlanSyncStatus = updatePlatePlanSyncStatus;
function setPlatePlanSyncPathValue(target,path,value){
  if(!path.length) return cleanCloudValue(value);
  let cursor=target;
  path.slice(0,-1).forEach(part=>{ if(!cursor[part]||typeof cursor[part]!=='object') cursor[part]={}; cursor=cursor[part]; });
  const leaf=path[path.length-1];
  if(value===undefined) delete cursor[leaf]; else cursor[leaf]=cleanCloudValue(value);
  return target;
}
function reconcilePlatePlanState(local, remote, options = {}) {
  let hasLocalNewer = false;
  if (!remote || typeof remote !== 'object') return { state: local, hasLocalNewer: false };
  if (!local || typeof local !== 'object') return { state: remote, hasLocalNewer: false };
  const isBoot = !!options.isBoot;
  const localRootTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
  const remoteRootTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
  const preferRemote = isBoot ? (remoteRootTime >= localRootTime || !localRootTime) : (remoteRootTime >= localRootTime);
  const getMs = (item, parentState) => {
    const raw = item?.updatedAt || parentState?.updatedAt;
    if (!raw) return 0;
    if (typeof raw === 'string') return new Date(raw).getTime() || 0;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'object' && typeof raw.seconds === 'number') return raw.seconds * 1000;
    return 0;
  };
  const getProductCompleteness = p => {
    if(!p || typeof p !== 'object') return 0;
    let score = 0;
    if(+(p.price) > 0) score += 2;
    if(+(p.packSize) > 0 && p.packUnit) score += 2;
    if(p.storage) score += 1;
    if(p.groupId) score += 2;
    if(+(p.itemWeight) > 0) score += 1;
    if((+(p.cal) > 0 || +(p.prot) > 0)) score += 2;
    if(p.notes) score += 0.5;
    if(p.brand) score += 0.5;
    return score;
  };
  const localRecipes = Array.isArray(local.recipes) ? local.recipes : [];
  const remoteRecipes = Array.isArray(remote.recipes) ? remote.recipes : [];
  const mergedRecipesMap = new Map();
  remoteRecipes.forEach(r => {
    if (r && r.id) mergedRecipesMap.set(r.id, r);
  });
  localRecipes.forEach(lr => {
    if (!lr || !lr.id) return;
    const rr = mergedRecipesMap.get(lr.id);
    if (!rr) {
      mergedRecipesMap.set(lr.id, lr);
      hasLocalNewer = true;
    } else {
      const localTime = getMs(lr, local);
      const remoteTime = getMs(rr, remote);
      if (localTime > remoteTime) {
        mergedRecipesMap.set(lr.id, lr);
        hasLocalNewer = true;
      } else if (localTime < remoteTime) {
        if (lr.enhanced && !rr.enhanced) {
          mergedRecipesMap.set(lr.id, { ...rr, enhanced: lr.enhanced });
          hasLocalNewer = true;
        } else { mergedRecipesMap.set(lr.id, rr); }
      } else {
        if (preferRemote) {
          mergedRecipesMap.set(lr.id, { ...lr, ...rr, enhanced: rr.enhanced || lr.enhanced });
        } else {
          const localIngCount = (lr.ingredients || []).length;
          const remoteIngCount = (rr.ingredients || []).length;
          const localStepsCount = (lr.steps || []).length;
          const remoteStepsCount = (rr.steps || []).length;
          if (localIngCount > remoteIngCount || localStepsCount > remoteStepsCount || (lr.enhanced && !rr.enhanced)) {
            mergedRecipesMap.set(lr.id, { ...rr, ...lr, enhanced: lr.enhanced || rr.enhanced });
            hasLocalNewer = true;
          } else if (safeJsonStringify(lr) !== safeJsonStringify(rr)) {
            mergedRecipesMap.set(lr.id, { ...rr, ...lr });
          }
        }
      }
    }
  });
  const mergedRecipes = Array.from(mergedRecipesMap.values());
  const mergeProductPreservingValidData = (lp, rp, preferRemote = false) => {
    const primary = preferRemote ? rp : lp;
    const fallback = preferRemote ? lp : rp;
    const merged = { ...fallback, ...primary };
    if (!(+(primary.price) > 0) && +(fallback.price) > 0) merged.price = fallback.price;
    if (!(+(primary.packSize) > 0) && +(fallback.packSize) > 0) {
      merged.packSize = fallback.packSize;
      merged.packUnit = fallback.packUnit || merged.packUnit;
    }
    if (!primary.storage && fallback.storage) merged.storage = fallback.storage;
    if (!primary.groupId && fallback.groupId) merged.groupId = fallback.groupId;
    if (!(+(primary.cal) > 0 || +(primary.prot) > 0) && (+(fallback.cal) > 0 || +(fallback.prot) > 0)) {
      merged.cal = fallback.cal;
      merged.fat = fallback.fat;
      merged.carb = fallback.carb;
      merged.fibre = fallback.fibre;
      merged.prot = fallback.prot;
    }
    if (!(+(primary.itemWeight) > 0) && +(fallback.itemWeight) > 0) {
      merged.itemWeight = fallback.itemWeight;
      merged.itemWeightUnit = fallback.itemWeightUnit || merged.itemWeightUnit;
    }
    if (!primary.cat && fallback.cat) { merged.cat = fallback.cat; }
    return merged;
  };
  const localDeletedProducts = new Set(Array.isArray(local.meta?.deletedProductIds) ? local.meta.deletedProductIds : []);
  const remoteDeletedProducts = new Set(Array.isArray(remote.meta?.deletedProductIds) ? remote.meta.deletedProductIds : []);
  const allDeletedProducts = new Set([...localDeletedProducts, ...remoteDeletedProducts]);
  const localDeletedCats = new Set(Array.isArray(local.meta?.deletedCategoryIds) ? local.meta.deletedCategoryIds : []);
  const remoteDeletedCats = new Set(Array.isArray(remote.meta?.deletedCategoryIds) ? remote.meta.deletedCategoryIds : []);
  const allDeletedCats = new Set([...localDeletedCats, ...remoteDeletedCats]);
  const mergedIngs = (Array.isArray(state?.ingredients) && state.ingredients.length > 0)
    ? state.ingredients
    : (Array.isArray(local.ingredients) ? local.ingredients : (Array.isArray(remote.ingredients) ? remote.ingredients : []));
  const mergeGroupsPreservingLinks = (lg, rg, preferRemote = false) => {
    const primary = preferRemote ? rg : lg;
    const fallback = preferRemote ? lg : rg;
    return {
      ...fallback,
      ...primary,
      ingredientId: primary.ingredientId || fallback.ingredientId || '',
      family: primary.family || fallback.family || '',
      cat: (primary.cat && primary.cat !== 'other') ? primary.cat : (fallback.cat || primary.cat || 'other'),
      defaultProductId: primary.defaultProductId || fallback.defaultProductId || '',
      productIds: Array.from(new Set([...(rg.productIds || []), ...(lg.productIds || [])])),
      aliases: Array.from(new Set([...(rg.aliases || []), ...(lg.aliases || [])]))
    };
  };
  const localGroups = Array.isArray(local.ingredientGroups) ? local.ingredientGroups : [];
  const remoteGroups = Array.isArray(remote.ingredientGroups) ? remote.ingredientGroups : [];
  const mergedGroupsMap = new Map();
  remoteGroups.forEach(g => { if (g && g.id) mergedGroupsMap.set(g.id, g); });
  localGroups.forEach(lg => {
    if (!lg || !lg.id) return;
    if (!mergedGroupsMap.has(lg.id)) {
      mergedGroupsMap.set(lg.id, lg);
      hasLocalNewer = true;
    } else {
      const rg = mergedGroupsMap.get(lg.id);
      const localTime = getMs(lg, local);
      const remoteTime = getMs(rg, remote);
      if (localTime > remoteTime) {
        mergedGroupsMap.set(lg.id, mergeGroupsPreservingLinks(lg, rg, false));
        hasLocalNewer = true;
      } else if (remoteTime > localTime) {
        mergedGroupsMap.set(lg.id, mergeGroupsPreservingLinks(lg, rg, true));
        if (!preferRemote && lg.ingredientId && !rg.ingredientId) hasLocalNewer = true;
      } else {
        const mergedGroup = mergeGroupsPreservingLinks(lg, rg, preferRemote);
        mergedGroupsMap.set(lg.id, mergedGroup);
        if (!preferRemote && ((lg.ingredientId && !rg.ingredientId) || (lg.productIds || []).length > (rg.productIds || []).length || (lg.aliases || []).length > (rg.aliases || []).length)) {
          hasLocalNewer = true;
        }
      }
    }
  });
  const mergeFamiliesPreservingTypes = (lf, rf, preferRemote = false) => {
    const primary = preferRemote ? rf : lf;
    const fallback = preferRemote ? lf : rf;
    return {
      ...fallback,
      ...primary,
      cat: (primary.cat && primary.cat !== 'other') ? primary.cat : (fallback.cat || primary.cat || 'other'),
      defaultTypeId: primary.defaultTypeId || fallback.defaultTypeId || '',
      typeIds: Array.from(new Set([...(rf.typeIds || []), ...(lf.typeIds || [])])),
      aliases: Array.from(new Set([...(rf.aliases || []), ...(lf.aliases || [])]))
    };
  };
  const localFamilies = Array.isArray(local.ingredientFamilies) ? local.ingredientFamilies : [];
  const remoteFamilies = Array.isArray(remote.ingredientFamilies) ? remote.ingredientFamilies : [];
  const mergedFamiliesMap = new Map();
  remoteFamilies.forEach(f => { if (f && f.id) mergedFamiliesMap.set(f.id, f); });
  localFamilies.forEach(lf => {
    if (!lf || !lf.id) return;
    if (!mergedFamiliesMap.has(lf.id)) {
      mergedFamiliesMap.set(lf.id, lf);
      hasLocalNewer = true;
    } else {
      const rf = mergedFamiliesMap.get(lf.id);
      const localTime = getMs(lf, local);
      const remoteTime = getMs(rf, remote);
      if (localTime > remoteTime) {
        mergedFamiliesMap.set(lf.id, mergeFamiliesPreservingTypes(lf, rf, false));
        hasLocalNewer = true;
      } else if (remoteTime > localTime) {
        mergedFamiliesMap.set(lf.id, mergeFamiliesPreservingTypes(lf, rf, true));
        if (!preferRemote && (lf.typeIds || []).length > (rf.typeIds || []).length) hasLocalNewer = true;
      } else {
        const mergedFamily = mergeFamiliesPreservingTypes(lf, rf, preferRemote);
        mergedFamiliesMap.set(lf.id, mergedFamily);
        if (!preferRemote && ((lf.typeIds || []).length > (rf.typeIds || []).length || (lf.aliases || []).length > (rf.aliases || []).length)) {
          hasLocalNewer = true;
        }
      }
    }
  });
  const mergedOverrides = preferRemote
    ? { ...(local.overrides || {}), ...(remote.overrides || {}) }
    : { ...(remote.overrides || {}), ...(local.overrides || {}) };
  let mergedPlan = remote.plan || {};
  if (local.plan?.updatedAt && remote.plan?.updatedAt) {
    if (new Date(local.plan.updatedAt).getTime() > new Date(remote.plan.updatedAt).getTime()) {
      mergedPlan = local.plan;
      hasLocalNewer = true;
    }
  } else if (!preferRemote && local.plan && Object.keys(local.plan?.slots || {}).length > 0 && !Object.keys(remote.plan?.slots || {}).length) {
    mergedPlan = local.plan;
    hasLocalNewer = true;
  }
  const mergedHistory = [...(remote.planHistory || [])];
  (local.planHistory || []).forEach(lp => {
    if (lp && lp.id && !mergedHistory.some(rp => rp.id === lp.id)) {
      mergedHistory.push(lp);
      if (!preferRemote) hasLocalNewer = true;
    }
  });
  const mergedCustomCats = preferRemote
    ? { ...(local.customCats || {}), ...(remote.customCats || {}) }
    : { ...(remote.customCats || {}), ...(local.customCats || {}) };
  allDeletedCats.forEach(slug => {
    delete mergedCustomCats[slug];
  });
  const mergedDismissals = preferRemote
    ? { ...(local.dataQualityDismissals || {}), ...(remote.dataQualityDismissals || {}) }
    : { ...(remote.dataQualityDismissals || {}), ...(local.dataQualityDismissals || {}) };
  const mergedUseUp = preferRemote
    ? { ...(local.useUpProducts || local.pantry || {}), ...(remote.useUpProducts || remote.pantry || {}) }
    : { ...(remote.useUpProducts || remote.pantry || {}), ...(local.useUpProducts || local.pantry || {}) };
  const mergedPackPicks = preferRemote
    ? { ...(local.packPicks || {}), ...(remote.packPicks || {}) }
    : { ...(remote.packPicks || {}), ...(local.packPicks || {}) };
  const mergedState = {
    schemaVersion: remote.schemaVersion || local.schemaVersion || PLATEPLAN_SCHEMA_VERSION,
    updatedAt: preferRemote ? (remote.updatedAt || local.updatedAt || new Date().toISOString()) : (local.updatedAt || remote.updatedAt || new Date().toISOString()),
    prefs: preferRemote ? { ...(local.prefs || {}), ...(remote.prefs || {}) } : { ...(remote.prefs || {}), ...(local.prefs || {}) },
    customCats: mergedCustomCats,
    excluded: preferRemote ? { ...(local.excluded || {}), ...(remote.excluded || {}) } : { ...(remote.excluded || {}), ...(local.excluded || {}) },
    useUpProducts: mergedUseUp,
    ignoredGroupMergeSuggestions: Array.from(new Set([...(remote.ignoredGroupMergeSuggestions || []), ...(local.ignoredGroupMergeSuggestions || [])])),
    ignoredDataQualityWarnings: Array.from(new Set([...(remote.ignoredDataQualityWarnings || []), ...(local.ignoredDataQualityWarnings || [])])),
    dataQualityDismissals: mergedDismissals,
    packPicks: mergedPackPicks,
    meta: {
      ...(remote.meta || {}),
      ...(local.meta || {}),
      householdId: window.activeHouseholdId || remote.meta?.householdId || local.meta?.householdId || 'elliott-chloe',
      deletedProductIds: Array.from(allDeletedProducts),
      deletedCategoryIds: Array.from(allDeletedCats)
    },
    recipes: mergedRecipes,
    ingredients: mergedIngs,
    ingredientGroups: Array.from(mergedGroupsMap.values()),
    ingredientFamilies: Array.from(mergedFamiliesMap.values()),
    plan: mergedPlan,
    overrides: mergedOverrides,
    planHistory: mergedHistory
  };
  return { state: mergedState, hasLocalNewer };
}
function applyRemoteCloudState(remoteState, metadata = {}, options = {}){
  if(!remoteState || typeof remoteState!=='object') return;
  const isInputFocused=document.activeElement && ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);
  const isPreferencesActive=document.getElementById('view-prefs')?.classList.contains('active');
  platePlanSyncSuppress=true;
  try{
    let reconciled;
    let hasLocalNewer = false;
    reconciled = remoteState;
    const loaded=loadStateFromObject(reconciled);
    state=loaded;
    window.state = state;
    window.appState = state;
    if (Array.isArray(state?.ingredients)) {
      state.ingredients.forEach(ing => {
        if (!ing.updatedAt) ing.updatedAt = state.updatedAt || new Date().toISOString();
      });
    }
    safeLocalStorageSet(SK, safeJsonStringify(state));
    platePlanNutritionCache.clear();
    rebuildPlatePlanIndexes();
    if(!isInputFocused || !isPreferencesActive){
      refreshPlatePlanDerivedState({persist:false,render:true,full:true});
    }else { renderPlatePlanDependentViews(); }
    platePlanLastSyncedAt=Date.now();
    const who=metadata.updatedBy&&metadata.updatedBy!==platePlanCloudUser?.email?`Updated by ${metadata.updatedBy}`:'Synced';
    updatePlatePlanSyncStatus('synced',who);
    if (hasLocalNewer && platePlanCloudReady && platePlanCloudUser && !options.isBoot) { schedulePlatePlanCloudDiff(3000); }
  }catch(error){
    console.warn('Failed to apply remote cloud state:',error);
  }finally{
    platePlanSyncSuppress=false;
  }
}
function applyPlatePlanProjectionRecord(key,value,{remote=true}={}){
  const [collection,...idParts]=String(key).split('/');
  const id=idParts.join('/');
  const arrayNames={recipes:'recipes',products:'ingredients',ingredientFamilies:'ingredientFamilies',ingredientGroups:'ingredientGroups'};
  if(arrayNames[collection]){
    const name=arrayNames[collection];
    const list=Array.isArray(state[name])?state[name]:[];
    const index=list.findIndex(item=>String(item?.id)===id);
    const cleaned = cleanCloudValue(value);
    if (value===null) { if(index>=0) list.splice(index,1); } else if(index>=0){
      const localItem = list[index];
      const localTime = localItem?.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
      const remoteTime = cleaned?.updatedAt ? new Date(cleaned.updatedAt).getTime() : 0;
      if (remoteTime >= localTime || !localTime) { list[index] = cleaned; } else {
        if (platePlanCloudReady && platePlanCloudUser) { schedulePlatePlanCloudDiff(3000); }
      }
    } else { list.push(cleaned); }
    state[name]=list;
  }else if(collection==='overrides'){
    if(!state.overrides) state.overrides={};
    if(value===null) delete state.overrides[id]; else state.overrides[id]=cleanCloudValue(value);
  }else if(key==='plans/current') state.plan=cleanCloudValue(value||{});
  else if(key==='plans/history') state.planHistory=cleanCloudValue(value||[]);
  else if(key==='settings/shared'&&value){
    ['prefs','customCats','excluded','useUpProducts','ignoredGroupMergeSuggestions','ignoredDataQualityWarnings','dataQualityDismissals','packPicks','meta'].forEach(name=>{
      if(value[name]!==undefined) state[name]=cleanCloudValue(value[name]);
    });
    CAT={...STANDARD_CATS,...(state.customCats||{})};
  }
  if(remote){
    platePlanSyncSuppress=true;
    try{
      safeLocalStorageSet(SK,safeJsonStringify(state));
      rebuildPlatePlanIndexes();
      renderPlatePlanDependentViews();
    }finally{ platePlanSyncSuppress=false; }
  }
}
function applyPlatePlanProjection(projection){
  platePlanSyncSuppress=true;
  try{
    if(!state) state = loadState();
    if(!Array.isArray(state.recipes)) state.recipes = [];
    if(!Array.isArray(state.ingredients)) state.ingredients = [];
    if(!Array.isArray(state.ingredientFamilies)) state.ingredientFamilies = [];
    if(!Array.isArray(state.ingredientGroups)) state.ingredientGroups = [];
    if(!state.overrides) state.overrides = {};
    if(!state.plan) state.plan = {};
    if(!Array.isArray(state.planHistory)) state.planHistory = [];
    Object.entries(projection).forEach(([key,value])=>applyPlatePlanProjectionRecord(key,value,{remote:false}));
    state=loadStateFromObject(state);
    safeLocalStorageSet(SK,safeJsonStringify(state));
  }finally{ platePlanSyncSuppress=false; }
}
function loadStateFromObject(value){
  if (!value || typeof value !== 'object') return value;
  try{
    return normalizeLoadedState(cleanCloudValue(value) || value, { injectSeed: false, restoreRecipeBackup: false });
  }catch(_e){
    return normalizeLoadedState(value, { injectSeed: false, restoreRecipeBackup: false });
  }
}
async function readPlatePlanCloudProjection(){
  const projection={};
  const collections=['recipes','products','ingredientFamilies','ingredientGroups','overrides'];
  for(const name of collections){
    const snapshot=await platePlanDb.collection('households').doc(getPlatePlanHouseholdId()).collection(name).get();
    snapshot.forEach(doc=>{ const data=doc.data()||{}; const key=name+'/'+decodeURIComponent(doc.id); projection[key]=cleanCloudValue(data.value); platePlanCloudRevisions[key]=+data.revision||0; });
  }
  for(const key of ['plans/current','plans/history','settings/shared']){
    const snapshot=await platePlanCloudRef(key).get();
    if(snapshot.exists){ const data=snapshot.data()||{}; projection[key]=cleanCloudValue(data.value); platePlanCloudRevisions[key]=+data.revision||0; }
  }
  return projection;
}
function populateIngredientsState(docs){
  if(!state) state = {};
  const ings = [];
  (docs || []).forEach(doc => {
    const raw = doc.data ? doc.data() : doc;
    const clean = unwrapAndCleanItem(raw) || {};
    if(!clean.id) clean.id = doc.id;
    ings.push(clean);
    ings[clean.id] = clean;
  });
  state.ingredients = ings;
  window.state = state;
  window.appState = state;
}
window.populateIngredientsState = populateIngredientsState;
function populateRecipesState(docs, options = {}){
  if(!state) state = {};
  const recs = (options.merge && Array.isArray(state.recipes)) ? [...state.recipes] : [];
  const existingMap = new Map();
  recs.forEach(r => {
    if(r && r.id) existingMap.set(String(r.id), r);
  });
  let list = [];
  if (Array.isArray(docs)) {
    list = docs;
  } else if (docs && typeof docs === 'object') { list = parseRecipeDocumentToCleanArray(docs); }
  list.forEach(doc => {
    if(!doc) return;
    const raw = (typeof doc.data === 'function') ? doc.data() : (doc.data && typeof doc.data === 'object' && !doc.name ? doc.data : doc);
    if(!raw || typeof raw !== 'object') return;
    const clean = unwrapAndCleanItem(raw) || {};
    if(!clean.id) {
      if(doc.id) clean.id = doc.id;
      else if(raw.id) clean.id = raw.id;
      else if(clean.name) clean.id = 'recipe_' + String(clean.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      else clean.id = 'recipe_' + Math.random().toString(36).substr(2, 9);
    }
    clean.id = String(clean.id);
    clean.isFavorite = (clean.isFavorite !== undefined) ? !!clean.isFavorite : false;
    clean.isFavourite = clean.isFavorite;
    if(existingMap.has(clean.id)){
      const existing = existingMap.get(clean.id);
      const localTime = new Date(existing.updatedAt || 0).getTime() || Number(existing.updatedAt || 0);
      const cloudTime = new Date(clean.updatedAt || 0).getTime() || Number(clean.updatedAt || 0);
      if (!localTime || cloudTime >= localTime) { Object.assign(existing, clean); }
    } else {
      recs.push(clean);
      existingMap.set(clean.id, clean);
    }
  });
  recs.forEach(r => {
    if(r && r.id) recs[r.id] = r;
  });
  state.recipes = recs;
  window.state = state;
  window.appState = state;
}
window.populateRecipesState = populateRecipesState;
async function performSubcollectionMigrationIfNeeded(db, householdId, rootDocData){
  if(!db || !householdId || !rootDocData) return;
  try {
    const rawIngredients = rootDocData.ingredients;
    const rawRecipes = rootDocData.recipes;
    const hasIngredients = (Array.isArray(rawIngredients) && rawIngredients.length > 0) || (rawIngredients && typeof rawIngredients === 'object' && Object.keys(rawIngredients).length > 0);
    const hasRecipes = (Array.isArray(rawRecipes) && rawRecipes.length > 0) || (rawRecipes && typeof rawRecipes === 'object' && Object.keys(rawRecipes).length > 0);
    if(!hasIngredients && !hasRecipes) return;
    console.log('[ONE-TIME SUBCOLLECTION MIGRATION] Starting migration of root document ingredients & recipes to subcollections...');
    const householdDocRef = db.collection('households').doc(householdId);
    if(hasIngredients){
      try {
        const ingList = Array.isArray(rawIngredients) ? rawIngredients : Object.values(rawIngredients);
        for(let i = 0; i < ingList.length; i += 400){
          const batch = db.batch();
          const chunk = ingList.slice(i, i + 400);
          chunk.forEach(item => {
            if(!item) return;
            const clean = sanitizePayloadForFirestore(unwrapAndCleanItem(item));
            const rawId = clean.id || clean.productId || clean.bankId;
            if(rawId){
              const docId = String(rawId).replace(/[\/\s]/g, '_').trim();
              if(docId){
                clean.id = docId;
                batch.set(householdDocRef.collection('ingredients').doc(docId), clean, { merge: true });
              }
            }
          });
          await batch.commit();
        }
        console.log(`[MIGRATION] Migrated ${ingList.length} ingredients to subcollection.`);
      } catch(ingErr) {
        console.warn('[MIGRATION] Error migrating ingredients batch:', ingErr);
      }
    }
    if(hasRecipes){
      try {
        const recList = Array.isArray(rawRecipes) ? rawRecipes : Object.values(rawRecipes);
        for(let i = 0; i < recList.length; i += 400){
          const batch = db.batch();
          const chunk = recList.slice(i, i + 400);
          chunk.forEach(item => {
            if(!item) return;
            const clean = sanitizePayloadForFirestore(unwrapAndCleanItem(item));
            const rawId = clean.id;
            if(rawId){
              const docId = String(rawId).replace(/[\/\s]/g, '_').trim();
              if(docId){
                clean.id = docId;
                batch.set(householdDocRef.collection('recipes').doc(docId), clean, { merge: true });
              }
            }
          });
          await batch.commit();
        }
        console.log(`[MIGRATION] Migrated ${recList.length} recipes to subcollection.`);
      } catch(recErr) {
        console.warn('[MIGRATION] Error migrating recipes batch:', recErr);
      }
    }
    try {
      const updateObj = {};
      if(window.firebase && firebase.firestore && firebase.firestore.FieldValue){
        if(hasIngredients) updateObj.ingredients = firebase.firestore.FieldValue.delete();
        if(hasRecipes) updateObj.recipes = firebase.firestore.FieldValue.delete();
      }
      if(Object.keys(updateObj).length > 0){
        await householdDocRef.update(updateObj);
        console.log('[MIGRATION] Deleted root document monolithic ingredients & recipes arrays.');
      }
    } catch(delErr) {
      console.warn('[MIGRATION] Could not delete root document legacy fields:', delErr);
    }
  } catch(globalMigErr) {
    console.warn('[MIGRATION] Top-level migration caught error:', globalMigErr);
  }
}
window.performSubcollectionMigrationIfNeeded = performSubcollectionMigrationIfNeeded;
function startPlatePlanCloudListeners(){
  console.log('[PlatePlan v3.1.0] Legacy Firestore onSnapshot listeners bypassed. Core engine in charge.');
  platePlanSyncUnsubscribers.forEach(stop=>{try{stop();}catch(e){}});
  platePlanSyncUnsubscribers=[];
  return;
  const targetHouseholdId = window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  const householdDocRef = getHouseholdDocRef(platePlanDb, targetHouseholdId);
  const unsubIngredients = householdDocRef.collection('ingredients').onSnapshot(snapshot => {
    if(!snapshot) return;
    if(platePlanTransactionShield.inFlight || (Date.now() - platePlanTransactionShield.lastCompletedAt < platePlanTransactionShield.cooldownMs)) return;
    if(snapshot.metadata && snapshot.metadata.hasPendingWrites) return;
    populateIngredientsState(snapshot.docs);
    window.state = state;
    window.appState = state;
    safeLocalStorageSet('plateplan_offline_backup', safeJsonStringify(state.ingredients));
    rebuildPlatePlanIndexes();
    renderAll();
    runDataQualityAudits();
    platePlanLastSyncedAt = Date.now();
    updatePlatePlanSyncStatus('synced');
  }, error => {
    console.error('[INGREDIENTS SUBCOLLECTION LISTENER ERROR]', error);
    if(!navigator.onLine) updatePlatePlanSyncStatus('offline');
  });
  platePlanSyncUnsubscribers.push(unsubIngredients);
  const unsubRecipes = householdDocRef.collection('recipes').onSnapshot(snapshot => {
    if(!snapshot) return;
    if(platePlanTransactionShield.inFlight || (Date.now() - platePlanTransactionShield.lastCompletedAt < platePlanTransactionShield.cooldownMs)) return;
    if(snapshot.metadata && snapshot.metadata.hasPendingWrites) return;
    if (!state.recipes) state.recipes = [];
    const recipeMap = new Map();
    state.recipes.forEach(r => {
      if (r && r.id) recipeMap.set(String(r.id), r);
    });
    const sources = [...snapshot.docs, ...(lastLoadedDataRecipesDoc || [])];
    sources.forEach(doc => {
      if (!doc) return;
      const raw = (typeof doc.data === 'function') ? doc.data() : (doc.data && typeof doc.data === 'object' && !doc.name ? doc.data : doc);
      if (!raw || typeof raw !== 'object') return;
      const clean = unwrapAndCleanItem(raw) || {};
      if (!clean.id) {
        if (doc.id) clean.id = doc.id;
        else if (raw.id) clean.id = raw.id;
        else if (clean.name) clean.id = 'recipe_' + String(clean.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        else clean.id = 'recipe_' + Math.random().toString(36).substr(2, 9);
      }
      clean.id = String(clean.id);
      clean.isFavorite = (clean.isFavorite !== undefined) ? !!clean.isFavorite : false;
      clean.isFavourite = clean.isFavorite;
      const parseTS = (val) => {
        if (!val) return 0;
        if (typeof val.toDate === 'function') return val.toDate().getTime();
        if (val.seconds !== undefined) return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000);
        if (val._seconds !== undefined) return val._seconds * 1000 + Math.floor((val._nanoseconds || 0) / 1000000);
        const d = new Date(val);
        const t = d.getTime();
        return isNaN(t) ? 0 : t;
      };
      if (recipeMap.has(clean.id)) {
        const existing = recipeMap.get(clean.id);
        const localTime = parseTS(existing.updatedAt);
        const cloudTime = parseTS(clean.updatedAt);
        if (!localTime || cloudTime >= localTime) { Object.assign(existing, clean); }
      } else {
        state.recipes.push(clean);
        recipeMap.set(clean.id, clean);
      }
    });
    state.recipes.forEach(r => {
      if (r && r.id) state.recipes[r.id] = r;
    });
    window.state = state;
    window.appState = state;
    rebuildPlatePlanIndexes();
    renderAll();
    runDataQualityAudits();
    platePlanLastSyncedAt = Date.now();
    updatePlatePlanSyncStatus('synced');
  }, error => {
    console.error('[RECIPES SUBCOLLECTION LISTENER ERROR]', error);
    if(!navigator.onLine) updatePlatePlanSyncStatus('offline');
  });
  platePlanSyncUnsubscribers.push(unsubRecipes);
  const unsubDataRecipes = householdDocRef.collection('data').doc('recipes').onSnapshot(docSnapshot => {
    if(!docSnapshot || !docSnapshot.exists) return;
    if(platePlanTransactionShield.inFlight || (Date.now() - platePlanTransactionShield.lastCompletedAt < platePlanTransactionShield.cooldownMs)) return;
    if(docSnapshot.metadata && docSnapshot.metadata.hasPendingWrites) return;
    const data = docSnapshot.data() || {};
    lastLoadedDataRecipesDoc = parseRecipeDocumentToCleanArray(data);
    populateRecipesState(lastLoadedDataRecipesDoc, { merge: true });
    window.state = state;
    window.appState = state;
    rebuildPlatePlanIndexes();
    renderAll();
    runDataQualityAudits();
    platePlanLastSyncedAt = Date.now();
    updatePlatePlanSyncStatus('synced');
  }, error => {
    console.warn('[DATA RECIPES LISTENER ERROR]', error);
  });
  platePlanSyncUnsubscribers.push(unsubDataRecipes);
  const unsubHousehold = householdDocRef.onSnapshot(docSnapshot => {
    if(!docSnapshot || !docSnapshot.exists) return;
    if(platePlanTransactionShield.inFlight || (Date.now() - platePlanTransactionShield.lastCompletedAt < platePlanTransactionShield.cooldownMs)) return;
    if(docSnapshot.metadata && docSnapshot.metadata.hasPendingWrites) return;
    const docData = docSnapshot.data() || {};
    const sourceData = (docData.state && typeof docData.state === 'object') ? docData.state : docData;
    const rootRecipesRaw = sourceData.recipes || sourceData.data?.recipes;
    if (rootRecipesRaw) {
      const parsedRoot = parseRecipeDocumentToCleanArray(typeof rootRecipesRaw === 'object' ? rootRecipesRaw : { recipes: rootRecipesRaw });
      const mergedSources = [...parsedRoot, ...(lastLoadedDataRecipesDoc || [])];
      populateRecipesState(mergedSources, { merge: true });
    }
    if(sourceData.prefs !== undefined) state.prefs = sourceData.prefs;
    if(sourceData.plan && typeof sourceData.plan === 'object' && Object.keys(sourceData.plan).length > 0){
      const hasConflict = checkStartupPlanRecovery(sourceData.plan);
      if(!hasConflict) {
        state.plan = sourceData.plan;
        safeLocalStorageSet('plateplan_plan_backup', sanitizePlanForFirestore(sourceData.plan));
      }
    }
    if(sourceData.overrides !== undefined) state.overrides = sourceData.overrides;
    if(Array.isArray(sourceData.planHistory) && sourceData.planHistory.length > 0){
      state.planHistory = sourceData.planHistory;
      safeSaveHistoryBackup(sourceData.planHistory);
    }
    if(sourceData.ingredientGroups !== undefined) state.ingredientGroups = sourceData.ingredientGroups;
    if(sourceData.ingredientFamilies !== undefined) state.ingredientFamilies = sourceData.ingredientFamilies;
    if(sourceData.customCats !== undefined) state.customCats = sourceData.customCats;
    if(sourceData.excluded !== undefined) state.excluded = sourceData.excluded;
    if(sourceData.useUpProducts !== undefined) state.useUpProducts = sourceData.useUpProducts;
    if(sourceData.ignoredGroupMergeSuggestions !== undefined) state.ignoredGroupMergeSuggestions = sourceData.ignoredGroupMergeSuggestions;
    if(sourceData.ignoredDataQualityWarnings !== undefined) state.ignoredDataQualityWarnings = sourceData.ignoredDataQualityWarnings;
    if(sourceData.dataQualityDismissals !== undefined) state.dataQualityDismissals = sourceData.dataQualityDismissals;
    if(sourceData.packPicks !== undefined) state.packPicks = sourceData.packPicks;
    if(sourceData.meta) state.meta = { ...(state.meta || {}), ...sourceData.meta, householdId: targetHouseholdId };
    window.state = state;
    window.appState = state;
    renderAll();
    platePlanLastSyncedAt = Date.now();
    updatePlatePlanSyncStatus('synced');
  }, error => {
    console.error('[HOUSEHOLD ROOT METADATA LISTENER ERROR]', error);
    if(!navigator.onLine) updatePlatePlanSyncStatus('offline');
  });
  platePlanSyncUnsubscribers.push(unsubHousehold);
  const unsubPlanCurrent = householdDocRef.collection('plans').doc('current').onSnapshot(docSnapshot => {
    if(!docSnapshot || !docSnapshot.exists) return;
    if(platePlanTransactionShield.inFlight || (Date.now() - platePlanTransactionShield.lastCompletedAt < platePlanTransactionShield.cooldownMs)) return;
    if(docSnapshot.metadata && docSnapshot.metadata.hasPendingWrites) return;
    const data = docSnapshot.data() || {};
    const val = cleanCloudValue(data.value !== undefined ? data.value : data);
    if(val && typeof val === 'object' && Object.keys(val).length > 0){
      if(window.deletedPlanIds && val.id && window.deletedPlanIds.has(val.id)) return;
      const hasConflict = checkStartupPlanRecovery(val);
      if(!hasConflict) {
        state.plan = val;
        window.state = state;
        window.appState = state;
        safeLocalStorageSet('plateplan_plan_backup', sanitizePlanForFirestore(val));
        renderPlan();
        try { if(document.getElementById('view-today')?.classList.contains('active')) renderToday(); } catch(e) {}
      }
    }
  }, error => {
    console.warn('[PLAN CURRENT LISTENER ERROR]', error);
  });
  platePlanSyncUnsubscribers.push(unsubPlanCurrent);
  const unsubPlanHistory = householdDocRef.collection('plans').doc('history').onSnapshot(docSnapshot => {
    if(!docSnapshot || !docSnapshot.exists) return;
    if(platePlanTransactionShield.inFlight || (Date.now() - platePlanTransactionShield.lastCompletedAt < platePlanTransactionShield.cooldownMs)) return;
    if(docSnapshot.metadata && docSnapshot.metadata.hasPendingWrites) return;
    const data = docSnapshot.data() || {};
    let val = cleanCloudValue(data.value !== undefined ? data.value : (Array.isArray(data) ? data : data.planHistory));
    if(Array.isArray(val) && val.length > 0){
      if (window.deletedPlanIds && window.deletedPlanIds.size > 0) { val = val.filter(item => item && !window.deletedPlanIds.has(item.id) && !window.deletedPlanIds.has(item.planId)); }
      state.planHistory = val;
      window.state = state;
      window.appState = state;
      safeSaveHistoryBackup(val);
    }
  }, error => {
    console.warn('[PLAN HISTORY LISTENER ERROR]', error);
  });
  platePlanSyncUnsubscribers.push(unsubPlanHistory);
}
function getPlatePlanMigrationCounts(projection=platePlanStateProjection(state)){
  const count=prefix=>Object.keys(projection).filter(key=>key.startsWith(prefix+'/')).length;
  return {recipes:count('recipes'),products:count('products'),ingredients:count('ingredientFamilies'),subTypes:count('ingredientGroups'),overrides:count('overrides')};
}
function ensurePlatePlanMigrationModal(){
  let wrap=document.getElementById('plateplan-cloud-migration-wrap');
  if(wrap) return wrap;
  wrap=document.createElement('div'); wrap.id='plateplan-cloud-migration-wrap'; wrap.className='modal-wrap'; wrap.style.zIndex='750'; document.body.appendChild(wrap); return wrap;
}
async function loadSharedPlatePlan(){
  if (typeof window.hydrateHouseholdData === 'function') { return window.hydrateHouseholdData(); }
  return Promise.resolve(true);
}
window.loadSharedPlatePlan = loadSharedPlatePlan;
function ensurePlatePlanAuthScreen(){
  let screen=document.getElementById('plateplan-auth-screen');
  if(screen) return screen;
  screen=document.createElement('div'); screen.id='plateplan-auth-screen'; screen.className='auth-screen';
  screen.style.display='none';
  screen.innerHTML=`<div class="auth-card" style="position:relative">
    <button type="button" class="btn icon ghost sm" style="position:absolute;top:12px;right:12px;cursor:pointer;padding:4px 8px;min-height:30px" onclick="dismissPlatePlanAuthScreen()" title="Close">✕</button>
    <div class="logo" style="font-size:20px;margin-bottom:5px">Plate<span>Plan</span></div>
    <p style="font-size:13px;color:var(--text2);margin-bottom:15px">Sign in with Elliott's or Chloe's authorised Google account to sync your household meal plan.</p>
    <button class="btn" style="width:100%;justify-content:center;font-weight:600;padding:10px" type="button" onclick="signInPlatePlanWithGoogle()"><span style="font-size:16px;font-weight:700;color:#4285f4">G</span> Continue with Google</button>
    <details style="margin-top:14px">
      <summary style="cursor:pointer;font-size:12px;color:var(--text2)">Use email and password instead</summary>
      <form onsubmit="signInPlatePlan(event)" style="margin-top:10px">
        <label>Email</label><input id="plateplan-auth-email" type="email" autocomplete="username" required>
        <label style="margin-top:10px">Password</label><input id="plateplan-auth-password" type="password" autocomplete="current-password" required>
        <button class="btn primary" style="width:100%;justify-content:center;margin-top:14px" type="submit">Sign in with password</button>
      </form>
      <button class="btn ghost sm" style="margin-top:8px" type="button" onclick="resetPlatePlanPassword()">Forgotten password?</button>
    </details>
    <div id="plateplan-auth-msg"></div>
    <hr style="border:none;border-top:1px solid var(--border);margin:16px 0 12px">
    <button class="btn ghost sm" style="width:100%;justify-content:center" type="button" onclick="dismissPlatePlanAuthScreen()">Continue using local data</button>
  </div>`;
  document.body.appendChild(screen); return screen;
}
function dismissPlatePlanAuthScreen(){
  hidePlatePlanAuthScreen();
  setPlatePlanStartupInert(false);
  updatePlatePlanSyncStatus('local','Local mode');
  renderAll();
}
window.dismissPlatePlanAuthScreen = dismissPlatePlanAuthScreen;
function setPlatePlanStartupInert(active,exceptionId=''){
  document.querySelectorAll('.app, body > *').forEach(element=>{
    if(!(element instanceof HTMLElement)||['SCRIPT','STYLE'].includes(element.tagName)||element.id===exceptionId)return;
    if(active){
      if(element.dataset.startupInert!=='1'){
        element.dataset.startupInert='1';
        element.dataset.startupAriaHidden=element.getAttribute('aria-hidden')??'';
      }
      element.inert=true;
      element.setAttribute('aria-hidden','true');
    }else{
      element.inert=false;
      const previous=element.dataset.startupAriaHidden;
      if(previous)element.setAttribute('aria-hidden',previous);else element.removeAttribute('aria-hidden');
      delete element.dataset.startupInert;
      delete element.dataset.startupAriaHidden;
    }
  });
}
function showPlatePlanAuthScreen(){
  const screen=ensurePlatePlanAuthScreen();
  screen.classList.add('open');
  screen.style.display='flex';
  setPlatePlanStartupInert(true,screen.id);
}
function hidePlatePlanAuthScreen(){
  const screen=document.getElementById('plateplan-auth-screen');
  if(screen){
    screen.classList.remove('open');
    screen.style.display='none';
  }
  setPlatePlanStartupInert(false);
  const sourceChoice=document.getElementById('baked-state-recovery-banner');
  if(sourceChoice)setPlatePlanStartupInert(true,sourceChoice.id);
}
async function signInPlatePlanWithGoogle(){
  try{
    showMsg('plateplan-auth-msg','Opening Google sign-in…','info');
    const provider=new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    const result=await platePlanAuth.signInWithPopup(provider);
    if(result?.user) await startPlatePlanForSignedInUser(result.user);
  }catch(error){
    const messages={
      'auth/popup-blocked':'The Google sign-in window was blocked. Allow popups for PlatePlan and try again.',
      'auth/popup-closed-by-user':'Google sign-in was cancelled.',
      'auth/account-exists-with-different-credential':'This email already uses the password sign-in method. Use the fallback once, then link Google in Firebase.'
    };
    showMsg('plateplan-auth-msg',messages[error.code]||ppEscapeHtml(error.message),'error');
  }
}
async function signInPlatePlan(event){
  event?.preventDefault();
  const email=document.getElementById('plateplan-auth-email')?.value.trim();
  const password=document.getElementById('plateplan-auth-password')?.value||'';
  try{ showMsg('plateplan-auth-msg','Signing in…','info'); await platePlanAuth.signInWithEmailAndPassword(email,password); }
  catch(error){ showMsg('plateplan-auth-msg',error.code==='auth/invalid-credential'?'The email or password was not recognised.':ppEscapeHtml(error.message),'error'); }
}
async function resetPlatePlanPassword(){
  const email=document.getElementById('plateplan-auth-email')?.value.trim();
  if(!email) return showMsg('plateplan-auth-msg','Enter your email address first.','warn');
  try{ await platePlanAuth.sendPasswordResetEmail(email); showMsg('plateplan-auth-msg','Password reset email sent.','success'); }
  catch(error){ showMsg('plateplan-auth-msg',ppEscapeHtml(error.message),'error'); }
}
async function signOutPlatePlan(){
  platePlanCloudReady=false;
  platePlanSyncUnsubscribers.forEach(stop=>{try{stop();}catch(e){}});
  platePlanSyncUnsubscribers=[];
  if(platePlanAuth) await platePlanAuth.signOut();
}
function clearPlatePlanSyncOutbox(){
  platePlanLastSyncError=null;
  updatePlatePlanSyncStatus('synced');
  showPlatePlanToast('Sync reset.');
}
function forcePushPlatePlanToCloud(){
  if(!platePlanCloudReady || !platePlanCloudUser){
    showPlatePlanToast('Firebase sign in required');
    return;
  }
  pushStateToCloud(true);
  showPlatePlanToast('Uploaded device data to cloud database.');
}
function openPlatePlanSyncPanel(){
  const configured=!!window.PLATEPLAN_FIREBASE?.configured;
  if(!configured) return openAppInfoModal('Cloud sync not configured','PlatePlan is working locally. Complete the steps in <strong>PLATEPLAN_FIREBASE_SETUP.md</strong>, then set <code>configured: true</code> in <code>firebase-config.js</code>.');
  const email=platePlanCloudUser?.email||'Not signed in';
  const householdId=window.PLATEPLAN_FIREBASE?.householdId||'elliott-chloe';
  let lastSyncText='Never';
  if(platePlanLastSyncedAt){
    const mins=Math.floor((Date.now()-platePlanLastSyncedAt)/60000);
    lastSyncText=mins<=0?'Just now':(mins===1?'1 min ago':`${mins} mins ago`);
  }
  const errorHtml=platePlanLastSyncError?`<div style="color:var(--red);font-size:12px;background:rgba(239,68,68,0.08);padding:8px 10px;border-radius:6px;margin-top:4px"><strong>Last sync error:</strong> ${ppEscapeHtml(platePlanLastSyncError)}</div>`:'';
  openAppInfoModal('PlatePlan Cloud Sync',`<div style="display:grid;gap:8px;font-size:13px"><div><strong>Account:</strong> ${ppEscapeHtml(email)}</div><div><strong>Household:</strong> <code>${ppEscapeHtml(householdId)}</code></div><div><strong>Device ID:</strong> <code>${ppEscapeHtml(getPlatePlanDeviceId())}</code></div><div><strong>Database Status:</strong> Cloud Primary (Real-Time)</div><div><strong>Last Saved to Cloud:</strong> ${lastSyncText}</div>${errorHtml}</div><div class="btn-row" style="margin-top:14px;gap:8px"><button class="btn sm primary" onclick="pushStateToCloud(true);closeAppConfirmModal()">Sync now</button><button class="btn sm ghost" onclick="forcePushPlatePlanToCloud();closeAppConfirmModal()">Force upload device</button><button class="btn sm ghost" onclick="signOutPlatePlan();closeAppConfirmModal()">Sign out</button></div>`);
}
window.clearPlatePlanSyncOutbox=clearPlatePlanSyncOutbox; window.openPlatePlanSyncPanel=openPlatePlanSyncPanel; window.forcePushPlatePlanToCloud=forcePushPlatePlanToCloud; window.pushStateToCloud=pushStateToCloud; window.signOutPlatePlan=signOutPlatePlan; window.loadSharedPlatePlan=loadSharedPlatePlan;
async function startPlatePlanForSignedInUser(user){
  platePlanCloudUser=user;
  const userEl=document.getElementById('sync-user');
  if(userEl) userEl.textContent=user.email||'';
  hidePlatePlanAuthScreen();
  updatePlatePlanSyncStatus(navigator.onLine ? 'connecting' : 'offline');
  try{
    const config=window.PLATEPLAN_FIREBASE||{};
    const householdId=config.householdId || 'elliott-chloe';
    window.activeHouseholdId = householdId;
    window.activeHousehold = { id: householdId };
    if (!state.meta) state.meta = {};
    state.meta.householdId = householdId;
    const root=platePlanDb.collection('households').doc(householdId);
    root.collection('members').doc(user.uid).set({
      email: user.email||'',
      lastActive: firebase.firestore.FieldValue.serverTimestamp(),
      role: 'member'
    },{merge:true}).catch(err=>console.info('Member heartbeat noted:',err));
    await loadSharedPlatePlan();
    updatePlatePlanSyncStatus(navigator.onLine ? 'synced' : 'offline', navigator.onLine ? 'Synced with Cloud' : 'Offline Mode');
    setPlatePlanStartupInert(false);
    renderAll();
  }catch(error){
    console.warn('PlatePlan cloud startup error:',error);
    updatePlatePlanSyncStatus(navigator.onLine ? 'error' : 'offline', error.message);
    setPlatePlanStartupInert(false);
    renderAll();
  }
}
function initPlatePlanCloudSync(){
  try { bindTopBarActionListeners(); } catch(e) {}
  const settings=window.PLATEPLAN_FIREBASE||{};
  if (!settings.configured) { updatePlatePlanSyncStatus('local','Add Firebase configuration to enable shared sync'); setPlatePlanStartupInert(false); return; }
  if (!window.firebase) { updatePlatePlanSyncStatus('error','Firebase scripts did not load'); setPlatePlanStartupInert(false); return; }
  try{
    platePlanFirebaseApp=firebase.apps.length?firebase.app():firebase.initializeApp(settings.config);
    platePlanAuth=firebase.auth();
    platePlanDb=firebase.firestore();
    platePlanAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    platePlanAuth.onAuthStateChanged(user=>{
      if(user) {
        const config=window.PLATEPLAN_FIREBASE||{};
        const householdId=config.householdId || 'elliott-chloe';
        window.activeHouseholdId = householdId;
        window.activeHousehold = { id: householdId };
        if (!state.meta) state.meta = {};
        state.meta.householdId = householdId;
        startPlatePlanForSignedInUser(user);
      } else {
        platePlanCloudUser=null; platePlanCloudReady=false;
        const userEl = document.getElementById('sync-user');
        if (userEl) userEl.textContent='';
        updatePlatePlanSyncStatus('local','Sign in for cloud sync');
        setPlatePlanStartupInert(false);
      }
    }, error => {
      console.warn('onAuthStateChanged error:', error);
      updatePlatePlanSyncStatus('error', error.message);
      setPlatePlanStartupInert(false);
    });
  }catch(error){
    updatePlatePlanSyncStatus('error',error.message);
    setPlatePlanStartupInert(false);
  }
}
function getRecoveryPoints(){
  try{
    const parsed = JSON.parse(localStorage.getItem(RECOVERY_SK) || '[]');
    return Array.isArray(parsed) ? parsed.filter(point => point?.state && point?.id).slice(0,3) : [];
  }catch(e){ return []; }
}
function writeRecoveryPoints(points){
  const list = (points || []).slice(0,3);
  for(let count = list.length; count >= 0; count--){
    if (safeLocalStorageSet(RECOVERY_SK, safeJsonStringify(list.slice(0, count)))) {
      return;
    }
  }
}
function createRecoveryPoint(reason, snapshotState = state){
  if(!snapshotState) return true;
  try{
    const snapshot = JSON.parse(safeJsonStringify(snapshotState));
    const point = {
      id:'recovery-' + Date.now() + '-' + Math.random().toString(36).slice(2,6),
      createdAt:new Date().toISOString(),
      reason:String(reason || 'Major change'),
      state:snapshot
    };
    writeRecoveryPoints([point, ...getRecoveryPoints()]);
    renderRecoveryPanel();
    return true;
  }catch(e){
    console.warn('Could not create PlatePlan recovery point', e);
    return false;
  }
}
function runWithRecoveryPoint(reason, action){
  createRecoveryPoint(reason);
  if(typeof action === 'function') action();
}
function renderRecoveryPanel(){
  const el = document.getElementById('prefs-recovery-list');
  if(!el) return;
  const points = getRecoveryPoints();
  if(!points.length){
    el.innerHTML = '<div style="font-size:12px;color:var(--text3)">No automatic recovery points yet.</div>';
    return;
  }
  el.innerHTML = `<details><summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--text2)">Automatic recovery points (${points.length}/3)</summary>
    <div style="margin-top:6px">${points.map(point => {
      const counts = getPlatePlanStateCounts(point.state);
      const when = new Date(point.createdAt).toLocaleString();
      return `<div class="row-between" style="gap:10px;border-top:1px solid var(--border);padding:8px 0">
        <div style="font-size:12px"><strong>${ppEscapeHtml(point.reason)}</strong><div style="color:var(--text3);margin-top:2px">${ppEscapeHtml(when)} · ${counts.recipes} recipes · ${counts.products} products</div></div>
        <div class="btn-row" style="margin:0"><button class="btn sm ghost" onclick="restoreRecoveryPoint('${ppEscapeAttr(point.id)}')">Restore</button><button class="btn sm danger ghost" onclick="deleteRecoveryPoint('${ppEscapeAttr(point.id)}')">Delete</button></div>
      </div>`;
    }).join('')}</div></details>`;
}
function restoreRecoveryPoint(id){
  const point = getRecoveryPoints().find(item => item.id === id);
  if(!point) return;
  const restoreState = JSON.parse(safeJsonStringify(point.state));
  openAppConfirmModal(
    'Restore PlatePlan data?',
    `Restore <strong>${ppEscapeHtml(point.reason)}</strong> from ${ppEscapeHtml(new Date(point.createdAt).toLocaleString())}? The current data will be saved as a recovery point first.`,
    'Restore snapshot',
    () => runWithRecoveryPoint('Before restoring recovery point', () => {
      state = restoreState;
      ensureIngredientGroups(state);
      refreshPlatePlanDerivedState({ persist:true, render:true });
      loadPrefs();
      renderRecoveryPanel();
      showMsg('prefs-data-msg','Recovery point restored.','success');
    })
  );
}
function deleteRecoveryPoint(id){
  try{
    writeRecoveryPoints(getRecoveryPoints().filter(point => point.id !== id));
    renderRecoveryPanel();
  }catch(e){ showMsg('prefs-data-msg','Could not delete that recovery point.','error'); }
}
function clearVolatileSavedDom(root = document){
  const find = id => root.getElementById ? root.getElementById(id) : root.querySelector('#' + id);
  [
    'today-content','vault-list','ingredient-groups-list','bank-list',
    'plan-content','plan-overall-summary','plan-meal-prep-panel','plan-history-panel','plan-warnings',
    'shop-content','shop-summary','shop-meal-prep-panel',
    'dq-missing-list','dq-duplicate-list','dq-cat-list',
    'mapping-list','orig-ings-list','enh-ings-list','view-modal-content',
    'replace-ing-body','parse-ing-list','tesco-diagnostics-box','tesco-save-msg','tp-cat','tp-cat-category-options','recipe-photo-previews','recipe-photo-msg','mobile-action-sheet'
  ].forEach(id => {
    const el = find(id);
    if(el) el.innerHTML = '';
  });
  root.querySelectorAll?.('.map-dropdown').forEach(el => { el.innerHTML=''; el.style.display='none'; });
  [
    'product-default-picker-wrap','ingredient-to-subtype-wrap','ingredient-family-details-wrap',
    'ingredient-group-details-wrap','ingredient-group-picker-wrap','ingredient-family-picker-wrap',
    'ingredient-herb-conversion-wrap',
    'category-manager-wrap','ingredient-group-merge-wrap','delete-ingredient-group-wrap',
    'ingredient-alias-suggestion-wrap','tesco-duplicate-wrap','review-replace-wrap',
    'review-hover-tip','app-confirm-wrap','app-prompt-wrap','plateplan-import-preview-wrap','cat-reassign-modal',
    'plateplan-auth-screen','plateplan-cloud-migration-wrap','plateplan-sync-conflict-wrap','recipe-recognition-wrap','saved-plan-pack-wrap','plan-dates-wrap','plan-reschedule-wrap',
    'plateplan-toast-region'
  ].forEach(id => find(id)?.remove());
  root.querySelectorAll?.('.modal-wrap.open,.mobile-more-wrap.open,.mobile-action-sheet-wrap.open').forEach(el=>{el.classList.remove('open');delete el.dataset.historyEntry;});
  const photoActions=find('recipe-photo-actions'); if(photoActions) photoActions.style.display='none';
}
function getPlatePlanAppearance(){
  try{
    const value=localStorage.getItem(PLATEPLAN_APPEARANCE_SK)||'system';
    return ['system','light','dark'].includes(value)?value:'system';
  }catch(e){ return 'system'; }
}
function platePlanAppearanceIsDark(){
  const appearance=getPlatePlanAppearance();
  return appearance==='dark'||(appearance==='system'&&window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}
function syncPlatePlanAppearanceControls(){
  const appearance=getPlatePlanAppearance();
  document.querySelectorAll('[data-appearance]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.appearance===appearance)));
}
function applyPlatePlanAppearance(){
  const appearance=getPlatePlanAppearance();
  if(appearance==='system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme=appearance;
  document.documentElement.style.colorScheme=appearance==='system'?'light dark':appearance;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',platePlanAppearanceIsDark()?'#111214':'#F7F6F2');
  syncPlatePlanAppearanceControls();
}
function setPlatePlanAppearance(appearance){
  const safe=['system','light','dark'].includes(appearance)?appearance:'system';
  try{ localStorage.setItem(PLATEPLAN_APPEARANCE_SK,safe); }catch(e){}
  applyPlatePlanAppearance();
  showPlatePlanToast(`Appearance set to ${safe}.`);
}
function preserveStateBeforeModularMigration(){
  try{
    if(localStorage.getItem(PLATEPLAN_MODULAR_MIGRATION_SK)==='complete') return;
    const hasHouseholdData=!!(
      state?.recipes?.length ||
      state?.ingredients?.length ||
      state?.ingredientFamilies?.length ||
      state?.ingredientGroups?.length ||
      Object.keys(state?.plan?.slots || {}).length
    );
    if(!hasHouseholdData){
      localStorage.setItem(PLATEPLAN_MODULAR_MIGRATION_SK,'complete');
      return;
    }
    if(createRecoveryPoint('Before PlatePlan 20.4 modular migration',state)){
      localStorage.setItem(PLATEPLAN_MODULAR_MIGRATION_SK,'complete');
      return;
    }
    setTimeout(()=>openAppInfoModal(
      'Recovery snapshot unavailable',
      'PlatePlan could not create the automatic pre-migration recovery point, usually because browser storage is full. Your live data has not been replaced, and cloud synchronisation will continue normally.'
    ),0);
  }catch(error){
    console.warn('Could not record the PlatePlan modular migration',error);
  }
}
function installPlatePlanSidebarState(){
  let saved={};
  try{saved=JSON.parse(localStorage.getItem(PLATEPLAN_SIDEBAR_SK)||'{}')||{};}catch(_error){}
  document.querySelectorAll('.desktop-sidebar details[data-sidebar-group]').forEach(group=>{
    const key=group.dataset.sidebarGroup;
    if(typeof saved[key]==='boolean') group.open=saved[key];
    group.addEventListener('toggle',()=>{
      const next={};
      document.querySelectorAll('.desktop-sidebar details[data-sidebar-group]').forEach(item=>{next[item.dataset.sidebarGroup]=item.open;});
      try{localStorage.setItem(PLATEPLAN_SIDEBAR_SK,safeJsonStringify(next));}catch(_error){}
    });
  });
}
let platePlanApplicationInitialized=false;
function initializePlatePlanApplication(){
  if(platePlanApplicationInitialized)return;
  platePlanApplicationInitialized=true;
  performance.mark?.('plateplan-start');
  installPlatePlanModalHistory();
  clearVolatileSavedDom(document);
  loadBakedState();
  state = loadState();
  const bootHouseholdId = window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  window.activeHouseholdId = bootHouseholdId;
  window.activeHousehold = { id: bootHouseholdId };
  if (!state.meta) state.meta = {};
  state.meta.householdId = bootHouseholdId;
  preserveStateBeforeModularMigration();
  rebuildPlatePlanIndexes();
  applyPlatePlanAppearance();
  installPlatePlanSidebarState();
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{
    if(getPlatePlanAppearance()==='system') applyPlatePlanAppearance();
  });
  renderCatOptions('mi-cat', 'other');
  renderCatOptions('pp-cat', 'other');
  renderCatOptions('tp-cat', 'other');
  renderCatOptions('mini-cat', 'other');
  hideLegacyCategoryAndMeatFields();
  installPackModelSummaryListeners();
  document.getElementById('shop-group-by').value = state.prefs.shopGroupBy || 'family';
  if(document.getElementById('plan-product-priority')) document.getElementById('plan-product-priority').value = state.prefs.productPriority || 'protein';
  setMealRepeatControlValues();
  setPlanTrafficSelectValues();
  ensurePlannerShell();
  installPlannerSummaryObserver();
  refreshAllProductDefaultsAndRecipeNutrition();
  rebuildPlatePlanIndexes();
  safeLocalStorageSet(SK, safeJsonStringify(state));
  checkStartupPlanRecovery(state?.plan);
  resetTodayDate({render:false});
  requestPlatePlanViewRender('today');
  platePlanDirtyViews.delete('today');
  scheduleTodayMidnightRefresh();
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible') return;
    const actualDate=getPlatePlanLocalToday();
    const dateChanged=!!platePlanLastActualDate&&platePlanLastActualDate!==actualDate;
    platePlanLastActualDate=actualDate;
    if(document.getElementById('view-today')?.classList.contains('active')){
      if(dateChanged) platePlanTodayDate=actualDate;
      renderToday();
    }
    scheduleTodayMidnightRefresh();
  });
  performance.mark?.('plateplan-usable');
  try{ performance.measure?.('plateplan-local-startup','plateplan-start','plateplan-usable'); }catch(e){}
  window.state = state;
  window.appState = state;
  try {
    Object.defineProperty(window, 'state', {
      get: () => state,
      set: (v) => { state = v; },
      configurable: true
    });
    Object.defineProperty(window, 'appState', {
      get: () => state,
      set: (v) => { state = v; },
      configurable: true
    });
  } catch(_e) {}
  setPlatePlanStartupInert(false);
  initPlatePlanCloudSync();
  setPlatePlanStartupInert(false);
  window.addEventListener('online',()=>{ updatePlatePlanSyncStatus(getPlatePlanSyncOutbox().length?'saving':'connecting'); flushPlatePlanSyncOutbox(); });
  window.addEventListener('offline',()=>updatePlatePlanSyncStatus('offline'));
  const origServesInput = document.getElementById('r-serves-orig');
  const targetServesInput = document.getElementById('r-serves');
  if(origServesInput && targetServesInput){
    origServesInput.addEventListener('input', () => {
      if (!targetServesInput.dataset.manuallyChanged || !targetServesInput.value) { targetServesInput.value = origServesInput.value; }
    });
    targetServesInput.addEventListener('input', () => {
      targetServesInput.dataset.manuallyChanged = 'true';
    });
  }
  document.addEventListener('click', (e) => {
      if(!e.target.closest('.mapping-search-container')) {
          document.querySelectorAll('.map-dropdown').forEach(d => d.style.display = 'none');
      }
      if(!e.target.closest('.recipe-search-wrap')) {
          document.querySelectorAll('.recipe-search-drop').forEach(d => d.style.display = 'none');
          document.querySelectorAll('.recipe-search-wrap').forEach(w => w.classList.remove('is-open'));
          document.querySelectorAll('.slot-row').forEach(sr => sr.classList.remove('has-open-drop'));
      }
  });
}
window.initializePlatePlanApplication = initializePlatePlanApplication;
window.initApp = initializePlatePlanApplication;
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initializePlatePlanApplication,{once:true});
}else { queueMicrotask(initializePlatePlanApplication); }
function getBudgets(person, mealType) {
    const p = state.prefs || {};
    const eAlloc = p.eAlloc || {b:15, l:25, d:45, s:15};
    const cAlloc = p.cAlloc || {b:25, l:30, d:35, s:10};
    const eProtAlloc = p.eProtAlloc || eAlloc;
    const cProtAlloc = p.cProtAlloc || cAlloc;
    const alloc = person === 'e' ? eAlloc : cAlloc;
    const protAlloc = person === 'e' ? eProtAlloc : cProtAlloc;
    const meal = String(mealType || '').toLowerCase();
    let mKey = 'd'; // default dinner for legacy/unknown meal contexts
    if(meal.includes('breakfast')) mKey = 'b';
    else if(meal.includes('lunch')) mKey = 'l';
    else if(meal.includes('snack')) mKey = 's';
    else if(meal.includes('dinner')) mKey = 'd';
    const calPct = (alloc[mKey] || 0) / 100;
    const protPct = (protAlloc[mKey] || 0) / 100;
    const cal = (person === 'e' ? (p.ecal || 2400) : (p.ccal || 1700)) * calPct;
    const prot = (person === 'e' ? (p.eprot || 130) : (p.cprot || 100)) * protPct;
    return {cal, prot};
}
function calculateFit(actCal, actProt, tgtCal, tgtProt) {
    if (!tgtCal || !tgtProt) {
      return { score: 0, status: 'green', label: '🟢 Great Fit', warn: [], calDiffPct: 0, protDiffPct: 0 };
    }
    const calDiffPct = ((actCal - tgtCal) / tgtCal) * 100;
    const protDiffPct = ((actProt - tgtProt) / tgtProt) * 100;
    const protDev = protDiffPct < 0 ? (Math.abs(protDiffPct) / 100) * 1.5 : 0;
    let calDev = 0;
    if (calDiffPct > 0) { calDev = (calDiffPct / 100) * 1.2; } else {
      const absCalDiff = Math.abs(calDiffPct);
      if (protDiffPct >= 0) {
        if (absCalDiff > 35) { calDev = 0.10 + ((absCalDiff - 35) / 100) * 0.8; } else if (absCalDiff > 25) { calDev = ((absCalDiff - 25) / 100) * 0.4; } else { calDev = 0; }
      } else {
        if (absCalDiff > 35) { calDev = (absCalDiff / 100) * 1.0; } else if (absCalDiff > 25) { calDev = (absCalDiff / 100) * 0.6; } else { calDev = (absCalDiff / 100) * 0.3; }
      }
    }
    const score = calDev + protDev;
    let calStatus = 'green';
    if (calDiffPct > 35) { calStatus = 'red'; } else if (calDiffPct > 20) { calStatus = 'amber'; } else if (calDiffPct >= -25) { calStatus = 'green'; } else if (calDiffPct >= -35) { calStatus = 'amber'; } else { calStatus = 'red'; }
    let protStatus = 'green';
    if (protDiffPct >= -10) { protStatus = 'green'; } else if (protDiffPct >= -25) { protStatus = 'amber'; } else { protStatus = 'red'; }
    let status = 'green';
    if (calStatus === 'red' || protStatus === 'red') { status = 'red'; } else if (calStatus === 'amber' || protStatus === 'amber') { status = 'amber'; } else { status = 'green'; }
    const label = status === 'green' ? '🟢 Great Fit' : status === 'amber' ? '🟠 Acceptable Fit' : '🔴 Poor Fit';
    const warn = [];
    if (calDiffPct > 20) {
      warn.push(`Calories ${Math.round(calDiffPct)}% above target`);
    } else if (calDiffPct < -25) {
      if (protDiffPct >= 0) {
        warn.push(`Calories ${Math.round(Math.abs(calDiffPct))}% below target (protein target met)`);
      } else {
        warn.push(`Calories ${Math.round(Math.abs(calDiffPct))}% below target`);
      }
    }
    if (protDiffPct < -10) {
      warn.push(`Protein ${Math.round(Math.abs(protDiffPct))}% below target`);
    }
    return { score, status, label, warn, calDiffPct, protDiffPct };
}
function getRecipeVariantActiveRecipe(row){
    if(!row) return null;
    if(row.variant === 'enhanced' && row.recipe?.enhanced) {
      return { ...row.recipe, ...row.recipe.enhanced, ingredients: row.recipe.enhanced.ingredients || row.recipe.ingredients || [] };
    }
    return row.recipe || null;
}
function getRecipeVariantTrafficStatus(row, person, mealType){
    const base = row?.recipe || null;
    if(!base) return 'red';
    const variant = row.variant === 'enhanced' && base.enhanced ? 'enhanced' : 'original';
    const mt = mealType || (base.types && base.types[0]) || base.type || 'dinner';
    const bundle = calculateRecipeDisplayNutrition({ recipe:base, variant, mealType:mt });
    const portions = bundle?.portions || calcPortions({}, state.prefs, base.serves || 2, base.who || 'both', mt);
    const key = String(person || '').toLowerCase().startsWith('c') ? 'c' : 'e';
    const actualCal = key === 'c' ? portions.cCal : portions.eCal;
    const actualProt = key === 'c' ? portions.cProt : portions.eProt;
    const tgt = getBudgets(key, mt);
    return calculateFit(actualCal, actualProt, tgt.cal, tgt.prot).status;
}
function normalisePlanTrafficStatuses(values){
    const valid=['green','amber','red'];
    const rows=(Array.isArray(values)?values:[values])
      .flatMap(value=>String(value||'').toLowerCase().split(/[\s,|/]+/))
      .filter(Boolean);
    if(rows.some(value=>value==='any'||value==='all'||value==='unrestricted'))return valid.slice();
    const selected=valid.filter(status=>rows.some(value=>value===status||value.includes(status)));
    return selected.length?selected:valid.slice();
}
function getSelectedPlanTrafficStatuses(personPrefix){
    const id = personPrefix === 'c' ? 'plan-traffic-c' : 'plan-traffic-e';
    const fallback = personPrefix === 'c' ? state.prefs.planTrafficC : state.prefs.planTrafficE;
    const inputs=Array.from(document.querySelectorAll(`input[name="${id}"]`));
    const checks = inputs.filter(input=>input.checked).map(el => el.value);
    if(inputs.length) return normalisePlanTrafficStatuses(checks);
    const el = document.getElementById(id);
    const selected = el ? Array.from(el.selectedOptions).map(o => o.value) : fallback;
    return normalisePlanTrafficStatuses(selected);
}
function setPlanTrafficSelectValues(){
    [['plan-traffic-e', state.prefs.planTrafficE], ['plan-traffic-c', state.prefs.planTrafficC]].forEach(([id, values]) => {
      const allowed = new Set(normalisePlanTrafficStatuses(values));
      document.querySelectorAll(`input[name="${id}"]`).forEach(input => { input.checked = allowed.has(input.value); });
      document.querySelectorAll(`input[name="${id}"]`).forEach(input => input.closest('.traffic-pill')?.setAttribute('aria-pressed',input.checked?'true':'false'));
      const el = document.getElementById(id);
      if(el) Array.from(el.options).forEach(opt => { opt.selected = allowed.has(opt.value); });
    });
}
function savePlanTrafficPrefs(){
    state.prefs.planTrafficE = getSelectedPlanTrafficStatuses('e');
    state.prefs.planTrafficC = getSelectedPlanTrafficStatuses('c');
    setPlanTrafficSelectValues();
    saveState();
    renderPlanTrafficAvailabilitySummary();
}
function togglePlanTrafficStatus(personPrefix,status){
    const id=personPrefix==='c'?'plan-traffic-c':'plan-traffic-e';
    const inputs=Array.from(document.querySelectorAll(`input[name="${id}"]`));
    const selected=new Set(inputs.filter(input=>input.checked).map(input=>input.value));
    if(selected.has(status)){
      if(selected.size===1){
        showPlatePlanToast('Keep at least one traffic-light colour selected.');
        return;
      }
      selected.delete(status);
    }else selected.add(status);
    inputs.forEach(input=>{input.checked=selected.has(input.value);});
    savePlanTrafficPrefs();
}
function getMealRepeatCadence(){
    const defaults = { breakfast:1, lunch:2, dinner:1 };
    const saved = state.prefs?.mealRepeatCadence || {};
    const read = meal => {
      const el = document.getElementById('plan-repeat-' + meal);
      const raw = el ? el.value : saved[meal];
      return Math.min(10, Math.max(1, parseInt(raw || defaults[meal], 10) || defaults[meal]));
    };
    return { breakfast: read('breakfast'), lunch: read('lunch'), dinner: read('dinner') };
}
function setMealRepeatControlValues(){
    const cadence = { breakfast:1, lunch:2, dinner:1, ...(state.prefs?.mealRepeatCadence || {}) };
    ['breakfast','lunch','dinner'].forEach(meal => {
      const el = document.getElementById('plan-repeat-' + meal);
      if(!el) return;
      if(!el.options.length){
        el.innerHTML = Array.from({length:10}, (_,i) => {
          const n = i + 1;
          return `<option value="${n}">${n} day${n === 1 ? '' : 's'}</option>`;
        }).join('');
      }
      el.value = String(Math.min(10, Math.max(1, parseInt(cadence[meal], 10) || (meal === 'lunch' ? 2 : 1))));
    });
}
function saveMealRepeatCadence(){
    state.prefs.mealRepeatCadence = getMealRepeatCadence();
    saveState();
}
function formatPlanTrafficLabel(statuses){
    const names = { green:'green', amber:'amber', red:'red' };
    return (statuses || []).map(s => names[s] || s).join('/') || 'none';
}
function getPlanTrafficFilterRules(){
    const e = normalisePlanTrafficStatuses(getSelectedPlanTrafficStatuses('e'));
    const c = normalisePlanTrafficStatuses(getSelectedPlanTrafficStatuses('c'));
    return { e, c, label:`Elliott ${formatPlanTrafficLabel(e)} and Chloe ${formatPlanTrafficLabel(c)}` };
}
function renderPlanTrafficAvailabilitySummary(){
    const host=document.getElementById('plan-traffic-availability');
    if(!host||!state)return;
    const rules=getPlanTrafficFilterRules();
    const priority=document.getElementById('plan-product-priority')?.value||state.prefs.productPriority||'protein';
    const personRow=(who,prefix)=>{
      const counts=['breakfast','lunch','dinner'].map(meal=>{
        const options=getPlannerRecipeOptions(meal,who,{applyExclusions:true,trafficRules:rules}).filter(option=>plannerOptionHasUsableMappings(option,priority));
        return `<span class="${options.length?'':'bad'}">${toTitleCase(meal)} <strong>${options.length}</strong></span>`;
      }).join('');
      const selected=(prefix==='e'?rules.e:rules.c).map(toTitleCase).join(', ');
      return `<div class="traffic-availability-row"><strong>${ppEscapeHtml(who)}</strong><span class="traffic-selected-copy">${ppEscapeHtml(selected)}</span><div>${counts}</div></div>`;
    };
    host.innerHTML=`<div class="row-between" style="gap:8px;align-items:center;margin-bottom:5px"><div style="font-size:12px;font-weight:700">Recipes available with these filters</div><div class="btn-row"><button type="button" class="btn sm primary" onclick="setPlanTrafficPreset('green')">Green only</button><button type="button" class="btn sm ghost" onclick="setPlanTrafficPreset('all')">All colours</button></div></div>${personRow('Elliott','e')}${personRow('Chloe','c')}<div style="font-size:11px;color:var(--text2);margin-top:6px">Coloured controls are included; grey controls are excluded. If the final selected colour is turned off, PlatePlan selects all three.</div>`;
}
function setPlanTrafficPreset(preset){
    const allowed=preset==='green'?new Set(['green']):new Set(['green','amber','red']);
    document.querySelectorAll('input[name="plan-traffic-e"],input[name="plan-traffic-c"]').forEach(input=>{input.checked=allowed.has(input.value);});
    savePlanTrafficPrefs();
}
function plannerRecipePassesTrafficFilter(row, mealType, who, suppliedRules=null){
    const minFitScore = state?.prefs?.minFitScore || 0;
    if (minFitScore > 0) {
      const effScore = (row._computedFitScore !== undefined) ? row._computedFitScore : (getEffectiveRecipeFitScore(row.recipe || row, mealType)?.score || 0);
      if (effScore < minFitScore) return false;
    }
    const rules = suppliedRules || getPlanTrafficFilterRules();
    const target = String(who || '').toLowerCase();
    const checkE = target === 'any' || target === 'elliott' || target === 'both';
    const checkC = target === 'any' || target === 'chloe' || target === 'both';
    if(checkE && rules.e && rules.e.length && !rules.e.includes(getRecipeVariantTrafficStatus(row, 'Elliott', mealType))) return false;
    if(checkC && rules.c && rules.c.length && !rules.c.includes(getRecipeVariantTrafficStatus(row, 'Chloe', mealType))) return false;
    return true;
}
function getRecipeFitScore(r, customMealType = null){
    const types = r.types || [r.type || 'dinner'];
    const mealType = customMealType || types[0] || 'dinner';
    const usingEnhanced = !!(r.enhanced && (r.enhanced.ingredients || r.enhanced.nutrition || r.enhanced.cal || r.enhanced.prot));
    const bundle = calculateRecipeDisplayNutrition({ recipe:r, variant:usingEnhanced ? 'enhanced' : 'original', mealType });
    const portions = bundle?.portions || calcPortions({}, state.prefs, r.serves || 2, r.who || 'both', mealType);
    const fitRes = calculateMacroFitTierAndScore({ recipe: r, variant: usingEnhanced ? 'enhanced' : 'original', portions }, mealType);
    return { raw: fitRes.score, display: fitRes.score, fit: fitRes, usingEnhanced, portions };
}
function getBoosters(gapGrams) {
    if(gapGrams <= 0) return [];
    const sorted = (state.ingredients || []).filter(i=>i && i.prot>5 && i.cal>0).sort((a,b) => (b.prot/b.cal) - (a.prot/a.cal));
    const suggestions = [];
    for(let i=0; i<Math.min(5, sorted.length); i++) {
        const ing = sorted[i];
        const multiplier = gapGrams / ing.prot; // grams per 100g needed to hit gap
        const gramsNeeded = Math.round(multiplier * 100);
        const extraCals = Math.round((ing.cal/100) * gramsNeeded);
        suggestions.push(`<strong>${gramsNeeded}g ${ing.name}</strong> (+${Math.round(gapGrams)}g P, +${extraCals} kcal)`);
    }
    return suggestions;
}
function getImprovementSuggestions(ings, prefix = 'enh') {
    const currentGroupIds = new Set((ings || []).filter(i=>i.groupId).map(i=>i.groupId));
    const catOptions = Object.entries(CAT).filter(([k,v]) => v).sort((a,b)=>a[1].localeCompare(b[1])).map(([k,v]) => `<option value="${ppEscapeAttr(k)}">${ppEscapeHtml(v)}</option>`).join('');
    return `<details class="review-secondary-section" style="margin-top:15px;border-top:1px solid var(--border);padding-top:10px;">
        <summary>Nutritional improvement tools</summary>
        <div class="enhancement-filter-grid">
          <input type="search" id="enhance-search-${prefix}" placeholder="Search ingredients or sub-types..." oninput="renderEnhancementFinder('${prefix}')" style="font-size:12px;padding:6px 9px">
          <select id="enhance-cat-${prefix}" onchange="renderEnhancementFinder('${prefix}')" style="font-size:12px"><option value="all">All categories</option>${catOptions}</select>
          <input type="search" id="enhance-family-${prefix}" placeholder="Ingredient" oninput="renderEnhancementFinder('${prefix}')" style="font-size:12px;padding:6px 9px">
          <input type="search" id="enhance-type-${prefix}" placeholder="Sub-type" oninput="renderEnhancementFinder('${prefix}')" style="font-size:12px;padding:6px 9px">
          <select id="enhance-sort-${prefix}" onchange="renderEnhancementFinder('${prefix}')" style="font-size:12px">
            <option value="protein_per_kcal">Protein per kcal (highest)</option>
            <option value="least_protein_per_kcal">Least protein per kcal (low efficiency)</option>
            <option value="protein_per_pound">Protein per £</option>
            <option value="protein">Highest protein</option>
            <option value="low_kcal">Lowest kcal</option>
            <option value="cost_per_100">Lowest cost per 100g/ml</option>
          </select>
        </div>
        <div id="enhancement-results-${prefix}" data-current-group-ids="${[...currentGroupIds].map(ppEscapeAttr).join(',')}"><div style="font-size:12px;color:var(--text2);padding:8px 0">Start typing to search ingredients or sub-types to add.</div></div>
    </details>`;
}
function getDefaultGroupForIngredientFamily(family){
    if(!family) return null;
    if(family.defaultGroupId) {
      const direct = getIngredientGroup(family.defaultGroupId);
      if(direct) return direct;
    }
    const groups = (state.ingredientGroups || []).filter(g => g && (g.ingredientId === family.id || String(g.family || '').toLowerCase() === String(family.name || '').toLowerCase()));
    if(!groups.length) return null;
    return groups.slice().sort((a,b) => {
      const ap = resolveProductForIngredient({groupId:a.id})?.product;
      const bp = resolveProductForIngredient({groupId:b.id})?.product;
      return scoreProductByPriority(bp, 'protein_per_kcal') - scoreProductByPriority(ap, 'protein_per_kcal') || (getGroupTypeName(a) || '').localeCompare(getGroupTypeName(b) || '');
    })[0];
}
function getEnhancementChoiceRows(){
    ensureIngredientFamilies?.();
    ensureIngredientGroups?.();
    const rows = [];
    const seen = new Set();
    (state.ingredientFamilies || []).forEach(family => {
      const group = getDefaultGroupForIngredientFamily(family);
      if(!group || seen.has('family:' + family.id)) return;
      const product = resolveProductForIngredient({groupId:group.id})?.product;
      if(!isUsableProduct(product)) return;
      const groups = (state.ingredientGroups || []).filter(g => g && (g.ingredientId === family.id || String(g.family || '').toLowerCase() === String(family.name || '').toLowerCase()));
      const aliases = [family.name, ...(family.aliases || []), ...groups.flatMap(g => [getGroupTypeName(g), ...(g.aliases || [])]), product.name, product.brand].filter(Boolean);
      rows.push({ kind:'ingredient', id:family.id, name:family.name || getGroupTypeName(group) || product.name, group, product, cat:family.cat || group.cat || product.cat || 'other', hierarchy:[CAT[family.cat || group.cat || product.cat || 'other'] || 'Other', family.name || 'Ingredient'].filter(Boolean).join(' > '), search:aliases.join(' ').toLowerCase() });
      seen.add('family:' + family.id);
    });
    (state.ingredientGroups || []).forEach(group => {
      if(!group || seen.has('group:' + group.id)) return;
      const product = resolveProductForIngredient({groupId:group.id})?.product;
      if(!isUsableProduct(product)) return;
      const family = getGroupIngredientFamily(group);
      const name = getGroupTypeName(group) || group.name || product.name;
      const aliases = [name, group.name, group.family, family?.name, ...(group.aliases || []), ...(family?.aliases || []), product.name, product.brand].filter(Boolean);
      rows.push({ kind:'subtype', id:group.id, name, group, product, cat:group.cat || family?.cat || product.cat || 'other', hierarchy:getGroupHierarchyText(group), search:aliases.join(' ').toLowerCase() });
      seen.add('group:' + group.id);
    });
    return rows;
}
function renderEnhancementFinder(prefix = 'enh'){
    const out = document.getElementById('enhancement-results-' + prefix);
    if(!out) return;
    const q = (document.getElementById('enhance-search-' + prefix)?.value || '').trim().toLowerCase();
    const cat = document.getElementById('enhance-cat-' + prefix)?.value || 'all';
    const familyQ = (document.getElementById('enhance-family-' + prefix)?.value || '').trim().toLowerCase();
    const typeQ = (document.getElementById('enhance-type-' + prefix)?.value || '').trim().toLowerCase();
    const sort = document.getElementById('enhance-sort-' + prefix)?.value || 'protein_per_kcal';
    if(!q && !familyQ && !typeQ) {
      out.innerHTML = '<div style="font-size:12px;color:var(--text2);padding:8px 0">Start typing to search ingredients or sub-types to add.</div>';
      return;
    }
    let rows = getEnhancementChoiceRows().filter(row => {
      const family = getGroupIngredientFamily(row.group);
      const typeName = getGroupTypeName(row.group) || '';
      if(cat !== 'all' && (row.cat || 'other') !== cat) return false;
      if(q && !row.search.includes(q)) return false;
      if(familyQ && !String(family?.name || row.group?.family || row.name || '').toLowerCase().includes(familyQ)) return false;
      if(typeQ && !String(typeName || '').toLowerCase().includes(typeQ)) return false;
      return true;
    });
    rows.sort((a,b) => scoreProductByPriority(b.product, sort) - scoreProductByPriority(a.product, sort) || (a.name || '').localeCompare(b.name || ''));
    rows = rows.slice(0, 18);
    if(!rows.length){
      out.innerHTML = '<div style="font-size:12px;color:var(--text2);padding:8px 0">No matching ingredients or sub-types found.</div>';
      return;
    }
    out.innerHTML = rows.map(row => {
      const product = row.product;
      const pkcal = getProductProteinPer100Kcal(product);
      const ppound = getProductProteinPerPound(product);
      const price = +product.price || 0;
      const packG = productPackGrams(product);
      const cost100 = price && packG ? price / packG * 100 : 0;
      const controlId = `${prefix}-${row.kind}-${row.id}`.replace(/[^a-zA-Z0-9_-]/g,'_');
      const badge = row.kind === 'ingredient' ? 'Ingredient' : 'Sub-type';
      return `<div class="card-inner" style="padding:9px 10px;margin-bottom:7px;background:var(--surface);border-left:3px solid var(--purple)">
        <div class="row-between enhancement-choice-row" style="gap:8px;align-items:flex-start">
          <div style="min-width:0;flex:1">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><strong>${ppEscapeHtml(row.name || badge)}</strong><span class="tag">${badge}</span></div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${ppEscapeHtml(row.hierarchy || '')}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:2px">Default product: ${ppEscapeHtml(product.name || 'Product')}${product.brand && product.brand !== 'Generic' ? ` · ${ppEscapeHtml(product.brand)}` : ''}</div>
            <div class="macro-bar" style="margin-top:5px"><span class="mpill">${Math.round(product.cal || 0)} kcal/100g</span><span class="mpill p">P ${round1(product.prot || 0)}g/100g</span><span class="mpill">${round1(pkcal)}g P/100kcal</span><span class="mpill">${round1(ppound)}g P/£</span>${cost100 ? `<span class="mpill">£${cost100.toFixed(2)}/100g</span>` : ''}</div>
          </div>
          <div class="enhancement-choice-actions" style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
            <input type="number" id="enhance-qty-${controlId}" value="100" min="0" step="0.1" style="width:64px;font-size:12px;padding:5px 6px">
            <select id="enhance-unit-${controlId}" style="width:58px;font-size:12px;padding:5px 6px"><option value="g">g</option><option value="ml">ml</option><option value="qty">qty</option></select>
            <button class="btn sm ghost" onclick="addImprovementChoiceToModal('${ppEscapeAttr(row.kind)}','${ppEscapeAttr(row.id)}','${ppEscapeAttr(prefix)}','${ppEscapeAttr(controlId)}')">Add</button>
          </div>
        </div>
      </div>`;
    }).join('');
}
function resolveEnhancementChoice(kind, id){
    if(kind === 'ingredient'){
      const family = getIngredientFamily(id) || (state.ingredientFamilies || []).find(f => f.id === id);
      const group = getDefaultGroupForIngredientFamily(family);
      const product = group ? resolveProductForIngredient({groupId:group.id})?.product : null;
      return { kind, family, group, product, displayName: family?.name || getGroupTypeName(group) || product?.name || '' };
    }
    const group = getIngredientGroup(id);
    const family = group ? getGroupIngredientFamily(group) : null;
    const product = group ? resolveProductForIngredient({groupId:group.id})?.product : null;
    return { kind:'subtype', family, group, product, displayName: getGroupTypeName(group) || product?.name || '' };
}
function addImprovementChoiceToModal(kind, id, prefix = 'enh', controlId = ''){
    const choice = resolveEnhancementChoice(kind, id);
    const product = choice.product;
    const group = choice.group;
    if(!group || !product) {
      openAppInfoModal('Default product needed','This ingredient does not have a usable default product yet. Add or assign a default product first.');
      return;
    }
    const safeId = controlId || `${prefix}-${kind}-${id}`.replace(/[^a-zA-Z0-9_-]/g,'_');
    const qty = Math.max(0, parseFloat(document.getElementById('enhance-qty-' + safeId)?.value) || 100);
    const unit = document.getElementById('enhance-unit-' + safeId)?.value || 'g';
    const rows = Array.from(document.querySelectorAll(`#${prefix}-ings-list .rev-ing-row`));
    const existing = rows.find(row => (row.dataset.groupid === group.id || row.dataset.bankid === product.id) && row.querySelector('.r-unit')?.value === unit);
    if(existing) {
      const input = existing.querySelector('.r-qty');
      input.value = Math.round(((parseFloat(input.value) || 0) + qty) * 10) / 10;
      recalcModal(prefix);
      return;
    }
    addModalIng(prefix);
    const updatedRows = document.querySelectorAll(`#${prefix}-ings-list .rev-ing-row`);
    const row = updatedRows[updatedRows.length - 1];
    if(!row) return;
    row.dataset.bankid = product.id;
    row.dataset.groupid = group.id || '';
    if(kind === 'ingredient' && choice.family?.id) {
      row.dataset.ingredientid = choice.family.id;
      row.dataset.mappedViaIngredient = '1';
    }
    row.querySelector('.r-qty').value = qty;
    row.querySelector('.r-unit').value = unit;
    row.querySelector('.r-name').value = choice.displayName || getGroupTypeName(group) || product.name || '';
    const editBtn = row.querySelector('.r-edit-ing');
    if(editBtn) editBtn.style.display = 'inline-block';
    recalcModal(prefix);
}
function transformProductGroup(product){
    const groupVal = typeof product === 'string' ? product : (product?.group || product?.groupId || product?.subType || '');
    return String(groupVal || '').replace(/[^a-zA-Z0-9_\s-]/g, '').trim();
}
window.transformProductGroup = transformProductGroup;
function addImprovementProductToModal(productId, prefix = 'enh', controlId = ''){
    const product = getProduct(productId);
    if(!product) return;
    const safeGroupId = (product?.groupId || product?.group || '').replace(/[^a-zA-Z0-9_-]/g,'_');
    const safeId = (product?.id || '').replace(/[^a-zA-Z0-9_-]/g,'_');
    addImprovementChoiceToModal('subtype', product?.groupId || '', prefix, controlId || `${prefix}-subtype-${safeGroupId || safeId}`);
}
function optimisePortions(id) {
    const r = state.recipes.find(x => x.id === id);
    if(!r) return;
    viewRecipe(id, null); 
}
function renderCatOptions(selectId, defaultVal) {
  const sel = document.getElementById(selectId);
  if(!sel) return;
  const combined = Object.entries(CAT).filter(([k,v]) => v).sort((a,b) => a[1].localeCompare(b[1]));
  let html = combined.map(([k,v]) => `<option value="${k}">${v}</option>`).join('');
  html += `<option value="__add_new__" style="font-weight:bold; color:var(--green)">+ Add new category...</option>`;
  sel.innerHTML = html;
  sel.value = defaultVal || 'other';
  syncCategorySearchInput(selectId);
  sel.onchange = (e) => {
    if(e.target.value === '__add_new__') {
      openAppPromptModal('Add category','Category name','','Add category',name=>{
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        state.customCats[slug] = name;
        CAT[slug] = name;
        saveState();
        ['mi-cat', 'pp-cat', 'tp-cat', 'mini-cat'].forEach(id => {
          const s = document.getElementById(id);
          if(s) {
            const currentVal = s.id === selectId ? slug : s.value;
            renderCatOptions(id, currentVal);
          }
        });
        syncCategorySearchInput(selectId);
        renderBank();
        renderDataQuality();
      },()=>{
        sel.value = defaultVal || 'other'; 
        syncCategorySearchInput(selectId);
      });
    }
  };
}
function getCategorySearchOptions() { return Object.entries(CAT).filter(([k,v]) => v).sort((a,b)=>a[1].localeCompare(b[1])); }
function syncCategorySearchInput(selectId){
  const select = document.getElementById(selectId);
  const input = document.getElementById(selectId + '-search');
  if(!select || !input) return;
  input.value = CAT[select.value] || select.value || '';
}
function enhanceCategorySearch(selectId){
  const select = document.getElementById(selectId);
  if(!select) return;
  const field = select.closest('.field') || select.parentElement;
  if(field) field.style.display = 'block';
  select.style.display = 'none';
  let input = document.getElementById(selectId + '-search');
  if(!input){
    input = document.createElement('input');
    input.type = 'search';
    input.id = selectId + '-search';
    input.placeholder = 'Search category';
    input.style.width = '100%';
    select.parentNode.insertBefore(input, select);
  }
  input.removeAttribute('list');
  let host=input.parentElement;
  if(!host.classList.contains('category-combobox')){
    host.classList.add('category-combobox');
  }
  let suggestions=document.getElementById(selectId+'-category-suggestions');
  if(!suggestions){
    suggestions=document.createElement('div');
    suggestions.id=selectId+'-category-suggestions';
    suggestions.className='category-suggestions';
    suggestions.hidden=true;
    input.insertAdjacentElement('afterend',suggestions);
  }
  input.oninput=()=>renderCategorySuggestions(selectId,input.value);
  input.onfocus=()=>renderCategorySuggestions(selectId,input.value);
  input.onkeydown=event=>handleCategorySearchKeydown(event,selectId);
  input.onblur=()=>setTimeout(()=>{const menu=document.getElementById(selectId+'-category-suggestions');if(menu)menu.hidden=true;},160);
  syncCategorySearchInput(selectId);
}
function setCategoryFromSearch(selectId, value, allowCreate = false){
  const select = document.getElementById(selectId);
  if(!select) return false;
  const raw = String(value || '').trim();
  const match = getCategorySearchOptions().find(([k,v]) => canonicalGroupKey(v) === canonicalGroupKey(raw) || canonicalGroupKey(k) === canonicalGroupKey(raw));
  if(match){
    select.value = match[0];
    syncCategorySearchInput(selectId);
    return match[0];
  }
  return false;
}
function renderCategorySuggestions(selectId,query=''){
  const menu=document.getElementById(selectId+'-category-suggestions');
  if(!menu)return;
  const needle=canonicalGroupKey(query);
  const options=getCategorySearchOptions().filter(([key,label])=>!needle||canonicalGroupKey(label).includes(needle)||canonicalGroupKey(key).includes(needle));
  menu.innerHTML=options.length?options.map(([key,label],index)=>`<button type="button" class="category-suggestion${index===0?' active':''}" data-category-key="${ppEscapeAttr(key)}" onmousedown="event.preventDefault()" onclick="chooseCategorySuggestion('${ppEscapeAttr(selectId)}','${ppEscapeAttr(key)}')">${ppEscapeHtml(label)}</button>`).join(''):'<div style="padding:11px 12px;color:var(--text2)">No existing category. Saving will ask before creating it.</div>';
  menu.hidden=false;
}
function chooseCategorySuggestion(selectId,key){
  const select=document.getElementById(selectId);
  if(!select||!CAT[key])return;
  select.value=key;
  syncCategorySearchInput(selectId);
  const menu=document.getElementById(selectId+'-category-suggestions');
  if(menu)menu.hidden=true;
  document.getElementById(selectId+'-search')?.focus();
}
function handleCategorySearchKeydown(event,selectId){
  const menu=document.getElementById(selectId+'-category-suggestions');
  if(!menu||menu.hidden)return;
  const choices=[...menu.querySelectorAll('.category-suggestion')];
  if(!choices.length)return;
  let index=choices.findIndex(choice=>choice.classList.contains('active'));
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();
    choices[index]?.classList.remove('active');
    index=event.key==='ArrowDown'?Math.min(choices.length-1,index+1):Math.max(0,index-1);
    choices[index].classList.add('active');choices[index].scrollIntoView({block:'nearest'});
  }else if (event.key==='Enter') { event.preventDefault();choices[Math.max(0,index)]?.click(); }else if (event.key==='Escape') { event.preventDefault();menu.hidden=true; }
}
function uniqueCategorySlug(label){
  const base=String(label||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'other';
  let slug=base,index=2;
  while(CAT[slug]&&canonicalGroupKey(CAT[slug])!==canonicalGroupKey(label))slug=`${base}-${index++}`;
  return slug;
}
function resolveCategoryBeforeProductSave(selectId,onReady){
  const input=document.getElementById(selectId+'-search');
  const raw=String(input?.value||'').trim();
  const match=setCategoryFromSearch(selectId,raw);
  if (match) { onReady(match);return; }
  if (!raw) { input?.focus();return showPlatePlanToast('Choose a category before saving.','error'); }
  openAppConfirmModal('Create new category?',`No existing category matches <strong>${ppEscapeHtml(raw)}</strong>. Create this category and continue saving the product?`,'Create category',()=>{
    const existing=getCategorySearchOptions().find(([key,label])=>canonicalGroupKey(label)===canonicalGroupKey(raw)||canonicalGroupKey(key)===canonicalGroupKey(raw));
    const slug=existing?.[0]||uniqueCategorySlug(raw);
    if (!existing) { state.customCats[slug]=raw;CAT[slug]=raw; }
    ['mi-cat','pp-cat','tp-cat','mini-cat'].forEach(id=>{const element=document.getElementById(id);if(element)renderCatOptions(id,id===selectId?slug:element.value||'other');});
    chooseCategorySuggestion(selectId,slug);
    onReady(slug);
  },()=>input?.focus());
}
function enhanceAllCategorySearches() { ['mi-cat','pp-cat','tp-cat','mini-cat'].forEach(enhanceCategorySearch); }
function hideLegacyCategoryAndMeatFields(){
  enhanceAllCategorySearches();
  ['mi-meatsub','tp-meatsub','pp-meatsub'].forEach(id => {
    const el = document.getElementById(id);
    const field = el?.closest('.field') || el?.parentElement;
    if(field) field.style.display = 'none';
  });
}
function getPlatePlanBackupPayload(){
  return {
    exportedAt: new Date().toISOString(),
    app: 'PlatePlan',
    version: PLATEPLAN_APP_VERSION,
    schemaVersion: PLATEPLAN_SCHEMA_VERSION,
    state
  };
}
function downloadPlatePlanBlob(filename, content, type){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function getSearchVariants(str) { return window.RecipeAuthoringService?.getSearchVariants(str) || (str ? [str.toLowerCase().trim()] : []); }
function toGrams(qty, unit, itemWeight = 100) { return window.UnitConverter?.toGrams(qty, unit, itemWeight) ?? Math.round(qty * itemWeight); }
function isLikelyLiquidIngredientName(name) { return window.UnitConverter?.isLikelyLiquidIngredientName(name) ?? false; }
function isLikelyCountableIngredientName(name) { return window.UnitConverter?.isLikelyCountableIngredientName(name) ?? false; }
function shouldClearAutoItemWeight(ing){
  if(!ing || isLikelyCountableIngredientName(ing.name)) return false;
  const weight = +ing.itemWeight || 0;
  if(!weight) return false;
  const packSize = +ing.drainedWeight || +ing.packSize || 0;
  const itemCount = +ing.itemCount || 0;
  if(itemCount > 1) return false;
  return weight === 100 || itemCount === 1 || (packSize > 0 && Math.abs(weight - packSize) < 0.01);
}
function inferParsedUnitForIngredient(ing) { return window.UnitConverter?.inferParsedUnitForIngredient(ing) ?? (ing?.unit || 'g'); }
function normaliseRecipeAmountForUi(ing = {}){
  return window.UnitConverter?.normaliseRecipeAmountForUi(ing) ?? { qty: parseFloat(ing?.qty) || 1, unit: ing?.unit || 'g' };
}
function normaliseUnicodeFractions(text) { return window.UnitConverter?.normaliseUnicodeFractions(text) ?? String(text || ''); }
function parseRecipeNumber(value) { return window.UnitConverter?.parseRecipeNumber(value) ?? parseFloat(value); }
function normaliseLeadingQuantity(raw) { return window.UnitConverter?.normaliseLeadingQuantity(raw) ?? String(raw || ''); }
function cleanIngredientLinePrefix(raw) { return window.UnitConverter?.cleanIngredientLinePrefix(raw) ?? String(raw || '').trim(); }
function splitPastedIngredientText(text) { return window.UnitConverter?.splitPastedIngredientText(text) ?? String(text || '').split('\n').filter(Boolean); }
function getIngredientSectionHeading(line){
  const cleaned = cleanIngredientLinePrefix(line || '').replace(/\s+/g, ' ').trim();
  if(!cleaned) return '';
  const noColon = cleaned.replace(/[:：]\s*$/, '').trim();
  if(!noColon) return '';
  if(/^(?:for|to serve|for serving)\b/i.test(noColon) && noColon.length <= 60) return toTitleCase(noColon);
  const hasQty = /^(?:\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+|[½⅓⅔¼¾⅛⅜⅝⅞])\s*(?:g|kg|ml|l|tsp|tbsp|cup|tin|tins|can|cans|clove|cloves|bulb|bulbs|head|heads|handful|handfuls|bunch|bunches|pinch|dash|slice|slices|piece|pieces|stalk|stalks|sprig|sprigs|leaf|leaves|x\b|×\b|qty\b|each\b)/i.test(noColon);
  const looksLikeHeading = /[:：]\s*$/.test(cleaned) && !hasQty && noColon.split(/\s+/).length <= 7;
  return looksLikeHeading ? toTitleCase(noColon) : '';
}
function splitPastedIngredientSections(text){
  const rows = splitPastedIngredientText(text);
  const out = [];
  let section = '';
  rows.forEach(row => {
    const heading = getIngredientSectionHeading(row);
    if(heading){
      section = heading;
      return;
    }
    out.push({ line: row, section });
  });
  return out;
}
function splitPastedMethodText(text){
  let normalised = String(text || '')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/([0-9#*]\ufe0f?\u20e3|[①②③④⑤⑥⑦⑧⑨⑩])\s*/gu, '\n$1 ')
    .replace(/\s+(?=(?:Step\s+)?\d+[\.)]\s+[A-Z])/g, '\n');
  return normalised.split(/\n+/).map(l => cleanIngredientLinePrefix(l).trim()).filter(Boolean);
}
function escapeRegex(string){
  return String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function ppEscapeRegex(string) { return escapeRegex(string); }
function convertMethodQuantitiesToPercentages(steps, parsedIngs = []){
  if(!Array.isArray(steps)) return [];
  try {
    const ings = (parsedIngs || []).map(ing => {
      const rawName = (ing.name || ing.raw || '').toLowerCase().trim();
      const baseName = rawName.replace(/\b(diced|chopped|sliced|grated|minced|crushed|peeled|firm|extra firm|fresh|dried|tinned|canned|organic|ground|whole|half|halved)\b/g, '').replace(/\s+/g, ' ').trim();
      const grams = +ing.grams || (['g','ml'].includes(ing.unit) ? +ing.qty : 0);
      const qty = +ing.qty || 0;
      const unit = ing.unit || 'g';
      return {
        raw: ing.raw,
        name: ing.name,
        rawName,
        baseName,
        grams,
        qty,
        unit
      };
    }).filter(i => i.name && (i.grams > 0 || i.qty > 0));
    return steps.map(step => {
      let text = String(step || '');
      ings.forEach(ing => {
        const base = ing.baseName || ing.rawName;
        const singular = base.replace(/s$/, '');
        const plural = base.endsWith('s') ? base : base + 's';
        const searchTerms = [...new Set([ing.rawName, (ing.name || '').toLowerCase(), base, singular, plural])]
          .filter(t => t && t.length >= 3);
        if(!searchTerms.length) return;
        const termPattern = searchTerms.map(escapeRegex).join('|');
        const unitOptions = 'g|kg|ml|l|tbsp|tablespoons?|tsp|teaspoons?|cups?|tins?|cans?|cloves?|slices?|pieces?|oz|ounces?|lbs?|pounds?|fl\\.?\\s*oz\\.?';
        const qtyPattern = new RegExp(`(?<!\\b(?:at|to|heat to|gas mark|for|in|about)\\s+)(?:(\\d+(?:\\.\\d+)?)\\s*(${unitOptions})?\\s+(?:of\\s+)?(?:the\\s+)?(${termPattern}))`, 'gi');
        text = text.replace(qtyPattern, (match, amountStr, unitStr, ingMention) => {
          const amount = parseFloat(amountStr);
          if(isNaN(amount) || amount <= 0) return match;
          let amountInGrams = amount;
          const u = (unitStr || '').toLowerCase().replace(/s$/, '');
          if(u === 'kg') amountInGrams = amount * 1000;
          else if(u === 'l') amountInGrams = amount * 1000;
          else if(u === 'tbsp' || u === 'tablespoon') amountInGrams = amount * 15;
          else if(u === 'tsp' || u === 'teaspoon') amountInGrams = amount * 5;
          else if(u === 'oz' || u === 'ounce') amountInGrams = amount * 28.35;
          else if(u === 'lb' || u === 'pound') amountInGrams = amount * 453.6;
          else if(u === 'cup') amountInGrams = amount * 240;
          else if(u === 'fl oz' || u === 'floz' || u === 'fl. oz') amountInGrams = amount * 30;
          const totalGrams = ing.grams || toGrams(ing.qty, ing.unit);
          if(totalGrams > 0 && amountInGrams > 0 && unitStr){
            const ratio = amountInGrams / totalGrams;
            let pct = Math.round(ratio * 100);
            if(pct > 100) pct = 100;
            if(pct < 1) pct = 1;
            return `${pct}% of the ${ingMention}`;
          } else if(ing.qty > 0){
            const ratio = amount / ing.qty;
            let pct = Math.round(ratio * 100);
            if(pct > 100) pct = 100;
            if(pct < 1) pct = 1;
            return `${pct}% of the ${ingMention}`;
          }
          return match;
        });
      });
      return text;
    });
  } catch(e) {
    console.warn('Error converting method quantities to percentages:', e);
    return steps;
  }
}
function detectStockIngredient(raw){
  const text = String(raw || '').toLowerCase();
  if(!/\bstock\b/.test(text) || !/\b(vegetable|veg|chicken|beef|stock)\b/.test(text)) return null;
  const waterMatch = text.match(/(\d+(?:\.\d+)?)\s*(ml|l)\s+(?:of\s+)?(?:vegetable\s+|veg\s+|chicken\s+|beef\s+)?stock\b/) || text.match(/\b(?:stock|water)\b.*?(\d+(?:\.\d+)?)\s*(ml|l)\b/);
  const cubeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:stock\s*)?(cube|cubes|pot|pots)\b/) || text.match(/\bwith\s+(\d+(?:\.\d+)?)\s*(?:cube|cubes|pot|pots)\b/);
  const waterMl = waterMatch ? Math.round(parseFloat(waterMatch[1]) * (waterMatch[2] === 'l' ? 1000 : 1)) : null;
  const cubeQty = cubeMatch ? parseFloat(cubeMatch[1]) : (waterMl ? Math.max(1, Math.round((waterMl / 500) * 10) / 10) : null);
  if(!waterMl && !cubeQty) return null;
  const stockType = /\bbeef\b/.test(text) ? 'Beef Stock Cubes' : /\bchicken\b/.test(text) ? 'Chicken Stock Cubes' : 'Vegetable Stock Cubes';
  return {
    raw: cleanIngredientLinePrefix(raw),
    qty: cubeQty || 1,
    unit: 'qty',
    name: stockType,
    grams: toGrams(cubeQty || 1, 'qty'),
    isStock: true,
    stockWaterMl: waterMl || '',
    stockDisplayName: stockType
  };
}
function parseIngredientLine(raw){
  const cleaned = cleanIngredientLinePrefix(raw).replace(/^\xad\s*/, '').trim(); 
  if(!cleaned) return null;
  const stock = detectStockIngredient(cleaned);
  if(stock) return stock;
  if (window.UnitConverter?.parseIngredientLine) { return window.UnitConverter.parseIngredientLine(raw); }
  return { raw, qty: 1, unit: 'qty', name: toTitleCase(cleaned), grams: 100 };
}
function fuzzyMatchBank(name) { return window.RecipeAuthoringService?.fuzzyMatchBank(name, state?.ingredients) ?? null; }
function fuzzyMatchIngredientGroup(name) { return window.RecipeAuthoringService?.fuzzyMatchIngredientGroup(name, state?.ingredientGroups) ?? null; }
function ppEscapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function ppEscapeAttr(value) { return ppEscapeHtml(value).replace(/`/g, '&#96;'); }
const PRODUCT_PRIORITY_LABELS = {
  protein: 'Highest protein',
  low_kcal: 'Lowest kcal',
  protein_per_kcal: 'Protein per kcal',
  protein_per_pound: 'Protein per £',
  value: 'Protein per £',
  lowest_cost: 'Lowest total cost',
  cost_per_100: 'Lowest cost per 100g/ml'
};
function normalisePackMeasure(value,unit,itemAmount=0){
  const amount=+value||0;
  const key=String(unit||'g').toLowerCase();
  if(!amount)return 0;
  if(key==='g'||key==='ml')return amount;
  if(key==='kg'||key==='l')return amount*1000;
  if(key==='qty')return itemAmount>0?amount*itemAmount:0;
  return toGrams(amount,key,itemAmount||100);
}
function getProductItemAmount(product){
  if(!product)return 0;
  return normalisePackMeasure(product.itemWeight,product.itemWeightUnit||'g');
}
function getProductGrossPackAmount(product){
  if(!product)return 0;
  const itemAmount=getProductItemAmount(product);
  return normalisePackMeasure(product.packSize,product.packUnit||'g',itemAmount);
}
function getProductUsablePackAmount(product){
  if(!product)return 0;
  const itemAmount=getProductItemAmount(product);
  const drained=normalisePackMeasure(product.drainedWeight,product.drainedWeightUnit||product.packUnit||'g',itemAmount);
  return drained>0?drained:getProductGrossPackAmount(product);
}
function getProductDerivedItemCount(product){
  const usable=getProductUsablePackAmount(product);
  const item=getProductItemAmount(product);
  return usable>0&&item>0?usable/item:0;
}
function productPackGrams(product) { return getProductUsablePackAmount(product); }
function normaliseLegacyCountedPackOnSave(product){
  if(!product||String(product.packUnit||'').toLowerCase()!=='qty')return product;
  const count=+product.packSize||+product.itemCount||0;
  const item=getProductItemAmount(product);
  if(count>0&&item>0){
    product.legacyItemCount=count;
    product.itemCount=count;
    product.packSize=Math.round(count*item*1000)/1000;
    product.packUnit=String(product.itemWeightUnit||'g').toLowerCase()==='ml'?'ml':'g';
  }
  return product;
}
function formatProductPackSummary(product){
  if(!product)return '';
  const gross=getProductGrossPackAmount(product);
  const usable=getProductUsablePackAmount(product);
  const item=getProductItemAmount(product);
  const count=getProductDerivedItemCount(product);
  const unit=(product.drainedWeight?product.drainedWeightUnit:product.packUnit)==='ml'?'ml':'g';
  if(!gross&&!usable)return 'Add a total pack size to calculate purchasing and cost.';
  const grossLabel=`${round1(gross)}${unit} pack`;
  const usableLabel=+product.drainedWeight>0?` · ${round1(usable)}${unit} drained`:'';
  const itemLabel=item>0?` ÷ ${round1(item)}${unit} each = ${round1(count)} usable item${Math.abs(count-1)<0.001?'':'s'}`:'';
  return grossLabel+usableLabel+itemLabel;
}
function isUsableProduct(product) { return !!(product && hasUsableIngredientNutrition(product)); }
function canonicalGroupNameFromProduct(product){
  let name = (product?.name || 'Ingredient').replace(/\([^)]*\)/g,' ');
  name = name.replace(/\b\d+\s*[x×]\s*\d+(?:\.\d+)?\s*(g|kg|ml|l)\b/ig,' ');
  name = name.replace(/\b\d+(?:\.\d+)?\s*(g|kg|ml|l)\b/ig,' ');
  name = name.replace(/\b\d+\s*(pack|packs|rolls?|burgers?|sausages?|bangers?|pieces?|slices?|tins?|cans?)\b/ig,' ');
  name = name.replace(/\b(tesco|plant chef|finest|hearty food co|the tofoo co|cauldron|yutaka)\b/ig,' ');
  name = name.replace(/\b(loose|each|pack|organic)\b/ig,' ');
  name = name.replace(/\s+/g,' ').trim();
  return toTitleCase(name || product?.name || 'Ingredient');
}
function canonicalGroupKey(name) { return window.RecipeAuthoringService?.canonicalGroupKey(name) ?? String(name || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
function normaliseAliasText(alias) { return window.RecipeAuthoringService?.normaliseAliasText(alias) ?? String(alias || '').replace(/\s+/g,' ').trim(); }
function addIngredientGroupAlias(group, alias) { return window.RecipeAuthoringService?.addIngredientGroupAlias(group, alias) ?? false; }
function addIngredientFamilyAlias(family, alias) { return window.RecipeAuthoringService?.addIngredientFamilyAlias(family, alias) ?? false; }
function syncIngredientGroupAliases(group, products = []){
  if (window.RecipeAuthoringService?.syncIngredientGroupAliases) { return window.RecipeAuthoringService.syncIngredientGroupAliases(group, products); }
}
function inferIngredientFamilyFromText(text){
  const t = canonicalGroupKey(text);
  if(!t) return '';
  const specificIngredients = [
    ['Sweet potato', ['sweet potato','sweet potatoes']],
    ['Black beans', ['black bean','black beans']],
    ['Kidney beans', ['kidney bean','kidney beans']],
    ['Butter beans', ['butter bean','butter beans']],
    ['Chickpeas', ['chickpea','chickpeas']],
    ['Asparagus', ['asparagus']],
    ['Garlic', ['garlic']],
    ['Onion', ['onion','onions','red onion','brown onion']],
    ['Potato', ['potato','potatoes']],
    ['Pepper', ['bell pepper','red pepper','green pepper','yellow pepper']],
    ['Broccoli', ['broccoli','tenderstem']],
    ['Spinach', ['spinach']],
    ['Cabbage', ['cabbage']],
    ['Carrot', ['carrot','carrots']],
    ['Tomato', ['tomato','tomatoes']],
    ['Avocado', ['avocado']],
    ['Aubergine', ['aubergine','eggplant']],
    ['Courgette', ['courgette','zucchini']],
    ['Cucumber', ['cucumber']],
    ['Lettuce', ['lettuce','baby gem']],
    ['Mushroom', ['mushroom','mushrooms']],
    ['Tofu', ['tofu']],
    ['Tempeh', ['tempeh']],
    ['Beef mince', ['beef mince']],
    ['Mince', ['mince']],
    ['Sausages', ['sausage','sausages']],
    ['Burgers', ['burger','burgers']]
  ];
  const specific = specificIngredients.find(row => row[1].some(word => t.includes(canonicalGroupKey(word))));
  if(specific) return specific[0];
  const rules = [
    { family:'Pasta', words:['pasta','spaghetti','tagliatelle','rigatoni','penne','fusilli','linguine','gnocchi','lasagne','noodle','noodles','soba','ramen'] },
    { family:'Rice and grains', words:['rice','quinoa','couscous','bulgur','barley','grain','grains'] },
    { family:'Beans and pulses', words:['bean','beans','lentil','lentils','chickpea','chickpeas','kidney','butter bean','black bean'] },
    { family:'Tofu and tempeh', words:['tofu','tempeh'] },
    { family:'Oils and vinegars', words:['oil','vinegar'] },
    { family:'Herbs and spices', words:['paprika','cumin','coriander','parsley','basil','oregano','chilli','pepper','salt','spice','spices','seasoning'] },
    { family:'Vegetables', words:['potato','onion','garlic','pepper','broccoli','spinach','cabbage','carrot','tomato','avocado','aubergine','courgette'] },
    { family:'Cheese and dairy', words:['cheese','feta','cream','yoghurt','yogurt','milk'] },
    { family:'Sauces and pastes', words:['sauce','paste','pesto','miso','gochujang','tahini','puree','purée','chutney'] },
    { family:'Meat substitutes', words:['burger','burgers','sausage','sausages','banger','bangers','mince','fillet','fillets','pieces','meatball','meatballs','quorn','plant chef'] }
  ];
  const found = rules.find(rule => rule.words.some(word => t.includes(canonicalGroupKey(word))));
  return found ? found.family : '';
}
function shouldRefreshBroadIngredientName(group){
  const current = normaliseAliasText(group?.family || '');
  if(!current) return true;
  const broad = new Set([
    'Vegetables','Fruit','Meat substitutes','Herbs and spices','Cheese and dairy',
    'Beans and pulses','Tofu and tempeh'
  ].map(canonicalGroupKey));
  const catLabel = CAT[group?.cat] || group?.cat || '';
  return canonicalGroupKey(current) === canonicalGroupKey(catLabel) || broad.has(canonicalGroupKey(current));
}
function refreshGroupIngredientNameIfBroad(group){
  if(!group || !shouldRefreshBroadIngredientName(group)) return;
  const inferred = inferIngredientFamilyFromText(group.name || '');
  if(inferred && canonicalGroupKey(inferred) !== canonicalGroupKey(group.family)) group.family = inferred;
}
function ingredientFamilyIdFromName(name, cat = 'other'){
  const key = canonicalGroupKey(name || 'Ingredient') || 'ingredient';
  const catKey = canonicalGroupKey(cat || 'other') || 'other';
  return 'fam_' + catKey + '_' + key;
}
function getIngredientFamily(familyId){
  if(!familyId) return null;
  return platePlanIndexes.families.get(familyId) || (state?.ingredientFamilies || []).find(f => f.id === familyId) || null;
}
function getGroupIngredientFamily(group, targetState = state){
  if(!group) return null;
  const list = targetState?.ingredientFamilies || [];
  return list.find(f => f.id === group.ingredientId) || null;
}
function ensureIngredientFamilyForGroup(group, targetState = state){
  if(!group || !targetState) return null;
  if(!Array.isArray(targetState.ingredientFamilies)) targetState.ingredientFamilies = [];
  const ingredientName = normaliseAliasText(group.family || inferIngredientFamilyFromText(group.name || '') || group.name || 'Ingredient');
  const cat = group.cat || 'other';
  let family = group.ingredientId ? targetState.ingredientFamilies.find(f => f.id === group.ingredientId) : null;
  if(family && ingredientName && canonicalGroupKey(family.name) !== canonicalGroupKey(ingredientName)){
    family.typeIds = (family.typeIds || []).filter(id => id !== group.id);
    group.ingredientId = "";
    family = null;
  }
  if(!family){
    const id = ingredientFamilyIdFromName(ingredientName, cat);
    family = targetState.ingredientFamilies.find(f => f.id === id);
    if(!family){
      family = { id, name: toTitleCase(ingredientName), cat, aliases: [], notes: '', typeIds: [], defaultTypeId: group.id };
      targetState.ingredientFamilies.push(family);
    }
    group.ingredientId = family.id;
  }
  if(!family.name) family.name = toTitleCase(ingredientName);
  if(!family.cat) family.cat = cat;
  if(!Array.isArray(family.aliases)) family.aliases = [];
  if(!Array.isArray(family.typeIds)) family.typeIds = [];
  if(!family.typeIds.includes(group.id)) family.typeIds.push(group.id);
  if(!family.defaultTypeId || !targetState.ingredientGroups.some(g => g.id === family.defaultTypeId)) family.defaultTypeId = group.id;
  group.family = family.name;
  group.cat = family.cat || group.cat || 'other';
  if(!family.aliases.some(a => canonicalGroupKey(a) === canonicalGroupKey(family.name))) family.aliases.push(family.name);
  return family;
}
function ensureIngredientFamilies(targetState = state){
  if(!targetState) return;
  if(!Array.isArray(targetState.ingredientGroups)) targetState.ingredientGroups = [];
  if(!Array.isArray(targetState.ingredientFamilies)) targetState.ingredientFamilies = [];
  targetState.ingredientGroups.forEach(group => ensureIngredientFamilyForGroup(group, targetState));
  targetState.ingredientFamilies.forEach(family => {
    family.typeIds = [...new Set((family.typeIds || []).filter(id => targetState.ingredientGroups.some(g => g.id === id)))];
    const types = targetState.ingredientGroups.filter(g => g.ingredientId === family.id || family.typeIds.includes(g.id));
    types.forEach(g => {
      g.ingredientId = family.id;
      g.family = family.name;
      g.cat = family.cat || g.cat || 'other';
      if(!family.typeIds.includes(g.id)) family.typeIds.push(g.id);
    });
    if(!family.defaultTypeId || !types.some(g => g.id === family.defaultTypeId)) family.defaultTypeId = types[0]?.id || '';
    family.aliases = (family.aliases || []).map(normaliseAliasText).filter(Boolean);
    if(family.name && !family.aliases.some(a => canonicalGroupKey(a) === canonicalGroupKey(family.name))) family.aliases.unshift(family.name);
  });
  targetState.ingredientFamilies = targetState.ingredientFamilies.filter(f => {
    if(!f) return false;
    if((f.typeIds || []).length > 0) return true;
    return Boolean(f.id && f.name && f.name !== 'Ingredient');
  });
}
function getKnownFamilies(){
  ensureIngredientFamilies();
  const fams = new Set();
  (state.ingredientFamilies || []).forEach(f => {
    const name = normaliseAliasText(f.name || '');
    if(name) fams.add(name);
  });
  ['Pasta','Rice and grains','Beans and pulses','Tofu and tempeh','Oils and vinegars','Herbs and spices','Vegetables','Cheese and dairy','Sauces and pastes','Meat substitutes'].forEach(f => fams.add(f));
  return [...fams].sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'}));
}
function getProductFamily(product){
  const group = getIngredientGroup(product?.groupId);
  const family = getGroupIngredientFamily(group);
  return normaliseAliasText(family?.name || group?.family || inferIngredientFamilyFromText((group?.name || '') + ' ' + (product?.name || ''))) || 'No ingredient';
}
function getGroupCategoryLabel(group) { return ppEscapeHtml(CAT[group?.cat] || group?.cat || 'Other'); }
function getGroupIngredientName(group){
  const family = getGroupIngredientFamily(group);
  return normaliseAliasText(family?.name || group?.family || inferIngredientFamilyFromText(group?.name || '')) || 'No ingredient';
}
function getGroupTypeName(group) { return normaliseAliasText(group?.name || '') || 'Unnamed sub-type'; }
function groupIsHiddenDefaultType(group){
  if(!group) return false;
  const familyName = getGroupIngredientName(group);
  const family = getGroupIngredientFamily(group);
  const siblings = family ? (family.typeIds || []).filter(id => getIngredientGroup(id)).length : (state.ingredientGroups || []).filter(g => canonicalGroupKey(getGroupIngredientName(g)) === canonicalGroupKey(familyName)).length;
  return siblings <= 1 && canonicalGroupKey(group.name) === canonicalGroupKey(familyName);
}
function getGroupDisplayName(group) { return groupIsHiddenDefaultType(group) ? getGroupIngredientName(group) : getGroupTypeName(group); }
function getGroupHierarchyText(group){
  const typeName = groupIsHiddenDefaultType(group) ? '' : ` > ${getGroupTypeName(group)}`;
  return `${CAT[group?.cat] || group?.cat || 'Other'} > ${getGroupIngredientName(group)}${typeName}`;
}
function getGroupCategoryOptionsHtml(selected = 'other'){
  const selectedKey=String(selected||'other');
  const entries=Object.entries(CAT)
    .filter(([key,label])=>key&&typeof label==='string'&&label.trim())
    .map(([key,label])=>[String(key),label.trim()]);
  if(selectedKey&&!entries.some(([key])=>key===selectedKey)){
    const fallbackLabel=selectedKey.split(/[-_]+/).filter(Boolean).map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' ')||'Other';
    entries.push([selectedKey,fallbackLabel]);
  }
  return entries
    .sort((a,b)=>String(a[1]).localeCompare(String(b[1]),'en',{sensitivity:'base'}))
    .map(([key,label]) => `<option value="${ppEscapeAttr(key)}"${key===selectedKey?' selected':''}>${ppEscapeHtml(label)}</option>`)
    .join('');
}
function familyKey(family){
  const key = canonicalGroupKey(family || 'No ingredient');
  if(key === 'no family') return 'no-ingredient';
  return key || 'no-ingredient';
}
function getMealTypeFromSlotKey(slotKey){
  const s = String(slotKey || '').toLowerCase();
  if(s.includes('breakfast')) return 'breakfast';
  if(s.includes('lunch')) return 'lunch';
  if(s.includes('snack')) return 'snack';
  if(s.includes('dinner')) return 'dinner';
  return '';
}
function findSlotKeyForInstance(instanceId){
  if(!instanceId || !state.plan?.slots) return '';
  for(const day of Object.values(state.plan.slots || {})){
    for(const [slotKey, slot] of Object.entries(day || {})){
      if(slot && typeof slot === 'object' && slot.instanceId === instanceId) return slotKey;
    }
  }
  return '';
}
function getContextMealType(recipe = null, instanceId = null, fallback = 'dinner'){
  const slotMeal = getMealTypeFromSlotKey(findSlotKeyForInstance(instanceId));
  if(slotMeal) return slotMeal;
  const checked = typeof getMealTypes === 'function' ? getMealTypes() : [];
  if(recipe === 'form' && checked.length) return checked[0];
  if(recipe === 'review' && Array.isArray(currentReviewMealTypes) && currentReviewMealTypes.length) return currentReviewMealTypes[0];
  const types = recipe?.types || (recipe?.type ? [recipe.type] : []);
  return types[0] || fallback || 'dinner';
}
function getReviewMealTypesFallback(){
  if(Array.isArray(currentReviewMealTypes) && currentReviewMealTypes.length) return currentReviewMealTypes;
  const checked = typeof getMealTypes === 'function' ? getMealTypes() : [];
  return checked.length ? checked : ['dinner'];
}
function getReviewWhoFallback(){
  if(currentReviewWho) return currentReviewWho;
  return document.getElementById('r-who') ? document.getElementById('r-who').value : 'both';
}
function getReviewServesFallback(){
  if(+currentReviewServes > 0) return +currentReviewServes;
  return parseFloat(document.getElementById('r-serves')?.value) || 2;
}
function formatPackDisplay(size, unit, itemWeight){
  const n = +size || 0;
  const iw = +itemWeight || 0;
  if(!n) return '';
  if(unit === 'qty') {
    const total = iw ? n * iw : 0;
    return iw ? `${n} items × ${iw}g = ${Math.round(total * 10) / 10}g` : `${n} items`;
  }
  return `${n}${unit || 'g'}`;
}
function readPackModelFromEditor(prefix){
  return {
    packSize:+document.getElementById(prefix+'-pack')?.value||0,
    packUnit:document.getElementById(prefix+'-pack-unit')?.value||'g',
    itemWeight:+document.getElementById(prefix+'-item-weight')?.value||0,
    itemWeightUnit:document.getElementById(prefix+'-item-weight-unit')?.value||'g',
    drainedWeight:+document.getElementById(prefix+'-drained-weight')?.value||0,
    drainedWeightUnit:document.getElementById(prefix+'-drained-weight-unit')?.value||'g'
  };
}
function updatePackModelSummary(prefix) { const host=document.getElementById(prefix+'-pack-summary');if(host)host.textContent=formatProductPackSummary(readPackModelFromEditor(prefix)); }
function installPackModelSummaryListeners(){
  ['mi','tp'].forEach(prefix=>['pack','pack-unit','item-weight','item-weight-unit','drained-weight','drained-weight-unit'].forEach(suffix=>{
    const field=document.getElementById(`${prefix}-${suffix}`);if (field&&!field.dataset.packSummaryBound) { field.dataset.packSummaryBound='1';field.addEventListener('input',()=>updatePackModelSummary(prefix));field.addEventListener('change',()=>updatePackModelSummary(prefix)); }
  }));
}
function setPackUnitEditorValue(selectId,value,{allowLegacyCount=false}={}){
  const select=document.getElementById(selectId);if(!select)return;
  let legacy=[...select.options].find(option=>option.value==='qty');
  if (allowLegacyCount&&!legacy) { legacy=document.createElement('option');legacy.value='qty';legacy.textContent='items (legacy — add item weight)';select.appendChild(legacy); }
  if(!allowLegacyCount&&legacy)legacy.remove();
  select.value=allowLegacyCount&&value==='qty'?'qty':(['g','ml'].includes(value)?value:'g');
}
function getProductProteinPer100Kcal(product){
  const cal = +product?.cal || 0;
  const prot = +product?.prot || 0;
  return cal > 0 ? (prot / cal) * 100 : 0;
}
function getProductProteinPerPound(product){
  const packGrams = productPackGrams(product);
  const price = +product?.price || 0;
  const prot = +product?.prot || 0;
  return price > 0 && packGrams > 0 ? (prot * packGrams / 100) / price : 0;
}
function getProductCostPerGram(product){
  const packGrams = productPackGrams(product);
  const price = +product?.price || 0;
  return (price > 0 && packGrams > 0) ? (price / packGrams) : Infinity;
}
function getProductCostPerUnit(product){
  const price = +product?.price || 0;
  if (price <= 0) return Infinity;
  const count = +product?.itemCount || (product?.packUnit === 'qty' ? +product?.packSize : 0) || 0;
  if (count > 0) return price / count;
  const packGrams = productPackGrams(product);
  if (packGrams > 0) return (price / packGrams) * 100;
  return price;
}
function getAutoMappingStrategy() { return state?.prefs?.autoMappingStrategy || 'protein_per_kcal'; }
function scoreProductByPriority(product, priority = 'protein_per_kcal'){
  const packGrams = productPackGrams(product);
  const price = +product?.price || 0;
  if(priority === 'low_kcal') return -(+product?.cal || 0);
  if(priority === 'protein_per_kcal' || priority === 'prot_kcal' || priority === 'protein') return getProductProteinPer100Kcal(product);
  if(priority === 'least_protein_per_kcal') return -getProductProteinPer100Kcal(product);
  if(priority === 'protein_per_pound' || priority === 'value') return getProductProteinPerPound(product);
  if (priority === 'lowest_cost_per_g' || priority === 'cost_per_g' || priority === 'cost_per_100') { return (price > 0 && packGrams > 0) ? -(price / packGrams) : -999999; }
  if(priority === 'lowest_cost_per_unit' || priority === 'cost_per_unit') {
    const cost = getProductCostPerUnit(product);
    return isFinite(cost) && cost > 0 ? -cost : -999999;
  }
  if(priority === 'lowest_cost') return price > 0 ? -price : -999999;
  return +product?.prot || 0;
}
function bestDefaultProductIdForGroup(group, targetState = state){
  if(!group || !targetState) return null;
  const ids = new Set(group.productIds || []);
  const products = (targetState.ingredients || [])
    .filter(product => product.groupId === group.id || ids.has(product.id))
    .filter(isUsableProduct);
  if(group.manualDefaultProductId && products.some(product => product.id === group.manualDefaultProductId)) return group.manualDefaultProductId;
  if(!products.length) return (group.productIds || [])[0] || null;
  const strategy = (targetState?.prefs?.autoMappingStrategy) || getAutoMappingStrategy();
  return products
    .slice()
    .sort((a,b) =>
      scoreProductByPriority(b, strategy) - scoreProductByPriority(a, strategy) ||
      getProductProteinPer100Kcal(b) - getProductProteinPer100Kcal(a) ||
      (+b.prot || 0) - (+a.prot || 0) ||
      (a.name || '').localeCompare(b.name || '')
    )[0].id;
}
function refreshAutoDefaultProductForGroup(groupId){
  const group = getIngredientGroup(groupId);
  if(!group) return null;
  group.defaultProductId = bestDefaultProductIdForGroup(group, state);
  return group.defaultProductId;
}
function refreshAllAutoDefaultProducts(targetState = state){
  const changed = [];
  (targetState.ingredientGroups || []).forEach(group => {
    const before = group.defaultProductId || '';
    const next = bestDefaultProductIdForGroup(group, targetState) || '';
    group.defaultProductId = next;
    if(before !== next) changed.push({ groupId: group.id, before, after: next });
  });
  return changed;
}
function groupIdForProduct(product) { return product?.groupId || (product?.id ? 'grp_' + product.id : ''); }
function getIngredientGroup(groupId){
  if(!groupId) return null;
  return platePlanIndexes.groups.get(groupId) || (state?.ingredientGroups || []).find(g => g.id === groupId) || null;
}
function getProduct(productId){
  if(!productId) return null;
  return platePlanIndexes.products.get(productId) || (state?.ingredients || []).find(i => i.id === productId) || null;
}
function getRecipe(recipeId){
  if(!recipeId) return null;
  return platePlanIndexes.recipes?.get(recipeId) || (state?.recipes || []).find(r => r.id === recipeId) || null;
}
globalThis.getRecipe = getRecipe;
function getGroupProducts(groupId){
  const group = getIngredientGroup(groupId);
  const ids = new Set(group?.productIds || []);
  return (state.ingredients || []).filter(p => p.groupId === groupId || ids.has(p.id));
}
function syncProductHierarchyCategory(product, group = null, preferredCat = ''){
  if(!product) return;
  group = group || (product.groupId ? getIngredientGroup(product.groupId) : null);
  const family = group ? getGroupIngredientFamily(group) : null;
  const chosen = preferredCat || product.cat || group?.cat || family?.cat || 'other';
  const established = [family?.cat, group?.cat].find(cat => cat && cat !== 'other');
  const finalCat = established || chosen || 'other';
  const nowIso = new Date().toISOString();
  if(finalCat && product.cat !== finalCat){
    product.cat = finalCat;
    product.updatedAt = nowIso;
  }
  if(group){
    let groupChanged = false;
    if(!group.cat || group.cat === 'other' || (preferredCat && preferredCat !== 'other' && !established)){
      if (group.cat !== finalCat) { group.cat = finalCat; groupChanged = true; }
    }
    if(family && (!family.cat || family.cat === 'other' || (preferredCat && preferredCat !== 'other' && !established))){
      if (family.cat !== finalCat) { family.cat = finalCat; family.updatedAt = nowIso; }
    }
    if(groupChanged) group.updatedAt = nowIso;
    getGroupProducts(group.id).forEach(p => {
      if(p && p.cat !== (group.cat || finalCat)){
        p.cat = group.cat || finalCat;
        p.updatedAt = nowIso;
      }
    });
  }
}
function makeIngredientGroupFromProduct(product){
  const id = groupIdForProduct(product);
  const name = canonicalGroupNameFromProduct(product);
  return {
    id,
    name,
    cat: product.cat || 'other',
    family: inferIngredientFamilyFromText(name + ' ' + (product.name || '')),
    aliases: [name, product.name].filter(Boolean),
    defaultProductId: product.id,
    productIds: [product.id],
    notes: '',
    ingredientId: null
  };
}
function ensureProductAssignedToGroup(product, preferredGroupName = '', preferredGroupId = '', allowCreate = false){
  if(!product) return null;
  if(!Array.isArray(state.ingredientGroups)) state.ingredientGroups = [];
  const desiredName = preferredGroupName || canonicalGroupNameFromProduct(product);
  let group = preferredGroupId ? getIngredientGroup(preferredGroupId) : null;
  if(!group && product.groupId) group = getIngredientGroup(product.groupId);
  if(!group && !allowCreate && !preferredGroupId && !product.groupId) return null;
  if(!group){
    const key = canonicalGroupKey(desiredName);
    group = state.ingredientGroups.find(g => canonicalGroupKey(g.name) === key);
  }
  if(!group && !allowCreate) return null;
  const nowIso = new Date().toISOString();
  if(!group){
    group = {
      id: 'grp' + Date.now() + Math.random().toString(36).slice(2,6),
      name: toTitleCase(desiredName || product.name || 'Ingredient'),
      cat: product.cat || 'other',
      family: inferIngredientFamilyFromText(desiredName || product.name || ''),
      aliases: [],
      defaultProductId: product.id,
      productIds: [],
      notes: '',
      ingredientId: null,
      updatedAt: nowIso
    };
    state.ingredientGroups.push(group);
  }
  state.ingredientGroups.forEach(g => {
    if(g.id !== group.id && Array.isArray(g.productIds) && g.productIds.includes(product.id)){
      g.productIds = g.productIds.filter(id => id !== product.id);
      g.updatedAt = nowIso;
    }
  });
  product.groupId = group.id;
  product.subTypeId = group.id;
  product.subType = group.name;
  if(group.ingredientId) product.ingredientId = group.ingredientId;
  else {
    const fam = typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily(group) : null;
    if(fam) product.ingredientId = fam.id;
  }
  product.updatedAt = nowIso;
  group.updatedAt = nowIso;
  if(!Array.isArray(group.productIds)) group.productIds = [];
  if(!group.productIds.includes(product.id)) group.productIds.push(product.id);
  syncIngredientGroupAliases(group, getGroupProducts(group.id));
  addIngredientGroupAlias(group, preferredGroupName);
  if(!group.cat) group.cat = product.cat || 'other';
  if(!group.family) group.family = inferIngredientFamilyFromText(group.name + ' ' + product.name);
  const family = ensureIngredientFamilyForGroup(group, state);
  if(family) family.updatedAt = nowIso;
  ensureIngredientFamilies(state);
  syncProductHierarchyCategory(product, group, product.cat);
  refreshAutoDefaultProductForGroup(group.id);
  return group;
}
function promptGroupForImportedProduct(product, suggestedName = ''){
  if(!product) return null;
  ensureIngredientGroups();
  const defaultName = suggestedName || canonicalGroupNameFromProduct(product);
  saveState();
  setTimeout(() => openProductGroupPickerModal(product.id, defaultName), 0);
  return null;
}
function ensureIngredientGroups(targetState = state){
  if(!targetState) return;
  if(!Array.isArray(targetState.ingredients)) targetState.ingredients = [];
  if(!Array.isArray(targetState.ingredientGroups)) targetState.ingredientGroups = [];
  const groupsById = new Map(targetState.ingredientGroups.map(g => [g.id, g]));
  targetState.ingredients.forEach(product => {
    if(!product.id) product.id = 'ing' + Date.now() + Math.random().toString(36).slice(2,6);
    if(!product.groupId) return;
    if(!groupsById.has(product.groupId)){
      const group = makeIngredientGroupFromProduct(product);
      group.id = product.groupId;
      targetState.ingredientGroups.push(group);
      groupsById.set(group.id, group);
    }
    const group = groupsById.get(product.groupId);
    if(group){
      if(!Array.isArray(group.productIds)) group.productIds = [];
      if(!group.productIds.includes(product.id)) group.productIds.push(product.id);
      if(!group.defaultProductId || !targetState.ingredients.some(p => p.id === group.defaultProductId)) group.defaultProductId = product.id;
      if(!group.cat) group.cat = product.cat || 'other';
      if(!group.family) group.family = inferIngredientFamilyFromText((group.name || '') + ' ' + (product.name || ''));
      refreshGroupIngredientNameIfBroad(group);
      syncIngredientGroupAliases(group, targetState.ingredients.filter(p => p.groupId === group.id || (group.productIds || []).includes(p.id)));
    }
  });
  targetState.ingredientGroups.forEach(group => {
    group.productIds = [...new Set((group.productIds || []).filter(id => targetState.ingredients.some(p => p.id === id)))];
    if(!group.family) group.family = inferIngredientFamilyFromText(group.name || '');
    refreshGroupIngredientNameIfBroad(group);
    syncIngredientGroupAliases(group, targetState.ingredients.filter(p => p.groupId === group.id || group.productIds.includes(p.id)));
  });
  ensureIngredientFamilies(targetState);
  refreshAllAutoDefaultProducts(targetState);
  const attach = ing => {
    if(!ing || typeof ing !== 'object') return;
    if(!ing.groupId && ing.bankId){
      const product = targetState.ingredients.find(p => p.id === ing.bankId);
      if(product?.groupId) ing.groupId = product.groupId;
    }
  };
  (targetState.recipes || []).forEach(r => {
    (r.ingredients || []).forEach(attach);
    if(r.enhanced?.ingredients) r.enhanced.ingredients.forEach(attach);
  });
}
function getRecipeIngredientGroupId(recipeIng){
  if(!recipeIng || typeof recipeIng !== 'object') return '';
  if(recipeIng.groupId) return recipeIng.groupId;
  const product = getProduct(recipeIng.bankId);
  return product?.groupId || '';
}
function selectBestProductForGroup(groupId, priority = null){
  const strat = priority || getAutoMappingStrategy();
  const products = getGroupProducts(groupId).filter(isUsableProduct);
  if(!products.length) return null;
  return products.slice().sort((a,b) =>
    scoreProductByPriority(b, strat) - scoreProductByPriority(a, strat) ||
    getProductProteinPer100Kcal(b) - getProductProteinPer100Kcal(a) ||
    (+b.prot || 0) - (+a.prot || 0) ||
    (a.name || '').localeCompare(b.name || '')
  )[0];
}
function selectBestProductForIngredientFamily(familyId, priority = null){
  const strat = priority || getAutoMappingStrategy();
  const products = getFamilyProducts(familyId).filter(isUsableProduct);
  if(!products.length) return null;
  return products.slice().sort((a,b) =>
    scoreProductByPriority(b, strat) - scoreProductByPriority(a, strat) ||
    getProductProteinPer100Kcal(b) - getProductProteinPer100Kcal(a) ||
    (+b.prot || 0) - (+a.prot || 0) ||
    (a.name || '').localeCompare(b.name || '')
  )[0];
}
function resolveProductForIngredient(recipeIng, context = {}){
  const groupId = getRecipeIngredientGroupId(recipeIng);
  const group = getIngredientGroup(groupId);
  const legacyProduct = getProduct(recipeIng?.bankId);
  const overrides = context.productOverrides || {};
  const legacyOverrides = context.substitutions || {};
  let productId = '';
  if(groupId && overrides[groupId]) productId = overrides[groupId];
  else if(groupId && context.useProductSelections && context.productSelections && context.productSelections[groupId]) productId = context.productSelections[groupId];
  else if(recipeIng?.bankId && legacyOverrides[recipeIng.bankId]) productId = legacyOverrides[recipeIng.bankId];
  else if(group?.defaultProductId) productId = group.defaultProductId;
  else if(recipeIng?.bankId) productId = recipeIng.bankId;
  const product = getProduct(productId) || legacyProduct || null;
  return { product, bankIng: product, group, groupId, productId: product?.id || '' };
}
function getPlanContextForInstance(instanceId, planContext = state.plan, overrideStore = state.overrides){
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
function getPlanOverride(instanceId){
  if(!instanceId) return {};
  if(!state.overrides) state.overrides = {};
  if(!state.overrides[instanceId]) state.overrides[instanceId] = { planMealId: instanceId, substitutions: {}, productOverrides: {}, removeIngredientKeys: {}, ingredientReplacements: {}, mergeInto: {}, ingredientQuantityOverrides:{} };
  const ov = state.overrides[instanceId];
  if(!ov.substitutions) ov.substitutions = {};
  if(!ov.productOverrides) ov.productOverrides = {};
  if(!ov.removeIngredientKeys) ov.removeIngredientKeys = {};
  if(!ov.ingredientReplacements) ov.ingredientReplacements = {};
  if(!ov.mergeInto) ov.mergeInto = {};
  if(!ov.ingredientQuantityOverrides) ov.ingredientQuantityOverrides = {};
  return ov;
}
function getRecipeIngredientKey(ing){
  if(!ing) return '';
  return ing.groupId || ing.bankId || normaliseAliasText(ing.raw || ing.name || '');
}
function isIngredientRemovedInContext(ing, context = {}){
  const key = getRecipeIngredientKey(ing);
  return !!(key && context.removeIngredientKeys && context.removeIngredientKeys[key]);
}
function getReplacementProductForIngredient(ing, context = {}){
  const key = getRecipeIngredientKey(ing);
  return key && context.ingredientReplacements ? getProduct(context.ingredientReplacements[key]) : null;
}
function getMergeTargetForIngredient(ing, context = {}){
  const key = getRecipeIngredientKey(ing);
  return key && context.mergeInto ? context.mergeInto[key] : '';
}
function getAdjustedIngredientForContext(ing, context = {}){
  if(!ing || typeof ing !== 'object') return ing;
  const replacement = getReplacementProductForIngredient(ing, context);
  if(!replacement) return ing;
  const key=getRecipeIngredientKey(ing);
  const quantity=context.ingredientQuantityOverrides?.[key];
  return { ...ing, ...(quantity?{qty:+quantity.qty||0,unit:quantity.unit||ing.unit,raw:''}:{}), bankId: replacement.id, groupId: replacement.groupId || ing.groupId || '', name: replacement.name };
}
function resolveProductForIngredientWithContext(recipeIng, context = {}){
  if(isIngredientRemovedInContext(recipeIng, context)) return { product:null, bankIng:null, group:null, groupId:'', productId:'' };
  const adjusted = getAdjustedIngredientForContext(recipeIng, context);
  return resolveProductForIngredient(adjusted, context);
}
function enhancePlanTrafficControls(){
  const symbols={green:'✓',amber:'–',red:'!'};
  const names={green:'Green recipes',amber:'Amber recipes',red:'Red recipes'};
  document.querySelectorAll('.traffic-pill').forEach(label=>{
    const input=label.querySelector('input');
    if(!input)return;
    const value=['green','amber','red'].find(status=>label.classList.contains(status))
      || (['green','amber','red'].includes(input.value)?input.value:'green');
    input.value=value;
    input.setAttribute('aria-label',names[value]||value);
    input.setAttribute('title',names[value]||value);
    input.tabIndex=-1;
    input.disabled=true;
    input.setAttribute('aria-hidden','true');
    const personPrefix=input.name==='plan-traffic-c'?'c':'e';
    label.setAttribute('role','button');
    label.setAttribute('tabindex','0');
    label.setAttribute('aria-label',`${names[value]||value} for ${personPrefix==='c'?'Chloe':'Elliott'}`);
    label.setAttribute('aria-pressed',input.checked?'true':'false');
    label.onclick=event=>{event.preventDefault();togglePlanTrafficStatus(personPrefix,value);};
    label.onkeydown=event=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      event.preventDefault();
      togglePlanTrafficStatus(personPrefix,value);
    };
    [...label.childNodes].forEach(node=>{
      const isSymbol=node.nodeType===1&&node.classList.contains('traffic-symbol');
      if(node!==input&&!isSymbol)node.remove();
    });
    let symbol=label.querySelector('.traffic-symbol');
    if(!symbol){
      symbol=document.createElement('span');
      symbol.className='traffic-symbol';
      label.appendChild(symbol);
    }
    symbol.setAttribute('aria-hidden','true');
    symbol.textContent=symbols[value];
  });
}
function updatePlannerCompactHeader(){
  const shell=document.getElementById('planner-compact-shell');
  if(!shell||!state)return;
  const hasPlan=!!(state.plan?.slots&&Object.values(state.plan.slots).some(day=>Object.values(day||{}).some(Boolean)));
  const empty=document.getElementById('planner-quick-setup');
  const active=document.getElementById('planner-active-setup');
  if(empty)empty.style.display=hasPlan?'none':'grid';
  if(active)active.style.display=hasPlan?'grid':'none';
  const originalDays=document.getElementById('plan-days');
  const originalStart=document.getElementById('plan-start-date');
  const quickDays=document.getElementById('plan-quick-days');
  const quickStart=document.getElementById('plan-quick-start');
  if(quickDays)quickDays.value=String(hasPlan?(state.plan.days||originalDays?.value||7):(originalDays?.value||7));
  if(quickStart)quickStart.value=hasPlan?(state.plan.dayDates?.[1]||''):(originalStart?.value||'');
  const copy=document.getElementById('planner-active-copy');
  if(copy&&hasPlan){
    const days=state.plan.days||Object.keys(state.plan.slots||{}).length;
    const dateRange=getPlanDateRangeLabel(state.plan);
    copy.textContent=[`${days} day${days===1?'':'s'}`,dateRange].filter(Boolean).join(' · ');
  }
}
function ensurePlannerOptionsUI(){
  if(document.getElementById('planner-wizard-host')) return;
  const planner=document.getElementById('view-planner');
  if(!planner||document.getElementById('planner-compact-shell'))return;
  const legacy=[...planner.children].find(child=>child.querySelector?.('#plan-days'));
  const setup=document.getElementById('plan-setup-card');
  if(!legacy||!setup)return;
  const days=document.getElementById('plan-days');
  const date=document.querySelector('#view-planner .plan-date-control');
  const priority=document.getElementById('plan-product-priority');
  const repeats=['breakfast','lunch','dinner'].map(meal=>document.getElementById(`plan-repeat-${meal}`)?.closest('label')).filter(Boolean);
  const traffic=[...legacy.querySelectorAll('.traffic-picker')];
  const dayOptions=days?[...days.options].map(option=>`<option value="${ppEscapeAttr(option.value)}">${ppEscapeHtml(option.textContent)}</option>`).join(''):'';
  const compact=document.createElement('section');
  compact.id='planner-compact-shell';
  compact.className='planner-compact-shell';
  compact.innerHTML=`<div class="planner-compact-card" id="planner-quick-setup">
      <div class="planner-compact-head"><div><div class="planner-compact-title">Meal planner</div><div class="planner-compact-copy">Choose the essentials, then generate. Detailed choices are in Plan options.</div></div><button class="btn ghost" onclick="openPlanOptionsWorkspace()">Plan options</button></div>
      <div class="planner-quick-fields"><div><label for="plan-quick-days">Length</label><select id="plan-quick-days">${dayOptions}</select></div><div><label for="plan-quick-start">Starts (optional)</label><input id="plan-quick-start" type="date"></div></div>
      <div class="planner-quick-actions"><button class="btn primary" onclick="generatePlanFromQuickSetup()">Generate plan</button></div>
    </div>
    <div class="planner-compact-card" id="planner-active-setup" style="display:none">
      <div class="planner-compact-head"><div><div class="planner-compact-title">Meal planner</div><div class="planner-compact-copy" id="planner-active-copy"></div></div><div class="planner-compact-actions"><button class="btn primary" onclick="openPlanStudio()">Rearrange plan</button><button class="btn ghost" onclick="prioritiseAllPlannedEnhancedRecipes()" title="Upgrade all eligible meals to Enhanced for better fit scores">✨ Prioritise Enhanced</button><button class="btn ghost" onclick="openPlanDatesWorkspace()">Assign dates</button><button class="btn ghost" onclick="openPlanOptionsWorkspace()">Edit plan settings</button></div></div>
    </div>`;
  planner.insertBefore(compact,legacy);
  const wrap=document.createElement('div');
  wrap.id='plan-options-wrap';
  wrap.className='modal-wrap plan-options-wrap';
  wrap.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="plan-options-title">
    <div class="plan-options-appbar row-between" style="align-items:center"><div><h2 id="plan-options-title" style="margin:0">Plan options</h2><div style="font-size:12px;color:var(--text2)">Meal-plan generation settings</div></div><button class="btn ghost" onclick="closePlanOptionsWorkspace()">Close</button></div>
    <div class="plan-options-body">
      <section class="plan-options-section"><h3>Plan details</h3><div class="plan-options-grid" id="plan-options-details"></div></section>
      <section class="plan-options-section"><h3>Recipe selection</h3><div class="plan-options-grid" id="plan-options-selection"></div></section>
      <section class="plan-options-section"><div class="row-between"><div><h3 style="margin:0">Pre-selected recipes</h3><p style="font-size:12px;color:var(--text2);margin:4px 0 0">Pin specific recipes to include before solver fills other meals.</p></div><button class="btn sm ghost" type="button" onclick="clearPinnedRecipes()">Clear</button></div><div id="pinned-recipes-editor"></div></section>
      <section class="plan-options-section"><div class="row-between"><div><h3 style="margin:0">Use up products</h3><p style="font-size:12px;color:var(--text2);margin:4px 0 0">Shared stock guidance for generation and Shopping.</p></div><button class="btn sm ghost" type="button" onclick="clearUseUpProducts()">Clear</button></div><div id="use-up-products-editor"></div></section>
      <section class="plan-options-section"><h3>Traffic-light filters</h3><p style="font-size:12px;color:var(--text2);margin-bottom:10px">Choose the fit statuses PlatePlan may use for each person. Symbols keep the controls readable without relying on colour alone.</p><div style="display:grid;gap:10px" id="plan-options-traffic"></div></section>
      <section class="plan-options-section"><h3>Meal slots</h3><div id="plan-options-slots"></div></section>
    </div>
    <div class="plan-options-workspace-actions"><button class="btn primary" onclick="generatePlanFromOptions()">Generate plan</button><button class="btn danger" onclick="confirmClearPlanFromOptions()">Clear plan</button></div>
  </div>`;
  document.body.appendChild(wrap);
  const details=wrap.querySelector('#plan-options-details');
  const daysField=document.createElement('div');
  daysField.innerHTML='<label for="plan-days">Length</label>';
  if(days) daysField.appendChild(days);
  const dateField=document.createElement('div');
  dateField.innerHTML='<label>Calendar dates</label>';
  if(date) date.style.margin='0';
  if(date) dateField.appendChild(date);
  details.append(daysField,dateField);
  const selection=wrap.querySelector('#plan-options-selection');
  const priorityField=document.createElement('div');
  priorityField.innerHTML='<label for="plan-product-priority">Product priority</label>';
  if(priority) priority.style.width='100%';
  if(priority) priorityField.appendChild(priority);
  selection.appendChild(priorityField);
  repeats.forEach(label=>{label.style.display='block';const s=label.querySelector('select');if(s)s.style.width='100%';selection.appendChild(label);});
  const preferEnhancedToggle=document.createElement('label');
  preferEnhancedToggle.className='prefer-enhanced-toggle';
  preferEnhancedToggle.innerHTML='<input type="checkbox" id="plan-prefer-enhanced" onchange="setPreferEnhancedRecipes(this.checked)"> <span><strong>✨ Prioritise Enhanced Recipes</strong><small>Prioritise enhanced variants for higher protein density and better (lower) macro fit scores.</small></span>';
  selection.appendChild(preferEnhancedToggle);
  const useUpToggle=document.createElement('label');
  useUpToggle.className='use-up-priority-toggle';
  useUpToggle.innerHTML='<input type="checkbox" id="plan-prioritise-use-up" onchange="setPrioritiseUseUpProducts(this.checked)"> <span><strong>Prioritise Use up products</strong><small>Keep nutrition, traffic filters, exclusions and variety authoritative.</small></span>';
  selection.appendChild(useUpToggle);
  const trafficHost=wrap.querySelector('#plan-options-traffic');
  traffic.forEach(picker=>trafficHost.appendChild(picker));
  if(!document.getElementById('plan-traffic-availability')){
    const summary=document.createElement('div');
    summary.id='plan-traffic-availability';
    summary.className='traffic-availability';
    trafficHost.insertAdjacentElement('afterend',summary);
  }
  enhancePlanTrafficControls();
  setPlanTrafficSelectValues();
  renderPlanTrafficAvailabilitySummary();
  renderUseUpProductsEditor();
  renderPinnedRecipesEditor();
  if(setup){
    setup.style.display='';
    setup.classList.remove('card');
    setup.style.margin='0';
    const setupTitle=setup.querySelector('h3');if(setupTitle)setupTitle.style.display='none';
    wrap.querySelector('#plan-options-slots')?.appendChild(setup);
  }
  legacy.remove();
  updatePlannerCompactHeader();
}
function syncPlannerQuickControls(){
  const days=document.getElementById('plan-days');
  const start=document.getElementById('plan-start-date');
  const quickDays=document.getElementById('plan-quick-days');
  const quickStart=document.getElementById('plan-quick-start');
  if(days&&quickDays)days.value=quickDays.value;
  if(start&&quickStart)start.value=quickStart.value;
}
function generatePlanFromQuickSetup(){
  syncPlannerQuickControls();
  initExcluded(false);
  renderExclGrid();
  renderUseUpProductsEditor();
  renderPinnedRecipesEditor();
  generatePlan();
}
function openPlanOptionsWorkspace(){
  ensurePlannerOptionsUI();
  const wrap=document.getElementById('plan-options-wrap');if(!wrap)return;
  const days=document.getElementById('plan-days');
  if(state.plan?.days&&days)days.value=String(state.plan.days);
  const start=document.getElementById('plan-start-date');
  if(start)start.value=state.plan?.dayDates?.[1]||document.getElementById('plan-quick-start')?.value||'';
  const preferToggle=document.getElementById('plan-prefer-enhanced');
  if(preferToggle) preferToggle.checked = state.prefs?.preferEnhancedRecipes !== false;
  setMealRepeatControlValues();
  setPlanTrafficSelectValues();
  renderPlanTrafficAvailabilitySummary();
  renderExclGrid();
  renderUseUpProductsEditor();
  renderPinnedRecipesEditor();
  platePlanLastMobileFocus=document.activeElement;
  wrap.classList.add('open');
  markMobileLayerForBack(wrap,'plan-options');
  setTimeout(()=>wrap.querySelector('button')?.focus(),0);
}
function closePlanOptionsWorkspace(fromHistory=false){
  const wrap=document.getElementById('plan-options-wrap');if(!wrap)return;
  const marked=wrap.dataset.historyEntry==='1';
  wrap.classList.remove('open');delete wrap.dataset.historyEntry;
  updatePlannerCompactHeader();
  restoreMobileLayerFocus();
  if(marked&&!fromHistory)returnFromPlatePlanUiHistory();
}
function generatePlanFromOptions() { generatePlan(); }
function confirmClearPlanFromOptions(){
  openAppConfirmModal('Clear active meal plan?','This removes the current working plan and its shopping checklist. Saved plans remain in the Meal Plan Library.','Clear plan',()=>{clearPlan();closePlanOptionsWorkspace();});
}
let platePlanDraftDayDates={};
function ensurePlanDatesWorkspace(){
  let wrap=document.getElementById('plan-dates-wrap');
  if(wrap)return wrap;
  wrap=document.createElement('div');
  wrap.id='plan-dates-wrap';
  wrap.className='modal-wrap plan-dates-wrap';
  wrap.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="plan-dates-title">
    <div class="plan-dates-appbar row-between" style="align-items:center;gap:12px">
      <div><h2 id="plan-dates-title" style="margin:0">Assign dates</h2><div style="font-size:13px;color:var(--text2)">Match plan days to your calendar</div></div>
      <button class="btn ghost" type="button" onclick="closePlanDatesWorkspace()">Close</button>
    </div>
    <div class="plan-dates-body">
      <p class="plan-dates-intro">Choose a start date to fill every day, or set individual dates. Gaps are allowed; assigned dates must stay unique and in order.</p>
      <div class="plan-dates-start">
        <div><label for="plan-dates-start">Start date</label><input id="plan-dates-start" type="date"></div>
        <button class="btn ghost" type="button" onclick="fillPlanDatesDraft()">Fill consecutive dates</button>
      </div>
      <div class="plan-dates-list" id="plan-dates-list"></div>
      <div class="plan-dates-msg" id="plan-dates-msg" role="status" aria-live="polite"></div>
    </div>
    <div class="plan-dates-actions">
      <button class="btn ghost" type="button" onclick="clearPlanDatesDraft()">Clear all</button>
      <button class="btn primary" type="button" onclick="savePlanDatesDraft()">Save dates</button>
    </div>
  </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function renderPlanDatesDraft(){
  const list=document.getElementById('plan-dates-list');
  if(!list)return;
  const days=+(state.plan?.days||Object.keys(state.plan?.slots||{}).length||0);
  list.innerHTML=Array.from({length:days},(_,index)=>{
    const day=index+1;
    return `<div class="plan-date-row"><label for="plan-date-draft-${day}">Day ${day}</label><input id="plan-date-draft-${day}" type="date" value="${ppEscapeAttr(platePlanDraftDayDates[day]||'')}" onchange="updatePlanDatesDraft(${day},this.value)" aria-label="Calendar date for day ${day}"></div>`;
  }).join('');
  updatePlanDatesDraftMessage();
}
function updatePlanDatesDraftMessage(){
  const message=document.getElementById('plan-dates-msg');
  const save=document.querySelector('#plan-dates-wrap .plan-dates-actions .btn.primary');
  const error=validatePlanDayDates(platePlanDraftDayDates);
  if(message)message.textContent=error;
  if(save)save.disabled=!!error;
  return error;
}
function updatePlanDatesDraft(day,value){
  if(value)platePlanDraftDayDates[day]=value;
  else delete platePlanDraftDayDates[day];
  updatePlanDatesDraftMessage();
}
function fillPlanDatesDraft(){
  const start=document.getElementById('plan-dates-start')?.value||'';
  if(!parsePlanLocalDate(start)){
    const message=document.getElementById('plan-dates-msg');
    if(message)message.textContent='Choose a valid start date first.';
    document.getElementById('plan-dates-start')?.focus();
    return;
  }
  const days=+(state.plan?.days||Object.keys(state.plan?.slots||{}).length||0);
  platePlanDraftDayDates=buildPlanDayDates(start,days);
  renderPlanDatesDraft();
}
function clearPlanDatesDraft(){
  platePlanDraftDayDates={};
  const start=document.getElementById('plan-dates-start');if(start)start.value='';
  renderPlanDatesDraft();
}
function openPlanDatesWorkspace(){
  if(!state.plan?.slots||!Object.keys(state.plan.slots).length){
    showPlatePlanToast('Generate a meal plan before assigning dates.');
    return;
  }
  closePlanOptionsWorkspace();
  const wrap=ensurePlanDatesWorkspace();
  platePlanDraftDayDates={...(state.plan.dayDates||{})};
  const start=wrap.querySelector('#plan-dates-start');if(start)start.value=platePlanDraftDayDates[1]||'';
  renderPlanDatesDraft();
  platePlanLastMobileFocus=document.activeElement;
  wrap.classList.add('open');
  markMobileLayerForBack(wrap,'plan-dates');
  setTimeout(()=>wrap.querySelector('#plan-dates-start')?.focus(),0);
}
function closePlanDatesWorkspace(fromHistory=false){
  const wrap=document.getElementById('plan-dates-wrap');if(!wrap)return;
  const marked=wrap.dataset.historyEntry==='1';
  wrap.classList.remove('open');delete wrap.dataset.historyEntry;
  platePlanDraftDayDates={};
  restoreMobileLayerFocus();
  if(marked&&!fromHistory)returnFromPlatePlanUiHistory();
}
function savePlanDatesDraft(){
  const error=updatePlanDatesDraftMessage();if(error)return;
  state.plan.dayDates={...platePlanDraftDayDates};
  const first=state.plan.dayDates[1]||'';
  const start=document.getElementById('plan-start-date');if(start)start.value=first;
  const quick=document.getElementById('plan-quick-start');if(quick)quick.value=first;
  saveState();
  markPlatePlanViewsDirty('today','shopping','planlib');
  closePlanDatesWorkspace();
  renderPlan();
  renderPlanHistoryPanel();
  showPlatePlanToast(Object.keys(state.plan.dayDates).length?'Plan dates saved.':'Plan dates cleared.');
}
function ensurePlannerShell(){
  const planner = document.getElementById('view-planner');
  if(planner && !document.getElementById('plan-setup-card')){
    const firstCard = planner.querySelector('.card');
    if (firstCard) { firstCard.id = 'plan-setup-card'; }
  }
  const library = document.getElementById('view-planlib');
  if(library){
    let history = document.getElementById('plan-history-panel');
    if(!history){
      library.insertAdjacentHTML('beforeend', '<div id="plan-history-panel"></div>');
      history = document.getElementById('plan-history-panel');
    } else if(!history.closest('#view-planlib')) {
      library.appendChild(history);
    }
  }
  if(planner && !document.getElementById('plan-overall-summary')){
    const content = document.getElementById('plan-content');
    if(content) content.insertAdjacentHTML('beforebegin', '<div id="plan-overall-summary"></div>');
  }
  if(planner && !document.getElementById('plan-meal-prep-panel')){
    const content = document.getElementById('plan-content');
    if(content) content.insertAdjacentHTML('beforebegin', '<div id="plan-meal-prep-panel"></div>');
  }
  const shopping = document.getElementById('view-shopping');
  if(shopping && !document.getElementById('shop-summary')){
    const content = document.getElementById('shop-content');
    if(content) content.insertAdjacentHTML('beforebegin', '<div id="shop-summary"></div>');
  }
  if(shopping && !document.getElementById('shop-meal-prep-panel')){
    const content = document.getElementById('shop-content');
    if(content) content.insertAdjacentHTML('beforebegin', '<div id="shop-meal-prep-panel"></div>');
  }
  ensurePlannerOptionsUI();
}
function normaliseExclusionList(list){
  return (list || []).map(x => typeof x === 'string' ? { name:x } : x).filter(x => (x.name || x.id));
}
function getExclusionsForPerson(who){
  const ex = state.prefs?.exclusions || { shared: [], elliott: [], chloe: [] };
  const person = String(who || '').toLowerCase().startsWith('chloe') ? 'chloe' : 'elliott';
  return [...normaliseExclusionList(ex.shared), ...normaliseExclusionList(ex[person])];
}
function recipeMatchesExclusion(recipe, exclusion){
  const needle = normaliseAliasText(exclusion.name || '');
  const ids = [exclusion.id, exclusion.groupId, exclusion.productId].filter(Boolean);
  const checkIng = ing => {
    const resolved = resolveProductForIngredient(ing);
    const hay = normaliseAliasText([ing.raw, ing.name, resolved.group?.name, resolved.product?.name, resolved.product?.brand].filter(Boolean).join(' '));
    if(needle && hay.includes(needle)) return true;
    return ids.includes(ing.groupId) || ids.includes(ing.bankId) || ids.includes(resolved.groupId) || ids.includes(resolved.productId);
  };
  return (recipe.ingredients || []).some(checkIng) || (recipe.enhanced?.ingredients || []).some(checkIng);
}
function recipeAllowedForPerson(recipe, who) { return !getExclusionsForPerson(who).some(ex => recipeMatchesExclusion(recipe, ex)); }
function getUsedRecipeIdsFromHistory(){
  const used = new Map();
  (state.planHistory || []).slice(0, 4).forEach((plan, histIndex) => {
    Object.values(plan.slots || {}).forEach(day => Object.values(day || {}).forEach(slot => {
      const info = getPlanSlotInfo(slot);
      if(info.id && !used.has(info.id)) used.set(info.id, histIndex);
    }));
  });
  return used;
}
function getPlanRecipeIds(plan = state.plan){
  const ids = new Set();
  Object.values(plan?.slots || {}).forEach(day => Object.values(day || {}).forEach(slot => {
    const info = getPlanSlotInfo(slot);
    if(info.id) ids.add(info.id);
  }));
  return [...ids];
}
function snapshotCurrentPlan(savedStatus = 'PlatePlan generated', name = ''){
  if(!state.plan?.slots) return null;
  const hasAny = Object.values(state.plan.slots || {}).some(day => Object.values(day || {}).some(Boolean));
  if(!hasAny) return null;
  const snap = {
    id: 'hist-' + Date.now(),
    date: new Date().toISOString(),
    name: name || '',
    savedBy: 'PlatePlan',
    savedStatus,
    confirmedShopping: !!state.plan.confirmedShopping,
    confirmedAt: state.plan.confirmedAt || null,
    days: state.plan.days || 0,
    slots: clonePlatePlanValue(state.plan.slots || {}),
    dayDates: clonePlatePlanValue(state.plan.dayDates || {}),
    slotReasons: clonePlatePlanValue(state.plan.slotReasons || {}),
    productPriority: state.plan.productPriority || state.prefs.productPriority || 'protein',
    productSelections: clonePlatePlanValue(state.plan.productSelections || {}),
    useUpProductIds: clonePlatePlanValue(state.plan.useUpProductIds || []),
    shoppingAtHome: clonePlatePlanValue(state.plan.shoppingAtHome || {}),
    overrides: clonePlatePlanValue(state.overrides || {}),
    score: calculatePlanScore(state.plan),
    mealPrepGroups: clonePlatePlanValue(state.plan.mealPrepGroups || []),
    declinedMealPrepGroups: clonePlatePlanValue(state.plan.declinedMealPrepGroups || []),
    warnings: state.plan.warnings || []
  };
  snap.cardPackSnapshot=buildRecipeCardPackSnapshot(state.plan,state.overrides,{planName:snap.name||defaultPlanSaveName(state.plan),createdAt:snap.date});
  state.planHistory = [snap, ...(state.planHistory || [])].slice(0, 12);
  return snap;
}
function getSlotMealMode(day, meal){
  const d = state.excluded?.[day] || {};
  const eKey = meal + 'E';
  const cKey = meal + 'C';
  const eOn = !d[eKey];
  const cOn = !d[cKey];
  if(eOn && cOn) return 'both';
  if(eOn) return 'elliott';
  if(cOn) return 'chloe';
  return 'none';
}
function setSlotMealMode(day, meal, mode){
  if(!state.excluded[day]) state.excluded[day] = {};
  state.excluded[day][meal+'E'] = !(mode === 'elliott' || mode === 'both');
  state.excluded[day][meal+'C'] = !(mode === 'chloe' || mode === 'both');
  saveState();
  renderExclGrid();
}
function getPlannerSlotNutritionInfo(plan = state.plan, day, slotKey){
  const person = getSlotPersonPrefix(slotKey);
  const mealType = getMealTypeFromSlotKey(slotKey);
  const label = (SLOT_LABELS[slotKey] || slotKey || '').replace('\n',' ');
  const base = { plan, day, slotKey, person, mealType, label, slotInfo:null, active:null, instanceId:null, cal:0, prot:0, assumed:false, visible:false };
  if(!person) return base;
  if(state.excluded?.[day]?.[slotKey]) {
    return { ...base, assumed:true };
  }
  const slots = plan?.slots?.[day] || plan?.slots?.[String(day)] || {};
  const slotInfo = getPlanSlotInfo(slots[slotKey]);
  if(!slotInfo.active) {
    return { ...base, slotInfo, assumed:true };
  }
  const n = getPlannedSlotNutrition(slotInfo.active, slotKey, slotInfo.instanceId, plan) || { cal:0, prot:0 };
  return { ...base, slotInfo, active:slotInfo.active, instanceId:slotInfo.instanceId, cal:+n.cal || 0, prot:+n.prot || 0, portions:n.portions || null, visible:true };
}
function buildPlanDaySlotInfos(plan = state.plan, day) { return SLOTS.map(sl => getPlannerSlotNutritionInfo(plan, day, sl.key)); }
function summarizePlanDaySlotInfos(daySlotInfos){
  const totals = { e:{cal:0, prot:0}, c:{cal:0, prot:0} };
  const assumed = { e:{cal:0, prot:0, labels:[]}, c:{cal:0, prot:0, labels:[]} };
  const addSnackBudget = personPrefix => {
    const b = getBudgets(personPrefix, 'snack');
    totals[personPrefix].cal += +b.cal || 0;
    totals[personPrefix].prot += +b.prot || 0;
    assumed[personPrefix].cal += +b.cal || 0;
    assumed[personPrefix].prot += +b.prot || 0;
    assumed[personPrefix].labels.push('snacks');
  };
  addSnackBudget('e');
  addSnackBudget('c');
  (daySlotInfos || []).forEach(info => {
    if(!info?.person || !info.visible) return;
    totals[info.person].cal += +info.cal || 0;
    totals[info.person].prot += +info.prot || 0;
  });
  const eTgt = { cal:+state.prefs.ecal || 0, prot:+state.prefs.eprot || 0 };
  const cTgt = { cal:+state.prefs.ccal || 0, prot:+state.prefs.cprot || 0 };
  const miss = (actual, target, protein=false) => {
    if(!target) return 0;
    const pct = ((actual - target) / target) * 100;
    return protein ? Math.max(0, -pct) : Math.abs(pct);
  };
  const score = miss(totals.e.cal, eTgt.cal) + miss(totals.c.cal, cTgt.cal) + miss(totals.e.prot, eTgt.prot, true) + miss(totals.c.prot, cTgt.prot, true);
  return { totals, targets:{ e:eTgt, c:cTgt }, assumed, score: Math.round(score) };
}
function getPlanDaySummary(day, plan = state.plan) { return summarizePlanDaySlotInfos(buildPlanDaySlotInfos(plan, day)); }
function calculatePlanScore(plan = state.plan){
  const days = plan?.days || 0;
  const dayScores = [];
  const totals = { e:{cal:0, prot:0, days:0}, c:{cal:0, prot:0, days:0} };
  for(let d=1; d<=days; d++){
    const s = getPlanDaySummary(d, plan);
    dayScores.push(s.score);
    ['e','c'].forEach(p => {
      if(s.totals[p].cal || s.totals[p].prot){
        totals[p].cal += s.totals[p].cal;
        totals[p].prot += s.totals[p].prot;
        totals[p].days++;
      }
    });
  }
  return {
    score: dayScores.length ? Math.round(dayScores.reduce((a,b)=>a+b,0) / dayScores.length) : 0,
    eAvg:{ cal: totals.e.days ? Math.round(totals.e.cal / totals.e.days) : 0, prot: totals.e.days ? Math.round(totals.e.prot * 10 / totals.e.days) / 10 : 0 },
    cAvg:{ cal: totals.c.days ? Math.round(totals.c.cal / totals.c.days) : 0, prot: totals.c.days ? Math.round(totals.c.prot * 10 / totals.c.days) / 10 : 0 }
  };
}
function fmtPlanDelta(actual, target, protein=false){
  if(!target) return 'no target';
  const pct = Math.round(((actual - target) / target) * 100);
  if(protein && pct >= 0) return `${Math.abs(pct)}% above target`;
  if(pct === 0) return 'on target';
  return `${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} target`;
}
function planDeltaColor(actual, target, protein=false){
  if(!target) return 'var(--text2)';
  const pct = ((actual - target) / target) * 100;
  if(protein && pct >= 0) return 'var(--green)';
  const abs = Math.abs(pct);
  if(abs <= 10) return 'var(--green)';
  if(abs <= 15) return 'var(--amber)';
  return 'var(--red)';
}
function calculatePlanDayScoreFromTotals(totals){
  const eTgt = { cal:+state.prefs.ecal || 0, prot:+state.prefs.eprot || 0 };
  const cTgt = { cal:+state.prefs.ccal || 0, prot:+state.prefs.cprot || 0 };
  const miss = (actual, target, protein=false) => {
    if(!target) return 0;
    const pct = ((actual - target) / target) * 100;
    return protein ? Math.max(0, -pct) : Math.abs(pct);
  };
  return Math.round(miss(totals.e.cal, eTgt.cal) + miss(totals.c.cal, cTgt.cal) + miss(totals.e.prot, eTgt.prot, true) + miss(totals.c.prot, cTgt.prot, true));
}
function parsePlannerVisibleMacro(text){
  const m = String(text || '').match(/([0-9]+(?:\.[0-9]+)?)\s*kcal\s*\/\s*P\s*([0-9]+(?:\.[0-9]+)?)\s*g/i);
  return m ? { cal:+m[1] || 0, prot:+m[2] || 0 } : null;
}
function summarizeVisiblePlanDayCard(card){
  const totals = { e:{cal:0, prot:0}, c:{cal:0, prot:0} };
  const assumed = { e:{cal:0, prot:0, labels:['snacks']}, c:{cal:0, prot:0, labels:['snacks']} };
  ['e','c'].forEach(person => {
    const b = getBudgets(person, 'snack');
    totals[person].cal += +b.cal || 0;
    totals[person].prot += +b.prot || 0;
    assumed[person].cal += +b.cal || 0;
    assumed[person].prot += +b.prot || 0;
  });
  card.querySelectorAll('.slot-row').forEach(row => {
    const label = (row.querySelector('.slot-lbl')?.textContent || '').toLowerCase();
    const person = row.dataset.planPerson || (label.includes('elliott') ? 'e' : label.includes('chloe') ? 'c' : '');
    if(!person) return;
    if(row.dataset.planCal !== undefined && row.dataset.planProt !== undefined && row.querySelector('.slot-macro')) {
      totals[person].cal += +row.dataset.planCal || 0;
      totals[person].prot += +row.dataset.planProt || 0;
      return;
    }
    const macro = parsePlannerVisibleMacro(row.querySelector('.slot-macro')?.textContent || '');
    if(macro) {
      totals[person].cal += macro.cal;
      totals[person].prot += macro.prot;
    }
  });
  const targets = { e:{ cal:+state.prefs.ecal || 0, prot:+state.prefs.eprot || 0 }, c:{ cal:+state.prefs.ccal || 0, prot:+state.prefs.cprot || 0 } };
  return { totals, targets, assumed, score: calculatePlanDayScoreFromTotals(totals) };
}
function renderPlannerPersonSummaryBox(personKey, daySummary) { return window.PlannerDayCard?.renderPersonSummaryBox?.(personKey, daySummary) || ''; }
function renderPlanOverallSummaryHtml(score){
  const el = document.getElementById('plan-overall-summary');
  if (!el) return;
  if (!state.plan?.slots) { el.innerHTML = ''; return; }
  el.innerHTML = window.PlannerGridToolbar?.renderPlanOverallSummary?.(score) || '';
}
let reconcilingPlanSummaries = false;
let plannerSummaryObserver = null;
function reconcileVisiblePlanSummaries(){
  if(reconcilingPlanSummaries) return;
  reconcilingPlanSummaries = true;
  try{
    const cards = [...document.querySelectorAll('#plan-content .day-plan-card:not(.skipped)')];
    if (!cards.length) { renderPlanOverallSummary(); return; }
    const aggregate = { e:{cal:0, prot:0, days:0}, c:{cal:0, prot:0, days:0}, scores:[] };
    cards.forEach(card => {
      const summary = summarizeVisiblePlanDayCard(card);
      const boxes = card.querySelectorAll('.plan-summary .summary-box');
      const boxE = renderPlannerPersonSummaryBox('e', summary);
      const boxC = renderPlannerPersonSummaryBox('c', summary);
      if(boxes[0] && boxes[0].innerHTML !== boxE) boxes[0].innerHTML = boxE;
      if(boxes[1] && boxes[1].innerHTML !== boxC) boxes[1].innerHTML = boxC;
      const scoreTag = card.querySelector('.row-between .tag');
      const scoreText = 'Score ' + summary.score;
      if(scoreTag && scoreTag.textContent !== scoreText) scoreTag.textContent = scoreText;
      aggregate.scores.push(summary.score);
      ['e','c'].forEach(person => {
        aggregate[person].cal += summary.totals[person].cal;
        aggregate[person].prot += summary.totals[person].prot;
        aggregate[person].days += 1;
      });
    });
    const visibleScore = {
      score: aggregate.scores.length ? Math.round(aggregate.scores.reduce((a,b)=>a+b,0) / aggregate.scores.length) : 0,
      eAvg:{ cal: aggregate.e.days ? Math.round(aggregate.e.cal / aggregate.e.days) : 0, prot: aggregate.e.days ? Math.round(aggregate.e.prot * 10 / aggregate.e.days) / 10 : 0 },
      cAvg:{ cal: aggregate.c.days ? Math.round(aggregate.c.cal / aggregate.c.days) : 0, prot: aggregate.c.days ? Math.round(aggregate.c.prot * 10 / aggregate.c.days) / 10 : 0 }
    };
    if(state.plan) state.plan.score = visibleScore;
    renderPlanOverallSummaryHtml(visibleScore);
  } finally {
    reconcilingPlanSummaries = false;
  }
}
function installPlannerSummaryObserver(){
}
function parsePlanRecipeValue(value){
  const text = String(value || '');
  if(text.endsWith('::enhanced')) return { id: text.slice(0, -10), variant: 'enhanced' };
  return { id: text, variant: 'original' };
}
function makePlanSlot(recipeId, variant = 'original'){
  const clean = parsePlanRecipeValue(recipeId);
  return {
    id: clean.id,
    instanceId: 'pm-' + Date.now() + Math.random().toString(36).substring(2,7),
    ...(variant === 'enhanced' || clean.variant === 'enhanced' ? { variant: 'enhanced' } : {})
  };
}
function getPlanSlotInfo(slotData, planContext = state.plan, overrideStore = state.overrides){
  if(!slotData) return { id:'', variant:'original', instanceId:null, recipe:null, active:null };
  const parsed = typeof slotData === 'string'
    ? parsePlanRecipeValue(slotData)
    : { id: slotData.id || '', variant: slotData.variant || 'original' };
  const recipe = getRecipe(parsed.id);
  const variant = parsed.variant === 'enhanced' && recipe?.enhanced ? 'enhanced' : 'original';
  const active = recipe ? getRecipeVariantForDisplay(recipe, variant, typeof slotData === 'string' ? null : slotData.instanceId, planContext, overrideStore) : null;
  return {
    id: parsed.id,
    variant,
    instanceId: typeof slotData === 'string' ? null : slotData.instanceId,
    recipe,
    active
  };
}
const MEAL_PREP_MEALS = [
  { key:'breakfast', label:'Breakfast', e:'breakfastE', c:'breakfastC' },
  { key:'lunch', label:'Lunch', e:'lunchE', c:'lunchC' },
  { key:'dinner', label:'Dinner', e:'dinnerE', c:'dinnerC' }
];
function getMealPrepSlotEntry(daySlots, dayNum, slotKey, planContext = state.plan, overrideStore = state.overrides){
  if(planContext === state.plan && state.excluded?.[dayNum]?.[slotKey]) return null;
  const slotData = daySlots?.[slotKey];
  if(!slotData) return null;
  const slotInfo = getPlanSlotInfo(slotData, planContext, overrideStore);
  if(!slotInfo.active) return null;
  return { slotKey, slotInfo, person: String(slotKey).endsWith('C') ? 'Chloe' : 'Elliott' };
}
function sameMealPrepRecipe(a, b) { return !!(a && b && a.slotInfo.id === b.slotInfo.id && (a.slotInfo.variant || 'original') === (b.slotInfo.variant || 'original')); }
function buildMealPrepDayGroups(dayNum, meal, daySlots, planContext = state.plan, overrideStore = state.overrides){
  const e = getMealPrepSlotEntry(daySlots, dayNum, meal.e, planContext, overrideStore);
  const c = getMealPrepSlotEntry(daySlots, dayNum, meal.c, planContext, overrideStore);
  if(e && c && sameMealPrepRecipe(e, c)) return [{ dayNum, meal, entries:[e, c] }];
  return [e ? { dayNum, meal, entries:[e] } : null, c ? { dayNum, meal, entries:[c] } : null].filter(Boolean);
}
function mealPrepPeopleKey(entries) { return (entries || []).map(entry => entry.person).sort().join('+') || 'none'; }
function recipePackGroupOccurrenceKey(group){
  const primary = group?.entries?.[0];
  if(!primary) return '';
  return [
    group.dayNum,
    group.meal?.key || '',
    primary.slotInfo.id || '',
    primary.slotInfo.variant || 'original',
    mealPrepPeopleKey(group.entries)
  ].join('|');
}
function mealPrepIdentityKey(group){
  const primary = group?.entries?.[0];
  if(!primary) return '';
  return [
    group.meal?.key || '',
    primary.slotInfo.id || '',
    primary.slotInfo.variant || 'original',
    mealPrepPeopleKey(group.entries)
  ].join('|');
}
function mealPrepSuggestionKey(group){
  return [
    'mp',
    group.mealKey,
    group.recipeId,
    group.variant || 'original',
    group.peopleKey,
    (group.days || []).join('-')
  ].join('|');
}
function findMealPrepSuggestions(plan = state.plan, overrideStore = state.overrides){
  if(!plan?.slots) return [];
  const days = plan.days || Object.keys(plan.slots || {}).length || 0, byIdentity = {};
  for(let d=1; d<=days; d++){
    const daySlots = plan.slots[d] || {};
    MEAL_PREP_MEALS.flatMap(meal => buildMealPrepDayGroups(d, meal, daySlots, plan, overrideStore)).forEach(group => {
      const primary = group.entries[0], idKey = mealPrepIdentityKey(group);
      if(!idKey) return;
      if(!byIdentity[idKey]) byIdentity[idKey] = [];
      byIdentity[idKey].push({ ...group, recipeId: primary.slotInfo.id, variant: primary.slotInfo.variant || 'original', recipeName: primary.slotInfo.active?.name || primary.slotInfo.recipe?.name || 'Recipe', mealKey: group.meal.key, peopleKey: mealPrepPeopleKey(group.entries) });
    });
  }
  const suggestions = [];
  Object.values(byIdentity).forEach(rows => {
    rows.sort((a,b) => a.dayNum - b.dayNum);
    let run = [];
    const flush = () => {
      if(run.length >= 2){ const first = run[0], suggestion = { key:'', recipeId:first.recipeId, variant:first.variant, recipeName:first.recipeName, mealKey:first.mealKey, mealLabel:first.meal.label, peopleKey:first.peopleKey, days:run.map(r => r.dayNum), occurrences:run }; suggestion.key = mealPrepSuggestionKey(suggestion); suggestions.push(suggestion); }
      run = [];
    };
    rows.forEach(row => { if(!run.length || row.dayNum === run[run.length - 1].dayNum + 1) run.push(row); else { flush(); run.push(row); } });
    flush();
  });
  return suggestions.sort((a,b) => a.days[0] - b.days[0]);
}
function cleanMealPrepState(){
  if(!state.plan || typeof state.plan !== 'object') return [];
  if(!Array.isArray(state.plan.mealPrepGroups)) state.plan.mealPrepGroups = [];
  if(!Array.isArray(state.plan.declinedMealPrepGroups)) state.plan.declinedMealPrepGroups = [];
  const suggs = findMealPrepSuggestions(state.plan), valid = new Set(suggs.map(s => s.key));
  state.plan.mealPrepGroups = state.plan.mealPrepGroups.filter(g => valid.has(g.key));
  state.plan.declinedMealPrepGroups = state.plan.declinedMealPrepGroups.filter(k => valid.has(k));
  return suggs;
}
function formatMealPrepDays(group, planContext = state.plan){
  return (group.days || []).map(day => `${formatPlanDayLabel(planContext, day)} ${group.mealLabel || ''}`.trim()).join(', ');
}
function refreshAfterMealPrepChange(){
  const suggs = cleanMealPrepState(), accepted = new Set((state.plan?.mealPrepGroups || []).map(g => g.key)), declined = new Set(state.plan?.declinedMealPrepGroups || []);
  if(document.getElementById('view-shopping')?.classList.contains('active') && !suggs.some(s => !accepted.has(s.key) && !declined.has(s.key))) renderShopping();
  else renderMealPrepSuggestions();
}
function acceptMealPrepSuggestion(key){
  const s = findMealPrepSuggestions(state.plan).find(item => item.key === key);
  if(!s) return;
  state.plan.declinedMealPrepGroups = (state.plan.declinedMealPrepGroups || []).filter(k => k !== key);
  if(!(state.plan.mealPrepGroups || []).some(g => g.key === key)) {
    state.plan.mealPrepGroups.push({ key, recipeId:s.recipeId, variant:s.variant, mealKey:s.mealKey, peopleKey:s.peopleKey, days:s.days });
  }
  saveState(); refreshAfterMealPrepChange();
}
function ignoreMealPrepSuggestion(key){
  if(!state.plan) return;
  state.plan.mealPrepGroups = (state.plan.mealPrepGroups || []).filter(g => g.key !== key);
  if(!(state.plan.declinedMealPrepGroups || []).includes(key)) state.plan.declinedMealPrepGroups.push(key);
  saveState(); refreshAfterMealPrepChange();
}
function removeMealPrepGroup(key){
  if(!state.plan) return;
  state.plan.mealPrepGroups = (state.plan.mealPrepGroups || []).filter(g => g.key !== key);
  saveState(); refreshAfterMealPrepChange();
}
function getRecipePackMealPrepGroups(planContext = state.plan, overrideStore = state.overrides){
  const suggs = planContext === state.plan ? cleanMealPrepState() : findMealPrepSuggestions(planContext, overrideStore);
  const accepted = new Set((planContext?.mealPrepGroups || []).map(g => g.key));
  return suggs.filter(s => accepted.has(s.key));
}
function renderMealPrepSuggestions(){
  const panels = [document.getElementById('plan-meal-prep-panel'), document.getElementById('shop-meal-prep-panel')].filter(Boolean);
  if(!panels.length) return;
  if (!state.plan?.slots) { panels.forEach(p => p.innerHTML = ''); return; }
  const suggs = cleanMealPrepState(), accepted = new Set((state.plan.mealPrepGroups || []).map(g => g.key)), declined = new Set(state.plan.declinedMealPrepGroups || []);
  const activeRows = suggs.filter(s => accepted.has(s.key)), pendingRows = suggs.filter(s => !accepted.has(s.key) && !declined.has(s.key));
  if (!activeRows.length && !pendingRows.length) { panels.forEach(p => p.innerHTML = ''); return; }
  const activeHtml = activeRows.map(s => `<div class="row-between" style="gap:10px;border-top:1px solid var(--border);padding:8px 0">
    <div><strong>Meal Prep: ${ppEscapeHtml(s.recipeName)}</strong><div style="font-size:12px;color:var(--text2)">Recipe pack combines ${ppEscapeHtml(formatMealPrepDays(s))}.</div></div>
    <button class="btn sm ghost" onclick="removeMealPrepGroup('${ppEscapeAttr(s.key)}')">Undo</button>
  </div>`).join('');
  const pendingHtml = pendingRows.map(s => `<div class="row-between" style="gap:10px;border-top:1px solid var(--border);padding:8px 0">
    <div><strong>${ppEscapeHtml(s.recipeName)}</strong><div style="font-size:12px;color:var(--text2)">Same ${ppEscapeHtml((s.mealLabel || '').toLowerCase())} on consecutive days: ${ppEscapeHtml(formatMealPrepDays(s))}.</div></div>
    <div class="row-center" style="justify-content:flex-end">
      <button class="btn sm primary" onclick="acceptMealPrepSuggestion('${ppEscapeAttr(s.key)}')">Use meal prep</button>
      <button class="btn sm ghost" onclick="ignoreMealPrepSuggestion('${ppEscapeAttr(s.key)}')">Ignore</button>
    </div>
  </div>`).join('');
  panels.forEach(p => {
    const copy = p.id === 'shop-meal-prep-panel' ? 'This affects the downloaded recipe pack only.' : 'PlatePlan can combine consecutive matching meals into one batch card in the recipe pack.';
    p.innerHTML = `<div class="card" style="margin-bottom:12px;border-color:var(--purple)">
      <div style="font-weight:700;margin-bottom:4px">Meal prep suggestions</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:4px">${copy}</div>
      ${activeHtml}${pendingHtml}
    </div>`;
  });
}
function getPlannerRecipeOptions(type, who, opts = {}){
  const used = opts.avoidHistory ? getUsedRecipeIdsFromHistory() : new Map(), tType = String(type || '').toLowerCase(), tWho = String(who || '').toLowerCase();
  let rows = state.recipes.filter(r => {
    return (r.types || [r.type || 'dinner']).map(t => String(t).toLowerCase()).includes(tType) && (tWho === 'any' || !r.who || String(r.who).toLowerCase() === 'any' || String(r.who).toLowerCase() === 'both' || String(r.who).toLowerCase() === tWho);
  }).filter(r => !opts.applyExclusions || tWho === 'any' || recipeAllowedForPerson(r, who)).flatMap(r => {
    const oFav = (typeof isRecipeVariantFavourite === 'function') ? isRecipeVariantFavourite(r.id, 'original') : !!(r.isFavourite || r.isFavorite);
    const eFav = (typeof isRecipeVariantFavourite === 'function') ? isRecipeVariantFavourite(r.id, 'enhanced') : !!(r.isFavourite || r.isFavorite);
    const res = [{ id:r.id, variant:'original', recipe:r, label:r.name, isFavourite:oFav, isFavorite:oFav }];
    if(r.enhanced) res.push({ id:r.id, variant:'enhanced', recipe:r, label:(r.enhanced.name || r.name + ' (Enhanced)'), enhanced:true, isFavourite:eFav, isFavorite:eFav });
    return res;
  });
  if(opts.applyTrafficFilter !== false) rows = rows.filter(row => plannerRecipePassesTrafficFilter(row, type, who, opts.trafficRules || null));
  if(opts.avoidHistory){
    rows.forEach(row => row.historyRank = used.has(row.id) ? used.get(row.id) + 1 : 0);
    const fresh = rows.filter(row => !row.historyRank);
    rows = fresh.length ? fresh : rows.sort((a,b) => (b.historyRank || 0) - (a.historyRank || 0));
  }
  return rows;
}
let platePlanUseUpCoverageCache=new Map();
function getUseUpEntries(){
  if (window.TodayViewService?.getUseUpEntries) {
    const productsMap = new Map((state.ingredients || []).map(p => [p.id, p]));
    return window.TodayViewService.getUseUpEntries(state.useUpProducts, productsMap);
  }
  return Object.entries(state.useUpProducts||{}).map(([productId,entry])=>({
    productId,
    product:getProduct(productId),
    quantity:+entry?.quantity||0,
    unit:['g','ml','item','pack','unknown'].includes(entry?.unit)?entry.unit:'unknown'
  })).filter(entry=>entry.product);
}
function getUseUpAvailableAmount(entry){
  if (window.TodayViewService?.getUseUpAvailableAmount) { return window.TodayViewService.getUseUpAvailableAmount(entry, (product, type) => type === 'pack' ? getProductUsablePackAmount(product) : getProductItemAmount(product)); }
  if(!entry||!(entry.quantity>0)||entry.unit==='unknown')return null;
  if(entry.unit==='pack')return entry.quantity*getProductUsablePackAmount(entry.product);
  if(entry.unit==='item')return entry.quantity*getProductItemAmount(entry.product);
  return entry.quantity;
}
function getRecipeUseUpCoverage(option,productIds=null){
  const active=option?.variant==='enhanced'&&option.recipe?.enhanced?{...option.recipe,...option.recipe.enhanced,ingredients:option.recipe.enhanced.ingredients||[]} : option?.recipe;
  if(!active)return {matches:[],matchedCount:0,otherIngredients:0,score:0};
  const allowed=productIds?new Set(productIds):null;
  const entries=getUseUpEntries().filter(entry=>!allowed||allowed.has(entry.productId));
  const signature=safeJsonStringify([active.id||option.id,option.variant||'original',active.ingredients,entries.map(e=>[e.productId,e.quantity,e.unit])]);
  if(platePlanUseUpCoverageCache.has(signature))return platePlanUseUpCoverageCache.get(signature);
  if (window.TodayViewService?.getRecipeUseUpCoverage) {
    const result = window.TodayViewService.getRecipeUseUpCoverage(option, entries, (ing, prod) => getEffectiveIngredientGrams(ing, prod));
    platePlanUseUpCoverageCache.set(signature, result);
    return result;
  }
  return {matches:[],matchedCount:0,otherIngredients:0,score:0};
}
function rankPlannerOptionsForUseUp(options,mealType,who,productIds=null){
  return (options||[]).map(o=>{
    const baseCoverage=getRecipeUseUpCoverage(o,productIds);
    const active=o.variant==='enhanced'&&o.recipe?.enhanced?{...o.recipe,...o.recipe.enhanced,ingredients:o.recipe.enhanced.ingredients||[]} : o.recipe;
    const bundle=calculateRecipeDisplayNutrition({recipe:o.recipe,variant:o.variant,mealType});
    const portions=bundle?.portions||{}, person=String(who||'').toLowerCase().startsWith('c')?'c':'e', serves=+active?.serves||+o.recipe?.serves||1;
    const portionServings=String(who||'').toLowerCase()==='both'?(+portions.eSingleServ||0)+(+portions.cSingleServ||0):(person==='c'?(+portions.cSingleServ||0):(+portions.eSingleServ||0));
    const pScale=portionServings>0?portionServings/serves:1;
    const scaledMatches=baseCoverage.matches.map(m=>{const used=m.used*pScale;return {...m,used,remainder:m.available==null?null:Math.max(0,m.available-used)};});
    const knownUtil=scaledMatches.reduce((sum,r)=>sum+(r.available>0?Math.min(r.used,r.available)/r.available:0),0);
    const coverage={...baseCoverage,matches:scaledMatches,score:scaledMatches.length*100+knownUtil*35-baseCoverage.otherIngredients};
    const cal=person==='c'?portions.cCal:portions.eCal, prot=person==='c'?portions.cProt:portions.eProt, target=getBudgets(person,mealType), fit=calculateFit(cal||0,prot||0,target.cal||1,target.prot||1);
    return {...o,useUpCoverage:coverage,useUpRank:coverage.score-(fit.score||0)*12-(o.historyRank||0)*8,active};
  }).sort((a,b)=>b.useUpRank-a.useUpRank||(a.label||'').localeCompare(b.label||''));
}
function applyUseUpSelectionsToPlan(slots,selections){
  const selected=getUseUpEntries().filter(entry=>isUsableProduct(entry.product));
  Object.values(slots||{}).forEach(day=>Object.values(day||{}).forEach(slot=>{
    const info=getPlanSlotInfo(slot);
    const recipe=info.active;
    if(!recipe)return;
    (recipe.ingredients||[]).forEach(ing=>{
      const groupId=getRecipeIngredientGroupId(ing);
      const entry=selected.find(item=>item.product.groupId&&item.product.groupId===groupId);
      if(entry)selections[groupId]=entry.productId;
    });
  }));
  return selections;
}
function setPrioritiseUseUpProducts(checked){
  state.prefs.prioritiseUseUpProducts=!!checked&&getUseUpEntries().length>0;
  saveState();
  renderUseUpProductsEditor();
}
function useUpQuantityLabel(entry){
  if(!entry||entry.unit==='unknown'||!(+entry.quantity>0))return 'Quantity unknown';
  const labels={g:'g',ml:'ml',item:' items',pack:' packs'};
  return `${round1(entry.quantity)}${labels[entry.unit]||''}`;
}
function renderUseUpProductsEditor(){
  const host=document.getElementById('use-up-products-editor');
  const toggle=document.getElementById('plan-prioritise-use-up');
  const entries=getUseUpEntries();
  if (toggle) { toggle.checked=!!state.prefs.prioritiseUseUpProducts;toggle.disabled=!entries.length; }
  if(!host)return;
  if (window.UseUpEditorUI?.renderEditor) {
    host.innerHTML = window.UseUpEditorUI.renderEditor(entries);
  }
}
function renderUseUpProductSuggestions(query=''){
  const host=document.getElementById('use-up-product-suggestions');if(!host)return;
  const q=canonicalGroupKey(query);
  const selected=new Set(Object.keys(state.useUpProducts||{}));
  const rows=(state.ingredients||[]).filter(product=>!selected.has(product.id)&&(!q||canonicalGroupKey([product.name,product.brand,getProductFamily(product)].join(' ')).includes(q))).slice(0,30);
  if (window.UseUpEditorUI?.renderSuggestions) {
    host.innerHTML = window.UseUpEditorUI.renderSuggestions(rows);
  }
  host.style.display='block';
}
function addUseUpProduct(productId){
  if(!getProduct(productId))return;
  if(!state.useUpProducts)state.useUpProducts={};
  state.useUpProducts[productId]={quantity:null,unit:'unknown'};
  saveState();platePlanUseUpCoverageCache.clear();renderUseUpProductsEditor();
}
let platePlanUseUpSaveTimer=null;
function updateUseUpProduct(productId,field,value,rerender=true){
  const entry=state.useUpProducts?.[productId];if(!entry)return;
  if(field==='quantity')entry.quantity=+value||null;
  if(field==='unit')entry.unit=['g','ml','item','pack','unknown'].includes(value)?value:'unknown';
  platePlanUseUpCoverageCache.clear();
  clearTimeout(platePlanUseUpSaveTimer);platePlanUseUpSaveTimer=setTimeout(()=>saveState(),180);
  if(rerender)renderUseUpProductsEditor();
}
function removeUseUpProduct(productId){
  delete state.useUpProducts?.[productId];
  if(!getUseUpEntries().length)state.prefs.prioritiseUseUpProducts=false;
  saveState();platePlanUseUpCoverageCache.clear();renderUseUpProductsEditor();
}
function clearUseUpProducts(){
  if(!getUseUpEntries().length)return;
  openAppConfirmModal('Clear Use up products?','This removes the shared stock guidance. It does not change your Product Bank or active plan.','Clear list',()=>{state.useUpProducts={};state.prefs.prioritiseUseUpProducts=false;saveState();platePlanUseUpCoverageCache.clear();renderUseUpProductsEditor();});
}
function getPinnedRecipesList() { return Array.isArray(state.prefs?.pinnedRecipes) ? state.prefs.pinnedRecipes : []; }
let currentPinnedPickerFilter = 'all';
let currentPinnedPickerSearch = '';
function setPreferEnhancedRecipes(checked){
  if(!state.prefs) state.prefs = {};
  state.prefs.preferEnhancedRecipes = !!checked;
  saveState();
}
function renderPinnedRecipesEditor(){
  const host = document.getElementById('pinned-recipes-editor');
  if(!host) return;
  const list = getPinnedRecipesList();
  const maxDays = parseInt(state.plan?.days || document.getElementById('plan-days')?.value) || 7;
  host.innerHTML = `<div class="pinned-recipes-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn primary sm" onclick="openPinnedRecipePicker()" style="display:inline-flex;align-items:center;gap:6px">
        <span>+</span> Add pre-selected recipe
      </button>
      ${list.length ? `<button type="button" class="btn ghost sm" onclick="clearPinnedRecipes()" style="color:var(--red)">Clear all (${list.length})</button>` : ''}
    </div>
    <div class="pinned-recipes-list">
      ${list.length ? list.map(item => {
        const rec = getRecipe(item.recipeId);
        const name = rec ? rec.name : 'Unknown Recipe';
        const isEnhanced = item.variant === 'enhanced';
        const daysCount = parseInt(item.daysCount) || 1;
        const targetDay = item.targetDay ? parseInt(item.targetDay) : 0;
        let dayOptions = '<option value="0"' + (targetDay === 0 ? ' selected' : '') + '>Any day</option>';
        for(let d = 1; d <= maxDays; d++){
          dayOptions += '<option value="' + d + '"' + (targetDay === d ? ' selected' : '') + '>Day ' + d + '</option>';
        }
        const recipeType = (rec?.types && rec?.types[0]) || rec?.type || 'dinner';
        return `<div class="pinned-recipe-row">
          <div class="pinned-recipe-info">
            <strong>${ppEscapeHtml(name)}${isEnhanced ? ' <span class="tag enhanced-pill">✨ Enhanced</span>' : ''}</strong>
            <small>${ppEscapeHtml(toTitleCase(recipeType))} · ${ppEscapeHtml(rec?.who === 'both' ? 'Shared' : rec?.who || 'Any')}</small>
          </div>
          <div>
            <select aria-label="Repeat count for ${ppEscapeAttr(name)}" onchange="updatePinnedRecipe('${ppEscapeAttr(item.recipeId)}','${ppEscapeAttr(item.variant || 'original')}','daysCount',this.value)">
              ${[1,2,3,4,5,6,7].map(num => `<option value="${num}"${daysCount === num ? ' selected' : ''}>${num} day${num > 1 ? 's' : ''}</option>`).join('')}
            </select>
          </div>
          <div>
            <select aria-label="Target day for ${ppEscapeAttr(name)}" onchange="updatePinnedRecipe('${ppEscapeAttr(item.recipeId)}','${ppEscapeAttr(item.variant || 'original')}','targetDay',this.value)">
              ${dayOptions}
            </select>
          </div>
          <button class="btn sm ghost" type="button" onclick="removePinnedRecipe('${ppEscapeAttr(item.recipeId)}','${ppEscapeAttr(item.variant || 'original')}');" aria-label="Remove ${ppEscapeAttr(name)}" style="color:var(--text2)">✕</button>
        </div>`;
      }).join('') : '<div class="empty compact" style="text-align:center;padding:16px 8px;color:var(--text2)">No pre-selected recipes added. Tap "+ Add pre-selected recipe" to pin specific meals before generating.</div>'}
    </div>
  </div>`;
}
function openPinnedRecipePicker(){
  let wrap = document.getElementById('pinned-recipe-picker-wrap');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.id = 'pinned-recipe-picker-wrap';
    wrap.className = 'modal-wrap';
    document.body.appendChild(wrap);
  }
  currentPinnedPickerFilter = 'all';
  currentPinnedPickerSearch = '';
  wrap.innerHTML = `<div class="modal recipe-picker-modal" role="dialog" aria-modal="true" aria-labelledby="pinned-picker-title">
    <div class="recipe-picker-head">
      <div>
        <h3 id="pinned-picker-title" style="margin:0;font-size:18px;font-weight:750">Pre-select Recipes</h3>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">Pin recipes to guarantee placement in your plan</div>
      </div>
      <button class="btn sm ghost" type="button" onclick="closePinnedRecipePicker()" aria-label="Close">✕</button>
    </div>
    <div class="recipe-picker-search-bar">
      <span class="recipe-picker-search-icon">🔍</span>
      <input type="search" id="pinned-picker-search-input" placeholder="Search recipe name, ingredients, tags…" autocomplete="off" oninput="handlePinnedPickerSearch(this.value)">
      <button type="button" class="recipe-picker-clear-btn" id="pinned-picker-clear-btn" style="display:none" onclick="clearPinnedPickerSearch()">✕</button>
    </div>
    <div style="margin-bottom:12px;overflow-x:auto;padding-bottom:2px">
      <div class="segmented-control" role="tablist">
        <button type="button" role="tab" class="active" id="pinned-tab-all" onclick="setPinnedRecipePickerFilter('all')">All</button>
        <button type="button" role="tab" id="pinned-tab-enhanced" onclick="setPinnedRecipePickerFilter('enhanced')">✨ Enhanced</button>
        <button type="button" role="tab" id="pinned-tab-original" onclick="setPinnedRecipePickerFilter('original')">Original</button>
        <button type="button" role="tab" id="pinned-tab-breakfast" onclick="setPinnedRecipePickerFilter('breakfast')">Breakfast</button>
        <button type="button" role="tab" id="pinned-tab-lunch" onclick="setPinnedRecipePickerFilter('lunch')">Lunch</button>
        <button type="button" role="tab" id="pinned-tab-dinner" onclick="setPinnedRecipePickerFilter('dinner')">Dinner</button>
      </div>
    </div>
    <div class="recipe-picker-list" id="pinned-picker-list-container"></div>
    <div class="row-between" style="margin-top:14px;align-items:center;flex-shrink:0">
      <div style="font-size:12px;color:var(--text2)" id="pinned-picker-count"></div>
      <button class="btn ghost sm" type="button" onclick="closePinnedRecipePicker()">Done</button>
    </div>
  </div>`;
  wrap.classList.add('open');
  renderPinnedRecipePickerList();
  setTimeout(() => document.getElementById('pinned-picker-search-input')?.focus(), 50);
}
function closePinnedRecipePicker() { const wrap = document.getElementById('pinned-recipe-picker-wrap'); if(wrap) wrap.classList.remove('open'); renderPinnedRecipesEditor(); }
function setPinnedRecipePickerFilter(filter){ currentPinnedPickerFilter = filter; ['all','enhanced','original','breakfast','lunch','dinner'].forEach(f => { const tab = document.getElementById(`pinned-tab-${f}`); if(tab) tab.classList.toggle('active', f === filter); }); renderPinnedRecipePickerList(); }
function handlePinnedPickerSearch(value) { currentPinnedPickerSearch = String(value || '').trim(); const clearBtn = document.getElementById('pinned-picker-clear-btn'); if(clearBtn) clearBtn.style.display = currentPinnedPickerSearch ? 'block' : 'none'; renderPinnedRecipePickerList(); }
function clearPinnedPickerSearch(){ const input = document.getElementById('pinned-picker-search-input'); if (input) { input.value = ''; input.focus(); } handlePinnedPickerSearch(''); }
function renderPinnedRecipePickerList(){
  const host = document.getElementById('pinned-picker-list-container');
  if(!host) return;
  const countHost = document.getElementById('pinned-picker-count');
  const q = currentPinnedPickerSearch.toLowerCase();
  const filter = currentPinnedPickerFilter;
  const pinned = getPinnedRecipesList();
  const pinnedKeys = new Set(pinned.map(p => `${p.recipeId}::${p.variant || 'original'}`));
  const rows = [];
  (state.recipes || []).forEach(r => {
    if(!r || !r.id) return;
    const rTypes = (r.types || [r.type || 'dinner']).map(t => String(t).toLowerCase());
    const rType = rTypes[0] || 'dinner';
    const matchType = !['breakfast','lunch','dinner'].includes(filter) || rTypes.includes(filter);
    if(!matchType) return;
    const ingText = (r.ingredients || []).map(i => i.name || i.ingredient || '').join(' ').toLowerCase();
    const searchMatch = !q || r.name.toLowerCase().includes(q) || rType.includes(q) || ingText.includes(q);
    if(!searchMatch) return;
    if(filter !== 'enhanced') {
      const isPinned = pinnedKeys.has(`${r.id}::original`);
      rows.push({
        id: r.id,
        variant: 'original',
        recipe: r,
        name: r.name,
        type: rType,
        who: r.who || 'both',
        isPinned,
        isEnhanced: false
      });
    }
    if(filter !== 'original' && r.enhanced && ((r.enhanced.ingredients && r.enhanced.ingredients.length) || (r.enhanced.method && r.enhanced.method.length) || (r.enhanced.steps && r.enhanced.steps.length) || r.enhanced.name || r.enhanced.changes)) {
      const isPinned = pinnedKeys.has(`${r.id}::enhanced`);
      rows.push({
        id: r.id,
        variant: 'enhanced',
        recipe: r,
        name: r.enhanced.name || (r.name + ' (Enhanced)'),
        type: rType,
        who: r.who || 'both',
        isPinned,
        isEnhanced: true
      });
    }
  });
  if(countHost) countHost.textContent = `${rows.length} recipe option${rows.length === 1 ? '' : 's'}`;
  if(!rows.length){
    host.innerHTML = `<div class="empty compact" style="text-align:center;padding:32px 16px;color:var(--text2)">
      <div>No matching recipes found for "${ppEscapeHtml(currentPinnedPickerSearch || currentPinnedPickerFilter)}".</div>
    </div>`;
    return;
  }
  host.innerHTML = rows.map(item => {
    let macroSummary = '';
    try {
      const bundle = calculateRecipeDisplayNutrition({ recipe: item.recipe, variant: item.variant, mealType: item.type });
      const portions = bundle?.portions;
      if(portions) {
        const cal = Math.round(portions.eCal || portions.cCal || item.recipe.cal || 0);
        const prot = round1(portions.eProt || portions.cProt || item.recipe.prot || 0);
        macroSummary = `<span class="slot-macro" style="font-size:11px">${cal} kcal · P${prot}g</span>`;
      }
    } catch(e){}
    return `<div class="recipe-picker-item" onclick="togglePinnedPickerSelection('${ppEscapeAttr(item.id)}','${ppEscapeAttr(item.variant)}')">
      <div class="recipe-picker-item-main">
        <div class="recipe-picker-item-title">
          <span>${ppEscapeHtml(item.name)}</span>
          ${item.isEnhanced ? '<span class="tag enhanced-pill">✨ Enhanced</span>' : ''}
          ${item.isPinned ? '<span class="tag pinned">Pre-selected</span>' : ''}
        </div>
        <div class="recipe-picker-item-sub">
          <span>${ppEscapeHtml(toTitleCase(item.type))}</span>
          <span>·</span>
          <span>${ppEscapeHtml(item.who === 'both' ? 'Shared' : item.who || 'Any')}</span>
        </div>
      </div>
      <div class="recipe-picker-item-macros">
        ${macroSummary}
        <button type="button" class="btn sm ${item.isPinned ? 'ghost' : 'primary'}" style="min-width:64px;pointer-events:none">
          ${item.isPinned ? 'Remove' : '+ Select'}
        </button>
      </div>
    </div>`;
  }).join('');
}
function togglePinnedPickerSelection(recipeId, variant){
  const exists = getPinnedRecipesList().find(p => p.recipeId === recipeId && (p.variant || 'original') === (variant || 'original'));
  if(exists) removePinnedRecipe(recipeId, variant); else addPinnedRecipe(recipeId, variant);
  renderPinnedRecipePickerList();
}
function addPinnedRecipe(recipeId, variant = 'original'){
  if(!state.prefs) state.prefs = {};
  if(!Array.isArray(state.prefs.pinnedRecipes)) state.prefs.pinnedRecipes = [];
  if(!state.prefs.pinnedRecipes.some(p => p.recipeId === recipeId && (p.variant || 'original') === (variant || 'original'))){
    state.prefs.pinnedRecipes.push({ recipeId, variant: variant || 'original', daysCount: 1, targetDay: 0 });
    saveState(); renderPinnedRecipesEditor();
  }
}
function updatePinnedRecipe(recipeId, variant, field, value){
  const entry = getPinnedRecipesList().find(p => p.recipeId === recipeId && (p.variant || 'original') === (variant || 'original'));
  if(!entry) return;
  if(field === 'daysCount') entry.daysCount = Math.max(1, parseInt(value) || 1);
  if(field === 'targetDay') entry.targetDay = Math.max(0, parseInt(value) || 0);
  saveState(); renderPinnedRecipesEditor();
}
function removePinnedRecipe(recipeId, variant = 'original'){
  if(!Array.isArray(state.prefs?.pinnedRecipes)) return;
  state.prefs.pinnedRecipes = state.prefs.pinnedRecipes.filter(p => !(p.recipeId === recipeId && (p.variant || 'original') === (variant || 'original')));
  saveState(); renderPinnedRecipesEditor();
}
function clearPinnedRecipes(){
  if(!getPinnedRecipesList().length) return;
  openAppConfirmModal('Clear Pre-selected Recipes?','This removes all pre-selected recipes from the planner options.','Clear all',()=>{
    state.prefs.pinnedRecipes = []; saveState(); renderPinnedRecipesEditor();
  });
}
function lockProductSelectionsForSlots(slots, priority){
  const selections = {};
  Object.values(slots || {}).forEach(day => {
    Object.values(day || {}).forEach(slot => {
      const r = getPlanSlotInfo(slot).active;
      if(!r) return;
      (r.ingredients || []).forEach(ing => {
        const groupId = getRecipeIngredientGroupId(ing);
        if(!groupId || selections[groupId]) return;
        const best = selectBestProductForGroup(groupId, priority) || resolveProductForIngredient(ing).product;
        if(best) selections[groupId] = best.id;
      });
    });
  });
  return selections;
}
function findProductResolutionBlockersForSlots(slots, selections = {}){
  const blockers = [];
  const seen = new Set();
  Object.values(slots || {}).forEach(day => {
    Object.values(day || {}).forEach(slot => {
      const r = getPlanSlotInfo(slot).active;
      if(!r) return;
      (r.ingredients || []).forEach(ing => {
        if(ing.excludeNutrition) return;
        const groupId = getRecipeIngredientGroupId(ing);
        if(!groupId || seen.has(groupId)) return;
        const resolved = resolveProductForIngredient(ing, { productSelections: selections });
        if(!resolved.product || !isUsableProduct(resolved.product)){
          seen.add(groupId);
          blockers.push(resolved.group?.name || ing.name || ing.raw || 'Ingredient');
        }
      });
    });
  });
  return blockers;
}
function isAllowedZeroNutritionIngredient(ing) { return window.DataQualityService?.isAllowedZeroNutritionIngredient(ing) ?? false; }
function hasUsableIngredientNutrition(ing) { return window.DataQualityService?.hasUsableIngredientNutrition(ing) ?? false; }
function isGarlicIngredient(ing, bankIng){
  const text = `${ing?.raw || ''} ${ing?.name || ''} ${bankIng?.name || ''}`.toLowerCase();
  return text.includes('garlic');
}
function isFreshGarlicIngredient(ing, bankIng){
  const text = `${ing?.raw || ''} ${ing?.name || ''} ${bankIng?.name || ''}`.toLowerCase();
  if(!text.includes('garlic')) return false;
  if(/\b(powder|granules|granulated|dried|ground|seasoning|salt|paste|puree|purée|oil|bread|baguette|sauce)\b/.test(text)) return false;
  return true;
}
function isGarlicCloveIngredient(ing, bankIng){
  const text = `${ing?.raw || ''} ${ing?.name || ''} ${bankIng?.name || ''}`.toLowerCase();
  return isFreshGarlicIngredient(ing, bankIng) && (text.includes('clove') || text.includes('cloves'));
}
function getRecipeIngredientGrams(ing, bankIng){
  if(!ing || typeof ing !== 'object') return 0;
  const unit = (ing.unit || '').toLowerCase().replace(/s$/,'');
  const qty = +ing.qty || 0;
  const storedGrams = +ing.grams || 0;
  if(unit === 'qty') {
    if(isGarlicCloveIngredient(ing, bankIng)) return Math.round(qty * 6);
    const itemWeight = +bankIng?.itemWeight || 0;
    if(itemWeight > 0) return Math.round(qty * itemWeight);
    if(storedGrams > 0 && storedGrams !== Math.round(qty * 100)) return storedGrams;
    return 0;
  }
  return storedGrams > 0 ? storedGrams : toGrams(qty, unit, bankIng?.itemWeight || 100);
}
function getEffectiveIngredientGrams(ing, bankIng) { return getRecipeIngredientGrams(ing, bankIng); }
function round1(n) { return Math.round((+n || 0) * 10) / 10; }
function getIngredientContribution(ing, recipe, targetServes){
  if(!ing) return null;
  const resolved = resolveProductForIngredient(ing, recipe?.resolutionContext || {});
  const bankIng = resolved.product;
  if(!bankIng) return null;
  const recipeServes = recipe?.serves || 1;
  const previewServes = targetServes || recipeServes;
  const previewScale = previewServes / recipeServes;
  const mealType = getContextMealType(recipe, recipe?.instanceId || null, (recipe?.types && recipe.types[0]) || recipe?.type || 'dinner');
  const recipeNutrition = calcRecipeNutrition(recipe.ingredients || [], recipeServes, recipe?.resolutionContext || {});
  const portions = calcPortions(recipeNutrition.perServing, state.prefs, previewServes, recipe?.who || 'both', mealType);
  const effectiveG = getEffectiveIngredientGrams(ing, bankIng) * previewScale;
  const itemNutrition = calculateItemNutrition(bankIng, effectiveG, 'g');
  const counted = !ing.excludeNutrition;
  const total = counted ? {
    cal: itemNutrition.kcal,
    prot: itemNutrition.protein,
    carb: itemNutrition.carbs,
    fat: itemNutrition.fat,
    fibre: itemNutrition.fibre
  } : {cal:0, prot:0, carb:0, fat:0, fibre:0};
  const eFactor = (portions.eRecipePct || 0) / 100;
  const cFactor = (portions.cRecipePct || 0) / 100;
  const person = factor => ({
    cal: Math.round(total.cal * factor),
    prot: round1(total.prot * factor),
    carb: round1(total.carb * factor),
    fat: round1(total.fat * factor),
    fibre: round1(total.fibre * factor)
  });
  return { bankIng, product: bankIng, group: resolved.group, effectiveG, counted, total, e: person(eFactor), c: person(cFactor), portions };
}
function ingredientContributionTitle(ing, recipe, targetServes){
  const c = getIngredientContribution(ing, recipe, targetServes);
  if(!c) return '';
  const amount = `${Math.round(c.effectiveG * 10) / 10}g effective`;
  const total = `Recipe total: ${c.total.cal} kcal, P ${c.total.prot}g, C ${c.total.carb}g, F ${c.total.fat}g, Fibre ${c.total.fibre}g`;
  const elliott = c.portions.ePct > 0 ? `Elliott portion: ${c.e.cal} kcal, P ${c.e.prot}g, C ${c.e.carb}g, F ${c.e.fat}g, Fibre ${c.e.fibre}g` : 'Elliott portion: not allocated';
  const chloe = c.portions.cPct > 0 ? `Chloe portion: ${c.c.cal} kcal, P ${c.c.prot}g, C ${c.c.carb}g, F ${c.c.fat}g, Fibre ${c.c.fibre}g` : 'Chloe portion: not allocated';
  return `${c.bankIng.name}\nQuantity: ${ing.raw || ing.name || ''}\n${amount}${c.counted ? '' : ' (not counted)'}\n${total}\n${elliott}\n${chloe}`;
}
const REVIEW_NUTRIENTS = {
  cal: { label:'Calories', unit:'kcal' },
  fat: { label:'Fat', unit:'g' },
  carb: { label:'Carbs', unit:'g' },
  fibre: { label:'Fibre', unit:'g' },
  prot: { label:'Protein', unit:'g' }
};
function pctOf(part,total) { return total > 0 ? Math.round((part / total) * 100) : 0; }
function formatContributionValue(key,value){
  const meta = REVIEW_NUTRIENTS[key] || { unit:'' };
  const rounded = key === 'cal' ? Math.round(value || 0) : round1(value || 0);
  return `${rounded}${meta.unit ? ' ' + meta.unit : ''}`;
}
let nutritionDetailsTrigger=null;
function ensureReviewTooltip(){
  let wrap=document.getElementById('review-hover-tip');
  if(wrap)wrap.remove();
  wrap=document.createElement('div');
  wrap.id='review-hover-tip';
  wrap.className='modal-wrap nutrition-detail-wrap';
  wrap.innerHTML=`<section class="nutrition-detail-panel" role="document">
    <div class="nutrition-detail-head"><h3 id="nutrition-detail-title" style="margin:0">Nutrition details</h3><button type="button" class="btn sm ghost" onclick="hideReviewTooltip()">Close</button></div>
    <div id="nutrition-detail-content" style="padding-top:10px"></div>
  </section>`;
  wrap.addEventListener('click',event=>{if(event.target===wrap)hideReviewTooltip();});
  document.body.appendChild(wrap);
  return wrap;
}
function positionReviewTooltip(trigger){
  const wrap=document.getElementById('review-hover-tip');
  const panel=wrap?.querySelector('.nutrition-detail-panel');
  if(!wrap||!panel||!trigger||!window.matchMedia('(min-width:700px) and (hover:hover) and (pointer:fine)').matches)return;
  const anchor=trigger.getBoundingClientRect();
  const width=Math.min(380,window.innerWidth-24);
  const left=Math.max(12,Math.min(window.innerWidth-width-12,anchor.left));
  const top=Math.max(12,Math.min(window.innerHeight-panel.offsetHeight-12,anchor.bottom+8));
  panel.style.left=left+'px';
  panel.style.top=top+'px';
}
function showReviewTooltip(trigger,html,title='Nutrition details'){
  if(!html)return;
  hideReviewTooltip(true);
  const wrap=ensureReviewTooltip();
  nutritionDetailsTrigger=trigger||document.activeElement;
  document.getElementById('nutrition-detail-title').textContent=title;
  document.getElementById('nutrition-detail-content').innerHTML=html;
  wrap.classList.add('open');
  positionReviewTooltip(nutritionDetailsTrigger);
  setTimeout(()=>wrap.querySelector('button')?.focus(),0);
}
function hideReviewTooltip(preserveFocus=false){
  const wrap=document.getElementById('review-hover-tip');
  if(wrap){
    wrap.classList.remove('open');
    wrap.remove();
  }
  if(!preserveFocus&&nutritionDetailsTrigger?.isConnected)nutritionDetailsTrigger.focus({preventScroll:true});
  nutritionDetailsTrigger=null;
}
function bindReviewTooltip(el,html,label='Open nutrition details'){
  if(!el)return;
  el.removeAttribute('title');
  el.classList.add('nutrition-detail-trigger');
  if(!/^(BUTTON|INPUT)$/.test(el.tagName)){
    el.setAttribute('role','button');
    el.tabIndex=0;
  }
  el.setAttribute('aria-label',label);
  el.setAttribute('aria-haspopup','dialog');
  el.onclick=event=>{event.stopPropagation();showReviewTooltip(el,html,label);};
  el.onkeydown=event=>{if((event.key==='Enter'||event.key===' ')&&!/^(BUTTON|INPUT)$/.test(el.tagName)){event.preventDefault();showReviewTooltip(el,html,label);}};
  el.onmouseenter=null;el.onmousemove=null;el.onmouseleave=null;
}
function ingredientContributionHtml(ing, recipe, targetServes){
  const c = getIngredientContribution(ing, recipe, targetServes);
  if(!c) return '';
  const totals = calcRecipeNutrition(recipe.ingredients || [], recipe.serves || 1, recipe?.resolutionContext || {}).totalNutrition || {};
  const rows = Object.keys(REVIEW_NUTRIENTS).map(key => {
    const meta = REVIEW_NUTRIENTS[key];
    const pct = pctOf(c.total[key] || 0, totals[key] || 0);
    return `<div style="display:flex;justify-content:space-between;gap:18px;"><span>${meta.label}</span><strong>${pct}%</strong></div>`;
  }).join('');
  const counted = c.counted ? '<span class="tag good">Included</span>' : '<span class="tag warn">Not counted</span>';
  return `<div style="font-weight:700;margin-bottom:4px">${ppEscapeHtml(c.group?.name || ing.name || 'Ingredient')}</div>
    <div style="color:var(--text2);margin-bottom:7px">${ppEscapeHtml(ing.raw || ing.name || '')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:9px">${counted}<span class="tag">${ppEscapeHtml(c.bankIng.name || 'Mapped product')}</span></div>
    ${rows}
    <details class="card-details"><summary>Calculation details</summary>
      <div>Effective mapped quantity: <strong>${round1(c.effectiveG)}g</strong></div>
      <div>Elliott portion: ${c.portions.ePct > 0 ? `${c.e.cal} kcal · ${c.e.prot}g protein` : 'Not allocated'}</div>
      <div>Chloe portion: ${c.portions.cPct > 0 ? `${c.c.cal} kcal · ${c.c.prot}g protein` : 'Not allocated'}</div>
      <div>Nutrition source: Product Bank only.</div>
    </details>`;
}
function nutrientContributionBreakdownHtml(recipe, nutrientKey){
  const meta = REVIEW_NUTRIENTS[nutrientKey];
  if(!meta) return '';
  const totals = calcRecipeNutrition(recipe.ingredients || [], recipe.serves || 1, recipe?.resolutionContext || {}).totalNutrition || {};
  const total = totals[nutrientKey] || 0;
  const rows = (recipe.ingredients || []).map(ing => {
    const c = getIngredientContribution(ing, recipe, recipe.serves);
    if(!c) return null;
    const value = c.total[nutrientKey] || 0;
    return {
      name: c.bankIng.name || ing.name || 'Ingredient',
      value,
      pct: pctOf(value, total)
    };
  }).filter(Boolean).filter(row => row.value > 0).sort((a,b) => b.value - a.value);
  if(!rows.length) return `<div style="font-weight:700;margin-bottom:6px">${meta.label}</div><div style="color:var(--text2)">No mapped counted ingredients contribute to this value.</div>`;
  return `<div style="font-weight:700;margin-bottom:6px">${meta.label}: ${formatContributionValue(nutrientKey, total)}</div>
    <div style="color:var(--text2);margin-bottom:8px">Mapped Product Bank contributors</div>` +
    rows.slice(0, 12).map(row => `<div style="display:flex;justify-content:space-between;gap:18px;"><span>${ppEscapeHtml(row.name)}</span><strong>${row.pct}%</strong></div>`).join('') +
    `<details class="card-details"><summary>Calculation details</summary><div>Calculated only from mapped, counted ingredients. No AI or stored-macro fallback is used.</div></details>`;
}
function portionNutrientContributionBreakdownHtml(recipe, nutrientKey, personPrefix, targetServes){
  const meta = REVIEW_NUTRIENTS[nutrientKey];
  if(!meta) return '';
  const personLabel = personPrefix === 'e' ? 'Elliott' : 'Chloe';
  const rows = (recipe.ingredients || []).map(ing => {
    const c = getIngredientContribution(ing, recipe, targetServes || recipe.serves);
    if(!c) return null;
    const personValues = personPrefix === 'e' ? c.e : c.c;
    const value = personValues[nutrientKey] || 0;
    return {
      name: c.group?.name || c.bankIng.name || ing.name || 'Ingredient',
      value
    };
  }).filter(Boolean).filter(row => row.value > 0).sort((a,b) => b.value - a.value);
  const total = rows.reduce((sum,row) => sum + row.value, 0);
  if(!rows.length) return `<div style="font-weight:700;margin-bottom:6px">${personLabel} ${meta.label} contributors</div><div style="color:var(--text2)">No mapped counted ingredients yet.</div>`;
  return `<div style="font-weight:700;margin-bottom:6px">${personLabel} ${meta.label} contributors</div>` +
    rows.slice(0, 12).map(row => `<div style="display:flex;justify-content:space-between;gap:18px;"><span>${ppEscapeHtml(row.name)}</span><strong>${pctOf(row.value, total)}%</strong></div>`).join('') +
    `<div style="color:var(--text2);margin-top:7px">Portion total: ${formatContributionValue(nutrientKey, total)}</div>`;
}
function bindPortionNutritionTooltips(root, recipe, targetServes){
  if(!root || !recipe) return;
  root.querySelectorAll('.portion-nutrient[data-nutrient][data-person]').forEach(el => {
    const html = portionNutrientContributionBreakdownHtml(recipe, el.dataset.nutrient, el.dataset.person, targetServes);
    bindReviewTooltip(el, html);
  });
}
function updateModalNutritionBreakdownTooltips(prefix, recipe){
  Object.keys(REVIEW_NUTRIENTS).forEach(key => {
    const input = document.getElementById(`${prefix}-${key}`);
    if(!input) return;
    const wrap = input.closest('div');
    const html = nutrientContributionBreakdownHtml(recipe, key);
    let button=wrap?.querySelector(`.nutrition-info-button[data-nutrient="${key}"]`);
    if(wrap&&!button){
      button=document.createElement('button');
      button.type='button';
      button.className='btn sm ghost nutrition-info-button';
      button.dataset.nutrient=key;
      button.textContent='Details';
      wrap.appendChild(button);
    }
    if(button)bindReviewTooltip(button,html,`Open ${REVIEW_NUTRIENTS[key].label} contributors`);
  });
}
function needsItemWeightForQtyIngredient(recipeIng, bankIng){
  if(!recipeIng || recipeIng.excludeNutrition) return false;
  const unit = (recipeIng.unit || '').toLowerCase().replace(/s$/,'');
  if(unit !== 'qty') return false;
  if(isGarlicCloveIngredient(recipeIng, bankIng)) return false;
  return !(+bankIng?.itemWeight > 0);
}
function findRecipeNutritionBlockers(structuredIngs){
  const seen = new Set();
  const blockers = [];
  (structuredIngs || []).forEach(recipeIng => {
    if(recipeIng && recipeIng.excludeNutrition) return;
    if(!recipeIng || (!recipeIng.bankId && !recipeIng.groupId)) return;
    const resolved = resolveProductForIngredient(recipeIng);
    const bankIng = resolved.product;
    if(!bankIng) return;
    if(!hasUsableIngredientNutrition(bankIng)) {
      const key = (resolved.groupId || bankIng.id) + ':nutrition';
      if(seen.has(key)) return;
      seen.add(key);
      blockers.push({ id: bankIng.id, groupId: resolved.groupId, name: resolved.group?.name || bankIng.name || recipeIng.name || recipeIng.raw || 'Ingredient', reason: 'nutrition' });
      return;
    }
    if(needsItemWeightForQtyIngredient(recipeIng, bankIng)) {
      const key = (resolved.groupId || bankIng.id) + ':itemWeight';
      if(seen.has(key)) return;
      seen.add(key);
      blockers.push({ id: bankIng.id, groupId: resolved.groupId, name: resolved.group?.name || bankIng.name || recipeIng.name || recipeIng.raw || 'Ingredient', reason: 'itemWeight' });
    }
  });
  return blockers;
}
function getReviewIngredientDataError(ing, resolved){
  if(!ing || typeof ing !== 'object' || !String(ing.name || '').trim()) return '';
  if(ing.excludeNutrition) return '';
  const product = resolved?.product || null;
  if(!product && !resolved?.group) return 'This ingredient is not mapped yet. Search and select an ingredient or sub-type.';
  if(product && !hasUsableIngredientNutrition(product)) return 'Missing nutrition data for the mapped product. Edit the product to add calories, protein, carbs, fat and fibre.';
  if(product && needsItemWeightForQtyIngredient(ing, product)) return 'Missing weight of 1 item for this quantity-based ingredient. Edit the product to add weight of 1 item.';
  return '';
}
/**
 * Single Canonical Nutrition Engine
 * Pure dynamic calculation contract:
 * - Rule A: Calculated macros are calculated dynamically on render, NEVER saved to Firestore or state.
 * - Rule B: Unit normalization converts volume/weight/counted units to grams using lookup tables.
 * - Rule C: Zero-fallback contract: { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, cost: 0, cal: 0, prot: 0, carb: 0 }.
 */
function calculateItemNutrition(item, quantity, unit = 'g'){
  if (window.NutritionService?.calculateItemNutrition) { return window.NutritionService.calculateItemNutrition(item, quantity, unit); }
  return { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, cost: 0, cal: 0, prot: 0, carb: 0 };
}
window.calculateItemNutrition = calculateItemNutrition;
function calcRecipeNutrition(structuredIngs,serves,context={}){
  let cal=0,prot=0,carb=0,fat=0,fibre=0,cost=0;
  let matched=0,ingCount=(structuredIngs||[]).length;
  for(const ing of (structuredIngs||[])){
    if(isIngredientRemovedInContext(ing, context)) continue;
    if(!ing.bankId && !ing.groupId)continue;
    const adjustedIng = getAdjustedIngredientForContext(ing, context);
    const bankIng=resolveProductForIngredient(adjustedIng, context).product;
    if(!bankIng)continue;
    matched++;
    let g = getEffectiveIngredientGrams(adjustedIng, bankIng);
    const itemNutrition = calculateItemNutrition(bankIng, g, 'g');
    if(!adjustedIng.excludeNutrition) {
      cal += itemNutrition.kcal;
      prot += itemNutrition.protein;
      carb += itemNutrition.carbs;
      fat += itemNutrition.fat;
      fibre += itemNutrition.fibre;
    }
    cost += itemNutrition.cost;
  }
  const s = serves || 1;
  const totalNutrition = {
    cal:   Math.round(cal),
    prot:  Math.round(prot  * 10) / 10,
    carb:  Math.round(carb  * 10) / 10,
    fat:   Math.round(fat   * 10) / 10,
    fibre: Math.round(fibre * 10) / 10,
    cost:  Math.round(cost  * 100) / 100
  };
  const perServing = {
    cal:   Math.round(cal   / s),
    prot:  Math.round(prot  * 10 / s) / 10,
    carb:  Math.round(carb  * 10 / s) / 10,
    fat:   Math.round(fat   * 10 / s) / 10,
    fibre: Math.round(fibre * 10 / s) / 10,
    cost:  Math.round(cost  * 100 / s) / 100
  };
  return { ...perServing, totalNutrition, perServing, matched, total: ingCount };
}
function recalcRecipeObject(r){
  if(!r || !r.ingredients || !r.ingredients.length) return false;
  const bundle = calculateRecipeDisplayNutrition({ recipe:r, variant:'original' });
  const n = bundle?.nutrition;
  if(!n || !n.matched) return false;
  const ps = n.perServing;
  r.cal=ps.cal; r.prot=ps.prot; r.carb=ps.carb; r.fat=ps.fat; r.fibre=ps.fibre;
  r.nutrition = { total: n.totalNutrition, perServing: ps };
  r.estimated = (n.matched < n.total);
  r.portions = bundle.portions;
  if(r.enhanced && r.enhanced.ingredients && r.enhanced.ingredients.length){
    const eb = calculateRecipeDisplayNutrition({ recipe:r, variant:'enhanced' });
    const en = eb?.nutrition;
    if(en) {
      const eps = en.perServing;
      r.enhanced.cal=eps.cal; r.enhanced.prot=eps.prot; r.enhanced.carb=eps.carb; r.enhanced.fat=eps.fat; r.enhanced.fibre=eps.fibre;
      r.enhanced.nutrition = { total: en.totalNutrition, perServing: eps };
    }
  }
  return true;
}
function recalcAllRecipes(){
  if(!state || !Array.isArray(state.recipes)) return 0;
  let changed = 0;
  state.recipes.forEach(r => { if(recalcRecipeObject(r)) changed++; });
  return changed;
}
function relinkSubtypeProductsInRecipes(subtypeId, preferredProductId) {
  if (!subtypeId || !preferredProductId) return 0;
  const group = getIngredientGroup(subtypeId);
  const product = getProduct(preferredProductId);
  if (group) {
    group.defaultProductId = preferredProductId;
    group.productId = preferredProductId;
    if (!Array.isArray(group.productIds)) group.productIds = [];
    if (!group.productIds.includes(preferredProductId)) group.productIds.push(preferredProductId);
  }
  if (product && product.groupId !== subtypeId) { product.groupId = subtypeId; }
  let updatedRecipeCount = 0;
  const allRecipes = Array.isArray(state?.recipes) ? state.recipes : [];
  allRecipes.forEach(recipe => {
    let touched = false;
    const processIngredient = (ing) => {
      if (!ing) return;
      const ingGroupId = getRecipeIngredientGroupId(ing) || ing.groupId || '';
      if (ingGroupId === subtypeId || ing.bankId === preferredProductId) {
        ing.bankId = preferredProductId;
        ing.groupId = subtypeId;
        touched = true;
      }
    };
    (recipe.ingredients || []).forEach(processIngredient);
    if (recipe.enhanced && Array.isArray(recipe.enhanced.ingredients)) {
      recipe.enhanced.ingredients.forEach(processIngredient);
    }
    if (touched) {
      recalcRecipeObject(recipe);
      updatedRecipeCount++;
    }
  });
  refreshPlatePlanDerivedState({
    changedProductIds: [preferredProductId],
    changedGroupIds: [subtypeId],
    persist: true,
    render: true
  });
  return updatedRecipeCount;
}
window.relinkSubtypeProductsInRecipes = relinkSubtypeProductsInRecipes;
function refreshProductGroupAndRecipes(productId){
  const product = getProduct(productId);
  if(product?.groupId) {
    const group = getIngredientGroup(product.groupId);
    if(group) {
      if(!Array.isArray(group.productIds)) group.productIds = [];
      if(!group.productIds.includes(product.id)) group.productIds.push(product.id);
      syncIngredientGroupAliases(group, getGroupProducts(group.id));
    }
  }
  return refreshPlatePlanDerivedState({ changedProductIds:[productId], render:true });
}
function refreshAutoDefaultTypeForIngredientFamily(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return '';
  const bestProduct = selectBestProductForIngredientFamily(familyId, 'protein_per_kcal');
  if(bestProduct?.groupId && getIngredientGroup(bestProduct.groupId)) {
    family.defaultTypeId = bestProduct.groupId;
    return family.defaultTypeId;
  }
  const groups = getFamilyGroups(familyId);
  if(!family.defaultTypeId || !groups.some(g => g.id === family.defaultTypeId)) {
    family.defaultTypeId = groups[0]?.id || '';
  }
  return family.defaultTypeId;
}
function refreshAllProductDefaultsAndRecipeNutrition(){
  ensureIngredientGroups();
  ensureIngredientFamilies();
  const changedDefaults = refreshAllAutoDefaultProducts(state) || [];
  (state.ingredientFamilies || []).forEach(family => refreshAutoDefaultTypeForIngredientFamily(family.id));
  const changedRecipes = recalcAllRecipes();
  if (state.plan?.slots && typeof calculatePlanScore === 'function') { state.plan.score = calculatePlanScore(state.plan); }
  return { changedDefaults, changedRecipes };
}
function renderPlatePlanDependentViews(){
  markPlatePlanViewsDirty();
  const active=document.querySelector('.view.active')?.id?.replace('view-','')||'today';
  const renderers={today:renderToday,vault:renderVault,ingredients:renderIngredientBank,bank:renderBank,planner:renderPlan,planlib:renderPlanHistoryPanel,shopping:renderShopping,data:renderDataQuality,prefs:loadPrefs};
  if (renderers[active]) { renderers[active](); platePlanDirtyViews.delete(active); }
  if(mappingContext && document.getElementById('mapping-modal-wrap')?.classList.contains('open')) renderMappingList();
  if(document.getElementById('modal-wrap')?.classList.contains('open')){
    recalcModal('orig');
    recalcModal('enh');
  }
}
function refreshPlatePlanDerivedState({ persist = false, render = true, changedProductIds = [], changedGroupIds = [], changedRecipeIds = [], full = false } = {}){
  platePlanNutritionCache.clear();
  platePlanUseUpCoverageCache.clear();
  ensureIngredientGroups();
  ensureIngredientFamilies();
  rebuildPlatePlanIndexes();
  const hasScope=changedProductIds.length||changedGroupIds.length||changedRecipeIds.length;
  let result;
  if (full||!hasScope) { result=refreshAllProductDefaultsAndRecipeNutrition(); }else{
    const groupIds=new Set(changedGroupIds);
    changedProductIds.forEach(id=>{ const product=getProduct(id); if(product?.groupId) groupIds.add(product.groupId); });
    const changedDefaults=[];
    groupIds.forEach(groupId=>{
      const group=getIngredientGroup(groupId); if(!group) return;
      const before=group.defaultProductId||''; refreshAutoDefaultProductForGroup(groupId);
      if(before!==(group.defaultProductId||'')) changedDefaults.push({groupId,before,after:group.defaultProductId||''});
      if(group.ingredientId) refreshAutoDefaultTypeForIngredientFamily(group.ingredientId);
    });
    const recipeIds=new Set(changedRecipeIds);
    [...changedProductIds,...groupIds].forEach(key=>(platePlanIndexes.recipeDependencies.get(key)||[]).forEach(id=>recipeIds.add(id)));
    let changedRecipes=0;
    recipeIds.forEach(id=>{ const recipe=getProductIndexRecipe(id); if(recipe&&recalcRecipeObject(recipe)) changedRecipes++; });
    if(state.plan?.slots&&typeof calculatePlanScore==='function') state.plan.score=calculatePlanScore(state.plan);
    result={changedDefaults,changedRecipes};
  }
  rebuildPlatePlanIndexes();
  if(persist) saveState();
  if(render) renderPlatePlanDependentViews();
  return result;
}
function recalcRecipesUsingIngredient(bankId){
  if(!state || !Array.isArray(state.recipes) || !bankId) return 0;
  const product = getProduct(bankId);
  const groupId = product?.groupId || '';
  const uses = ing => ing && (ing.bankId === bankId || (groupId && getRecipeIngredientGroupId(ing) === groupId));
  let changed = 0;
  state.recipes.forEach(r => {
    const usesOriginal = (r.ingredients||[]).some(uses);
    const usesEnhanced = !!(r.enhanced && r.enhanced.ingredients && r.enhanced.ingredients.some(uses));
    if (usesOriginal || usesEnhanced) { if(recalcRecipeObject(r)) changed++; }
  });
  return changed;
}
function recalcRecipeNutrition(id){
  const r = state.recipes.find(x=>x.id===id);
  if (!r) { openAppInfoModal('Recipe unavailable','The recipe could not be found.'); return; }
  if (!r.ingredients || !r.ingredients.length) { openAppInfoModal('Ingredients needed','This recipe has no ingredients to recalculate.'); return; }
  const n = calcRecipeNutrition(r.ingredients, r.serves||1);
  if (!n.matched) { openAppInfoModal('Mapped products needed','None of this recipe\u2019s ingredients are mapped to Product Bank yet.'); return; }
  recalcRecipeObject(r);
  saveState();
  if(typeof renderVault==='function') renderVault();
  showPlatePlanToast(`Recalculated with ${n.matched} of ${n.total} mapped ingredients.`);
}
function calcPortions(perServing, prefs, serves = 2, who = 'both', mealType = 'dinner') {
  const totalServes = +serves || 0;
  const whoKey = String(who || 'both').trim().toLowerCase();
  const empty = {e:'—', c:'—', eServ:0, cServ:0, eSingleServ:0, cSingleServ:0, ePct:0, cPct:0, eRecipePct:0, cRecipePct:0,
                 eCal:0, eProt:0, eCarb:0, eFat:0, eFibre:0, cCal:0, cProt:0, cCarb:0, cFat:0, cFibre:0,
                 eTgt:{cal:0,prot:0}, cTgt:{cal:0,prot:0}, mealType, capped:false};
  if (totalServes <= 0) return empty;
  const eTgt = getBudgets('e', mealType);
  const cTgt = getBudgets('c', mealType);
  const mealKey = mealType && mealType.includes('breakfast') ? 'b'
    : mealType && mealType.includes('lunch') ? 'l'
    : mealType && mealType.includes('snack') ? 's'
    : 'd';
  const defaultEAlloc = {b:15,l:25,d:45,s:15};
  const defaultCAlloc = {b:25,l:30,d:35,s:10};
  const eAlloc = +((prefs?.eAlloc || {}).hasOwnProperty(mealKey) ? prefs.eAlloc[mealKey] : defaultEAlloc[mealKey]) || 0;
  const cAlloc = +((prefs?.cAlloc || {}).hasOwnProperty(mealKey) ? prefs.cAlloc[mealKey] : defaultCAlloc[mealKey]) || 0;
  let eServ = 0, cServ = 0;
  let activePeople = 0;
  if (whoKey === 'elliott' || whoKey === 'e') {
    eServ = totalServes;
    activePeople = 1;
  } else if (whoKey === 'chloe' || whoKey === 'c') {
    cServ = totalServes;
    activePeople = 1;
  } else {
    activePeople = 2;
    const eMealBudget = +eTgt.cal || 0;
    const cMealBudget = +cTgt.cal || 0;
    const totalMealBudget = eMealBudget + cMealBudget;
    if (totalMealBudget > 0) {
      eServ = totalServes * (eMealBudget / totalMealBudget);
      cServ = totalServes * (cMealBudget / totalMealBudget);
    } else {
      const totalAlloc = eAlloc + cAlloc;
      if (totalAlloc > 0) {
        eServ = totalServes * (eAlloc / totalAlloc);
        cServ = totalServes * (cAlloc / totalAlloc);
      } else {
        eServ = totalServes / 2;
        cServ = totalServes / 2;
      }
    }
  }
  const mealOccasions = totalServes / activePeople;
  const eSingleServ = mealOccasions ? eServ / mealOccasions : 0;
  const cSingleServ = mealOccasions ? cServ / mealOccasions : 0;
  const ePct = totalServes ? Math.round((eServ / totalServes) * 100) : 0;
  const cPct = totalServes ? Math.round((cServ / totalServes) * 100) : 0;
  const eRecipePct = totalServes ? Math.round((eSingleServ / totalServes) * 100) : 0;
  const cRecipePct = totalServes ? Math.round((cSingleServ / totalServes) * 100) : 0;
  const macro = (key, serv, roundWhole=false) => {
    const val = (+perServing[key] || 0) * serv;
    return roundWhole ? Math.round(val) : Math.round(val * 10) / 10;
  };
  const eCal = macro('cal', eSingleServ, true);
  const eProt = macro('prot', eSingleServ);
  const eCarb = macro('carb', eSingleServ);
  const eFat = macro('fat', eSingleServ);
  const eFibre = macro('fibre', eSingleServ);
  const cCal = macro('cal', cSingleServ, true);
  const cProt = macro('prot', cSingleServ);
  const cCarb = macro('carb', cSingleServ);
  const cFat = macro('fat', cSingleServ);
  const cFibre = macro('fibre', cSingleServ);
  const fmtPct = pct => pct > 0 ? `${pct}%` : '—';
  return {
    e: fmtPct(ePct),
    c: fmtPct(cPct),
    eServ, cServ, eSingleServ, cSingleServ, ePct, cPct, eRecipePct, cRecipePct,
    eCal, eProt, eCarb, eFat, eFibre,
    cCal, cProt, cCarb, cFat, cFibre,
    eTgt, cTgt, mealType, capped:false
  };
}
function getRecipeVariantForDisplay(recipe, variant = 'original', instanceId = null, planContext = state.plan, overrideStore = state.overrides){
  if(!recipe) return null;
  const useEnhanced = variant === 'enhanced' && recipe.enhanced;
  const enh = useEnhanced ? recipe.enhanced : {};
  const steps = useEnhanced
    ? (enh.method || enh.steps || recipe.steps || recipe.method || [])
    : (recipe.steps || recipe.method || []);
  const ingredients = useEnhanced
    ? (enh.ingredients || recipe.ingredients || [])
    : (recipe.ingredients || []);
  const active = {
    ...recipe,
    id: recipe.id,
    name: useEnhanced ? (enh.name || recipe.name) : recipe.name,
    ingredients,
    steps,
    method: steps,
    changes: useEnhanced ? (enh.changes || '') : (recipe.changes || ''),
    types: recipe.types || (recipe.type ? [recipe.type] : ['dinner']),
    type: recipe.type || (recipe.types && recipe.types[0]) || 'dinner',
    serves: +recipe.serves || 1,
    who: recipe.who || 'both',
    time: recipe.time || null,
    source: recipe.source || '',
    isEnhancedView: !!useEnhanced,
    instanceId,
    resolutionContext: getPlanContextForInstance(instanceId, planContext, overrideStore)
  };
  return active;
}
function calculateRecipeDisplayNutrition({ recipe, variant = 'original', ingredients = null, serves = null, who = null, mealType = null, instanceId = null, targetServes = null, planContext = state.plan, overrideStore = state.overrides } = {}){
  const active = recipe
    ? getRecipeVariantForDisplay(recipe, variant, instanceId, planContext, overrideStore)
    : {
        name: '',
        ingredients: ingredients || [],
        steps: [],
        types: mealType ? [mealType] : ['dinner'],
        type: mealType || 'dinner',
        serves: +serves || 1,
        who: who || 'both',
        resolutionContext: getPlanContextForInstance(instanceId, planContext, overrideStore)
      };
  if(!active) return null;
  if(Array.isArray(ingredients)) active.ingredients = ingredients;
  if(serves != null) active.serves = +serves || 1;
  if(who) active.who = who;
  if(!active.resolutionContext) active.resolutionContext = getPlanContextForInstance(instanceId, planContext, overrideStore);
  const types = active.types || [active.type || 'dinner'];
  const resolvedMealType = mealType || getContextMealType(active, instanceId, types[0] || 'dinner');
  const ingLen = (active.ingredients || []).length;
  const ingSig = ingLen ? (active.ingredients[0]?.id || active.ingredients[0]?.bankId || active.ingredients[0]?.name || '') : '';
  const recipeUpdated = recipe?.updatedAt || '';
  const cacheKey = recipe?.id
    ? `${recipe.id}:${recipeUpdated}:${variant}:${instanceId||''}:${targetServes||''}:${serves||''}:${who||''}:${resolvedMealType}:${ingLen}:${ingSig}:${state.prefs?.ecal||''}:${state.prefs?.eprot||''}:${state.prefs?.ccal||''}:${state.prefs?.cprot||''}:${safeJsonStringify(state.prefs?.eAlloc||{})}:${safeJsonStringify(state.prefs?.cAlloc||{})}:${safeJsonStringify(state.prefs?.eProtAlloc||{})}:${safeJsonStringify(state.prefs?.cProtAlloc||{})}`
    : '';
  if(cacheKey&&platePlanNutritionCache.has(cacheKey)) return platePlanNutritionCache.get(cacheKey);
  const nutrition = (active.ingredients && active.ingredients.length)
    ? calcRecipeNutrition(active.ingredients, active.serves || 1, active.resolutionContext || {})
    : (() => {
        const zero = { cal:0, prot:0, carb:0, fat:0, fibre:0, cost:0 };
        return { ...zero, perServing:{...zero}, totalNutrition:{...zero}, matched:0, total:0, missingData:true };
      })();
  const portions = calcPortions(nutrition.perServing || nutrition, state.prefs, +targetServes || +active.serves || 1, active.who || 'both', resolvedMealType);
  const resolvedIngredients = (active.ingredients || []).map(ing => {
    if(!ing || typeof ing !== 'object') return { ing, adjusted: ing, resolved: {}, warning: '' };
    const adjusted = getAdjustedIngredientForContext(ing, active.resolutionContext || {});
    const resolved = resolveProductForIngredient(adjusted, active.resolutionContext || {});
    return { ing, adjusted, resolved, warning: getIngredientMappingWarning(ing, resolved) };
  });
  const result={
    active,
    ingredients: active.ingredients || [],
    resolvedIngredients,
    serves: +active.serves || 1,
    targetServes: +targetServes || +active.serves || 1,
    types,
    mealType: resolvedMealType,
    resolutionContext: active.resolutionContext || {},
    nutrition,
    perServing: nutrition.perServing || nutrition,
    totalNutrition: nutrition.totalNutrition || nutrition,
    portions,
    warnings: resolvedIngredients.map(x => x.warning).filter(Boolean)
  };
  if(cacheKey) platePlanNutritionCache.set(cacheKey,result);
  return result;
}
function ingredientDisplayNameForRecipe(ing){
  if(!ing || typeof ing !== 'object') return ingRaw(ing);
  const parsed = normaliseRecipeAmountForUi ? normaliseRecipeAmountForUi(ing) : ing;
  const qty = parsed.qty ?? ing.qty ?? '';
  const unit = parsed.unit ?? ing.unit ?? '';
  const name = ing.name || '';
  return `${qty || ''} ${unit && unit !== 'qty' ? unit : ''} ${name}`.trim() || ingRaw(ing);
}
function getIngredientMappingWarning(ing, resolved) { return ''; }
function renderIngredientMappingNote(ing, resolved, options = {}){
  if(!ing || typeof ing !== 'object' || !resolved) return '';
  const groupName = resolved.group?.name || '';
  const productName = resolved.product?.name || '';
  if(!groupName && !productName) return '';
  const mappedText = `mapped to ${groupName || productName}${productName ? ' using ' + productName : ''}`;
  const color = options.color || 'var(--text3)';
  return ` <span class="muted" style="color:${color};font-size:${options.fontSize || '11px'}">${ppEscapeHtml(mappedText)}</span>`;
}
function portionDeltaText(actual, target, unit) { if (!target) return '—'; const pct = Math.round(((actual - target) / target) * 100); return pct === 0 ? `On target` : `${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} target`; }
function portionDeltaColor(actual, target) { if (!target) return 'var(--text2)'; const pct = Math.abs(((actual - target) / target) * 100); return pct <= 10 ? 'var(--green)' : (pct <= 15 ? 'var(--amber)' : 'var(--red)'); }
function proteinTargetText(actual, target) { if (!target) return '—'; const pct = Math.round(((actual - target) / target) * 100); return pct === 0 ? 'On target' : `${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} target`; }
function proteinTargetColor(actual, target) { if (!target) return 'var(--text2)'; const pct = ((actual - target) / target) * 100; if (pct >= 0 || Math.abs(pct) <= 10) return 'var(--green)'; return Math.abs(pct) <= 15 ? 'var(--amber)' : 'var(--red)'; }
function renderPortionField(label, value, nutrientKey = '', personPrefix = '') {
  const attrs = nutrientKey ? ` class="portion-nutrient" data-nutrient="${nutrientKey}" data-person="${personPrefix}" style="cursor:help"` : '';
  return `
    <div${attrs}>
      <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:5px">${label}</div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 11px;font-size:18px;color:var(--text);line-height:1.2">${value}</div>
    </div>
  `;
}
function renderPortionTargetBox(label, portions, prefix) {
  const isE = prefix === 'e';
  const pct = isE ? portions.ePct : portions.cPct;
  if (pct <= 0) return '';
  const cal = isE ? portions.eCal : portions.cCal;
  const prot = isE ? portions.eProt : portions.cProt;
  const carb = isE ? portions.eCarb : portions.cCarb;
  const fat = isE ? portions.eFat : portions.cFat;
  const fibre = isE ? portions.eFibre : portions.cFibre;
  const tgt = isE ? portions.eTgt : portions.cTgt;
  const calColor = portionDeltaColor(cal, tgt.cal);
  const protColor = proteinTargetColor(prot, tgt.prot);
  return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px;">
      <div style="font-weight:700;font-size:12px;margin-bottom:10px">${label} Portion (${pct}%)</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:10px;">
        ${renderPortionField('Calories (Energy)', cal, 'cal', prefix)}
        ${renderPortionField('Fat (g)', fat, 'fat', prefix)}
        ${renderPortionField('Carbs (g)', carb, 'carb', prefix)}
        ${renderPortionField('Fibre (g)', fibre, 'fibre', prefix)}
        ${renderPortionField('Protein (g)', prot, 'prot', prefix)}
      </div>
      <div style="font-size:12px;color:var(--text2);display:grid;grid-template-columns:1fr 1fr;gap:5px 10px;border-top:1px solid var(--border);padding-top:9px;">
        <div>Target calories</div><strong style="color:var(--text)">${Math.round(tgt.cal)} kcal</strong>
        <div>Calories vs target</div><strong style="color:${calColor}">${portionDeltaText(cal, tgt.cal, 'kcal')}</strong>
        <div>Target protein</div><strong style="color:var(--text)">${Math.round(tgt.prot)}g</strong>
        <div>Protein vs target</div><strong style="color:${protColor}">${proteinTargetText(prot, tgt.prot)}</strong>
      </div>
    </div>
  `;
}
function renderAllocatedNutritionLine(label, portions, prefix) {
  const isE = prefix === 'e';
  const pct = isE ? portions.ePct : portions.cPct;
  const recipePct = isE ? portions.eRecipePct : portions.cRecipePct;
  if (pct <= 0) return '';
  const cal = isE ? portions.eCal : portions.cCal;
  const prot = isE ? portions.eProt : portions.cProt;
  const carb = isE ? portions.eCarb : portions.cCarb;
  const fat = isE ? portions.eFat : portions.cFat;
  const fibre = isE ? portions.eFibre : portions.cFibre;
  return `
    <div style="font-size:12px;color:var(--text2);margin-top:4px">
      <strong>${label} single portion (${recipePct}% of recipe):</strong>
      ${cal} kcal &nbsp;|&nbsp; P ${prot}g &nbsp;|&nbsp; C ${carb}g &nbsp;|&nbsp; F ${fat}g${fibre ? ` &nbsp;|&nbsp; Fibre ${fibre}g` : ''}
    </div>
  `;
}
function getIngredientUsage(bankId) {
  if (window.TodayViewService?.getIngredientUsage) { return window.TodayViewService.getIngredientUsage(bankId, state, formatPlanDayLabel); }
  return { recipes: [], plans: [] };
}
let platePlanTodayDate='';
let platePlanTodayTimer=null;
let platePlanLastActualDate='';
function getPlatePlanLocalToday() { return window.TodayViewService?.getPlatePlanLocalToday() || formatPlanLocalDateValue(new Date()); }
function formatTodayDateLabel(value) { return window.TodayViewService?.formatTodayDateLabel(value) || ''; }
function resetTodayDate({render=true}={}){
  platePlanTodayDate=getPlatePlanLocalToday();
  platePlanLastActualDate=platePlanTodayDate;
  if(render) renderToday();
}
function moveTodayDate(amount){
  const date=parsePlanLocalDate(platePlanTodayDate)||parsePlanLocalDate(getPlatePlanLocalToday());
  date.setDate(date.getDate()+(+amount||0));
  platePlanTodayDate=formatPlanLocalDateValue(date);
  renderToday();
}
function getTodayPlanDay(dateValue,planContext=state?.plan) { return window.TodayViewService?.getTodayPlanDay(dateValue, planContext) ?? ''; }
function getNextDatedPlanDay(dateValue,planContext=state?.plan) { return window.TodayViewService?.getNextDatedPlanDay(dateValue, planContext) ?? null; }
function stablePlatePlanValue(value) { return window.TodayViewService?.stablePlatePlanValue(value) ?? value; }
function getTodayResolvedFingerprint(info,mealType) { return window.TodayViewService?.getTodayResolvedFingerprint(info, mealType, getPlanContextForInstance(info?.instanceId)) ?? ''; }
function getTodaySlotEntry(day,slotKey,person,mealType){
  if(state.excluded?.[day]?.[slotKey]) return null;
  const info=getPlanSlotInfo(state.plan?.slots?.[day]?.[slotKey]);
  if(!info.active) return null;
  const calculated=getPlannedSlotNutrition(info.active,slotKey,info.instanceId,state.plan);
  return {day,slotKey,person,mealType,info,calculated,fingerprint:getTodayResolvedFingerprint(info,mealType)};
}
function renderTodayPersonPanel(person,label,entries){
  const rows=['breakfast','lunch','dinner'].map(mealType=>{
    const entry=entries.find(item=>item.person===person&&item.mealType===mealType);
    const actualCal=Math.round(entry?.calculated?.cal||0);
    const actualProt=Math.round((entry?.calculated?.prot||0)*10)/10;
    const target=getBudgets(person,mealType);
    const calPct=target.cal?Math.min(100,Math.round(actualCal/target.cal*100)):0;
    const protPct=target.prot?Math.min(100,Math.round(actualProt/target.prot*100)):0;
    return `<div class="today-target-row">
      <div class="today-target-meal">${ppEscapeHtml(toTitleCase(mealType))}</div>
      <div class="today-target-values">
        <div class="today-target-line"><span>${actualCal} / ${Math.round(target.cal)} kcal</span><span>${actualProt} / ${Math.round(target.prot)}g protein</span></div>
        <div class="today-progress" role="progressbar" aria-label="${ppEscapeAttr(toTitleCase(mealType))} calories" aria-valuemin="0" aria-valuemax="${Math.round(target.cal)}" aria-valuenow="${actualCal}"><span style="--progress:${calPct}%"></span></div>
        <div class="today-progress protein" role="progressbar" aria-label="${ppEscapeAttr(toTitleCase(mealType))} protein" aria-valuemin="0" aria-valuemax="${Math.round(target.prot)}" aria-valuenow="${actualProt}" style="margin-top:4px"><span style="--progress:${protPct}%"></span></div>
      </div>
    </div>`;
  }).join('');
  return `<section class="today-person" aria-label="${ppEscapeAttr(label)} meal nutrition">
    <div class="today-person-head"><div class="today-person-name">${ppEscapeHtml(label)}</div><div class="today-person-copy">Meal allocation</div></div>
    ${rows}
  </section>`;
}
function isMealEatenOnDate(dateStr, mealType, person = 'both') { return window.TodayViewService?.isMealEatenOnDate(state.plan?.eatenMeals, dateStr, mealType, person) ?? false; }
function toggleMealEatenOnDate(dateStr, mealType, person = 'both'){
  if(!state.plan) return;
  state.plan.eatenMeals = state.plan.eatenMeals || {};
  if (window.TodayViewService?.calculateMealEatenUpdates) {
    const { nextEaten, toastMessage } = window.TodayViewService.calculateMealEatenUpdates(state.plan.eatenMeals, dateStr, mealType, person);
    state.plan.eatenMeals = nextEaten;
    if (toastMessage) showPlatePlanToast(toastMessage);
  }
  saveState(true);
  if(platePlanCloudReady && !platePlanSyncSuppress) queuePlatePlanCloudDiff();
  if(document.getElementById('view-today')?.classList.contains('active')) renderToday();
}
function renderTodayMealCard(group, mealType = 'dinner'){
  const isShared = group.length === 2, entry = group[0], info = entry.info, personKey = isShared ? 'both' : entry.person, isEaten = isMealEatenOnDate(platePlanTodayDate, mealType, personKey), people = group.map(item=>item.person==='e'?'Elliott':'Chloe');
  const macroText = `${Math.round(entry.calculated?.cal||0)} kcal · ${round1(entry.calculated?.prot||0)}g protein`;
  const portions = group.map(item=>{
    const nutrition = item.calculated||{}, portionValue = item.person==='e' ? item.calculated?.portions?.eSingleServ : item.calculated?.portions?.cSingleServ;
    return `<div class="today-portion"><strong>${item.person==='e'?'Elliott':'Chloe'} · ${Math.round(nutrition.cal||0)} kcal · ${round1(nutrition.prot||0)}g protein</strong>${round1(portionValue||0)} serving${Math.abs((portionValue||0)-1)<.001?'':'s'}</div>`;
  }).join('');
  return `<article class="today-meal-card ${isEaten ? 'eaten-card' : ''}" id="today-card-${ppEscapeAttr(mealType)}-${ppEscapeAttr(personKey)}">
    <div class="today-meal-card-top">
      <div class="today-meal-card-left">
        <button class="today-eaten-circle ${isEaten ? 'is-checked' : ''}" type="button" aria-label="${isEaten ? 'Mark as not eaten' : 'Mark as eaten'}" onclick="toggleMealEatenOnDate('${platePlanTodayDate}','${ppEscapeAttr(mealType)}','${ppEscapeAttr(personKey)}')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
        <div class="today-meal-info">
          <div class="today-meal-name" style="${isEaten ? 'text-decoration:line-through;opacity:0.75' : ''}">${ppEscapeHtml(info.active.name||info.recipe?.name||'Recipe')}</div>
          <div class="today-meal-meta"><span class="tag">${ppEscapeHtml(people.join(' & '))}</span><span class="tag">${ppEscapeHtml(info.variant==='enhanced'?'Enhanced':'Original')}</span></div>
        </div>
      </div>
      <div class="today-meal-macro-pill">${ppEscapeHtml(macroText)}</div>
    </div>
    <div class="today-card-disclosure-row">
      <details class="today-card-disclosure">
        <summary><span>Portions & details</span><span class="today-card-disclosure-arrow">▾</span></summary>
        <div class="today-portions">${portions}</div>
        <div class="today-card-actions"><button class="btn ghost sm" type="button" onclick="openPlanReschedule(${+entry.day},'${ppEscapeAttr(entry.slotKey)}')">Reschedule meal</button></div>
      </details>
      <button class="btn primary sm today-view-recipe-btn" type="button" onclick="viewRecipe('${ppEscapeAttr(info.id)}','${ppEscapeAttr(info.instanceId||'')}','${ppEscapeAttr(info.variant||'original')}')">View recipe</button>
    </div>
  </article>`;
}
function renderTodayReasonCard(group){
  const entry=group[0], people=group.map(item=>item.person==='e'?'Elliott':'Chloe').join(' & ');
  return `<article class="today-reason-card"><strong>${ppEscapeHtml(formatPlanSlotReason(entry.reason))}</strong><div style="color:var(--text2)">${ppEscapeHtml(people)} · no recipe scheduled</div></article>`;
}
function renderTodayEmpty(title,copy,actions=''){
  return `<div class="today-empty"><h3>${ppEscapeHtml(title)}</h3><p>${ppEscapeHtml(copy)}</p>${actions?`<div class="btn-row">${actions}</div>`:''}</div>`;
}
function renderToday(){
  const host=document.getElementById('today-content'); if(!host||!state) return;
  try {
    if(!platePlanTodayDate) platePlanTodayDate=getPlatePlanLocalToday();
    const label=document.getElementById('today-date-label'), subtitle=document.getElementById('today-subtitle');
    if(label) label.textContent=formatTodayDateLabel(platePlanTodayDate);
    if(!state.plan?.slots||!Object.keys(state.plan.slots).length){
      if(subtitle) subtitle.textContent='Your planned meals';
      host.innerHTML=renderTodayEmpty('No active meal plan','Apply a meal plan from your library, or generate a new one.',`<button class="btn primary" onclick="openApplyPlanFromLibraryModal()">Apply Plan</button>`);
      return;
    }
    let dated=Object.values(state.plan.dayDates||{}).some(v=>parsePlanLocalDate(v));
    if(!dated && state.plan.slots && Object.keys(state.plan.slots).length){
      state.plan.dayDates=buildPlanDayDates(platePlanTodayDate||getPlatePlanLocalToday(),state.plan.days||7);
      state.plan.updatedAt=new Date().toISOString(); safeLocalStorageSet(SK, safeJsonStringify(state)); dated=true;
    }
    if(!dated){
      if(subtitle) subtitle.textContent='This plan has no calendar dates';
      host.innerHTML=renderTodayEmpty('Assign dates to this plan','Today only shows meals assigned to a calendar date.',`<button class="btn primary" onclick="rollActivePlanToDate('${platePlanTodayDate}')">Start plan today</button>`);
      return;
    }
    const day=getTodayPlanDay(platePlanTodayDate);
    if(!day){
      const next=getNextDatedPlanDay(platePlanTodayDate), nextCopy=next?` Next dated plan day is ${formatPlanDayLabel(state.plan,next[0],{short:true})}.`:'';
      if(subtitle) subtitle.textContent='No plan day is assigned';
      host.innerHTML=renderTodayEmpty('No meals planned for this date',`This date is not assigned.${nextCopy}`,`<button class="btn primary" onclick="rollActivePlanToDate('${platePlanTodayDate}')">Start plan cycle today</button>`);
      return;
    }
    if(subtitle) subtitle.textContent=formatPlanDayLabel(state.plan,day,{short:false});
    const entries=[], reasonEntries=[], mealDefinitions=[{mealType:'breakfast',e:'breakfastE',c:'breakfastC'},{mealType:'lunch',e:'lunchE',c:'lunchC'},{mealType:'dinner',e:'dinnerE',c:'dinnerC'}];
    mealDefinitions.forEach(m=>{
      const e=getTodaySlotEntry(day,m.e,'e',m.mealType), c=getTodaySlotEntry(day,m.c,'c',m.mealType);
      if(e) entries.push(e); if(c) entries.push(c);
      if(!e){ const r=getPlanSlotReason(state.plan,day,m.e); if(r)reasonEntries.push({day:+day,slotKey:m.e,person:'e',mealType:m.mealType,reason:r}); }
      if(!c){ const r=getPlanSlotReason(state.plan,day,m.c); if(r)reasonEntries.push({day:+day,slotKey:m.c,person:'c',mealType:m.mealType,reason:r}); }
    });
    if(!entries.length&&!reasonEntries.length){
      host.innerHTML=renderTodayEmpty('No meals planned','This plan day has no meals.',`<button class="btn primary" onclick="openApplyPlanFromLibraryModal()">Apply Plan</button>`);
      return;
    }
    let eCal=0, eProt=0, cCal=0, cProt=0;
    entries.forEach(item => { if (item.person === 'e') { eCal += item.calculated?.cal || 0; eProt += item.calculated?.prot || 0; } else { cCal += item.calculated?.cal || 0; cProt += item.calculated?.prot || 0; } });
    const eBudgets = ['breakfast','lunch','dinner'].reduce((acc,m)=>{ const b=getBudgets('e',m); return {cal:acc.cal+b.cal, prot:acc.prot+b.prot}; }, {cal:0,prot:0});
    const cBudgets = ['breakfast','lunch','dinner'].reduce((acc,m)=>{ const b=getBudgets('c',m); return {cal:acc.cal+b.cal, prot:acc.prot+b.prot}; }, {cal:0,prot:0});
    const summaryHtml = entries.length ? `<details class="today-summary-accordion" id="today-daily-summary-accordion">
      <summary class="today-summary-summary">
        <div class="today-summary-chips">
          <span class="tag" style="background:var(--action);color:#fff;font-weight:700">Daily Targets</span>
          <span class="today-summary-chip"><strong>Elliott:</strong> ${Math.round(eCal)} / ${Math.round(eBudgets.cal)} kcal · ${round1(eProt)} / ${Math.round(eBudgets.prot)}g protein</span>
          <span class="today-summary-chip"><strong>Chloe:</strong> ${Math.round(cCal)} / ${Math.round(cBudgets.cal)} kcal · ${round1(cProt)} / ${Math.round(cBudgets.prot)}g protein</span>
        </div>
        <span class="today-summary-arrow">▾</span>
      </summary>
      <div class="today-summary-body">
        <div class="today-people">${renderTodayPersonPanel('e','Elliott',entries)}${renderTodayPersonPanel('c','Chloe',entries)}</div>
      </div>
    </details>` : '';
    const mealSections=mealDefinitions.map(m=>{
      const mEntries=entries.filter(x=>x.mealType===m.mealType), mReasons=reasonEntries.filter(x=>x.mealType===m.mealType);
      if(!mEntries.length&&!mReasons.length) return null;
      const isEaten=isMealEatenOnDate(platePlanTodayDate,m.mealType,'both');
      const groups=mEntries.length===2&&mEntries[0].fingerprint===mEntries[1].fingerprint?[mEntries]:mEntries.map(x=>[x]);
      const reasonGroups=mReasons.length===2&&formatPlanSlotReason(mReasons[0].reason)===formatPlanSlotReason(mReasons[1].reason)?[mReasons]:mReasons.map(x=>[x]);
      return {
        mealType: m.mealType, isEaten,
        html: `<section class="today-meal-section ${isEaten ? 'is-eaten-section' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <h2 class="today-meal-heading" style="margin:0">${ppEscapeHtml(toTitleCase(m.mealType))}</h2>
          </div>
          ${groups.map(g => renderTodayMealCard(g, m.mealType)).join('')}
          ${reasonGroups.map(renderTodayReasonCard).join('')}
        </section>`
      };
    }).filter(Boolean);
    mealSections.sort((a,b)=>a.isEaten===b.isEaten?0:(a.isEaten?1:-1));
    host.innerHTML=summaryHtml+mealSections.map(s=>s.html).join('');
  } catch(err) {
    console.error('Error rendering Today view:', err);
    host.innerHTML = `<div class="card" style="padding:20px;text-align:center;"><h3>Unable to load today's plan</h3></div>`;
  }
}
function openApplyPlanFromLibraryModal(){
  let wrap=document.getElementById('apply-plan-library-modal-wrap');
  if (!wrap) { wrap=document.createElement('div'); wrap.id='apply-plan-library-modal-wrap'; wrap.className='modal-wrap'; document.body.appendChild(wrap); }
  const hist=state.planHistory||[], todayStr=getPlatePlanLocalToday(), cardsHtml = hist.length ? hist.map((p,i)=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center"><div><strong>${ppEscapeHtml(p.name||'Saved plan '+(i+1))}</strong><div style="font-size:11px;color:var(--text2)">${p.days||0} days</div></div><button class="btn primary sm" onclick="applyPlanFromLibraryModalConfirm(${i})">Apply Plan</button></div>`).join('') : '<div style="text-align:center;padding:20px">No saved plans.</div>';
  wrap.innerHTML=`<div class="modal" style="max-width:540px"><div class="row-between" style="align-items:center;margin-bottom:12px"><h3>Apply Plan</h3><button class="btn sm ghost" onclick="closeApplyPlanLibraryModal()">✕</button></div><div style="margin-bottom:10px"><label style="font-size:12px;font-weight:600">Start date:</label> <input type="date" id="apply-plan-library-start-date" value="${ppEscapeAttr(todayStr)}" style="padding:4px 8px"></div><div style="max-height:300px;overflow-y:auto">${cardsHtml}</div></div>`;
  wrap.classList.add('open');
}
function closeApplyPlanLibraryModal() { document.getElementById('apply-plan-library-modal-wrap')?.classList.remove('open'); }
function applyPlanFromLibraryModalConfirm(index){
  const startDate=document.getElementById('apply-plan-library-start-date')?.value||getPlatePlanLocalToday();
  applyPlanFromLibraryDirect(index,startDate); closeApplyPlanLibraryModal();
}
function applyPlanFromLibraryDirect(index,startDate){
  const p=(state.planHistory||[])[index]; if(!p) return;
  if(state.plan?.slots&&Object.keys(state.plan.slots).length) snapshotCurrentPlan('Auto-saved before library plan',defaultPlanSaveName(state.plan));
  const days=p.days||Object.keys(p.slots||{}).length||7, start=startDate||getPlatePlanLocalToday();
  state.plan={
    days, slots: clonePlatePlanValue(p.slots||{}), dayDates: buildPlanDayDates(start,days), slotReasons: clonePlatePlanValue(p.slotReasons||{}),
    productPriority: p.productPriority||state.prefs?.productPriority||'protein', productSelections: clonePlatePlanValue(p.productSelections||{}),
    useUpProductIds: clonePlatePlanValue(p.useUpProductIds||[]), shoppingAtHome: clonePlatePlanValue(p.shoppingAtHome||{}), warnings: [],
    score: calculatePlanScore({days, slots:p.slots, productSelections:p.productSelections}), confirmedShopping: !!p.confirmedShopping,
    mealPrepGroups: clonePlatePlanValue(p.mealPrepGroups||[]), declinedMealPrepGroups: clonePlatePlanValue(p.declinedMealPrepGroups||[]),
    updatedAt: new Date().toISOString(), appliedAt: new Date().toISOString()
  };
  state.overrides=clonePlatePlanValue(p.overrides||{});
  platePlanNutritionCache.clear(); markPlatePlanViewsDirty('today','planner','shopping','planlib');
  saveState(true); if(platePlanCloudReady && !platePlanSyncSuppress) queuePlatePlanCloudDiff();
  renderPlan(); showView('today'); showPlatePlanToast(`Applied "${p.name||'Saved Plan'}" starting ${start}`);
}
function rollActivePlanToDate(startDate){
  if(!state?.plan?.slots||!Object.keys(state.plan.slots).length) return;
  const start=startDate||getPlatePlanLocalToday(), days=state.plan.days||Object.keys(state.plan.slots).length||7;
  state.plan.dayDates=buildPlanDayDates(start,days); state.plan.updatedAt=new Date().toISOString();
  platePlanNutritionCache.clear(); markPlatePlanViewsDirty('today','planner','shopping','planlib');
  saveState(true); renderPlan(); if(document.getElementById('view-today')?.classList.contains('active')) renderToday();
  showPlatePlanToast(`Plan dates rolled forward starting ${formatTodayDateLabel(start)}`);
}
window.openApplyPlanFromLibraryModal=openApplyPlanFromLibraryModal;
window.closeApplyPlanLibraryModal=closeApplyPlanLibraryModal;
window.applyPlanFromLibraryModalConfirm=applyPlanFromLibraryModalConfirm;
window.applyPlanFromLibraryDirect=applyPlanFromLibraryDirect;
window.rollActivePlanToDate=rollActivePlanToDate;
window.toggleMealEatenOnDate=toggleMealEatenOnDate;
window.isMealEatenOnDate=isMealEatenOnDate;
function scheduleTodayMidnightRefresh(){
  clearTimeout(platePlanTodayTimer);
  const now=new Date();
  const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,1);
  platePlanTodayTimer=setTimeout(()=>{
    const previousActual=platePlanLastActualDate||formatPlanLocalDateValue(now);
    const wasActualDate=platePlanTodayDate===previousActual;
    platePlanLastActualDate=getPlatePlanLocalToday();
    if(wasActualDate) platePlanTodayDate=getPlatePlanLocalToday();
    if(document.getElementById('view-today')?.classList.contains('active')) renderToday();
    scheduleTodayMidnightRefresh();
  },Math.max(1000,next.getTime()-now.getTime()));
}
function applyPendingRecipePreFillToForm(){
  if(!platePlanPendingRecipePreFill) return;
  const recipe = platePlanPendingRecipePreFill;
  platePlanPendingRecipePreFill = null;
  if(typeof clearForm === 'function') clearForm();
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if(el && val !== undefined && val !== null) { el.value = Array.isArray(val) ? val.join('\n') : String(val); el.dispatchEvent(new Event('input', { bubbles: true })); }
  };
  setVal('r-name', recipe.name);
  const servesVal = recipe.servings ? String(recipe.servings) : '';
  setVal('r-serves-orig', servesVal);
  setVal('r-serves', servesVal || '2');
  setVal('r-time', recipe.timeMinutes);
  setVal('r-ingredients', recipe.ingredients);
  setVal('r-method', recipe.method);
  if(typeof setMealTypes === 'function') setMealTypes(Array.isArray(recipe.mealTypes) && recipe.mealTypes.length ? recipe.mealTypes : ['dinner']);
  if(recipe.sourceType) { const s = document.getElementById('r-src-type'); if (s) { s.value = recipe.sourceType; updateSrcFields(); } if(recipe.url) setVal('r-src-url', recipe.url); }
  showPlatePlanToast('Recipe text loaded into Add Recipe');
}
function loadPrefs() {
  if (typeof window.renderSettings === 'function') { return window.renderSettings(); }
}
window.loadPrefs = loadPrefs;
function closeSubstituteModal() { const modal = document.getElementById('subst-modal-wrap'); if (modal) modal.classList.remove('open'); }
window.closeSubstituteModal = closeSubstituteModal;
function openSubstituteModal(instanceId, originalKey) { const modal = document.getElementById('subst-modal-wrap'); if (modal) modal.classList.add('open'); }
window.openSubstituteModal = openSubstituteModal;
function confirmSubstitute() { closeSubstituteModal(); if (typeof renderShopping === 'function') renderShopping(); }
window.confirmSubstitute = confirmSubstitute;
function handleSubstSearch(event) {}
function selectSubstItem(id) {}
function removeSubstitute() { closeSubstituteModal(); }
function renderPlatePlanLegacyView(id){
  if(id==='today'){ resetTodayDate({render:false}); renderToday(); }
  if(id==='vault')renderVault();
  if(id==='add'){
    if (platePlanPendingRecipePreFill) { applyPendingRecipePreFillToForm(); }else if (!editId && !platePlanPreserveAddForm) { clearForm(); }
    platePlanPreserveAddForm = false;
  }
  if(id==='ingredients')renderIngredientBank();
  if(id==='bank')renderBank();
  if(id==='planner'){
    ensurePlannerShell();
    const daySel=document.getElementById('plan-days');
    if(daySel && state.plan?.days) daySel.value = String(state.plan.days);
    buildExclGrid();
    renderPlan();
  }
  if(id==='planlib'){
    ensurePlannerShell();
    renderPlanHistoryPanel();
  }
  if(id==='shopping')renderShopping();
  if(id==='prefs')loadPrefs();
  if(id==='data')renderDataQuality();
}
platePlanFeatureRenderers=Object.freeze({
  today(){
    resetTodayDate({render:false});
    return renderToday();
  },
  vault: () => (typeof window.renderVault === 'function' ? window.renderVault() : (typeof renderVault === 'function' ? renderVault() : null)),
  add(){
    if (platePlanPendingRecipePreFill) { applyPendingRecipePreFillToForm(); }else if (!editId && !platePlanPreserveAddForm) { clearForm(); }
    platePlanPreserveAddForm = false;
  },
  ingredients:renderIngredientBank,
  bank:renderBank,
  planner(){
    ensurePlannerShell();
    const daySel=document.getElementById('plan-days');
    if(daySel && state.plan?.days) daySel.value=String(state.plan.days);
    buildExclGrid();
    return renderPlan();
  },
  planlib(){
    ensurePlannerShell();
    return renderPlanHistoryPanel();
  },
  shopping:renderShopping,
  prefs:loadPrefs,
  data:renderDataQuality
});
function requestPlatePlanViewRender(id){
  if(globalThis.PlatePlanModules?.renderView){
    globalThis.PlatePlanModules.renderView(id);
    return;
  }
  renderPlatePlanLegacyView(id);
}
function showView(id){
  document.querySelectorAll('.desktop-sidebar .ntab').forEach(tab=>tab.classList.toggle('active',tab.dataset.view===id));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const view = document.getElementById('view-'+id);
  if(view) view.classList.add('active');
  syncMobileNavigation(id);
  requestPlatePlanViewRender(id);
  platePlanDirtyViews.delete(id);
  window.scrollTo({top:0,behavior:'instant'});
}
function openPlatePlanSearchResult(type,id,title=''){
  if(type==='recipe'){
    showView('vault');
    setTimeout(()=>viewRecipe(id),0);
    return;
  }
  if(type==='ingredient'||type==='subtype'){
    showView('ingredients');
    setTimeout(()=>{
      const input=document.getElementById('ingredient-group-search');
      if(input)input.value=title||'';
      renderIngredientBank();
      input?.focus();
    },0);
    return;
  }
  if(type==='product'){
    showView('bank');
    setTimeout(()=>{
      const input=document.getElementById('bank-search');
      if(input)input.value=title||'';
      renderBank();
      input?.focus();
    },0);
    return;
  }
  if(type==='plan') showView('planlib');
}
function openRecipePhotoPicker(mode='library') { document.getElementById(mode==='camera'?'recipe-photo-camera-input':'recipe-photo-input')?.click(); }
function revokeRecipePhotoUrls() { recipePhotoObjectUrls.forEach(url=>URL.revokeObjectURL(url)); recipePhotoObjectUrls=[]; }
function renderRecipePhotoPreviews(){
  const host=document.getElementById('recipe-photo-previews');
  const actions=document.getElementById('recipe-photo-actions');
  if(!host||!actions) return;
  revokeRecipePhotoUrls();
  if (!recipePhotoFiles.length) { host.innerHTML='';host.style.display='none';actions.style.display='none';return; }
  host.style.display='grid';actions.style.display='flex';
  host.innerHTML=recipePhotoFiles.map((file,index)=>{
    const url=URL.createObjectURL(file);recipePhotoObjectUrls.push(url);
    return `<div class="photo-preview"><img src="${url}" alt="Recipe page ${index+1}"><button type="button" aria-label="Remove page ${index+1}" onclick="removeRecipePhoto(${index})">×</button></div>`;
  }).join('');
}
function handleRecipePhotoSelection(event){
  const incoming=[...(event.target.files||[])].filter(file=>file.type.startsWith('image/'));
  if(recipePhotoFiles.length+incoming.length>4) showMsg('recipe-photo-msg','PlatePlan can process up to four recipe photos at a time.','warn');
  recipePhotoFiles=[...recipePhotoFiles,...incoming].slice(0,4);
  event.target.value='';renderRecipePhotoPreviews();
}
function removeRecipePhoto(index) { recipePhotoFiles.splice(index,1);renderRecipePhotoPreviews(); }
function clearRecipePhotos() { recipePhotoFiles=[];revokeRecipePhotoUrls();renderRecipePhotoPreviews();showMsg('recipe-photo-msg','','info'); }
async function prepareRecipePhoto(file){
  return window.RecipeOcrService?.prepareRecipePhoto?.(file) || { blob: file, mimeType: file.type };
}
async function recogniseRecipePhotos(){
  if (window.RecipeOcrService?.recogniseRecipePhotos) { return window.RecipeOcrService.recogniseRecipePhotos(); }
}
async function recogniseRecipePhotosLocally(){
  if (window.RecipeOcrService?.recogniseRecipePhotosLocally) { return window.RecipeOcrService.recogniseRecipePhotosLocally(); }
}
function ensureRecipeRecognitionModal(){
  let wrap=document.getElementById('recipe-recognition-wrap');if(wrap)return wrap;
  wrap=document.createElement('div');wrap.id='recipe-recognition-wrap';wrap.className='modal-wrap';wrap.style.zIndex='620';wrap.innerHTML='<div class="modal" style="max-width:700px"></div>';document.body.appendChild(wrap);return wrap;
}
function closeRecipeRecognitionModal() { document.getElementById('recipe-recognition-wrap')?.classList.remove('open'); }
let currentRecognisedRecipe = null;
function parseRecipeText(raw) { return parsePastedRecipeText(raw); }
function openRecipeRecognitionReview(recipe, label){
  currentRecognisedRecipe = recipe;
  const wrap = ensureRecipeRecognitionModal(), queueLen = state?.importQueue?.length || 0, queueIdx = state?.importQueueIndex || 0, isMulti = queueLen > 1;
  const subLabel = label || (isMulti ? `Sequential Import Queue (${queueIdx + 1} of ${queueLen})` : 'Pasted text · review recipe');
  wrap.querySelector('.modal').innerHTML = `
    <div class="row-between" style="align-items:center;margin-bottom:10px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="margin:0">Review Recipe</h3>${isMulti ? `<span style="background:var(--purple-bg,#EEF2FF);color:var(--purple,#4F46E5);font-size:12px;font-weight:700;padding:3px 10px;border-radius:12px">Recipe ${queueIdx+1} of ${queueLen}</span>` : ''}</div><button class="btn sm ghost" onclick="cancelImportQueueAndClose()">Close</button></div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:10px">${ppEscapeHtml(subLabel)}</div>
    <div class="grid3"><div><label>Name</label><input id="recognised-name" value="${ppEscapeAttr(recipe?.name || '')}"></div><div><label>Servings</label><input id="recognised-serves" type="number" min="1" value="${recipe?.servings || 2}"></div></div>
    <div class="field"><label>Ingredients</label><textarea id="recognised-ingredients" style="min-height:120px">${ppEscapeHtml((recipe?.ingredients || []).join('\n'))}</textarea></div>
    <div class="field"><label>Method</label><textarea id="recognised-method" style="min-height:140px">${ppEscapeHtml((recipe?.method || []).join('\n'))}</textarea></div>
    <div class="btn-row" style="margin-top:10px;gap:8px"><button type="button" class="btn primary" onclick="saveCurrentReviewedRecipe()">Save Recipe</button>${isMulti ? `<button type="button" class="btn secondary" onclick="skipImportQueueItem()">Skip Recipe</button>` : ''}<button type="button" class="btn ghost" onclick="cancelImportQueueAndClose()">Cancel</button></div>
  `;
  wrap.classList.add('open');
}
async function saveCurrentReviewedRecipe(){
  const name = document.getElementById('recognised-name')?.value.trim() || 'Untitled Recipe', serves = +document.getElementById('recognised-serves')?.value || 2;
  const ingredientsLines = (document.getElementById('recognised-ingredients')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const methodLines = (document.getElementById('recognised-method')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const parsedIngs = ingredientsLines.map(parseIngredientLine).filter(Boolean);
  ensureIngredientGroups();
  parsedIngs.forEach(ing => { const g = fuzzyMatchIngredientGroup(ing.name); if (g) { ing.groupId = g.id; ing.bankId = resolveProductForIngredient(ing).product?.id || ""; } });
  const nutrition = calcRecipeNutrition(parsedIngs, serves), ps = nutrition.perServing, mealTypes = currentRecognisedRecipe?.mealTypes || ['dinner'], portions = calcPortions(ps, state.prefs, serves, 'both', mealTypes[0] || 'dinner');
  const fullRecipe = { id: 'r' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), name, servings: serves, serves, types: mealTypes, ingredients: parsedIngs, method: methodLines, steps: methodLines, ...ps, nutrition: { total: nutrition.totalNutrition, perServing: ps }, portionE: portions.e, portionC: portions.c, bankCalculated: true, updatedAt: new Date().toISOString() };
  recalcRecipeObject(fullRecipe); if(!state) state = {}; if(!Array.isArray(state.recipes)) state.recipes = []; state.recipes.push(fullRecipe);
  try { if(typeof saveRecipe === 'function') await saveRecipe(fullRecipe); } catch(e){}
  platePlanNutritionCache.clear(); markPlatePlanViewsDirty(); rebuildPlatePlanIndexes(); saveState(true);
  state.importQueueIndex = (state.importQueueIndex || 0) + 1;
  if (state.importQueue && state.importQueueIndex < state.importQueue.length) { loadBatchRecipeIntoStepA(state.importQueue[state.importQueueIndex]); } else {
    state.importQueue = []; state.importQueueIndex = 0; updateBatchUiBanners(); closeRecipeRecognitionModal(); showView('vault'); renderVault(); showPlatePlanToast(`Saved "${fullRecipe.name}"`);
  }
}
function detectRecipeTitle(rawText, index = 0){
  const lines = String(rawText || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  for(const l of lines){
    const m = l.match(/^(?:Recipe\s*Title|Title|Recipe)\s*[:\-]\s*(.+)$/i);
    if(m && m[1]?.trim()) return toAPTitleCase(m[1].trim());
  }
  return lines[0] ? toAPTitleCase(lines[0].replace(/^#+\s*/, '').trim()) : `Recipe ${index + 1}`;
}
function isBatchImportActive() { return Boolean(state && Array.isArray(state.importQueue) && state.importQueue.length > 0 && typeof state.importQueueIndex === 'number' && state.importQueueIndex < state.importQueue.length); }
function updateBatchUiBanners(){
  const active = isBatchImportActive(), queue = state?.importQueue || [], idx = state?.importQueueIndex || 0, totalNum = queue.length, statusText = `Batch Import: Recipe ${idx + 1} of ${totalNum}`;
  const bannerAdd = document.getElementById('batch-import-banner-add');
  if(bannerAdd){
    bannerAdd.style.display = (active && totalNum > 1) ? 'flex' : 'none';
    bannerAdd.innerHTML = (active && totalNum > 1) ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><strong style="color:var(--purple,#4F46E5);font-size:14px">${ppEscapeHtml(statusText)}</strong><span style="font-size:12px;color:var(--text2)">Review detected inputs below.</span></div><div class="btn-row" style="margin:0;gap:6px"><button type="button" class="btn sm secondary" onclick="skipBatchImportRecipe()">Skip Recipe</button><button type="button" class="btn sm danger ghost" onclick="abortBatchImport()">Abort Batch Import</button></div>` : '';
  }
  ['add-btn', 'abort-add-btn', 'abort-parse-btn', 'skip-parse-btn', 'abort-parse-btn2', 'abort-mapping-top', 'skip-mapping-btn', 'abort-mapping-btn', 'abort-review-top', 'skip-review-btn', 'abort-review-btn'].forEach(id => {
    const el = document.getElementById(`batch-${id}`);
    if(el) el.style.display = (active && totalNum > 1) ? 'inline-flex' : 'none';
  });
  ['parse', 'mapping', 'review'].forEach(step => {
    const b = document.getElementById(`batch-banner-${step}`);
    if (b) { b.textContent = statusText; b.style.display = (active && totalNum > 1) ? 'inline-block' : 'none'; }
  });
}
function loadBatchRecipeIntoStepA(rawBlock){
  if(!rawBlock) return;
  closeRecipeRecognitionModal();
  document.getElementById('parse-modal-wrap')?.classList.remove('open');
  document.getElementById('mapping-modal-wrap')?.classList.remove('open');
  if(document.getElementById('modal-wrap')?.classList.contains('open')) closeModal(true);
  const parsed = parseRobustRecipeText(rawBlock), detectedTitle = detectRecipeTitle(rawBlock, state?.importQueueIndex || 0);
  platePlanPreserveAddForm = true; showView('add'); editId = null;
  const setVal = (id, val) => { const el = document.getElementById(id); if(el && val !== undefined && val !== null) { el.value = Array.isArray(val) ? val.join('\n') : String(val); el.dispatchEvent(new Event('input', { bubbles: true })); } };
  setVal('r-name', parsed.name || detectedTitle);
  const origServes = parsed.servings ? String(parsed.servings) : '2';
  setVal('r-serves-orig', origServes); setVal('r-serves', origServes);
  setVal('r-time', parsed.timeMinutes);
  setVal('r-ingredients', parsed.ingredients);
  setVal('r-method', parsed.method);
  if(typeof setMealTypes === 'function') setMealTypes(Array.isArray(parsed.mealTypes) && parsed.mealTypes.length ? parsed.mealTypes : ['dinner']);
  updateBatchUiBanners();
}
function skipBatchImportRecipe(){
  if(!state || !Array.isArray(state.importQueue) || !state.importQueue.length){
    return;
  }
  const currentIndex = state.importQueueIndex || 0;
  const total = state.importQueue.length;
  closeRecipeRecognitionModal();
  document.getElementById('parse-modal-wrap')?.classList.remove('open');
  document.getElementById('mapping-modal-wrap')?.classList.remove('open');
  if(document.getElementById('modal-wrap')?.classList.contains('open')){
    closeModal(true);
  }
  state.importQueueIndex = currentIndex + 1;
  if(state.importQueueIndex < state.importQueue.length){
    showPlatePlanToast(`Skipped recipe ${currentIndex + 1} of ${total}. Loading recipe ${state.importQueueIndex + 1}...`);
    loadBatchRecipeIntoStepA(state.importQueue[state.importQueueIndex]);
  } else {
    state.importQueue = [];
    state.importQueueIndex = 0;
    updateBatchUiBanners();
    clearForm();
    showView('vault');
    renderVault();
    showPlatePlanToast('Import queue completed.');
  }
}
function abortBatchImport(){
  if(!state) state = {};
  state.importQueue = [];
  state.importQueueIndex = 0;
  closeRecipeRecognitionModal();
  document.getElementById('parse-modal-wrap')?.classList.remove('open');
  document.getElementById('mapping-modal-wrap')?.classList.remove('open');
  if(document.getElementById('modal-wrap')?.classList.contains('open')){
    closeModal(true);
  }
  clearForm();
  updateBatchUiBanners();
  showView('vault');
  renderVault();
  showPlatePlanToast('Batch import aborted. Remaining queued items discarded.');
}
function openConfirmRecipeIdentificationModal(blocks){
  window.pendingIdentifiedRecipeBlocks = blocks;
  const wrap = ensureRecipeRecognitionModal();
  const modal = wrap.querySelector('.modal');
  if(modal) {
    modal.innerHTML = `<div class="row-between" style="align-items:center;margin-bottom:12px"><h3 style="margin:0">Confirm Recipe Identification (${blocks.length})</h3><button class="btn sm ghost" onclick="cancelImportQueueAndClose()">Close</button></div><div style="max-height:50dvh;overflow-y:auto;margin-bottom:14px">${blocks.map((b, idx) => `<div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px"><strong>${idx + 1}. ${ppEscapeHtml(detectRecipeTitle(b, idx))}</strong></div>`).join('')}</div><div class="btn-row"><button type="button" class="btn primary" onclick="confirmBatchIdentification()">Confirm &amp; Start Wizard Loop</button><button type="button" class="btn ghost" onclick="cancelImportQueueAndClose()">Cancel</button></div>`;
  }
  wrap.classList.add('open');
}
function confirmBatchIdentification(){
  const blocks = window.pendingIdentifiedRecipeBlocks || [];
  if(!blocks.length) return;
  if(!state) state = {};
  state.importQueue = blocks;
  state.importQueueIndex = 0;
  window.pendingIdentifiedRecipeBlocks = null;
  closeRecipeRecognitionModal();
  loadBatchRecipeIntoStepA(state.importQueue[state.importQueueIndex]);
}
function startRecipeImportQueue(){
  const textEl = document.getElementById('recipe-paste-text');
  const rawText = (textEl?.value || '').trim();
  if(!rawText) return textEl?.focus();
  if(!state) state = {};
  const blocks = splitPastedRecipeBlocks(rawText);
  if(blocks.length > 1) openConfirmRecipeIdentificationModal(blocks);
  else { state.importQueue = [rawText]; state.importQueueIndex = 0; closeRecipeRecognitionModal(); loadBatchRecipeIntoStepA(rawText); }
}
function updateRecipePasteTextStatus(){
  const ta = document.getElementById('recipe-paste-text');
  if(!ta) return;
  const val = ta.value || '', blocks = splitPastedRecipeBlocks(val), badge = document.getElementById('recipe-paste-badge'), btn = document.getElementById('recipe-paste-action-btn');
  if(badge) { badge.textContent = blocks.length > 1 ? `${blocks.length} recipes detected` : ''; badge.style.display = blocks.length > 1 ? 'inline-block' : 'none'; }
  if(btn) btn.textContent = blocks.length > 1 ? `Identify & Queue ${blocks.length} Recipes` : 'Import & Review Recipe';
}
function openRecipeTextPaste(){
  const wrap = ensureRecipeRecognitionModal();
  wrap.querySelector('.modal').innerHTML = `<div class="row-between" style="align-items:center;margin-bottom:10px"><h3 style="margin:0">Paste extracted recipe text</h3><button class="btn sm ghost" onclick="cancelRecipeTextPaste()">Close</button></div><textarea id="recipe-paste-text" style="min-height:45dvh" oninput="updateRecipePasteTextStatus()" placeholder="Paste ingredients and method..."></textarea><div class="btn-row" style="margin-top:12px"><button id="recipe-paste-action-btn" class="btn primary" onclick="startRecipeImportQueue()">Import &amp; Review Recipe</button><button class="btn ghost" onclick="cancelRecipeTextPaste()">Cancel</button></div>`;
  wrap.classList.add('open');
  setTimeout(() => document.getElementById('recipe-paste-text')?.focus(), 0);
}
function cancelRecipeTextPaste(){
  const ta = document.getElementById('recipe-paste-text');
  if(ta) ta.value = '';
  closeRecipeRecognitionModal();
}
function cancelImportQueueAndClose() { closeRecipeRecognitionModal(); updateBatchUiBanners(); }
function reviewPastedRecipeText() { startRecipeImportQueue(); }
function applyPastedRecipeDirectlyFromModal() { startRecipeImportQueue(); }
window.detectRecipeTitle = detectRecipeTitle;
window.isBatchImportActive = isBatchImportActive;
window.updateBatchUiBanners = updateBatchUiBanners;
window.loadBatchRecipeIntoStepA = loadBatchRecipeIntoStepA;
window.skipBatchImportRecipe = skipBatchImportRecipe;
window.abortBatchImport = abortBatchImport;
window.openConfirmRecipeIdentificationModal = openConfirmRecipeIdentificationModal;
window.confirmBatchIdentification = confirmBatchIdentification;
window.parseRecipeText = parseRecipeText;
window.startRecipeImportQueue = startRecipeImportQueue;
window.saveCurrentReviewedRecipe = saveCurrentReviewedRecipe;
window.skipImportQueueItem = skipBatchImportRecipe;
window.cancelImportQueueAndClose = cancelImportQueueAndClose;
function openBatchRecipeReviewModal(recipes){
  window.pendingBatchRecipes = recipes;
  const wrap = ensureRecipeRecognitionModal();
  const modal = wrap.querySelector('.modal');
  if(modal) {
    modal.innerHTML = `<div class="row-between" style="align-items:center;margin-bottom:10px"><h3 style="margin:0">Batch Review (${recipes.length} Recipes)</h3><button class="btn sm ghost" onclick="closeRecipeRecognitionModal()">Close</button></div><div style="max-height:55dvh;overflow-y:auto;margin:12px 0">${recipes.map((r, i) => `<div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px"><strong>${i+1}. ${ppEscapeHtml(r.name || 'Recipe ' + (i+1))}</strong></div>`).join('')}</div><div class="btn-row"><button class="btn primary" onclick="importAllBatchRecipesToVault()">Import All to Vault</button><button class="btn ghost" onclick="closeRecipeRecognitionModal()">Cancel</button></div>`;
  }
  wrap.classList.add('open');
}
function importAllBatchRecipesToVault(){
  const recipes = window.pendingBatchRecipes || [];
  if(!recipes.length) return;
  runWithRecoveryPoint('Before importing batch recipes (' + recipes.length + ')', () => {
    let importedCount = 0;
    const nowIso = new Date().toISOString();
    recipes.forEach(r => {
      const parsedIngs = (r.ingredients || []).map(parseIngredientLine).filter(Boolean);
      ensureIngredientGroups();
      parsedIngs.forEach(ing => {
        const groupMatch = fuzzyMatchIngredientGroup(ing.name);
        if (groupMatch) { ing.groupId = groupMatch.id; ing.bankId = resolveProductForIngredient(ing).product?.id || ""; }
        else { const bankMatch = fuzzyMatchBank(ing.name); if (bankMatch) { ing.bankId = bankMatch.id; ing.groupId = bankMatch.groupId || ""; } }
      });
      const serves = r.servings || 2, nutrition = calcRecipeNutrition(parsedIngs, serves), ps = nutrition.perServing, portions = calcPortions(ps, state.prefs, serves, 'both', (r.mealTypes && r.mealTypes[0]) || 'dinner');
      const fullRecipe = { id: 'r' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), name: r.name || 'Untitled Recipe', servings: serves, serves: serves, types: r.mealTypes || ['dinner'], ingredients: parsedIngs, method: r.method || [], steps: r.method || [], ...ps, nutrition: { total: nutrition.totalNutrition, perServing: ps }, portionE: portions.e, portionC: portions.c, bankCalculated: true, source: r.sourceType ? { type: r.sourceType, book: r.bookTitle || '', author: r.author || '', page: r.page || '', url: r.url || '' } : null, timeMinutes: r.timeMinutes || null, updatedAt: nowIso };
      recalcRecipeObject(fullRecipe);
      state.recipes.push(fullRecipe);
      importedCount++;
    });
    platePlanNutritionCache.clear(); markPlatePlanViewsDirty(); rebuildPlatePlanIndexes(); saveState(true); closeRecipeRecognitionModal(); window.pendingBatchRecipes = null; showView('vault'); renderVault(); showPlatePlanToast(`Successfully imported ${importedCount} recipes to Recipe Vault!`);
  });
}
function useFirstBatchRecipeInForm() { const recipes = window.pendingBatchRecipes || []; if(recipes.length) applyRecognisedRecipeDirectlyToForm(recipes[0]); }
function applyRecognisedRecipeDirectlyToForm(parsed){
  platePlanPendingRecipePreFill = normaliseRecognisedRecipe(parsed || {});
  platePlanPreserveAddForm = true; closeRecipeRecognitionModal(); clearRecipePhotos();
  showView('add'); applyPendingRecipePreFillToForm();
}
function applyRecognisedRecipeToForm(){
  const name = document.getElementById('recognised-name')?.value.trim() || '', serves = +document.getElementById('recognised-serves')?.value || null, timeMinutes = document.getElementById('recognised-time')?.value !== '' ? +document.getElementById('recognised-time')?.value : null, bookTitle = document.getElementById('recognised-book')?.value.trim() || '', ingredients = (document.getElementById('recognised-ingredients')?.value || '').split('\n').map(s => s.trim()).filter(Boolean), method = (document.getElementById('recognised-method')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  applyRecognisedRecipeDirectlyToForm({ ...(currentRecognisedRecipe || {}), name, servings: serves, timeMinutes, bookTitle, ingredients, method });
}
function updateSrcFields(){
  const t = document.getElementById('r-src-type')?.value; if(!t) return;
  const labels={tiktok:'TikTok URL',website:'Website URL',youtube:'YouTube URL',instagram:'Instagram URL'};
  if(labels[t]) document.getElementById('src-url-label').textContent=labels[t];
  updateSrcPreview();
}
function updateSrcPreview(){
  const t=document.getElementById('r-src-type')?.value, prev=document.getElementById('src-preview'); if(!prev) return;
  if (!t) { prev.style.display='none';return; }
  const url=document.getElementById('r-src-url')?.value.trim();
  prev.innerHTML=url?'Stored as: <a href="'+url+'" target="_blank" style="color:var(--purple)">'+url+'</a>':'Source set'; prev.style.display='block';
}
function getSource(){
  const t=document.getElementById('r-src-type')?.value, url=document.getElementById('r-src-url')?.value.trim(); return (t && url)?{type:t,url}:null;
}
function renderSourceTag(src){
  if(!src)return''; const text = typeof src === 'string' ? src : (src.url||src.book||'');
  return /^https?:\/\//i.test(text) ? '<a href="'+ppEscapeHtml(text)+'" target="_blank" class="source-link">Source ↗</a>' : '<span class="source-plain">'+ppEscapeHtml(text)+'</span>';
}
function formatRecipeSourceText(src) { return typeof src === 'string' ? src : (src?.url || src?.book || ''); }
function renderRecipeSourceForPrint(src){ const t = formatRecipeSourceText(src); return t ? `<p class="source">Source: ${ppEscapeHtml(t)}</p>` : ''; }
function setSourceFields(src) { if(src?.url) document.getElementById('r-src-url').value=src.url; }
function getMealTypes() { return ['breakfast','lunch','dinner'].filter(t=>document.getElementById('mt-'+t)?.checked); }
function setMealTypes(types){['breakfast','lunch','dinner'].forEach(t=>{const el=document.getElementById('mt-'+t);if(el)el.checked=types.includes(t);});}
function clearForm(){
  ['r-name','r-serves','r-serves-orig','r-time','r-ingredients','r-method','r-src-url'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  editId=null; window.currentEditMap = {}; window.currentEditGroupMap = {}; window.currentEditIngredientMeta = {};
  const t = document.getElementById('form-title'); if(t) t.textContent='Add recipe';
}
function submitRecipe(){
  const name=document.getElementById('r-name').value.trim();
  const ingsText=document.getElementById('r-ingredients').value.trim();
  const methodText=document.getElementById('r-method').value.trim();
  const types=getMealTypes();
  if(!name)return showMsg('form-msg','Please enter a recipe name.','error');
  if(!ingsText)return showMsg('form-msg','Please paste the ingredients.','error');
  if(!methodText)return showMsg('form-msg','Please paste the method.','error');
  if(!types.length)return showMsg('form-msg','Please select at least one meal type.','error');
  const originalServes = parseFloat(document.getElementById('r-serves-orig').value);
  const targetServes = parseFloat(document.getElementById('r-serves').value);
  if(!originalServes || originalServes <= 0) return showMsg('form-msg','Please enter the original serves.','error');
  if(!targetServes || targetServes <= 0) return showMsg('form-msg','Please enter the target servings.','error');
  const scale = targetServes / originalServes;
  const ingredientEntries=splitPastedIngredientSections(ingsText);
  const parsedIngs=ingredientEntries.map(entry=>{
      const p = parseIngredientLine(entry.line);
      if(p && scale !== 1) {
          p.qty = Math.round((p.qty * scale) * 100) / 100;
          p.grams = toGrams(p.qty, p.unit);
          p.raw = `${p.qty} ${p.unit !== 'qty' ? p.unit : ''} ${p.name}`.trim();
          if(p.stockWaterMl) p.stockWaterMl = Math.round((+p.stockWaterMl || 0) * scale);
      }
      if(p && entry.section) p.section = entry.section;
      return p;
  }).filter(Boolean);
  const rawSteps=splitPastedMethodText(methodText);
  const methodSteps=convertMethodQuantitiesToPercentages(rawSteps, parsedIngs);
  document.getElementById('r-serves').value = targetServes;
  openParseModal(parsedIngs, methodSteps);
}
function openParseModal(ings, steps) {
  const ingList = document.getElementById('parse-ing-list');
  ingList.innerHTML = ings.map(renderParseIngredientRow).join('') + '<datalist id="parse-section-options"></datalist>';
  refreshParseSectionOptions();
  if(!document.getElementById('parse-add-ingredient-btn')) {
    ingList.insertAdjacentHTML('afterend', '<button id="parse-add-ingredient-btn" class="btn sm ghost" style="margin-top:8px" onclick="addParseIngredientRow()">+ Add ingredient</button>');
  }
  const methodList = document.getElementById('parse-method-list');
  methodList.innerHTML = steps.map((step, i) => `
    <div class="parse-method-row" style="display:flex; gap:5px; align-items:flex-start;">
      <span class="step-num" style="font-weight:600; font-size:12px; margin-top:8px; width:20px;">${i+1}.</span>
      <textarea class="p-step" style="flex:1; min-height:40px;">${step.replace(/"/g, '&quot;')}</textarea>
      <button class="btn sm danger ghost" onclick="this.parentElement.remove(); reindexMethodSteps();" style="padding:4px 8px;">&times;</button>
    </div>
  `).join('');
  document.getElementById('parse-modal-wrap').classList.add('open');
  updateBatchUiBanners();
}
function renderParseIngredientRow(ing = {}) {
  const normalised = normaliseRecipeAmountForUi(ing), displayUnit = normalised.unit, stockWater = ing.stockWaterMl || '';
  return `<div class="parse-ing-row" style="display:flex;gap:5px;align-items:center"><input type="number" class="p-qty" value="${normalised.qty||1}" style="width:65px" step="0.1" min="0"><select class="p-unit" style="width:85px;border:1px solid var(--border);border-radius:8px;padding:0 5px"><option value="g" ${displayUnit==='g'?'selected':''}>g</option><option value="ml" ${displayUnit==='ml'?'selected':''}>ml</option><option value="qty" ${displayUnit==='qty'?'selected':''}>qty</option></select>${renderSectionInput('p-section',ing.section||'','parse-section-options','refreshParseSectionOptions()','130px')}<input type="text" class="p-name" value="${(ing.name||'').replace(/"/g,'&quot;')}" style="flex:1" oninput="refreshParseIngredientUnit(this)"><input type="number" class="p-stock-water" value="${stockWater}" placeholder="Water ml" style="width:92px;display:${ing.isStock||stockWater?'block':'none'}" step="1" min="0"><button class="btn sm danger ghost" onclick="this.parentElement.remove()" style="padding:4px 8px">&times;</button></div>`;
}
function refreshParseIngredientUnit(input){
  const row = input.closest('.parse-ing-row'); if(!row) return;
  const unit = row.querySelector('.p-unit'), water = row.querySelector('.p-stock-water'), name = input.value || '';
  if(/\bstock\b/i.test(name)) { if(unit) unit.value = 'qty'; if(water) water.style.display = 'block'; }
  else if(unit && (!unit.value || unit.value === 'g')) { unit.value = inferParsedUnitForIngredient({ name }); }
}
function showParseModalMessage(message, type = 'error'){
  let msg = document.getElementById('parse-modal-msg');
  const modal = document.querySelector('#parse-modal-wrap .modal');
  if (!msg && modal) { msg = document.createElement('div'); msg.id = 'parse-modal-msg'; modal.insertBefore(msg, modal.querySelector('.btn-row') || null); }
  if(msg) msg.innerHTML = `<div class="msg ${type}">${ppEscapeHtml(message)}</div>`;
}
function addParseMethodStep() {
  const container = document.getElementById('parse-method-list'), div = document.createElement('div');
  div.className = 'parse-method-row'; div.style = 'display:flex;gap:5px;align-items:flex-start';
  div.innerHTML = `<span class="step-num" style="font-weight:600;font-size:12px;margin-top:8px;width:20px"></span><textarea class="p-step" style="flex:1;min-height:40px"></textarea><button class="btn sm danger ghost" onclick="this.parentElement.remove();reindexMethodSteps()" style="padding:4px 8px">&times;</button>`;
  container.appendChild(div); reindexMethodSteps();
}
function addParseIngredientRow() {
  const container = document.getElementById('parse-ing-list'); if(!container) return;
  document.getElementById('parse-section-options')?.remove();
  container.insertAdjacentHTML('beforeend', renderParseIngredientRow({ qty:1, unit:'qty', name:'' }) + '<datalist id="parse-section-options"></datalist>');
  refreshParseSectionOptions();
}
function reindexMethodSteps() {
  document.querySelectorAll('.parse-method-row').forEach((r, i) => { const s = r.querySelector('.step-num'); if(s) s.textContent = (i + 1) + '.'; });
}
async function confirmParseAndMatch() {
  const finalIngs = [];
  document.querySelectorAll('.parse-ing-row').forEach(row => {
    const qty = parseFloat(row.querySelector('.p-qty').value) || 1, unit = row.querySelector('.p-unit').value, section = row.querySelector('.p-section')?.value.trim() || '', name = row.querySelector('.p-name').value.trim(), water = +row.querySelector('.p-stock-water')?.value || null;
    if(name) finalIngs.push({ raw: `${qty} ${unit !== 'qty' ? unit : ''} ${name}`.trim(), qty, unit, name, grams: toGrams(qty, unit), ...(section ? { section } : {}), ...(water ? { isStock: true, stockWaterMl: water } : {}) });
  });
  const finalMethod = Array.from(document.querySelectorAll('.parse-method-row textarea.p-step')).map(el => el.value.trim()).filter(Boolean);
  if (!finalIngs.length || !finalMethod.length) { showParseModalMessage("Please ensure there is at least one ingredient and one method step."); return; }
  try {
    await continueToMatch(finalIngs, finalMethod);
    document.getElementById('parse-modal-wrap').classList.remove('open');
  } catch(e) {
    console.error('Could not open mapping', e); hideOverlay();
    document.getElementById('parse-modal-wrap').classList.add('open');
    showParseModalMessage('Could not open ingredient mapping. Please check names and try again.');
  }
}
let searchTimeout = null;
function handleMapFocus(idx) { renderMapDropdown(idx, document.getElementById(`map-search-${idx}`).value); }
function handleMapSearch(e, idx) {
  clearTimeout(searchTimeout); const query = e.target.value;
  searchTimeout = setTimeout(() => {
    renderMapDropdown(idx, query);
    const ing = mappingContext?.ings?.[idx];
    if (ing) { ing.groupId = ""; ing.bankId = ""; ing.ingredientId = ""; ing.mappedViaIngredient = false; }
    const editBtn = document.getElementById(`edit-btn-${idx}`), mapRow = document.getElementById(`map-row-${idx}`);
    if(editBtn) editBtn.style.display = 'none'; if(mapRow) mapRow.classList.add('error');
  }, 150);
}
function renderMapDropdown(idx, query) {
    const drop = document.getElementById(`map-dropdown-${idx}`);
    ensureIngredientGroups();
    const variants = getSearchVariants(query || '');
    let productRows = [], familyRows = [];
    if(variants.length) {
      productRows = (state.ingredients || []).filter(p => isUsableProduct(p) && variants.some(q => [p.name, p.brand, CAT[p.cat] || p.cat].join(' ').toLowerCase().includes(q))).sort((a,b) => scoreProductByPriority(b, getAutoMappingStrategy()) - scoreProductByPriority(a, getAutoMappingStrategy())).slice(0, 6);
      familyRows = (state.ingredientFamilies || []).filter(f => variants.some(q => [f.name, CAT[f.cat], f.cat, ...(f.aliases || [])].join(' ').toLowerCase().includes(q))).slice(0, 6);
    }
    let list = (state.ingredientGroups || []).filter(g => !query || variants.some(q => getIngredientGroupSearchText(g).includes(q)));
    list.sort((a,b) => getGroupDisplayName(a).localeCompare(getGroupDisplayName(b)));
    if (!list.length && !familyRows.length && !productRows.length) { drop.innerHTML = `<div style="padding:8px 12px;font-size:12px;color:var(--text3)">No matching items found.</div>`; } else {
        const productHtml = productRows.map(p => `<div class="map-drop-item" onclick="selectMapProductItem(${idx}, '${ppEscapeAttr(p.id)}')"><div style="font-weight:600;font-size:13px">${ppEscapeHtml(p.name)}</div><div style="font-size:11px;color:var(--text3)">Product · ${ppEscapeHtml(CAT[p.cat]||p.cat||'Other')}</div></div>`).join('');
        const familyHtml = familyRows.map(f => `<div class="map-drop-item" onclick="selectMapIngredientDefault(${idx}, '${f.id}')"><div style="font-weight:700;font-size:13px">${ppEscapeHtml(f.name)}</div></div>`).join('');
        const typeHtml = list.slice(0,15).map(g => `<div class="map-drop-item" onclick="selectMapItem(${idx}, '${g.id}')"><div style="font-weight:600;font-size:13px">${ppEscapeHtml(getGroupDisplayName(g))}</div></div>`).join('');
        drop.innerHTML = productHtml + familyHtml + typeHtml;
    }
    drop.style.display = 'block';
}
function selectMapProductItem(idx, productId) {
    const p = getProduct(productId);
    if (!p) return;
    const ing = mappingContext?.ings?.[idx];
    if (!ing) return;
    ing.bankId = p.id;
    ing.groupId = p.groupId || '';
    ing.ingredientId = '';
    ing.mappedViaIngredient = false;
    const inp = document.getElementById(`map-search-${idx}`);
    if (inp) inp.value = `${p.name}${p.brand && p.brand !== 'Generic' ? ` (${p.brand})` : ''}`;
    const drop = document.getElementById(`map-dropdown-${idx}`);
    if (drop) drop.style.display = 'none';
    const row = document.getElementById(`map-row-${idx}`);
    if (row) row.classList.remove('error');
    const editBtn = document.getElementById(`edit-btn-${idx}`);
    if (editBtn) editBtn.style.display = 'inline-block';
}
window.selectMapProductItem = selectMapProductItem;
function selectMapIngredientFamily(idx, familyId){
  const family = getIngredientFamily(familyId);
  const drop = document.getElementById(`map-dropdown-${idx}`);
  const groups = getFamilyGroups(familyId);
  if(!family || !groups.length) return;
  if(groups.length === 1) {
    selectMapIngredientDefault(idx, familyId);
    return;
  }
  const bestProduct = selectBestProductForIngredientFamily(familyId, 'protein_per_kcal');
  const defaultGroup = (bestProduct?.groupId ? getIngredientGroup(bestProduct.groupId) : null) || getIngredientGroup(family.defaultTypeId) || groups[0];
  const defaultProduct = bestProduct || resolveProductForIngredient({ groupId: defaultGroup.id }).product || {};
  const defaultHtml = `<div class="map-drop-item" onclick="selectMapIngredientDefault(${idx}, '${family.id}')">
      <div style="font-weight:700;font-size:13px">Use Ingredient: ${ppEscapeHtml(family.name)}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">${ppEscapeHtml(CAT[family.cat] || family.cat || 'Other')} > ${ppEscapeHtml(family.name)} > ${ppEscapeHtml(getGroupTypeName(defaultGroup))}</div>
      <div style="font-size:11px;color:var(--text2);margin-top:2px">Uses best protein-per-kcal product: ${ppEscapeHtml(defaultProduct.name || 'No product')} | ${round1(defaultProduct.prot || 0)}g P | ${Math.round(defaultProduct.cal || 0)} kcal</div>
    </div>
    <div style="padding:7px 12px 4px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text3);border-top:1px solid var(--border);">Choose Sub-type</div>`;
  drop.innerHTML = defaultHtml + groups.map(g => {
    const p = resolveProductForIngredient({ groupId:g.id }).product || {};
    return `<div class="map-drop-item" onclick="selectMapItem(${idx}, '${g.id}')">
      <div style="font-weight:600;font-size:13px">${ppEscapeHtml(getGroupTypeName(g))}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">${ppEscapeHtml(CAT[g.cat] || g.cat || 'Other')} > ${ppEscapeHtml(family.name)}</div>
      <div style="font-size:11px;color:var(--text2);margin-top:2px">Default: ${p.name || 'No product'} | ${p.prot || 0}g P | ${p.cal || 0} kcal</div>
    </div>`;
  }).join('');
  drop.style.display = 'block';
}
function selectMapIngredientDefault(idx, familyId){
    const family = getIngredientFamily(familyId);
    const groups = getFamilyGroups(familyId);
    if(!family || !groups.length) return;
    const bestProduct = selectBestProductForIngredientFamily(familyId, 'protein_per_kcal');
    const defaultGroup = (bestProduct?.groupId ? getIngredientGroup(bestProduct.groupId) : null) || getIngredientGroup(family.defaultTypeId) || groups[0];
    if(!defaultGroup) return;
    const product = bestProduct || resolveProductForIngredient({ groupId: defaultGroup.id }).product;
    const ing = mappingContext.ings[idx];
    ing.ingredientId = family.id;
    ing.mappedViaIngredient = true;
    ing.groupId = defaultGroup.id;
    ing.bankId = product?.id || "";
    const inp = document.getElementById(`map-search-${idx}`);
    if(inp) inp.value = family.name;
    const drop = document.getElementById(`map-dropdown-${idx}`);
    if(drop) drop.style.display = 'none';
    const row = document.getElementById(`map-row-${idx}`);
    if(row) row.classList.remove('error');
    const editBtn = document.getElementById(`edit-btn-${idx}`);
    if(editBtn) editBtn.style.display = product ? 'inline-block' : 'none';
    maybeSuggestIngredientAlias(idx, defaultGroup.id);
}
let pendingAliasSuggestion = null;
function recipeIngredientAliasCandidate(ing){
  const candidate = normaliseAliasText(ing?.name || '');
  if(candidate && canonicalGroupKey(candidate)) return candidate;
  return normaliseAliasText(String(ing?.raw || '').replace(/^\s*[-*•\d.)\[\]☐□]+\s*/, '').replace(/^\d+(?:\.\d+)?\s*\w+\s+/,''));
}
function maybeSuggestIngredientAlias(idx, groupId){
  const group = getIngredientGroup(groupId);
  const ing = mappingContext?.ings?.[idx];
  if(!group || !ing) return;
  const alias = recipeIngredientAliasCandidate(ing);
  if(!alias) return;
  const aliasKey = canonicalGroupKey(alias);
  if(ing.mappedViaIngredient && ing.ingredientId) {
    const family = getIngredientFamily(ing.ingredientId);
    if(!family || !aliasKey || aliasKey === canonicalGroupKey(family.name)) return;
    if((family.aliases || []).some(a => canonicalGroupKey(a) === aliasKey)) return;
    pendingAliasSuggestion = { idx, familyId: family.id, alias, target: 'ingredient' };
    openIngredientAliasSuggestionModal();
    return;
  }
  if(!aliasKey || aliasKey === canonicalGroupKey(group.name)) return;
  if((group.aliases || []).some(a => canonicalGroupKey(a) === aliasKey)) return;
  pendingAliasSuggestion = { idx, groupId, alias, target: 'subtype' };
  openIngredientAliasSuggestionModal();
}
function ensureIngredientAliasSuggestionModal(){
  let wrap = document.getElementById('ingredient-alias-suggestion-wrap');
  if(wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'ingredient-alias-suggestion-wrap';
  wrap.className = 'modal-wrap sheet-mobile';
  wrap.style.zIndex = '430';
  wrap.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 style="margin:0">Add alias?</h3>
        <button class="btn sm ghost" onclick="closeIngredientAliasSuggestionModal()">Close</button>
      </div>
      <div id="ingredient-alias-suggestion-copy" style="font-size:13px;color:var(--text2);line-height:1.45;margin-bottom:14px"></div>
      <div class="btn-row">
        <button class="btn primary" onclick="confirmIngredientAliasSuggestion()">Add alias</button>
        <button class="btn ghost" onclick="closeIngredientAliasSuggestionModal()">Not now</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function openIngredientAliasSuggestionModal(){
  const wrap = ensureIngredientAliasSuggestionModal();
  if(!pendingAliasSuggestion) return;
  const family = getIngredientFamily(pendingAliasSuggestion.familyId);
  const group = getIngredientGroup(pendingAliasSuggestion.groupId);
  if(!family && !group) return;
  const targetName = family ? family.name : getGroupTypeName(group);
  const targetLabel = family ? 'ingredient' : 'sub-type';
  document.getElementById('ingredient-alias-suggestion-copy').innerHTML =
    `Use <strong>${ppEscapeHtml(pendingAliasSuggestion.alias)}</strong> as another recognised name for the ${targetLabel} <strong>${ppEscapeHtml(targetName)}</strong>?`;
  wrap.classList.add('open');
}
function closeIngredientAliasSuggestionModal(){
  const wrap = document.getElementById('ingredient-alias-suggestion-wrap');
  if(wrap) wrap.classList.remove('open');
  pendingAliasSuggestion = null;
}
function confirmIngredientAliasSuggestion(){
  const family = getIngredientFamily(pendingAliasSuggestion?.familyId);
  const group = getIngredientGroup(pendingAliasSuggestion?.groupId);
  if(pendingAliasSuggestion?.alias){
    if(family) addIngredientFamilyAlias(family, pendingAliasSuggestion.alias);
    else if(group) addIngredientGroupAlias(group, pendingAliasSuggestion.alias);
    saveState();
    renderIngredientBank();
    renderBank();
  }
  closeIngredientAliasSuggestionModal();
}
function selectMapItem(idx, groupId) {
    const group = getIngredientGroup(groupId);
    if(!group) return;
    const product = resolveProductForIngredient({ groupId }).product;
    mappingContext.ings[idx].groupId = groupId;
    mappingContext.ings[idx].bankId = product?.id || "";
    mappingContext.ings[idx].ingredientId = "";
    mappingContext.ings[idx].mappedViaIngredient = false;
    const inp = document.getElementById(`map-search-${idx}`);
    if(inp) inp.value = getGroupTypeName(group);
    const drop = document.getElementById(`map-dropdown-${idx}`);
    if(drop) drop.style.display = 'none';
    const row = document.getElementById(`map-row-${idx}`);
    if(row) row.classList.remove('error');
    const editBtn = document.getElementById(`edit-btn-${idx}`);
    if(editBtn) editBtn.style.display = product ? 'inline-block' : 'none';
    maybeSuggestIngredientAlias(idx, groupId);
}
async function continueToMatch(parsedIngs, methodSteps) {
  const name=document.getElementById('r-name').value.trim();
  const serves=parseInt(document.getElementById('r-serves').value)||2;
  const types=getMealTypes();
  showOverlay('Analysing recipe...','Matching against bank');
  const savedMappings = window.currentEditMap || {};
  const savedGroupMappings = window.currentEditGroupMap || {};
  const savedIngredientMeta = window.currentEditIngredientMeta || {};
  for(const ing of parsedIngs){
    if (savedGroupMappings[ing.raw]) {
        ing.groupId = savedGroupMappings[ing.raw];
        const product = resolveProductForIngredient(ing).product;
        ing.bankId = product?.id || savedMappings[ing.raw] || "";
    } else if (savedMappings[ing.raw]) {
        ing.bankId = savedMappings[ing.raw];
        const product = getProduct(ing.bankId);
        if(product?.groupId) ing.groupId = product.groupId;
    } else {
        const groupMatch=fuzzyMatchIngredientGroup(ing.name);
        if(groupMatch){
          ing.groupId=groupMatch.id;
          ing.bankId=resolveProductForIngredient(ing).product?.id || "";
        } else {
          const bankMatch=fuzzyMatchBank(ing.name);
          if(bankMatch){
            ing.bankId=bankMatch.id;
            ing.groupId=bankMatch.groupId || "";
          } else {
            ing.bankId = "";
            ing.groupId = "";
          }
        }
    }
    if (savedIngredientMeta[ing.raw]?.excludeNutrition) { ing.excludeNutrition = true; }
    if (savedIngredientMeta[ing.raw]?.section && !ing.section) { ing.section = savedIngredientMeta[ing.raw].section; }
    if(savedIngredientMeta[ing.raw]?.ingredientId) {
        ing.ingredientId = savedIngredientMeta[ing.raw].ingredientId;
        ing.mappedViaIngredient = !!savedIngredientMeta[ing.raw].mappedViaIngredient;
    }
  }
  mappingContext = {
      name, serves, types, 
      ings: parsedIngs, 
      methodSteps, 
      ingsText: parsedIngs.map(i => i.raw).join('\n'),
      activeIndex: null
  };
    openMappingModal();
  hideOverlay();
}
function openMappingModal() {
    renderMappingList();
    document.getElementById('mapping-msg').innerHTML = '';
    document.getElementById('mapping-modal-wrap').classList.add('open');
    updateBatchUiBanners();
}
function renderMappingList() {
    const listEl = document.getElementById('mapping-list');
    let html = mappingContext.ings.map((ing, idx) => {
        let displayVal = "";
        let hasBankId = false;
        const groupId = ing.groupId || getRecipeIngredientGroupId(ing);
        if(groupId) {
            const g = getIngredientGroup(groupId);
            const p = resolveProductForIngredient({ ...ing, groupId }).product;
            if(g) {
                const family = ing.ingredientId ? getIngredientFamily(ing.ingredientId) : null;
                displayVal = ing.mappedViaIngredient && family ? family.name : getGroupTypeName(g);
                hasBankId = true;
                ing.groupId = groupId;
                ing.bankId = p?.id || ing.bankId || "";
            }
        }
        if(!hasBankId && ing.bankId) {
            const b = state.ingredients.find(x => x.id === ing.bankId);
            if(b) {
                displayVal = `${b.name} ${b.brand && b.brand !== 'Generic' ? `(${b.brand})` : ''}`;
                hasBankId = true;
            }
        }
        return `
        <div class="mapping-row ${hasBankId ? '' : 'error'}" id="map-row-${idx}">
           <div style="flex:1; font-size:13px;"><strong>${ing.raw}</strong>${ing.excludeNutrition ? ' <span class="tag">not counted</span>' : ''}</div>
           <div class="mapping-search-container" style="position:relative; flex:2;">
               <input type="text" class="map-search-input" id="map-search-${idx}" autocomplete="off" placeholder="Search to map ingredient..." value="${displayVal.replace(/"/g, '&quot;')}" oninput="handleMapSearch(event, ${idx})" onfocus="handleMapFocus(${idx})">
               <div class="map-dropdown" id="map-dropdown-${idx}" style="display:none;"></div>
           </div>
           <button class="btn sm ghost" onclick="editIng('${ing.bankId || ''}')" id="edit-btn-${idx}" style="display:${ing.bankId ? 'inline-block' : 'none'}">Edit default</button>
           <button class="btn sm ghost" onclick="openMiniAdd(${idx})">+ New</button>
           <button class="btn sm ghost" style="color:var(--purple); border-color:var(--purple);" onclick="openTescoImportFromMap(${idx}, '${ing.name.replace(/'/g,"\\'")}')">🛒 Import</button>
        </div>`;
    }).join('');
    listEl.innerHTML = html;
}
function openMiniAdd(index) {
    if (typeof window.openAddProductModal === 'function') { window.openAddProductModal(mappingContext?.ings?.[index]?.name || ''); } else { editIng(''); }
}
function openMiniEdit(index) {
    const bankId = mappingContext?.ings?.[index]?.bankId;
    if (bankId) editIng(bankId);
}
function saveMiniIng() {
    document.getElementById('mini-ing-wrap')?.classList.remove('open');
    if (mappingContext) renderMappingList();
}
function confirmMapping() {
    let hasError = false;
    document.querySelectorAll('.mapping-row').forEach((row, idx) => {
        if(!mappingContext.ings[idx].groupId && !mappingContext.ings[idx].bankId) {
            row.classList.add('error');
            hasError = true;
        } else { row.classList.remove('error'); }
    });
    if(hasError) {
        showMsg('mapping-msg', 'Please map all ingredients before calculating.', 'error');
        return;
    }
    document.getElementById('mapping-modal-wrap').classList.remove('open');
    const methodText = mappingContext.methodSteps.join('\n');
    continueAfterResolve(
        mappingContext.name, 
        mappingContext.ings, 
        mappingContext.serves, 
        mappingContext.types, 
        methodText, 
        mappingContext.ingsText
    );
}
async function continueAfterResolve(name,allIngs,serves,types,method,ingsText,skipNutritionGate=false){
  if(!skipNutritionGate){
    const blockers = findRecipeNutritionBlockers(allIngs);
    if(blockers.length){
      pendingRecipeNutritionFix = {
        args: { name, allIngs, serves, types, method, ingsText },
        blockers
      };
      showIngredientNutritionFixPrompt(blockers[0]);
      return;
    }
  }
  showOverlay('Calculating nutrition...','Using ingredient bank data');
  const nutrition = calcRecipeNutrition(allIngs, serves);
  const ps = nutrition.perServing; // always use perServing for portions and display
  const who = document.getElementById('r-who') ? document.getElementById('r-who').value : 'both';
  const portions = calcPortions(ps, state.prefs, serves, who, (types&&types[0])||'dinner');
  const result = buildBankCalculatedResult(name, allIngs, method, nutrition, portions, types);
  hideOverlay();
  openModal(name, result, true);
}
function buildBankCalculatedResult(name,allIngs,method,nutrition,portions,types=[]){
  const ps = nutrition.perServing;
  const existing = editId ? (state?.recipes || []).find(x => x.id === editId) : null;
  return{
    original:{
      types: Array.isArray(types) && types.length ? types : (Array.isArray(mappingContext?.types) ? mappingContext.types : getMealTypes()),
      ingredients:allIngs,
      method:method.split('\n').filter(Boolean),
      ...ps,
      nutrition:{total:nutrition.totalNutrition,perServing:ps},
      portionE:portions.e,portionC:portions.c,
      bankCalculated:true
    },
    enhanced: existing?.enhanced ? clonePlatePlanValue(existing.enhanced) : null
  };
}
function renderReviewUnitSelect(unit, prefix, name = ''){
    return window.RecipeIngredientRow?.renderReviewUnitSelect?.(unit, prefix, name) ?? `<select class="r-unit" onchange="recalcModal('${prefix}')"><option value="g">g</option></select>`;
}
function renderSectionInput(className, value, listId, onChange, width = '120px'){
    return window.RecipeIngredientRow?.renderSectionInput?.(className, value, listId, onChange, width) ?? `<input type="search" class="${className}" value="${ppEscapeAttr(value || '')}">`;
}
function renderModalIngs(prefix, ings) {
    const context = getReviewResolutionContext();
    const resolvedIngs = orderRecipeIngredientsBySection(applyReviewContextToIngredients(ings || [], context));
    const list = document.getElementById(prefix + '-ings-list');
    if (list && window.RecipeIngredientRow?.renderModalIngredientsList) {
        list.innerHTML = window.RecipeIngredientRow.renderModalIngredientsList(prefix, resolvedIngs);
        refreshReviewSectionOptions(prefix);
        updateModalIngredientContributionTitles(prefix);
    }
}
function uniqueSectionNames(values){
    const seen = new Set();
    return (values || []).map(v => normaliseRecipeIngredientSection(v)).filter(v => {
      const key = canonicalGroupKey(v);
      if(!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
function getParseSectionOptions() { return uniqueSectionNames(Array.from(document.querySelectorAll('#parse-ing-list .p-section')).map(el => el.value)); }
function getReviewSectionOptions(prefix){
    return uniqueSectionNames(Array.from(document.querySelectorAll(`#${prefix}-ings-list .r-section`)).map(el => el.value));
}
function updateSectionDatalist(id, values){
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = uniqueSectionNames(values).map(v => `<option value="${ppEscapeAttr(v)}"></option>`).join('');
}
function refreshParseSectionOptions() { updateSectionDatalist('parse-section-options', getParseSectionOptions()); }
function refreshReviewSectionOptions(prefix){
    updateSectionDatalist(`${prefix}-section-options`, getReviewSectionOptions(prefix));
}
function getReviewResolutionContext(){
    return currentReviewInstanceId ? getPlanContextForInstance(currentReviewInstanceId) : {};
}
function applyReviewContextToIngredients(ings, context = {}){
    return (ings || []).filter(ing => !isIngredientRemovedInContext(ing, context)).map(ing => {
      const adjusted = typeof ing === 'object' ? getAdjustedIngredientForContext(ing, context) : ing;
      if(typeof adjusted === 'object' && adjusted !== ing) return { ...adjusted, isSubstituted: true, originalName: ing.name, originalBankId: ing.bankId, originalGroupId: ing.groupId, originalKey: getRecipeIngredientKey(ing) };
      return adjusted;
    });
}
function applyTemporaryReviewOverrides(prefix){
    if(!currentReviewInstanceId) return;
    const ov = getPlanOverride(currentReviewInstanceId);
    const rows = document.querySelectorAll(`#${prefix}-ings-list .rev-ing-row`);
    rows.forEach(row => {
      const originalKey = row.dataset.originalKey || row.dataset.groupid || row.dataset.bankid;
      const bankId = row.dataset.bankid || '';
      const groupId = row.dataset.groupid || '';
      if(!originalKey) return;
      if(row.dataset.tempRemoved === '1') {
        ov.removeIngredientKeys[originalKey] = true;
        delete ov.ingredientReplacements[originalKey];
        delete ov.mergeInto[originalKey];
        if(groupId) delete ov.productOverrides[groupId];
        return;
      }
      delete ov.removeIngredientKeys[originalKey];
      if(bankId && bankId !== (row.dataset.originalBankid || '')) {
        ov.ingredientReplacements[originalKey] = bankId;
        if(groupId) ov.productOverrides[groupId] = bankId;
      }
    });
    saveState();
    if(document.getElementById('view-planner')?.classList.contains('active')) renderPlan();
    if(document.getElementById('view-shopping')?.classList.contains('active')) renderShopping();
}
function removeReviewIngredientRow(btn, prefix){
    const row = btn.closest('.rev-ing-row');
    if(!row) return;
    if(currentReviewInstanceId && row.dataset.originalKey) {
      row.dataset.tempRemoved = '1';
      row.style.display = 'none';
    } else { row.remove(); }
    recalcModal(prefix);
}
function editModalRowIngredient(btn){
    const row = btn.closest('.rev-ing-row');
    let bankId = row ? row.dataset.bankid : '';
    if(!bankId && row?.dataset.groupid) bankId = resolveProductForIngredient({ groupId: row.dataset.groupid }).product?.id || '';
    hideReviewTooltip();
    if(bankId){
      productEditorReturnToReview=!!document.getElementById('modal-wrap')?.classList.contains('open');
      editIng(bankId);
    }else { openAppInfoModal('Product unavailable','The mapped Product Bank item could not be found. Refresh the recipe mapping and try again.'); }
}
let mobileReviewIngredientRow = null;
function openReviewIngredientActions(btn, prefix){
    mobileReviewIngredientRow = btn.closest('.rev-ing-row');
    if(!mobileReviewIngredientRow) return;
    const canEdit = !!(mobileReviewIngredientRow.dataset.bankid || mobileReviewIngredientRow.dataset.groupid);
    const actions = [];
    if(canEdit) actions.push({ label:'Edit mapped product', onclick:`runReviewIngredientMobileAction('edit', '${prefix}')` });
    actions.push(
      { label:'Move up', onclick:`runReviewIngredientMobileAction('up', '${prefix}')` },
      { label:'Move down', onclick:`runReviewIngredientMobileAction('down', '${prefix}')` },
      { label:'Delete ingredient', danger:true, onclick:`runReviewIngredientMobileAction('delete', '${prefix}')` }
    );
    openMobileActionSheet('Ingredient actions', actions);
}
function runReviewIngredientMobileAction(action, prefix){
    const row = mobileReviewIngredientRow;
    mobileReviewIngredientRow = null;
    closeMobileActionSheet();
    if(!row) return;
    if(action === 'edit') return editModalRowIngredient(row.querySelector('.r-edit-ing') || row);
    if(action === 'delete') return removeReviewIngredientRow(row, prefix);
    if(action === 'up') {
      const previous = row.previousElementSibling;
      if(previous?.classList.contains('rev-ing-row')) row.parentNode.insertBefore(row, previous);
    }
    if(action === 'down') {
      const next = row.nextElementSibling;
      if(next?.classList.contains('rev-ing-row')) row.parentNode.insertBefore(next, row);
    }
    recalcModal(prefix);
}
let reviewReplaceTargetRow = null;
function ensureReviewReplaceModal(){
    let wrap = document.getElementById('review-replace-wrap');
    if(wrap) wrap.remove();
    wrap = document.createElement('div');
    wrap.id = 'review-replace-wrap';
    wrap.className = 'modal-wrap';
    wrap.style.zIndex = '380';
    wrap.innerHTML = `
      <div class="modal" style="max-width:540px">
        <div class="row-between" style="align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Replace recipe ingredient</h3>
          <button class="btn sm ghost" onclick="closeModalIngredientReplace()">Close</button>
        </div>
        <div class="field">
          <label>Search type</label>
          <input type="search" id="review-replace-search" placeholder="Search category, ingredient, type, alias or product" oninput="renderReviewReplaceOptions(this.value)">
        </div>
        <div id="review-replace-options" style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface)"></div>
      </div>`;
    document.body.appendChild(wrap);
    return wrap;
}
let activeUnifiedMappingContext = null;
window.activeUnifiedMappingContext = null;
function openUnifiedMappingModal(context){
  activeUnifiedMappingContext = context;
  window.activeUnifiedMappingContext = context;
  const wrap = document.getElementById('unified-mapping-modal-wrap');
  if(!wrap) return;
  const nameEl = document.getElementById('unified-map-ing-name');
  const rawEl = document.getElementById('unified-map-ing-raw');
  const qtyTagEl = document.getElementById('unified-map-ing-qty-tag');
  const searchInput = document.getElementById('unified-map-search');
  const ingName = context.ingredientName || 'Ingredient';
  if(nameEl) nameEl.textContent = ingName;
  if(rawEl) rawEl.textContent = context.rawText && context.rawText !== ingName ? `Original: "${context.rawText}"` : '';
  if(qtyTagEl) {
    const qtyStr = [context.qty, context.unit].filter(Boolean).join(' ');
    qtyTagEl.textContent = qtyStr || 'No quantity';
    qtyTagEl.style.display = qtyStr ? 'inline-block' : 'none';
  }
  wrap.classList.add('open');
  const query = context.initialQuery || ingName;
  if(searchInput) {
    searchInput.value = query;
    setTimeout(() => {
      searchInput.focus();
      searchInput.select();
    }, 50);
  }
  handleUnifiedMapSearch(query);
}
function closeUnifiedMappingModal(){
  const wrap = document.getElementById('unified-mapping-modal-wrap');
  if(wrap) wrap.classList.remove('open');
  activeUnifiedMappingContext = null;
  window.activeUnifiedMappingContext = null;
}
function switchUnifiedMapTab(tabName) {
  window.unifiedMapActiveTab = tabName;
  const searchInput = document.getElementById('unified-map-search');
  handleUnifiedMapSearch(searchInput ? searchInput.value : '');
}
window.switchUnifiedMapTab = switchUnifiedMapTab;
function handleUnifiedMapSearch(query){
  const resultsEl = document.getElementById('unified-map-results');
  if(!resultsEl) return;
  if(!window.unifiedMapActiveTab) window.unifiedMapActiveTab = 'product';
  const q = (query || '').trim(), variants = getSearchVariants(q), strat = getAutoMappingStrategy();
  let products = (state.ingredients || []).filter(p => isUsableProduct(p) && (!q || variants.some(v => [p.name, p.brand, CAT[p.cat] || p.cat].join(' ').toLowerCase().includes(v)))).sort((a, b) => scoreProductByPriority(b, strat) - scoreProductByPriority(a, strat)).slice(0, 20);
  ensureIngredientGroups();
  let groups = (state.ingredientGroups || []).filter(g => !q || variants.some(v => getIngredientGroupSearchText(g).includes(v))).slice(0, 15);
  let html = `<div style="display:flex;gap:8px;margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:8px"><button type="button" class="btn sm ${window.unifiedMapActiveTab !== 'subtype' ? 'primary' : 'ghost'}" onclick="switchUnifiedMapTab('product')">Tab 1: Products</button><button type="button" class="btn sm ${window.unifiedMapActiveTab === 'subtype' ? 'primary' : 'ghost'}" onclick="switchUnifiedMapTab('subtype')">Tab 2: Sub-types</button></div>`;
  if(window.unifiedMapActiveTab !== 'subtype') {
    if(!products.length) html += `<div style="padding:16px;text-align:center;color:var(--text2)">No matching products found.</div>`;
    else html += products.map(p => `<div class="unified-map-item" onclick="selectUnifiedMapProduct('${ppEscapeAttr(p.id)}', '${ppEscapeAttr(p.groupId || '')}')" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid var(--border);cursor:pointer"><div><strong style="font-size:13px">${ppEscapeHtml(p.name)}</strong><div style="font-size:11px;color:var(--text3)">${ppEscapeHtml(CAT[p.cat]||p.cat||'Other')}</div></div><button type="button" class="btn sm primary">Select</button></div>`).join('');
  } else {
    if(!groups.length) html += `<div style="padding:16px;text-align:center;color:var(--text2)">No matching sub-types found.</div>`;
    else html += groups.map(g => `<div class="unified-map-item" onclick="selectUnifiedMapGroup('${ppEscapeAttr(g.id)}')" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid var(--border);cursor:pointer"><div><strong style="font-size:13px">${ppEscapeHtml(getGroupTypeName(g))}</strong></div><button type="button" class="btn sm ghost">Use</button></div>`).join('');
  }
  resultsEl.innerHTML = html;
}
function selectUnifiedMapProduct(productId, groupId){
  const product = getProduct(productId);
  if(!product) return;
  const targetGroupId = groupId || product.groupId || '';
  if(activeUnifiedMappingContext){
    applyUnifiedMappingResult(activeUnifiedMappingContext, {
      productId: product.id,
      groupId: targetGroupId,
      productName: product.name,
      brand: product.brand
    });
  }
}
function selectUnifiedMapGroup(groupId){
  const group = getIngredientGroup(groupId);
  if(!group) return;
  const defProd = resolveProductForIngredient({ groupId: group.id }).product;
  if(activeUnifiedMappingContext){
    applyUnifiedMappingResult(activeUnifiedMappingContext, {
      productId: defProd?.id || '',
      groupId: group.id,
      productName: getGroupTypeName(group),
      brand: defProd?.brand || ''
    });
  }
}
function applyUnifiedMappingResult(context, result){
  if(!context) return;
  const householdId = window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  const targetIngId = context.ingredientId || (context.type === 'ingredient' ? (context.entityId || context.id) : null);
  if (targetIngId) { updateIngredientMappingGlobal(targetIngId, result).catch(err => console.error('[UPDATE INGREDIENT MAPPING GLOBAL ERROR]', err)); }
  if(context.type === 'reviewRow' && context.rowEl){
    const row = context.rowEl;
    row.dataset.groupid = result.groupId || '';
    row.dataset.bankid = result.productId || '';
    row.dataset.ingredientid = '';
    row.dataset.mappedViaIngredient = '';
    const nameInput = row.querySelector('.r-name');
    if(nameInput && (!nameInput.value || nameInput.value === 'New item' || nameInput.value === 'Ingredient')){
      nameInput.value = result.productName || '';
    }
    const editBtn = row.querySelector('.r-edit-ing');
    if(editBtn) editBtn.style.display = result.productId ? 'inline-block' : 'none';
    const prefix = context.prefix || 'orig';
    closeUnifiedMappingModal();
    recalcModal(prefix);
  } else if(context.type === 'recipeIngredient' && context.recipeId){
    const recipe = getRecipe(context.recipeId);
    if(recipe){
      const variant = context.variantKey === 'enhanced' ? recipe.variants?.enhanced : (recipe.variants?.original || recipe);
      if(variant && Array.isArray(variant.ingredients) && variant.ingredients[context.ingredientIndex]){
        const target = variant.ingredients[context.ingredientIndex];
        const previousProductId = target.productId || target.bankId || '';
        const nowIso = new Date().toISOString();
        target.bankId = result.productId || '';
        target.groupId = result.groupId || '';
        if (result.productId) target.productId = result.productId;
        if (result.tescoProductId || result.tpnb) target.tescoProductId = result.tescoProductId || result.tpnb;
        if (result.packOptions) target.packOptions = result.packOptions;
        if (result.sourceUrl || result.url) target.sourceUrl = result.sourceUrl || result.url;
        recipe.updatedAt = nowIso;
        if (Array.isArray(window.state?.recipes)) {
          const idx = window.state.recipes.findIndex(r => r && r.id === recipe.id);
          if (idx !== -1) window.state.recipes[idx] = recipe;
        }
        rehydrateActiveRecipeAndStateCache({ changedProductIds: [result.productId], recipeId: recipe.id });
        renderAll();
        (async () => {
          try {
            const db = platePlanDb || (window.firebase && firebase.firestore && firebase.firestore());
            if (db) {
              const cleanRecipe = sanitizePayloadForFirestore(unwrapAndCleanItem(recipe));
              await db.collection('households').doc(householdId).collection('recipes').doc(recipe.id).set(cleanRecipe, { merge: true });
            }
          } catch(err) {
            console.error('[INGREDIENT LINK REVERT - ROLLING BACK]', err);
            target.productId = previousProductId;
            target.bankId = previousProductId;
            rehydrateActiveRecipeAndStateCache({ changedProductIds: [previousProductId], recipeId: recipe.id });
            renderAll();
            showPlatePlanToast('Failed to link ingredient in cloud. Reverted change.', 'error');
          }
        })();
      }
    }
    closeUnifiedMappingModal();
    if (context.issueKey) { finishEditorReturn('data'); }
  } else { closeUnifiedMappingModal(); }
}
function openTescoModal(context = null){
  const ctx = context || window.pendingTescoMapping || activeUnifiedMappingContext || window.activeUnifiedMappingContext || null;
  if (typeof showTescoImport === 'function') { return showTescoImport(ctx); }
  const modal = document.getElementById('tesco-modal');
  if(modal) modal.style.display = 'flex';
}
window.openTescoModal = openTescoModal;
function showTescoSearchModal(ingredientId){
  try {
    let ingName = '';
    const activeCtx = activeUnifiedMappingContext || window.activeUnifiedMappingContext || null;
    let cleanId = typeof ingredientId === 'string' ? ingredientId : (ingredientId?.id || '');
    if (!cleanId && activeCtx?.ingredientId) { cleanId = activeCtx.ingredientId; }
    if(cleanId){
      if(Array.isArray(state?.ingredients)){
        const found = state.ingredients.find(i => i && i.id === cleanId);
        if(found) ingName = found.name || '';
      }
      if(!ingName && state?.ingredients && typeof state.ingredients === 'object'){
        const found = state.ingredients[cleanId];
        if(found) ingName = found.name || '';
      }
    }
    const searchVal = document.getElementById('unified-map-search')?.value?.trim();
    const query = ingName || searchVal || activeCtx?.ingredientName || '';
    const ctx = {
      type: 'unified',
      ingredientId: cleanId || activeCtx?.ingredientId || '',
      name: query
    };
    window.pendingTescoMapping = ctx;
    closeUnifiedMappingModal();
    openTescoModal(ctx);
    const inp = document.getElementById('tesco-url');
    if(inp){
      inp.value = query;
      if(typeof fetchTescoData === 'function') fetchTescoData(query);
    }
  } catch(err) {
    console.error('[TESCO SEARCH MODAL ERROR]', err);
  }
}
window.showTescoSearchModal = showTescoSearchModal;
function openAddProductModal(ingredientIdOrQuery = ''){
  try {
    let ingName = '';
    const activeCtx = activeUnifiedMappingContext || window.activeUnifiedMappingContext || null;
    let cleanId = typeof ingredientIdOrQuery === 'string' ? ingredientIdOrQuery : (ingredientIdOrQuery?.id || '');
    if(cleanId && cleanId.startsWith('ing')){
      if(Array.isArray(state?.ingredients)){
        const found = state.ingredients.find(i => i && i.id === cleanId);
        if(found) ingName = found.name || '';
      }
    } else if (cleanId) { ingName = cleanId; }
    if (!ingName && activeCtx?.ingredientName) { ingName = activeCtx.ingredientName; }
    const searchVal = document.getElementById('unified-map-search')?.value?.trim();
    const query = ingName || searchVal || activeCtx?.ingredientName || '';
    if(activeCtx){
      window.pendingUnifiedAddContext = { ...activeCtx };
    }
    closeUnifiedMappingModal();
    if(typeof showTescoImport === 'function'){
      showTescoImport({
        type: 'manualAdd',
        name: query,
        ingredientId: cleanId || activeCtx?.ingredientId || ''
      });
    } else if (typeof openMiniIng === 'function') { openMiniIng(query); }
    const nameInp = document.getElementById('tp-name') || document.getElementById('mi-name');
    if(nameInp && query) {
      nameInp.value = query;
      nameInp.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } catch(err) {
    console.error('[OPEN ADD PRODUCT MODAL ERROR]', err);
  }
}
window.openAddProductModal = openAddProductModal;
function openProductPicker(ingredientId) { return openAddProductModal(ingredientId); }
window.openProductPicker = openProductPicker;
function triggerTescoImportFromUnifiedMap() { showTescoSearchModal(activeUnifiedMappingContext?.ingredientId || ''); }
function triggerNewProductFromUnifiedMap() { openProductPicker(activeUnifiedMappingContext?.ingredientId || ''); }
function openUnifiedMappingModalFromRow(row, prefix = 'orig'){
  if(!row) return;
  const currentName = row.querySelector('.r-name')?.value || '';
  const rawText = row.dataset.raw || currentName;
  const qty = row.querySelector('.r-qty')?.value || '';
  const unit = row.querySelector('.r-unit')?.value || '';
  openUnifiedMappingModal({
    type: 'reviewRow',
    rowEl: row,
    prefix,
    ingredientName: currentName,
    rawText,
    qty,
    unit,
    initialQuery: currentName
  });
}
function openReviewMappingModalFromStatus(el){
  const row = el?.closest('.rev-ing-row');
  if(!row) return;
  const prefix = row.dataset.prefix || row.closest('[id$="-ings-list"]')?.id?.replace('-ings-list','') || 'orig';
  openUnifiedMappingModalFromRow(row, prefix);
}
window.openUnifiedMappingModal = openUnifiedMappingModal;
window.closeUnifiedMappingModal = closeUnifiedMappingModal;
window.handleUnifiedMapSearch = handleUnifiedMapSearch;
window.selectUnifiedMapProduct = selectUnifiedMapProduct;
window.selectUnifiedMapGroup = selectUnifiedMapGroup;
window.triggerTescoImportFromUnifiedMap = triggerTescoImportFromUnifiedMap;
window.triggerNewProductFromUnifiedMap = triggerNewProductFromUnifiedMap;
window.openUnifiedMappingModalFromRow = openUnifiedMappingModalFromRow;
window.openReviewMappingModalFromStatus = openReviewMappingModalFromStatus;
function openModalIngredientReplace(btn){
    hideReviewTooltip();
    reviewReplaceTargetRow = btn.closest('.rev-ing-row');
    const prefix = reviewReplaceTargetRow?.dataset?.prefix || reviewReplaceTargetRow?.closest('[id$="-ings-list"]')?.id?.replace('-ings-list','') || 'orig';
    openUnifiedMappingModalFromRow(reviewReplaceTargetRow, prefix);
}
function closeModalIngredientReplace(){
    closeUnifiedMappingModal();
    const wrap = document.getElementById('review-replace-wrap');
    if(wrap) wrap.classList.remove('open');
    reviewReplaceTargetRow = null;
}
function renderReviewReplaceOptions(query){
    const listEl = document.getElementById('review-replace-options');
    if(!listEl) return;
    const q = (query || '').trim().toLowerCase();
    ensureIngredientGroups();
    let list = state.ingredientGroups || [];
    if(q){
      const variants = getSearchVariants(q);
      list = list.filter(g => variants.some(v => getIngredientGroupSearchText(g).includes(v)));
    }
    list = list.slice().sort((a,b) => {
      const pa = resolveProductForIngredient({ groupId: a.id }).product || {};
      const pb = resolveProductForIngredient({ groupId: b.id }).product || {};
      const effA = pa.cal > 0 ? (pa.prot || 0) / pa.cal : 0;
      const effB = pb.cal > 0 ? (pb.prot || 0) / pb.cal : 0;
      if(Math.abs(effA - effB) > 0.001) return effB - effA;
      return (a.name || '').localeCompare(b.name || '');
    }).slice(0, 40);
    if(!list.length){
      listEl.innerHTML = '<div style="padding:12px;color:var(--text2);font-size:12px">No matching types found.</div>';
      return;
    }
    listEl.innerHTML = list.map(g => {
      const p = resolveProductForIngredient({ groupId: g.id }).product || {};
      return `
      <button type="button" class="review-replace-option" data-id="${ppEscapeHtml(g.id)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)">
        <div style="font-weight:700;font-size:13px">${ppEscapeHtml(getGroupTypeName(g))}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">${ppEscapeHtml(getGroupHierarchyText(g))}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:3px">Default: ${ppEscapeHtml(p.name || 'No product')} ${p.brand && p.brand !== 'Generic' ? `(${ppEscapeHtml(p.brand)})` : ''} | ${Math.round(p.cal || 0)} kcal | ${round1(p.prot || 0)}g protein</div>
      </button>
    `}).join('');
    listEl.querySelectorAll('.review-replace-option').forEach(btn => {
      btn.onclick = () => selectReviewReplacement(btn.dataset.id);
      btn.onmouseenter = () => btn.style.background = 'var(--surface2)';
      btn.onmouseleave = () => btn.style.background = 'var(--surface)';
    });
}
function selectReviewReplacement(groupId){
    if(!reviewReplaceTargetRow) return;
    const group = getIngredientGroup(groupId);
    if(!group) return;
    const product = resolveProductForIngredient({ groupId }).product;
    reviewReplaceTargetRow.dataset.groupid = group.id;
    reviewReplaceTargetRow.dataset.bankid = product?.id || '';
    reviewReplaceTargetRow.dataset.ingredientid = '';
    reviewReplaceTargetRow.dataset.mappedViaIngredient = '';
    const nameInput = reviewReplaceTargetRow.querySelector('.r-name');
    if(nameInput) nameInput.value = getGroupTypeName(group);
    const editBtn = reviewReplaceTargetRow.querySelector('.r-edit-ing');
    if(editBtn) editBtn.style.display = product ? 'inline-block' : 'none';
    const prefix = reviewReplaceTargetRow.dataset.prefix || reviewReplaceTargetRow.closest('[id$="-ings-list"]')?.id?.replace('-ings-list','') || 'orig';
    closeModalIngredientReplace();
    recalcModal(prefix);
}
function updateModalIngredientContributionTitles(prefix){
    const mealTypes = getReviewMealTypesFallback();
    const recipe = {
      serves: getReviewServesFallback(),
      who: document.getElementById('r-who')?.value || 'both',
      types: mealTypes,
      ingredients: extractModalList(prefix).ings,
      resolutionContext: getReviewResolutionContext(),
      instanceId: currentReviewInstanceId
    };
    Array.from(document.querySelectorAll(`#${prefix}-ings-list .rev-ing-row`)).filter(row => row.dataset.tempRemoved !== '1').forEach((row, idx) => {
      const ing = recipe.ingredients[idx];
      const html = ingredientContributionHtml(ing, recipe, recipe.serves);
      const editBtn = row.querySelector('.r-edit-ing');
      const input = row.querySelector('.r-name');
      const resolved = resolveProductForIngredient(ing || {}, recipe.resolutionContext || {});
      const resolvedProduct = resolved.product;
      const hasName = !!(input?.value || '').trim();
      const errorText = hasName ? getReviewIngredientDataError(ing, resolved) : '';
      const errorEl = row.querySelector('.r-row-error');
      const mappingEl = row.querySelector('.review-mapping-status');
      if(editBtn) editBtn.style.display = resolvedProduct ? 'inline-block' : 'none';
      if(mappingEl) {
        const group = ing?.groupId ? getIngredientGroup(ing.groupId) : null;
        mappingEl.textContent = group ? `${getGroupHierarchyText(group)}${resolvedProduct?.name ? ` · ${resolvedProduct.name}` : ''}` : (resolvedProduct?.name || 'Not mapped yet');
        mappingEl.classList.toggle('unmapped', !group && !resolvedProduct);
        if(html){
          const info=document.createElement('button');
          info.type='button';
          info.className='btn sm ghost nutrition-info-button';
          info.textContent='Nutrition details';
          mappingEl.append(' · ',info);
          bindReviewTooltip(info,html,`Open nutrition contribution for ${resolvedProduct?.name||ing?.name||'ingredient'}`);
        }
      }
      if(input) {
        if(errorText) {
          input.style.borderColor = 'var(--red)';
          input.style.boxShadow = '0 0 0 2px rgba(166,27,27,.10)';
          input.title = errorText;
        } else {
          input.style.borderColor = '';
          input.style.boxShadow = '';
          input.title = '';
        }
      }
      if(errorEl) {
        errorEl.textContent = errorText;
        errorEl.style.display = errorText ? 'block' : 'none';
      }
      row.style.cursor = '';
    });
}
function renderModalMethod(prefix, steps) {
    const list = document.getElementById(prefix + '-method-list');
    if (list && window.RecipeStepRow?.renderModalMethodList) { list.innerHTML = window.RecipeStepRow.renderModalMethodList(prefix, steps); }
}
function copyOriginalMethodToEnhanced(){
    if (window.RecipeStepRow?.copyOriginalMethodToEnhanced) { window.RecipeStepRow.copyOriginalMethodToEnhanced(); }
}
function addModalIng(prefix) {
    const container = document.getElementById(prefix + '-ings-list');
    if (!container) return;
    const div = window.RecipeIngredientRow?.createBlankIngredientRow(prefix);
    if (!div) return;
    const sectionOptions = document.getElementById(prefix + '-section-options');
    if (sectionOptions) container.insertBefore(div, sectionOptions);
    else container.appendChild(div);
    refreshReviewSectionOptions(prefix);
}
function addModalMethod(prefix) {
    const container = document.getElementById(prefix + '-method-list');
    if (!container) return;
    const div = window.RecipeStepRow?.createBlankMethodRow(prefix);
    if (!div) return;
    container.appendChild(div);
    reindexModalMethod(prefix);
    updateSaveBothVisibility();
}
function reindexModalMethod(prefix) {
    if (window.RecipeStepRow?.reindexModalMethodRows) { window.RecipeStepRow.reindexModalMethodRows(prefix); }
}
function renderReviewCostSummary(nutrition, portions) { return window.RecipeEditorModal?.renderReviewCostSummary(nutrition, portions) ?? ''; }
function renderProteinEfficiencyAnalysisSection(modalIngs, recipe, prefix = 'enh') {
  if (window.RecipeEditorModalUI?.renderProteinEfficiencyAnalysisSection) {
    return window.RecipeEditorModalUI.renderProteinEfficiencyAnalysisSection(modalIngs, recipe, prefix);
  }
  if(!modalIngs || !modalIngs.length) return '';
  const items = [];
  modalIngs.forEach((ing, idx) => {
    if(ing.excludeNutrition) return;
    const c = getIngredientContribution(ing, recipe, recipe.serves);
    if(!c) return;
    const cal = c.total?.cal || 0;
    const prot = c.total?.prot || 0;
    if(cal <= 0) return;
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
  if(!items.length) return '';
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
            <span style="color:var(--text2);margin-right:4px">#${rank+1}</span> ${ppEscapeHtml(item.name)}
          </div>
          <div style="font-size:11px;color:var(--text2)">${Math.round(item.cal)} kcal · ${round1(item.prot)}g protein</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="badge ${tagClass}" style="font-size:11px">${displayPPer100}g P / 100 kcal</span>
          ${!isBest ? `<button type="button" class="btn sm ghost" onclick="searchSubstituteForIngredient('${ppEscapeAttr(prefix)}', '${ppEscapeAttr(item.name)}')">Replace</button>` : ''}
          <button type="button" class="btn sm ghost" onclick="highlightReviewIngredientRow('${ppEscapeAttr(prefix)}', ${item.idx})">Locate</button>
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
const renderLeastProteinEfficientSection = renderProteinEfficiencyAnalysisSection;
function searchSubstituteForIngredient(prefix, name) {
  const searchInput = document.getElementById(`enhance-search-${prefix}`);
  const sortSelect = document.getElementById(`enhance-sort-${prefix}`);
  if(sortSelect) sortSelect.value = 'protein_per_kcal';
  if(searchInput) {
    searchInput.value = name;
    renderEnhancementFinder(prefix);
    const toolDetails = searchInput.closest('details');
    if(toolDetails) toolDetails.open = true;
    searchInput.focus();
    searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
function highlightReviewIngredientRow(prefix, idx) {
  const rows = document.querySelectorAll(`#${prefix}-ings-list .rev-ing-row`);
  const targetRow = rows[idx];
  if(targetRow) {
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetRow.style.transition = 'background-color 0.3s ease, outline 0.3s ease';
    targetRow.style.outline = '2px solid var(--purple, #8b5cf6)';
    targetRow.style.backgroundColor = 'var(--purple-bg, rgba(139, 92, 246, 0.15))';
    setTimeout(() => {
      targetRow.style.outline = '';
      targetRow.style.backgroundColor = '';
    }, 2500);
  }
}
function recalcModal(prefix) {
    const rows = document.querySelectorAll(`#${prefix}-ings-list .rev-ing-row`);
    const serves = getReviewServesFallback();
    let unmappedWarning = false;
    let validIngs = [];
    let modalIngs = [];
    rows.forEach(r => {
        if(r.dataset.tempRemoved === '1') return;
        const qty = parseFloat(r.querySelector('.r-qty').value) || 0;
        const unit = r.querySelector('.r-unit').value;
        const section = r.querySelector('.r-section')?.value.trim() || '';
        const name = r.querySelector('.r-name').value.trim();
        const excludeNutrition = !!r.querySelector('.r-exclude-nutrition')?.checked;
        let bankId = r.dataset.bankid;
        let groupId = r.dataset.groupid;
        let ingredientId = r.dataset.ingredientid || '';
        const mappedViaIngredient = r.dataset.mappedViaIngredient === '1';
        if(!groupId && name) {
            const groupMatch = fuzzyMatchIngredientGroup(name);
            if(groupMatch) {
                groupId = groupMatch.id;
                r.dataset.groupid = groupId;
                const product = resolveProductForIngredient({ groupId }).product;
                bankId = product?.id || bankId || "";
                r.dataset.bankid = bankId;
            } else {
                const match = fuzzyMatchBank(name);
                if(match) {
                    bankId = match.id;
                    groupId = match.groupId || "";
                    r.dataset.bankid = bankId;
                    r.dataset.groupid = groupId;
                }
            }
        }
        if(groupId && !bankId) {
            const product = resolveProductForIngredient({ groupId }).product;
            bankId = product?.id || "";
            r.dataset.bankid = bankId;
        }
        const editBtn = r.querySelector('.r-edit-ing');
        if(editBtn) editBtn.style.display = bankId ? 'inline-block' : 'none';
        if(name) {
            const modalIng = {
                raw: `${qty} ${unit !== 'qty' ? unit : ''} ${name}`.trim(),
                qty,
                unit,
                name,
                ...(section ? { section } : {}),
                groupId,
                bankId,
                ...(ingredientId ? { ingredientId, mappedViaIngredient } : {}),
                excludeNutrition,
                ...(r.dataset.stockWater ? { isStock: true, stockWaterMl: +r.dataset.stockWater || null } : {})
            };
            modalIngs.push(modalIng);
            if(groupId || bankId) {
                validIngs.push({ groupId, bankId });
            } else { unmappedWarning = true; }
        }
    });
    const who = getReviewWhoFallback();
    const mealTypes = getReviewMealTypesFallback();
    const mealType = getContextMealType('review', currentReviewInstanceId, mealTypes[0] || 'dinner');
    const bundle = calculateRecipeDisplayNutrition({ recipe:null, ingredients:modalIngs, serves, who, mealType, instanceId:currentReviewInstanceId });
    const nutrition = bundle.nutrition;
    const total = bundle.totalNutrition;
    const ps = bundle.perServing;
    const portions = bundle.portions;
    document.getElementById(prefix + '-cal').value   = ps.cal;
    document.getElementById(prefix + '-prot').value  = ps.prot;
    document.getElementById(prefix + '-carb').value  = ps.carb;
    document.getElementById(prefix + '-fat').value   = ps.fat;
    document.getElementById(prefix + '-fibre').value = ps.fibre;
    document.getElementById(prefix + '-pe').value = portions.e;
    document.getElementById(prefix + '-pc').value = portions.c;
    let warns = [];
    if(unmappedWarning) warns.push(`<strong>Note:</strong> Some ingredients added manually are unmapped. They will count as 0 calories.`);
    const warnEl = document.getElementById(prefix + '-warn');
    if(warns.length) {
        warnEl.innerHTML = warns.join('<br>');
        warnEl.style.display = 'block';
    } else { warnEl.style.display = 'none'; }
    const portionSummary = document.getElementById(prefix + '-portion-summary');
    if(portionSummary) {
      portionSummary.innerHTML = `
        <div style="margin-bottom:14px;background:var(--surface2);padding:10px;border-radius:8px">
            <div style="font-weight:600;font-size:12px;margin-bottom:6px">Portion Allocation (${mealType})</div>
            <div style="font-size:12px;display:flex;gap:15px;flex-wrap:wrap">
                ${portions.ePct > 0 ? `<div><strong>Elliott:</strong> ${portions.e}</div>` : ''}
                ${portions.cPct > 0 ? `<div><strong>Chloe:</strong> ${portions.c}</div>` : ''}
            </div>
        </div>
        <div class="grid2" style="margin-bottom:14px;">
          ${renderPortionTargetBox('Elliott', portions, 'e')}
          ${renderPortionTargetBox('Chloe', portions, 'c')}
        </div>
      `;
    }
    const tooltipRecipe = { ingredients: modalIngs, serves, who, types: mealTypes, resolutionContext: getReviewResolutionContext(), instanceId: currentReviewInstanceId };
    const nutritionSummary = document.getElementById(prefix + '-nutrition-summary');
    if(nutritionSummary) {
      nutritionSummary.innerHTML = renderReviewCostSummary(nutrition, portions) + renderLeastProteinEfficientSection(modalIngs, tooltipRecipe, prefix);
      if(prefix === 'enh') nutritionSummary.innerHTML += getImprovementSuggestions(validIngs, 'enh');
    }
    if(prefix === 'orig') {
        document.getElementById('orig-improvements').innerHTML = getImprovementSuggestions(validIngs, 'orig');
        setTimeout(() => renderEnhancementFinder('orig'), 0);
    }
    if(prefix === 'enh') setTimeout(() => renderEnhancementFinder('enh'), 0);
    bindPortionNutritionTooltips(portionSummary, tooltipRecipe, serves);
    updateModalIngredientContributionTitles(prefix);
    updateModalNutritionBreakdownTooltips(prefix, tooltipRecipe);
    if(prefix === 'enh') updateSaveBothVisibility();
}
function openModal(name,result,isFallback, options = {}){
  if (window.RecipeEditorModal?.openModal) { return window.RecipeEditorModal.openModal(name, result, isFallback, options); }
}
function switchModalTab(tab){
  if (window.RecipeEditorModal?.switchModalTab) { return window.RecipeEditorModal.switchModalTab(tab); }
}
function closeModal(preserveEditorReturn=false){
  if (window.RecipeEditorModal?.closeModal) { return window.RecipeEditorModal.closeModal(preserveEditorReturn); }
  document.getElementById('modal-wrap')?.classList.remove('open');
}
function normaliseReviewCompareText(value) { return window.RecipeAuthoringService?.normaliseReviewCompareText(value) ?? String(value || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
function comparableReviewIngredients(prefix){
    const ings = extractModalList(prefix).ings;
    return window.RecipeAuthoringService?.comparableReviewIngredients(ings) ?? ings;
}
function comparableReviewSteps(prefix){
    const steps = Array.from(document.querySelectorAll(`#${prefix}-method-list .r-step`)).map(el => el.value);
    return window.RecipeAuthoringService?.comparableReviewSteps(steps) ?? steps;
}
function hasMeaningfulEnhancedModalChanges(){
    if (window.RecipeAuthoringService?.hasMeaningfulEnhancedChanges) {
        return window.RecipeAuthoringService.hasMeaningfulEnhancedChanges({
            origName: document.getElementById('orig-name')?.value || '',
            enhName: document.getElementById('enh-name')?.value || '',
            changesText: document.getElementById('enh-changes')?.value || '',
            origIngs: extractModalList('orig').ings,
            enhIngs: extractModalList('enh').ings,
            origSteps: Array.from(document.querySelectorAll('#orig-method-list .r-step')).map(el => el.value),
            enhSteps: Array.from(document.querySelectorAll('#enh-method-list .r-step')).map(el => el.value)
        });
    }
    return false;
}
function updateSaveBothVisibility(){
    const btn = document.getElementById('save-both-btn');
    if(!btn) return;
    if (currentReviewInstanceId) { btn.style.display = 'none'; return; }
    btn.style.display = hasMeaningfulEnhancedModalChanges() ? '' : 'none';
}
function extractModalList(prefix) {
    const ings = [];
    document.querySelectorAll(`#${prefix}-ings-list .rev-ing-row`).forEach(r => {
        if(r.dataset.tempRemoved === '1') return;
        const qty = parseFloat(r.querySelector('.r-qty')?.value) || 1;
        const unit = r.querySelector('.r-unit')?.value || 'qty';
        const section = r.querySelector('.r-section')?.value?.trim() || '';
        const name = r.querySelector('.r-name')?.value?.trim() || '';
        const excludeNutrition = !!r.querySelector('.r-exclude-nutrition')?.checked;
        const bankId = r.dataset.bankid || '';
        const groupId = r.dataset.groupid || '';
        const ingredientId = r.dataset.ingredientid || '';
        const mappedViaIngredient = r.dataset.mappedViaIngredient === '1';
        const stockWaterMl = +r.dataset.stockWater || null;
        if(name) {
            ings.push({
                raw: `${qty} ${unit !== 'qty' ? unit : ''} ${name}`.trim(),
                qty, unit, name, groupId, bankId,
                ...(section ? { section } : {}),
                ...(ingredientId ? { ingredientId, mappedViaIngredient } : {}),
                ...(stockWaterMl ? { isStock: true, stockWaterMl } : {}),
                ...(excludeNutrition ? { excludeNutrition: true } : {})
            });
        }
    });
    const steps = [];
    document.querySelectorAll(`#${prefix}-method-list .rev-method-row`).forEach(r => {
        const text = r.querySelector('.r-step')?.value?.trim() || '';
        if(text) steps.push(text);
    });
    return { ings:orderRecipeIngredientsBySection(ings), steps };
}
function buildRecipeFromModal(useEnh){
  const types=getReviewMealTypesFallback();
  const serves=getReviewServesFallback();
  const existing = editId ? state.recipes.find(x => x.id === editId) : null;
  const eData = extractModalList('enh');
  const oData = extractModalList('orig');
  const originalSteps = oData.steps.length ? oData.steps : ((existing?.steps || existing?.method || []).filter(Boolean));
  const existingEnhSteps = (existing?.enhanced?.method || existing?.enhanced?.steps || []).filter(Boolean);
  const enhancedSteps = eData.steps.length ? eData.steps : existingEnhSteps;
  const origPS = {
    cal:   +document.getElementById('orig-cal')?.value   || 0,
    prot:  +document.getElementById('orig-prot')?.value  || 0,
    carb:  +document.getElementById('orig-carb')?.value  || 0,
    fat:   +document.getElementById('orig-fat')?.value   || 0,
    fibre: +document.getElementById('orig-fibre')?.value || 0
  };
  const origTotal = {
    cal:   Math.round(origPS.cal   * serves),
    prot:  Math.round(origPS.prot  * serves * 10) / 10,
    carb:  Math.round(origPS.carb  * serves * 10) / 10,
    fat:   Math.round(origPS.fat   * serves * 10) / 10,
    fibre: Math.round(origPS.fibre * serves * 10) / 10
  };
  const enh = (useEnh && eData.ings.length > 0) ? (() => {
    const enhPS = {
      cal:   +document.getElementById('enh-cal')?.value   || 0,
      prot:  +document.getElementById('enh-prot')?.value  || 0,
      carb:  +document.getElementById('enh-carb')?.value  || 0,
      fat:   +document.getElementById('enh-fat')?.value   || 0,
      fibre: +document.getElementById('enh-fibre')?.value || 0
    };
    const enhTotal = {
      cal:   Math.round(enhPS.cal   * serves),
      prot:  Math.round(enhPS.prot  * serves * 10) / 10,
      carb:  Math.round(enhPS.carb  * serves * 10) / 10,
      fat:   Math.round(enhPS.fat   * serves * 10) / 10,
      fibre: Math.round(enhPS.fibre * serves * 10) / 10
    };
    const enhName = document.getElementById('enh-name')?.value?.trim() || (document.getElementById('orig-name')?.value ? `${document.getElementById('orig-name').value} (enhanced)` : (existing?.enhanced?.name || 'Enhanced Recipe'));
    return {
      name:    enhName,
      ...enhPS,                                   // flat per-serving fields for backwards compat
      nutrition: { total: enhTotal, perServing: enhPS },
      portionE: document.getElementById('enh-pe')?.value || existing?.enhanced?.portionE || '',
      portionC: document.getElementById('enh-pc')?.value || existing?.enhanced?.portionC || '',
      changes:  document.getElementById('enh-changes')?.value || existing?.enhanced?.changes || '',
      ingredients: eData.ings,
      method:   enhancedSteps,
      updatedAt: new Date().toISOString()
    };
  })() : null;
  const origName = document.getElementById('orig-name')?.value?.trim() || existing?.name || 'Untitled Recipe';
  return {
    id:    editId || ('r' + Date.now()),
    name:  origName,
    types, serves,
    who:   getReviewWhoFallback(),
    time:  +document.getElementById('r-time')?.value || existing?.time || null,
    source: getSource(),
    ...origPS,                                     // flat per-serving fields for backwards compat
    nutrition: { total: origTotal, perServing: origPS },
    portions: { e: document.getElementById('orig-pe')?.value || existing?.portions?.e || '', c: document.getElementById('orig-pc')?.value || existing?.portions?.c || '' },
    ingredients: oData.ings,
    steps:  originalSteps,
    estimated: false,
    enhanced: enh,
    updatedAt: new Date().toISOString()
  };
}
function saveBoth(){
  if(currentReviewInstanceId) return saveTemporaryPlanReview();
  saveToVault(buildRecipeFromModal(true));
}
function saveOrigOnly(){
  if(currentReviewInstanceId) return saveTemporaryPlanReview();
  const r = buildRecipeFromModal(false);
  r.enhancedOptOut = true;
  saveToVault(r);
}
function saveTemporaryPlanReview(){
  if(!currentReviewInstanceId) return;
  const activePrefix = document.getElementById('mtab-enhanced')?.classList.contains('active') ? 'enh' : 'orig';
  applyTemporaryReviewOverrides(activePrefix);
  closeModal();
  showMsg('form-msg','Temporary meal-plan recipe updated. The Recipe Vault version was not changed.','success');
}
function confirmSave() { saveBoth(); }
function deleteEnhancedVersion() {
    if(!editId) return;
    openAppConfirmModal('Remove enhanced version?','The original recipe will remain unchanged.','Remove enhanced version',()=>{
      const r = state.recipes.find(x=>x.id === editId);
      if(r) {
          delete r.enhanced;
          saveState();
          closeModal();
          renderVault();
          showPlatePlanToast('Enhanced version removed.');
      }
    });
}
function saveToVault(r){
  if(!r || typeof r !== 'object') return;
  runWithRecoveryPoint('Before saving recipe ' + (r.name || 'recipe'), () => {
    ensureIngredientGroups();
    const attachGroups = list => (list || []).forEach(ing => {
      if(!ing || typeof ing !== 'object') return;
      if(!ing.groupId && ing.bankId) {
        const product = getProduct(ing.bankId);
        if(product?.groupId) ing.groupId = product.groupId;
      }
      if(ing.groupId && !ing.bankId) ing.bankId = resolveProductForIngredient(ing).product?.id || "";
    });
    attachGroups(r.ingredients);
    if(r.enhanced?.ingredients) attachGroups(r.enhanced.ingredients);
    recalcRecipeObject(r);
    const nowIso = new Date().toISOString();
    r.updatedAt = nowIso;
    if (r.enhanced && typeof r.enhanced === 'object') { r.enhanced.updatedAt = nowIso; }
    if(!r.id) r.id = 'r' + Date.now();
    if(editId){
      const i=state.recipes.findIndex(x=>x.id===editId);
      if(i>-1) state.recipes[i]=r;
      else state.recipes.push(r);
    } else {
      const existingIndex = state.recipes.findIndex(x=>x.id===r.id);
      if(existingIndex>-1) state.recipes[existingIndex]=r;
      else state.recipes.push(r);
    }
    platePlanNutritionCache.clear();
    markPlatePlanViewsDirty();
    rebuildPlatePlanIndexes();
    saveState(true);
    try {
      if (typeof saveRecipe === 'function') { saveRecipe(r).catch(err => console.warn('saveRecipe error in saveToVault:', err)); }
    } catch(err) {
      console.warn('saveRecipe error in saveToVault:', err);
    }
    closeModal(true);
    clearForm();
    const isBatch = Boolean(state && Array.isArray(state.importQueue) && state.importQueue.length > 0 && typeof state.importQueueIndex === 'number' && state.importQueueIndex < state.importQueue.length);
    if(isBatch){
      const completedIdx = state.importQueueIndex;
      const totalCount = state.importQueue.length;
      if(completedIdx + 1 < totalCount){
        state.importQueueIndex = completedIdx + 1;
        showPlatePlanToast(`Saved "${r.name}" (${completedIdx + 1} of ${totalCount})`);
        loadBatchRecipeIntoStepA(state.importQueue[state.importQueueIndex]);
      } else {
        state.importQueue = [];
        state.importQueueIndex = 0;
        updateBatchUiBanners();
        finishEditorReturn('vault');
        renderVault();
        showPlatePlanToast(`All ${totalCount} recipes imported successfully!`);
      }
    } else {
      finishEditorReturn('vault');
      showPlatePlanToast(`Saved "${r.name}" to Recipe Vault`);
    }
  });
}
function dataQualityFingerprint(value) { return window.DataQualityService?.dataQualityFingerprint(value) ?? ''; }
function isDataQualityWarningIgnored(key, fingerprint = '') { return window.DataQualityService?.isDataQualityWarningIgnored(key, fingerprint, state.dataQualityDismissals, state.ignoredDataQualityWarnings) ?? false; }
async function ignoreDataQualityWarning(key, fingerprint = ''){
    if(!key) return;
    const fp = fingerprint || dataQualityFingerprint(key);
    try {
      await executeDataQualityTransaction('DISMISS_WARNING', { key, fingerprint: fp });
      renderDataQuality();
    } catch(e) {
      console.error('ignoreDataQualityWarning failed:', e);
    }
}
function createDataQualityIssue({ entityType, entityId, code, severity = 'gap', title, message, fixButtonHtml = '', fixTarget = null, source = null, legacyKey = '' }){
    if (window.DataQualityService?.createDataQualityIssue) {
        return window.DataQualityService.createDataQualityIssue({ entityType, entityId, code, severity, title, message, fixButtonHtml, fixTarget, source, legacyKey });
    }
    const key = `${entityType}:${entityId}:${code}`;
    return { entityType, entityId, code, severity, title, message, fixButtonHtml, fixTarget, key, legacyKey, fingerprint:dataQualityFingerprint(source) };
}
function openSubtypeResolutionModal(subTypeId, issueKey = '') { return window.DataQualityFixModal?.openSubtypeResolutionModal(subTypeId, issueKey); }
function closeSubtypeResolutionModal() { return window.DataQualityFixModal?.closeSubtypeResolutionModal(); }
function openTescoJsonImportModal(subTypeId) { return window.DataQualityFixModal?.openTescoJsonImportModal(subTypeId); }
function closeTescoJsonImportModal() { return window.DataQualityFixModal?.closeTescoJsonImportModal(); }
function filterSubtypeLinkProducts(query, subTypeId) { return window.DataQualityFixModal?.filterSubtypeLinkProducts(query, subTypeId); }
function resolveSubtypeViaExisting(subTypeId, productId) {
  const product = getProduct(productId);
  if (!product) { showPlatePlanToast('Product not found.'); return; }
  relinkSubtypeProductsInRecipes(subTypeId, productId);
  closeSubtypeResolutionModal();
  renderDataQuality();
  showPlatePlanToast(`Linked "${product.name}" to sub-type successfully! ✓`);
}
function resolveSubtypeViaTesco(subTypeId) { openTescoJsonImportModal(subTypeId); }
function resolveSubtypeViaManual(subTypeId) {
  const group = getIngredientGroup(subTypeId);
  const subTypeName = group ? (group.name || getGroupTypeName(group)) : (subTypeId || '');
  closeSubtypeResolutionModal();
  showView('bank');
  productBankGroupFilterId = subTypeId;
  renderBank();
  if (typeof openAddProductModal === 'function') {
    openAddProductModal({ id: subTypeId, name: subTypeName, groupId: subTypeId });
  } else if (typeof showAddIng === 'function') {
    showAddIng();
    const nameInput = document.getElementById('mi-name');
    if (nameInput) nameInput.value = subTypeName;
  }
}
function fixSubtypeDataQuality(subTypeId, issueKey = '') { openSubtypeResolutionModal(subTypeId, issueKey); }
window.openSubtypeResolutionModal = openSubtypeResolutionModal; window.closeSubtypeResolutionModal = closeSubtypeResolutionModal; window.filterSubtypeLinkProducts = filterSubtypeLinkProducts;
window.resolveSubtypeViaExisting = resolveSubtypeViaExisting; window.resolveSubtypeViaTesco = resolveSubtypeViaTesco; window.resolveSubtypeViaManual = resolveSubtypeViaManual; window.fixSubtypeDataQuality = fixSubtypeDataQuality;
function beginDataQualityFix(entityType, entityId, issueKey) { return window.DataQualityDrawer?.beginDataQualityFix(entityType, entityId, issueKey); }
function openProductMappingModal(ingredientId, issueKey = '') {
  if (typeof ingredientId === 'string' && ingredientId.includes(':')) {
    const parts = ingredientId.split(':');
    const recipe = getRecipe(parts[0]);
    const variant = parts[1] === 'enhanced' ? recipe?.variants?.enhanced : (recipe?.variants?.original || recipe);
    const ing = variant?.ingredients?.[+parts[2]];
    openUnifiedMappingModal({
      type: 'recipeIngredient',
      recipeId: parts[0],
      variantKey: parts[1],
      ingredientIndex: +parts[2],
      ingredientName: ing?.name || ing?.raw || 'Ingredient',
      rawText: ing?.raw || ing?.name || '',
      qty: ing?.qty ?? ing?.grams ?? '',
      unit: ing?.unit || '',
      issueKey: issueKey || ''
    });
    return;
  }
  let ing = null;
  if (Array.isArray(state?.ingredients)) {
    ing = state.ingredients.find(i => i && i.id === ingredientId);
  }
  if (!ing && state?.ingredients && typeof state.ingredients === 'object') { ing = state.ingredients[ingredientId]; }
  openUnifiedMappingModal({
    type: 'ingredient',
    ingredientId: ingredientId,
    ingredientName: ing?.name || ingredientId || 'Ingredient',
    rawText: ing?.raw || ing?.name || '',
    qty: ing?.qty ?? ing?.grams ?? '',
    unit: ing?.unit || '',
    initialQuery: ing?.name || '',
    issueKey: issueKey || ''
  });
}
window.openProductMappingModal = openProductMappingModal;
window.showProductSearchModal = openProductMappingModal;
function abandonEditorReturn() { return window.DataQualityDrawer?.abandonEditorReturn(); }
function finishEditorReturn(defaultView = '') { return window.DataQualityDrawer?.finishEditorReturn(defaultView); }
function dataQualityFixButton(issue) { return window.DataQualityIssueRow?.dataQualityFixButton(issue) ?? ''; }
function renderDataQualityIssue(issue, dismissible = false) { return window.DataQualityIssueRow?.renderDataQualityIssue(issue, dismissible) ?? ''; }
function renderDataQualityWarningRow(title, message, fixButtonHtml = '', ignoreKey = '') { return window.DataQualityIssueRow?.renderDataQualityWarningRow(title, message, fixButtonHtml, ignoreKey) ?? ''; }
function renderDataQuality() { return window.DataQualityDrawer?.renderDataQualityView(); }
function updateDataQualityBadge(count = 0, blockers = 0, gaps = 0) { return window.DataQualityDrawer?.updateDataQualityBadge(count, blockers, gaps); }
window.updateDataQualityBadge = updateDataQualityBadge;
function runDataQualityAudits(shouldRender = false) {
  const audit = window.DataQualityService?.runDataQualityAudit(state) || { issues: [], advisories: [], blockers: [], gaps: [], totalCount: 0, blockerCount: 0, gapCount: 0 };
  updateDataQualityBadge(audit.totalCount, audit.blockerCount, audit.gapCount);
  if (shouldRender || document.getElementById('view-data')?.classList.contains('active')) renderDataQuality();
  window.dispatchEvent(new CustomEvent('plateplan:data-quality-updated', { detail: audit }));
  return audit;
}
window.runDataQualityAudits = runDataQualityAudits;
function deleteCategory(slug) {
  const affected = state.ingredients.filter(i => i.cat === slug);
  if (affected.length === 0) {
    openAppConfirmModal('Delete category?', `Delete <strong>${ppEscapeHtml(CAT[slug] || slug)}</strong>?`, 'Delete category', async () => {
      try {
        await executeDataQualityTransaction('DELETE_CATEGORY', { slug });
        ['mi-cat', 'pp-cat', 'tp-cat', 'mini-cat'].forEach(id => renderCatOptions(id, 'other'));
        renderDataQuality(); renderBank();
      } catch (e) { console.error('Delete category failed:', e); }
    });
    return;
  }
  const otherCats = Object.entries(CAT).filter(([k]) => k !== slug), catOptions = otherCats.map(([k, v]) => `<option value="${k}">${v}</option>`).join(''), ingList = affected.map(i => `<li style="font-size:13px;margin:2px 0">${i.name}</li>`).join('');
  const modal = document.createElement('div');
  modal.id = 'cat-reassign-modal'; modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:300';
  modal.innerHTML = `<div style="background:var(--surface);border-radius:14px;padding:24px;max-width:420px;width:90%;max-height:80vh;overflow-y:auto">
    <h3 style="margin-bottom:10px">Reassign Ingredients</h3>
    <p style="font-size:13px;color:var(--text2);margin-bottom:10px">The following ${affected.length} ingredient(s) must be reassigned:</p>
    <ul style="margin:0 0 14px 16px;padding:0">${ingList}</ul>
    <div style="margin-bottom:12px">
      <label style="font-size:12px;color:var(--text2);margin-bottom:4px;display:block">Move to existing category</label>
      <select id="cat-reassign-existing" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px"><option value="">— choose —</option>${catOptions}</select>
    </div>
    <div style="margin-bottom:16px;border-top:1px solid var(--border);padding-top:12px">
      <label style="font-size:12px;color:var(--text2);margin-bottom:4px;display:block">Or create a new category</label>
      <input id="cat-reassign-new" type="text" placeholder="New category name" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;background:var(--surface);color:var(--text)">
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn" onclick="document.getElementById('cat-reassign-modal').remove()">Cancel</button>
      <button class="btn primary" onclick="confirmCategoryReassign('${slug}')">Reassign &amp; Delete</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}
function confirmCategoryReassign(oldSlug) {
  const existingVal = document.getElementById('cat-reassign-existing').value, newName = document.getElementById('cat-reassign-new').value.trim();
  if (!existingVal && !newName) { openAppInfoModal('Choose a category', 'Please choose or enter a category.'); return; }
  applyCategoryReassign(oldSlug, existingVal, newName);
}
async function applyCategoryReassign(oldSlug, existingVal, newName) {
  let targetSlug = existingVal;
  if (!targetSlug && newName) {
    targetSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    state.customCats[targetSlug] = newName; CAT[targetSlug] = newName;
  }
  try {
    await executeDataQualityTransaction('REASSIGN_CATEGORY', { oldSlug, targetSlug });
    document.getElementById('cat-reassign-modal')?.remove();
    ['mi-cat', 'pp-cat', 'tp-cat', 'mini-cat'].forEach(id => renderCatOptions(id, 'other'));
    refreshHierarchyViews(); renderDataQuality(); renderBank();
  } catch (e) { console.error('applyCategoryReassign failed:', e); }
}
function editCategory(slug) {
  let currentName = CAT[slug];
  openAppPromptModal('Edit category', 'Category name', currentName, 'Save', async newName => {
    if (newName.trim() !== currentName) {
      try {
        await executeDataQualityTransaction('RENAME_CATEGORY', { slug, newName });
        ['mi-cat', 'pp-cat', 'tp-cat', 'mini-cat'].forEach(id => { const el = document.getElementById(id); if (el) renderCatOptions(id, el.value); });
        renderDataQuality(); renderBank();
      } catch (e) { console.error('editCategory failed:', e); }
    }
  });
}
function openMergeModal(primaryId, groupKey) { return window.DataQualityFixModal?.openMergeModal(primaryId, groupKey); }
function closeMergeModal() { return window.DataQualityFixModal?.closeMergeModal(); }
async function executeMerge() {
  if (!window.mergeContext) return;
  await applyProductMerge();
}
async function applyProductMerge() {
  if (!window.mergeContext) return;
  const { primary, others } = window.mergeContext;
  const pId = primary.id;
  const oldIds = others.map(o => o.id);
  const primaryGroup = ensureProductAssignedToGroup(primary, primary.name, primary.groupId || '', !!primary.groupId);
  try {
    await executeDataQualityTransaction('MERGE_PRODUCTS', {
      primaryId: pId,
      oldIds,
      primaryGroup
    }, {
      modalWrapId: 'merge-modal-wrap',
      successMessage: 'Merge complete. Recipes and plan overrides were updated.'
    });
    refreshProductGroupAndRecipes(pId);
    closeMergeModal();
    renderDataQuality();
    renderBank();
  } catch (err) {
    console.error('applyProductMerge transaction failed:', err);
  }
}
function formatStockIngredientText(ing, scale = 1){
  if(!ing || !ing.stockWaterMl) return '';
  const qty = Math.round(((+ing.qty || 1) * scale) * 10) / 10;
  const water = Math.round((+ing.stockWaterMl || 0) * scale);
  const name = ing.name || 'Stock Cube';
  return `${qty} ${name}${qty === 1 ? '' : 's'} mixed with ${water}ml water`;
}
function ingRaw(ing){
  if(typeof ing==='string') return ing;
  const stockText = formatStockIngredientText(ing);
  if(stockText) return stockText;
  return ing.raw||[ing.qty||'',ing.unit||'',ing.name||''].filter(Boolean).join(' ');
}
function renderExpandableText(text,key,className=''){
  const value=String(text||'');
  const safeKey=String(key||('copy-'+dataQualityFingerprint(value))).replace(/[^a-zA-Z0-9_-]/g,'-');
  const needsToggle=value.length>46;
  return `<span id="expand-${ppEscapeAttr(safeKey)}" class="${ppEscapeAttr(className)}${needsToggle?' clamp-copy':''}">${ppEscapeHtml(value)}</span>${needsToggle?`<button type="button" class="btn text-expand-btn" aria-expanded="false" aria-controls="expand-${ppEscapeAttr(safeKey)}" onclick="toggleExpandableText(this,'expand-${ppEscapeAttr(safeKey)}')">Show more</button>`:''}`;
}
function toggleExpandableText(button,targetId){
  const target=document.getElementById(targetId);
  if(!target)return;
  const expanded=target.classList.toggle('expanded');
  button.setAttribute('aria-expanded',String(expanded));
  button.textContent=expanded?'Show less':'Show more';
}
function openVaultFitDetails(trigger,recipeId,variant='original',personKey='e'){
  const recipe=getProductIndexRecipe(recipeId);
  if(!recipe)return openAppInfoModal('Recipe unavailable','That recipe could not be found.');
  const mealType=getContextMealType(recipe,null,(recipe.types||[recipe.type||'dinner'])[0]);
  const bundle=calculateRecipeDisplayNutrition({recipe,variant,mealType});
  const portions=bundle?.portions||{};
  const person=personKey==='c'?'Chloe':'Elliott';
  const targets=getBudgets(personKey,mealType);
  const calories=personKey==='c'?portions.cCal:portions.eCal;
  const protein=personKey==='c'?portions.cProt:portions.eProt;
  const recipePct=personKey==='c'?portions.c:portions.e;
  const fit=calculateFit(calories,protein,targets.cal,targets.prot);
  const profileScore=Math.round(computeProfileFitScore(calories,targets.cal,protein,targets.prot));
  const html=`<div style="font-weight:750;font-size:16px;margin-bottom:8px">${ppEscapeHtml(person)} · ${ppEscapeHtml(recipe.name)}</div>
    <div class="nutrition-detail-row"><span>Allocated recipe portion</span><strong>${ppEscapeHtml(recipePct||'Not allocated')}</strong></div>
    <div class="nutrition-detail-row"><span>Calories</span><strong>${Math.round(calories||0)} / ${Math.round(targets.cal||0)} kcal</strong></div>
    <div class="nutrition-detail-row"><span>Protein</span><strong>${round1(protein||0)} / ${round1(targets.prot||0)}g</strong></div>
    <div class="nutrition-detail-row"><span>Slot Fit Score (${person})</span><strong>${profileScore}%</strong></div>
    <div class="msg ${fit.warn.length?'info':'success'}" style="margin:10px 0 0">${ppEscapeHtml(fit.warn.join(', ')||'This portion is on target.')}</div>
    <details class="card-details"><summary>Calculation details</summary><div>Fit score is calculated 50% from calorie error relative to target and 50% from protein target achievement for ${person} for ${mealType}.</div></details>`;
  showReviewTooltip(trigger,html,`${person} nutrition and fit details`);
}
let vaultFilterFavouritesOnly = false;
let vaultFilterFavoritesOnly = false;
let platePlanUseUpFinder={meal:'dinner',who:'both',productIds:[],assign:null};
function ensureUseUpRecipeFinder(){
  let wrap=document.getElementById('use-up-finder-wrap');
  if(wrap)return wrap;
  wrap=document.createElement('div');wrap.id='use-up-finder-wrap';wrap.className='modal-wrap long-workspace use-up-finder-wrap';
  if (window.UseUpFinderModalUI?.renderFinderWrap) {
    wrap.innerHTML = window.UseUpFinderModalUI.renderFinderWrap();
  }
  document.body.appendChild(wrap);return wrap;
}
function openUseUpRecipeFinder(){
  if(!getUseUpEntries().length){
    showView('planner');setTimeout(()=>openPlanOptionsWorkspace(),0);
    return showPlatePlanToast('Add products to Use up products in Plan options first.');
  }
  const wrap=ensureUseUpRecipeFinder();
  platePlanUseUpFinder.productIds=getUseUpEntries().map(entry=>entry.productId);
  platePlanLastMobileFocus=document.activeElement;wrap.classList.add('open');markMobileLayerForBack(wrap,'use-up-finder');renderUseUpRecipeFinder();
}
function closeUseUpRecipeFinder(fromHistory=false){
  const wrap=document.getElementById('use-up-finder-wrap');if(!wrap)return;
  const marked=wrap.dataset.historyEntry==='1';wrap.classList.remove('open');delete wrap.dataset.historyEntry;restoreMobileLayerFocus();if(marked&&!fromHistory)returnFromPlatePlanUiHistory();
}
function setUseUpFinderFilter(field,value){
  if(field==='meal'&&['breakfast','lunch','dinner'].includes(value))platePlanUseUpFinder.meal=value;
  if(field==='who'&&['Elliott','Chloe','both'].includes(value))platePlanUseUpFinder.who=value;
  renderUseUpRecipeFinder();
}
function toggleUseUpFinderProduct(productId,checked) { const set=new Set(platePlanUseUpFinder.productIds||[]);if(checked)set.add(productId);else set.delete(productId);platePlanUseUpFinder.productIds=[...set];renderUseUpRecipeFinder(); }
function getUseUpFinderResults(){
  const meal=platePlanUseUpFinder.meal,who=platePlanUseUpFinder.who;
  const trafficRules=getPlanTrafficFilterRules();
  let rows=getPlannerRecipeOptions(meal,who==='both'?'any':who,{applyExclusions:true,trafficRules});
  if(who==='both')rows=rows.filter(row=>row.recipe?.who==='both'&&recipeAllowedForPerson(row.recipe,'Elliott')&&recipeAllowedForPerson(row.recipe,'Chloe')&&plannerRecipePassesTrafficFilter(row,meal,'Elliott',trafficRules)&&plannerRecipePassesTrafficFilter(row,meal,'Chloe',trafficRules));
  rows=rows.filter(row=>plannerOptionHasUsableMappings(row,state.prefs.productPriority||'protein'));
  const allowed=new Set(platePlanUseUpFinder.productIds||[]);
  return rankPlannerOptionsForUseUp(rows,meal,who==='Chloe'?'Chloe':'Elliott',[...allowed]).filter(row=>row.useUpCoverage.matches.length).sort((a,b)=>b.useUpCoverage.matches.length-a.useUpCoverage.matches.length||b.useUpRank-a.useUpRank);
}
function renderUseUpRecipeFinder(){
  const controls=document.getElementById('use-up-finder-controls'),results=document.getElementById('use-up-finder-results');if(!controls||!results)return;
  const entries=getUseUpEntries();
  if (window.UseUpFinderModalUI?.renderFinderControls) {
    controls.innerHTML = window.UseUpFinderModalUI.renderFinderControls(entries, platePlanUseUpFinder.meal, platePlanUseUpFinder.who, platePlanUseUpFinder.productIds || []);
  }
  const rows=getUseUpFinderResults();
  if (window.UseUpFinderModalUI?.renderFinderResults) {
    results.innerHTML = window.UseUpFinderModalUI.renderFinderResults(rows, entries, platePlanUseUpFinder.meal, platePlanUseUpFinder.who, platePlanUseUpFinder.productIds || []);
  }
}
function openUseUpAssign(recipeId,variant){
  if(!state.plan?.slots)return openAppConfirmModal('No active plan','Open Meal Planner to generate or set up an active plan first.','Open Meal Planner',()=>{closeUseUpRecipeFinder();showView('planner');});
  const recipe=state.recipes.find(item=>item.id===recipeId);if(!recipe)return;
  platePlanUseUpFinder.assign={recipeId,variant};
  let wrap=document.getElementById('use-up-assign-wrap');if (!wrap) { wrap=document.createElement('div');wrap.id='use-up-assign-wrap';wrap.className='modal-wrap sheet-mobile';document.body.appendChild(wrap); }
  const days=+state.plan.days||0;
  const whoVal = platePlanUseUpFinder.who || 'both';
  if (window.UseUpFinderModalUI?.renderAssignModal) {
    wrap.innerHTML = window.UseUpFinderModalUI.renderAssignModal(recipe.name, days, platePlanUseUpFinder.meal, whoVal, state.plan);
  }
  wrap.classList.add('open');
}
function closeUseUpAssign() { document.getElementById('use-up-assign-wrap')?.classList.remove('open'); }
let platePlanChoiceAction=null;
function openAppChoiceModal(title,copy,choices,onChoose){
  let wrap=document.getElementById('app-choice-wrap');if (!wrap) { wrap=document.createElement('div');wrap.id='app-choice-wrap';wrap.className='modal-wrap sheet-mobile';document.body.appendChild(wrap); }
  platePlanChoiceAction=onChoose;
  wrap.innerHTML=`<div class="modal"><h3>${ppEscapeHtml(title)}</h3><p>${ppEscapeHtml(copy)}</p><div class="btn-row">${(choices||[]).map((choice,index)=>`<button class="btn ${index===choices.length-1?'danger':'primary'}" onclick="chooseAppChoice('${ppEscapeAttr(choice.value)}')">${ppEscapeHtml(choice.label)}</button>`).join('')}<button class="btn ghost" onclick="closeAppChoiceModal()">Cancel</button></div></div>`;
  wrap.classList.add('open');
}
function chooseAppChoice(value) { const action=platePlanChoiceAction;closeAppChoiceModal();if(typeof action==='function')action(value); }
function closeAppChoiceModal() { document.getElementById('app-choice-wrap')?.classList.remove('open');platePlanChoiceAction=null; }
function confirmUseUpAssign(mode='review'){
  const draft=platePlanUseUpFinder.assign;if(!draft)return;
  const day=+document.getElementById('use-up-assign-day')?.value||0,person=document.getElementById('use-up-assign-person')?.value||'both',meal=document.getElementById('use-up-assign-meal')?.value||'dinner';
  const isBoth = person === 'both';
  const keys = isBoth ? [meal+'E', meal+'C'] : [meal+person];
  const occupied = keys.some(k => !!state.plan?.slots?.[day]?.[k]);
  const apply=replace=>{
    keys.forEach(k => {
      const old=state.plan?.slots?.[day]?.[k];
      const next=makePlanSlot(draft.recipeId,draft.variant);
      if(!state.plan.slots[day]) state.plan.slots[day]={};
      state.plan.slots[day][k]=next;
      setPlanSlotReason(day, k, '');
      const info=getPlanSlotInfo(next),ov=getPlanOverride(info.instanceId),coverage=getRecipeUseUpCoverage({id:draft.recipeId,variant:draft.variant,recipe:state.recipes.find(r=>r.id===draft.recipeId)});
      coverage.matches.filter(match=>platePlanUseUpFinder.productIds.includes(match.productId)).forEach(match=>{if(match.product.groupId)ov.productOverrides[match.product.groupId]=match.productId;});
      if(replace==='swap'&&old){
        const personSuffix = k.slice(-1);
        const empty=Object.entries(state.plan.slots).flatMap(([d,slots])=>Object.keys(slots).filter(sk=>!slots[sk]).map(sk=>({day:+d,key:sk}))).find(place=>place.key.endsWith(personSuffix));
        if(empty)state.plan.slots[empty.day][empty.key]=old;
      }
    });
    state.plan.confirmedShopping=false;state.plan.mealPrepGroups=[];state.plan.score=calculatePlanScore(state.plan);platePlanNutritionCache.clear();markPlatePlanViewsDirty();saveState();closeUseUpAssign();renderPlan();showPlatePlanToast(isBoth ? 'Recipe assigned for Elliott & Chloe to active plan.' : 'Recipe assigned to the active plan.');
  };
  if(occupied&&mode==='review')return openAppChoiceModal('That slot is occupied','Choose how to apply this suggestion.',[{label:'Swap to an empty slot',value:'swap'},{label:'Replace existing meal',value:'replace'}],value=>apply(value));
  apply(mode);
}
function safeFileName(name) { return String(name || 'recipe').replace(/[\\/:*?"<>|]+/g,'').replace(/\s+/g,' ').trim() || 'recipe'; }
function normaliseRecipeIngredientSection(section) { return window.RecipeAuthoringService?.normaliseRecipeIngredientSection(section) ?? normaliseAliasText(section || ''); }
function orderRecipeIngredientsBySection(ingredients) { return window.RecipeAuthoringService?.orderRecipeIngredientsBySection(ingredients) ?? (Array.isArray(ingredients) ? ingredients : []); }
function renderGroupedIngredientItems(ingredients, renderItem, options = {}){
  const rows = orderRecipeIngredientsBySection(ingredients);
  const hasSections = rows.some(item => normaliseRecipeIngredientSection(item?.section));
  if(!hasSections) return rows.map(renderItem).join('');
  let current = null;
  const headingStyle = options.headingStyle || 'list-style:none;margin:10px 0 5px -18px;font-weight:700;color:var(--text);';
  return rows.map((item, idx) => {
    const section = normaliseRecipeIngredientSection(item?.section);
    const heading = section && section !== current
      ? (() => { current = section; return `<li class="ingredient-section-heading" style="${headingStyle}">${ppEscapeHtml(section)}</li>`; })()
      : '';
    return heading + renderItem(item, idx);
  }).join('');
}
function downloadRecipeCard(id, tab = 'original', instanceId = null){
  const r = state.recipes.find(x => x.id === id);
  if(!r) return;
  const bundle = calculateRecipeDisplayNutrition({ recipe:r, variant:tab, instanceId });
  if(!bundle) return;
  const { active, types, portions, resolutionContext } = bundle;
  const formatMacro = (value, unit) => `${ppEscapeHtml(unit === 'kcal' ? Math.round(value || 0) : round1(value || 0))}${unit ? ' ' + unit : ''}`;
  const portionBox = (label, prefix) => {
    const isE = prefix === 'e';
    const pct = isE ? portions.ePct : portions.cPct;
    const recipePct = isE ? portions.eRecipePct : portions.cRecipePct;
    if(pct <= 0) return '';
    const cal = isE ? portions.eCal : portions.cCal;
    const prot = isE ? portions.eProt : portions.cProt;
    const carb = isE ? portions.eCarb : portions.cCarb;
    const fat = isE ? portions.eFat : portions.cFat;
    const fibre = isE ? portions.eFibre : portions.cFibre;
    return `<div class="person-card">
      <h3>${label} Portion (${recipePct}%)</h3>
      <div class="macro-grid">
        <div><span>Calories</span><strong>${formatMacro(cal, 'kcal')}</strong></div>
        <div><span>Fat</span><strong>${formatMacro(fat, 'g')}</strong></div>
        <div><span>Carbs</span><strong>${formatMacro(carb, 'g')}</strong></div>
        <div><span>Fibre</span><strong>${formatMacro(fibre, 'g')}</strong></div>
        <div><span>Protein</span><strong>${formatMacro(prot, 'g')}</strong></div>
      </div>
    </div>`;
  };
  const portionNutrition = `
    <section class="nutrition">
      <h2>Portion nutrition</h2>
      <p class="muted">Split this recipe ${portions.ePct > 0 ? `Elliott ${ppEscapeHtml(portions.e)}` : ''}${portions.ePct > 0 && portions.cPct > 0 ? ' / ' : ''}${portions.cPct > 0 ? `Chloe ${ppEscapeHtml(portions.c)}` : ''}.</p>
      <div class="portion-grid">
        ${portionBox('Elliott', 'e')}
        ${portionBox('Chloe', 'c')}
      </div>
    </section>`;
  const ingredients = renderGroupedIngredientItems(active.ingredients || [], ing => {
    const adjusted = typeof ing === 'object' ? getAdjustedIngredientForContext(ing, resolutionContext) : ing;
    const resolved = typeof adjusted === 'object' ? resolveProductForIngredient(adjusted, resolutionContext) : {};
    const generic = typeof ing === 'object' ? ingredientDisplayNameForRecipe(ing) : ingRaw(ing);
    const note = renderIngredientMappingNote(ing, resolved, { fontSize:'12px' });
    return `<li>${ppEscapeHtml(generic)}${ing.excludeNutrition ? ' <span class="muted">not counted</span>' : ''}${note}</li>`;
  }, { headingStyle: 'list-style:none;margin:12px 0 5px -18px;font-weight:700;color:#222;' });
  const steps = (active.steps || active.method || []).map(step => `<li>${ppEscapeHtml(step)}</li>`).join('');
  const source = renderRecipeSourceForPrint(active.source || r.source);
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${ppEscapeHtml(active.name || r.name)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#222;margin:32px;line-height:1.45}
  h1{font-size:28px;margin:0 0 8px}
  h2{font-size:16px;margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:6px}
  .meta{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 18px}
  .pill{border:1px solid #ddd;border-radius:999px;padding:4px 9px;font-size:12px}
  .grid{display:grid;grid-template-columns:1fr 1.4fr;gap:28px}
  .nutrition{margin:18px 0 22px}
  .portion-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px}
  .person-card{border:1px solid #ddd;border-radius:8px;padding:12px;background:#fbfaf7}
  .person-card h3{font-size:15px;margin:0 0 10px}
  .macro-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .macro-grid div{background:#f4f1ec;border:1px solid #ddd;border-radius:8px;padding:8px 10px}
  .macro-grid span{display:block;color:#666;font-size:12px;margin-bottom:3px}
  .macro-grid strong{font-size:18px;font-weight:650}
  li{margin:6px 0}
  .muted,.source{color:#666;font-size:12px}
  @media print{body{margin:18mm}.no-print{display:none}.grid{grid-template-columns:1fr 1.4fr}}
  @media(max-width:700px){.grid,.portion-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<button class="no-print" onclick="window.print()" style="float:right;padding:8px 12px;border:1px solid #bbb;border-radius:8px;background:white">Print</button>
<h1>${ppEscapeHtml(active.name || r.name)}</h1>
<div class="meta">
  ${types.map(t => `<span class="pill">${ppEscapeHtml(t)}</span>`).join('')}
  <span class="pill">${ppEscapeHtml(active.who === 'both' ? 'Shared' : active.who || '')}</span>
  ${active.serves ? `<span class="pill">Serves ${ppEscapeHtml(active.serves)}</span>` : ''}
  ${active.time ? `<span class="pill">${ppEscapeHtml(active.time)}m</span>` : ''}
</div>
${portionNutrition}
${source}
<div class="grid">
  <section><h2>Ingredients</h2><ul>${ingredients}</ul></section>
  <section><h2>Method</h2><ol>${steps}</ol></section>
</div>
</body>
</html>`;
  const blob = new Blob([html], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(active.name || r.name)} recipe card.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function editEnhancedRecipe(id) { capturePlatePlanEditBaseline('recipes/'+id); editRecipeModalView(id); switchModalTab('enhanced'); }
function reviewEnhancedRecipe(id) { editRecipeModalView(id,'enhanced'); }
function deleteEnhancedRecipe(id) {
    const r = state.recipes.find(x => x.id === id);
    if(!r?.enhanced) return;
    openAppConfirmModal('Delete enhanced recipe?', 'Delete the enhanced version? The original recipe will be kept.', 'Delete enhanced version', () =>
      runWithRecoveryPoint('Before deleting enhanced recipe', () => {
        delete r.enhanced;
        refreshPlatePlanDerivedState({ persist:true, render:true });
      })
    );
}
function reviewRecipeModalView(id, instanceId = null, tab = 'original') {
    const r = state.recipes.find(x => x.id === id);
    if(!r) return;
    editId = instanceId ? null : id;
    const hasEnh = !!r.enhanced;
    const tabEnh = document.getElementById('tab-btn-enhanced');
    const tabComp = document.getElementById('tab-btn-compare');
    if(tabEnh) tabEnh.style.display = hasEnh ? 'block' : 'none';
    if(tabComp) tabComp.style.display = hasEnh ? 'block' : 'none';
    const payload = { original: r, enhanced: r.enhanced || {} };
    openModal(r.name, payload, true, { instanceId, tab });
}
function editRecipeModalView(id, initialTab = 'original') {
    capturePlatePlanEditBaseline('recipes/'+id);
    currentReviewInstanceId = null;
    currentReviewVariant = initialTab === 'enhanced' ? 'enhanced' : 'original';
    const r = state.recipes.find(x => x.id === id);
    if (!r) return;
    editId = id;
    const hasEnh = !!r.enhanced;
    const tabEnh = document.getElementById('tab-btn-enhanced');
    const tabComp = document.getElementById('tab-btn-compare');
    if(tabEnh) tabEnh.style.display = hasEnh ? 'block' : 'none';
    if(tabComp) tabComp.style.display = hasEnh ? 'block' : 'none';
    const payload = { original: r, enhanced: r.enhanced || {} };
    openModal(r.name, payload, true, {tab:currentReviewVariant});
}
let previewBaseRecipe = null, currentPreviewInstanceId = null, currentViewTab = 'original', currentPreviewServingMode = 'both', currentPreviewSingleServes = 1;
function closeRecipePreview() { const wrap = document.getElementById('view-modal-wrap'); if (wrap) wrap.classList.remove('open'); }
function switchPreviewServingMode(mode) {
  currentPreviewServingMode = mode;
  const baseServes = previewBaseRecipe ? (+previewBaseRecipe.serves || 2) : 2;
  renderRecipePreview(baseServes);
}
function updateSinglePersonServes(val) {
  const v = Math.max(1, parseInt(val) || 1);
  currentPreviewSingleServes = v;
  const baseServes = previewBaseRecipe ? (+previewBaseRecipe.serves || 2) : 2;
  renderRecipePreview(baseServes);
}
function switchViewTab(tab) {
  if(tab === 'enhanced' && !previewBaseRecipe.enhanced) return;
  currentViewTab = tab;
  const targetServes = parseFloat(document.getElementById('preview-serves')?.value) || previewBaseRecipe.serves || 2;
  renderRecipePreview(targetServes);
}
function updateRecipePreviewScale(val) {
  const target = parseFloat(val);
  if(isNaN(target) || target <= 0) return;
  renderRecipePreview(target);
}
function viewRecipe(id, instanceId = null, tab = 'original', servingMode = 'both') {
  const activeState = window.state || state || {};
  const recipes = activeState.recipes || (typeof state !== 'undefined' ? state.recipes : []) || [];
  const cleanInstanceId = (instanceId === 'null' || instanceId === 'undefined' || !instanceId) ? null : instanceId;
  const r = recipes.find(x => String(x.id) === String(id));
  if (!r) {
    console.warn('[viewRecipe] Recipe not found:', id);
    return;
  }
  const clonedRecipe = clonePlatePlanValue(r); // isolated deep copy for scaling
  if (typeof previewBaseRecipe !== 'undefined') { previewBaseRecipe = clonedRecipe; } else { window.previewBaseRecipe = clonedRecipe; }
  const baseRec = (typeof previewBaseRecipe !== 'undefined' && previewBaseRecipe) || window.previewBaseRecipe || clonedRecipe;
  currentPreviewInstanceId = cleanInstanceId;
  currentViewTab = (tab === 'enhanced' && r.enhanced) ? 'enhanced' : 'original';
  currentPreviewServingMode = servingMode || 'both';
  currentPreviewSingleServes = 1;
  if (cleanInstanceId && activeState.overrides && activeState.overrides[cleanInstanceId]?.substitutions && !activeState.overrides[cleanInstanceId]?.productOverrides) {
      const subs = activeState.overrides[cleanInstanceId].substitutions;
      const applySubs = (ings) => {
          if(!ings) return;
          ings.forEach(ing => {
              if (ing.bankId && subs[ing.bankId]) {
                  const subId = subs[ing.bankId];
                  const subIng = (activeState.ingredients || []).find(i => i.id === subId);
                  if(subIng) {
                      ing.originalBankId = ing.bankId;
                      ing.originalName = ing.name;
                      ing.bankId = subIng.id;
                      ing.name = subIng.name;
                      ing.isSubstituted = true;
                  }
              }
          });
      };
      applySubs(baseRec.ingredients);
      if(baseRec.enhanced) applySubs(baseRec.enhanced.ingredients);
  }
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) wrap.classList.add('open');
  renderRecipePreview(baseRec.serves || 2);
}
function renderRecipePreview(targetServes = 2) {
    const r = previewBaseRecipe;
    if(!r) return;
    const hasEnh = !!r.enhanced;
    const isEnh = currentViewTab === 'enhanced' && hasEnh;
    const bundle = calculateRecipeDisplayNutrition({ recipe:r, variant:isEnh ? 'enhanced' : 'original', instanceId:currentPreviewInstanceId, targetServes });
    if(!bundle) return;
    const activeR = bundle.active;
    const mealType = bundle.mealType;
    const baseServes = activeR.serves || 1;
    const resolutionContext = bundle.resolutionContext;
    const portions = bundle.portions;
    let scale = 1.0;
    let servingModeBannerHtml = '';
    let allocationAndTargetHtml = '';
    if (currentPreviewServingMode === 'elliott') {
      const elliottProportion = (portions.eRecipePct > 0)
        ? (portions.eRecipePct / 100)
        : (portions.eSingleServ > 0 ? (portions.eSingleServ / baseServes) : (1 / baseServes));
      scale = elliottProportion * currentPreviewSingleServes;
      const scaledCal = Math.round(portions.eCal * currentPreviewSingleServes);
      const scaledProt = Math.round(portions.eProt * currentPreviewSingleServes * 10) / 10;
      const scaledCarb = Math.round(portions.eCarb * currentPreviewSingleServes * 10) / 10;
      const scaledFat = Math.round(portions.eFat * currentPreviewSingleServes * 10) / 10;
      servingModeBannerHtml = `
        <div class="recipe-view-serving-banner">
          <div class="recipe-view-serving-info">
            <span>👤 Elliott Only (${currentPreviewSingleServes} serving${currentPreviewSingleServes > 1 ? 's' : ''})</span>
            <span style="font-size:12px;font-weight:normal;color:var(--text2);">Scaled to Elliott's portion (${portions.e})</span>
          </div>
          <div class="recipe-view-macros-pill-group">
            <span class="slot-macro" style="font-size:12px;font-weight:700;">${scaledCal} kcal</span>
            <span class="slot-macro" style="font-size:12px;font-weight:700;">P ${scaledProt}g</span>
            <span class="slot-macro" style="font-size:12px;color:var(--text2);">C ${scaledCarb}g</span>
            <span class="slot-macro" style="font-size:12px;color:var(--text2);">F ${scaledFat}g</span>
          </div>
        </div>
      `;
      allocationAndTargetHtml = `
        <div style="margin-bottom:16px;">
          ${renderPortionTargetBox('Elliott', portions, 'e')}
        </div>
      `;
    } else if (currentPreviewServingMode === 'chloe') {
      const chloeProportion = (portions.cRecipePct > 0)
        ? (portions.cRecipePct / 100)
        : (portions.cSingleServ > 0 ? (portions.cSingleServ / baseServes) : (1 / baseServes));
      scale = chloeProportion * currentPreviewSingleServes;
      const scaledCal = Math.round(portions.cCal * currentPreviewSingleServes);
      const scaledProt = Math.round(portions.cProt * currentPreviewSingleServes * 10) / 10;
      const scaledCarb = Math.round(portions.cCarb * currentPreviewSingleServes * 10) / 10;
      const scaledFat = Math.round(portions.cFat * currentPreviewSingleServes * 10) / 10;
      servingModeBannerHtml = `
        <div class="recipe-view-serving-banner">
          <div class="recipe-view-serving-info">
            <span>👤 Chloe Only (${currentPreviewSingleServes} serving${currentPreviewSingleServes > 1 ? 's' : ''})</span>
            <span style="font-size:12px;font-weight:normal;color:var(--text2);">Scaled to Chloe's portion (${portions.c})</span>
          </div>
          <div class="recipe-view-macros-pill-group">
            <span class="slot-macro" style="font-size:12px;font-weight:700;">${scaledCal} kcal</span>
            <span class="slot-macro" style="font-size:12px;font-weight:700;">P ${scaledProt}g</span>
            <span class="slot-macro" style="font-size:12px;color:var(--text2);">C ${scaledCarb}g</span>
            <span class="slot-macro" style="font-size:12px;color:var(--text2);">F ${scaledFat}g</span>
          </div>
        </div>
      `;
      allocationAndTargetHtml = `
        <div style="margin-bottom:16px;">
          ${renderPortionTargetBox('Chloe', portions, 'c')}
        </div>
      `;
    } else {
      scale = targetServes / baseServes;
      const allocationHtml = `
        <div style="margin-bottom:12px;background:var(--surface2);padding:10px 14px;border-radius:var(--radius-control, 12px);border:1px solid var(--border)">
          <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:var(--text)">Portion Allocation (${toTitleCase(mealType)})</div>
          <div style="font-size:12px;display:flex;gap:18px;flex-wrap:wrap">
            ${portions.ePct > 0 ? `<div><strong>Elliott:</strong> ${portions.e} <span style="color:var(--text2)">(${portions.eCal} kcal · P${portions.eProt}g)</span></div>` : ''}
            ${portions.cPct > 0 ? `<div><strong>Chloe:</strong> ${portions.c} <span style="color:var(--text2)">(${portions.cCal} kcal · P${portions.cProt}g)</span></div>` : ''}
          </div>
        </div>
      `;
      const targetBoxHtml = `
        <div class="grid2" style="margin-bottom:16px;gap:12px;">
          ${renderPortionTargetBox('Elliott', portions, 'e')}
          ${renderPortionTargetBox('Chloe', portions, 'c')}
        </div>
      `;
      allocationAndTargetHtml = allocationHtml + targetBoxHtml;
    }
    const recipeSource = activeR.source || r.source;
    const sourceHtml = recipeSource ? `
      <div style="margin-bottom:14px;background:var(--surface2);padding:10px 14px;border-radius:10px;font-size:12px;color:var(--text2);border:1px solid var(--border)">
        <strong style="color:var(--text)">Source:</strong> ${renderSourceTag(recipeSource)}
      </div>
    ` : '';
    const content = document.getElementById('view-modal-content');
    if (!content) return;
    const variantKey = isEnh ? 'enhanced' : 'original';
    const isFav = (typeof window.isRecipeVariantFavourite === 'function' ? window.isRecipeVariantFavourite(r.id, variantKey) : (typeof isRecipeVariantFavourite === 'function' ? isRecipeVariantFavourite(r.id, variantKey) : false)) || ((r.isFavourite || r.isFavorite) && !isEnh);
    content.innerHTML = `
      <div class="recipe-view-sheet">
        <div class="recipe-view-nav">
          <div class="recipe-view-nav-title">
            <h2>${ppEscapeHtml(activeR.name)}</h2>
            <div class="recipe-view-nav-subtitle">
              ${isFav ? '<span class="tag fav-tag" style="background:#fee2e2;color:#ef4444;border-color:#fca5a5;font-weight:600">❤️ Favourite</span>' : ''}
              ${isEnh ? '<span class="tag enhanced-pill">✨ Enhanced</span>' : ''}
              ${activeR.time ? `<span>⏱ ${activeR.time}m prep</span> · ` : ''}
              <span>${toTitleCase(mealType || 'Dinner')}</span>
              <span>·</span>
              <span>Serves ${activeR.serves || 1} baseline</span>
              ${currentPreviewInstanceId ? '<span class="tag" style="background:var(--purple-bg);color:var(--purple);font-size:11px">Planned Meal</span>' : ''}
            </div>
          </div>
          <div class="recipe-view-nav-actions" style="display:flex;align-items:center;gap:8px">
            <button type="button" id="modal-recipe-fav-btn" class="recipe-fav-btn ${isFav ? 'active' : ''}" onclick="toggleRecipeFavourite('${ppEscapeAttr(r.id)}', event, '${variantKey}')" aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}" title="${isFav ? 'Favourited' : 'Add to favourites'}">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <button type="button" class="recipe-view-close-btn" onclick="closeRecipePreview()" aria-label="Close recipe">✕</button>
          </div>
        </div>
        <div class="recipe-view-body">
          <div class="recipe-view-controls-bar">
            ${hasEnh ? `
              <div class="segmented-control" role="tablist" style="width:fit-content;margin-bottom:4px;">
                <button type="button" role="tab" class="${!isEnh ? 'active' : ''}" onclick="switchViewTab('original')">Original</button>
                <button type="button" role="tab" class="${isEnh ? 'active' : ''}" onclick="switchViewTab('enhanced')">✨ Enhanced</button>
              </div>
            ` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <div class="segmented-control" role="tablist">
                <button type="button" role="tab" class="${currentPreviewServingMode==='both'?'active':''}" onclick="switchPreviewServingMode('both')">Shared (${activeR.serves || 2})</button>
                <button type="button" role="tab" class="${currentPreviewServingMode==='elliott'?'active':''}" onclick="switchPreviewServingMode('elliott')">👤 Elliott only</button>
                <button type="button" role="tab" class="${currentPreviewServingMode==='chloe'?'active':''}" onclick="switchPreviewServingMode('chloe')">👤 Chloe only</button>
              </div>
              ${currentPreviewServingMode === 'both' ? `
                <div style="display:flex;align-items:center;gap:8px;font-size:13px;">
                  <label for="preview-serves" style="font-weight:650;color:var(--text)">Servings:</label>
                  <input type="number" id="preview-serves" value="${targetServes}" oninput="updateRecipePreviewScale(this.value)" style="width:70px;min-height:36px;padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);font-weight:700;text-align:center" min="1" step="1">
                </div>
              ` : `
                <div style="display:flex;align-items:center;gap:8px;font-size:13px;">
                  <label for="preview-single-serves" style="font-weight:650;color:var(--text)">Servings:</label>
                  <input type="number" id="preview-single-serves" value="${currentPreviewSingleServes}" oninput="updateSinglePersonServes(this.value)" style="width:70px;min-height:36px;padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);font-weight:700;text-align:center" min="1" step="1">
                </div>
              `}
            </div>
          </div>
          ${servingModeBannerHtml}
          ${allocationAndTargetHtml}
          ${sourceHtml}
          <div class="recipe-view-content-grid">
            <div class="recipe-view-card">
              <div class="recipe-view-section-header">
                <h3>Ingredients</h3>
                <span class="recipe-view-count-badge">${(activeR.ingredients || []).length} items</span>
              </div>
              <ul class="recipe-ingredients-list">
                ${renderGroupedIngredientItems(activeR.ingredients || [], i => {
                  const adjusted = typeof i === 'object' ? getAdjustedIngredientForContext(i, resolutionContext) : i;
                  const resolved = typeof adjusted === 'object' ? resolveProductForIngredient(adjusted, resolutionContext) : {};
                  let text = typeof i === 'string' ? i : (ingRaw(i) || ingredientDisplayNameForRecipe(i));
                  if (scale !== 1.0 && i.qty) {
                    text = i.stockWaterMl ? formatStockIngredientText(i, scale) : `${Math.round((i.qty * scale)*100)/100} ${i.unit !== 'qty' ? i.unit : ''} ${i.name || ''}`.trim();
                  }
                  const defaultProduct = typeof i === 'object' ? resolveProductForIngredient(i, {}).product : null;
                  const selectedProduct = resolved.product;
                  const productNote = renderIngredientMappingNote(i, resolved);
                  const subBadge = (i.isSubstituted || (currentPreviewInstanceId && defaultProduct && selectedProduct && defaultProduct.id !== selectedProduct.id)) ? ` <span style="color:var(--purple);font-style:italic;font-size:11px;">(product changed)</span>` : '';
                  const notCountedBadge = i.excludeNutrition ? ` <span class="tag">not counted</span>` : '';
                  const originalKey = typeof i === 'object' ? (getRecipeIngredientGroupId(i) || i.originalBankId || i.bankId) : '';
                  const subAction = (currentPreviewInstanceId && originalKey) ? ` <button class="btn sm ghost" style="padding:0px 4px;font-size:10px;margin-left:6px;" onclick="openSubstituteModal('${currentPreviewInstanceId}', '${originalKey}')">Product</button>` : '';
                  const title = typeof i === 'object' ? ingredientContributionTitle(i, activeR, targetServes) : '';
                  return `<li style="${title?'cursor:help;':''}" title="${ppEscapeHtml(title)}">${ppEscapeHtml(text)}${notCountedBadge}${productNote}${subBadge}${subAction}</li>`;
                })}
              </ul>
            </div>
            <div class="recipe-view-card">
              <div class="recipe-view-section-header">
                <h3>Method</h3>
                <span class="recipe-view-count-badge">${(activeR.steps || activeR.method || []).length} steps</span>
              </div>
              <ol class="recipe-method-list">
                ${(activeR.steps || activeR.method || []).map(s => `<li>${ppEscapeHtml(s)}</li>`).join('')}
              </ol>
            </div>
          </div>
        </div>
      </div>
    `;
    bindPortionNutritionTooltips(content, activeR, targetServes);
}
function applyScaleToRecipeDefinition(targetServes) {
    const scale = targetServes / previewBaseRecipe.serves;
    const r = clonePlatePlanValue(previewBaseRecipe);
    r.serves = targetServes;
    r.ingredients.forEach(i => {
        if(i.qty) {
            i.qty = Math.round((i.qty * scale)*100)/100;
            i.grams = toGrams(i.qty, i.unit);
            i.raw = `${i.qty} ${i.unit !== 'qty' ? i.unit : ''} ${i.name}`.trim();
        }
    });
    const n = calcRecipeNutrition(r.ingredients, r.serves);
    r.cal = n.cal; r.prot = n.prot; r.carb = n.carb; r.fat = n.fat; r.fibre = n.fibre;
    const mtRoot = (r.types && r.types[0]) || 'dinner';
    r.portions = calcPortions(n, state.prefs, r.serves, r.who, mtRoot);
    if(r.enhanced) {
        r.enhanced.ingredients.forEach(i => {
            if(i.qty) {
                i.qty = Math.round((i.qty * scale)*100)/100;
                i.grams = toGrams(i.qty, i.unit);
                i.raw = `${i.qty} ${i.unit !== 'qty' ? i.unit : ''} ${i.name}`.trim();
            }
        });
        const ne = calcRecipeNutrition(r.enhanced.ingredients, r.serves);
        r.enhanced.cal = ne.cal; r.enhanced.prot = ne.prot; r.enhanced.carb = ne.carb; r.enhanced.fat = ne.fat; r.enhanced.fibre = ne.fibre;
        const ePortions = calcPortions(ne, state.prefs, r.serves, r.who, mtRoot);
        r.enhanced.portionE = ePortions.e;
        r.enhanced.portionC = ePortions.c;
    }
    return r;
}
function savePreviewScaleToCurrent(targetServes) {
    const scaledR = applyScaleToRecipeDefinition(targetServes);
    const idx = state.recipes.findIndex(x => x.id === scaledR.id);
    if(idx > -1) {
        scaledR.updatedAt = new Date().toISOString();
        state.recipes[idx] = scaledR;
        platePlanNutritionCache.clear();
        markPlatePlanViewsDirty();
        saveState(true);
        document.getElementById('view-modal-wrap').classList.remove('open');
        renderVault();
        if(state.plan?.slots) renderPlan(); 
        showMsg('form-msg','Recipe updated to new serving baseline.','success');
    }
}
function savePreviewScaleAsNew(targetServes) {
    const scaledR = applyScaleToRecipeDefinition(targetServes);
    scaledR.id = 'r' + Date.now();
    scaledR.name = scaledR.name + " (Scaled)";
    scaledR.updatedAt = new Date().toISOString();
    state.recipes.push(scaledR);
    platePlanNutritionCache.clear();
    markPlatePlanViewsDirty();
    saveState(true);
    document.getElementById('view-modal-wrap').classList.remove('open');
    renderVault();
    showMsg('form-msg','Saved as new recipe.','success');
}
function editRecipe(id){
  capturePlatePlanEditBaseline('recipes/'+id);
  const r=state.recipes.find(x=>x.id===id);if(!r)return;
  editId=id;
  window.currentEditMap = {};
  window.currentEditGroupMap = {};
  window.currentEditIngredientMeta = {};
  if(r.ingredients) {
      r.ingredients.forEach(i => {
        if(typeof i === 'object' && i.raw && i.bankId) window.currentEditMap[i.raw] = i.bankId;
        if(typeof i === 'object' && i.raw && (i.groupId || getRecipeIngredientGroupId(i))) window.currentEditGroupMap[i.raw] = i.groupId || getRecipeIngredientGroupId(i);
        if(typeof i === 'object' && i.raw && (i.excludeNutrition || i.section || i.ingredientId)) {
          window.currentEditIngredientMeta[i.raw] = {
            ...(i.excludeNutrition ? { excludeNutrition: true } : {}),
            ...(i.section ? { section: i.section } : {}),
            ...(i.ingredientId ? { ingredientId: i.ingredientId, mappedViaIngredient: !!i.mappedViaIngredient } : {})
          };
        }
      });
  }
  document.getElementById('form-title').textContent='Edit recipe';
  document.getElementById('r-name').value=r.name;document.getElementById('r-who').value=r.who;
  document.getElementById('r-serves').value=r.serves||2;
  document.getElementById('r-serves-orig').value=r.serves||2;
  document.getElementById('r-time').value=r.time||'';
  setMealTypes(r.types||[r.type||'dinner']);
  document.getElementById('r-ingredients').value=(r.ingredients||[]).map(i=>ingRaw(i)).join('\n');
  document.getElementById('r-method').value=(r.steps||[]).join('\n');
  setSourceFields(r.source||null);
  showView('add');
}
function deleteRecipe(id){
  const activeState = window.state || state || {};
  const recipes = activeState.recipes || (typeof state !== 'undefined' ? state.recipes : []) || [];
  const recipe = recipes.find(r => r.id === id);
  if(!recipe) return;
  openAppConfirmModal('Delete recipe?', `Delete <strong>${ppEscapeHtml(recipe.name || 'this recipe')}</strong>?`, 'Delete recipe', () =>
    runWithRecoveryPoint('Before deleting recipe', () => {
      const nextRecipes = recipes.filter(r => r.id !== id);
      activeState.recipes = nextRecipes;
      if (typeof state !== 'undefined') state.recipes = nextRecipes;
      deleteRecipeFromCloud(id);
      if (typeof window.saveHouseholdRecipes === 'function') { window.saveHouseholdRecipes(nextRecipes); }
      document.dispatchEvent(new CustomEvent('plateplan:state:recipes', { detail: nextRecipes }));
      if (typeof window.renderVault === 'function') window.renderVault();
      if (typeof showPlatePlanToast === 'function') showPlatePlanToast('Recipe deleted');
    })
  );
}
function duplicateRecipe(id){
    const activeState = window.state || state || {};
    const recipes = activeState.recipes || (typeof state !== 'undefined' ? state.recipes : []) || [];
    const r = recipes.find(x => x.id === id);
    if(!r) return;
    const clone = clonePlatePlanValue(r);
    clone.id = 'r' + Date.now();
    clone.name = clone.name + ' (Copy)';
    clone.updatedAt = new Date().toISOString();
    if(clone.enhanced) clone.enhanced.name = clone.enhanced.name + ' (Copy)';
    recipes.push(clone);
    activeState.recipes = recipes;
    if (typeof state !== 'undefined') state.recipes = recipes;
    platePlanNutritionCache.clear();
    markPlatePlanViewsDirty();
    if (typeof window.saveHouseholdRecipes === 'function') { window.saveHouseholdRecipes(recipes); }
    document.dispatchEvent(new CustomEvent('plateplan:state:recipes', { detail: recipes }));
    if (typeof window.renderVault === 'function') window.renderVault();
    if (typeof showPlatePlanToast === 'function') showPlatePlanToast('Recipe duplicated');
    editRecipe(clone.id);
}
function renderIngredientBank(){
  ensureIngredientGroups();
  ensureIngredientFamilies();
  const el = document.getElementById('ingredient-groups-list');
  if(!el) return;
  const search = (document.getElementById('ingredient-group-search')?.value || '').trim().toLowerCase();
  const searchVariants = getSearchVariants(search);
  const suggestions = getSuggestedGroupMerges();
  const families = (state.ingredientFamilies || []).slice();
  const familyMatchesSearch = family => {
    if(!search) return true;
    const groups = (family.typeIds || []).map(id => getIngredientGroup(id)).filter(Boolean);
    const products = groups.flatMap(g => getGroupProducts(g.id));
    const haystack = [
      family.name,
      family.cat,
      CAT[family.cat],
      ...(family.aliases || []),
      ...groups.flatMap(g => [g.name, ...(g.aliases || []), getGroupHierarchyText(g)]),
      ...products.flatMap(p => [p.name, p.brand])
    ].filter(Boolean).join(' ').toLowerCase();
    return searchVariants.some(v => haystack.includes(v));
  };
  const matchingFamilies = families.filter(familyMatchesSearch).sort((a,b)=>
    (CAT[a.cat] || a.cat || 'Other').localeCompare(CAT[b.cat] || b.cat || 'Other') ||
    (a.name || '').localeCompare(b.name || '')
  );
  resetProgressiveList('ingredients',search);
  const totalFamilies=matchingFamilies.length;
  const visibleFamilies=matchingFamilies.slice(0,platePlanListLimits.ingredients);
  const suggestionHtml = !search && suggestions.length ? `<div class="card" style="margin-bottom:12px">
    <div style="font-weight:700;margin-bottom:6px">Suggested sub-type merges</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:8px">These look like product variants that could sit under one sub-type.</div>
    ${suggestions.slice(0,8).map(s => `<div class="row-between" style="gap:10px;border-top:1px solid var(--border);padding:8px 0">
      <div><strong>${ppEscapeHtml(s.name)}</strong><div style="font-size:11px;color:var(--text2)">${s.products.map(p=>ppEscapeHtml(p.name)).join(' | ')}</div></div>
      <div class="row-center" style="justify-content:flex-end">
        <button class="btn sm ghost" onclick="mergeSuggestedIngredientGroup('${ppEscapeHtml(s.key)}')">Merge</button>
        <button class="btn sm ghost" onclick="ignoreGroupMergeSuggestion('${ppEscapeHtml(s.key)}')">Ignore</button>
      </div>
    </div>`).join('')}
  </div>` : '';
  const catMap = {};
  visibleFamilies.forEach(family => {
    const cat = CAT[family.cat] || family.cat || 'Other';
    if(!catMap[cat]) catMap[cat] = [];
    catMap[cat].push(family);
  });
  const familyCard = family => {
    const groups = (family.typeIds || []).map(id => getIngredientGroup(id)).filter(Boolean).sort((a,b)=>getGroupTypeName(a).localeCompare(getGroupTypeName(b)));
    const herbPair=getFamilyHerbPair(family.id);
    const herbsAndSpices=family.cat==='herbs';
    const products = groups.flatMap(g => getGroupProducts(g.id));
    const defaultGroup = getIngredientGroup(family.defaultTypeId) || groups[0] || null;
    const defaultProduct = defaultGroup ? (getProduct(defaultGroup.defaultProductId) || getGroupProducts(defaultGroup.id)[0] || null) : null;
    const defaultLabel = defaultGroup?.manualDefaultProductId ? 'Default' : 'Auto default';
    const forceSubTypesOpen = ingredientSubTypesOpenIds.has(family.id) || ingredientSubTypesKeepOpenId === family.id;
    const showSubTypes = groups.length > 0 && (forceSubTypesOpen || groups.length > 1 || (groups[0] && !groupIsHiddenDefaultType(groups[0])));
    const defaultScore = defaultProduct ? getProductProteinPer100Kcal(defaultProduct).toFixed(1) : '';
    const keepSubTypesOpen = showSubTypes && forceSubTypesOpen;
    const typeRows = showSubTypes ? `<details${keepSubTypesOpen ? ' open' : ''} ontoggle="rememberIngredientSubTypesOpen('${ppEscapeAttr(family.id)}', this.open)" style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">
      <summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;list-style-position:inside">Sub-types (${groups.length})</summary>
      <div style="margin-top:6px">
      ${groups.map(g => {
        const gProducts = getGroupProducts(g.id);
        const gDefault = getProduct(g.defaultProductId) || gProducts[0] || null;
        const gDefaultLabel = g.manualDefaultProductId ? 'Default' : 'Auto default';
        return `<div class="subtype-row">
          <div style="min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <strong style="font-size:13px">${ppEscapeHtml(getGroupTypeName(g))}</strong>
              <span class="tag">${gProducts.length} product${gProducts.length===1?'':'s'}</span>
              ${herbsAndSpices&&g.herbForm&&g.herbKey?`<span class="tag green">${g.herbForm==='fresh'?'Fresh':'Dried'} · 3:1 pair</span>`:''}
            </div>
            ${gDefault ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">${gDefaultLabel}: ${ppEscapeHtml(gDefault.name)} · ${getProductProteinPer100Kcal(gDefault).toFixed(1)}g protein / 100kcal</div>` : `<div style="font-size:11px;color:var(--red);margin-top:2px">No default product</div>`}
          </div>
          <div class="subtype-actions">
            <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="renameIngredientGroupPrompt('${g.id}')">Sub-type</button>
            <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="editGroupAliasesPrompt('${g.id}')">Aliases</button>
            <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="mergeIngredientGroupPrompt('${g.id}')">Merge</button>
            <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="convertSubTypeToIngredient('${g.id}')">Make Ingredient</button>
            <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="openProductDefaultPicker('group','${g.id}')">Products</button>
            <button class="btn sm danger desktop-only-mobile-hide" style="justify-content:center" onclick="deleteIngredientGroupPrompt('${g.id}')">Delete</button>
            <button class="btn sm ghost mobile-only-action" onclick="renameIngredientGroupPrompt('${g.id}')">Edit sub-type</button>
            <button class="btn sm ghost mobile-only-action" onclick="openIngredientGroupActions('${g.id}')">More</button>
          </div>
        </div>`;
      }).join('')}
      </div>
    </details>` : '';
    return `<div class="bank-card" data-family-id="${ppEscapeAttr(family.id)}" data-category="${ppEscapeAttr(CAT[family.cat] || family.cat || 'Other')}" data-ingredient="${ppEscapeAttr(family.name)}">
      <div class="hierarchy-card-layout">
        <div style="min-width:0">
          <div style="font-size:11px;color:var(--text3);margin-bottom:3px">${ppEscapeHtml(CAT[family.cat] || family.cat || 'Other')} > ${ppEscapeHtml(family.name || 'Ingredient')}${showSubTypes ? ' > sub-types' : ''}</div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <strong style="font-size:14px">${ppEscapeHtml(family.name || 'Ingredient')}</strong>
            <span class="tag" title="Category">${ppEscapeHtml(CAT[family.cat] || family.cat || 'Other')}</span>
            <span class="tag">${groups.length} sub-type${groups.length===1?'':'s'}</span>
            <span class="tag">${products.length} product${products.length===1?'':'s'}</span>
          </div>
          ${defaultProduct ? `<div style="font-size:12px;color:var(--text2);margin-top:5px"><strong>${defaultLabel}:</strong> ${ppEscapeHtml(defaultProduct.name)}${defaultProduct.brand&&defaultProduct.brand!=='Generic'?' ('+ppEscapeHtml(defaultProduct.brand)+')':''}${defaultScore ? ` · ${defaultScore}g protein / 100kcal` : ''}</div>` : `<div style="font-size:12px;color:var(--red);margin-top:5px">No default product yet.</div>`}
          ${(family.aliases || []).length > 1 ? `<div style="font-size:11px;color:var(--text2);margin-top:5px"><strong>Aliases:</strong> ${ppEscapeHtml((family.aliases || []).slice(0,6).join(', '))}${family.aliases.length > 6 ? '...' : ''}</div>` : ''}
          ${family.notes ? `<div style="font-size:12px;color:var(--text2);margin-top:5px">${ppEscapeHtml(family.notes)}</div>` : ''}
          ${herbsAndSpices?`<div class="herb-status"><strong>Fresh/dried conversion:</strong> ${herbPair.fresh&&herbPair.dried?`${ppEscapeHtml(getGroupTypeName(herbPair.fresh))} ↔ ${ppEscapeHtml(getGroupTypeName(herbPair.dried))} · 3:1`:'Not configured'} <span class="tag">Edit ingredient to configure</span></div>`:''}
        </div>
        <div class="hierarchy-actions">
          <button class="btn sm ghost desktop-only-mobile-hide ingredient-edit-action" style="justify-content:center" onclick="openIngredientEditor('${family.id}',this)">Edit ingredient</button>
          <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="openIngredientFamilyAliasesModal('${family.id}')">Aliases</button>
          <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="addSubTypeToFamilyPrompt('${family.id}')">+ Sub-type</button>
          <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="mergeIngredientFamilyPrompt('${family.id}')">Merge</button>
          <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="openIngredientToSubTypeModal('${family.id}')">Make Sub-type</button>
          <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="openProductDefaultPicker('family','${family.id}')">Products</button>
          <button class="btn sm danger desktop-only-mobile-hide" style="justify-content:center;grid-column:span 2" onclick="deleteIngredientFamilyPrompt('${family.id}')">Delete</button>
          <button class="btn sm primary mobile-only-action ingredient-edit-action" onclick="openIngredientEditor('${family.id}',this)">Edit ingredient</button>
          <button class="btn sm ghost mobile-only-action" onclick="openIngredientFamilyActions('${family.id}')">More</button>
        </div>
      </div>
      ${typeRows}
    </div>`;
  };
  const rows = Object.entries(catMap).map(([cat, fams]) => `
    <section style="margin-bottom:16px">
      <h3 style="font-size:14px;margin:4px 0 8px;color:var(--text)">${ppEscapeHtml(cat)}</h3>
      ${fams.map(familyCard).join('')}
    </section>`).join('');
  el.innerHTML = suggestionHtml + (rows || '<div class="empty">No ingredients found.</div>') + progressiveListButton('ingredients',totalFamilies,visibleFamilies.length);
  ingredientSubTypesKeepOpenId = null;
}
let ingredientSubTypesKeepOpenId = null;
let ingredientSubTypesOpenIds = new Set();
function rememberIngredientSubTypesOpen(familyId, isOpen){
  if(!familyId) return;
  if(isOpen) ingredientSubTypesOpenIds.add(familyId);
  else ingredientSubTypesOpenIds.delete(familyId);
}
let productBankFamilyFilterId = null;
function getFamilyGroups(familyId){
  const family = getIngredientFamily(familyId);
  return (family?.typeIds || []).map(id => getIngredientGroup(id)).filter(Boolean);
}
function getFamilyProducts(familyId) { return getFamilyGroups(familyId).flatMap(g => getGroupProducts(g.id)); }
let herbConversionFamilyId=null;
function isHerbsAndSpicesFamily(family) { return family?.cat==='herbs'; }
function isHerbsAndSpicesGroup(group){
  const family=getGroupIngredientFamily(group);
  return group?.cat==='herbs'&&family?.cat==='herbs';
}
function getFamilyHerbPair(familyId,{includeInactive=false}={}){
  const family=getIngredientFamily(familyId);
  if(!includeInactive&&!isHerbsAndSpicesFamily(family)) return {fresh:null,dried:null,key:'',active:false};
  const groups=getFamilyGroups(familyId);
  const fresh=groups.find(group=>group.herbForm==='fresh'&&group.herbKey);
  const dried=groups.find(group=>group.herbForm==='dried'&&group.herbKey&&(!fresh||group.herbKey===fresh.herbKey));
  return {fresh,dried,key:fresh?.herbKey||dried?.herbKey||'',active:isHerbsAndSpicesFamily(family)};
}
function ensureHerbConversionPanel(){
  let wrap=document.getElementById('ingredient-herb-conversion-wrap');
  if(wrap)wrap.remove();
  wrap=document.createElement('div');
  wrap.id='ingredient-herb-conversion-wrap';
  wrap.className='modal-wrap';
  wrap.style.zIndex='445';
  wrap.innerHTML=`<div class="modal" style="max-width:560px">
    <div class="row-between" style="align-items:center;margin-bottom:12px">
      <div><h3 style="margin:0">Fresh/dried conversion</h3><div id="herb-conversion-context" style="font-size:14px;color:var(--text2);margin-top:3px"></div></div>
      <button class="btn sm ghost" onclick="closeHerbConversionPanel()">Close</button>
    </div>
    <div class="msg info" style="margin:0 0 14px">Within Herbs &amp; Spices, PlatePlan uses 3 parts fresh to 1 part dried for a deliberately paired ingredient. This only changes temporary planned-meal substitutions.</div>
    <div class="herb-pair-grid">
      <div class="field"><label for="herb-conversion-fresh">Fresh sub-type</label><select id="herb-conversion-fresh"></select></div>
      <div class="field"><label for="herb-conversion-dried">Dried sub-type</label><select id="herb-conversion-dried"></select></div>
    </div>
    <div id="herb-conversion-msg"></div>
    <details class="card-details"><summary>How this works</summary><div style="font-size:14px;color:var(--text2);padding-bottom:10px">Choose two sub-types of the same ingredient. If one is missing, select Create new. Products remain mapped to their existing sub-types; no Recipe Vault recipe is edited.</div></details>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn primary" onclick="saveHerbConversionPair()">Save pairing</button>
      <button class="btn ghost" onclick="clearHerbConversionPair()">Clear pairing</button>
      <button class="btn ghost" onclick="closeHerbConversionPanel()">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function herbConversionOptions(groups,selected,form){
  return `<option value="">Choose ${form} sub-type</option>${groups.map(group=>`<option value="${ppEscapeAttr(group.id)}"${group.id===selected?' selected':''}>${ppEscapeHtml(getGroupTypeName(group))}</option>`).join('')}<option value="__create__">Create new ${form} sub-type…</option>`;
}
function openHerbConversionPanel(familyId){
  const family=getIngredientFamily(familyId);
  if(!family)return showPlatePlanToast('That ingredient could not be found.');
  if(!isHerbsAndSpicesFamily(family)) return openAppInfoModal('Fresh/dried conversion unavailable','Move this ingredient into Herbs &amp; Spices before configuring a fresh/dried pairing. Existing pairing metadata is preserved while it is outside that category.');
  if(typeof closeMobileActionSheet==='function')closeMobileActionSheet(true);
  herbConversionFamilyId=family.id;
  const groups=getFamilyGroups(family.id);
  const pair=getFamilyHerbPair(family.id);
  const wrap=ensureHerbConversionPanel();
  document.getElementById('herb-conversion-context').textContent=family.name;
  document.getElementById('herb-conversion-fresh').innerHTML=herbConversionOptions(groups,pair.fresh?.id||'','fresh');
  document.getElementById('herb-conversion-dried').innerHTML=herbConversionOptions(groups,pair.dried?.id||'','dried');
  wrap.classList.add('open');
  setTimeout(()=>document.getElementById('herb-conversion-fresh')?.focus(),0);
}
function closeHerbConversionPanel(){
  document.getElementById('ingredient-herb-conversion-wrap')?.classList.remove('open');
  herbConversionFamilyId=null;
}
function createHerbSubType(family,form){
  const name=`${form==='fresh'?'Fresh':'Dried'} ${family.name}`;
  const group={id:'grp'+Date.now()+Math.random().toString(36).slice(2,6),name,cat:'herbs',family:family.name,ingredientId:family.id,aliases:[name],defaultProductId:null,productIds:[],notes:'',herbForm:form,herbKey:canonicalGroupKey(family.name)};
  state.ingredientGroups.push(group);
  if(!Array.isArray(family.typeIds))family.typeIds=[];
  family.typeIds.push(group.id);
  if(!family.defaultTypeId)family.defaultTypeId=group.id;
  return group;
}
function saveHerbConversionPair(){
  const family=getIngredientFamily(herbConversionFamilyId);
  const msg=document.getElementById('herb-conversion-msg');
  if(!family)return;
  if(!isHerbsAndSpicesFamily(family)){if(msg)msg.innerHTML='<div class="msg error">Fresh/dried pairings are available only inside Herbs &amp; Spices.</div>';return;}
  let freshId=document.getElementById('herb-conversion-fresh')?.value||'';
  let driedId=document.getElementById('herb-conversion-dried')?.value||'';
  let fresh=freshId==='__create__'?createHerbSubType(family,'fresh'):getIngredientGroup(freshId);
  let dried=driedId==='__create__'?createHerbSubType(family,'dried'):getIngredientGroup(driedId);
  if (!fresh||!dried) { if(msg)msg.innerHTML='<div class="msg error">Choose both a fresh and dried sub-type.</div>';return; }
  if (fresh.id===dried.id) { if(msg)msg.innerHTML='<div class="msg error">Fresh and dried must use different sub-types.</div>';return; }
  const key=canonicalGroupKey(family.name);
  getFamilyGroups(family.id).forEach(group=>{if (group.id!==fresh.id&&group.id!==dried.id&&group.herbKey===key) { group.herbForm='';group.herbKey=''; }});
  fresh.herbForm='fresh';fresh.herbKey=key;
  dried.herbForm='dried';dried.herbKey=key;
  saveState();
  closeHerbConversionPanel();
  refreshHierarchyViews();
  refreshIngredientFamilyHerbEditor();
  showPlatePlanToast(`${family.name} fresh/dried pairing saved.`);
}
function clearHerbConversionPair(){
  const family=getIngredientFamily(herbConversionFamilyId);
  if(!family)return;
  getFamilyGroups(family.id).forEach(group=>{group.herbForm='';group.herbKey='';});
  saveState();
  closeHerbConversionPanel();
  refreshHierarchyViews();
  refreshIngredientFamilyHerbEditor();
  showPlatePlanToast(`${family.name} conversion pairing cleared.`);
}
let productDefaultPickerContext = null;
function ensureProductDefaultPickerModal(){
  let wrap = document.getElementById('product-default-picker-wrap');
  if(wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'product-default-picker-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '445';
  wrap.innerHTML = `
    <div class="modal" style="max-width:780px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 id="product-default-picker-title" style="margin:0">Products</h3>
        <button class="btn sm ghost" onclick="closeProductDefaultPicker()">Close</button>
      </div>
      <div id="product-default-picker-copy" style="font-size:12px;color:var(--text2);margin-bottom:12px"></div>
      <div id="product-default-picker-list" style="max-height:420px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface);margin-bottom:12px"></div>
      <div class="btn-row">
        <button class="btn ghost" id="product-default-picker-bank-btn" onclick="openProductDefaultPickerBank()">Open in Product Bank</button>
        <button class="btn ghost" onclick="closeProductDefaultPicker()">Close</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function openProductDefaultPicker(scope, id){
  ensureIngredientFamilies();
  const wrap = ensureProductDefaultPickerModal();
  if(scope === 'family'){
    const family = getIngredientFamily(id);
    if(!family) return;
    productDefaultPickerContext = { scope, id:family.id };
    document.getElementById('product-default-picker-title').textContent = `Products for ${family.name}`;
    document.getElementById('product-default-picker-copy').innerHTML = 'Choose which linked product should be the default for this ingredient. If the product sits under a sub-type, that sub-type also becomes the ingredient default.';
  } else {
    const group = getIngredientGroup(id);
    if(!group) return;
    productDefaultPickerContext = { scope:'group', id:group.id };
    document.getElementById('product-default-picker-title').textContent = `Products for ${getGroupTypeName(group)}`;
    document.getElementById('product-default-picker-copy').innerHTML = 'Choose which linked product should be the default for this sub-type.';
  }
  renderProductDefaultPickerList();
  wrap.classList.add('open');
}
function closeProductDefaultPicker(){
  document.getElementById('product-default-picker-wrap')?.classList.remove('open');
  productDefaultPickerContext = null;
}
function getProductDefaultPickerRows(){
  if(!productDefaultPickerContext) return [];
  const groups = productDefaultPickerContext.scope === 'family'
    ? getFamilyGroups(productDefaultPickerContext.id)
    : [getIngredientGroup(productDefaultPickerContext.id)].filter(Boolean);
  return groups.flatMap(group => getGroupProducts(group.id).map(product => ({ group, product })))
    .sort((a,b) =>
      getGroupTypeName(a.group).localeCompare(getGroupTypeName(b.group)) ||
      getProductProteinPer100Kcal(b.product) - getProductProteinPer100Kcal(a.product) ||
      (a.product.name || '').localeCompare(b.product.name || '')
    );
}
function renderProductDefaultPickerList(){
  const list = document.getElementById('product-default-picker-list');
  if(!list) return;
  const rows = getProductDefaultPickerRows();
  if(!rows.length){
    list.innerHTML = '<div style="padding:14px;color:var(--text2);font-size:12px">No linked products yet. Open the Product Bank to add or assign products.</div>';
    return;
  }
  const family = productDefaultPickerContext?.scope === 'family' ? getIngredientFamily(productDefaultPickerContext.id) : null;
  list.innerHTML = rows.map(({ group, product }) => {
    const selected = group.defaultProductId === product.id && (!family || family.defaultTypeId === group.id);
    const density = getProductProteinPer100Kcal(product);
    const pack = product.packSize ? formatPackDisplay(product.packSize, product.packUnit || 'g', product.itemWeight) : '';
    return `<div class="row-between" style="gap:12px;align-items:flex-start;padding:10px 12px;border-bottom:1px solid var(--border);background:${selected ? 'rgba(54,179,126,0.08)' : 'var(--surface)'}">
      <div style="min-width:0;flex:1">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <strong style="font-size:13px">${ppEscapeHtml(product.name)}</strong>
          ${product.brand && product.brand !== 'Generic' ? `<span class="tag">${ppEscapeHtml(product.brand)}</span>` : ''}
          <span class="tag">${ppEscapeHtml(getGroupTypeName(group))}</span>
          ${selected ? '<span class="tag green">Current default</span>' : ''}
        </div>
        <div style="font-size:11px;color:var(--text2);margin-top:4px">${(+product.cal || 0)} kcal · ${(+product.prot || 0)}g protein · ${density.toFixed(1)}g protein / 100kcal${pack ? ` · ${ppEscapeHtml(pack)}` : ''}</div>
      </div>
      <button class="btn sm ${selected ? 'ghost' : 'primary'}" onclick="setDefaultProductFromPicker('${ppEscapeAttr(group.id)}','${ppEscapeAttr(product.id)}')">${selected ? 'Selected' : 'Set default'}</button>
    </div>`;
  }).join('');
}
function setDefaultProductFromPicker(groupId, productId){
  const group = getIngredientGroup(groupId);
  const product = getProduct(productId);
  if(!group || !product) return;
  ensureProductAssignedToGroup(product, group.name, group.id);
  syncProductHierarchyCategory(product, group, product.cat);
  group.manualDefaultProductId = product.id;
  group.defaultProductId = product.id;
  const family = getGroupIngredientFamily(group);
  if(family) family.defaultTypeId = group.id;
  refreshProductGroupAndRecipes(product.id);
  saveState();
  renderProductDefaultPickerList();
  renderIngredientBank();
  renderBank();
  renderVault();
}
function openProductDefaultPickerBank(){
  const ctx = productDefaultPickerContext;
  closeProductDefaultPicker();
  if(ctx?.scope === 'family') showFamilyProducts(ctx.id);
  else if(ctx?.scope === 'group') showGroupProducts(ctx.id);
}
function refreshHierarchyViews(){
  refreshPlatePlanDerivedState({persist:true, render:true});
}
let ingredientToSubTypeSourceId = null;
function ensureIngredientToSubTypeModal(){
  let wrap = document.getElementById('ingredient-to-subtype-wrap');
  if(wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'ingredient-to-subtype-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '445';
  wrap.innerHTML = `
    <div class="modal" style="max-width:660px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 style="margin:0">Make ingredient a sub-type</h3>
        <button class="btn sm ghost" onclick="closeIngredientToSubTypeModal()">Close</button>
      </div>
      <div id="ingredient-to-subtype-copy" style="font-size:12px;color:var(--text2);margin-bottom:12px"></div>
      <div class="field" id="ingredient-to-subtype-search-field">
        <label>Choose parent ingredient</label>
        <input type="search" id="ingredient-to-subtype-search" placeholder="Search ingredients by any part of their name, alias, or category" oninput="renderIngredientToSubTypeOptions(this.value)">
      </div>
      <div id="ingredient-to-subtype-options" style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface);margin-bottom:12px"></div>
      <div id="ingredient-to-subtype-create" class="card-inner" style="margin-bottom:12px;display:none">
        <div style="font-size:12px;color:var(--text2);margin-bottom:8px">Need a new parent ingredient?</div>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end">
          <div class="field" style="margin:0">
            <label>New ingredient name</label>
            <input type="text" id="ingredient-to-subtype-new-name" placeholder="e.g. Pasta">
          </div>
          <button class="btn primary" onclick="createIngredientForSubTypeConversion()">Create New Ingredient</button>
        </div>
      </div>
      <div id="ingredient-to-subtype-msg"></div>
      <div class="btn-row">
        <button class="btn ghost" onclick="closeIngredientToSubTypeModal()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function openIngredientToSubTypeModal(familyId){
  ensureIngredientFamilies();
  const family = getIngredientFamily(familyId);
  if(!family) return;
  const groups = getFamilyGroups(family.id);
  ingredientToSubTypeSourceId = family.id;
  const wrap = ensureIngredientToSubTypeModal();
  const copy = document.getElementById('ingredient-to-subtype-copy');
  const searchField = document.getElementById('ingredient-to-subtype-search-field');
  const options = document.getElementById('ingredient-to-subtype-options');
  const createBox = document.getElementById('ingredient-to-subtype-create');
  const msg = document.getElementById('ingredient-to-subtype-msg');
  msg.innerHTML = '';
  if(groups.length !== 1){
    copy.innerHTML = `<strong>${ppEscapeHtml(family.name)}</strong> has ${groups.length} sub-types. Move, merge, or delete the extra sub-types first, then it can safely become a sub-type under another ingredient.`;
    searchField.style.display = 'none';
    if(createBox) createBox.style.display = 'none';
    options.innerHTML = '';
  } else {
    copy.innerHTML = `<strong>${ppEscapeHtml(family.name)}</strong> will become a sub-type under the ingredient you choose. Recipe mappings, products, aliases, and nutrition links will be preserved.`;
    searchField.style.display = 'block';
    if(createBox) createBox.style.display = 'block';
    const search = document.getElementById('ingredient-to-subtype-search');
    const newName = document.getElementById('ingredient-to-subtype-new-name');
    search.value = '';
    if(newName) newName.value = '';
    renderIngredientToSubTypeOptions('');
    setTimeout(()=>search.focus(),0);
  }
  wrap.classList.add('open');
}
function closeIngredientToSubTypeModal(){
  document.getElementById('ingredient-to-subtype-wrap')?.classList.remove('open');
  ingredientToSubTypeSourceId = null;
}
function renderIngredientToSubTypeOptions(query = ''){
  const list = document.getElementById('ingredient-to-subtype-options');
  if(!list) return;
  const source = getIngredientFamily(ingredientToSubTypeSourceId);
  if (!source) { list.innerHTML = ''; return; }
  const variants = getSearchVariants(query || '');
  let rows = (state.ingredientFamilies || []).filter(f => f.id !== source.id);
  if(variants.length){
    rows = rows.filter(f => {
      const haystack = [f.name, CAT[f.cat], f.cat, ...(f.aliases || [])].filter(Boolean).join(' ').toLowerCase();
      return variants.some(v => haystack.includes(v));
    });
  }
  rows = rows.sort((a,b)=>(CAT[a.cat] || a.cat || '').localeCompare(CAT[b.cat] || b.cat || '') || (a.name || '').localeCompare(b.name || '')).slice(0,50);
  const newName = document.getElementById('ingredient-to-subtype-new-name');
  if(newName && !newName.matches(':focus')) newName.value = normaliseAliasText(query || '');
  list.innerHTML = rows.length ? rows.map(f => `<button type="button" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)" onclick="confirmIngredientToSubType('${ppEscapeAttr(f.id)}')">
    <strong style="font-size:13px">${ppEscapeHtml(f.name)}</strong>
    <span class="tag" style="margin-left:6px">${ppEscapeHtml(CAT[f.cat] || f.cat || 'Other')}</span>
    <span class="tag">${(f.typeIds || []).length} sub-type${(f.typeIds || []).length===1?'':'s'}</span>
  </button>`).join('') : '<div style="padding:12px;color:var(--text2);font-size:12px">No matching parent ingredients found.</div>';
}
function createIngredientForSubTypeConversion(){
  const source = getIngredientFamily(ingredientToSubTypeSourceId);
  const msg = document.getElementById('ingredient-to-subtype-msg');
  if(!source) return;
  const groups = getFamilyGroups(source.id);
  if(groups.length !== 1){
    if(msg) msg.innerHTML = '<div class="msg error">This ingredient has multiple sub-types. Move or merge them first.</div>';
    return;
  }
  const typed = normaliseAliasText(document.getElementById('ingredient-to-subtype-new-name')?.value || document.getElementById('ingredient-to-subtype-search')?.value || '');
  if(!typed){
    if(msg) msg.innerHTML = '<div class="msg error">Add the new ingredient name first.</div>';
    return;
  }
  const cat = source.cat || groups[0]?.cat || 'other';
  const existing = (state.ingredientFamilies || []).find(f => f.id !== source.id && canonicalGroupKey(f.name) === canonicalGroupKey(typed) && f.cat === cat);
  if(existing){
    confirmIngredientToSubType(existing.id);
    return;
  }
  let id = ingredientFamilyIdFromName(typed, cat);
  if(getIngredientFamily(id)) id = 'fam_' + Date.now() + Math.random().toString(36).slice(2,6);
  const family = { id, name:toTitleCase(typed), cat, aliases:[typed], notes:'', typeIds:[], defaultTypeId:'' };
  state.ingredientFamilies.push(family);
  confirmIngredientToSubType(family.id);
}
function confirmIngredientToSubType(targetFamilyId){
  const source = getIngredientFamily(ingredientToSubTypeSourceId);
  const target = getIngredientFamily(targetFamilyId);
  if(!source || !target || source.id === target.id) return;
  const groups = getFamilyGroups(source.id);
  const msg = document.getElementById('ingredient-to-subtype-msg');
  if(groups.length !== 1){
    if(msg) msg.innerHTML = '<div class="msg error">This ingredient has multiple sub-types. Move or merge them first.</div>';
    return;
  }
  const group = groups[0];
  if(!Array.isArray(target.aliases)) target.aliases = [];
  if(!Array.isArray(target.typeIds)) target.typeIds = [];
  [source.name, ...(source.aliases || [])].filter(Boolean).forEach(alias => {
    if(!target.aliases.some(a => canonicalGroupKey(a) === canonicalGroupKey(alias))) target.aliases.push(alias);
    addIngredientGroupAlias(group, alias);
  });
  group.name = toTitleCase(source.name || group.name || 'Sub-type');
  group.ingredientId = target.id;
  group.family = target.name;
  group.cat = target.cat || source.cat || group.cat || 'other';
  getGroupProducts(group.id).forEach(product => {
    product.cat = group.cat;
    product.updatedAt = new Date().toISOString();
  });
  target.typeIds = target.typeIds.filter(id => id !== group.id);
  target.typeIds.push(group.id);
  if(!target.defaultTypeId) target.defaultTypeId = group.id;
  state.ingredientFamilies = (state.ingredientFamilies || []).filter(f => f.id !== source.id);
  closeIngredientToSubTypeModal();
  refreshHierarchyViews();
}
function convertSubTypeToIngredient(groupId){
  ensureIngredientFamilies();
  const group = getIngredientGroup(groupId);
  if(!group) return;
  const oldFamily = getGroupIngredientFamily(group);
  const cat = group.cat || oldFamily?.cat || 'other';
  const name = toTitleCase(getGroupTypeName(group));
  let familyId = ingredientFamilyIdFromName(name, cat);
  let family = getIngredientFamily(familyId);
  if(family && family.id !== oldFamily?.id && (family.typeIds || []).some(id => id !== group.id)){
    familyId = 'fam_' + Date.now() + Math.random().toString(36).slice(2,6);
    family = null;
  }
  if(!family){
    family = { id:familyId, name, cat, aliases:[name], notes:'', typeIds:[], defaultTypeId:group.id };
    state.ingredientFamilies.push(family);
  }
  const keepOldFamilyOpen = oldFamily && oldFamily.typeIds && oldFamily.typeIds.filter(id => id !== group.id && getIngredientGroup(id)).length > 0;
  if(oldFamily){
    oldFamily.typeIds = (oldFamily.typeIds || []).filter(id => id !== group.id);
    if(oldFamily.defaultTypeId === group.id) oldFamily.defaultTypeId = oldFamily.typeIds[0] || '';
  }
  if(!Array.isArray(family.aliases)) family.aliases = [];
  [name, ...(group.aliases || [])].filter(Boolean).forEach(alias => {
    if(!family.aliases.some(a => canonicalGroupKey(a) === canonicalGroupKey(alias))) family.aliases.push(alias);
  });
  group.ingredientId = family.id;
  group.family = family.name;
  group.cat = family.cat;
  group.name = family.name;
  if(!family.typeIds.includes(group.id)) family.typeIds.push(group.id);
  family.defaultTypeId = group.id;
  getGroupProducts(group.id).forEach(product => {
    product.cat = family.cat;
    product.updatedAt = new Date().toISOString();
  });
  if(keepOldFamilyOpen) {
    ingredientSubTypesKeepOpenId = oldFamily.id;
    ingredientSubTypesOpenIds.add(oldFamily.id);
  }
  refreshHierarchyViews();
}
function showFamilyProducts(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return;
  productBankFamilyFilterId = family.id;
  productBankGroupFilterId = null;
  activeFamily = 'all';
  activeCat = 'all';
  showView('bank');
  const search = document.getElementById('bank-search');
  if(search) search.value = '';
  renderBank();
  setTimeout(() => document.getElementById('bank-search')?.focus(), 0);
}
function clearProductFamilyFilter(){
  productBankFamilyFilterId = null;
  renderBank();
}
function createIngredientFamilyPrompt() { openIngredientFamilyDetailsModal('', true); }
let ingredientFamilyDetailsId = null;
let ingredientFamilyDetailsCreate = false;
let ingredientEditorOrigin = null;
function preparePlatePlanWorkspace(wrap,trigger=null){
  if(typeof closeMobileActionSheet==='function') closeMobileActionSheet(true);
  if(typeof closeMobileMore==='function') closeMobileMore(true);
  if(!wrap) return null;
  wrap.setAttribute('role','dialog');
  wrap.setAttribute('aria-modal','true');
  if(trigger) ingredientEditorOrigin={element:trigger,scrollY:window.scrollY};
  document.body.appendChild(wrap);
  return wrap;
}
function restoreIngredientEditorOrigin(){
  const origin=ingredientEditorOrigin;
  ingredientEditorOrigin=null;
  if(!origin)return;
  requestAnimationFrame(()=>{
    window.scrollTo({top:origin.scrollY||0,behavior:'instant'});
    if(origin.element?.isConnected) origin.element.focus({preventScroll:true});
    else if(ingredientFamilyDetailsId) document.querySelector(`[data-family-id="${CSS.escape(ingredientFamilyDetailsId)}"] .ingredient-edit-action`)?.focus({preventScroll:true});
  });
}
function ensureIngredientFamilyDetailsModal(){
  const matches=Array.from(document.querySelectorAll('#ingredient-family-details-wrap'));
  let wrap=matches.shift()||null;
  matches.forEach(node=>node.remove());
  if(wrap&&(!wrap.querySelector('#ingredient-family-details-name')||!wrap.querySelector('#ingredient-family-herb-field'))){wrap.remove();wrap=null;}
  if(wrap) return preparePlatePlanWorkspace(wrap);
  wrap = document.createElement('div');
  wrap.id = 'ingredient-family-details-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '440';
  wrap.innerHTML = `
    <div class="modal" style="max-width:540px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 id="ingredient-family-details-title" style="margin:0">Edit ingredient</h3>
        <button class="btn sm ghost" onclick="closeIngredientFamilyDetailsModal()">Close</button>
      </div>
      <div class="field">
        <label>Category</label>
        <select id="ingredient-family-details-cat" onchange="refreshIngredientFamilyHerbEditor()"></select>
      </div>
      <div class="field">
        <label>Ingredient name</label>
        <input type="text" id="ingredient-family-details-name" placeholder="e.g. Pasta, Asparagus, Tofu">
      </div>
      <div class="field">
        <label>Notes</label>
        <textarea id="ingredient-family-details-notes" style="min-height:70px"></textarea>
      </div>
      <section class="card-inner" id="ingredient-family-herb-field" style="display:none;margin:12px 0">
        <div style="font-weight:750">Fresh/dried conversion</div>
        <div id="ingredient-family-herb-summary" style="font-size:14px;color:var(--text2);margin:5px 0 10px"></div>
        <button type="button" class="btn" id="ingredient-family-herb-action" onclick="openIngredientEditorHerbConversion()">Configure pairing</button>
        <div style="font-size:12px;color:var(--text2);margin-top:8px">A planned-meal substitution can use the fixed 3 fresh : 1 dried ratio. Recipe Vault quantities are never changed.</div>
      </section>
      <div id="ingredient-family-details-msg"></div>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn primary" onclick="saveIngredientFamilyDetailsModal()">Save</button>
        <button class="btn ghost" onclick="closeIngredientFamilyDetailsModal()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return preparePlatePlanWorkspace(wrap);
}
function openIngredientEditor(familyId,trigger=null){
  const family=getIngredientFamily(familyId);
  if(!family){
    showPlatePlanToast('That ingredient could not be found. Refreshing the Ingredient Bank.');
    renderIngredientBank();
    return false;
  }
  try{
    ingredientEditorOrigin={element:trigger||document.activeElement,scrollY:window.scrollY};
    openIngredientFamilyDetailsModal(familyId,false);
    return true;
  }catch(error){
    console.warn('Rebuilding the ingredient editor after an opening error.',error);
    document.querySelectorAll('#ingredient-family-details-wrap').forEach(node=>node.remove());
    try{
      openIngredientFamilyDetailsModal(familyId,false);
      return true;
    }catch(retryError){
      console.error('Could not open ingredient editor after rebuilding it.',retryError);
      openAppInfoModal('Could not open ingredient',`PlatePlan rebuilt the editor but could not open this ingredient. No data was changed.<details class="card-details"><summary>Technical detail</summary><div class="breakable-id">${ppEscapeHtml(retryError?.message||String(retryError))}</div></details>`);
      return false;
    }
  }
}
function refreshIngredientFamilyHerbEditor(){
  const section=document.getElementById('ingredient-family-herb-field');
  if(!section) return;
  const cat=document.getElementById('ingredient-family-details-cat')?.value||'other';
  section.style.display=cat==='herbs'?'block':'none';
  if(cat!=='herbs') return;
  const family=getIngredientFamily(ingredientFamilyDetailsId);
  const summary=document.getElementById('ingredient-family-herb-summary');
  const action=document.getElementById('ingredient-family-herb-action');
  if(!family){
    if(summary) summary.textContent='Save this ingredient first, then reopen it to create or pair fresh and dried sub-types.';
    if (action) { action.disabled=true;action.textContent='Save ingredient first'; }
    return;
  }
  const pair=getFamilyHerbPair(family.id,{includeInactive:true});
  if(summary) summary.textContent=pair.fresh&&pair.dried
    ? `${getGroupTypeName(pair.fresh)} ↔ ${getGroupTypeName(pair.dried)} · 3:1`
    : 'Not configured';
  if (action) { action.disabled=false;action.textContent=pair.fresh&&pair.dried?'Edit pairing':'Configure pairing'; }
}
function openIngredientEditorHerbConversion(){
  if(!ingredientFamilyDetailsId) return;
  openHerbConversionPanel(ingredientFamilyDetailsId);
}
function openIngredientFamilyDetailsModal(familyId = '', create = false){
  if(familyId) capturePlatePlanEditBaseline('ingredientFamilies/'+familyId);
  ensureIngredientGroups();
  const family = familyId ? getIngredientFamily(familyId) : null;
  ingredientFamilyDetailsId = family?.id || '';
  ingredientFamilyDetailsCreate = create || !family;
  const wrap = preparePlatePlanWorkspace(ensureIngredientFamilyDetailsModal(),ingredientEditorOrigin?.element||document.activeElement);
  document.getElementById('ingredient-family-details-title').textContent = ingredientFamilyDetailsCreate ? 'Create ingredient' : 'Edit ingredient';
  document.getElementById('ingredient-family-details-cat').innerHTML = getGroupCategoryOptionsHtml(family?.cat || 'other');
  document.getElementById('ingredient-family-details-name').value = family?.name || '';
  document.getElementById('ingredient-family-details-notes').value = family?.notes || '';
  document.getElementById('ingredient-family-details-msg').innerHTML = '';
  refreshIngredientFamilyHerbEditor();
  wrap.classList.add('open');
  setTimeout(()=>document.getElementById('ingredient-family-details-name')?.focus(),0);
}
function closeIngredientFamilyDetailsModal(preserveEditorReturn=false){
  document.getElementById('ingredient-family-details-wrap')?.classList.remove('open');
  const savedId=ingredientFamilyDetailsId;
  ingredientFamilyDetailsId = null;
  ingredientFamilyDetailsCreate = false;
  if(!preserveEditorReturn) abandonEditorReturn();
  const origin=ingredientEditorOrigin;
  ingredientEditorOrigin=null;
  requestAnimationFrame(()=>{
    window.scrollTo({top:origin?.scrollY||window.scrollY,behavior:'instant'});
    if(origin?.element?.isConnected) origin.element.focus({preventScroll:true});
    else if(savedId) document.querySelector(`[data-family-id="${CSS.escape(savedId)}"] .ingredient-edit-action`)?.focus({preventScroll:true});
  });
}
async function saveIngredientFamilyDetailsModal(){
  const name = normaliseAliasText(document.getElementById('ingredient-family-details-name')?.value || '');
  const cat = document.getElementById('ingredient-family-details-cat')?.value || 'other';
  const notes = document.getElementById('ingredient-family-details-notes')?.value || '';
  const msg = document.getElementById('ingredient-family-details-msg');
  if(!name){
    msg.innerHTML = '<div class="msg error">Add an ingredient name first.</div>';
    return;
  }
  let family = ingredientFamilyDetailsId ? getIngredientFamily(ingredientFamilyDetailsId) : null;
  const dupe = (state.ingredientFamilies || []).find(f => f.id !== family?.id && canonicalGroupKey(f.name) === canonicalGroupKey(name) && f.cat === cat);
  if(dupe){
    msg.innerHTML = `<div class="msg error">That ingredient already exists in ${ppEscapeHtml(CAT[cat] || cat)}. Use Merge if you want to combine them.</div>`;
    return;
  }
  const nowIso = new Date().toISOString();
  let isNew = false;
  let newGroup = null;
  let affectedGroups = [];
  let affectedProducts = [];
  if(!family){
    isNew = true;
    const id = ingredientFamilyIdFromName(name, cat);
    family = { id, name: toTitleCase(name), cat, aliases:[name], notes, typeIds:[], defaultTypeId:'', updatedAt: nowIso };
    newGroup = {
      id:'grp'+Date.now()+Math.random().toString(36).slice(2,6),
      name:toTitleCase(name),
      cat,
      family:family.name,
      ingredientId:family.id,
      aliases:[name],
      defaultProductId:null,
      productIds:[],
      notes:'',
      updatedAt: nowIso
    };
    family.typeIds.push(newGroup.id);
    family.defaultTypeId = newGroup.id;
  } else {
    const oldName = family.name;
    family.name = toTitleCase(name);
    family.cat = cat;
    family.notes = notes;
    family.updatedAt = nowIso;
    if(!Array.isArray(family.aliases)) family.aliases = [];
    [oldName, family.name].filter(Boolean).forEach(alias => {
      if(!family.aliases.some(a => canonicalGroupKey(a) === canonicalGroupKey(alias))) family.aliases.push(alias);
    });
    affectedGroups = getFamilyGroups(family.id);
    affectedGroups.forEach(g => {
      g.family = family.name;
      g.cat = family.cat;
      g.updatedAt = nowIso;
      getGroupProducts(g.id).forEach(p => { p.cat = family.cat; p.updatedAt = nowIso; affectedProducts.push(p); });
    });
  }
  try {
    await executeDataQualityTransaction('SAVE_INGREDIENT_FAMILY', {
      familyData: family,
      isNew,
      newGroup,
      affectedGroups,
      affectedProducts
    }, {
      modalWrapId: 'ingredient-family-details-wrap',
      submitButtonId: 'ingredient-family-save-btn',
      errorContainerId: 'ingredient-family-details-msg'
    });
    closeIngredientFamilyDetailsModal(true);
    refreshHierarchyViews();
    finishEditorReturn();
  } catch(e) {
    console.error('saveIngredientFamilyDetailsModal failed:', e);
  }
}
function openIngredientFamilyAliasesModal(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return;
  const wrap = ensureIngredientGroupDetailsModal();
  ingredientGroupDetailsEditId = null;
  ingredientFamilyDetailsId = family.id;
  ingredientGroupDetailsMode = 'familyAliases';
  document.getElementById('ingredient-group-details-title').textContent = 'Edit ingredient aliases';
  document.getElementById('ingredient-group-details-context').innerHTML = `<strong>${ppEscapeHtml(family.name)}</strong>`;
  const catField = document.getElementById('ingredient-group-category-field'); if(catField) catField.style.display = 'none';
  const nameField = document.getElementById('ingredient-group-name-field'); if(nameField) nameField.style.display = 'none';
  const famField = document.getElementById('ingredient-group-family-field'); if(famField) famField.style.display = 'none';
  const aliasField = document.getElementById('ingredient-group-aliases-field'); if(aliasField) aliasField.style.display = 'block';
  document.getElementById('ingredient-group-aliases-input').value = (family.aliases || []).join('\\n');
  document.getElementById('ingredient-group-details-msg').innerHTML = '';
  wrap.classList.add('open');
}
function addSubTypeToFamilyPrompt(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return;
  openIngredientGroupDetailsModal('', 'create');
  document.getElementById('ingredient-group-category-input').value = family.cat || 'other';
  document.getElementById('ingredient-group-family-input').value = family.name || '';
  window.pendingSubTypeFamilyId = family.id;
}
let ingredientFamilyMergeSourceId = null;
let ingredientFamilyMergeTargetId = null;
let ingredientFamilyMergeTargetKind = 'family';
function mergeIngredientFamilyPrompt(sourceFamilyId){
  const source = getIngredientFamily(sourceFamilyId);
  if(!source) return;
  ingredientFamilyMergeSourceId = source.id;
  ingredientFamilyMergeTargetId = null;
  ingredientFamilyMergeTargetKind = 'family';
  const wrap = ensureIngredientGroupMergeModal();
  document.querySelector('#ingredient-group-merge-wrap h3').textContent = 'Merge ingredients';
  document.getElementById('ingredient-group-merge-source').innerHTML = `<strong>Merging from:</strong> ${ppEscapeHtml(source.name)} <span class="tag">${(source.typeIds || []).length} sub-type${(source.typeIds || []).length===1?'':'s'}</span>`;
  const search = document.getElementById('ingredient-group-merge-search');
  search.placeholder = 'Search target ingredient';
  search.value = '';
  const mergeSel = document.getElementById('ingredient-group-merge-selection');
  if(mergeSel) mergeSel.style.display = 'none';
  document.getElementById('ingredient-group-merge-confirm').disabled = true;
  document.getElementById('ingredient-group-merge-confirm').onclick = confirmIngredientFamilyMerge;
  renderIngredientFamilyMergeOptions('');
  search.oninput = () => renderIngredientFamilyMergeOptions(search.value);
  wrap.classList.add('open');
  setTimeout(()=>search.focus(),0);
}
function renderIngredientFamilyMergeOptions(query = ''){
  const listEl = document.getElementById('ingredient-group-merge-options');
  const variants = getSearchVariants(query || '');
  let rows = (state.ingredientFamilies || []).filter(f => f.id !== ingredientFamilyMergeSourceId);
  if(variants.length) rows = rows.filter(f => variants.some(v => [f.name, ...(f.aliases || [])].join(' ').toLowerCase().includes(v)));
  rows = rows.slice(0,40);
  let typeRows = (state.ingredientGroups || []).filter(g => {
    const source = getIngredientFamily(ingredientFamilyMergeSourceId);
    if(source && g.ingredientId === source.id) return false;
    if(!variants.length) return true;
    return variants.some(v => [getGroupTypeName(g), getGroupIngredientName(g), ...(g.aliases || [])].filter(Boolean).join(' ').toLowerCase().includes(v));
  }).slice(0,40);
  const familyHtml = rows.length ? `<div style="padding:8px 10px;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;background:var(--surface2)">Ingredients</div>` + rows.map(f => `<button type="button" class="ingredient-group-merge-option" data-id="${ppEscapeHtml(f.id)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)" onclick="selectIngredientFamilyMergeTarget('${ppEscapeHtml(f.id)}')">
    <strong style="font-size:13px">${ppEscapeHtml(f.name)}</strong>
    <span class="tag" style="margin-left:6px">${ppEscapeHtml(CAT[f.cat] || f.cat || 'Other')}</span>
    <span class="tag">${(f.typeIds || []).length} sub-type${(f.typeIds || []).length===1?'':'s'}</span>
  </button>`).join('') : '';
  const typeHtml = typeRows.length ? `<div style="padding:8px 10px;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;background:var(--surface2)">Sub-types</div>` + typeRows.map(g => `<button type="button" class="ingredient-group-merge-option" data-id="${ppEscapeHtml(g.id)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)" onclick="selectIngredientFamilyMergeGroupTarget('${ppEscapeHtml(g.id)}')">
    <strong style="font-size:13px">${ppEscapeHtml(getGroupTypeName(g))}</strong>
    <span class="tag" style="margin-left:6px">${ppEscapeHtml(getGroupIngredientName(g))}</span>
    <span class="tag">${ppEscapeHtml(CAT[g.cat] || g.cat || 'Other')}</span>
    <div style="font-size:11px;color:var(--text2);margin-top:3px">Merge this ingredient's sub-types into this sub-type.</div>
  </button>`).join('') : '';
  listEl.innerHTML = familyHtml + typeHtml || '<div style="padding:12px;color:var(--text2);font-size:12px">No matching ingredients or sub-types found.</div>';
}
function selectIngredientFamilyMergeTarget(targetFamilyId){
  const source = getIngredientFamily(ingredientFamilyMergeSourceId);
  const target = getIngredientFamily(targetFamilyId);
  if(!source || !target) return;
  ingredientFamilyMergeTargetId = target.id;
  ingredientFamilyMergeTargetKind = 'family';
  const selection = document.getElementById('ingredient-group-merge-selection');
  selection.innerHTML = `<strong>${ppEscapeHtml(source.name)}</strong> will merge into <strong>${ppEscapeHtml(target.name)}</strong>. Sub-types, products, aliases, and recipe mappings will be preserved.`;
  selection.style.display = 'block';
  document.getElementById('ingredient-group-merge-confirm').disabled = false;
}
function selectIngredientFamilyMergeGroupTarget(targetGroupId){
  const source = getIngredientFamily(ingredientFamilyMergeSourceId);
  const target = getIngredientGroup(targetGroupId);
  if(!source || !target) return;
  ingredientFamilyMergeTargetId = target.id;
  ingredientFamilyMergeTargetKind = 'group';
  const selection = document.getElementById('ingredient-group-merge-selection');
  selection.innerHTML = `<strong>${ppEscapeHtml(source.name)}</strong> will merge into sub-type <strong>${ppEscapeHtml(getGroupTypeName(target))}</strong>. All source sub-types, products, aliases, and recipe mappings will be moved into that sub-type.`;
  selection.style.display = 'block';
  document.getElementById('ingredient-group-merge-confirm').disabled = false;
}
function confirmIngredientFamilyMerge(){
  const source = getIngredientFamily(ingredientFamilyMergeSourceId);
  if(!source) return;
  const targetName = ingredientFamilyMergeTargetKind === 'group'
    ? getGroupTypeName(getIngredientGroup(ingredientFamilyMergeTargetId) || {})
    : (getIngredientFamily(ingredientFamilyMergeTargetId)?.name || 'another ingredient');
  runWithRecoveryPoint(`Before merging ${source.name} into ${targetName}`, applyIngredientFamilyMerge);
}
function applyIngredientFamilyMerge(){
  const source = getIngredientFamily(ingredientFamilyMergeSourceId);
  if(!source) return;
  if(ingredientFamilyMergeTargetKind === 'group'){
    const merged = mergeIngredientFamilyIntoGroup(source.id, ingredientFamilyMergeTargetId);
    if(merged) closeIngredientGroupMergeModal();
    return;
  }
  const target = getIngredientFamily(ingredientFamilyMergeTargetId);
  if(!target) return;
  if(!Array.isArray(target.aliases)) target.aliases = [];
  if(!Array.isArray(target.typeIds)) target.typeIds = [];
  [source.name, ...(source.aliases || [])].filter(Boolean).forEach(alias => {
    if(!target.aliases.some(a => canonicalGroupKey(a) === canonicalGroupKey(alias))) target.aliases.push(alias);
  });
  getFamilyGroups(source.id).forEach(group => {
    group.ingredientId = target.id;
    group.family = target.name;
    group.cat = target.cat || group.cat || 'other';
    if(!target.typeIds.includes(group.id)) target.typeIds.push(group.id);
  });
  state.ingredientFamilies = (state.ingredientFamilies || []).filter(f => f.id !== source.id);
  closeIngredientGroupMergeModal();
  refreshHierarchyViews();
}
function deleteIngredientFamilyPrompt(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return;
  const used = getFamilyGroups(family.id).flatMap(g => getIngredientGroupRecipeUsage(g.id));
  const wrap = ensureDeleteIngredientGroupModal();
  document.querySelector('#delete-ingredient-group-wrap h3').textContent = 'Delete ingredient?';
  document.getElementById('delete-ingredient-group-copy').innerHTML = used.length
    ? `<strong>${ppEscapeHtml(family.name)}</strong> is used by ${[...new Set(used)].length} recipe${[...new Set(used)].length===1?'':'s'}. Merge it into another ingredient before deleting.`
    : `Delete <strong>${ppEscapeHtml(family.name)}</strong>? Its sub-types will also be removed from the Ingredient Bank, but products will remain in Product Bank.`;
  document.getElementById('delete-ingredient-group-actions').innerHTML = used.length
    ? `<button class="btn primary" onclick="closeDeleteIngredientGroupModal(); mergeIngredientFamilyPrompt('${ppEscapeHtml(family.id)}')">Merge instead</button><button class="btn ghost" onclick="closeDeleteIngredientGroupModal()">Cancel</button>`
    : `<button class="btn danger" onclick="confirmDeleteIngredientFamily('${ppEscapeHtml(family.id)}')">Delete ingredient</button><button class="btn ghost" onclick="closeDeleteIngredientGroupModal()">Cancel</button>`;
  wrap.classList.add('open');
}
function confirmDeleteIngredientFamily(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return;
  const groups = getFamilyGroups(family.id);
  if(groups.some(g => getIngredientGroupRecipeUsage(g.id).length)) return;
  runWithRecoveryPoint(`Before deleting ingredient ${family.name}`, () => applyDeleteIngredientFamily(familyId));
}
function applyDeleteIngredientFamily(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return;
  const groups = getFamilyGroups(family.id);
  groups.forEach(group => {
    const products = getGroupProducts(group.id);
    state.ingredientGroups = (state.ingredientGroups || []).filter(g => g.id !== group.id);
    products.forEach(product => {
      product.groupId = '';
    });
  });
  state.ingredientFamilies = (state.ingredientFamilies || []).filter(f => f.id !== family.id);
  ensureIngredientGroups();
  closeDeleteIngredientGroupModal();
  refreshHierarchyViews();
}
function openCategoryManagerModal(){
  ensureIngredientGroups();
  let wrap = document.getElementById('category-manager-wrap');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.id = 'category-manager-wrap';
    wrap.className = 'modal-wrap';
    wrap.style.zIndex = '440';
    wrap.innerHTML = `
      <div class="modal" style="max-width:760px">
        <div class="row-between" style="align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Manage categories</h3>
          <button class="btn sm ghost" onclick="closeCategoryManagerModal()">Close</button>
        </div>
        <div id="category-manager-list"></div>
        <div class="card-inner" style="margin-top:12px">
          <div style="font-weight:700;margin-bottom:8px">Create category</div>
          <div style="display:flex;gap:8px">
            <input id="category-manager-new-name" placeholder="e.g. Frozen foods">
            <button class="btn sm primary" onclick="createManagedCategory()">Create</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
  }
  renderCategoryManagerModal();
  wrap.classList.add('open');
}
function closeCategoryManagerModal() { document.getElementById('category-manager-wrap')?.classList.remove('open'); }
function renderCategoryManagerModal(){
  const list = document.getElementById('category-manager-list');
  if(!list) return;
  const cats = Object.entries(CAT).filter(([k,v]) => v).sort((a,b)=>a[1].localeCompare(b[1]));
  list.innerHTML = cats.map(([key,label]) => {
    const famCount = (state.ingredientFamilies || []).filter(f => f.cat === key).length;
    const productCount = (state.ingredients || []).filter(p => (getIngredientGroup(p.groupId)?.cat || p.cat || 'other') === key).length;
    const options = cats.filter(([k]) => k !== key).map(([k,v]) => `<option value="${ppEscapeHtml(k)}">${ppEscapeHtml(v)}</option>`).join('');
    return `<div class="card-inner" style="margin-bottom:8px">
      <div class="row-between" style="gap:10px;align-items:flex-start">
        <div style="flex:1">
          <div style="font-weight:700">${ppEscapeHtml(label)}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">${famCount} ingredient${famCount===1?'':'s'} · ${productCount} product${productCount===1?'':'s'}</div>
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
            <input id="cat-rename-${ppEscapeAttr(key)}" value="${ppEscapeAttr(label)}" style="max-width:220px">
            <button class="btn sm ghost" onclick="renameManagedCategory('${ppEscapeAttr(key)}')">Rename</button>
            <select id="cat-merge-${ppEscapeAttr(key)}" style="max-width:220px">${options}</select>
            <button class="btn sm ghost" onclick="mergeManagedCategory('${ppEscapeAttr(key)}')">Merge into</button>
            <button class="btn sm danger" onclick="deleteManagedCategory('${ppEscapeAttr(key)}')">Delete/reassign</button>
          </div>
          <div id="cat-msg-${ppEscapeAttr(key)}" style="font-size:11px;margin-top:6px"></div>
        </div>
      </div>
    </div>`;
  }).join('');
}
function createManagedCategory(){
  const name = normaliseAliasText(document.getElementById('category-manager-new-name')?.value || '');
  if(!name) return;
  const slug = canonicalGroupKey(name).replace(/\s+/g, '-') || ('cat-' + Date.now());
  state.customCats[slug] = name;
  CAT[slug] = name;
  saveState();
  renderCategoryManagerModal();
  renderCatOptions('mi-cat','other'); renderCatOptions('pp-cat','other'); renderCatOptions('tp-cat','other'); renderCatOptions('mini-cat','other');
}
function renameManagedCategory(key){
  const name = normaliseAliasText(document.getElementById(`cat-rename-${key}`)?.value || '');
  if(!name) return;
  state.customCats[key] = name;
  CAT[key] = name;
  saveState();
  renderCategoryManagerModal();
  renderIngredientBank();
  renderBank();
}
function moveCategoryAssignments(oldKey, targetKey){
  const nowIso = new Date().toISOString();
  (state.ingredientFamilies || []).forEach(f => { if (f.cat === oldKey) { f.cat = targetKey; f.updatedAt = nowIso; } });
  (state.ingredientGroups || []).forEach(g => { if (g.cat === oldKey) { g.cat = targetKey; g.updatedAt = nowIso; } });
  (state.ingredients || []).forEach(p => {
    if(p.cat === oldKey || getIngredientGroup(p.groupId)?.cat === oldKey) {
      p.cat = targetKey;
      p.updatedAt = nowIso;
    }
  });
  ensureIngredientFamilies();
}
function mergeManagedCategory(oldKey){
  const targetKey = document.getElementById(`cat-merge-${oldKey}`)?.value || '';
  if(!targetKey || targetKey === oldKey) return;
  runWithRecoveryPoint(`Before merging category ${CAT[oldKey] || oldKey}`, () => applyManagedCategoryMerge(oldKey, targetKey));
}
function applyManagedCategoryMerge(oldKey, targetKey){
  moveCategoryAssignments(oldKey, targetKey);
  state.customCats[oldKey] = null;
  delete CAT[oldKey];
  refreshHierarchyViews();
  renderCategoryManagerModal();
}
function deleteManagedCategory(oldKey){
  const targetKey = document.getElementById(`cat-merge-${oldKey}`)?.value || '';
  const msg = document.getElementById(`cat-msg-${oldKey}`);
  if(!targetKey){
    if(msg) msg.innerHTML = '<span style="color:var(--red)">Choose a category to reassign into first.</span>';
    return;
  }
  mergeManagedCategory(oldKey);
}
function renderBank(){
  ensureIngredientGroups();
  const groupsPanel = document.getElementById('bank-groups-panel');
  if(groupsPanel) groupsPanel.innerHTML = '';
  const filterEl = document.getElementById('cat-filter');
  if(!filterEl) return;
  const categoryFilters=['all',...new Set((state.ingredients||[]).map(i=>getIngredientGroup(i.groupId)?.cat || i.cat || 'other'))].sort((a,b)=>(CAT[a]||a).localeCompare(CAT[b]||b));
  const categoryHtml = categoryFilters.map(c=>`<div class="cf${activeCat===c?' active':''}" onclick="setCat('${ppEscapeHtml(c)}')">${ppEscapeHtml(c==='all'?'all':(CAT[c]||c))}</div>`).join('');
  const activeFamilyLabel = getProductBankFamilyFilterLabel(activeFamily);
  const familyOptions = getProductBankFamilyFilterOptions();
  filterEl.innerHTML = `
    <div style="width:100%;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-top:2px">Category</div>
    ${categoryHtml}
    <div style="width:100%;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-top:6px">Ingredient</div>
    <div style="width:100%;display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
      <input type="search" id="bank-family-search" list="bank-family-options" placeholder="Search ingredient..." value="${ppEscapeAttr(productBankFamilySearchText || (activeFamily !== 'all' ? activeFamilyLabel : ''))}" oninput="handleProductBankFamilySearch(this.value)" onchange="selectProductBankFamilyFromSearch(this.value)" style="font-size:12px;padding:5px 10px;max-width:260px;flex:1;min-width:180px">
      <datalist id="bank-family-options">${familyOptions.map(opt => `<option value="${ppEscapeAttr(opt.label)}"></option>`).join('')}</datalist>
      ${activeFamily !== 'all' ? `<span class="tag">Ingredient: ${ppEscapeHtml(activeFamilyLabel)}</span><button class="btn sm ghost" onclick="clearProductBankFamilyFilter()">Clear</button>` : ''}
    </div>
  `;
  const sort=document.getElementById('bank-sort').value;
  const search=(document.getElementById('bank-search').value||'').trim();
  const searchVariants = getSearchVariants(search);
  let ings=(state.ingredients || []).filter(i=>{
      const group = getIngredientGroup(i.groupId);
      const effectiveCat = group?.cat || i.cat || 'other';
      if(productBankGroupFilterId && i.groupId !== productBankGroupFilterId && !getGroupProducts(productBankGroupFilterId).some(p => p.id === i.id)) return false;
      if(activeCat!=='all' && effectiveCat!==activeCat) return false;
      if(activeFamily!=='all' && familyKey(getProductFamily(i))!==activeFamily) return false;
      if(!search) return true;
      const bName = i.name.toLowerCase();
      const bBrand = (i.brand||'').toLowerCase();
      const gName = (group?.name || '').toLowerCase();
      const gFamily = (getProductFamily(i) || group?.family || '').toLowerCase();
      const gCat = (CAT[group?.cat] || group?.cat || i.cat || '').toLowerCase();
      const gHierarchy = getGroupHierarchyText(group || { cat:i.cat, family:getProductFamily(i), name:i.name }).toLowerCase();
      const gAliases = (group?.aliases || []).join(' ').toLowerCase();
      return searchVariants.some(v => bName.includes(v) || bBrand.includes(v) || gName.includes(v) || gFamily.includes(v) || gCat.includes(v) || gHierarchy.includes(v) || gAliases.includes(v));
  });
  if(productBankFamilyFilterId){
      const productIds = new Set(getFamilyProducts(productBankFamilyFilterId).map(p => p.id));
      ings = ings.filter(i => productIds.has(i.id));
  }
  if(sort==='prot')ings.sort((a,b)=>b.prot-a.prot);
  else if(sort==='cal')ings.sort((a,b)=>a.cal-b.cal);
  else if(sort==='prot_kcal')ings.sort((a,b)=>{
      const effA = a.cal ? (a.prot/a.cal)*100 : 0;
      const effB = b.cal ? (b.prot/b.cal)*100 : 0;
      return effB - effA;
  });
  else if(sort==='value')ings.sort((a,b)=>scoreProductByPriority(b, 'protein_per_pound') - scoreProductByPriority(a, 'protein_per_pound'));
  else ings.sort((a,b)=>a.name.localeCompare(b.name));
  const bankSignature=[activeCat,activeFamily,productBankGroupFilterId||'',productBankFamilyFilterId||'',search,sort].join('|');
  resetProgressiveList('bank',bankSignature);
  const totalProducts=ings.length;
  const visibleProducts=ings.slice(0,platePlanListLimits.bank);
  const el=document.getElementById('bank-list');
  const groupFilter = productBankGroupFilterId ? getIngredientGroup(productBankGroupFilterId) : null;
  const familyFilter = productBankFamilyFilterId ? getIngredientFamily(productBankFamilyFilterId) : null;
  const groupFilterHtml = groupFilter ? `<div class="card" style="margin-bottom:12px;background:var(--surface2)">
    <div class="row-between" style="gap:10px;align-items:center">
      <div>
        <div style="font-weight:700;font-size:13px">Products for ${ppEscapeHtml(getGroupTypeName(groupFilter))}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:3px">${ppEscapeHtml(getGroupHierarchyText(groupFilter))} · ${ings.length} product${ings.length===1?'':'s'} linked to this type</div>
      </div>
      <button class="btn sm ghost" onclick="clearProductGroupFilter()">Show all products</button>
    </div>
  </div>` : familyFilter ? `<div class="card" style="margin-bottom:12px;background:var(--surface2)">
    <div class="row-between" style="gap:10px;align-items:center">
      <div>
        <div style="font-weight:700;font-size:13px">Products for ${ppEscapeHtml(familyFilter.name)}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:3px">${ppEscapeHtml(CAT[familyFilter.cat] || familyFilter.cat || 'Other')} > ${ppEscapeHtml(familyFilter.name)} · ${ings.length} product${ings.length===1?'':'s'} linked to this ingredient</div>
      </div>
      <button class="btn sm ghost" onclick="clearProductFamilyFilter()">Show all products</button>
    </div>
  </div>` : '';
  if (!ings.length) { el.innerHTML=groupFilterHtml + '<div class="empty">No products found.</div>';return; }
  el.innerHTML=groupFilterHtml + visibleProducts.map(ing=>{
    const p=ing.prot||0;
    const protDensity = ing.cal ? (p / ing.cal) * 100 : 0; // g protein per 100 kcal
    const rank = protDensity >= 10 ? 'high' : protDensity >= 5 ? 'mid' : 'low';
    const packInGrams = productPackGrams(ing);
    const pricePer100=ing.price&&packInGrams?((ing.price/packInGrams)*100).toFixed(1):null;
    const ppenny=ing.price&&packInGrams?((p*packInGrams/100)/ing.price).toFixed(1):null;
    const pkcal=ing.cal?((p/ing.cal)*100).toFixed(1):null;
    const formattedPackSize = formatProductPackSummary(ing);
    const variantLabels = getIngredientPackVariantLabels(ing);
    const group = getIngredientGroup(ing.groupId);
    const isDefaultProduct = group && group.defaultProductId === ing.id;
    const hierarchy = group ? getGroupHierarchyText(group) : `${CAT[ing.cat] || ing.cat || 'Other'} > ${getProductFamily(ing)} > Unassigned type`;
    const basisWarning = isPowderOrSupplementProduct(ing) && (+ing.cal > 0 && +ing.cal < 200 && +ing.prot > 0 && +ing.prot < 40)
      ? `<div class="msg warn" style="font-size:11px;margin:6px 0 0;padding:6px 8px">Check nutrition basis: powders/supplements must be stored per 100g/ml, not per scoop.</div>`
      : '';
    return`<div class="bank-card"><div class="product-card-layout"><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;overflow-wrap:break-word">${ing.name}</div>${ing.brand&&ing.brand!=='Generic'?`<div style="font-size:12px;color:var(--text2);margin-bottom:4px">${ing.brand}</div>`:''}<div style="font-size:11px;color:var(--text3);margin:3px 0;overflow-wrap:break-word">${ppEscapeHtml(hierarchy)}</div><div class="row-center" style="margin:4px 0;gap:5px"><span class="rank rank-${rank}" title="${protDensity.toFixed(1)}g protein per 100 kcal">${protDensity>=15?'Very high protein':protDensity>=10?'High protein':protDensity>=5?'Medium protein':'Lower protein'}</span><span class="tag" title="Category">${ppEscapeHtml(CAT[group?.cat || ing.cat]||group?.cat||ing.cat||'Other')}</span><span class="tag" title="Ingredient">${ppEscapeHtml(getProductFamily(ing))}</span>${group?`<span class="tag" title="Type">Type: ${ppEscapeHtml(getGroupTypeName(group))}</span>`:''}${isDefaultProduct?`<span class="tag green" title="Automatic default product: highest protein per 100 kcal in this type">Auto default</span>`:''}${ing.storage ? `<span class="tag" style="text-transform:capitalize;">${ing.storage}</span>` : ''}</div><div class="macro-bar"><span class="mpill p">P <span>${p}g</span></span><span class="mpill"><span>${ing.cal}</span> kcal</span><span class="mpill">C <span>${ing.carb}g</span></span><span class="mpill">F <span>${ing.fat}g</span></span></div>${basisWarning}<div class="row-center" style="margin-top:5px; gap:8px;">${pkcal?`<span style="font-size:11px;color:var(--blue)"><strong>${pkcal}g</strong> P / 100kcal</span>`:''}${ppenny?`<span style="font-size:11px;color:var(--blue)"><strong>${ppenny}g</strong> P / &pound;</span>`:''}</div>${ing.notes?`<div style="font-size:12px;color:var(--text2);margin-top:4px">${ing.notes}</div>`:''}${ing.price&&ing.packSize?`<div style="font-size:12px;color:var(--text2);margin-top:4px;">&pound;${ing.price.toFixed(2)} for ${formattedPackSize}</div>`:''}${variantLabels.length>1?`<div style="font-size:11px;color:var(--text2);margin-top:4px;"><strong>Pack variants:</strong> ${variantLabels.map(ppEscapeHtml).join(' · ')}</div>`:''}${ing.sourceUrl?`<div style="font-size:11px;margin-top:4px;"><a href="${ing.sourceUrl}" target="_blank" rel="noopener" style="color:var(--blue);text-decoration:underline">View on Tesco ↗</a></div>`:''}</div><div class="product-card-actions"><button class="btn sm ghost desktop-only-mobile-hide" onclick="editIng('${ing.id}')">Edit</button><button class="btn sm ghost desktop-only-mobile-hide" onclick="openProductReallocationModal('${ing.id}')">Reallocate</button><button class="btn sm danger desktop-only-mobile-hide" onclick="deleteIng('${ing.id}')">Delete</button><button class="btn sm ghost mobile-only-action" onclick="editIng('${ing.id}')">Edit product</button><button class="btn sm ghost mobile-only-action" onclick="openProductBankActions('${ing.id}')">More</button></div></div></div>`;
  }).join('')+progressiveListButton('bank',totalProducts,visibleProducts.length);
}
function getProductBankFamilyFilterOptions(){
  return getKnownFamilies().map(label => ({ key: familyKey(label), label })).concat([{ key:'no-ingredient', label:'No ingredient' }]);
}
function getProductBankFamilyFilterLabel(key){
  if(!key || key === 'all') return 'all';
  const match = getProductBankFamilyFilterOptions().find(opt => opt.key === key || canonicalGroupKey(opt.label) === canonicalGroupKey(key));
  return match?.label || key;
}
function handleProductBankFamilySearch(value) { productBankFamilySearchText = value || ''; }
function selectProductBankFamilyFromSearch(value){
  const raw = String(value || '').trim();
  if(!raw) return;
  const match = getProductBankFamilyFilterOptions().find(opt => canonicalGroupKey(opt.label) === canonicalGroupKey(raw) || opt.key === familyKey(raw));
  if(match) {
    productBankFamilySearchText = match.label;
    setFamilyFilter(match.key);
  }
}
function clearProductBankFamilyFilter(){
  productBankFamilySearchText = '';
  setFamilyFilter('all');
}
function renderIngredientGroupsPanel(){
  const el = document.getElementById('bank-groups-panel');
  if(!el) return;
  const groups = (state.ingredientGroups || []).slice().sort((a,b)=>
    (CAT[a.cat] || a.cat || 'Other').localeCompare(CAT[b.cat] || b.cat || 'Other') ||
    getGroupIngredientName(a).localeCompare(getGroupIngredientName(b)) ||
    getGroupTypeName(a).localeCompare(getGroupTypeName(b))
  );
  const suggestions = getSuggestedGroupMerges();
  const suggestionHtml = suggestions.length ? `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;margin:8px 0 12px">
    <div style="font-weight:700;margin-bottom:6px">Suggested group merges</div>
    ${suggestions.slice(0,8).map(s => `<div class="row-between" style="gap:10px;border-top:1px solid var(--border);padding:7px 0">
      <div><strong>${ppEscapeHtml(s.name)}</strong><div style="font-size:11px;color:var(--text2)">${s.products.map(p=>ppEscapeHtml(p.name)).join(' | ')}</div></div>
      <div class="row-center" style="justify-content:flex-end">
        <button class="btn sm ghost" onclick="mergeSuggestedIngredientGroup('${ppEscapeHtml(s.key)}')">Merge</button>
        <button class="btn sm ghost" onclick="ignoreGroupMergeSuggestion('${ppEscapeHtml(s.key)}')">Ignore</button>
      </div>
    </div>`).join('')}
  </div>` : '';
  const rows = groups.map(g => {
    const products = getGroupProducts(g.id);
    const defaultProduct = getProduct(g.defaultProductId);
    return `<div style="display:grid;grid-template-columns:minmax(160px,1fr) 110px minmax(180px,1.4fr) auto;gap:8px;align-items:center;border-top:1px solid var(--border);padding:8px 0;font-size:12px">
      <div><strong>${ppEscapeHtml(getGroupTypeName(g))}</strong><div style="color:var(--text2);font-size:11px">${ppEscapeHtml(getGroupHierarchyText(g))}</div></div>
      <div style="color:var(--text2)">${products.length} product${products.length===1?'':'s'}</div>
      <div style="color:var(--text2);font-size:11px">${defaultProduct ? `Auto: ${ppEscapeHtml(defaultProduct.name)} · ${getProductProteinPer100Kcal(defaultProduct).toFixed(1)}g P/100kcal` : 'No default product'}</div>
      <div class="row-center" style="justify-content:flex-end">
        <button class="btn sm ghost" onclick="renameIngredientGroupPrompt('${g.id}')">Type</button>
        <button class="btn sm ghost" onclick="editGroupAliasesPrompt('${g.id}')">Aliases</button>
        <button class="btn sm ghost" onclick="editGroupFamilyPrompt('${g.id}')">Ingredient</button>
        <button class="btn sm ghost" onclick="mergeIngredientGroupPrompt('${g.id}')">Merge</button>
      </div>
    </div>`;
  }).join('');
  el.innerHTML = `<details class="card" style="margin-bottom:12px">
    <summary style="cursor:pointer;font-size:13px;font-weight:700">Ingredient types (${groups.length})</summary>
    <div style="font-size:12px;color:var(--text2);margin:8px 0 10px">Recipes map to these types. Meal plans and shopping lists resolve each type to a selected product.</div>
    ${suggestionHtml}
    ${rows || '<div class="empty">No groups yet.</div>'}
  </details>`;
}
function getSuggestedGroupMerges(){
  const buckets = {};
  const ignored = new Set(state.ignoredGroupMergeSuggestions || []);
  (state.ingredients || []).forEach(product => {
    const name = canonicalGroupNameFromProduct(product);
    const key = canonicalGroupKey(name);
    if(!key) return;
    if(!buckets[key]) buckets[key] = { key, name, products: [], groupIds: new Set() };
    buckets[key].products.push(product);
    if(product.groupId) buckets[key].groupIds.add(product.groupId);
  });
  return Object.values(buckets)
    .filter(b => b.products.length > 1 && b.groupIds.size > 1 && !ignored.has(b.key))
    .sort((a,b) => b.products.length - a.products.length || a.name.localeCompare(b.name));
}
function ignoreGroupMergeSuggestion(key){
  if(!key) return;
  if(!Array.isArray(state.ignoredGroupMergeSuggestions)) state.ignoredGroupMergeSuggestions = [];
  if(!state.ignoredGroupMergeSuggestions.includes(key)) state.ignoredGroupMergeSuggestions.push(key);
  saveState();
  renderIngredientBank();
  renderIngredientGroupsPanel();
  renderDataQuality();
}
function mergeSuggestedIngredientGroup(key){
  const suggestion = getSuggestedGroupMerges().find(s => s.key === key);
  if(!suggestion) return;
  openGroupPickerModal({ type:'suggestedMerge', suggestionKey:key, defaultName:suggestion.name });
}
function createIngredientGroupPrompt() { openIngredientGroupDetailsModal(null, 'create'); }
function assignProductToGroupPrompt(productId){
  const product = getProduct(productId);
  if(!product) return;
  openProductGroupPickerModal(product.id);
}
let ingredientGroupPickerContext = null;
let ingredientGroupPickerMode = 'type';
function ensureGroupPickerModal(){
  let wrap = document.getElementById('ingredient-group-picker-wrap');
  if(wrap) wrap.remove();
  wrap = document.createElement('div');
  wrap.id = 'ingredient-group-picker-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '430';
  wrap.innerHTML = `
    <div class="modal" style="max-width:640px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 id="ingredient-group-picker-title" style="margin:0">Choose type</h3>
        <button class="btn sm ghost" onclick="closeGroupPickerModal()">Close</button>
      </div>
      <div id="ingredient-group-picker-copy" style="font-size:12px;color:var(--text2);margin-bottom:12px"></div>
      <div class="btn-row" style="margin-bottom:10px">
        <button type="button" class="btn sm ghost" id="group-picker-mode-ingredient" onclick="setGroupPickerMode('ingredient')">Assign To Ingredient</button>
        <button type="button" class="btn sm ghost" id="group-picker-mode-type" onclick="setGroupPickerMode('type')">Assign To Sub-type</button>
      </div>
      <div class="field">
        <label id="ingredient-group-picker-search-label">Search ingredient bank</label>
        <input type="search" id="ingredient-group-picker-search" placeholder="Search category, ingredient, type, alias, product, or brand" oninput="renderGroupPickerOptions(this.value)">
      </div>
      <div class="field" id="ingredient-group-picker-parent-field" style="display:none">
        <label>Parent ingredient for new sub-type</label>
        <input type="search" id="ingredient-group-picker-parent" list="ingredient-group-picker-parent-options" placeholder="Search or type parent ingredient, e.g. Pasta" oninput="renderGroupPickerParentOptions(this.value); syncGroupPickerCreateButton()">
        <datalist id="ingredient-group-picker-parent-options"></datalist>
      </div>
      <div id="ingredient-group-picker-options" style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface);margin-bottom:12px"></div>
      <div class="btn-row">
        <button class="btn primary" id="ingredient-group-picker-create-btn" onclick="createGroupFromPickerSearch()">Create new sub-type from typed name</button>
        <button class="btn ghost" onclick="closeGroupPickerModal()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function openProductGroupPickerModal(productId, defaultName = ''){
  const product = getProduct(productId);
  if(!product) return;
  const current = getIngredientGroup(product.groupId);
  openGroupPickerModal({
    type:'product',
    productId,
    defaultName: defaultName || current?.name || canonicalGroupNameFromProduct(product),
    title:'Assign product',
    copy:`Choose whether <strong>${ppEscapeHtml(product.name)}</strong> belongs directly to an ingredient, or to a sub-type under an ingredient.`,
    mode:'ingredient'
  });
}
function openGroupPickerModal(context){
  ingredientGroupPickerContext = context || {};
  ingredientGroupPickerMode = context.mode || (context.type === 'product' ? 'ingredient' : 'type');
  const wrap = ensureGroupPickerModal();
  const title = context.title || (context.type === 'suggestedMerge' ? 'Merge suggested products' : 'Choose type');
  const copy = context.copy || (context.type === 'suggestedMerge'
    ? 'Choose the ingredient type these products should sit under, or create a new one.'
    : 'Choose an ingredient type, or create a new one.');
  document.getElementById('ingredient-group-picker-title').textContent = title;
  document.getElementById('ingredient-group-picker-copy').innerHTML = copy;
  const search = document.getElementById('ingredient-group-picker-search');
  search.value = context.defaultName || '';
  const parent = document.getElementById('ingredient-group-picker-parent');
  if(parent) parent.value = '';
  syncGroupPickerModeUi();
  renderGroupPickerParentOptions('');
  renderGroupPickerOptions(search.value);
  wrap.classList.add('open');
  setTimeout(() => {
    search.focus();
    search.select?.();
  }, 0);
}
function closeGroupPickerModal(){
  const wrap = document.getElementById('ingredient-group-picker-wrap');
  if(wrap) wrap.classList.remove('open');
  ingredientGroupPickerContext = null;
}
function setGroupPickerMode(mode){
  ingredientGroupPickerMode = mode === 'ingredient' ? 'ingredient' : 'type';
  syncGroupPickerModeUi();
  renderGroupPickerOptions(document.getElementById('ingredient-group-picker-search')?.value || '');
}
function syncGroupPickerModeUi(){
  const isIngredient = ingredientGroupPickerMode === 'ingredient';
  const ingredientBtn = document.getElementById('group-picker-mode-ingredient');
  const typeBtn = document.getElementById('group-picker-mode-type');
  if(ingredientBtn) ingredientBtn.classList.toggle('primary', isIngredient);
  if(typeBtn) typeBtn.classList.toggle('primary', !isIngredient);
  const label = document.getElementById('ingredient-group-picker-search-label');
  if(label) label.textContent = isIngredient ? 'Search or create ingredient' : 'Search or create sub-type';
  const search = document.getElementById('ingredient-group-picker-search');
  if(search) search.placeholder = isIngredient ? 'Search ingredient, category, alias, product, or brand' : 'Search sub-type, ingredient, alias, product, or brand';
  const parentField = document.getElementById('ingredient-group-picker-parent-field');
  if(parentField) parentField.style.display = isIngredient ? 'none' : 'block';
  const createBtn = document.getElementById('ingredient-group-picker-create-btn');
  if(createBtn) createBtn.textContent = isIngredient ? 'Create/assign ingredient from typed name' : 'Create new sub-type from typed name';
  syncGroupPickerCreateButton();
}
function renderGroupPickerParentOptions(query = ''){
  const list = document.getElementById('ingredient-group-picker-parent-options');
  if(!list) return;
  const q = normaliseAliasText(query || '');
  const variants = getSearchVariants(q);
  let rows = (state.ingredientFamilies || []).slice();
  if (variants.length) { rows = rows.filter(f => variants.some(v => [f.name, CAT[f.cat], f.cat, ...(f.aliases || [])].join(' ').toLowerCase().includes(v))); }
  rows = rows.sort((a,b)=>(CAT[a.cat] || a.cat || '').localeCompare(CAT[b.cat] || b.cat || '') || (a.name || '').localeCompare(b.name || '')).slice(0,30);
  list.innerHTML = rows.map(f => `<option value="${ppEscapeAttr(f.name)}"></option>`).join('');
}
function syncGroupPickerCreateButton(){
  const btn = document.getElementById('ingredient-group-picker-create-btn');
  if(!btn) return;
  const search = normaliseAliasText(document.getElementById('ingredient-group-picker-search')?.value || '');
  const parent = normaliseAliasText(document.getElementById('ingredient-group-picker-parent')?.value || '');
  const needsParent = ingredientGroupPickerMode !== 'ingredient';
  btn.disabled = !search || (needsParent && !parent);
  btn.style.opacity = btn.disabled ? '0.55' : '';
  btn.title = btn.disabled && needsParent ? 'Choose or type a parent ingredient before creating a new sub-type.' : '';
}
function renderGroupPickerOptions(query){
  const listEl = document.getElementById('ingredient-group-picker-options');
  if(!listEl) return;
  syncGroupPickerCreateButton();
  ensureIngredientGroups();
  const q = (query || '').trim();
  if(ingredientGroupPickerMode === 'ingredient'){
    const variants = getSearchVariants(q);
    let rows = (state.ingredientFamilies || []).slice();
    if (q) { rows = rows.filter(f => variants.some(v => [f.name, CAT[f.cat], f.cat, ...(f.aliases || [])].join(' ').toLowerCase().includes(v))); }
    rows = rows.sort((a,b) => (CAT[a.cat] || a.cat || '').localeCompare(CAT[b.cat] || b.cat || '') || (a.name || '').localeCompare(b.name || '')).slice(0, 40);
    if(!rows.length){
      listEl.innerHTML = '<div style="padding:12px;color:var(--text2);font-size:12px">No matching ingredients found. Use Create/assign ingredient from typed name below.</div>';
      return;
    }
    listEl.innerHTML = rows.map(f => {
      const groups = getFamilyGroups(f.id);
      const defaultGroup = getIngredientGroup(f.defaultTypeId) || groups[0] || null;
      const defaultProduct = defaultGroup ? resolveProductForIngredient({ groupId: defaultGroup.id }).product : null;
      return `
        <button type="button" class="ingredient-group-picker-option" data-family-id="${ppEscapeHtml(f.id)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <strong style="font-size:13px">${ppEscapeHtml(f.name)}</strong>
            <span class="tag">${ppEscapeHtml(CAT[f.cat] || f.cat || 'Other')}</span>
            <span class="tag">${groups.length} sub-type${groups.length===1?'':'s'}</span>
          </div>
          ${defaultProduct ? `<div style="font-size:11px;color:var(--text2);margin-top:3px"><strong>Default product:</strong> ${ppEscapeHtml(defaultProduct.name)} · ${getProductProteinPer100Kcal(defaultProduct).toFixed(1)}g protein / 100kcal</div>` : ''}
        </button>`;
    }).join('');
    listEl.querySelectorAll('.ingredient-group-picker-option').forEach(btn => {
      btn.onclick = () => chooseFamilyPickerTarget(btn.dataset.familyId);
      btn.onmouseenter = () => btn.style.background = 'var(--surface2)';
      btn.onmouseleave = () => btn.style.background = 'var(--surface)';
    });
    return;
  }
  let rows = q
    ? findIngredientGroupsByText(q)
    : (state.ingredientGroups || []).map(g => ({ group:g, text:getIngredientGroupSearchText(g), products:getGroupProducts(g.id) })).sort((a,b)=>a.group.name.localeCompare(b.group.name));
  rows = rows.slice(0, 40);
  if(!rows.length){
    listEl.innerHTML = '<div style="padding:12px;color:var(--text2);font-size:12px">No matching types found. Use Create new type from typed name below.</div>';
    return;
  }
  listEl.innerHTML = rows.map(row => {
    const g = row.group;
    const defaultProduct = getProduct(g.defaultProductId) || row.products[0] || null;
    return `
      <button type="button" class="ingredient-group-picker-option" data-id="${ppEscapeHtml(g.id)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <strong style="font-size:13px">${ppEscapeHtml(getGroupTypeName(g))}</strong>
          <span class="tag">${ppEscapeHtml(CAT[g.cat] || g.cat || 'Other')}</span>
          <span class="tag">${ppEscapeHtml(getGroupIngredientName(g))}</span>
          <span class="tag">${row.products.length} product${row.products.length===1?'':'s'}</span>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">${ppEscapeHtml(getGroupHierarchyText(g))}</div>
        ${defaultProduct ? `<div style="font-size:11px;color:var(--text2);margin-top:3px"><strong>Auto default:</strong> ${ppEscapeHtml(defaultProduct.name)} · ${getProductProteinPer100Kcal(defaultProduct).toFixed(1)}g protein / 100kcal</div>` : ''}
      </button>`;
  }).join('');
  listEl.querySelectorAll('.ingredient-group-picker-option').forEach(btn => {
    btn.onclick = () => chooseGroupPickerTarget(btn.dataset.id);
    btn.onmouseenter = () => btn.style.background = 'var(--surface2)';
    btn.onmouseleave = () => btn.style.background = 'var(--surface)';
  });
}
function createGroupFromPickerSearch(){
  const search = normaliseAliasText(document.getElementById('ingredient-group-picker-search')?.value || ingredientGroupPickerContext?.defaultName || '');
  if(!search) return;
  if(ingredientGroupPickerMode === 'ingredient'){
    const product = getProduct(ingredientGroupPickerContext?.productId);
    const cat = product?.cat || 'other';
    const family = ensureIngredientFamilyByName(search, cat);
    chooseFamilyPickerTarget(family.id);
    return;
  }
  const existing = (state.ingredientGroups || []).find(g => canonicalGroupKey(g.name) === canonicalGroupKey(search));
  if(existing) {
    chooseGroupPickerTarget(existing.id);
    return;
  }
  const product = getProduct(ingredientGroupPickerContext?.productId);
  const parentName = normaliseAliasText(document.getElementById('ingredient-group-picker-parent')?.value || '');
  const msg = document.getElementById('ingredient-group-picker-copy');
  if(!parentName){
    if(msg) msg.innerHTML = '<span style="color:var(--red);font-weight:600">Choose or type the parent ingredient before creating a new sub-type.</span>';
    return;
  }
  const family = ensureIngredientFamilyByName(parentName, product?.cat || 'other');
  const group = {
    id:'grp'+Date.now()+Math.random().toString(36).slice(2,6),
    name:toTitleCase(search),
    cat:(family.cat && family.cat !== 'other') ? family.cat : (product?.cat || family.cat || 'other'),
    family:family.name,
    ingredientId:family.id,
    aliases:[search],
    defaultProductId:null,
    productIds:[],
    notes:''
  };
  if(!Array.isArray(family.typeIds)) family.typeIds = [];
  family.typeIds.push(group.id);
  if(!family.defaultTypeId) family.defaultTypeId = group.id;
  syncIngredientGroupAliases(group, []);
  state.ingredientGroups.push(group);
  chooseGroupPickerTarget(group.id);
}
function ensureIngredientFamilyByName(name, cat = 'other'){
  ensureIngredientGroups();
  const clean = normaliseAliasText(name || 'Ingredient');
  const key = canonicalGroupKey(clean);
  let family = (state.ingredientFamilies || []).find(f => canonicalGroupKey(f.name) === key && (!cat || f.cat === cat));
  if (!family && cat && cat !== 'other') { family = (state.ingredientFamilies || []).find(f => canonicalGroupKey(f.name) === key && (!f.cat || f.cat === 'other')); }
  if(!family) {
    let id = ingredientFamilyIdFromName(clean, cat || 'other');
    if(getIngredientFamily(id)) id = 'fam_' + Date.now() + Math.random().toString(36).slice(2,6);
    family = { id, name: toTitleCase(clean), cat: cat || 'other', aliases: [clean], notes: '', typeIds: [], defaultTypeId: '' };
    state.ingredientFamilies.push(family);
  } else if(cat && cat !== 'other' && (!family.cat || family.cat === 'other')) {
    family.cat = cat;
  }
  if(!Array.isArray(family.aliases)) family.aliases = [];
  if(!family.aliases.some(a => canonicalGroupKey(a) === key)) family.aliases.push(family.name);
  if(!Array.isArray(family.typeIds)) family.typeIds = [];
  return family;
}
function ensureDefaultGroupForFamily(family, product = null){
  if(!family) return null;
  let group = getIngredientGroup(family.defaultTypeId) || (state.ingredientGroups || []).find(g => g.ingredientId === family.id && canonicalGroupKey(g.name) === canonicalGroupKey(family.name));
  if(!group){
    group = {
      id:'grp'+Date.now()+Math.random().toString(36).slice(2,6),
      name:toTitleCase(family.name),
      cat:family.cat || product?.cat || 'other',
      family:family.name,
      ingredientId:family.id,
      aliases:[family.name],
      defaultProductId:null,
      productIds:[],
      notes:'',
      defaultSubType:true
    };
    state.ingredientGroups.push(group);
  }
  if(!Array.isArray(family.typeIds)) family.typeIds = [];
  if(!family.typeIds.includes(group.id)) family.typeIds.push(group.id);
  family.defaultTypeId = group.id;
  group.family = family.name;
  group.ingredientId = family.id;
  group.cat = (family.cat && family.cat !== 'other') ? family.cat : (product?.cat && product.cat !== 'other') ? product.cat : (group.cat || family.cat || 'other');
  if(product) syncProductHierarchyCategory(product, group, product.cat);
  return group;
}
function chooseFamilyPickerTarget(familyId){
  const family = getIngredientFamily(familyId);
  if(!family || !ingredientGroupPickerContext) return;
  const product = getProduct(ingredientGroupPickerContext.productId);
  const group = ensureDefaultGroupForFamily(family, product);
  if(product && group){
    ensureProductAssignedToGroup(product, group.name, group.id);
    syncProductHierarchyCategory(product, group, product.cat);
    refreshProductGroupAndRecipes(product.id);
  }
  refreshAutoDefaultProductForGroup(group.id);
  saveState();
  renderIngredientBank();
  renderBank();
  renderVault();
  closeGroupPickerModal();
}
function chooseGroupPickerTarget(groupId){
  const group = getIngredientGroup(groupId);
  if(!group || !ingredientGroupPickerContext) return;
  if(ingredientGroupPickerContext.type === 'product'){
    const product = getProduct(ingredientGroupPickerContext.productId);
    if(product){
      ensureProductAssignedToGroup(product, group.name, group.id);
      syncProductHierarchyCategory(product, group, product.cat);
      refreshProductGroupAndRecipes(product.id);
    }
  } else if(ingredientGroupPickerContext.type === 'suggestedMerge'){
    const suggestion = getSuggestedGroupMerges().find(s => s.key === ingredientGroupPickerContext.suggestionKey);
    (suggestion?.products || []).forEach(product => {
      ensureProductAssignedToGroup(product, group.name, group.id);
      syncProductHierarchyCategory(product, group, product.cat);
      refreshProductGroupAndRecipes(product.id);
    });
  }
  refreshAutoDefaultProductForGroup(group.id);
  saveState();
  renderIngredientBank();
  renderBank();
  renderVault();
  closeGroupPickerModal();
}
function setGroupDefaultProduct(groupId, productId){
  const group = getIngredientGroup(groupId);
  const product = getProduct(productId);
  if(!group || !product) return;
  ensureProductAssignedToGroup(product, group.name, group.id);
  group.manualDefaultProductId = product.id;
  group.defaultProductId = product.id;
  refreshProductGroupAndRecipes(product.id);
  saveState();
  renderIngredientBank();
  renderBank();
  renderVault();
}
function renderEditProductLinkage(ing){
  const el = document.getElementById('mi-linkage-container');
  if(!el || !ing) return;
  const group = getIngredientGroup(ing.groupId);
  const family = group ? getGroupIngredientFamily(group) : null;
  if(group){
    el.innerHTML = `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
        <div class="row-between" style="align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em">Linked Ingredient & Sub-type</div>
            <div style="font-size:13px;font-weight:600;margin-top:2px;color:var(--text)">
              ${ppEscapeHtml(family?.name || group.family || 'Ingredient')} &rarr; <span style="color:var(--green)">${ppEscapeHtml(getGroupTypeName(group))}</span>
            </div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${ppEscapeHtml(getGroupHierarchyText(group))}</div>
          </div>
          <div class="btn-row" style="margin:0;gap:6px">
            <button type="button" class="btn sm ghost" onclick="openProductReallocationModal('${ppEscapeHtml(ing.id)}')">Reallocate</button>
            <button type="button" class="btn sm danger ghost" onclick="confirmDelinkProduct('${ppEscapeHtml(ing.id)}')">Delink</button>
          </div>
        </div>
      </div>`;
  } else {
    el.innerHTML = `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
        <div class="row-between" style="align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em">Ingredient Linkage</div>
            <div style="font-size:13px;color:var(--text2);margin-top:2px">Standalone product (not linked to any ingredient)</div>
          </div>
          <div class="btn-row" style="margin:0">
            <button type="button" class="btn sm primary" onclick="openProductReallocationModal('${ppEscapeHtml(ing.id)}')">Link to Ingredient</button>
          </div>
        </div>
      </div>`;
  }
}
let activeReallocationProductId = null;
function ensureProductReallocationModal(){
  let wrap = document.getElementById('product-reallocation-wrap');
  if(wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'product-reallocation-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '450';
  wrap.innerHTML = `
    <div class="modal" style="max-width:580px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;">
      <div class="row-between" style="align-items:center;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">
        <div>
          <h3 id="product-reallocation-title" style="margin:0;font-size:16px">Reallocate Product</h3>
          <div id="product-reallocation-subtitle" style="font-size:12px;color:var(--text2);margin-top:2px"></div>
        </div>
        <button class="btn sm ghost" onclick="closeProductReallocationModal()">&times;</button>
      </div>
      <div id="product-reallocation-body" style="overflow-y:auto;flex:1;padding-right:4px;">
        <div id="product-reallocation-current" style="margin-bottom:12px;"></div>
        <!-- Option 1: Existing ingredient -->
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:12px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:6px">Option 1: Allocate to Existing Ingredient / Sub-type</div>
          <input type="search" id="product-reallocation-search" placeholder="Search ingredient or sub-type..." oninput="filterReallocationOptions(this.value)" style="width:100%;padding:7px 10px;font-size:12px;margin-bottom:8px">
          <div id="product-reallocation-options" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface)"></div>
        </div>
        <!-- Option 2: Invent new ingredient -->
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:12px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:6px">Option 2: Invent New Ingredient & Sub-type</div>
          <div class="grid2" style="gap:8px">
            <div>
              <label style="font-size:11px;font-weight:600">Ingredient Name</label>
              <input type="text" id="product-reallocation-new-family" placeholder="e.g. Tempeh" style="font-size:12px">
            </div>
            <div>
              <label style="font-size:11px;font-weight:600">Sub-type Name</label>
              <input type="text" id="product-reallocation-new-type" placeholder="e.g. Smoked Tempeh" style="font-size:12px">
            </div>
          </div>
          <div style="margin-top:8px">
            <label style="font-size:11px;font-weight:600">Category</label>
            <select id="product-reallocation-new-cat" style="font-size:12px;width:100%"></select>
          </div>
          <button type="button" class="btn sm secondary" style="margin-top:10px;width:100%" onclick="saveProductReallocationToNewIngredient()">Create Ingredient & Allocate Product</button>
        </div>
        <!-- Delink standalone option -->
        <div id="product-reallocation-delink-row" style="margin-top:8px;text-align:right"></div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function openProductReallocationModal(productId){
  const product = getProduct(productId);
  if(!product) return;
  activeReallocationProductId = productId;
  const wrap = ensureProductReallocationModal();
  document.getElementById('product-reallocation-title').textContent = `Reallocate "${product.name}"`;
  document.getElementById('product-reallocation-subtitle').textContent = product.brand && product.brand !== 'Generic' ? product.brand : 'Product reallocation';
  const group = getIngredientGroup(product.groupId);
  const family = group ? getGroupIngredientFamily(group) : null;
  const currentEl = document.getElementById('product-reallocation-current');
  if(group){
    currentEl.innerHTML = `<div style="font-size:12px;color:var(--text2)">Currently linked to: <strong>${ppEscapeHtml(family?.name || group.family)}</strong> &rarr; <span style="color:var(--green);font-weight:600">${ppEscapeHtml(getGroupTypeName(group))}</span></div>`;
  } else { currentEl.innerHTML = `<div style="font-size:12px;color:var(--text2)">Currently <strong>Standalone</strong> (not linked to any ingredient).</div>`; }
  const catSelect = document.getElementById('product-reallocation-new-cat');
  if(catSelect){
    catSelect.innerHTML = Object.entries(CAT).map(([k, v]) => `<option value="${ppEscapeAttr(k)}" ${k === (product.cat || 'other') ? 'selected' : ''}>${ppEscapeHtml(v)}</option>`).join('');
  }
  const famInput = document.getElementById('product-reallocation-new-family');
  const typeInput = document.getElementById('product-reallocation-new-type');
  if(famInput) famInput.value = family?.name || getProductFamily(product) || '';
  if(typeInput) typeInput.value = group ? getGroupTypeName(group) : product.name;
  const searchInput = document.getElementById('product-reallocation-search');
  if(searchInput) searchInput.value = '';
  filterReallocationOptions('');
  const delinkRow = document.getElementById('product-reallocation-delink-row');
  if(delinkRow){
    if(group){
      delinkRow.innerHTML = `<button type="button" class="btn sm danger ghost" onclick="confirmDelinkProduct('${ppEscapeHtml(product.id)}')">Delink product from ingredient (make standalone)</button>`;
    } else { delinkRow.innerHTML = ''; }
  }
  wrap.classList.add('open');
  setTimeout(() => searchInput?.focus(), 50);
}
function closeProductReallocationModal(){
  const wrap = document.getElementById('product-reallocation-wrap');
  if(wrap) wrap.classList.remove('open');
  activeReallocationProductId = null;
}
function filterReallocationOptions(query = ''){
  const listEl = document.getElementById('product-reallocation-options');
  if(!listEl) return;
  ensureIngredientGroups();
  const q = String(query || '').trim().toLowerCase();
  const groups = (state.ingredientGroups || []).slice();
  let filtered = groups;
  if(q){
    const variants = getSearchVariants(q);
    filtered = groups.filter(g => {
      const gName = (g.name || '').toLowerCase();
      const gFam = (g.family || '').toLowerCase();
      const gCat = (CAT[g.cat] || g.cat || '').toLowerCase();
      const gAliases = (g.aliases || []).join(' ').toLowerCase();
      return variants.some(v => gName.includes(v) || gFam.includes(v) || gCat.includes(v) || gAliases.includes(v));
    });
  }
  filtered.sort((a,b) => (a.family||'').localeCompare(b.family||'') || (a.name||'').localeCompare(b.name||''));
  if(!filtered.length){
    listEl.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--text2)">No matching ingredient sub-types found. Use Option 2 below to invent a new one.</div>';
    return;
  }
  listEl.innerHTML = filtered.slice(0, 35).map(g => {
    const isCurrent = activeReallocationProductId && getProduct(activeReallocationProductId)?.groupId === g.id;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border);${isCurrent ? 'background:var(--surface2);' : ''}">
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:600">${ppEscapeHtml(g.family || 'Ingredient')} &rarr; <span style="color:var(--green)">${ppEscapeHtml(getGroupTypeName(g))}</span></div>
          <div style="font-size:10px;color:var(--text3)">${ppEscapeHtml(CAT[g.cat] || g.cat || 'Other')} · ${(g.productIds||[]).length} product${(g.productIds||[]).length===1?'':'s'}</div>
        </div>
        <div>
          ${isCurrent 
            ? '<span class="tag green" style="font-size:11px">Current</span>' 
            : `<button type="button" class="btn sm primary" style="padding:3px 8px;font-size:11px" onclick="reallocateProductToExistingGroup('${ppEscapeHtml(activeReallocationProductId)}', '${ppEscapeHtml(g.id)}')">Allocate</button>`}
        </div>
      </div>`;
  }).join('');
}
function reallocateProductToExistingGroup(productId, targetGroupId){
  const product = getProduct(productId);
  const targetGroup = getIngredientGroup(targetGroupId);
  if(!product || !targetGroup) return;
  const nowIso = new Date().toISOString();
  const oldGroupId = product.groupId;
  if(oldGroupId && oldGroupId !== targetGroup.id){
    const oldGroup = getIngredientGroup(oldGroupId);
    if(oldGroup && Array.isArray(oldGroup.productIds)){
      oldGroup.productIds = oldGroup.productIds.filter(id => id !== product.id);
      oldGroup.updatedAt = nowIso;
    }
    refreshAutoDefaultProductForGroup(oldGroupId);
  }
  product.updatedAt = nowIso;
  targetGroup.updatedAt = nowIso;
  ensureProductAssignedToGroup(product, targetGroup.name, targetGroup.id);
  product.groupId = targetGroup.id;
  product.subTypeId = targetGroup.id;
  product.subType = targetGroup.name;
  if(targetGroup.ingredientId) product.ingredientId = targetGroup.ingredientId;
  else {
    const fam = typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily(targetGroup) : null;
    if(fam) product.ingredientId = fam.id;
  }
  syncProductHierarchyCategory(product, targetGroup, product.cat);
  refreshProductGroupAndRecipes(product.id);
  refreshAutoDefaultProductForGroup(targetGroup.id);
  saveIngredient(product);
  saveState(true);
  renderIngredientBank();
  renderBank();
  renderVault();
  if (editIngId === product.id) { renderEditProductLinkage(product); }
  closeProductReallocationModal();
  showPlatePlanToast(`"${product.name}" reallocated to ${getGroupTypeName(targetGroup)}.`);
}
function saveProductReallocationToNewIngredient(){
  if(!activeReallocationProductId) return;
  const product = getProduct(activeReallocationProductId);
  if(!product) return;
  const familyName = normaliseAliasText(document.getElementById('product-reallocation-new-family')?.value || '');
  const typeName = normaliseAliasText(document.getElementById('product-reallocation-new-type')?.value || '');
  const cat = document.getElementById('product-reallocation-new-cat')?.value || product.cat || 'other';
  if (!familyName || !typeName) { return alert('Please enter both an ingredient name and sub-type name.'); }
  const nowIso = new Date().toISOString();
  const family = ensureIngredientFamilyByName(familyName, cat);
  family.updatedAt = nowIso;
  const group = {
    id: 'grp' + Date.now() + Math.random().toString(36).slice(2,6),
    name: toTitleCase(typeName),
    cat: cat || family.cat || 'other',
    family: family.name,
    ingredientId: family.id,
    aliases: [typeName],
    defaultProductId: product.id,
    productIds: [product.id],
    notes: '',
    updatedAt: nowIso
  };
  if(!Array.isArray(family.typeIds)) family.typeIds = [];
  family.typeIds.push(group.id);
  if(!family.defaultTypeId) family.defaultTypeId = group.id;
  syncIngredientGroupAliases(group, []);
  state.ingredientGroups.push(group);
  const oldGroupId = product.groupId;
  if(oldGroupId && oldGroupId !== group.id){
    const oldGroup = getIngredientGroup(oldGroupId);
    if(oldGroup && Array.isArray(oldGroup.productIds)){
      oldGroup.productIds = oldGroup.productIds.filter(id => id !== product.id);
      oldGroup.updatedAt = nowIso;
    }
    refreshAutoDefaultProductForGroup(oldGroupId);
  }
  product.updatedAt = nowIso;
  product.groupId = group.id;
  product.subTypeId = group.id;
  product.subType = group.name;
  product.ingredientId = family.id;
  ensureProductAssignedToGroup(product, group.name, group.id);
  syncProductHierarchyCategory(product, group, product.cat);
  refreshProductGroupAndRecipes(product.id);
  refreshAutoDefaultProductForGroup(group.id);
  saveIngredient(product);
  saveState(true);
  renderIngredientBank();
  renderBank();
  renderVault();
  if (editIngId === product.id) { renderEditProductLinkage(product); }
  closeProductReallocationModal();
  showPlatePlanToast(`"${product.name}" allocated to new ingredient ${family.name} (${group.name}).`);
}
function confirmDelinkProduct(productId){
  const product = getProduct(productId);
  if(!product) return;
  const group = getIngredientGroup(product.groupId);
  const groupName = group ? getGroupTypeName(group) : 'ingredient';
  if(!confirm(`Are you sure you want to delink "${product.name}" from ${groupName}?\n\nIt will become a standalone product not attached to any recipe ingredient.`)){
    return;
  }
  const nowIso = new Date().toISOString();
  const oldGroupId = product.groupId;
  product.groupId = '';
  product.subTypeId = '';
  product.subType = '';
  product.ingredientId = '';
  product.updatedAt = nowIso;
  if(oldGroupId){
    const oldGroup = getIngredientGroup(oldGroupId);
    if(oldGroup && Array.isArray(oldGroup.productIds)){
      oldGroup.productIds = oldGroup.productIds.filter(id => id !== product.id);
      oldGroup.updatedAt = nowIso;
    }
    refreshAutoDefaultProductForGroup(oldGroupId);
  }
  saveState(true);
  renderIngredientBank();
  renderBank();
  renderVault();
  if (editIngId === product.id) { renderEditProductLinkage(product); }
  closeProductReallocationModal();
  showPlatePlanToast(`"${product.name}" delinked from ingredient.`);
}
let productBankGroupFilterId = null;
function showGroupProducts(groupId){
  const group = getIngredientGroup(groupId);
  if(!group) return;
  productBankGroupFilterId = group.id;
  productBankFamilyFilterId = null;
  activeFamily = 'all';
  activeCat = 'all';
  showView('bank');
  const search = document.getElementById('bank-search');
  if(search) search.value = '';
  renderBank();
  setTimeout(() => document.getElementById('bank-search')?.focus(), 0);
}
function clearProductGroupFilter(){
  productBankGroupFilterId = null;
  productBankFamilyFilterId = null;
  renderBank();
}
function renameIngredientGroupPrompt(groupId) { openIngredientGroupDetailsModal(groupId, 'name'); }
function editGroupAliasesPrompt(groupId) { openIngredientGroupDetailsModal(groupId, 'aliases'); }
function editGroupFamilyPrompt(groupId) { openIngredientFamilyPickerModal(groupId); }
let familyPickerGroupId = null;
let familyRenameOriginal = '';
function ensureIngredientFamilyPickerModal(){
  let wrap = document.getElementById('ingredient-family-picker-wrap');
  if(wrap) wrap.remove();
  wrap = document.createElement('div');
  wrap.id = 'ingredient-family-picker-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '430';
  wrap.innerHTML = `
    <div class="modal" style="max-width:620px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 style="margin:0">Choose ingredient</h3>
        <button class="btn sm ghost" onclick="closeIngredientFamilyPickerModal()">Close</button>
      </div>
      <div id="ingredient-family-picker-context" style="font-size:12px;color:var(--text2);margin-bottom:12px"></div>
      <div class="field">
        <label>Search or create ingredient</label>
        <input type="search" id="ingredient-family-picker-search" placeholder="e.g. Pasta, Asparagus, Tofu" oninput="renderIngredientFamilyPickerOptions(this.value)">
      </div>
      <div id="ingredient-family-picker-options" style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface);margin-bottom:12px"></div>
      <div class="field" style="border-top:1px solid var(--border);padding-top:12px">
        <label>Rename current ingredient everywhere</label>
        <div style="display:flex;gap:8px">
          <input type="text" id="ingredient-family-rename-input" placeholder="New ingredient name">
          <button class="btn sm ghost" type="button" onclick="renameCurrentIngredientFamily()">Rename</button>
        </div>
      </div>
      <div id="ingredient-family-picker-msg"></div>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn primary" onclick="createFamilyFromPickerSearch()">Create and assign</button>
        <button class="btn ghost" onclick="clearIngredientFamilyAssignment()">Clear ingredient</button>
        <button class="btn ghost" onclick="closeIngredientFamilyPickerModal()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function openIngredientFamilyPickerModal(groupId){
  const group = getIngredientGroup(groupId);
  if(!group) return;
  familyPickerGroupId = group.id;
  familyRenameOriginal = group.family || '';
  const wrap = ensureIngredientFamilyPickerModal();
  document.getElementById('ingredient-family-picker-context').innerHTML =
    `<strong>${ppEscapeHtml(getGroupTypeName(group))}</strong> is currently under <strong>${ppEscapeHtml(getGroupIngredientName(group))}</strong>.`;
  document.getElementById('ingredient-family-picker-search').value = group.family || '';
  document.getElementById('ingredient-family-rename-input').value = group.family || '';
  document.getElementById('ingredient-family-picker-msg').innerHTML = '';
  renderIngredientFamilyPickerOptions(group.family || '');
  wrap.classList.add('open');
  setTimeout(()=>document.getElementById('ingredient-family-picker-search')?.focus(),0);
}
function closeIngredientFamilyPickerModal(){
  const wrap = document.getElementById('ingredient-family-picker-wrap');
  if(wrap) wrap.classList.remove('open');
  familyPickerGroupId = null;
  familyRenameOriginal = '';
}
function renderIngredientFamilyPickerOptions(query = ''){
  const list = document.getElementById('ingredient-family-picker-options');
  if(!list) return;
  const q = canonicalGroupKey(query);
  const families = getKnownFamilies().filter(f => !q || canonicalGroupKey(f).includes(q));
  if(!families.length){
    list.innerHTML = '<div style="padding:12px;color:var(--text2);font-size:12px">No matching ingredient yet. Use Create and assign.</div>';
    return;
  }
  list.innerHTML = families.map(f => {
    const count = (state.ingredientGroups || []).filter(g => canonicalGroupKey(g.family) === canonicalGroupKey(f)).length;
    return `<button type="button" class="family-picker-option" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)" onclick="assignIngredientFamily('${ppEscapeHtml(f)}')">
      <strong>${ppEscapeHtml(f)}</strong>
      <span class="tag" style="margin-left:6px">${count} type${count===1?'':'s'}</span>
    </button>`;
  }).join('');
}
function assignIngredientFamily(family){
  const group = getIngredientGroup(familyPickerGroupId);
  const clean = normaliseAliasText(family);
  if(!group || !clean) return;
  group.family = clean;
  saveState();
  renderIngredientBank();
  renderBank();
  renderDataQuality?.();
  closeIngredientFamilyPickerModal();
}
function createFamilyFromPickerSearch(){
  const family = normaliseAliasText(document.getElementById('ingredient-family-picker-search')?.value || '');
  if(!family){
    document.getElementById('ingredient-family-picker-msg').innerHTML = '<div class="msg error">Type an ingredient name first.</div>';
    return;
  }
  assignIngredientFamily(family);
}
function clearIngredientFamilyAssignment(){
  const group = getIngredientGroup(familyPickerGroupId);
  if(!group) return;
  group.family = '';
  saveState();
  renderIngredientBank();
  renderBank();
  renderDataQuality?.();
  closeIngredientFamilyPickerModal();
}
function renameCurrentIngredientFamily(){
  const oldName = normaliseAliasText(familyRenameOriginal);
  const nextName = normaliseAliasText(document.getElementById('ingredient-family-rename-input')?.value || '');
  const msg = document.getElementById('ingredient-family-picker-msg');
  if(!oldName){
    if(msg) msg.innerHTML = '<div class="msg error">This type has no current ingredient to rename.</div>';
    return;
  }
  if(!nextName){
    if(msg) msg.innerHTML = '<div class="msg error">Add the new ingredient name first.</div>';
    return;
  }
  (state.ingredientGroups || []).forEach(g => {
    if(canonicalGroupKey(g.family) === canonicalGroupKey(oldName)) g.family = nextName;
  });
  familyRenameOriginal = nextName;
  saveState();
  renderIngredientFamilyPickerOptions(nextName);
  renderIngredientBank();
  renderBank();
  renderDataQuality?.();
  if(msg) msg.innerHTML = `<div class="msg success">Renamed ${ppEscapeHtml(oldName)} to ${ppEscapeHtml(nextName)}.</div>`;
}
let ingredientGroupDetailsEditId = null;
let ingredientGroupDetailsMode = 'name';
let ingredientGroupDetailsFamilyId = null;
function inferHerbMetadata(...values){
  const text=normaliseAliasText(values.filter(Boolean).join(' ')).toLowerCase();
  const herbs=['basil','coriander','cilantro','parsley','thyme','rosemary','oregano','mint','sage','dill','chives','marjoram','tarragon'];
  const herbKey=herbs.find(herb=>new RegExp(`\\b${herb}\\b`).test(text))||'';
  if(!herbKey) return {herbForm:'',herbKey:''};
  return {herbForm:/\b(dried|dry)\b/.test(text)?'dried':'fresh',herbKey};
}
function ensureIngredientGroupDetailsModal(){
  let wrap = document.getElementById('ingredient-group-details-wrap');
  if(wrap) wrap.remove();
  wrap = document.createElement('div');
  wrap.id = 'ingredient-group-details-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '380';
  wrap.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 id="ingredient-group-details-title" style="margin:0">Edit type</h3>
        <button class="btn sm ghost" onclick="closeIngredientGroupDetailsModal()">Close</button>
      </div>
      <div id="ingredient-group-details-context" style="font-size:12px;color:var(--text2);margin-bottom:12px"></div>
      <div class="field" id="ingredient-group-category-field">
        <label>Category</label>
        <select id="ingredient-group-category-input"></select>
      </div>
      <div class="field" id="ingredient-group-name-field">
        <label>Type</label>
        <input type="text" id="ingredient-group-name-input" placeholder="e.g. Spaghetti, Frozen asparagus, Super firm tofu">
      </div>
      <div class="field" id="ingredient-group-family-field">
        <label>Ingredient</label>
        <input type="search" id="ingredient-group-family-input" placeholder="Search or create ingredient, e.g. Pasta, Asparagus, Tofu" oninput="renderIngredientGroupFamilyOptions(this.value)">
        <div id="ingredient-group-family-options" style="display:none;max-height:190px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface);margin-top:6px"></div>
        <button type="button" class="btn sm ghost" id="ingredient-group-family-create-btn" style="margin-top:6px;display:none" onclick="createIngredientForGroupDetails()">Create New Ingredient</button>
        <div style="font-size:11px;color:var(--text2);margin-top:4px">This is the everyday ingredient. The type is the more specific subtype used by recipes.</div>
      </div>
      <div class="field" id="ingredient-group-aliases-field">
        <label>Aliases</label>
        <textarea id="ingredient-group-aliases-input" style="min-height:110px" placeholder="One alias per line, or comma-separated"></textarea>
        <div style="font-size:11px;color:var(--text2);margin-top:4px">Aliases help recipe mapping and search recognise different names for the same type or ingredient.</div>
      </div>
      <div id="ingredient-group-details-msg"></div>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn primary" id="ingredient-group-save-btn" onclick="saveIngredientGroupDetailsModal()">Save</button>
        <button class="btn ghost" onclick="closeIngredientGroupDetailsModal()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function openIngredientGroupDetailsModal(groupId, mode = 'name'){
  if(groupId) capturePlatePlanEditBaseline('ingredientGroups/'+groupId);
  const group = getIngredientGroup(groupId);
  if(!group && mode !== 'create') return;
  ingredientGroupDetailsEditId = group?.id || null;
  ingredientGroupDetailsMode = mode;
  const wrap = ensureIngredientGroupDetailsModal();
  const products = group ? getGroupProducts(group.id) : [];
  const titles = { aliases:'Edit aliases', family:'Edit ingredient', create:'Create type', name:'Edit type' };
  document.getElementById('ingredient-group-details-title').textContent = titles[mode] || titles.name;
  document.getElementById('ingredient-group-details-context').innerHTML = group
    ? `<strong>${ppEscapeHtml(getGroupHierarchyText(group))}</strong> <span class="tag">${products.length} product${products.length===1?'':'s'}</span>`
    : 'Create a recipe ingredient type. Products can be linked afterwards from Product Bank.';
  const catField = document.getElementById('ingredient-group-category-field');
  if(catField) catField.style.display = (mode === 'name' || mode === 'family' || mode === 'create') ? 'block' : 'none';
  const nameField = document.getElementById('ingredient-group-name-field');
  if(nameField) nameField.style.display = (mode === 'name' || mode === 'create') ? 'block' : 'none';
  const famField = document.getElementById('ingredient-group-family-field');
  if(famField) famField.style.display = (mode === 'name' || mode === 'family' || mode === 'create') ? 'block' : 'none';
  const aliasField = document.getElementById('ingredient-group-aliases-field');
  if(aliasField) aliasField.style.display = (mode === 'aliases' || mode === 'create') ? 'block' : 'none';
  document.getElementById('ingredient-group-category-input').innerHTML = getGroupCategoryOptionsHtml(group?.cat || 'other');
  document.getElementById('ingredient-group-name-input').value = group?.name || '';
  document.getElementById('ingredient-group-family-input').value = group?.family || '';
  ingredientGroupDetailsFamilyId = group?.ingredientId || getGroupIngredientFamily(group)?.id || null;
  renderIngredientGroupFamilyOptions(group?.family || '');
  document.getElementById('ingredient-group-aliases-input').value = (group?.aliases || []).join('\n');
  document.getElementById('ingredient-group-details-msg').innerHTML = '';
  wrap.classList.add('open');
  setTimeout(() => {
    const input = document.getElementById(mode === 'aliases' ? 'ingredient-group-aliases-input' : mode === 'family' ? 'ingredient-group-family-input' : 'ingredient-group-name-input');
    input?.focus();
    input?.select?.();
  }, 0);
}
function closeIngredientGroupDetailsModal(preserveEditorReturn=false){
  const wrap = document.getElementById('ingredient-group-details-wrap');
  if(wrap) wrap.classList.remove('open');
  ingredientGroupDetailsEditId = null;
  ingredientGroupDetailsFamilyId = null;
  if(!preserveEditorReturn) abandonEditorReturn();
}
function renderIngredientGroupFamilyOptions(query = ''){
  const list = document.getElementById('ingredient-group-family-options');
  const createBtn = document.getElementById('ingredient-group-family-create-btn');
  if(!list) return;
  const q = normaliseAliasText(query || '');
  const variants = getSearchVariants(q);
  let rows = (state.ingredientFamilies || []).slice();
  if (variants.length) { rows = rows.filter(f => variants.some(v => [f.name, ...(f.aliases || [])].filter(Boolean).join(' ').toLowerCase().includes(v))); }
  rows = rows.sort((a,b)=>(CAT[a.cat] || a.cat || '').localeCompare(CAT[b.cat] || b.cat || '') || (a.name || '').localeCompare(b.name || '')).slice(0,20);
  list.style.display = rows.length ? 'block' : 'none';
  list.innerHTML = rows.map(f => `<button type="button" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:${ingredientGroupDetailsFamilyId === f.id ? 'var(--green-bg)' : 'var(--surface)'};padding:8px 10px;cursor:pointer;color:var(--text)" onclick="selectIngredientForGroupDetails('${ppEscapeAttr(f.id)}')">
    <strong style="font-size:12px">${ppEscapeHtml(f.name)}</strong>
    <span class="tag" style="margin-left:5px">${ppEscapeHtml(CAT[f.cat] || f.cat || 'Other')}</span>
    <span class="tag">${(f.typeIds || []).length} sub-type${(f.typeIds || []).length===1?'':'s'}</span>
  </button>`).join('');
  const exact = rows.some(f => canonicalGroupKey(f.name) === canonicalGroupKey(q));
  if(createBtn) {
    createBtn.style.display = q && !exact ? 'inline-flex' : 'none';
    createBtn.textContent = q ? `Create New Ingredient: ${q}` : 'Create New Ingredient';
  }
}
function selectIngredientForGroupDetails(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return;
  ingredientGroupDetailsFamilyId = family.id;
  const input = document.getElementById('ingredient-group-family-input');
  if(input) input.value = family.name;
  const catInput = document.getElementById('ingredient-group-category-input');
  if(catInput && family.cat) catInput.value = family.cat;
  renderIngredientGroupFamilyOptions(family.name);
}
function createIngredientForGroupDetails(){
  const input = document.getElementById('ingredient-group-family-input');
  const msg = document.getElementById('ingredient-group-details-msg');
  const name = normaliseAliasText(input?.value || '');
  if(!name){
    if(msg) msg.innerHTML = '<div class="msg error">Add an ingredient name first.</div>';
    return;
  }
  const cat = document.getElementById('ingredient-group-category-input')?.value || 'other';
  let family = (state.ingredientFamilies || []).find(f => canonicalGroupKey(f.name) === canonicalGroupKey(name) && f.cat === cat);
  if(!family){
    let id = ingredientFamilyIdFromName(name, cat);
    if(getIngredientFamily(id)) id = 'fam_' + Date.now() + Math.random().toString(36).slice(2,6);
    family = { id, name:toTitleCase(name), cat, aliases:[name], notes:'', typeIds:[], defaultTypeId:'' };
    state.ingredientFamilies.push(family);
  }
  selectIngredientForGroupDetails(family.id);
}
function resolveIngredientFamilyForGroupDetails(name, cat, fallbackFamily = null){
  const clean = normaliseAliasText(name || '');
  const selected = ingredientGroupDetailsFamilyId ? getIngredientFamily(ingredientGroupDetailsFamilyId) : null;
  if(selected && (!clean || canonicalGroupKey(selected.name) === canonicalGroupKey(clean))) return selected;
  if(clean){
    let family = (state.ingredientFamilies || []).find(f => canonicalGroupKey(f.name) === canonicalGroupKey(clean) && f.cat === cat);
    if(!family){
      let id = ingredientFamilyIdFromName(clean, cat);
      if(getIngredientFamily(id)) id = 'fam_' + Date.now() + Math.random().toString(36).slice(2,6);
      family = { id, name:toTitleCase(clean), cat, aliases:[clean], notes:'', typeIds:[], defaultTypeId:'' };
      state.ingredientFamilies.push(family);
    }
    return family;
  }
  return fallbackFamily;
}
async function saveIngredientGroupDetailsModal(){
  let group = getIngredientGroup(ingredientGroupDetailsEditId);
  const msg = document.getElementById('ingredient-group-details-msg');
  const nowIso = new Date().toISOString();
  let isNew = false;
  let family = null;
  if(ingredientGroupDetailsMode === 'create'){
    const name = (document.getElementById('ingredient-group-name-input')?.value || '').trim();
    if(!name){
      msg.innerHTML = '<div class="msg error">Add a type name first.</div>';
      return;
    }
    const key = canonicalGroupKey(name);
    if((state.ingredientGroups || []).some(g => canonicalGroupKey(g.name) === key)){
      msg.innerHTML = '<div class="msg error">That type already exists. Use Merge if you want to combine types.</div>';
      return;
    }
    const aliasesText = document.getElementById('ingredient-group-aliases-input')?.value || '';
    const cat = document.getElementById('ingredient-group-category-input')?.value || 'other';
    const familyName = normaliseAliasText(document.getElementById('ingredient-group-family-input')?.value || '') || inferIngredientFamilyFromText(name) || name;
    family = window.pendingSubTypeFamilyId ? getIngredientFamily(window.pendingSubTypeFamilyId) : resolveIngredientFamilyForGroupDetails(familyName, cat);
    family.updatedAt = nowIso;
    group = {
      id:'grp'+Date.now()+Math.random().toString(36).slice(2,6),
      name:toTitleCase(name),
      cat:family.cat || cat,
      family:family.name,
      ingredientId:family.id,
      aliases:aliasesText.split(/[\n,]/).map(a=>a.trim()).filter(Boolean),
      defaultProductId:null,
      productIds:[],
      notes:'',
      updatedAt: nowIso
    };
    family.typeIds.push(group.id);
    if(!family.defaultTypeId) family.defaultTypeId = group.id;
    window.pendingSubTypeFamilyId = null;
    syncIngredientGroupAliases(group, []);
    isNew = true;
  } else if (!group) { return; } else if(ingredientGroupDetailsMode === 'name'){
    const name = (document.getElementById('ingredient-group-name-input')?.value || '').trim();
    if(!name){
      msg.innerHTML = '<div class="msg error">Add a type name first.</div>';
      return;
    }
    const key = canonicalGroupKey(name);
    const duplicate = (state.ingredientGroups || []).find(g => g.id !== group.id && canonicalGroupKey(g.name) === key);
    if(duplicate){
      msg.innerHTML = `<div class="msg error">That type already exists. Use Merge to combine it with ${ppEscapeHtml(duplicate.name)}.</div>`;
      return;
    }
    group.cat = document.getElementById('ingredient-group-category-input')?.value || group.cat || 'other';
    const familyName = normaliseAliasText(document.getElementById('ingredient-group-family-input')?.value || '') || group.family || inferIngredientFamilyFromText(name);
    family = resolveIngredientFamilyForGroupDetails(familyName, group.cat, getGroupIngredientFamily(group));
    if(family){
      const oldFamily = getGroupIngredientFamily(group);
      if(oldFamily && oldFamily.id !== family.id){
        oldFamily.typeIds = (oldFamily.typeIds || []).filter(id => id !== group.id);
        if(oldFamily.defaultTypeId === group.id) oldFamily.defaultTypeId = oldFamily.typeIds[0] || '';
        oldFamily.updatedAt = nowIso;
      }
      group.ingredientId = family.id;
      group.family = family.name;
      group.cat = family.cat || group.cat;
      if(!Array.isArray(family.typeIds)) family.typeIds = [];
      if(!family.typeIds.includes(group.id)) family.typeIds.push(group.id);
      if(!family.defaultTypeId) family.defaultTypeId = group.id;
      family.updatedAt = nowIso;
      ingredientSubTypesOpenIds.add(family.id);
    } else { group.family = familyName; }
    group.name = toTitleCase(name);
    group.updatedAt = nowIso;
    addIngredientGroupAlias(group, group.name);
  } else if(ingredientGroupDetailsMode === 'family'){
    group.cat = document.getElementById('ingredient-group-category-input')?.value || group.cat || 'other';
    const familyName = normaliseAliasText(document.getElementById('ingredient-group-family-input')?.value || '');
    family = resolveIngredientFamilyForGroupDetails(familyName, group.cat, getGroupIngredientFamily(group));
    if(family){
      group.ingredientId = family.id;
      group.family = family.name;
      group.cat = family.cat || group.cat;
      if(!Array.isArray(family.typeIds)) family.typeIds = [];
      if(!family.typeIds.includes(group.id)) family.typeIds.push(group.id);
      family.updatedAt = nowIso;
      ingredientSubTypesOpenIds.add(family.id);
    } else { group.family = familyName; }
    group.updatedAt = nowIso;
  } else if(ingredientGroupDetailsMode === 'familyAliases'){
    const fam = getIngredientFamily(ingredientFamilyDetailsId);
    if(fam){
      const aliasesText = document.getElementById('ingredient-group-aliases-input')?.value || '';
      fam.aliases = aliasesText.split(/[\n,]/).map(a=>a.trim()).filter(Boolean);
      if(fam.name && !fam.aliases.some(a => canonicalGroupKey(a) === canonicalGroupKey(fam.name))) fam.aliases.unshift(fam.name);
      fam.updatedAt = nowIso;
      family = fam;
    }
  } else {
    const aliasesText = document.getElementById('ingredient-group-aliases-input')?.value || '';
    group.aliases = aliasesText.split(/[\n,]/).map(a=>a.trim()).filter(Boolean);
    group.updatedAt = nowIso;
    syncIngredientGroupAliases(group, getGroupProducts(group.id));
  }
  let affectedProducts = [];
  if(group) {
    group.updatedAt = nowIso;
    ensureIngredientFamilyForGroup(group, state);
    affectedProducts = getGroupProducts(group.id);
    affectedProducts.forEach(product => { if(group.cat) product.cat = group.cat; product.updatedAt = nowIso; });
    syncIngredientGroupAliases(group, affectedProducts);
  }
  try {
    await executeDataQualityTransaction('SAVE_SUBTYPE_GROUP', {
      groupData: group,
      isNew,
      affectedProducts,
      affectedFamily: family
    }, {
      modalWrapId: 'ingredient-group-details-wrap',
      submitButtonId: 'ingredient-group-save-btn',
      errorContainerId: 'ingredient-group-details-msg'
    });
    closeIngredientGroupDetailsModal(true);
    refreshHierarchyViews();
    finishEditorReturn();
  } catch(e) {
    console.error('saveIngredientGroupDetailsModal failed:', e);
  }
}
function getIngredientGroupSearchText(group){
  if(!group) return '';
  const products = getGroupProducts(group.id);
  const family = getGroupIngredientFamily(group);
  return [
    group.name,
    group.cat,
    CAT[group.cat],
    group.family,
    family?.name,
    ...(family?.aliases || []),
    getGroupHierarchyText(group),
    ...(group.aliases || []),
    ...products.flatMap(p => [p.name, p.brand])
  ].filter(Boolean).join(' ').toLowerCase();
}
function findIngredientGroupsByText(query, excludeGroupId = ''){
  const variants = getSearchVariants(query || '');
  if(!variants.length) return [];
  return (state.ingredientGroups || [])
    .filter(g => g.id !== excludeGroupId)
    .map(g => ({ group:g, text:getIngredientGroupSearchText(g), products:getGroupProducts(g.id) }))
    .filter(row => variants.some(v => row.text.includes(v)))
    .sort((a,b) => {
      const qa = variants.some(v => canonicalGroupKey(a.group.name) === canonicalGroupKey(v)) ? 0 : 1;
      const qb = variants.some(v => canonicalGroupKey(b.group.name) === canonicalGroupKey(v)) ? 0 : 1;
      return qa - qb || a.group.name.localeCompare(b.group.name);
    });
}
function updateRecipeIngredientGroupIds(oldGroupId, newGroupId){
  (state.recipes || []).forEach(recipe => {
    [recipe.ingredients, recipe.enhanced?.ingredients].forEach(list => {
      (list || []).forEach(ing => {
        if(ing.groupId === oldGroupId) {
          ing.groupId = newGroupId;
          const product = resolveProductForIngredient(ing).product;
          if(product) ing.bankId = product.id;
        }
      });
    });
  });
}
function mergeIngredientGroups(sourceGroupId, targetGroupId){
  if(sourceGroupId === targetGroupId) return false;
  const source = getIngredientGroup(sourceGroupId);
  const target = getIngredientGroup(targetGroupId);
  if(!source || !target) return false;
  if(!Array.isArray(target.aliases)) target.aliases = [];
  [source.name, ...(source.aliases || [])].filter(Boolean).forEach(alias => {
    if(!target.aliases.some(a => canonicalGroupKey(a) === canonicalGroupKey(alias))) target.aliases.push(alias);
  });
  const movedProducts = getGroupProducts(source.id);
  movedProducts.forEach(product => ensureProductAssignedToGroup(product, target.name, target.id));
  refreshAutoDefaultProductForGroup(target.id);
  if(!target.cat || target.cat === 'other') target.cat = source.cat || target.cat || 'other';
  if(!target.family) target.family = source.family || inferIngredientFamilyFromText(target.name);
  movedProducts.forEach(product => syncProductHierarchyCategory(product, target, target.cat || product.cat));
  updateRecipeIngredientGroupIds(source.id, target.id);
  state.ingredientGroups = (state.ingredientGroups || []).filter(g => g.id !== source.id);
  movedProducts.forEach(product => refreshProductGroupAndRecipes(product.id));
  saveState();
  renderIngredientBank();
  renderBank();
  renderVault();
  return true;
}
function mergeIngredientGroupIntoFamily(sourceGroupId, targetFamilyId){
  const source = getIngredientGroup(sourceGroupId);
  const family = getIngredientFamily(targetFamilyId);
  if(!source || !family) return false;
  let targetGroup = getIngredientGroup(family.defaultTypeId) || getFamilyGroups(family.id)[0] || null;
  if(targetGroup && targetGroup.id !== source.id){
    ingredientSubTypesOpenIds.add(family.id);
    return mergeIngredientGroups(source.id, targetGroup.id);
  }
  const oldFamily = getGroupIngredientFamily(source);
  if(oldFamily) {
    oldFamily.typeIds = (oldFamily.typeIds || []).filter(id => id !== source.id);
    if(oldFamily.defaultTypeId === source.id) oldFamily.defaultTypeId = oldFamily.typeIds[0] || '';
  }
  source.ingredientId = family.id;
  source.family = family.name;
  source.cat = family.cat || source.cat || 'other';
  if(!Array.isArray(family.typeIds)) family.typeIds = [];
  if(!family.typeIds.includes(source.id)) family.typeIds.push(source.id);
  if(!family.defaultTypeId) family.defaultTypeId = source.id;
  getGroupProducts(source.id).forEach(product => { product.cat = source.cat; });
  ingredientSubTypesOpenIds.add(family.id);
  saveState(true);
  refreshHierarchyViews();
  return true;
}
function mergeIngredientFamilyIntoGroup(sourceFamilyId, targetGroupId){
  const source = getIngredientFamily(sourceFamilyId);
  const target = getIngredientGroup(targetGroupId);
  if(!source || !target) return false;
  const sourceGroups = getFamilyGroups(source.id).filter(group => group.id !== target.id);
  if(!sourceGroups.length) return false;
  sourceGroups.forEach(group => mergeIngredientGroups(group.id, target.id));
  const remaining = getFamilyGroups(source.id);
  if(!remaining.length) state.ingredientFamilies = (state.ingredientFamilies || []).filter(f => f.id !== source.id);
  const targetFamily = getGroupIngredientFamily(target);
  if(targetFamily) ingredientSubTypesOpenIds.add(targetFamily.id);
  saveState(true);
  refreshHierarchyViews();
  return true;
}
let ingredientGroupMergeSourceId = null;
let ingredientGroupMergeTargetId = null;
let ingredientGroupMergeTargetKind = 'group';
function ensureIngredientGroupMergeModal(){
  let wrap = document.getElementById('ingredient-group-merge-wrap');
  if(wrap) wrap.remove();
  wrap = document.createElement('div');
  wrap.id = 'ingredient-group-merge-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '380';
  wrap.innerHTML = `
    <div class="modal" style="max-width:620px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 style="margin:0">Merge sub-types</h3>
        <button class="btn sm ghost" onclick="closeIngredientGroupMergeModal()">Close</button>
      </div>
      <div id="ingredient-group-merge-source" style="font-size:12px;color:var(--text2);margin-bottom:12px"></div>
      <div class="field">
        <label>Search target ingredient or sub-type</label>
        <input type="search" id="ingredient-group-merge-search" placeholder="Search category, ingredient, type, alias, product, or brand" oninput="renderIngredientGroupMergeOptions(this.value)">
      </div>
      <div id="ingredient-group-merge-options" style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface);margin-bottom:12px"></div>
      <div id="ingredient-group-merge-selection" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px"></div>
      <div class="btn-row">
        <button class="btn primary" id="ingredient-group-merge-confirm" onclick="confirmIngredientGroupMerge()" disabled>Merge</button>
        <button class="btn ghost" onclick="closeIngredientGroupMergeModal()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function openIngredientGroupMergeModal(sourceGroupId){
  const source = getIngredientGroup(sourceGroupId);
  if(!source) return;
  ingredientGroupMergeSourceId = source.id;
  ingredientGroupMergeTargetId = null;
  const wrap = ensureIngredientGroupMergeModal();
  const sourceProducts = getGroupProducts(source.id);
  document.getElementById('ingredient-group-merge-source').innerHTML = `
    <strong>Merging from:</strong> ${ppEscapeHtml(getGroupTypeName(source))}
    <span class="tag" style="margin-left:6px">${sourceProducts.length} product${sourceProducts.length===1?'':'s'}</span>
    ${(source.aliases || []).length ? `<div style="margin-top:4px"><strong>Aliases:</strong> ${ppEscapeHtml((source.aliases || []).join(', '))}</div>` : ''}
  `;
  const search = document.getElementById('ingredient-group-merge-search');
  if(search) search.value = '';
  const mergeSel = document.getElementById('ingredient-group-merge-selection');
  if(mergeSel) mergeSel.style.display = 'none';
  const confirmBtn = document.getElementById('ingredient-group-merge-confirm');
  if(confirmBtn) confirmBtn.disabled = true;
  renderIngredientGroupMergeOptions('');
  wrap.classList.add('open');
  setTimeout(() => search.focus(), 0);
}
function closeIngredientGroupMergeModal(){
  const wrap = document.getElementById('ingredient-group-merge-wrap');
  if(wrap) wrap.classList.remove('open');
  ingredientGroupMergeSourceId = null;
  ingredientGroupMergeTargetId = null;
  ingredientGroupMergeTargetKind = 'group';
  ingredientFamilyMergeTargetKind = 'family';
}
function renderIngredientGroupMergeOptions(query){
  const listEl = document.getElementById('ingredient-group-merge-options');
  if(!listEl) return;
  ensureIngredientGroups();
  const q = (query || '').trim();
  let matches;
  if (q) { matches = findIngredientGroupsByText(q, ingredientGroupMergeSourceId); } else {
    matches = (state.ingredientGroups || [])
      .filter(g => g.id !== ingredientGroupMergeSourceId)
      .map(g => ({ group:g, text:getIngredientGroupSearchText(g), products:getGroupProducts(g.id) }))
      .sort((a,b) => a.group.name.localeCompare(b.group.name));
  }
  matches = matches.slice(0, 40);
  const familyRows = (state.ingredientFamilies || [])
    .filter(f => {
      const source = getIngredientGroup(ingredientGroupMergeSourceId);
      if(source && f.id === source.ingredientId) return false;
      if(!q) return true;
      return getSearchVariants(q).some(v => [f.name, CAT[f.cat], f.cat, ...(f.aliases || [])].filter(Boolean).join(' ').toLowerCase().includes(v));
    })
    .sort((a,b)=>(a.name || '').localeCompare(b.name || ''))
    .slice(0,20);
  if(!matches.length && !familyRows.length){
    listEl.innerHTML = '<div style="padding:12px;color:var(--text2);font-size:12px">No matching types or ingredients found.</div>';
    return;
  }
  const typeHtml = matches.length ? `<div style="padding:8px 10px;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;background:var(--surface2)">Sub-types</div>` + matches.map(row => {
    const g = row.group;
    const defaultProduct = getProduct(g.defaultProductId) || row.products[0] || null;
    const aliases = (g.aliases || []).slice(0, 4).join(', ');
    const products = row.products.slice(0, 4).map(p => p.name).join(', ');
    return `
      <button type="button" class="ingredient-group-merge-option" data-id="${ppEscapeHtml(g.id)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <strong style="font-size:13px">${ppEscapeHtml(getGroupTypeName(g))}</strong>
          <span class="tag">${row.products.length} product${row.products.length===1?'':'s'}</span>
          <span class="tag">${CAT[g.cat] || g.cat || 'Other'}</span>
          <span class="tag">${ppEscapeHtml(getGroupIngredientName(g))}</span>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">${ppEscapeHtml(getGroupHierarchyText(g))}</div>
        ${defaultProduct ? `<div style="font-size:11px;color:var(--text2);margin-top:3px"><strong>Default:</strong> ${ppEscapeHtml(defaultProduct.name)}${defaultProduct.brand && defaultProduct.brand !== 'Generic' ? ` (${ppEscapeHtml(defaultProduct.brand)})` : ''}</div>` : ''}
        ${aliases ? `<div style="font-size:11px;color:var(--text2);margin-top:3px"><strong>Aliases:</strong> ${ppEscapeHtml(aliases)}</div>` : ''}
        ${products ? `<div style="font-size:11px;color:var(--text2);margin-top:3px"><strong>Products:</strong> ${ppEscapeHtml(products)}</div>` : ''}
      </button>`;
  }).join('') : '';
  const familyHtml = familyRows.length ? `<div style="padding:8px 10px;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;background:var(--surface2)">Ingredients</div>` + familyRows.map(f => `<button type="button" class="ingredient-group-merge-option" data-kind="family" data-id="${ppEscapeAttr(f.id)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)">
    <strong style="font-size:13px">${ppEscapeHtml(f.name)}</strong>
    <span class="tag" style="margin-left:6px">${ppEscapeHtml(CAT[f.cat] || f.cat || 'Other')}</span>
    <span class="tag">${(f.typeIds || []).length} sub-type${(f.typeIds || []).length===1?'':'s'}</span>
    <div style="font-size:11px;color:var(--text2);margin-top:3px">Merge this sub-type into the ingredient's default sub-type, or move it there if no default exists.</div>
  </button>`).join('') : '';
  listEl.innerHTML = typeHtml + familyHtml;
  listEl.querySelectorAll('.ingredient-group-merge-option').forEach(btn => {
    btn.onclick = () => btn.dataset.kind === 'family' ? selectIngredientGroupMergeFamilyTarget(btn.dataset.id) : selectIngredientGroupMergeTarget(btn.dataset.id);
    btn.onmouseenter = () => btn.style.background = 'var(--surface2)';
    btn.onmouseleave = () => {
      btn.style.background = btn.dataset.id === ingredientGroupMergeTargetId ? 'var(--green-bg)' : 'var(--surface)';
    };
  });
}
function selectIngredientGroupMergeTarget(targetGroupId){
  const source = getIngredientGroup(ingredientGroupMergeSourceId);
  const target = getIngredientGroup(targetGroupId);
  if(!source || !target || source.id === target.id) return;
  ingredientGroupMergeTargetId = target.id;
  ingredientGroupMergeTargetKind = 'group';
  const movedProducts = getGroupProducts(source.id);
  const targetProducts = getGroupProducts(target.id);
  const selection = document.getElementById('ingredient-group-merge-selection');
  selection.innerHTML = `
    <div style="font-weight:700;margin-bottom:5px">Ready to merge</div>
    <div><strong>${ppEscapeHtml(getGroupTypeName(source))}</strong> will be merged into <strong>${ppEscapeHtml(getGroupTypeName(target))}</strong>.</div>
    <div style="color:var(--text2);margin-top:4px">${movedProducts.length} product${movedProducts.length===1?'':'s'} and ${(source.aliases || []).length + 1} alias/name value${((source.aliases || []).length + 1)===1?'':'s'} will move. The target currently has ${targetProducts.length} product${targetProducts.length===1?'':'s'}.</div>
    <div style="color:var(--text2);margin-top:4px">Recipe mappings using ${ppEscapeHtml(getGroupTypeName(source))} will be updated to ${ppEscapeHtml(getGroupTypeName(target))}.</div>
  `;
  selection.style.display = 'block';
  document.getElementById('ingredient-group-merge-confirm').disabled = false;
  document.querySelectorAll('.ingredient-group-merge-option').forEach(btn => {
    btn.style.background = btn.dataset.id === target.id ? 'var(--green-bg)' : 'var(--surface)';
  });
}
function selectIngredientGroupMergeFamilyTarget(targetFamilyId){
  const source = getIngredientGroup(ingredientGroupMergeSourceId);
  const target = getIngredientFamily(targetFamilyId);
  if(!source || !target) return;
  ingredientGroupMergeTargetId = target.id;
  ingredientGroupMergeTargetKind = 'family';
  const selection = document.getElementById('ingredient-group-merge-selection');
  const targetGroups = getFamilyGroups(target.id);
  selection.innerHTML = `
    <div style="font-weight:700;margin-bottom:5px">Ready to merge into ingredient</div>
    <div><strong>${ppEscapeHtml(getGroupTypeName(source))}</strong> will merge into <strong>${ppEscapeHtml(target.name)}</strong>.</div>
    <div style="color:var(--text2);margin-top:4px">${targetGroups.length ? "It will merge into that ingredient's default sub-type." : 'The sub-type will move under that ingredient because it has no sub-types yet.'}</div>
  `;
  selection.style.display = 'block';
  document.getElementById('ingredient-group-merge-confirm').disabled = false;
}
function confirmIngredientGroupMerge(){
  if(!ingredientGroupMergeSourceId || !ingredientGroupMergeTargetId) return;
  const source = getIngredientGroup(ingredientGroupMergeSourceId);
  const targetName = ingredientGroupMergeTargetKind === 'family'
    ? getIngredientFamily(ingredientGroupMergeTargetId)?.name
    : getGroupTypeName(getIngredientGroup(ingredientGroupMergeTargetId) || {});
  runWithRecoveryPoint(`Before merging sub-type ${getGroupTypeName(source || {})} into ${targetName || 'another sub-type'}`, applyIngredientGroupMerge);
}
function applyIngredientGroupMerge(){
  if(!ingredientGroupMergeSourceId || !ingredientGroupMergeTargetId) return;
  const merged = ingredientGroupMergeTargetKind === 'family'
    ? mergeIngredientGroupIntoFamily(ingredientGroupMergeSourceId, ingredientGroupMergeTargetId)
    : mergeIngredientGroups(ingredientGroupMergeSourceId, ingredientGroupMergeTargetId);
  if(merged) closeIngredientGroupMergeModal();
}
function mergeIngredientGroupPrompt(sourceGroupId) { openIngredientGroupMergeModal(sourceGroupId); }
let deleteIngredientGroupId = null;
function getIngredientGroupRecipeUsage(groupId){
  const rows = [];
  (state.recipes || []).forEach(recipe => {
    (recipe.ingredients || []).forEach(ing => {
      if(getRecipeIngredientGroupId(ing) === groupId) rows.push(recipe.name);
    });
    (recipe.enhanced?.ingredients || []).forEach(ing => {
      if(getRecipeIngredientGroupId(ing) === groupId) rows.push(recipe.name + ' (Enhanced)');
    });
  });
  return [...new Set(rows)];
}
function ensureDeleteIngredientGroupModal(){
  let wrap = document.getElementById('delete-ingredient-group-wrap');
  if(wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'delete-ingredient-group-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '430';
  wrap.innerHTML = `
    <div class="modal" style="max-width:560px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 style="margin:0">Delete type?</h3>
        <button class="btn sm ghost" onclick="closeDeleteIngredientGroupModal()">Close</button>
      </div>
      <div id="delete-ingredient-group-copy" style="font-size:13px;color:var(--text2);line-height:1.45;margin-bottom:14px"></div>
      <div class="btn-row" id="delete-ingredient-group-actions"></div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function deleteIngredientGroupPrompt(groupId){
  const group = getIngredientGroup(groupId);
  if(!group) return;
  deleteIngredientGroupId = group.id;
  const wrap = ensureDeleteIngredientGroupModal();
  const products = getGroupProducts(group.id);
  const recipeUses = getIngredientGroupRecipeUsage(group.id);
  const copy = document.getElementById('delete-ingredient-group-copy');
  const actions = document.getElementById('delete-ingredient-group-actions');
  if(recipeUses.length){
    copy.innerHTML = `
      <strong>${ppEscapeHtml(getGroupTypeName(group))}</strong> is still used by ${recipeUses.length} recipe${recipeUses.length===1?'':'s'}.
      Merge it into another type before deleting it.
      <div style="margin-top:8px;color:var(--text3)">${recipeUses.slice(0,6).map(ppEscapeHtml).join(' | ')}${recipeUses.length>6?' | ...':''}</div>`;
    actions.innerHTML = `
      <button class="btn primary" onclick="closeDeleteIngredientGroupModal(); mergeIngredientGroupPrompt('${ppEscapeHtml(group.id)}')">Merge instead</button>
      <button class="btn ghost" onclick="closeDeleteIngredientGroupModal()">Cancel</button>`;
  } else {
    copy.innerHTML = `
      Delete <strong>${ppEscapeHtml(group.name)}</strong> from the Ingredient Bank?
      ${products.length ? `<div style="margin-top:8px">Its ${products.length} linked product${products.length===1?'':'s'} will stay in Product Bank and be split into their own types.</div>` : ''}`;
    actions.innerHTML = `
      <button class="btn danger" onclick="confirmDeleteIngredientGroup()">Delete type</button>
      <button class="btn ghost" onclick="closeDeleteIngredientGroupModal()">Cancel</button>`;
  }
  wrap.classList.add('open');
}
function closeDeleteIngredientGroupModal(){
  const wrap = document.getElementById('delete-ingredient-group-wrap');
  if(wrap) wrap.classList.remove('open');
  deleteIngredientGroupId = null;
}
function confirmDeleteIngredientGroup(){
  const group = getIngredientGroup(deleteIngredientGroupId);
  if(!group) return;
  if(getIngredientGroupRecipeUsage(group.id).length) return;
  runWithRecoveryPoint(`Before deleting sub-type ${getGroupTypeName(group)}`, () => applyDeleteIngredientGroup(group.id));
}
function applyDeleteIngredientGroup(groupId){
  const group = getIngredientGroup(groupId);
  if(!group) return;
  const products = getGroupProducts(group.id);
  state.ingredientGroups = (state.ingredientGroups || []).filter(g => g.id !== group.id);
  products.forEach(product => {
    product.groupId = '';
    refreshProductGroupAndRecipes(product.id);
  });
  closeDeleteIngredientGroupModal();
  refreshHierarchyViews();
}
function setFamilyFilter(f){
  activeFamily = f === 'no-family' ? 'no-ingredient' : (f || 'all');
  productBankFamilySearchText = activeFamily === 'all' ? '' : getProductBankFamilyFilterLabel(activeFamily);
  renderBank();
}
function setCat(c){
  activeCat = c || 'all';
  renderBank();
}
function showParseIng(){
  hideLegacyCategoryAndMeatFields();
  const parsePanel = document.getElementById('parse-panel');
  if(parsePanel) parsePanel.style.display='block';
  const manualIngPanel = document.getElementById('manual-ing-panel');
  if(manualIngPanel) manualIngPanel.style.display='none';
  const tescoWrap = document.getElementById('tesco-modal-wrap');
  if(tescoWrap) tescoWrap.classList.remove('open');
  ['pp-name','pp-brand','pp-text','pp-price','pp-pack'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
  });
  if(document.getElementById('pp-cat')) document.getElementById('pp-cat').value = 'other';
  syncCategorySearchInput('pp-cat');
  if(document.getElementById('pp-storage')) document.getElementById('pp-storage').value = '';
  if(document.getElementById('pp-pack-unit')) document.getElementById('pp-pack-unit').value = 'qty';
  if(document.getElementById('pp-item-weight')) document.getElementById('pp-item-weight').value = '';
}
function showTescoImportReviewModal(productData = {}, targetSubtype = null) {
  const context = {
    type: 'manualAdd',
    groupId: targetSubtype || productData.groupId || productData.subTypeId || null,
    name: productData.name || '',
    ...productData
  };
  showTescoImport(context);
  if (document.getElementById('tesco-preview')) document.getElementById('tesco-preview').style.display = 'block';
  if (document.getElementById('tesco-diagnostics-box')) document.getElementById('tesco-diagnostics-box').style.display = 'none';
  if (productData.name && document.getElementById('tp-name')) document.getElementById('tp-name').value = productData.name;
  if (productData.brand && document.getElementById('tp-brand')) document.getElementById('tp-brand').value = productData.brand;
  if (productData.cat && document.getElementById('import-category')) document.getElementById('import-category').value = productData.cat;
  if (productData.storage && document.getElementById('import-storage')) document.getElementById('import-storage').value = productData.storage;
  if (productData.drainedWeight !== undefined && document.getElementById('import-usable-weight')) document.getElementById('import-usable-weight').value = productData.drainedWeight;
  if (productData.fibre !== undefined && document.getElementById('import-fibre')) document.getElementById('import-fibre').value = productData.fibre;
  if (productData.notes && document.getElementById('import-notes')) document.getElementById('import-notes').value = productData.notes;
  if (productData.storage && document.getElementById('tp-storage')) document.getElementById('tp-storage').value = productData.storage;
  if (productData.price !== undefined && document.getElementById('tp-price')) document.getElementById('tp-price').value = productData.price;
  if (productData.packSize !== undefined && document.getElementById('tp-pack')) document.getElementById('tp-pack').value = productData.packSize;
  if (productData.packUnit && document.getElementById('tp-pack-unit')) setPackUnitEditorValue('tp-pack-unit', productData.packUnit);
  if (productData.cal !== undefined && document.getElementById('tp-cal')) document.getElementById('tp-cal').value = productData.cal;
  if (productData.prot !== undefined && document.getElementById('tp-prot')) document.getElementById('tp-prot').value = productData.prot;
  if (productData.carb !== undefined && document.getElementById('tp-carb')) document.getElementById('tp-carb').value = productData.carb;
  if (productData.fat !== undefined && document.getElementById('tp-fat')) document.getElementById('tp-fat').value = productData.fat;
  if (productData.fibre !== undefined && document.getElementById('tp-fibre')) document.getElementById('tp-fibre').value = productData.fibre;
  if (productData.drainedWeight !== undefined && document.getElementById('tp-drained-weight')) document.getElementById('tp-drained-weight').value = productData.drainedWeight;
  if (productData.drainedWeightUnit && document.getElementById('tp-drained-weight-unit')) document.getElementById('tp-drained-weight-unit').value = productData.drainedWeightUnit;
  if (productData.itemWeight !== undefined && document.getElementById('tp-item-weight')) document.getElementById('tp-item-weight').value = productData.itemWeight;
  if (productData.itemWeightUnit && document.getElementById('tp-item-weight-unit')) document.getElementById('tp-item-weight-unit').value = productData.itemWeightUnit;
  if (productData.notes && document.getElementById('tp-notes')) document.getElementById('tp-notes').value = productData.notes;
}
window.showTescoImportReviewModal = showTescoImportReviewModal;
function showTescoImport(context = null){
  hideLegacyCategoryAndMeatFields();
  window.pendingTescoMapping = context;
  const manualAddMode = context?.type === 'manualAdd';
  const pasteEl = document.getElementById('tesco-paste');
  if(pasteEl) pasteEl.value='';
  const msgEl = document.getElementById('tesco-msg');
  if(msgEl) msgEl.innerHTML='';
  const previewEl = document.getElementById('tesco-preview');
  if(previewEl) previewEl.style.display = manualAddMode ? 'block' : 'none';
  const diagnosticsBox = document.getElementById('tesco-diagnostics-box');
  if(diagnosticsBox) diagnosticsBox.style.display = 'none';
  const importTitle = document.getElementById('tesco-import-title');
  if(importTitle) importTitle.textContent = manualAddMode ? 'Add product' : 'Import Tesco product';
  const detailsHeading = document.getElementById('tesco-details-heading');
  if(detailsHeading) detailsHeading.textContent = manualAddMode ? 'Product details' : 'Review extracted details';
  const saveBtn = document.getElementById('tesco-save-btn');
  if(saveBtn) saveBtn.textContent = manualAddMode ? 'Add product' : 'Save to Product Bank';
  ['tesco-bookmarklet-panel','tesco-paste-panel','tesco-extract-actions'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.display = manualAddMode ? 'none' : '';
  });
  ['tp-name','tp-brand','tp-cal','tp-fat','tp-carb','tp-fibre','tp-prot','tp-price','tp-pack','tp-notes','tp-item-weight','tp-drained-weight'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
  });
  if(context?.name && document.getElementById('tp-name')) {
    document.getElementById('tp-name').value = context.name;
  }
  let initialCat = 'other';
  if(context?.groupId) {
    const linkedGrp = getIngredientGroup(context.groupId);
    if(linkedGrp?.cat) initialCat = linkedGrp.cat;
  }
  if(document.getElementById('tp-cat')) document.getElementById('tp-cat').value = initialCat;
  syncCategorySearchInput('tp-cat');
  if(document.getElementById('tp-storage')) document.getElementById('tp-storage').value = '';
  setPackUnitEditorValue('tp-pack-unit','g',{allowLegacyCount:false});
  if(document.getElementById('tp-item-weight-unit')) document.getElementById('tp-item-weight-unit').value = 'g';
  if(document.getElementById('tp-drained-weight-unit')) document.getElementById('tp-drained-weight-unit').value = 'g';
  const searchHint = document.getElementById('tesco-search-hint');
  if(!manualAddMode && context && context.name) {
      if(searchHint) searchHint.style.display = 'block';
      const termEl = document.getElementById('tesco-search-term');
      if(termEl) termEl.innerText = context.name;
      const linkEl = document.getElementById('tesco-search-link');
      if(linkEl) linkEl.href = `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(context.name)}`;
  } else { if(searchHint) searchHint.style.display = 'none'; }
  const modalWrap = document.getElementById('tesco-modal-wrap');
  if(modalWrap) modalWrap.classList.add('open');
}
function closeTescoModal() {
  document.getElementById('tesco-modal-wrap').classList.remove('open');
  window.pendingTescoMapping = null;
}
function applyTescoImportToExistingIngredient(target, data){
  if(!target || !data) return;
  target.name = data.name || target.name;
  target.brand = data.brand || target.brand || '';
  target.cat = data.cat || target.cat || 'other';
  target.storage = data.storage || target.storage || '';
  target.cal = data.cal;
  target.fat = data.fat;
  target.carb = data.carb;
  target.fibre = data.fibre;
  target.prot = data.prot;
  target.price = data.price;
  target.packSize = data.packSize;
  target.packUnit = data.packUnit || 'g';
  target.itemWeight = data.itemWeight || target.itemWeight || null;
  target.itemWeightUnit = data.itemWeightUnit || target.itemWeightUnit || 'g';
  target.drainedWeight = data.drainedWeight || target.drainedWeight || null;
  target.drainedWeightUnit = data.drainedWeightUnit || target.drainedWeightUnit || 'g';
  target.notes = data.notes || target.notes || '';
  target.sourceUrl = data.sourceUrl || target.sourceUrl || null;
  target.itemCount = data.itemCount || target.itemCount || null;
  if(data.packSize && data.price){
    if(!target.packOptions) target.packOptions = [];
    const exists = target.packOptions.some(po =>
      (+po.packSize || 0) === (+data.packSize || 0) &&
      (po.packUnit || 'g') === (data.packUnit || 'g') &&
      (+po.price || 0) === (+data.price || 0)
    );
    if(!exists){
      target.packOptions.push({
        packSize: data.packSize,
        packUnit: data.packUnit || 'g',
        price: data.price,
        itemWeight: data.itemWeight || null,
        itemWeightUnit: data.itemWeightUnit || 'g',
        drainedWeight: data.drainedWeight || null,
        drainedWeightUnit: data.drainedWeightUnit || 'g',
        sourceUrl: data.sourceUrl || null,
        itemCount: data.itemCount || null
      });
    }
  }
}
function openTescoImportFromMap(idx, name) {
    showTescoImport({ type: 'map', idx, name });
}
function openTescoImportFromSubst() {
    const name = document.getElementById('subst-search').value.trim();
    showTescoImport({ type: 'subst', name });
}
function getTescoItemWeightGuess(data, name){
    if (window.TescoImportService?.guessItemWeight) { return window.TescoImportService.guessItemWeight(data, name); }
    if(!data) return '';
    const count = +data.itemCount || 0;
    const packSize = +data.drainedWeight || +data.packSize || 0;
    const explicit = +data.itemWeight || 0;
    const countable = isLikelyCountableIngredientName(name || data.name || '');
    if(explicit > 0 && countable) return explicit;
    if(count > 1 && packSize > 0 && countable) return Math.round((packSize / count) * 10) / 10;
    if(count === 1 && explicit > 0 && countable) return explicit;
    return '';
}
function extractTescoProduct() {
    window.__lastTescoImport = null;
    const text = document.getElementById('tesco-paste')?.value?.trim() || '';
    if (!text) {
        showMsg('tesco-msg', 'Please paste data first.', 'error');
        return;
    }
    const parser = window.TescoImportService?.parseTescoProduct;
    let res;
    if (typeof parser === 'function') { res = parser(text); } else {
        try {
            const parsed = JSON.parse(text);
            res = { success: true, data: { raw: parsed, name: parsed.name || '', brand: parsed.brand || '', price: parsed.price || '', packSize: parsed.packSize || '', packUnit: parsed.packUnit || 'g', cal: parsed.cal || 0, prot: parsed.prot || 0, carb: parsed.carb || 0, fat: parsed.fat || 0, fibre: parsed.fibre || 0, sourceValues: {}, parsedValues: parsed, normalisedValues: parsed }, warnings: [] };
        } catch (e) {
            res = { success: false, error: 'Invalid JSON format. Please use the bookmarklet to copy the correct data from Tesco.' };
        }
    }
    if (!res.success) {
        showMsg('tesco-msg', res.error || 'Failed to parse Tesco product.', 'error');
        return;
    }
    const { data: p, warnings } = res;
    window.__lastTescoImport = p.raw;
    const sv = p.sourceValues || {};
    const pv = p.parsedValues || {};
    const normalisedPv = p.normalisedValues || p;
    let diagHtml = `
    <div style="background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:14px; margin-bottom:14px;">
        <h3 style="margin-top:0; border-bottom:1px solid var(--border); padding-bottom:6px; font-size:14px;">Tesco Import Diagnostics</h3>
        <div class="grid2" style="margin-top:10px;">
            <div>
                <h4 style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--text2); margin:0 0 6px;">Product Extraction</h4>
                <div style="font-size:12px; margin-bottom:4px;"><strong>Name:</strong> ${p.name || '-'}</div>
                <div style="font-size:12px; margin-bottom:4px;"><strong>Brand:</strong> ${p.brand || '-'}</div>
                <div style="font-size:12px; margin-bottom:4px;"><strong>Price:</strong> £${p.price || '-'}</div>
                <div style="font-size:12px; margin-bottom:4px;"><strong>Pack Size:</strong> ${p.packSize || '-'}${p.packUnit || ''}</div>
                <div style="font-size:12px; margin-bottom:4px;"><strong>Item Weight:</strong> ${p.itemWeight || '-'}g</div>
                <div style="font-size:12px; margin-bottom:4px;"><strong>Storage:</strong> ${p.storage || '-'}</div>
            </div>
            <div>
                <h4 style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--text2); margin:0 0 6px;">Nutrition Extraction</h4>
                <div style="font-size:12px; margin-bottom:6px;"><strong>Source:</strong> <span class="badge badge-purple">${p.nsrc || 'Import'}</span></div>
                <div style="font-size:12px; margin-bottom:4px;"><strong>Basis:</strong> <span class="badge badge-gray">${p.nbasis || 'unknown'}</span></div>
                <div style="font-size:12px; margin-bottom:4px; margin-top:8px;"><strong>Breadcrumbs:</strong></div>
                <div style="font-size:11px; color:var(--text3); word-break: break-all;">${p.breadcrumbs || 'Not found'}</div>
            </div>
        </div>
        <h4 style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--text2); margin:14px 0 6px; border-top:1px solid var(--border); padding-top:10px;">Trace Pipeline</h4>
        <div style="overflow-x:auto;">
            <table style="width:100%; font-size:12px; text-align:left; border-collapse:collapse; margin-bottom:10px;">
                <thead>
                    <tr style="border-bottom:1px solid var(--border-strong);">
                        <th style="padding:6px 4px; color:var(--text2);">Nutrient</th>
                        <th style="padding:6px 4px; color:var(--text2);">Source Value</th>
                        <th style="padding:6px 4px; color:var(--text2);">Parsed Value</th>
                        <th style="padding:6px 4px; color:var(--text2);">Saved Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:6px 4px; font-weight:500;">Calories</td>
                        <td style="padding:6px 4px;">${sv.cal ?? '-'}</td>
                        <td style="padding:6px 4px;">${pv.cal ?? '0'}</td>
                        <td style="padding:6px 4px;">${normalisedPv.cal ?? '0'}</td>
                    </tr>
                    <tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:6px 4px; font-weight:500;">Protein</td>
                        <td style="padding:6px 4px;">${sv.prot ?? '-'}</td>
                        <td style="padding:6px 4px;">${pv.prot ?? '0'}</td>
                        <td style="padding:6px 4px;">${normalisedPv.prot ?? '0'}</td>
                    </tr>
                    <tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:6px 4px; font-weight:500;">Carbs</td>
                        <td style="padding:6px 4px;">${sv.carb ?? '-'}</td>
                        <td style="padding:6px 4px;">${pv.carb ?? '0'}</td>
                        <td style="padding:6px 4px;">${normalisedPv.carb ?? '0'}</td>
                    </tr>
                    <tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:6px 4px; font-weight:500;">Fat</td>
                        <td style="padding:6px 4px;">${sv.fat ?? '-'}</td>
                        <td style="padding:6px 4px;">${pv.fat ?? '0'}</td>
                        <td style="padding:6px 4px;">${normalisedPv.fat ?? '0'}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px 4px; font-weight:500;">Fibre</td>
                        <td style="padding:6px 4px;">${sv.fibre ?? '-'}</td>
                        <td style="padding:6px 4px;">${pv.fibre ?? '0'}</td>
                        <td style="padding:6px 4px;">${normalisedPv.fibre ?? '0'}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        ${warnings.length > 0 
            ? `<div class="msg error" style="margin-top:8px;"><strong>Import Validation Warnings:</strong><ul style="margin:4px 0 0 20px; font-size:12px;">${warnings.map(w => `<li>${w}</li>`).join('')}</ul></div>` 
            : '<div class="msg success" style="margin-top:8px; font-size:12px;">Data validation passed.</div>'}
    </div>`;
    let dBox = document.getElementById('tesco-diagnostics-box');
    if (!dBox) {
        dBox = document.createElement('div');
        dBox.id = 'tesco-diagnostics-box';
        const tp = document.getElementById('tesco-preview');
        if (tp) tp.insertBefore(dBox, tp.firstChild);
    }
    if (dBox) dBox.innerHTML = diagHtml;
    if(document.getElementById('tp-name')) document.getElementById('tp-name').value = p.name;
    if(document.getElementById('tp-brand')) document.getElementById('tp-brand').value = p.brand;
    if(document.getElementById('tp-price')) document.getElementById('tp-price').value = p.price || '';
    if(document.getElementById('tp-cal')) document.getElementById('tp-cal').value = normalisedPv.cal || '';
    if(document.getElementById('tp-fat')) document.getElementById('tp-fat').value = normalisedPv.fat || '';
    if(document.getElementById('tp-carb')) document.getElementById('tp-carb').value = normalisedPv.carb || '';
    if(document.getElementById('tp-fibre')) document.getElementById('tp-fibre').value = normalisedPv.fibre || '';
    if(document.getElementById('tp-prot')) document.getElementById('tp-prot').value = normalisedPv.prot || '';
    if(document.getElementById('tp-pack')) document.getElementById('tp-pack').value = p.packSize;
    setPackUnitEditorValue('tp-pack-unit', p.packUnit, {allowLegacyCount: p.packUnit === 'qty'});
    if(document.getElementById('tp-item-weight')) {
        document.getElementById('tp-item-weight').value = p.itemWeight;
    }
    if(document.getElementById('tp-item-weight-unit')) document.getElementById('tp-item-weight-unit').value = p.itemWeightUnit || 'g';
    if(document.getElementById('tp-drained-weight')) {
        document.getElementById('tp-drained-weight').value = p.drainedWeight || '';
    }
    if(document.getElementById('tp-drained-weight-unit')) document.getElementById('tp-drained-weight-unit').value = p.drainedWeightUnit || 'g';
    updatePackModelSummary('tp');
    if(document.getElementById('tp-storage')) document.getElementById('tp-storage').value = p.storage;
    if(document.getElementById('tp-cat')) document.getElementById('tp-cat').value = p.cat;
    syncCategorySearchInput('tp-cat');
    const previewEl = document.getElementById('tesco-preview');
    if (previewEl) previewEl.style.display = 'block';
    const msgEl = document.getElementById('tesco-msg');
    if (msgEl) msgEl.innerHTML = '<div class="msg success">Extracted details! Please review below before saving.</div>';
}
function finishTescoImportSelection(pendingTesco, ingredientId, ingredientName, message){
  const product = getProduct(ingredientId);
  if(product) syncProductHierarchyCategory(product, product.groupId ? getIngredientGroup(product.groupId) : null, product.cat);
  if(product && pendingTesco?.type === 'subst' && currentSubstContext.groupId) {
    ensureProductAssignedToGroup(product, getIngredientGroup(currentSubstContext.groupId)?.name || product.name, currentSubstContext.groupId);
    refreshProductGroupAndRecipes(product.id);
    saveState();
  }
  if (pendingTesco) {
      if (pendingTesco.type === 'map') {
          mappingContext.ings[pendingTesco.idx].bankId = ingredientId;
          mappingContext.ings[pendingTesco.idx].groupId = product?.groupId || "";
          renderMappingList();
      } else if (pendingTesco.type === 'subst') {
          currentSubstContext.newBankId = ingredientId;
          document.getElementById('subst-search').value = ingredientName;
          const dd = document.getElementById('subst-dropdown');
          if(dd) dd.style.display = 'none';
          document.getElementById('subst-selected').textContent = `Replacing with: ${ingredientName}`;
      } else if (pendingTesco.type === 'replace') { applyReplaceImportSelection(pendingTesco.widgetId, ingredientId, ingredientName); } else if (pendingTesco.type === 'editIng') {
          renderBank();
          editIng(ingredientId);
          showMsg('mi-msg', message || 'Updated from Tesco.', 'success');
      } else if (pendingTesco.type === 'unified') {
          const ctx = activeUnifiedMappingContext || window.activeUnifiedMappingContext || window.pendingUnifiedAddContext;
          if (ctx) {
            applyUnifiedMappingResult(ctx, {
              productId: ingredientId,
              groupId: product?.groupId || '',
              productName: ingredientName,
              brand: product?.brand || ''
            });
          }
      } else if (pendingTesco.type === 'manualAdd') {
          const ctx = activeUnifiedMappingContext || window.activeUnifiedMappingContext || window.pendingUnifiedAddContext;
          if (ctx) {
            applyUnifiedMappingResult(ctx, {
              productId: ingredientId,
              groupId: product?.groupId || '',
              productName: ingredientName,
              brand: product?.brand || ''
            });
            window.pendingUnifiedAddContext = null;
          }
          renderBank();
          renderIngredientBank();
          if(document.getElementById('view-data')?.classList.contains('active')) renderDataQuality();
          const el = document.createElement('div');
          el.className='msg success';
          el.style.marginBottom='12px';
          el.textContent=message || `"${ingredientName}" added to ingredient bank.`;
          const bankList = document.getElementById('bank-list');
          if(bankList?.parentNode) {
            bankList.parentNode.insertBefore(el,bankList);
            setTimeout(()=>el.remove(),4000);
          }
      }
      window.pendingTescoMapping = null;
  } else {
      renderBank();
      const el = document.createElement('div');
      el.className='msg success';
      el.style.marginBottom='12px';
      el.textContent=message || `"${ingredientName}" added to ingredient bank.`;
      const bankList = document.getElementById('bank-list');
      if(bankList?.parentNode) {
        bankList.parentNode.insertBefore(el,bankList);
        setTimeout(()=>el.remove(),4000);
      }
  }
}
function createTescoIngredientFromData(data){
  if (window.TescoImportService?.createTescoIngredientFromData) { return normaliseLegacyCountedPackOnSave(window.TescoImportService.createTescoIngredientFromData(data)); }
  return normaliseLegacyCountedPackOnSave({
    id:'ing'+Date.now(),
    name: data.name,
    brand: data.brand || '',
    cat: data.cat || 'other',
    storage: data.storage || '',
    cal: +data.cal || 0,
    fat: +data.fat || 0,
    carb: +data.carb || 0,
    fibre: +data.fibre || 0,
    prot: +data.prot || 0,
    price: +data.price || null,
    packSize: +data.packSize || null,
    packUnit: data.packUnit || 'g',
    itemWeight: +data.itemWeight || null,
    itemWeightUnit: data.itemWeightUnit || 'g',
    drainedWeight: +data.drainedWeight || null,
    drainedWeightUnit: data.drainedWeightUnit || 'g',
    notes: data.notes || '',
    sourceUrl: data.sourceUrl || null,
    itemCount: data.itemCount || null,
    meatSubstituteFor: null,
    updatedAt: new Date().toISOString()
  });
}
function addTescoPackVariant(match, data){
  if (window.TescoImportService?.addTescoPackVariant) { window.TescoImportService.addTescoPackVariant(match, data); } else {
    if(!match.packOptions) match.packOptions = [];
    if(match.packSize && match.price && match.packOptions.length === 0) {
      match.packOptions.push({
        packSize: match.packSize,
        packUnit: match.packUnit || 'g',
        price: match.price,
        itemWeight: match.itemWeight || null,
        itemWeightUnit: match.itemWeightUnit || 'g',
        drainedWeight: match.drainedWeight || null,
        drainedWeightUnit: match.drainedWeightUnit || 'g'
      });
    }
    match.packOptions.push(normaliseLegacyCountedPackOnSave({
      packSize: data.packSize,
      packUnit: data.packUnit || 'g',
      price: data.price,
      itemWeight: data.itemWeight || null,
      itemWeightUnit: data.itemWeightUnit || 'g',
      drainedWeight: data.drainedWeight || null,
      drainedWeightUnit: data.drainedWeightUnit || 'g',
      sourceUrl: data.sourceUrl || null,
      itemCount: data.itemCount || null
    }));
    if(data.drainedWeight) {
      match.drainedWeight = data.drainedWeight;
      match.drainedWeightUnit = data.drainedWeightUnit || 'g';
    }
    if(data.sourceUrl) match.sourceUrl = match.sourceUrl || data.sourceUrl;
    match.updatedAt = new Date().toISOString();
  }
  refreshProductGroupAndRecipes(match.id);
  saveState(true);
}
function openTescoDuplicateChoice(match, data, pendingTesco){
  let wrap = document.getElementById('tesco-duplicate-wrap');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.id = 'tesco-duplicate-wrap';
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `
      <div class="modal" style="max-width:520px">
        <h2 style="margin-top:0">Possible duplicate</h2>
        <div id="tesco-duplicate-copy" style="font-size:13px;color:var(--text2);line-height:1.45;margin-bottom:14px"></div>
        <div class="btn-row">
          <button class="btn primary" id="tesco-dup-variant-btn">Add as pack variant</button>
          <button class="btn ghost" id="tesco-dup-separate-btn">No, not a duplicate</button>
          <button class="btn ghost" id="tesco-dup-cancel-btn">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
  }
  if(wrap.parentElement !== document.body) document.body.appendChild(wrap);
  wrap.style.zIndex = '500';
  document.getElementById('tesco-duplicate-copy').innerHTML =
    `<strong>${ppEscapeHtml(data.name)}</strong> looks similar to <strong>${ppEscapeHtml(match.name)}</strong>.<br>Choose whether this Tesco item is another pack size for the existing ingredient, or a separate ingredient.`;
  document.getElementById('tesco-dup-variant-btn').onclick = () => {
    addTescoPackVariant(match, data);
    wrap.classList.remove('open');
    closeTescoModal();
    renderBank();
    finishTescoImportSelection(pendingTesco, match.id, match.name, `Added pack option to ${match.name}.`);
  };
  document.getElementById('tesco-dup-separate-btn').onclick = () => {
    const ing = createTescoIngredientFromData(data);
    state.ingredients.push(ing);
    if (pendingTesco?.type === 'subst' && currentSubstContext.groupId) { ensureProductAssignedToGroup(ing, getIngredientGroup(currentSubstContext.groupId)?.name || ing.name, currentSubstContext.groupId); } else { promptGroupForImportedProduct(ing, pendingTesco?.name || data.name || ing.name); }
    refreshProductGroupAndRecipes(ing.id);
    saveState();
    wrap.classList.remove('open');
    closeTescoModal();
    finishTescoImportSelection(pendingTesco, ing.id, ing.name, `"${ing.name}" added to ingredient bank.`);
  };
  document.getElementById('tesco-dup-cancel-btn').onclick = () => wrap.classList.remove('open');
  wrap.classList.add('open');
}
function saveTescoIngredient(categoryReady=false){
  const name = document.getElementById('tp-name').value.trim();
  if(!name) return showMsg('tesco-save-msg','Please enter a product name.','error');
  if(!categoryReady)return resolveCategoryBeforeProductSave('tp-cat',()=>saveTescoIngredient(true));
  const pendingTesco = window.pendingTescoMapping;
  const manualAddMode = pendingTesco?.type === 'manualAdd';
  const newPrice = +document.getElementById('tp-price').value||null;
  const newSize = +document.getElementById('tp-pack').value||null;
  const newUnit = document.getElementById('tp-pack-unit').value||'g';
  const newWeight = +document.getElementById('tp-item-weight').value||null;
  const newWeightUnit = document.getElementById('tp-item-weight-unit')?.value||'g';
  const explicitUsableWeight = +document.getElementById('import-usable-weight')?.value || null;
  const newDrainedWeight = explicitUsableWeight || (+document.getElementById('tp-drained-weight')?.value||null);
  const newDrainedWeightUnit = document.getElementById('tp-drained-weight-unit')?.value||'g';
  const newSourceUrl = manualAddMode ? null : (window.__lastTescoImport ? window.__lastTescoImport.url : null);
  const newItemCount = newUnit === 'qty' ? newSize : (!manualAddMode && window.__lastTescoImport ? window.__lastTescoImport.itemCount : null);
  const selectedCat = document.getElementById('import-category')?.value || document.getElementById('tp-cat')?.value || 'other';
  const selectedStorage = document.getElementById('import-storage')?.value || document.getElementById('tp-storage')?.value || '';
  const selectedFibre = +document.getElementById('import-fibre')?.value || +document.getElementById('tp-fibre')?.value || 0;
  const selectedNotes = document.getElementById('import-notes')?.value?.trim() || document.getElementById('tp-notes')?.value?.trim() || '';
  const tescoData = normaliseLegacyCountedPackOnSave({
    name,
    brand: document.getElementById('tp-brand').value.trim(),
    cat: selectedCat,
    category: selectedCat,
    storage: selectedStorage,
    cal: +document.getElementById('tp-cal').value||0,
    fat: +document.getElementById('tp-fat').value||0,
    carb: +document.getElementById('tp-carb').value||0,
    fibre: selectedFibre,
    prot: +document.getElementById('tp-prot').value||0,
    price: newPrice,
    packSize: newSize,
    packUnit: newUnit,
    itemWeight: newWeight,
    itemWeightUnit: newWeightUnit,
    drainedWeight: newDrainedWeight,
    usableWeight: newDrainedWeight,
    drainedWeightUnit: newDrainedWeightUnit,
    notes: selectedNotes,
    sourceUrl: newSourceUrl,
    itemCount: newItemCount
  });
  if(pendingTesco && pendingTesco.type === 'editIng' && pendingTesco.ingredientId){
      const target = state.ingredients.find(i => i.id === pendingTesco.ingredientId);
      if(!target) return showMsg('tesco-save-msg','Could not find the ingredient to update.','error');
      applyTescoImportToExistingIngredient(target, tescoData);
      target.updatedAt = new Date().toISOString();
      if(target.groupId) ensureProductAssignedToGroup(target, target.name, target.groupId);
      syncProductHierarchyCategory(target, target.groupId ? getIngredientGroup(target.groupId) : null, target.cat);
      refreshProductGroupAndRecipes(target.id);
      saveState(true);
      closeTescoModal();
      window.pendingTescoMapping = null;
      renderBank();
      editIng(target.id);
      showMsg('mi-msg', 'Updated this ingredient from Tesco.', 'success');
      return;
  }
  const existingMatches = (state.ingredients || []).filter(i => {
     const n1 = i.name.toLowerCase().replace(/[^a-z0-9]/g, '');
     const n2 = name.toLowerCase().replace(/[^a-z0-9]/g, '');
     return n1.length > 3 && n2.length > 3 && (n1 === n2 || n1.includes(n2) || n2.includes(n1));
  });
  if(existingMatches.length > 0 && newSize && newPrice) {
      const match = existingMatches[0];
      openTescoDuplicateChoice(match, tescoData, pendingTesco);
      return;
  }
  const ing = normaliseLegacyCountedPackOnSave({
    id:'ing'+Date.now(),
    name,
    brand: document.getElementById('tp-brand').value.trim(),
    cat: selectedCat,
    category: selectedCat,
    storage: selectedStorage,
    cal: +document.getElementById('tp-cal').value||0,
    fat: +document.getElementById('tp-fat').value||0,
    carb: +document.getElementById('tp-carb').value||0,
    fibre: selectedFibre,
    prot: +document.getElementById('tp-prot').value||0,
    price: newPrice,
    packSize: newSize,
    packUnit: newUnit,
    itemWeight: newWeight,
    itemWeightUnit: newWeightUnit,
    drainedWeight: newDrainedWeight,
    usableWeight: newDrainedWeight,
    drainedWeightUnit: newDrainedWeightUnit,
    notes: selectedNotes,
    sourceUrl: newSourceUrl,
    itemCount: newItemCount,
    meatSubstituteFor: null,
    updatedAt: new Date().toISOString()
  });
  if (typeof persistProductToBank === 'function') { persistProductToBank(ing); } else { state.ingredients.push(ing); }
  if (pendingTesco?.type === 'subst' && currentSubstContext.groupId) { ensureProductAssignedToGroup(ing, getIngredientGroup(currentSubstContext.groupId)?.name || ing.name, currentSubstContext.groupId); } else if (pendingTesco?.groupId) { ensureProductAssignedToGroup(ing, getIngredientGroup(pendingTesco.groupId)?.name || ing.name, pendingTesco.groupId); } else { promptGroupForImportedProduct(ing, pendingTesco?.name || ing.name); }
  syncProductHierarchyCategory(ing, ing.groupId ? getIngredientGroup(ing.groupId) : null, ing.cat);
  refreshPlatePlanDerivedState({changedProductIds:[ing.id],render:false});
  saveIngredient(ing);
  saveState(true);
  const newIngId = ing.id;
  closeTescoModal();
  if (pendingTesco) {
      if (pendingTesco.type === 'map') {
          const idx = pendingTesco.idx;
          mappingContext.ings[idx].bankId = newIngId;
          mappingContext.ings[idx].groupId = ing.groupId || "";
          renderMappingList();
      } else if (pendingTesco.type === 'subst') {
          currentSubstContext.newBankId = newIngId;
          const sSearch = document.getElementById('subst-search');
          if(sSearch) sSearch.value = ing.name;
          const sDrop = document.getElementById('subst-dropdown');
          if(sDrop) sDrop.style.display = 'none';
          const sSel = document.getElementById('subst-selected');
          if(sSel) sSel.textContent = `Replacing with: ${ing.name}`;
      } else if (pendingTesco.type === 'replace') { applyReplaceImportSelection(pendingTesco.widgetId, newIngId, ing.name); } else if (pendingTesco.type === 'editIng') {
          renderBank();
          editIng(newIngId);
          showMsg('mi-msg', 'Added this ingredient from Tesco.', 'success');
      } else if (pendingTesco.type === 'unified') {
          if (activeUnifiedMappingContext) {
            applyUnifiedMappingResult(activeUnifiedMappingContext, {
              productId: newIngId,
              groupId: ing.groupId || '',
              productName: ing.name,
              brand: ing.brand
            });
          }
      } else if (pendingTesco.type === 'manualAdd') {
          renderBank();
          renderIngredientBank();
          if(document.getElementById('view-data')?.classList.contains('active')) renderDataQuality();
          const el = document.createElement('div');
          el.className='msg success';
          el.style.marginBottom='12px';
          el.textContent=`"${name}" added to ingredient bank.`;
          const bankList = document.getElementById('bank-list');
          if(bankList?.parentNode) {
            bankList.parentNode.insertBefore(el,bankList);
            setTimeout(()=>el.remove(),4000);
          }
      }
      window.pendingTescoMapping = null;
  } else {
      renderBank();
      const el = document.createElement('div');
      el.className='msg success';
      el.style.marginBottom='12px';
      el.textContent=`"${name}" added to ingredient bank.`;
      const bankList = document.getElementById('bank-list');
      bankList.parentNode.insertBefore(el,bankList);
      setTimeout(()=>el.remove(),4000);
  }
}
function ensureIngredientModalDetached(){
  const panel = document.getElementById('manual-ing-panel');
  if(panel && panel.parentElement !== document.body) document.body.appendChild(panel);
  return panel;
}
function ensureIngredientTescoUpdateButton(){
  const title = document.getElementById('mi-title');
  if(!title || document.getElementById('mi-tesco-actions')) return;
  const row = document.createElement('div');
  row.id = 'mi-tesco-actions';
  row.style.cssText = 'display:flex;justify-content:flex-end;margin:-4px 0 12px;';
  row.innerHTML = '<button type="button" class="btn sm ghost" onclick="openTescoImportForIngredientEdit()">Paste/update from Tesco</button>';
  title.insertAdjacentElement('afterend', row);
}
function openTescoImportForIngredientEdit(){
  const name = document.getElementById('mi-name')?.value.trim() || '';
  showTescoImport({ type:'editIng', ingredientId: editIngId, name });
}
function isPowderOrSupplementProduct(ing){
  const text = [ing?.name, ing?.brand, ing?.cat, ing?.family, ing?.notes].filter(Boolean).join(' ').toLowerCase();
  return /protein|whey|powder|creatine|supplement|casein|isolate|mass gainer|pre workout/.test(text);
}
function updateServingConverterHint(ing){
  const hint = document.getElementById('mi-serving-hint');
  if(!hint) return;
  hint.innerHTML = '';
  hint.style.display = 'none';
}
function applyServingNutritionConverter(){
  const serving = +document.getElementById('mi-serving-size')?.value || 0;
  if(serving <= 0) return showMsg('mi-msg','Enter the serving size in grams/ml first.','error');
  const fields = [
    ['mi-serving-cal','mi-cal'],
    ['mi-serving-fat','mi-fat'],
    ['mi-serving-carb','mi-carb'],
    ['mi-serving-fibre','mi-fibre'],
    ['mi-serving-prot','mi-prot']
  ];
  fields.forEach(([fromId,toId]) => {
    const raw = document.getElementById(fromId);
    const target = document.getElementById(toId);
    if(!raw || !target || raw.value === '') return;
    const val = +raw.value;
    if(!Number.isFinite(val)) return;
    const per100 = val * 100 / serving;
    target.value = Math.round(per100 * 10) / 10;
  });
  showMsg('mi-msg','Converted serving label values to per-100g/ml values. Review, then save.','success');
  updateServingConverterHint({ name: document.getElementById('mi-name')?.value || '', cat: document.getElementById('mi-cat')?.value || '' });
}
function showAddIng(){
  editIngId = null;
  showTescoImport({ type:'manualAdd' });
}
function getIngredientPackVariantLabels(ing){
  const rows=[];
  const seen=new Set();
  const addVariant=po=>{
    if(!po)return;
    const size=po.packSize ?? po.size;
    const unit=po.packUnit || po.unit || 'g';
    const itemWeight=po.itemWeight || null;
    if(!size && !itemWeight)return;
    const key=[size,unit,itemWeight].join('|');
    if(seen.has(key))return;
    seen.add(key);
    rows.push(formatProductPackSummary({packSize:size,packUnit:unit,itemWeight,itemWeightUnit:po.itemWeightUnit||'g',drainedWeight:po.drainedWeight,drainedWeightUnit:po.drainedWeightUnit||'g'}));
  };
  addVariant(ing);
  (ing.packOptions||[]).forEach(addVariant);
  return rows;
}
function formatIngredientPackVariantLabel(po){
  if(!po) return '';
  const size = po.packSize ?? po.size;
  const unit = po.packUnit || po.unit || 'g';
  const itemWeight = po.itemWeight || null;
  let label = formatProductPackSummary({packSize:size,packUnit:unit,itemWeight,itemWeightUnit:po.itemWeightUnit||'g',drainedWeight:po.drainedWeight,drainedWeightUnit:po.drainedWeightUnit||'g'});
  if(!label && itemWeight) label = `${itemWeight}g item`;
  if(po.price) label += `${label ? ' · ' : ''}£${(+po.price).toFixed(2)}`;
  return label;
}
function renderIngredientPackVariantsEditor(ing){
  const variantsEl = document.getElementById('mi-pack-variants');
  if(!variantsEl) return;
  if(!ing){
    variantsEl.style.display = 'none';
    variantsEl.innerHTML = '';
    return;
  }
  const baseLabel = formatIngredientPackVariantLabel(ing);
  const optionRows = (ing.packOptions || []).map((po, idx) => {
    const label = formatIngredientPackVariantLabel(po) || 'Pack variant';
    return `<li style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:3px 0;"><span>${ppEscapeHtml(label)}</span><button type="button" class="btn sm ghost" onclick="removeManualPackVariant(${idx})">Remove</button></li>`;
  }).join('');
  const rows = `${baseLabel ? `<li style="margin:3px 0;"><span>${ppEscapeHtml(baseLabel)}</span> <span class="tag">Current pack</span></li>` : ''}${optionRows}`;
  variantsEl.innerHTML = `
    <strong>Available Tesco Variants</strong>
    <ul style="margin:6px 0 10px 18px;padding:0;">${rows || '<li>No pack variants saved yet.</li>'}</ul>
    <div class="grid3" style="margin-top:8px;">
      <div><label>Variant size</label><input type="number" id="mi-var-pack" placeholder="400"></div>
      <div><label>Total unit</label><select id="mi-var-unit"><option value="g">g</option><option value="ml">ml</option></select></div>
      <div><label>Price (£)</label><input type="number" id="mi-var-price" placeholder="1.25" step="0.01"></div>
      <div><label>Weight / volume of 1 usable item</label><div style="display:flex;gap:5px"><input type="number" id="mi-var-item-weight" placeholder="75"><select id="mi-var-item-weight-unit" style="width:70px"><option value="g">g</option><option value="ml">ml</option></select></div></div>
      <div><label>Drained weight (usable content)</label><div style="display:flex;gap:5px"><input type="number" id="mi-var-drained-weight" placeholder="235"><select id="mi-var-drained-weight-unit" style="width:70px"><option value="g">g</option><option value="ml">ml</option></select></div></div>
      <div style="display:flex;align-items:flex-end;"><button type="button" class="btn sm secondary" onclick="addManualPackVariant()">Add variant</button></div>
    </div>
  `;
  variantsEl.style.display = 'block';
}
function addManualPackVariant(){
  if(!editIngId) return showMsg('mi-msg','Save the ingredient before adding pack variants.','error');
  const ing = state.ingredients.find(i => i.id === editIngId);
  if(!ing) return;
  const packSize = +document.getElementById('mi-var-pack')?.value || null;
  const packUnit = document.getElementById('mi-var-unit')?.value || 'g';
  const price = +document.getElementById('mi-var-price')?.value || null;
  const itemWeight = +document.getElementById('mi-var-item-weight')?.value || null;
  const itemWeightUnit = document.getElementById('mi-var-item-weight-unit')?.value || 'g';
  const drainedWeight = +document.getElementById('mi-var-drained-weight')?.value || null;
  const drainedWeightUnit = document.getElementById('mi-var-drained-weight-unit')?.value || 'g';
  if(!packSize) return showMsg('mi-msg','Enter a variant pack size first.','error');
  if(!ing.packOptions) ing.packOptions = [];
  ing.packOptions.push(normaliseLegacyCountedPackOnSave({ packSize, packUnit, price, itemWeight, itemWeightUnit, drainedWeight, drainedWeightUnit }));
  if(drainedWeight && !ing.drainedWeight) {
    ing.drainedWeight = drainedWeight;
    ing.drainedWeightUnit = drainedWeightUnit;
  }
  refreshProductGroupAndRecipes(ing.id);
  saveState();
  renderIngredientPackVariantsEditor(ing);
  refreshAfterIngredientEdit();
  showMsg('mi-msg','Pack variant added.','success');
}
function removeManualPackVariant(idx){
  if(!editIngId) return;
  const ing = state.ingredients.find(i => i.id === editIngId);
  if(!ing || !ing.packOptions) return;
  ing.packOptions.splice(idx, 1);
  refreshProductGroupAndRecipes(ing.id);
  saveState();
  renderIngredientPackVariantsEditor(ing);
  refreshAfterIngredientEdit();
}
function showIngredientNutritionFixPrompt(blocker){
  if(!blocker) return;
  hideOverlay();
  editIng(blocker.id);
  const msgEl = document.getElementById('mi-msg');
  if(msgEl){
    if(blocker.reason === 'itemWeight') {
      msgEl.innerHTML = `<div class="msg error">This recipe uses <strong>${ppEscapeHtml(blocker.name)}</strong> as a counted item, but PlatePlan needs the <strong>Weight of 1 item (g)</strong> to calculate nutrition safely. Add that value here, then save to continue reviewing the recipe.</div>`;
    } else {
      msgEl.innerHTML = `<div class="msg error">This recipe uses <strong>${ppEscapeHtml(blocker.name)}</strong>, but the ingredient has no usable per-100g nutrition data. Add the calories and nutrition values here, then save to continue reviewing the recipe.</div>`;
    }
  }
}
function handlePendingRecipeNutritionAfterSave(savedId){
  if(!pendingRecipeNutritionFix) return false;
  const args = pendingRecipeNutritionFix.args;
  const blockers = findRecipeNutritionBlockers(args.allIngs);
  pendingRecipeNutritionFix.blockers = blockers;
  const next = blockers[0];
  if(next){
    if(next.id === savedId){
      const msgEl = document.getElementById('mi-msg');
      if(msgEl){
        msgEl.innerHTML = next.reason === 'itemWeight'
          ? `<div class="msg error">Please add the <strong>Weight of 1 item (g)</strong> for <strong>${ppEscapeHtml(next.name)}</strong> before continuing.</div>`
          : `<div class="msg error">Please add at least one usable per-100g nutrition value for <strong>${ppEscapeHtml(next.name)}</strong> before continuing.</div>`;
      }
      return true;
    }
    closeIngModal();
    showIngredientNutritionFixPrompt(next);
    return true;
  }
  pendingRecipeNutritionFix = null;
  closeIngModal();
  refreshAfterIngredientEdit();
  continueAfterResolve(args.name, args.allIngs, args.serves, args.types, args.method, args.ingsText, true);
  return true;
}
function editIng(id){
  capturePlatePlanEditBaseline('products/'+id);
  hideLegacyCategoryAndMeatFields();
  const ing=state.ingredients.find(i=>i.id===id);
  if(!ing)return;
  const packDisplay=normaliseLegacyCountedPackOnSave({...ing});
  editIngId=id;
  ensureIngredientModalDetached();
  ensureIngredientTescoUpdateButton();
  document.getElementById('mi-title').textContent='Edit product';
  document.getElementById('mi-name').value=ing.name||'';
  document.getElementById('mi-brand').value=ing.brand||'';
  document.getElementById('mi-cat').value=CAT[ing.cat] ? ing.cat : 'other';
  syncCategorySearchInput('mi-cat');
  document.getElementById('mi-storage').value=ing.storage || '';
  document.getElementById('mi-cal').value=ing.cal||'';
  document.getElementById('mi-fat').value=ing.fat||'';
  document.getElementById('mi-carb').value=ing.carb||'';
  document.getElementById('mi-fibre').value=ing.fibre||'';
  document.getElementById('mi-prot').value=ing.prot||'';
  document.getElementById('mi-price').value=ing.price||'';
  document.getElementById('mi-pack').value=packDisplay.packSize||'';
  setPackUnitEditorValue('mi-pack-unit',packDisplay.packUnit||'g',{allowLegacyCount:packDisplay.packUnit==='qty'});
  document.getElementById('mi-item-weight').value=ing.itemWeight||'';
  if(document.getElementById('mi-item-weight-unit')) document.getElementById('mi-item-weight-unit').value=ing.itemWeightUnit||'g';
  if(document.getElementById('mi-drained-weight')) document.getElementById('mi-drained-weight').value=ing.drainedWeight||'';
  if(document.getElementById('mi-drained-weight-unit')) document.getElementById('mi-drained-weight-unit').value=ing.drainedWeightUnit||'g';
  updatePackModelSummary('mi');
  document.getElementById('mi-notes').value=ing.notes||'';
  if(document.getElementById('mi-meatsub')) document.getElementById('mi-meatsub').value=ing.meatSubstituteFor||'';
  ['mi-serving-size','mi-serving-cal','mi-serving-fat','mi-serving-carb','mi-serving-fibre','mi-serving-prot'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const msgEl=document.getElementById('mi-msg');if(msgEl)msgEl.innerHTML='';
  updateServingConverterHint(ing);
  renderIngredientPackVariantsEditor(ing);
  renderEditProductLinkage(ing);
  const panel = document.getElementById('manual-ing-panel');
  panel.style.cssText = 'display:block; position:fixed; inset:0; z-index:360; overflow-y:auto; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center;';
  if (!panel.dataset.modalWrapped) {
    panel.dataset.modalWrapped = '1';
    const inner = document.createElement('div');
    inner.id = 'mi-inner-wrap';
    inner.style.cssText = 'background:var(--surface);border-radius:14px;padding:24px;max-width:560px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.3);';
    while(panel.firstChild) inner.appendChild(panel.firstChild);
    panel.appendChild(inner);
  }
  const parsePanel = document.getElementById('parse-panel');
  if(parsePanel) parsePanel.style.display='none';
  const tescoWrap = document.getElementById('tesco-modal-wrap');
  if(tescoWrap) tescoWrap.classList.remove('open');
}
function refreshAfterIngredientEdit(productId = ''){
  return refreshPlatePlanDerivedState({ changedProductIds:productId?[productId]:[], render:true });
}
let appConfirmAction = null;
let appConfirmCancelAction = null;
let appPromptAction = null;
let appPromptCancelAction = null;
function ensureAppConfirmModal(){
  let wrap = document.getElementById('app-confirm-wrap');
  if(wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'app-confirm-wrap';
  wrap.className = 'modal-wrap sheet-mobile';
  wrap.style.zIndex = '450';
  wrap.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 id="app-confirm-title" style="margin:0">Confirm</h3>
        <button class="btn sm ghost" onclick="closeAppConfirmModal()">Close</button>
      </div>
      <div id="app-confirm-copy" style="font-size:13px;color:var(--text2);line-height:1.45;margin-bottom:14px"></div>
      <div class="btn-row">
        <button class="btn danger" id="app-confirm-ok">Confirm</button>
        <button class="btn ghost" onclick="closeAppConfirmModal()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function openAppConfirmModal(title, copy, confirmLabel, onConfirm, onCancel=null){
  const wrap = ensureAppConfirmModal();
  appConfirmAction = onConfirm;
  appConfirmCancelAction = onCancel;
  document.getElementById('app-confirm-title').textContent = title || 'Confirm';
  document.getElementById('app-confirm-copy').innerHTML = copy || '';
  const cancel = wrap.querySelector('.btn-row .btn.ghost');
  if(cancel) cancel.style.display = '';
  const btn = document.getElementById('app-confirm-ok');
  btn.textContent = confirmLabel || 'Confirm';
  btn.onclick = () => {
    const action = appConfirmAction;
    closeAppConfirmModal(true);
    if(typeof action === 'function') action();
  };
  wrap.classList.add('open');
}
function openAppInfoModal(title, copy){
  const wrap = ensureAppConfirmModal();
  appConfirmAction = null;
  appConfirmCancelAction = null;
  document.getElementById('app-confirm-title').textContent = title || 'Information';
  document.getElementById('app-confirm-copy').innerHTML = copy || '';
  const btn = document.getElementById('app-confirm-ok');
  btn.textContent = 'Close';
  btn.onclick = closeAppConfirmModal;
  const cancel = wrap.querySelector('.btn-row .btn.ghost');
  if(cancel) cancel.style.display = 'none';
  wrap.classList.add('open');
}
function closeAppConfirmModal(confirmed=false){
  const wrap = document.getElementById('app-confirm-wrap');
  const cancel = wrap?.querySelector('.btn-row .btn.ghost');
  if(cancel) cancel.style.display = '';
  if(wrap) wrap.classList.remove('open');
  const cancelAction=appConfirmCancelAction;
  appConfirmAction = null;
  appConfirmCancelAction = null;
  if(!confirmed&&typeof cancelAction==='function')cancelAction();
}
function ensureAppPromptModal(){
  let wrap=document.getElementById('app-prompt-wrap');
  if(wrap)return wrap;
  wrap=document.createElement('div');
  wrap.id='app-prompt-wrap';
  wrap.className='modal-wrap sheet-mobile';
  wrap.style.zIndex='455';
  wrap.innerHTML=`<div class="modal" style="max-width:500px">
    <div class="row-between" style="align-items:center;margin-bottom:10px"><h3 id="app-prompt-title" style="margin:0">Enter a value</h3><button class="btn sm ghost" onclick="closeAppPromptModal(false)">Close</button></div>
    <label id="app-prompt-label" for="app-prompt-input">Value</label>
    <input id="app-prompt-input" type="text" style="width:100%;margin:7px 0 14px">
    <div class="btn-row"><button class="btn primary" id="app-prompt-ok">Save</button><button class="btn ghost" onclick="closeAppPromptModal(false)">Cancel</button></div>
  </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function openAppPromptModal(title,label,initialValue,confirmLabel,onConfirm,onCancel){
  const wrap=ensureAppPromptModal();
  appPromptAction=onConfirm;
  appPromptCancelAction=onCancel;
  document.getElementById('app-prompt-title').textContent=title||'Enter a value';
  document.getElementById('app-prompt-label').textContent=label||'Value';
  const input=document.getElementById('app-prompt-input');
  input.value=initialValue||'';
  document.getElementById('app-prompt-ok').textContent=confirmLabel||'Save';
  document.getElementById('app-prompt-ok').onclick=()=>{
    const value=input.value.trim();
    if (!value) { input.focus();return; }
    const action=appPromptAction;
    closeAppPromptModal(true);
    if(typeof action==='function')action(value);
  };
  wrap.classList.add('open');
  setTimeout(()=>{input.focus();input.select();},0);
}
function closeAppPromptModal(confirmed=false){
  document.getElementById('app-prompt-wrap')?.classList.remove('open');
  const cancel=appPromptCancelAction;
  appPromptAction=null;
  appPromptCancelAction=null;
  if(!confirmed&&typeof cancel==='function')cancel();
}
async function saveManualIng(categoryReady=false){
  const name=document.getElementById('mi-name').value.trim();
  if(!name)return showMsg('mi-msg','Please enter a name.','error');
  if(!categoryReady)return resolveCategoryBeforeProductSave('mi-cat',()=>saveManualIng(true));
  const nowIso = new Date().toISOString();
  const existingIng = editIngId ? state.ingredients.find(x=>x.id===editIngId) : null;
  const isNew = !editIngId;
  const ing=normaliseLegacyCountedPackOnSave({
    id:editIngId||('ing'+Date.now()),
    name,
    brand:document.getElementById('mi-brand').value.trim(),
    cat:document.getElementById('mi-cat').value,
    storage:document.getElementById('mi-storage').value,
    cal:+document.getElementById('mi-cal').value||0,
    fat:+document.getElementById('mi-fat').value||0,
    carb:+document.getElementById('mi-carb').value||0,
    fibre:+document.getElementById('mi-fibre').value||0,
    prot:+document.getElementById('mi-prot').value||0,
    price:+document.getElementById('mi-price').value||null,
    packSize:+document.getElementById('mi-pack').value||null,
    packUnit:document.getElementById('mi-pack-unit').value||'g',
    itemWeight:+document.getElementById('mi-item-weight').value||null,
    itemWeightUnit:document.getElementById('mi-item-weight-unit')?.value||'g',
    drainedWeight:+document.getElementById('mi-drained-weight')?.value||null,
    drainedWeightUnit:document.getElementById('mi-drained-weight-unit')?.value||'g',
    groupId: existingIng ? (existingIng.groupId || '') : '',
    subTypeId: existingIng ? (existingIng.subTypeId || existingIng.groupId || '') : '',
    subType: existingIng ? (existingIng.subType || '') : '',
    ingredientId: existingIng ? (existingIng.ingredientId || '') : '',
    itemCount: existingIng ? (existingIng.itemCount || null) : null,
    sourceUrl: existingIng ? (existingIng.sourceUrl || null) : null,
    packOptions: existingIng ? (existingIng.packOptions || []) : [],
    notes:document.getElementById('mi-notes').value.trim(),
    meatSubstituteFor: existingIng ? (existingIng.meatSubstituteFor || null) : null,
    updatedAt: nowIso
  });
  let groupUpdate = null;
  if(ing.groupId && getIngredientGroup(ing.groupId)) {
    const grp = getIngredientGroup(ing.groupId);
    ensureProductAssignedToGroup(ing, name, ing.groupId);
    syncProductHierarchyCategory(ing, grp, ing.cat);
    grp.updatedAt = nowIso;
    groupUpdate = grp;
    ing.groupId = grp.id;
    ing.subTypeId = grp.id;
    ing.subType = grp.name;
    const fam = (typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily(grp) : null) || (grp.ingredientId ? getIngredientFamily(grp.ingredientId) : null);
    if(fam) ing.ingredientId = fam.id;
    else if(grp.ingredientId) ing.ingredientId = grp.ingredientId;
  } else {
    const assignedGroup = ensureProductAssignedToGroup(ing, name, '', true);
    if(assignedGroup) {
      assignedGroup.updatedAt = nowIso;
      ing.groupId = assignedGroup.id;
      ing.subTypeId = assignedGroup.id;
      ing.subType = assignedGroup.name;
      syncProductHierarchyCategory(ing, assignedGroup, ing.cat);
      groupUpdate = assignedGroup;
      const fam = (typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily(assignedGroup) : null) || (assignedGroup.ingredientId ? getIngredientFamily(assignedGroup.ingredientId) : null);
      if(fam) ing.ingredientId = fam.id;
      else if(assignedGroup.ingredientId) ing.ingredientId = assignedGroup.ingredientId;
    }
  }
  recalcRecipesUsingIngredient(ing.id);
  try {
    await executeDataQualityTransaction('UPDATE_PRODUCT', {
      product: ing,
      isNew,
      groupUpdate
    }, {
      submitButtonId: 'mi-save-btn',
      errorContainerId: 'mi-msg'
    });
  } catch(error) {
    console.warn('saveManualIng transaction error, ensuring local persistence:', error);
    try {
      const idx = state.ingredients.findIndex(x => x.id === ing.id);
      if (idx > -1) state.ingredients[idx] = ing;
      else state.ingredients.push(ing);
      safeLocalStorageSet(SK, safeJsonStringify(state));
    } catch(_saveErr) {
      console.warn('Local storage fallback save error in saveManualIng:', _saveErr);
    }
  }
  try {
    if (typeof pushStateToCloud === 'function') { pushStateToCloud(false).catch(e => console.warn('Background cloud sync in saveManualIng:', e)); }
  } catch(_pushErr) {}
  refreshProductGroupAndRecipes(ing.id);
  try {
    if (typeof runDataQualityAudits === 'function') { runDataQualityAudits(true); }
  } catch(auditErr) {
    console.warn('Reactive audit error in saveManualIng:', auditErr);
  }
  if(handlePendingRecipeNutritionAfterSave(ing.id)){
    refreshAfterIngredientEdit(ing.id);
    return;
  }
  closeIngModal();
  editIngId=null;
  refreshAfterIngredientEdit(ing.id);
  if(productEditorReturnToReview){
    productEditorReturnToReview=false;
    if(document.getElementById('modal-wrap')?.classList.contains('open')){
      recalcModal(currentReviewVariant === 'enhanced' ? 'enh' : 'orig');
      document.getElementById('modal-title')?.focus?.({preventScroll:true});
      showPlatePlanToast('Product saved. Continue reviewing the recipe.');
      return;
    }
  }
  finishEditorReturn();
}
function closeIngModal() {
  const panel = document.getElementById('manual-ing-panel');
  panel.style.display = 'none';
  panel.style.cssText = 'display:none';
}
function cancelManualIng() {
    if(pendingRecipeNutritionFix){
      const msgEl = document.getElementById('mi-msg');
      if(msgEl) msgEl.innerHTML = '<div class="msg error">Add the missing nutrition values and save before continuing with this recipe.</div>';
      return;
    }
    closeIngModal();
    if(productEditorReturnToReview){
      productEditorReturnToReview=false;
      document.getElementById('modal-wrap')?.querySelector('button,input,select,textarea')?.focus?.({preventScroll:true});
      return;
    }
    abandonEditorReturn();
}
function deleteIng(id){
    const usage = getIngredientUsage(id);
    if (usage.recipes.length > 0 || usage.plans.length > 0) {
        openReplaceIngredientModal(id);
        return;
    }
    const product = getProduct(id);
    openAppConfirmModal(
      'Delete product?',
      `Delete <strong>${ppEscapeHtml(product?.name || 'this product')}</strong> from Product Bank?`,
      'Delete product',
      () => runWithRecoveryPoint('Before deleting product', async () => {
        try {
          await executeDataQualityTransaction('DELETE_PRODUCT', { id });
          refreshPlatePlanDerivedState({ persist:false, render:true });
        } catch(e) {
          console.error('deleteIng failed:', e);
        }
      })
    );
}
let _replaceCtx = null; // { targetId, rows:[{recipeId, key:'ingredients'|'enhanced', idx, replacementId}] }
function openReplaceIngredientModal(targetId){
    const target = state.ingredients.find(i=>i.id===targetId);
    if(!target){
      openAppConfirmModal('Product not found', 'That product could not be found in Product Bank.', 'OK', () => {});
      return;
    }
    const rows = [];
    const usesTarget = ing => ing && (ing.bankId === targetId || resolveProductForIngredient(ing).product?.id === targetId);
    state.recipes.forEach(r => {
        (r.ingredients||[]).forEach((ing, idx) => {
            if(usesTarget(ing)) rows.push({recipeId:r.id, recipeName:r.name, key:'ingredients', idx, line:ing.raw||ing.name, replacementId:''});
        });
        if(r.enhanced && r.enhanced.ingredients){
            r.enhanced.ingredients.forEach((ing, idx) => {
                if(usesTarget(ing)) rows.push({recipeId:r.id, recipeName:r.name+' (Enhanced)', key:'enhanced', idx, line:ing.raw||ing.name, replacementId:''});
            });
        }
    });
    const planRefs = [];
    if(state.plan && state.plan.slots){
        Object.entries(state.plan.productSelections || {}).forEach(([groupId, productId]) => {
            if(productId === targetId) planRefs.push({ type:'planSelection', groupId, label:'Plan product selection' });
        });
        for(const d in state.plan.slots){
            for(const k in state.plan.slots[d]){
                const s = state.plan.slots[d][k];
                if(s && s.instanceId){
                    const overrideSet = state.overrides[s.instanceId] || {};
                    const subs = overrideSet.substitutions || {};
                    for(const fromId in subs){
                        if(subs[fromId] === targetId) planRefs.push({ type:'substitution', instanceId:s.instanceId, fromId, label:`${formatPlanDayLabel(state.plan,d,{short:true})} ${k}` });
                    }
                    const productOverrides = overrideSet.productOverrides || {};
                    for(const groupId in productOverrides){
                        if(productOverrides[groupId] === targetId) planRefs.push({ type:'productOverride', instanceId:s.instanceId, groupId, label:`${formatPlanDayLabel(state.plan,d,{short:true})} ${k}` });
                    }
                }
            }
        }
    }
    _replaceCtx = { targetId, target, rows, planRefs };
    renderReplaceModal();
    document.getElementById('replace-ing-wrap').classList.add('open');
}
function renderReplaceModal(){
    const c = _replaceCtx; if(!c) return;
    const others = state.ingredients
        .filter(i => i.id !== c.targetId)
        .sort((a,b)=>{
            const aEff = a.cal ? (a.prot/a.cal)*100 : 0;
            const bEff = b.cal ? (b.prot/b.cal)*100 : 0;
            if(bEff !== aEff) return bEff - aEff;
            return a.name.localeCompare(b.name,'en',{sensitivity:'base'});
        });
    function searchWidget(widgetId, onPickFn) {
        const listId = widgetId + '-list';
        return `
          <div style="position:relative">
            <div style="display:flex;gap:6px;">
            <input type="text" id="${widgetId}-input" placeholder="Search ingredients…"
              onfocus="replaceSearchFilter('${widgetId}', '${listId}')"
              oninput="replaceSearchFilter('${widgetId}', '${listId}')"
              style="flex:1;border:1px solid var(--border);border-radius:8px;padding:7px 10px;font-size:13px;background:var(--surface);color:var(--text)"
            >
            <button class="btn sm ghost" style="white-space:nowrap" onclick="openTescoImportFromReplace('${widgetId}')">🛒 Import</button>
            </div>
            <div id="${listId}" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:8px;max-height:200px;overflow-y:auto;z-index:50;box-shadow:0 4px 12px rgba(0,0,0,.15)">
              ${others.map(i=>{
                const eff = i.cal ? ((i.prot/i.cal)*100).toFixed(1) : '0.0';
                return `<div class="replace-search-opt" data-id="${i.id}" data-name="${(i.name+(i.brand?' ('+i.brand+')':'')).replace(/"/g,'&quot;')}" data-search="${(i.name+' '+(i.brand||'')+' '+(CAT[i.cat]||i.cat||'')).toLowerCase().replace(/"/g,'&quot;')}"
                onclick="${onPickFn}('${widgetId}','${listId}',this)"
                style="padding:7px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
              >${i.name}${i.brand?` <span style="color:var(--text3);font-size:11px">(${i.brand})</span>`:''}<span style="float:right;color:var(--text3);font-size:11px">${eff}g P/100kcal</span></div>`;
              }).join('')}
            </div>
            <div id="${widgetId}-selected" style="font-size:12px;color:var(--text2);margin-top:3px;min-height:16px"></div>
          </div>`;
    }
    let rowsHtml = '';
    if (!c.rows.length && !c.planRefs.length) { rowsHtml = '<div class="msg success" style="margin:0">No live references found — safe to delete.</div>'; } else {
        rowsHtml = '<div style="display:flex; flex-direction:column; gap:10px;">';
        c.rows.forEach((row, i) => {
            rowsHtml += `<div style="border-bottom:1px solid var(--border); padding:8px 0; gap:8px;">
                <div style="margin-bottom:5px">
                    <div style="font-weight:600; font-size:13px;">${row.recipeName}</div>
                    <div style="font-size:11px; color:var(--text3);">${row.line||''}</div>
                </div>
                ${searchWidget('rrow-'+i, 'replaceRowPick')}
            </div>`;
        });
        rowsHtml += '</div>';
        if(c.planRefs.length){
            rowsHtml += `<div style="margin-top:10px; font-size:12px; color:var(--text2);">Plus ${c.planRefs.length} meal-plan substitution override(s) — remapped automatically.</div>`;
        }
    }
    document.getElementById('replace-ing-body').innerHTML = `
        <p style="font-size:12px; color:var(--text2); margin-bottom:10px;">
            <strong>${c.target.name}</strong> is used in the recipes below. Search for a replacement for each, then confirm.
        </p>
        <div style="background:var(--surface2); padding:10px; border-radius:8px; margin-bottom:14px; font-size:12px;">
            <strong style="display:block;margin-bottom:6px">Replace ALL with:</strong>
            ${searchWidget('rrow-bulk', 'replaceBulkPickAndApply')}
        </div>
        ${rowsHtml}
    `;
}
function replaceSearchFilter(widgetId, listId) {
    const inp = document.getElementById(widgetId+'-input');
    if(!inp) return;
    const q = inp.value.toLowerCase().trim();
    const terms = q.split(/\s+/).filter(Boolean);
    const list = document.getElementById(listId);
    if(!list) return;
    list.style.display = 'block';
    Array.from(list.querySelectorAll('.replace-search-opt')).forEach(el => {
        const haystack = (el.dataset.search || el.dataset.name || '').toLowerCase();
        el.style.display = !terms.length || terms.every(t => haystack.includes(t)) ? '' : 'none';
    });
}
function openTescoImportFromReplace(widgetId) {
    const name = (document.getElementById(widgetId+'-input')?.value || _replaceCtx?.target?.name || '').trim();
    showTescoImport({ type: 'replace', widgetId, name });
}
function applyReplaceImportSelection(widgetId, id, name) {
    if(!_replaceCtx || !widgetId || !id) return;
    const input = document.getElementById(widgetId+'-input');
    const selected = document.getElementById(widgetId+'-selected');
    if(input) input.value = name;
    if(selected) selected.textContent = '✓ Selected: ' + name;
    if(widgetId === 'rrow-bulk') {
        _replaceCtx.rows.forEach(r => r.replacementId = id);
        _replaceCtx.rows.forEach((r, i) => {
            const rowInput = document.getElementById('rrow-'+i+'-input');
            const rowSelected = document.getElementById('rrow-'+i+'-selected');
            if(rowInput) rowInput.value = name;
            if(rowSelected) rowSelected.textContent = '✓ Selected: ' + name;
        });
    } else {
        const idx = parseInt(widgetId.replace('rrow-', ''));
        if(!isNaN(idx) && _replaceCtx.rows[idx]) _replaceCtx.rows[idx].replacementId = id;
    }
}
function replaceRowPick(widgetId, listId, el) {
    const id = el.dataset.id;
    const name = el.dataset.name;
    const idx = parseInt(widgetId.replace('rrow-', ''));
    if(_replaceCtx?.rows?.[idx]) _replaceCtx.rows[idx].replacementId = id;
    const inp = document.getElementById(widgetId+'-input');
    if(inp) inp.value = name;
    const sel = document.getElementById(widgetId+'-selected');
    if(sel) sel.textContent = '✓ Selected: ' + name;
    const list = document.getElementById(listId);
    if(list) list.style.display = 'none';
}
function replaceBulkPickAndApply(widgetId, listId, el) {
    const id = el.dataset.id;
    const name = el.dataset.name;
    const bInp = document.getElementById(widgetId+'-input');
    if(bInp) bInp.value = name;
    const bSel = document.getElementById(widgetId+'-selected');
    if(bSel) bSel.textContent = '✓ Applying to all rows: ' + name;
    const list = document.getElementById(listId);
    if(list) list.style.display = 'none';
    if(_replaceCtx?.rows) _replaceCtx.rows.forEach(r => r.replacementId = id);
    if(_replaceCtx?.rows) _replaceCtx.rows.forEach((r, i) => {
        const inp = document.getElementById('rrow-'+i+'-input');
        const sel = document.getElementById('rrow-'+i+'-selected');
        if(inp) inp.value = name;
        if(sel) sel.textContent = '✓ Selected: ' + name;
    });
}
function replaceBulkApply(){
}
function closeReplaceModal(){
    document.getElementById('replace-ing-wrap').classList.remove('open');
    _replaceCtx = null;
}
function confirmReplaceAndDelete(){
    const c = _replaceCtx; if(!c) return;
    const missing = c.rows.filter(r => !r.replacementId);
    if(missing.length){
        const body = document.getElementById('replace-ing-body');
        if(body) body.insertAdjacentHTML('afterbegin', `<div class="msg error">Please pick a replacement for all ${c.rows.length} reference(s). ${missing.length} still need a selection.</div>`);
        return;
    }
    openAppConfirmModal(
      'Replace and delete?',
      `Replace ${c.rows.length} reference${c.rows.length===1?'':'s'} and delete <strong>${ppEscapeHtml(c.target.name)}</strong>?`,
      'Replace and delete',
      () => performReplaceAndDelete(c)
    );
}
function performReplaceAndDelete(c){
    if(!c) return;
    runWithRecoveryPoint('Before bulk replacing and deleting product', () => applyReplaceAndDelete(c));
}
async function applyReplaceAndDelete(c){
    if(!c) return;
    try {
      await executeDataQualityTransaction('REPLACE_AND_DELETE_PRODUCT', {
        targetId: c.targetId,
        replacements: c.rows
      });
      const touched = new Set(c.rows.map(r => r.recipeId));
      touched.forEach(rid => {
        const r = state.recipes.find(x=>x.id===rid); if(!r) return;
        recalcRecipeObject(r);
      });
      closeReplaceModal();
      if(typeof renderBank==='function') renderBank();
      if(typeof renderVault==='function') renderVault();
      if(typeof renderDataQuality==='function') renderDataQuality();
    } catch(e) {
      console.error('applyReplaceAndDelete failed:', e);
    }
}
async function parsePlainNutritionLabel(text){
  const raw = String(text || '').replace(/\r/g, '\n');
  const lines = raw.split(/\n|;/).map(x => x.trim()).filter(Boolean);
  const joined = lines.join(' | ');
  const payload = {};
  payload.cal = normalizeEnergyKcal(joined);
  function valueFor(labels){
    const patterns = labels.flatMap(label => [
      new RegExp('(?:^|\\b)' + label + '\\b[^0-9]{0,30}(\\d+(?:\\.\\d+)?)', 'i'),
      new RegExp('(\\d+(?:\\.\\d+)?)\\s*g?\\s*(?:^|\\b)' + label + '\\b', 'i')
    ]);
    for(const line of lines){
      const clean = line.toLowerCase();
      for(const pat of patterns){
        const m = clean.match(pat);
        if(m) return +m[1] || 0;
      }
    }
    const all = joined.toLowerCase();
    for(const pat of patterns){
      const m = all.match(pat);
      if(m) return +m[1] || 0;
    }
    return 0;
  }
  payload.fat = valueFor(['fat', 'total fat']);
  payload.carb = valueFor(['carbohydrate', 'carbohydrates', 'carbs', 'total carbohydrate']);
  payload.fibre = valueFor(['fibre', 'fiber']);
  payload.prot = valueFor(['protein']);
  return normalizeNutritionPayload(payload);
}
function parseIng(){
  const name=document.getElementById('pp-name').value.trim(),text=document.getElementById('pp-text').value.trim();
  if(!name||!text)return showMsg('pp-msg','Please enter a name and paste the label.','error');
  showOverlay('Parsing nutritional info...','Using local label parser');
  try{
    const parsed = parsePlainNutritionLabel(text);
    hideOverlay();
    const hasCore = parsed.cal > 0 || parsed.prot > 0 || parsed.carb > 0 || parsed.fat > 0 || parsed.fibre > 0;
    const ing={
      id:'ing'+Date.now(),
      name,
      brand:document.getElementById('pp-brand').value.trim(),
      cat:document.getElementById('pp-cat').value,
      storage:document.getElementById('pp-storage').value,
      cal:+parsed.cal||0,
      prot:+parsed.prot||0,
      carb:+parsed.carb||0,
      fat:+parsed.fat||0,
      fibre:+parsed.fibre||0,
      price:+document.getElementById('pp-price').value||null,
      packSize:+document.getElementById('pp-pack').value||null,
      packUnit:document.getElementById('pp-pack-unit').value||'g',
      itemWeight:+document.getElementById('pp-item-weight').value||null,
      notes:'',
      meatSubstituteFor:null,
      updatedAt: new Date().toISOString()
    };
    state.ingredients.push(ing);
    refreshProductGroupAndRecipes(ing.id);
    saveState();
    const parsePanel = document.getElementById('parse-panel');
    if(parsePanel) parsePanel.style.display='none';
    ['pp-name','pp-brand','pp-text','pp-price','pp-pack','pp-meatsub'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
    const sEl = document.getElementById('pp-storage'); if(sEl) sEl.value = '';
    const puEl = document.getElementById('pp-pack-unit'); if(puEl) puEl.value = 'qty';
    const iwEl = document.getElementById('pp-item-weight'); if(iwEl) iwEl.value = '';
    renderBank();
    showMsg('bank-msg', hasCore ? 'Product added from pasted label. Please review the parsed nutrition values.' : 'Product added, but PlatePlan could not confidently read nutrition values. Please edit the product and fill the bank data.', hasCore ? 'success' : 'error');
  }catch(e){hideOverlay();showMsg('pp-msg','Could not parse this label locally. Please add the values manually.','error');}
}
function parsePlanLocalDate(value){
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return null;
  const date=new Date(+match[1],+match[2]-1,+match[3],12,0,0,0);
  return date.getFullYear()===+match[1]&&date.getMonth()===+match[2]-1&&date.getDate()===+match[3]?date:null;
}
function formatPlanLocalDateValue(date){
  if(!(date instanceof Date)||Number.isNaN(date.getTime()))return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function buildPlanDayDates(startDate,days){
  const first=parsePlanLocalDate(startDate);if(!first)return {};
  const result={};for(let day=1;day<=(+days||0);day++){const date=new Date(first);date.setDate(first.getDate()+day-1);result[day]=formatPlanLocalDateValue(date);}return result;
}
function formatPlanDayLabel(planContext,day,{short=false}={}){
  const base=`Day ${day}`;const date=parsePlanLocalDate(planContext?.dayDates?.[day]);if(!date)return base;
  const formatted=new Intl.DateTimeFormat('en-GB',short?{weekday:'short',day:'numeric',month:'short'}:{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(date);
  return `${base} · ${formatted}`;
}
function getPlanDateRangeLabel(planContext){
  const rows=Object.entries(planContext?.dayDates||{}).filter(([,value])=>parsePlanLocalDate(value)).sort((a,b)=>+a[0]-+b[0]);
  if(!rows.length)return '';
  const first=formatPlanDayLabel(planContext,rows[0][0],{short:true}).replace(/^Day \d+ · /,'');
  const last=formatPlanDayLabel(planContext,rows[rows.length-1][0],{short:true}).replace(/^Day \d+ · /,'');
  return first===last?first:`${first} – ${last}`;
}
function validatePlanDayDates(dayDates){
  const rows=Object.entries(dayDates||{}).filter(([,value])=>value).sort((a,b)=>+a[0]-+b[0]);let previous='';const seen=new Set();
  for(const [day,value] of rows){if(!parsePlanLocalDate(value))return `Day ${day} has an invalid date.`;if(seen.has(value))return 'Each meal-plan day needs a different calendar date.';if(previous&&value<=previous)return 'Calendar dates must follow the same order as the meal-plan days.';seen.add(value);previous=value;}
  return '';
}
function setPlanDayDate(day,value){
  if(!state.plan?.slots)return;
  const next={...(state.plan.dayDates||{})};if(value)next[day]=value;else delete next[day];
  const error=validatePlanDayDates(next);if (error) { showMsg('plan-warnings',error,'error');renderPlan();return; }
  state.plan.dayDates=next;saveState();markPlatePlanViewsDirty('today','shopping','planlib');renderPlan();renderPlanHistoryPanel();
}
function applyPlanCalendarStart(){
  if(!state.plan?.slots)return showMsg('plan-warnings','Generate a meal plan before applying calendar dates.','warn');
  const start=document.getElementById('plan-start-date')?.value||'';
  if(!start)return clearPlanCalendarDates();
  state.plan.dayDates=buildPlanDayDates(start,state.plan.days||Object.keys(state.plan.slots||{}).length);saveState();markPlatePlanViewsDirty('today','shopping','planlib');renderPlan();
}
function clearPlanCalendarDates(){
  const input=document.getElementById('plan-start-date');if(input)input.value='';
  if(state.plan?.slots){state.plan.dayDates={};saveState();markPlatePlanViewsDirty('today','shopping','planlib');renderPlan();}
}
const PLAN_SLOT_REASON_LABELS={
  eating_out:'Eating out',
  away:'Away',
  leftovers:'Leftovers',
  skipped:'Skipped',
  plans_changed:'Plans changed',
  forgot_to_update:'Forgot to update',
  other:'Other'
};
function getPlanSlotReasonKey(day,slotKey){return `${day}|${slotKey}`;}
function getPlanSlotReason(planContext,day,slotKey){
  const value=planContext?.slotReasons?.[getPlanSlotReasonKey(day,slotKey)];
  if(!value)return null;
  if(typeof value==='string')return {code:value,note:''};
  return {code:value.code||'other',note:value.note||''};
}
function formatPlanSlotReason(reason){
  if(!reason)return '';
  const base=PLAN_SLOT_REASON_LABELS[reason.code]||PLAN_SLOT_REASON_LABELS.other;
  return reason.note ? (reason.code==='other'?reason.note:`${base} · ${reason.note}`) : base;
}
function setPlanSlotReason(day,slotKey,code,note=''){
  if(!state.plan.slotReasons||typeof state.plan.slotReasons!=='object')state.plan.slotReasons={};
  const key=getPlanSlotReasonKey(day,slotKey);
  if(!code)delete state.plan.slotReasons[key];
  else state.plan.slotReasons[key]={code:PLAN_SLOT_REASON_LABELS[code]?code:'other',note:String(note||'').trim()};
}
function clearPlanSlotReason(day,slotKey,{persist=true}={}){
  if(!state.plan?.slotReasons)return;
  delete state.plan.slotReasons[getPlanSlotReasonKey(day,slotKey)];
  if(!persist)return;
  saveState();
  markPlatePlanViewsDirty('today','shopping','planlib');
  renderPlan();
  if(document.getElementById('view-today')?.classList.contains('active'))renderToday();
  showPlatePlanToast('Plan note cleared.');
}
function findPlanSlotLocation(instanceId){
  if(!instanceId||!state.plan?.slots)return null;
  for(const [day,daySlots] of Object.entries(state.plan.slots)){
    for(const [slotKey,slot] of Object.entries(daySlots||{})){
      if(slot&&typeof slot==='object'&&slot.instanceId===instanceId)return {day:+day,slotKey,slot};
    }
  }
  return null;
}
function getPlanSlotCounterpartKey(slotKey){
  if(String(slotKey).endsWith('E'))return String(slotKey).slice(0,-1)+'C';
  if(String(slotKey).endsWith('C'))return String(slotKey).slice(0,-1)+'E';
  return '';
}
function planSlotsCanMoveTogether(day,slotKey){
  const counterpartKey=getPlanSlotCounterpartKey(slotKey);
  const first=getPlanSlotInfo(state.plan?.slots?.[day]?.[slotKey]);
  const second=getPlanSlotInfo(state.plan?.slots?.[day]?.[counterpartKey]);
  const mealType=getMealTypeFromSlotKey(slotKey);
  return !!(first.active&&second.active&&getTodayResolvedFingerprint(first,mealType)===getTodayResolvedFingerprint(second,mealType));
}
function emptyPlanDaySlots() { return Object.fromEntries(SLOTS.map(slot=>[slot.key,null])); }
function insertPlanDayAt(index,dateValue){
  const plan=state.plan;
  const oldDays=Math.max(+plan.days||0,...Object.keys(plan.slots||{}).map(Number).filter(Number.isFinite),0);
  const slots={};
  const dayDates={};
  const excluded={};
  for(let day=1;day<=oldDays;day++){
    const nextDay=day>=index?day+1:day;
    slots[nextDay]=plan.slots?.[day]||emptyPlanDaySlots();
    if(plan.dayDates?.[day])dayDates[nextDay]=plan.dayDates[day];
    if(state.excluded?.[day])excluded[nextDay]=state.excluded[day];
  }
  slots[index]=emptyPlanDaySlots();
  dayDates[index]=dateValue;
  excluded[index]=Object.fromEntries(SLOTS.map(slot=>[slot.key,false]));
  const slotReasons={};
  Object.entries(plan.slotReasons||{}).forEach(([key,value])=>{
    const match=key.match(/^(\d+)\|(.+)$/);
    if(!match)return;
    const oldDay=+match[1];
    slotReasons[getPlanSlotReasonKey(oldDay>=index?oldDay+1:oldDay,match[2])]=value;
  });
  plan.days=oldDays+1;
  plan.slots=slots;
  plan.dayDates=dayDates;
  plan.slotReasons=slotReasons;
  state.excluded={...(state.excluded||{}),...excluded};
  Object.keys(state.excluded).forEach(key=>{if(+key>=1&&+key<=oldDays+1&&!excluded[key])delete state.excluded[key];});
  return index;
}
function ensurePlanDayForReschedule(dateValue){
  const existing=getTodayPlanDay(dateValue,state.plan);
  if(existing)return +existing;
  const days=Math.max(+state.plan.days||0,...Object.keys(state.plan.slots||{}).map(Number).filter(Number.isFinite),0);
  const dated=Object.entries(state.plan.dayDates||{}).filter(([,value])=>parsePlanLocalDate(value)).sort((a,b)=>+a[0]-+b[0]);
  const next=dated.find(([,value])=>value>dateValue);
  return insertPlanDayAt(next?+next[0]:days+1,dateValue);
}
function ensurePlanRescheduleModal(){
  let wrap=document.getElementById('plan-reschedule-wrap');
  if (wrap) { wrap.remove(); }
  wrap=document.createElement('div');
  wrap.id='plan-reschedule-wrap';
  wrap.className='modal-wrap sheet-mobile plan-reschedule-wrap';
  wrap.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="plan-reschedule-title">
    <div class="plan-reschedule-appbar">
      <div><h3 id="plan-reschedule-title">Reschedule meal</h3><div>Choose where this planned meal should go</div></div>
      <button class="btn sm ghost" type="button" onclick="closePlanRescheduleModal()">Close</button>
    </div>
    <div class="plan-reschedule-body" id="plan-reschedule-body"></div>
    <div class="plan-reschedule-actions" id="plan-reschedule-actions"></div>
  </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function getPlanRescheduleSourceKeys(){
  if(!platePlanRescheduleSource)return [];
  const scope=platePlanRescheduleDraft?.scope||'single';
  const keys=[platePlanRescheduleSource.slotKey];
  const counterpart=getPlanSlotCounterpartKey(platePlanRescheduleSource.slotKey);
  if(scope==='both'&&counterpart&&planSlotsCanMoveTogether(platePlanRescheduleSource.day,platePlanRescheduleSource.slotKey))keys.push(counterpart);
  return keys;
}
function planHasCalendarDates(){
  return Object.values(state.plan?.dayDates||{}).some(value=>!!parsePlanLocalDate(value));
}
function getPlanRescheduleDestinationDay(){
  if(!platePlanRescheduleDraft)return 0;
  if(platePlanRescheduleDraft.destinationType==='day')return +platePlanRescheduleDraft.destinationValue||0;
  return +(getTodayPlanDay(platePlanRescheduleDraft.destinationValue,state.plan)||0);
}
function getPlanRescheduleSuggestions(){
  const suggestions=[];
  const add=(type,value,label)=>{
    const key=`${type}:${value}`;
    if(!value||suggestions.some(item=>item.key===key))return;
    suggestions.push({key,type,value:String(value),label});
  };
  if(!planHasCalendarDates()){
    const days=Math.max(+state.plan?.days||0,...Object.keys(state.plan?.slots||{}).map(Number).filter(Number.isFinite),0);
    for(let day=1;day<=days;day++)add('day',day,`Day ${day}`);
    return suggestions;
  }
  const today=getPlatePlanLocalToday();
  const tomorrow=parsePlanLocalDate(today);
  tomorrow.setDate(tomorrow.getDate()+1);
  add('date',today,'Today');
  add('date',formatPlanLocalDateValue(tomorrow),'Tomorrow');
  const sourceDate=state.plan.dayDates?.[platePlanRescheduleSource?.day]||today;
  Object.entries(state.plan.dayDates||{})
    .filter(([,value])=>parsePlanLocalDate(value))
    .sort((a,b)=>{
      const distanceA=Math.abs(parsePlanLocalDate(a[1])-parsePlanLocalDate(sourceDate));
      const distanceB=Math.abs(parsePlanLocalDate(b[1])-parsePlanLocalDate(sourceDate));
      return distanceA-distanceB||a[1].localeCompare(b[1]);
    })
    .slice(0,5)
    .forEach(([day,value])=>add('date',value,formatPlanDayLabel(state.plan,day,{short:true})));
  return suggestions;
}
function getPlanRescheduleDestinationLabel(){
  if(!platePlanRescheduleDraft)return '';
  const day=getPlanRescheduleDestinationDay();
  if(day)return formatPlanDayLabel(state.plan,day,{short:true});
  if(platePlanRescheduleDraft.destinationType==='date')return formatTodayDateLabel(platePlanRescheduleDraft.destinationValue);
  return `Day ${platePlanRescheduleDraft.destinationValue}`;
}
function setPlanRescheduleScope(value){
  if(!platePlanRescheduleDraft)return;
  platePlanRescheduleDraft.scope=value==='both'?'both':'single';
  platePlanRescheduleDraft.collisionReview=false;
  renderPlanRescheduleSheet();
}
function selectPlanRescheduleDestination(type,value){
  if(!platePlanRescheduleDraft)return;
  platePlanRescheduleDraft.destinationType=type==='day'?'day':'date';
  platePlanRescheduleDraft.destinationValue=String(value||'');
  platePlanRescheduleDraft.showOtherDate=false;
  platePlanRescheduleDraft.collisionReview=false;
  renderPlanRescheduleSheet();
}
function showPlanRescheduleOtherDate(){
  if(!platePlanRescheduleDraft)return;
  if(!planHasCalendarDates()){
    closePlanRescheduleModal();
    openPlanDatesWorkspace();
    return;
  }
  platePlanRescheduleDraft.showOtherDate=true;
  platePlanRescheduleDraft.collisionReview=false;
  renderPlanRescheduleSheet();
  setTimeout(()=>document.getElementById('plan-reschedule-other-date')?.focus(),0);
}
function setPlanRescheduleOtherDate(value){
  if(!platePlanRescheduleDraft)return;
  platePlanRescheduleDraft.destinationType='date';
  platePlanRescheduleDraft.destinationValue=value||'';
  platePlanRescheduleDraft.collisionReview=false;
  renderPlanRescheduleSheet();
}
function setPlanRescheduleMeal(value){
  if(!platePlanRescheduleDraft)return;
  platePlanRescheduleDraft.meal=['breakfast','lunch','dinner'].includes(value)?value:'dinner';
  platePlanRescheduleDraft.collisionReview=false;
  renderPlanRescheduleSheet();
}
function setPlanRescheduleReason(value){
  if(!platePlanRescheduleDraft)return;
  platePlanRescheduleDraft.reason=PLAN_SLOT_REASON_LABELS[value]?value:'';
  if(value==='other')platePlanRescheduleDraft.showNote=true;
  platePlanRescheduleDraft.collisionReview=false;
  renderPlanRescheduleSheet();
}
function togglePlanRescheduleNote(){
  if(!platePlanRescheduleDraft)return;
  platePlanRescheduleDraft.showNote=!platePlanRescheduleDraft.showNote;
  renderPlanRescheduleSheet();
  if(platePlanRescheduleDraft.showNote)setTimeout(()=>document.getElementById('plan-reschedule-note')?.focus(),0);
}
function setPlanRescheduleNote(value) { if(platePlanRescheduleDraft)platePlanRescheduleDraft.note=String(value||'').slice(0,80); }
function getPlanRescheduleCollisionCount(){
  const targetDay=getPlanRescheduleDestinationDay();
  if(!targetDay||!platePlanRescheduleDraft)return 0;
  const movingInstances=new Set(getPlanRescheduleSourceKeys().map(key=>getPlanSlotInfo(state.plan?.slots?.[platePlanRescheduleSource.day]?.[key]).instanceId).filter(Boolean));
  return getPlanRescheduleSourceKeys().filter(key=>{
    const suffix=key.endsWith('C')?'C':'E';
    const destination=getPlanSlotInfo(state.plan?.slots?.[targetDay]?.[`${platePlanRescheduleDraft.meal}${suffix}`]);
    return !!(destination.active&&!movingInstances.has(destination.instanceId));
  }).length;
}
function updatePlanReschedulePreview(){
  if(!platePlanRescheduleSource||!platePlanRescheduleDraft)return '';
  const destinationValue=platePlanRescheduleDraft.destinationValue;
  if(platePlanRescheduleDraft.destinationType==='date'&&!parsePlanLocalDate(destinationValue))return 'Choose a valid destination date.';
  if(platePlanRescheduleDraft.destinationType==='day'&&!(+destinationValue>0))return 'Choose a destination day.';
  const existingDay=getPlanRescheduleDestinationDay();
  const people=getPlanRescheduleSourceKeys().map(key=>key.endsWith('C')?'Chloe':'Elliott');
  const occupied=getPlanRescheduleCollisionCount();
  const destination=getPlanRescheduleDestinationLabel();
  const collision=occupied?` ${occupied===people.length?'The destination is occupied; choose Swap or Replace after review.':'One destination is occupied; choose how to handle it after review.'}`:'';
  const extension=existingDay||platePlanRescheduleDraft.destinationType==='day'?'':' This date will be added to the active plan.';
  const reason=platePlanRescheduleDraft.reason?` Reason: ${formatPlanSlotReason({code:platePlanRescheduleDraft.reason,note:platePlanRescheduleDraft.note})}.`:' Choose a reason to continue.';
  return `Move ${people.join(' and ')} to ${destination} · ${toTitleCase(platePlanRescheduleDraft.meal)}.${collision}${extension}${reason}`;
}
function renderPlanRescheduleSheet(){
  const body=document.getElementById('plan-reschedule-body');
  const actions=document.getElementById('plan-reschedule-actions');
  if(!body||!actions||!platePlanRescheduleSource||!platePlanRescheduleDraft)return;
  const info=getPlanSlotInfo(state.plan?.slots?.[platePlanRescheduleSource.day]?.[platePlanRescheduleSource.slotKey]);
  const together=planSlotsCanMoveTogether(platePlanRescheduleSource.day,platePlanRescheduleSource.slotKey);
  const person=platePlanRescheduleSource.slotKey.endsWith('C')?'Chloe':'Elliott';
  const sourceLabel=`${formatPlanDayLabel(state.plan,platePlanRescheduleSource.day,{short:true})} · ${toTitleCase(getMealTypeFromSlotKey(platePlanRescheduleSource.slotKey))}`;
  if(platePlanRescheduleDraft.collisionReview){
    const count=getPlanRescheduleCollisionCount();
    body.innerHTML=`<div class="plan-reschedule-summary"><strong>${ppEscapeHtml(info.active?.name||info.recipe?.name||'Planned meal')}</strong><div>${ppEscapeHtml(sourceLabel)}</div></div>
      <section class="plan-reschedule-collision" role="alert">
        <h4>${count>1?'Destination meals already exist':'A destination meal already exists'}</h4>
        <p><strong>Swap</strong> moves the existing ${count>1?'meals':'meal'} back to the original slot. <strong>Replace</strong> removes ${count>1?'them':'it'} and can be immediately undone.</p>
      </section>`;
    actions.innerHTML=`<button class="btn ghost" type="button" onclick="platePlanRescheduleDraft.collisionReview=false;renderPlanRescheduleSheet()">Back</button>
      <button class="btn ghost" type="button" onclick="applyPlanReschedule('swap')">Swap</button>
      <button class="btn danger" type="button" onclick="applyPlanReschedule('replace')">Replace</button>`;
    return;
  }
  const suggestions=getPlanRescheduleSuggestions();
  const selectedKey=`${platePlanRescheduleDraft.destinationType}:${platePlanRescheduleDraft.destinationValue}`;
  const scopeHtml=together?`<section class="plan-reschedule-step"><h4>Move for</h4><div class="plan-choice-grid">
      <button class="plan-choice ${platePlanRescheduleDraft.scope==='both'?'selected':''}" type="button" aria-pressed="${platePlanRescheduleDraft.scope==='both'}" onclick="setPlanRescheduleScope('both')">Elliott and Chloe</button>
      <button class="plan-choice ${platePlanRescheduleDraft.scope==='single'?'selected':''}" type="button" aria-pressed="${platePlanRescheduleDraft.scope==='single'}" onclick="setPlanRescheduleScope('single')">${ppEscapeHtml(person)} only</button>
    </div></section>`:'';
  const destinationHtml=suggestions.map(item=>`<button class="plan-choice ${selectedKey===item.key?'selected':''}" type="button" aria-pressed="${selectedKey===item.key}" onclick="selectPlanRescheduleDestination('${item.type}','${ppEscapeAttr(item.value)}')">${ppEscapeHtml(item.label)}</button>`).join('');
  const reasonHtml=Object.entries(PLAN_SLOT_REASON_LABELS).map(([value,label])=>`<button class="plan-choice ${platePlanRescheduleDraft.reason===value?'selected':''}" type="button" aria-pressed="${platePlanRescheduleDraft.reason===value}" onclick="setPlanRescheduleReason('${value}')">${ppEscapeHtml(label)}</button>`).join('');
  const otherDate=platePlanRescheduleDraft.showOtherDate?`<div class="plan-reschedule-other"><label for="plan-reschedule-other-date">Other date</label><input id="plan-reschedule-other-date" type="date" value="${ppEscapeAttr(platePlanRescheduleDraft.destinationType==='date'?platePlanRescheduleDraft.destinationValue:'')}" onchange="setPlanRescheduleOtherDate(this.value)"></div>`:'';
  const note=platePlanRescheduleDraft.showNote?`<div class="plan-reschedule-note"><label for="plan-reschedule-note">${platePlanRescheduleDraft.reason==='other'?'Description':'Optional note'}</label><input id="plan-reschedule-note" maxlength="80" value="${ppEscapeAttr(platePlanRescheduleDraft.note||'')}" placeholder="Add a short note" oninput="setPlanRescheduleNote(this.value)"></div>`:'';
  body.innerHTML=`<div class="plan-reschedule-summary"><strong>${ppEscapeHtml(info.active?.name||info.recipe?.name||'Planned meal')}</strong><div>${ppEscapeHtml(sourceLabel)}</div></div>
    ${scopeHtml}
    <section class="plan-reschedule-step"><h4>New day</h4><div class="plan-choice-grid">${destinationHtml}<button class="plan-choice ${platePlanRescheduleDraft.showOtherDate?'selected':''}" type="button" onclick="showPlanRescheduleOtherDate()">${planHasCalendarDates()?'Other date':'Assign dates'}</button></div>${otherDate}</section>
    <section class="plan-reschedule-step"><h4>Meal</h4><div class="plan-choice-grid three">${['breakfast','lunch','dinner'].map(value=>`<button class="plan-choice ${platePlanRescheduleDraft.meal===value?'selected':''}" type="button" aria-pressed="${platePlanRescheduleDraft.meal===value}" onclick="setPlanRescheduleMeal('${value}')">${toTitleCase(value)}</button>`).join('')}</div></section>
    <section class="plan-reschedule-step"><h4>Why is the original slot changing?</h4><div class="plan-choice-grid">${reasonHtml}</div><button class="btn sm ghost plan-note-toggle" type="button" onclick="togglePlanRescheduleNote()">${platePlanRescheduleDraft.showNote?'Hide note':'Add note'}</button>${note}</section>
    <div class="plan-reschedule-preview" role="status" aria-live="polite">${ppEscapeHtml(updatePlanReschedulePreview())}</div>`;
  actions.innerHTML=`<button class="btn ghost" type="button" onclick="closePlanRescheduleModal()">Cancel</button><button class="btn primary" type="button" onclick="confirmPlanReschedule()">Review move</button>`;
}
function openPlanReschedule(day,slotKey){
  const info=getPlanSlotInfo(state.plan?.slots?.[day]?.[slotKey]);
  if(!info.active)return showPlatePlanToast('That planned meal is no longer available.');
  closeMobileActionSheet(true);
  const wrap=ensurePlanRescheduleModal();
  platePlanRescheduleSource={day:+day,slotKey,instanceId:info.instanceId};
  const together=planSlotsCanMoveTogether(+day,slotKey);
  const hasDates=planHasCalendarDates();
  let destinationType=hasDates?'date':'day';
  let destinationValue='';
  if(hasDates){
    const sourceDate=state.plan.dayDates?.[day]||getPlatePlanLocalToday();
    const parsed=parsePlanLocalDate(sourceDate)||parsePlanLocalDate(getPlatePlanLocalToday());
    parsed.setDate(parsed.getDate()+1);
    destinationValue=formatPlanLocalDateValue(parsed);
  }else{
    const days=Math.max(+state.plan.days||0,...Object.keys(state.plan.slots||{}).map(Number).filter(Number.isFinite),0);
    destinationValue=String(Math.min(days,+day+1)||day);
  }
  platePlanRescheduleDraft={scope:together?'both':'single',destinationType,destinationValue,meal:getMealTypeFromSlotKey(slotKey)||'dinner',reason:'',note:'',showOtherDate:false,showNote:false,collisionReview:false};
  platePlanLastMobileFocus=document.activeElement;
  wrap.classList.add('open');
  markMobileLayerForBack(wrap,'plan-reschedule');
  renderPlanRescheduleSheet();
  setTimeout(()=>wrap.querySelector('.plan-choice')?.focus(),0);
}
function closePlanRescheduleModal(fromHistory=false){
  const wrap=document.getElementById('plan-reschedule-wrap');if(!wrap)return;
  const marked=wrap.dataset.historyEntry==='1';
  wrap.classList.remove('open');delete wrap.dataset.historyEntry;
  platePlanRescheduleSource=null;
  platePlanRescheduleDraft=null;
  restoreMobileLayerFocus();
  if(marked&&!fromHistory)returnFromPlatePlanUiHistory();
}
function confirmPlanReschedule(){
  if(!platePlanRescheduleSource||!platePlanRescheduleDraft||!state.plan?.slots)return;
  if(platePlanRescheduleDraft.destinationType==='date'&&!parsePlanLocalDate(platePlanRescheduleDraft.destinationValue))return showPlatePlanToast('Choose a valid destination date.');
  if(platePlanRescheduleDraft.destinationType==='day'&&!(+platePlanRescheduleDraft.destinationValue>0))return showPlatePlanToast('Choose a destination day.');
  if(!platePlanRescheduleDraft.reason)return showPlatePlanToast('Choose why the original slot is changing.');
  if(platePlanRescheduleDraft.reason==='other'&&!platePlanRescheduleDraft.note.trim())return showPlatePlanToast('Add a short description for Other.');
  if(getPlanRescheduleCollisionCount()){
    platePlanRescheduleDraft.collisionReview=true;
    renderPlanRescheduleSheet();
    return;
  }
  applyPlanReschedule('move');
}
function applyPlanReschedule(mode='move'){
  if(!platePlanRescheduleSource||!platePlanRescheduleDraft||!state.plan?.slots)return;
  const targetMeal=platePlanRescheduleDraft.meal;
  const reason=platePlanRescheduleDraft.reason;
  const note=platePlanRescheduleDraft.note.trim();
  const destinationType=platePlanRescheduleDraft.destinationType;
  const destinationValue=platePlanRescheduleDraft.destinationValue;
  const sourceItems=getPlanRescheduleSourceKeys().map(slotKey=>{
    const info=getPlanSlotInfo(state.plan.slots?.[platePlanRescheduleSource.day]?.[slotKey]);
    return info.instanceId?{slotKey,instanceId:info.instanceId,personSuffix:slotKey.endsWith('C')?'C':'E'}:null;
  }).filter(Boolean);
  if(!sourceItems.length)return showPlatePlanToast('The planned meal has changed. Reopen Reschedule.');
  platePlanRescheduleUndo={
    plan:clonePlatePlanValue(state.plan),
    excluded:clonePlatePlanValue(state.excluded||{})
  };
  const targetDay=destinationType==='day'?+destinationValue:ensurePlanDayForReschedule(destinationValue);
  const moves=sourceItems.map(item=>{
    const source=findPlanSlotLocation(item.instanceId);
    const targetSlotKey=targetMeal+item.personSuffix;
    return source?{...item,source,targetSlotKey,destination:state.plan.slots?.[targetDay]?.[targetSlotKey]||null}:null;
  }).filter(Boolean);
  if(moves.every(move=>move.source.day===targetDay&&move.source.slotKey===move.targetSlotKey)){
    platePlanRescheduleUndo=null;
    return showPlatePlanToast('That meal is already in the selected slot.');
  }
  moves.forEach(move=>{
    if(!state.plan.slots[targetDay])state.plan.slots[targetDay]=emptyPlanDaySlots();
    state.plan.slots[targetDay][move.targetSlotKey]=move.source.slot;
    setPlanSlotReason(targetDay,move.targetSlotKey,'');
    if(!state.excluded[targetDay])state.excluded[targetDay]={};
    state.excluded[targetDay][move.targetSlotKey]=false;
  });
  moves.forEach(move=>{
    if(move.source.day===targetDay&&moves.some(other=>other.targetSlotKey===move.source.slotKey))return;
    if(move.destination&&mode==='swap'){
      state.plan.slots[move.source.day][move.source.slotKey]=move.destination;
      setPlanSlotReason(move.source.day,move.source.slotKey,'');
    }else{
      state.plan.slots[move.source.day][move.source.slotKey]=null;
      setPlanSlotReason(move.source.day,move.source.slotKey,reason,note);
    }
    if(!state.excluded[move.source.day])state.excluded[move.source.day]={};
    state.excluded[move.source.day][move.source.slotKey]=false;
  });
  const destinationLabel=destinationType==='day'?formatPlanDayLabel(state.plan,targetDay,{short:true}):formatTodayDateLabel(destinationValue);
  closePlanRescheduleModal();
  refreshAfterPlanReschedule(`Meal ${mode==='swap'?'swapped':'rescheduled'} to ${destinationLabel}.`);
}
let platePlanStudioSession=null;
let platePlanStudioApplyUndo=null;
function planStudioFingerprint(plan){return safeJsonStringify(plan||{});}
function ensurePlanStudio(){
  let wrap=document.getElementById('plan-studio-wrap');if(wrap)return wrap;
  wrap=document.createElement('div');wrap.id='plan-studio-wrap';wrap.className='modal-wrap long-workspace plan-studio-wrap';
  wrap.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="plan-studio-title"><div class="workspace-appbar"><div><h2 id="plan-studio-title">Rearrange plan</h2><p>Stage changes across the full plan, then review their impact before applying.</p></div><button class="btn ghost" onclick="closePlanStudio()">Close</button></div><div class="plan-studio-toolbar" id="plan-studio-toolbar"></div><div class="workspace-scroll"><div id="plan-studio-links"></div><div id="plan-studio-grid"></div><div id="plan-studio-impact"></div></div><div class="workspace-actionbar"><button class="btn ghost" onclick="undoPlanStudioChange()">Undo last</button><button class="btn ghost" onclick="resetPlanStudioDraft()">Reset draft</button><button class="btn primary" onclick="applyPlanStudio()">Apply changes</button></div></div>`;
  document.body.appendChild(wrap);return wrap;
}
function openPlanStudio(){
  if(!state.plan?.slots)return showPlatePlanToast('Generate a meal plan first.');
  const wrap=ensurePlanStudio();
  platePlanStudioSession={basePlan:clonePlatePlanValue(state.plan),baseExcluded:clonePlatePlanValue(state.excluded||{}),draftPlan:clonePlatePlanValue(state.plan),draftExcluded:clonePlatePlanValue(state.excluded||{}),baseFingerprint:planStudioFingerprint(state.plan),baseRevision:+platePlanCloudRevisions['plans/current']||0,selected:null,moveTogether:true,reason:'plans_changed',note:'',changes:[],undo:[],collision:null};
  platePlanLastMobileFocus=document.activeElement;wrap.classList.add('open');markMobileLayerForBack(wrap,'plan-studio');renderPlanStudio();
}
function closePlanStudio(fromHistory=false){
  const wrap=document.getElementById('plan-studio-wrap');if(!wrap)return;
  const marked=wrap.dataset.historyEntry==='1';wrap.classList.remove('open');delete wrap.dataset.historyEntry;platePlanStudioSession=null;restoreMobileLayerFocus();if(marked&&!fromHistory)returnFromPlatePlanUiHistory();
}
function planStudioDays(){
  const plan=platePlanStudioSession?.draftPlan;return Object.keys(plan?.slots||{}).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
}
function setPlanStudioReason(value) { if(platePlanStudioSession)platePlanStudioSession.reason=PLAN_SLOT_REASON_LABELS[value]?value:'plans_changed'; }
function setPlanStudioNote(value) { if(platePlanStudioSession)platePlanStudioSession.note=String(value||'').slice(0,80); }
function setPlanStudioMoveTogether(value){if (platePlanStudioSession) { platePlanStudioSession.moveTogether=!!value;renderPlanStudio(); }}
function selectPlanStudioSlot(day,key){
  const session=platePlanStudioSession;if(!session)return;
  const slot=session.draftPlan.slots?.[day]?.[key];
  if(!session.selected){
    if(!slot)return showPlatePlanToast('Choose a meal first, then choose its destination.');
    session.selected={day:+day,key};
    renderPlanStudio();return;
  }
  if (session.selected.day===+day&&session.selected.key===key) { session.selected=null;renderPlanStudio();return; }
  const destination=session.draftPlan.slots?.[day]?.[key]||null;
  if(destination){
    session.collision={day:+day,key};
    renderPlanStudioCollision();return;
  }
  stagePlanStudioMove(+day,key,'move');
}
function renderPlanStudioCollision(){
  const session=platePlanStudioSession;if(!session?.collision)return;
  openAppChoiceModal('Destination occupied','Swap the two meals, or replace the destination meal. The draft remains reversible until Apply changes.',[{label:'Swap meals',value:'swap'},{label:'Replace destination',value:'replace'}],mode=>stagePlanStudioMove(session.collision.day,session.collision.key,mode));
}
function planStudioMoveKeys(source){
  const session=platePlanStudioSession;
  const keys=[source.key];
  const counterpart=getPlanSlotCounterpartKey(source.key);
  if(session.moveTogether&&counterpart&&planSlotsEquivalentInPlan(session.draftPlan,source.day,source.key,counterpart))keys.push(counterpart);
  return keys;
}
function planSlotsEquivalentInPlan(plan,day,key,counterpart){
  const a=getPlanSlotInfo(plan?.slots?.[day]?.[key],plan),b=getPlanSlotInfo(plan?.slots?.[day]?.[counterpart],plan);
  if(!a.active||!b.active)return false;
  const contextA=getPlanContextForInstance(a.instanceId,plan,state.overrides),contextB=getPlanContextForInstance(b.instanceId,plan,state.overrides);
  return a.id===b.id&&a.variant===b.variant&&safeJsonStringify({...contextA,instanceId:null})===safeJsonStringify({...contextB,instanceId:null});
}
function stagePlanStudioMove(targetDay,targetKey,mode){
  const session=platePlanStudioSession,source=session?.selected;if(!session||!source)return;
  if(!session.reason)return showPlatePlanToast('Choose a reason before moving a meal.');
  session.undo.push({draftPlan:clonePlatePlanValue(session.draftPlan),draftExcluded:clonePlatePlanValue(session.draftExcluded),changes:clonePlatePlanValue(session.changes)});
  const sourceKeys=planStudioMoveKeys(source);
  sourceKeys.forEach(sourceKey=>{
    const suffix=sourceKey.endsWith('C')?'C':'E';
    const destinationKey=getMealTypeFromSlotKey(targetKey)+suffix;
    const sourceSlot=session.draftPlan.slots[source.day]?.[sourceKey]||null;
    const destinationSlot=session.draftPlan.slots[targetDay]?.[destinationKey]||null;
    if(!sourceSlot)return;
    if(!session.draftPlan.slots[targetDay])session.draftPlan.slots[targetDay]=emptyPlanDaySlots();
    session.draftPlan.slots[targetDay][destinationKey]=sourceSlot;
    if(mode==='swap'&&destinationSlot)session.draftPlan.slots[source.day][sourceKey]=destinationSlot;
    else session.draftPlan.slots[source.day][sourceKey]=null;
    const reasonKey=getPlanSlotReasonKey(source.day,sourceKey);
    if(!session.draftPlan.slotReasons)session.draftPlan.slotReasons={};
    if(mode==='swap')delete session.draftPlan.slotReasons[reasonKey];
    else session.draftPlan.slotReasons[reasonKey]={code:session.reason,note:session.note||'',updatedAt:new Date().toISOString()};
    session.changes.push({mode,sourceDay:source.day,sourceKey,targetDay,destinationKey,replaced:!!destinationSlot,recipe:getPlanSlotInfo(sourceSlot,session.draftPlan).active?.name||'Meal'});
  });
  session.selected=null;session.collision=null;renderPlanStudio();
}
function undoPlanStudioChange(){
  const session=platePlanStudioSession,last=session?.undo.pop();if(!last)return showPlatePlanToast('There is no staged change to undo.');
  session.draftPlan=last.draftPlan;session.draftExcluded=last.draftExcluded;session.changes=last.changes;session.selected=null;renderPlanStudio();
}
function resetPlanStudioDraft(){
  const session=platePlanStudioSession;if(!session)return;
  session.draftPlan=clonePlatePlanValue(session.basePlan);session.draftExcluded=clonePlatePlanValue(session.baseExcluded);session.changes=[];session.undo=[];session.selected=null;renderPlanStudio();
}
function addPlanStudioDate(){
  const session=platePlanStudioSession,value=document.getElementById('plan-studio-new-date')?.value||'';if(!session||!parsePlanLocalDate(value))return showPlatePlanToast('Choose a valid date.');
  if(Object.values(session.draftPlan.dayDates||{}).includes(value))return showPlatePlanToast('That date is already in the active plan.');
  session.undo.push({draftPlan:clonePlatePlanValue(session.draftPlan),draftExcluded:clonePlatePlanValue(session.draftExcluded),changes:clonePlatePlanValue(session.changes)});
  const oldDays=planStudioDays();const before=oldDays.find(day=>(session.draftPlan.dayDates?.[day]||'')>value);const index=before||((session.draftPlan.days||oldDays.length)+1);
  const slots={},dates={},excluded={};
  oldDays.forEach(day=>{const next=day>=index?day+1:day;slots[next]=session.draftPlan.slots[day];if(session.draftPlan.dayDates?.[day])dates[next]=session.draftPlan.dayDates[day];excluded[next]=session.draftExcluded[day]||Object.fromEntries(SLOTS.map(slot=>[slot.key,false]));});
  const shiftedReasons={};Object.entries(session.draftPlan.slotReasons||{}).forEach(([key,reason])=>{const match=key.match(/^(\d+)\|(.+)$/);if (!match) { shiftedReasons[key]=reason;return; }const day=+match[1];shiftedReasons[getPlanSlotReasonKey(day>=index?day+1:day,match[2])]=reason;});
  slots[index]=emptyPlanDaySlots();dates[index]=value;excluded[index]=Object.fromEntries(SLOTS.map(slot=>[slot.key,false]));
  session.draftPlan.slots=slots;session.draftPlan.dayDates=dates;session.draftPlan.slotReasons=shiftedReasons;session.draftPlan.days=oldDays.length+1;session.draftExcluded=excluded;
  session.changes.forEach(change=>{if(change.sourceDay>=index)change.sourceDay++;if(change.targetDay>=index)change.targetDay++;});if(session.selected?.day>=index)session.selected.day++;
  session.changes.push({mode:'new-date',targetDay:index,recipe:`Added ${formatTodayDateLabel(value)}`});renderPlanStudio();
}
function getPlanStudioImpact(){
  const session=platePlanStudioSession;if(!session)return null;
  const affected=[...new Set(session.changes.flatMap(change=>[change.sourceDay,change.targetDay]).filter(Boolean))];
  const nutrition=affected.map(day=>{
    const totals={E:{cal:0,prot:0},C:{cal:0,prot:0}};
    Object.entries(session.draftPlan.slots?.[day]||{}).forEach(([key,slot])=>{const info=getPlanSlotInfo(slot,session.draftPlan);if(!info.active)return;const n=getPlannedSlotNutrition(info.active,key,info.instanceId,session.draftPlan);const person=key.endsWith('C')?'C':'E';totals[person].cal+=+n?.cal||0;totals[person].prot+=+n?.prot||0;});
    return {day,totals};
  });
  const empty=affected.reduce((sum,day)=>sum+Object.values(session.draftPlan.slots?.[day]||{}).filter(value=>!value).length,0);
  return {affected,nutrition,empty,prepBefore:findMealPrepSuggestions(session.basePlan).length,prepAfter:findMealPrepSuggestions(session.draftPlan).length};
}
function renderPlanStudio(){
  const session=platePlanStudioSession;if(!session)return;
  const toolbar=document.getElementById('plan-studio-toolbar'),links=document.getElementById('plan-studio-links'),grid=document.getElementById('plan-studio-grid'),impact=document.getElementById('plan-studio-impact');if(!toolbar||!grid)return;
  const counterpart=session.selected?getPlanSlotCounterpartKey(session.selected.key):'',canTogether=!!(session.selected&&counterpart&&planSlotsEquivalentInPlan(session.draftPlan,session.selected.day,session.selected.key,counterpart));
  toolbar.innerHTML=`<label>Reason for emptied slots<select onchange="setPlanStudioReason(this.value)">${Object.entries(PLAN_SLOT_REASON_LABELS).map(([value,label])=>`<option value="${value}"${session.reason===value?' selected':''}>${ppEscapeHtml(label)}</option>`).join('')}</select></label><label>Optional note<input maxlength="80" value="${ppEscapeAttr(session.note||'')}" oninput="setPlanStudioNote(this.value)"></label><div class="plan-studio-add-date"><input id="plan-studio-new-date" type="date" aria-label="Add date outside current plan"><button class="btn ghost" onclick="addPlanStudioDate()">Add date</button></div>${canTogether?`<label class="plan-studio-together"><input type="checkbox" ${session.moveTogether?'checked':''} onchange="setPlanStudioMoveTogether(this.checked)"> Move equivalent Elliott and Chloe meals together</label>`:''}`;
  const days=planStudioDays();const today=getPlatePlanLocalToday();
  links.innerHTML=`<nav class="plan-studio-links" aria-label="Plan dates">${days.map(day=>`<a href="#plan-studio-day-${day}" class="${session.draftPlan.dayDates?.[day]===today?'today':''}">${ppEscapeHtml(formatPlanDayLabel(session.draftPlan,day,{short:true}))}</a>`).join('')}</nav>`;
  grid.innerHTML=`<div class="plan-studio-grid">${days.map(day=>`<section class="plan-studio-day" id="plan-studio-day-${day}"><h3>${ppEscapeHtml(formatPlanDayLabel(session.draftPlan,day,{short:true}))}</h3>${['breakfast','lunch','dinner'].map(meal=>`<div class="plan-studio-meal"><strong>${toTitleCase(meal)}</strong>${['E','C'].map(person=>{const key=meal+person,info=getPlanSlotInfo(session.draftPlan.slots?.[day]?.[key],session.draftPlan),selected=session.selected?.day===day&&session.selected?.key===key;return `<button class="plan-studio-slot ${selected?'selected':''} ${info.active?'filled':'empty'}" aria-pressed="${selected}" onclick="selectPlanStudioSlot(${day},'${key}')"><span>${person==='E'?'Elliott':'Chloe'}</span><strong>${ppEscapeHtml(info.active?.name||'Empty')}</strong>${info.variant==='enhanced'?'<small>Enhanced</small>':''}</button>`;}).join('')}</div>`).join('')}</section>`).join('')}</div>`;
  const summary=getPlanStudioImpact();
  impact.innerHTML=`<section class="plan-studio-impact"><h3>Impact review</h3>${session.changes.length?`<ul>${session.changes.map(change=>`<li><strong>${ppEscapeHtml(toTitleCase(change.mode.replace('-',' ')))}</strong> · ${ppEscapeHtml(change.recipe)}${change.sourceDay?` · ${ppEscapeHtml(formatPlanDayLabel(session.draftPlan,change.sourceDay,{short:true}))} → ${ppEscapeHtml(formatPlanDayLabel(session.draftPlan,change.targetDay,{short:true}))}`:''}</li>`).join('')}</ul><div class="plan-studio-nutrition">${summary.nutrition.map(row=>`<div><strong>${ppEscapeHtml(formatPlanDayLabel(session.draftPlan,row.day,{short:true}))}</strong><span>Elliott ${Math.round(row.totals.E.cal)} kcal / P${round1(row.totals.E.prot)}g</span><span>Chloe ${Math.round(row.totals.C.cal)} kcal / P${round1(row.totals.C.prot)}g</span></div>`).join('')}</div><p>${summary.empty} empty selected-person slots across affected days. Meal-prep groupings: ${summary.prepBefore} → ${summary.prepAfter}.</p><div class="msg warn">Shopping will recalculate after moved, swapped or replaced meals are applied.</div>`:'<div class="empty compact">Tap a meal, then tap its destination. No active-plan data changes until Apply changes.</div>'}</section>`;
}
function applyPlanStudio(){
  const session=platePlanStudioSession;if(!session||!session.changes.length)return showPlatePlanToast('Stage at least one change first.');
  const revision=+platePlanCloudRevisions['plans/current']||0;
  if(revision!==session.baseRevision||planStudioFingerprint(state.plan)!==session.baseFingerprint)return openAppInfoModal('Plan changed on another device','Your draft has been preserved, but the active plan changed after Plan Studio opened. Close and reopen Plan Studio to review against the latest plan before applying.');
  runWithRecoveryPoint('Before applying Plan Studio changes',()=>{
    platePlanStudioApplyUndo={plan:clonePlatePlanValue(state.plan),excluded:clonePlatePlanValue(state.excluded||{})};
    state.plan=clonePlatePlanValue(session.draftPlan);state.excluded=clonePlatePlanValue(session.draftExcluded);state.plan.confirmedShopping=false;state.plan.mealPrepGroups=[];state.plan.declinedMealPrepGroups=[];state.plan.score=calculatePlanScore(state.plan);
    platePlanNutritionCache.clear();markPlatePlanViewsDirty();saveState();closePlanStudio();renderPlan();if(document.getElementById('view-today')?.classList.contains('active'))renderToday();showPlatePlanToast('Plan changes applied. Undo is available from the planner.');renderPlanStudioUndoBanner();
  });
}
function renderPlanStudioUndoBanner(){
  const host=document.getElementById('plan-warnings');if(!host||!platePlanStudioApplyUndo)return;
  host.innerHTML=`<div class="msg success">Plan Studio changes applied. <button class="btn sm ghost" onclick="undoAppliedPlanStudio()">Undo</button></div>`;
}
function undoAppliedPlanStudio(){
  if(!platePlanStudioApplyUndo)return;
  state.plan=platePlanStudioApplyUndo.plan;state.excluded=platePlanStudioApplyUndo.excluded;platePlanStudioApplyUndo=null;platePlanNutritionCache.clear();markPlatePlanViewsDirty();saveState();renderPlan();if(document.getElementById('view-today')?.classList.contains('active'))renderToday();showPlatePlanToast('Plan Studio changes undone.');
}
function initExcluded(persist=true){
  ensurePlannerShell();
  const days=parseInt(document.getElementById('plan-days').value)||9;
  const old=state.excluded||{};
  state.excluded={};
  for(let d=1;d<=days;d++){state.excluded[d]={};SLOTS.forEach(s=>state.excluded[d][s.key]=(old[d]&&old[d][s.key])||false);}
  if(persist)saveState();
}
function buildExclGrid() { initExcluded();renderExclGrid(); }
function renderExclGrid(){
  ensurePlannerShell();
  const days=parseInt(document.getElementById('plan-days').value)||9;
  const el=document.getElementById('excl-grid');
  const daySelect=document.getElementById('plan-days');
  if(daySelect && daySelect.options.length < 10){
    daySelect.innerHTML = Array.from({length:10},(_,i)=>`<option value="${i+1}">${i+1} day${i?'s':''}</option>`).join('');
    daySelect.value = String(days);
  }
  let html='';
  for(let d=1;d<=days;d++){
    const draftStart=document.getElementById('plan-start-date')?.value||'';
    const draftDates=buildPlanDayDates(draftStart,days);
    html+=`<div class="meal-slot-card"><h4>${ppEscapeHtml(formatPlanDayLabel({dayDates:draftDates},d,{short:true}))}</h4>
      <div class="meal-slot-grid">
        ${['breakfast','lunch','dinner'].map(meal=>{
          const mode = getSlotMealMode(d, meal);
          const label = meal.charAt(0).toUpperCase()+meal.slice(1);
          return `<div><div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:5px">${label}</div><div class="seg-row">
            ${[['none','None'],['elliott','Elliott'],['chloe','Chloe'],['both','Both']].map(([val,txt])=>`<div class="seg-btn ${val==='both'?'both':''} ${mode===val?'active':''}" onclick="setSlotMealMode(${d},'${meal}','${val}')" title="${val==='both'?'Use the same recipe for Elliott and Chloe':''}">${txt}</div>`).join('')}
          </div></div>`;
        }).join('')}
      </div>
    </div>`;
  }
  el.innerHTML=html;
  renderPlanHistoryPanel();
}
function toggleSlot(day,key){
  if(!state.excluded[day])state.excluded[day]={};
  state.excluded[day][key]=!state.excluded[day][key];
  saveState();renderExclGrid();
}
function inclAll() { const days=parseInt(document.getElementById('plan-days').value)||9;for(let d=1;d<=days;d++)['breakfast','lunch','dinner'].forEach(m=>setSlotMealMode(d,m,'both')); }
function exclAllDinners() { const days=parseInt(document.getElementById('plan-days').value)||9;for(let d=1;d<=days;d++)setSlotMealMode(d,'dinner','none'); }
function exclAllDays() { const days=parseInt(document.getElementById('plan-days').value)||9;for(let d=1;d<=days;d++)['breakfast','lunch','dinner'].forEach(m=>setSlotMealMode(d,m,'none')); }
function plannerOptionHasUsableMappings(option,priority){
  const recipe=option?.variant==='enhanced'&&option.recipe?.enhanced?{...option.recipe,...option.recipe.enhanced,ingredients:option.recipe.enhanced.ingredients||[]} : option?.recipe;
  if(!recipe)return false;
  return (recipe.ingredients||[]).every(ing=>{
    if(ing?.excludeNutrition)return true;
    const groupId=getRecipeIngredientGroupId(ing);
    const preferred=groupId?selectBestProductForGroup(groupId,priority):null;
    const resolved=resolveProductForIngredient(ing,{productSelections:preferred&&groupId?{[groupId]:preferred.id}:{}});
    return !!resolved.product&&isUsableProduct(resolved.product);
  });
}
function explainUnavailablePlanSlot(type,who,priority,trafficRules=null){
  const typed=getPlannerRecipeOptions(type,who,{applyExclusions:false,applyTrafficFilter:false});
  if(!typed.length)return `No ${type} recipes are available for ${who}.`;
  const allowed=getPlannerRecipeOptions(type,who,{applyExclusions:true,applyTrafficFilter:false});
  if(!allowed.length)return `${who}'s exclusions remove every available ${type} recipe.`;
  const traffic=getPlannerRecipeOptions(type,who,{applyExclusions:true,trafficRules});
  if(!traffic.length)return `The selected traffic-light filters remove every ${type} recipe for ${who}.`;
  if(!traffic.some(option=>plannerOptionHasUsableMappings(option,priority)))return `${type} recipes for ${who} need usable Product Bank mappings.`;
  return `No eligible ${type} recipe could be selected for ${who}.`;
}
function showPlanGenerationProblem(title,copy){
  const host=document.getElementById('plan-warnings');
  if(host)host.innerHTML=`<div class="msg error"><strong>${ppEscapeHtml(title)}</strong><div style="margin-top:5px">${ppEscapeHtml(copy)}</div><div class="btn-row" style="margin-top:10px"><button class="btn primary" onclick="includeAllMealsAndGenerate()">Include all meals</button><button class="btn ghost" onclick="openPlanOptionsWorkspace()">Edit plan options</button></div></div>`;
}
function includeAllMealsAndGenerate(){
  const days=parseInt(document.getElementById('plan-days')?.value)||9;
  for(let day=1;day<=days;day++){
    if(!state.excluded[day])state.excluded[day]={};
    ['breakfast','lunch','dinner'].forEach(meal=>{
      state.excluded[day][meal+'E']=false;
      state.excluded[day][meal+'C']=false;
    });
  }
  renderExclGrid();
  generatePlan();
}
function proceedDraftToShopping() { showView('shopping'); }
function confirmAndSaveDraftPlan(){
  if(!state.draftPlan && !state.isDraftPlan){
    showPlatePlanToast('No draft plan to confirm.');
    return;
  }
  const finalized = state.draftPlan || state.plan;
  if(state.draftBackupPlan && state.draftBackupPlan.slots && Object.keys(state.draftBackupPlan.slots).length){
    snapshotCurrentPlan('Previous plan before new generation', defaultPlanSaveName(state.draftBackupPlan));
  }
  state.plan = finalized;
  state.plan.confirmedShopping = true;
  state.plan.updatedAt = new Date().toISOString();
  delete state.draftPlan;
  delete state.draftBackupPlan;
  state.isDraftPlan = false;
  saveState(true);
  if(platePlanCloudReady && !platePlanSyncSuppress) queuePlatePlanCloudDiff();
  markPlatePlanViewsDirty('today', 'planner', 'shopping', 'planlib');
  renderPlan();
  renderShopping();
  if(document.getElementById('view-today')?.classList.contains('active')) renderToday();
  showPlatePlanToast('Meal plan confirmed & saved to cloud! ✓');
}
function discardDraftPlan(){
  if(!state.draftPlan && !state.isDraftPlan){
    showPlatePlanToast('No draft plan to discard.');
    return;
  }
  state.plan = state.draftBackupPlan || state.plan || {};
  delete state.draftPlan;
  delete state.draftBackupPlan;
  state.isDraftPlan = false;
  markPlatePlanViewsDirty('today', 'planner', 'shopping', 'planlib');
  renderPlan();
  renderShopping();
  if(document.getElementById('view-today')?.classList.contains('active')) renderToday();
  showPlatePlanToast('Draft meal plan discarded.');
}
window.proceedDraftToShopping = proceedDraftToShopping;
window.confirmAndSaveDraftPlan = confirmAndSaveDraftPlan;
window.discardDraftPlan = discardDraftPlan;
function generatePlan(){
  ensurePlannerShell();
  const days = parseInt(document.getElementById('wizard-plan-days')?.value || document.getElementById('plan-days')?.value || state.plannerDays || 10, 10) || 10;
  initExcluded(false);
  const selectedSlots=[];
  for(let day=1;day<=days;day++)['breakfast','lunch','dinner'].forEach(meal=>{
    const mode=getSlotMealMode(day,meal);
    if(mode==='elliott'||mode==='both')selectedSlots.push({day,meal,who:'Elliott',key:meal+'E'});
    if(mode==='chloe'||mode==='both')selectedSlots.push({day,meal,who:'Chloe',key:meal+'C'});
  });
  if(!selectedSlots.length){
    showPlanGenerationProblem('No meals selected','Every meal is set to None. Your current meal plan has been kept.');
    return;
  }
  const priority = document.getElementById('plan-product-priority')?.value || state.prefs.productPriority || 'protein';
  const trafficRules=getPlanTrafficFilterRules();
  const prioritiseUseUp=!!state.prefs.prioritiseUseUpProducts&&getUseUpEntries().length>0;
  const usedInNewPlan = new Set();
  const pinnedRecipes = getPinnedRecipesList();
  const slots={};
  const pinnedSlots=new Set();
  for(let d=1;d<=days;d++){
    slots[d]={breakfastE:null,breakfastC:null,lunchE:null,lunchC:null,dinnerE:null,dinnerC:null};
  }
  if(pinnedRecipes.length > 0){
    pinnedRecipes.forEach(pin => {
      const rec = getRecipe(pin.recipeId);
      if(!rec) return;
      const mealType = rec.type || 'dinner';
      const variant = pin.variant || 'original';
      const repeatDays = Math.min(days, Math.max(1, parseInt(pin.daysCount) || 1));
      const targetDay = parseInt(pin.targetDay) || 0;
      let candidateDays = [];
      if(targetDay > 0 && targetDay <= days){
        candidateDays = [targetDay];
        for(let d = 1; d <= days; d++){
          if(d !== targetDay && candidateDays.length < repeatDays) candidateDays.push(d);
        }
      } else { for(let d = 1; d <= days; d++) candidateDays.push(d); }
      let assignedCount = 0;
      for(const d of candidateDays){
        if(assignedCount >= repeatDays) break;
        const mode = getSlotMealMode(d, mealType);
        if(mode === 'none') continue;
        let placed = false;
        if(mode === 'both'){
          slots[d][mealType+'E'] = makePlanSlot(rec.id, variant);
          slots[d][mealType+'C'] = makePlanSlot(rec.id, variant);
          pinnedSlots.add(`${d}:${mealType}E`);
          pinnedSlots.add(`${d}:${mealType}C`);
          placed = true;
        } else if(mode === 'chloe' && (rec.who === 'both' || rec.who === 'any' || rec.who === 'Chloe' || rec.who === 'chloe' || !rec.who)){
          if(!slots[d][mealType+'C']){
            slots[d][mealType+'C'] = makePlanSlot(rec.id, variant);
            pinnedSlots.add(`${d}:${mealType}C`);
            placed = true;
          }
        } else if(mode === 'elliott' && (rec.who === 'both' || rec.who === 'any' || rec.who === 'Elliott' || rec.who === 'elliott' || !rec.who)){
          if(!slots[d][mealType+'E']){
            slots[d][mealType+'E'] = makePlanSlot(rec.id, variant);
            pinnedSlots.add(`${d}:${mealType}E`);
            placed = true;
          }
        }
        if(placed){
          usedInNewPlan.add(rec.id);
          assignedCount++;
        }
      }
    });
  }
  const scoreCandidateOption = (opt, type, who) => {
    let baseScore = 0;
    try {
      const bundle = calculateRecipeDisplayNutrition({ recipe: opt.recipe, variant: opt.variant, mealType: type });
      const portions = bundle?.portions;
      if(portions) {
        let cal = 0, prot = 0;
        if(who === 'Elliott' || who === 'elliott') {
          const fit = calculateFit(portions.eCal, portions.eProt, getTarget('e', 'cal') / 3, getTarget('e', 'prot') / 3);
          baseScore = fit?.score || 0;
          cal = portions.eCal || 0;
          prot = portions.eProt || 0;
        } else if(who === 'Chloe' || who === 'chloe') {
          const fit = calculateFit(portions.cCal, portions.cProt, getTarget('c', 'cal') / 3, getTarget('c', 'prot') / 3);
          baseScore = fit?.score || 0;
          cal = portions.cCal || 0;
          prot = portions.cProt || 0;
        } else {
          const fitE = calculateFit(portions.eCal, portions.eProt, getTarget('e', 'cal') / 3, getTarget('e', 'prot') / 3);
          const fitC = calculateFit(portions.cCal, portions.cProt, getTarget('c', 'cal') / 3, getTarget('c', 'prot') / 3);
          baseScore = ((fitE?.score || 0) + (fitC?.score || 0)) / 2;
          cal = ((portions.eCal || 0) + (portions.cCal || 0)) / 2;
          prot = ((portions.eProt || 0) + (portions.cProt || 0)) / 2;
        }
        const proteinDensity = cal > 0 ? (prot / cal) * 100 : 0;
        baseScore -= Math.min(2.0, proteinDensity * 0.1);
      }
    } catch(e){}
    if(opt.variant === 'enhanced') {
      baseScore -= 0.5; // Natural bonus for enhanced variants
    }
    return baseScore;
  };
  const choose = (type, who, shared=false) => {
    let p = getPlannerRecipeOptions(type, shared ? 'any' : who, { applyExclusions:true, avoidHistory:true, trafficRules });
    if(shared) p = p.filter(opt => opt.recipe?.who === 'both');
    p=p.filter(option=>plannerOptionHasUsableMappings(option,priority));
    let fresh = p.filter(opt => !usedInNewPlan.has(opt.id));
    if(!fresh.length) fresh = p;
    if(!fresh.length && !shared) fresh = getPlannerRecipeOptions(type, who, { applyExclusions:true, trafficRules }).filter(option=>plannerOptionHasUsableMappings(option,priority));
    if (prioritiseUseUp) { fresh = rankPlannerOptionsForUseUp(fresh, type, shared ? 'both' : who); } else if(fresh.length > 1) {
      fresh = fresh.map(opt => ({
        opt,
        score: scoreCandidateOption(opt, type, shared ? 'both' : who) + (Math.random() * 0.12)
      })).sort((a, b) => a.score - b.score).map(item => item.opt);
    }
    let picked = null;
    if (prioritiseUseUp) { picked = fresh[0] || null; } else if(fresh.length > 0) {
      const topPoolSize = Math.min(fresh.length, 3);
      picked = fresh[Math.floor(Math.random() * topPoolSize)] || fresh[0] || null;
    } else { picked = fresh[0] || null; }
    if(picked) usedInNewPlan.add(picked.id);
    return picked;
  };
  const unresolved=[];
  for(let d=1;d<=days;d++){
      ['breakfast','lunch','dinner'].forEach(meal => {
        const mode = getSlotMealMode(d, meal);
        if(mode === 'none') return;
        if(mode === 'both'){
          const hasE = !!slots[d][meal+'E'];
          const hasC = !!slots[d][meal+'C'];
          if(hasE && hasC) return;
          if(!hasE && !hasC){
            const rec = choose(meal, 'any', true);
            if(rec){
              slots[d][meal+'E'] = makePlanSlot(rec.id, rec.variant);
              slots[d][meal+'C'] = makePlanSlot(rec.id, rec.variant);
            } else {
              const recE = choose(meal, 'Elliott', false);
              const recC = choose(meal, 'Chloe', false);
              if(recE) slots[d][meal+'E'] = makePlanSlot(recE.id, recE.variant);
              else unresolved.push({day:d,meal,who:'Elliott',key:meal+'E'});
              if(recC) slots[d][meal+'C'] = makePlanSlot(recC.id, recC.variant);
              else unresolved.push({day:d,meal,who:'Chloe',key:meal+'C'});
            }
          } else if(!hasE){
            const recE = choose(meal, 'Elliott', false);
            if(recE) slots[d][meal+'E'] = makePlanSlot(recE.id, recE.variant);
            else unresolved.push({day:d,meal,who:'Elliott',key:meal+'E'});
          } else if(!hasC){
            const recC = choose(meal, 'Chloe', false);
            if(recC) slots[d][meal+'C'] = makePlanSlot(recC.id, recC.variant);
            else unresolved.push({day:d,meal,who:'Chloe',key:meal+'C'});
          }
          return;
        }
        const who = mode === 'chloe' ? 'Chloe' : 'Elliott';
        const key = meal + (mode === 'chloe' ? 'C' : 'E');
        if(slots[d][key]) return;
        const rec = choose(meal, who, false);
        if(rec) slots[d][key] = makePlanSlot(rec.id, rec.variant);
        else unresolved.push({day:d,meal,who,key});
      });
  }
  const cadence = getMealRepeatCadence();
  const applyCadence = (meal, blockSize) => {
    if(blockSize <= 1) return;
    for(let start = 1; start <= days; start += blockSize){
      const blockDays = [];
      for(let d = start; d <= Math.min(days, start + blockSize - 1); d++) blockDays.push(d);
      ['E','C'].forEach(personSuffix => {
        const key = meal + personSuffix;
        const sourceDay = blockDays.find(d => !state.excluded?.[d]?.[key] && slots[d]?.[key]);
        if(!sourceDay) return;
        const sourceSlot = slots[sourceDay][key];
        blockDays.forEach(d => {
          if(d === sourceDay || state.excluded?.[d]?.[key]) return;
          if(pinnedSlots.has(`${d}:${key}`)) return;
          if(!slots[d]) slots[d] = {};
          slots[d][key] = makePlanSlot(sourceSlot.id, sourceSlot.variant || 'original');
        });
      });
    }
  };
  applyCadence('breakfast', cadence.breakfast);
  applyCadence('lunch', cadence.lunch);
  applyCadence('dinner', cadence.dinner);
  Object.entries(slots).forEach(([day,daySlots])=>Object.entries(daySlots).forEach(([key,slot])=>{
    if(!slot)return;
    const info=getPlanSlotInfo(slot);
    const who=key.endsWith('C')?'Chloe':'Elliott';
    const meal=getMealTypeFromSlotKey(key);
    const row={recipe:info.recipe,variant:info.variant||'original'};
    if(!plannerRecipePassesTrafficFilter(row,meal,who,trafficRules)){
      daySlots[key]=null;
      unresolved.push({day:+day,meal,who,key,reason:'traffic-audit'});
    }
  }));
  let productSelections = lockProductSelectionsForSlots(slots, priority);
  if(prioritiseUseUp)productSelections=applyUseUpSelectionsToPlan(slots,productSelections);
  const blockers = findProductResolutionBlockersForSlots(slots, productSelections);
  if(blockers.length){
    Object.entries(slots).forEach(([day,daySlots])=>Object.entries(daySlots).forEach(([key,slot])=>{
      if(!slot)return;
      const single={1:{[key]:slot}};
      if(findProductResolutionBlockersForSlots(single,lockProductSelectionsForSlots(single,priority)).length){
        const meal=getMealTypeFromSlotKey(key);
        const who=key.endsWith('C')?'Chloe':'Elliott';
        daySlots[key]=null;
        unresolved.push({day:+day,meal,who,key});
      }
    }));
    productSelections=lockProductSelectionsForSlots(slots,priority);
    if(prioritiseUseUp)productSelections=applyUseUpSelectionsToPlan(slots,productSelections);
  }
  const remainingUnresolved=unresolved.filter(item=>!slots[item.day]?.[item.key]);
  const filled=selectedSlots.filter(item=>slots[item.day]?.[item.key]).length;
  if(!filled){
    const reason=remainingUnresolved.length?explainUnavailablePlanSlot(remainingUnresolved[0].meal,remainingUnresolved[0].who,priority,trafficRules):'No eligible recipes were found.';
    showPlanGenerationProblem('No meals could be generated',`${reason} Your current meal plan has been kept.`);
    return;
  }
  const planStartInput = document.getElementById('wizard-plan-start')?.value || document.getElementById('plan-start-date')?.value || state.plannerStartDate || getPlatePlanLocalToday();
  const warningMessages=[...new Set(remainingUnresolved.map(item=>`${formatPlanDayLabel({dayDates:buildPlanDayDates(planStartInput,days)},item.day,{short:true})} ${item.meal} for ${item.who}: ${explainUnavailablePlanSlot(item.meal,item.who,priority,trafficRules)}`))];
  state.overrides = {};
  const dayDates=buildPlanDayDates(planStartInput,days);
  state.prefs.productPriority = priority;
  state.prefs.mealRepeatCadence = cadence;
  state.prefs.planTrafficE = trafficRules.e;
  state.prefs.planTrafficC = trafficRules.c;
  const nextPlan = {days,slots,dayDates,slotReasons:{},productPriority:priority,trafficFilter:{ e: state.prefs.planTrafficE, c: state.prefs.planTrafficC },mealRepeatCadence:cadence,productSelections,useUpProductIds:prioritiseUseUp?getUseUpEntries().map(entry=>entry.productId):[],shoppingAtHome:{},warnings:warningMessages,score:null,confirmedShopping:false,mealPrepGroups:[],declinedMealPrepGroups:[],updatedAt:new Date().toISOString()};
  nextPlan.score = calculatePlanScore(nextPlan);
  platePlanEarlierDaysExpanded = false;
  const autoPrepSuggestions = findMealPrepSuggestions(nextPlan).filter(s => {
    const repeat = cadence[s.mealKey] || 1;
    return repeat > 1 && (s.days || []).length >= repeat;
  });
  nextPlan.mealPrepGroups = autoPrepSuggestions.map(s => ({ key:s.key, recipeId:s.recipeId, variant:s.variant, mealKey:s.mealKey, peopleKey:s.peopleKey, days:s.days }));
  state.draftBackupPlan = clonePlatePlanValue(state.plan || {});
  state.draftPlan = nextPlan;
  state.isDraftPlan = true;
  state.plan = nextPlan;
  state.plannerStep = 2;
  markPlatePlanViewsDirty('today', 'planner', 'shopping', 'planlib');
  renderPlan();
  closePlanOptionsWorkspace();
  const message=`Generated ${filled} of ${selectedSlots.length} selected meals (Step 1: Review Plan).`;
  showPlatePlanToast(message);
  if(remainingUnresolved.length){
    const host=document.getElementById('plan-warnings');
    if(host)host.innerHTML=`<div class="msg warn"><strong>${ppEscapeHtml(message)}</strong><div style="margin-top:5px">${warningMessages.slice(0,6).map(ppEscapeHtml).join('<br>')}${warningMessages.length>6?`<br>And ${warningMessages.length-6} more unresolved meals.`:''}</div><button class="btn sm ghost" style="margin-top:9px" onclick="openPlanOptionsWorkspace()">Edit plan options</button></div>`;
  }
}
function getSlotPersonPrefix(slotKey) { return String(slotKey || '').endsWith('E') ? 'e' : String(slotKey || '').endsWith('C') ? 'c' : ''; }
function getPlannedSlotNutrition(recipe, slotKey, instanceId, planContext = state.plan){
  if(!recipe) return null;
  const mealType = getMealTypeFromSlotKey(slotKey) || (recipe.types && recipe.types[0]) || recipe.type || 'dinner';
  const bundle = calculateRecipeDisplayNutrition({ recipe, ingredients:recipe.ingredients || [], serves:recipe.serves || 1, who:recipe.who || 'both', mealType, instanceId, planContext });
  const recalc = bundle?.nutrition || { cal:0, prot:0 };
  const portions = bundle?.portions || calcPortions(recalc.perServing || recalc, state.prefs, recipe.serves || 1, recipe.who || 'both', mealType);
  const prefix = getSlotPersonPrefix(slotKey);
  if(prefix === 'e') return portions.ePct > 0 ? { cal: portions.eCal, prot: portions.eProt, portions } : { cal: 0, prot: 0, portions };
  if(prefix === 'c') return portions.cPct > 0 ? { cal: portions.cCal, prot: portions.cProt, portions } : { cal: 0, prot: 0, portions };
  return { cal: recalc.cal, prot: recalc.prot, portions };
}
function getSlotShoppingScale(recipe, slotKey, instanceId = null, planContext = state.plan, overrideStore = state.overrides) {
  if(!recipe) return 1;
  const serves = +recipe.serves || 1;
  const mealType = getMealTypeFromSlotKey(slotKey) || (recipe.types && recipe.types[0]) || recipe.type || 'dinner';
  const bundle = calculateRecipeDisplayNutrition({
    recipe:null,
    ingredients:recipe.ingredients || [],
    serves,
    who:recipe.who || 'both',
    mealType,
    instanceId,
    planContext,
    overrideStore
  });
  const portions = bundle?.portions || calcPortions({}, state.prefs, serves, recipe.who || 'both', mealType);
  const servingShare = String(slotKey || '').endsWith('C') ? portions.cSingleServ : portions.eSingleServ;
  return serves > 0 ? Math.max(servingShare, 0) / serves : 1;
}
function getShoppingAmount(ing, bankIng, scale = 1) {
  if(typeof ing !== 'object') return { qty: 0, unit: 'g', grams: 0, label: '' };
  const unit = (ing.unit || '').toLowerCase().replace(/s$/,'');
  const qty = (+ing.qty || 0) * scale;
  const grams = getEffectiveIngredientGrams(ing, bankIng) * scale;
  if(unit === 'kg') return { qty: qty * 1000, unit: 'g', grams, label: `${Math.round(qty * 1000)}g` };
  if(unit === 'g') return { qty, unit: 'g', grams, label: `${Math.round(qty)}g` };
  if(unit === 'l') return { qty: qty * 1000, unit: 'ml', grams, label: `${Math.round(qty * 1000)}ml` };
  if(unit === 'ml') return { qty, unit: 'ml', grams, label: `${Math.round(qty)}ml` };
  if(unit === 'qty') return { qty, unit: 'item', grams, label: `${Math.round(qty * 10) / 10} item${qty === 1 ? '' : 's'}` };
  return { qty: grams, unit: 'g', grams, label: `${Math.round(grams)}g` };
}
function formatGarlicBulbCloveAmount(grams){
  const g = +grams || 0;
  if(g <= 0) return '';
  const cloves = Math.max(1, Math.round(g / 6));
  const bulbs = Math.floor(cloves / 11);
  const remainder = cloves % 11;
  const parts = [];
  if(bulbs > 0) parts.push(`${bulbs} bulb${bulbs === 1 ? '' : 's'}`);
  if(remainder > 0) parts.push(`${remainder} clove${remainder === 1 ? '' : 's'}`);
  return parts.join(' and ');
}
function formatRecipePackIngredientAmount(ing, bankIng, amount){
  if(ing?.stockWaterMl) {
    const stockText = formatStockIngredientText(ing, amount?.qty && ing.qty ? amount.qty / ing.qty : 1);
    if(stockText) return stockText;
  }
  if(isFreshGarlicIngredient(ing, bankIng) && amount?.grams > 0) {
    const garlic = formatGarlicBulbCloveAmount(amount.grams);
    if(garlic) return `${garlic} garlic`;
  }
  const name = (ing?.name || bankIng?.name || '').trim();
  const unit = amount?.unit || 'g';
  const qty = +amount?.qty || 0;
  if(unit === 'ml') return `${Math.round(qty)}ml ${name}`.trim();
  if(unit === 'item') return `${Math.round(qty * 10) / 10} ${name}`.trim();
  return `${Math.round(qty)}g ${name}`.trim();
}
function togglePlatePlanEarlierDays(){
  platePlanEarlierDaysExpanded=!platePlanEarlierDaysExpanded;
  renderPlan();
  if(platePlanEarlierDaysExpanded){
    setTimeout(()=>document.getElementById('plan-earlier-days-heading')?.scrollIntoView({block:'start',behavior:'smooth'}),0);
  }
}
function checkIsPlanExpired(plan, localToday){
  if(!plan || !plan.slots) return false;
  const days = plan.days || Object.keys(plan.slots).length || 0;
  if(!days) return false;
  const datedEntries = Object.entries(plan.dayDates || {}).filter(([, v]) => !!parsePlanLocalDate(v));
  if(!datedEntries.length) return false;
  const dates = datedEntries.map(([, v]) => v).sort();
  const maxDate = dates[dates.length - 1];
  return maxDate < localToday;
}
function getTomorrowLocalDate(){
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function generateNewPlanStartingTomorrow(){
  const tomorrow = getTomorrowLocalDate();
  const startInput = document.getElementById('plan-start-date');
  if(startInput) startInput.value = tomorrow;
  const quickStartInput = document.getElementById('plan-quick-start');
  if(quickStartInput) quickStartInput.value = tomorrow;
  const days = state.plan?.days || parseInt(document.getElementById('plan-days')?.value, 10) || 7;
  if (state.plan) { state.plan.dayDates = buildPlanDayDates(tomorrow, days); }
  const setupCard = document.getElementById('plan-setup-card');
  if(setupCard) setupCard.style.display = '';
  generatePlan();
  showPlatePlanToast('Generated new meal plan starting tomorrow!');
}
function openPlanSetupAndFocus(){
  const setupCard = document.getElementById('plan-setup-card');
  if(setupCard){
    setupCard.style.display = '';
    setupCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const tomorrow = getTomorrowLocalDate();
  const startInput = document.getElementById('plan-start-date');
  if(startInput && !startInput.value) startInput.value = tomorrow;
}
function formatPlanDateShort(dateString){
  if(!dateString) return '';
  const date = parsePlanLocalDate(dateString);
  if(!date) return String(dateString);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}
window.formatPlanDateShort = formatPlanDateShort;
function getPlannerWizardStep() { return window.GeneratorWizardModal?.getPlannerWizardStep?.(state) || (state.plannerStep && [1, 2, 3, 4].includes(state.plannerStep) ? state.plannerStep : (state.plan?.slots && Object.keys(state.plan.slots).length > 0 ? 2 : 1)); }
function setPlannerWizardStep(step) {
  state.plannerStep = Math.max(1, Math.min(4, step));
  if (window.state) window.state.plannerStep = state.plannerStep;
  renderPlannerWizard();
}
window.setPlannerWizardStep = setPlannerWizardStep;
window.goToPlannerStep = setPlannerWizardStep;
function getActiveWizardExclusions() {
  const list = [];
  const excluded = state.excluded || {};
  Object.entries(excluded).forEach(([day, slots]) => {
    if (!slots) return;
    const d = parseInt(day, 10);
    ['breakfast', 'lunch', 'dinner'].forEach(meal => {
      const eExcl = !!slots[meal + 'E'];
      const cExcl = !!slots[meal + 'C'];
      if (eExcl && cExcl) {
        list.push({ day: d, meal, who: 'Both', keys: [meal + 'E', meal + 'C'], label: `Day ${d} ${meal.charAt(0).toUpperCase() + meal.slice(1)} (Both)` });
      } else if (eExcl) {
        list.push({ day: d, meal, who: 'Elliott', keys: [meal + 'E'], label: `Day ${d} ${meal.charAt(0).toUpperCase() + meal.slice(1)} (Elliott)` });
      } else if (cExcl) {
        list.push({ day: d, meal, who: 'Chloe', keys: [meal + 'C'], label: `Day ${d} ${meal.charAt(0).toUpperCase() + meal.slice(1)} (Chloe)` });
      }
    });
  });
  return list;
}
function removeWizardExclusion(day, keys) {
  if (!state.excluded || !state.excluded[day]) return;
  (Array.isArray(keys) ? keys : [keys]).forEach(k => {
    state.excluded[day][k] = false;
  });
  saveState();
  renderPlannerWizard();
}
window.removeWizardExclusion = removeWizardExclusion;
function addWizardExclusionFromUI() {
  const day = parseInt(document.getElementById('wizard-excl-day')?.value, 10) || 1;
  const meal = document.getElementById('wizard-excl-meal')?.value || 'all';
  const person = document.getElementById('wizard-excl-person')?.value || 'both';
  state.excluded = state.excluded || {};
  state.excluded[day] = state.excluded[day] || {};
  const meals = meal === 'all' ? ['breakfast', 'lunch', 'dinner'] : [meal];
  meals.forEach(m => {
    if (person === 'both' || person === 'elliott') state.excluded[day][m + 'E'] = true;
    if (person === 'both' || person === 'chloe') state.excluded[day][m + 'C'] = true;
  });
  saveState();
  renderPlannerWizard();
}
window.addWizardExclusionFromUI = addWizardExclusionFromUI;
function skipAllWizardDinners() {
  const days = state.plannerDays || parseInt(document.getElementById('wizard-plan-days')?.value, 10) || 10;
  state.excluded = state.excluded || {};
  for (let d = 1; d <= days; d++) {
    state.excluded[d] = state.excluded[d] || {};
    state.excluded[d]['dinnerE'] = true;
    state.excluded[d]['dinnerC'] = true;
  }
  saveState();
  renderPlannerWizard();
}
window.skipAllWizardDinners = skipAllWizardDinners;
function clearAllWizardExclusions() {
  initExcluded(true);
  renderPlannerWizard();
}
window.clearAllWizardExclusions = clearAllWizardExclusions;
function filterWizardPinRecipes(query) {
  const container = document.getElementById('wizard-pin-search-results');
  if (!container) return;
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  const matches = (state.recipes || []).filter(r => String(r?.name || '').toLowerCase().includes(q)).slice(0, 6);
  if (!matches.length) {
    container.style.display = 'block';
    container.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--text3)">No recipes found.</div>';
    return;
  }
  const targetDay = parseInt(document.getElementById('wizard-pin-day')?.value, 10) || 1;
  container.style.display = 'block';
  container.innerHTML = matches.map(r => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--border)">
      <span style="font-size:12px;font-weight:600">${ppEscapeHtml(r.name)}</span>
      <button type="button" class="btn sm primary" style="font-size:11px;padding:2px 8px" onclick="pinWizardRecipe('${ppEscapeAttr(r.id)}', ${targetDay})">+ Pin Day ${targetDay}</button>
    </div>
  `).join('');
}
window.filterWizardPinRecipes = filterWizardPinRecipes;
function pinWizardRecipe(recipeId, day) {
  state.pinnedRecipes = state.pinnedRecipes || [];
  state.pinnedRecipes = state.pinnedRecipes.filter(p => p.recipeId !== recipeId);
  state.pinnedRecipes.push({ recipeId, targetDay: day, daysCount: 1, variant: 'original' });
  saveState();
  renderPlannerWizard();
}
window.pinWizardRecipe = pinWizardRecipe;
function unpinWizardRecipe(recipeId) {
  state.pinnedRecipes = (state.pinnedRecipes || []).filter(p => p.recipeId !== recipeId);
  saveState();
  renderPlannerWizard();
}
window.unpinWizardRecipe = unpinWizardRecipe;
function filterWizardUseUpProducts(query) {
  const container = document.getElementById('wizard-useup-search-results');
  if (!container) return;
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  const matches = (state.ingredients || []).filter(p => {
    const name = String(p?.name || '').toLowerCase();
    const brand = String(p?.brand || '').toLowerCase();
    return name.includes(q) || brand.includes(q);
  }).slice(0, 6);
  if (!matches.length) {
    container.style.display = 'block';
    container.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--text3)">No products found.</div>';
    return;
  }
  container.style.display = 'block';
  container.innerHTML = matches.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--border)">
      <span style="font-size:12px;font-weight:600">${ppEscapeHtml(p.name)} <span style="color:var(--text3);font-size:11px">(${ppEscapeHtml(p.brand || 'No brand')})</span></span>
      <button type="button" class="btn sm primary" style="font-size:11px;padding:2px 8px" onclick="addWizardUseUpProduct('${ppEscapeAttr(p.id)}')">+ Use Up</button>
    </div>
  `).join('');
}
window.filterWizardUseUpProducts = filterWizardUseUpProducts;
function addWizardUseUpProduct(productId) {
  state.useUpProducts = state.useUpProducts || [];
  if (!state.useUpProducts.includes(productId)) {
    state.useUpProducts.push(productId);
  }
  state.prefs = state.prefs || {};
  state.prefs.prioritiseUseUpProducts = true;
  saveState();
  renderPlannerWizard();
}
window.addWizardUseUpProduct = addWizardUseUpProduct;
function removeWizardUseUpProduct(productId) {
  state.useUpProducts = (state.useUpProducts || []).filter(id => id !== productId);
  saveState();
  renderPlannerWizard();
}
window.removeWizardUseUpProduct = removeWizardUseUpProduct;
if (!window.state) window.state = {};
window.state.deletedPlanIds = window.state.deletedPlanIds || [];
window.deletedPlanIds = window.deletedPlanIds || window.state.deletedPlanIds;
async function deletePlan(planId) {
  if (!window.state) window.state = {};
  const previousPlan = window.state.plan ? clonePlatePlanValue(window.state.plan) : {};
  window.state.plan = {};
  if (typeof state !== 'undefined' && state) {
    state.plan = {};
  }
  localStorage.removeItem('plateplan_plan_backup');
  if (typeof renderPlanHistory === 'function') renderPlanHistory();
  if (typeof renderPlan === 'function') renderPlan();
  renderAll();
  try {
    const householdId = window.activeHouseholdId || window.state?.meta?.householdId || 'elliott-chloe';
    const db = window.platePlanDb || (window.firebase && window.firebase.firestore && window.firebase.firestore());
    if (db) {
      const householdDocRef = db.collection('households').doc(householdId);
      await householdDocRef.collection('plans').doc('current').delete();
      const fb = window.firebase || (window.PLATEPLAN_FIREBASE && window.PLATEPLAN_FIREBASE.firebase) || (window.firebaseObj);
      if (fb) {
        await householdDocRef.update({ plan: fb.firestore.FieldValue.delete() });
      }
      showPlatePlanToast('Plan deleted successfully. ✓');
    }
  } catch (err) {
    console.error('[PLAN DELETE ERROR - ROLLING BACK]', err);
    window.state.plan = previousPlan;
    if (typeof state !== 'undefined' && state) { state.plan = previousPlan; }
    if (typeof renderPlanHistory === 'function') renderPlanHistory();
    if (typeof renderPlan === 'function') renderPlan();
    renderAll();
    showPlatePlanToast('Failed to delete plan from cloud. Plan restored.', 'error');
  }
}
window.deletePlan = deletePlan;
async function persistProductToBank(newProduct) {
  if (!newProduct) throw new Error('Cannot persist empty product');
  if (!newProduct.id) newProduct.id = 'ing' + Date.now();
  if (!newProduct.updatedAt) newProduct.updatedAt = new Date().toISOString();
  if (!Array.isArray(window.state.products)) {
    window.state.products = Array.isArray(window.state.ingredients) ? [...window.state.ingredients] : (Array.isArray(state?.ingredients) ? [...state.ingredients] : []);
  }
  if (!Array.isArray(state.products)) {
    state.products = window.state.products;
  }
  if (!Array.isArray(state.ingredients)) {
    state.ingredients = [];
  }
  if (!Array.isArray(window.state.ingredients)) {
    window.state.ingredients = state.ingredients;
  }
  const pIdx = window.state.products.findIndex(p => p && p.id === newProduct.id);
  if (pIdx > -1) { window.state.products[pIdx] = newProduct; } else { window.state.products.push(newProduct); }
  const iIdx = state.ingredients.findIndex(p => p && p.id === newProduct.id);
  if (iIdx > -1) { state.ingredients[iIdx] = newProduct; } else { state.ingredients.push(newProduct); }
  rebuildPlatePlanIndexes();
  const householdId = window.CURRENT_HOUSEHOLD_ID || window.activeHouseholdId || state?.meta?.householdId || 'elliott-chloe';
  const cleaned = sanitizePayloadForFirestore(unwrapAndCleanItem(newProduct));
  let firestorePromise = null;
  const db = platePlanDb || (window.firebase && firebase.firestore && firebase.firestore());
  if (db) {
    const writeProducts = db.collection('households').doc(householdId).collection('products').doc(newProduct.id).set(cleaned, { merge: true });
    const writeIngredients = db.collection('households').doc(householdId).collection('ingredients').doc(newProduct.id).set(cleaned, { merge: true });
    firestorePromise = Promise.all([writeProducts, writeIngredients]).catch(err => {
      console.warn('[v3.0.4 STATE PERSISTENCE] persistProductToBank Firestore write warning:', err);
    });
  } else { firestorePromise = Promise.resolve(); }
  try {
    safeLocalStorageSet(SK, safeJsonStringify(state));
  } catch(e) {}
  await Promise.race([firestorePromise, new Promise(r => setTimeout(r, 200))]);
  return newProduct;
}
window.persistProductToBank = persistProductToBank;
function openSearchableRecipeSwapModal(day, slotKey, isShared = false) { return window.PlannerMealSlot?.openSearchableRecipeSwapModal?.(day, slotKey, isShared); }
window.openSearchableRecipeSwapModal = openSearchableRecipeSwapModal;
function closeSearchableRecipeSwapModal() { return window.PlannerMealSlot?.closeSearchableRecipeSwapModal?.(); }
window.closeSearchableRecipeSwapModal = closeSearchableRecipeSwapModal;
function filterSearchableRecipeSwapModal(query = '') { return window.PlannerMealSlot?.filterSearchableRecipeSwapModal?.(query); }
window.filterSearchableRecipeSwapModal = filterSearchableRecipeSwapModal;
function selectAndSwapRecipe(recipeId, variant = 'original') { return window.PlannerMealSlot?.selectAndSwapRecipe?.(recipeId, variant); }
window.selectAndSwapRecipe = selectAndSwapRecipe;
function toggleInlineSwapPanel(day, slotKey) { openSearchableRecipeSwapModal(day, slotKey); }
window.toggleInlineSwapPanel = toggleInlineSwapPanel;
function executeInlineMealSwap(day, slotKey, recipeId, variant = 'original') { selectAndSwapRecipe(recipeId, variant); }
window.executeInlineMealSwap = executeInlineMealSwap;
function toggleShoppingAtHome(itemKey) {
  state.plan = state.plan || {};
  state.plan.shoppingAtHome = state.plan.shoppingAtHome || {};
  state.plan.shoppingAtHome[itemKey] = !state.plan.shoppingAtHome[itemKey];
  saveState();
  renderPlannerWizard();
}
window.toggleShoppingAtHome = toggleShoppingAtHome;
function toggleInlineShoppingSubst(itemKey, groupId) {
  const panel = document.getElementById(`subst-drawer-${itemKey}`);
  if (!panel) return;
  if (panel.style.display !== 'none') {
    panel.style.display = 'none';
    panel.innerHTML = '';
    return;
  }
  const products = getGroupProducts(groupId);
  panel.innerHTML = window.ShoppingItemRow?.renderSubstDrawerContent(groupId, products) || '<div style="font-size:12px;color:var(--text3);padding:6px">No alternate products found.</div>';
  panel.style.display = 'block';
}
window.toggleInlineShoppingSubst = toggleInlineShoppingSubst;
function selectShoppingProductOverride(groupId, productId) {
  state.plan = state.plan || {};
  state.plan.productSelections = state.plan.productSelections || {};
  state.plan.productSelections[groupId] = productId;
  saveState();
  renderPlannerWizard();
  showPlatePlanToast('Product preference updated! ✓');
}
window.selectShoppingProductOverride = selectShoppingProductOverride;
function resetPlannerStartFresh() {
  if (state) {
    state.draftPlan = null;
    state.draftBackupPlan = null;
    state.isDraftPlan = false;
    state.plannerStep = 1;
    state.pinnedRecipes = [];
    state.useUpProducts = [];
    if (state.planOptions) {
      state.planOptions.pinnedMeals = [];
      state.planOptions.useUp = [];
    }
  }
  if (window.state) {
    window.state.draftPlan = null;
    window.state.draftBackupPlan = null;
    window.state.isDraftPlan = false;
    window.state.plannerStep = 1;
  }
  const today = new Date().toISOString().split('T')[0];
  const startInp = document.getElementById('wizard-plan-start');
  if (startInp) startInp.value = today;
  state.plannerStartDate = today;
  const daysInp = document.getElementById('wizard-plan-days');
  if (daysInp) daysInp.value = '10';
  state.plannerDays = 10;
  saveState();
  renderPlannerWizard();
  showPlatePlanToast('Meal planner reset to Step 1. ✓');
}
window.resetPlannerStartFresh = resetPlannerStartFresh;
function commitPlannerWizardPlan() {
  if (!state.plan || !state.plan.slots) {
    showPlatePlanToast('No active plan found to commit.');
    return;
  }
  const currentPlan = state.plan;
  const committedPlan = {
    ...currentPlan,
    score: calculatePlanScore(currentPlan),
    mealPrepGroups: currentPlan.mealPrepGroups || [],
    appliedAt: new Date().toISOString(),
    savedStatus: 'Saved',
    shoppingAtHome: currentPlan.shoppingAtHome || {},
    version: '3.8.4',
    confirmedShopping: true,
    updatedAt: new Date().toISOString()
  };
  state.plan = committedPlan;
  window.state = state;
  delete state.draftPlan;
  delete state.draftBackupPlan;
  state.isDraftPlan = false;
  state.plannerStep = 2; // Next time, show current review
  const commitPromise = (typeof savePlanTransactional === 'function')
    ? savePlanTransactional(committedPlan)
    : (typeof saveState === 'function' ? Promise.resolve(saveState(true)) : Promise.resolve());
  commitPromise.then(() => {
    saveState(true);
    if (platePlanCloudReady && !platePlanSyncSuppress) queuePlatePlanCloudDiff();
    markPlatePlanViewsDirty('today', 'planner', 'shopping', 'planlib');
    showPlatePlanToast('Meal plan v3.8.4 committed! Displaying Today\'s meals. ✓');
    if (typeof showView === 'function') { showView('today'); }
    window.location.hash = '#/today';
    if (typeof renderToday === 'function') { renderToday(); }
  }).catch(err => {
    console.error('Failed to commit meal plan:', err);
    showPlatePlanToast('Failed to commit meal plan. Check network connection.');
  });
}
window.commitPlannerWizardPlan = commitPlannerWizardPlan;
function computeWizardShoppingAgg(plan = state.plan) {
  if (!plan?.slots) return { items: [], totalCost: 0 };
  const agg = {};
  const days = plan.days || Object.keys(plan.slots).length;
  for (let d = 1; d <= days; d++) {
    const s = plan.slots[d] || {};
    SLOTS.forEach(sl => {
      if (state.excluded?.[d]?.[sl.key]) return;
      const slotData = s[sl.key];
      if (!slotData) return;
      const slotInfo = getPlanSlotInfo(slotData);
      const r = slotInfo.active;
      if (!r || !r.ingredients) return;
      const instanceId = slotInfo.instanceId;
      const context = getPlanContextForInstance(instanceId);
      const slotScale = getSlotShoppingScale(r, sl.key, instanceId);
      (r.ingredients || []).forEach(ing => {
        if (isIngredientRemovedInContext(ing, context)) return;
        const adjustedIng = getAdjustedIngredientForContext(ing, context);
        const resolved = resolveProductForIngredientWithContext(adjustedIng, context);
        const bankIng = resolved.product || (adjustedIng.bankId ? state.ingredients.find(i => i.id === adjustedIng.bankId) : null);
        const actualBankId = bankIng?.id || '';
        const groupId = resolved.groupId || bankIng?.groupId || '';
        const actualName = resolved.group?.name || bankIng?.name || adjustedIng.name || adjustedIng.raw || 'Ingredient';
        const raw = ingRaw(adjustedIng);
        const amt = getShoppingAmount(adjustedIng, bankIng, slotScale);
        const k = getShoppingLineStateKey(groupId, actualBankId, raw);
        if (!agg[k]) {
          agg[k] = {
            key: k,
            name: actualName,
            bankIng,
            groupId,
            grams: 0,
            needQty: 0,
            needUnit: amt.needUnit,
            cat: CAT[resolved.group?.cat || bankIng?.cat] || 'General'
          };
        }
        agg[k].grams += (amt.grams || 0);
        agg[k].needQty += (amt.needQty || 0);
      });
    });
  }
  let totalCost = 0;
  const items = Object.values(agg).map(item => {
    let cost = 0;
    let packsNeeded = 1;
    if (item.bankIng && item.bankIng.price) {
      const price = +item.bankIng.price || 0;
      const packSize = +item.bankIng.packSize || 100;
      const qty = item.needUnit === 'item' ? item.needQty : item.grams;
      packsNeeded = Math.ceil(qty / Math.max(1, packSize));
      cost = price * packsNeeded;
    }
    const isAtHome = !!(plan.shoppingAtHome && plan.shoppingAtHome[item.key]);
    if (!isAtHome) { totalCost += cost; }
    return {
      ...item,
      cost,
      packsNeeded,
      isAtHome
    };
  });
  return { items, totalCost };
}
function renderPlannerWizard() {
  const host = document.getElementById('planner-wizard-host');
  if (!host) return;
  const currentStep = getPlannerWizardStep();
  const hasActivePlan = !!(state.plan?.slots && Object.keys(state.plan.slots).length > 0);
  let stepContentHtml = '';
  if (currentStep === 1) {
    const daysVal = state.plannerDays || state.plan?.days || 10;
    const today = new Date().toISOString().split('T')[0];
    const startVal = state.plannerStartDate || state.plan?.dayDates?.[1] || today;
    const cadence = state.prefs?.mealRepeatCadence || { breakfast: 1, lunch: 2, dinner: 2 };
    const minFitScore = state.prefs?.minFitScore || 0;
    const activeExclusions = getActiveWizardExclusions();
    const rawPinned = window.state?.planOptions?.pinnedMeals || (typeof planOptions !== 'undefined' ? planOptions?.pinnedMeals : null) || state?.pinnedRecipes;
    const pinned = Array.isArray(rawPinned) ? rawPinned : [];
    const rawUseUp = window.state?.planOptions?.useUp || (typeof planOptions !== 'undefined' ? planOptions?.useUp : null) || state?.useUpProducts;
    const useUp = Array.isArray(rawUseUp) ? rawUseUp : (rawUseUp && typeof rawUseUp === 'object' ? Object.keys(rawUseUp) : []);
    stepContentHtml = window.GeneratorConstraintsForm?.renderConstraintsForm?.({
      daysVal,
      startVal,
      cadence,
      minFitScore,
      activeExclusions,
      pinned,
      useUp
    }) || '';
  }
  else if (currentStep === 2) {
    if (!hasActivePlan) {
      stepContentHtml = window.GeneratorWizardModal?.renderWizardEmptyPlanCard?.(2) || `
        <div class="card" style="padding:24px;text-align:center">
          <h3>No Meal Plan Generated Yet</h3>
          <p style="color:var(--text2);font-size:13px;margin-bottom:14px">Configure your days and requests in Step 1 to generate your meal plan.</p>
          <button type="button" class="btn primary" onclick="setPlannerWizardStep(1)">← Go to Step 1: Configure Requests</button>
        </div>
      `;
    } else {
      const plan = state.plan || {};
      const rawSlots = plan.slots;
      const safeSlots = Array.isArray(rawSlots) ? rawSlots : (rawSlots && typeof rawSlots === 'object' ? Object.values(rawSlots) : []);
      const days = plan.days || safeSlots.length || 0;
      const prepGroups = Array.isArray(plan.mealPrepGroups) ? plan.mealPrepGroups : [];
      let cardsHtml = '';
      for (let d = 1; d <= days; d++) {
        const dateLabel = formatPlanDayLabel(plan, d, { short: true });
        const daySlots = plan.slots?.[d] || {};
        let eCal = 0, eProt = 0, cCal = 0, cProt = 0;
        ['breakfast', 'lunch', 'dinner'].forEach(m => {
          const sE = daySlots[m + 'E'];
          const sC = daySlots[m + 'C'];
          if (sE) {
            const info = getPlanSlotInfo(sE);
            const nut = getPlannedSlotNutrition(info?.active, m + 'E', info?.instanceId, plan);
            if (nut) { eCal += nut.cal || 0; eProt += nut.prot || 0; }
          }
          if (sC) {
            const info = getPlanSlotInfo(sC);
            const nut = getPlannedSlotNutrition(info?.active, m + 'C', info?.instanceId, plan);
            if (nut) { cCal += nut.cal || 0; cProt += nut.prot || 0; }
          }
        });
        const dayPreps = prepGroups.filter(g => (Array.isArray(g?.days) ? g.days : []).includes(d));
        const mealsHtml = ['breakfast', 'lunch', 'dinner'].map(meal => {
          const slotKeyE = meal + 'E';
          const slotKeyC = meal + 'C';
          const sE = daySlots[slotKeyE];
          const sC = daySlots[slotKeyC];
          const infoE = sE ? getPlanSlotInfo(sE) : null;
          const infoC = sC ? getPlanSlotInfo(sC) : null;
          const rE = infoE?.active;
          const rC = infoC?.active;
          const isShared = rE && rC && infoE.id === infoC.id && infoE.variant === infoC.variant;
          return window.PlannerMealSlot?.renderDensePlanMealRow({ meal, isShared, rE, rC, infoE, infoC, day: d, slotKeyE, slotKeyC }) || '';
        }).join('');
        cardsHtml += window.PlannerDayCard?.renderDenseDayCard({
          day: d,
          dateLabel,
          eCal,
          eProt,
          cCal,
          cProt,
          dayPreps,
          mealsHtml
        }) || '';
      }
      stepContentHtml = `
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div>
              <h2 style="margin:0;font-size:18px;font-weight:700">Step 2: Review Generated Meal Plan</h2>
              <div style="font-size:13px;color:var(--text2);margin-top:4px">Review daily macro fits and swap any meal directly inline.</div>
            </div>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn ghost sm" onclick="setPlannerWizardStep(1)">← Edit Requests</button>
              <button type="button" class="btn primary sm" style="font-weight:700" onclick="setPlannerWizardStep(3)">Proceed to Shopping List →</button>
            </div>
          </div>
          <div class="dense-plan-grid">${cardsHtml}</div>
          <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <button type="button" class="btn ghost" onclick="setPlannerWizardStep(1)">← Back to Configure</button>
            <button type="button" class="btn primary" style="font-weight:700;padding:10px 24px" onclick="setPlannerWizardStep(3)">Proceed to Shopping List & Substitutions →</button>
          </div>
        </div>
      `;
    }
  }
  else if (currentStep === 3) {
    if (!hasActivePlan) {
      stepContentHtml = window.GeneratorWizardModal?.renderWizardEmptyPlanCard?.(3) || `
        <div class="card" style="padding:24px;text-align:center">
          <h3>No Meal Plan Active</h3>
          <p style="color:var(--text2);font-size:13px;margin-bottom:14px">Generate a meal plan first before viewing the shopping list.</p>
          <button type="button" class="btn primary" onclick="setPlannerWizardStep(1)">← Go to Step 1</button>
        </div>
      `;
    } else {
      const { items, totalCost } = computeWizardShoppingAgg(state.plan);
      const topToolbarHtml = window.ShoppingBatchToolbar?.renderShoppingBatchToolbar({ totalCost, items }) || '';
      const listHtml = window.ShoppingCategoryGroup?.renderShoppingCategoriesList(items) || '';
      stepContentHtml = `
        <div style="display:flex;flex-direction:column;gap:16px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro',sans-serif">
          ${topToolbarHtml}
          ${listHtml}
          <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <button type="button" class="btn ghost" onclick="setPlannerWizardStep(2)">← Back to Review Plan</button>
            <button type="button" class="btn primary" style="font-weight:700;padding:10px 24px" onclick="commitPlannerWizardPlan()">✓ Save Shopping List &amp; Plan (Commit to Today) →</button>
          </div>
        </div>
      `;
    }
  }
  else if (currentStep === 4) {
    stepContentHtml = window.GeneratorWizardModal?.renderWizardStep4Commit?.('v3.8.4') || `
      <div class="card" style="padding:28px;text-align:center">
        <h2 style="margin-top:0">Committing Meal Plan v3.8.4...</h2>
        <p style="color:var(--text2);font-size:13px;margin-bottom:18px">Finalizing plan metadata, locking shopping quantities, and synchronizing with your live dashboard.</p>
        <button type="button" class="btn primary" onclick="commitPlannerWizardPlan()">Commit Plan Now</button>
      </div>
    `;
  }
  host.innerHTML = window.GeneratorWizardModal?.renderPlannerWizardView?.({
    currentStep,
    hasActivePlan,
    stepContentHtml
  }) || `<div class="planner-wizard-container">${stepContentHtml}</div>`;
}
window.renderPlannerWizard = renderPlannerWizard;
function renderPlan(){
  ensurePlannerShell();
  installPlannerSummaryObserver();
  renderPlannerWizard();
  const el=document.getElementById('plan-content');
  if(!el) return;
  try {
    if(!state.plan||!state.plan.slots){
      el.innerHTML='';
      const actions=document.getElementById('plan-actions'); if(actions) actions.style.display = 'none';
      const overall=document.getElementById('plan-overall-summary'); if(overall) overall.innerHTML='';
      const prep=document.getElementById('plan-meal-prep-panel'); if(prep) prep.innerHTML='';
      return;
    }
    const{days,slots}=state.plan;
    const startInput=document.getElementById('plan-start-date');if(startInput)startInput.value=state.plan.dayDates?.[1]||'';
    let hasValidSlots = false;
    const makeRenderedDaySummary = () => {
      const totals = { e:{cal:0, prot:0}, c:{cal:0, prot:0} };
      const assumed = { e:{cal:0, prot:0, labels:['snacks']}, c:{cal:0, prot:0, labels:['snacks']} };
      ['e','c'].forEach(person => {
        const b = getBudgets(person, 'snack');
        totals[person].cal += +b.cal || 0;
        totals[person].prot += +b.prot || 0;
        assumed[person].cal += +b.cal || 0;
        assumed[person].prot += +b.prot || 0;
      });
      return {
        totals,
        targets:{ e:{ cal:+state.prefs.ecal || 0, prot:+state.prefs.eprot || 0 }, c:{ cal:+state.prefs.ccal || 0, prot:+state.prefs.cprot || 0 } },
        assumed,
        score:0
      };
    };
    let html='';
    if (state.isDraftPlan || state.draftPlan) { html += window.PlannerGridToolbar?.renderDraftPlanBanner?.() || ''; }
    const localToday=getPlatePlanLocalToday();
    const isPlanExpired = checkIsPlanExpired(state.plan, localToday);
    if(isPlanExpired){
      const tomorrow = getTomorrowLocalDate();
      const datedEntries = Object.entries(state.plan.dayDates || {}).filter(([, v]) => !!parsePlanLocalDate(v));
      const dates = datedEntries.map(([, v]) => v).sort();
      const maxDate = dates[dates.length - 1] || localToday;
      const endLabel = parsePlanLocalDate(maxDate) ? formatPlanDateShort(maxDate) : maxDate;
      const tomorrowLabel = formatPlanDateShort(tomorrow);
      html += window.PlannerGridToolbar?.renderPlanExpiredBanner?.(endLabel, tomorrowLabel) || '';
    }
    const earlierDays=Array.from({length:days},(_,index)=>index+1).filter(day=>{
      const value=state.plan.dayDates?.[day]||'';
      return !!parsePlanLocalDate(value)&&value<localToday;
    });
    if(earlierDays.length){
      const firstLabel=formatPlanDayLabel(state.plan,earlierDays[0],{short:true});
      const lastLabel=formatPlanDayLabel(state.plan,earlierDays[earlierDays.length-1],{short:true});
      const range=earlierDays.length>1?`${firstLabel} – ${lastLabel}`:firstLabel;
      html+= window.PlannerGridToolbar?.renderEarlierDaysHeading?.(range, earlierDays.length, platePlanEarlierDaysExpanded) || '';
    }
    for(let d=1;d<=days;d++){
      if(earlierDays.includes(d)&&!platePlanEarlierDaysExpanded)continue;
      const s=slots[d]||{};
      const allEx=SLOTS.every(sl=>state.excluded[d]?.[sl.key]);
      const dayLabel = formatPlanDayLabel(state.plan, d, { short: true });
      const dayDate = state.plan.dayDates?.[d] || '';
      if(allEx){
        html += window.PlannerDayCard?.renderDayPlanCard?.({ day: d, dayLabel, dayDate, isAllExcluded: true }) || '';
        continue;
      }
      const daySlotInfos = buildPlanDaySlotInfos(state.plan, d);
      const daySummary = makeRenderedDaySummary();
      let dayRowsHtml = '';
      SLOTS.forEach(sl=>{
        const isEx=state.excluded[d]?.[sl.key];
        const slotData = s[sl.key];
        const slotInfo = getPlanSlotInfo(slotData);
        const r = slotInfo.active;
        const rId = slotInfo.id;
        const instanceId = slotInfo.instanceId;
        const lblLines=SLOT_LABELS[sl.key].split('\n');
        const showRecipe = !!r && !isEx;
        if(showRecipe) hasValidSlots = true;
        const slotNutrition = daySlotInfos.find(info => info.slotKey === sl.key) || getPlannerSlotNutritionInfo(state.plan, d, sl.key);
        let calStr = '';
        let rowCal = 0;
        let rowProt = 0;
        let rowPerson = sl.key.endsWith('E') ? 'e' : sl.key.endsWith('C') ? 'c' : '';
        if(showRecipe) {
            rowCal = +slotNutrition.cal || 0;
            rowProt = +slotNutrition.prot || 0;
            calStr = `${Math.round(rowCal)}kcal / P${round1(rowProt)}g`;
            if(rowPerson) {
              daySummary.totals[rowPerson].cal += rowCal;
              daySummary.totals[rowPerson].prot += rowProt;
            }
        }
        const slotReason=getPlanSlotReason(state.plan,d,sl.key);
        const slotReasonLabel=formatPlanSlotReason(slotReason);
        const isPinned = !!(r && getPinnedRecipesList().some(p => p.recipeId === rId && (p.variant || 'original') === (slotInfo.variant || 'original')));
        dayRowsHtml += window.PlannerMealSlot?.renderSlotRow?.({
          day: d,
          slotKey: sl.key,
          slotColor: SLOT_COLORS[sl.key],
          lblLines,
          isExcluded: isEx,
          showRecipe,
          recipe: r,
          instanceId,
          variant: slotInfo.variant,
          rowPerson,
          rowCal,
          rowProt,
          isPinned,
          slotReasonLabel,
          hasSlotReason: !!slotReason
        }) || '';
      });
      daySummary.score = calculatePlanDayScoreFromTotals(daySummary.totals);
      html += window.PlannerDayCard?.renderDayPlanCard?.({
        day: d,
        dayLabel,
        dayDate,
        isAllExcluded: false,
        daySummary,
        dayRowsHtml,
        score: daySummary.score
      }) || '';
    }
    el.innerHTML=html;
    reconcileVisiblePlanSummaries();
    renderMealPrepSuggestions();
    renderPlanHistoryPanel();
    const setup=document.getElementById('plan-setup-card');
    if(setup) setup.style.display = '';
    const actions=document.getElementById('plan-actions');
    if(actions) actions.style.display = hasValidSlots ? 'block' : 'none';
    updatePlannerCompactHeader();
  } catch(err) {
    console.error('Error rendering Meal Planner:', err);
    el.innerHTML = window.PlannerGridToolbar?.renderPlannerEmptyError?.() || '';
  }
}
function toggleSlotVariant(day, slotKey){
  const info = getPlanSlotInfo(state.plan?.slots?.[day]?.[slotKey]);
  if(!info.recipe) return;
  const currentVariant = info.variant || 'original';
  const newVariant = currentVariant === 'enhanced' ? 'original' : 'enhanced';
  state.plan.slots[day][slotKey] = makePlanSlot(info.id, newVariant);
  const priority = state.plan.productPriority || state.prefs?.productPriority || 'protein';
  state.plan.productSelections = lockProductSelectionsForSlots(state.plan.slots, priority);
  state.plan.score = calculatePlanScore(state.plan);
  saveState();
  renderPlan();
  showPlatePlanToast(`Switched to ${newVariant === 'enhanced' ? '✨ Enhanced' : 'Original'} variant for ${info.recipe.name}`);
}
function prioritiseAllPlannedEnhancedRecipes(){
  if(!state.plan?.slots) return showPlatePlanToast('No active meal plan to prioritise.');
  let upgradedCount = 0;
  Object.entries(state.plan.slots).forEach(([day, daySlots]) => {
    Object.entries(daySlots || {}).forEach(([slotKey, slotVal]) => {
      if(!slotVal) return;
      const info = getPlanSlotInfo(slotVal);
      if(!info.recipe || info.variant === 'enhanced') return;
      const r = info.recipe;
      const hasEnhanced = r.enhanced && ((r.enhanced.ingredients && r.enhanced.ingredients.length) || (r.enhanced.method && r.enhanced.method.length) || (r.enhanced.steps && r.enhanced.steps.length) || r.enhanced.name || r.enhanced.changes || r.enhancedPortions);
      if(hasEnhanced){
        state.plan.slots[day][slotKey] = makePlanSlot(info.id, 'enhanced');
        upgradedCount++;
      }
    });
  });
  if(upgradedCount > 0){
    const priority = state.plan.productPriority || state.prefs?.productPriority || 'protein';
    state.plan.productSelections = lockProductSelectionsForSlots(state.plan.slots, priority);
    state.plan.score = calculatePlanScore(state.plan);
    saveState();
    renderPlan();
    showPlatePlanToast(`✨ Prioritised ${upgradedCount} meal(s) to Enhanced variants for better fit scores!`);
  } else { showPlatePlanToast('All eligible meals in your plan are already using Enhanced variants.'); }
}
function openPlannedMealActions(day,slotKey){
  const info=getPlanSlotInfo(state.plan?.slots?.[day]?.[slotKey]);
  if(!info.active && !info.recipe) return showPlatePlanToast('That planned meal is no longer available.');
  const actions = window.PlannerModalsUI?.buildPlannedMealActionItems ? window.PlannerModalsUI.buildPlannedMealActionItems(info, day, slotKey) : [];
  openMobileActionSheet(info.active?.name || info.recipe?.name || 'Planned meal', actions);
}
function swapSlot(day,slot,id){
    if(!state.plan.slots[day]) state.plan.slots[day]={};
    let swappedName = '';
    const mealType = slot.includes('breakfast') ? 'breakfast' : slot.includes('lunch') ? 'lunch' : 'dinner';
    const slotMealMode = getSlotMealMode(day, mealType);
    const counterpartKey = getPlanSlotCounterpartKey(slot);
    const isDualView = slotMealMode === 'both' || (document.getElementById('filter-who')?.value === 'both') || (window.activeHouseholdId && slotMealMode !== 'elliott' && slotMealMode !== 'chloe');
    if(id) {
        const parsed = parsePlanRecipeValue(id);
        state.plan.slots[day][slot] = makePlanSlot(parsed.id, parsed.variant);
        setPlanSlotReason(day,slot,'');
        if(isDualView && counterpartKey) {
            state.plan.slots[day][counterpartKey] = makePlanSlot(parsed.id, parsed.variant);
            setPlanSlotReason(day,counterpartKey,'');
        }
        const info = getPlanSlotInfo(state.plan.slots[day][slot]);
        swappedName = info?.active?.name || info?.recipe?.name || '';
    } else {
        state.plan.slots[day][slot] = null;
        setPlanSlotReason(day,slot,'');
        if(isDualView && counterpartKey) {
            state.plan.slots[day][counterpartKey] = null;
            setPlanSlotReason(day,counterpartKey,'');
        }
    }
    const priority = state.plan.productPriority || state.prefs.productPriority || 'protein';
    state.plan.productSelections = lockProductSelectionsForSlots(state.plan.slots, priority);
    state.plan.productPriority = priority;
    state.plan.confirmedShopping = false;
    state.plan.mealPrepGroups = [];
    state.plan.declinedMealPrepGroups = [];
    state.plan.score = calculatePlanScore(state.plan);
    saveState();
    renderPlan();
    const toastMsg = swappedName 
      ? (isDualView ? `Assigned ${swappedName} for Elliott & Chloe` : `Swapped meal to ${swappedName}`)
      : (isDualView ? 'Meal slots cleared for Elliott & Chloe' : 'Meal slot cleared');
    showPlatePlanToast(toastMsg);
}
function openSwapMealModal(day, slotKey) { return window.PlannerMealSlot?.openSearchableRecipeSwapModal?.(day, slotKey); }
function closeSwapMealModal() { return window.PlannerMealSlot?.closeSearchableRecipeSwapModal?.(); }
function setSwapModalFilter(filterType) { return window.PlannerMealSlot?.filterSearchableRecipeSwapModal?.(filterType); }
function selectSwapModalRecipe(value) { return window.PlannerMealSlot?.selectAndSwapRecipe?.(value); }
function confirmSwapMealModal() { return window.PlannerMealSlot?.closeSearchableRecipeSwapModal?.(); }
function executeSwapSlotAndClose(day, slotKey, value) {
  swapSlot(day, slotKey, value);
  closeSwapMealModal();
}
function quickRandomizeSwap(day, slotKey) {
  const all = (state.recipes || []);
  if (!all.length) return;
  const picked = all[Math.floor(Math.random() * all.length)];
  if (picked?.id) executeSwapSlotAndClose(day, slotKey, picked.id);
}
function renderSwapModalOptionsList() {}
window.openSwapMealModal = openSwapMealModal;
window.closeSwapMealModal = closeSwapMealModal;
window.setSwapModalFilter = setSwapModalFilter;
window.selectSwapModalRecipe = selectSwapModalRecipe;
window.confirmSwapMealModal = confirmSwapMealModal;
window.executeSwapSlotAndClose = executeSwapSlotAndClose;
window.quickRandomizeSwap = quickRandomizeSwap;
window.renderSwapModalOptionsList = renderSwapModalOptionsList;
function clearPlan(){
    state.plan={}; 
    state.overrides={}; // Purge orphaned execution data
    state.plannerStep = 1;
    platePlanEarlierDaysExpanded = false;
    saveState();
    const content = document.getElementById('plan-content'); if(content) content.innerHTML='';
    const warnings = document.getElementById('plan-warnings'); if(warnings) warnings.innerHTML='';
    const overall=document.getElementById('plan-overall-summary'); if(overall) overall.innerHTML='';
    const prep=document.getElementById('plan-meal-prep-panel'); if(prep) prep.innerHTML='';
    const setup=document.getElementById('plan-setup-card'); if(setup) setup.style.display = '';
    const actions = document.getElementById('plan-actions'); if(actions) actions.style.display = 'none';
    renderPlanHistoryPanel();
    updatePlannerCompactHeader();
    renderPlannerWizard();
}
function showPlanSetup(){
  ensurePlannerShell();
  openPlanOptionsWorkspace();
}
function renderPlanOverallSummary(){
  const el=document.getElementById('plan-overall-summary');
  if (!el || !state.plan?.slots) { if(el) el.innerHTML=''; return; }
  if(document.querySelector('#plan-content .day-plan-card:not(.skipped)')) {
    reconcileVisiblePlanSummaries();
    return;
  }
  const score = calculatePlanScore(state.plan);
  state.plan.score = score;
  renderPlanOverallSummaryHtml(score);
}
function defaultPlanSaveName(plan = state.plan){
  const days = plan?.days || Object.keys(plan?.slots || {}).length || 0;
  const dt = getPlanDateRangeLabel(plan) || new Date().toLocaleDateString();
  return `Meal plan ${dt}${days ? ' · ' + days + ' days' : ''}`;
}
function openSaveMealPlanModal(){
  if(!state.plan?.slots) {
    openAppInfoModal('Save meal plan', '<div class="empty">Generate a meal plan first.</div>');
    return;
  }
  const hasAny = Object.values(state.plan.slots || {}).some(day => Object.values(day || {}).some(Boolean));
  if(!hasAny) {
    openAppInfoModal('Save meal plan', '<div class="empty">There are no meals in the current plan to save.</div>');
    return;
  }
  const defaultName = defaultPlanSaveName();
  const modalHtml = window.PlannerModalsUI?.renderSavePlanModalContent
    ? window.PlannerModalsUI.renderSavePlanModalContent(defaultName)
    : `<div style="margin-bottom:10px">Save the current meal plan to the Meal Plan Library.</div>
       <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">Plan name</label>
       <input id="save-plan-name" type="text" value="${ppEscapeHtml(defaultName)}" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:var(--surface);color:var(--text)">`;
  openAppConfirmModal(
    'Save meal plan',
    modalHtml,
    'Save plan',
    async () => {
      const name = document.getElementById('save-plan-name')?.value?.trim() || defaultName;
      state.plan.name = name;
      state.plan.savedStatus = 'Manually saved';
      const snap = snapshotCurrentPlan('Manually saved', name);
      const saveBtn = document.querySelector('#app-confirm-modal .btn.primary, .modal-actions .btn.primary');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
      }
      try {
        const success = await savePlanTransactional(state.plan);
        renderPlanHistoryPanel();
        if (success) {
          openAppInfoModal('Meal plan saved', `<div class="msg success" style="margin:0">Saved <strong>${ppEscapeHtml(name)}</strong> to the Meal Plan Library.</div>`);
        }
      } catch (err) {
        console.error('[Save Meal Plan Error]', err);
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save plan';
        }
      }
    }
  );
}
function renderPlanHistoryPanel(){
  const el=document.getElementById('plan-history-panel');
  if(!el) return;
  const hist = state.planHistory || [];
  if (window.PlannerGridUI?.renderHistoryPanel) {
    el.innerHTML = window.PlannerGridUI.renderHistoryPanel(hist);
    return;
  }
  const body = !hist.length
    ? '<div style="font-size:12px;color:var(--text3)">No saved meal plans yet. Generate a plan, then use Save current plan.</div>'
    : `<div style="display:grid;gap:10px">${hist.map((p,i)=>{
      const dt = p.date ? new Date(p.date).toLocaleString() : 'Previous plan';
      const dateRange=getPlanDateRangeLabel(p);
      const allIds = getPlanRecipeIds(p);
      const ids = allIds.slice(0,3).map(id => getProductIndexRecipe(id)?.name || id);
      const remaining = Math.max(0, allIds.length - ids.length);
      const status = p.savedStatus || (p.confirmedShopping ? 'Shopping confirmed' : 'PlatePlan generated');
      const title = p.name || `Saved plan ${i+1}`;
      const score = p.score?.score ?? p.score ?? '—';
      return `<article class="plan-library-card">
        <div class="plan-library-layout">
          <div class="plan-library-main">
            ${renderExpandableText(title,`plan-${p.id||i}`,'plan-library-title')}
            <div class="plan-library-meta">
              <span class="tag">${p.days||0} days</span>
              ${dateRange?`<span class="tag">${ppEscapeHtml(dateRange)}</span>`:''}
              <span class="tag">Score ${ppEscapeHtml(score)}</span>
              <span class="tag">${ppEscapeHtml(status)}</span>
            </div>
            <div style="color:var(--text3);margin-top:7px">Saved ${ppEscapeHtml(dt)} · ${ppEscapeHtml(p.savedBy || 'PlatePlan')}</div>
            <div class="plan-library-recipe-preview"><strong>Recipes:</strong> ${renderExpandableText(ids.length ? ids.join(', ') : 'No recipes',`plan-recipes-${p.id||i}`,'')}${remaining ? ` <span class="tag">+${remaining} more</span>` : ''}</div>
          </div>
          <div class="plan-library-actions">
            <button class="btn sm primary" onclick="openSavedPlanRecipeCards(${i})">Recipe cards</button>
            <button class="btn sm ghost" onclick="openPlanHistoryActions(${i})">More</button>
          </div>
        </div>
      </article>`;
    }).join('')}</div>`;
  el.innerHTML = `<div class="card" style="font-size:12px;margin:0">${body}</div>`;
}
function openPlanHistoryActions(index){
  const p=(state.planHistory||[])[index];
  if(!p) return;
  openMobileActionSheet(p.name || `Saved plan ${index+1}`,[
    {label:'Apply plan starting today',onclick:`applyPlanFromLibraryDirect(${index})`},
    {label:'View schedule',onclick:`viewPlanHistory(${index})`},
    {label:'Download recipe pack',onclick:`downloadSavedPlanPack(${index})`},
    {label:'Edit plan',onclick:`loadPlanHistoryForEdit(${index})`},
    {label:'Rename',onclick:`renamePlanHistory(${index})`},
    {label:'Delete saved plan',onclick:`deletePlanHistory(${index})`,danger:true}
  ]);
}
function viewPlanHistory(index){
  const p = (state.planHistory || [])[index];
  if(!p) return;
  const rows = [];
  for(let d=1; d<=(p.days||0); d++){
    const day = p.slots?.[d] || {};
    const meals = SLOTS.map(sl => {
      const info = getPlanSlotInfo(day[sl.key]);
      const reason=getPlanSlotReason(p,d,sl.key);
      return info.active
        ? `${SLOT_LABELS[sl.key].replace('\n',' ')}: ${info.active.name}${info.variant==='enhanced'?' (Enhanced)':''}`
        : reason
          ? `${SLOT_LABELS[sl.key].replace('\n',' ')}: ${formatPlanSlotReason(reason)}`
          : '';
    }).filter(Boolean);
    if(meals.length) rows.push(`<div class="summary-box"><strong>${ppEscapeHtml(formatPlanDayLabel(p,d,{short:true}))}</strong><div>${meals.map(ppEscapeHtml).join('<br>')}</div></div>`);
  }
  openAppInfoModal('Previous meal plan', rows.join('') || '<div class="empty">No meals in this plan.</div>');
}
function loadPlanHistoryForEdit(index){
  const p = (state.planHistory || [])[index];
  if(!p) return;
  openAppConfirmModal(
    'Load saved meal plan?',
    `Load <strong>${ppEscapeHtml(p.name || 'this saved plan')}</strong> into the Meal Planner so you can edit it? Your current active plan will be replaced, but saved plans stay in the library.`,
    'Load plan',
    () => {
      if(state.plan?.slots) snapshotCurrentPlan('Auto-saved before loading saved plan', defaultPlanSaveName(state.plan));
      state.plan = {
        days: p.days || Object.keys(p.slots || {}).length || 0,
        slots: clonePlatePlanValue(p.slots || {}),
        dayDates: clonePlatePlanValue(p.dayDates || {}),
        slotReasons: clonePlatePlanValue(p.slotReasons || {}),
        productPriority: p.productPriority || state.prefs.productPriority || 'protein',
        productSelections: clonePlatePlanValue(p.productSelections || {}),
        useUpProductIds: clonePlatePlanValue(p.useUpProductIds || []),
        shoppingAtHome: clonePlatePlanValue(p.shoppingAtHome || {}),
        warnings: [],
        score: calculatePlanScore({ days:p.days, slots:p.slots, productSelections:p.productSelections }),
        confirmedShopping: !!p.confirmedShopping,
        mealPrepGroups: clonePlatePlanValue(p.mealPrepGroups || []),
        declinedMealPrepGroups: clonePlatePlanValue(p.declinedMealPrepGroups || [])
      };
      state.overrides = clonePlatePlanValue(p.overrides || {});
      saveState();
      renderPlan();
      showView('planner');
    }
  );
}
function renamePlanHistory(index){
  const p = (state.planHistory || [])[index];
  if(!p) return;
  const currentName = p.name || `Saved plan ${index+1}`;
  openAppConfirmModal(
    'Rename saved plan',
    `<label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">Plan name</label>
     <input id="rename-plan-name" type="text" value="${ppEscapeHtml(currentName)}" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:var(--surface);color:var(--text)">`,
    'Rename',
    () => {
      const name = document.getElementById('rename-plan-name')?.value?.trim();
      if (name) { p.name = name;if(p.cardPackSnapshot)p.cardPackSnapshot.planName=name; }
      saveState();
      renderPlanHistoryPanel();
    }
  );
}
function deletePlanHistory(index){
  const p = (state.planHistory || [])[index];
  if(!p) return;
  const targetId = p.id || p.planId;
  openAppConfirmModal(
    'Delete saved meal plan?',
    `Delete <strong>${ppEscapeHtml(p.name || 'this saved plan')}</strong> from the Meal Plan Library? This will not delete recipes or products.`,
    'Delete plan',
    () => {
      if (targetId) { deletePlan(targetId); } else {
        state.planHistory.splice(index, 1);
        try {
          safeLocalStorageSet(SK, safeJsonStringify(state));
          safeSaveHistoryBackup(state.planHistory);
        } catch(e) {}
        state.plannerStep = 1;
        renderAll();
      }
    }
  );
}
function filterRecipeSwap(inputRef, listRef){
  const input = typeof inputRef === 'string' ? document.getElementById(inputRef) : (inputRef?.target ? inputRef.target : inputRef);
  const list = typeof listRef === 'string' ? document.getElementById(listRef) : listRef;
  if(!input || !list) return;
  const currentWrap = input.closest('.recipe-search-wrap');
  const currentSlotRow = input.closest('.slot-row');
  document.querySelectorAll('.recipe-search-drop').forEach(d => {
    if(d !== list) {
      d.style.display = 'none';
      d.closest('.recipe-search-wrap')?.classList.remove('is-open');
      d.closest('.slot-row')?.classList.remove('has-open-drop');
    }
  });
  if (currentWrap) currentWrap.classList.add('is-open');
  if (currentSlotRow) currentSlotRow.classList.add('has-open-drop');
  list.style.display = 'block';
  const normalize = str => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/&#039;|&#39;|&apos;|'/g, "'")
      .replace(/&amp;|&/g, ' and ')
      .replace(/[^a-z0-9\s']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };
  const rawVal = input.value || '';
  const query = normalize(rawVal);
  const terms = query.split(/\s+/).filter(Boolean);
  let visibleCount = 0;
  const opts = list.querySelectorAll('.recipe-search-opt');
  opts.forEach(el => {
    const hay = normalize(el.dataset.search || el.textContent || '');
    const match = !terms.length || terms.every(t => hay.includes(t));
    el.style.display = match ? '' : 'none';
    if(match) visibleCount++;
  });
  let noMatchEl = list.querySelector('.recipe-search-no-match');
  if(opts.length > 0) {
    if(!visibleCount){
      if(!noMatchEl){
        noMatchEl = document.createElement('div');
        noMatchEl.className = 'recipe-search-no-match';
        noMatchEl.style.cssText = 'padding:12px;font-size:12px;color:var(--text3);text-align:center;';
        noMatchEl.textContent = 'No matching recipes found';
        list.appendChild(noMatchEl);
      }
      noMatchEl.style.display = 'block';
    } else if (noMatchEl) { noMatchEl.style.display = 'none'; }
  }
}
window.platePlanToastActions = window.platePlanToastActions || new Map();
const platePlanToastActions = window.platePlanToastActions;
function runPlatePlanToastAction(id){
  const toastActions = (typeof platePlanToastActions !== 'undefined' && platePlanToastActions) || window.platePlanToastActions || new Map();
  const action = toastActions instanceof Map ? toastActions.get(id) : toastActions[id];
  if(toastActions instanceof Map) toastActions.delete(id); else delete toastActions[id];
  document.getElementById(`plateplan-toast-${id}`)?.remove();
  if(typeof action==='function')action();
}
function showPlatePlanToast(message,action=null){
  let region=document.getElementById('plateplan-toast-region');
  if (!region) { region=document.createElement('div');region.id='plateplan-toast-region';region.className='plateplan-toast-region';region.setAttribute('role','status');region.setAttribute('aria-live','polite');document.body.appendChild(region); }
  const id=Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const toastActions = (typeof platePlanToastActions !== 'undefined' && platePlanToastActions) || window.platePlanToastActions || new Map();
  if(action?.onclick){
    if(toastActions instanceof Map) toastActions.set(id,action.onclick);
    else toastActions[id] = action.onclick;
  }
  region.innerHTML=`<div class="plateplan-toast" id="plateplan-toast-${id}"><span>${ppEscapeHtml(message)}</span>${action?.onclick?`<button onclick="runPlatePlanToastAction('${ppEscapeAttr(id)}')">${ppEscapeHtml(action.label||'Undo')}</button>`:''}</div>`;
  setTimeout(()=>{
    document.getElementById(`plateplan-toast-${id}`)?.remove();
    if(toastActions instanceof Map) toastActions.delete(id); else delete toastActions[id];
  },action?.onclick?8000:4200);
}
function showToast(message,action=null) { return showPlatePlanToast(message, action); }
window.showPlatePlanToast = showPlatePlanToast;
window.showToast = showToast;
function showMsg(id,msg,type){const el=document.getElementById(id);if(!el)return;el.innerHTML='<div class="msg '+type+'">'+msg+'</div>';setTimeout(()=>{if(el)el.innerHTML='';},4000);}
function showOverlay(msg,sub) { document.getElementById('overlay-msg').textContent=msg;document.getElementById('overlay-sub').textContent=sub||'';document.getElementById('overlay').classList.add('visible'); }
function hideOverlay() { document.getElementById('overlay').classList.remove('visible'); }
function runPlatePlanDelegatedAction(code,event,element){
  if(!code || typeof code !== 'string') return undefined;
  const delegatedEvent = (event && typeof event === 'object') ? new Proxy(event, {
    get(target, prop) {
      if (prop === 'currentTarget') return element;
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    }
  }) : event;
  return (function delegatedPlatePlanAction(event){
    const targetElement = element || (event && (event.currentTarget || event.target));
    const isSubtypeFix = (targetElement?.dataset?.action === 'fix-subtype') ||
      targetElement?.hasAttribute?.('data-subtype-id') ||
      (code && (code.includes("beginDataQualityFix('subtype'") || code.includes('beginDataQualityFix("subtype"') || code.includes('fixSubtypeDataQuality')));
    if (isSubtypeFix) {
      let subTypeId = targetElement?.dataset?.subtypeId || targetElement?.getAttribute?.('data-subtype-id');
      if (!subTypeId && code) {
        const match = code.match(/beginDataQualityFix\(['"]subtype['"],\s*['"]([^'"]+)['"]/);
        if (match) subTypeId = match[1];
        else {
          const directMatch = code.match(/fixSubtypeDataQuality\(['"]([^'"]+)['"]/);
          if (directMatch) subTypeId = directMatch[1];
        }
      }
      if (subTypeId) { return fixSubtypeDataQuality(subTypeId); }
    }
    return eval(code);
  }).call(element, delegatedEvent);
}
Object.assign(globalThis.PlatePlanLegacy, {
  updateSyncStatus: updatePlatePlanSyncStatus,
  setSyncStatus: updatePlatePlanSyncStatus,
  version:PLATEPLAN_APP_VERSION,
  expectedCache:PLATEPLAN_EXPECTED_CACHE,
  getState:()=>state,
  saveState,
  getRecipe,
  getProduct,
  calculateRecipeDisplayNutrition,
  getPlanContextForInstance,
  refreshPlatePlanDerivedState,
  renderLegacyView:renderPlatePlanLegacyView,
  openSearchResult:openPlatePlanSearchResult,
  runDelegatedAction:runPlatePlanDelegatedAction,
  showInfo:openAppInfoModal,
  closeInfo:closeAppConfirmModal,
  showOverlay,
  hideOverlay,
  showToast:showPlatePlanToast,
  createRecoveryPoint,
  renderRecoveryPanel,
  initCloudSync:initPlatePlanCloudSync,
  signOut:signOutPlatePlan,
  renderAll,
  saveIngredient,
  addIngredient,
  deleteIngredient,
  saveManualIng,
  deleteIng,
  abortBatchImport,
  skipBatchImportRecipe,
  confirmBatchIdentification,
  loadBatchRecipeIntoStepA,
  openConfirmRecipeIdentificationModal,
  updateBatchUiBanners,
  openTescoModal,
  showTescoSearchModal,
  openAddProductModal,
  openProductPicker,
  showTescoImport,
  closeTescoModal,
  openUnifiedMappingModal,
  closeUnifiedMappingModal,
  openTescoImportFromSubst,
  closeSubstituteModal,
  confirmSubstitute,
  extractTescoProduct,
  saveTescoIngredient,
  runDataQualityAudits,
  updateDataQualityBadge,
  fixSubtypeDataQuality
});
Object.freeze(globalThis.PlatePlanLegacy);
window.renderAll = renderAll;
window.saveIngredient = saveIngredient;
window.addIngredient = addIngredient;
window.deleteIngredient = deleteIngredient;
window.saveManualIng = saveManualIng;
window.deleteIng = deleteIng;
window.abortBatchImport = abortBatchImport;
window.skipBatchImportRecipe = skipBatchImportRecipe;
window.confirmBatchIdentification = confirmBatchIdentification;
window.loadBatchRecipeIntoStepA = loadBatchRecipeIntoStepA;
window.openConfirmRecipeIdentificationModal = openConfirmRecipeIdentificationModal;
window.updateBatchUiBanners = updateBatchUiBanners;
window.openTescoModal = openTescoModal;
window.showTescoSearchModal = showTescoSearchModal;
window.openAddProductModal = openAddProductModal;
window.openProductPicker = openProductPicker;
window.showTescoImport = showTescoImport;
window.closeTescoModal = closeTescoModal;
window.openUnifiedMappingModal = openUnifiedMappingModal;
window.closeUnifiedMappingModal = closeUnifiedMappingModal;
window.openTescoImportFromSubst = openTescoImportFromSubst;
window.closeSubstituteModal = closeSubstituteModal; window.confirmSubstitute = confirmSubstitute; window.openSubstituteModal = openSubstituteModal; window.handleSubstSearch = handleSubstSearch; window.selectSubstItem = selectSubstItem; window.removeSubstitute = removeSubstitute;
window.extractTescoProduct = extractTescoProduct;
window.saveTescoIngredient = saveTescoIngredient;
window.runDataQualityAudits = runDataQualityAudits;
window.updateDataQualityBadge = updateDataQualityBadge;
window.fixSubtypeDataQuality = fixSubtypeDataQuality;
window.dispatchEvent(new CustomEvent('plateplan:legacy-ready',{detail:{version:PLATEPLAN_APP_VERSION}}));
