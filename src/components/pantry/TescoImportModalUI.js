/**
 * src/components/pantry/TescoImportModalUI.js (v3.20.04)
 * Sub-type Product Link Modals: Selection, Picker & Tesco JSON Import.
 * Strictly modular (< 400 lines) with clean dialogue lifecycle.
 */

import { getState, setProducts } from '../../store/store.js';
import { saveProduct } from '../../services/HouseholdRepository.js';

const escapeHTML = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function showModal(html) {
  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (wrap && content) {
    content.innerHTML = html;
    wrap.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

export function closeModal() {
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) {
    wrap.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function formatBrandProductLabel(p) {
  if (!p) return '';
  const brand = String(p.brand || '').trim();
  let pName = String(p.name || p.title || '').trim();
  if (brand && pName.toLowerCase().startsWith(brand.toLowerCase())) {
    pName = pName.slice(brand.length).replace(/^[\s\-–—:]+/, '').trim();
  }
  return (brand && pName) ? `${brand} ${pName}` : (pName || brand || 'Unnamed Product');
}

export function openSubtypeLinkSelectionModal(subtypeId, parentId) {
  const state = getState() || {};
  const parent = (state.ingredients || []).find(i => String(i.id) === String(parentId));
  const subName = subtypeId 
    ? parent?.subtypes?.find(s => String(s.id) === String(subtypeId))?.name 
    : (window.__draftSubtypePayload?.name || 'New Sub-type');

  const html = `
    <div style="padding: 24px; max-width: 520px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px;">
      <h3 style="margin-top:0; margin-bottom: 6px; font-size: 1.15rem; font-weight: 750;">🔗 Link Product: ${escapeHTML(subName)}</h3>
      <p style="font-size: 13px; color: var(--text2,#78716c); margin: 0 0 20px 0;">Select how you want to attach a grocery item or barcode to this sub-type.</p>

      <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
        <div onclick="window.handleSubtypeLinkRoute('link', '${subtypeId || ''}', '${parentId}')" style="cursor:pointer; display:flex; align-items:center; gap:12px; padding:12px 16px; border:1px solid var(--border,#e7e5e4); border-radius:10px; background:#fff; transition: background 0.15s;" onmouseover="this.style.background='var(--surface2,#f5f5f4)'" onmouseout="this.style.background='#fff'">
          <div style="font-size: 24px;">🔗</div>
          <div>
            <div style="font-weight: 750; font-size: 13.5px;">1. Link Existing Product(s)</div>
            <div style="font-size: 11.5px; color: var(--text2);">Search and attach a product already in your Product Bank.</div>
          </div>
        </div>

        <div onclick="window.handleSubtypeLinkRoute('manual', '${subtypeId || ''}', '${parentId}')" style="cursor:pointer; display:flex; align-items:center; gap:12px; padding:12px 16px; border:1px solid var(--border,#e7e5e4); border-radius:10px; background:#fff; transition: background 0.15s;" onmouseover="this.style.background='var(--surface2,#f5f5f4)'" onmouseout="this.style.background='#fff'">
          <div style="font-size: 24px;">➕</div>
          <div>
            <div style="font-weight: 750; font-size: 13.5px;">2. Add Product Manually</div>
            <div style="font-size: 11.5px; color: var(--text2);">Type nutritional data, price, and pack weights directly.</div>
          </div>
        </div>

        <div onclick="window.handleSubtypeLinkRoute('tesco', '${subtypeId || ''}', '${parentId}')" style="cursor:pointer; display:flex; align-items:center; gap:12px; padding:12px 16px; border:1px solid var(--border,#e7e5e4); border-radius:10px; background:#fff; transition: background 0.15s;" onmouseover="this.style.background='var(--surface2,#f5f5f4)'" onmouseout="this.style.background='#fff'">
          <div style="font-size: 24px;">🛒</div>
          <div>
            <div style="font-weight: 750; font-size: 13.5px;">3. Import from Tesco</div>
            <div style="font-size: 11.5px; color: var(--text2);">Use our simple browser bookmarklet to paste Tesco grocery links.</div>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Cancel</button>
      </div>
    </div>
  `;

  showModal(html);
}

export function openSubtypeExistingProductPickerModal(subtypeId, parentId) {
  const state = getState() || {};
  const products = Array.isArray(state.products) ? state.products : [];
  const parent = (state.ingredients || []).find(i => String(i.id) === String(parentId));
  const subName = subtypeId 
    ? parent?.subtypes?.find(s => String(s.id) === String(subtypeId))?.name 
    : (window.__draftSubtypePayload?.name || 'New Sub-type');

  const html = `
    <div style="padding: 20px; max-width: 500px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 6px; font-size: 1.15rem; font-weight: 750;">🔗 Select Existing Products for "${escapeHTML(subName)}"</h3>
      <p style="font-size: 12.5px; color: var(--text2,#78716c); margin: 0 0 14px 0;">Search your product bank and check one or more items to attach.</p>

      <div style="margin-bottom: 12px;">
        <input type="text" id="picker-search-input" placeholder="🔍 Search products by title or brand..." style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12.5px;" />
      </div>

      <div id="picker-product-list" style="display:flex; flex-direction:column; gap:6px; max-height:220px; overflow-y:auto; padding:6px; background:var(--surface2,#f5f5f4); border:1px solid var(--border,#e7e5e4); border-radius:8px; margin-bottom: 18px;"></div>

      <div style="display:flex; gap:8px; justify-content: flex-end; align-items:center;">
        <span id="picker-selected-count" style="font-size:12px; color:var(--text2); margin-right:auto; font-weight:600;">0 selected</span>
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn primary" id="btn-confirm-picker-link" disabled style="opacity:0.5; pointer-events:none;">Link Selected Product(s)</button>
      </div>
    </div>
  `;

  showModal(html);

  const searchInput = document.getElementById('picker-search-input');
  const listContainer = document.getElementById('picker-product-list');
  const confirmBtn = document.getElementById('btn-confirm-picker-link');
  const countEl = document.getElementById('picker-selected-count');
  const checkedIds = new Set(window.__draftSubtypePayload?.linkedProductIds || []);

  const updateBtnState = () => {
    const count = checkedIds.size;
    countEl.textContent = `${count} selected`;
    confirmBtn.disabled = count < 1;
    confirmBtn.style.opacity = count >= 1 ? '1' : '0.5';
    confirmBtn.style.pointerEvents = count >= 1 ? 'auto' : 'none';
  };

  const renderList = (filterText = '') => {
    const query = filterText.toLowerCase().trim();
    const filtered = products.filter(p => !query || (p.name || '').toLowerCase().includes(query) || (p.brand || '').toLowerCase().includes(query));

    if (!filtered.length) {
      listContainer.innerHTML = `<div style="text-align:center; padding:16px; font-size:12px; color:var(--text2);">No products found matching "${escapeHTML(query)}".</div>`;
      return;
    }

    listContainer.innerHTML = filtered.map(p => {
      const isChecked = checkedIds.has(String(p.id));
      return `
        <label style="display:flex; align-items:center; gap:10px; padding:8px 10px; background:#fff; border:1px solid var(--border,#e7e5e4); border-radius:6px; cursor:pointer;">
          <input type="checkbox" class="product-picker-cb" value="${escapeHTML(p.id)}" ${isChecked ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--primary,#4f46e5); cursor:pointer;" />
          <div style="flex:1; min-width:0;">
            <div style="font-size:12.5px; font-weight:650; color:var(--text,#1c1917); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHTML(formatBrandProductLabel(p))}</div>
            <div style="font-size:11px; color:var(--text2,#78716c);">£${Number(p.price || 0).toFixed(2)}</div>
          </div>
        </label>
      `;
    }).join('');

    listContainer.querySelectorAll('.product-picker-cb').forEach(cb => {
      cb.onchange = () => {
        if (cb.checked) checkedIds.add(cb.value);
        else checkedIds.delete(cb.value);
        updateBtnState();
      };
    });
  };

  searchInput.oninput = () => renderList(searchInput.value);
  renderList();
  updateBtnState();

  confirmBtn.onclick = async () => {
    const selectedArray = Array.from(checkedIds);
    if (!selectedArray.length) return;
    closeModal();

    if (subtypeId && parentId) {
      const updatedProds = products.map(p => selectedArray.includes(String(p.id))
        ? { ...p, ingredientId: parentId, subtypeId: subtypeId, updatedAt: new Date().toISOString() }
        : p);
      setProducts(updatedProds);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      if (typeof window.renderProductBank === 'function') window.renderProductBank();
      await Promise.all(updatedProds.filter(p => selectedArray.includes(String(p.id))).map(p => saveProduct(p)));
    } else {
      if (!window.__draftSubtypePayload) window.__draftSubtypePayload = { parentId, name: subName, notes: '' };
      window.__draftSubtypePayload.linkedProductIds = selectedArray;
      if (typeof window.openIngredientFamilyDetailsModal === 'function') {
        window.openIngredientFamilyDetailsModal(null, parentId);
      }
    }
  };
}

export function openTescoImportModal(subtypeId, parentId) {
  const state = getState() || {};
  const parent = (state.ingredients || []).find(i => String(i.id) === String(parentId));
  const parentCategory = parent?.category || 'General';
  const subName = subtypeId 
    ? parent?.subtypes?.find(s => String(s.id) === String(subtypeId))?.name 
    : (window.__draftSubtypePayload?.name || parent?.name || 'Item');
  const tescoSearchUrl = `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(subName)}`;

  const html = `
    <div style="padding: 24px; max-width: 520px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px;">
      <h3 style="margin-top:0; margin-bottom: 8px; font-size: 1.15rem; font-weight: 750;">🛒 Import Product from Tesco</h3>
      <div style="margin-bottom: 16px;">
        <a href="${tescoSearchUrl}" target="_blank" rel="noopener" class="btn sm ghost" style="display:inline-flex; align-items:center; gap:6px; color:var(--primary,#4f46e5); font-weight:600; font-size:12.5px; padding:6px 12px; border:1px solid rgba(79,70,229,0.2); background:rgba(79,70,229,0.05); border-radius:8px; text-decoration:none;">
          🔍 Search Tesco for "${escapeHTML(subName)}" ↗
        </a>
      </div>
      <div style="padding:10px 12px; background:var(--surface2,#f5f5f4); border:1px solid var(--border,#e7e5e4); border-radius:8px; margin-bottom: 16px; font-size:12px; color:var(--text2,#78716c);">
        <div style="font-weight:750; color:var(--text,#1c1917); margin-bottom:3px;">🔖 Tesco to PlatePlan Bookmarklet</div>
        <div>Drag the bookmarklet from Settings to your browser bar. Click it on any Tesco product page, copy the generated JSON string, and paste it below.</div>
      </div>
      <div class="field" style="margin-bottom: 12px;">
        <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:6px;">Paste Tesco Bookmarklet JSON Output</label>
        <textarea id="tesco-json-input" placeholder='{"title":"Tesco Bagels 4 Pack","price":1.50,"brand":"Tesco",...}' style="width:100%; min-height:110px; font-family:monospace; font-size:11.5px; padding:10px; border:1px solid var(--border,#e7e5e4); border-radius:8px; outline:none; background:#fff;"></textarea>
      </div>
      <div id="tesco-import-error-msg" style="display:none; margin-bottom:14px;"></div>
      <div style="display:flex; gap:8px; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn primary" id="btn-review-tesco-import">Review Import Data</button>
      </div>
    </div>
  `;

  showModal(html);

  const jsonInput = document.getElementById('tesco-json-input');
  const errorMsg = document.getElementById('tesco-import-error-msg');
  document.getElementById('btn-review-tesco-import').onclick = () => {
    const raw = (jsonInput ? jsonInput.value : '').trim();
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
    if (!parsed || typeof parsed !== 'object') {
      if (errorMsg) {
        errorMsg.style.display = 'block';
        errorMsg.innerHTML = `<div style="padding:10px; background:#fee2e2; color:#ef4444; border-radius:8px; font-weight:600; font-size:12px;">⚠️ Invalid Tesco JSON string. Please copy directly from the bookmarklet output.</div>`;
      }
      return;
    }
    parsed.category = parentCategory;
    closeModal();
    window.__prefilledResolveBinding = {
      ingredientId: parentId,
      subtypeId: subtypeId || null,
      subtypeDraftName: window.__draftSubtypePayload?.name || null,
      parentCategory,
      tescoImportData: parsed
    };
    setTimeout(() => {
      if (typeof window.openProductEditModal === 'function') window.openProductEditModal(null);
    }, 150);
  };
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    openSubtypeLinkSelectionModal,
    openSubtypeExistingProductPickerModal,
    openTescoImportModal
  });
}
