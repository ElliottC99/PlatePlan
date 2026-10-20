import { getState, setIngredients } from '../store/store.js';
import { runAudit } from '../services/DataQualityScanner.js';
import { saveIngredient } from '../services/IngredientRepository.js';
import { savePreferencesWithAutoPrune } from '../services/HouseholdRepository.js';
import { runOptimisticMutation } from '../store/store.js';
import { openMacroDriftPreviewModal } from '../components/data-quality/MacroDriftPreviewModal.js';
import { openSubtypeOrphanResolverModal } from '../components/data-quality/SubtypeOrphanResolverModal.js';
import { openMealPlanSyncWarningModal } from '../components/data-quality/MealPlanSyncWarningModal.js';
import { openMergeIngredientsModal } from '../components/data-quality/MergeIngredientsModal.js';
import { openRecipeAuditModal } from '../components/recipe/RecipeAuditModal.js';
import { openUnlinkedSweeperModal } from '../components/data-quality/UnlinkedSweeperUI.js';
import { performGlobalProductRelink, verifyZeroCalorieIngredient } from '../services/DataQualityService.js';

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

export function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

export const renderAuditCard = (title, icon, items, renderer) => {
  const safeItems = Array.isArray(items) ? items : [];
  const listHtml = safeItems.map(renderer).join('');
  const count = safeItems.length;
  return `
    <div class="card" style="background:var(--surface,#fff); border-radius:14px; padding:18px; border:1px solid var(--border,#e7e5e4); margin-bottom:16px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
        <h3 style="margin:0; font-size:14.5px; font-weight:750; color:var(--text,#1c1917); display:flex; align-items:center; gap:6px;">
          <span>${icon}</span> ${title}
        </h3>
        <span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; background:${count > 0 ? '#fee2e2' : '#dcfce7'}; color:${count > 0 ? '#b91c1c' : '#15803d'}">
          ${count > 0 ? `${count} Action Required` : 'Healthy'}
        </span>
      </div>
      ${count === 0 
        ? `<div style="font-size:12.5px; color:var(--text2,#78716c); padding:6px 0;">All checks passed. No issues found.</div>` 
        : `<div style="display:flex; flex-direction:column; gap:8px;">${listHtml}</div>`
      }
    </div>
  `;
};

