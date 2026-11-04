/**
 * src/views/PantryBankView.js (v3.38.74)
 * Modular ES6 View for the Pantry Master Catalog.
 * Strictly modular (<350 lines).
 */

import { getState, subscribe } from '../store/store.js';
import { saveRootItem as saveIngredient } from '../services/RootItemRepository.js';
import { openGuidedDelete } from '../components/pantry/GuidedDeleteModalUI.js';
import { 
  buildPantryHierarchy, setAutoDefaultProduct, getActiveCategories,
  invalidateHierarchyCache, slugCategory
} from '../models/PantryHierarchyModel.js';
import { renderProductBank, openProductEditModal } from './ProductBankView.js';
import { buildIngredientBankHTML } from '../components/pantry/PantryBankHTMLTemplate.js';

export let selectedCategoryFilter = null;
export let activeCategoryFilter = null;
export let isCategoryManagerOpen = false;

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

export function resetCategoryFilter() {
  selectedCategoryFilter = activeCategoryFilter = null;
  const input = typeof document !== 'undefined' ? document.getElementById('ingredient-group-search') : null;
  if (input) input.value = '';
  invalidateHierarchyCache();
}

export function setActiveCategoryFilter(cat) {
  selectedCategoryFilter = activeCategoryFilter = (cat && cat !== 'all') ? cat : null;
  renderIngredientBank();
}

export function getFilteredIngredients(items = [], filter = selectedCategoryFilter || activeCategoryFilter) {
  if (!filter || filter === 'all') return items;
  const targetSlug = slugCategory(filter);
  return items.filter(i => slugCategory(i.category) === targetSlug || slugCategory(i.cat) === targetSlug);
}

export function updateActiveCategoryFilter(oldName, newName) {
  if (oldName) {
    const oldSlug = slugCategory(oldName);
    const curFilter = selectedCategoryFilter || activeCategoryFilter;
    if (curFilter && slugCategory(curFilter) === oldSlug) {
      selectedCategoryFilter = activeCategoryFilter = (newName && newName !== 'all') ? newName : null;
    }
    const searchInput = typeof document !== 'undefined' ? document.getElementById('ingredient-group-search') : null;
    if (searchInput?.value && slugCategory(searchInput.value) === oldSlug) searchInput.value = newName || '';
  }
  invalidateHierarchyCache();
  renderIngredientBank();
}

export async function handleSetDefaultProduct(prodId, ingId, subtypeId = null) {
  await setAutoDefaultProduct(prodId, ingId, subtypeId);
  renderIngredientBank();
}

export function promptAddSubtype(ingId) {
  import(`../components/pantry/AddToBankHubUI.js`).then(m => m.openAddToBankModal('subtype', { parentId: ingId }));
}

export function renderIngredientBank() {
  if (typeof document === 'undefined') return;

  const container = document.getElementById('ingredient-groups-list');
  if (!container) return;

  const state = getState(), rootItems = state.rootItems || state.ingredients || [], products = state.products || [];

  if (rootItems.length === 0) {
    container.innerHTML = `<div class="card" style="padding:32px 20px;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px;margin-top:12px;">
      <div style="font-size:32px;margin-bottom:8px">🏛️</div>
      <h3 style="font-size:16px;font-weight:700;margin:0 0 6px 0">No items in Pantry Bank</h3>
      <p style="font-size:12.5px;color:var(--text2,#78716c);margin:0 0 12px 0">Add Categories, Items, and Sub-types to build your master Pantry Bank catalog.</p>
      <button class="btn primary sm" type="button" data-action="add-to-bank">Add to Bank</button>
    </div>`;

    if (!container.hasAttribute('data-delegated')) {
      container.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        if (action === 'create-ingredient-family') {
          if (typeof window.createIngredientFamilyPrompt === 'function') window.createIngredientFamilyPrompt();
        }
      });
      container.setAttribute('data-delegated', 'true');
    }
    return;
  }

  let hierarchy = buildPantryHierarchy(rootItems, products);
  const curFilter = selectedCategoryFilter || activeCategoryFilter;
  if (curFilter && curFilter !== 'all') {
    const targetSlug = slugCategory(curFilter);
    hierarchy = hierarchy.filter(g => slugCategory(g.category) === targetSlug || slugCategory(g.cat) === targetSlug);
  }

  container.innerHTML = buildIngredientBankHTML(hierarchy, escapeHtml, escapeAttr);
  attachPantryBankSearchListener();
  attachPantryBankDelegation();
  const searchInput = document.getElementById('ingredient-group-search');
  if (searchInput?.value) filterPantryBankDOM(searchInput.value);
}

let searchDebounceTimer = null;

