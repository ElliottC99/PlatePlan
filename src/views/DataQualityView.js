/**
 * src/views/DataQualityView.js
 * Comprehensive, Self-Healing Data Quality Centre View with direct Audit Engine bindings.
 * Handled via optimistic Store updates, Firestore batching, and context-aware modal routing.
 */

import { getState, setPreferences, setIngredients, runOptimisticMutation } from '../store/store.js';
import { saveIngredient, savePreferences, dismissAdvisoryInDb } from '../services/HouseholdRepository.js';
import { runAudit } from '../services/DataQualityEngine.js';
import { openMacroDriftPreviewModal } from '../components/data-quality/MacroDriftPreviewModal.js';
import { openSubtypeOrphanResolverModal } from '../components/data-quality/SubtypeOrphanResolverModal.js';
import { openMealPlanSyncWarningModal } from '../components/data-quality/MealPlanSyncWarningModal.js';
import { openMergeIngredientsModal } from '../components/data-quality/MergeIngredientsModal.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

/**
 * Dismiss an advisory key optimistically with granular server-side arrayUnion updates.
 */
export async function dismissAdvisory(issueKey) {
  const state = getState() || {};
  const currentPrefs = state.preferences || state.userPrefs || {};
  const previousPrefs = JSON.parse(JSON.stringify(currentPrefs));

  const mutateFn = (currentState) => {
    const prefs = currentState.preferences || currentState.userPrefs || {};
    const dismissed = Array.isArray(prefs.dismissedQualityAdvisories)
      ? [...prefs.dismissedQualityAdvisories]
      : [];
    if (!dismissed.includes(issueKey)) {
      dismissed.push(issueKey);
    }
    currentState.preferences = {
      ...prefs,
      dismissedQualityAdvisories: dismissed
    };
    currentState.userPrefs = currentState.preferences;
  };

  const rollbackFn = (currentState) => {
    currentState.preferences = previousPrefs;
    currentState.userPrefs = previousPrefs;
  };

  try {
    await runOptimisticMutation(
      'preferences',
      mutateFn,
      dismissAdvisoryInDb(issueKey),
      rollbackFn,
      'Failed to dismiss advisory. Reverted.'
    );
    renderDataQualityView();
    updateDataQualityBadge();
  } catch (err) {
    console.error('[DataQualityView] dismissAdvisory error:', err);
  }
}

/**
 * Perform a global product relinking operation
 */
export async function runGlobalProductRelink() {
  try {
    const state = getState() || {};
    const products = Array.isArray(state.products) ? [...state.products] : [];
    const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];

    let modifiedCount = 0;
    const resolvedProducts = products.map(p => {
      if (p.ingredientId) return p;

      // Match by product name substring to any ingredient name
      const pName = String(p.name || '').toLowerCase().trim();
      const matchedIng = ingredients.find(ing => {
        const ingName = String(ing.name || '').toLowerCase().trim();
        return pName.includes(ingName) || ingName.includes(pName);
      });

      if (matchedIng) {
        modifiedCount++;
        return {
          ...p,
          ingredientId: matchedIng.id,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });

    if (modifiedCount === 0) {
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Catalog is already fully linked.', 'info');
      }
      return;
    }

    // Save and notify
    if (typeof window.Store !== 'undefined' && typeof window.Store.setState === 'function') {
      window.Store.setState({ products: resolvedProducts });
    }
    renderDataQualityView();

    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast(`Relinked ${modifiedCount} products automatically.`, 'success');
    }
  } catch (err) {
    console.error('[DataQualityView] runGlobalProductRelink error:', err);
  }
}

/**
 * Instant self-healing: Verify Zero Calories on an ingredient
 */
export async function handleVerifyZeroCal(ingredientId) {
  const state = getState() || {};
  const ingredients = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  const ingIndex = ingredients.findIndex(i => String(i.id) === String(ingredientId));
  if (ingIndex < 0) return;

  const originalIng = ingredients[ingIndex];
  const updatedIng = {
    ...originalIng,
    cal: 0,
    calories: 0,
    prot: 0,
    protein: 0,
    carb: 0,
    carbs: 0,
    fat: 0,
    isVerifiedZero: true,
    isVerifiedZeroCal: true,
    updatedAt: new Date().toISOString()
  };

  ingredients[ingIndex] = updatedIng;

  // 1. Optimistic Local Update
  setIngredients(ingredients);
  renderDataQualityView();

  // 2. Persist
  try {
    await saveIngredient(updatedIng);
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast(`"${updatedIng.name}" verified as zero-cal ingredient.`, 'success');
    }
  } catch (e) {
    console.error('[DataQualityView] Failed to save verified zero-cal:', e);
    // Rollback
    ingredients[ingIndex] = originalIng;
    setIngredients(ingredients);
    renderDataQualityView();
  }
}

