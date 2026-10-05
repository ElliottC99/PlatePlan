/**
 * src/components/pantry/IngredientActionModalsUI.js (v3.20.01)
 * Standardised custom styled dialogues and workflows for Pantry Ingredients & Products.
 * Strictly modular (< 400 lines), British English, and free of legacy terminology.
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { saveIngredient } from '../../services/HouseholdRepository.js';

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

export function promptAddAlias(ingId, parentId = null) {
  if (parentId && typeof window.openSubtypeAliasModal === 'function') {
    window.openSubtypeAliasModal(ingId, parentId);
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
            <span style="cursor:pointer; font-weight:bold; color:var(--red,#ef4444);" onclick="window.handleIngredientAliasRemove('${escapeHTML(a)}')">&times;</span>
          </span>
        `).join('') || '<span style="font-size:12px; color:var(--text2); font-style:italic; padding:6px 0;">No aliases defined yet</span>'}
      </div>

      <div style="display:flex; gap:6px; margin-bottom: 20px;">
        <input type="text" id="new-ing-alias-input" placeholder="e.g. Sourdough loaf" style="flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:6px; font-size: 12px;" />
        <button type="button" class="btn primary sm" id="btn-add-ing-alias">Add Alias</button>
      </div>

      <div style="display:flex; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Close</button>
      </div>
    </div>
  `;
  showModal(html);

  window.handleIngredientAliasRemove = async (alias) => {
    ing.aliases = aliases.filter(a => a !== alias);
    ing.updatedAt = new Date().toISOString();
    setIngredients([...state.ingredients]);
    promptAddAlias(ingId);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    await saveIngredient(ing);
  };

  document.getElementById('btn-add-ing-alias').onclick = async () => {
    const input = document.getElementById('new-ing-alias-input');
    const val = input ? input.value.trim() : '';
    if (!val) return;
    if (!ing.aliases) ing.aliases = [];
    if (!ing.aliases.includes(val)) ing.aliases.push(val);
    ing.updatedAt = new Date().toISOString();
    setIngredients([...state.ingredients]);
    promptAddAlias(ingId);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    await saveIngredient(ing);
  };
}

export function promptRemoveAlias(ingId, alias, parentId = null) {
  if (parentId) {
    const state = getState() || {}, ings = [...(state.ingredients || [])], parent = ings.find(i => String(i.id) === String(parentId));
    if (parent && Array.isArray(parent.subtypes)) {
      const sub = parent.subtypes.find(s => String(s.id) === String(ingId));
      if (sub && Array.isArray(sub.aliases)) {
        sub.aliases = sub.aliases.filter(a => a !== alias);
        parent.updatedAt = new Date().toISOString();
        setIngredients(ings);
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
}

export async function handlePromoteSubtype(subId, parentId) {
  const html = `
    <div style="padding: 24px; max-width: 440px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">🚀</div>
      <h3 style="margin-top:0; margin-bottom: 10px; font-size: 1.15rem; font-weight: 750;">Promote Sub-type?</h3>
      <p style="font-size: 13.5px; color: var(--text2,#78716c); margin: 0 0 24px 0; line-height: 1.5;">
        Are you sure you want to promote this sub-type to a standalone Ingredient?
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
}

export function promptDemote(ingId, parentId = null) {
  if (parentId && typeof window.openSubtypeReorganizeModal === 'function') {
    window.openSubtypeReorganizeModal(ingId, parentId);
    return;
  }

  const state = getState() || {};
  const currentIngs = state.ingredients || [];
  const candidates = currentIngs.filter(i => String(i.id) !== String(ingId));

  const html = `
    <div style="padding: 24px; max-width: 480px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 12px; font-size: 1.15rem; font-weight: 750;">⬇️ Move Ingredient to Sub-type</h3>
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
}

export function promptMerge(sourceId, parentId = null) {
  if (parentId && typeof window.openSubtypeReorganizeModal === 'function') {
    window.openSubtypeReorganizeModal(sourceId, parentId);
    return;
  }

  const state = getState() || {};
  const currentIngs = state.ingredients || [];
  const candidates = currentIngs.filter(i => String(i.id) !== String(sourceId));

  const html = `
    <div style="padding: 24px; max-width: 480px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 12px; font-size: 1.15rem; font-weight: 750;">🔀 Merge Ingredient</h3>
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
}

export function handleDeleteIngredient(ingId, ingName, parentId = null) {
  if (parentId && typeof window.openSubtypeDeleteModal === 'function') {
    window.openSubtypeDeleteModal(ingId, parentId);
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
        <button type="button" class="btn danger" style="padding: 8px 16px;" id="btn-confirm-ing-delete">Confirm Delete</button>
      </div>
    </div>
  `;
  showModal(html);

  document.getElementById('btn-confirm-ing-delete').onclick = async () => {
    closeModal();
    const state = getState() || {};
    const ings = (state.ingredients || []).filter(i => String(i.id) !== String(ingId));
    setIngredients(ings);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    import('../../services/HouseholdRepository.js').then(async (repo) => {
      await repo.deleteIngredient(ingId);
    });
  };
}

export function handleDeleteProduct(productId, prodName) {
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
}

export function showCustomAlert(message) {
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
}

export function openIngredientReorganiseModal(ingredientId) {
  const state = getState() || {};
  const currentIngs = Array.isArray(state.ingredients) ? state.ingredients : [];
  const ing = currentIngs.find(i => String(i.id) === String(ingredientId));
  if (!ing) return;

  const targetCandidates = currentIngs.filter(i => String(i.id) !== String(ingredientId));

  const html = `
    <div style="padding: 24px; max-width: 500px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px;">
      <h3 style="margin-top:0; margin-bottom: 6px; font-size: 1.15rem; font-weight: 750;">🔀 Reorganise Ingredient: ${escapeHTML(ing.name)}</h3>
      <p style="font-size: 12.5px; color: var(--text2,#78716c); margin: 0 0 18px 0;">Select how you want to restructure or consolidate this ingredient.</p>

      <div style="padding: 14px; border: 1px solid var(--border,#e7e5e4); border-radius: 10px; margin-bottom: 14px; background: var(--surface2,#fafaf9);">
        <div style="font-weight: 750; font-size: 13px; margin-bottom: 4px; color: var(--text,#1c1917);">🔀 Option A: Merge into another Ingredient</div>
        <p style="margin: 0 0 10px 0; font-size: 11.5px; color: var(--text2,#78716c);">Transfers all sub-types, linked products, and aliases to the target ingredient before removing this source.</p>
        <div style="display:flex; gap:8px;">
          <select id="reorg-ing-merge-select" style="flex:1; padding:7px; border:1px solid var(--border,#e7e5e4); border-radius:6px; font-size:12px; background:#fff;" ${targetCandidates.length === 0 ? 'disabled' : ''}>
            ${targetCandidates.map(c => `<option value="${c.id}">${escapeHTML(c.name)} (${escapeHTML(c.category || 'Other')})</option>`).join('') || '<option>No other ingredients available</option>'}
          </select>
          <button type="button" class="btn primary sm" id="btn-reorg-ing-merge" ${targetCandidates.length === 0 ? 'disabled' : ''}>Merge</button>
        </div>
      </div>

      <div style="padding: 14px; border: 1px solid var(--border,#e7e5e4); border-radius: 10px; margin-bottom: 20px; background: var(--surface2,#fafaf9);">
        <div style="font-weight: 750; font-size: 13px; margin-bottom: 4px; color: var(--text,#1c1917);">⬇️ Option B: Convert to Sub-type of...</div>
        <p style="margin: 0 0 10px 0; font-size: 11.5px; color: var(--text2,#78716c);">Nests this ingredient as a child sub-type under the chosen parent, preserving all linked products.</p>
        <div style="display:flex; gap:8px;">
          <select id="reorg-ing-demote-select" style="flex:1; padding:7px; border:1px solid var(--border,#e7e5e4); border-radius:6px; font-size:12px; background:#fff;" ${targetCandidates.length === 0 ? 'disabled' : ''}>
            ${targetCandidates.map(c => `<option value="${c.id}">${escapeHTML(c.name)} (${escapeHTML(c.category || 'Other')})</option>`).join('') || '<option>No parent ingredients available</option>'}
          </select>
          <button type="button" class="btn primary sm" id="btn-reorg-ing-demote" ${targetCandidates.length === 0 ? 'disabled' : ''}>Convert</button>
        </div>
      </div>

      <div style="display:flex; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Cancel</button>
      </div>
    </div>
  `;

  showModal(html);

  document.getElementById('btn-reorg-ing-merge').onclick = async () => {
    const targetId = document.getElementById('reorg-ing-merge-select').value;
    if (!targetId) return;
    closeModal();
    import('../../models/PantryHierarchyModel.js').then(async (model) => {
      await model.mergeIngredients(ingredientId, targetId);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      if (typeof window.renderProductBank === 'function') window.renderProductBank();
    });
  };

  document.getElementById('btn-reorg-ing-demote').onclick = async () => {
    const targetParentId = document.getElementById('reorg-ing-demote-select').value;
    if (!targetParentId) return;
    closeModal();
    import('../../models/PantryHierarchyModel.js').then(async (model) => {
      await model.demoteToSubtype(ingredientId, targetParentId);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      if (typeof window.renderProductBank === 'function') window.renderProductBank();
    });
  };
}
