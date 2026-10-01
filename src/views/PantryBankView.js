/**
 * src/views/PantryBankView.js (v3.19.21)
 * Modular ES6 View for Category ➔ Ingredient ➔ Sub-type Hierarchy Bank.
 * Features Aliasing, Merging, Sub-type creation, Promoting/demoting, and Auto-default product previews.
 * Fully responsive and optimized to remain under 350 lines.
 */

import { getState, setIngredients, subscribe } from '../store/store.js';
import { saveIngredient, deleteIngredient } from '../services/HouseholdRepository.js';
import { 
  buildPantryHierarchy, aliasIngredient, removeAlias, addSubtypeToIngredient, 
  promoteToIngredient, demoteToSubtype, reparentSubtype, mergeIngredients, setAutoDefaultProduct, getActiveCategories
} from '../models/PantryHierarchyModel.js';
import { renderProductBank, openProductEditModal } from './ProductBankView.js';
import { renderCategoryManagerModal } from '../components/pantry/CategoryManagerModalUI.js';

let activeEditingIngredientId = null;

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

export function closeIngredientFamilyDetailsModal() {
  const modalWrap = document.getElementById('ingredient-family-details-wrap');
  if (modalWrap) modalWrap.classList.remove('open');
  document.body.style.overflow = '';
  activeEditingIngredientId = null;
}