/**
 * Instant self-healing: Ignore Store Mapping for an ingredient
 */
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

  // 1. Optimistic Local Update
  setIngredients(ingredients);
  renderDataQualityView();

  // 2. Persist
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

/**
 * Instant self-healing: Truncate advisory history & clear snaps
 */
export async function handleCleanHistoryCache() {
  const state = getState() || {};
  const currentPrefs = state.preferences || state.userPrefs || {};
  const previousPrefs = JSON.parse(JSON.stringify(currentPrefs));

  const dismissed = Array.isArray(currentPrefs.dismissedQualityAdvisories)
    ? [...currentPrefs.dismissedQualityAdvisories]
    : [];

  const prunedDismissed = dismissed.slice(-30); // Truncate to 30 items

  const updatedPrefs = {
    ...currentPrefs,
    dismissedQualityAdvisories: prunedDismissed,
    advisoryHistory: [],
    snapshots: [],
    stateSnapshots: []
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
      savePreferences(updatedPrefs),
      rollbackFn,
      'Failed to clean preference history cache.'
    );
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Preference storage cleaned successfully (cached snapshots deleted).', 'success');
    }
    renderDataQualityView();
  } catch (err) {
    console.error('[DataQualityView] handleCleanHistoryCache error:', err);
  }
}

/**
 * Core rendering view
 */
