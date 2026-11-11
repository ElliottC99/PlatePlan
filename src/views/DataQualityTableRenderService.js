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
import { openUnlinkedSweeperModal, scanUnlinkedRecipeIngredients } from '../components/data-quality/UnlinkedSweeperUI.js';
import { openCategoryPromotionModal } from '../components/data-quality/CategoryPromotionModalUI.js';
import { findDuplicateCategoryClusters } from '../components/pantry/CategoryMergeModalUI.js';
import { findDuplicateRecipeClusters } from '../services/RecipeFirestoreRepository.js';
import { openRecipeDeduplicationModal } from './RecipeVaultView.js';
import { auditRecipeMappings } from '../utils/RecipeAuditService.js';
import { performGlobalProductRelink, verifyZeroCalorieIngredient } from '../services/DataQualityService.js';
import { showCustomDensityModal } from '../components/ui/DialogHelpers.js';

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
          <span style="font-size:11px; font-weight:700; padding:3px 8px; border-radius:999px; background:${count > 0 ? 'var(--badge-red-bg)' : 'var(--badge-green-bg)'}; color:${count > 0 ? 'var(--badge-red-text)' : 'var(--badge-green-text)'}">
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
        openSubtypeOrphanResolverModal({ all: true });
      } else {
        window.showPlatePlanToast?.('No orphaned products detected.', 'info');
      }
      return;
    }
    if (action === 'open-sweeper') {
      openUnlinkedSweeperModal();
      return;
    }
    if (action === 'open-taxonomy-elevation') {
      openCategoryPromotionModal();
      return;
    }
    if (action === 'open-recipe-audit') {
      openRecipeAuditModal();
      return;
    }
    if (action === 'open-recipe-dedup') {
      openRecipeDeduplicationModal();
      return;
    }
    if (action === 'open-category-merge') {
      import('../components/pantry/CategoryMergeModalUI.js').then(m => m.openCategoryMergeModal());
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
      const productId = btn.dataset.productId;
      const type = btn.dataset.orphanType;
      openSubtypeOrphanResolverModal({ subtypeId, parentId, productId, type });
      return;
    }
    if (action === 'edit-recipe') {
      const recipeId = btn.dataset.recipeId;
      if (typeof window.openRecipeWizard === 'function') {
        window.openRecipeWizard(recipeId);
      } else if (typeof window.editRecipeInWizard === 'function') {
        window.editRecipeInWizard(recipeId);
      } else {
        window.showPlatePlanToast?.('Open Recipe Vault to edit this recipe.', 'info');
      }
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
    if (action === 'add-density') {
      const ingId = btn.dataset.ingId;
      const ingName = btn.dataset.ingName;
      const state = getState();
      const ing = (state.ingredients || []).find(i => String(i.id) === String(ingId));
      const currentDensity = ing?.density ?? 1.0;
      showCustomDensityModal({
        ingredientName: ingName,
        currentDensity,
        onSave: async (val) => {
          const updatedIng = { ...ing, density: Number(val), updatedAt: new Date().toISOString() };
          try {
            await saveIngredient(updatedIng);
            const ings = [...(state.ingredients || [])];
            const idx = ings.findIndex(i => String(i.id) === String(ingId));
            if (idx !== -1) ings[idx] = updatedIng;
            setIngredients(ings);
            window.showPlatePlanToast?.(`Updated density factor for "${ingName}" to ${val} g/ml.`, 'success');
            renderDataQualityView();
          } catch (err) {
            console.error('[DataQualityView] Failed to save density factor:', err);
          }
        }
      });
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
  const blockers = audit.orphans.length;
  const gaps = audit.densityMismatch.length + audit.planDesync.length;
  const advisories = audit.macroDrift.length;
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - (blockers * 4 + gaps * 1 + advisories * 0.3))));
  const isHealthy = totalIssues === 0;
  let unlinkedRecipeCount = 0;
  try {
    unlinkedRecipeCount = scanUnlinkedRecipeIngredients().length;
  } catch (e) {
    unlinkedRecipeCount = 0;
  }

  let recipeAuditCount = 0;
  try {
    const auditReport = auditRecipeMappings(state);
    recipeAuditCount = auditReport?.summary?.totalIssues || auditReport?.issues?.length || 0;
  } catch (e) {
    recipeAuditCount = 0;
  }

  let categoryClusterCount = 0;
  try {
    categoryClusterCount = findDuplicateCategoryClusters(state).length;
  } catch (e) {
    categoryClusterCount = 0;
  }

  let recipeClusterCount = 0;
  let recipeClusters = [];
  try {
    recipeClusters = findDuplicateRecipeClusters(state.recipes);
    recipeClusterCount = recipeClusters.length;
  } catch (e) {
    recipeClusterCount = 0;
    recipeClusters = [];
  }

  container.innerHTML = `
    <div style="max-width:920px; margin:0 auto; padding:20px; box-sizing:border-box;">
      
      <!-- Top Health KPI Banner -->
      <div style="background:var(--surface,#fff); border:1px solid var(--border,#e7e5e4); border-radius:16px; padding:20px; margin-bottom:20px; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:10px;">
              <h2 style="font-size:22px; font-weight:800; margin:0; color:var(--text,#1c1917);">Data Health Centre</h2>
              <span style="font-size:12px; font-weight:750; padding:3px 10px; border-radius:999px; background:${isHealthy ? 'var(--badge-green-bg)' : 'var(--badge-red-bg)'}; color:${isHealthy ? 'var(--badge-green-text)' : 'var(--badge-red-text)'};">
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
          <button type="button" class="btn sm" data-action-dq="open-macro-recalibrate" style="font-weight:600; background:#3b82f6; color:#fff; ${audit.macroDrift.length === 0 ? 'opacity:0.55; cursor:default;' : ''}">
            📉 Macro Recalibration (${audit.macroDrift.length}${audit.macroDrift.length === 0 ? ' ✓' : ''})
          </button>
          <button type="button" class="btn sm" data-action-dq="open-duplicate-merge" style="font-weight:600; background:#8b5cf6; color:#fff; ${audit.duplicates.length === 0 ? 'opacity:0.55; cursor:default;' : ''}">
            👥 Deduplication Wizard (${audit.duplicates.length}${audit.duplicates.length === 0 ? ' ✓' : ''})
          </button>
          <button type="button" class="btn sm" data-action-dq="open-orphan-resolver" style="font-weight:600; background:#f59e0b; color:#fff; ${audit.orphans.length === 0 ? 'opacity:0.55; cursor:default;' : ''}">
            🔗 Resolve Orphans (${audit.orphans.length}${audit.orphans.length === 0 ? ' ✓' : ''})
          </button>
          <button type="button" class="btn sm" data-action-dq="open-sweeper" style="font-weight:600; background:#059669; color:#fff; ${unlinkedRecipeCount === 0 ? 'opacity:0.55; cursor:default;' : ''}">
            🧹 Unlinked Sweeper (${unlinkedRecipeCount}${unlinkedRecipeCount === 0 ? ' ✓' : ''})
          </button>
          <button type="button" class="btn sm" data-action-dq="open-category-merge" style="font-weight:600; background:#0284c7; color:#fff; ${categoryClusterCount === 0 ? 'opacity:0.55; cursor:default;' : ''}">
            📂 Category Deduplication (${categoryClusterCount}${categoryClusterCount === 0 ? ' ✓' : ''})
          </button>
          <button type="button" class="btn sm" data-action-dq="open-recipe-dedup" style="font-weight:600; background:#6366f1; color:#fff; ${recipeClusterCount === 0 ? 'opacity:0.55; cursor:default;' : ''}">
            🍲 Recipe Deduplication (${recipeClusterCount}${recipeClusterCount === 0 ? ' ✓' : ''})
          </button>
          <button type="button" class="btn sm" data-action-dq="open-recipe-audit" style="font-weight:600; background:var(--primary,#4f46e5); color:#fff; ${recipeAuditCount === 0 ? 'opacity:0.55; cursor:default;' : ''}">
            📖 Recipe Mapping Audit (${recipeAuditCount}${recipeAuditCount === 0 ? ' ✓' : ''})
          </button>
          <button type="button" class="btn sm" data-action-dq="open-taxonomy-elevation" style="font-weight:600; background:#0d9488; color:#fff;">
            📈 Taxonomy Elevation
          </button>
        </div>
      </div>

      <!-- Health Pillars Grid -->
      <div style="display:grid; grid-template-columns:1fr; gap:16px;">
        
        <!-- 0. DUPLICATE RECIPES CARD -->
        ${renderAuditCard('Duplicate Recipe Candidates', '🍲', recipeClusters.map(c => ({
          title: c.title,
          count: c.variants.length,
          message: `${c.variants.length} recipes sharing normalized title "${c.title}"`
        })), (item) => `
          <div style="padding:12px 14px; background:var(--surface2); border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:var(--text);">"${escapeHtml(item.title)}"</strong>
              <div style="font-size:12px; color:var(--text2,#78716c); margin-top:3px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary dq-action-btn" 
                data-action-dq="open-recipe-dedup"
                style="background:#6366f1; color:#fff; font-weight:600;">Review &amp; Merge</button>
            </div>
          </div>
        `)}

        <!-- 1. DUPLICATE INGREDIENTS CARD -->
        ${renderAuditCard('Duplicate Ingredient Candidates', '👥', audit.duplicates, (item) => `
          <div style="padding:12px 14px; background:var(--surface2); border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:var(--text);">"${escapeHtml(item.ing1Name)}" &amp; "${escapeHtml(item.ing2Name)}"</strong>
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
          <div style="padding:12px 14px; background:var(--surface2); border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:var(--text);">${escapeHtml(item.productName)}</strong>
              <div style="font-size:12px; color:var(--text2,#78716c); margin-top:3px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary dq-action-btn" 
                data-action-dq="resolve-orphan"
                data-subtype-id="${escapeAttr(item.subtypeId || '')}" 
                data-parent-id="${escapeAttr(item.parentId || '')}"
                data-product-id="${escapeAttr(item.productId || '')}"
                data-orphan-type="${escapeAttr(item.type || '')}"
                style="background:var(--primary,#4f46e5); color:#fff; font-weight:600;">Resolve Links</button>
            </div>
          </div>
        `)}

        <!-- 3. RECIPE MACRO DRIFT CARD -->
        ${renderAuditCard('Recipe Macro Drift Anomaly', '📉', audit.macroDrift, (item) => `
          <div style="padding:12px 14px; background:var(--surface2); border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:var(--text);">${escapeHtml(item.recipeName)}</strong>
              <div style="font-size:12px; color:var(--text2,#78716c); margin-top:3px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-shrink:0;">
              <button type="button" class="btn sm ghost dq-action-btn" data-action-dq="inspect-macro" data-recipe-id="${escapeAttr(item.recipeId)}" style="font-weight:600;">Review Diff</button>
            </div>
          </div>
        `, audit.macroDrift.length > 0 ? `
          <button type="button" class="btn sm primary dq-action-btn" data-action-dq="recalibrate-all-macros" style="font-weight:700; background:var(--system-blue); color:#fff;">
            ⚡ Recalibrate All (${audit.macroDrift.length})
          </button>
        ` : '')}

        <!-- 4. ACTIVE MEAL PLAN DESYNC CARD -->
        ${renderAuditCard('Active Week Meal Plan Desync', '📅', audit.planDesync, (item) => `
          <div style="padding:12px 14px; background:var(--surface2); border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:var(--text);">${escapeHtml(item.recipeName)} (Day ${escapeHtml(item.dayKey)} · ${escapeHtml(item.mealKey)})</strong>
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

        <!-- 5. DRY-GOODS VOLUME DENSITY MISMATCH CARD -->
        ${renderAuditCard('Weight-to-Volume Density Mismatch', '🧪', audit.densityMismatch, (item) => `
          <div style="padding:12px 14px; background:var(--surface2); border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:var(--text);">${escapeHtml(item.ingredientName)}</strong>
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

        <!-- 6. UNLINKED RECIPE INGREDIENTS CARD -->
        ${renderAuditCard('Unlinked Recipe Ingredients', '⚠️', audit.unmappedItems, (item) => `
          <div style="padding:12px 14px; background:var(--surface2); border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13.5px; color:var(--text);">${escapeHtml(item.recipeName)}</strong>
              <div style="font-size:12px; color:var(--text2,#78716c); margin-top:3px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary dq-action-btn" 
                data-action-dq="edit-recipe" 
                data-recipe-id="${escapeAttr(item.recipeId)}"
                style="background:var(--primary,#4f46e5); color:#fff; font-weight:600;">Edit in Wizard</button>
            </div>
          </div>
        `)}

        <!-- 7. RETROSPECTIVE TAXONOMY ELEVATION CARD -->
        <div class="card" style="background:var(--surface,#fff); border-radius:14px; padding:18px; border:1px solid var(--border,#e7e5e4); margin-bottom:16px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid var(--border,#e7e5e4); padding-bottom:10px; flex-wrap:wrap; gap:8px;">
            <h3 style="margin:0; font-size:14.5px; font-weight:750; color:var(--text,#1c1917); display:flex; align-items:center; gap:8px;">
              <span>📈</span> Retrospective Taxonomy Elevation
            </h3>
            <div style="display:flex; align-items:center; gap:8px;">
              <button type="button" class="btn sm primary dq-action-btn" data-action-dq="open-taxonomy-elevation" style="background:#0d9488; color:#fff; font-weight:700;">
                Review Elevations
              </button>
            </div>
          </div>
          <div style="font-size:12.5px; color:var(--text2,#78716c); padding:6px 0;">
            Elevate recipe ingredients mapped to default/standard sub-types back up to Root Items or Categories for dynamic product flexibility.
          </div>
        </div>

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

export async function handleIgnoreStoreMapping() {
  // Benign no-op: Pantry-to-product mapping card has been retired.
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
