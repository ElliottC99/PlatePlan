/**
 * src/components/data-quality/UnlinkedSweeperUI.js (v3.35.27)
 * "Unlinked Ingredient Sweeper" Wizard UI Component.
 * Replicates the Recipe Wizard's hierarchical taxonomy search with "✨ New Item" creation trigger.
 */

import { getState, setRecipes } from '../../store/store.js';
import { batchUpdateRecipesInDb } from '../../services/HouseholdRepository.js';
import { openTaxonomyCreationModal } from '../recipe/RecipeWizardTaxonomyModal.js';

let activeModalOverlay = null;

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

const PREFIX_REGEX = /^[\d\s\/\.\-\u00BC-\u00BE\u2150-\u215E]+(?:g|kg|ml|l|oz|lb|tbsp|tsp|cup|cups|scoop|scoops|pinch|can|cans|clove|cloves|slice|slices|packet|packets|bunch|bunches|piece|pieces|head|heads)?\s+(?:of\s+)?/i;

export function normaliseIngredientString(str) {
  return str ? String(str).replace(PREFIX_REGEX, '').trim().toLowerCase() : '';
}

export function cleanDisplayPhrase(str) {
  if (!str) return '';
  const c = String(str).replace(PREFIX_REGEX, '').trim();
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : '';
}

export function scanUnlinkedRecipeIngredients() {
  const state = (typeof window !== 'undefined' ? (window.Store?.getState?.() ) : {});
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const groups = new Map();

  recipes.forEach(recipe => {
    if (!recipe?.id) return;
    const rName = recipe.title || recipe.name || 'Untitled Recipe';

    const check = (item, sIdx, iIdx) => {
      if (!item) return;
      const linked = Boolean(item.pantryItemId || item.ingredientId || item.targetId || (item.id && typeof item.id === 'string' && item.id.length > 3));
      if (!linked) {
        const raw = typeof item === 'string' ? item : (item.raw || item.name || item.ingredient || item.ingredientName || '');
        const key = normaliseIngredientString(raw).toLowerCase();
        if (!key) return;
        if (!groups.has(key)) groups.set(key, { normalisedKey: key, displayName: cleanDisplayPhrase(raw) || key, count: 0, occurrences: [] });
        const g = groups.get(key);
        g.count++;
        g.occurrences.push({ recipeId: recipe.id, recipeName: rName, sectionIdx: sIdx, itemIdx: iIdx });
      }
    };

    if (Array.isArray(recipe.ingredientSections) && recipe.ingredientSections.length) {
      recipe.ingredientSections.forEach((sec, sIdx) => { if (Array.isArray(sec.ingredients)) sec.ingredients.forEach((ing, iIdx) => check(ing, sIdx, iIdx)); });
    } else if (Array.isArray(recipe.ingredients)) {
      recipe.ingredients.forEach((ing, iIdx) => check(ing, null, iIdx));
    }
  });

  return Array.from(groups.values()).sort((a, b) => b.count - a.count || a.normalisedKey.localeCompare(b.normalisedKey));
}

export function closeUnlinkedSweeperModal() {
  if (activeModalOverlay) { activeModalOverlay.remove(); activeModalOverlay = null; }
  document.body.style.overflow = '';
}

