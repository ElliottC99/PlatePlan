/**
 * src/views/DataQualityTableRenderService.js
 * Executive Data Health Dashboard & Delegated Wizard Actions for Data Quality Centre.
 */

import { getState, setIngredients, runOptimisticMutation } from '../store/store.js';
import { runAudit } from '../services/DataQualityScanner.js';
import { saveRootItem as saveIngredient } from '../services/RootItemRepository.js';
import { savePreferencesWithAutoPrune } from '../services/HouseholdRepository.js';
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

export const renderAuditCard = (title, icon, items, renderer, headerActionHtml = '') => {
  const safeItems = Array.isArray(items) ? items : [];
  const listHtml = safeItems.map(renderer).join('');
  const count = safeItems.length;
  return `
    <div class="card" style="background:var(--surface,#fff); border-radius:14px; padding:18px; border:1px solid var(--border,#e7e5e4); margin-bottom:16px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid var(--border,#e7e5e4); padding-bottom:10px; flex-wrap:wrap; gap:8px;">
        <h3 style="margin:0; font-size:14.5px; font-weight:750; color:var(--text,#1c1917); display:flex; align-items:center; gap:8px;">
          <span>${icon}</span> ${title}
        </h3>
        <div style="display:flex; align-items:center; gap:8px;">
          ${headerActionHtml}
          <span style="font-size:11px; font-weight:700; padding:3px 8px; border-radius:999px; background:${count > 0 ? '#fee2e2' : '#dcfce7'}; color:${count > 0 ? '#b91c1c' : '#15803d'}">
            ${count > 0 ? `${count} Action Required` : 'Healthy'}
          </span>
        </div>
      </div>
      ${count === 0 
        ? `<div style="font-size:12.5px; color:var(--text2,#78716c); padding:6px 0;">All checks passed. No issues found.</div>` 
        : `<div style="display:flex; flex-direction:column; gap:8px;">${listHtml}</div>`
      }
    </div>
  `;
};

let isEventsBound = false;

function initDataQualityEvents(container) {
  if (isEventsBound || !container) return;
  isEventsBound = true;

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action-dq]');
    if (!btn) return;
    const action = btn.dataset.actionDq;

    // Top action bar triggers
    if (action === 'open-macro-recalibrate') {
      openMacroDriftPreviewModal();
      return;
    }
    if (action === 'open-duplicate-merge') {
      const state = getState();
      const audit = runAudit(state);
      if (audit.duplicates && audit.duplicates.length > 0) {
        openMergeIngredientsModal(audit.duplicates[0]);
      } else {
        window.showPlatePlanToast?.('No duplicate ingredients detected.', 'info');
      }
      return;
    }
    if (action === 'open-orphan-resolver') {
      const state = getState();
      const audit = runAudit(state);
      if (audit.orphans && audit.orphans.length > 0) {
        openSubtypeOrphanResolverModal(audit.orphans[0]);
      } else {
        window.showPlatePlanToast?.('No orphaned products detected.', 'info');
      }
      return;
    }
    if (action === 'open-sweeper') {
      openUnlinkedSweeperModal();
      return;
    }
    if (action === 'open-recipe-audit') {
      openRecipeAuditModal();
      return;
    }
    if (action === 'relink-catalog') {
      const state = getState();
      const { modifiedCount } = await performGlobalProductRelink(state.ingredients || [], state.products || []);
      window.showPlatePlanToast?.(`Catalog auto-relink complete (${modifiedCount} updated).`, 'success');
      renderDataQualityView();
      return;
    }
    if (action === 'refresh-audit') {
      renderDataQualityView();
      return;
    }

    // Card item triggers
    if (action === 'merge-duplicate') {
      const ing1Id = btn.dataset.ing1Id;
      const ing2Id = btn.dataset.ing2Id;
      openMergeIngredientsModal({ ing1Id, ing2Id });
      return;
    }
    if (action === 'resolve-orphan') {
      const subtypeId = btn.dataset.subtypeId;
      const parentId = btn.dataset.parentId;
      openSubtypeOrphanResolverModal({ subtypeId, parentId });
      return;
    }
    if (action === 'inspect-macro') {
      const recipeId = btn.dataset.recipeId;
      openMacroDriftPreviewModal([recipeId]);
      return;
    }
    if (action === 'recalibrate-all-macros') {
      openMacroDriftPreviewModal();
      return;
    }
    if (action === 'sync-plan') {
      const { day, meal, recipeId, recipeName, nodeCal, nodeProt, tempCal, tempProt } = btn.dataset;
      openMealPlanSyncWarningModal({
        dayKey: day,
        mealKey: meal,
        recipeId,
        recipeName,
        nodeCal: Number(nodeCal),
        nodeProt: Number(nodeProt),
        tempCal: Number(tempCal),
        tempProt: Number(tempProt)
      });
      return;
    }
    if (action === 'unmapped-tesco') {
      const ingId = btn.dataset.ingId;
      const state = getState();
      const ing = (state.ingredients || []).find(i => String(i.id) === String(ingId));
      import('../components/pantry/SubtypeProductLinkerModalUI.js').then(m => {
        m.openTescoImportModal?.(null, ingId, () => renderDataQualityView(), ing?.name || null);
      }).catch(err => console.error('[DataQualityView] Failed to load Tesco import modal:', err));
      return;
    }
    if (action === 'unmapped-ignore') {
      const ingId = btn.dataset.ingId;
      await handleIgnoreStoreMapping(ingId);
      return;
    }
    if (action === 'add-density') {
      const ingId = btn.dataset.ingId;
      const ingName = btn.dataset.ingName;
      const state = getState();
      const ing = (state.ingredients || []).find(i => String(i.id) === String(ingId));
      const currentDensity = ing?.density ?? 1.0;
      const input = prompt(`Enter density factor (g/ml) for "${ingName}":\n(e.g. 1.0 for water/liquids, 0.5 for flour, 0.85 for sugar/lentils)`, currentDensity);
      if (input !== null && !isNaN(Number(input)) && Number(input) > 0) {
        const updatedIng = { ...ing, density: Number(input), updatedAt: new Date().toISOString() };
        try {
          await saveIngredient(updatedIng);
          const ings = [...(state.ingredients || [])];
          const idx = ings.findIndex(i => String(i.id) === String(ingId));
          if (idx !== -1) ings[idx] = updatedIng;
          setIngredients(ings);
          window.showPlatePlanToast?.(`Updated density factor for "${ingName}" to ${input} g/ml.`, 'success');
          renderDataQualityView();
        } catch (err) {
          console.error('[DataQualityView] Failed to save density factor:', err);
        }
      }
      return;
    }
    if (action === 'fix-macros') {
      const ingId = btn.dataset.ingId;
      if (typeof window.editIng === 'function') {
        window.editIng(ingId);
      } else {
        window.showPlatePlanToast?.('Open Pantry tab to edit ingredient macros directly.', 'info');
      }
      return;
    }
    if (action === 'clean-cache') {
      await handleCleanHistoryCache();
      return;
    }
  });
}