export function filterPantryBankDOM(rawQuery = '') {
  const q = String(rawQuery || '').trim().toLowerCase();
  const state = getState();
  const ingredients = state.ingredients || [];
  const products = state.products || [];

  let filteredIngredients = ingredients;
  if (q) {
    filteredIngredients = ingredients.filter(i => {
      const nameMatch = (i.name || '').toLowerCase().includes(q);
      const aliasMatch = Array.isArray(i.aliases) && i.aliases.some(a => String(a).toLowerCase().includes(q));
      const subMatch = Array.isArray(i.subtypes) && i.subtypes.some(s => (s.name || '').toLowerCase().includes(q));
      return nameMatch || aliasMatch || subMatch;
    });
  }

  let hierarchy = buildPantryHierarchy(filteredIngredients, products);
  const curFilter = selectedCategoryFilter || activeCategoryFilter;
  if (curFilter && curFilter !== 'all') {
    const targetSlug = slugCategory(curFilter);
    hierarchy = hierarchy.filter(g => slugCategory(g.category) === targetSlug || slugCategory(g.cat) === targetSlug);
  }

  const container = document.getElementById('ingredient-groups-list');
  if (container) {
    container.innerHTML = buildIngredientBankHTML(hierarchy, escapeHtml, escapeAttr);
    attachPantryBankDelegation();
  }
}

export function attachPantryBankSearchListener() {
  const searchInput = document.getElementById('ingredient-group-search');
  if (!searchInput || searchInput.__hasLivePantryListener) return;
  searchInput.__hasLivePantryListener = true;
  searchInput.addEventListener('input', (e) => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      filterPantryBankDOM(e.target.value);
    }, 300);
  });
}

export function attachPantryBankDelegation() {
  const container = document.getElementById('view-ingredients') || document.getElementById('pantry-bank-container') || document.getElementById('ingredient-groups-list');
  if (!container || container.__hasPantryDelegation) return;
  container.__hasPantryDelegation = true;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const subtypeId = btn.dataset.subtypeId;
    const parentId = btn.dataset.parentId;

    if (action === 'toggle-subtype-collapse') {
      const el = document.getElementById(`subtypes-container-${id}`); if (!el) return;
      const collapsed = el.style.display === 'none'; el.style.display = collapsed ? 'flex' : 'none'; el.classList.toggle('is-expanded', collapsed);
      btn.textContent = `${collapsed ? '▲' : '▼'} SUB-TYPES (${el.children.length})`;
      return;
    } else if (action === 'item-action-sheet') {
      import(`../components/pantry/ActionSheetUI.js`).then(m => {
        m.openActionSheet({
          title: 'Item Options',
          options: [
            {
              label: 'Reorganise Item',
              icon: '🔄',
              onClick: () => import(`../components/pantry/ReorganiseModalUI.js`).then(mod => mod.openReorganiseModal('item', { id }))
            },
            {
              label: 'Manage Aliases',
              icon: '🏷️',
              onClick: () => import(`../components/pantry/ReorganiseModalUI.js`).then(mod => mod.openReorganiseModal('item', { id, tab: 'aliases' }))
            },
            {
              label: 'Delete Item',
              icon: '🗑️',
              isDestructive: true,
              onClick: () => openGuidedDelete({ kind: 'item', id }, { onDone: renderIngredientBank })
            }
          ]
        });
      });
      return;
    } else if (action === 'subtype-action-sheet') {
      import(`../components/pantry/ActionSheetUI.js`).then(m => {
        m.openActionSheet({
          title: 'Sub-type Options',
          options: [
            {
              label: 'Link Product',
              icon: '🔗',
              onClick: () => import(`../components/pantry/SubtypeProductLinkerModalUI.js`).then(mod => mod.openSubtypeLinkSelectionModal(subtypeId, parentId))
            },
            {
              label: 'Reorganise Sub-type',
              icon: '🔄',
              onClick: () => import(`../components/pantry/ReorganiseModalUI.js`).then(mod => mod.openReorganiseModal('subtype', { id: subtypeId, parentId }))
            },
            {
              label: 'Manage Aliases',
              icon: '🏷️',
              onClick: () => import(`../components/pantry/ReorganiseModalUI.js`).then(mod => mod.openReorganiseModal('subtype', { id: subtypeId, parentId, tab: 'aliases' }))
            },
            {
              label: 'Delete Sub-type',
              icon: '🗑️',
              isDestructive: true,
              onClick: () => openGuidedDelete({ kind: 'subtype', itemId: parentId, subtypeId }, { onDone: renderIngredientBank })
            }
          ]
        });
      });
      return;
    } else if (action === 'add-subtype-shortcut') {
      import(`../components/pantry/AddToBankHubUI.js`)
        .then(m => m.openAddToBankModal('subtype', { parentId: id }))
        .catch(err => console.error('Delegation Error [add-subtype-shortcut]:', err));
      return;
    } else if (action === 'reorganise-subtype' || action === 'edit-subtype' || action === 'alias-subtype') {
      import(`../components/pantry/ReorganiseModalUI.js`)
        .then(m => m.openReorganiseModal('subtype', { id: subtypeId, parentId }))
        .catch(err => console.error('Delegation Error [reorganise-subtype]:', err));
    } else if (action === 'link-product') {
      import(`../components/pantry/SubtypeProductLinkerModalUI.js`)
        .then(m => m.openSubtypeLinkSelectionModal(subtypeId, parentId))
        .catch(err => console.error('Delegation Error [link-product]:', err));
    } else if (action === 'reorganise-item' || action === 'alias-item' || action === 'edit-item') {
      import(`../components/pantry/ReorganiseModalUI.js`)
        .then(m => m.openReorganiseModal('item', { id }))
        .catch(err => console.error('Delegation Error [reorganise-item]:', err));
    } else if (action === 'add-to-bank' || action === 'create-ingredient-family') {
      import(`../components/pantry/AddToBankHubUI.js`)
        .then(m => m.openAddToBankModal())
        .catch(err => console.error('Delegation Error [add-to-bank]:', err));
    } else if (action === 'manage-categories' || action === 'open-category-manager' || action === 'reorganise-category') {
      import(`../components/pantry/CategoryManagerModalUI.js`)
        .then(m => m.openCategoryManagerModal())
        .catch(err => console.error('Delegation Error [manage-categories]:', err));
    }
  });
}

