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
              const bytes = res.sizeBytes ?? res.bytes ?? res.size ?? 0;
              const msg = bytes > 0 ? `${(bytes / 1024).toFixed(2)} KB` : 'Successfully';
              console.log(`[Maintenance] Preferences cleaned: ${msg}.`);
            }
          }
        }
      } catch (e) {
        console.warn('[Maintenance] cleanPreferencesBloat failed:', e);
      }
    }

    if (typeof window !== 'undefined' && typeof window.sweepAndRecalibrateIngredientDefaults === 'function') {
      try {
        const recalibratedCount = await window.sweepAndRecalibrateIngredientDefaults();
        if (recalibratedCount > 0) {
          const { recalculateAllRecipeMacros } = await import('./MaintenanceService.js');
          if (typeof recalculateAllRecipeMacros === 'function') {
            await recalculateAllRecipeMacros({ forceAll: false });
          }
        }
      } catch (e) {
        console.warn('[Maintenance] sweepAndRecalibrateIngredientDefaults failed:', e);
      }
    }

    try {
      const { migrateLegacyRecipeProductBindings } = await import('./MaintenanceService.js');
      if (typeof migrateLegacyRecipeProductBindings === 'function') {
        await migrateLegacyRecipeProductBindings();
      }
    } catch (e) {
      console.warn('[Maintenance] migrateLegacyRecipeProductBindings failed:', e);
    }

    // Scrub products with kJ stored as calories
    if (typeof window !== 'undefined' && window.Store?.getState) {
      try {
        const storeState = window.Store.getState() || {};
        const prods = Array.isArray(storeState.products) ? storeState.products : [];
        const { normalizeEnergyKcal } = await import('./NutritionService.js');
        const { saveProduct } = await import('./ProductRepository.js');
        const { setProducts } = await import('../store/store.js');

        let scrubCount = 0;
        const scrubbedProds = prods.map(p => {
          if (!p || typeof p !== 'object') return p;
          const rawCal = Number(p.cal ?? p.kcal ?? 0);
          const prot = Number(p.prot ?? p.protein ?? 0);
          const carb = Number(p.carb ?? p.carbs ?? 0);
          const fat = Number(p.fat ?? 0);
          const fibre = Number(p.fibre ?? p.fiber ?? 0);
          const cleanCal = normalizeEnergyKcal(rawCal, prot, carb, fat, fibre);
          if (cleanCal > 0 && cleanCal !== rawCal) {
            scrubCount++;
            return { ...p, cal: cleanCal, kcal: cleanCal, updatedAt: new Date().toISOString() };
          }
          return p;
        });

        if (scrubCount > 0) {
          setProducts(scrubbedProds);
          for (const p of scrubbedProds) {
            const orig = prods.find(o => String(o.id) === String(p.id));
            if (orig && p.cal !== orig.cal) {
              await saveProduct(p);
            }
          }
          console.log(`[Maintenance] Successfully corrected energy units (kJ -> kcal) for ${scrubCount} products.`);
        }
      } catch (err) {
        console.warn('[Maintenance] Product energy scrub error:', err);
      }
    }
  } catch (err) {
    console.warn('[Maintenance] Deferred maintenance skipped:', err);
  }
}
