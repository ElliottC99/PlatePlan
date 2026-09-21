/**
 * PlatePlan v3.3.5 - Modular Firebase & Cloud Sync Service
 */

let firebaseApp = null;
let db = null;
let auth = null;
let unsubscribeRecipes = null;
let unsubscribeProducts = null;
let unsubscribePlans = null;
let currentHouseholdId = 'elliott-chloe';
let isSyncing = false;
let connectionStatus = 'disconnected';

function updateConnectionBadge(status, text) {
  connectionStatus = status;
  if (typeof window !== 'undefined') {
    window.platePlanConnectionStatus = status;
    window.dispatchEvent(new CustomEvent('plateplan:connection-status', { detail: { status, text } }));
    const statusBtn = document.getElementById('sync-status');
    if (statusBtn) {
      statusBtn.textContent = text;
      statusBtn.dataset.status = status === 'synced' ? 'synced' : 'local';
    }
    const badge = document.getElementById('sync-status-badge') || document.querySelector('.sync-badge') || document.getElementById('connection-badge');
    if (badge) {
      badge.textContent = text;
      badge.dataset.status = status;
      badge.className = `sync-badge status-${status}`;
    }
  }
}

export function initFirebaseService() {
  if (firebaseApp) return { db, auth, app: firebaseApp };

  try {
    const configObj = window.PLATEPLAN_FIREBASE?.config;
    currentHouseholdId = window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
    window.activeHouseholdId = currentHouseholdId;

    if (!window.firebase || !configObj) {
      console.warn('[Firebase] Firebase SDK or config missing. Running in local-only mode.');
      updateConnectionBadge('local-only', 'Local Only');
      return null;
    }

    if (!window.firebase.apps.length) {
      firebaseApp = window.firebase.initializeApp(configObj);
    } else {
      firebaseApp = window.firebase.app();
    }

    db = window.firebase.firestore(firebaseApp);
    auth = window.firebase.auth(firebaseApp);
    window.platePlanDb = db;
    window.platePlanAuth = auth;

    updateConnectionBadge('connecting', 'Connecting...');

    auth.onAuthStateChanged(user => {
      if (user) {
        console.log('[Firebase] User authenticated:', user.email || user.uid);
        updateConnectionBadge('synced', 'Synced');
        startCloudSyncListeners();
      } else {
        console.log('[Firebase] No authenticated user. Attempting anonymous sign-in...');
        auth.signInAnonymously().catch(err => {
          console.warn('[Firebase] Anonymous sign-in failed:', err);
          updateConnectionBadge('local-only', 'Local Only');
        });
      }
    });

    return { db, auth, app: firebaseApp };
  } catch (err) {
    console.error('[Firebase] Initialization error:', err);
    updateConnectionBadge('local-only', 'Local Only');
    return null;
  }
}

