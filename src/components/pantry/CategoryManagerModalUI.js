/**
 * src/components/pantry/CategoryManagerModalUI.js (v3.19.78)
 * In-App Multi-Step Category Operations Wizard & Fine-Grained Reassignment Modal.
 */

import { getState } from '../../store/store.js';
import { db, HOUSEHOLD_ID } from '../../config/firebase.js';
import { saveIngredient, saveProduct } from '../../services/HouseholdRepository.js';
import { getActiveCategories, slugCategory, slugifyToKebab, invalidateHierarchyCache } from '../../models/PantryHierarchyModel.js';
import { resetCategoryFilter } from '../../views/PantryBankView.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

let wizardStep = 'list', activeCat = null, reassignMode = 'mass', reassignSearch = '', massTargetCat = '', individualCatMap = {};

export function getCategoryName(cat) {
  if (!cat) return '';
  if (typeof cat === 'string') return cat;
  return cat.name || cat.categoryName || cat.id || '';
}

const resolveCategory = (id) => {
  const cats = getState()?.categories || [];
  for (const c of cats) {
    const cName = getCategoryName(c);
    if (typeof c === 'string' && (c === id || slugCategory(c) === slugCategory(id))) return { id: c, name: c };
    if (c && typeof c === 'object' && (String(c.id) === String(id) || String(cName) === String(id) || slugCategory(cName) === slugCategory(id))) return { id: c.id || cName, name: cName };
  }
  return { id, name: id };
};

export function closeCategoryManagerModal() {
  const el = document.getElementById('category-manager-modal');
  if (el) { el.dataset.wizardStep = wizardStep; Object.assign(el.style, { opacity: '0', pointerEvents: 'none' }); el.classList.remove('open'); }
  wizardStep = 'list'; activeCat = null; reassignSearch = '';
  if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
  invalidateHierarchyCache();
}

