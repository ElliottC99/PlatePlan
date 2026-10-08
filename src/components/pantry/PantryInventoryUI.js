/**
 * src/components/pantry/PantryInventoryUI.js (v3.29.0)
 * Modular Presentation Component for Pantry Stock Items & Inventory Wrappers
 */

import { getState, addPantryItem, updatePantryItem, removePantryItem, toggleUseUpStatus } from '../../store/store.js';
import { renderPantryItemRow } from './PantryItemRow.js';
import { renderPantryCategoryGroup } from './PantryCategoryGroup.js';
import { renderPantryToolbar } from './PantryToolbar.js';
import { renderPantryStockToolbar } from './PantryStockToolbar.js';

export let activePantryTab = 'master-catalog';

export const stockFilterState = {
  searchQuery: '',
  selectedZone: 'all',
  onlyUseUp: false
};

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

export function enrichInventoryItems(inventory = [], ingredients = [], products = []) {
  return (Array.isArray(inventory) ? inventory : [])
    .filter(item => item && item.status !== 'out_of_stock' && Number(item.quantity ?? item.qty ?? 1) > 0)
    .map(item => {
      const ing = item.ingredientId
        ? ingredients.find(i => String(i.id) === String(item.ingredientId))
        : null;
      const sub = (ing && item.subtypeId && Array.isArray(ing.subtypes))
        ? ing.subtypes.find(s => String(s.id) === String(item.subtypeId))
        : null;
      const prod = item.productId
        ? products.find(p => String(p.id) === String(item.productId))
        : (sub?.defaultProductId
          ? products.find(p => String(p.id) === String(sub.defaultProductId))
          : (ing?.defaultProductId
            ? products.find(p => String(p.id) === String(ing.defaultProductId))
            : null));

      const displayName = item.customName || item.name || (sub ? `${sub.name} (${ing?.name || ''})` : (ing?.name || 'Pantry Item'));
      const category = item.category || ing?.category || prod?.category || 'Store Cupboard';
      const storage = (item.storage || prod?.storage || 'cupboard').toLowerCase();
      const unit = item.unit || prod?.packUnit || ing?.unit || 'qty';

      return {
        ...item,
        customName: displayName,
        name: displayName,
        category,
        storage,
        unit
      };
    });
}

export function renderPantryInventoryList(items = []) {
  if (!items || !items.length) {
    return `<div class="card pantry-empty" style="padding:32px 20px;text-align:center;color:var(--text2,#78716c);font-size:13px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px">
      <div style="font-size:30px;margin-bottom:8px">📦</div>
      <h3 style="margin:0 0 6px 0;font-size:16px;font-weight:750;color:var(--text,#1c1917)">No Active Stock Recorded</h3>
      <p style="margin:0 0 14px 0;font-size:12.5px;color:var(--text2,#78716c)">Add items from your Pantry Bank (Master Catalog) with 1 click or add a stock item directly.</p>
      <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn sm secondary" onclick="window.switchPantryTab('master-catalog')">🏛️ Browse Master Catalog</button>
        <button type="button" class="btn sm primary" onclick="window.openAddPantryStockModal()">+ Add Stock Item</button>
      </div>
    </div>`;
  }

  const grouped = new Map();
  items.forEach(item => {
    const cat = item.category || 'Store Cupboard';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat).push(item);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([catName, groupItems]) => `
      <div class="card" style="padding:14px 16px;margin-bottom:14px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px">
        ${renderPantryCategoryGroup(catName, groupItems)}
      </div>
    `)
    .join('');
}

