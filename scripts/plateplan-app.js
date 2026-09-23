// Expose global window actions immediately on app load before any async operations execute
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
  if (typeof pushStateToCloud === 'function') {
    await pushStateToCloud(true);
  } else if (typeof loadSharedPlatePlan === 'function') {
    await loadSharedPlatePlan();
  }
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
      if (typeof openPlatePlanSyncPanel === 'function') {
        openPlatePlanSyncPanel();
      } else {
        window.syncNow();
      }
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindTopBarActionListeners);
  } else {
    bindTopBarActionListeners();
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, window.PlatePlanNutrition, window.PlatePlanState, window.PlatePlanDOM, window.PlatePlanIngredients);
}



function toAPTitleCase(str) {
    if (!str || typeof str !== 'string') return '';
    const trimmed = str.trim();
    if (!trimmed) return '';

    const lowerWords = new Set([
        'a', 'an', 'the',
        'in', 'on', 'at', 'to', 'from', 'by', 'with', 'of', 'for',
        'and', 'but', 'or', 'nor'
    ]);

    const words = trimmed.split(/\s+/);
    const len = words.length;

    const formattedWords = words.map((word, index) => {
        if (word.includes('-')) {
            const parts = word.split('-');
            const formattedParts = parts.map((part, pIdx) => {
                if (!part) return part;
                const cleanPart = part.toLowerCase().replace(/[^a-z0-9]/g, '');
                const isFirst = index === 0 && pIdx === 0;
                const isLast = index === len - 1 && pIdx === parts.length - 1;
                if (!isFirst && !isLast && lowerWords.has(cleanPart)) {
                    return part.toLowerCase();
                }
                return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            });
            return formattedParts.join('-');
        }

        const match = word.match(/^([^\w]*)([\w']+)([^\w]*)$/);
        if (!match) {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }

        const [, leadingPunct, coreWord, trailingPunct] = match;
        const lowerCore = coreWord.toLowerCase();
        const isFirst = index === 0 || (index > 0 && /[:.!?\-–—]$/.test(words[index - 1]));
        const isLast = index === len - 1;

        let casedCore;
        if (!isFirst && !isLast && lowerWords.has(lowerCore)) {
            casedCore = lowerCore;
        } else {
            casedCore = coreWord.charAt(0).toUpperCase() + coreWord.slice(1).toLowerCase();
        }

        return leadingPunct + casedCore + trailingPunct;
    });

    return formattedWords.join(' ');
}

function toTitleCase(str) {
    if (!str || typeof str !== 'string') return '';
    if (str.includes(' ') || str.includes('-')) {
        return toAPTitleCase(str);
    }
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// == CATEGORIES ==
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

// == STATE ==
const SK='plateplan_v2';
const BAKED_CANDIDATE_SK='plateplan_v2_baked_candidate';
const RECOVERY_SK='plateplan_v2_recovery';
const PLATEPLAN_APPEARANCE_SK='plateplan_appearance';
const PLATEPLAN_SIDEBAR_SK='plateplan_sidebar_groups';
const PLATEPLAN_MODULAR_MIGRATION_SK='plateplan_modular_migration_20_4';
const PLATEPLAN_SCHEMA_VERSION=1;
const PLATEPLAN_APP_VERSION='3.3.7-mod';
const PLATEPLAN_EXPECTED_CACHE='plateplan-shell-v94';
window.APP_VERSION = '3.3.7-mod';
window._hydrationLogged = false;
window.state = window.state || {};
window.state.meta = window.state.meta || {};
window.state.meta.version = '3.3.7-mod';
window.state.deletedPlanIds = window.state.deletedPlanIds || [];
window.deletedPlanIds = window.deletedPlanIds || window.state.deletedPlanIds;

window.findRecipeByIdOrInstance = function(targetId) {
  if (!targetId) return null;

  // 1. Check base recipe library
  const baseRecipes = window.state?.recipes || (typeof state !== 'undefined' ? state?.recipes : []) || [];
  let found = baseRecipes.find(r => r && (r.id === targetId || String(r.id) === String(targetId)));
  if (found) return found;

  // 2. Search active meal plan items (currentPlan / plan)
  const currentPlan = window.state?.currentPlan || window.state?.plan || (typeof state !== 'undefined' ? (state?.currentPlan || state?.plan) : {}) || {};
  const planDays = currentPlan.days || currentPlan.slots || currentPlan;
  if (typeof planDays === 'object' && planDays !== null) {
    for (const day in planDays) {
      const meals = Array.isArray(planDays[day]) ? planDays[day] : [];
      for (const meal of meals) {
        if (!meal) continue;
        if (meal.id === targetId || meal.instanceId === targetId || String(meal.id) === String(targetId) || String(meal.instanceId) === String(targetId)) {
          // Resolve base recipe by recipeId if available
          if (meal.recipeId) {
            const matchedBase = baseRecipes.find(r => r && (r.id === meal.recipeId || String(r.id) === String(meal.recipeId)));
            if (matchedBase) return { ...matchedBase, ...meal };
          }
          return meal;
        }
      }
    }
  }

  // 3. Search saved plan history
  const history = window.state?.planHistory || (typeof state !== 'undefined' ? state?.planHistory : []) || [];
  for (const plan of history) {
    if (!plan) continue;
    const days = plan.days || plan.plan || plan.slots || {};
    if (typeof days === 'object' && days !== null) {
      for (const day in days) {
        const meals = Array.isArray(days[day]) ? days[day] : [];
        for (const meal of meals) {
          if (!meal) continue;
          if (meal.id === targetId || meal.instanceId === targetId || String(meal.id) === String(targetId) || String(meal.instanceId) === String(targetId)) {
            if (meal.recipeId) {
              const matchedBase = baseRecipes.find(r => r && (r.id === meal.recipeId || String(r.id) === String(meal.recipeId)));
              if (matchedBase) return { ...matchedBase, ...meal };
            }
            return meal;
          }
        }
      }
    }
  }

  return null;
};

function sanitizeModalDOMHierarchy() {
  const topLevelWrappers = [
    'view-modal-wrap',
    'modal-wrap',
    'tesco-modal-wrap',
    'mobile-action-sheet-wrap',
    'app-confirm-modal',
    'app-confirm-wrap',
    'manual-ing-panel',
    'parse-modal-wrap',
    'mapping-modal-wrap',
    'unified-mapping-modal-wrap',
    'subst-modal-wrap',
    'merge-modal-wrap',
    'replace-ing-wrap',
    'mini-ing-wrap',
    'ingredient-family-details-wrap'
  ];
  topLevelWrappers.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentElement && el.parentElement !== document.body && el.parentElement.id !== 'app-container') {
      if (typeof window !== 'undefined' && window.PP_DEBUG) {
        console.warn(`[PlatePlan DOM Engine] Reparenting top-level #${id} to <body>`);
      }
      document.body.appendChild(el);
    }
  });

  const sheet = document.getElementById('mobile-action-sheet');
  const sheetWrap = document.getElementById('mobile-action-sheet-wrap');
  if (sheet && sheetWrap && sheet.parentElement !== sheetWrap) {
    sheetWrap.appendChild(sheet);
  }
}
window.sanitizeModalDOMHierarchy = sanitizeModalDOMHierarchy;
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', sanitizeModalDOMHierarchy);
  if (document.readyState !== 'loading') sanitizeModalDOMHierarchy();
}
// console.log("[v3.0.9 STATE PERSISTENCE]", "Defensive LocalStorage guard, sanitized Firestore streams, debounced autosave, and startup recovery active.");

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
  if (value === undefined || value === null) {
    return (space !== null && space !== undefined) ? 'null' : fallback;
  }
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





// == v3.0.6 BATCH RECIPE PRODUCT RELINKING ENGINE ==
async function runGlobalProductRelink() {
  // console.log('[v3.0.6 RELINK ENGINE] Starting batch recipe product relinking...');
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
        } else if (ing.groupId) {
          matchedProduct = resolveProductForIngredient(ing)?.product || null;
        }
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
    if (recipe.enhanced && recipe.enhanced.ingredients) {
      processIngList(recipe.enhanced.ingredients);
    }
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
  // console.log(`[v3.0.6 RELINK ENGINE] Relink complete. Updated ${relinkedCount} recipes.`);
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

// ============================================================================
// == v3.0.5 ROBUST PERSISTENCE & STATE RECOVERY ARCHITECTURE ==
// ============================================================================

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

function isMobilePlatePlan(){ return window.matchMedia('(max-width:839px)').matches; }
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
function mobileMoreView(id){ closeMobileMore(); showView(id); }
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

function executeSheetAction(actionFnName, ...args) {
  // 1. Close only the mobile action sheet container without destroying global modal backdrops
  const sheet = document.getElementById('mobile-action-sheet');
  const overlay = document.getElementById('mobile-action-sheet-overlay');
  const wrap = document.getElementById('mobile-action-sheet-wrap');
  if (sheet) sheet.classList.remove('open', 'active');
  if (overlay) overlay.classList.remove('open', 'active');
  if (wrap) wrap.classList.remove('open', 'active');

  // 2. Defer execution slightly for DOM transition cleanup
  setTimeout(() => {
    if (typeof window[actionFnName] === 'function') {
      window[actionFnName](...args);
    } else if (typeof actionFnName === 'function') {
      actionFnName(...args);
    } else if (typeof eval !== 'undefined') {
      try {
        const fn = eval(actionFnName);
        if (typeof fn === 'function') fn(...args);
      } catch(e) {
        console.error(`[executeSheetAction] Function '${actionFnName}' not found on window.`, e);
      }
    } else {
      console.error(`[executeSheetAction] Function '${actionFnName}' not found on window.`);
    }
  }, 50);
}
window.executeSheetAction = executeSheetAction;

function openMobileActionSheet(title, actions){
  const host=document.getElementById('mobile-action-sheet'); if(!host) return;
  const titleId='mobile-action-sheet-title';
  host.setAttribute('role','dialog'); host.setAttribute('aria-modal','true'); host.setAttribute('aria-labelledby',titleId);
  host.innerHTML=`<div class="mobile-sheet-handle"></div><div class="row-between" style="align-items:center;margin-bottom:10px"><h3 id="${titleId}" style="margin:0">${ppEscapeHtml(title||'Actions')}</h3><button class="btn sm ghost" onclick="closeMobileActionSheet()">Close</button></div><div style="display:grid;gap:6px">${actions.map(action=>`<button class="btn ${action.danger?'danger':''}" onclick="executeSheetAction(function(){ ${action.onclick}; })">${ppEscapeHtml(action.label)}</button>`).join('')}</div>`;
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
function openRecipeActions(recipeId){
  if (typeof window.openRecipeActions === 'function' && window.openRecipeActions !== openRecipeActions) {
    return window.openRecipeActions(recipeId);
  }
  const recipe = getProductIndexRecipe(recipeId) || (state?.recipes || []).find(r => r.id === recipeId);
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
    markMobileLayerForBack(wrap, 'actions');
  }
  setTimeout(() => sheet.querySelector('button')?.focus(), 0);
}
function openEnhancedRecipeActions(recipeId){
  if (typeof window.openEnhancedRecipeActions === 'function' && window.openEnhancedRecipeActions !== openEnhancedRecipeActions) {
    return window.openEnhancedRecipeActions(recipeId);
  }
  const recipe = getProductIndexRecipe(recipeId) || (state?.recipes || []).find(r => r.id === recipeId);
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
    markMobileLayerForBack(wrap, 'actions');
  }
  setTimeout(() => sheet.querySelector('button')?.focus(), 0);
}
window.openRecipeActions = openRecipeActions;
window.openEnhancedRecipeActions = openEnhancedRecipeActions;
function openManualRecipeEntry(){ showView('add'); setTimeout(()=>document.getElementById('r-name')?.focus(),0); }
function openRecipeCaptureFromToolbar(){ showView('add'); setTimeout(()=>openRecipePhotoPicker('library'),0); }
function openRecipeTextFromToolbar(){ showView('add'); setTimeout(()=>openRecipeTextPaste(),0); }

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
  if(platePlanReturningFromUiClose){platePlanReturningFromUiClose=false;return;}
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
  if(close){event.preventDefault();close.click();}
});
// Actions moved to modular recipes.js

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
function getProductIndexRecipe(id){ return platePlanIndexes.recipes.get(id) || (state?.recipes||[]).find(recipe=>recipe.id===id) || null; }
function resetProgressiveList(name,signature){
  if(platePlanListSignatures[name]!==signature){ platePlanListSignatures[name]=signature; platePlanListLimits[name]=PLATEPLAN_LIST_BATCH; }
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
function markPlatePlanViewsDirty(...names){ (names.length?names:['today','vault','ingredients','bank','planner','planlib','shopping','data','prefs']).forEach(name=>platePlanDirtyViews.add(name)); }

// == INITIALIZATION ==
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

function useBakedFileState(){
  runWithRecoveryPoint('Before switching to file data', applyBakedFileState);
}

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

  // Migration: ensure every recipe has a nutrition.total and nutrition.perServing object.
  // Legacy recipes only have flat r.cal/r.prot etc which are per-serving values.
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

    // Restore active meal plan if empty
    const planBackupRaw = localStorage.getItem('plateplan_plan_backup');
    if(planBackupRaw && (!s.plan || typeof s.plan !== 'object' || Object.keys(s.plan).length === 0)){
      try {
        const parsedPlan = JSON.parse(planBackupRaw);
        if(parsedPlan && typeof parsedPlan === 'object' && Object.keys(parsedPlan).length > 0){
          s.plan = parsedPlan;
        }
      } catch(_e) {}
    }

    // Restore historical meal plans if empty
    const historyBackupRaw = localStorage.getItem('plateplan_history_v2') || localStorage.getItem('plateplan_history_backup');
    if(historyBackupRaw && (!Array.isArray(s.planHistory) || s.planHistory.length === 0)){
      try {
        const parsedHist = JSON.parse(historyBackupRaw);
        if(Array.isArray(parsedHist) && parsedHist.length > 0){
          s.planHistory = parsedHist;
        }
      } catch(_e) {}
    }

    // Check recovery points if plan or planHistory is still empty
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

function syncPlatePlanVersionDisplay() {
  const versionStr = `v${PLATEPLAN_APP_VERSION}`;
  const versionEl = document.getElementById('plateplan-update-version');
  if (versionEl) versionEl.textContent = versionStr;
  const logoPill = document.querySelector('.logo span:last-child');
  if (logoPill && (logoPill.textContent.startsWith('v') || logoPill.textContent.includes('mod'))) {
    logoPill.textContent = versionStr;
  }
  document.querySelectorAll('.app-version, #footer-version, #main-footer-version, .footer-version').forEach(el => {
    el.textContent = versionStr;
  });
}
window.syncPlatePlanVersionDisplay = syncPlatePlanVersionDisplay;

let platePlanApplicationInitialized=false;
function initializePlatePlanApplication(){
  if(platePlanApplicationInitialized)return;
  platePlanApplicationInitialized=true;
  console.log('[PlatePlan v3.3.7-mod] Initializing core application...');
  performance.mark?.('plateplan-start');
  installPlatePlanModalHistory();
  clearVolatileSavedDom(document);
  syncPlatePlanVersionDisplay();
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
  (window.ensurePlannerShell || window.PlatePlanPlanner?.ensurePlannerShell || (typeof ensurePlannerShell !== 'undefined' ? ensurePlannerShell : () => {}))();
  (window.installPlannerSummaryObserver || window.PlatePlanPlanner?.installPlannerSummaryObserver || (typeof installPlannerSummaryObserver !== 'undefined' ? installPlannerSummaryObserver : () => {}))();
  refreshAllProductDefaultsAndRecipeNutrition();
  rebuildPlatePlanIndexes();
  safeLocalStorageSet(SK, safeJsonStringify(state));
  checkStartupPlanRecovery(state?.plan);

  (window.resetTodayDate || window.PlatePlanPlanner?.resetTodayDate || (typeof resetTodayDate !== 'undefined' ? resetTodayDate : () => {}))({render:false});
  requestPlatePlanViewRender('today');
  platePlanDirtyViews.delete('today');
  (window.scheduleTodayMidnightRefresh || window.PlatePlanPlanner?.scheduleTodayMidnightRefresh || (typeof scheduleTodayMidnightRefresh !== 'undefined' ? scheduleTodayMidnightRefresh : () => {}))();
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
  // Cloud-First: remove baked state recovery banner to avoid local cache overrides
  setPlatePlanStartupInert(false);
  if (typeof window.initPlatePlanCloudSync === 'function') {
    window.initPlatePlanCloudSync();
  } else if (window.PlatePlanCloud && typeof window.PlatePlanCloud.initPlatePlanCloudSync === 'function') {
    window.PlatePlanCloud.initPlatePlanCloudSync();
  } else if (typeof initPlatePlanCloudSync === 'function') {
    initPlatePlanCloudSync();
  }
  setPlatePlanStartupInert(false);
  window.addEventListener('online',()=>{ updatePlatePlanSyncStatus(getPlatePlanSyncOutbox().length?'saving':'connecting'); flushPlatePlanSyncOutbox(); });
  window.addEventListener('offline',()=>updatePlatePlanSyncStatus('offline'));

  // Sync Original Serves to Target Servings unless manually edited
  const origServesInput = document.getElementById('r-serves-orig');
  const targetServesInput = document.getElementById('r-serves');
  if(origServesInput && targetServesInput){
    origServesInput.addEventListener('input', () => {
      if(!targetServesInput.dataset.manuallyChanged || !targetServesInput.value){
        targetServesInput.value = origServesInput.value;
      }
    });
    targetServesInput.addEventListener('input', () => {
      targetServesInput.dataset.manuallyChanged = 'true';
    });
  }

  // Close map and recipe search dropdowns on outside click
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
}else{
  queueMicrotask(initializePlatePlanApplication);
}

// == MEAL BUDGETS & FIT SCORING ==
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
    // Sort ingredients by protein density (prot per kcal)
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

// Category Dropdown Population (Alphabetical Sort)
function renderCatOptions(selectId, defaultVal) {
  const sel = document.getElementById(selectId);
  if(!sel) return;
  
  // Merge and sort
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

function getCategorySearchOptions(){
  return Object.entries(CAT).filter(([k,v]) => v).sort((a,b)=>a[1].localeCompare(b[1]));
}

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
  }else if(event.key==='Enter'){
    event.preventDefault();choices[Math.max(0,index)]?.click();
  }else if(event.key==='Escape'){
    event.preventDefault();menu.hidden=true;
  }
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
  if(match){onReady(match);return;}
  if(!raw){input?.focus();return showPlatePlanToast('Choose a category before saving.','error');}
  openAppConfirmModal('Create new category?',`No existing category matches <strong>${ppEscapeHtml(raw)}</strong>. Create this category and continue saving the product?`,'Create category',()=>{
    const existing=getCategorySearchOptions().find(([key,label])=>canonicalGroupKey(label)===canonicalGroupKey(raw)||canonicalGroupKey(key)===canonicalGroupKey(raw));
    const slug=existing?.[0]||uniqueCategorySlug(raw);
    if(!existing){state.customCats[slug]=raw;CAT[slug]=raw;}
    ['mi-cat','pp-cat','tp-cat','mini-cat'].forEach(id=>{const element=document.getElementById(id);if(element)renderCatOptions(id,id===selectId?slug:element.value||'other');});
    chooseCategorySuggestion(selectId,slug);
    onReady(slug);
  },()=>input?.focus());
}

function enhanceAllCategorySearches(){
  ['mi-cat','pp-cat','tp-cat','mini-cat'].forEach(enhanceCategorySearch);
}

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

// == NORMALIZED SEARCH HELPERS ==
function getSearchVariants(str) {
  const q = (str || '').toLowerCase().trim();
  if(!q) return [];
  const alt1 = q.replace(/hummus/g, 'houmous').replace(/yogurt/g, 'yoghurt');
  const alt2 = q.replace(/houmous/g, 'hummus').replace(/yoghurt/g, 'yogurt');
  return [...new Set([q, alt1, alt2])];
}

function toGrams(qty, unit, itemWeight = 100){
  unit=(unit||'').toLowerCase().replace(/s$/,'');
  if(unit === 'qty' || unit === 'clove' || unit === 'head' || unit === 'bulb') {
      return Math.round(qty * (unit === 'clove' ? 6 : (unit === 'head' || unit === 'bulb' ? 65 : itemWeight)));
  }
  const factor=UNIT_TO_GRAMS[unit]||itemWeight;
  return Math.round(qty*factor);
}

function isLikelyLiquidIngredientName(name){
  const text = (name || '').toLowerCase();
  if(/\b(paste|pastes|puree|purees|purée|purées)\b/.test(text)) return false;
  return /oil|vinegar|sauce|milk|water|stock|juice|tamari|soy|maple|syrup|cream|yoghurt|yogurt|coconut milk|passata|dressing|mustard|ketchup|mayo/.test(text);
}

function isLikelyCountableIngredientName(name){
  const text = (name || '').toLowerCase();
  if(/gnocchi|rice|pasta|noodle|noodles|grain|grains|couscous|bulgur|orzo|flour|sugar|salt|seasoning|spice|spices|herb|herbs|ground|powder|flakes|paprika|cumin|coriander|nutmeg|oregano|parsley|basil|thyme|rosemary|peppercorn|black pepper|white pepper|oil|vinegar|sauce|pesto|paste|chutney|honey|syrup/.test(text)) return false;
  if(/\bchilli\b/.test(text) && !/fresh|red|green|jalapeno|jalapeño|pepper/.test(text)) return false;
  if(/\bpepper\b/.test(text) && /black|white|ground|cracked|corn/.test(text)) return false;
  if(/\b(each|per item|per serving)\b/.test(text)) return true;
  if(/\b\d+\s*[x×]\s*\d+(?:\.\d+)?\s*(g|kg|ml|l)\b/.test(text)) return true;
  if(/\b\d+\s*(pack|packs|burger|burgers|sausage|sausages|roll|rolls|bun|buns|wrap|wraps|tortilla|tortillas|egg|eggs|fillet|fillets)\b/.test(text)) return true;
  return /garlic|clove|egg|avocado|potato|sweet potato|onion|\bpepper\b|\bchilli\b|lime|lemon|mango|burger|sausage|wrap|tortilla|bun|roll|bagel|fillet|slice|piece|block|ball/.test(text);
}

function shouldClearAutoItemWeight(ing){
  if(!ing || isLikelyCountableIngredientName(ing.name)) return false;
  const weight = +ing.itemWeight || 0;
  if(!weight) return false;
  const packSize = +ing.drainedWeight || +ing.packSize || 0;
  const itemCount = +ing.itemCount || 0;
  if(itemCount > 1) return false;
  return weight === 100 || itemCount === 1 || (packSize > 0 && Math.abs(weight - packSize) < 0.01);
}

function inferParsedUnitForIngredient(ing){
  const unit = (ing?.unit || '').toLowerCase().replace(/s$/,'');
  const name = ing?.name || ing?.raw || '';
  if(unit === 'g' || unit === 'kg') return 'g';
  if(unit === 'ml' || unit === 'l') return 'ml';
  if(unit === 'qty') return 'qty';
  if(['clove','head','bulb','slice','piece','stalk','sprig','leaf'].includes(unit)) return 'qty';
  if(['tsp','tbsp','cup'].includes(unit)) return isLikelyLiquidIngredientName(name) ? 'ml' : 'g';
  if(ing?.isStock) return 'qty';
  if(isLikelyLiquidIngredientName(name)) return 'ml';
  if(isLikelyCountableIngredientName(name)) return 'qty';
  return unit || 'g';
}

function normaliseRecipeAmountForUi(ing = {}){
  const name = ing.name || ing.raw || '';
  let qty = parseFloat(ing.qty);
  if(!isFinite(qty)) qty = 1;
  let unit = (ing.unit || '').toLowerCase().replace(/s$/,'') || inferParsedUnitForIngredient(ing);
  if(unit === 'kg') return { qty: Math.round(qty * 1000 * 10) / 10, unit: 'g' };
  if(unit === 'l') return { qty: Math.round(qty * 1000 * 10) / 10, unit: 'ml' };
  if(['tsp','tbsp','cup'].includes(unit)) {
    return { qty: toGrams(qty, unit), unit: isLikelyLiquidIngredientName(name) ? 'ml' : 'g' };
  }
  if(unit === 'clove') return { qty, unit: 'qty' };
  if(unit === 'head' || unit === 'bulb') return { qty: Math.round(qty * 11 * 10) / 10, unit: 'qty' };
  if(['slice','piece','stalk','sprig','leaf','tin','can'].includes(unit)) return { qty, unit: 'qty' };
  if(unit === 'ml') return { qty, unit: 'ml' };
  if(unit === 'qty') return { qty, unit: 'qty' };
  return { qty, unit: 'g' };
}