export function renderCategoryManagerModal() {
  let modal = document.getElementById('category-manager-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'category-manager-modal';
    modal.className = 'modal-wrap';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;pointer-events:none;transition:opacity 0.2s ease;';
    document.body.appendChild(modal);
  } else if (modal.dataset.wizardStep) wizardStep = modal.dataset.wizardStep;

  const renderCurrentStep = () => {
    const state = getState() || {}, categories = getActiveCategories(state), ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
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
                <button type="button" class="btn xs ghost" style="color:var(--red,#ef4444)" onclick="window.promptDeleteCategory('${escapeAttr(cat)}')">Delete</button>
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
    } else if (wizardStep === 'reassign') {
      const boundIngs = ingredients.filter(i => slugCategory(i.category) === slugCategory(activeCat) || slugCategory(i.cat) === slugCategory(activeCat));
      const otherCats = categories.filter(c => slugCategory(c) !== slugCategory(activeCat));
      if (!otherCats.includes('Uncategorised')) otherCats.push('Uncategorised');
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
              const currentSel = individualCatMap[ing.id] || otherCats[0] || 'Uncategorised';
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
  Object.assign(modal.style, { opacity: '1', pointerEvents: 'all' }); modal.classList.add('open');

  window.closeCategoryManagerModal = closeCategoryManagerModal;
  window.navCatStep = (step) => { wizardStep = step; reassignSearch = ''; renderCurrentStep(); };

  window.submitAddCat = async () => {
    const input = document.getElementById('cat-manager-add-input');
    const val = input ? input.value.trim() : '';
    if (!val) return;
    const state = getState() || {}, categories = Array.isArray(state.categories) ? [...state.categories] : [];
    if (!categories.some(c => slugCategory(c) === slugCategory(val))) {
      categories.push(val);
      const { setCategories } = await import('../../store/store.js');
      const { saveCategories } = await import('../../services/HouseholdRepository.js');
      setCategories(categories); await saveCategories(categories);
    }
    wizardStep = 'list'; activeCat = null; reassignSearch = ''; renderCurrentStep();
  };

  window.startRenameCat = (cat) => { activeCat = cat; wizardStep = 'rename'; renderCurrentStep(); };
  window.submitRenameCat = async () => {
    const input = document.getElementById('cat-rename-input'), newName = input ? input.value.trim() : '', oldCat = activeCat;
    if (!newName || !oldCat || slugCategory(newName) === slugCategory(oldCat)) { wizardStep = 'list'; activeCat = null; reassignSearch = ''; renderCurrentStep(); return; }

    const targetSlug = slugCategory(oldCat), newCatKebab = slugifyToKebab(newName), state = getState() || {};
    const ings = Array.isArray(state.ingredients) ? state.ingredients : [], prods = Array.isArray(state.products) ? state.products : [];
    const batch = window.firebase.firestore().batch(), householdRef = db.collection('households').doc(HOUSEHOLD_ID);

    ings.forEach(i => {
      let changed = false;
      if (slugCategory(i.category) === targetSlug || slugCategory(i.cat) === targetSlug) { i.category = newName; i.cat = newCatKebab; changed = true; }
      if (Array.isArray(i.subtypes)) {
        i.subtypes.forEach(st => {
          if (slugCategory(st.category) === targetSlug || slugCategory(st.cat) === targetSlug) { st.category = newName; st.cat = newCatKebab; changed = true; }
        });
      }
      if (changed) { const updated = { ...i, updatedAt: new Date().toISOString() }; delete updated.id; batch.set(householdRef.collection('ingredients').doc(String(i.id)), updated, { merge: true }); }
    });

    prods.forEach(p => {
      if (slugCategory(p.category) === targetSlug || slugCategory(p.cat) === targetSlug) {
        const updated = { ...p, category: newName, cat: newCatKebab, updatedAt: new Date().toISOString() }; delete updated.id;
        batch.set(householdRef.collection('products').doc(String(p.id)), updated, { merge: true });
      }
    });

    const categories = (state.categories || []).map(c => slugCategory(c) === targetSlug ? newName : c);
    const { setCategories } = await import('../../store/store.js'); setCategories(categories);
    batch.set(householdRef.collection('settings').doc('categories'), { categories, updatedAt: new Date().toISOString() }, { merge: true });
    await batch.commit(); wizardStep = 'list'; activeCat = null; reassignSearch = ''; renderCurrentStep();
  };

  window.startMergeCat = (cat) => { activeCat = cat; wizardStep = 'merge'; renderCurrentStep(); };
  window.submitMergeCat = async () => {
    const select = document.getElementById('cat-merge-select'), targetCat = select ? select.value : '', sourceCat = activeCat;
    if (!targetCat || !sourceCat) return;

    const targetSlug = slugCategory(sourceCat), targetKebab = slugifyToKebab(targetCat), state = getState() || {};
    const ings = Array.isArray(state.ingredients) ? state.ingredients : [], prods = Array.isArray(state.products) ? state.products : [];
    const persistPromises = [];

    ings.forEach(i => {
      if (slugCategory(i.category) === targetSlug || slugCategory(i.cat) === targetSlug) persistPromises.push(saveIngredient({ ...i, category: targetCat, cat: targetKebab }));
    });
    prods.forEach(p => {
      if (slugCategory(p.category) === targetSlug || slugCategory(p.cat) === targetSlug) persistPromises.push(saveProduct({ ...p, category: targetCat, cat: targetKebab }));
    });

    const categories = (state.categories || []).filter(c => slugCategory(c) !== targetSlug);
    const { setCategories } = await import('../../store/store.js');
    const { saveCategories } = await import('../../services/HouseholdRepository.js');
    setCategories(categories); persistPromises.push(saveCategories(categories));

    await Promise.all(persistPromises);
    if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
    invalidateHierarchyCache(); closeCategoryManagerModal();
  };

  window.setCatReassignMode = (mode) => { reassignMode = mode; renderCurrentStep(); };
  window.handleReassignSearch = (text) => { reassignSearch = text || ''; renderCurrentStep(); };
  window.updateIndividualCatMap = (ingId, targetCat) => { individualCatMap[ingId] = targetCat; };

  window.submitReassignAndDelete = async () => {
    const deletedCat = activeCat; if (!deletedCat) return;
    const targetSlug = slugCategory(deletedCat), state = getState() || {};
    const ings = Array.isArray(state.ingredients) ? state.ingredients : [], prods = Array.isArray(state.products) ? state.products : [];
    const massTarget = document.getElementById('cat-mass-target-select')?.value || massTargetCat || 'Uncategorised';
    const persistPromises = [];

    ings.forEach(i => {
      if (slugCategory(i.category) === targetSlug || slugCategory(i.cat) === targetSlug) {
        const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[i.id] || massTarget);
        persistPromises.push(saveIngredient({ ...i, category: dest, cat: slugifyToKebab(dest) }));
      }
    });
    prods.forEach(p => {
      if (slugCategory(p.category) === targetSlug || slugCategory(p.cat) === targetSlug) {
        const dest = reassignMode === 'mass' ? massTarget : 'Uncategorised';
        persistPromises.push(saveProduct({ ...p, category: dest, cat: slugifyToKebab(dest) }));
      }
    });

    const categories = (state.categories || []).filter(c => slugCategory(c) !== targetSlug);
    const { setCategories } = await import('../../store/store.js');
    const { saveCategories } = await import('../../services/HouseholdRepository.js');
    setCategories(categories); persistPromises.push(saveCategories(categories));

    await Promise.all(persistPromises);
    if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
    invalidateHierarchyCache(); closeCategoryManagerModal();
  };
}