export function renderDataQualityView() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('view-data');
  if (!container) return;

  const state = getState();
  const audit = runAudit(state);
  
  // Storage silent auto-prune
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
    }
  }

  const totalIssues = audit.totalCount || 0;
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - (totalIssues * 1.5))));
  const isHealthy = totalIssues === 0;

  container.innerHTML = `
    <div style="max-width:920px; margin:0 auto; padding:20px; box-sizing:border-box;">
      
      <!-- Top Health KPI Banner -->
      <div style="background:var(--surface,#fff); border:1px solid var(--border,#e7e5e4); border-radius:16px; padding:20px; margin-bottom:20px; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:10px;">
              <h2 style="font-size:22px; font-weight:800; margin:0; color:var(--text,#1c1917);">Data Health Centre</h2>
              <span style="font-size:12px; font-weight:750; padding:3px 10px; border-radius:999px; background:${isHealthy ? '#dcfce7' : '#fee2e2'}; color:${isHealthy ? '#15803d' : '#b91c1c'};">
                ${healthScore}% Healthy · ${totalIssues} Action Items
              </span>
            </div>
            <p style="margin:4px 0 0 0; font-size:13px; color:var(--text2,#78716c);">
              Catalogue audit scanner, recipe macro validation, and guided self-healing wizards.
            </p>
          </div>
          
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn sm ghost" data-action-dq="refresh-audit" style="font-weight:600;">🔄 Refresh Audit</button>
            <button type="button" class="btn sm secondary" data-action-dq="relink-catalog" style="font-weight:600;">⚡ Auto-Relink Catalog</button>
          </div>
        </div>

        <!-- Guided Resolution Action Ribbon -->
        <div style="display:flex; gap:8px; flex-wrap:wrap; padding-top:12px; border-top:1px solid var(--border,#e7e5e4);">
          <button type="button" class="btn sm" data-action-dq="open-macro-recalibrate" style="font-weight:600; background:#3b82f6; color:#fff;">
            📉 Macro Recalibration (${audit.macroDrift.length})
          </button>
          <button type="button" class="btn sm" data-action-dq="open-duplicate-merge" style="font-weight:600; background:#8b5cf6; color:#fff;">
            👥 Deduplication Wizard (${audit.duplicates.length})
          </button>
          <button type="button" class="btn sm" data-action-dq="open-orphan-resolver" style="font-weight:600; background:#f59e0b; color:#fff;">
            🔗 Resolve Orphans (${audit.orphans.length})
          </button>
          <button type="button" class="btn sm" data-action-dq="open-sweeper" style="font-weight:600; background:#059669; color:#fff;">
            🧹 Unlinked Sweeper (${audit.unmappedItems.length})
          </button>
          <button type="button" class="btn sm" data-action-dq="open-recipe-audit" style="font-weight:600; background:var(--primary,#4f46e5); color:#fff;">
            📖 Recipe Mapping Audit
          </button>
        </div>
      </div>

      <!-- Health Pillars Grid -->
      <div style="display:grid; grid-template-columns:1fr; gap:16px;">
        
        <!-- 1. DUPLICATE INGREDIENTS CARD -->
        ${renderAuditCard('Duplicate Ingredient Candidates', '👥', audit.duplicates, (item) => `
          <div style="padding:12px 14px; background:#fff; border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:#111827;">"${escapeHtml(item.ing1Name)}" &amp; "${escapeHtml(item.ing2Name)}"</strong>
              <div style="font-size:12px; color:var(--text2,#78716c); margin-top:3px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary dq-action-btn" 
                data-action-dq="merge-duplicate"
                data-ing1-id="${escapeAttr(item.ing1Id)}" 
                data-ing2-id="${escapeAttr(item.ing2Id)}"
                style="background:var(--primary,#4f46e5); color:#fff; font-weight:600;">Review &amp; Merge</button>
            </div>
          </div>
        `)}

        <!-- 2. BROKEN / ORPHANED PRODUCTS CARD -->
        ${renderAuditCard('Broken / Orphaned Grocery Products', '🔗', audit.orphans, (item) => `
          <div style="padding:12px 14px; background:#fff; border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:#111827;">${escapeHtml(item.productName)}</strong>
              <div style="font-size:12px; color:var(--text2,#78716c); margin-top:3px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary dq-action-btn" 
                data-action-dq="resolve-orphan"
                data-subtype-id="${escapeAttr(item.subtypeId || '')}" 
                data-parent-id="${escapeAttr(item.parentId || '')}"
                style="background:var(--primary,#4f46e5); color:#fff; font-weight:600;">Resolve Links</button>
            </div>
          </div>
        `)}

        <!-- 3. RECIPE MACRO DRIFT CARD -->
        ${renderAuditCard('Recipe Macro Drift Anomaly', '📉', audit.macroDrift, (item) => `
          <div style="padding:12px 14px; background:#fff; border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:#111827;">${escapeHtml(item.recipeName)}</strong>
              <div style="font-size:12px; color:var(--text2,#78716c); margin-top:3px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-shrink:0;">
              <button type="button" class="btn sm ghost dq-action-btn" data-action-dq="inspect-macro" data-recipe-id="${escapeAttr(item.recipeId)}" style="font-weight:600;">Review Diff</button>
            </div>
          </div>
        `, audit.macroDrift.length > 0 ? `
          <button type="button" class="btn sm primary dq-action-btn" data-action-dq="recalibrate-all-macros" style="font-weight:700; background:#2563eb; color:#fff;">
            ⚡ Recalibrate All (${audit.macroDrift.length})
          </button>
        ` : '')}

        <!-- 4. ACTIVE MEAL PLAN DESYNC CARD -->
        ${renderAuditCard('Active Week Meal Plan Desync', '📅', audit.planDesync, (item) => `
          <div style="padding:12px 14px; background:#fff; border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:#111827;">${escapeHtml(item.recipeName)} (Day ${escapeHtml(item.dayKey)} · ${escapeHtml(item.mealKey)})</strong>
              <div style="font-size:12px; color:var(--text2,#78716c); margin-top:3px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary dq-action-btn" 
                data-action-dq="sync-plan"
                data-day="${escapeAttr(item.dayKey)}" 
                data-meal="${escapeAttr(item.mealKey)}" 
                data-recipe-id="${escapeAttr(item.recipeId)}"
                data-recipe-name="${escapeAttr(item.recipeName)}"
                data-node-cal="${escapeAttr(item.nodeCal)}"
                data-node-prot="${escapeAttr(item.nodeProt)}"
                data-temp-cal="${escapeAttr(item.tempCal)}"
                data-temp-prot="${escapeAttr(item.tempProt)}"
                style="background:var(--primary,#4f46e5); color:#fff; font-weight:600;">Sync Active Slot</button>
            </div>
          </div>
        `)}

        <!-- 5. UNMAPPED CORE INGREDIENTS CARD -->
        ${renderAuditCard('Unmapped Core Ingredients', '🛒', audit.unmappedItems, (item) => `
          <div style="padding:12px 14px; background:#fff; border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:#111827;">${escapeHtml(item.ingredientName)}</strong>
              <div style="font-size:12px; color:var(--text2,#78716c); margin-top:3px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary dq-action-btn" data-action-dq="unmapped-tesco" data-ing-id="${escapeAttr(item.ingredientId)}" style="background:var(--primary,#4f46e5); color:#fff; font-weight:600;">Find Tesco Match</button>
              <button type="button" class="btn sm ghost dq-action-btn" data-action-dq="unmapped-ignore" data-ing-id="${escapeAttr(item.ingredientId)}">Ignore</button>
            </div>
          </div>
        `)}

        <!-- 6. DRY-GOODS VOLUME DENSITY MISMATCH CARD -->
        ${renderAuditCard('Weight-to-Volume Density Mismatch', '🧪', audit.densityMismatch, (item) => `
          <div style="padding:12px 14px; background:#fff; border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:#111827;">${escapeHtml(item.ingredientName)}</strong>
              <div style="font-size:12px; color:var(--text2,#78716c); margin-top:3px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary dq-action-btn" 
                data-action-dq="add-density" 
                data-ing-id="${escapeAttr(item.ingredientId)}"
                data-ing-name="${escapeAttr(item.ingredientName)}"
                style="background:var(--primary,#4f46e5); color:#fff; font-weight:600;">Set Density</button>
            </div>
          </div>
        `)}

        <!-- 7. INCOMPLETE MACRO SPECIFICATIONS CARD -->
        ${renderAuditCard('Incomplete Macro Specifications', '🔬', audit.incompleteMacros, (item) => `
          <div style="padding:12px 14px; background:#fff; border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:#111827;">${escapeHtml(item.ingredientName)}</strong>
              <div style="font-size:12px; color:var(--text2,#78716c); margin-top:3px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary dq-action-btn" data-action-dq="fix-macros" data-ing-id="${escapeAttr(item.ingredientId)}" style="background:var(--primary,#4f46e5); color:#fff; font-weight:600;">Fix Macros</button>
            </div>
          </div>
        `)}

        <!-- 8. DATABASE STORAGE HEALTH CARD -->
        ${renderAuditCard('Database Payload Health Warning', '💾', audit.storageHealth, (item) => `
          <div style="padding:12px 14px; background:#fffbf2; border:1px solid #fef3c7; border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:#92400e;">Preferences Storage Warning (${item.sizeKb} KB)</strong>
              <div style="font-size:12px; color:#b45309; margin-top:3px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary dq-action-btn" data-action-dq="clean-cache" style="background:#d97706; color:#fff; border:none; font-weight:600;">Clean History Cache</button>
            </div>
          </div>
        `)}

      </div>
    </div>
  `;

  initDataQualityEvents(container);
}

export async function handleVerifyZeroCal(ingredientId) {
  const state = getState();
  const ingredients = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  try {
    const updated = await verifyZeroCalorieIngredient(ingredientId, ingredients);
    if (updated) {
      renderDataQualityView();
      window.showPlatePlanToast?.(`"${updated.name}" verified as zero-cal ingredient.`, 'success');
    }
  } catch (e) {
    console.error('[DataQualityView] Failed to save verified zero-cal:', e);
    renderDataQualityView();
  }
}

export async function handleIgnoreStoreMapping(ingredientId) {
  const state = getState();
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
    window.showPlatePlanToast?.(`Ignored store mapping for "${updatedIng.name}".`, 'info');
  } catch (e) {
    console.error('[DataQualityView] Failed to save ignoreStoreMapping:', e);
    ingredients[ingIndex] = originalIng;
    setIngredients(ingredients);
    renderDataQualityView();
  }
}

export async function handleCleanHistoryCache() {
  const state = getState();
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
    window.showPlatePlanToast?.('Preference storage cleaned successfully (cached snapshots & history deleted).', 'success');
    renderDataQualityView();
  } catch (err) {
    console.error('[DataQualityView] handleCleanHistoryCache error:', err);
  }
}
