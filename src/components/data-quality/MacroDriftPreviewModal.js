/**
 * src/components/data-quality/MacroDriftPreviewModal.js
 * Side-by-side comparison & selective approval of Recipe Macro Recalibrations.
 */

import { getState, setRecipes, setPreferences } from '../../store/store.js';
import { batchRecalibrateRecipesInDb } from '../../services/HouseholdRepository.js';
import { calculateRecipeDynamicMacros } from '../../services/DataQualityScannerService.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function openMacroDriftPreviewModal(recipesToRecalibrate = []) {
  const state = getState() || {};
  const ingredients = state.ingredients || [];
  const products = state.products || [];

  // If no specific list, find all recipes with drift dynamically
  let list = recipesToRecalibrate;
  if (!list.length) {
    const recipes = state.recipes || [];
    recipes.forEach(r => {
      const dynamic = calculateRecipeDynamicMacros(r, ingredients, products);
      if (!dynamic) return;
      const storedCal = Number(r.macros?.calories ?? r.calories ?? r.cal ?? 0);
      const calcCal = dynamic.perServing.cal;
      const calDiff = Math.abs(storedCal - calcCal) / Math.max(1, calcCal);
      if (calDiff > 0.02) {
        list.push(r);
      }
    });
  }

  if (!list.length) {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('No recipe macro drifts detected.', 'info');
    }
    return;
  }

  // Pre-calculate recalculations for the table
  const previewData = list.map(r => {
    const dynamic = calculateRecipeDynamicMacros(r, ingredients, products);
    return {
      recipe: r,
      dynamic,
      stored: {
        cal: Number(r.macros?.calories ?? r.calories ?? r.cal ?? 0),
        prot: Number(r.macros?.protein ?? r.protein ?? r.prot ?? 0),
        carb: Number(r.macros?.carbs ?? r.carbs ?? r.carb ?? 0),
        fat: Number(r.macros?.fat ?? r.fat ?? 0),
        price: Number(r.macros?.price ?? r.price ?? r.cost ?? 0)
      },
      calc: {
        cal: Math.round(dynamic?.perServing.cal ?? 0),
        prot: Math.round(dynamic?.perServing.prot ?? 0),
        carb: Math.round(dynamic?.perServing.carb ?? 0),
        fat: Math.round(dynamic?.perServing.fat ?? 0),
        price: Number(dynamic?.perServing.cost ?? 0)
      }
    };
  });

  let modal = document.getElementById('macro-drift-preview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'macro-drift-preview-modal';
    document.body.appendChild(modal);
  }
  modal.className = 'modal active';
  modal.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;padding:16px;';

  const tableRows = previewData.map((d, index) => `
    <tr style="border-bottom: 1px solid var(--border,#e7e5e4); font-size:12.5px;">
      <td style="padding:12px 8px; text-align:left;">
        <input type="checkbox" class="drift-rec-cb" data-index="${index}" checked style="width:16px; height:16px; accent-color:var(--primary,#4f46e5); cursor:pointer;" name="${index}" />
      </td>
      <td style="padding:12px 8px; font-weight:700; text-align:left; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        ${escapeHtml(d.recipe.name || d.recipe.title)}
      </td>
      <td style="padding:12px 8px; color:var(--text2); text-align:center;">
        ${d.stored.cal} kcal<br /><span style="font-size:10.5px;">P: ${d.stored.prot}g · C: ${d.stored.carb}g · F: ${d.stored.fat}g</span>
      </td>
      <td style="padding:12px 8px; color:var(--primary,#4f46e5); font-weight:600; text-align:center;">
        ➔
      </td>
      <td style="padding:12px 8px; color:var(--green,#16a34a); font-weight:700; text-align:center;">
        ${d.calc.cal} kcal<br /><span style="font-size:10.5px;">P: ${d.calc.prot}g · C: ${d.calc.carb}g · F: ${d.calc.fat}g</span>
      </td>
    </tr>
  `).join('');

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:640px; padding:24px; border-radius:14px; background:var(--surface,#fff); box-shadow:0 12px 36px rgba(0,0,0,0.25); display:flex; flex-direction:column; max-height:90vh; box-sizing:border-box;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px;">
        <div>
          <h2 style="font-size:18px; font-weight:750; margin:0; color:var(--text,#1c1917);">Recipe Macro Drift Preview</h2>
          <p style="font-size:12.5px; color:var(--text2,#78716c); margin:4px 0 0 0;">Inspect and selectively approve dynamic updates to template recipe macros.</p>
        </div>
        <button type="button" class="btn sm ghost" style="padding:4px 8px; font-size:16px; line-height:1;" onclick="window.closeMacroDriftPreviewModal()">✕</button>
      </div>

      <div style="flex:1; overflow-y:auto; border:1px solid var(--border,#e7e5e4); border-radius:10px; margin-bottom:18px; background:var(--surface2,#f5f5f4);">
        <table style="width:100%; border-collapse:collapse; text-align:center;">
          <thead>
            <tr style="background:#e7e5e4; font-size:11px; font-weight:800; color:var(--text2); text-transform:uppercase; border-bottom:2px solid #d6d3d1;">
              <th style="padding:10px 8px; text-align:left; width:40px;">
                <input type="checkbox" id="drift-select-all" checked style="width:16px; height:16px; cursor:pointer;" name="drift-select-all" />
              </th>
              <th style="padding:10px 8px; text-align:left;">Recipe</th>
              <th style="padding:10px 8px;">Stored Macros</th>
              <th style="padding:10px 8px; width:40px;"></th>
              <th style="padding:10px 8px;">Calculated Macros</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>

      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button type="button" class="btn sm ghost" onclick="window.closeMacroDriftPreviewModal()">Cancel</button>
        <button type="button" class="btn sm primary" id="drift-approve-btn" style="font-weight:700; background:var(--primary,#4f46e5); color:#fff; border-radius:8px; padding:8px 16px;">Approve &amp; Recalibrate Selected</button>
      </div>
    </div>
  `;

  // Bind select all checkbox
  const selectAllCb = document.getElementById('drift-select-all');
  const rCbs = modal.querySelectorAll('.drift-rec-cb');
  if (selectAllCb) {
    selectAllCb.onchange = () => {
      rCbs.forEach(cb => { cb.checked = selectAllCb.checked; });
    };
  }

  // Bind Recalibrate Button
  document.getElementById('drift-approve-btn').onclick = async () => {
    const selectedIndexes = Array.from(rCbs).filter(cb => cb.checked).map(cb => Number(cb.dataset.index));
    if (selectedIndexes.length === 0) {
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Please select at least one recipe to recalibrate.', 'warning');
      }
      return;
    }

    const updates = [];
    const advisoryKeys = [];

    selectedIndexes.forEach(idx => {
      const item = previewData[idx];
      const r = { ...item.recipe };

      r.macros = {
        calories: item.calc.cal,
        protein: item.calc.prot,
        carbs: item.calc.carb,
        fat: item.calc.fat,
        price: item.calc.price
      };
      r.cal = item.calc.cal;
      r.calories = item.calc.cal;
      r.prot = item.calc.prot;
      r.protein = item.calc.prot;
      r.carb = item.calc.carb;
      r.carbs = item.calc.carb;
      r.fat = item.calc.fat;
      r.updatedAt = new Date().toISOString();

      // Clear warning flags
      delete r.dataQualityWarning;
      delete r.hasMacroSyncIssue;
      delete r.hasLowCalIssue;
      delete r.macroWarning;
      r.isMacroSynchronized = true;

      updates.push(r);
      advisoryKeys.push(`advisory:recipe-macro-sync:${r.id}`);
      advisoryKeys.push(`advisory:recipe-low-cal:${r.id}`);
    });

    window.closeMacroDriftPreviewModal();

    // 1. Optimistic Local State Update
    const currentRecipes = [...(state.recipes || [])];
    updates.forEach(u => {
      const idx = currentRecipes.findIndex(rec => String(rec.id) === String(u.id));
      if (idx >= 0) currentRecipes[idx] = u;
    });

    setRecipes(currentRecipes);

    // Update local preferences dismissedQualityAdvisories so warning disappears immediately
    const currentPrefs = state.preferences || state.userPrefs || {};
    const dismissed = Array.isArray(currentPrefs.dismissedQualityAdvisories)
      ? [...currentPrefs.dismissedQualityAdvisories]
      : [];
    advisoryKeys.forEach(k => { if (!dismissed.includes(k)) dismissed.push(k); });
    const updatedPrefs = { ...currentPrefs, dismissedQualityAdvisories: dismissed };
    setPreferences(updatedPrefs);

    if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();

    // 2. Atomic DB Write Batch Commit
    try {
      await batchRecalibrateRecipesInDb(updates, advisoryKeys);
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast(`Successfully recalibrated ${updates.length} recipes atomically.`, 'success');
      }
    } catch (e) {
      console.error('[MacroDriftPreviewModal] DB batch update failed:', e);
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Database write failed. Reverting changes.', 'error');
      }
      // Revert local store by re-hydrating or reloading
      if (typeof window.Store !== 'undefined' && typeof window.Store.setState === 'function') {
        window.Store.setState({ recipes: state.recipes, preferences: state.preferences });
      }
      if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
    }
  };
}

export function closeMacroDriftPreviewModal() {
  const modal = document.getElementById('macro-drift-preview-modal');
  if (modal) {
    modal.className = 'modal';
    modal.style.display = 'none';
  }
}

if (typeof window !== 'undefined') {
  window.openMacroDriftPreviewModal = openMacroDriftPreviewModal;
  window.closeMacroDriftPreviewModal = closeMacroDriftPreviewModal;
}
