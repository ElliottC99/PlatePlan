/**
 * src/components/pantry/SubtypeActionModalsUI.js (v3.19.38)
 * Standardized custom styled dialogs and workflows for nested sub-types.
 * Eliminates all prompt(), alert(), and confirm() browser chrome calls.
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { saveIngredient, saveProduct } from '../../services/HouseholdRepository.js';

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
        <div style="display:flex; flex-direction:column; gap:6px; max-height:120px; overflow-y:auto; background:var(--surface2,#f5f5f4); padding:8px; border-radius:8px;">
          ${linkedProds.map(p => `
            <div style="font-size:12px; display:flex; justify-content:space-between; align-items:center; background:#fff; padding:6px 10px; border-radius:6px; border:1px solid var(--border,#e7e5e4)">
              <span>${escapeHTML(p.name)}</span>
              ${p.isAutoDefault ? '<span style="color:var(--green); font-weight:700; font-size:10px;">⭐ Default</span>' : ''}
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
        <!-- Card 1: Link Existing Product -->
        <div onclick="window.handleSubtypeLinkRoute('link', '${subtypeId}', '${parentId}')" style="cursor:pointer; display:flex; align-items:center; gap:12px; padding:12px 16px; border:1px solid var(--border,#e7e5e4); border-radius:10px; background:#fff; transition: background 0.15s;" onmouseover="this.style.background='var(--surface2,#f5f5f4)'" onmouseout="this.style.background='#fff'">
          <div style="font-size: 24px;">🔗</div>
          <div>
            <div style="font-weight: 750; font-size: 13.5px;">1. Link Existing Product(s)</div>
            <div style="font-size: 11.5px; color: var(--text2);">Search and attach a product already in your Product Bank.</div>
          </div>
        </div>

        <!-- Card 2: Add Product Manually -->
        <div onclick="window.handleSubtypeLinkRoute('manual', '${subtypeId}', '${parentId}')" style="cursor:pointer; display:flex; align-items:center; gap:12px; padding:12px 16px; border:1px solid var(--border,#e7e5e4); border-radius:10px; background:#fff; transition: background 0.15s;" onmouseover="this.style.background='var(--surface2,#f5f5f4)'" onmouseout="this.style.background='#fff'">
          <div style="font-size: 24px;">➕</div>
          <div>
            <div style="font-weight: 750; font-size: 13.5px;">2. Add Product Manually</div>
            <div style="font-size: 11.5px; color: var(--text2);">Type nutritional data, price, and pack weights directly.</div>
          </div>
        </div>

        <!-- Card 3: Import from Tesco -->
        <div onclick="window.handleSubtypeLinkRoute('tesco', '${subtypeId}', '${parentId}')" style="cursor:pointer; display:flex; align-items:center; gap:12px; padding:12px 16px; border:1px solid var(--border,#e7e5e4); border-radius:10px; background:#fff; transition: background 0.15s;" onmouseover="this.style.background='var(--surface2,#f5f5f4)'" onmouseout="this.style.background='#fff'">
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
        <div style="font-weight: 750; font-size: 13px; margin-bottom: 6px;">📦 Option B: Move to another Parent Ingredient</div>
        <div style="display:flex; gap:8px;">
          <select id="reorg-move-select" style="flex:1; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:12px;">
            ${targetParents.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${escapeHTML(p.category || 'Other')})</option>`).join('')}
          </select>
          <button type="button" class="btn sm" id="btn-reorg-move">Move</button>
        </div>
      </div>

      <!-- Option C: Merge Sibling -->
      <div style="padding: 12px; border: 1px solid var(--border,#e7e5e4); border-radius: 8px; margin-bottom: 20px; background: #fafaf9;">
        <div style="font-weight: 750; font-size: 13px; margin-bottom: 6px;">🔀 Option C: Merge with another Sub-type sibling</div>
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

  // Bind option clicks
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
      const prods = [...(state.products || [])].map(p => (String(p.subtypeId) === String(subtypeId)) ? { ...p, subtypeId: target.id, updatedAt: new Date().toISOString() } : p);
      setIngredients(currentIngs); setProducts(prods);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
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
    openSubtypeAliasModal(subtypeId, parentId); // Re-render
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
    openSubtypeAliasModal(subtypeId, parentId); // Re-render
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
        Are you sure you want to delete <strong>"${escapeHTML(sub.name)}"</strong>? <br />This action cannot be undone and will detach any associated product templates.
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
    setIngredients([...state.ingredients]);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    await saveIngredient(parent);
  };
}

// 6. INSTRUCTIONS/BOOKMARKLET DIALOG
export function openTescoBookmarkletInstructionsModal() {
  const html = `
    <div style="padding: 24px; max-width: 500px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 12px; font-size: 1.15rem; font-weight: 750;">🛒 Tesco Bookmarklet Import</h3>
      <p style="font-size: 13px; color: var(--text2); line-height: 1.5; margin: 0 0 16px 0;">
        To easily import and sync products directly from the Tesco Groceries website:
      </p>
      
      <ol style="font-size: 12.5px; color: var(--text); padding-left: 20px; margin-bottom: 20px; line-height: 1.6;">
        <li>Drag the <strong>Tesco to PlatePlan</strong> bookmarklet from the Settings area to your browser bookmarks bar.</li>
        <li>Visit <a href="https://www.tesco.com/groceries" target="_blank" style="color:var(--primary); font-weight:600">Tesco Groceries ↗</a> and find your desired item.</li>
        <li>Click the bookmarklet in your bar. It will instantly forward and attach the product to this sub-type!</li>
      </ol>

      <div style="display:flex; justify-content: flex-end;">
        <button type="button" class="btn primary" onclick="window.closeSubtypeActionModal()">Got it</button>
      </div>
    </div>
  `;

  showModal(html);
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
    await promoteToIngredient(subId, parentId);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
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

// Global window linkages
if (typeof window !== 'undefined') {
  window.closeSubtypeActionModal = closeModal;
  window.openEditSubtypeModal = openEditSubtypeModal;
  window.openSubtypeLinkSelectionModal = openSubtypeLinkSelectionModal;
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
        if (typeof window.linkProductToSubtype === 'function') {
          window.linkProductToSubtype(parentId, subtypeId);
        }
      } else if (action === 'tesco') {
        openTescoBookmarkletInstructionsModal();
      }
    }, 150);
  };
}