window.closeDeleteCategoryModal = function closeDeleteCategoryModal() {
  const overlay = document.getElementById('category-delete-confirm-modal');
  if (overlay) overlay.remove();
};

window.handleDeleteCategory = async function handleDeleteCategory(identifier) {
  if (!identifier) return;
  const category = resolveCategory(identifier);
  if (!category || (!category.id && !category.name)) return;
  const targetId = category.id;
  const targetName = category.name;

  try {
    await window.PantryRepository.deleteCategory(targetId || targetName);

    const state = window.Store.getState() || {};
    const targetSlug = slugCategory(targetName);
    const ingsToUpdate = (state.ingredients || []).filter(i => slugCategory(i.category) === targetSlug || slugCategory(i.cat) === targetSlug);
    for (const ing of ingsToUpdate) {
      await window.PantryRepository.saveIngredient({ ...ing, category: 'Uncategorised', cat: 'uncategorised', updatedAt: new Date().toISOString() });
    }
    const updatedIngs = (state.ingredients || []).map(i => {
      if (slugCategory(i.category) === targetSlug || slugCategory(i.cat) === targetSlug) {
        return { ...i, category: 'Uncategorised', cat: 'uncategorised' };
      }
      return i;
    });
    window.Store.setState({ ingredients: updatedIngs });

    const updatedCategories = (window.Store.getState().categories || []).filter(c => {
      if (typeof c === 'string') return c !== targetId && slugCategory(c) !== slugCategory(targetName);
      return c.id !== targetId && c.name !== targetName;
    });
    window.Store.setState({ categories: updatedCategories });
  } catch (err) {
    console.error('Failed to delete category:', err);
  } finally {
    const confirmModal = document.getElementById('category-delete-confirm-modal');
    if (confirmModal) confirmModal.remove();
    if (typeof window.openCategoryManagerModal === 'function') {
      window.openCategoryManagerModal();
    }
  }
};

window.promptDeleteCategory = function promptDeleteCategory(categoryId) {
  if (!categoryId) return;
  const category = resolveCategory(categoryId);
  if (!category || !category.name) {
    console.error('[CategoryManager] Invalid category resolution:', categoryId);
    return;
  }

  const state = getState() || {}, ings = Array.isArray(state.ingredients) ? state.ingredients : [];
  const bound = ings.filter(i => slugCategory(i.category) === slugCategory(category.name) || slugCategory(i.cat) === slugCategory(category.name));

  if (bound.length > 0) {
    activeCat = category.name; wizardStep = 'reassign'; reassignMode = 'mass'; reassignSearch = '';
    const otherCats = getActiveCategories(state).filter(c => slugCategory(c) !== slugCategory(category.name));
    massTargetCat = otherCats[0] || 'Uncategorised'; individualCatMap = {};
    bound.forEach(i => { individualCatMap[i.id] = massTargetCat; });
    renderCategoryManagerModal(); return;
  }

  window.closeDeleteCategoryModal();
  const overlay = document.createElement('div');
  overlay.id = 'category-delete-confirm-modal';
  overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:10000;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
  overlay.innerHTML = `
    <div style="background:#ffffff; border-radius:16px; padding:20px; width:100%; max-width:400px; box-shadow:0 10px 25px rgba(0,0,0,0.25);">
      <h3 style="margin-top:0; margin-bottom:10px; font-size:1.15rem; font-weight:750; color:var(--red,#ef4444);">Delete "${escapeHtml(category.name)}"</h3>
      <p style="font-size:13px; color:var(--text2,#78716c); margin:0 0 16px 0; line-height:1.4">Are you sure you want to delete this category? This action is permanent.</p>
      <div style="display:flex; gap:8px; justify-content:flex-end">
        <button type="button" class="btn sm" onclick="window.closeDeleteCategoryModal()">Cancel</button>
        <button type="button" class="btn sm primary" style="background:var(--red,#ef4444); color:#fff;" onclick="window.handleDeleteCategory('${escapeAttr(category.id || category.name)}')">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
};

if (typeof window !== 'undefined') {
  window.openCategoryManagerModal = () => {
    wizardStep = 'list';
    renderCategoryManagerModal();
  };
}