export function openAddPantryStockModal(ingredients = []) {
  if (typeof document === 'undefined') return;
  let modalEl = document.getElementById('add-pantry-stock-modal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'add-pantry-stock-modal';
    modalEl.className = 'modal-wrap';
    modalEl.style.zIndex = '12000';
    document.body.appendChild(modalEl);
  }

  const ingOptions = (Array.isArray(ingredients) ? ingredients : [])
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .map(i => `<option value="${escapeAttr(i.id)}">${escapeHtml(i.name)} (${escapeHtml(i.category || 'General')})</option>`)
    .join('');

  modalEl.innerHTML = `
    <div class="modal-backdrop" id="add-stock-modal-backdrop"></div>
    <div class="modal" style="max-width:460px;width:92%;padding:20px;background:var(--surface,#fff);border-radius:14px;border:1px solid var(--border,#e7e5e4)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h3 style="margin:0;font-size:16px;font-weight:750">📦 Add Item to Active Stock</h3>
        <button type="button" class="btn sm ghost" id="btn-close-add-stock-modal">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label for="stock-modal-ing-select" style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Link to Catalog Ingredient (Optional)</label>
          <select id="stock-modal-ing-select" name="stockModalIngSelect" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;background:var(--surface,#fff)">
            <option value="">-- Custom / Unlinked Item --</option>
            ${ingOptions}
          </select>
        </div>
        <div>
          <label for="stock-modal-name-input" style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Item Name *</label>
          <input type="text" id="stock-modal-name-input" name="stockModalNameInput" placeholder="e.g. Extra Firm Tofu, Oat Milk" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;box-sizing:border-box" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div>
            <label for="stock-modal-qty-input" style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Quantity</label>
            <input type="number" id="stock-modal-qty-input" name="stockModalQtyInput" value="1" min="0.1" step="any" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;box-sizing:border-box" />
          </div>
          <div>
            <label for="stock-modal-unit-input" style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Unit</label>
            <input type="text" id="stock-modal-unit-input" name="stockModalUnitInput" value="qty" placeholder="g, ml, qty" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;box-sizing:border-box" />
          </div>
          <div>
            <label for="stock-modal-storage-select" style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Storage</label>
            <select id="stock-modal-storage-select" name="stockModalStorageSelect" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;background:var(--surface,#fff)">
              <option value="cupboard">🥫 Cupboard</option>
              <option value="fridge">❄️ Fridge</option>
              <option value="freezer">🧊 Freezer</option>
            </select>
          </div>
        </div>
        <div>
          <label for="stock-modal-expiry-input" style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Expiry Date (Optional)</label>
          <input type="date" id="stock-modal-expiry-input" name="stockModalExpiryInput" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;box-sizing:border-box" />
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px">
          <button type="button" class="btn ghost" id="btn-cancel-add-stock-modal">Cancel</button>
          <button type="button" class="btn primary" id="btn-save-add-stock-modal">Add to Active Stock</button>
        </div>
      </div>
    </div>
  `;

  const close = () => modalEl.classList.remove('open');
  modalEl.querySelector('#add-stock-modal-backdrop')?.addEventListener('click', close);
  modalEl.querySelector('#btn-close-add-stock-modal')?.addEventListener('click', close);
  modalEl.querySelector('#btn-cancel-add-stock-modal')?.addEventListener('click', close);

  const ingSelect = modalEl.querySelector('#stock-modal-ing-select');
  const nameInput = modalEl.querySelector('#stock-modal-name-input');
  if (ingSelect && nameInput) {
    ingSelect.onchange = () => {
      const picked = (ingredients || []).find(i => String(i.id) === String(ingSelect.value));
      if (picked && !nameInput.value.trim()) {
        nameInput.value = picked.name || '';
      }
    };
  }

  modalEl.querySelector('#btn-save-add-stock-modal')?.addEventListener('click', () => {
    const ingId = ingSelect?.value || null;
    const picked = ingId ? (ingredients || []).find(i => String(i.id) === String(ingId)) : null;
    const customName = (nameInput?.value || picked?.name || '').trim();
    if (!customName) return;

    const quantity = Number(modalEl.querySelector('#stock-modal-qty-input')?.value) || 1;
    const unit = (modalEl.querySelector('#stock-modal-unit-input')?.value || 'qty').trim();
    const storage = modalEl.querySelector('#stock-modal-storage-select')?.value || 'cupboard';
    const expiryDate = modalEl.querySelector('#stock-modal-expiry-input')?.value || null;

    if (typeof window.addPantryItem === 'function') {
      window.addPantryItem({
        ingredientId: ingId,
        customName,
        category: picked?.category || 'Store Cupboard',
        storage,
        quantity,
        unit,
        expiryDate
      });
    }
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast(`Added ${customName} to Active Stock`, 'success');
    }
    close();
  });

  modalEl.classList.add('open');
}

