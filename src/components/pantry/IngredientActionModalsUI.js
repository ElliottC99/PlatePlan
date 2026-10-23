/**
 * src/components/pantry/IngredientActionModalsUI.js (v3.38.70)
 * Standardised custom styled dialogues and workflows for Pantry Ingredients & Products.
 * Strictly modular (< 350 lines).
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { saveIngredient } from '../../services/IngredientRepository.js';
import { getUnifiedCategories } from '../../services/HouseholdRepository.js';
import { 
  renderAddAliasTemplate, 
  renderPromoteSubtypeTemplate, 
  renderDemoteTemplate, 
  renderMergeTemplate, 
  renderDeleteIngredientTemplate, 
  renderDeleteProductTemplate, 
  renderCustomAlertTemplate, 
  renderCustomConfirmTemplate,
  renderCopyTextModalTemplate,
  renderReorganiseTemplate 
} from './IngredientActionModalsRenderService.js';

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
  const state = getState();
  const currentIngs = state.ingredients || [];
  const ing = currentIngs.find(i => String(i.id) === String(ingId));
  if (!ing) return;
  const aliases = Array.isArray(ing.aliases) ? ing.aliases : [];

  const html = renderAddAliasTemplate(ing, aliases);
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
    const state = getState(), ings = [...(state.ingredients || [])], parent = ings.find(i => String(i.id) === String(parentId));
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
  const state = getState(), currentIngs = state.ingredients || [];
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
  const html = renderPromoteSubtypeTemplate();
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

  const state = getState();
  const currentIngs = state.ingredients || [];
  const candidates = currentIngs.filter(i => String(i.id) !== String(ingId));

  const html = renderDemoteTemplate(candidates);
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

  const state = getState();
  const currentIngs = state.ingredients || [];
  const candidates = currentIngs.filter(i => String(i.id) !== String(sourceId));

  const html = renderMergeTemplate(candidates);
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

export function handleDeleteIngredient(ingId, ingName = null, parentId = null) {
  if (parentId && typeof window.openSubtypeDeleteModal === 'function') {
    window.openSubtypeDeleteModal(ingId, parentId);
    return;
  }
  const state = getState();
  let targetName = ingName;
  if (!targetName) {
    const found = (state.ingredients || []).find(i => String(i.id) === String(ingId));
    targetName = found?.name || 'Ingredient';
  }

  const html = renderDeleteIngredientTemplate(targetName);
  showModal(html);

  document.getElementById('btn-confirm-ing-delete').onclick = async () => {
    closeModal();
    const curState = getState();
    const ings = (curState.ingredients || []).filter(i => String(i.id) !== String(ingId));
    setIngredients(ings);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    import('../../services/IngredientRepository.js').then(async (repo) => {
      await repo.deleteIngredient(ingId);
    });
  };
}

export function handleDeleteProduct(productId, prodName = null) {
  const state = getState();
  let targetName = prodName;
  if (!targetName) {
    const found = (state.products || []).find(p => String(p.id) === String(productId));
    targetName = found?.name || 'Product';
  }

  const html = renderDeleteProductTemplate(targetName);
  showModal(html);

  document.getElementById('btn-confirm-prod-delete').onclick = async () => {
    closeModal();
    const curState = getState();
    const prods = (curState.products || []).filter(p => String(p.id) !== String(productId));
    setProducts(prods);
    if (typeof window.renderProductBank === 'function') window.renderProductBank();
    import('../../services/ProductRepository.js').then(async (repo) => {
      await repo.deleteProduct(productId);
    });
  };
}

export function showCustomAlert(message) {
  showModal(renderCustomAlertTemplate(message));
}

export function showCustomConfirm(message, title, onConfirm) {
  showModal(renderCustomConfirmTemplate(message, title));
  const btn = document.getElementById('btn-confirm-custom');
  if (btn) {
    btn.onclick = () => {
      closeModal();
      if (typeof onConfirm === 'function') onConfirm();
    };
  }
}

export function showCustomCopyModal(title, text) {
  showModal(renderCopyTextModalTemplate(title, text));
  const btn = document.getElementById('btn-copy-modal-text');
  if (btn) {
    btn.onclick = () => {
      const textarea = document.getElementById('copy-modal-textarea');
      if (textarea) {
        textarea.select();
        document.execCommand('copy');
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Copied to clipboard! 📋', 'success');
        }
      }
    };
  }
}

function bindDropdown(inputId, targetCandidates) {
  const input = document.getElementById(inputId);
  if (!input) return;

  let drop = input.parentElement.querySelector('.reorg-custom-dropdown');
  if (!drop) {
    input.parentElement.style.position = 'relative';
    drop = document.createElement('div');
    drop.className = 'reorg-custom-dropdown';
    drop.style.cssText = 'position:absolute; top:100%; left:0; right:0; z-index:9999; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); max-height:220px; overflow-y:auto; margin-top:4px; display:none;';
    input.parentElement.appendChild(drop);
  }

  const renderOptions = () => {
    const q = (input.value || '').trim();
    const filtered = targetCandidates.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()));
    if (!filtered.length && !q) {
      drop.style.display = 'none';
      return;
    }

    const optionsHtml = filtered.map(c => 
      `<div class="custom-dd-item" data-id="${c.id}" data-name="${escapeHTML(c.name)}" style="padding:10px 14px; cursor:pointer; display:flex; align-items:center; gap:8px; border-bottom:1px solid #f1f5f9; transition: background 0.1s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
         <div style="font-size:16px; color:#94a3b8; line-height:1;">📁</div>
         <div style="display:flex; flex-direction:column; gap:2px;">
           <span style="font-weight:600; color:#1e293b; font-size:13px">${escapeHTML(c.name)}</span>
           <span style="font-size:11px; color:#64748b; font-weight:500;">[${escapeHTML(c.category || 'Other')}]</span>
         </div>
       </div>`
    ).join('');
    
    // Prepend the "New Item" aesthetic block at the top if no exact match exists
    const exactMatch = filtered.some(c => c.name.toLowerCase() === q.toLowerCase());
    const newItemHtml = (exactMatch || !q) ? '' : 
      `<div class="custom-dd-item new-item-trigger" data-id="NEW" data-name="${escapeHTML(q)}" style="padding:10px 14px; cursor:pointer; display:flex; align-items:center; gap:8px; border-bottom:1px solid #e2e8f0; background:#f0fdf4; transition: background 0.1s ease;" onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">
         <div style="font-size:14px; line-height:1;">✨</div>
         <span style="font-weight:700; color:#15803d; font-size:13px">New Item: "${escapeHTML(q)}"</span>
       </div>`;

    drop.innerHTML = newItemHtml + optionsHtml;
    drop.style.display = 'block';

    drop.querySelectorAll('.custom-dd-item').forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        input.value = item.dataset.name || '';
        drop.style.display = 'none';
      };
    });
  };

  input.addEventListener('input', renderOptions);
  input.addEventListener('focus', renderOptions);

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !drop.contains(e.target)) {
      drop.style.display = 'none';
    }
  });
}

export async function executePromoteItemToCategory(ingredientId) {
  const op = await import('./IngredientReorganiseOperations.js');
  return await op.executePromoteItemToCategory(ingredientId);
}

export async function executeMoveItemCategory(ingredientId, newCategory) {
  const op = await import('./IngredientReorganiseOperations.js');
  return await op.executeMoveItemCategory(ingredientId, newCategory);
}

export async function executeMergeItem(sourceId, targetId) {
  const op = await import('./IngredientReorganiseOperations.js');
  return await op.executeMergeItem(sourceId, targetId);
}

export async function executeDemoteItemToSubtype(sourceId, parentId) {
  const op = await import('./IngredientReorganiseOperations.js');
  return await op.executeDemoteItemToSubtype(sourceId, parentId);
}

export function openIngredientReorganiseModal(ingredientId) {
  const state = getState();
  const currentIngs = Array.isArray(state.ingredients) ? state.ingredients : [];
  const ing = currentIngs.find(i => String(i.id) === String(ingredientId));
  if (!ing) return;

  const targetCandidates = currentIngs.filter(i => String(i.id) !== String(ingredientId));
  const categories = getUnifiedCategories(state);

  const html = renderReorganiseTemplate(ing, targetCandidates, categories);
  showModal(html);

  const promoteBtn = document.getElementById('btn-reorg-promote');
  if (promoteBtn) {
    promoteBtn.onclick = async () => {
      closeModal();
      await executePromoteItemToCategory(ingredientId);
    };
  }

  const moveBtn = document.getElementById('btn-reorg-move');
  if (moveBtn) {
    moveBtn.onclick = async () => {
      const input = document.getElementById('reorg-move-cat-input');
      const val = input ? input.value.trim() : '';
      if (!val) { alert('Please select or enter a target category.'); return; }
      closeModal();
      await executeMoveItemCategory(ingredientId, val);
    };
  }

  const mergeBtn = document.getElementById('btn-reorg-merge');
  if (mergeBtn) {
    mergeBtn.onclick = async () => {
      const input = document.getElementById('reorg-merge-item-input');
      const val = input ? input.value.trim() : '';
      const target = targetCandidates.find(t => String(t.name).trim().toLowerCase() === val.toLowerCase());
      if (!target) { alert('Please select a valid target item from the list.'); return; }
      closeModal();
      await executeMergeItem(ingredientId, target.id);
    };
  }

  const demoteBtn = document.getElementById('btn-reorg-demote');
  if (demoteBtn) {
    demoteBtn.onclick = async () => {
      const input = document.getElementById('reorg-demote-item-input');
      const val = input ? input.value.trim() : '';
      const target = targetCandidates.find(t => String(t.name).trim().toLowerCase() === val.toLowerCase());
      if (!target) { alert('Please select a valid parent item from the list.'); return; }
      closeModal();
      await executeDemoteItemToSubtype(ingredientId, target.id);
    };
  }
}
