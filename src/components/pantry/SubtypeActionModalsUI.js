/**
 * src/components/pantry/SubtypeActionModalsUI.js (v3.19.75)
 * Standardized custom styled dialogs and workflows for nested sub-types.
 * Eliminates all prompt(), alert(), and confirm() browser chrome calls.
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { saveIngredient, saveProduct } from '../../services/HouseholdRepository.js';
import { promptReallocateProduct, openProductReallocateModal } from './ReallocateProductModalUI.js';

export { promptReallocateProduct, openProductReallocateModal };

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
                <span style="font-weight:600;">${escapeHTML(p.name)}</span>
                ${p.brand ? `<span style="color:var(--text2,#78716c); font-size:11px;"> (${escapeHTML(p.brand)})</span>` : ''}
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

// 2. LINK PRODUCT SELECTOR MODAL (Sub-type Row Menu Route)
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
        <!-- Card 1: Link Existing Product -->
        <div onclick="window.handleSubtypeLinkRoute('link', '${subtypeId || ''}', '${parentId}')" style="cursor:pointer; display:flex; align-items:center; gap:12px; padding:12px 16px; border:1px solid var(--border,#e7e5e4); border-radius:10px; background:#fff; transition: background 0.15s;" onmouseover="this.style.background='var(--surface2,#f5f5f4)'" onmouseout="this.style.background='#fff'">
          <div style="font-size: 24px;">🔗</div>
          <div>
            <div style="font-weight: 750; font-size: 13.5px;">1. Link Existing Product(s)</div>
            <div style="font-size: 11.5px; color: var(--text2);">Search and attach a product already in your Product Bank.</div>
          </div>
        </div>

        <!-- Card 2: Add Product Manually -->
        <div onclick="window.handleSubtypeLinkRoute('manual', '${subtypeId || ''}', '${parentId}')" style="cursor:pointer; display:flex; align-items:center; gap:12px; padding:12px 16px; border:1px solid var(--border,#e7e5e4); border-radius:10px; background:#fff; transition: background 0.15s;" onmouseover="this.style.background='var(--surface2,#f5f5f4)'" onmouseout="this.style.background='#fff'">
          <div style="font-size: 24px;">➕</div>
          <div>
            <div style="font-weight: 750; font-size: 13.5px;">2. Add Product Manually</div>
            <div style="font-size: 11.5px; color: var(--text2);">Type nutritional data, price, and pack weights directly.</div>
          </div>
        </div>

        <!-- Card 3: Import from Tesco -->
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

      <div id="picker-product-list" style="display:flex; flex-direction:column; gap:6px; max-height:220px; overflow-y:auto; padding:6px; background:var(--surface2,#f5f5f4); border:1px solid var(--border,#e7e5e4); border-radius:8px; margin-bottom: 18px;">
      </div>

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

  const renderList = (filterText = '') => {
    const query = filterText.toLowerCase().trim();
    const filtered = products.filter(p => {
      if (!query) return true;
      return (p.name || '').toLowerCase().includes(query) || (p.brand || '').toLowerCase().includes(query);
    });

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
            <div style="font-size:12.5px; font-weight:650; color:var(--text,#1c1917); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHTML(p.name)}</div>
            <div style="font-size:11px; color:var(--text2,#78716c);">${escapeHTML(p.brand || 'No brand')} · £${Number(p.price || 0).toFixed(2)}</div>
          </div>
        </label>
      `;
    }).join('');

    listContainer.querySelectorAll('.product-picker-cb').forEach(cb => {
      cb.onchange = () => {
        if (cb.checked) {
          checkedIds.add(cb.value);
        } else {
          checkedIds.delete(cb.value);
        }
        updateBtnState();
      };
    });
  };

  const updateBtnState = () => {
    const count = checkedIds.size;
    countEl.textContent = `${count} selected`;
    if (count >= 1) {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmBtn.style.pointerEvents = 'auto';
    } else {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.5';
      confirmBtn.style.pointerEvents = 'none';
    }
  };

  searchInput.oninput = () => renderList(searchInput.value);
  renderList();
  updateBtnState();

  confirmBtn.onclick = async () => {
    const selectedArray = Array.from(checkedIds);
    if (!selectedArray.length) return;

    closeModal();

    if (subtypeId && parentId) {
      // Existing sub-type mode: link directly
      const updatedProds = products.map(p => {
        if (selectedArray.includes(String(p.id))) {
          return { ...p, ingredientId: parentId, subtypeId: subtypeId, updatedAt: new Date().toISOString() };
        }
        return p;
      });
      setProducts(updatedProds);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      if (typeof window.renderProductBank === 'function') window.renderProductBank();
      await Promise.all(updatedProds.filter(p => selectedArray.includes(String(p.id))).map(p => saveProduct(p)));
    } else {
      // Draft sub-type mode: store linkedProductIds in payload and re-open add subtype modal
      if (!window.__draftSubtypePayload) {
        window.__draftSubtypePayload = { parentId, name: subName, notes: '' };
      }
      window.__draftSubtypePayload.linkedProductIds = selectedArray;

      if (typeof window.openIngredientFamilyDetailsModal === 'function') {
        window.openIngredientFamilyDetailsModal(null, parentId);
        setTimeout(() => {
          const nameInput = document.getElementById('ingredient-family-details-name');
          const notesInput = document.getElementById('ingredient-family-details-notes');
          if (nameInput && window.__draftSubtypePayload.name) nameInput.value = window.__draftSubtypePayload.name;
          if (notesInput && window.__draftSubtypePayload.notes) notesInput.value = window.__draftSubtypePayload.notes;
        }, 50);
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
      
      <!-- Dynamic Search Button directly under Title -->
      <div style="margin-bottom: 16px;">
        <a href="${tescoSearchUrl}" target="_blank" rel="noopener" class="btn sm ghost" style="display:inline-flex; align-items:center; gap:6px; color:var(--primary,#4f46e5); font-weight:600; font-size:12.5px; padding:6px 12px; border:1px solid rgba(79,70,229,0.2); background:rgba(79,70,229,0.05); border-radius:8px; text-decoration:none;">
          🔍 Search Tesco for "${escapeHTML(subName)}" ↗
        </a>
      </div>

      <!-- Bookmarklet Helper -->
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
  const reviewBtn = document.getElementById('btn-review-tesco-import');

  reviewBtn.onclick = () => {
    const raw = (jsonInput ? jsonInput.value : '').trim();
    if (!raw) {
      if (errorMsg) {
        errorMsg.style.display = 'block';
        errorMsg.innerHTML = `<div style="padding:10px; background:#fee2e2; color:#ef4444; border-radius:8px; font-weight:600; font-size:12px;">⚠️ Invalid Tesco JSON string. Please copy directly from the bookmarklet output.</div>`;
      }
      return;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parsed = null;
    }

    if (!parsed || typeof parsed !== 'object') {
      if (errorMsg) {
        errorMsg.style.display = 'block';
        errorMsg.innerHTML = `<div style="padding:10px; background:#fee2e2; color:#ef4444; border-radius:8px; font-weight:600; font-size:12px;">⚠️ Invalid Tesco JSON string. Please copy directly from the bookmarklet output.</div>`;
      }
      return;
    }

    // Auto-fill category from parent ingredient
    if (parsed) {
      parsed.category = parentCategory;
    }

    // Successful parse!
    closeModal();

    window.__prefilledResolveBinding = {
      ingredientId: parentId,
      subtypeId: subtypeId || null,
      subtypeDraftName: window.__draftSubtypePayload?.name || null,
      parentCategory: parentCategory,
      tescoImportData: parsed
    };

    setTimeout(() => {
      if (typeof window.openProductEditModal === 'function') {
        window.openProductEditModal(null);
      }
    }, 150);
  };
}

// 3. CONSOLIDATED REORGANIZE MODAL (Promote, Move, Merge)
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
      <h3 style="margin-top:0; margin-bottom: 16px; font-size: 1.15rem; font-weight: 750;">🔀 Reorganize: ${escapeHTML(sub.name)}</h3>
      
      <!-- Option A: Promote -->
      <div style="padding: 12px; border: 1px solid var(--border,#e7e5e4); border-radius: 8px; margin-bottom: 12px; background: #fafaf9;">
        <div style="font-weight: 750; font-size: 13px; display:flex; align-items:center; justify-content:space-between">
          <span>🚀 Option A: Promote to Standalone Core Ingredient</span>
          <button type="button" class="btn sm" id="btn-reorg-promote">Promote</button>
        </div>
        <p style="margin:4px 0 0 0; font-size:11px; color:var(--text2)">Ejects this sub-type from parent "${escapeHTML(parent.name)}" into a standalone card.</p>
      </div>

      <!-- Option B: Move Parent -->
      <div style="padding: 12px; border: 1px solid var(--border,#e7e5e4); border-radius: 8px; margin-bottom: 12px; background: #fafaf9;">
        <div style="font-weight: 750; font-size: 13px; margin-bottom: 6px;">📦 Option B: Move to another Parent Core Ingredient</div>
        <div style="display:flex; gap:8px;">
          <select id="reorg-move-select" style="flex:1; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:12px;">
            ${targetParents.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${escapeHTML(p.category || 'Other')})</option>`).join('')}
          </select>
          <button type="button" class="btn sm" id="btn-reorg-move">Move</button>
        </div>
      </div>

      <!-- Option C: Merge Sibling -->
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
    if (typeof window.handlePromoteSubtype === 'function') {
      await window.handlePromoteSubtype(subtypeId, parentId);
    }
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

      const prods = [...(state.products || [])].map(p => {
        if (String(p.subtypeId) === String(subtypeId)) {
          return { ...p, subtypeId: target.id, updatedAt: new Date().toISOString() };
        }
        return p;
      });

      setIngredients([...state.ingredients]);
      setProducts(prods);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      if (typeof window.renderProductBank === 'function') window.renderProductBank();
      await Promise.all([
        saveIngredient(parent),
        ...prods.filter(p => String(p.subtypeId) === String(target.id)).map(p => saveProduct(p))
      ]);
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

  const html = `
    <div style="padding: 20px; max-width: 480px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 12px; font-size: 1.15rem; font-weight: 750;">🏷️ Manage Aliases: ${escapeHTML(sub.name)}</h3>
      
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom: 16px; padding: 10px; background: var(--surface2,#f5f5f4); border-radius:8px; min-height: 50px;">
        ${aliases.map(a => `
          <span style="font-size: 11px; padding: 4px 10px; border-radius: 999px; background: #fff; border: 1px solid var(--border,#e7e5e4); display: flex; align-items: center; gap: 4px;">
            ${escapeHTML(a)}
            <span style="cursor:pointer; font-weight:bold; color:var(--red,#ef4444);" onclick="window.handleSubtypeAliasRemove('${escapeHTML(a)}')">&times;</span>
          </span>
        `).join('') || '<span style="font-size:12px; color:var(--text2); font-style:italic; padding:6px 0;">No aliases defined yet</span>'}
      </div>

      <div style="display:flex; gap:6px; margin-bottom: 20px;">
        <input type="text" id="new-alias-input" placeholder="e.g. Sourdough loaf" style="flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:6px; font-size: 12px;" />
        <button type="button" class="btn primary sm" id="btn-add-alias">Add Alias</button>
      </div>

      <div style="display:flex; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Close</button>
      </div>
    </div>
  `;

  showModal(html);

  window.handleSubtypeAliasRemove = async (alias) => {
    sub.aliases = aliases.filter(a => a !== alias);
    parent.updatedAt = new Date().toISOString();
    setIngredients([...state.ingredients]);
    openSubtypeAliasModal(subtypeId, parentId);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    await saveIngredient(parent);
  };

  document.getElementById('btn-add-alias').onclick = async () => {
    const input = document.getElementById('new-alias-input');
    const val = input ? input.value.trim() : '';
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

  const html = `
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
  `;

  showModal(html);

  document.getElementById('btn-confirm-sub-delete').onclick = async () => {
    closeModal();

    parent.subtypes = parent.subtypes.filter(s => String(s.id) !== String(subtypeId));
    parent.updatedAt = new Date().toISOString();

    const prods = [...(state.products || [])];
    const unlinkedProds = [];
    prods.forEach(p => {
      if (String(p.subtypeId) === String(subtypeId)) {
        p.subtypeId = null;
        p.isAutoDefault = false;
        p.updatedAt = new Date().toISOString();
        unlinkedProds.push(p);
      }
    });

    setIngredients([...state.ingredients]);
    setProducts(prods);

    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    if (typeof window.renderProductBank === 'function') window.renderProductBank();

    await Promise.all([
      saveIngredient(parent),
      ...unlinkedProds.map(p => saveProduct(p))
    ]);
  };
}

// 6. INSTRUCTIONS/BOOKMARKLET DIALOG
export function openTescoBookmarkletInstructionsModal() {
  openTescoImportModal(null, null);
}

// 7. UNIVERSAL ZERO POPUP CORES LINK
window.promptAddAlias = (ingId, parentId = null) => {
  if (parentId) {
    openSubtypeAliasModal(ingId, parentId);
    return;
  }
  const state = getState() || {};
  const currentIngs = state.ingredients || [];
  const ing = currentIngs.find(i => String(i.id) === String(ingId));
  if (!ing) return;
  const aliases = Array.isArray(ing.aliases) ? ing.aliases : [];

  const html = `
    <div style="padding: 20px; max-width: 480px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 12px; font-size: 1.15rem; font-weight: 750;">🏷️ Manage Aliases: ${escapeHTML(ing.name)}</h3>
      
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom: 16px; padding: 10px; background: var(--surface2,#f5f5f4); border-radius:8px; min-height: 50px;">
        ${aliases.map(a => `
          <span style="font-size: 11px; padding: 4px 10px; border-radius: 999px; background: #fff; border: 1px solid var(--border,#e7e5e4); display: flex; align-items: center; gap: 4px;">
            ${escapeHTML(a)}
            <span style="cursor:pointer; font-weight:bold; color:var(--red,#ef4444);" onclick="window.handleCoreAliasRemove('${escapeHTML(a)}')">&times;</span>
          </span>
        `).join('') || '<span style="font-size:12px; color:var(--text2); font-style:italic; padding:6px 0;">No aliases defined yet</span>'}
      </div>

      <div style="display:flex; gap:6px; margin-bottom: 20px;">
        <input type="text" id="new-core-alias-input" placeholder="e.g. Sourdough loaf" style="flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:6px; font-size: 12px;" />
        <button type="button" class="btn primary sm" id="btn-add-core-alias">Add Alias</button>
      </div>

      <div style="display:flex; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Close</button>
      </div>
    </div>
  `;
  showModal(html);

  window.handleCoreAliasRemove = async (alias) => {
    ing.aliases = aliases.filter(a => a !== alias);
    ing.updatedAt = new Date().toISOString();
    setIngredients([...state.ingredients]);
    window.promptAddAlias(ingId);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    await saveIngredient(ing);
  };

  document.getElementById('btn-add-core-alias').onclick = async () => {
    const input = document.getElementById('new-core-alias-input');
    const val = input ? input.value.trim() : '';
    if (!val) return;
    if (!ing.aliases) ing.aliases = [];
    if (!ing.aliases.includes(val)) ing.aliases.push(val);
    ing.updatedAt = new Date().toISOString();
    setIngredients([...state.ingredients]);
    window.promptAddAlias(ingId);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    await saveIngredient(ing);
  };
};

window.promptRemoveAlias = (ingId, alias, parentId = null) => {
  if (parentId) {
    const state = getState() || {}, ings = [...(state.ingredients || [])], parent = ings.find(i => String(i.id) === String(parentId));
    if (parent && Array.isArray(parent.subtypes)) {
      const sub = parent.subtypes.find(s => String(s.id) === String(ingId));
      if (sub && Array.isArray(sub.aliases)) {
        sub.aliases = sub.aliases.filter(a => a !== alias);
        parent.updatedAt = new Date().toISOString(); setIngredients(ings);
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        saveIngredient(parent);
      }
    }
    return;
  }
  const state = getState() || {}, currentIngs = state.ingredients || [];
  const ing = currentIngs.find(i => String(i.id) === String(ingId));
  if (ing && Array.isArray(ing.aliases)) {
    ing.aliases = ing.aliases.filter(a => a !== alias);
    ing.updatedAt = new Date().toISOString();
    setIngredients(currentIngs);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    saveIngredient(ing);
  }
};

window.handlePromoteSubtype = async (subId, parentId) => {
  const html = `
    <div style="padding: 24px; max-width: 440px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">🚀</div>
      <h3 style="margin-top:0; margin-bottom: 10px; font-size: 1.15rem; font-weight: 750;">Promote Sub-type?</h3>
      <p style="font-size: 13.5px; color: var(--text2,#78716c); margin: 0 0 24px 0; line-height: 1.5;">
        Are you sure you want to promote this sub-type to a standalone Core Ingredient?
      </p>

      <div style="display:flex; gap:8px; justify-content: center;">
        <button type="button" class="btn" style="padding: 8px 16px;" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn primary" style="padding: 8px 16px;" id="btn-confirm-sub-promote">Confirm Promote</button>
      </div>
    </div>
  `;
  showModal(html);

  document.getElementById('btn-confirm-sub-promote').onclick = async () => {
    closeModal();
    import('../../models/PantryHierarchyModel.js').then(async (model) => {
      await model.promoteToIngredient(subId, parentId);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    });
  };
};

window.promptDemote = (ingId, parentId = null) => {
  if (parentId) {
    openSubtypeReorganizeModal(ingId, parentId);
    return;
  }

  const state = getState() || {};
  const currentIngs = state.ingredients || [];
  const candidates = currentIngs.filter(i => String(i.id) !== String(ingId));

  const html = `
    <div style="padding: 24px; max-width: 480px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 12px; font-size: 1.15rem; font-weight: 750;">⬇️ Move Core Ingredient to Sub-type</h3>
      <p style="font-size: 13px; color: var(--text2); margin-bottom: 16px;">Select which parent ingredient you want to nest this under as a child sub-type.</p>

      <div style="display:flex; gap:8px; margin-bottom: 20px;">
        <select id="demote-parent-select" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:12px;">
          ${candidates.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)} (${escapeHTML(c.category || 'Other')})</option>`).join('')}
        </select>
      </div>

      <div style="display:flex; gap:8px; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn primary" id="btn-confirm-demote">Set as Sub-type</button>
      </div>
    </div>
  `;
  showModal(html);

  document.getElementById('btn-confirm-demote').onclick = async () => {
    const targetParentId = document.getElementById('demote-parent-select').value;
    if (!targetParentId) return;
    closeModal();
    import('../../models/PantryHierarchyModel.js').then(async (model) => {
      await model.demoteToSubtype(ingId, targetParentId);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    });
  };
};

window.promptMerge = (sourceId, parentId = null) => {
  if (parentId) {
    openSubtypeReorganizeModal(sourceId, parentId);
    return;
  }

  const state = getState() || {};
  const currentIngs = state.ingredients || [];
  const candidates = currentIngs.filter(i => String(i.id) !== String(sourceId));

  const html = `
    <div style="padding: 24px; max-width: 480px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 12px; font-size: 1.15rem; font-weight: 750;">🔀 Merge Core Ingredient</h3>
      <p style="font-size: 13px; color: var(--text2); margin-bottom: 16px;">Select another ingredient to merge into. This will combine all aliases, sub-types, and products into the target.</p>

      <div style="display:flex; gap:8px; margin-bottom: 20px;">
        <select id="merge-target-select" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:12px;">
          ${candidates.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)} (${escapeHTML(c.category || 'Other')})</option>`).join('')}
        </select>
      </div>

      <div style="display:flex; gap:8px; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn primary" id="btn-confirm-merge">Merge Ingredients</button>
      </div>
    </div>
  `;
  showModal(html);

  document.getElementById('btn-confirm-merge').onclick = async () => {
    const targetId = document.getElementById('merge-target-select').value;
    if (!targetId) return;
    closeModal();
    import('../../models/PantryHierarchyModel.js').then(async (model) => {
      await model.mergeIngredients(sourceId, targetId);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    });
  };
};

window.handleDeleteIngredient = (ingId, ingName, parentId = null) => {
  if (parentId) {
    openSubtypeDeleteModal(ingId, parentId);
    return;
  }

  const html = `
    <div style="padding: 24px; max-width: 440px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">⚠️</div>
      <h3 style="margin-top:0; margin-bottom: 10px; font-size: 1.15rem; font-weight: 750; color: var(--red,#ef4444)">Delete Ingredient?</h3>
      <p style="font-size: 13.5px; color: var(--text2,#78716c); margin: 0 0 24px 0; line-height: 1.5;">
        Are you sure you want to delete <strong>"${escapeHTML(ingName)}"</strong>? <br />This will remove it from the pantry bank and clear all relationships.
      </p>

      <div style="display:flex; gap:8px; justify-content: center;">
        <button type="button" class="btn" style="padding: 8px 16px;" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn danger" style="padding: 8px 16px;" id="btn-confirm-core-delete">Confirm Delete</button>
      </div>
    </div>
  `;
  showModal(html);

  document.getElementById('btn-confirm-core-delete').onclick = async () => {
    closeModal();
    const state = getState() || {};
    const ings = (state.ingredients || []).filter(i => String(i.id) !== String(ingId));
    setIngredients(ings);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    import('../../services/HouseholdRepository.js').then(async (repo) => {
      await repo.deleteIngredient(ingId);
    });
  };
};

// 8. PRODUCT MANAGEMENT ZERO POPUP DIALOGS
window.handleDeleteProduct = (productId, prodName) => {
  const html = `
    <div style="padding: 24px; max-width: 440px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">🗑️</div>
      <h3 style="margin-top:0; margin-bottom: 10px; font-size: 1.15rem; font-weight: 750; color: var(--red,#ef4444)">Delete Product?</h3>
      <p style="font-size: 13.5px; color: var(--text2,#78716c); margin: 0 0 24px 0; line-height: 1.5;">
        Are you sure you want to delete <strong>"${escapeHTML(prodName)}"</strong> from your bank?
      </p>

      <div style="display:flex; gap:8px; justify-content: center;">
        <button type="button" class="btn" style="padding: 8px 16px;" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn danger" style="padding: 8px 16px;" id="btn-confirm-prod-delete">Confirm Delete</button>
      </div>
    </div>
  `;
  showModal(html);

  document.getElementById('btn-confirm-prod-delete').onclick = async () => {
    closeModal();
    const state = getState() || {};
    const prods = (state.products || []).filter(p => String(p.id) !== String(productId));
    setProducts(prods);
    if (typeof window.renderProductBank === 'function') window.renderProductBank();
    import('../../services/HouseholdRepository.js').then(async (repo) => {
      await repo.deleteProduct(productId);
    });
  };
};

window.promptReallocateProduct = promptReallocateProduct;
window.openProductReallocateModal = openProductReallocateModal;

const _legacyPromptReallocate = (productId) => {
  const state = getState() || {};
  const currentIngs = Array.isArray(state.ingredients) ? state.ingredients : [];
  const prods = Array.isArray(state.products) ? state.products : [];
  const prod = prods.find(p => String(p.id) === String(productId));
  if (!prod) return;

  let selectedIngId = prod.ingredientId || prod.groupId || (currentIngs[0]?.id || null);
  let selectedSubId = prod.subtypeId || null;

  const html = `
    <div style="padding: 24px; max-width: 520px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px;">
      <h3 style="margin-top:0; margin-bottom: 6px; font-size: 1.15rem; font-weight: 750;">📦 Reallocate Product: ${escapeHTML(prod.name)}</h3>
      <p style="font-size: 12.5px; color: var(--text2,#78716c); margin: 0 0 14px 0;">Search and select the target parent ingredient and optional sub-type.</p>

      <!-- Banner for inline duplicate alerts -->
      <div id="realloc-duplicate-banner" style="display:none; padding:10px 12px; background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; border-radius:8px; font-weight:600; font-size:12px; margin-bottom:12px;"></div>

      <!-- 1. Searchable Core Ingredient Filter -->
      <div class="field" style="margin-bottom: 14px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
          <label style="font-weight: 600; font-size: 0.85rem;">1. Target Core Ingredient</label>
          <button type="button" class="btn xs ghost" id="btn-toggle-create-ing" style="color:var(--primary,#4f46e5); font-weight:600; font-size:11.5px;">➕ Create New Ingredient</button>
        </div>

        <!-- Inline Create Ingredient Panel -->
        <div id="realloc-create-ing-panel" style="display:none; padding:10px; background:var(--surface2,#f5f5f4); border:1px solid var(--border,#e7e5e4); border-radius:8px; margin-bottom:8px;">
          <div style="font-weight:700; font-size:12px; margin-bottom:6px;">Create New Core Ingredient</div>
          <div style="display:flex; gap:6px; margin-bottom:6px;">
            <input type="text" id="new-core-ing-name" placeholder="Ingredient name..." style="flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:6px; font-size:12px;" />
            <select id="new-core-ing-cat" style="padding:6px; border:1px solid var(--border); border-radius:6px; font-size:12px;">
              <option value="Produce">Produce</option>
              <option value="Grains">Grains</option>
              <option value="Proteins">Proteins</option>
              <option value="Dairy">Dairy</option>
              <option value="Pantry">Pantry</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div style="display:flex; gap:6px; justify-content:flex-end;">
            <button type="button" class="btn xs ghost" id="btn-cancel-create-ing">Cancel</button>
            <button type="button" class="btn xs primary" id="btn-save-create-ing">Add Ingredient</button>
          </div>
        </div>

        <input type="text" id="realloc-ing-search" class="input" placeholder="🔍 Type core ingredient or category name..." style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12.5px; box-sizing:border-box;" />
        <div id="realloc-ing-results" style="margin-top:6px; max-height:140px; overflow-y:auto; border:1px solid var(--border,#e7e5e4); border-radius:8px; background:var(--surface2,#f5f5f4); padding:4px;">
        </div>
      </div>

      <!-- 2. Searchable Sub-type Filter -->
      <div class="field" style="margin-bottom: 20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
          <label style="font-weight: 600; font-size: 0.85rem;">2. Target Sub-type (Optional)</label>
          <button type="button" class="btn xs ghost" id="btn-toggle-create-sub" style="color:var(--primary,#4f46e5); font-weight:600; font-size:11.5px;">➕ Create New Sub-type</button>
        </div>

        <!-- Inline Create Sub-type Panel -->
        <div id="realloc-create-sub-panel" style="display:none; padding:10px; background:var(--surface2,#f5f5f4); border:1px solid var(--border,#e7e5e4); border-radius:8px; margin-bottom:8px;">
          <div style="font-weight:700; font-size:12px; margin-bottom:6px;">Create Sub-type for Selected Ingredient</div>
          <div style="display:flex; gap:6px; margin-bottom:6px;">
            <input type="text" id="new-sub-name-input" placeholder="Sub-type name (e.g. Sourdough)..." style="flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:6px; font-size:12px;" />
          </div>
          <div style="display:flex; gap:6px; justify-content:flex-end;">
            <button type="button" class="btn xs ghost" id="btn-cancel-create-sub">Cancel</button>
            <button type="button" class="btn xs primary" id="btn-save-create-sub">Add Sub-type</button>
          </div>
        </div>

        <input type="text" id="realloc-sub-search" class="input" placeholder="🔍 Filter sub-types..." style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12.5px; box-sizing:border-box;" />
        <div id="realloc-sub-results" style="margin-top:6px; max-height:120px; overflow-y:auto; border:1px solid var(--border,#e7e5e4); border-radius:8px; background:var(--surface2,#f5f5f4); padding:4px;">
        </div>
      </div>

      <div style="display:flex; gap:8px; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn primary" id="btn-confirm-realloc">Reallocate Product</button>
      </div>
    </div>
  `;
  showModal(html);

  const ingSearch = document.getElementById('realloc-ing-search');
  const ingResults = document.getElementById('realloc-ing-results');
  const subSearch = document.getElementById('realloc-sub-search');
  const subResults = document.getElementById('realloc-sub-results');
  const dupBanner = document.getElementById('realloc-duplicate-banner');

  const showDuplicateWarning = (msg) => {
    if (!dupBanner) return;
    dupBanner.textContent = msg;
    dupBanner.style.display = 'block';
  };

  const hideDuplicateWarning = () => {
    if (!dupBanner) return;
    dupBanner.style.display = 'none';
  };

  const renderSubtypeList = (query = '') => {
    const q = String(query || '').trim().toLowerCase();
    const ing = currentIngs.find(i => String(i.id) === String(selectedIngId));
    const subtypes = (ing && Array.isArray(ing.subtypes)) ? ing.subtypes : [];

    const filtered = subtypes.filter(s => {
      if (!q) return true;
      return (s.name || '').toLowerCase().includes(q);
    });

    const isTopLevelSelected = !selectedSubId;
    let itemsHtml = `
      <div class="realloc-sub-option" data-id="" style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; margin-bottom:2px; border-radius:6px; cursor:pointer; background:${isTopLevelSelected ? 'var(--primary,#4f46e5)' : '#fff'}; color:${isTopLevelSelected ? '#fff' : 'var(--text,#1c1917)'}; border:1px solid ${isTopLevelSelected ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'};">
        <span style="font-size:12.5px; font-weight:650;">None (Top-level ${escapeHTML(ing ? ing.name : 'Ingredient')})</span>
      </div>
    `;

    filtered.forEach(s => {
      const isSelected = String(s.id) === String(selectedSubId);
      itemsHtml += `
        <div class="realloc-sub-option" data-id="${escapeHTML(s.id)}" style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; margin-bottom:2px; border-radius:6px; cursor:pointer; background:${isSelected ? 'var(--primary,#4f46e5)' : '#fff'}; color:${isSelected ? '#fff' : 'var(--text,#1c1917)'}; border:1px solid ${isSelected ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'};">
          <span style="font-size:12.5px; font-weight:650;">${escapeHTML(s.name)}</span>
        </div>
      `;
    });

    subResults.innerHTML = itemsHtml;

    subResults.querySelectorAll('.realloc-sub-option').forEach(el => {
      el.onclick = () => {
        selectedSubId = el.dataset.id || null;
        renderSubtypeList(subSearch.value);
      };
    });
  };

  const renderIngredientList = (query = '') => {
    const q = String(query || '').trim().toLowerCase();
    const filtered = currentIngs.filter(i => {
      if (!q) return true;
      const name = String(i.name || '').toLowerCase();
      const cat = String(i.category || '').toLowerCase();
      return name.includes(q) || cat.includes(q);
    });

    if (!filtered.length) {
      ingResults.innerHTML = `<div style="padding:10px; font-size:12px; color:var(--text3,#a8a29e); text-align:center;">No matching ingredients found.</div>`;
      return;
    }

    ingResults.innerHTML = filtered.map(i => {
      const isSelected = String(i.id) === String(selectedIngId);
      return `
        <div class="realloc-ing-option" data-id="${escapeHTML(i.id)}" style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; margin-bottom:2px; border-radius:6px; cursor:pointer; background:${isSelected ? 'var(--primary,#4f46e5)' : '#fff'}; color:${isSelected ? '#fff' : 'var(--text,#1c1917)'}; border:1px solid ${isSelected ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'};">
          <span style="font-size:12.5px; font-weight:650;">${escapeHTML(i.name)}</span>
          <span style="font-size:11px; opacity:0.85;">${escapeHTML(i.category || 'General')}</span>
        </div>
      `;
    }).join('');

    ingResults.querySelectorAll('.realloc-ing-option').forEach(el => {
      el.onclick = () => {
        selectedIngId = el.dataset.id;
        selectedSubId = null;
        renderIngredientList(ingSearch.value);
        renderSubtypeList(subSearch.value);
      };
    });
  };

  ingSearch.oninput = () => renderIngredientList(ingSearch.value);
  subSearch.oninput = () => renderSubtypeList(subSearch.value);

  // Toggle inline creation panels
  const createIngPanel = document.getElementById('realloc-create-ing-panel');
  const createSubPanel = document.getElementById('realloc-create-sub-panel');

  document.getElementById('btn-toggle-create-ing').onclick = () => {
    hideDuplicateWarning();
    createIngPanel.style.display = createIngPanel.style.display === 'none' ? 'block' : 'none';
  };
  document.getElementById('btn-cancel-create-ing').onclick = () => {
    createIngPanel.style.display = 'none';
  };

  document.getElementById('btn-toggle-create-sub').onclick = () => {
    hideDuplicateWarning();
    createSubPanel.style.display = createSubPanel.style.display === 'none' ? 'block' : 'none';
  };
  document.getElementById('btn-cancel-create-sub').onclick = () => {
    createSubPanel.style.display = 'none';
  };

  // Inline Create Ingredient Action with Duplicate Check
  document.getElementById('btn-save-create-ing').onclick = async () => {
    const nameInput = document.getElementById('new-core-ing-name');
    const catInput = document.getElementById('new-core-ing-cat');
    const newName = (nameInput ? nameInput.value : '').trim();
    const newCat = (catInput ? catInput.value : 'General') || 'General';

    if (!newName) return;

    // Duplicate Check
    const existing = currentIngs.find(i => (i.name || '').trim().toLowerCase() === newName.toLowerCase());
    if (existing) {
      showDuplicateWarning(`⚠️ An ingredient named "${existing.name}" already exists. Select it from the list above.`);
      selectedIngId = existing.id;
      selectedSubId = null;
      renderIngredientList();
      renderSubtypeList();
      createIngPanel.style.display = 'none';
      return;
    }

    hideDuplicateWarning();
    const newIng = {
      id: `ing_${Date.now()}`,
      name: newName,
      category: newCat,
      aliases: [],
      subtypes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    currentIngs.push(newIng);
    setIngredients([...currentIngs]);
    selectedIngId = newIng.id;
    selectedSubId = null;
    createIngPanel.style.display = 'none';
    if (nameInput) nameInput.value = '';

    renderIngredientList();
    renderSubtypeList();
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    await saveIngredient(newIng);
  };

  // Inline Create Sub-type Action with Duplicate Check
  document.getElementById('btn-save-create-sub').onclick = async () => {
    const subNameInput = document.getElementById('new-sub-name-input');
    const newSubName = (subNameInput ? subNameInput.value : '').trim();
    if (!newSubName || !selectedIngId) return;

    const ing = currentIngs.find(i => String(i.id) === String(selectedIngId));
    if (!ing) return;
    if (!Array.isArray(ing.subtypes)) ing.subtypes = [];

    // Duplicate Check
    const existingSub = ing.subtypes.find(s => (s.name || '').trim().toLowerCase() === newSubName.toLowerCase());
    if (existingSub) {
      showDuplicateWarning(`⚠️ A sub-type named "${existingSub.name}" already exists for ${ing.name}. Select it from the list above.`);
      selectedSubId = existingSub.id;
      renderSubtypeList();
      createSubPanel.style.display = 'none';
      return;
    }

    hideDuplicateWarning();
    const newSub = {
      id: `sub_${Date.now()}`,
      name: newSubName,
      aliases: [],
      createdAt: new Date().toISOString()
    };

    ing.subtypes.push(newSub);
    ing.updatedAt = new Date().toISOString();
    setIngredients([...currentIngs]);
    selectedSubId = newSub.id;
    createSubPanel.style.display = 'none';
    if (subNameInput) subNameInput.value = '';

    renderSubtypeList();
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    await saveIngredient(ing);
  };

  // Initial render
  const initialIng = currentIngs.find(i => String(i.id) === String(selectedIngId));
  if (initialIng) {
    ingSearch.placeholder = `Current: ${initialIng.name} (type to search...)`;
  }
  renderIngredientList();
  renderSubtypeList();

  document.getElementById('btn-confirm-realloc').onclick = async () => {
    if (!selectedIngId) return;
    const subtypeId = selectedSubId || null;
    const ing = currentIngs.find(i => String(i.id) === String(selectedIngId));
    if (!ing) return;
    closeModal();

    const prodsList = [...(state.products || [])];
    const targetProd = prodsList.find(p => String(p.id) === String(productId));
    if (targetProd) {
      targetProd.ingredientId = ing.id;
      targetProd.subtypeId = subtypeId;
      targetProd.category = ing.category || 'General';
      targetProd.updatedAt = new Date().toISOString();

      setProducts(prodsList);
      if (typeof window.renderProductBank === 'function') window.renderProductBank();
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      await saveProduct(targetProd);
    }
  };
};

window.openProductReallocateModal = window.promptReallocateProduct;

window.showCustomAlert = (message) => {
  const html = `
    <div style="padding: 24px; max-width: 400px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">⚠️</div>
      <h3 style="margin-top:0; margin-bottom: 10px; font-size: 1.15rem; font-weight: 750;">Notification</h3>
      <p style="font-size: 13.5px; color: var(--text2,#78716c); margin: 0 0 20px 0; line-height: 1.5;">
        ${escapeHTML(message)}
      </p>

      <div style="display:flex; justify-content: center;">
        <button type="button" class="btn primary" style="padding: 8px 24px;" onclick="window.closeSubtypeActionModal()">OK</button>
      </div>
    </div>
  `;
  showModal(html);
};

// Global window linkages
if (typeof window !== 'undefined') {
  window.closeSubtypeActionModal = closeModal;
  window.openEditSubtypeModal = openEditSubtypeModal;
  window.openSubtypeLinkSelectionModal = openSubtypeLinkSelectionModal;
  window.openSubtypeExistingProductPickerModal = openSubtypeExistingProductPickerModal;
  window.openTescoImportModal = openTescoImportModal;
  window.openSubtypeReorganizeModal = openSubtypeReorganizeModal;
  window.openSubtypeAliasModal = openSubtypeAliasModal;
  window.openSubtypeDeleteModal = openSubtypeDeleteModal;
  window.openTescoBookmarkletInstructionsModal = openTescoBookmarkletInstructionsModal;

  window.handleSubtypeLinkRoute = function(action, subtypeId, parentId) {
    closeModal();
    window.__prefilledResolveBinding = {
      ingredientId: parentId,
      subtypeId: subtypeId || null
    };

    setTimeout(() => {
      if (action === 'manual') {
        if (typeof window.openProductEditModal === 'function') {
          window.openProductEditModal(null);
        }
      } else if (action === 'link') {
        openSubtypeExistingProductPickerModal(subtypeId, parentId);
      } else if (action === 'tesco') {
        openTescoImportModal(subtypeId, parentId);
      }
    }, 150);
  };

  window.openIngredientReorganiseModal = function openIngredientReorganiseModal(ingredientId) {
    const state = getState() || {};
    const currentIngs = Array.isArray(state.ingredients) ? state.ingredients : [];
    const ing = currentIngs.find(i => String(i.id) === String(ingredientId));
    if (!ing) return;

    const targetCandidates = currentIngs.filter(i => String(i.id) !== String(ingredientId));

    const html = `
      <div style="padding: 24px; max-width: 500px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px;">
        <h3 style="margin-top:0; margin-bottom: 6px; font-size: 1.15rem; font-weight: 750;">🔀 Reorganise Ingredient: ${escapeHTML(ing.name)}</h3>
        <p style="font-size: 12.5px; color: var(--text2,#78716c); margin: 0 0 18px 0;">Select how you want to restructure or consolidate this ingredient.</p>

        <!-- Option A: Merge into another Ingredient -->
        <div style="padding: 14px; border: 1px solid var(--border,#e7e5e4); border-radius: 10px; margin-bottom: 14px; background: var(--surface2,#fafaf9);">
          <div style="font-weight: 750; font-size: 13px; margin-bottom: 4px; color: var(--text,#1c1917);">🔀 Option A: Merge into another Ingredient</div>
          <p style="margin: 0 0 10px 0; font-size: 11.5px; color: var(--text2,#78716c);">Transfers all sub-types, linked products, and aliases to the target ingredient before removing this source.</p>
          <div style="display:flex; gap:8px;">
            <select id="reorg-core-merge-select" style="flex:1; padding:7px; border:1px solid var(--border,#e7e5e4); border-radius:6px; font-size:12px; background:#fff;" ${targetCandidates.length === 0 ? 'disabled' : ''}>
              ${targetCandidates.map(c => `<option value="${c.id}">${escapeHTML(c.name)} (${escapeHTML(c.category || 'Other')})</option>`).join('') || '<option>No other ingredients available</option>'}
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
              ${targetCandidates.map(c => `<option value="${c.id}">${escapeHTML(c.name)} (${escapeHTML(c.category || 'Other')})</option>`).join('') || '<option>No parent ingredients available</option>'}
            </select>
            <button type="button" class="btn primary sm" id="btn-reorg-core-demote" ${targetCandidates.length === 0 ? 'disabled' : ''}>Convert</button>
          </div>
        </div>

        <div style="display:flex; justify-content: flex-end;">
          <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Cancel</button>
        </div>
      </div>
    `;

    showModal(html);

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
  };
}
