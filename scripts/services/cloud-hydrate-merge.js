/**
 * scripts/services/cloud-hydrate-merge.js
 * State reconciliation, conflict resolution, and local hydration.
 */
  window.mergeCloudState = async function(remoteData) {
    if (!remoteData) return;

    console.log('[CloudMerge] Merging remote data...');

    // Simple strategy: remote wins if it exists, but we could be smarter
    if (remoteData.settings) {
      localStorage.setItem('plateplan_prefs', JSON.stringify(remoteData.settings));
    }

    if (remoteData.plan) {
      localStorage.setItem('plateplan_current_plan', JSON.stringify(remoteData.plan));
    }

    if (remoteData.recipes && remoteData.recipes.length > 0) {
      localStorage.setItem('plateplan_recipes', JSON.stringify(remoteData.recipes));
    }

    if (remoteData.ingredients && remoteData.ingredients.length > 0) {
      localStorage.setItem('plateplan_ingredients', JSON.stringify(remoteData.ingredients));
    }

    console.log('[CloudMerge] Local storage updated from cloud.');
    
    // Trigger app re-render if possible
    if (typeof window.refreshPlatePlanDerivedState === 'function') {
      await window.refreshPlatePlanDerivedState();
    }
    
    if (typeof window.renderAll === 'function') {
      window.renderAll();
    }
  };
