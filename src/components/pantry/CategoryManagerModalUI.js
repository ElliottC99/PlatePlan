/**
 * src/components/pantry/CategoryManagerModalUI.js (v3.19.62)
 * In-App Multi-Step Category Operations Wizard & Fine-Grained Reassignment Modal.
 * Replaces all native browser calls with accessible DOM views, relying on native Firestore reactivity.
 */

import { getState } from '../../store/store.js';
import { db, HOUSEHOLD_ID } from '../../config/firebase.js';
import { saveIngredient, saveProduct } from '../../services/HouseholdRepository.js';
import { getActiveCategories, slugCategory, slugifyToKebab, invalidateHierarchyCache } from '../../models/PantryHierarchyModel.js';
import { resetCategoryFilter, isCategoryManagerOpen } from '../../views/PantryBankView.js';

function escapeHtml(str) { return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(str) { return escapeHtml(str).replace(/`/g, '&#96;'); }

let wizardStep = 'list', activeCat = null, reassignMode = 'mass', reassignSearch = '', massTargetCat = '', individualCatMap = {};

export function closeCategoryManagerModal() {
  const modal = document.getElementById('category-manager-modal');
  if (modal) {
    modal.dataset.wizardStep = wizardStep;
    modal.style.opacity = '0'; modal.style.pointerEvents = 'none'; modal.classList.remove('open');
  }
  wizardStep = 'list'; activeCat = null; reassignSearch = '';
  if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
  invalidateHierarchyCache();
}

function setCategoryManagerOpen(isOpen) {
  // modify exported module-level flag or window flag if needed
  try {
    const pantryMod = import('../../views/PantryBankView.js');
    // or set globally
  } catch (e) {}
}

export function renderCategoryManagerModal() {
  let modal = document.getElementById('category-manager-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'category-manager-modal';
    modal.className = 'modal-wrap';
    modal.style = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;pointer-events:none;transition:opacity 0.2s ease;';
    document.body.appendChild(modal);
  } else if (modal.dataset.wizardStep) {
    wizardStep = modal.dataset.wizardStep;
  }

  const renderCurrentStep = () => {
    const state = getState() || {};
    const categories = getActiveCategories(state);
    const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
    const products = Array.isArray(state.products) ? state.products : [];
    let bodyHtml = '';

    if (wizardStep === 'list') {
      bodyHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border,#e7e5e4)">
          <div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">🏷️</span><h3 style="margin:0;font-size:16px;font-weight:750">Category Manager</h3></div>
          <button type="button" class="btn sm ghost" onclick="window.closeCategoryManagerModal()" style="padding:2px 8px;font-size:18px">&times;</button>
        </div>
        <div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${categories.map(cat => {
            const count = ingredients.filter(i => slugCategory(i.category) === slugCategory(cat) || slugCategory(i.cat) === slugCategory(cat)).length;
            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface2,#f5f5f4);border-radius:8px;border:1px solid var(--border,#e7e5e4)">
              <div><span style="font-size:13px;font-weight:650">${escapeHtml(cat)}</span><span style="font-size:11px;color:var(--text2,#78716c);margin-left:6px">(${count} items)</span></div>
              <div style="display:flex;gap:4px">
                <button type="button" class="btn xs ghost" onclick="window.startRenameCat('${escapeAttr(cat)}')">Rename</button>
                <button type="button" class="btn xs ghost" onclick="window.startMergeCat('${escapeAttr(cat)}')">Merge</button>
                <button type="button" class="btn xs ghost" style="color:var(--red,#ef4444)" onclick="window.startDeleteCat('${escapeAttr(cat)}')">Delete</button>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:8px">
          <input type="text" id="cat-manager-add-input" placeholder="New category name..." aria-label="New category name" style="flex:1;padding:6px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px">
          <button type="button" class="btn primary sm" onclick="window.submitAddCat()">+ Add</button>
        </div>
      `;
    } else if (wizardStep === 'rename') {
      bodyHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border,#e7e5e4)">
          <h3 style="margin:0;font-size:15px;font-weight:750">Rename "${escapeHtml(activeCat)}"</h3>
          <button type="button" class="btn sm ghost" onclick="window.closeCategoryManagerModal()">&times;</button>
        </div>
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text2,#78716c)">New Category Name</label>
          <input type="text" id="cat-rename-input" value="${escapeAttr(activeCat)}" aria-label="New category name input" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13.5px;box-sizing:border-box">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn ghost sm" onclick="window.navCatStep('list')">Back</button>
          <button type="button" class="btn primary sm" onclick="window.submitRenameCat()">Apply Rename</button>
        </div>
      `;
    } else if (wizardStep === 'merge') {
      const otherCats = categories.filter(c => slugCategory(c) !== slugCategory(activeCat));
      bodyHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border,#e7e5e4)">
          <h3 style="margin:0;font-size:15px;font-weight:750">Merge "${escapeHtml(activeCat)}"</h3>
          <button type="button" class="btn sm ghost" onclick="window.closeCategoryManagerModal()">&times;</button>
        </div>
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text2,#78716c)">Select Target Destination Category</label>
          <select id="cat-merge-select" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13.5px;background:var(--surface,#fff)">
            ${otherCats.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn ghost sm" onclick="window.navCatStep('list')">Back</button>
          <button type="button" class="btn primary sm" onclick="window.submitMergeCat()">Confirm Merge</button>
        </div>
      `;
    } else if (wizardStep === 'delete-empty') {
      bodyHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border,#e7e5e4)">
          <h3 style="margin:0;font-size:15px;font-weight:750">Delete "${escapeHtml(activeCat)}"</h3>
          <button type="button" class="btn sm ghost" onclick="window.closeCategoryManagerModal()">&times;</button>
        </div>
        <p style="font-size:13px;color:var(--text2,#78716c);margin:0 0 16px 0">This category contains 0 ingredients. Are you sure you want to delete it?</p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn ghost sm" onclick="window.navCatStep('list')">Cancel</button>
          <button type="button" class="btn primary sm" style="background:var(--red,#ef4444)" onclick="window.submitDeleteEmptyCat()">Delete</button>
        </div>
      `;
    } else if (wizardStep === 'reassign') {
      const boundIngs = ingredients.filter(i => slugCategory(i.category) === slugCategory(activeCat) || slugCategory(i.cat) === slugCategory(activeCat));
      const otherCats = categories.filter(c => slugCategory(c) !== slugCategory(activeCat));
      if (!otherCats.includes('Uncategorized')) otherCats.push('Uncategorized');
      const filteredIngs = boundIngs.filter(i => (i.name || '').toLowerCase().includes(reassignSearch.toLowerCase().trim()));

      bodyHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border,#e7e5e4)">
          <div>
            <h3 style="margin:0;font-size:15px;font-weight:750">Reassign Items (${boundIngs.length})</h3>
            <p style="margin:2px 0 0 0;font-size:11.5px;color:var(--text2,#78716c)">Reassign ingredients before deleting "${escapeHtml(activeCat)}".</p>
          </div>
          <button type="button" class="btn sm ghost" onclick="window.closeCategoryManagerModal()">&times;</button>
        </div>

        <div style="display:flex;gap:6px;margin-bottom:10px">
          <button type="button" class="btn xs ${reassignMode === 'mass' ? 'primary' : 'ghost'}" onclick="window.setCatReassignMode('mass')">Mass Reassign</button>
          <button type="button" class="btn xs ${reassignMode === 'individual' ? 'primary' : 'ghost'}" onclick="window.setCatReassignMode('individual')">Individual Sorting</button>
        </div>

        ${reassignMode === 'mass' ? `
          <div style="margin-bottom:16px">
            <label for="cat-mass-target-select" style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text2,#78716c)">Reassign all ${boundIngs.length} items to:</label>
            <select id="cat-mass-target-select" name="cat_mass_target" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;background:var(--surface,#fff)">
              ${otherCats.map(c => `<option value="${escapeAttr(c)}" ${c === massTargetCat ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
            </select>
          </div>
        ` : `
          <div style="margin-bottom:8px">
            <label for="cat-reassign-filter" style="display:none">Filter items by name</label>
            <input type="text" id="cat-reassign-filter" name="reassign_filter" placeholder="Filter items by name..." value="${escapeAttr(reassignSearch)}" oninput="window.handleReassignSearch(this.value)" style="width:100%;padding:6px 10px;border:1px solid var(--border,#e7e5e4);border-radius:6px;font-size:12px;box-sizing:border-box">
          </div>
          <div style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
            ${filteredIngs.map(ing => {
              const currentSel = individualCatMap[ing.id] || otherCats[0] || 'Uncategorized';
              const selId = `cat-select-${ing.id}`;
              return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:var(--surface2,#f5f5f4);border-radius:6px;border:1px solid var(--border,#e7e5e4)">
                <label for="${selId}" style="font-size:12px;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(ing.name)}</label>
                <select id="${selId}" name="cat_select_${ing.id}" onchange="window.updateIndividualCatMap('${escapeAttr(ing.id)}', this.value)" style="padding:4px 6px;font-size:11.5px;border:1px solid var(--border,#e7e5e4);border-radius:6px;background:var(--surface,#fff)">
                  ${otherCats.map(c => `<option value="${escapeAttr(c)}" ${c === currentSel ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                </select>
              </div>`;
            }).join('') || '<div style="font-size:12px;color:var(--text2,#78716c);padding:8px">No matching items found.</div>'}
          </div>
        `}

        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn ghost sm" onclick="window.navCatStep('list')">Cancel</button>
          <button type="button" class="btn primary sm" style="background:var(--red,#ef4444)" onclick="window.submitReassignAndDelete()">Reassign & Delete</button>
        </div>
      `;
    }

    modal.innerHTML = `<div class="card" style="width:100%;max-width:420px;background:var(--surface,#fff);padding:20px;border-radius:14px;box-shadow:0 12px 30px rgba(0,0,0,0.15)">${bodyHtml}</div>`;
  };

  renderCurrentStep();
  modal.style.opacity = '1'; modal.style.pointerEvents = 'all'; modal.classList.add('open');

  window.closeCategoryManagerModal = closeCategoryManagerModal;
  window.navCatStep = (step) => { wizardStep = step; reassignSearch = ''; renderCurrentStep(); };

  window.submitAddCat = () => {
    const input = document.getElementById('cat-manager-add-input');
    const val = input ? input.value.trim() : '';
    if (!val) return;
    wizardStep = 'list'; activeCat = null; reassignSearch = '';
    renderCurrentStep();
  };

  window.startRenameCat = (cat) => { activeCat = cat; wizardStep = 'rename'; renderCurrentStep(); };
  window.submitRenameCat = async () => {
    const input = document.getElementById('cat-rename-input');
    const newName = input ? input.value.trim() : '';
    const oldCat = activeCat;
    if (!newName || !oldCat || slugCategory(newName) === slugCategory(oldCat)) {
      wizardStep = 'list'; activeCat = null; reassignSearch = ''; renderCurrentStep(); return;
    }

    const targetSlug = slugCategory(oldCat), newCatKebab = slugifyToKebab(newName);
    const state = getState() || {};
    const ings = Array.isArray(state.ingredients) ? state.ingredients : [];
    const prods = Array.isArray(state.products) ? state.products : [];

    const batch = window.firebase.firestore().batch();
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);

    ings.forEach(i => {
      let isIngChanged = false;
      if (slugCategory(i.category) === targetSlug || slugCategory(i.cat) === targetSlug) {
        i.category = newName; i.cat = newCatKebab;
        isIngChanged = true;
      }
      if (Array.isArray(i.subtypes)) {
        i.subtypes.forEach(st => {
          if (slugCategory(st.category) === targetSlug || slugCategory(st.cat) === targetSlug) {
            st.category = newName; st.cat = newCatKebab;
            isIngChanged = true;
          }
        });
      }
      if (isIngChanged) {
        const updated = { ...i, updatedAt: new Date().toISOString() };
        delete updated.id;
        batch.set(householdRef.collection('ingredients').doc(String(i.id)), updated, { merge: true });
      }
    });

    prods.forEach(p => {
      if (slugCategory(p.category) === targetSlug || slugCategory(p.cat) === targetSlug) {
        const updated = { ...p, category: newName, cat: newCatKebab, updatedAt: new Date().toISOString() };
        delete updated.id;
        batch.set(householdRef.collection('products').doc(String(p.id)), updated, { merge: true });
      }
    });

    await batch.commit();
    wizardStep = 'list'; activeCat = null; reassignSearch = ''; renderCurrentStep();
  };

  window.startMergeCat = (cat) => { activeCat = cat; wizardStep = 'merge'; renderCurrentStep(); };
  window.submitMergeCat = async () => {
    const select = document.getElementById('cat-merge-select');
    const targetCat = select ? select.value : '';
    const sourceCat = activeCat;
    if (!targetCat || !sourceCat) return;

    const targetSlug = slugCategory(sourceCat), targetKebab = slugifyToKebab(targetCat);
    const state = getState() || {};
    const ings = Array.isArray(state.ingredients) ? state.ingredients : [];
    const prods = Array.isArray(state.products) ? state.products : [];

    const persistPromises = [];
    ings.forEach(i => {
      if (slugCategory(i.category) === targetSlug || slugCategory(i.cat) === targetSlug) {
        const updated = { ...i, category: targetCat, cat: targetKebab };
        persistPromises.push(saveIngredient(updated));
      }
    });

    prods.forEach(p => {
      if (slugCategory(p.category) === targetSlug || slugCategory(p.cat) === targetSlug) {
        const updated = { ...p, category: targetCat, cat: targetKebab };
        persistPromises.push(saveProduct(updated));
      }
    });

    await Promise.all(persistPromises);
    if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
    invalidateHierarchyCache();
    closeCategoryManagerModal();
  };

  window.startDeleteCat = (cat) => {
    activeCat = cat;
    const state = getState() || {}, ings = Array.isArray(state.ingredients) ? state.ingredients : [];
    const bound = ings.filter(i => slugCategory(i.category) === slugCategory(cat) || slugCategory(i.cat) === slugCategory(cat));

    if (bound.length === 0) { wizardStep = 'delete-empty'; }
    else {
      wizardStep = 'reassign'; reassignMode = 'mass'; reassignSearch = '';
      const otherCats = getActiveCategories(state).filter(c => slugCategory(c) !== slugCategory(cat));
      massTargetCat = otherCats[0] || 'Uncategorized'; individualCatMap = {};
      bound.forEach(i => { individualCatMap[i.id] = massTargetCat; });
    }
    renderCurrentStep();
  };

  window.submitDeleteEmptyCat = () => {
    if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
    invalidateHierarchyCache();
    closeCategoryManagerModal();
  };

  window.setCatReassignMode = (mode) => { reassignMode = mode; renderCurrentStep(); };
  window.handleReassignSearch = (text) => { reassignSearch = text || ''; renderCurrentStep(); };
  window.updateIndividualCatMap = (ingId, targetCat) => { individualCatMap[ingId] = targetCat; };

  window.submitReassignAndDelete = async () => {
    const deletedCat = activeCat;
    if (!deletedCat) return;
    const targetSlug = slugCategory(deletedCat);
    const state = getState() || {}, ings = Array.isArray(state.ingredients) ? state.ingredients : [], prods = Array.isArray(state.products) ? state.products : [];
    const massTarget = document.getElementById('cat-mass-target-select')?.value || massTargetCat || 'Uncategorized';

    const persistPromises = [];
    ings.forEach(i => {
      if (slugCategory(i.category) === targetSlug || slugCategory(i.cat) === targetSlug) {
        const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[i.id] || massTarget);
        const updated = { ...i, category: dest, cat: slugifyToKebab(dest) };
        persistPromises.push(saveIngredient(updated));
      }
    });

    prods.forEach(p => {
      if (slugCategory(p.category) === targetSlug || slugCategory(p.cat) === targetSlug) {
        const dest = reassignMode === 'mass' ? massTarget : 'Uncategorized';
        const updated = { ...p, category: dest, cat: slugifyToKebab(dest) };
        persistPromises.push(saveProduct(updated));
      }
    });

    await Promise.all(persistPromises);
    if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
    invalidateHierarchyCache();
    closeCategoryManagerModal();
  };
}

export function openIngredientReorganiseModal(ingredientId) {
  const state = getState() || {};
  const currentIngs = Array.isArray(state.ingredients) ? state.ingredients : [];
  const ing = currentIngs.find(i => String(i.id) === String(ingredientId));
  if (!ing) return;

  const targetCandidates = currentIngs.filter(i => String(i.id) !== String(ingredientId));

  const showModal = (html) => {
    const wrap = document.getElementById('view-modal-wrap');
    const content = document.getElementById('view-modal-content');
    if (wrap && content) {
      content.innerHTML = html;
      wrap.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  };

  const closeModal = () => {
    const wrap = document.getElementById('view-modal-wrap');
    if (wrap) {
      wrap.classList.remove('open');
      document.body.style.overflow = '';
    }
  };

  const html = `
    <div style="padding: 24px; max-width: 500px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px;">
      <h3 style="margin-top:0; margin-bottom: 6px; font-size: 1.15rem; font-weight: 750;">🔀 Reorganise Ingredient: ${escapeHtml(ing.name)}</h3>
      <p style="font-size: 12.5px; color: var(--text2,#78716c); margin: 0 0 18px 0;">Select how you want to restructure or consolidate this ingredient.</p>

      <!-- Option A: Merge into another Ingredient -->
      <div style="padding: 14px; border: 1px solid var(--border,#e7e5e4); border-radius: 10px; margin-bottom: 14px; background: var(--surface2,#fafaf9);">
        <div style="font-weight: 750; font-size: 13px; margin-bottom: 4px; color: var(--text,#1c1917);">🔀 Option A: Merge into another Ingredient</div>
        <p style="margin: 0 0 10px 0; font-size: 11.5px; color: var(--text2,#78716c);">Transfers all sub-types, linked products, and aliases to the target ingredient before removing this source.</p>
        <div style="display:flex; gap:8px;">
          <select id="reorg-core-merge-select" style="flex:1; padding:7px; border:1px solid var(--border,#e7e5e4); border-radius:6px; font-size:12px; background:#fff;" ${targetCandidates.length === 0 ? 'disabled' : ''}>
            ${targetCandidates.map(c => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.name)} (${escapeHtml(c.category || 'Other')})</option>`).join('') || '<option>No other ingredients available</option>'}
          </select>
          <button type="button" class="btn primary sm" id="btn-reorg-core-merge" ${targetCandidates.length === 0 ? 'disabled' : ''}>Merge</button>
        </div>
      </div>

      <!-- Option B: Convert to Sub-type of... -->
      <div style="padding: 14px; border: 1px solid var(--border,#e7e5e4); border-radius: 10px; margin-bottom: 20px; background: var(--surface2,#fafaf9);">
        <div style="font-weight: 750; font-size: 13px; margin-bottom: 4px; color: var(--text,#1c1917);">⬇️ Option B: Convert to Sub-type of...</div>
        <p style="margin: 0 0 10px 0; font-size: 11.5px; color: var(--text2,#78716c);">Nests this ingredient as a child sub-type under the chosen parent, preserving all linked products.</p>
        <div style="display:flex; gap:8px;">
          <select id="reorg-core-demote-select" style="flex:1; padding:7px; border:1px solid var(--border,#e7e5e4); border-radius:6px; font-size:12px; background:#fff;" ${targetCandidates.length === 0 ? 'disabled' : ''}>
            ${targetCandidates.map(c => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.name)} (${escapeHtml(c.category || 'Other')})</option>`).join('') || '<option>No parent ingredients available</option>'}
          </select>
          <button type="button" class="btn primary sm" id="btn-reorg-core-demote" ${targetCandidates.length === 0 ? 'disabled' : ''}>Convert</button>
        </div>
      </div>

      <div style="display:flex; justify-content: flex-end;">
        <button type="button" class="btn" id="btn-cancel-reorg-core">Cancel</button>
      </div>
    </div>
  `;

  showModal(html);

  document.getElementById('btn-cancel-reorg-core').onclick = closeModal;

  document.getElementById('btn-reorg-core-merge').onclick = async () => {
    const targetId = document.getElementById('reorg-core-merge-select').value;
    if (!targetId) return;
    closeModal();
    import('../../models/PantryHierarchyModel.js').then(async (model) => {
      await model.mergeIngredients(ingredientId, targetId);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      if (typeof window.renderProductBank === 'function') window.renderProductBank();
    });
  };

  document.getElementById('btn-reorg-core-demote').onclick = async () => {
    const targetParentId = document.getElementById('reorg-core-demote-select').value;
    if (!targetParentId) return;
    closeModal();
    import('../../models/PantryHierarchyModel.js').then(async (model) => {
      await model.demoteToSubtype(ingredientId, targetParentId);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      if (typeof window.renderProductBank === 'function') window.renderProductBank();
    });
  };
}

if (typeof window !== 'undefined') {
  window.openIngredientReorganiseModal = openIngredientReorganiseModal;
}
