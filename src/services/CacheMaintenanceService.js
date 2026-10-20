/**
 * src/services/CacheMaintenanceService.js (v3.38.5)
 * Handles background preference bloat cleaning and maintenance routines.
 */

export async function runDeferredMaintenance(preferencesData, mergedCategories, mutated, saveCategoriesFn) {
  try {
    const authInstance = (typeof window !== 'undefined' && window.firebase && typeof window.firebase.auth === 'function')
      ? window.firebase.auth()
      : null;

    if (!authInstance || !authInstance.currentUser) {
      console.warn('[Maintenance] Deferred maintenance skipped: unauthenticated session.');
      return;
    }

    if (mutated && Array.isArray(mergedCategories) && typeof saveCategoriesFn === 'function') {
      try {
        await saveCategoriesFn(mergedCategories);
      } catch (err) {
        console.warn('[Maintenance] Deferred saveCategories error:', err);
      }
    }

    if (preferencesData) {
      try {
        const originalSize = JSON.stringify(preferencesData).length;
        const hasLegacyKeys = Boolean(
          preferencesData.ingredientFamilies !== undefined ||
          (preferencesData.userPrefs && (
            preferencesData.userPrefs.planHistory !== undefined ||
            preferencesData.userPrefs.ingredientGroups !== undefined ||
            preferencesData.userPrefs.ingredientFamilies !== undefined
          ))
        );

        if (hasLegacyKeys || originalSize > 50 * 1024) {
          console.log(`[Maintenance] Stale/bloated preferences detected (${(originalSize / 1024).toFixed(2)} KB). Running deferred clean...`);
          const repo = await import('./HouseholdRepository.js');
          if (typeof repo.cleanPreferencesBloat === 'function') {
            const res = await repo.cleanPreferencesBloat();
            if (res && res.success) {
              console.log(`[Maintenance] Preferences cleaned: ${(res.sizeBytes / 1024).toFixed(2)} KB.`);
            }
          }
        }
      } catch (e) {
        console.warn('[Maintenance] cleanPreferencesBloat failed:', e);
      }
    }

    if (typeof window !== 'undefined' && typeof window.sweepAndRecalibrateIngredientDefaults === 'function') {
      try {
        await window.sweepAndRecalibrateIngredientDefaults();
      } catch (e) {
        console.warn('[Maintenance] sweepAndRecalibrateIngredientDefaults failed:', e);
      }
    }
  } catch (err) {
    console.warn('[Maintenance] Deferred maintenance skipped:', err);
  }
}