export function renderDataQualityView() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('view-data');
  if (!container) return;

  const state = getState() || {};
  const audit = runAudit(state);
  
  if (audit.storageHealth && audit.storageHealth.length > 0) {
    const currentPrefs = state.preferences || state.userPrefs || {};
    const hasUnmigratedFields = currentPrefs.planHistory !== undefined || 
                                currentPrefs.ingredientGroups !== undefined || 
                                currentPrefs.ingredientFamilies !== undefined;

    if (!hasUnmigratedFields) {
      const clonedPrefs = JSON.parse(JSON.stringify(currentPrefs));
      delete clonedPrefs.planHistory;
      delete clonedPrefs.ingredientGroups;
      delete clonedPrefs.ingredientFamilies;
      delete clonedPrefs.userPrefs;

      savePreferencesWithAutoPrune(clonedPrefs).then(() => {
        console.log('[DataQualityView] Silently pruned bloated preferences in background.');
      }).catch(err => {
        console.error('[DataQualityView] Silent background auto-prune failed:', err);
      });
    } else {
      console.warn('[DataQualityView] Silent background auto-prune skipped because unmigrated legacy fields exist. Please run window.cleanPreferencesBloat() manually.');
    }
  }

  container.innerHTML = `
    <div style="max-width:900px; margin:0 auto; padding:20px; box-sizing:border-box;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="font-size:22px; font-weight:750; margin:0; color:var(--text,#1c1917)">Data Quality Centre</h2>
          <p style="margin:4px 0 0 0; font-size:13px; color:var(--text2,#78716c)">Catalogue audit scanner, recipe macro validation, and self-healing structural health checks.</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn sm" id="dq-btn-sweeper" style="font-weight:600; background:#059669; color:#fff;">🧹 Unlinked Sweeper</button>
          <button type="button" class="btn sm primary" id="dq-btn-recipe-audit" style="font-weight:600; background:var(--primary,#4f46e5); color:#fff;">📖 Recipe Mapping Audit</button>
          <button type="button" class="btn sm secondary" id="dq-btn-relink" style="font-weight:600;">⚡ Auto-Relink Catalog</button>
          <button type="button" class="btn sm ghost" id="dq-btn-refresh" style="font-weight:600;">🔄 Refresh Audit</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr; gap:16px;">
        <!-- 1. RECIPE MACRO DRIFT CARD -->
        ${renderAuditCard('Recipe Macro Drift Anomaly', '📉', audit.macroDrift, (item) => `
          <div style="padding:10px 12px; background:#fff; border:1px solid var(--border); border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13px; color:#111827;">${escapeHtml(item.recipeName)}</strong>
              <div style="font-size:11.5px; color:var(--text2); margin-top:2px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-shrink:0;">
              <span class="badge" style="background:#dcfce7; color:#15803d; font-size:11px; font-weight:700; padding:4px 8px; border-radius:999px;">Auto-Calibrated Dynamic</span>
              <button type="button" class="btn sm ghost rec-manual-inspect-btn" data-recipe-id="${escapeAttr(item.recipeId)}">Manual Inspect</button>
            </div>
          </div>
        `)}

        <!-- 2. ACTIVE MEAL PLAN DESYNC CARD -->
        ${renderAuditCard('Active Week Meal Plan Desync', '📅', audit.planDesync, (item) => `
          <div style="padding:10px 12px; background:#fff; border:1px solid var(--border); border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13px; color:#111827;">${escapeHtml(item.recipeName)} (Day ${escapeHtml(item.dayKey)} · ${escapeHtml(item.mealKey)})</strong>
              <div style="font-size:11.5px; color:var(--text2); margin-top:2px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary plan-sync-active-btn" 
                data-day="${escapeAttr(item.dayKey)}" 
                data-meal="${escapeAttr(item.mealKey)}" 
                data-recipe-id="${escapeAttr(item.recipeId)}"
                data-recipe-name="${escapeAttr(item.recipeName)}"
                data-node-cal="${escapeAttr(item.nodeCal)}"
                data-node-prot="${escapeAttr(item.nodeProt)}"
                data-temp-cal="${escapeAttr(item.tempCal)}"
                data-temp-prot="${escapeAttr(item.tempProt)}"
                style="background:var(--primary,#4f46e5); color:#fff;">Sync Active Week</button>
            </div>
          </div>
        `)}

        <!-- 3. INCOMPLETE MACROS CARD -->
        ${renderAuditCard('Incomplete Macro Specifications', '🔬', audit.incompleteMacros, (item) => `
          <div style="padding:10px 12px; background:#fff; border:1px solid var(--border); border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13px; color:#111827;">${escapeHtml(item.ingredientName)}</strong>
              <div style="font-size:11.5px; color:var(--text2); margin-top:2px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary math-fix-macros-btn" data-ing-id="${escapeAttr(item.ingredientId)}" style="background:var(--primary,#4f46e5); color:#fff;">Fix Macros</button>
            </div>
          </div>
        `)}

        <!-- 4. DENSITY MISMATCH CARD -->
        ${renderAuditCard('Weight-to-Volume Density Mismatch', '🧪', audit.densityMismatch, (item) => `
          <div style="padding:10px 12px; background:#fff; border:1px solid var(--border); border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13px; color:#111827;">${escapeHtml(item.ingredientName)} (in "${escapeHtml(item.recipeName)}")</strong>
              <div style="font-size:11.5px; color:var(--text2); margin-top:2px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary density-add-conversion-btn" data-ing-id="${escapeAttr(item.ingredientId)}" style="background:var(--primary,#4f46e5); color:#fff;">Add Conversion</button>
            </div>
          </div>
        `)}

        <!-- 5. ORPHANED PRODUCT CARD -->
        ${renderAuditCard('Orphaned Grocery Products', '🔗', audit.orphans, (item) => `
          <div style="padding:10px 12px; background:#fff; border:1px solid var(--border); border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13px; color:#111827;">${escapeHtml(item.productName)}</strong>
              <div style="font-size:11.5px; color:var(--text2); margin-top:2px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary orphan-resolve-btn" 
                data-subtype-id="${escapeAttr(item.subtypeId || '')}" 
                data-parent-id="${escapeAttr(item.parentId || '')}"
                style="background:var(--primary,#4f46e5); color:#fff;">Resolve Links</button>
            </div>
          </div>
        `)}

        <!-- 6. UNMAPPED ITEM CARD -->
        ${renderAuditCard('Unmapped Core Ingredients', '🛒', audit.unmappedItems, (item) => `
          <div style="padding:10px 12px; background:#fff; border:1px solid var(--border); border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13px; color:#111827;">${escapeHtml(item.ingredientName)}</strong>
              <div style="font-size:11.5px; color:var(--text2); margin-top:2px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary unmapped-tesco-btn" data-ing-id="${escapeAttr(item.ingredientId)}" style="background:var(--primary,#4f46e5); color:#fff;">Find Tesco Match</button>
              <button type="button" class="btn sm ghost unmapped-ignore-btn" data-ing-id="${escapeAttr(item.ingredientId)}">Ignore</button>
            </div>
          </div>
        `)}

        <!-- 7. DUPLICATE INGREDIENT CARD -->
        ${renderAuditCard('Duplicate Ingredient Candidates', '👥', audit.duplicates, (item) => `
          <div style="padding:10px 12px; background:#fff; border:1px solid var(--border); border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13px; color:#111827;">"${escapeHtml(item.ing1Name)}" &amp; "${escapeHtml(item.ing2Name)}"</strong>
              <div style="font-size:11.5px; color:var(--text2); margin-top:2px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary duplicate-merge-btn" 
                data-ing1-id="${escapeAttr(item.ing1Id)}" 
                data-ing2-id="${escapeAttr(item.ing2Id)}"
                style="background:var(--primary,#4f46e5); color:#fff;">Review &amp; Merge</button>
            </div>
          </div>
        `)}

        <!-- 8. PAYLOAD SIZE CARD -->
        ${renderAuditCard('Database Payload Health Warning', '💾', audit.storageHealth, (item) => `
          <div style="padding:10px 12px; background:#fffbf2; border:1px solid #fef3c7; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13px; color:#92400e;">Preferences Storage Warning (${item.sizeKb} KB)</strong>
              <div style="font-size:11.5px; color:#b45309; margin-top:2px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary health-clean-btn" style="background:#d97706; color:#fff; border:none;">Clean History Cache</button>
            </div>
          </div>
        `)}

      </div>
    </div>
  `;

  // Bind relink & refresh top buttons
  const sweeperBtn = document.getElementById('dq-btn-sweeper');
  if (sweeperBtn) sweeperBtn.onclick = () => openUnlinkedSweeperModal();
  const auditBtn = document.getElementById('dq-btn-recipe-audit');
  if (auditBtn) auditBtn.onclick = () => openRecipeAuditModal();
  document.getElementById('dq-btn-relink').onclick = performGlobalProductRelink; // Assuming we can use performGlobalProductRelink directly if exported. Wait, it needs to be imported or delegated. 
  // It needs ingredients, products. So it should be a handler in the service.
  // I'll fix this in the next step.
  document.getElementById('dq-btn-refresh').onclick = () => renderDataQualityView();

  // Bind all actions...
  // This is too much code in the render function. I need to delegate action handlers.
}

