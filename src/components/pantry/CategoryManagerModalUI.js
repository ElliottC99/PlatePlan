/**
 * src/components/pantry/CategoryManagerModalUI.js (v3.19.18)
 * In-App Multi-Step Category Operations Wizard & Fine-Grained Reassignment Modal.
 * Replaces all native browser calls (prompt, confirm, alert) with accessible DOM views.
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { saveIngredient, saveProduct } from '../../services/HouseholdRepository.js';
import { getActiveCategories } from '../../models/PantryHierarchyModel.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

let wizardStep = 'list'; // 'list' | 'rename' | 'merge' | 'delete-empty' | 'reassign'
let activeCat = null;
let reassignMode = 'mass'; // 'mass' | 'individual'
let reassignSearch = '';
let massTargetCat = '';
let individualCatMap = {}; // ingId -> targetCat

export function closeCategoryManagerModal() {
  const modal = document.getElementById('category-manager-modal');
  if (modal) {
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    modal.classList.remove('open');
  }
  wizardStep = 'list';
  activeCat = null;
}

export function renderCategoryManagerModal() {
  let modal = document.getElementById('category-manager-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'category-manager-modal';
    modal.className = 'modal-wrap';
    modal.style = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;pointer-events:none;transition:opacity 0.2s ease;';
    document.body.appendChild(modal);
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
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:18px">🏷️</span>
            <h3 style="margin:0;font-size:16px;font-weight:750">Category Manager</h3>
          </div>
          <button type="button" class="btn sm ghost" onclick="window.closeCategoryManagerModal()" style="padding:2px 8px;font-size:18px">&times;</button>
        </div>

        <div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${categories.map(cat => {
            const count = ingredients.filter(i => (i.category || i.cat || '').toLowerCase().trim() === cat.toLowerCase().trim()).length;
            return `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface2,#f5f5f4);border-radius:8px;border:1px solid var(--border,#e7e5e4)">
                <div>
                  <span style="font-size:13px;font-weight:650">${escapeHtml(cat)}</span>
                  <span style="font-size:11px;color:var(--text2,#78716c);margin-left:6px">(${count} items)</span>
                </div>
                <div style="display:flex;gap:4px">
                  <button type="button" class="btn xs ghost" onclick="window.startRenameCat('${escapeAttr(cat)}')">Rename</button>
                  <button type="button" class="btn xs ghost" onclick="window.startMergeCat('${escapeAttr(cat)}')">Merge</button>
                  <button type="button" class="btn xs ghost" style="color:var(--red,#ef4444)" onclick="window.startDeleteCat('${escapeAttr(cat)}')">Delete</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="display:flex;gap:8px">
          <input type="text" id="cat-manager-add-input" placeholder="New category name..." style="flex:1;padding:6px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px">
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
          <input type="text" id="cat-rename-input" value="${escapeAttr(activeCat)}" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13.5px;box-sizing:border-box">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn ghost sm" onclick="window.navCatStep('list')">Back</button>
          <button type="button" class="btn primary sm" onclick="window.submitRenameCat()">Apply Rename</button>
        </div>
      `;
    } else if (wizardStep === 'merge') {
      const otherCats = categories.filter(c => c.toLowerCase().trim() !== activeCat.toLowerCase().trim());
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
      const boundIngs = ingredients.filter(i => (i.category || i.cat || '').toLowerCase().trim() === activeCat.toLowerCase().trim());
      const otherCats = categories.filter(c => c.toLowerCase().trim() !== activeCat.toLowerCase().trim());
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

        <!-- Mode Toggle -->
        <div style="display:flex;gap:6px;margin-bottom:10px">
          <button type="button" class="btn xs ${reassignMode === 'mass' ? 'primary' : 'ghost'}" onclick="window.setCatReassignMode('mass')">Mass Reassign</button>
          <button type="button" class="btn xs ${reassignMode === 'individual' ? 'primary' : 'ghost'}" onclick="window.setCatReassignMode('individual')">Individual Sorting</button>
        </div>

        ${reassignMode === 'mass' ? `
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text2,#78716c)">Reassign all ${boundIngs.length} items to:</label>
            <select id="cat-mass-target-select" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;background:var(--surface,#fff)">
              ${otherCats.map(c => `<option value="${escapeAttr(c)}" ${c === massTargetCat ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
            </select>
          </div>
        ` : `
          <div style="margin-bottom:8px">
            <input type="text" placeholder="Filter items by name..." value="${escapeAttr(reassignSearch)}" oninput="window.handleReassignSearch(this.value)" style="width:100%;padding:6px 10px;border:1px solid var(--border,#e7e5e4);border-radius:6px;font-size:12px;box-sizing:border-box">
          </div>
          <div style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
            ${filteredIngs.map(ing => {
              const currentSel = individualCatMap[ing.id] || otherCats[0] || 'Uncategorized';
              return `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:var(--surface2,#f5f5f4);border-radius:6px;border:1px solid var(--border,#e7e5e4)">
                  <span style="font-size:12px;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(ing.name)}</span>
                  <select onchange="window.updateIndividualCatMap('${escapeAttr(ing.id)}', this.value)" style="padding:4px 6px;font-size:11.5px;border:1px solid var(--border,#e7e5e4);border-radius:6px;background:var(--surface,#fff)">
                    ${otherCats.map(c => `<option value="${escapeAttr(c)}" ${c === currentSel ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                  </select>
                </div>
              `;
            }).join('') || '<div style="font-size:12px;color:var(--text2,#78716c);padding:8px">No matching items found.</div>'}
          </div>
        `}

        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn ghost sm" onclick="window.navCatStep('list')">Cancel</button>
          <button type="button" class="btn primary sm" style="background:var(--red,#ef4444)" onclick="window.submitReassignAndDelete()">Reassign & Delete</button>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="card" style="width:100%;max-width:420px;background:var(--surface,#fff);padding:20px;border-radius:14px;box-shadow:0 12px 30px rgba(0,0,0,0.15)">
        ${bodyHtml}
      </div>
    `;
  };

  renderCurrentStep();
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'all';
  modal.classList.add('open');

  window.closeCategoryManagerModal = closeCategoryManagerModal;
  window.navCatStep = (step) => { wizardStep = step; renderCurrentStep(); };

  window.submitAddCat = () => {
    const input = document.getElementById('cat-manager-add-input');
    const val = input ? input.value.trim() : '';
    if (!val) return;
    const state = getState() || {};
    const current = Array.isArray(state.categories) ? [...state.categories] : [];
    if (!current.some(c => (typeof c === 'string' ? c : c.name || '').toLowerCase().trim() === val.toLowerCase())) {
      current.push(val);
      state.categories = current;
      setIngredients([...(state.ingredients || [])]);
    }
    renderCurrentStep();
  };

  window.startRenameCat = (cat) => { activeCat = cat; wizardStep = 'rename'; renderCurrentStep(); };
  window.submitRenameCat = async () => {
    const input = document.getElementById('cat-rename-input');
    const newName = input ? input.value.trim() : '';
    if (!newName || !activeCat || newName.toLowerCase() === activeCat.toLowerCase()) {
      wizardStep = 'list';
      renderCurrentStep();
      return;
    }

    const state = getState() || {};
    const ings = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
    const prods = Array.isArray(state.products) ? [...state.products] : [];
    const cats = Array.isArray(state.categories) ? [...state.categories] : [];

    ings.forEach(i => {
      if ((i.category || i.cat || '').toLowerCase().trim() === activeCat.toLowerCase().trim()) {
        i.category = newName;
        saveIngredient(i).catch(() => {});
      }
    });

    prods.forEach(p => {
      if ((p.category || p.cat || '').toLowerCase().trim() === activeCat.toLowerCase().trim()) {
        p.category = newName;
        saveProduct(p).catch(() => {});
      }
    });

    const newCats = cats.map(c => {
      const name = typeof c === 'string' ? c : c.name;
      return name.toLowerCase().trim() === activeCat.toLowerCase().trim() ? newName : name;
    });

    if (!newCats.some(c => (typeof c === 'string' ? c : c.name || '').toLowerCase().trim() === newName.toLowerCase())) {
      newCats.push(newName);
    }

    state.categories = newCats;
    setIngredients(ings);
    setProducts(prods);
    wizardStep = 'list';
    renderCurrentStep();
  };

  window.startMergeCat = (cat) => { activeCat = cat; wizardStep = 'merge'; renderCurrentStep(); };
  window.submitMergeCat = async () => {
    const select = document.getElementById('cat-merge-select');
    const targetCat = select ? select.value : '';
    if (!targetCat || !activeCat) return;

    const state = getState() || {};
    const ings = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
    const prods = Array.isArray(state.products) ? [...state.products] : [];

    ings.forEach(i => {
      if ((i.category || i.cat || '').toLowerCase().trim() === activeCat.toLowerCase().trim()) {
        i.category = targetCat;
        saveIngredient(i).catch(() => {});
      }
    });

    prods.forEach(p => {
      if ((p.category || p.cat || '').toLowerCase().trim() === activeCat.toLowerCase().trim()) {
        p.category = targetCat;
        saveProduct(p).catch(() => {});
      }
    });

    const cats = Array.isArray(state.categories) ? [...state.categories] : [];
    state.categories = cats.filter(c => (typeof c === 'string' ? c : c.name || '').toLowerCase().trim() !== activeCat.toLowerCase().trim());

    setIngredients(ings);
    setProducts(prods);
    wizardStep = 'list';
    renderCurrentStep();
  };

  window.startDeleteCat = (cat) => {
    activeCat = cat;
    const state = getState() || {};
    const ings = Array.isArray(state.ingredients) ? state.ingredients : [];
    const bound = ings.filter(i => (i.category || i.cat || '').toLowerCase().trim() === cat.toLowerCase().trim());

    if (bound.length === 0) {
      wizardStep = 'delete-empty';
    } else {
      wizardStep = 'reassign';
      reassignMode = 'mass';
      reassignSearch = '';
      const otherCats = getActiveCategories(state).filter(c => c.toLowerCase().trim() !== cat.toLowerCase().trim());
      massTargetCat = otherCats[0] || 'Uncategorized';
      individualCatMap = {};
      bound.forEach(i => { individualCatMap[i.id] = massTargetCat; });
    }
    renderCurrentStep();
  };

  window.submitDeleteEmptyCat = () => {
    if (!activeCat) return;
    const state = getState() || {};
    const cats = Array.isArray(state.categories) ? [...state.categories] : [];
    state.categories = cats.filter(c => (typeof c === 'string' ? c : c.name || '').toLowerCase().trim() !== activeCat.toLowerCase().trim());
    setIngredients([...(state.ingredients || [])]);
    wizardStep = 'list';
    renderCurrentStep();
  };

  window.setCatReassignMode = (mode) => {
    reassignMode = mode;
    renderCurrentStep();
  };

  window.handleReassignSearch = (text) => {
    reassignSearch = text || '';
    renderCurrentStep();
  };

  window.updateIndividualCatMap = (ingId, targetCat) => {
    individualCatMap[ingId] = targetCat;
  };

  window.submitReassignAndDelete = async () => {
    if (!activeCat) return;
    const state = getState() || {};
    const ings = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
    const prods = Array.isArray(state.products) ? [...state.products] : [];

    const massTarget = document.getElementById('cat-mass-target-select')?.value || massTargetCat || 'Uncategorized';

    ings.forEach(i => {
      if ((i.category || i.cat || '').toLowerCase().trim() === activeCat.toLowerCase().trim()) {
        const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[i.id] || massTarget);
        i.category = dest;
        saveIngredient(i).catch(() => {});
      }
    });

    prods.forEach(p => {
      if ((p.category || p.cat || '').toLowerCase().trim() === activeCat.toLowerCase().trim()) {
        p.category = reassignMode === 'mass' ? massTarget : 'Uncategorized';
        saveProduct(p).catch(() => {});
      }
    });

    const cats = Array.isArray(state.categories) ? [...state.categories] : [];
    state.categories = cats.filter(c => (typeof c === 'string' ? c : c.name || '').toLowerCase().trim() !== activeCat.toLowerCase().trim());

    setIngredients(ings);
    setProducts(prods);
    wizardStep = 'list';
    renderCurrentStep();
  };
}
