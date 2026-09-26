/**
 * scripts/services/cloud-hydrate-pull.js
 * Firestore document fetch routines and non-blocking background hydration.
 */
  window.pullCloudHydrate = function() {
    const cloud = window.PlatePlanCloud;
    const state = cloud?.State;
    if (!state || state.isHydrating) return Promise.resolve();

    // 1. Instant Local Cache Hydration into Domain Namespaces (Non-Blocking UI Render)
    try {
      const cachedRecipes = JSON.parse(localStorage.getItem('plateplan_recipes') || '[]');
      const cachedIngredients = JSON.parse(localStorage.getItem('plateplan_ingredients') || '[]');
      const cachedSettings = JSON.parse(localStorage.getItem('plateplan_prefs') || '{}');
      const cachedPlan = JSON.parse(localStorage.getItem('plateplan_current_plan') || '{}');

      window.PlatePlanRecipes = window.PlatePlanRecipes || {};
      window.PlatePlanRecipes.State = window.PlatePlanRecipes.State || {};
      if (cachedRecipes.length > 0) window.PlatePlanRecipes.State.recipes = cachedRecipes;

      window.PlatePlanBank = window.PlatePlanBank || {};
      window.PlatePlanBank.State = window.PlatePlanBank.State || {};
      if (cachedIngredients.length > 0) window.PlatePlanBank.State.ingredients = cachedIngredients;

      window.PlatePlanIngredientBank = window.PlatePlanIngredientBank || {};
      window.PlatePlanIngredientBank.State = window.PlatePlanIngredientBank.State || {};
      if (cachedIngredients.length > 0) window.PlatePlanIngredientBank.State.ingredients = cachedIngredients;

      window.PlatePlanCloud = window.PlatePlanCloud || {};
      window.PlatePlanCloud.State = window.PlatePlanCloud.State || {};
      if (Object.keys(cachedSettings).length > 0) window.PlatePlanCloud.State.settings = cachedSettings;

      if (window.state) {
        if (cachedRecipes.length > 0 && !window.state.recipes?.length) window.state.recipes = cachedRecipes;
        if (cachedIngredients.length > 0 && !window.state.ingredients?.length) window.state.ingredients = cachedIngredients;
        if (Object.keys(cachedSettings).length > 0) window.state.prefs = cachedSettings;
        if (Object.keys(cachedPlan).length > 0 && !window.state.plan?.slots) window.state.plan = cachedPlan;
      }

      // Trigger immediate UI renders from local cache
      if (typeof window.PlatePlanRecipes?.renderVault === 'function') window.PlatePlanRecipes.renderVault();
      else if (typeof window.renderVault === 'function') window.renderVault();

      if (typeof window.PlatePlanIngredientBank?.renderProductBank === 'function') window.PlatePlanIngredientBank.renderProductBank();
      else if (typeof window.renderBank === 'function') window.renderBank();

      if (typeof window.PlatePlanSettings?.renderPreferences === 'function') window.PlatePlanSettings.renderPreferences();
      else if (typeof window.renderPreferences === 'function') window.renderPreferences();

      if (typeof window.renderMealPlannerWizard === 'function') window.renderMealPlannerWizard();
      if (typeof window.renderPlannerView === 'function') window.renderPlannerView();
    } catch (err) {
      console.warn('[CloudHydrate] Local initial render warning:', err);
    }

    state.isHydrating = true;
    window.syncStatus = 'pending';

    // 2. Asynchronous Background Firestore Fetch (Does NOT block UI thread)
    const pullTask = (async () => {
      try {
        console.log('[CloudHydrate] Starting background pull from Firestore...');
        const refs = cloud.Refs;

        const planRef = refs.getPlanDoc();
        const settingsRef = refs.getSettingsDoc();
        const recipesRef = refs.getRecipesColl();
        const ingredientsRef = refs.getIngredientsColl();

        const [planDoc, settingsDoc, recipesSnap, ingredientsSnap] = await Promise.all([
          planRef.get(),
          settingsRef.get(),
          recipesRef.get(),
          ingredientsRef.get()
        ]);

        console.log('[Diagnostic] Raw planDoc exists:', planDoc.exists);
        console.log('[Diagnostic] Raw settingsDoc exists:', settingsDoc.exists);
        console.log('[Diagnostic] Raw recipes count:', recipesSnap.docs.length);
        console.log('[Diagnostic] Raw ingredients count:', ingredientsSnap.docs.length);

        // Print sample IDs to verify we are querying the correct household path
        if (recipesSnap.docs.length > 0) {
          console.log('[Diagnostic] Sample recipe IDs:', recipesSnap.docs.slice(0, 3).map(d => d.id));
        }
        if (ingredientsSnap.docs.length > 0) {
          console.log('[Diagnostic] Sample ingredient IDs:', ingredientsSnap.docs.slice(0, 3).map(d => d.id));
        }

        const remoteData = {
          plan: planDoc.exists ? planDoc.data() : null,
          settings: settingsDoc.exists ? settingsDoc.data() : null,
          recipes: recipesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          ingredients: ingredientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        };

        if (typeof window.mergeCloudState === 'function') {
          await window.mergeCloudState(remoteData);
        }

        state.isCloudHydrated = true;
        window.syncStatus = 'synced';
        state.lastSyncedAt = Date.now();
      } catch (e) {
        console.error('[CloudHydrate] Background pull failed:', e);
        window.syncStatus = 'error';
        state.lastSyncError = e.message;
      } finally {
        state.isHydrating = false;
        state.isSyncing = false;
      }
    })();

    return pullTask;
  };

  window.isCloudHydrated = function() {
    return Boolean(window.PlatePlanCloud?.State?.isCloudHydrated);
  };
