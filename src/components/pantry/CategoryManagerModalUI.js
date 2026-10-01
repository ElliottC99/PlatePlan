/**
 * src/components/pantry/CategoryManagerModalUI.js (v3.19.17)
 * Category Lifecycle Management UI Component.
 * Supports Rename, Merge, and Delete with mandatory Reassignment Safeguards.
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

export function closeCategoryManagerModal() {
  const modal = document.getElementById('category-manager-modal');
  if (modal) {
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    modal.classList.remove('open');
  }
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

  const render = () => {
    const state = getState() || {};
    const categories = getActiveCategories(state);
    const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];

    modal.innerHTML = `
      <div class="card" style="width:100%;max-width:420px;background:var(--surface,#fff);padding:20px;border-radius:14px;box-shadow:0 12px 30px rgba(0,0,0,0.15)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border,#e7e5e4)">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:18px">🏷️</span>
            <h3 style="margin:0;font-size:16px;font-weight:750">Category Manager</h3>
          </div>
          <button type="button" class="btn sm ghost" onclick="window.closeCategoryManagerModal()" style="padding:2px 8px;font-size:18px">&times;</button>
        </div>

        <div style="max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:16px" id="cat-manager-list">
          ${categories.map(cat => {
            const count = ingredients.filter(i => (i.category || i.cat || '').toLowerCase().trim() === cat.toLowerCase().trim()).length;
            return `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface2,#f5f5f4);border-radius:8px;border:1px solid var(--border,#e7e5e4)">
                <div>
                  <span style="font-size:13px;font-weight:650">${escapeHtml(cat)}</span>
                  <span style="font-size:11px;color:var(--text2,#78716c);margin-left:6px">(${count} items)</span>
                </div>
                <div style="display:flex;gap:4px">
                  <button type="button" class="btn xs ghost" onclick="window.handleRenameCategory('${escapeAttr(cat)}')">Rename</button>
                  <button type="button" class="btn xs ghost" onclick="window.handleMergeCategory('${escapeAttr(cat)}')">Merge</button>
                  <button type="button" class="btn xs ghost" style="color:var(--red,#ef4444)" onclick="window.handleDeleteCategorySafely('${escapeAttr(cat)}')">Delete</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="display:flex;gap:8px">
          <input type="text" id="cat-manager-new-input" placeholder="New category name..." style="flex:1;padding:6px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px">
          <button type="button" class="btn primary sm" onclick="window.handleCreateNewCategory()">+ Add</button>
        </div>
      </div>
    `;
  };

  render();
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'all';
  modal.classList.add('open');

  window.closeCategoryManagerModal = closeCategoryManagerModal;

  window.handleCreateNewCategory = () => {
    const input = document.getElementById('cat-manager-new-input');
    const val = input ? input.value.trim() : '';
    if (!val) return;
    const state = getState() || {};
    const current = Array.isArray(state.categories) ? [...state.categories] : [];
    if (!current.some(c => (typeof c === 'string' ? c : c.name || '').toLowerCase().trim() === val.toLowerCase())) {
      current.push(val);
      state.categories = current;
      setIngredients([...(state.ingredients || [])]);
    }
    render();
  };

  window.handleRenameCategory = async (oldName) => {
    const newName = prompt(`Rename category "${oldName}" to:`, oldName);
    if (!newName || newName.trim().toLowerCase() === oldName.toLowerCase()) return;
    const cleanNew = newName.trim();

    const state = getState() || {};
    const ings = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
    const prods = Array.isArray(state.products) ? [...state.products] : [];
    const cats = Array.isArray(state.categories) ? [...state.categories] : [];

    ings.forEach(i => {
      if ((i.category || i.cat || '').toLowerCase().trim() === oldName.toLowerCase().trim()) {
        i.category = cleanNew;
        saveIngredient(i).catch(() => {});
      }
    });

    prods.forEach(p => {
      if ((p.category || p.cat || '').toLowerCase().trim() === oldName.toLowerCase().trim()) {
        p.category = cleanNew;
        saveProduct(p).catch(() => {});
      }
    });

    const newCats = cats.map(c => {
      const name = typeof c === 'string' ? c : c.name;
      return name.toLowerCase().trim() === oldName.toLowerCase().trim() ? cleanNew : name;
    });

    if (!newCats.some(c => c.toLowerCase() === cleanNew.toLowerCase())) {
      newCats.push(cleanNew);
    }

    state.categories = newCats;
    setIngredients(ings);
    setProducts(prods);
    render();
  };

  window.handleMergeCategory = async (sourceCat) => {
    const state = getState() || {};
    const categories = getActiveCategories(state).filter(c => c.toLowerCase().trim() !== sourceCat.toLowerCase().trim());
    if (!categories.length) {
      alert('No target categories available to merge into.');
      return;
    }

    const targetCat = prompt(
      `Merge category "${sourceCat}" INTO which category?\n` +
      categories.map((c, idx) => `${idx + 1}. ${c}`).join('\n') +
      `\nEnter number or category name:`
    );

    if (!targetCat) return;

    let destination = targetCat.trim();
    const num = parseInt(destination, 10);
    if (!isNaN(num) && num >= 1 && num <= categories.length) {
      destination = categories[num - 1];
    }

    if (!destination) return;

    const ings = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
    const prods = Array.isArray(state.products) ? [...state.products] : [];

    ings.forEach(i => {
      if ((i.category || i.cat || '').toLowerCase().trim() === sourceCat.toLowerCase().trim()) {
        i.category = destination;
        saveIngredient(i).catch(() => {});
      }
    });

    prods.forEach(p => {
      if ((p.category || p.cat || '').toLowerCase().trim() === sourceCat.toLowerCase().trim()) {
        p.category = destination;
        saveProduct(p).catch(() => {});
      }
    });

    const cats = Array.isArray(state.categories) ? [...state.categories] : [];
    state.categories = cats.filter(c => (typeof c === 'string' ? c : c.name || '').toLowerCase().trim() !== sourceCat.toLowerCase().trim());

    setIngredients(ings);
    setProducts(prods);
    render();
  };

  window.handleDeleteCategorySafely = async (catToDelete) => {
    const state = getState() || {};
    const ings = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
    const boundIngs = ings.filter(i => (i.category || i.cat || '').toLowerCase().trim() === catToDelete.toLowerCase().trim());

    if (boundIngs.length > 0) {
      const otherCats = getActiveCategories(state).filter(c => c.toLowerCase().trim() !== catToDelete.toLowerCase().trim());
      const promptMsg = `Category "${catToDelete}" contains ${boundIngs.length} ingredients.\n` +
        `Select a replacement category to reassign these items before deleting:\n` +
        (otherCats.length ? otherCats.map((c, idx) => `${idx + 1}. ${c}`).join('\n') + `\nOr type a new category name (e.g. "Uncategorized"):` : `Type replacement category (default: "Uncategorized"):`);

      const choice = prompt(promptMsg, otherCats[0] || 'Uncategorized');
      if (!choice) return;

      let targetCat = choice.trim();
      const num = parseInt(targetCat, 10);
      if (!isNaN(num) && num >= 1 && num <= otherCats.length) {
        targetCat = otherCats[num - 1];
      }
      if (!targetCat) targetCat = 'Uncategorized';

      boundIngs.forEach(i => {
        i.category = targetCat;
        saveIngredient(i).catch(() => {});
      });

      const prods = Array.isArray(state.products) ? [...state.products] : [];
      prods.forEach(p => {
        if ((p.category || p.cat || '').toLowerCase().trim() === catToDelete.toLowerCase().trim()) {
          p.category = targetCat;
          saveProduct(p).catch(() => {});
        }
      });

      const cats = Array.isArray(state.categories) ? [...state.categories] : [];
      state.categories = cats.filter(c => (typeof c === 'string' ? c : c.name || '').toLowerCase().trim() !== catToDelete.toLowerCase().trim());

      setIngredients(ings);
      setProducts(prods);
      render();
    } else {
      if (confirm(`Delete empty category "${catToDelete}"?`)) {
        const cats = Array.isArray(state.categories) ? [...state.categories] : [];
        state.categories = cats.filter(c => (typeof c === 'string' ? c : c.name || '').toLowerCase().trim() !== catToDelete.toLowerCase().trim());
        setIngredients(ings);
        render();
      }
    }
  };
}