export function switchPantryTab(tabName = 'master-catalog') {
  activePantryTab = tabName === 'active-stock' ? 'active-stock' : 'master-catalog';
  if (typeof document === 'undefined') return;

  const activeStockPanel = document.getElementById('pantry-tab-active-stock');
  const masterCatalogPanel = document.getElementById('pantry-tab-master-catalog');
  const btnActive = document.getElementById('btn-pantry-tab-active-stock');
  const btnMaster = document.getElementById('btn-pantry-tab-master-catalog');

  const isStock = activePantryTab === 'active-stock';
  if (activeStockPanel) activeStockPanel.style.display = isStock ? 'block' : 'none';
  if (masterCatalogPanel) masterCatalogPanel.style.display = isStock ? 'none' : 'block';

  if (btnActive) {
    btnActive.setAttribute('aria-selected', isStock ? 'true' : 'false');
    btnActive.style.background = isStock ? 'var(--surface,#fff)' : 'transparent';
    btnActive.style.color = isStock ? 'var(--text,#1c1917)' : 'var(--text2,#78716c)';
    btnActive.style.boxShadow = isStock ? '0 1px 3px rgba(0,0,0,0.08)' : 'none';
  }
  if (btnMaster) {
    btnMaster.setAttribute('aria-selected', !isStock ? 'true' : 'false');
    btnMaster.style.background = !isStock ? 'var(--surface,#fff)' : 'transparent';
    btnMaster.style.color = !isStock ? 'var(--text,#1c1917)' : 'var(--text2,#78716c)';
    btnMaster.style.boxShadow = !isStock ? '0 1px 3px rgba(0,0,0,0.08)' : 'none';
  }

  renderActiveStockTab();
  if (typeof window !== 'undefined' && typeof window.renderIngredientBank === 'function') {
    window.renderIngredientBank();
  }
}

export function renderActiveStockTab() {
  if (typeof document === 'undefined') return;
  const state = getState() || {};
  const inventory = state.inventory || [];
  const ingredients = state.ingredients || [];
  const products = state.products || [];

  const enriched = enrichInventoryItems(inventory, ingredients, products);

  const badgeStock = document.getElementById('pantry-active-stock-badge');
  if (badgeStock) badgeStock.textContent = String(enriched.length);
  const badgeMaster = document.getElementById('pantry-master-catalog-badge');
  if (badgeMaster) badgeMaster.textContent = String(ingredients.length);

  const toolbarHost = document.getElementById('pantry-stock-toolbar-host');
  if (toolbarHost && !toolbarHost.innerHTML) {
    toolbarHost.innerHTML = renderPantryStockToolbar(stockFilterState);
  }

  const listHost = document.getElementById('pantry-active-stock-list');
  if (!listHost) return;

  const q = (stockFilterState.searchQuery || '').trim().toLowerCase();
  const zone = (stockFilterState.selectedZone || 'all').toLowerCase();

  const filtered = enriched.filter(item => {
    if (stockFilterState.onlyUseUp && !item.isUseUp) return false;
    if (zone !== 'all') {
      const itemZone = (item.storage || 'cupboard').toLowerCase();
      if (zone === 'cupboard' || zone === 'pantry') {
        if (itemZone !== 'cupboard' && itemZone !== 'pantry') return false;
      } else if (itemZone !== zone) {
        return false;
      }
    }
    if (q) {
      const matchName = String(item.customName || item.name || '').toLowerCase().includes(q);
      const matchCat = String(item.category || '').toLowerCase().includes(q);
      if (!matchName && !matchCat) return false;
    }
    return true;
  });

  listHost.innerHTML = renderPantryInventoryList(filtered);
}

