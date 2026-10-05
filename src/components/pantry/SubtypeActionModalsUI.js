/**
 * src/components/pantry/SubtypeActionModalsUI.js (v3.20.01)
 * Standardised custom styled dialogues and workflows for nested sub-types.
 * Eliminates all prompt(), alert(), and confirm() browser chrome calls.
 * Strictly modular (< 400 lines) and sanitised of legacy terminology.
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { saveIngredient, saveProduct } from '../../services/HouseholdRepository.js';
import { promptReallocateProduct, openProductReallocateModal } from './ReallocateProductModalUI.js';
import {
  promptAddAlias,
  promptRemoveAlias,
  handlePromoteSubtype,
  promptDemote,
  promptMerge,
  handleDeleteIngredient,
  handleDeleteProduct,
  showCustomAlert,
  openIngredientReorganiseModal
} from './IngredientActionModalsUI.js';

export {
  promptReallocateProduct,
  openProductReallocateModal,
  promptAddAlias,
  promptRemoveAlias,
  handlePromoteSubtype,
  promptDemote,
  promptMerge,
  handleDeleteIngredient,
  handleDeleteProduct,
  showCustomAlert,
  openIngredientReorganiseModal
};

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

// 1. EDIT SUB-TYPE MODAL
export function openEditSubtypeModal(subtypeId, parentId) {
  const state = getState() || {};
  const parent = (state.ingredients || []).find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) return;
  const sub = parent.subtypes.find(s => String(s.id) === String(subtypeId));
  if (!sub) return;

  const linkedProds = (state.products || []).filter(p => String(p.subtypeId) === String(subtypeId));

  const html = `
    <div style="padding: 20px; max-width: 500px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 16px; font-size: 1.15rem; font-weight: 750;">📝 Edit Sub-type: ${escapeHTML(sub.name)}</h3>
      
      <div class="field" style="margin-bottom: 12px;">
        <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 4px;">Sub-type Name</label>
        <input type="text" id="edit-sub-name" class="input" value="${escapeHTML(sub.name)}" style="width:100%;" />
      </div>

      <div class="field" style="margin-bottom: 16px;">
        <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 4px;">Notes</label>
        <textarea id="edit-sub-notes" class="input" style="width:100%; min-height: 70px;">${escapeHTML(sub.notes || '')}</textarea>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 0.85rem; font-weight: 750; margin: 0 0 8px 0;">Linked Products (${linkedProds.length})</h4>
        <div style="display:flex; flex-direction:column; gap:6px; max-height:140px; overflow-y:auto; background:var(--surface2,#f5f5f4); padding:8px; border-radius:8px;">
          ${linkedProds.map(p => `
            <div style="font-size:12px; display:flex; justify-content:space-between; align-items:center; background:#fff; padding:6px 10px; border-radius:6px; border:1px solid var(--border,#e7e5e4)">
              <div>
                <span style="font-weight:600;">${escapeHTML(formatBrandProductLabel(p))}</span>
              </div>
              <button type="button" class="btn xs ghost" onclick="window.handleUnlinkProductFromSubtype('${escapeHTML(p.id)}', '${escapeHTML(subtypeId)}', '${escapeHTML(parentId)}')" style="color:var(--red,#ef4444); font-weight:bold;" title="Unlink product">&times; Unlink</button>
            </div>
          `).join('') || '<div style="font-size:12px; color:var(--text2); text-align:center; padding:10px 0;">No products linked yet.</div>'}
        </div>
      </div>

      <div style="display:flex; gap:8px; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn primary" id="save-edit-sub-btn">Save Changes</button>
      </div>
    </div>
  `;

  showModal(html);

  window.handleUnlinkProductFromSubtype = async (prodId, subId, pId) => {
    const prods = [...(state.products || [])];
    const prod = prods.find(p => String(p.id) === String(prodId));
    if (prod) {
      prod.subtypeId = null;
      prod.isAutoDefault = false;
      prod.updatedAt = new Date().toISOString();
      setProducts(prods);
      openEditSubtypeModal(subId, pId);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      if (typeof window.renderProductBank === 'function') window.renderProductBank();
      await saveProduct(prod);
    }
  };

  document.getElementById('save-edit-sub-btn').onclick = async () => {
    const newName = document.getElementById('edit-sub-name').value.trim();
    if (!newName) return;
    sub.name = newName;
    sub.notes = document.getElementById('edit-sub-notes').value.trim();
    parent.updatedAt = new Date().toISOString();
    
    setIngredients([...state.ingredients]);
    closeModal();
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    await saveIngredient(parent);
  };
}

// 2. LINK PRODUCT SELECTOR MODAL
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

// 2a. PATH 1: EXISTING PRODUCT PICKER MODAL
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

// 2b. PATH 3: TESCO JSON IMPORT MODAL
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

// 3. CONSOLIDATED REORGANISE MODAL (Promote, Move, Merge)
export function openSubtypeReorganizeModal(subtypeId, parentId) {
  const state = getState() || {};
  const currentIngs = state.ingredients || [];
  const parent = currentIngs.find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) return;
  const sub = parent.subtypes.find(s => String(s.id) === String(subtypeId));
  if (!sub) return;

  const targetParents = currentIngs.filter(i => String(i.id) !== String(parentId));
  const siblingSubtypes = parent.subtypes.filter(s => String(s.id) !== String(subtypeId));

  const html = `
    <div style="padding: 24px; max-width: 500px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 16px; font-size: 1.15rem; font-weight: 750;">🔀 Reorganise: ${escapeHTML(sub.name)}</h3>
      <div style="padding: 12px; border: 1px solid var(--border,#e7e5e4); border-radius: 8px; margin-bottom: 12px; background: #fafaf9;">
        <div style="font-weight: 750; font-size: 13px; display:flex; align-items:center; justify-content:space-between">
          <span>🚀 Option A: Promote to Standalone Ingredient</span>
          <button type="button" class="btn sm" id="btn-reorg-promote">Promote</button>
        </div>
        <p style="margin:4px 0 0 0; font-size:11px; color:var(--text2)">Ejects this sub-type from parent "${escapeHTML(parent.name)}" into a standalone card.</p>
      </div>
      <div style="padding: 12px; border: 1px solid var(--border,#e7e5e4); border-radius: 8px; margin-bottom: 12px; background: #fafaf9;">
        <div style="font-weight: 750; font-size: 13px; margin-bottom: 6px;">📦 Option B: Move to another Parent Ingredient</div>
        <div style="display:flex; gap:8px;">
          <select id="reorg-move-select" style="flex:1; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:12px;">
            ${targetParents.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${escapeHTML(p.category || 'Other')})</option>`).join('')}
          </select>
          <button type="button" class="btn sm" id="btn-reorg-move">Move</button>
        </div>
      </div>
      <div style="padding: 12px; border: 1px solid var(--border,#e7e5e4); border-radius: 8px; margin-bottom: 20px; background: #fafaf9;">
        <div style="font-weight: 750; font-size: 13px; margin-bottom: 6px;">🔀 Option C: Merge into another Sub-type sibling</div>
        <div style="display:flex; gap:8px;">
          <select id="reorg-merge-select" style="flex:1; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:12px;" ${siblingSubtypes.length === 0 ? 'disabled' : ''}>
            ${siblingSubtypes.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join('') || '<option>No siblings available</option>'}
          </select>
          <button type="button" class="btn sm" id="btn-reorg-merge" ${siblingSubtypes.length === 0 ? 'disabled' : ''}>Merge</button>
        </div>
      </div>
      <div style="display:flex; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Cancel</button>
      </div>
    </div>
  `;

  showModal(html);

  document.getElementById('btn-reorg-promote').onclick = async () => {
    closeModal();
    await handlePromoteSubtype(subtypeId, parentId);
  };

  document.getElementById('btn-reorg-move').onclick = async () => {
    const targetParentId = document.getElementById('reorg-move-select').value;
    if (!targetParentId) return;
    closeModal();
    const targetParent = currentIngs.find(i => String(i.id) === String(targetParentId));
    if (targetParent) {
      const subtypeIdx = parent.subtypes.findIndex(s => String(s.id) === String(subtypeId));
      if (subtypeIdx >= 0) {
        const [movedSub] = parent.subtypes.splice(subtypeIdx, 1);
        if (!Array.isArray(targetParent.subtypes)) targetParent.subtypes = [];
        targetParent.subtypes.push(movedSub);
        parent.updatedAt = new Date().toISOString();
        targetParent.updatedAt = new Date().toISOString();
        const prods = [...(state.products || [])].map(p => (String(p.subtypeId) === String(subtypeId)) ? { ...p, ingredientId: targetParent.id, updatedAt: new Date().toISOString() } : p);
        setIngredients(currentIngs); setProducts(prods);
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        await Promise.all([saveIngredient(parent), saveIngredient(targetParent), ...prods.filter(p => String(p.subtypeId) === String(subtypeId)).map(p => saveProduct(p))]);
      }
    }
  };

  document.getElementById('btn-reorg-merge').onclick = async () => {
    const targetSubtypeId = document.getElementById('reorg-merge-select').value;
    if (!targetSubtypeId) return;
    closeModal();
    const target = parent.subtypes.find(s => String(s.id) === String(targetSubtypeId));
    if (target) {
      const targetAliases = new Set(Array.isArray(target.aliases) ? target.aliases : []);
      if (sub.name) targetAliases.add(sub.name);
      if (Array.isArray(sub.aliases)) sub.aliases.forEach(a => targetAliases.add(a));
      target.aliases = Array.from(targetAliases);
      parent.subtypes = parent.subtypes.filter(s => String(s.id) !== String(subtypeId));
      parent.updatedAt = new Date().toISOString();
      const prods = [...(state.products || [])].map(p => String(p.subtypeId) === String(subtypeId) ? { ...p, subtypeId: target.id, updatedAt: new Date().toISOString() } : p);
      setIngredients([...state.ingredients]); setProducts(prods);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      if (typeof window.renderProductBank === 'function') window.renderProductBank();
      await Promise.all([saveIngredient(parent), ...prods.filter(p => String(p.subtypeId) === String(target.id)).map(p => saveProduct(p))]);
    }
  };
}

// 4. MANAGE ALIASES MODAL
export function openSubtypeAliasModal(subtypeId, parentId) {
  const state = getState() || {};
  const parent = (state.ingredients || []).find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) return;
  const sub = parent.subtypes.find(s => String(s.id) === String(subtypeId));
  if (!sub) return;
  const aliases = Array.isArray(sub.aliases) ? sub.aliases : [];

  showModal(`
    <div style="padding: 20px; max-width: 480px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 12px; font-size: 1.15rem; font-weight: 750;">🏷️ Manage Aliases: ${escapeHTML(sub.name)}</h3>
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom: 16px; padding: 10px; background: var(--surface2,#f5f5f4); border-radius:8px; min-height: 50px;">
        ${aliases.map(a => `<span style="font-size: 11px; padding: 4px 10px; border-radius: 999px; background: #fff; border: 1px solid var(--border,#e7e5e4); display: flex; align-items: center; gap: 4px;">${escapeHTML(a)}<span style="cursor:pointer; font-weight:bold; color:var(--red,#ef4444);" onclick="window.handleSubtypeAliasRemove('${escapeHTML(a)}')">&times;</span></span>`).join('') || '<span style="font-size:12px; color:var(--text2); font-style:italic; padding:6px 0;">No aliases defined yet</span>'}
      </div>
      <div style="display:flex; gap:6px; margin-bottom: 20px;">
        <input type="text" id="new-alias-input" placeholder="e.g. Sourdough loaf" style="flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:6px; font-size: 12px;" />
        <button type="button" class="btn primary sm" id="btn-add-alias">Add Alias</button>
      </div>
      <div style="display:flex; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Close</button>
      </div>
    </div>
  `);

  window.handleSubtypeAliasRemove = async (alias) => {
    sub.aliases = aliases.filter(a => a !== alias);
    parent.updatedAt = new Date().toISOString();
    setIngredients([...state.ingredients]);
    openSubtypeAliasModal(subtypeId, parentId);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    await saveIngredient(parent);
  };

  document.getElementById('btn-add-alias').onclick = async () => {
    const val = (document.getElementById('new-alias-input')?.value || '').trim();
    if (!val) return;
    if (!sub.aliases) sub.aliases = [];
    if (!sub.aliases.includes(val)) sub.aliases.push(val);
    parent.updatedAt = new Date().toISOString();
    setIngredients([...state.ingredients]);
    openSubtypeAliasModal(subtypeId, parentId);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    await saveIngredient(parent);
  };
}

// 5. DELETE CONFIRMATION MODAL
export function openSubtypeDeleteModal(subtypeId, parentId) {
  const state = getState() || {};
  const parent = (state.ingredients || []).find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) return;
  const sub = parent.subtypes.find(s => String(s.id) === String(subtypeId));
  if (!sub) return;

  showModal(`
    <div style="padding: 24px; max-width: 440px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">⚠️</div>
      <h3 style="margin-top:0; margin-bottom: 10px; font-size: 1.15rem; font-weight: 750; color: var(--red,#ef4444)">Delete Sub-type?</h3>
      <p style="font-size: 13.5px; color: var(--text2,#78716c); margin: 0 0 24px 0; line-height: 1.5;">
        Are you sure you want to delete <strong>"${escapeHTML(sub.name)}"</strong>? <br /><span style="font-size:12px; color:var(--text2);">Linked products will remain in your Product Bank but will be unlinked.</span>
      </p>
      <div style="display:flex; gap:8px; justify-content: center;">
        <button type="button" class="btn" style="padding: 8px 16px;" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn danger" style="padding: 8px 16px;" id="btn-confirm-sub-delete">Confirm Delete</button>
      </div>
    </div>
  `);

  document.getElementById('btn-confirm-sub-delete').onclick = async () => {
    closeModal();
    parent.subtypes = parent.subtypes.filter(s => String(s.id) !== String(subtypeId));
    parent.updatedAt = new Date().toISOString();
    const prods = [...(state.products || [])], unlinkedProds = [];
    prods.forEach(p => {
      if (String(p.subtypeId) === String(subtypeId)) {
        p.subtypeId = null; p.isAutoDefault = false; p.updatedAt = new Date().toISOString();
        unlinkedProds.push(p);
      }
    });
    setIngredients([...state.ingredients]); setProducts(prods);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    if (typeof window.renderProductBank === 'function') window.renderProductBank();
    await Promise.all([saveIngredient(parent), ...unlinkedProds.map(p => saveProduct(p))]);
  };
}

export function openTescoBookmarkletInstructionsModal() {
  openTescoImportModal(null, null);
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    closeSubtypeActionModal: closeModal,
    openEditSubtypeModal,
    openSubtypeLinkSelectionModal,
    openSubtypeExistingProductPickerModal,
    openTescoImportModal,
    openSubtypeReorganizeModal,
    openSubtypeAliasModal,
    openSubtypeDeleteModal,
    openTescoBookmarkletInstructionsModal,
    promptAddAlias,
    promptRemoveAlias,
    handlePromoteSubtype,
    promptDemote,
    promptMerge,
    handleDeleteIngredient,
    handleDeleteProduct,
    showCustomAlert,
    openIngredientReorganiseModal,
    promptReallocateProduct,
    openProductReallocateModal,
    handleSubtypeLinkRoute(action, subtypeId, parentId) {
      closeModal();
      window.__prefilledResolveBinding = { ingredientId: parentId, subtypeId: subtypeId || null };
      setTimeout(() => {
        if (action === 'manual' && typeof window.openProductEditModal === 'function') window.openProductEditModal(null);
        else if (action === 'link') openSubtypeExistingProductPickerModal(subtypeId, parentId);
        else if (action === 'tesco') openTescoImportModal(subtypeId, parentId);
      }, 150);
    }
  });
}