// == NUTRITION CALCULATION ==
function ppEscapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function ppEscapeAttr(value){
  return ppEscapeHtml(value).replace(/`/g, '&#96;');
}

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

function productPackGrams(product){
  return getProductUsablePackAmount(product);
}

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

function isUsableProduct(product){
  return !!(product && hasUsableIngredientNutrition(product));
}

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

function canonicalGroupKey(name){
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

function normaliseAliasText(alias){
  return String(alias || '').replace(/\s+/g,' ').trim();
}

function addIngredientGroupAlias(group, alias){
  const clean = normaliseAliasText(alias);
  if(!group || !clean) return false;
  if(!Array.isArray(group.aliases)) group.aliases = [];
  const key = canonicalGroupKey(clean);
  if(!key || group.aliases.some(a => canonicalGroupKey(a) === key)) return false;
  group.aliases.push(clean);
  return true;
}

function addIngredientFamilyAlias(family, alias){
  const clean = normaliseAliasText(alias);
  if(!family || !clean) return false;
  if(!Array.isArray(family.aliases)) family.aliases = [];
  const key = canonicalGroupKey(clean);
  if(!key || canonicalGroupKey(family.name) === key || family.aliases.some(a => canonicalGroupKey(a) === key)) return false;
  family.aliases.push(clean);
  return true;
}

function syncIngredientGroupAliases(group, products = []){
  if(!group) return;
  if(!Array.isArray(group.aliases)) group.aliases = [];
  group.aliases = group.aliases
    .map(normaliseAliasText)
    .filter(Boolean)
    .filter((alias, idx, arr) => arr.findIndex(a => canonicalGroupKey(a) === canonicalGroupKey(alias)) === idx);
  addIngredientGroupAlias(group, group.name);
  (products || []).forEach(product => {
    addIngredientGroupAlias(group, product?.name);
  });
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

function getGroupCategoryLabel(group){
  return ppEscapeHtml(CAT[group?.cat] || group?.cat || 'Other');
}

function getGroupIngredientName(group){
  const family = getGroupIngredientFamily(group);
  return normaliseAliasText(family?.name || group?.family || inferIngredientFamilyFromText(group?.name || '')) || 'No ingredient';
}

function getGroupTypeName(group){
  return normaliseAliasText(group?.name || '') || 'Unnamed sub-type';
}

function groupIsHiddenDefaultType(group){
  if(!group) return false;
  const familyName = getGroupIngredientName(group);
  const family = getGroupIngredientFamily(group);
  const siblings = family ? (family.typeIds || []).filter(id => getIngredientGroup(id)).length : (state.ingredientGroups || []).filter(g => canonicalGroupKey(getGroupIngredientName(g)) === canonicalGroupKey(familyName)).length;
  return siblings <= 1 && canonicalGroupKey(group.name) === canonicalGroupKey(familyName);
}

function getGroupDisplayName(group){
  return groupIsHiddenDefaultType(group) ? getGroupIngredientName(group) : getGroupTypeName(group);
}

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
function updatePackModelSummary(prefix){
  const host=document.getElementById(prefix+'-pack-summary');if(host)host.textContent=formatProductPackSummary(readPackModelFromEditor(prefix));
}
function installPackModelSummaryListeners(){
  ['mi','tp'].forEach(prefix=>['pack','pack-unit','item-weight','item-weight-unit','drained-weight','drained-weight-unit'].forEach(suffix=>{
    const field=document.getElementById(`${prefix}-${suffix}`);if(field&&!field.dataset.packSummaryBound){field.dataset.packSummaryBound='1';field.addEventListener('input',()=>updatePackModelSummary(prefix));field.addEventListener('change',()=>updatePackModelSummary(prefix));}
  }));
}
function setPackUnitEditorValue(selectId,value,{allowLegacyCount=false}={}){
  const select=document.getElementById(selectId);if(!select)return;
  let legacy=[...select.options].find(option=>option.value==='qty');
  if(allowLegacyCount&&!legacy){legacy=document.createElement('option');legacy.value='qty';legacy.textContent='items (legacy — add item weight)';select.appendChild(legacy);}
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

function getAutoMappingStrategy(){
  return state?.prefs?.autoMappingStrategy || 'protein_per_kcal';
}

function scoreProductByPriority(product, priority = 'protein_per_kcal'){
  const packGrams = productPackGrams(product);
  const price = +product?.price || 0;
  if(priority === 'low_kcal') return -(+product?.cal || 0);
  if(priority === 'protein_per_kcal' || priority === 'prot_kcal' || priority === 'protein') return getProductProteinPer100Kcal(product);
  if(priority === 'least_protein_per_kcal') return -getProductProteinPer100Kcal(product);
  if(priority === 'protein_per_pound' || priority === 'value') return getProductProteinPerPound(product);
  if(priority === 'lowest_cost_per_g' || priority === 'cost_per_g' || priority === 'cost_per_100') {
    return (price > 0 && packGrams > 0) ? -(price / packGrams) : -999999;
  }
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

function groupIdForProduct(product){
  return product?.groupId || (product?.id ? 'grp_' + product.id : '');
}

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
      if(group.cat !== finalCat){ group.cat = finalCat; groupChanged = true; }
    }
    if(family && (!family.cat || family.cat === 'other' || (preferredCat && preferredCat !== 'other' && !established))){
      if(family.cat !== finalCat){ family.cat = finalCat; family.updatedAt = nowIso; }
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


function isAllowedZeroNutritionIngredient(ing){
  const text = `${ing?.name || ''} ${ing?.cat || ''}`.toLowerCase();
  return /\b(water|salt|msg|monosodium glutamate|creatine|stock cube|stock pot|seasoning cube)\b/.test(text);
}

function hasUsableIngredientNutrition(ing){
  if(!ing) return false;
  if(isAllowedZeroNutritionIngredient(ing)) return true;
  return !!((+ing.cal || 0) || (+ing.prot || 0) || (+ing.carb || 0) || (+ing.fat || 0) || (+ing.fibre || 0));
}

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

function getEffectiveIngredientGrams(ing, bankIng){
  // Recipe weights already describe edible quantity. Drained weight affects
  // purchasing and cost coverage, never the nutrition quantity a recipe states.
  return getRecipeIngredientGrams(ing, bankIng);
}

function round1(n){return Math.round((+n || 0) * 10) / 10;}

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

function pctOf(part,total){
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

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
  // Spread perServing at top level so all existing callers (which read .cal, .prot etc)
  // continue to receive per-serving values unchanged.
  return { ...perServing, totalNutrition, perServing, matched, total: ingCount };
}

// Recompute per-serving macros for a saved recipe from the current ingredient bank.
// Useful for legacy recipes that may have stored totals or stale values.
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
  if (product && product.groupId !== subtypeId) {
    product.groupId = subtypeId;
  }

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
  if(state.plan?.slots && typeof calculatePlanScore === 'function') {
    state.plan.score = calculatePlanScore(state.plan);
  }
  return { changedDefaults, changedRecipes };
}

function renderPlatePlanDependentViews(){
  markPlatePlanViewsDirty();
  const active=document.querySelector('.view.active')?.id?.replace('view-','')||'today';
  const renderers={today:renderToday,vault:renderVault,ingredients:renderIngredientBank,bank:renderBank,planner:renderPlan,planlib:renderPlanHistoryPanel,shopping:renderShopping,data:renderDataQuality,prefs:loadPrefs};
  if(renderers[active]){ renderers[active](); platePlanDirtyViews.delete(active); }
  if(mappingContext && document.getElementById('mapping-modal-wrap')?.classList.contains('open')) renderMappingList();
  if(document.getElementById('modal-wrap')?.classList.contains('open')){
    recalcModal('orig');
    recalcModal('enh');
  }
}

function refreshPlatePlanDerivedState({ persist = false, render = true, changedProductIds = [], changedGroupIds = [], changedRecipeIds = [], full = false } = {}){
  if (typeof platePlanNutritionCache !== 'undefined' && platePlanNutritionCache?.clear) platePlanNutritionCache.clear();
  if (window.platePlanUseUpCoverageCache?.clear) window.platePlanUseUpCoverageCache.clear();
  else if (window.PlatePlanPlanner?.platePlanUseUpCoverageCache?.clear) window.PlatePlanPlanner.platePlanUseUpCoverageCache.clear();
  else if (typeof platePlanUseUpCoverageCache !== 'undefined' && platePlanUseUpCoverageCache?.clear) platePlanUseUpCoverageCache.clear();
  ensureIngredientGroups();
  ensureIngredientFamilies();
  rebuildPlatePlanIndexes();
  const hasScope=changedProductIds.length||changedGroupIds.length||changedRecipeIds.length;
  let result;
  if(full||!hasScope){
    result=refreshAllProductDefaultsAndRecipeNutrition();
  }else{
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
    if(usesOriginal || usesEnhanced) {
      if(recalcRecipeObject(r)) changed++;
    }
  });
  return changed;
}

function recalcRecipeNutrition(id){
  const r = state.recipes.find(x=>x.id===id);
  if(!r){ openAppInfoModal('Recipe unavailable','The recipe could not be found.'); return; }
  if(!r.ingredients || !r.ingredients.length){ openAppInfoModal('Ingredients needed','This recipe has no ingredients to recalculate.'); return; }
  const n = calcRecipeNutrition(r.ingredients, r.serves||1);
  if(!n.matched){ openAppInfoModal('Mapped products needed','None of this recipe\u2019s ingredients are mapped to Product Bank yet.'); return; }
  recalcRecipeObject(r);
  saveState();
  if(typeof renderVault==='function') renderVault();
  showPlatePlanToast(`Recalculated with ${n.matched} of ${n.total} mapped ingredients.`);
}

// Per-meal portion math.
// `perServing` is the recipe's PER-SERVING macros (calcRecipeNutrition already divides by serves).
// Returns the ideal number of servings each person needs to hit the per-meal target
// for the given mealType ('breakfast' | 'lunch' | 'dinner' | 'snack' | string).
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
    ? `${recipe.id}:${recipeUpdated}:${variant}:${instanceId||''}:${targetServes||''}:${serves||''}:${who||''}:${resolvedMealType}:${ingLen}:${ingSig}:${state.prefs?.ecal||''}:${state.prefs?.eprot||''}:${state.prefs?.ccal||''}:${state.prefs?.cprot||''}:${JSON.stringify(state.prefs?.eAlloc||{})}:${JSON.stringify(state.prefs?.cAlloc||{})}:${JSON.stringify(state.prefs?.eProtAlloc||{})}:${JSON.stringify(state.prefs?.cProtAlloc||{})}`
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

function getIngredientMappingWarning(ing, resolved){
  // Do not flag caution warnings on confirmed or assigned ingredient mappings
  return '';
}

function renderIngredientMappingNote(ing, resolved, options = {}){
  if(!ing || typeof ing !== 'object' || !resolved) return '';
  const groupName = resolved.group?.name || '';
  const productName = resolved.product?.name || '';
  if(!groupName && !productName) return '';
  const mappedText = `mapped to ${groupName || productName}${productName ? ' using ' + productName : ''}`;
  const color = options.color || 'var(--text3)';
  return ` <span class="muted" style="color:${color};font-size:${options.fontSize || '11px'}">${ppEscapeHtml(mappedText)}</span>`;
}
function portionDeltaText(actual, target, unit) {
  if (!target) return '—';
  const pct = Math.round(((actual - target) / target) * 100);
  if (pct === 0) return `On target`;
  return `${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} target`;
}

function portionDeltaColor(actual, target) {
  if (!target) return 'var(--text2)';
  const pct = Math.abs(((actual - target) / target) * 100);
  if (pct <= 10) return 'var(--green)';
  if (pct <= 15) return 'var(--amber)';
  return 'var(--red)';
}

function proteinTargetText(actual, target) {
  if (!target) return '—';
  const pct = Math.round(((actual - target) / target) * 100);
  if (pct === 0) return 'On target';
  return `${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} target`;
}

function proteinTargetColor(actual, target) {
  if (!target) return 'var(--text2)';
  const pct = ((actual - target) / target) * 100;
  if (pct >= 0) return 'var(--green)';
  const shortfall = Math.abs(pct);
  if (shortfall <= 10) return 'var(--green)';
  if (shortfall <= 15) return 'var(--amber)';
  return 'var(--red)';
}

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

// == USAGE TRACKING (Part Q / U) ==
function getIngredientUsage(bankId) {
   const product = getProduct(bankId);
   let recipes = [];
   state.recipes.forEach(r => {
       const usesProduct = ing => ing && resolveProductForIngredient(ing).product?.id === bankId;
       if ((r.ingredients || []).some(usesProduct)) {
           recipes.push(r.name);
       } else if (r.enhanced && r.enhanced.ingredients && r.enhanced.ingredients.some(usesProduct)) {
           recipes.push(r.name + ' (Enhanced)');
       }
   });
   
   let plans = [];
   if(state.plan && state.plan.slots) {
       for(let d in state.plan.slots) {
           for(let k in state.plan.slots[d]) {
               let s = state.plan.slots[d][k];
               if(s && typeof s === 'object' && s.instanceId) {
                   const r = state.recipes.find(x => x.id === s.id);
                   if (r) {
                       const context = getPlanContextForInstance(s.instanceId);
                       const used = (r.ingredients || []).some(ing => resolveProductForIngredient(ing, context).product?.id === bankId);
                       if(used) plans.push(`${formatPlanDayLabel(state.plan,d,{short:true})} ${k}`);
                   }
               }
           }
       }
   }
   
   // Make unique
   recipes = [...new Set(recipes)];
   plans = [...new Set(plans)];
   return { recipes, plans };
}

// == TODAY ==
let platePlanTodayDate='';
let platePlanTodayTimer=null;
let platePlanLastActualDate='';

// == NAV ==
function applyPendingRecipePreFillToForm(){
  if(!platePlanPendingRecipePreFill) return;
  const recipe = platePlanPendingRecipePreFill;
  platePlanPendingRecipePreFill = null;

  // Clear existing form cleanly
  if(typeof clearForm === 'function') clearForm();

  // Recipe Name
  const nameEl = document.getElementById('r-name');
  if(nameEl && recipe.name){
    nameEl.value = recipe.name;
    nameEl.dispatchEvent(new Event('input', { bubbles: true }));
    nameEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Original Serves & Target Servings (Servings Sync)
  const servesOrigEl = document.getElementById('r-serves-orig');
  const servesTargetEl = document.getElementById('r-serves');
  const servesVal = recipe.servings ? String(recipe.servings) : '';
  if(servesOrigEl){
    servesOrigEl.value = servesVal;
    servesOrigEl.dispatchEvent(new Event('input', { bubbles: true }));
    servesOrigEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if(servesTargetEl){
    servesTargetEl.value = servesVal || '2';
    delete servesTargetEl.dataset.manuallyChanged;
    servesTargetEl.dispatchEvent(new Event('input', { bubbles: true }));
    servesTargetEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Prep time (mins)
  const timeEl = document.getElementById('r-time');
  if(timeEl && recipe.timeMinutes !== null && recipe.timeMinutes !== undefined && recipe.timeMinutes !== ''){
    timeEl.value = String(recipe.timeMinutes);
    timeEl.dispatchEvent(new Event('input', { bubbles: true }));
    timeEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Ingredients
  const ingsEl = document.getElementById('r-ingredients');
  if(ingsEl && recipe.ingredients){
    ingsEl.value = Array.isArray(recipe.ingredients) ? recipe.ingredients.join('\n') : String(recipe.ingredients);
    ingsEl.dispatchEvent(new Event('input', { bubbles: true }));
    ingsEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Method
  const methodEl = document.getElementById('r-method');
  if(methodEl && recipe.method){
    methodEl.value = Array.isArray(recipe.method) ? recipe.method.join('\n') : String(recipe.method);
    methodEl.dispatchEvent(new Event('input', { bubbles: true }));
    methodEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Meal types
  if(typeof setMealTypes === 'function'){
    const types = Array.isArray(recipe.mealTypes) && recipe.mealTypes.length ? recipe.mealTypes : ['dinner'];
    setMealTypes(types);
  }

  // Source fields
  const bookTitle = recipe.bookTitle || '';
  const author = recipe.author || '';
  const page = recipe.page || '';
  const url = recipe.url || '';
  const srcType = document.getElementById('r-src-type');
  if(recipe.sourceType && srcType){
    srcType.value = recipe.sourceType;
    if(typeof updateSrcFields === 'function') updateSrcFields();
    if(recipe.sourceType === 'book'){
      const bookEl = document.getElementById('r-src-book');
      const authEl = document.getElementById('r-src-author');
      const pageEl = document.getElementById('r-src-page');
      if(bookEl && bookTitle) bookEl.value = bookTitle;
      if(authEl && author) authEl.value = author;
      if(pageEl && page) pageEl.value = page;
    } else if(['tiktok','website','youtube','instagram'].includes(recipe.sourceType)){
      const urlEl = document.getElementById('r-src-url');
      if(urlEl && url) urlEl.value = url;
    }
    if(typeof updateSrcPreview === 'function') updateSrcPreview();
  }

  requestAnimationFrame(() => {
    nameEl?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    nameEl?.focus();
  });
  if(typeof showMsg === 'function') showMsg('form-msg', 'Recipe text loaded. Select original serves, target serves, meal type, suitable for, and source, then click Parse & Verify.', 'info');
  if(typeof showPlatePlanToast === 'function') showPlatePlanToast('Recipe text loaded into Add Recipe');
}

function renderPlatePlanLegacyView(id){
  if(id==='today'){ (window.resetTodayDate || window.PlatePlanPlanner?.resetTodayDate || (typeof resetTodayDate !== 'undefined' ? resetTodayDate : () => {}))({render:false}); renderToday(); }
  if(id==='vault')renderVault();
  if(id==='add'){
    if(platePlanPendingRecipePreFill){
      applyPendingRecipePreFillToForm();
    }else if(!editId && !platePlanPreserveAddForm){
      clearForm();
    }
    platePlanPreserveAddForm = false;
  }
  if(id==='ingredients')renderIngredientBank();
  if(id==='bank')renderBank();
  if(id==='planner'){
    (window.ensurePlannerShell || window.PlatePlanPlanner?.ensurePlannerShell || (typeof ensurePlannerShell !== 'undefined' ? ensurePlannerShell : () => {}))();
    const daySel=document.getElementById('plan-days');
    if(daySel && state.plan?.days) daySel.value = String(state.plan.days);
    buildExclGrid();
    renderPlan();
  }
  if(id==='planlib'){
    (window.ensurePlannerShell || window.PlatePlanPlanner?.ensurePlannerShell || (typeof ensurePlannerShell !== 'undefined' ? ensurePlannerShell : () => {}))();
    renderPlanHistoryPanel();
  }
  if(id==='shopping')renderShopping();
  if(id==='prefs')loadPrefs();
  if(id==='data')renderDataQuality();
}

const platePlanFeatureRenderers=Object.freeze({
  today(){
    (window.resetTodayDate || window.PlatePlanPlanner?.resetTodayDate || (typeof resetTodayDate !== 'undefined' ? resetTodayDate : () => {}))({render:false});
    return renderToday();
  },
  vault(){
    if (typeof window !== 'undefined' && typeof window.renderVault === 'function') {
      return window.renderVault();
    }
    return typeof renderVault === 'function' ? renderVault() : null;
  },
  add(){
    if(platePlanPendingRecipePreFill){
      applyPendingRecipePreFillToForm();
    }else if(!editId && !platePlanPreserveAddForm){
      clearForm();
    }
    platePlanPreserveAddForm = false;
  },
  ingredients:renderIngredientBank,
  bank:renderBank,
  planner(){
    (window.ensurePlannerShell || window.PlatePlanPlanner?.ensurePlannerShell || (typeof ensurePlannerShell !== 'undefined' ? ensurePlannerShell : () => {}))();
    const daySel=document.getElementById('plan-days');
    if(daySel && state.plan?.days) daySel.value=String(state.plan.days);
    buildExclGrid();
    return renderPlan();
  },
  planlib(){
    (window.ensurePlannerShell || window.PlatePlanPlanner?.ensurePlannerShell || (typeof ensurePlannerShell !== 'undefined' ? ensurePlannerShell : () => {}))();
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

// == FREE PHOTO-TO-RECIPE CAPTURE ==
function openRecipePhotoPicker(mode='library'){ document.getElementById(mode==='camera'?'recipe-photo-camera-input':'recipe-photo-input')?.click(); }

function revokeRecipePhotoUrls(){ recipePhotoObjectUrls.forEach(url=>URL.revokeObjectURL(url)); recipePhotoObjectUrls=[]; }

function renderRecipePhotoPreviews(){
  const host=document.getElementById('recipe-photo-previews');
  const actions=document.getElementById('recipe-photo-actions');
  if(!host||!actions) return;
  revokeRecipePhotoUrls();
  if(!recipePhotoFiles.length){host.innerHTML='';host.style.display='none';actions.style.display='none';return;}
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
function removeRecipePhoto(index){recipePhotoFiles.splice(index,1);renderRecipePhotoPreviews();}
function clearRecipePhotos(){recipePhotoFiles=[];revokeRecipePhotoUrls();renderRecipePhotoPreviews();showMsg('recipe-photo-msg','','info');}

async function prepareRecipePhoto(file){
  let source;
  if(typeof createImageBitmap==='function') source=await createImageBitmap(file,{imageOrientation:'from-image'});
  else source=await new Promise((resolve,reject)=>{const image=new Image();const url=URL.createObjectURL(file);image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Photo could not be opened.'));};image.src=url;});
  const sourceWidth=source.width||source.naturalWidth,sourceHeight=source.height||source.naturalHeight;
  const scale=Math.min(1,2000/Math.max(sourceWidth,sourceHeight));
  const width=Math.max(1,Math.round(sourceWidth*scale)),height=Math.max(1,Math.round(sourceHeight*scale));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  canvas.getContext('2d',{alpha:false}).drawImage(source,0,0,width,height);source.close?.();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Photo could not be prepared.')),'image/jpeg',0.86));
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
  return {blob,dataUrl,base64:String(dataUrl).split(',')[1],mimeType:'image/jpeg'};
}

async function loadPlatePlanAiModules(){
  if(platePlanAiModules) return platePlanAiModules;
  const version='12.5.0';
  const [app,ai,appCheck]=await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-ai.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-app-check.js`)
  ]);
  platePlanAiModules={app,ai,appCheck};return platePlanAiModules;
}

function platePlanRecipeRecognitionSchema(){
  return {type:'OBJECT',properties:{name:{type:'STRING'},servings:{type:'NUMBER'},timeMinutes:{type:'NUMBER'},sourceType:{type:'STRING'},bookTitle:{type:'STRING'},author:{type:'STRING'},page:{type:'STRING'},ingredients:{type:'ARRAY',items:{type:'STRING'}},method:{type:'ARRAY',items:{type:'STRING'}},warnings:{type:'ARRAY',items:{type:'STRING'}}},required:['name','ingredients','method','warnings']};
}

async function recogniseRecipePhotos(){
  if(!recipePhotoFiles.length) return showMsg('recipe-photo-msg','Choose at least one recipe photo first.','warn');
  const cfg=window.PLATEPLAN_FIREBASE||{};
  if(!navigator.onLine||!cfg.aiEnabled||!cfg.recaptchaEnterpriseSiteKey){
    showMsg('recipe-photo-msg','Free cloud recognition is unavailable or not configured. Using the on-device fallback is still available.','warn');
    return;
  }
  showOverlay('Reading recipe photos','Transcribing only — nutrition is never estimated…');
  try{
    const prepared=[];for(const file of recipePhotoFiles) prepared.push(await prepareRecipePhoto(file));
    const {app,ai,appCheck}=await loadPlatePlanAiModules();
    if(location.hostname==='localhost'||location.hostname==='127.0.0.1') self.FIREBASE_APPCHECK_DEBUG_TOKEN=true;
    const modularApp=app.getApps().find(item=>item.name==='plateplan-ai')||app.initializeApp(cfg.config,'plateplan-ai');
    try{ appCheck.initializeAppCheck(modularApp,{provider:new appCheck.ReCaptchaEnterpriseProvider(cfg.recaptchaEnterpriseSiteKey),isTokenAutoRefreshEnabled:true}); }catch(error){ if(!/already exists|already initialized/i.test(error.message)) throw error; }
    const service=ai.getAI(modularApp,{backend:new ai.GoogleAIBackend()});
    const model=ai.getGenerativeModel(service,{model:cfg.aiModel||'gemini-2.5-flash',generationConfig:{responseMimeType:'application/json',responseSchema:platePlanRecipeRecognitionSchema(),temperature:0}});
    const prompt='Transcribe the recipe shown in these images in page order. Return only fields visibly present. Do not invent missing quantities, ingredients, steps, timings, servings, nutrition, or source details. Never calculate or estimate nutrition. Keep each ingredient as its original full line and each instruction as a separate step. Put uncertain or unreadable text in warnings.';
    const response=await model.generateContent([prompt,...prepared.map(item=>({inlineData:{data:item.base64,mimeType:item.mimeType}}))]);
    const parsed=JSON.parse(response.response.text());
    openRecipeRecognitionReview(normaliseRecognisedRecipe(parsed),'Firebase Gemini transcription');
    showMsg('recipe-photo-msg','','info');
  }catch(error){
    console.warn('Free recipe recognition failed',error);
    showMsg('recipe-photo-msg','Cloud recognition was unavailable or its free quota was reached. Use on-device OCR or paste text instead.','warn');
  }finally{hideOverlay();}
}

function loadTesseractScript(){
  if(window.Tesseract) return Promise.resolve();
  return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='./vendor/tesseract/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('The on-device OCR files are not available.'));document.head.appendChild(script);});
}

async function recogniseRecipePhotosLocally(){
  if(!recipePhotoFiles.length) return showMsg('recipe-photo-msg','Choose at least one recipe photo first.','warn');
  showOverlay('Reading on this device','Printed text works best; handwriting may need corrections…');
  let worker=null;
  try{
    await loadTesseractScript();
    worker=await Tesseract.createWorker('eng',1,{workerPath:'./vendor/tesseract/worker.min.js',corePath:'./vendor/tesseract/core',langPath:'./vendor/tesseract/lang',logger:progress=>{if(progress.status==='recognizing text'){const el=document.getElementById('overlay-sub');if(el)el.textContent=`Reading page text · ${Math.round((progress.progress||0)*100)}%`;}}});
    const pages=[];for(const file of recipePhotoFiles){const prepared=await prepareRecipePhoto(file);const result=await worker.recognize(prepared.blob);pages.push(result.data.text||'');}
    openRecipeRecognitionReview(parsePastedRecipeText(pages.join('\n\n')), 'On-device OCR · review carefully');
  }catch(error){showMsg('recipe-photo-msg',ppEscapeHtml(error.message)+' You can still paste text from Live Text or Google Lens.','error');}
  finally{try{await worker?.terminate();}catch(e){}hideOverlay();}
}

