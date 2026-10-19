/**
 * src/components/data-quality/UnlinkedSweeperUI.js (v3.35.23)
 * "Unlinked Ingredient Sweeper" Wizard UI Component.
 *
 * Scans store.recipes for unlinked ingredients (where pantryItemId / ingredientId is missing or null),
 * groups identical unlinked strings (e.g. all instances of "Macaroni"),
 * and presents them in a rapid-fire list to map them in bulk to master Pantry Bank items.
 *
 * Respects strict architectural boundaries:
 * - Pure ES6 module, no window state mutations
 * - Uses Proxy Store (getState, setRecipes)
 * - Quarantine Firebase writes to HouseholdRepository.batchUpdateRecipesInDb
 */

import { getState, setRecipes } from '../../store/store.js';
import { batchUpdateRecipesInDb } from '../../services/HouseholdRepository.js';

let activeModalOverlay = null;

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

/**
 * Normalises an ingredient raw/name string for grouping.
 * @param {string} str
 * @returns {string}
 */
export function normaliseIngredientString(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/^[\d\s\/\.\-\u00BC-\u00BE\u2150-\u215E]+(?:g|kg|ml|l|oz|lb|tbsp|tsp|cup|cups|scoop|scoops|pinch|can|clove|slice|slices)?\s+(?:of\s+)?/i, '')
    .trim();
}

/**
 * Scans all recipes in the Store and groups unlinked ingredient strings.
 * @returns {Array<{ normalisedKey: string, displayName: string, count: number, occurrences: Array<{ recipeId: string, recipeName: string, sectionIdx: number|null, itemIdx: number }> }>}
 */
export function scanUnlinkedRecipeIngredients() {
  const state = getState() || {};
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const groups = new Map();

  recipes.forEach(recipe => {
    if (!recipe || !recipe.id) return;
    const recipeName = recipe.title || recipe.name || 'Untitled Recipe';

    const checkItem = (item, sectionIdx, itemIdx) => {
      if (!item) return;
      const hasLink = Boolean(
        item.pantryItemId ||
        item.ingredientId ||
        item.targetId ||
        (item.id && typeof item.id === 'string' && item.id.length > 3)
      );

      if (!hasLink) {
        const rawText = typeof item === 'string'
          ? item
          : (item.raw || item.name || item.ingredient || item.ingredientName || '');
        const norm = normaliseIngredientString(rawText);
        if (!norm) return;

        if (!groups.has(norm)) {
          groups.set(norm, {
            normalisedKey: norm,
            displayName: rawText || norm,
            count: 0,
            occurrences: []
          });
        }

        const group = groups.get(norm);
        group.count++;
        group.occurrences.push({
          recipeId: recipe.id,
          recipeName,
          sectionIdx,
          itemIdx
        });
      }
    };

    if (Array.isArray(recipe.ingredientSections) && recipe.ingredientSections.length > 0) {
      recipe.ingredientSections.forEach((sec, sIdx) => {
        if (Array.isArray(sec.ingredients)) {
          sec.ingredients.forEach((ing, iIdx) => checkItem(ing, sIdx, iIdx));
        }
      });
    } else if (Array.isArray(recipe.ingredients)) {
      recipe.ingredients.forEach((ing, iIdx) => checkItem(ing, null, iIdx));
    }
  });

  return Array.from(groups.values()).sort((a, b) => b.count - a.count || a.normalisedKey.localeCompare(b.normalisedKey));
}

/**
 * Builds selectable options from the master Pantry Bank.
 * @param {Array<Object>} ingredients
 * @returns {string}
 */
function buildPantryOptions(ingredients = []) {
  const sorted = [...ingredients].sort((a, b) =>
    (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || '')
  );

  const opts = ['<option value="">-- Select Master Pantry Item --</option>'];
  sorted.forEach(ing => {
    if (!ing || !ing.id) return;
    const catLabel = ing.category ? `[${ing.category}] ` : '';
    opts.push(`<option value="${escapeAttr(ing.id)}">${catLabel}${escapeHtml(ing.name)}</option>`);

    if (Array.isArray(ing.subtypes) && ing.subtypes.length > 0) {
      ing.subtypes.forEach(sub => {
        if (!sub || !sub.id) return;
        opts.push(`<option value="${escapeAttr(ing.id)}:${escapeAttr(sub.id)}">&nbsp;&nbsp;↳ ${escapeHtml(ing.name)} ➔ ${escapeHtml(sub.name)} (Sub-type)</option>`);
      });
    }
  });

  return opts.join('');
}

/**
 * Closes the Unlinked Sweeper Modal.
 */