let isSubscribed = false;
export function initBankSubscriptions() {
  if (isSubscribed) return;
  isSubscribed = true;
  attachPantryBankDelegation();
  const update = () => { renderIngredientBank(); renderProductBank(); };
  subscribe('ingredients', update); subscribe('products', update);
  if (typeof document !== 'undefined') {
    document.addEventListener('plateplan:state:ingredients', update);
    document.addEventListener('plateplan:state:products', update);
  }
}

export function mount() {
  initBankSubscriptions();
  renderIngredientBank();
  renderProductBank();
  attachPantryBankSearchListener();
  attachPantryBankDelegation();
}
export const renderPantryBankView = renderIngredientBank; export { renderProductBank, openProductEditModal };
export function openAddSubtypeModal(parentId) {
  import(`../components/pantry/AddToBankHubUI.js`).then(m => m.openAddToBankModal('subtype', { parentId }));
}
export function openCategoryManager() {
  import(`../components/pantry/ReorganiseModalUI.js`).then(m => m.openReorganiseModal('category'));
}
export function linkProductToSubtype(parentId, subtypeId) {
  import(`../components/pantry/SubtypeProductLinkerModalUI.js`).then(m => m.openSubtypeLinkSelectionModal(subtypeId, parentId));
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    renderIngredientBank, renderPantryBankView,
    openAddSubtypeModal, linkProductToSubtype,
    handleSetDefaultProduct,
    promptAddSubtype, openCategoryManager, openCategoryManagerModal: openCategoryManager,
    updateActiveCategoryFilter, setActiveCategoryFilter, resetCategoryFilter, getFilteredIngredients,
    createIngredientFamilyPrompt: () => import(`../components/pantry/AddToBankHubUI.js`).then(m => m.openAddToBankModal()),
    toggleSubtypeCollapse(btn, ingId) {
      const el = document.getElementById(`subtypes-container-${ingId}`); if (!el) return;
      const collapsed = el.style.display === 'none'; el.style.display = collapsed ? 'flex' : 'none'; el.classList.toggle('is-expanded', collapsed);
      btn.textContent = `${collapsed ? '▲' : '▼'} SUB-TYPES (${el.children.length})`;
    },
    toggleCardMoreMenu(btn, ingId) {
      document.querySelectorAll('.card-more-menu').forEach(m => { if (m.id !== `card-more-menu-${ingId}`) m.style.display = 'none'; });
      const menu = document.getElementById(`card-more-menu-${ingId}`); if (!menu) return;
      const isHidden = menu.style.display === 'none'; menu.style.display = isHidden ? 'flex' : 'none';
      const close = (e) => { if (!btn.contains(e.target) && !menu.contains(e.target)) { menu.style.display = 'none'; document.removeEventListener('click', close); } };
      if (isHidden) setTimeout(() => document.addEventListener('click', close), 10);
    }
  });
}