export function startCloudSyncListeners() {
  if (!db) return;
  const householdDocRef = db.collection('households').doc(currentHouseholdId);

  if (unsubscribeRecipes) { unsubscribeRecipes(); unsubscribeRecipes = null; }
  if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; }
  if (unsubscribePlans) { unsubscribePlans(); unsubscribePlans = null; }

  householdDocRef.onSnapshot(doc => {
    if (!doc.exists) return;
    const data = doc.data();
    if (!data) return;

    if (window.state && data.plan) {
      const localTime = window.state.plan?.updatedAt ? new Date(window.state.plan.updatedAt).getTime() : 0;
      const cloudTime = data.plan?.updatedAt ? new Date(data.plan.updatedAt).getTime() : 0;
      if (cloudTime > localTime) {
        window.state.plan = data.plan;
        if (typeof window.localStorage !== 'undefined') {
          localStorage.setItem('plateplan_v2', JSON.stringify(window.state));
        }
        window.dispatchEvent(new CustomEvent('plateplan:remote-state-applied', { detail: { source: 'household-doc' } }));
        if (typeof window.renderAll === 'function') window.renderAll();
      }
    }
  }, err => {
    console.error('[Firebase] Household listener error:', err);
  });

  unsubscribeRecipes = householdDocRef.collection('recipes').onSnapshot(snapshot => {
    if (snapshot.empty) return;
    const cloudRecipes = [];
    snapshot.forEach(doc => {
      cloudRecipes.push({ id: doc.id, ...doc.data() });
    });

    if (window.state && window.PlatePlanModules?.store) {
      const merged = window.PlatePlanModules.store.mergeRecipesSnapshot(window.state.recipes, cloudRecipes);
      window.state.recipes = merged;
      if (typeof window.localStorage !== 'undefined') {
        localStorage.setItem('plateplan_v2', JSON.stringify(window.state));
      }
      window.dispatchEvent(new CustomEvent('plateplan:remote-state-applied', { detail: { source: 'recipes-collection' } }));
      if (typeof window.renderAll === 'function') window.renderAll();
    }
  }, err => {
    console.error('[Firebase] Recipes listener error:', err);
  });

  unsubscribePlans = householdDocRef.collection('plans').onSnapshot(snapshot => {
    if (snapshot.empty) {
      if (!window.state?.plans || window.state.plans.length === 0) {
        // Fallback to local storage if available
        try {
          const cached = localStorage.getItem('plateplan_v2');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed.plans) && parsed.plans.length > 0) {
              window.state.plans = parsed.plans;
            }
          }
        } catch (e) {}
      }
      console.log('[Firebase] Plans synced:', window.state?.plans?.length || 0);
      return;
    }
    const cloudPlans = [];
    snapshot.forEach(doc => {
      cloudPlans.push({ id: doc.id, ...doc.data() });
    });

    if (window.state) {
      if (cloudPlans.length > 0) {
        window.state.plans = cloudPlans;
      }
      console.log('[Firebase] Plans synced:', window.state.plans?.length);
      if (typeof window.localStorage !== 'undefined') {
        localStorage.setItem('plateplan_v2', JSON.stringify(window.state));
      }
      window.dispatchEvent(new CustomEvent('plateplan:remote-state-applied', { detail: { source: 'plans-collection' } }));
      if (Array.isArray(window.plateplanSubscribers)) {
        window.plateplanSubscribers.forEach(cb => {
          try { cb(window.state); } catch (e) {}
        });
      }
      if (typeof window.renderAll === 'function') window.renderAll();
    }
  }, err => {
    console.error('[Firebase] Plans listener error:', err);
  });

  unsubscribeProducts = householdDocRef.collection('products').onSnapshot(snapshot => {
    if (snapshot.empty) return;
    const cloudProducts = [];
    snapshot.forEach(doc => {
      cloudProducts.push({ id: doc.id, ...doc.data() });
    });

    if (window.state) {
      window.state.products = cloudProducts;
      if (typeof window.localStorage !== 'undefined') {
        localStorage.setItem('plateplan_v2', JSON.stringify(window.state));
      }
      window.dispatchEvent(new CustomEvent('plateplan:remote-state-applied', { detail: { source: 'products-collection' } }));
    }
  }, err => {
    console.error('[Firebase] Products listener error:', err);
  });

  updateConnectionBadge('synced', 'Synced');
}

export async function pushStateToCloud(force = false) {
  if (!db || isSyncing) return false;
  if (!window.state) return false;

  isSyncing = true;
  try {
    const householdDocRef = db.collection('households').doc(currentHouseholdId);
    
    await householdDocRef.set({
      updatedAt: new Date().toISOString(),
      plan: window.state.plan || {},
      meta: window.state.meta || {}
    }, { merge: true });

    if (Array.isArray(window.state.recipes)) {
      const batch = db.batch();
      window.state.recipes.forEach(recipe => {
        if (recipe && recipe.id) {
          const ref = householdDocRef.collection('recipes').doc(String(recipe.id));
          batch.set(ref, { ...recipe, updatedAt: recipe.updatedAt || new Date().toISOString() }, { merge: true });
        }
      });
      await batch.commit();
    }

    if (Array.isArray(window.state.products)) {
      const batch = db.batch();
      window.state.products.forEach(prod => {
        if (prod && (prod.id || prod.barcode)) {
          const docId = String(prod.id || prod.barcode);
          const ref = householdDocRef.collection('products').doc(docId);
          batch.set(ref, { ...prod, updatedAt: prod.updatedAt || new Date().toISOString() }, { merge: true });
        }
      });
      await batch.commit();
    }

    if (Array.isArray(window.state.plans)) {
      const batch = db.batch();
      window.state.plans.forEach(plan => {
        if (plan && (plan.id || plan.planId)) {
          const docId = String(plan.id || plan.planId);
          const ref = householdDocRef.collection('plans').doc(docId);
          batch.set(ref, { ...plan, updatedAt: plan.updatedAt || new Date().toISOString() }, { merge: true });
        }
      });
      await batch.commit();
    }

    updateConnectionBadge('synced', 'Synced');
    isSyncing = false;
    return true;
  } catch (err) {
    console.error('[Firebase] pushStateToCloud error:', err);
    updateConnectionBadge('local-only', 'Local Only');
    isSyncing = false;
    return false;
  }
}