function parseTimeToCleanMinutes(str){
  if(str === null || str === undefined) return null;
  const s = String(str).toLowerCase().trim();
  if(!s) return null;

  // Check for range like "20-25 mins"
  const rangeMatch = s.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:mins?|minutes?)/i);
  if(rangeMatch){
    return Math.round((parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2);
  }

  let totalSeconds = 0;
  let matched = false;

  // Match hours: e.g. "1 hour", "1.5 hours", "2 hrs", "1h"
  const hrMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/i);
  if(hrMatch){
    totalSeconds += parseFloat(hrMatch[1]) * 3600;
    matched = true;
  }

  // Match minutes: e.g. "11 mins", "11 min", "11 minutes", "11m"
  const minMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m\b)/i);
  if(minMatch){
    totalSeconds += parseFloat(minMatch[1]) * 60;
    matched = true;
  }

  // Match seconds: e.g. "35 secs", "35 sec", "35 seconds", "35s"
  const secMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s\b)/i);
  if(secMatch){
    totalSeconds += parseFloat(secMatch[1]);
    matched = true;
  }

  if(matched){
    const minutes = Math.round(totalSeconds / 60);
    return minutes > 0 ? minutes : (totalSeconds > 0 ? 1 : null);
  }

  // Fallback to standalone integer
  const numMatch = s.match(/\b(\d+)\b/);
  if(numMatch){
    return parseInt(numMatch[1], 10);
  }

  return null;
}

