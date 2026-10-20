/**
 * src/components/pantry/IngredientActionModalsUI.js (v3.38.70)
 * Standardised custom styled dialogues and workflows for Pantry Ingredients & Products.
 * Strictly modular (< 350 lines).
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { saveIngredient } from '../../services/IngredientRepository.js';
import { 
  renderAddAliasTemplate, 
  renderPromoteSubtypeTemplate, 
  renderDemoteTemplate, 
  renderMergeTemplate, 
  renderDeleteIngredientTemplate, 
  renderDeleteProductTemplate, 
  renderCustomAlertTemplate, 
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
  const state = getState() || {};
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

  const state = getState() || {};
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

  const state = getState() || {};
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
  const state = getState() || {};
  let targetName = ingName;
  if (!targetName) {
    const found = (state.ingredients || []).find(i => String(i.id) === String(ingId));
    targetName = found?.name || 'Ingredient';
  }

  const html = renderDeleteIngredientTemplate(targetName);
  showModal(html);

  document.getElementById('btn-confirm-ing-delete').onclick = async () => {
    closeModal();
    const curState = getState() || {};
    const ings = (curState.ingredients || []).filter(i => String(i.id) !== String(ingId));
    setIngredients(ings);
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    import('../../services/IngredientRepository.js').then(async (repo) => {
      await repo.deleteIngredient(ingId);
    });
  };
}

export function handleDeleteProduct(productId, prodName = null) {
  const state = getState() || {};
  let targetName = prodName;
  if (!targetName) {
    const found = (state.products || []).find(p => String(p.id) === String(productId));
    targetName = found?.name || 'Product';
  }

  const html = renderDeleteProductTemplate(targetName);
  showModal(html);

  document.getElementById('btn-confirm-prod-delete').onclick = async () => {
    closeModal();
    const curState = getState() || {};
    const prods = (curState.products || []).filter(p => String(p.id) !== String(productId));
    setProducts(prods);
    if (typeof window.renderProductBank === 'function') window.renderProductBank();
    import('../../services/ProductRepository.js').then(async (repo) => {
      await repo.deleteProduct(productId);
    });
  };
}

export function showCustomAlert(message) {
  const html = renderCustomAlertTemplate(message);
  showModal(html);
}

export function openIngredientReorganiseModal(ingredientId) {
  const state = getState() || {};
  const currentIngs = Array.isArray(state.ingredients) ? state.ingredients : [];
  const ing = currentIngs.find(i => String(i.id) === String(ingredientId));
  if (!ing) return;

  const targetCandidates = currentIngs.filter(i => String(i.id) !== String(ingredientId));

  const html = renderReorganiseTemplate(ing, targetCandidates);

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