export function addCatalogItemToActiveStock(ingredientId, subtypeId = '') {
  if (!ingredientId) return null;
  const state = getState() || {};
  const ingredients = state.ingredients || [];
  const products = state.products || [];

  const ing = ingredients.find(i => String(i.id) === String(ingredientId));
  if (!ing) return null;

  const cleanSubtypeId = subtypeId ? String(subtypeId).trim() : '';
  const sub = cleanSubtypeId && Array.isArray(ing.subtypes)
    ? ing.subtypes.find(s => String(s.id) === cleanSubtypeId)
    : null;

  const resolvedProduct = sub?.defaultProductId
    ? products.find(p => String(p.id) === String(sub.defaultProductId))
    : (ing.defaultProductId
      ? products.find(p => String(p.id) === String(ing.defaultProductId))
      : products.find(p => (cleanSubtypeId && String(p.subtypeId) === cleanSubtypeId) || String(p.ingredientId) === String(ing.id)));

  const displayName = sub ? `${sub.name} (${ing.name})` : ing.name;
  const defaultQty = Number(resolvedProduct?.pack || resolvedProduct?.packSize) || 1;
  const defaultUnit = resolvedProduct?.packUnit || ing.unit || 'qty';
  const storageZone = (resolvedProduct?.storage || 'cupboard').toLowerCase();
  const category = ing.category || 'Store Cupboard';
  const deterministicId = cleanSubtypeId ? `inv_${ing.id}_${cleanSubtypeId}` : `inv_${ing.id}`;

  const created = addPantryItem({
    id: deterministicId,
    ingredientId: ing.id,
    subtypeId: cleanSubtypeId || null,
    productId: resolvedProduct?.id || null,
    customName: displayName,
    category,
    storage: storageZone,
    quantity: defaultQty,
    unit: defaultUnit,
    status: 'in_stock'
  });

  if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast(`Added ${displayName} to Active Stock`, 'success');
  }
  renderActiveStockTab();
  if (typeof window !== 'undefined' && typeof window.renderIngredientBank === 'function') {
    window.renderIngredientBank();
  }
  return created;
}

export function adjustPantryStock(itemId, delta = 1) {
  const state = getState() || {};
  const item = (state.inventory || []).find(i => String(i.id) === String(itemId));
  if (!item) return;
  const currentQty = Number(item.quantity ?? item.qty ?? 1) || 1;
  const step = currentQty >= 50 ? (delta * 50) : delta;
  const nextQty = Number((currentQty + step).toFixed(2));
  if (nextQty <= 0) {
    removePantryItem(itemId);
  } else {
    updatePantryItem(itemId, { quantity: nextQty, status: 'in_stock' });
  }
}

export function removePantryStock(itemId) {
  if (!itemId) return;
  removePantryItem(itemId);
}

export function togglePantryUseUp(itemId) {
  if (!itemId) return;
  toggleUseUpStatus(itemId);
}

export function handlePantrySearchFilter(val) {
  const input = typeof document !== 'undefined' ? document.getElementById('pantry-search-input') : null;
  stockFilterState.searchQuery = val !== undefined ? val : (input?.value || '');
  renderActiveStockTab();
}

export function handlePantryZoneChange(val) {
  const select = typeof document !== 'undefined' ? document.getElementById('pantry-zone-select') : null;
  stockFilterState.selectedZone = val !== undefined ? val : (select?.value || 'all');
  renderActiveStockTab();
}

export function togglePantryUseUpFilter() {
  stockFilterState.onlyUseUp = !stockFilterState.onlyUseUp;
  const toolbarHost = typeof document !== 'undefined' ? document.getElementById('pantry-stock-toolbar-host') : null;
  if (toolbarHost) toolbarHost.innerHTML = renderPantryStockToolbar(stockFilterState);
  renderActiveStockTab();
}

export {
  renderPantryItemRow,
  renderPantryCategoryGroup,
  renderPantryToolbar,
  renderPantryStockToolbar
};
