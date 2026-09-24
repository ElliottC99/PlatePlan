/**
 * scripts/services/cloud-sync.js
 * PlatePlan Cloud Sync Engine & Remote State Management Subsystem
 * Classic global namespace service module.
 */

(() => {
function sanitizePayloadForFirestore(data) {
  if (typeof window !== 'undefined' && window.PlatePlanState && typeof window.PlatePlanState.sanitizePayloadForFirestore === 'function') {
    return window.PlatePlanState.sanitizePayloadForFirestore(data);
  }
  if (typeof window !== 'undefined' && typeof window.sanitizePayloadForFirestore === 'function' && window.sanitizePayloadForFirestore !== sanitizePayloadForFirestore) {
    return window.sanitizePayloadForFirestore(data);
  }
  if (data === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (e) {
    return data;
  }
}

function unwrapAndCleanItem(item) {
  if (typeof window !== 'undefined' && window.PlatePlanState && typeof window.PlatePlanState.unwrapAndCleanItem === 'function') {
    return window.PlatePlanState.unwrapAndCleanItem(item);
  }
  if (typeof window !== 'undefined' && typeof window.unwrapAndCleanItem === 'function' && window.unwrapAndCleanItem !== unwrapAndCleanItem) {
    return window.unwrapAndCleanItem(item);
  }
  return item;
}

function sanitizePlanForFirestore(plan) {
  if (typeof window !== 'undefined' && window.PlatePlanState && typeof window.PlatePlanState.sanitizePlanForFirestore === 'function') {
    return window.PlatePlanState.sanitizePlanForFirestore(plan);
  }
  if (typeof window !== 'undefined' && typeof window.sanitizePlanForFirestore === 'function' && window.sanitizePlanForFirestore !== sanitizePlanForFirestore) {
    return window.sanitizePlanForFirestore(plan);
  }
  return sanitizePayloadForFirestore(unwrapAndCleanItem(plan));
}

function sanitizeRecipeForFirestore(recipe) {
  if (typeof window !== 'undefined' && window.PlatePlanState && typeof window.PlatePlanState.sanitizeRecipeForFirestore === 'function') {
    return window.PlatePlanState.sanitizeRecipeForFirestore(recipe);
  }
  if (typeof window !== 'undefined' && typeof window.sanitizeRecipeForFirestore === 'function' && window.sanitizeRecipeForFirestore !== sanitizeRecipeForFirestore) {
    return window.sanitizeRecipeForFirestore(recipe);
  }
  return sanitizePayloadForFirestore(unwrapAndCleanItem(recipe));
}

function sanitizeIngredientForFirestore(ing) {
  if (typeof window !== 'undefined' && window.PlatePlanState && typeof window.PlatePlanState.sanitizeIngredientForFirestore === 'function') {
    return window.PlatePlanState.sanitizeIngredientForFirestore(ing);
  }
  if (typeof window !== 'undefined' && typeof window.sanitizeIngredientForFirestore === 'function' && window.sanitizeIngredientForFirestore !== sanitizeIngredientForFirestore) {
    return window.sanitizeIngredientForFirestore(ing);
  }
  return sanitizePayloadForFirestore(unwrapAndCleanItem(ing));
}

function cleanObject(obj) {
  if (typeof window !== 'undefined' && window.PlatePlanState && typeof window.PlatePlanState.cleanObject === 'function') {
    return window.PlatePlanState.cleanObject(obj);
  }
  if (typeof window !== 'undefined' && typeof window.cleanObject === 'function' && window.cleanObject !== cleanObject) {
    return window.cleanObject(obj);
  }
  return sanitizePayloadForFirestore(unwrapAndCleanItem(obj));
}

function safeLocalStorageSet(key, val) {
  if (typeof window !== 'undefined' && typeof window.safeLocalStorageSet === 'function' && window.safeLocalStorageSet !== safeLocalStorageSet) {
    return window.safeLocalStorageSet(key, val);
  }
  try {
    const payload = typeof val === 'string' ? val : (typeof safeJsonStringify === 'function' ? safeJsonStringify(val) : JSON.stringify(val));
    localStorage.setItem(key, payload);
    return true;
  } catch (e) {
    console.warn('[LocalStorage Write Warning]', e);
    return false;
  }
}

function safeSaveHistoryBackup(historyList) {
  if (typeof window !== 'undefined' && typeof window.safeSaveHistoryBackup === 'function' && window.safeSaveHistoryBackup !== safeSaveHistoryBackup) {
    return window.safeSaveHistoryBackup(historyList);
  }
  try {
    const payload = typeof safeJsonStringify === 'function' ? safeJsonStringify(historyList || []) : JSON.stringify(historyList || []);
    localStorage.setItem('plateplan_history_backup', payload);
    return true;
  } catch (e) {
    console.warn('[History Backup Warning]', e);
    return false;
  }
}

const SYNC_OUTBOX_SK='plateplan_v1_sync_outbox';
const SYNC_DEVICE_SK='plateplan_v1_device_id';
let platePlanCloudReady=false;
let platePlanSyncSuppress=false;
let isHydrating=false;
window.isHydrating=false;
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

function capturePlatePlanEditBaseline(key){
  return true;
}

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

function getPlatePlanSyncOutbox(){
  return [];
}

function setPlatePlanSyncOutbox(_value){
  // Legacy stub
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
  if (state?.meta && !state.meta.householdId && hid) {
    state.meta.householdId = hid;
  }
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
let lastPersistedStateJson = null;

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

let isRenderingAll = false;
function renderAll(){
  if (isRenderingAll) return;
  if (window.isHydrating || (!window.isPlatePlanHydrated && !window.PlatePlanState?.isReady)) {
    return;
  }
  isRenderingAll = true;
  try {
    rebuildPlatePlanIndexes();
    platePlanNutritionCache.clear();
    refreshPlatePlanDerivedState({ persist: false, render: false, full: true });
    
    if (typeof window !== 'undefined') {
      const activeTab = document.querySelector('.ntab.active, .mobile-nav button.active');
      const activeView = activeTab?.dataset?.view || 'today';
      const renderFn = window.renderPlatePlanLegacyView || window.PlatePlanRouter?.renderPlatePlanLegacyView;
      if (typeof renderFn === 'function') {
        renderFn(activeView);
      }
    }
  } catch (err) {
    console.error('Error in renderAll:', err);
  } finally {
    isRenderingAll = false;
  }
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

async function addIngredient(item){
  return saveIngredient(item);
}
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
  if(db){
    await db.collection('households').doc(householdId).collection('recipes').doc(recipeId).delete().catch(err => console.warn('deleteRecipeFromCloud error:', err));
  }
}
window.deleteRecipeFromCloud = deleteRecipeFromCloud;

async function updateIngredientMappingGlobal(ingredientId, mappingData){
  if(!ingredientId) return;
  const householdId = window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  const db = platePlanDb || (window.firebase && firebase.firestore && firebase.firestore());
  if(!db) return;

  const batch = db.batch();
  const householdDocRef = db.collection('households').doc(householdId);

  // 1. Update ingredient in subcollection
  let targetIng = null;
  if(Array.isArray(state?.ingredients)){
    targetIng = state.ingredients.find(i => i && i.id === ingredientId);
  }
  if(!targetIng && state?.ingredients && typeof state.ingredients === 'object'){
    targetIng = state.ingredients[ingredientId];
  }
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

  // 2. Cascade update to all recipes containing this ingredientId
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
  if(typeof platePlanNutritionCache !== 'undefined' && platePlanNutritionCache.clear){
    platePlanNutritionCache.clear();
  }
  rebuildPlatePlanIndexes();
  if(recipeId){
    recalcRecipeNutrition(recipeId);
  } else {
    recalcAllRecipes();
  }
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

async function pushStateToCloud(force=false){
  if (isHydrating || window.isHydrating) {
    console.log('[v3.3.7-mod STATE PERSISTENCE] PushStateToCloud blocked during hydration.');
    return Promise.resolve(false);
  }

  // Unbind pushState during Steps 1-3 of Meal Planner
  const isInsidePlannerDraft = (document.getElementById('view-planner')?.classList.contains('active') || (typeof currentTab !== 'undefined' && currentTab === 'planner')) && (typeof getPlannerWizardStep === 'function' ? getPlannerWizardStep() < 4 : false);
  if (isInsidePlannerDraft && !force) {
    return Promise.resolve(false);
  }

  const currentStateJson = safeJsonStringify(state);
  if (!force && lastPersistedStateJson && lastPersistedStateJson === currentStateJson) {
    console.log('[v3.3.7-mod STATE PERSISTENCE] State unchanged from last persisted; skipping cloud push.');
    return Promise.resolve(true);
  }

  if (state) state.updatedAt = new Date().toISOString();
  // Explicitly retrieve and assign householdId before constructing Firestore paths or payloads
  const householdId = window.CURRENT_HOUSEHOLD_ID || window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  const targetHouseholdId = householdId;
  window.CURRENT_HOUSEHOLD_ID = householdId;
  window.activeHouseholdId = householdId;
  window.activeHousehold = { id: householdId };
  if (state && !state.meta) state.meta = {};
  if (state?.meta) state.meta.householdId = householdId;

  const householdDocRef = getHouseholdDocRef(platePlanDb, targetHouseholdId);
  console.log('[FIRESTORE WRITE PATH]', householdDocRef.path);

  // Debounce handler (1000ms window) for local-to-cloud sync dispatches targeting households/elliott-chloe.
  // Coalesces rapid, back-to-back state mutations or un-debounced watchers to prevent Firestore write queue exhaustion.
  if(!force && platePlanCloudReady && platePlanCloudUser){
    return new Promise((resolve, reject) => {
      platePlanDebounceResolvers.push({ resolve, reject });
      if(platePlanCloudDebounceTimer) clearTimeout(platePlanCloudDebounceTimer);
      platePlanCloudDebounceTimer = setTimeout(async () => {
        platePlanCloudDebounceTimer = null;
        const resolvers = platePlanDebounceResolvers.slice();
        platePlanDebounceResolvers = [];
        try {
          const res = await _executePushStateToCloud(false, targetHouseholdId, householdDocRef);
          resolvers.forEach(r => r.resolve(res));
        } catch(err) {
          resolvers.forEach(r => r.reject(err));
        }
      }, 1000); // 1000ms debounce
    });
  }

  if(platePlanCloudDebounceTimer){
    clearTimeout(platePlanCloudDebounceTimer);
    platePlanCloudDebounceTimer = null;
  }
  const pendingResolvers = platePlanDebounceResolvers.slice();
  platePlanDebounceResolvers = [];
  try {
    const res = await _executePushStateToCloud(force, targetHouseholdId, householdDocRef);
    pendingResolvers.forEach(r => r.resolve(res));
    return res;
  } catch(err) {
    pendingResolvers.forEach(r => r.reject(err));
    throw err;
  }
}

async function _executePushStateToCloud(force, targetHouseholdId, householdDocRef){
  if(!platePlanCloudReady || !platePlanCloudUser || !platePlanDb) return;
  if(!navigator.onLine){
    updatePlatePlanSyncStatus('offline','Offline · changes saved locally');
    if(force){
      showPlatePlanToast('Save Failed: Database update could not be committed.');
      throw new Error('Save Failed: Database update could not be committed.');
    }
    return;
  }

  // Safely resolve householdId from arguments, state, global or fallback
  const householdId = targetHouseholdId
    || state?.householdId
    || state?.meta?.householdId
    || (typeof ACTIVE_HOUSEHOLD_ID !== 'undefined' ? ACTIVE_HOUSEHOLD_ID : null)
    || (typeof window !== 'undefined' ? (window.CURRENT_HOUSEHOLD_ID || window.activeHouseholdId || window.PLATEPLAN_FIREBASE?.householdId) : null)
    || 'elliott-chloe';

  if(!householdDocRef && platePlanDb){
    householdDocRef = getHouseholdDocRef(platePlanDb, householdId);
  }

  // 1. Exponential backoff guard: applies to all sync attempts targeting households/elliott-chloe
  const now = Date.now();
  if(now < platePlanBackoffUntil){
    const remainingBackoff = platePlanBackoffUntil - now + 500;
    schedulePlatePlanCloudDiff(remainingBackoff);
    if(force){
      console.warn(`[FIRESTORE WRITE THROTTLE] Cloud push deferred due to active backoff (${Math.round(remainingBackoff)}ms remaining).`);
    }
    return;
  }

  // 2. Minimum push interval (throttle): debouncing rapid mutations to prevent write stream exhaustion
  const MIN_PUSH_INTERVAL_MS = force ? 800 : 2000;
  const elapsedSincePush = now - platePlanLastPushCompletedAt;
  if(elapsedSincePush < MIN_PUSH_INTERVAL_MS){
    schedulePlatePlanCloudDiff(MIN_PUSH_INTERVAL_MS - elapsedSincePush);
    return;
  }

  // 3. Concurrency lock: coalesce into pending push if write stream is in-flight or reconnecting
  if(platePlanIsPushing){
    platePlanPendingPush=true;
    if(force && platePlanCurrentPushPromise){
      try {
        await platePlanCurrentPushPromise;
      } catch(_e) {}
      if(platePlanPendingPush){
        return pushStateToCloud(false);
      }
    }
    return;
  }
  platePlanIsPushing=true;
  platePlanPendingPush=false;
  updatePlatePlanSyncStatus('saving');

  platePlanCurrentPushPromise = (async () => {
    try{
      const cleaned=cleanCloudValue(state);
      if(!cleaned) throw new Error('State payload is empty');

      // Subcollection batch writes
      const dataCol = householdDocRef.collection('data');

      // Ensure tombstones sync across sessions
      const deletedProductIds = Array.from(new Set([
        ...(Array.isArray(cleaned.meta?.deletedProductIds) ? cleaned.meta.deletedProductIds : []),
        ...(Array.isArray(state?.meta?.deletedProductIds) ? state.meta.deletedProductIds : [])
      ]));
      const deletedCategoryIds = Array.from(new Set([
        ...(Array.isArray(cleaned.meta?.deletedCategoryIds) ? cleaned.meta.deletedCategoryIds : []),
        ...(Array.isArray(state?.meta?.deletedCategoryIds) ? state.meta.deletedCategoryIds : [])
      ]));

      // Document contents for dirty-checking
      const metaContent = {
        schemaVersion: PLATEPLAN_SCHEMA_VERSION,
        appVersion: PLATEPLAN_APP_VERSION,
        prefs: cleaned.prefs || {},
        customCats: cleaned.customCats || {},
        excluded: cleaned.excluded || {},
        useUpProducts: cleaned.useUpProducts || {},
        ignoredGroupMergeSuggestions: cleaned.ignoredGroupMergeSuggestions || [],
        ignoredDataQualityWarnings: cleaned.ignoredDataQualityWarnings || [],
        dataQualityDismissals: cleaned.dataQualityDismissals || {},
        packPicks: cleaned.packPicks || {},
        meta: {
          ...(cleaned.meta || {}),
          householdId,
          deletedProductIds,
          deletedCategoryIds
        }
      };

      const taxonomyContent = {
        ingredientGroups: cleaned.ingredientGroups || [],
        ingredientFamilies: cleaned.ingredientFamilies || []
      };

      const plannerContent = {
        plan: cleaned.plan || {},
        overrides: cleaned.overrides || {}
      };

      const historyContent = {
        planHistory: cleaned.planHistory || []
      };

      const sigs = {
        meta: computePayloadSignature(metaContent),
        taxonomy: computePayloadSignature(taxonomyContent),
        planner: computePayloadSignature(plannerContent),
        history: computePayloadSignature(historyContent)
      };

      // Determine which documents actually modified their content
      const changedKeys = Object.keys(sigs).filter(k => force || sigs[k] !== platePlanLastPushedSignatures[k]);

      if(changedKeys.length === 0){
        // Nothing changed: completely skip Firestore write batch to avoid exhausting stream queue
        platePlanLastPushCompletedAt=Date.now();
        platePlanLastSyncError=null;
        platePlanLastSyncedAt=Date.now();
        updatePlatePlanSyncStatus('synced');
        return;
      }

      const deviceId=getPlatePlanDeviceId();
      const userEmail=platePlanCloudUser.email||platePlanCloudUser.uid||'';
      const nowIso=new Date().toISOString();
      const serverTs=firebase.firestore.FieldValue.serverTimestamp();

      const baseMeta={
        updatedAt: serverTs,
        clientTimestamp: nowIso,
        updatedBy: userEmail,
        deviceId: deviceId
      };

      // Subcollection Architecture: root document stores only metadata/preferences
      const writePayload = {
        updatedAt: serverTs,
        meta: cleaned.meta || state.meta || {},
        ingredientGroups: cleaned.ingredientGroups || state.ingredientGroups || [],
        ingredientFamilies: cleaned.ingredientFamilies || state.ingredientFamilies || [],
        plan: cleaned.plan || state.plan || {},
        overrides: cleaned.overrides || state.overrides || {},
        planHistory: cleaned.planHistory || state.planHistory || [],
        prefs: cleaned.prefs || state.prefs || {},
        customCats: cleaned.customCats || state.customCats || {},
        useUpProducts: cleaned.useUpProducts || state.useUpProducts || {},
        packPicks: cleaned.packPicks || state.packPicks || {},
        dataQualityDismissals: cleaned.dataQualityDismissals || state.dataQualityDismissals || {}
      };

      // Combined atomic batch write targeting households/elliott-chloe
      const batch = platePlanDb.batch();
      batch.set(householdDocRef, writePayload, { merge: true });
      batch.set(dataCol.doc('meta'), { ...baseMeta, ...metaContent });
      if(changedKeys.includes('taxonomy')) batch.set(dataCol.doc('taxonomy'), { ...baseMeta, ...taxonomyContent });
      if(changedKeys.includes('planner')) batch.set(dataCol.doc('planner'), { ...baseMeta, ...plannerContent });
      if(changedKeys.includes('history')) batch.set(dataCol.doc('history'), { ...baseMeta, ...historyContent });

      await batch.commit();

      // Store verified pushed signatures
      platePlanLastPushedSignatures.meta = sigs.meta;
      changedKeys.forEach(k => { platePlanLastPushedSignatures[k] = sigs[k]; });

      // Clean up oversized monolithic legacy state doc at most once
      if(!platePlanLegacyStateDeleted){
        platePlanLegacyStateDeleted=true;
        dataCol.doc('state').delete().catch(()=>{});
      }

      platePlanSyncErrorCount=0;
      platePlanBackoffUntil=0;
      platePlanLastPushCompletedAt=Date.now();
      platePlanLastSyncError=null;
      platePlanLastSyncedAt=Date.now();
      lastPersistedStateJson = safeJsonStringify(state);
      console.log('[v3.3.7-mod STATE PERSISTENCE] State successfully pushed to cloud with debounce 1000ms.');
      updatePlatePlanSyncStatus('synced');
    }catch(error){
      console.warn('PlatePlan Cloud push failed:',error);
      platePlanSyncErrorCount++;
      const isExhausted = error?.code === 'resource-exhausted' || 
                          String(error?.message || '').toLowerCase().includes('resource-exhausted') ||
                          String(error?.message || '').toLowerCase().includes('quota') ||
                          String(error?.message || '').toLowerCase().includes('too many');
      const backoffMs = isExhausted
        ? Math.max(15000, Math.min(120000, Math.pow(2, platePlanSyncErrorCount) * 5000))
        : Math.min(60000, Math.pow(2, platePlanSyncErrorCount) * 1500);
      platePlanBackoffUntil = Date.now() + backoffMs;
      platePlanLastSyncError=error?.message||'Cloud push failed';
      updatePlatePlanSyncStatus(navigator.onLine?'error':'offline', isExhausted ? 'Sync throttled (retrying)' : platePlanLastSyncError);
      if(!isExhausted){
        showPlatePlanToast('Save Failed: Database update could not be committed.');
      }
      throw error;
    }finally{
      platePlanIsPushing=false;
      platePlanCurrentPushPromise=null;
      if(platePlanPendingPush){
        // Queue next push with safety delay respecting backoff instead of synchronous recursion
        const nextDelay = Math.max(1500, platePlanBackoffUntil > Date.now() ? (platePlanBackoffUntil - Date.now() + 500) : 1500);
        schedulePlatePlanCloudDiff(nextDelay);
      }
    }
  })();
  platePlanCurrentPushPromise.catch(()=>{});

  return platePlanCurrentPushPromise;
}

// === DATA QUALITY TRANSACTION & REMOTE SHIELDING (v2.6.9) ===
const platePlanTransactionShield = {
  inFlight: false,
  lastCompletedAt: 0,
  cooldownMs: 4000
};

function createSafeStateSnapshot(sourceState) {
  if (!sourceState || typeof sourceState !== 'object') return {};
  const targetHouseholdId = window.activeHouseholdId || sourceState?.meta?.householdId || 'elliott-chloe';
  try {
    const seen = new WeakSet();
    const clone = JSON.parse(JSON.stringify(sourceState, (key, value) => {
      if (typeof value === 'function') return undefined;
      if (typeof Node !== 'undefined' && value instanceof Node) return undefined;
      if (value instanceof Set) return Array.from(value);
      if (value instanceof Map) return Object.fromEntries(value);
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return undefined;
        seen.add(value);
      }
      return value;
    }));
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

  // 1. UI Lock
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }
  platePlanTransactionShield.inFlight = true;

  if (errorContainerId) {
    const errEl = document.getElementById(errorContainerId);
    if (errEl) errEl.innerHTML = '';
  }

  // 2. Rollback Snapshot (State Purity Guaranteed)
  const rollbackState = createSafeStateSnapshot(state);
  const nowIso = new Date().toISOString();

  try {
    // 3. Direct Root State Mutation
    switch (mutationType) {
      case 'UPDATE_PRODUCT': {
        const { product, isNew, groupUpdate } = payload;
        if (!product || !product.id) throw new Error('Invalid product payload');
        product.updatedAt = nowIso;

        // Ensure product explicitly updates both ingredientId and subTypeId/subType
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
          } else {
            state.ingredientGroups.push(groupUpdate);
          }
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
        if (primaryProd) {
          await saveIngredient(primaryProd);
        }
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
        if (isNew) {
          state.ingredientGroups.push(groupData);
        } else {
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
        if (isNew) {
          state.ingredientFamilies.push(familyData);
        } else {
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
          if (rec && rec[r.key] && rec[r.key][r.idx]) {
            rec[r.key][r.idx].bankId = r.replacementId;
          }
        });
        const firstReplacement = (replacements && replacements[0]) ? replacements[0].replacementId : null;
        (state.ingredientGroups || []).forEach(group => {
          if (Array.isArray(group.productIds)) group.productIds = group.productIds.filter(id => id !== targetId);
          if (group.defaultProductId === targetId) {
            group.defaultProductId = firstReplacement || group.productIds[0] || null;
          }
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

    // Refresh derived indexes & cache before serialization to cloud
    rebuildPlatePlanIndexes();
    platePlanNutritionCache.clear();

    // 4. Local Persistence
    safeLocalStorageSet(SK, safeJsonStringify(state));

    // 5. Explicit Forced Cloud Write: isolated in internal try/catch to protect local transaction
    try {
      await pushStateToCloud(true);
    } catch (cloudErr) {
      console.warn(`[executeDataQualityTransaction] Cloud push deferred or failed (${mutationType}), local mutation preserved:`, cloudErr);
      if (typeof schedulePlatePlanCloudDiff === 'function') {
        schedulePlatePlanCloudDiff(1000);
      }
    }

    // 6. Finalize Success
    platePlanTransactionShield.lastCompletedAt = Date.now();

    if (modalWrapId) {
      const modal = document.getElementById(modalWrapId);
      if (modal) {
        modal.classList.remove('open');
        if (modal.dataset.modalWrapped === '1' || modal.id === 'manual-ing-panel') {
          modal.style.display = 'none';
        }
      }
    }

    if (successMessage) {
      showPlatePlanToast(successMessage);
    }

    // Reactive in-memory data quality audit recalculation
    try {
      if (typeof runDataQualityAudits === 'function') {
        runDataQualityAudits(true);
      }
    } catch(auditErr) {
      console.warn('Reactive audit error in executeDataQualityTransaction:', auditErr);
    }

    return true;
  } catch (error) {
    console.error(`[DataQuality Transaction Failed] ${mutationType}:`, error);

    // Rollback local memory and storage
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

    // Display error banner in modal
    const errHtml = '<div class="msg error" style="margin:10px 0;font-weight:600">Database Write Failed: Changes were not saved.</div>';
    if (errorContainerId) {
      const errEl = document.getElementById(errorContainerId);
      if (errEl) {
        errEl.innerHTML = errHtml;
      }
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
  if(platePlanSyncSuppress || isHydrating || window.isHydrating || isHydratingRemoteState || window.isHydratingRemoteState) return;
  if(immediateFlush){
    clearTimeout(platePlanSyncTimer);
    pushStateToCloud();
  }else{
    schedulePlatePlanCloudDiff(1000);
  }
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
  if (isHydrating || window.isHydrating) {
    console.log('[v3.3.7-mod STATE PERSISTENCE] saveState called during hydration; skipped.');
    return true;
  }
  window.dispatchEvent(new CustomEvent('plateplan:state-saved',{detail:{source:'cloud',savedAt:Date.now()}}));
  if(state) {
    state.updatedAt=new Date().toISOString();
    state.version = '3.0.6';
    if (state.plan && typeof state.plan === 'object') {
      state.plan.version = '3.0.6';
    }
  }
  window.state = state;
  window.appState = state;
  try{
    // Defensive LocalStorage Engine via safeLocalStorageSet
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

  // Reactive in-memory data quality audit run
  try {
    if (typeof runDataQualityAudits === 'function') {
      runDataQualityAudits(document.getElementById('view-data')?.classList.contains('active'));
    }
  } catch(auditErr) {
    console.warn('Reactive audit error in saveState:', auditErr);
  }

  // Unbind autosave while inside Steps 1, 2, or 3 of Meal Planner
  const isInsidePlannerDraft = (document.getElementById('view-planner')?.classList.contains('active') || (typeof currentTab !== 'undefined' && currentTab === 'planner')) && (typeof getPlannerWizardStep === 'function' ? getPlannerWizardStep() < 4 : false);
  if (isInsidePlannerDraft && !immediate) {
    return true;
  }

  // Central debounced save stream for state.plan updates
  if (state?.plan && typeof state.plan === 'object' && Object.keys(state.plan).length > 0) {
    queuePlanSave(state.plan, immediate);
  }

  if(!platePlanSyncSuppress && platePlanCloudReady && platePlanCloudUser){
    if(immediate){
      clearTimeout(platePlanSyncTimer);
      pushStateToCloud(true);
    }else{
      schedulePlatePlanCloudDiff(1000);
    }
  }else if(!platePlanCloudUser){
    updatePlatePlanSyncStatus('local');
  }
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
  const el=document.getElementById('sync-status');
  if(!el) return;
  let label='• Synced';
  if(status==='synced'){
    label='• Synced';
  }else if(status==='saving'){
    label='Saving…';
  }else if(status==='offline'){
    label='Offline';
  }else if(status==='connecting'){
    label='Connecting…';
  }else if(status==='local'){
    label='Local only';
  }else if(status==='error'){
    label='Sync error';
  }
  el.dataset.status=status;
  el.textContent=label;
  el.title=detail||label||'';
}

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

  // Helper: safe timestamp extraction falling back to root state timestamp
  const getMs = (item, parentState) => {
    const raw = item?.updatedAt || parentState?.updatedAt;
    if (!raw) return 0;
    if (typeof raw === 'string') return new Date(raw).getTime() || 0;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'object' && typeof raw.seconds === 'number') return raw.seconds * 1000;
    return 0;
  };

  // Helper to score product data completeness
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

  // 1. Recipes reconciliation (by id)
  const localRecipes = Array.isArray(local.recipes) ? local.recipes : [];
  const remoteRecipes = Array.isArray(remote.recipes) ? remote.recipes : [];
  const mergedRecipesMap = new Map();

  // Add remote recipes first
  remoteRecipes.forEach(r => {
    if (r && r.id) mergedRecipesMap.set(r.id, r);
  });

  // Reconcile with local recipes
  localRecipes.forEach(lr => {
    if (!lr || !lr.id) return;
    const rr = mergedRecipesMap.get(lr.id);
    if (!rr) {
      // Local recipe not yet in remote cloud: PRESERVE IT!
      mergedRecipesMap.set(lr.id, lr);
      hasLocalNewer = true;
    } else {
      const localTime = getMs(lr, local);
      const remoteTime = getMs(rr, remote);
      if (localTime > remoteTime) {
        mergedRecipesMap.set(lr.id, lr);
        hasLocalNewer = true;
      } else if (localTime < remoteTime) {
        // Remote is strictly newer
        if (lr.enhanced && !rr.enhanced) {
          mergedRecipesMap.set(lr.id, { ...rr, enhanced: lr.enhanced });
          hasLocalNewer = true;
        } else {
          mergedRecipesMap.set(lr.id, rr);
        }
      } else {
        // Timestamps are equal or both missing
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
          } else if (JSON.stringify(lr) !== JSON.stringify(rr)) {
            mergedRecipesMap.set(lr.id, { ...rr, ...lr });
          }
        }
      }
    }
  });

  const mergedRecipes = Array.from(mergedRecipesMap.values());

  // Helper: preserve valid data fields when merging two product versions
  const mergeProductPreservingValidData = (lp, rp, preferRemote = false) => {
    const primary = preferRemote ? rp : lp;
    const fallback = preferRemote ? lp : rp;
    const merged = { ...fallback, ...primary };
    // Guard critical fields: never allow an invalid or missing value to clobber a valid value
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
    if (!primary.cat && fallback.cat) {
      merged.cat = fallback.cat;
    }
    return merged;
  };

  // Tombstones for deleted products and categories
  const localDeletedProducts = new Set(Array.isArray(local.meta?.deletedProductIds) ? local.meta.deletedProductIds : []);
  const remoteDeletedProducts = new Set(Array.isArray(remote.meta?.deletedProductIds) ? remote.meta.deletedProductIds : []);
  const allDeletedProducts = new Set([...localDeletedProducts, ...remoteDeletedProducts]);

  const localDeletedCats = new Set(Array.isArray(local.meta?.deletedCategoryIds) ? local.meta.deletedCategoryIds : []);
  const remoteDeletedCats = new Set(Array.isArray(remote.meta?.deletedCategoryIds) ? remote.meta.deletedCategoryIds : []);
  const allDeletedCats = new Set([...localDeletedCats, ...remoteDeletedCats]);

  // 2. Ingredients / Products (v2.8.0 sub-collection model: server-authoritative via sub-collection)
  const mergedIngs = (Array.isArray(state?.ingredients) && state.ingredients.length > 0)
    ? state.ingredients
    : (Array.isArray(local.ingredients) ? local.ingredients : (Array.isArray(remote.ingredients) ? remote.ingredients : []));

  // 3. Ingredient Groups and Families
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

  // 4. Overrides
  const mergedOverrides = preferRemote
    ? { ...(local.overrides || {}), ...(remote.overrides || {}) }
    : { ...(remote.overrides || {}), ...(local.overrides || {}) };

  // 5. Plan & Plan History
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

  // 6. Settings, Prefs, Categories, Dismissals
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
    // Cloud-First Firestore Single Source of Truth: what exists in households/elliott-chloe is what renders on screen
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
    }else{
      renderPlatePlanDependentViews();
    }

    platePlanLastSyncedAt=Date.now();
    const who=metadata.updatedBy&&metadata.updatedBy!==platePlanCloudUser?.email?`Updated by ${metadata.updatedBy}`:'Synced';
    updatePlatePlanSyncStatus('synced',who);

    if(hasLocalNewer && platePlanCloudReady && platePlanCloudUser && !options.isBoot){
      schedulePlatePlanCloudDiff(3000);
    }
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
    if(value===null){
      if(index>=0) list.splice(index,1);
    } else if(index>=0){
      const localItem = list[index];
      const localTime = localItem?.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
      const remoteTime = cleaned?.updatedAt ? new Date(cleaned.updatedAt).getTime() : 0;
      if(remoteTime >= localTime || !localTime){
        list[index] = cleaned;
      } else {
        // Keep local item and push if online
        if(platePlanCloudReady && platePlanCloudUser){
          schedulePlatePlanCloudDiff(3000);
        }
      }
    } else {
      list.push(cleaned);
    }
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

function parseRecipeDocumentToCleanArray(docData) {
  if (!docData) return [];
  if (Array.isArray(docData)) return docData;
  if (typeof docData !== 'object') return [];
  if (Array.isArray(docData.recipes)) return docData.recipes;
  if (Array.isArray(docData.items)) return docData.items;
  if (Array.isArray(docData.list)) return docData.list;
  const values = Object.values(docData).filter(v => v && typeof v === 'object' && (v.id || v.name));
  if (values.length > 0) return values;
  if (docData.id || docData.name) return [docData];
  return [];
}
window.parseRecipeDocumentToCleanArray = parseRecipeDocumentToCleanArray;

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
  } else if (docs && typeof docs === 'object') {
    list = parseRecipeDocumentToCleanArray(docs);
  }

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
      if (!localTime || cloudTime >= localTime) {
        Object.assign(existing, clean);
      }
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

    // 1. Migrate ingredients to subcollection in batches of up to 400
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

    // 2. Migrate recipes to subcollection in batches of up to 400
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

    // 3. Clear root doc monolithic fields
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
  console.log('[PlatePlan v3.3.7-mod] Legacy Firestore onSnapshot listeners bypassed. Core engine in charge.');
  platePlanSyncUnsubscribers.forEach(stop=>{try{stop();}catch(e){}});
  platePlanSyncUnsubscribers=[];
  return;
  const targetHouseholdId = window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  const householdDocRef = getHouseholdDocRef(platePlanDb, targetHouseholdId);

  // A. Subcollection Listener: ingredients
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

  // B. Subcollection Listener: recipes
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
        if (!localTime || cloudTime >= localTime) {
          Object.assign(existing, clean);
        }
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

  // B2. Dedicated Subcollection Doc Listener: data/recipes
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
    // console.log("[v3.0.6 HYDRATION]", state.recipes.length, "recipes loaded.");
  }, error => {
    console.warn('[DATA RECIPES LISTENER ERROR]', error);
  });
  platePlanSyncUnsubscribers.push(unsubDataRecipes);

  // C. Lightweight Listener on doc('households/elliott-chloe') ONLY for top-level metadata
  const unsubHousehold = householdDocRef.onSnapshot(docSnapshot => {
    if(!docSnapshot || !docSnapshot.exists) return;
    if(platePlanTransactionShield.inFlight || (Date.now() - platePlanTransactionShield.lastCompletedAt < platePlanTransactionShield.cooldownMs)) return;
    if(docSnapshot.metadata && docSnapshot.metadata.hasPendingWrites) return;

    const docData = docSnapshot.data() || {};
    const sourceData = (docData.state && typeof docData.state === 'object') ? docData.state : docData;

    // Guard Realtime Overwrites: Ensure root snapshot updates do NOT overwrite window.state.recipes.
    // Instead, merge root recipes with the data/recipes document objects, deduplicating by id.
    const rootRecipesRaw = sourceData.recipes || sourceData.data?.recipes;
    if (rootRecipesRaw) {
      const parsedRoot = parseRecipeDocumentToCleanArray(typeof rootRecipesRaw === 'object' ? rootRecipesRaw : { recipes: rootRecipesRaw });
      const mergedSources = [...parsedRoot, ...(lastLoadedDataRecipesDoc || [])];
      populateRecipesState(mergedSources, { merge: true });
    }

    // Retain ONLY top-level metadata; NEVER overwrite ingredients from root document
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
    // console.log("[v3.0.6 HYDRATION]", state.recipes.length, "recipes loaded.");
  }, error => {
    console.error('[HOUSEHOLD ROOT METADATA LISTENER ERROR]', error);
    if(!navigator.onLine) updatePlatePlanSyncStatus('offline');
  });
  platePlanSyncUnsubscribers.push(unsubHousehold);

  // D. Subcollection Listener: plans/current
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

  // E. Subcollection Listener: plans/history
  const unsubPlanHistory = householdDocRef.collection('plans').doc('history').onSnapshot(docSnapshot => {
    if(!docSnapshot || !docSnapshot.exists) return;
    if(platePlanTransactionShield.inFlight || (Date.now() - platePlanTransactionShield.lastCompletedAt < platePlanTransactionShield.cooldownMs)) return;
    if(docSnapshot.metadata && docSnapshot.metadata.hasPendingWrites) return;

    const data = docSnapshot.data() || {};
    let val = cleanCloudValue(data.value !== undefined ? data.value : (Array.isArray(data) ? data : data.planHistory));
    if(Array.isArray(val) && val.length > 0){
      if(window.deletedPlanIds && window.deletedPlanIds.size > 0) {
        val = val.filter(item => item && !window.deletedPlanIds.has(item.id) && !window.deletedPlanIds.has(item.planId));
      }
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
  isHydrating = true;
  window.isHydrating = true;
  try {
    // Unsubscribe any legacy document listeners
    platePlanSyncUnsubscribers.forEach(stop=>{try{stop();}catch(e){}});
    platePlanSyncUnsubscribers=[];

    updatePlatePlanSyncStatus('connecting');
    const targetHouseholdId = window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
    window.activeHouseholdId = targetHouseholdId;
    window.activeHousehold = { id: targetHouseholdId };
    if (!state) state = loadState() || {};
    if (!state.meta) state.meta = {};
    state.meta.householdId = targetHouseholdId;
    window.state = state;
    window.appState = state;

    const householdDocRef = getHouseholdDocRef(platePlanDb, targetHouseholdId);
    // console.log('[FIRESTORE READ PATH]', householdDocRef.path);

  // 1. Fetch Root Document
  let rootSnapshot = null;
  try {
    if (navigator.onLine) {
      try {
        rootSnapshot = await householdDocRef.get({ source: 'server' });
      } catch (_serverErr) {
        rootSnapshot = await householdDocRef.get();
      }
    } else {
      rootSnapshot = await householdDocRef.get();
    }
  } catch(err) {
    console.warn('[FIRESTORE ROOT FETCH ERROR]', err);
  }

  const rootData = (rootSnapshot && rootSnapshot.exists) ? (rootSnapshot.data() || {}) : {};

  // 2. Perform Automatic One-Time Migration check if root document has top-level ingredients or recipes
  await performSubcollectionMigrationIfNeeded(platePlanDb, targetHouseholdId, rootData);

  // 3. Read Subcollection: ingredients
  const ingredientsCol = householdDocRef.collection('ingredients');
  let ingredientsSnapshot = null;
  try {
    if (navigator.onLine) {
      try {
        ingredientsSnapshot = await ingredientsCol.get({ source: 'server' });
      } catch (_serverErr) {
        ingredientsSnapshot = await ingredientsCol.get();
      }
    } else {
      ingredientsSnapshot = await ingredientsCol.get();
    }
  } catch(err) {
    console.warn('[INGREDIENTS SUBCOLLECTION READ ERROR]', err);
  }

  // Fallback to legacy products subcollection if ingredients subcollection is empty
  if(!ingredientsSnapshot || ingredientsSnapshot.empty){
    try {
      const productsCol = householdDocRef.collection('products');
      const prodSnap = await productsCol.get();
      if(prodSnap && !prodSnap.empty){
        // Copy to ingredients subcollection
        const batch = platePlanDb.batch();
        prodSnap.docs.forEach(doc => {
          const d = unwrapAndCleanItem(doc.data() || {});
          if(!d.id) d.id = doc.id;
          batch.set(ingredientsCol.doc(doc.id), sanitizePayloadForFirestore(d), { merge: true });
        });
        await batch.commit();
        ingredientsSnapshot = await ingredientsCol.get();
      }
    } catch(_prodErr) {
      console.warn('[PRODUCTS FALLBACK CHECK ERROR]', _prodErr);
    }
  }

  if (ingredientsSnapshot && !ingredientsSnapshot.empty) {
    populateIngredientsState(ingredientsSnapshot.docs);
  } else if (!Array.isArray(state.ingredients)) {
    state.ingredients = [];
  }

  // 4. Read Subcollection: recipes
  const recipesCol = householdDocRef.collection('recipes');
  let recipesSnapshot = null;
  try {
    if (navigator.onLine) {
      try {
        recipesSnapshot = await recipesCol.get({ source: 'server' });
      } catch (_serverErr) {
        recipesSnapshot = await recipesCol.get();
      }
    } else {
      recipesSnapshot = await recipesCol.get();
    }
  } catch(err) {
    console.warn('[RECIPES SUBCOLLECTION READ ERROR]', err);
  }

  // 5. Hydrate Top-Level Metadata from subcollection: data
  let dataDocs = {};
  try {
    const dataCol = householdDocRef.collection('data');
    const subSnapshot = await dataCol.get();
    subSnapshot.forEach(doc => { dataDocs[doc.id] = doc.data() || {}; });
  } catch(e) {}

  // Explicit Path Reading: Fetch the dedicated recipes document at doc(db, 'households', 'elliott-chloe', 'data', 'recipes')
  try {
    let dataRecipesRaw = dataDocs.recipes;
    if (!dataRecipesRaw) {
      const dataRecipesSnap = await householdDocRef.collection('data').doc('recipes').get();
      if (dataRecipesSnap && dataRecipesSnap.exists) {
        dataRecipesRaw = dataRecipesSnap.data() || {};
      }
    }
    if (dataRecipesRaw) {
      lastLoadedDataRecipesDoc = parseRecipeDocumentToCleanArray(dataRecipesRaw);
    }
  } catch(err) {
    console.warn('[DEDICATED DATA/RECIPES READ ERROR]', err);
  }

  // Explicit multi-path check across:
  // 1. Root document households/elliott-chloe (rootData.recipes & rootData.data.recipes)
  // 2. Subcollection path households/elliott-chloe/data (mapping documents containing recipe arrays or individual recipe objects)
  // 3. Subcollection path households/elliott-chloe/recipes
  // 4. Dedicated document households/elliott-chloe/data/recipes
  const allRecipeSources = [];
  if (recipesSnapshot && !recipesSnapshot.empty) {
    recipesSnapshot.docs.forEach(doc => allRecipeSources.push(doc));
  }

  if (lastLoadedDataRecipesDoc && lastLoadedDataRecipesDoc.length > 0) {
    lastLoadedDataRecipesDoc.forEach(r => allRecipeSources.push(r));
  }

  // Multi-path 1: Root document
  const rootRecipes = rootData.recipes || rootData.data?.recipes || null;
  if (rootRecipes) {
    const parsedRoot = parseRecipeDocumentToCleanArray(typeof rootRecipes === 'object' ? rootRecipes : { recipes: rootRecipes });
    parsedRoot.forEach(r => { if(r) allRecipeSources.push(r); });
  }

  // Multi-path 2: Subcollection data (specifically mapping documents containing recipe arrays or individual recipe objects)
  Object.entries(dataDocs).forEach(([docId, docContent]) => {
    if (!docContent || typeof docContent !== 'object') return;
    if (docId === 'recipes') {
      const parsed = parseRecipeDocumentToCleanArray(docContent);
      parsed.forEach(r => { if(r) allRecipeSources.push(r); });
      return;
    }
    if (Array.isArray(docContent.recipes)) {
      docContent.recipes.forEach(r => { if(r) allRecipeSources.push(r); });
    } else if (docContent.recipes && typeof docContent.recipes === 'object') {
      Object.values(docContent.recipes).forEach(r => { if(r) allRecipeSources.push(r); });
    } else if (Array.isArray(docContent.list)) {
      docContent.list.forEach(r => { if(r) allRecipeSources.push(r); });
    } else if (docContent.name && (docContent.ingredients || docContent.steps || docContent.serves || docId.startsWith('recipe_') || docId.startsWith('recipe-') || docContent.name.toLowerCase().includes('pancake'))) {
      allRecipeSources.push({ id: docContent.id || docId, ...docContent });
    }
  });

  // Local storage fallback if no recipe items found yet
  if (allRecipeSources.length === 0) {
    try {
      const localBackup = localStorage.getItem('plateplan_recipes_backup') || localStorage.getItem('plateplan_state_v2');
      if (localBackup) {
        const parsed = JSON.parse(localBackup);
        const recs = parsed.recipes || (Array.isArray(parsed) ? parsed : null);
        if (Array.isArray(recs) && recs.length > 0) {
          // console.log('[RECIPES HYDRATION] Hydrating recipes from local backup storage...');
          recs.forEach(r => { if(r) allRecipeSources.push(r); });
        }
      }
    } catch(bErr) {}
  }

  // Deduplicate incoming items by recipe.id into window.state.recipes
  populateRecipesState(allRecipeSources);
  state.isCloudHydrated = true;
  window.isCloudHydrated = true;
  // console.log(`[RECIPES HYDRATION] Deterministically hydrated and deduplicated ${state.recipes.length} recipes across multi-path check.`);
  if(!window._hydrationLogged) {
    // console.log("[v3.0.7 HYDRATION]", state.recipes.length, "recipes loaded.");
    window._hydrationLogged = true;
  }

  const metaDoc = dataDocs.meta || {};
  const taxonomyDoc = dataDocs.taxonomy || {};
  const plannerDoc = dataDocs.planner || {};
  const historyDoc = dataDocs.history || {};

  state.schemaVersion = metaDoc.schemaVersion || rootData.schemaVersion || PLATEPLAN_SCHEMA_VERSION;
  state.updatedAt = rootData.updatedAt || metaDoc.updatedAt || new Date().toISOString();
  state.prefs = metaDoc.prefs || rootData.prefs || state.prefs || {};
  state.customCats = metaDoc.customCats || rootData.customCats || state.customCats || {};
  state.excluded = metaDoc.excluded || rootData.excluded || state.excluded || {};
  state.useUpProducts = metaDoc.useUpProducts || rootData.useUpProducts || state.useUpProducts || {};
  state.ignoredGroupMergeSuggestions = metaDoc.ignoredGroupMergeSuggestions || rootData.ignoredGroupMergeSuggestions || state.ignoredGroupMergeSuggestions || [];
  state.ignoredDataQualityWarnings = metaDoc.ignoredDataQualityWarnings || rootData.ignoredDataQualityWarnings || state.ignoredDataQualityWarnings || [];
  state.dataQualityDismissals = metaDoc.dataQualityDismissals || rootData.dataQualityDismissals || state.dataQualityDismissals || {};
  state.packPicks = metaDoc.packPicks || rootData.packPicks || state.packPicks || {};
  state.ingredientGroups = taxonomyDoc.ingredientGroups || rootData.ingredientGroups || state.ingredientGroups || [];
  state.ingredientFamilies = taxonomyDoc.ingredientFamilies || rootData.ingredientFamilies || state.ingredientFamilies || [];

  // 6. Resilient extraction of active plan and historical plan
  let cloudPlanDoc = null;
  let cloudHistoryDoc = null;
  try {
    const pSnap = await householdDocRef.collection('plans').doc('current').get();
    if (pSnap && pSnap.exists) cloudPlanDoc = pSnap.data() || {};
  } catch(_pErr) {}
  try {
    const hSnap = await householdDocRef.collection('plans').doc('history').get();
    if (hSnap && hSnap.exists) cloudHistoryDoc = hSnap.data() || {};
  } catch(_hErr) {}

  function extractPlanCandidate(candidates) {
    for (const c of candidates) {
      if (!c) continue;
      const unwrapped = (c.value !== undefined) ? c.value : ((c.plan !== undefined) ? c.plan : c);
      if (unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped)) {
        if (Object.keys(unwrapped).length > 0) return unwrapped;
      }
    }
    return null;
  }

  function extractPlanHistoryCandidate(candidates) {
    for (const c of candidates) {
      if (!c) continue;
      const unwrapped = (c.value !== undefined) ? c.value : ((c.planHistory !== undefined) ? c.planHistory : c);
      if (Array.isArray(unwrapped) && unwrapped.length > 0) return unwrapped;
      if (unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped)) {
        const arr = Object.values(unwrapped);
        if (arr.length > 0 && arr.some(item => item && typeof item === 'object')) return arr;
      }
    }
    return null;
  }

  let localPlanBackup = null;
  let localHistoryBackup = null;
  let recoveryPointPlan = null;
  let recoveryPointHistory = null;
  try {
    const rawP = localStorage.getItem('plateplan_plan_backup');
    if (rawP) localPlanBackup = JSON.parse(rawP);
  } catch(_e) {}
  try {
    const rawH = localStorage.getItem('plateplan_history_v2') || localStorage.getItem('plateplan_history_backup');
    if (rawH) localHistoryBackup = JSON.parse(rawH);
  } catch(_e) {}
  try {
    const recList = JSON.parse(localStorage.getItem(RECOVERY_SK) || '[]');
    if (Array.isArray(recList)) {
      for (const pt of recList) {
        if (!recoveryPointPlan && pt?.state?.plan && typeof pt.state.plan === 'object' && Object.keys(pt.state.plan).length > 0) {
          recoveryPointPlan = pt.state.plan;
        }
        if (!recoveryPointHistory && Array.isArray(pt?.state?.planHistory) && pt.state.planHistory.length > 0) {
          recoveryPointHistory = pt.state.planHistory;
        }
      }
    }
  } catch(_e) {}

  const resolvedPlan = extractPlanCandidate([
    cloudPlanDoc,
    plannerDoc.plan,
    rootData.plan,
    dataDocs.state?.state?.plan,
    dataDocs.state?.plan,
    state.plan,
    localPlanBackup,
    recoveryPointPlan
  ]) || {};

  const resolvedHistory = extractPlanHistoryCandidate([
    cloudHistoryDoc,
    historyDoc.planHistory,
    rootData.planHistory,
    dataDocs.state?.state?.planHistory,
    dataDocs.state?.planHistory,
    state.planHistory,
    localHistoryBackup,
    recoveryPointHistory
  ]) || [];

    state.plan = resolvedPlan;
    state.overrides = plannerDoc.overrides || rootData.overrides || state.overrides || {};
    state.planHistory = resolvedHistory;

    if(resolvedPlan && typeof resolvedPlan === 'object' && Object.keys(resolvedPlan).length > 0){
      safeLocalStorageSet('plateplan_plan_backup', sanitizePlanForFirestore(resolvedPlan));
    }
    if(Array.isArray(resolvedHistory) && resolvedHistory.length > 0){
      safeSaveHistoryBackup(resolvedHistory);
    }

    state.meta = {
      ...(rootData.meta || {}),
      ...(metaDoc.meta || {}),
      householdId: targetHouseholdId
    };

    safeLocalStorageSet(SK, safeJsonStringify(state));
    safeLocalStorageSet('plateplan_offline_backup', safeJsonStringify(state.ingredients));

    window.state = state;
    window.appState = state;
    platePlanCloudReady = true;

    setPlatePlanStartupInert(false);
    rebuildPlatePlanIndexes();
    renderAll();
    runDataQualityAudits();

    startPlatePlanCloudListeners();
    updatePlatePlanSyncStatus('synced');
  } catch(err) {
    console.error('[loadSharedPlatePlan] Error applying state:', err);
  } finally {
    isHydrating = false;
    window.isHydrating = false;
    lastPersistedStateJson = safeJsonStringify(state);
  }
}

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
  if(!platePlanCloudUser){
    return showPlatePlanAuthScreen();
  }
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

window.clearPlatePlanSyncOutbox=clearPlatePlanSyncOutbox;
window.openPlatePlanSyncPanel=openPlatePlanSyncPanel;
window.forcePushPlatePlanToCloud=forcePushPlatePlanToCloud;
window.pushStateToCloud=pushStateToCloud;
window.signOutPlatePlan=signOutPlatePlan;
window.loadSharedPlatePlan=loadSharedPlatePlan;

async function startPlatePlanForSignedInUser(user){
  platePlanCloudUser=user;
  if (typeof window !== 'undefined') window.platePlanCloudUser = user;
  const userEl=document.getElementById('sync-user');
  if(userEl) userEl.textContent=user.email||'';
  hidePlatePlanAuthScreen();
  updatePlatePlanSyncStatus('connecting');
  try{
    const config=window.PLATEPLAN_FIREBASE||{};
    const householdId=config.householdId || 'elliott-chloe';
    window.activeHouseholdId = householdId;
    window.activeHousehold = { id: householdId };
    if (typeof state === 'undefined' || !state) {
      if (typeof window !== 'undefined') {
        window.state = window.state || {};
        state = window.state;
      }
    }
    if (typeof state !== 'undefined' && state) {
      if (!state.meta) state.meta = {};
      state.meta.householdId = householdId;
    }
    const root=platePlanDb.collection('households').doc(householdId);
    
    // Automatically record / ensure member is registered so no device is ever locked out
    await root.collection('members').doc(user.uid).set({
      email: user.email||'',
      lastActive: firebase.firestore.FieldValue.serverTimestamp(),
      role: 'member'
    },{merge:true}).catch(err=>console.info('Member heartbeat noted:',err));

    await loadSharedPlatePlan();
  }catch(error){
    console.warn('PlatePlan cloud startup error:',error);
    updatePlatePlanSyncStatus('error',error.message);
    setPlatePlanStartupInert(false);
    renderAll();
  }
}

let cloudSyncInitialized=false;
function initPlatePlanCloudSync(){
  try { bindTopBarActionListeners(); } catch(e) {}
  const settings=window.PLATEPLAN_FIREBASE||{};
  if(!settings.configured){ updatePlatePlanSyncStatus('local','Add Firebase configuration to enable shared sync'); setPlatePlanStartupInert(false); return; }
  if(!window.firebase){ updatePlatePlanSyncStatus('error','Firebase scripts did not load'); setPlatePlanStartupInert(false); return; }
  try{
    platePlanFirebaseApp=firebase.apps.length?firebase.app():firebase.initializeApp(settings.config);
    platePlanAuth=firebase.auth();
    platePlanDb=firebase.firestore();
    if (typeof window !== 'undefined') {
      window.platePlanDb = platePlanDb;
      window.db = platePlanDb;
      window.platePlanAuth = platePlanAuth;
      window.auth = platePlanAuth;
    }
    platePlanAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    if (!cloudSyncInitialized) {
      cloudSyncInitialized = true;
      platePlanAuth.onAuthStateChanged(user=>{
        if(user) {
          const config=window.PLATEPLAN_FIREBASE||{};
          const householdId=config.householdId || 'elliott-chloe';
          window.activeHouseholdId = householdId;
          window.activeHousehold = { id: householdId };
          if (typeof state === 'undefined' || !state) {
            if (typeof window !== 'undefined') {
              window.state = window.state || {};
              state = window.state;
            }
          }
          if (typeof state !== 'undefined' && state) {
            if (!state.meta) state.meta = {};
            state.meta.householdId = householdId;
          }
          startPlatePlanForSignedInUser(user);
        } else {
          // Attempt anonymous sign-in fallback for instant Firestore connectivity
          platePlanAuth.signInAnonymously().catch(err => {
            console.info('Anonymous sign-in fallback:', err.message);
            platePlanCloudUser=null; platePlanCloudReady=false;
            const userEl = document.getElementById('sync-user');
            if (userEl) userEl.textContent='';
            updatePlatePlanSyncStatus('local','Sign in for cloud sync');
            setPlatePlanStartupInert(false);
          });
        }
      }, error => {
        console.warn('onAuthStateChanged error:', error);
        updatePlatePlanSyncStatus('error', error.message);
        setPlatePlanStartupInert(false);
      });
    }
  }catch(error){
    updatePlatePlanSyncStatus('error',error.message);
    setPlatePlanStartupInert(false);
  }
}

  window.PlatePlanCloud = {
    pushStateToCloud,
    initPlatePlanCloudSync,
    loadSharedPlatePlan,
    saveState,
    renderAll,
    saveIngredient,
    addIngredient,
    deleteIngredient,
    saveRecipe,
    deleteRecipeFromCloud,
    updateIngredientMappingGlobal,
    executeDataQualityTransaction,
    capturePlatePlanEditBaseline,
    getPlatePlanDeviceId,
    getPlatePlanSyncOutbox,
    setPlatePlanSyncOutbox,
    cleanCloudValue,
    syncValuesEqual,
    platePlanStateProjection,
    getPlatePlanHouseholdId,
    getHouseholdDocRef,
    getPlatePlanDataCollection,
    platePlanCloudRef,
    persistPlatePlanDataQualityFix,
    rehydrateActiveRecipeAndStateCache,
    createSafeStateSnapshot,
    queuePlatePlanCloudDiff,
    schedulePlatePlanCloudDiff,
    flushPlatePlanSyncOutbox,
    updatePlatePlanSyncStatus,
    setPlatePlanSyncPathValue,
    reconcilePlatePlanState,
    applyRemoteCloudState,
    applyPlatePlanProjectionRecord,
    applyPlatePlanProjection,
    loadStateFromObject,
    readPlatePlanCloudProjection,
    populateIngredientsState,
    populateRecipesState,
    performSubcollectionMigrationIfNeeded,
    startPlatePlanCloudListeners,
    getPlatePlanMigrationCounts,
    ensurePlatePlanMigrationModal,
    ensurePlatePlanAuthScreen,
    dismissPlatePlanAuthScreen,
    setPlatePlanStartupInert,
    showPlatePlanAuthScreen,
    hidePlatePlanAuthScreen,
    signInPlatePlanWithGoogle,
    signInPlatePlan,
    resetPlatePlanPassword,
    signOutPlatePlan,
    clearPlatePlanSyncOutbox,
    forcePushPlatePlanToCloud,
    openPlatePlanSyncPanel,
    startPlatePlanForSignedInUser,
    sanitizePayloadForFirestore,
    unwrapAndCleanItem,
    sanitizePlanForFirestore,
    sanitizeRecipeForFirestore,
    sanitizeIngredientForFirestore,
    cleanObject,
    safeLocalStorageSet,
    safeSaveHistoryBackup,
    get platePlanDb() { return platePlanDb; },
    get platePlanAuth() { return platePlanAuth; }
  };

  if (typeof window !== 'undefined') {
    Object.assign(window, window.PlatePlanCloud);
    // Explicitly preserve PlatePlanState authoritative sanitization methods to prevent proxy/alias loops
    if (window.PlatePlanState) {
      if (typeof window.PlatePlanState.sanitizePayloadForFirestore === 'function') {
        window.sanitizePayloadForFirestore = window.PlatePlanState.sanitizePayloadForFirestore;
      }
      if (typeof window.PlatePlanState.sanitizePlanForFirestore === 'function') {
        window.sanitizePlanForFirestore = window.PlatePlanState.sanitizePlanForFirestore;
      }
      if (typeof window.PlatePlanState.sanitizeRecipeForFirestore === 'function') {
        window.sanitizeRecipeForFirestore = window.PlatePlanState.sanitizeRecipeForFirestore;
      }
      if (typeof window.PlatePlanState.sanitizeIngredientForFirestore === 'function') {
        window.sanitizeIngredientForFirestore = window.PlatePlanState.sanitizeIngredientForFirestore;
      }
      if (typeof window.PlatePlanState.unwrapAndCleanItem === 'function') {
        window.unwrapAndCleanItem = window.PlatePlanState.unwrapAndCleanItem;
      }
      if (typeof window.PlatePlanState.cleanObject === 'function') {
        window.cleanObject = window.PlatePlanState.cleanObject;
      }
      if (typeof window.PlatePlanState.safeLocalStorageSet === 'function') {
        window.safeLocalStorageSet = window.PlatePlanState.safeLocalStorageSet;
      }
      if (typeof window.PlatePlanState.safeSaveHistoryBackup === 'function') {
        window.safeSaveHistoryBackup = window.PlatePlanState.safeSaveHistoryBackup;
      }
    }
    window.initPlatePlanCloudSync = initPlatePlanCloudSync;
    window.pushStateToCloud = pushStateToCloud;
    window.saveState = saveState;
    window.loadSharedPlatePlan = loadSharedPlatePlan;
    window.safeLocalStorageSet = window.safeLocalStorageSet || safeLocalStorageSet;
    window.safeSaveHistoryBackup = window.safeSaveHistoryBackup || safeSaveHistoryBackup;
  }

  if (typeof window !== 'undefined' && window.firebase && window.PLATEPLAN_FIREBASE) {
    initPlatePlanCloudSync();
  }
})();