export function renderDataQualityView() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('view-data');
  if (!container) return;

  const state = getState() || {};
  const audit = runAudit(state);

  // Helper to render individual audit rows
  const renderAuditCard = (title, icon, items, renderer) => {
    const listHtml = items.map(renderer).join('');
    const count = items.length;
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

  container.innerHTML = `
    <div style="max-width:900px; margin:0 auto; padding:20px; box-sizing:border-box;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="font-size:22px; font-weight:750; margin:0; color:var(--text,#1c1917)">Data Quality Overhaul Dashboard</h2>
          <p style="margin:4px 0 0 0; font-size:13px; color:var(--text2,#78716c)">Catalogue audit scanner, recipe macro validation, and self-healing structural health checks.</p>
        </div>
        <div style="display:flex; gap:8px;">
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
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary rec-auto-recal-btn" data-recipe-id="${escapeAttr(item.recipeId)}" style="background:var(--primary,#4f46e5); color:#fff;">Auto-Recalibrate</button>
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

        <!-- 3. INCOMPLETE / ATWATER MATH CARD -->
        ${renderAuditCard('Incomplete Nutrition & Atwater Discrepancy', '🔬', audit.atwaterMath, (item) => `
          <div style="padding:10px 12px; background:#fff; border:1px solid var(--border); border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:0;">
              <strong style="font-size:13px; color:#111827;">${escapeHtml(item.ingredientName)}</strong>
              <div style="font-size:11.5px; color:var(--text2); margin-top:2px;">${escapeHtml(item.message)}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" class="btn sm primary math-fix-macros-btn" data-ing-id="${escapeAttr(item.ingredientId)}" style="background:var(--primary,#4f46e5); color:#fff;">Fix Macros</button>
              ${item.type === 'atwater' ? `<button type="button" class="btn sm ghost math-verify-zero-btn" data-ing-id="${escapeAttr(item.ingredientId)}">Verify Zero-Cal</button>` : ''}
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
  document.getElementById('dq-btn-relink').onclick = runGlobalProductRelink;
  document.getElementById('dq-btn-refresh').onclick = () => renderDataQualityView();

  // Wire actions inside audit rows using event delegation
  container.querySelectorAll('.rec-auto-recal-btn').forEach(btn => {
    btn.onclick = () => {
      const rId = btn.dataset.recipeId;
      const recipes = state.recipes || [];
      const recipe = recipes.find(r => String(r.id) === String(rId));
      if (recipe) {
        openMacroDriftPreviewModal([recipe]);
      }
    };
  });

  container.querySelectorAll('.rec-manual-inspect-btn').forEach(btn => {
    btn.onclick = () => {
      window.__modalContext = { returnTo: 'data-quality' };
      if (typeof window.viewRecipe === 'function') {
        window.viewRecipe(btn.dataset.recipeId);
      }
    };
  });

  container.querySelectorAll('.plan-sync-active-btn').forEach(btn => {
    btn.onclick = () => {
      const issue = {
        dayKey: btn.dataset.day,
        mealKey: btn.dataset.meal,
        recipeId: btn.dataset.recipeId,
        recipeName: btn.dataset.recipeName,
        nodeCal: Number(btn.dataset.nodeCal),
        nodeProt: Number(btn.dataset.nodeProt),
        tempCal: Number(btn.dataset.tempCal),
        tempProt: Number(btn.dataset.tempProt)
      };
      openMealPlanSyncWarningModal(issue);
    };
  });

  container.querySelectorAll('.math-fix-macros-btn').forEach(btn => {
    btn.onclick = () => {
      window.__modalContext = { returnTo: 'data-quality', targetTab: 'macros' };
      if (typeof window.openIngredientFamilyDetailsModal === 'function') {
        window.openIngredientFamilyDetailsModal(btn.dataset.ingId);
      }
    };
  });

  container.querySelectorAll('.math-verify-zero-btn').forEach(btn => {
    btn.onclick = () => {
      handleVerifyZeroCal(btn.dataset.ingId);
    };
  });

  container.querySelectorAll('.density-add-conversion-btn').forEach(btn => {
    btn.onclick = () => {
      window.__modalContext = { returnTo: 'data-quality' };
      if (typeof window.openIngredientFamilyDetailsModal === 'function') {
        window.openIngredientFamilyDetailsModal(btn.dataset.ingId);
      }
    };
  });

  container.querySelectorAll('.orphan-resolve-btn').forEach(btn => {
    btn.onclick = () => {
      const issue = {
        subtypeId: btn.dataset.subtypeId,
        parentId: btn.dataset.parentId
      };
      openSubtypeOrphanResolverModal(issue);
    };
  });

  container.querySelectorAll('.unmapped-tesco-btn').forEach(btn => {
    btn.onclick = () => {
      window.__modalContext = { returnTo: 'data-quality' };
      if (typeof window.openTescoImportModal === 'function') {
        window.openTescoImportModal(null, btn.dataset.ingId);
      }
    };
  });

  container.querySelectorAll('.unmapped-ignore-btn').forEach(btn => {
    btn.onclick = () => {
      handleIgnoreStoreMapping(btn.dataset.ingId);
    };
  });

  container.querySelectorAll('.duplicate-merge-btn').forEach(btn => {
    btn.onclick = () => {
      const issue = {
        ing1Id: btn.dataset.ing1Id,
        ing2Id: btn.dataset.ing2Id
      };
      openMergeIngredientsModal(issue);
    };
  });

  container.querySelectorAll('.health-clean-btn').forEach(btn => {
    btn.onclick = () => {
      handleCleanHistoryCache();
    };
  });
}

export function updateDataQualityBadge() {
  const badge = document.getElementById('dq-badge-count');
  if (!badge) return;
  const state = getState() || {};
  const audit = runAudit(state);
  const total = audit.totalCount;
  badge.textContent = total;
  badge.style.display = total > 0 ? 'inline-flex' : 'none';
}

function initDataQualitySubscriptions() {
  if (typeof document === 'undefined') return;
  document.addEventListener('plateplan:state:ingredients', () => { renderDataQualityView(); updateDataQualityBadge(); });
  document.addEventListener('plateplan:state:products', () => { renderDataQualityView(); updateDataQualityBadge(); });
  document.addEventListener('plateplan:state:recipes', () => { renderDataQualityView(); updateDataQualityBadge(); });
  document.addEventListener('plateplan:state:plan', () => { renderDataQualityView(); updateDataQualityBadge(); });
  document.addEventListener('plateplan:state:preferences', () => { renderDataQualityView(); updateDataQualityBadge(); });
}

export function mount(container) {
  initDataQualitySubscriptions();
  renderDataQualityView();
  updateDataQualityBadge();
}

if (typeof window !== 'undefined') {
  window.renderDataQualityView = renderDataQualityView;
  window.renderDataQuality = renderDataQualityView;
  window.updateDataQualityBadge = updateDataQualityBadge;
}