export function openIngredientFamilyDetailsModal(ingredientId = null) {
  const modalWrap = document.getElementById('ingredient-family-details-wrap');
  if (!modalWrap) return;

  document.body.style.overflow = 'hidden';
  activeEditingIngredientId = ingredientId;
  const state = getState() || {}, ingredients = state.ingredients || [], products = state.products || [];
  const ing = ingredientId ? ingredients.find(i => String(i.id) === String(ingredientId)) : null;

  const titleEl = document.getElementById('ingredient-family-details-title');
  const nameEl = document.getElementById('ingredient-family-details-name');
  const catEl = document.getElementById('ingredient-family-details-cat');
  const notesEl = document.getElementById('ingredient-family-details-notes');
  const msgEl = document.getElementById('ingredient-family-details-msg');

  if (titleEl) titleEl.textContent = ing ? `Edit ingredient: ${ing.name}` : 'New Ingredient';
  if (nameEl) nameEl.value = ing?.name || '';
  if (notesEl) notesEl.value = ing?.notes || '';

  if (catEl) {
    catEl.innerHTML = getActiveCategories(state).map(c => `<option value="${escapeAttr(c.toLowerCase())}" ${ing?.category?.toLowerCase() === c.toLowerCase() ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
  }

  if (msgEl && ing) {
    const linked = products.filter(p => String(p.ingredientId) === String(ing.id) || String(p.groupId) === String(ing.id));
    msgEl.innerHTML = `
      <div style="margin-top:14px;padding:10px;background:var(--surface2,#f5f5f4);border-radius:8px;border:1px solid var(--border,#e7e5e4)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:12px;font-weight:750">Linked Products (${linked.length})</span>
          <button type="button" class="btn sm ghost" onclick="openProductEditModal(null)" style="font-size:11px">+ Add Product</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto">
          ${linked.map(p => `
            <div style="padding:6px 8px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:6px;display:flex;align-items:center;justify-content:space-between">
              <div>
                <span style="font-size:12px;font-weight:600">${escapeHtml(p.name)}</span>
                <div style="font-size:11px;color:var(--text2,#78716c)">${escapeHtml(p.brand || '')} · £${Number(p.price || 0).toFixed(2)}</div>
              </div>
              <div style="display:flex;gap:4px">
                ${p.isAutoDefault ? '<span class="tag" style="font-size:10px;background:rgba(16,185,129,0.15);color:var(--green);font-weight:700">Default</span>' : `<button type="button" class="btn xs ghost" onclick="handleSetDefaultProduct('${escapeAttr(p.id)}', '${escapeAttr(ing.id)}')">Default</button>`}
                <button type="button" class="btn xs ghost" onclick="openProductEditModal('${escapeAttr(p.id)}')">Edit</button>
              </div>
            </div>
          `).join('') || '<div style="font-size:12px;color:var(--text2)">No linked products.</div>'}
        </div>
      </div>
    `;
  } else if (msgEl) {
    msgEl.innerHTML = '';
  }
  modalWrap.classList.add('open');
}

export async function saveIngredientFamilyDetailsModal() {
  const name = (document.getElementById('ingredient-family-details-name')?.value || '').trim();
  if (!name) return;
  const category = document.getElementById('ingredient-family-details-cat')?.value || 'other';
  const notes = (document.getElementById('ingredient-family-details-notes')?.value || '').trim();

  const state = getState() || {}, currentIngs = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  const updatedIng = {
    ...(activeEditingIngredientId ? currentIngs.find(i => String(i.id) === String(activeEditingIngredientId)) : {}),
    id: activeEditingIngredientId || `ing_${Date.now()}`, name, category, notes, updatedAt: new Date().toISOString()
  };

  const existingIdx = currentIngs.findIndex(i => String(i.id) === String(updatedIng.id));
  if (existingIdx >= 0) currentIngs[existingIdx] = updatedIng; else currentIngs.push(updatedIng);

  setIngredients(currentIngs);
  closeIngredientFamilyDetailsModal();
  renderIngredientBank();

  try { await saveIngredient(updatedIng); } catch (e) { console.warn('[PantryBankView] Sync error:', e); }
}

export async function handleSetDefaultProduct(prodId, ingId, subtypeId = null) {
  await setAutoDefaultProduct(prodId, ingId, subtypeId);
  renderIngredientBank();
  openIngredientFamilyDetailsModal(ingId);
}

export async function promptAddAlias(ingId) {
  const alias = prompt('Enter alias for matching recipe ingredients:');
  if (alias) { await aliasIngredient(ingId, alias); renderIngredientBank(); }
}

export async function promptRemoveAlias(ingId, alias) {
  if (confirm(`Remove alias "${alias}"?`)) { await removeAlias(ingId, alias); renderIngredientBank(); }
}

export async function promptAddSubtype(ingId) {
  const subName = prompt('Enter sub-type name:');
  if (subName) { await addSubtypeToIngredient(ingId, subName); renderIngredientBank(); }
}

export async function promptMerge(sourceIngId) {
  const state = getState() || {}, ings = (state.ingredients || []).filter(i => String(i.id) !== String(sourceIngId));
  if (!ings.length) return alert('No other ingredients available.');
  const num = parseInt(prompt(`Select target index:\n` + ings.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n')), 10);
  if (!isNaN(num) && num >= 1 && num <= ings.length) {
    const target = ings[num - 1];
    if (confirm(`Merge this ingredient into "${target.name}"?`)) { await mergeIngredients(sourceIngId, target.id); renderIngredientBank(); }
  }
}

export async function promptDemote(ingId) {
  const state = getState() || {}, ings = (state.ingredients || []).filter(i => String(i.id) !== String(ingId));
  if (!ings.length) return alert('No parent ingredients available.');
  const num = parseInt(prompt(`Select target parent core ingredient:\n` + ings.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n')), 10);
  if (!isNaN(num) && num >= 1 && num <= ings.length) { 
    const targetParent = ings[num - 1];
    await reparentSubtype(ingId, targetParent.id); 
    renderIngredientBank(); 
  }
}

export async function handlePromoteSubtype(subId, parentId) {
  if (confirm('Promote to Core Ingredient (detaches sub-type as a standalone parent card)?')) { 
    await promoteToIngredient(subId, parentId); 
    renderIngredientBank(); 
  }
}

export async function handleDeleteIngredient(ingId, ingName) {
  if (confirm(`Delete ingredient "${ingName}"?`)) {
    const state = getState() || {};
    setIngredients((state.ingredients || []).filter(i => String(i.id) !== String(ingId)));
    renderIngredientBank();
    await deleteIngredient(ingId);
  }
}

export function renderIngredientBank() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('ingredient-groups-list');
  if (!container) return;

  const state = getState() || {}, ingredients = state.ingredients || [], products = state.products || [];

  if (ingredients.length === 0) {
    container.innerHTML = `
      <div class="card" style="padding:32px 20px;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px;margin-top:12px;">
        <div style="font-size:32px;margin-bottom:8px">🥗</div>
        <h3 style="font-size:16px;font-weight:700;margin:0 0 6px 0">No ingredients in bank</h3>
        <button class="btn primary sm" type="button" onclick="openIngredientFamilyDetailsModal(null)">+ Add Ingredient</button>
      </div>
    `;
    return;
  }

  const hierarchy = buildPantryHierarchy(ingredients, products);

  container.innerHTML = hierarchy.map(group => `
    <div class="card" style="margin-bottom:16px;padding:16px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border,#e7e5e4)">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:16px">🏷️</span>
          <h3 style="margin:0;font-size:15px;font-weight:750;text-transform:capitalize">${escapeHtml(group.category)}</h3>
        </div>
        <span class="tag" style="font-size:11px;font-weight:600;background:var(--surface2,#f5f5f4)">${group.ingredients.length} items</span>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px">
        ${group.ingredients.map(ing => {
          const defProd = ing.defaultProduct, subtypes = ing.subtypes || [], aliases = ing.aliases || [];
          return `
            <div class="ingredient-card-node" style="padding:12px 14px;border-radius:10px;background:var(--surface2,#f5f5f4);border:1px solid var(--border,#e7e5e4);display:flex;flex-direction:column;gap:8px">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
                <div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:14px;font-weight:750;color:var(--text,#1c1917)">${escapeHtml(ing.name)}</span>
                    ${ing.unit ? `<span style="font-size:11px;color:var(--text2,#78716c)">(${escapeHtml(ing.unit)})</span>` : ''}
                  </div>
                  <div style="margin-top:4px;display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text2,#78716c)">
                    <span style="font-weight:600">Auto default:</span>
                    ${defProd ? `
                      <span class="tag" style="background:rgba(79,70,229,0.1);color:var(--primary,#4f46e5);font-weight:700;font-size:11px">
                        ⭐ ${escapeHtml(defProd.brand ? `${defProd.brand} - ` : '')}${escapeHtml(defProd.name)} (£${Number(defProd.price || 0).toFixed(2)})
                      </span>
                    ` : '<span style="font-style:italic">None linked</span>'}
                  </div>
                </div>

                <div style="display:flex;align-items:center;gap:6px;position:relative">
                  <button type="button" class="btn xs ghost" onclick="openIngredientFamilyDetailsModal('${escapeAttr(ing.id)}')" title="Edit properties">Edit</button>
                  <button type="button" class="btn xs ghost" onclick="promptAddSubtype('${escapeAttr(ing.id)}')" title="Add child sub-type">+ Sub-type</button>
                  <div style="position:relative;display:inline-block">
                    <button type="button" class="btn xs ghost" onclick="toggleCardMoreMenu(this, '${escapeAttr(ing.id)}')" title="More actions" style="padding:2px 6px;font-weight:700">•••</button>
                    <div id="card-more-menu-${escapeAttr(ing.id)}" class="card-more-menu" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,0.08);z-index:100;min-width:130px;flex-direction:column;padding:4px">
                      <button type="button" class="btn xs ghost" onclick="promptAddAlias('${escapeAttr(ing.id)}')" style="justify-content:flex-start;padding:6px 10px;width:100%;font-size:12px;text-align:left">🏷️ + Alias</button>
                      <button type="button" class="btn xs ghost" onclick="promptMerge('${escapeAttr(ing.id)}')" style="justify-content:flex-start;padding:6px 10px;width:100%;font-size:12px;text-align:left">🔀 Merge</button>
                      <button type="button" class="btn xs ghost" onclick="promptDemote('${escapeAttr(ing.id)}')" style="justify-content:flex-start;padding:6px 10px;width:100%;font-size:12px;text-align:left">⬇️ Move / Set as Sub-type of...</button>
                      <div style="height:1px;background:var(--border,#e7e5e4);margin:4px 0"></div>
                      <button type="button" class="btn xs ghost" onclick="handleDeleteIngredient('${escapeAttr(ing.id)}', '${escapeAttr(ing.name)}')" style="justify-content:flex-start;padding:6px 10px;width:100%;color:var(--red,#ef4444);font-size:12px;text-align:left">🗑️ Delete</button>
                    </div>
                  </div>
                </div>
              </div>

              ${aliases.length ? `
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px">
                  <span style="color:var(--text3,#a8a29e);font-weight:600">Aliases:</span>
                  ${aliases.map(a => `<span class="tag" style="font-size:10px;padding:2px 6px;background:var(--surface,#fff)">${escapeHtml(a)} <span style="cursor:pointer;margin-left:2px" onclick="promptRemoveAlias('${escapeAttr(ing.id)}', '${escapeAttr(a)}')">&times;</span></span>`).join('')}
                </div>
              ` : ''}

              ${subtypes.length ? `
                <div style="margin-top:4px">
                  <button type="button" class="btn xs ghost subtype-toggle-btn" onclick="toggleSubtypeCollapse(this, '${escapeAttr(ing.id)}')" style="font-size:11px;font-weight:700;color:var(--text2,#78716c);display:flex;align-items:center;gap:4px;padding:2px 6px">▼ SUB-TYPES (${subtypes.length})</button>
                  <div id="subtypes-container-${escapeAttr(ing.id)}" class="subtypes-collapsible" style="display:none;margin-top:6px;padding-left:14px;border-left:2px solid var(--border,#e7e5e4);flex-direction:column;gap:6px">
                    ${subtypes.map(st => `
                      <div style="padding:6px 10px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:6px;display:flex;align-items:center;justify-content:space-between">
                        <div style="display:flex;align-items:center;gap:8px">
                          <span style="font-size:12px;font-weight:650">↳ ${escapeHtml(st.name)}</span>
                          ${st.defaultProduct ? `<span class="tag" style="font-size:10px;background:rgba(79,70,229,0.08);color:var(--primary)">⭐ ${escapeHtml(st.defaultProduct.name)}</span>` : ''}
                        </div>
                        <button type="button" class="btn xs ghost" onclick="handlePromoteSubtype('${escapeAttr(st.id)}', '${escapeAttr(ing.id)}')" title="Promote to Core Ingredient">Promote to Core Ingredient</button>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

let isSubscribed = false;
export function initBankSubscriptions() {
  if (isSubscribed) return;
  isSubscribed = true;
  subscribe('ingredients', () => renderIngredientBank());
  subscribe('products', () => { renderIngredientBank(); renderProductBank(); });

  if (typeof document !== 'undefined') {
    document.addEventListener('plateplan:state:ingredients', () => renderIngredientBank());
    document.addEventListener('plateplan:state:products', () => { renderIngredientBank(); renderProductBank(); });
  }
}

export function mount(container) {
  initBankSubscriptions();
  renderIngredientBank();
  renderProductBank();
}

export { renderProductBank, openProductEditModal };

export function openCategoryManager() {
  renderCategoryManagerModal();
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    renderIngredientBank, openIngredientFamilyDetailsModal, closeIngredientFamilyDetailsModal,
    saveIngredientFamilyDetailsModal, handleSetDefaultProduct, promptAddAlias, promptRemoveAlias,
    promptAddSubtype, promptMerge, promptDemote, handlePromoteSubtype, handleDeleteIngredient,
    openCategoryManager, openCategoryManagerModal: openCategoryManager,
    createIngredientFamilyPrompt: () => openIngredientFamilyDetailsModal(null),
    
    toggleSubtypeCollapse(btn, ingId) {
      const container = document.getElementById(`subtypes-container-${ingId}`);
      if (!container) return;
      const isCollapsed = container.style.display === 'none';
      if (isCollapsed) {
        container.style.display = 'flex';
        container.classList.add('is-expanded');
        btn.textContent = `▲ SUB-TYPES (${container.children.length})`;
      } else {
        container.style.display = 'none';
        container.classList.remove('is-expanded');
        btn.textContent = `▼ SUB-TYPES (${container.children.length})`;
      }
    },
    
    toggleCardMoreMenu(btn, ingId) {
      document.querySelectorAll('.card-more-menu').forEach(menu => {
        if (menu.id !== `card-more-menu-${ingId}`) menu.style.display = 'none';
      });
      const menu = document.getElementById(`card-more-menu-${ingId}`);
      if (!menu) return;
      const isHidden = menu.style.display === 'none';
      menu.style.display = isHidden ? 'flex' : 'none';
      const closeListener = (e) => {
        if (!btn.contains(e.target) && !menu.contains(e.target)) {
          menu.style.display = 'none';
          document.removeEventListener('click', closeListener);
        }
      };
      if (isHidden) setTimeout(() => document.addEventListener('click', closeListener), 10);
    }
  });
}