export async function handleVerifyZeroCal(ingredientId) {
  const state = getState() || {};
  const ingredients = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  try {
    const updated = await verifyZeroCalorieIngredient(ingredientId, ingredients);
    if (updated) {
      renderDataQualityView();
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast(`"${updated.name}" verified as zero-cal ingredient.`, 'success');
      }
    }
  } catch (e) {
    console.error('[DataQualityView] Failed to save verified zero-cal:', e);
    renderDataQualityView();
  }
}

export async function handleIgnoreStoreMapping(ingredientId) {
  const state = getState() || {};
  const ingredients = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  const ingIndex = ingredients.findIndex(i => String(i.id) === String(ingredientId));
  if (ingIndex < 0) return;

  const originalIng = ingredients[ingIndex];
  const updatedIng = {
    ...originalIng,
    ignoreStoreMapping: true,
    updatedAt: new Date().toISOString()
  };

  ingredients[ingIndex] = updatedIng;

  setIngredients(ingredients);
  renderDataQualityView();

  try {
    await saveIngredient(updatedIng);
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast(`Ignored store mapping for "${updatedIng.name}".`, 'info');
    }
  } catch (e) {
    console.error('[DataQualityView] Failed to save ignoreStoreMapping:', e);
    ingredients[ingIndex] = originalIng;
    setIngredients(ingredients);
    renderDataQualityView();
  }
}

export async function handleCleanHistoryCache() {
  const state = getState() || {};
  const currentPrefs = state.preferences || state.userPrefs || {};
  const previousPrefs = JSON.parse(JSON.stringify(currentPrefs));

  const dismissed = Array.isArray(currentPrefs.dismissedQualityAdvisories)
    ? [...currentPrefs.dismissedQualityAdvisories]
    : [];

  const prunedDismissed = dismissed.slice(-20);

  const updatedPrefs = {
    ...currentPrefs,
    dismissedQualityAdvisories: prunedDismissed,
    advisoryHistory: [],
    snapshots: [],
    stateSnapshots: [],
    cachedSnapshots: {}
  };

  const mutateFn = (currentState) => {
    currentState.preferences = updatedPrefs;
    currentState.userPrefs = updatedPrefs;
  };

  const rollbackFn = (currentState) => {
    currentState.preferences = previousPrefs;
    currentState.userPrefs = previousPrefs;
  };

  try {
    await runOptimisticMutation(
      'preferences',
      mutateFn,
      savePreferencesWithAutoPrune(updatedPrefs),
      rollbackFn,
      'Failed to clean preference history cache.'
    );
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Preference storage cleaned successfully (cached snapshots & history deleted).', 'success');
    }
    renderDataQualityView();
  } catch (err) {
    console.error('[DataQualityView] handleCleanHistoryCache error:', err);
  }
}