export function openUnlinkedSweeperModal() {
  closeUnlinkedSweeperModal();
  const unlinkedGroups = scanUnlinkedRecipeIngredients();

  activeModalOverlay = document.createElement('div');
  activeModalOverlay.id = 'unlinked-sweeper-modal-overlay';
  activeModalOverlay.className = 'modal-backdrop-custom';
  activeModalOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

  const rowsHtml = !unlinkedGroups.length
    ? `<div style="text-align:center;padding:48px 20px;color:var(--text2,#64748b);"><span style="font-size:36px;display:block;margin-bottom:12px;">🎉</span><strong style="font-size:16px;color:var(--text,#111827);">All Recipe Ingredients Linked!</strong><p style="font-size:13px;margin-top:6px;">No unlinked ingredient strings found across your recipes.</p></div>`
    : unlinkedGroups.map((g, idx) => `
      <div class="sweeper-row" data-norm="${escapeAttr(g.normalisedKey)}" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:10px;margin-bottom:8px;">
        <div style="flex:1;min-width:200px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <strong style="font-size:14px;color:var(--text,#0f172a);">${escapeHtml(g.displayName)}</strong>
            <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#e0f2fe;color:#0369a1;">${g.count} recipe${g.count > 1 ? 's' : ''}</span>
          </div>
          <div style="font-size:11.5px;color:var(--text2,#64748b);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px;" title="${escapeAttr(g.occurrences.map(o => o.recipeName).join(', '))}">Used in: ${escapeHtml(g.occurrences.map(o => o.recipeName).slice(0, 3).join(', '))}${g.occurrences.length > 3 ? ` +${g.occurrences.length - 3} more` : ''}</div>
        </div>
        <div style="flex:1;min-width:240px;max-width:320px;position:relative;" class="pantry-search-container relative">
          <input type="text" class="pantry-search-input" placeholder="Search Master Pantry..." data-idx="${idx}" data-phrase="${escapeAttr(g.normalisedKey)}" data-selected-id="" data-selected-sub-id="" autocomplete="off" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border,#cbd5e1);font-size:13px;background:var(--surface,#fff);color:var(--text,#1e293b);box-sizing:border-box;" />
          <div class="pantry-search-dropdown hidden absolute bg-white shadow-lg w-full z-10 max-h-48 overflow-y-auto" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:220px;overflow-y:auto;background:#fff;border:1px solid var(--border,#e2e8f0);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);z-index:20;margin-top:2px;"></div>
        </div>
      </div>
    `).join('');

  activeModalOverlay.innerHTML = `
    <div class="sweeper-dialog" style="width:100%;max-width:760px;max-height:88vh;background:var(--surface,#fff);border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.3);display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;">
      <div style="padding:18px 24px;border-bottom:1px solid var(--border,#e2e8f0);display:flex;align-items:center;justify-content:space-between;background:var(--surface2,#f8fafc);">
        <div><h2 style="margin:0;font-size:18px;font-weight:750;color:var(--text,#0f172a);display:flex;align-items:center;gap:8px;"><span>🧹</span> Unlinked Ingredient Sweeper</h2><p style="margin:4px 0 0;font-size:12.5px;color:var(--text2,#64748b);">Rapid-fire bulk mapping: link recurring unlinked recipe ingredients to Master Pantry items.</p></div>
        <button type="button" class="btn sm ghost" id="sweeper-close-btn" style="border:none;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:6px;" aria-label="Close">✕</button>
      </div>
      <div style="padding:16px 24px;overflow-y:auto;flex:1;background:var(--surface2,#f8fafc);" id="sweeper-list-container">${rowsHtml}</div>
      <div style="padding:14px 24px;border-top:1px solid var(--border,#e2e8f0);display:flex;align-items:center;justify-content:space-between;background:var(--surface,#fff);">
        <div style="font-size:12.5px;color:var(--text2,#64748b);">${unlinkedGroups.length ? `<strong>${unlinkedGroups.length}</strong> unique unlinked phrases found` : 'All ingredients mapped'}</div>
        <div style="display:flex;gap:10px;">
          <button type="button" class="btn sm ghost" id="sweeper-cancel-btn" style="padding:8px 16px;font-weight:600;">Cancel</button>
          <button type="button" class="btn sm primary" id="sweeper-save-all-btn" ${!unlinkedGroups.length ? 'disabled' : ''} style="padding:8px 20px;font-weight:600;background:var(--primary,#4f46e5);color:#fff;border-radius:8px;">⚡ Apply Selected Links</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(activeModalOverlay);
  document.body.style.overflow = 'hidden';

  document.getElementById('sweeper-close-btn').addEventListener('click', closeUnlinkedSweeperModal);
  document.getElementById('sweeper-cancel-btn').addEventListener('click', closeUnlinkedSweeperModal);
  attachSweeperSearchEvents(activeModalOverlay, unlinkedGroups);

  const saveBtn = document.getElementById('sweeper-save-all-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      const inputs = activeModalOverlay.querySelectorAll('.pantry-search-input');
      const assignments = [];
      inputs.forEach(input => {
        const ingId = input.dataset.selectedId;
        if (!ingId) return;
        const group = unlinkedGroups[parseInt(input.dataset.idx, 10)];
        if (group) assignments.push({ group, ingId, subId: input.dataset.selectedSubId || null });
      });

      if (!assignments.length) {
        if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast('Please select at least one pantry item to link.', 'warning');
        saveBtn.disabled = false;
        saveBtn.textContent = '⚡ Apply Selected Links';
        return;
      }
      await applySweeperBatchMappings(assignments);
      closeUnlinkedSweeperModal();
    });
  }
}

function attachSweeperSearchEvents(container, unlinkedGroups = []) {
  const inputs = container.querySelectorAll('.pantry-search-input');
  const STANDARD_CATS = ['Store Cupboard', 'Produce', 'Refrigerated & Dairy', 'Frozen', 'Bakery', 'Spices & Oils'];

  inputs.forEach(input => {
    const parent = input.closest('.pantry-search-container');
    const dropdown = parent?.querySelector('.pantry-search-dropdown');
    if (!dropdown) return;

    const renderFilteredOptions = () => {
      const query = (input.value || '').toLowerCase().trim();
      const st = window.Store?.getState?.() ;
      const masterItems = st.ingredients || [];
      const masterCategories = Array.from(new Set([...STANDARD_CATS, ...(st.categories || []), ...masterItems.map(i => i.category).filter(Boolean)]));

      let matchCount = 0;
      let html = `<div class="wiz-tax-opt" data-val="new_item" data-label="✨ New Item" style="padding:7px 10px; font-size:12px; cursor:pointer; font-weight:600; color:#059669; border-bottom:1px solid #eee;">✨ New Item</div>`;

      masterCategories.forEach(cat => {
        const catStr = String(cat || '');
        if (!query || catStr.toLowerCase().includes(query) || '[category]'.includes(query)) {
          matchCount++;
          html += `<div class="wiz-tax-opt wiz-tax-category" data-val="cat:${escapeAttr(catStr)}" data-label="📂 [Category] ${escapeAttr(catStr)}" style="padding:6px 10px;font-size:12px;cursor:pointer;font-weight:700;color:var(--purple,#4f46e5);background:var(--surface2,#f5f4ee);border-bottom:1px solid #eee;">📂 <span class="badge" style="background:#eef2ff;color:#4f46e5;font-size:10px;padding:1px 5px;border-radius:4px;margin-right:4px;">[Category]</span> ${escapeHtml(catStr)}</div>`;
        }
      });

      masterItems.forEach(ing => {
        if (!ing?.id) return;
        const ingName = String(ing.name || '').toLowerCase();
        const ingCat = String(ing.category || '').toLowerCase();
        const subTypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];
        const matchesMain = !query || ingName.includes(query) || ingCat.includes(query);
        const matchingSubs = subTypes.filter(s => !query || String(s.name || '').toLowerCase().includes(query) || ingName.includes(query));

        if (matchesMain || matchingSubs.length > 0) {
          matchCount++;
          html += `<div class="wiz-tax-opt wiz-tax-main" data-val="${escapeAttr(ing.id)}" data-label="📦 ${escapeAttr(ing.name)} [${escapeAttr(ing.category || 'General')}]" style="padding:6px 10px;font-size:12px;cursor:pointer;font-weight:700;color:var(--text);background:var(--surface2,#fbfbf9);border-bottom:1px solid rgba(0,0,0,0.03);">📦 ${escapeHtml(ing.name)} <span style="font-size:10.5px;font-weight:normal;color:var(--text2,#64748b);">[${escapeHtml(ing.category || 'General')}]</span></div>`;

          (matchesMain ? subTypes : matchingSubs).forEach(sub => {
            matchCount++;
            html += `<div class="wiz-tax-opt wiz-tax-sub" data-val="${escapeAttr(`${ing.id}:${sub.id || sub.name}`)}" data-label="🏷️ ${escapeAttr(sub.name)} (${escapeAttr(ing.name)})" style="padding:5px 10px 5px 22px;font-size:11.5px;cursor:pointer;color:var(--text);border-bottom:1px solid rgba(0,0,0,0.03);">↳ 🏷️ ${escapeHtml(sub.name)}</div>`;
          });
        }
      });

      if (matchCount === 0 && !query) html = `<div style="padding:10px;font-size:12px;color:#94a3b8;text-align:center;">No pantry items matching "${escapeHtml(query)}"</div>`;
      dropdown.innerHTML = html;
      dropdown.classList.remove('hidden');
      dropdown.style.display = 'block';

      dropdown.querySelectorAll('.wiz-tax-opt').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = opt.dataset.val || '';
          dropdown.classList.add('hidden');
          dropdown.style.display = 'none';

          if (val === 'new_item') {
            const idx = parseInt(input.dataset.idx, 10);
            const initialPhrase = unlinkedGroups[idx]?.displayName || input.value || '';
            openTaxonomyCreationModal({
              initialName: initialPhrase,
              onComplete: (created) => {
                const combinedKey = `${created.ingredientId}:${created.subtypeId}`;
                const displayLabel = `🏷️ ${created.subtypeName} (${created.parentName})`;
                input.value = displayLabel;
                input.dataset.selectedId = created.ingredientId;
                input.dataset.selectedSubId = created.subtypeId;
                if (parent) { parent.dataset.selectedId = created.ingredientId; parent.dataset.selectedSubId = created.subtypeId; }
                input.style.borderColor = '#10b981';
                input.style.backgroundColor = '#ecfdf5';
                input.style.color = 'var(--text,#1e293b)';
              }
            });
            return;
          }

          input.value = opt.dataset.label || '';
          if (val.includes(':') && !val.startsWith('cat:')) {
            const [ingId, subId] = val.split(':');
            input.dataset.selectedId = ingId;
            input.dataset.selectedSubId = subId;
            if (parent) { parent.dataset.selectedId = ingId; parent.dataset.selectedSubId = subId; }
          } else {
            input.dataset.selectedId = val;
            input.dataset.selectedSubId = '';
            if (parent) { parent.dataset.selectedId = val; parent.dataset.selectedSubId = ''; }
          }

          input.style.borderColor = val.startsWith('cat:') ? '#818cf8' : '#10b981';
          input.style.backgroundColor = val.startsWith('cat:') ? '#eef2ff' : '#ecfdf5';
          input.style.color = val.startsWith('cat:') ? '#4338ca' : 'var(--text,#1e293b)';
        });
      });
    };

    input.addEventListener('focus', renderFilteredOptions);
    input.addEventListener('input', renderFilteredOptions);
  });

  container.addEventListener('click', (e) => {
    if (!e.target.closest('.pantry-search-container')) {
      container.querySelectorAll('.pantry-search-dropdown').forEach(d => { d.classList.add('hidden'); d.style.display = 'none'; });
    }
  });
}

async function applySweeperBatchMappings(assignments = []) {
  const state = (typeof window !== 'undefined' ? (window.Store?.getState?.() ) : {});
  const recipes = Array.isArray(state.recipes) ? [...state.recipes] : [];
  const masterItems = (window.Store?.getState?.()  || state).ingredients || [];

  const recipeMap = new Map();
  recipes.forEach(r => { if (r?.id) recipeMap.set(String(r.id), JSON.parse(JSON.stringify(r))); });
  const pantryMap = new Map();
  masterItems.forEach(i => { if (i?.id) pantryMap.set(String(i.id), i); });

  let totalUpdatedItems = 0;
  const modifiedRecipeIds = new Set();

  assignments.forEach(({ group, ingId, subId }) => {
    const isCat = String(ingId).startsWith('cat:');
    const catName = isCat ? String(ingId).replace('cat:', '') : '';
    const masterIng = !isCat ? pantryMap.get(String(ingId)) : null;
    const masterName = masterIng?.name || catName || group.displayName;
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
        if (isCat) {
          item.categoryId = catName;
          item.pantryItemId = null;
          item.ingredientId = null;
          item.subtypeId = null;
          item.name = masterName;
        } else {
          item.pantryItemId = String(ingId);
          item.ingredientId = String(ingId);
          if (subId) { item.subtypeId = String(subId); item.subtypeName = subName; }
          item.name = subName ? `${masterName} (${subName})` : masterName;
        }
        totalUpdatedItems++;
        modifiedRecipeIds.add(String(recipe.id));
      };

      if (occ.sectionIdx !== null && Array.isArray(recipe.ingredientSections)) {
        const sec = recipe.ingredientSections[occ.sectionIdx];
        if (sec && Array.isArray(sec.ingredients)) updateTarget(sec.ingredients[occ.itemIdx]);
      } else if (Array.isArray(recipe.ingredients)) {
        updateTarget(recipe.ingredients[occ.itemIdx]);
      }
    });
  });

  const modifiedRecipes = Array.from(modifiedRecipeIds).map(id => recipeMap.get(id));
  const updatedAllRecipes = recipes.map(r => recipeMap.get(String(r.id)) || r);
  setRecipes(updatedAllRecipes);

  if (typeof window !== 'undefined') {
    if (getState()) getState().recipes = updatedAllRecipes;
    if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
  }

  try {
    const res = await batchUpdateRecipesInDb(modifiedRecipes);
    if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast(`Successfully mapped ${totalUpdatedItems} ingredients across ${modifiedRecipes.length} recipes!`, 'success');
    return res;
  } catch (err) {
    console.error('[UnlinkedSweeperUI] Batch write failed:', err);
    if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast('Failed to save ingredient mappings to database.', 'error');
  }
}

if (typeof window !== 'undefined') {
  window.openUnlinkedSweeperModal = openUnlinkedSweeperModal;
  window.closeUnlinkedSweeperModal = closeUnlinkedSweeperModal;
}