export function closeUnlinkedSweeperModal() {
  if (activeModalOverlay) {
    activeModalOverlay.remove();
    activeModalOverlay = null;
  }
  document.body.style.overflow = '';
}

/**
 * Opens and renders the "Unlinked Ingredient Sweeper" Wizard Modal.
 */
export function openUnlinkedSweeperModal() {
  closeUnlinkedSweeperModal();

  const state = getState() || {};
  const pantryIngredients = Array.isArray(state.ingredients) ? state.ingredients : [];
  const unlinkedGroups = scanUnlinkedRecipeIngredients();

  activeModalOverlay = document.createElement('div');
  activeModalOverlay.id = 'unlinked-sweeper-modal-overlay';
  activeModalOverlay.className = 'modal-backdrop-custom';
  activeModalOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

  const pantryOptionsHtml = buildPantryOptions(pantryIngredients);

  const rowsHtml = unlinkedGroups.length === 0
    ? `<div style="text-align:center;padding:48px 20px;color:var(--text2,#64748b);">
        <span style="font-size:36px;display:block;margin-bottom:12px;">🎉</span>
        <strong style="font-size:16px;color:var(--text,#111827);">All Recipe Ingredients Linked!</strong>
        <p style="font-size:13px;margin-top:6px;">No unlinked ingredient strings found across your recipes.</p>
       </div>`
    : unlinkedGroups.map((g, idx) => `
      <div class="sweeper-row" data-norm="${escapeAttr(g.normalisedKey)}" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:10px;margin-bottom:8px;">
        <div style="flex:1;min-width:200px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <strong style="font-size:14px;color:var(--text,#0f172a);">${escapeHtml(g.displayName)}</strong>
            <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#e0f2fe;color:#0369a1;">
              ${g.count} recipe${g.count > 1 ? 's' : ''}
            </span>
          </div>
          <div style="font-size:11.5px;color:var(--text2,#64748b);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px;" title="${escapeAttr(g.occurrences.map(o => o.recipeName).join(', '))}">
            Used in: ${escapeHtml(g.occurrences.map(o => o.recipeName).slice(0, 3).join(', '))}${g.occurrences.length > 3 ? ` +${g.occurrences.length - 3} more` : ''}
          </div>
        </div>
        <div style="flex:1;min-width:240px;max-width:320px;">
          <select class="sweeper-target-select" data-idx="${idx}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border,#cbd5e1);font-size:13px;background:var(--surface,#fff);color:var(--text,#1e293b);">
            ${pantryOptionsHtml}
          </select>
        </div>
      </div>
    `).join('');

  activeModalOverlay.innerHTML = `
    <div class="sweeper-dialog" style="width:100%;max-width:760px;max-height:88vh;background:var(--surface,#fff);border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.3);display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;">
      
      <!-- Modal Header -->
      <div style="padding:18px 24px;border-bottom:1px solid var(--border,#e2e8f0);display:flex;align-items:center;justify-content:space-between;background:var(--surface2,#f8fafc);">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:750;color:var(--text,#0f172a);display:flex;align-items:center;gap:8px;">
            <span>🧹</span> Unlinked Ingredient Sweeper
          </h2>
          <p style="margin:4px 0 0;font-size:12.5px;color:var(--text2,#64748b);">
            Rapid-fire bulk mapping: link recurring unlinked recipe ingredients to Master Pantry items.
          </p>
        </div>
        <button type="button" class="btn sm ghost" id="sweeper-close-btn" style="border:none;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:6px;" aria-label="Close">✕</button>
      </div>

      <!-- Sweeper List Content -->
      <div style="padding:16px 24px;overflow-y:auto;flex:1;background:var(--surface2,#f8fafc);" id="sweeper-list-container">
        ${rowsHtml}
      </div>

      <!-- Modal Footer -->
      <div style="padding:14px 24px;border-top:1px solid var(--border,#e2e8f0);display:flex;align-items:center;justify-content:space-between;background:var(--surface,#fff);">
        <div style="font-size:12.5px;color:var(--text2,#64748b);">
          ${unlinkedGroups.length > 0 ? `<strong>${unlinkedGroups.length}</strong> unique unlinked phrases found` : 'All ingredients mapped'}
        </div>
        <div style="display:flex;gap:10px;">
          <button type="button" class="btn sm ghost" id="sweeper-cancel-btn" style="padding:8px 16px;font-weight:600;">Cancel</button>
          <button type="button" class="btn sm primary" id="sweeper-save-all-btn" ${unlinkedGroups.length === 0 ? 'disabled' : ''} style="padding:8px 20px;font-weight:600;background:var(--primary,#4f46e5);color:#fff;border-radius:8px;">
            ⚡ Apply Selected Links
          </button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(activeModalOverlay);
  document.body.style.overflow = 'hidden';

  // Wire close & cancel buttons
  document.getElementById('sweeper-close-btn').onclick = closeUnlinkedSweeperModal;
  document.getElementById('sweeper-cancel-btn').onclick = closeUnlinkedSweeperModal;

  // Wire bulk mapping save button
  const saveBtn = document.getElementById('sweeper-save-all-btn');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const selects = activeModalOverlay.querySelectorAll('.sweeper-target-select');
      const assignments = []; // Array<{ group: Object, targetValue: string }>

      selects.forEach(sel => {
        const val = sel.value;
        if (!val) return;
        const idx = parseInt(sel.dataset.idx, 10);
        const group = unlinkedGroups[idx];
        if (group) {
          assignments.push({ group, targetValue: val });
        }
      });

      if (assignments.length === 0) {
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Please select at least one pantry item to link.', 'warning');
        }
        saveBtn.disabled = false;
        saveBtn.textContent = '⚡ Apply Selected Links';
        return;
      }

      await applySweeperBatchMappings(assignments);
      closeUnlinkedSweeperModal();
    };
  }
}

/**
 * Applies the selected mappings to all affected recipes, updating local store and Firestore.
 * @param {Array<{ group: Object, targetValue: string }>} assignments
 */
async function applySweeperBatchMappings(assignments = []) {
  const state = getState() || {};
  const recipes = Array.isArray(state.recipes) ? [...state.recipes] : [];
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];

  const recipeMap = new Map();
  recipes.forEach(r => {
    if (r && r.id) recipeMap.set(String(r.id), JSON.parse(JSON.stringify(r)));
  });

  const pantryMap = new Map();
  ingredients.forEach(i => {
    if (i && i.id) pantryMap.set(String(i.id), i);
  });

  let totalUpdatedItems = 0;
  const modifiedRecipeIds = new Set();

  assignments.forEach(({ group, targetValue }) => {
    let ingId = targetValue;
    let subId = null;

    if (targetValue.includes(':')) {
      const parts = targetValue.split(':');
      ingId = parts[0];
      subId = parts[1] || null;
    }

    const masterIng = pantryMap.get(String(ingId));
    const masterName = masterIng?.name || group.displayName;

    let subName = '';
    if (subId && masterIng && Array.isArray(masterIng.subtypes)) {
      const foundSub = masterIng.subtypes.find(s => String(s.id) === String(subId));
      if (foundSub) subName = foundSub.name;
    }

    group.occurrences.forEach(occ => {
      const recipe = recipeMap.get(String(occ.recipeId));
      if (!recipe) return;

      const updateTarget = (item) => {
        if (!item) return;
        item.pantryItemId = String(ingId);
        item.ingredientId = String(ingId);
        if (subId) {
          item.subtypeId = String(subId);
          item.subtypeName = subName;
        }
        item.name = subName ? `${masterName} (${subName})` : masterName;
        totalUpdatedItems++;
        modifiedRecipeIds.add(String(recipe.id));
      };

      if (occ.sectionIdx !== null && Array.isArray(recipe.ingredientSections)) {
        const sec = recipe.ingredientSections[occ.sectionIdx];
        if (sec && Array.isArray(sec.ingredients)) {
          updateTarget(sec.ingredients[occ.itemIdx]);
        }
      } else if (Array.isArray(recipe.ingredients)) {
        updateTarget(recipe.ingredients[occ.itemIdx]);
      }
    });
  });

  const modifiedRecipes = Array.from(modifiedRecipeIds).map(id => recipeMap.get(id));

  // 1. Optimistic Proxy Store update
  const updatedAllRecipes = recipes.map(r => recipeMap.get(String(r.id)) || r);
  setRecipes(updatedAllRecipes);

  if (typeof window !== 'undefined') {
    if (window.state) window.state.recipes = updatedAllRecipes;
    if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
  }

  // 2. Quarantine Firebase Batch write in HouseholdRepository
  try {
    const res = await batchUpdateRecipesInDb(modifiedRecipes);
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast(`Successfully mapped ${totalUpdatedItems} ingredients across ${modifiedRecipes.length} recipes!`, 'success');
    }
    console.log(`[UnlinkedSweeperUI] Batch sweep applied: ${totalUpdatedItems} items linked in ${modifiedRecipes.length} recipes.`);
    return res;
  } catch (err) {
    console.error('[UnlinkedSweeperUI] Batch write failed:', err);
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Failed to save ingredient mappings to database.', 'error');
    }
  }
}

if (typeof window !== 'undefined') {
  window.openUnlinkedSweeperModal = openUnlinkedSweeperModal;
  window.closeUnlinkedSweeperModal = closeUnlinkedSweeperModal;
}