function parseRobustRecipeText(raw){
  const text = String(raw || '').replace(/\r/g, '');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if(!lines.length){
    return {
      name: '',
      servings: null,
      timeMinutes: null,
      ingredients: [],
      method: [],
      mealTypes: ['dinner'],
      sourceType: '',
      bookTitle: '',
      author: '',
      page: '',
      url: '',
      warnings: [],
      rawText: ''
    };
  }

  // 1. Recipe name & Servings
  let name = '';
  let servings = null;

  // Extract servings: "Number of Servings: X", "Original Servings: X", "Servings: X", "Serves: X"
  const servingsMatch = text.match(/(?:Number of Servings|Original Servings|Original Serves|Servings|Serves)\s*[:\-]?\s*(\d+)/i);
  if(servingsMatch){
    servings = parseInt(servingsMatch[1], 10);
  }

  // "Recipe name *" -> First line or text preceding "Number of Servings:" / metadata
  const isMetaLine = l => /^(?:(?:Number of Servings|Original Servings|Original Serves|Servings?|Serves|Prep(?:aration)?(?:\s*time)?|Cook(?:\s*time)?|Total(?:\s*time)?|Time|Book|Cookbook|Author|By|Page|Source|Url|Link)\s*[:\-]|^https?:\/\/|^(?:ingredients?|method|instructions?|steps?)\b)/i.test(l);
  const firstMetaIdx = lines.findIndex(isMetaLine);
  if(firstMetaIdx > 0){
    name = lines.slice(0, firstMetaIdx).join(' ').trim();
  } else if(firstMetaIdx === 0){
    name = lines[0];
  } else {
    name = lines[0] || '';
  }
  name = name.replace(/^(?:recipe\s*title|recipe\s*name|recipe|title)\s*[:\-]?\s*/i, '').trim();
  name = toAPTitleCase(name);

  // 2. Prep time (mins)
  let timeMinutes = null;
  const prepTimeMatch = text.match(/(?:Prep(?:aration)?\s*time|Prep)\s*[:\-]?\s*([^\n\r|]+)/i);
  if(prepTimeMatch){
    timeMinutes = parseTimeToCleanMinutes(prepTimeMatch[1]);
  }
  if(timeMinutes === null){
    const totalTimeMatch = text.match(/(?:Total\s*time|Cook\s*time|Time)\s*[:\-]?\s*([^\n\r|]+)/i);
    if(totalTimeMatch){
      timeMinutes = parseTimeToCleanMinutes(totalTimeMatch[1]);
    }
  }
  if(timeMinutes === null){
    // Match compound time like "11 mins, 35 secs"
    const compoundMatch = text.match(/(\d+\s*(?:hours?|hrs?|h)\s*(?:and\s*)?\d+\s*(?:mins?|minutes?|m)|\d+\s*(?:mins?|minutes?)\s*,?\s*\d+\s*(?:secs?|seconds?|s))/i);
    if(compoundMatch){
      timeMinutes = parseTimeToCleanMinutes(compoundMatch[1]);
    }
  }
  if(timeMinutes === null){
    const simpleMinMatch = text.match(/(\d+)\s*(?:mins?|minutes?)/i);
    if(simpleMinMatch){
      timeMinutes = parseTimeToCleanMinutes(simpleMinMatch[1]);
    }
  }

  // 3. Ingredients & Method sections
  const ingHeaderIdx = lines.findIndex(l => /^(?:[-*•#\s]*)ingredients?\b/i.test(l));
  const methodHeaderIdx = lines.findIndex(l => /^(?:[-*•#\s]*)(?:method|instructions?|directions?|steps?|preparation)\b/i.test(l));

  let ingredients = [];
  let method = [];

  if(ingHeaderIdx >= 0 && methodHeaderIdx > ingHeaderIdx){
    ingredients = lines.slice(ingHeaderIdx + 1, methodHeaderIdx);
    method = lines.slice(methodHeaderIdx + 1);
  } else if(ingHeaderIdx >= 0 && methodHeaderIdx < 0){
    ingredients = lines.slice(ingHeaderIdx + 1);
  } else if(methodHeaderIdx >= 0 && ingHeaderIdx < 0){
    method = lines.slice(methodHeaderIdx + 1);
  } else {
    const looksIngredient = l => /^(?:[-•*]\s*)?(?:\d|½|¼|¾|one |two |a |an )/i.test(l) && /\b(g|kg|ml|l|tsp|tbsp|cup|tin|can|bunch|clove|slice|handful|pinch|x|pack|block|onion|garlic|oil|salt|pepper|sauce|chicken|beef|egg|rice|pasta|cheese|butter|water|sugar|flour)\b/i.test(l);
    lines.forEach(l => {
      if(l === name || /^(?:serves?|number of servings|prep|cook|total|time|recipe)\b/i.test(l)) return;
      if(looksIngredient(l)){
        ingredients.push(l);
      } else {
        method.push(l);
      }
    });
  }

  ingredients = ingredients.filter(l => !/^(?:ingredients?|method|instructions?|steps?)\s*:?$/i.test(l.trim()));
  method = method.filter(l => !/^(?:ingredients?|method|instructions?|steps?)\s*:?$/i.test(l.trim()));

  // 4. Meal Types
  const lowerText = text.toLowerCase();
  const mealTypes = [];
  if(lowerText.includes('breakfast') || lowerText.includes('brekkie') || lowerText.includes('pancake') || lowerText.includes('porridge') || lowerText.includes('waffle') || lowerText.includes('granola') || lowerText.includes('smoothie')) mealTypes.push('breakfast');
  if(lowerText.includes('lunch') || lowerText.includes('sandwich') || lowerText.includes('salad') || lowerText.includes('wrap') || lowerText.includes('soup')) mealTypes.push('lunch');
  if(lowerText.includes('dinner') || lowerText.includes('curry') || lowerText.includes('casserole') || lowerText.includes('roast') || lowerText.includes('pasta') || lowerText.includes('stew') || lowerText.includes('risotto') || lowerText.includes('pie') || lowerText.includes('stir-fry')) mealTypes.push('dinner');
  if(lowerText.includes('snack') || lowerText.includes('dessert') || lowerText.includes('biscuit') || lowerText.includes('cookie') || lowerText.includes('cake') || lowerText.includes('muffin')) mealTypes.push('snack');
  if(!mealTypes.length) mealTypes.push('dinner');

  // 5. Source info
  let sourceType = '';
  let bookTitle = '';
  let author = '';
  let page = '';
  let url = '';

  const urlMatch = text.match(/(https?:\/\/[^\s\)\>\]]+)/i);
  if(urlMatch){
    url = urlMatch[1];
    if(url.includes('tiktok.com')) sourceType = 'tiktok';
    else if(url.includes('youtube.com') || url.includes('youtu.be')) sourceType = 'youtube';
    else if(url.includes('instagram.com')) sourceType = 'instagram';
    else sourceType = 'website';
  }

  const bookMatch = text.match(/(?:Book|From the book|Cookbook|Source)\s*:\s*([^\n\r,]+)/i);
  if(bookMatch && !sourceType){
    sourceType = 'book';
    bookTitle = bookMatch[1].trim();
  }
  const authorMatch = text.match(/(?:Author|By)\s*:\s*([^\n\r,]+)/i);
  if(authorMatch) author = authorMatch[1].trim();
  const pageMatch = text.match(/(?:Page|p\.?)\s*[:\-]?\s*(\d+)/i);
  if(pageMatch) page = pageMatch[1].trim();

  return {
    name,
    servings,
    timeMinutes,
    ingredients,
    method,
    mealTypes,
    sourceType,
    bookTitle,
    author,
    page,
    url,
    warnings: [],
    rawText: text
  };
}

function splitPastedRecipeBlocks(rawText){
  const text = String(rawText || '').replace(/\r/g, '').trim();
  if(!text) return [];

  // 1. Check if text contains explicit recipe title header markers:
  // e.g. "Recipe Title:", "Title:", "Recipe:"
  // Or "Recipe 1:", "Recipe #1:"
  const lines = text.split('\n');
  const headerLineIndices = [];
  lines.forEach((line, idx) => {
    if(/^\s*(?:Recipe\s*Title|Title|Recipe)\s*[:\-]/i.test(line) || /^\s*Recipe\s*#?\d+\s*[:\-]/i.test(line)){
      headerLineIndices.push(idx);
    }
  });

  let blocks = [];
  if(headerLineIndices.length > 1){
    // Split into individual recipe blocks based on header lines
    for(let i = 0; i < headerLineIndices.length; i++){
      const start = headerLineIndices[i];
      const end = (i + 1 < headerLineIndices.length) ? headerLineIndices[i + 1] : lines.length;
      const blockText = lines.slice(start, end).join('\n').trim();
      if(blockText) blocks.push(blockText);
    }
  } else if(/(?:\n\s*){3,}/.test(text)){
    // Double-blank line breaks (\n\n\n or more)
    const rawChunks = text.split(/(?:\n\s*){3,}/);
    blocks = rawChunks.map(c => c.trim()).filter(c => c.length > 15);
  }

  if(!blocks.length){
    blocks = [text];
  }

  return blocks;
}

function parsePastedRecipeText(raw){
  try {
    const parsed = parseRobustRecipeText(raw);
    const parsedIngs = (parsed.ingredients || []).map(parseIngredientLine).filter(Boolean);
    const convertedMethod = convertMethodQuantitiesToPercentages(parsed.method || [], parsedIngs);
    parsed.method = convertedMethod.length ? convertedMethod : parsed.method;
    return normaliseRecognisedRecipe(parsed);
  } catch(err) {
    console.warn('parsePastedRecipeText error fallback:', err);
    return normaliseRecognisedRecipe({
      name: 'Pasted Recipe',
      servings: 2,
      timeMinutes: 30,
      mealTypes: ['dinner'],
      ingredients: String(raw||'').split('\n').filter(Boolean),
      method: [],
      warnings: ['Could not automatically structure all sections; please review fields.'],
      rawText: String(raw||'')
    });
  }
}

function normaliseRecognisedRecipe(value){
  return {
    name: toAPTitleCase(String(value?.name || '')),
    servings: value?.servings !== null && value?.servings !== undefined ? +value.servings : null,
    timeMinutes: value?.timeMinutes !== null && value?.timeMinutes !== undefined ? +value.timeMinutes : null,
    mealTypes: Array.isArray(value?.mealTypes) && value.mealTypes.length ? value.mealTypes : ['dinner'],
    sourceType: String(value?.sourceType || ''),
    bookTitle: String(value?.bookTitle || ''),
    author: String(value?.author || ''),
    page: String(value?.page || ''),
    url: String(value?.url || ''),
    ingredients: (value?.ingredients || []).map(String).filter(Boolean),
    method: (value?.method || []).map(String).filter(Boolean),
    warnings: (value?.warnings || []).map(String).filter(Boolean),
    rawText: String(value?.rawText || '')
  };
}

function ensureRecipeRecognitionModal(){
  let wrap=document.getElementById('recipe-recognition-wrap');if(wrap)return wrap;
  wrap=document.createElement('div');wrap.id='recipe-recognition-wrap';wrap.className='modal-wrap';wrap.style.zIndex='620';wrap.innerHTML='<div class="modal" style="max-width:700px"></div>';document.body.appendChild(wrap);return wrap;
}
function closeRecipeRecognitionModal(){document.getElementById('recipe-recognition-wrap')?.classList.remove('open');}

let currentRecognisedRecipe = null;

function parseRecipeText(raw){
  return parsePastedRecipeText(raw);
}

function openRecipeRecognitionReview(recipe, label){
  currentRecognisedRecipe = recipe;
  const wrap = ensureRecipeRecognitionModal();
  const queueLen = (state && Array.isArray(state.importQueue)) ? state.importQueue.length : 0;
  const queueIdx = (state && typeof state.importQueueIndex === 'number') ? state.importQueueIndex : 0;
  const isMulti = queueLen > 1;

  let progressBadge = '';
  if (isMulti) {
    progressBadge = `<span id="import-queue-counter-badge" style="background:var(--purple-bg, #EEF2FF);color:var(--purple, #4F46E5);font-size:12px;font-weight:700;padding:3px 10px;border-radius:12px;border:1px solid rgba(79,70,229,0.2)">Reviewing Recipe ${queueIdx + 1} of ${queueLen}</span>`;
  }

  const subLabel = label || (isMulti ? `Sequential Import Queue (${queueIdx + 1} of ${queueLen})` : 'Pasted text · review recipe');

  const skipBtnHtml = isMulti ? `
    <button type="button" class="btn secondary" id="review-skip-recipe-btn" onclick="skipImportQueueItem()">Skip Recipe</button>
  ` : '';

  wrap.querySelector('.modal').innerHTML = `
    <div class="row-between" style="align-items:center;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <h3 style="margin:0">Review Recipe</h3>
        ${progressBadge}
      </div>
      <button class="btn sm ghost" onclick="cancelImportQueueAndClose()">Close</button>
    </div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:10px">${ppEscapeHtml(subLabel)}</div>
    <div class="msg warn" style="margin:0 0 12px">Check every quantity and instruction against the original. Standard metric units and method percentages applied.</div>
    <div class="grid3">
      <div style="grid-column:span 2"><label>Name</label><input id="recognised-name" value="${ppEscapeAttr(recipe?.name || '')}"></div>
      <div><label>Servings</label><input id="recognised-serves" type="number" min="1" value="${recipe?.servings || 2}"></div>
    </div>
    <div class="grid2">
      <div><label>Time (minutes)</label><input id="recognised-time" type="number" min="1" value="${recipe?.timeMinutes || ''}"></div>
      <div><label>Book/source title</label><input id="recognised-book" value="${ppEscapeAttr(recipe?.bookTitle || '')}"></div>
    </div>
    <div class="field">
      <label>Ingredients — one per line</label>
      <textarea id="recognised-ingredients" style="min-height:180px">${ppEscapeHtml((recipe?.ingredients || []).join('\n'))}</textarea>
    </div>
    <div class="field">
      <label>Method — one step per line</label>
      <textarea id="recognised-method" style="min-height:220px">${ppEscapeHtml((recipe?.method || []).join('\n'))}</textarea>
    </div>
    ${(recipe?.warnings && recipe.warnings.length) ? `<div class="msg warn">${recipe.warnings.map(ppEscapeHtml).join('<br>')}</div>` : ''}
    <div class="btn-row" style="margin-top:14px;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn primary" id="review-save-recipe-btn" onclick="saveCurrentReviewedRecipe()">Save Recipe</button>
      ${skipBtnHtml}
      <button type="button" class="btn ghost" onclick="applyRecognisedRecipeToForm()">Edit in Add Form</button>
      <button type="button" class="btn ghost" onclick="cancelImportQueueAndClose()">Cancel</button>
    </div>
  `;
  wrap.classList.add('open');
}

async function saveCurrentReviewedRecipe(){
  const name = document.getElementById('recognised-name')?.value.trim() || 'Untitled Recipe';
  const serves = +document.getElementById('recognised-serves')?.value || 2;
  const timeMinutes = document.getElementById('recognised-time')?.value !== '' ? +document.getElementById('recognised-time')?.value : null;
  const bookTitle = document.getElementById('recognised-book')?.value.trim() || '';
  const ingredientsLines = (document.getElementById('recognised-ingredients')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const methodLines = (document.getElementById('recognised-method')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);

  const parsedIngs = ingredientsLines.map(parseIngredientLine).filter(Boolean);
  ensureIngredientGroups();
  parsedIngs.forEach(ing => {
    const groupMatch = fuzzyMatchIngredientGroup(ing.name);
    if(groupMatch){
      ing.groupId = groupMatch.id;
      ing.bankId = resolveProductForIngredient(ing).product?.id || "";
    } else {
      const bankMatch = fuzzyMatchBank(ing.name);
      if(bankMatch){
        ing.bankId = bankMatch.id;
        ing.groupId = bankMatch.groupId || "";
      }
    }
  });

  const nutrition = calcRecipeNutrition(parsedIngs, serves);
  const ps = nutrition.perServing;
  const mealTypes = currentRecognisedRecipe?.mealTypes || ['dinner'];
  const portions = calcPortions(ps, state.prefs, serves, 'both', mealTypes[0] || 'dinner');
  const nowIso = new Date().toISOString();
  const recipeId = 'r' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

  const fullRecipe = {
    id: recipeId,
    name: name,
    servings: serves,
    serves: serves,
    types: mealTypes,
    ingredients: parsedIngs,
    method: methodLines,
    steps: methodLines,
    ...ps,
    nutrition: { total: nutrition.totalNutrition, perServing: ps },
    portionE: portions.e,
    portionC: portions.c,
    bankCalculated: true,
    source: (bookTitle || currentRecognisedRecipe?.sourceType) ? {
      type: currentRecognisedRecipe?.sourceType || 'book',
      book: bookTitle,
      author: currentRecognisedRecipe?.author || '',
      page: currentRecognisedRecipe?.page || '',
      url: currentRecognisedRecipe?.url || ''
    } : null,
    timeMinutes: timeMinutes,
    updatedAt: nowIso
  };

  recalcRecipeObject(fullRecipe);

  if(!state) state = {};
  if(!Array.isArray(state.recipes)) state.recipes = [];
  state.recipes.push(fullRecipe);

  // Save reviewed recipe document to recipes subcollection
  try {
    if(typeof saveRecipe === 'function'){
      await saveRecipe(fullRecipe);
    }
  } catch(err) {
    console.warn('saveRecipe error during queue save:', err);
  }

  platePlanNutritionCache.clear();
  markPlatePlanViewsDirty();
  rebuildPlatePlanIndexes();
  saveState(true);
  showPlatePlanToast(`Saved "${fullRecipe.name}"`);

  // Sequential Stepper Engine: Increment queue index
  state.importQueueIndex = (state.importQueueIndex || 0) + 1;
  if(state.importQueue && state.importQueueIndex < state.importQueue.length){
    showPlatePlanToast(`Saved "${fullRecipe.name}" (${state.importQueueIndex} of ${state.importQueue.length})`);
    loadBatchRecipeIntoStepA(state.importQueue[state.importQueueIndex]);
  } else {
    // Reset queue, close modal, and refresh main UI view
    state.importQueue = [];
    state.importQueueIndex = 0;
    updateBatchUiBanners();
    closeRecipeRecognitionModal();
    showView('vault');
    renderVault();
    showPlatePlanToast(`Saved "${fullRecipe.name}"`);
  }
}

function detectRecipeTitle(rawText, index = 0){
  const text = String(rawText || '').replace(/\r/g, '').trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for(const l of lines){
    const m = l.match(/^(?:Recipe\s*Title|Title|Recipe)\s*[:\-]\s*(.+)$/i);
    if(m && m[1]?.trim()) return toAPTitleCase(m[1].trim());
  }
  for(const l of lines){
    const m = l.match(/^Recipe\s*#?\d+\s*[:\-]\s*(.+)$/i);
    if(m && m[1]?.trim()) return toAPTitleCase(m[1].trim());
  }
  try {
    const parsed = parseRobustRecipeText(text);
    if(parsed.name && parsed.name !== 'Recipe' && parsed.name !== 'Untitled Recipe'){
      return toAPTitleCase(parsed.name);
    }
  } catch(_e){}
  if(lines.length){
    for(const candidate of lines){
      if(!/^(?:ingredients?|method|instructions?|steps?|serves?|prep|cook|notes?)\b/i.test(candidate)){
        const cleaned = candidate.replace(/^#+\s*/, '').replace(/^Recipe\s*#?\d+\s*[:\-]?\s*/i, '').trim();
        return toAPTitleCase(cleaned) || `Recipe ${index + 1}`;
      }
    }
  }
  return `Recipe ${index + 1}`;
}

function isBatchImportActive(){
  return Boolean(state && Array.isArray(state.importQueue) && state.importQueue.length > 0 && typeof state.importQueueIndex === 'number' && state.importQueueIndex < state.importQueue.length);
}

function updateBatchUiBanners(){
  const active = isBatchImportActive();
  const queue = (state && Array.isArray(state.importQueue)) ? state.importQueue : [];
  const idx = (state && typeof state.importQueueIndex === 'number') ? state.importQueueIndex : 0;
  const currentNum = idx + 1;
  const totalNum = queue.length;
  const statusText = `Batch Import: Recipe ${currentNum} of ${totalNum}`;

  // 1. Step A: Add Recipe View Banner & Form Buttons
  const bannerAdd = document.getElementById('batch-import-banner-add');
  const skipAddBtn = document.getElementById('batch-skip-add-btn');
  const abortAddBtn = document.getElementById('batch-abort-add-btn');
  if(bannerAdd){
    if(active && totalNum > 1){
      bannerAdd.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <strong style="color:var(--purple,#4F46E5);font-size:14px">${ppEscapeHtml(statusText)}</strong>
          <span style="font-size:12px;color:var(--text2)">Review detected inputs below, then click &ldquo;Parse &amp; Verify&rdquo; to proceed.</span>
        </div>
        <div class="btn-row" style="margin:0;gap:6px;flex-wrap:wrap">
          <button type="button" class="btn sm secondary" onclick="skipBatchImportRecipe()">Skip Recipe</button>
          <button type="button" class="btn sm danger ghost" onclick="abortBatchImport()">Abort Batch Import</button>
        </div>
      `;
      bannerAdd.style.display = 'flex';
    } else {
      bannerAdd.style.display = 'none';
      bannerAdd.innerHTML = '';
    }
  }
  if(skipAddBtn) skipAddBtn.style.display = (active && totalNum > 1) ? 'inline-flex' : 'none';
  if(abortAddBtn) abortAddBtn.style.display = (active && totalNum > 1) ? 'inline-flex' : 'none';

  // 2. Step B: Parse Modal
  const bannerParse = document.getElementById('batch-banner-parse');
  const abortParseBtn = document.getElementById('batch-abort-parse-btn');
  const skipParseBtn = document.getElementById('batch-skip-parse-btn');
  const abortParseBtn2 = document.getElementById('batch-abort-parse-btn2');
  if(bannerParse){
    if(active && totalNum > 1){
      bannerParse.textContent = statusText;
      bannerParse.style.display = 'inline-block';
    } else {
      bannerParse.style.display = 'none';
    }
  }
  if(abortParseBtn) abortParseBtn.style.display = (active && totalNum > 1) ? 'inline-flex' : 'none';
  if(skipParseBtn) skipParseBtn.style.display = (active && totalNum > 1) ? 'inline-flex' : 'none';
  if(abortParseBtn2) abortParseBtn2.style.display = (active && totalNum > 1) ? 'inline-flex' : 'none';

  // 3. Step C: Mapping Modal
  const bannerMapping = document.getElementById('batch-banner-mapping');
  const abortMappingTop = document.getElementById('batch-abort-mapping-top');
  const skipMappingBtn = document.getElementById('batch-skip-mapping-btn');
  const abortMappingBtn = document.getElementById('batch-abort-mapping-btn');
  if(bannerMapping){
    if(active && totalNum > 1){
      bannerMapping.textContent = statusText;
      bannerMapping.style.display = 'inline-block';
    } else {
      bannerMapping.style.display = 'none';
    }
  }
  if(abortMappingTop) abortMappingTop.style.display = (active && totalNum > 1) ? 'inline-flex' : 'none';
  if(skipMappingBtn) skipMappingBtn.style.display = (active && totalNum > 1) ? 'inline-flex' : 'none';
  if(abortMappingBtn) abortMappingBtn.style.display = (active && totalNum > 1) ? 'inline-flex' : 'none';

  // 4. Step D: Review Modal
  const bannerReview = document.getElementById('batch-banner-review');
  const abortReviewTop = document.getElementById('batch-abort-review-top');
  const skipReviewBtn = document.getElementById('batch-skip-review-btn');
  const abortReviewBtn = document.getElementById('batch-abort-review-btn');
  if(bannerReview){
    if(active && totalNum > 1){
      bannerReview.textContent = statusText;
      bannerReview.style.display = 'inline-block';
    } else {
      bannerReview.style.display = 'none';
    }
  }
  if(abortReviewTop) abortReviewTop.style.display = (active && totalNum > 1) ? 'inline-flex' : 'none';
  if(skipReviewBtn) skipReviewBtn.style.display = (active && totalNum > 1) ? 'inline-flex' : 'none';
  if(abortReviewBtn) abortReviewBtn.style.display = (active && totalNum > 1) ? 'inline-flex' : 'none';
}

function loadBatchRecipeIntoStepA(rawBlock){
  if(!rawBlock) return;
  // Ensure prior modals are closed cleanly
  closeRecipeRecognitionModal();
  document.getElementById('parse-modal-wrap')?.classList.remove('open');
  document.getElementById('mapping-modal-wrap')?.classList.remove('open');
  if(document.getElementById('modal-wrap')?.classList.contains('open')){
    closeModal(true);
  }

  // Parse recipe block
  const parsed = parseRobustRecipeText(rawBlock);
  const detectedTitle = detectRecipeTitle(rawBlock, (state?.importQueueIndex || 0));

  // Set flag so showView('add') does not clear our populated form fields
  platePlanPreserveAddForm = true;
  showView('add');

  editId = null;
  const formTitle = document.getElementById('form-title');
  if(formTitle) formTitle.textContent = 'Add recipe';

  // 1. Name
  const nameEl = document.getElementById('r-name');
  if(nameEl){
    nameEl.value = parsed.name || detectedTitle;
    nameEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 2. Servings (Original and Target)
  const origServes = parsed.servings ? String(parsed.servings) : '2';
  const servesOrigEl = document.getElementById('r-serves-orig');
  const servesTargetEl = document.getElementById('r-serves');
  if(servesOrigEl){
    servesOrigEl.value = origServes;
    servesOrigEl.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if(servesTargetEl){
    servesTargetEl.value = origServes;
    delete servesTargetEl.dataset.manuallyChanged;
    servesTargetEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 3. Time
  const timeEl = document.getElementById('r-time');
  if(timeEl){
    timeEl.value = (parsed.timeMinutes !== null && parsed.timeMinutes !== undefined && parsed.timeMinutes !== '') ? String(parsed.timeMinutes) : '';
    timeEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 4. Ingredients (raw text)
  const ingsEl = document.getElementById('r-ingredients');
  if(ingsEl){
    const ingsList = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
    ingsEl.value = ingsList.join('\n');
    ingsEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 5. Method (raw instructions)
  const methodEl = document.getElementById('r-method');
  if(methodEl){
    const methodList = Array.isArray(parsed.method) ? parsed.method : [];
    methodEl.value = methodList.join('\n');
    methodEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 6. Who
  const whoEl = document.getElementById('r-who');
  if(whoEl) whoEl.value = 'both';

  // 7. Meal Types
  if(typeof setMealTypes === 'function'){
    const types = Array.isArray(parsed.mealTypes) && parsed.mealTypes.length ? parsed.mealTypes : ['dinner'];
    setMealTypes(types);
  }

  // 8. Source
  if(parsed.sourceType){
    const srcType = document.getElementById('r-src-type');
    if(srcType){
      srcType.value = parsed.sourceType;
      if(typeof updateSrcFields === 'function') updateSrcFields();
      if(parsed.sourceType === 'book'){
        const bookEl = document.getElementById('r-src-book');
        const authEl = document.getElementById('r-src-author');
        const pageEl = document.getElementById('r-src-page');
        if(bookEl && parsed.bookTitle) bookEl.value = parsed.bookTitle;
        if(authEl && parsed.author) authEl.value = parsed.author;
        if(pageEl && parsed.page) pageEl.value = parsed.page;
      } else if(['tiktok','website','youtube','instagram'].includes(parsed.sourceType)){
        const urlEl = document.getElementById('r-src-url');
        if(urlEl && parsed.url) urlEl.value = parsed.url;
      }
      if(typeof updateSrcPreview === 'function') updateSrcPreview();
    }
  } else {
    const srcType = document.getElementById('r-src-type');
    if(srcType){
      srcType.value = '';
      if(typeof updateSrcFields === 'function') updateSrcFields();
      if(typeof updateSrcPreview === 'function') updateSrcPreview();
    }
  }

  // Update batch UI status banners across screens
  updateBatchUiBanners();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  
  const itemsHtml = blocks.map((b, idx) => {
    const title = detectRecipeTitle(b, idx);
    const parsed = parseRobustRecipeText(b);
    const serves = parsed.servings ? `${parsed.servings} servings` : '2 servings';
    const ingCount = (parsed.ingredients || []).length;
    const stepCount = (parsed.method || []).length;
    return `
      <div style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:10px;background:var(--surface)">
        <div class="row-between" style="align-items:center;margin-bottom:4px;gap:8px;flex-wrap:wrap">
          <strong style="font-size:14px;color:var(--text)">${idx + 1}. ${ppEscapeHtml(title)}</strong>
          <span style="font-size:11px;color:var(--text2);background:var(--surface2);padding:2px 8px;border-radius:6px">🍽️ ${serves}</span>
        </div>
        <div style="font-size:12px;color:var(--text2)">
          ${ingCount} ingredients detected · ${stepCount} method steps
        </div>
      </div>
    `;
  }).join('');

  wrap.querySelector('.modal').innerHTML = `
    <div class="row-between" style="align-items:center;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <h3 style="margin:0">Confirm Recipe Identification</h3>
        <span style="background:var(--purple-bg, #EEF2FF);color:var(--purple, #4F46E5);font-size:12px;font-weight:700;padding:3px 10px;border-radius:12px;border:1px solid rgba(79,70,229,0.2)">${blocks.length} Recipes Identified</span>
      </div>
      <button class="btn sm ghost" onclick="cancelImportQueueAndClose()">Close</button>
    </div>
    <div class="msg info" style="margin:0 0 14px;font-size:12px">
      These recipes will cycle through the full step-by-step wizard: <strong>Add Recipe &rarr; Verify Parsed Details &rarr; Map Ingredients &rarr; Review Recipe</strong> for each recipe in the queue.
    </div>
    <div style="max-height:50dvh;overflow-y:auto;margin-bottom:14px;padding-right:4px">
      ${itemsHtml}
    </div>
    <div class="btn-row" style="margin-top:14px;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn primary" onclick="confirmBatchIdentification()">Confirm &amp; Start Wizard Loop</button>
      <button type="button" class="btn secondary" onclick="openRecipeTextPaste()">Back to Paste</button>
      <button type="button" class="btn ghost" onclick="cancelImportQueueAndClose()">Cancel</button>
    </div>
  `;
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
  if(!rawText){
    if(typeof showPlatePlanToast === 'function') showPlatePlanToast('Please paste some recipe text first.', 'error');
    else if(typeof showToast === 'function') showToast('Please paste some recipe text first.', 'error');
    textEl?.focus();
    return;
  }

  if(!state) state = {};
  const blocks = splitPastedRecipeBlocks(rawText);
  if(blocks.length > 1){
    openConfirmRecipeIdentificationModal(blocks);
  } else {
    state.importQueue = [rawText];
    state.importQueueIndex = 0;
    closeRecipeRecognitionModal();
    loadBatchRecipeIntoStepA(rawText);
  }
}

function updateRecipePasteTextStatus(){
  const ta = document.getElementById('recipe-paste-text');
  if(!ta) return;
  const val = ta.value || '';
  const blocks = splitPastedRecipeBlocks(val);
  const badge = document.getElementById('recipe-paste-badge');
  const summary = document.getElementById('recipe-paste-summary');
  const btn = document.getElementById('recipe-paste-action-btn');

  if(blocks.length > 1){
    if(badge){
      badge.textContent = `${blocks.length} recipes detected`;
      badge.style.display = 'inline-block';
    }
    if(summary){
      summary.innerHTML = `<strong>Multi-recipe batch detected:</strong> Found ${blocks.length} independent recipe blocks. Clicking below will show the identification confirmation modal before starting the step-by-step wizard loop.`;
      summary.style.display = 'block';
    }
    if(btn){
      btn.textContent = `Identify & Queue ${blocks.length} Recipes`;
    }
  } else {
    if(badge) badge.style.display = 'none';
    if(summary) summary.style.display = 'none';
    if(btn) btn.textContent = 'Import & Review Recipe';
  }
}

function openRecipeTextPaste(){
  const wrap=ensureRecipeRecognitionModal();
  wrap.querySelector('.modal').innerHTML=`<div class="row-between" style="align-items:center;margin-bottom:10px"><div style="display:flex;align-items:center;gap:10px"><h3 style="margin:0">Paste extracted recipe text</h3><span id="recipe-paste-badge" style="display:none;background:var(--purple-bg);color:var(--purple);font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px"></span></div><button class="btn sm ghost" onclick="cancelRecipeTextPaste()">Close</button></div><p style="font-size:12px;color:var(--text2);margin-bottom:10px">Paste recipe text below (supports single recipes or multi-recipe blocks separated by headers e.g. <code>Recipe Title:</code> or double blank lines). Multi-recipe imports cycle through the full wizard step-by-step.</p><textarea id="recipe-paste-text" style="min-height:45dvh" oninput="updateRecipePasteTextStatus()" placeholder="Recipe Title: Spicy Chickpea Curry&#10;&#10;Number of Servings: 4&#10;Prep time: 15 mins&#10;&#10;Ingredients&#10;- 2 x 400g tins chickpeas&#10;- 1 x red onion&#10;- 2 tbsp olive oil&#10;&#10;Method&#10;1. Dice red onions.&#10;2. Fry 40% of the red onions in olive oil."></textarea><div id="recipe-paste-summary" style="display:none;margin-top:8px;font-size:12px;color:var(--text2);padding:8px 12px;background:var(--surface2);border-radius:8px"></div><div class="btn-row" style="margin-top:12px"><button id="recipe-paste-action-btn" class="btn primary" onclick="startRecipeImportQueue()">Import &amp; Review Recipe</button><button class="btn ghost" onclick="cancelRecipeTextPaste()">Cancel</button></div>`;
  wrap.classList.add('open');setTimeout(()=>document.getElementById('recipe-paste-text')?.focus(),0);
}

function cancelRecipeTextPaste(){
  const ta = document.getElementById('recipe-paste-text');
  if(ta) ta.value = '';
  closeRecipeRecognitionModal();
}

function cancelImportQueueAndClose(){
  closeRecipeRecognitionModal();
  updateBatchUiBanners();
}

function reviewPastedRecipeText(){
  startRecipeImportQueue();
}

function applyPastedRecipeDirectlyFromModal(){
  startRecipeImportQueue();
}

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
  let itemsHtml = recipes.map((r, i) => `
    <div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px;background:var(--surface)">
      <div class="row-between" style="align-items:center;margin-bottom:6px">
        <div style="font-weight:700;font-size:14px;color:var(--text)">${i+1}. ${ppEscapeHtml(r.name || 'Recipe ' + (i+1))}</div>
        <div style="font-size:11px;color:var(--text2);display:flex;gap:8px">
          <span>🍽️ ${r.servings ? r.servings + ' servings' : '2 servings'}</span>
          <span>⏱️ ${r.timeMinutes ? r.timeMinutes + ' mins' : '30 mins'}</span>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:4px">
        <strong>${(r.ingredients||[]).length} ingredients:</strong> ${(r.ingredients||[]).slice(0, 3).map(ppEscapeHtml).join(', ')}${(r.ingredients||[]).length > 3 ? '...' : ''}
      </div>
      <div style="font-size:11px;color:var(--text3)">
        <strong>${(r.method||[]).length} steps</strong>
      </div>
    </div>
  `).join('');

  wrap.querySelector('.modal').innerHTML = `
    <div class="row-between" style="align-items:center;margin-bottom:10px">
      <div>
        <h3 style="margin:0">Batch Review: ${recipes.length} Recipes Detected</h3>
        <div style="font-size:11px;color:var(--text2);margin-top:3px">All ingredients normalised to metric and method percentages applied</div>
      </div>
      <button class="btn sm ghost" onclick="closeRecipeRecognitionModal()">Close</button>
    </div>
    <div style="max-height:55dvh;overflow-y:auto;margin:12px 0;padding-right:4px">
      ${itemsHtml}
    </div>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn primary" onclick="importAllBatchRecipesToVault()">Import All ${recipes.length} Recipes to Vault</button>
      <button class="btn secondary" onclick="useFirstBatchRecipeInForm()">Use 1st in Add Recipe</button>
      <button class="btn ghost" onclick="openRecipeTextPaste()">Back to Paste</button>
    </div>
  `;
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
        if(groupMatch){
          ing.groupId = groupMatch.id;
          ing.bankId = resolveProductForIngredient(ing).product?.id || "";
        } else {
          const bankMatch = fuzzyMatchBank(ing.name);
          if(bankMatch){
            ing.bankId = bankMatch.id;
            ing.groupId = bankMatch.groupId || "";
          }
        }
      });

      const serves = r.servings || 2;
      const nutrition = calcRecipeNutrition(parsedIngs, serves);
      const ps = nutrition.perServing;
      const portions = calcPortions(ps, state.prefs, serves, 'both', (r.mealTypes && r.mealTypes[0]) || 'dinner');

      const fullRecipe = {
        id: 'r' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        name: r.name || 'Untitled Recipe',
        servings: serves,
        serves: serves,
        types: r.mealTypes || ['dinner'],
        ingredients: parsedIngs,
        method: r.method || [],
        steps: r.method || [],
        ...ps,
        nutrition: { total: nutrition.totalNutrition, perServing: ps },
        portionE: portions.e,
        portionC: portions.c,
        bankCalculated: true,
        source: r.sourceType ? {
          type: r.sourceType,
          book: r.bookTitle || '',
          author: r.author || '',
          page: r.page || '',
          url: r.url || ''
        } : null,
        timeMinutes: r.timeMinutes || null,
        updatedAt: nowIso
      };

      recalcRecipeObject(fullRecipe);
      state.recipes.push(fullRecipe);
      importedCount++;
    });

    platePlanNutritionCache.clear();
    markPlatePlanViewsDirty();
    rebuildPlatePlanIndexes();
    saveState(true);
    closeRecipeRecognitionModal();
    window.pendingBatchRecipes = null;
    showView('vault');
    renderVault();
    showPlatePlanToast(`Successfully imported ${importedCount} recipes to Recipe Vault!`);
  });
}

function useFirstBatchRecipeInForm(){
  const recipes = window.pendingBatchRecipes || [];
  if(!recipes.length) return;
  applyRecognisedRecipeDirectlyToForm(recipes[0]);
}

function applyRecognisedRecipeDirectlyToForm(parsed){
  const recipe = normaliseRecognisedRecipe(parsed || {});
  
  // Set pending pre-fill and preservation flag so form isn't wiped during view transition
  platePlanPendingRecipePreFill = recipe;
  platePlanPreserveAddForm = true;

  closeRecipeRecognitionModal();
  clearRecipePhotos();

  showView('add');
  applyPendingRecipePreFillToForm();
}

function applyRecognisedRecipeToForm(){
  const name = document.getElementById('recognised-name')?.value.trim() || '';
  const serves = +document.getElementById('recognised-serves')?.value || null;
  const timeMinutes = document.getElementById('recognised-time')?.value !== '' ? +document.getElementById('recognised-time')?.value : null;
  const bookTitle = document.getElementById('recognised-book')?.value.trim() || '';
  const ingredients = (document.getElementById('recognised-ingredients')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const method = (document.getElementById('recognised-method')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  
  const merged = {
    ...(currentRecognisedRecipe || {}),
    name,
    servings: serves,
    timeMinutes,
    bookTitle,
    ingredients,
    method
  };
  applyRecognisedRecipeDirectlyToForm(merged);
}

// == SOURCE FIELDS ==
function updateSrcFields(){
  const typeEl = document.getElementById('r-src-type');
  if(!typeEl) return;
  const t = typeEl.value;
  const hint = document.getElementById('src-type-hint');
  const urlField = document.getElementById('src-url-field');
  const bookFields = document.getElementById('src-book-fields');
  const otherField = document.getElementById('src-other-field');
  if(urlField) urlField.style.display=URL_TYPES.includes(t)?'block':'none';
  if(bookFields) bookFields.style.display=t==='book'?'block':'none';
  if(otherField) otherField.style.display=t==='other'?'block':'none';
  if(hint) hint.style.display=t?'none':'inline';
  const labels={tiktok:'TikTok URL',website:'Website URL',youtube:'YouTube URL',instagram:'Instagram URL'};
  if(labels[t])document.getElementById('src-url-label').textContent=labels[t];
  const placeholders={tiktok:'https://www.tiktok.com/@user/video/...',website:'https://...',youtube:'https://www.youtube.com/watch?v=...',instagram:'https://www.instagram.com/p/...'};
  if(placeholders[t])document.getElementById('r-src-url').placeholder=placeholders[t];
  if(URL_TYPES.includes(t))document.getElementById('r-src-url').oninput=updateSrcPreview;
  updateSrcPreview();
}
function updateSrcPreview(){
  const t=document.getElementById('r-src-type').value;
  const prev=document.getElementById('src-preview');
  if(!t){prev.style.display='none';return;}
  let html='';
  if(URL_TYPES.includes(t)){const url=document.getElementById('r-src-url').value.trim();html=url?'Stored as: <a href="'+url+'" target="_blank" style="color:var(--purple)">'+url+'</a>':'Enter a URL above';}
  else if(t==='book'){const b=document.getElementById('r-src-book').value.trim(),a=document.getElementById('r-src-author').value.trim(),p=document.getElementById('r-src-page').value.trim();html=[b,a?'by '+a:'',p?'p.'+p:''].filter(Boolean).join(' / ')||'Enter book details above';}
  else if(t==='other'){const d=document.getElementById('r-src-other').value.trim();html=d||'Enter a description above';}
  prev.innerHTML=html;prev.style.display='block';
}
function getSource(){
  const t=document.getElementById('r-src-type').value;if(!t)return null;
  if(URL_TYPES.includes(t)){const url=document.getElementById('r-src-url').value.trim();return url?{type:t,url}:null;}
  if(t==='book'){const b=document.getElementById('r-src-book').value.trim();return b?{type:'book',book:b,author:document.getElementById('r-src-author').value.trim(),page:document.getElementById('r-src-page').value.trim()}:null;}
  if(t==='other'){const d=document.getElementById('r-src-other').value.trim();return d?{type:'other',desc:d}:null;}
  return null;
}
function renderSourceTag(src){
  if(!src)return'';
  if(typeof src === 'string'){
    const text = src.trim();
    return /^https?:\/\//i.test(text)
      ? '<a href="'+ppEscapeHtml(text)+'" target="_blank" rel="noopener" class="source-link">Open source ↗</a>'
      : '<span class="source-plain">'+ppEscapeHtml(text)+'</span>';
  }
  const labels={tiktok:'Open TikTok',website:'Open source',youtube:'Open YouTube',instagram:'Open Instagram'};
  if(src.url)return'<a href="'+ppEscapeHtml(src.url)+'" target="_blank" rel="noopener" class="source-link">'+ppEscapeHtml(labels[src.type]||'Open source')+' ↗</a>';
  if(src.type==='book'){const p=[src.book,src.author?'by '+src.author:'',src.page?'p.'+src.page:''].filter(Boolean).join(' / ');return'<span class="source-plain">'+ppEscapeHtml(p)+'</span>';}
  return'<span class="source-plain">'+ppEscapeHtml(src.desc||'Source')+'</span>';
}

function formatRecipeSourceText(src){
  if(!src) return '';
  if(typeof src === 'string') return src;
  if(src.url) return src.url;
  if(src.type === 'book') return [src.book, src.author ? 'by ' + src.author : '', src.page ? 'p. ' + src.page : ''].filter(Boolean).join(' / ');
  return src.desc || src.other || src.type || '';
}

function renderRecipeSourceForPrint(src){
  const text = formatRecipeSourceText(src);
  if(!text) return '';
  const safe = ppEscapeHtml(text);
  if(/^https?:\/\//i.test(text)) return `<p class="source">Source: <a href="${safe}">${safe}</a></p>`;
  return `<p class="source">Source: ${safe}</p>`;
}
function setSourceFields(src){
  document.getElementById('r-src-type').value=src?.type||'';
  updateSrcFields();
  if(!src)return;
  if(src.url)document.getElementById('r-src-url').value=src.url;
  if(src.book)document.getElementById('r-src-book').value=src.book;
  if(src.author)document.getElementById('r-src-author').value=src.author;
  if(src.page)document.getElementById('r-src-page').value=src.page;
  if(src.desc)document.getElementById('r-src-other').value=src.desc;
  updateSrcPreview();
}

// == MEAL TYPES ==
function getMealTypes(){return['breakfast','lunch','dinner'].filter(t=>document.getElementById('mt-'+t)?.checked);}
function setMealTypes(types){['breakfast','lunch','dinner'].forEach(t=>{const el=document.getElementById('mt-'+t);if(el)el.checked=types.includes(t);});}

// == RECIPE FORM ==
function clearForm(){
  ['r-name','r-serves','r-serves-orig','r-time','r-ingredients','r-method','r-src-url','r-src-book','r-src-author','r-src-page','r-src-other'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const targetServesEl = document.getElementById('r-serves');
  if(targetServesEl) delete targetServesEl.dataset.manuallyChanged;
  document.getElementById('r-who').value='both';
  document.getElementById('r-src-type').value='';
  setMealTypes(['dinner']);
  updateSrcFields();
  document.getElementById('form-msg').innerHTML='';
  editId=null;
  window.currentEditMap = {};
  window.currentEditGroupMap = {};
  window.currentEditIngredientMeta = {};
  document.getElementById('form-title').textContent='Add recipe';
}

// == RECIPE PARSING & INTERMEDIATE VERIFICATION ==
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
  const normalised = normaliseRecipeAmountForUi(ing);
  const displayUnit = normalised.unit;
  const stockWater = ing.stockWaterMl || '';
  return `
    <div class="parse-ing-row" style="display:flex; gap:5px; align-items:center;">
      <input type="number" class="p-qty" value="${normalised.qty || 1}" style="width:65px;" step="0.1" min="0">
      <select class="p-unit" style="width:85px; border:1px solid var(--border); border-radius:8px; padding:0 5px;">
        <option value="g" ${displayUnit==='g'?'selected':''}>g</option>
        <option value="ml" ${displayUnit==='ml'?'selected':''}>ml</option>
        <option value="qty" ${displayUnit==='qty'?'selected':''}>qty</option>
      </select>
      ${renderSectionInput('p-section', ing.section || '', 'parse-section-options', 'refreshParseSectionOptions()', '130px')}
      <input type="text" class="p-name" value="${(ing.name || '').replace(/"/g, '&quot;')}" style="flex:1;" oninput="refreshParseIngredientUnit(this)">
      <input type="number" class="p-stock-water" value="${stockWater}" placeholder="Water ml" title="Water used to make stock; displayed in recipe cards but not counted in nutrition or shopping." style="width:92px; display:${ing.isStock || stockWater ? 'block' : 'none'};" step="1" min="0">
      <button class="btn sm danger ghost" onclick="this.parentElement.remove()" style="padding:4px 8px;">&times;</button>
    </div>
  `;
}

function refreshParseIngredientUnit(input){
  const row = input.closest('.parse-ing-row');
  if(!row) return;
  const unit = row.querySelector('.p-unit');
  const water = row.querySelector('.p-stock-water');
  const name = input.value || '';
  if(/\bstock\b/i.test(name)) {
    if(unit) unit.value = 'qty';
    if(water) water.style.display = 'block';
  } else if(unit && (!unit.value || unit.value === 'g')) {
    unit.value = inferParsedUnitForIngredient({ name });
  }
}

function showParseModalMessage(message, type = 'error'){
  let msg = document.getElementById('parse-modal-msg');
  const modal = document.querySelector('#parse-modal-wrap .modal');
  if(!msg && modal){
    msg = document.createElement('div');
    msg.id = 'parse-modal-msg';
    const actions = modal.querySelector('.btn-row') || modal.lastElementChild;
    modal.insertBefore(msg, actions || null);
  }
  if(msg) msg.innerHTML = `<div class="msg ${type}">${ppEscapeHtml(message)}</div>`;
}

function addParseMethodStep() {
  const container = document.getElementById('parse-method-list');
  const div = document.createElement('div');
  div.className = 'parse-method-row';
  div.style = 'display:flex; gap:5px; align-items:flex-start;';
  div.innerHTML = `<span class="step-num" style="font-weight:600; font-size:12px; margin-top:8px; width:20px;"></span><textarea class="p-step" style="flex:1; min-height:40px;"></textarea><button class="btn sm danger ghost" onclick="this.parentElement.remove(); reindexMethodSteps();" style="padding:4px 8px;">&times;</button>`;
  container.appendChild(div);
  reindexMethodSteps();
}

function addParseIngredientRow() {
  const container = document.getElementById('parse-ing-list');
  if(!container) return;
  const datalist = document.getElementById('parse-section-options');
  if(datalist) datalist.remove();
  container.insertAdjacentHTML('beforeend', renderParseIngredientRow({ qty:1, unit:'qty', name:'' }) + '<datalist id="parse-section-options"></datalist>');
  refreshParseSectionOptions();
}

function reindexMethodSteps() {
  const rows = document.querySelectorAll('.parse-method-row');
  rows.forEach((r, i) => {
    const span = r.querySelector('.step-num');
    if(span) span.textContent = (i + 1) + '.';
  });
}

async function confirmParseAndMatch() {
  const finalIngs = [];
  document.querySelectorAll('.parse-ing-row').forEach(row => {
    const qty = parseFloat(row.querySelector('.p-qty').value) || 1;
    const unit = row.querySelector('.p-unit').value;
    const section = row.querySelector('.p-section')?.value.trim() || '';
    const name = row.querySelector('.p-name').value.trim();
    const stockWaterMl = +row.querySelector('.p-stock-water')?.value || null;
    if(name) {
      finalIngs.push({
        raw: `${qty} ${unit !== 'qty' ? unit : ''} ${name}`.trim(),
        qty, unit, name,
        grams: toGrams(qty, unit),
        ...(section ? { section } : {}),
        ...(stockWaterMl ? { isStock: true, stockWaterMl } : {})
      });
    }
  });

  const finalMethod = [];
  document.querySelectorAll('.parse-method-row').forEach(row => {
    const text = row.querySelector('.p-step').value.trim();
    if(text) finalMethod.push(text);
  });
  
  if(!finalIngs.length || !finalMethod.length) {
      showParseModalMessage("Please ensure there is at least one ingredient and one method step.");
      return;
  }

  try {
    await continueToMatch(finalIngs, finalMethod);
    document.getElementById('parse-modal-wrap').classList.remove('open');
  } catch(e) {
    console.error('Could not open ingredient mapping', e);
    hideOverlay();
    document.getElementById('parse-modal-wrap').classList.add('open');
    showParseModalMessage('Could not open ingredient mapping. Please check the ingredient names and try again.');
  }
}

// == DATA QUALITY CENTRE (Part Q) ==
function dataQualityFingerprint(value){
    const text = safeJsonStringify(value ?? null);
    let hash = 2166136261;
    for(let i = 0; i < text.length; i++){
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function isDataQualityWarningIgnored(key, fingerprint = ''){
    if(!key) return false;
    if(new Set(state.ignoredDataQualityWarnings || []).has(key)) return true;
    if(state.dataQualityDismissals && typeof state.dataQualityDismissals === 'object'){
        if(state.dataQualityDismissals[key]){
            if(!fingerprint) return true;
            return state.dataQualityDismissals[key] === fingerprint;
        }
    }
    return false;
}

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
    const key = `${entityType}:${entityId}:${code}`;
    return { entityType, entityId, code, severity, title, message, fixButtonHtml, fixTarget, key, legacyKey, fingerprint:dataQualityFingerprint(source) };
}

function abandonEditorReturn(){
    const context=editorNavigationStack[editorNavigationStack.length-1];
    if(context?.view==='data') editorNavigationStack.pop();
}

function finishEditorReturn(defaultView = ''){
    const context=editorNavigationStack.pop();
    if(!context){ if(defaultView) showView(defaultView); return false; }
    showView(context.view||'data');
    requestAnimationFrame(()=>{
      const row=document.querySelector(`[data-dq-key="${CSS.escape(context.issueKey||'')}"]`);
      const host=document.getElementById('dq-missing-list');
      if(row){
        row.closest('details')?.setAttribute('open','');
        row.classList.add('dq-return-highlight');
        row.scrollIntoView({block:'center'});
        if(host) host.insertAdjacentHTML('afterbegin','<div class="msg" style="margin:0 0 10px">Saved. This issue still needs attention.</div>');
      }
      else{
        window.scrollTo({top:Math.max(0,context.scrollY||0),behavior:'instant'});
        if(host) host.insertAdjacentHTML('afterbegin','<div class="msg success" style="margin:0 0 10px">Issue fixed and Data Quality has been refreshed.</div>');
      }
    });
    return true;
}

function dataQualityFixButton(issue){
    const supported=['product','ingredient','subtype','recipe','recipe-ingredient'];
    const target=issue.fixTarget||{entityType:issue.entityType,entityId:issue.entityId};
    if(!supported.includes(target.entityType)) return String(issue.fixButtonHtml||'').replace(/class="btn sm ghost"/,'class="btn sm dq-fix-btn"');
    const actionAttr = target.entityType === 'subtype' ? ` data-action="fix-subtype" data-subtype-id="${ppEscapeAttr(target.entityId)}"` : '';
    return `<button class="btn sm dq-fix-btn"${actionAttr} onclick="beginDataQualityFix('${ppEscapeAttr(target.entityType)}','${ppEscapeAttr(target.entityId)}','${ppEscapeAttr(issue.key)}')">Fix</button>`;
}

function renderDataQualityIssue(issue, dismissible = false){
    const ignoreButton = dismissible
      ? `<button class="btn sm ghost" onclick="ignoreDataQualityWarning('${ppEscapeAttr(issue.key)}','${ppEscapeAttr(issue.fingerprint)}')">Looks right</button>`
      : '';
    const severityLabel = issue.severity === 'blocker' ? '<span class="tag bad" style="margin-left:6px">Blocks calculation</span>' : '';
    return `<div class="dq-issue-row" data-dq-key="${ppEscapeAttr(issue.key)}">
      <div style="min-width:0"><div style="font-weight:600;font-size:13px">${ppEscapeHtml(issue.title)}${severityLabel}</div><div class="dq-warning">${ppEscapeHtml(issue.message)}</div></div>
      <div class="dq-issue-actions">${ignoreButton}${dataQualityFixButton(issue)}</div>
    </div>`;
}

function renderDataQualityWarningRow(title, message, fixButtonHtml = '', ignoreKey = ''){
    const ignoreButton = ignoreKey ? `<button class="btn sm ghost" onclick="ignoreDataQualityWarning('${ppEscapeAttr(ignoreKey)}')">Looks right</button>` : '';
    return `
    <div class="dq-issue-row">
        <div>
            <div style="font-weight:600; font-size:13px;">${ppEscapeHtml(title)}</div>
            <div class="dq-warning">${ppEscapeHtml(message)}</div>
        </div>
        <div class="dq-issue-actions">${ignoreButton}${String(fixButtonHtml||'').replace(/class="btn sm ghost"/,'class="btn sm dq-fix-btn"')}</div>
    </div>`;
}

function addPotentialDataQualityWarning(warnings, key, title, message, fixButtonHtml){
    if(!key || isDataQualityWarningIgnored(key)) return;
    warnings.push({ key, title, message, fixButtonHtml });
}

function dataQualityRecipeVariants(recipe){
    const rows = [{ label: 'Original', data: recipe, ingredients: recipe.ingredients || [], steps: recipe.steps || recipe.method || [] }];
    if(recipe.enhanced) {
        rows.push({
            label: 'Enhanced',
            data: recipe.enhanced,
            ingredients: recipe.enhanced.ingredients || [],
            steps: recipe.enhanced.method || recipe.enhanced.steps || []
        });
    }
    return rows;
}

function dataQualityVariantPerServing(recipe, variant){
    if(variant.data?.nutrition?.perServing) return variant.data.nutrition.perServing;
    if(variant.label === 'Original' && recipe.nutrition?.perServing) return recipe.nutrition.perServing;
    return variant.data || {};
}

function collectUnusualNumberWarnings(){
    const warnings = [];
    state.ingredients.forEach(product => {
        const title = product.name || 'Unnamed product';
        const fix = `<button class="btn sm dq-fix-btn" onclick="editIng('${ppEscapeAttr(product.id)}')">Fix</button>`;
        const addProductWarning = (field, value, message) => {
            const rounded = Math.round((+value || 0) * 10) / 10;
            addPotentialDataQualityWarning(warnings, `product-${product.id}-${field}-${rounded}`, title, message, fix);
        };
        if((+product.cal || 0) > 900) addProductWarning('cal', product.cal, `Calories look unusually high: ${product.cal} kcal per 100g/ml.`);
        ['prot','fat','carb','fibre'].forEach(field => {
            const value = +product[field] || 0;
            if(value > 100) addProductWarning(field, value, `${field === 'prot' ? 'Protein' : field.charAt(0).toUpperCase() + field.slice(1)} looks unusually high: ${value}g per 100g/ml.`);
        });
        if((+product.price || 0) > 25) addProductWarning('price', product.price, `Price looks unusually high: £${product.price}.`);
        if((+product.packSize || 0) > 5000) addProductWarning('packSize', product.packSize, `Pack size looks unusually large: ${product.packSize}${product.packUnit || ''}.`);
        if((+product.itemWeight || 0) > 1000) addProductWarning('itemWeight', product.itemWeight, `Weight of 1 item looks unusually large: ${product.itemWeight}${product.itemWeightUnit || 'g'}.`);
        if((+product.drainedWeight || 0) && (+product.packSize || 0) && product.drainedWeight > product.packSize && (product.packUnit || 'g') === (product.drainedWeightUnit || 'g')) {
            addProductWarning('drainedWeight', product.drainedWeight, `Drained weight (${product.drainedWeight}${product.drainedWeightUnit || 'g'}) is larger than pack size (${product.packSize}${product.packUnit || 'g'}).`);
        }
    });

    state.recipes.forEach(recipe => {
        const mealTypes = recipe.types || [];
        const isMainMeal = mealTypes.some(t => ['lunch','dinner'].includes(t));
        dataQualityRecipeVariants(recipe).forEach(variant => {
            const suffix = variant.label === 'Enhanced' ? ' enhanced' : ' original';
            const title = `${recipe.name || 'Untitled recipe'} (${variant.label})`;
            const fix = `<button class="btn sm dq-fix-btn" onclick="editRecipeModalView('${ppEscapeAttr(recipe.id)}')">Fix</button>`;
            const ps = dataQualityVariantPerServing(recipe, variant);
            const cal = +ps.cal || 0;
            const prot = +ps.prot || 0;
            if(isMainMeal && cal > 1400) addPotentialDataQualityWarning(warnings, `recipe-${recipe.id}-${variant.label}-cal-${Math.round(cal)}`, title, `Calories look unusually high: ${Math.round(cal)} kcal per serving.`, fix);
            if(isMainMeal && cal > 0 && cal < 150) addPotentialDataQualityWarning(warnings, `recipe-${recipe.id}-${variant.label}-cal-low-${Math.round(cal)}`, title, `Calories look unusually low: ${Math.round(cal)} kcal per serving.`, fix);
            if(prot > 120) addPotentialDataQualityWarning(warnings, `recipe-${recipe.id}-${variant.label}-prot-${Math.round(prot)}`, title, `Protein looks unusually high: ${Math.round(prot)}g per serving.`, fix);
            (variant.ingredients || []).forEach((ing, idx) => {
                const unit = String(ing.unit || '').toLowerCase();
                const qty = +ing.qty || +ing.grams || 0;
                const label = ing.name || ing.raw || `Ingredient ${idx + 1}`;
                if(['g','ml'].includes(unit) && qty > 3000) {
                    addPotentialDataQualityWarning(warnings, `recipe-${recipe.id}-${variant.label}-ing-${idx}-large-${Math.round(qty)}`, title, `${label} quantity looks unusually large: ${qty}${unit}.`, fix);
                }
                if(unit === 'qty' && qty > 20) {
                    addPotentialDataQualityWarning(warnings, `recipe-${recipe.id}-${variant.label}-ing-${idx}-qty-${Math.round(qty)}`, title, `${label} quantity looks unusually large: ${qty} items.`, fix);
                }
            });
        });
    });
    return warnings;
}

function recipeVariantHasOilIngredient(ingredients){
    return (ingredients || []).some(ing => {
        const resolved = resolveProductForIngredient(ing);
        const family = resolved.group ? getGroupIngredientFamily(resolved.group) : null;
        const text = [ing.raw, ing.name, resolved.group?.name, ...(resolved.group?.aliases || []), family?.name, ...(family?.aliases || []), resolved.product?.name].filter(Boolean).join(' ').toLowerCase();
        return /\b(olive|vegetable|sesame|rapeseed|sunflower|avocado|coconut)?\s*oil\b/.test(text);
    });
}

function recipeVariantMethodSuggestsOil(steps){
    const text = (steps || []).join(' ').toLowerCase();
    return /\b(oil|drizzle|fry|pan[-\s]?fry|sauté|saute|roast|bake|air[-\s]?fry)\b/.test(text);
}

function collectMissingOilWarnings(){
    const warnings = [];
    state.recipes.forEach(recipe => {
        const mealTypes = recipe.types || [];
        if(!mealTypes.some(t => ['lunch','dinner'].includes(t))) return;
        dataQualityRecipeVariants(recipe).forEach(variant => {
            if(recipeVariantHasOilIngredient(variant.ingredients)) return;
            if(!recipeVariantMethodSuggestsOil(variant.steps)) return;
            const title = `${recipe.name || 'Untitled recipe'} (${variant.label})`;
            const key = `recipe-${recipe.id}-${variant.label}-missing-oil`;
            const fix = `<button class="btn sm dq-fix-btn" onclick="editRecipeModalView('${ppEscapeAttr(recipe.id)}')">Fix</button>`;
            addPotentialDataQualityWarning(warnings, key, title, 'Method suggests oil or frying, but no oil is listed in the ingredients.', fix);
        });
    });
    return warnings;
}

function collectDeterministicDataQualityIssues(){
    ensureIngredientGroups();
    const issues = [];
    const add = input => issues.push(createDataQualityIssue(input));
    const extremeCostProducts = new Map();

    (state.ingredients || []).forEach(product => {
        const fix = `<button class="btn sm dq-fix-btn" onclick="editIng('${ppEscapeAttr(product.id)}')">Fix</button>`;
        if(!hasUsableIngredientNutrition(product)) add({entityType:'product',entityId:product.id,code:'unusable-nutrition',severity:'blocker',title:product.name || 'Unnamed product',message:'No usable mapped nutrition is available.',fixButtonHtml:fix,source:[product.cal,product.prot,product.carb,product.fat,product.fibre,product.name]});
        if(!(+(product.price) > 0)) add({entityType:'product',entityId:product.id,code:'missing-price',title:product.name || 'Unnamed product',message:'Price is missing.',fixButtonHtml:fix,source:product.price});
        if(!(+(product.packSize) > 0) || !product.packUnit) add({entityType:'product',entityId:product.id,code:'missing-pack',title:product.name || 'Unnamed product',message:'Pack size or unit is missing.',fixButtonHtml:fix,source:[product.packSize,product.packUnit]});
        if(!product.storage) add({entityType:'product',entityId:product.id,code:'missing-storage',title:product.name || 'Unnamed product',message:'Storage location is missing.',fixButtonHtml:fix,source:product.storage});
        const linkedGroup = product.groupId ? getIngredientGroup(product.groupId) : null;
        let parentFamily = linkedGroup ? getGroupIngredientFamily(linkedGroup) : null;
        if(!parentFamily && product.ingredientId) parentFamily = getIngredientFamily(product.ingredientId);
        if(!parentFamily && product.cat) parentFamily = getIngredientFamily(product.cat);
        const familySubGroups = parentFamily ? getFamilyGroups(parentFamily.id) : [];
        const familyHasNoSubtypes = !!parentFamily && familySubGroups.length === 0;
        const isCompliantWithoutSubtype = familyHasNoSubtypes && (product.subTypeId === null || product.subTypeId === 'default' || product.groupId === 'default' || !product.groupId);

        if(!linkedGroup && !isCompliantWithoutSubtype) add({entityType:'product',entityId:product.id,code:'missing-hierarchy-link',title:product.name || 'Unnamed product',message:'Product is not linked to a valid ingredient sub-type.',fixButtonHtml:fix,source:[product.groupId,product.cat]});
        const packUnit=String(product.packUnit||'').toLowerCase();
        const itemWeightUnit=String(product.itemWeightUnit||'g').toLowerCase();
        const drainedUnit=String(product.drainedWeightUnit||packUnit||'g').toLowerCase();
        const gross=getProductGrossPackAmount(product),usable=getProductUsablePackAmount(product),itemAmount=getProductItemAmount(product),derived=getProductDerivedItemCount(product);
        if(+product.drainedWeight>0&&packUnit!=='qty'&&drainedUnit!==packUnit){
            add({entityType:'product',entityId:product.id,code:'incompatible-pack-units',title:product.name||'Unnamed product',message:`Pack size uses ${packUnit}, but drained weight uses ${drainedUnit}. Use matching weight or volume units.`,fixButtonHtml:fix,source:[product.packSize,packUnit,product.drainedWeight,drainedUnit]});
        }
        if(+product.itemWeight>0&&packUnit!=='qty'&&itemWeightUnit!==packUnit){
            add({entityType:'product',entityId:product.id,code:'incompatible-item-unit',title:product.name||'Unnamed product',message:`Pack size uses ${packUnit}, but one item uses ${itemWeightUnit}. Use matching weight or volume units.`,fixButtonHtml:fix,source:[product.packSize,packUnit,product.itemWeight,itemWeightUnit]});
        }
        if(+product.drainedWeight>0&&gross>0&&usable>gross){
            add({entityType:'product',entityId:product.id,code:'drained-over-gross',title:product.name||'Unnamed product',message:'Drained usable content is larger than the gross pack size.',fixButtonHtml:fix,source:[gross,usable,packUnit,drainedUnit]});
        }
        if(itemAmount>0&&usable>0&&itemAmount>usable){
            add({entityType:'product',entityId:product.id,code:'item-over-usable-pack',title:product.name||'Unnamed product',message:'One item is heavier than the usable contents of the entire pack.',fixButtonHtml:fix,source:[itemAmount,usable,itemWeightUnit]});
        }
        if(derived>1.05&&Math.abs(derived-Math.round(derived))>0.12){
            add({entityType:'product',entityId:product.id,code:'implausible-derived-count',title:product.name||'Unnamed product',message:`The usable pack amount implies ${round1(derived)} items. Check total, drained and item weights.`,fixButtonHtml:fix,source:[gross,usable,itemAmount,derived]});
        }
        if(['g','ml'].includes(packUnit) && packUnit===itemWeightUnit && +product.itemWeight>0 && +product.packSize>0 && +product.itemWeight>+product.packSize){
            add({entityType:'product',entityId:product.id,code:'item-heavier-than-pack',title:product.name || 'Unnamed product',message:`Pack size (${product.packSize}${packUnit}) is smaller than the recorded weight of one item (${product.itemWeight}${itemWeightUnit}). This can produce extreme recipe costs.`,fixButtonHtml:fix,source:[product.packSize,packUnit,product.itemWeight,itemWeightUnit,product.price]});
        }
        if(packUnit==='qty' && !(+product.itemWeight>0)){
            add({entityType:'product',entityId:product.id,code:'count-pack-missing-item-weight',title:product.name || 'Unnamed product',message:'This is a counted pack but the weight of one item is missing, so nutrition and consumed cost cannot be calculated reliably.',fixButtonHtml:fix,source:[product.packSize,product.packUnit,product.itemWeight,product.itemWeightUnit]});
        }
        if(packUnit==='qty' && +product.itemCount>0 && +product.packSize>0 && +product.itemCount!==+product.packSize){
            add({entityType:'product',entityId:product.id,code:'count-pack-mismatch',title:product.name || 'Unnamed product',message:`Pack size says ${product.packSize} items but item count says ${product.itemCount}. Confirm the correct count.`,fixButtonHtml:fix,source:[product.packSize,product.packUnit,product.itemCount,product.itemWeight]});
        }
    });

    (state.recipes || []).forEach(recipe => {
        const fix = `<button class="btn sm dq-fix-btn" onclick="editRecipeModalView('${ppEscapeAttr(recipe.id)}')">Fix</button>`;
        dataQualityRecipeVariants(recipe).forEach(variant => {
            const variantId = variant.label.toLowerCase();
            const title = `${recipe.name || 'Untitled recipe'} · ${variant.label}`;
            if(!variant.ingredients.length) add({entityType:'recipe',entityId:`${recipe.id}:${variantId}`,code:'no-ingredients',severity:'blocker',title,message:'Recipe has no ingredients, so nutrition is zero.',fixButtonHtml:fix,source:variant.ingredients});
            if(!(variant.steps || []).filter(Boolean).length) add({entityType:'recipe',entityId:`${recipe.id}:${variantId}`,code:'missing-method',title,message:'Method is missing.',fixButtonHtml:fix,source:variant.steps});
            (variant.ingredients || []).forEach((ingredient, index) => {
                if(!ingredient || typeof ingredient !== 'object' || ingredient.excludeNutrition) return;
                const qty = +(ingredient.qty ?? ingredient.grams ?? 0);
                if(!(qty > 0)) return;
                const resolved = resolveProductForIngredient(ingredient, {});
                const entityId = `${recipe.id}:${variantId}:${index}`;
                const ingredientName = ingredient.name || ingredient.raw || `Ingredient ${index + 1}`;
                if(!resolved.product){
                    const unitStr = String(ingredient.unit || '').toLowerCase().trim();
                    const isCountedPantry = ['qty','count','item','whole','piece','pieces','small','medium','large','pack','pouch','unit'].includes(unitStr) || (!unitStr && +(ingredient.qty || 0) > 0);
                    const boundIngId = ingredient.ingredientId || ingredient.familyId || resolved.group?.ingredientId || (ingredient.bankId && getIngredientFamily(ingredient.bankId)) || (ingredientName && (state.ingredientFamilies || []).some(f => normaliseAliasText(f.name) === normaliseAliasText(ingredientName) || normaliseAliasText(f.name).includes(normaliseAliasText(ingredientName))));
                    if(boundIngId || (isCountedPantry && (ingredient.ingredientId || ingredient.bankId || resolved.groupId))){
                        // Counted pantry item bound directly to ingredientId when productId is null satisfies audit completeness
                        return;
                    }
                    const unmappedFix = `<button class="btn sm dq-fix-btn" onclick="openProductMappingModal('${ppEscapeAttr(entityId)}', 'recipe-ingredient:${ppEscapeAttr(entityId)}:unmapped-counted-ingredient')">Fix</button>`;
                    add({entityType:'recipe-ingredient',entityId,code:'unmapped-counted-ingredient',severity:'blocker',title,message:`${ingredientName} has a counted quantity but no mapped product.`,fixButtonHtml:unmappedFix,fixTarget:{entityType:'recipe-ingredient',entityId},source:[ingredient.name,ingredient.raw,ingredient.qty,ingredient.unit,ingredient.groupId,ingredient.bankId]});
                    return;
                }
                if(needsItemWeightForQtyIngredient(ingredient, resolved.product)) add({entityType:'recipe-ingredient',entityId,code:'missing-item-weight',severity:'blocker',title,message:`${ingredientName} is counted as items, but its product has no item weight.`,fixButtonHtml:fix,fixTarget:{entityType:'product',entityId:resolved.product.id},source:[ingredient.qty,ingredient.unit,resolved.product.id,resolved.product.itemWeight,resolved.product.itemWeightUnit]});
                const mappingWarning = getIngredientMappingWarning(ingredient, resolved);
                if(mappingWarning) add({entityType:'recipe-ingredient',entityId,code:'mapping-mismatch',title,message:mappingWarning,fixButtonHtml:fix,source:[ingredient.name,ingredient.groupId,ingredient.bankId,resolved.group?.id,resolved.product?.id]});
            });

            const serves=+(variant.data?.serves||recipe.serves)||1;
            const productCosts=new Map();
            (variant.ingredients||[]).forEach(ingredient=>{
                if(!ingredient||typeof ingredient!=='object')return;
                const resolved=resolveProductForIngredient(ingredient,{});
                const product=resolved.product;
                if(!product?.price||!product.packSize)return;
                const grams=getEffectiveIngredientGrams(ingredient,product);
                const packGrams=getProductUsablePackAmount(product);
                if(!(grams>0&&packGrams>0))return;
                productCosts.set(product.id,(productCosts.get(product.id)||0)+((+product.price/packGrams)*grams/serves));
            });
            const perServing=[...productCosts.values()].reduce((sum,value)=>sum+value,0);
            if(perServing>15){
                productCosts.forEach((contribution,productId)=>{
                    if(contribution<=10)return;
                    const product=getProduct(productId);if(!product)return;
                    const current=extremeCostProducts.get(productId)||{product,recipes:new Map(),maxContribution:0};
                    current.recipes.set(`${recipe.id}:${variantId}`,`${recipe.name || 'Untitled recipe'} · ${variant.label}`);
                    current.maxContribution=Math.max(current.maxContribution,contribution);
                    extremeCostProducts.set(productId,current);
                });
            }
        });
    });

    extremeCostProducts.forEach(({product,recipes,maxContribution})=>{
        const recipeNames=[...recipes.values()];
        add({entityType:'product',entityId:product.id,code:'extreme-recipe-cost',title:product.name || 'Unnamed product',message:`This product contributes up to £${maxContribution.toFixed(2)} per serving in ${recipeNames.join(', ')}. Check its price, pack unit, pack size and item weight.`,fixTarget:{entityType:'product',entityId:product.id},source:[product.price,product.packSize,product.packUnit,product.itemWeight,product.itemWeightUnit,recipeNames,maxContribution.toFixed(2)]});
    });

    (state.ingredientFamilies || []).forEach(family => {
        const groups = getFamilyGroups(family.id);
        const fix = `<button class="btn sm dq-fix-btn" onclick="openIngredientFamilyDetailsModal('${ppEscapeAttr(family.id)}')">Fix</button>`;
        if(!groups.length) add({entityType:'ingredient',entityId:family.id,code:'no-subtypes',title:family.name || 'Unnamed ingredient',message:'Ingredient has no sub-types.',fixButtonHtml:fix,source:family.typeIds});
        if(!family.cat || family.cat === 'other') add({entityType:'ingredient',entityId:family.id,code:'missing-category',title:family.name || 'Unnamed ingredient',message:'Ingredient has no sorted category.',fixButtonHtml:fix,source:family.cat});
    });
    (state.ingredientGroups || []).forEach(group => {
        const products = getGroupProducts(group.id);
        const fix = `<button class="btn sm dq-fix-btn" data-action="fix-subtype" data-subtype-id="${ppEscapeAttr(group.id)}" onclick="fixSubtypeDataQuality('${ppEscapeAttr(group.id)}')">Fix</button>`;
        const title = getGroupHierarchyText(group);
        if(!group.ingredientId || !getIngredientFamily(group.ingredientId)) add({entityType:'subtype',entityId:group.id,code:'missing-ingredient-link',title,message:'Sub-type is not linked to a valid ingredient.',fixButtonHtml:fix,source:group.ingredientId});
        if(!products.length) add({entityType:'subtype',entityId:group.id,code:'no-products',title,message:'Sub-type has no linked products.',fixButtonHtml:fix,source:products.map(p => p.id)});
        if(products.length && !resolveProductForIngredient({groupId:group.id}).product) add({entityType:'subtype',entityId:group.id,code:'no-valid-default',title,message:'Sub-type has products but no usable default.',fixButtonHtml:fix,source:[group.defaultProductId,group.manualDefaultProductId,products.map(p => [p.id,p.cal,p.prot])]});
        if(!group.cat || group.cat === 'other') add({entityType:'subtype',entityId:group.id,code:'missing-category',title,message:'Sub-type has no sorted category.',fixButtonHtml:fix,source:group.cat});
    });
    return issues;
}

function dataQualityAdvisoryFromLegacy(warning){
    let entityType = 'advisory';
    let entityId = warning.key;
    const product = (state.ingredients || []).find(item => warning.key.startsWith(`product-${item.id}-`));
    const recipe = (state.recipes || []).find(item => warning.key.startsWith(`recipe-${item.id}-`));
    if(product){ entityType = 'product'; entityId = product.id; }
    if(recipe){ entityType = 'recipe'; entityId = recipe.id; }
    const code = warning.key.replace(entityType === 'product' ? `product-${entityId}-` : entityType === 'recipe' ? `recipe-${entityId}-` : '', '').replace(/-[-\d.]+$/, '') || 'advisory';
    return createDataQualityIssue({entityType,entityId,code:`advisory-${code}`,severity:'advisory',title:warning.title,message:warning.message,fixButtonHtml:warning.fixButtonHtml,source:warning.message,legacyKey:warning.key});
}

function collectDuplicateDataQualityAdvisories(){
    const groups = {};
    (state.ingredients || []).forEach(product => {
        const norm = String(product.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if(!norm) return;
        (groups[norm] ||= []).push(product);
    });
    const ignoredLegacy = new Set(state.ignoredGroupMergeSuggestions || []);
    return Object.entries(groups).filter(([,products]) => products.length > 1).map(([norm,products]) => {
        const legacyKey = `product-dupe-${norm}`;
        if(ignoredLegacy.has(legacyKey)) return null;
        const actions = products.map(product => `<div class="row-between" style="gap:8px;margin-top:5px"><span style="font-size:12px">${ppEscapeHtml(product.name)} <span style="color:var(--text3)">(${ppEscapeHtml(product.brand || 'No brand')})</span></span><button class="btn sm" onclick="openMergeModal('${ppEscapeAttr(product.id)}','${ppEscapeAttr(norm)}')">Keep & merge others</button></div>`).join('');
        return createDataQualityIssue({entityType:'product-set',entityId:norm,code:'possible-duplicate',severity:'advisory',title:'Possible duplicate products',message:products.map(p => p.name).join(', '),fixButtonHtml:`<details style="min-width:190px"><summary class="btn sm ghost">Review</summary>${actions}</details>`,source:products.map(p => [p.id,p.name,p.brand]).sort(),legacyKey});
    }).filter(Boolean);
}

let isAuditing = false;
function renderDataQuality() {
    const missingTarget = document.getElementById('dq-missing-list');
    const advisoryTarget = document.getElementById('dq-duplicate-list');
    if (!state?.isCloudHydrated) {
        const skeletonHtml = `<div class="ios-activity-skeleton">
          <div class="spinner"></div>
          <span class="ios-activity-skeleton-text">Syncing live cloud data before audit...</span>
        </div>`;
        if (missingTarget) missingTarget.innerHTML = skeletonHtml;
        if (advisoryTarget) advisoryTarget.innerHTML = '';
        return;
    }
    if (isAuditing) return;
    isAuditing = true;
    const spinnerHtml = `<div class="dq-audit-loading" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 16px;gap:12px;color:var(--text2)">
      <div style="width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--action-fill,#0969da);border-radius:50%;animation:spin 0.8s linear infinite"></div>
      <span style="font-size:13px;font-weight:600">Running data audit...</span>
    </div>`;
    if (missingTarget) missingTarget.innerHTML = spinnerHtml;
    if (advisoryTarget) advisoryTarget.innerHTML = '';

    requestAnimationFrame(() => {
        setTimeout(() => {
            try {
                const issues = collectDeterministicDataQualityIssues();
                const blockers = issues.filter(issue => issue.severity === 'blocker');
                const gaps = issues.filter(issue => issue.severity === 'gap');
                const section = (title, rows, emptyText, open = true) => `<details ${open ? 'open' : ''} style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700;font-size:13px;margin-bottom:4px">${ppEscapeHtml(title)} (${rows.length})</summary>${rows.length ? rows.map(issue => renderDataQualityIssue(issue)).join('') : `<div class="msg success" style="margin:6px 0 0">${ppEscapeHtml(emptyText)}</div>`}</details>`;
                if(missingTarget) missingTarget.innerHTML = section('Calculation blockers', blockers, 'No calculation blockers detected.') + section('Other data gaps', gaps, 'No other data gaps detected.', false);

                const advisories = [...collectUnusualNumberWarnings(), ...collectMissingOilWarnings()].map(dataQualityAdvisoryFromLegacy).concat(collectDuplicateDataQualityAdvisories()).filter(issue => !isDataQualityWarningIgnored(issue.key, issue.fingerprint) && !(issue.legacyKey && isDataQualityWarningIgnored(issue.legacyKey)));
                if(advisoryTarget) advisoryTarget.innerHTML = `<details><summary style="cursor:pointer;font-weight:700;font-size:13px">Heuristic advisories (${advisories.length})</summary><div style="margin-top:6px">${advisories.length ? advisories.map(issue => renderDataQualityIssue(issue, true)).join('') : '<div class="msg success" style="margin:0">No active advisories.</div>'}</div></details>`;

                updateDataQualityBadge(blockers.length + gaps.length + advisories.length, blockers.length, gaps.length);

                const catBox = document.getElementById('dq-cat-list')?.closest('.card');
                if(catBox) catBox.style.display = 'none';
            } finally {
                isAuditing = false;
            }
        }, 40);
    });
}

function updateDataQualityBadge(count = 0, blockers = 0, gaps = 0){
  document.querySelectorAll('[data-view="data"]').forEach(el => {
    let badge = el.querySelector('.dq-nav-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'dq-nav-badge';
        badge.style.cssText = 'margin-left:6px;font-size:11px;font-weight:700;padding:2px 6px;border-radius:10px;line-height:1;display:inline-block;';
        el.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : count;
      badge.title = `${blockers} blockers, ${gaps} gaps, ${count} total issues`;
      if (blockers > 0) {
        badge.style.background = 'var(--red-bg, rgba(239,68,68,0.15))';
        badge.style.color = 'var(--red, #dc2626)';
      } else {
        badge.style.background = 'var(--amber-bg, rgba(245,158,11,0.15))';
        badge.style.color = 'var(--amber, #d97706)';
      }
    } else if (badge) {
      badge.remove();
    }
  });

  document.querySelectorAll('[data-pp-click*="mobileMoreView(\'data\')"], [onclick*="mobileMoreView(\'data\')"]').forEach(el => {
    let badge = el.querySelector('.dq-nav-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'dq-nav-badge';
        badge.style.cssText = 'margin-left:auto;margin-right:6px;background:var(--amber-bg, rgba(245,158,11,0.15));color:var(--amber,#d97706);font-size:11px;font-weight:700;padding:2px 6px;border-radius:10px;line-height:1;display:inline-block;';
        const arrow = el.querySelector('[aria-hidden="true"]');
        if (arrow) el.insertBefore(badge, arrow);
        else el.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : count;
      if (blockers > 0) {
        badge.style.background = 'var(--red-bg, rgba(239,68,68,0.15))';
        badge.style.color = 'var(--red, #dc2626)';
      } else {
        badge.style.background = 'var(--amber-bg, rgba(245,158,11,0.15))';
        badge.style.color = 'var(--amber, #d97706)';
      }
    } else if (badge) {
      badge.remove();
    }
  });
}
window.updateDataQualityBadge = updateDataQualityBadge;

function runDataQualityAudits(shouldRender = false){
  try {
    const issues = collectDeterministicDataQualityIssues();
    const advisories = [...collectUnusualNumberWarnings(), ...collectMissingOilWarnings()]
      .map(dataQualityAdvisoryFromLegacy)
      .concat(collectDuplicateDataQualityAdvisories())
      .filter(issue => !isDataQualityWarningIgnored(issue.key, issue.fingerprint) && !(issue.legacyKey && isDataQualityWarningIgnored(issue.legacyKey)));

    const blockers = issues.filter(issue => issue.severity === 'blocker');
    const gaps = issues.filter(issue => issue.severity === 'gap');
    const totalCount = issues.length + advisories.length;

    updateDataQualityBadge(totalCount, blockers.length, gaps.length);

    if (shouldRender || document.getElementById('view-data')?.classList.contains('active')) {
      renderDataQuality();
    }

    window.dispatchEvent(new CustomEvent('plateplan:data-quality-updated', {
      detail: { count: totalCount, blockers: blockers.length, gaps: gaps.length, issues, advisories }
    }));

    return { issues, advisories, totalCount, blockerCount: blockers.length, gapCount: gaps.length };
  } catch(e) {
    console.warn('runDataQualityAudits error:', e);
    return null;
  }
}
window.runDataQualityAudits = runDataQualityAudits;

function deleteCategory(slug) {
    const affected = state.ingredients.filter(i => i.cat === slug);
    if (affected.length === 0) {
        openAppConfirmModal('Delete category?',`Delete <strong>${ppEscapeHtml(CAT[slug]||slug)}</strong>?`,'Delete category', async ()=>{
          try {
            await executeDataQualityTransaction('DELETE_CATEGORY', { slug });
            ['mi-cat', 'pp-cat', 'tp-cat', 'mini-cat'].forEach(id => renderCatOptions(id, 'other'));
            renderDataQuality();
            renderBank();
          } catch(e) {
            console.error('Delete category failed:', e);
          }
        });
        return;
    }

    // Build reassignment modal
    const otherCats = Object.entries(CAT).filter(([k]) => k !== slug);
    const catOptions = otherCats.map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

    const ingList = affected.map(i => `<li style="font-size:13px;margin:2px 0">${i.name}</li>`).join('');

    const modal = document.createElement('div');
    modal.id = 'cat-reassign-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:300';
    modal.innerHTML = `
      <div style="background:var(--surface);border-radius:14px;padding:24px;max-width:420px;width:90%;max-height:80vh;overflow-y:auto">
        <h3 style="margin-bottom:10px">Reassign Ingredients Before Deleting</h3>
        <p style="font-size:13px;color:var(--text2);margin-bottom:10px">The following ${affected.length} ingredient(s) must be reassigned:</p>
        <ul style="margin:0 0 14px 16px;padding:0">${ingList}</ul>
        <div style="margin-bottom:12px">
          <label style="font-size:12px;color:var(--text2);margin-bottom:4px;display:block">Move all to existing category</label>
          <select id="cat-reassign-existing" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px">
            <option value="">— choose —</option>
            ${catOptions}
          </select>
        </div>
        <div style="margin-bottom:16px;border-top:1px solid var(--border);padding-top:12px">
          <label style="font-size:12px;color:var(--text2);margin-bottom:4px;display:block">Or create a new category</label>
          <input id="cat-reassign-new" type="text" placeholder="New category name" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;background:var(--surface);color:var(--text)">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn" onclick="document.getElementById('cat-reassign-modal').remove()">Cancel</button>
          <button class="btn primary" onclick="confirmCategoryReassign('${slug}')">Reassign &amp; Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
}

function confirmCategoryReassign(oldSlug) {
    const existingVal = document.getElementById('cat-reassign-existing').value;
    const newName = document.getElementById('cat-reassign-new').value.trim();
    if (!existingVal && !newName) {
        openAppInfoModal('Choose a category','Choose an existing category or enter a new category name before continuing.');
        return;
    }
    applyCategoryReassign(oldSlug, existingVal, newName);
}

async function applyCategoryReassign(oldSlug, existingVal, newName) {
    let targetSlug = existingVal;
    if (!targetSlug && newName) {
        targetSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        state.customCats[targetSlug] = newName;
        CAT[targetSlug] = newName;
    }

    try {
      await executeDataQualityTransaction('REASSIGN_CATEGORY', { oldSlug, targetSlug });
      document.getElementById('cat-reassign-modal')?.remove();
      ['mi-cat', 'pp-cat', 'tp-cat', 'mini-cat'].forEach(id => renderCatOptions(id, 'other'));
      refreshHierarchyViews();
      renderDataQuality();
      renderBank();
    } catch(e) {
      console.error('applyCategoryReassign failed:', e);
    }
}

function editCategory(slug) {
    let currentName = CAT[slug];
    openAppPromptModal('Edit category','Category name',currentName,'Save', async newName=>{
      if(newName.trim() !== currentName) {
        try {
          await executeDataQualityTransaction('RENAME_CATEGORY', { slug, newName });
          ['mi-cat', 'pp-cat', 'tp-cat', 'mini-cat'].forEach(id => {
              let el = document.getElementById(id);
              if(el) renderCatOptions(id, el.value);
          });
          renderDataQuality();
          renderBank();
        } catch(e) {
          console.error('editCategory failed:', e);
        }
      }
    });
}

let mergeContext = null;
function openMergeModal(primaryId, groupKey) {
    let group = state.ingredients.filter(i => i.name.toLowerCase().replace(/[^a-z0-9]/g, '') === groupKey);
    let primary = group.find(i => i.id === primaryId);
    let others = group.filter(i => i.id !== primaryId);
    
    mergeContext = { primary, others };
    
    let html = `
        <div style="background:var(--green-bg); border:1px solid var(--green); border-radius:8px; padding:10px; margin-bottom:10px;">
            <div style="font-weight:600; color:var(--green); margin-bottom:4px;">PRIMARY (Keeping):</div>
            <div style="font-size:13px;">${primary.name} <span style="color:var(--text2)">(${primary.brand||'No brand'})</span></div>
        </div>
        <div style="font-weight:600; font-size:12px; margin-bottom:6px;">WILL BE DELETED & REPLACED BY PRIMARY:</div>
        ${others.map(o => `
            <div style="background:var(--red-bg); border:1px solid var(--red); border-radius:8px; padding:10px; margin-bottom:6px;">
                <div style="font-size:13px;">${o.name} <span style="color:var(--text2)">(${o.brand||'No brand'})</span></div>
            </div>
        `).join('')}
    `;
    
    document.getElementById('merge-options-container').innerHTML = html;
    document.getElementById('merge-modal-wrap').classList.add('open');
}

function closeMergeModal() {
    document.getElementById('merge-modal-wrap').classList.remove('open');
    mergeContext = null;
}

async function executeMerge() {
    if(!mergeContext) return;
    await applyProductMerge();
}

async function applyProductMerge() {
    if(!mergeContext) return;
    const { primary, others } = mergeContext;
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
    } catch(err) {
      console.error('applyProductMerge transaction failed:', err);
    }
}


// == VAULT ==
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
function toggleVaultFavouritesFilter(){
  vaultFilterFavouritesOnly = !vaultFilterFavouritesOnly;
  vaultFilterFavoritesOnly = vaultFilterFavouritesOnly;
  const btn = document.getElementById('vault-filter-fav');
  if(btn){
    btn.classList.toggle('active', vaultFilterFavouritesOnly);
    btn.setAttribute('aria-pressed', vaultFilterFavouritesOnly ? 'true' : 'false');
  }
  renderVault();
}
function toggleVaultFavoritesFilter(){
  toggleVaultFavouritesFilter();
}
window.toggleVaultFavouritesFilter = toggleVaultFavouritesFilter;
window.toggleVaultFavoritesFilter = toggleVaultFavoritesFilter;

function hasVariantFavoritingInitialized(){
  const list = state?.userPrefs?.favouriteVariantIds || state?.prefs?.favouriteVariantIds || state?.userPrefs?.favoriteVariantIds || state?.prefs?.favoriteVariantIds;
  return Array.isArray(list);
}

function ensureVariantFavoritingPrefs(){
  if(!state) state = {};
  if(!state.prefs) state.prefs = {};
  if(!state.userPrefs) state.userPrefs = state.prefs;
  const existing = state.userPrefs.favouriteVariantIds || state.prefs.favouriteVariantIds || state.userPrefs.favoriteVariantIds || state.prefs.favoriteVariantIds;
  if(!Array.isArray(existing)){
    state.userPrefs.favouriteVariantIds = [];
    (state.recipes || []).forEach(r => {
      if(r && r.id && (r.isFavourite || r.isFavorite)){
        const key = `${r.id}_original`;
        if(!state.userPrefs.favouriteVariantIds.includes(key)){
          state.userPrefs.favouriteVariantIds.push(key);
        }
      }
    });
  } else {
    state.userPrefs.favouriteVariantIds = existing;
  }
  state.prefs.favouriteVariantIds = state.userPrefs.favouriteVariantIds;
  state.userPrefs.favoriteVariantIds = state.userPrefs.favouriteVariantIds;
  state.prefs.favoriteVariantIds = state.userPrefs.favouriteVariantIds;
  return state.userPrefs.favouriteVariantIds;
}

function isRecipeVariantFavourite(recipeId, variantKey = 'original'){
  if(!recipeId) return false;
  const list = typeof ensureVariantFavoritingPrefs === 'function'
    ? ensureVariantFavoritingPrefs()
    : (typeof window !== 'undefined' && typeof window.ensureVariantFavoritingPrefs === 'function'
      ? window.ensureVariantFavoritingPrefs()
      : []);
  const key = `${recipeId}_${variantKey}`;
  if(Array.isArray(list) && list.includes(key)){
    return true;
  }
  const hasInit = typeof hasVariantFavoritingInitialized === 'function'
    ? hasVariantFavoritingInitialized()
    : (typeof window !== 'undefined' && typeof window.hasVariantFavoritingInitialized === 'function'
      ? window.hasVariantFavoritingInitialized()
      : false);
  if(!hasInit && variantKey === 'original'){
    const rec = (state?.recipes || window.state?.recipes || []).find(r => r && r.id === recipeId);
    if(rec && (rec.isFavourite || rec.isFavorite)) return true;
  }
  return false;
}
const isRecipeVariantFavorite = isRecipeVariantFavourite;
window.isRecipeVariantFavourite = isRecipeVariantFavourite;
window.isRecipeVariantFavorite = isRecipeVariantFavourite;

function renderVault(...args) {
  if (typeof window !== 'undefined' && typeof window.renderVault === 'function' && window.renderVault !== renderVault) {
    return window.renderVault(...args);
  }
  const list = document.getElementById('vault-list');
  if (!list) return;

  if (!state?.isCloudHydrated && !window.state?.isCloudHydrated) {
    list.innerHTML = `<div class="ios-activity-skeleton">
      <div class="spinner"></div>
      <span class="ios-activity-skeleton-text">Syncing live recipes from cloud...</span>
    </div>`;
    return;
  }

  const ftEl = document.getElementById('filter-type');
  const fwEl = document.getElementById('filter-who');
  const ft = ftEl?.value || 'all', fw = fwEl?.value || 'all';
  const q = (document.getElementById('vault-search')?.value || '').trim().toLowerCase();
  const sort = (document.getElementById('vault-sort')?.value) || 'name';

  const favFilterBtn = document.getElementById('vault-filter-fav');
  const isFavOnly = !!(favFilterBtn?.classList.contains('active') || window.state?.vaultFavOnly || vaultFilterFavouritesOnly);
  if (favFilterBtn) {
    favFilterBtn.classList.toggle('active', isFavOnly);
    favFilterBtn.setAttribute('aria-pressed', isFavOnly ? 'true' : 'false');
    if (!favFilterBtn.dataset.boundFavFilter) {
      favFilterBtn.dataset.boundFavFilter = 'true';
      favFilterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        favFilterBtn.classList.toggle('active');
        const active = favFilterBtn.classList.contains('active');
        favFilterBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (window.state) window.state.vaultFavOnly = active;
        vaultFilterFavouritesOnly = active;
        window.vaultFilterFavouritesOnly = active;
        renderVault();
      });
    }
  }

  ensureVariantFavoritingPrefs();
  const currentRecipes = (window.state?.recipes || state?.recipes || []);
  const recipes = currentRecipes.filter(r => {
    if (!r) return false;
    if (isFavOnly) {
      const isFav = !!(r.isFavorite || r.isFavourite || isRecipeVariantFavourite(r.id, 'original') || isRecipeVariantFavourite(r.id, 'enhanced'));
      if (!isFav) return false;
    }
    const types = r.types || [r.type];
    const searchable = [
      r.name,
      r.source,
      r.who,
      ...(types || []),
      ...(r.ingredients || []).map(ing => (typeof ingRaw === 'function' ? ingRaw(ing) : (ing?.name || '')))
    ].join(' ').toLowerCase();
    return (ft === 'all' || types.includes(ft)) && (fw === 'all' || r.who === fw) && (!q || searchable.includes(q));
  });

  const selectedMealType = ft !== 'all' ? ft : 'dinner';
  const sortedRecipes = (typeof getSortedRecipes === 'function')
    ? getSortedRecipes(recipes, sort, selectedMealType)
    : recipes;

  if (!sortedRecipes.length) { list.innerHTML = '<div class="empty">No matching recipes found.</div>'; return; }
  const listSignature = [ft, fw, q, sort, isFavOnly ? 'fav' : 'all'].join('|');
  if (typeof resetProgressiveList === 'function') {
    resetProgressiveList('vault', listSignature);
  }
  const totalRecipes = sortedRecipes.length;
  const visibleRecipes = sortedRecipes.slice(0, platePlanListLimits?.vault || 24);
  const cardRenderer = typeof renderRecipeCard === 'function'
    ? renderRecipeCard
    : (typeof window.renderRecipeCard === 'function' ? window.renderRecipeCard : null);
  const progBtn = typeof progressiveListButton === 'function'
    ? progressiveListButton('vault', totalRecipes, visibleRecipes.length)
    : '';

  const prefs = (window.state && window.state.prefs) || state?.prefs || {};
  const ecal = Number(prefs.ecal) || 2400;
  const eprot = Number(prefs.eprot) || 130;
  const ccal = Number(prefs.ccal) || 1700;
  const cprot = Number(prefs.cprot) || 100;

  const eAlloc = prefs.eAlloc || { b: 15, l: 25, d: 45, s: 15 };
  const cAlloc = prefs.cAlloc || { b: 25, l: 30, d: 35, s: 10 };
  const eProtAlloc = prefs.eProtAlloc || eAlloc;
  const cProtAlloc = prefs.cProtAlloc || cAlloc;

  let mKey = 'd';
  if (selectedMealType.includes('breakfast')) mKey = 'b';
  else if (selectedMealType.includes('lunch')) mKey = 'l';
  else if (selectedMealType.includes('snack')) mKey = 's';
  else if (selectedMealType.includes('dinner')) mKey = 'd';

  const eTgt = {
    cal: ecal * ((eAlloc[mKey] ?? 45) / 100),
    prot: eprot * ((eProtAlloc[mKey] ?? eAlloc[mKey] ?? 45) / 100)
  };
  const cTgt = {
    cal: ccal * ((cAlloc[mKey] ?? 35) / 100),
    prot: cprot * ((cProtAlloc[mKey] ?? cAlloc[mKey] ?? 35) / 100)
  };
  const targetMacros = {
    mealType: selectedMealType,
    targetCal_E: eTgt.cal,
    targetProt_E: eTgt.prot,
    targetCal_C: cTgt.cal,
    targetProt_C: cTgt.prot,
    e: eTgt,
    c: cTgt,
    prefs: { ecal, eprot, ccal, cprot }
  };

  if (cardRenderer) {
    list.innerHTML = visibleRecipes.map(r => cardRenderer(r, { mealType: selectedMealType, eTgt, cTgt, targetMacros })).join('') + progBtn;
  }
}
window.renderVault = renderVault;


let platePlanUseUpFinder={meal:'dinner',who:'both',productIds:[],assign:null};
function ensureUseUpRecipeFinder(){
  let wrap=document.getElementById('use-up-finder-wrap');
  if(wrap)return wrap;
  wrap=document.createElement('div');wrap.id='use-up-finder-wrap';wrap.className='modal-wrap long-workspace use-up-finder-wrap';
  wrap.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="use-up-finder-title"><div class="workspace-appbar"><div><h2 id="use-up-finder-title">Use up ingredients</h2><p>Find eligible recipes that make the best use of your shared list.</p></div><button class="btn ghost" type="button" onclick="closeUseUpRecipeFinder()">Close</button></div><div class="workspace-scroll"><div id="use-up-finder-controls"></div><div id="use-up-finder-results"></div></div></div>`;
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
function toggleUseUpFinderProduct(productId,checked){
  const set=new Set(platePlanUseUpFinder.productIds||[]);if(checked)set.add(productId);else set.delete(productId);platePlanUseUpFinder.productIds=[...set];renderUseUpRecipeFinder();
}
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
  controls.innerHTML=`<div class="use-up-finder-filters"><label>Meal<select onchange="setUseUpFinderFilter('meal',this.value)">${['breakfast','lunch','dinner'].map(value=>`<option value="${value}"${platePlanUseUpFinder.meal===value?' selected':''}>${toTitleCase(value)}</option>`).join('')}</select></label><label>For<select onchange="setUseUpFinderFilter('who',this.value)">${[['both','Both'],['Elliott','Elliott'],['Chloe','Chloe']].map(([value,label])=>`<option value="${value}"${platePlanUseUpFinder.who===value?' selected':''}>${label}</option>`).join('')}</select></label></div><fieldset class="use-up-product-filter"><legend>Products to match</legend>${entries.map(entry=>`<label><input type="checkbox" ${platePlanUseUpFinder.productIds.includes(entry.productId)?'checked':''} onchange="toggleUseUpFinderProduct('${ppEscapeAttr(entry.productId)}',this.checked)"> ${ppEscapeHtml(entry.product.name)} <small>${ppEscapeHtml(useUpQuantityLabel(entry))}</small></label>`).join('')}</fieldset>`;
  const rows=getUseUpFinderResults();
  results.innerHTML=rows.length?`<div class="use-up-result-list">${rows.slice(0,48).map(row=>{
    const coverage=row.useUpCoverage;
    const bundle=calculateRecipeDisplayNutrition({recipe:row.recipe,variant:row.variant,mealType:platePlanUseUpFinder.meal});
    const portions=bundle?.portions||{};
    const people=platePlanUseUpFinder.who==='both'?`E ${Math.round(portions.eCal||0)} kcal / P${round1(portions.eProt)}g · C ${Math.round(portions.cCal||0)} kcal / P${round1(portions.cProt)}g`:platePlanUseUpFinder.who==='Chloe'?`${Math.round(portions.cCal||0)} kcal / P${round1(portions.cProt)}g`:`${Math.round(portions.eCal||0)} kcal / P${round1(portions.eProt)}g`;
    const matchText=coverage.matches.map(match=>`${match.product.name}: use about ${formatShoppingBatchAmount(match.used)}${match.remainder==null?'':`, ${formatShoppingBatchAmount(match.remainder)} left`}`).join(' · ');
    const matchedIds=new Set(coverage.matches.map(match=>match.productId)),unmatched=getUseUpEntries().filter(entry=>platePlanUseUpFinder.productIds.includes(entry.productId)&&!matchedIds.has(entry.productId)).map(entry=>entry.product.name);
    const trafficPeople=platePlanUseUpFinder.who==='both'?['Elliott','Chloe']:[platePlanUseUpFinder.who];
    const traffic=trafficPeople.map(person=>`${person} ${toTitleCase(getRecipeVariantTrafficStatus(row,person,platePlanUseUpFinder.meal))}`).join(' · ');
    return `<article class="use-up-result"><div><h3>${ppEscapeHtml(row.label)}</h3><p><strong>Uses:</strong> ${ppEscapeHtml(matchText)}</p>${unmatched.length?`<p><strong>Not used:</strong> ${ppEscapeHtml(unmatched.join(', '))}</p>`:''}<p>${coverage.otherIngredients} other ingredient${coverage.otherIngredients===1?'':'s'} · ${ppEscapeHtml(people)} · ${ppEscapeHtml(traffic)}</p></div><div class="btn-row"><button class="btn primary" onclick="viewRecipe('${ppEscapeAttr(row.id)}',null,'${row.variant}')">View recipe</button><button class="btn ghost" onclick="openUseUpAssign('${ppEscapeAttr(row.id)}','${row.variant}')">Assign to plan</button></div></article>`;
  }).join('')}</div>`:'<div class="empty">No eligible recipe uses the selected products with these meal, exclusion and traffic-light settings.</div>';
}
function openUseUpAssign(recipeId,variant){
  if(!state.plan?.slots)return openAppConfirmModal('No active plan','Open Meal Planner to generate or set up an active plan first.','Open Meal Planner',()=>{closeUseUpRecipeFinder();showView('planner');});
  const recipe=state.recipes.find(item=>item.id===recipeId);if(!recipe)return;
  platePlanUseUpFinder.assign={recipeId,variant};
  let wrap=document.getElementById('use-up-assign-wrap');if(!wrap){wrap=document.createElement('div');wrap.id='use-up-assign-wrap';wrap.className='modal-wrap sheet-mobile';document.body.appendChild(wrap);}
  const days=Array.from({length:+state.plan.days||0},(_,i)=>i+1);
  const whoVal = platePlanUseUpFinder.who || 'both';
  wrap.innerHTML=`<div class="modal"><div class="row-between"><h3 style="margin:0">Assign ${ppEscapeHtml(recipe.name)}</h3><button class="btn ghost" onclick="closeUseUpAssign()">Close</button></div><div class="grid2" style="margin-top:14px"><label>Day<select id="use-up-assign-day">${days.map(day=>`<option value="${day}">${ppEscapeHtml(formatPlanDayLabel(state.plan,day,{short:true}))}</option>`).join('')}</select></label><label>For<select id="use-up-assign-person"><option value="both"${whoVal==='both'?' selected':''}>Both (Shared)</option><option value="E"${whoVal==='Elliott'?' selected':''}>Elliott</option><option value="C"${whoVal==='Chloe'?' selected':''}>Chloe</option></select></label><label>Meal<select id="use-up-assign-meal"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner"${platePlanUseUpFinder.meal==='dinner'?' selected':''}>Dinner</option></select></label></div><div class="btn-row" style="margin-top:14px"><button class="btn primary" onclick="confirmUseUpAssign()">Continue</button></div></div>`;
  wrap.classList.add('open');
}
function closeUseUpAssign(){document.getElementById('use-up-assign-wrap')?.classList.remove('open');}
let platePlanChoiceAction=null;
function openAppChoiceModal(title,copy,choices,onChoose){
  let wrap=document.getElementById('app-choice-wrap');if(!wrap){wrap=document.createElement('div');wrap.id='app-choice-wrap';wrap.className='modal-wrap sheet-mobile';document.body.appendChild(wrap);}
  platePlanChoiceAction=onChoose;
  wrap.innerHTML=`<div class="modal"><h3>${ppEscapeHtml(title)}</h3><p>${ppEscapeHtml(copy)}</p><div class="btn-row">${(choices||[]).map((choice,index)=>`<button class="btn ${index===choices.length-1?'danger':'primary'}" onclick="chooseAppChoice('${ppEscapeAttr(choice.value)}')">${ppEscapeHtml(choice.label)}</button>`).join('')}<button class="btn ghost" onclick="closeAppChoiceModal()">Cancel</button></div></div>`;
  wrap.classList.add('open');
}
function chooseAppChoice(value){const action=platePlanChoiceAction;closeAppChoiceModal();if(typeof action==='function')action(value);}
function closeAppChoiceModal(){document.getElementById('app-choice-wrap')?.classList.remove('open');platePlanChoiceAction=null;}
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

// == PREFS ==
function ensureExclusionPrefsUI(){
  const legacy = document.getElementById('pref-exclude');
  if(!legacy || document.getElementById('pref-exclude-ui')) return;
  const field = legacy.closest('.field') || legacy.parentElement;
  if(!field) return;
  if(field) field.style.display = 'none';
  field.insertAdjacentHTML('afterend', `<div class="field" id="pref-exclude-ui">
    <label>Foods to always exclude</label>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <select id="pref-exclude-scope" style="width:auto;font-size:12px">
        <option value="shared">Both</option>
        <option value="elliott">Elliott only</option>
        <option value="chloe">Chloe only</option>
      </select>
      <div class="mapping-search-container" style="position:relative;flex:1;min-width:220px">
        <input type="text" class="map-search-input" id="pref-exclude-search" autocomplete="off" placeholder="Search ingredients or products..." oninput="handleExcludeSearch()" onfocus="handleExcludeSearch()">
        <div class="map-dropdown" id="pref-exclude-dropdown" style="display:none"></div>
      </div>
      <button class="btn sm ghost" onclick="viewExclusions()">View list</button>
    </div>
    <div id="pref-exclude-preview" style="font-size:12px;color:var(--text2);margin-top:6px"></div>
  </div>`);
}

function handleExcludeSearch(){
  const q=(document.getElementById('pref-exclude-search')?.value||'').toLowerCase().trim();
  const drop=document.getElementById('pref-exclude-dropdown');
  if(!drop) return;
  const rows=[];
  (state.ingredientGroups||[]).forEach(g => rows.push({ type:'group', id:g.id, name:g.name, sub:'Ingredient', search:[g.name,...(g.aliases||[]),g.family||''].join(' ').toLowerCase() }));
  (state.ingredients||[]).forEach(p => rows.push({ type:'product', id:p.id, groupId:p.groupId, name:p.name, sub:p.brand||'Product', search:[p.name,p.brand||'',getIngredientGroup(p.groupId)?.name||''].join(' ').toLowerCase() }));
  const terms=q.split(/\s+/).filter(Boolean);
  const filtered=rows.filter(r=>!terms.length||terms.every(t=>r.search.includes(t))).slice(0,20);
  drop.innerHTML=filtered.length ? filtered.map(r=>`<div class="map-drop-item" onclick="addExclusion('${r.type}','${r.id}',decodeURIComponent('${encodeURIComponent(r.name)}'),'${r.groupId||''}')"><div style="font-weight:600;font-size:13px">${ppEscapeHtml(r.name)}</div><div style="font-size:11px;color:var(--text2)">${ppEscapeHtml(r.sub)}</div></div>`).join('') : '<div style="padding:8px 12px;font-size:12px;color:var(--text3)">No matches found.</div>';
  drop.style.display='block';
}

function addExclusion(type, id, name, groupId=''){
  const scope=document.getElementById('pref-exclude-scope')?.value || 'shared';
  if(!state.prefs.exclusions) state.prefs.exclusions={shared:[],elliott:[],chloe:[]};
  const row={ type, id, name, ...(groupId?{groupId}:{}) };
  if(!state.prefs.exclusions[scope].some(x => x.id===id || normaliseAliasText(x.name)===normaliseAliasText(name))) state.prefs.exclusions[scope].push(row);
  const pSearch = document.getElementById('pref-exclude-search');
  if(pSearch) pSearch.value='';
  const pDrop = document.getElementById('pref-exclude-dropdown');
  if(pDrop) pDrop.style.display='none';
  saveState();
  renderExclusionPreview();
}

function removeExclusion(scope, index){
  if(state.prefs.exclusions?.[scope]) state.prefs.exclusions[scope].splice(index,1);
  saveState();
  renderExclusionPreview();
  viewExclusions();
}

function renderExclusionPreview(){
  const el=document.getElementById('pref-exclude-preview');
  if(!el) return;
  const ex=state.prefs.exclusions || {shared:[],elliott:[],chloe:[]};
  el.textContent=`Both: ${(ex.shared||[]).length} · Elliott: ${(ex.elliott||[]).length} · Chloe: ${(ex.chloe||[]).length}`;
}

function viewExclusions(){
  const ex=state.prefs.exclusions || {shared:[],elliott:[],chloe:[]};
  const label={shared:'Both',elliott:'Elliott only',chloe:'Chloe only'};
  const html=['shared','elliott','chloe'].map(scope=>`<div class="summary-box"><strong>${label[scope]}</strong>${(ex[scope]||[]).length ? (ex[scope]||[]).map((x,i)=>`<div class="row-between" style="gap:8px;border-top:1px solid var(--border);padding:6px 0"><span>${ppEscapeHtml(x.name||'Unnamed')}</span><button class="btn sm ghost" onclick="removeExclusion('${scope}',${i})">Remove</button></div>`).join('') : '<div style="color:var(--text3)">None</div>'}</div>`).join('');
  openAppInfoModal('Excluded foods', html);
}

function toggleSeparateProteinAllocUI() {
  // Retained for compatibility
}

function loadPrefs(){
  const p=state.prefs||{};
  ensureExclusionPrefsUI();
  if(document.getElementById('pref-exclude')) document.getElementById('pref-exclude').value=p.exclude||'';
  if(document.getElementById('pref-diet')) document.getElementById('pref-diet').value=p.diet||'vegetarian';
  if(document.getElementById('pref-auto-mapping-strategy')) document.getElementById('pref-auto-mapping-strategy').value=p.autoMappingStrategy||'protein_per_kcal';
  if(document.getElementById('pref-ecal')) document.getElementById('pref-ecal').value=p.ecal||2400;
  if(document.getElementById('pref-eprot')) document.getElementById('pref-eprot').value=p.eprot||130;
  if(document.getElementById('pref-ccal')) document.getElementById('pref-ccal').value=p.ccal||1700;
  if(document.getElementById('pref-cprot')) document.getElementById('pref-cprot').value=p.cprot||100;
  const ea = p.eAlloc || {b:15, l:25, d:45, s:15};
  if(document.getElementById('pref-eb')) document.getElementById('pref-eb').value = ea.b;
  if(document.getElementById('pref-el')) document.getElementById('pref-el').value = ea.l;
  if(document.getElementById('pref-ed')) document.getElementById('pref-ed').value = ea.d;
  if(document.getElementById('pref-es')) document.getElementById('pref-es').value = ea.s;

  const ca = p.cAlloc || {b:25, l:30, d:35, s:10};
  if(document.getElementById('pref-cb')) document.getElementById('pref-cb').value = ca.b;
  if(document.getElementById('pref-cl')) document.getElementById('pref-cl').value = ca.l;
  if(document.getElementById('pref-cd')) document.getElementById('pref-cd').value = ca.d;
  if(document.getElementById('pref-cs')) document.getElementById('pref-cs').value = ca.s;

  const epa = p.eProtAlloc || ea;
  if(document.getElementById('pref-epb')) document.getElementById('pref-epb').value = epa.b;
  if(document.getElementById('pref-epl')) document.getElementById('pref-epl').value = epa.l;
  if(document.getElementById('pref-epd')) document.getElementById('pref-epd').value = epa.d;
  if(document.getElementById('pref-eps')) document.getElementById('pref-eps').value = epa.s;

  const cpa = p.cProtAlloc || ca;
  if(document.getElementById('pref-cpb')) document.getElementById('pref-cpb').value = cpa.b;
  if(document.getElementById('pref-cpl')) document.getElementById('pref-cpl').value = cpa.l;
  if(document.getElementById('pref-cpd')) document.getElementById('pref-cpd').value = cpa.d;
  if(document.getElementById('pref-cps')) document.getElementById('pref-cps').value = cpa.s;

  ['pref-ecal','pref-eprot','pref-eb','pref-el','pref-ed','pref-es','pref-epb','pref-epl','pref-epd','pref-eps',
   'pref-ccal','pref-cprot','pref-cb','pref-cl','pref-cd','pref-cs','pref-cpb','pref-cpl','pref-cpd','pref-cps'].forEach(id => {
    const el = document.getElementById(id);
    if(el && !el.dataset.budgetBound) {
      el.dataset.budgetBound = '1';
      el.addEventListener('input', calcBudgets);
      el.addEventListener('change', calcBudgets);
    }
  });

  calcBudgets();
  renderExclusionPreview();
  renderRecoveryPanel();
  syncPlatePlanVersionDisplay();
}

function calcBudgets() {
  const ecal = +document.getElementById('pref-ecal')?.value||2400;
  const eprot = +document.getElementById('pref-eprot')?.value||130;
  const eb = +document.getElementById('pref-eb')?.value||0;
  const el = +document.getElementById('pref-el')?.value||0;
  const ed = +document.getElementById('pref-ed')?.value||0;
  const es = +document.getElementById('pref-es')?.value||0;

  const ccal = +document.getElementById('pref-ccal')?.value||1700;
  const cprot = +document.getElementById('pref-cprot')?.value||100;
  const cb = +document.getElementById('pref-cb')?.value||0;
  const cl = +document.getElementById('pref-cl')?.value||0;
  const cd = +document.getElementById('pref-cd')?.value||0;
  const cs = +document.getElementById('pref-cs')?.value||0;

  const epb = +document.getElementById('pref-epb')?.value||0;
  const epl = +document.getElementById('pref-epl')?.value||0;
  const epd = +document.getElementById('pref-epd')?.value||0;
  const eps = +document.getElementById('pref-eps')?.value||0;

  const cpb = +document.getElementById('pref-cpb')?.value||0;
  const cpl = +document.getElementById('pref-cpl')?.value||0;
  const cpd = +document.getElementById('pref-cpd')?.value||0;
  const cps = +document.getElementById('pref-cps')?.value||0;

  const eCalValid = (eb+el+ed+es) === 100;
  const cCalValid = (cb+cl+cd+cs) === 100;
  const eProtValid = (epb+epl+epd+eps) === 100;
  const cProtValid = (cpb+cpl+cpd+cps) === 100;

  const errors = [];
  if (!eCalValid) errors.push(`Elliott's calorie percentages total ${eb+el+ed+es}% (must equal 100%).`);
  if (!cCalValid) errors.push(`Chloe's calorie percentages total ${cb+cl+cd+cs}% (must equal 100%).`);
  if (!eProtValid) errors.push(`Elliott's protein percentages total ${epb+epl+epd+eps}% (must equal 100%).`);
  if (!cProtValid) errors.push(`Chloe's protein percentages total ${cpb+cpl+cpd+cps}% (must equal 100%).`);

  const warnEl = document.getElementById('alloc-warn');
  if (warnEl) {
    if (errors.length > 0) {
      warnEl.innerHTML = errors.join('<br>');
      warnEl.style.display = 'block';
    } else {
      warnEl.style.display = 'none';
    }
  }

  const allValid = eCalValid && cCalValid && eProtValid && cProtValid;
  const saveBtn = document.getElementById('btn-save-prefs');
  if (saveBtn) saveBtn.disabled = !allValid;

  const eBudgetEl = document.getElementById('ebudget-text');
  if (eBudgetEl) {
    eBudgetEl.innerHTML = `
        <strong>Breakfast Budget:</strong> ${Math.round(ecal*eb/100)}kcal / ${Math.round(eprot*epb/100)}g P<br>
        <strong>Lunch Budget:</strong> ${Math.round(ecal*el/100)}kcal / ${Math.round(eprot*epl/100)}g P<br>
        <strong>Dinner Budget:</strong> ${Math.round(ecal*ed/100)}kcal / ${Math.round(eprot*epd/100)}g P<br>
        <strong>Snacks Budget:</strong> ${Math.round(ecal*es/100)}kcal / ${Math.round(eprot*eps/100)}g P
    `;
  }

  const cBudgetEl = document.getElementById('cbudget-text');
  if (cBudgetEl) {
    cBudgetEl.innerHTML = `
        <strong>Breakfast Budget:</strong> ${Math.round(ccal*cb/100)}kcal / ${Math.round(cprot*cpb/100)}g P<br>
        <strong>Lunch Budget:</strong> ${Math.round(ccal*cl/100)}kcal / ${Math.round(cprot*cpl/100)}g P<br>
        <strong>Dinner Budget:</strong> ${Math.round(ccal*cd/100)}kcal / ${Math.round(cprot*cpd/100)}g P<br>
        <strong>Snacks Budget:</strong> ${Math.round(ccal*cs/100)}kcal / ${Math.round(cprot*cps/100)}g P
    `;
  }
}
window.calcBudgets = calcBudgets;

function downloadPlatePlanDataBackup(){
  try{
    const stamp = new Date().toISOString().slice(0,10);
    downloadPlatePlanBlob('PlatePlan data backup ' + stamp + '.json', JSON.stringify(getPlatePlanBackupPayload(), null, 2), 'application/json');
    showMsg('prefs-data-msg','PlatePlan data exported.','success');
  }catch(e){
    showMsg('prefs-data-msg','Could not export PlatePlan data.','error');
  }
}

function getPlatePlanStateCounts(candidate){
  return {
    recipes:Array.isArray(candidate?.recipes) ? candidate.recipes.length : 0,
    products:Array.isArray(candidate?.ingredients) ? candidate.ingredients.length : 0,
    ingredients:Array.isArray(candidate?.ingredientFamilies) ? candidate.ingredientFamilies.length : 0,
    subTypes:Array.isArray(candidate?.ingredientGroups) ? candidate.ingredientGroups.length : 0,
    planDays:+candidate?.plan?.days || Object.keys(candidate?.plan?.slots || {}).length,
    planHistory:Array.isArray(candidate?.planHistory) ? candidate.planHistory.length : 0
  };
}

function validatePlatePlanImport(candidate, metadata = {}){
  const errors = [], warnings = [];
  if(!candidate || typeof candidate !== 'object') errors.push('The backup does not contain a PlatePlan state object.');
  if(!Array.isArray(candidate?.recipes)) errors.push('Recipes are missing or invalid.');
  if(!Array.isArray(candidate?.ingredients)) errors.push('Products are missing or invalid.');
  const schemaVersion = +(metadata.schemaVersion || candidate?.meta?.schemaVersion || 1);
  if(schemaVersion > PLATEPLAN_SCHEMA_VERSION) errors.push(`This backup uses newer data schema ${schemaVersion}; this PlatePlan supports schema ${PLATEPLAN_SCHEMA_VERSION}.`);
  const duplicateIds = (items, label) => {
    if(!Array.isArray(items)) return;
    const seen = new Set(), duplicates = new Set();
    items.forEach(item => { if(!item?.id) return; if(seen.has(item.id)) duplicates.add(item.id); else seen.add(item.id); });
    if(duplicates.size) errors.push(`${label} contain ${duplicates.size} duplicate ID${duplicates.size===1?'':'s'}.`);
  };
  duplicateIds(candidate?.recipes, 'Recipes');
  duplicateIds(candidate?.ingredients, 'Products');
  duplicateIds(candidate?.ingredientFamilies, 'Ingredients');
  duplicateIds(candidate?.ingredientGroups, 'Sub-types');
  if(candidate?.plan != null && typeof candidate.plan !== 'object') errors.push('The meal plan is invalid.');
  if(!Array.isArray(candidate?.ingredientFamilies)) warnings.push('Ingredient hierarchy will be rebuilt from compatible product data.');
  if(!Array.isArray(candidate?.ingredientGroups)) warnings.push('Sub-types will be rebuilt from compatible product data.');
  if(!candidate?.prefs || typeof candidate.prefs !== 'object') warnings.push('Default preferences will be applied where settings are missing.');
  return { valid:errors.length===0, errors, warnings, schemaVersion, counts:getPlatePlanStateCounts(candidate) };
}

let pendingPlatePlanImport = null;

function ensurePlatePlanImportPreviewModal(){
  let wrap = document.getElementById('plateplan-import-preview-wrap');
  if(wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'plateplan-import-preview-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '470';
  wrap.innerHTML = `<div class="modal" style="max-width:760px">
    <div class="row-between" style="align-items:center;margin-bottom:10px">
      <h3 style="margin:0">Review PlatePlan import</h3>
      <button class="btn sm ghost" onclick="closePlatePlanImportPreview()">Close</button>
    </div>
    <div id="plateplan-import-preview-content"></div>
    <div class="btn-row" style="margin-top:14px;justify-content:flex-end">
      <button class="btn ghost" onclick="closePlatePlanImportPreview()">Cancel</button>
      <button class="btn primary" id="plateplan-import-confirm" onclick="confirmPlatePlanDataImport()">Import data</button>
    </div>
  </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

function openPlatePlanImportPreview(imported, metadata = {}){
  const validation = validatePlatePlanImport(imported, metadata);
  pendingPlatePlanImport = { imported, metadata, validation };
  const wrap = ensurePlatePlanImportPreviewModal();
  const c = validation.counts;
  const versionLabel = metadata.version || 'legacy/raw state';
  const differences = validation.valid ? renderBakedStateDifferenceSummary(state || {}, imported) : '';
  document.getElementById('plateplan-import-preview-content').innerHTML = `
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Backup version: <strong>${ppEscapeHtml(versionLabel)}</strong> · Schema ${validation.schemaVersion}</div>
    <div class="plan-summary" style="margin-bottom:10px">
      <div class="summary-box"><strong>Recipes</strong><div>${c.recipes}</div></div>
      <div class="summary-box"><strong>Products</strong><div>${c.products}</div></div>
      <div class="summary-box"><strong>Ingredients</strong><div>${c.ingredients}</div></div>
      <div class="summary-box"><strong>Sub-types</strong><div>${c.subTypes}</div></div>
      <div class="summary-box"><strong>Plan</strong><div>${c.planDays} days</div></div>
      <div class="summary-box"><strong>History</strong><div>${c.planHistory}</div></div>
    </div>
    ${validation.errors.length ? `<div class="msg error"><strong>Import blocked</strong><br>${validation.errors.map(ppEscapeHtml).join('<br>')}</div>` : ''}
    ${validation.warnings.length ? `<div class="msg info">${validation.warnings.map(ppEscapeHtml).join('<br>')}</div>` : ''}
    ${validation.valid ? `<div style="font-size:12px;font-weight:700;margin:10px 0 5px">Differences from browser data</div><div style="display:grid;gap:5px;max-height:220px;overflow:auto;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px">${differences}</div>` : ''}`;
  document.getElementById('plateplan-import-confirm').disabled = !validation.valid;
  wrap.classList.add('open');
}

function closePlatePlanImportPreview(){
  document.getElementById('plateplan-import-preview-wrap')?.classList.remove('open');
  pendingPlatePlanImport = null;
}

function confirmPlatePlanDataImport(){
  if(!pendingPlatePlanImport?.validation?.valid) return;
  const imported = pendingPlatePlanImport.imported;
  const schemaVersion = pendingPlatePlanImport.validation.schemaVersion || 1;
  runWithRecoveryPoint('Before importing PlatePlan data', () => {
    state = imported;
    if(!state.meta || typeof state.meta !== 'object') state.meta = {};
    state.meta.schemaVersion = +state.meta.schemaVersion || schemaVersion;
    ensureIngredientGroups(state);
    refreshPlatePlanDerivedState({ persist:true, render:true });
    localStorage.removeItem(BAKED_CANDIDATE_SK);
    closePlatePlanImportPreview();
    loadPrefs();
    showMsg('prefs-data-msg','PlatePlan data imported.','success');
  });
}

function importPlatePlanDataBackup(input){
  const file = input?.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      const imported = parsed.state || parsed;
      openPlatePlanImportPreview(imported, { version:parsed.version || '', schemaVersion:parsed.schemaVersion || imported?.meta?.schemaVersion || 1, exportedAt:parsed.exportedAt || '' });
    }catch(e){
      showMsg('prefs-data-msg','That file does not look like a PlatePlan data backup.','error');
    }finally{
      input.value = '';
    }
  };
  reader.readAsText(file);
}

function savePrefs(){
  const eb = +document.getElementById('pref-eb')?.value||0;
  const el = +document.getElementById('pref-el')?.value||0;
  const ed = +document.getElementById('pref-ed')?.value||0;
  const es = +document.getElementById('pref-es')?.value||0;

  const cb = +document.getElementById('pref-cb')?.value||0;
  const cl = +document.getElementById('pref-cl')?.value||0;
  const cd = +document.getElementById('pref-cd')?.value||0;
  const cs = +document.getElementById('pref-cs')?.value||0;

  const epb = +document.getElementById('pref-epb')?.value||0;
  const epl = +document.getElementById('pref-epl')?.value||0;
  const epd = +document.getElementById('pref-epd')?.value||0;
  const eps = +document.getElementById('pref-eps')?.value||0;

  const cpb = +document.getElementById('pref-cpb')?.value||0;
  const cpl = +document.getElementById('pref-cpl')?.value||0;
  const cpd = +document.getElementById('pref-cpd')?.value||0;
  const cps = +document.getElementById('pref-cps')?.value||0;

  if((eb+el+ed+es) !== 100 || (cb+cl+cd+cs) !== 100 || (epb+epl+epd+eps) !== 100 || (cpb+cpl+cpd+cps) !== 100) {
    showMsg('prefs-msg','Percentages must total 100% for both calories and protein.','error');
    return;
  }

  state.prefs={
    ...state.prefs,
    updatedAt: new Date().toISOString(),
    exclude: document.getElementById('pref-exclude')?.value||'',
    exclusions: state.prefs.exclusions || {shared:[],elliott:[],chloe:[]},
    diet: document.getElementById('pref-diet')?.value||'vegetarian',
    ecal: +document.getElementById('pref-ecal')?.value||2400,
    eprot: +document.getElementById('pref-eprot')?.value||130,
    ccal: +document.getElementById('pref-ccal')?.value||1700,
    cprot: +document.getElementById('pref-cprot')?.value||100,
    eAlloc: {b:eb, l:el, d:ed, s:es},
    cAlloc: {b:cb, l:cl, d:cd, s:cs},
    eProtAlloc: {b:epb, l:epl, d:epd, s:eps},
    cProtAlloc: {b:cpb, l:cpl, d:cpd, s:cps},
    shopGroupBy: state.prefs.shopGroupBy || 'family',
    autoMappingStrategy: document.getElementById('pref-auto-mapping-strategy')?.value || state.prefs.autoMappingStrategy || 'protein_per_kcal',
    productPriority: document.getElementById('plan-product-priority')?.value || state.prefs.productPriority || 'protein'
  };
  refreshAllAutoDefaultProducts();
  if (typeof platePlanNutritionCache !== 'undefined' && platePlanNutritionCache.clear) {
    platePlanNutritionCache.clear();
  }
  recalcAllRecipes();
  saveState(true);
  if (document.getElementById('modal-wrap')?.classList.contains('open')) {
    if (typeof recalcModal === 'function') {
      recalcModal('orig');
      recalcModal('enh');
    }
  }
  showMsg('prefs-msg','Preferences saved.','success');
  renderVault(); // refreshes any views dependent on macros
}

// == UTILS ==

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
    // Sub-type audit card "Fix" action delegation case handler
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
      if (subTypeId) {
        return fixSubtypeDataQuality(subTypeId);
      }
    }

    // Direct viewRecipe dispatch to ensure safe string parameter extraction without evaluation errors
    const viewMatch = typeof code === 'string' && code.trim().match(/^viewRecipe\s*\(\s*(['"][^'"]+['"]|[^\s,]+)(?:\s*,\s*([^)]*))?\)\s*;?$/);
    if (viewMatch) {
      let recId = viewMatch[1];
      if ((recId.startsWith("'") && recId.endsWith("'")) || (recId.startsWith('"') && recId.endsWith('"'))) {
        recId = recId.slice(1, -1);
      }
      let secondArg = null;
      if (viewMatch[2]) {
        const rawSecond = viewMatch[2].trim();
        if (rawSecond === 'null' || rawSecond === 'undefined') {
          secondArg = null;
        } else if ((rawSecond.startsWith("'") && rawSecond.endsWith("'")) || (rawSecond.startsWith('"') && rawSecond.endsWith('"'))) {
          secondArg = rawSecond.slice(1, -1);
        } else {
          secondArg = rawSecond;
        }
      }
      if (typeof window.viewRecipe === 'function') {
        return window.viewRecipe(recId, secondArg);
      } else if (typeof viewRecipe === 'function') {
        return viewRecipe(recId, secondArg);
      }
    }

    // This direct evaluation preserves the exact legacy handler scope while
    // runtime DOM attributes migrate to the delegated module action system.
    return eval(code);
  }).call(element, delegatedEvent);
}

window.ppEscapeAttr = ppEscapeAttr;
window.ppEscapeHtml = ppEscapeHtml;
window.toTitleCase = toTitleCase;
window.getContextMealType = getContextMealType;
window.getBudgets = getBudgets;
window.calculateRecipeDisplayNutrition = calculateRecipeDisplayNutrition;
window.calcPortions = calcPortions;
window.calculateFit = calculateFit;
window.renderExpandableText = renderExpandableText;
window.saveState = saveState;
window.progressiveListButton = progressiveListButton;
window.resetProgressiveList = resetProgressiveList;
window.getProductIndexRecipe = getProductIndexRecipe;
window.openMobileActionSheet = openMobileActionSheet;
window.ingRaw = ingRaw;
window.unwrapAndCleanItem = typeof unwrapAndCleanItem !== 'undefined' ? unwrapAndCleanItem : (window.unwrapAndCleanItem || window.PlatePlanState?.unwrapAndCleanItem);
window.sanitizePayloadForFirestore = typeof sanitizePayloadForFirestore !== 'undefined' ? sanitizePayloadForFirestore : (window.sanitizePayloadForFirestore || window.PlatePlanState?.sanitizePayloadForFirestore);
window.sanitizePlanForFirestore = typeof sanitizePlanForFirestore !== 'undefined' ? sanitizePlanForFirestore : (window.sanitizePlanForFirestore || window.PlatePlanState?.sanitizePlanForFirestore);
window.sanitizeRecipeForFirestore = typeof sanitizeRecipeForFirestore !== 'undefined' ? sanitizeRecipeForFirestore : (window.sanitizeRecipeForFirestore || window.PlatePlanState?.sanitizeRecipeForFirestore);
window.sanitizeIngredientForFirestore = typeof sanitizeIngredientForFirestore !== 'undefined' ? sanitizeIngredientForFirestore : (window.sanitizeIngredientForFirestore || window.PlatePlanState?.sanitizeIngredientForFirestore);
window.cleanObject = typeof cleanObject !== 'undefined' ? cleanObject : (window.cleanObject || window.PlatePlanState?.cleanObject);
window.renderRecipePreview = renderRecipePreview;
window.hasVariantFavoritingInitialized = typeof hasVariantFavoritingInitialized !== 'undefined' ? hasVariantFavoritingInitialized : () => false;
window.ensureVariantFavoritingPrefs = typeof ensureVariantFavoritingPrefs !== 'undefined' ? ensureVariantFavoritingPrefs : () => [];
window.ACTIVE_HOUSEHOLD_ID = typeof ACTIVE_HOUSEHOLD_ID !== 'undefined' ? ACTIVE_HOUSEHOLD_ID : 'elliott-chloe';
window.platePlanDb = (typeof platePlanDb !== 'undefined' && platePlanDb) ? platePlanDb : (window.platePlanDb || window.PlatePlanCloud?.platePlanDb || null);
window.platePlanListLimits = typeof platePlanListLimits !== 'undefined' ? platePlanListLimits : { vault: 24 };
window.vaultFilterFavouritesOnly = typeof vaultFilterFavouritesOnly !== 'undefined' ? vaultFilterFavouritesOnly : false;
window.previewBaseRecipe = typeof previewBaseRecipe !== 'undefined' ? previewBaseRecipe : null;
window.currentPreviewInstanceId = typeof currentPreviewInstanceId !== 'undefined' ? currentPreviewInstanceId : null;
window.currentViewTab = typeof currentViewTab !== 'undefined' ? currentViewTab : 'original';
window.currentPreviewServingMode = typeof currentPreviewServingMode !== 'undefined' ? currentPreviewServingMode : 'both';
window.currentPreviewSingleServes = typeof currentPreviewSingleServes !== 'undefined' ? currentPreviewSingleServes : 1;
window.editEnhancedRecipe = typeof editEnhancedRecipe !== 'undefined' ? editEnhancedRecipe : null;
window.editRecipeModalView = typeof editRecipeModalView !== 'undefined' ? editRecipeModalView : null;
window.downloadRecipeCard = typeof downloadRecipeCard !== 'undefined' ? downloadRecipeCard : null;
window.duplicateRecipe = typeof duplicateRecipe !== 'undefined' ? duplicateRecipe : null;
window.editRecipe = typeof editRecipe !== 'undefined' ? editRecipe : null;
window.deleteRecipe = typeof deleteRecipe !== 'undefined' ? deleteRecipe : null;
window.reviewEnhancedRecipe = typeof reviewEnhancedRecipe !== 'undefined' ? reviewEnhancedRecipe : null;
window.deleteEnhancedRecipe = typeof deleteEnhancedRecipe !== 'undefined' ? deleteEnhancedRecipe : null;

globalThis.PlatePlanLegacy=Object.freeze({
  version:PLATEPLAN_APP_VERSION,
  expectedCache:PLATEPLAN_EXPECTED_CACHE,
  getState:()=>(typeof state !== 'undefined' ? state : (window.state || {})),
  saveState:(...args)=>(window.saveState || window.PlatePlanCloud?.saveState || (typeof saveState !== 'undefined' ? saveState : ()=>{}))(...args),
  getRecipe:(...args)=>(window.getRecipe || (typeof getRecipe !== 'undefined' ? getRecipe : ()=>null))(...args),
  getProduct:(...args)=>(window.getProduct || (typeof getProduct !== 'undefined' ? getProduct : ()=>null))(...args),
  calculateRecipeDisplayNutrition:(...args)=>(window.calculateRecipeDisplayNutrition || window.PlatePlanNutrition?.calculateRecipeDisplayNutrition || (typeof calculateRecipeDisplayNutrition !== 'undefined' ? calculateRecipeDisplayNutrition : ()=>{}))(...args),
  getPlanContextForInstance:(...args)=>(window.getPlanContextForInstance || window.PlatePlanPlanner?.getPlanContextForInstance || (typeof getPlanContextForInstance !== 'undefined' ? getPlanContextForInstance : ()=>{}))(...args),
  refreshPlatePlanDerivedState:(...args)=>(window.refreshPlatePlanDerivedState || (typeof refreshPlatePlanDerivedState !== 'undefined' ? refreshPlatePlanDerivedState : ()=>{}))(...args),
  renderLegacyView:(...args)=>(window.renderPlatePlanLegacyView || (typeof renderPlatePlanLegacyView !== 'undefined' ? renderPlatePlanLegacyView : ()=>{}))(...args),
  renderers:typeof platePlanFeatureRenderers !== 'undefined' ? platePlanFeatureRenderers : (window.platePlanFeatureRenderers || {}),
  openSearchResult:(...args)=>(window.openPlatePlanSearchResult || (typeof openPlatePlanSearchResult !== 'undefined' ? openPlatePlanSearchResult : ()=>{}))(...args),
  runDelegatedAction:(...args)=>(window.runPlatePlanDelegatedAction || (typeof runPlatePlanDelegatedAction !== 'undefined' ? runPlatePlanDelegatedAction : ()=>{}))(...args),
  showInfo:(...args)=>(window.openAppInfoModal || window.PlatePlanIngredientBank?.openAppInfoModal || (typeof openAppInfoModal !== 'undefined' ? openAppInfoModal : ()=>{}))(...args),
  closeInfo:(...args)=>(window.closeAppConfirmModal || (typeof closeAppConfirmModal !== 'undefined' ? closeAppConfirmModal : ()=>{}))(...args),
  showOverlay:(...args)=>(window.showOverlay || (typeof showOverlay !== 'undefined' ? showOverlay : ()=>{}))(...args),
  hideOverlay:(...args)=>(window.hideOverlay || (typeof hideOverlay !== 'undefined' ? hideOverlay : ()=>{}))(...args),
  showToast:(...args)=>(window.showPlatePlanToast || (typeof showPlatePlanToast !== 'undefined' ? showPlatePlanToast : ()=>{}))(...args),
  createRecoveryPoint:(...args)=>(window.createRecoveryPoint || (typeof createRecoveryPoint !== 'undefined' ? createRecoveryPoint : ()=>{}))(...args),
  renderRecoveryPanel:(...args)=>(window.renderRecoveryPanel || (typeof renderRecoveryPanel !== 'undefined' ? renderRecoveryPanel : ()=>{}))(...args),
  initCloudSync:(...args)=>(window.initPlatePlanCloudSync || window.PlatePlanCloud?.initPlatePlanCloudSync || (typeof initPlatePlanCloudSync !== 'undefined' ? initPlatePlanCloudSync : ()=>{}))(...args),
  signOut:(...args)=>(window.signOutPlatePlan || window.PlatePlanCloud?.signOutPlatePlan || (typeof signOutPlatePlan !== 'undefined' ? signOutPlatePlan : ()=>{}))(...args),
  renderAll:(...args)=>(window.renderAll || (typeof renderAll !== 'undefined' ? renderAll : ()=>{}))(...args),
  saveIngredient:(...args)=>(window.saveIngredient || window.PlatePlanIngredientBank?.saveIngredient || (typeof saveIngredient !== 'undefined' ? saveIngredient : ()=>{}))(...args),
  addIngredient:(...args)=>(window.addIngredient || window.PlatePlanIngredientBank?.addIngredient || (typeof addIngredient !== 'undefined' ? addIngredient : ()=>{}))(...args),
  deleteIngredient:(...args)=>(window.deleteIngredient || window.PlatePlanIngredientBank?.deleteIngredient || (typeof deleteIngredient !== 'undefined' ? deleteIngredient : ()=>{}))(...args),
  saveManualIng:(...args)=>(window.saveManualIng || window.PlatePlanIngredientBank?.saveManualIng || (typeof saveManualIng !== 'undefined' ? saveManualIng : ()=>{}))(...args),
  deleteIng:(...args)=>(window.deleteIng || (typeof deleteIng !== 'undefined' ? deleteIng : ()=>{}))(...args),
  abortBatchImport:(...args)=>(window.abortBatchImport || (typeof abortBatchImport !== 'undefined' ? abortBatchImport : ()=>{}))(...args),
  skipBatchImportRecipe:(...args)=>(window.skipBatchImportRecipe || (typeof skipBatchImportRecipe !== 'undefined' ? skipBatchImportRecipe : ()=>{}))(...args),
  confirmBatchIdentification:(...args)=>(window.confirmBatchIdentification || (typeof confirmBatchIdentification !== 'undefined' ? confirmBatchIdentification : ()=>{}))(...args),
  loadBatchRecipeIntoStepA:(...args)=>(window.loadBatchRecipeIntoStepA || (typeof loadBatchRecipeIntoStepA !== 'undefined' ? loadBatchRecipeIntoStepA : ()=>{}))(...args),
  openConfirmRecipeIdentificationModal:(...args)=>(window.openConfirmRecipeIdentificationModal || (typeof openConfirmRecipeIdentificationModal !== 'undefined' ? openConfirmRecipeIdentificationModal : ()=>{}))(...args),
  updateBatchUiBanners:(...args)=>(window.updateBatchUiBanners || (typeof updateBatchUiBanners !== 'undefined' ? updateBatchUiBanners : ()=>{}))(...args),
  openTescoModal:(...args)=>(window.openTescoModal || (typeof openTescoModal !== 'undefined' ? openTescoModal : ()=>{}))(...args),
  showTescoSearchModal:(...args)=>(window.showTescoSearchModal || (typeof showTescoSearchModal !== 'undefined' ? showTescoSearchModal : ()=>{}))(...args),
  openAddProductModal:(...args)=>(window.openAddProductModal || (typeof openAddProductModal !== 'undefined' ? openAddProductModal : ()=>{}))(...args),
  openProductPicker:(...args)=>(window.openProductPicker || (typeof openProductPicker !== 'undefined' ? openProductPicker : ()=>{}))(...args),
  showTescoImport:(...args)=>(window.showTescoImport || (typeof showTescoImport !== 'undefined' ? showTescoImport : ()=>{}))(...args),
  closeTescoModal:(...args)=>(window.closeTescoModal || (typeof closeTescoModal !== 'undefined' ? closeTescoModal : ()=>{}))(...args),
  openUnifiedMappingModal:(...args)=>(window.openUnifiedMappingModal || (typeof openUnifiedMappingModal !== 'undefined' ? openUnifiedMappingModal : ()=>{}))(...args),
  closeUnifiedMappingModal:(...args)=>(window.closeUnifiedMappingModal || (typeof closeUnifiedMappingModal !== 'undefined' ? closeUnifiedMappingModal : ()=>{}))(...args),
  openTescoImportFromSubst:(...args)=>(window.openTescoImportFromSubst || (typeof openTescoImportFromSubst !== 'undefined' ? openTescoImportFromSubst : ()=>{}))(...args),
  closeSubstituteModal:(...args)=>(window.closeSubstituteModal || (typeof closeSubstituteModal !== 'undefined' ? closeSubstituteModal : ()=>{}))(...args),
  confirmSubstitute:(...args)=>(window.confirmSubstitute || (typeof confirmSubstitute !== 'undefined' ? confirmSubstitute : ()=>{}))(...args),
  extractTescoProduct:(...args)=>(window.extractTescoProduct || (typeof extractTescoProduct !== 'undefined' ? extractTescoProduct : ()=>{}))(...args),
  saveTescoIngredient:(...args)=>(window.saveTescoIngredient || (typeof saveTescoIngredient !== 'undefined' ? saveTescoIngredient : ()=>{}))(...args),
  runDataQualityAudits:(...args)=>(window.runDataQualityAudits || (typeof runDataQualityAudits !== 'undefined' ? runDataQualityAudits : ()=>{}))(...args),
  updateDataQualityBadge:(...args)=>(window.updateDataQualityBadge || (typeof updateDataQualityBadge !== 'undefined' ? updateDataQualityBadge : ()=>{}))(...args),
  fixSubtypeDataQuality:(...args)=>(window.fixSubtypeDataQuality || (typeof fixSubtypeDataQuality !== 'undefined' ? fixSubtypeDataQuality : ()=>{}))(...args)
});
window.renderAll = typeof renderAll !== 'undefined' ? renderAll : (window.renderAll || window.PlatePlanLegacy?.renderAll);
window.saveIngredient = typeof saveIngredient !== 'undefined' ? saveIngredient : (window.saveIngredient || window.PlatePlanIngredientBank?.saveIngredient);
window.addIngredient = typeof addIngredient !== 'undefined' ? addIngredient : (window.addIngredient || window.PlatePlanIngredientBank?.addIngredient);
window.deleteIngredient = typeof deleteIngredient !== 'undefined' ? deleteIngredient : (window.deleteIngredient || window.PlatePlanIngredientBank?.deleteIngredient);
window.saveManualIng = typeof saveManualIng !== 'undefined' ? saveManualIng : (window.saveManualIng || window.PlatePlanIngredientBank?.saveManualIng);
window.deleteIng = typeof deleteIng !== 'undefined' ? deleteIng : (window.deleteIng || window.PlatePlanIngredientBank?.deleteIng);
window.abortBatchImport = typeof abortBatchImport !== 'undefined' ? abortBatchImport : window.abortBatchImport;
window.skipBatchImportRecipe = typeof skipBatchImportRecipe !== 'undefined' ? skipBatchImportRecipe : window.skipBatchImportRecipe;
window.confirmBatchIdentification = typeof confirmBatchIdentification !== 'undefined' ? confirmBatchIdentification : window.confirmBatchIdentification;
window.loadBatchRecipeIntoStepA = typeof loadBatchRecipeIntoStepA !== 'undefined' ? loadBatchRecipeIntoStepA : window.loadBatchRecipeIntoStepA;
window.openConfirmRecipeIdentificationModal = typeof openConfirmRecipeIdentificationModal !== 'undefined' ? openConfirmRecipeIdentificationModal : window.openConfirmRecipeIdentificationModal;
window.updateBatchUiBanners = typeof updateBatchUiBanners !== 'undefined' ? updateBatchUiBanners : window.updateBatchUiBanners;
window.openTescoModal = typeof openTescoModal !== 'undefined' ? openTescoModal : (window.openTescoModal || window.PlatePlanRecipeEditor?.openTescoModal);
window.showTescoSearchModal = typeof showTescoSearchModal !== 'undefined' ? showTescoSearchModal : (window.showTescoSearchModal || window.PlatePlanRecipeEditor?.showTescoSearchModal);
window.openAddProductModal = typeof openAddProductModal !== 'undefined' ? openAddProductModal : (window.openAddProductModal || window.PlatePlanRecipeEditor?.openAddProductModal);
window.openProductPicker = typeof openProductPicker !== 'undefined' ? openProductPicker : (window.openProductPicker || window.PlatePlanRecipeEditor?.openProductPicker);
window.showTescoImport = typeof showTescoImport !== 'undefined' ? showTescoImport : (window.showTescoImport || window.PlatePlanIngredientBank?.showTescoImport);
window.closeTescoModal = typeof closeTescoModal !== 'undefined' ? closeTescoModal : (window.closeTescoModal || window.PlatePlanIngredientBank?.closeTescoModal);
window.openUnifiedMappingModal = typeof openUnifiedMappingModal !== 'undefined' ? openUnifiedMappingModal : (window.openUnifiedMappingModal || window.PlatePlanRecipeEditor?.openUnifiedMappingModal);
window.closeUnifiedMappingModal = typeof closeUnifiedMappingModal !== 'undefined' ? closeUnifiedMappingModal : (window.closeUnifiedMappingModal || window.PlatePlanRecipeEditor?.closeUnifiedMappingModal);
window.openTescoImportFromSubst = typeof openTescoImportFromSubst !== 'undefined' ? openTescoImportFromSubst : (window.openTescoImportFromSubst || window.PlatePlanIngredientBank?.openTescoImportFromSubst);
window.closeSubstituteModal = typeof closeSubstituteModal !== 'undefined' ? closeSubstituteModal : (window.closeSubstituteModal || window.PlatePlanShoppingList?.closeSubstituteModal);
window.confirmSubstitute = typeof confirmSubstitute !== 'undefined' ? confirmSubstitute : (window.confirmSubstitute || window.PlatePlanShoppingList?.confirmSubstitute);
window.extractTescoProduct = typeof extractTescoProduct !== 'undefined' ? extractTescoProduct : (window.extractTescoProduct || window.PlatePlanIngredientBank?.extractTescoProduct);
window.saveTescoIngredient = typeof saveTescoIngredient !== 'undefined' ? saveTescoIngredient : (window.saveTescoIngredient || window.PlatePlanIngredientBank?.saveTescoIngredient);
window.runDataQualityAudits = typeof runDataQualityAudits !== 'undefined' ? runDataQualityAudits : window.runDataQualityAudits;
window.updateDataQualityBadge = typeof updateDataQualityBadge !== 'undefined' ? updateDataQualityBadge : window.updateDataQualityBadge;
window.fixSubtypeDataQuality = typeof fixSubtypeDataQuality !== 'undefined' ? fixSubtypeDataQuality : window.fixSubtypeDataQuality;
window.renderVault = typeof renderVault !== 'undefined' ? renderVault : window.renderVault;
window.isRecipeVariantFavourite = typeof isRecipeVariantFavourite !== 'undefined' ? isRecipeVariantFavourite : window.isRecipeVariantFavourite;
window.isRecipeVariantFavorite = typeof isRecipeVariantFavourite !== 'undefined' ? isRecipeVariantFavourite : window.isRecipeVariantFavorite;
window.dispatchEvent(new CustomEvent('plateplan:legacy-ready',{detail:{version:PLATEPLAN_APP_VERSION}}));
