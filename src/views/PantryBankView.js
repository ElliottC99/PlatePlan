/**
 * src/views/PantryBankView.js (v3.19.35)
 * Modular ES6 View for Category ➔ Ingredient ➔ Sub-type Hierarchy Bank.
 * Features Aliasing, Merging, Sub-type creation, Promoting/demoting, and Auto-default product previews.
 * Fully responsive and optimized to remain under 350 lines.
 */

import { getState, setIngredients, subscribe } from '../store/store.js';
import { saveIngredient, deleteIngredient } from '../services/HouseholdRepository.js';
import { 
  buildPantryHierarchy, aliasIngredient, removeAlias, addSubtypeToIngredient, 
  promoteToIngredient, demoteToSubtype, reparentSubtype, mergeIngredients, setAutoDefaultProduct, getActiveCategories,
  invalidateHierarchyCache, slugCategory
} from '../models/PantryHierarchyModel.js';
import { renderProductBank, openProductEditModal } from './ProductBankView.js';
import { renderCategoryManagerModal } from '../components/pantry/CategoryManagerModalUI.js';
import { updateIngredientFamilyModalUI } from '../components/pantry/IngredientFamilyModalUI.js';

let activeEditingIngredientId = null;
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
  return items.filter(item => 
    slugCategory(item.category) === targetSlug || 
    slugCategory(item.cat) === targetSlug
  );
}

export function updateActiveCategoryFilter(oldName, newName) {
  if (oldName) {
    const oldSlug = slugCategory(oldName);
    const curFilter = selectedCategoryFilter || activeCategoryFilter;
    if (curFilter && slugCategory(curFilter) === oldSlug) {
      selectedCategoryFilter = (newName && newName !== 'all') ? newName : null;
      activeCategoryFilter = selectedCategoryFilter;
    }
    const searchInput = typeof document !== 'undefined' ? document.getElementById('ingredient-group-search') : null;
    if (searchInput && searchInput.value && slugCategory(searchInput.value) === oldSlug) {
      searchInput.value = newName ? newName : '';
    }
  }
  invalidateHierarchyCache();
  renderIngredientBank();
}

export function closeIngredientFamilyDetailsModal() {
  const modalWrap = document.getElementById('ingredient-family-details-wrap');
  if (modalWrap) {
    modalWrap.classList.remove('open');
    modalWrap.dataset.parentId = '';
  }
  const catEl = document.getElementById('ingredient-family-details-cat');
  if (catEl) catEl.disabled = false;
  const parentWrap = document.getElementById('parent-ingredient-display-wrap');
  if (parentWrap) parentWrap.style.display = 'none';
  const actionsWrap = document.getElementById('subtype-product-actions-wrap');
  if (actionsWrap) actionsWrap.style.display = 'none';
  const nameEl = document.getElementById('ingredient-family-details-name');
  if (nameEl) nameEl.oninput = null;
  const tescoEl = document.getElementById('tesco-search-helper-link');
  if (tescoEl) tescoEl.innerHTML = '';
  document.body.style.overflow = '';
  activeEditingIngredientId = null;
}

export function openIngredientFamilyDetailsModal(ingredientId = null, parentId = null) {
  const modalWrap = document.getElementById('ingredient-family-details-wrap');
  if (!modalWrap) return;

  document.body.style.overflow = 'hidden';
  activeEditingIngredientId = ingredientId;
  modalWrap.dataset.parentId = parentId || '';

  const state = getState() || {}, ingredients = state.ingredients || [], products = state.products || [];
  const ing = ingredientId ? ingredients.find(i => String(i.id) === String(ingredientId)) : null;
  const parent = parentId ? ingredients.find(i => String(i.id) === String(parentId)) : null;

  const titleEl = document.getElementById('ingredient-family-details-title');
  const nameEl = document.getElementById('ingredient-family-details-name');
  const catEl = document.getElementById('ingredient-family-details-cat');
  const notesEl = document.getElementById('ingredient-family-details-notes');
  const msgEl = document.getElementById('ingredient-family-details-msg');

  if (titleEl) {
    if (ing) {
      titleEl.textContent = `Edit ${ing.name}`;
    } else if (parent) {
      titleEl.textContent = `Add Sub-type to ${parent.name}`;
    } else {
      titleEl.textContent = 'New Ingredient';
    }
  }
  if (nameEl) nameEl.value = ing?.name || '';
  if (notesEl) notesEl.value = ing?.notes || '';

  if (catEl) {
    const categories = getActiveCategories(state);
    const selectedCat = (ing?.category || parent?.category || '').toLowerCase();
    catEl.innerHTML = categories.map(c => `<option value="${escapeAttr(c.toLowerCase())}" ${selectedCat === c.toLowerCase() ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
    catEl.disabled = Boolean(parent && !ing);
    const targetCat = ing?.category || parent?.category || '';
    if (targetCat) catEl.value = targetCat;
    if (parent && !ing) {
      catEl.value = parent.category ? parent.category.toLowerCase() : '';
      catEl.disabled = true;
    }
  }

  if (msgEl && ing) {
    const linked = products.filter(p => String(p.ingredientId) === String(ing.id) || String(p.groupId) === String(ing.id));
    msgEl.innerHTML = `<div style="margin-top:14px;padding:10px;background:var(--surface2,#f5f5f4);border-radius:8px;border:1px solid var(--border,#e7e5e4)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12px;font-weight:750">Linked Products (${linked.length})</span>
        <button type="button" class="btn sm ghost" onclick="openProductEditModal(null)" style="font-size:11px">+ Add Product</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto">
        ${linked.map(p => `<div style="padding:6px 8px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:6px;display:flex;align-items:center;justify-content:space-between">
          <div><span style="font-size:12px;font-weight:600">${escapeHtml(p.name)}</span><div style="font-size:11px;color:var(--text2,#78716c)">${escapeHtml(p.brand || '')} · £${Number(p.price || 0).toFixed(2)}</div></div>
          <div style="display:flex;gap:4px">
            ${p.isAutoDefault ? '<span class="tag" style="font-size:10px;background:rgba(16,185,129,0.15);color:var(--green);font-weight:700">Default</span>' : `<button type="button" class="btn xs ghost" onclick="handleSetDefaultProduct('${escapeAttr(p.id)}', '${escapeAttr(ing.id)}')">Default</button>`}
            <button type="button" class="btn xs ghost" onclick="openProductEditModal('${escapeAttr(p.id)}')">Edit</button>
          </div>
        </div>`).join('') || '<div style="font-size:12px;color:var(--text2)">No linked products.</div>'}
      </div>
    </div>`;
  } else if (msgEl) {
    msgEl.innerHTML = '';
  }

  // 3. Apply layout updates and Tesco helper integration
  updateIngredientFamilyModalUI(ing, parent);

  modalWrap.classList.add('open');
}

export async function saveIngredientFamilyDetailsModal() {
  const name = (document.getElementById('ingredient-family-details-name')?.value || '').trim();
  if (!name) return;
  const category = document.getElementById('ingredient-family-details-cat')?.value || 'other';
  const notes = (document.getElementById('ingredient-family-details-notes')?.value || '').trim();
  const modalWrap = document.getElementById('ingredient-family-details-wrap');
  const parentId = modalWrap?.dataset?.parentId;

  if (parentId && !activeEditingIngredientId) {
    await addSubtypeToIngredient(parentId, name, notes);
    closeIngredientFamilyDetailsModal(); renderIngredientBank(); return;
  }

  const state = getState() || {}, currentIngs = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  const updatedIng = {
    ...(activeEditingIngredientId ? currentIngs.find(i => String(i.id) === String(activeEditingIngredientId)) : {}),
    id: activeEditingIngredientId || `ing_${Date.now()}`, name, category, notes, updatedAt: new Date().toISOString()
  };

  const existingIdx = currentIngs.findIndex(i => String(i.id) === String(updatedIng.id));
  if (existingIdx >= 0) currentIngs[existingIdx] = updatedIng; else currentIngs.push(updatedIng);

  setIngredients(currentIngs); closeIngredientFamilyDetailsModal(); renderIngredientBank();

  try { await saveIngredient(updatedIng); } catch (e) { console.warn('[PantryBankView] Sync error:', e); }
}

export async function handleSetDefaultProduct(prodId, ingId, subtypeId = null) {
  await setAutoDefaultProduct(prodId, ingId, subtypeId);
  renderIngredientBank(); openIngredientFamilyDetailsModal(ingId);
}

export async function promptAddAlias(ingId) {
  const alias = prompt('Enter alias:'); if (alias) { await aliasIngredient(ingId, alias); renderIngredientBank(); }
}

export async function promptRemoveAlias(ingId, alias) {
  if (confirm(`Remove alias "${alias}"?`)) { await removeAlias(ingId, alias); renderIngredientBank(); }
}

export function promptAddSubtype(ingId) { openIngredientFamilyDetailsModal(null, ingId); }

export async function promptMerge(sourceIngId) {
  const state = getState() || {}, ings = (state.ingredients || []).filter(i => String(i.id) !== String(sourceIngId));
  if (!ings.length) return alert('No other ingredients available.');
  const num = parseInt(prompt(`Select index:\n` + ings.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n')), 10);
  if (!isNaN(num) && num >= 1 && num <= ings.length) {
    if (confirm(`Merge into "${ings[num - 1].name}"?`)) { await mergeIngredients(sourceIngId, ings[num - 1].id); renderIngredientBank(); }
  }
}

export async function promptDemote(ingId) {
  const state = getState() || {}, ings = (state.ingredients || []).filter(i => String(i.id) !== String(ingId));
  if (!ings.length) return alert('No parent ingredients.');
  const num = parseInt(prompt(`Select parent:\n` + ings.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n')), 10);
  if (!isNaN(num) && num >= 1 && num <= ings.length) { await reparentSubtype(ingId, ings[num - 1].id); renderIngredientBank(); }
}

export async function handlePromoteSubtype(subId, parentId) {
  if (confirm('Promote to Core Ingredient?')) { await promoteToIngredient(subId, parentId); renderIngredientBank(); }
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
    container.innerHTML = `<div class="card" style="padding:32px 20px;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px;margin-top:12px;">
      <div style="font-size:32px;margin-bottom:8px">🥗</div>
      <h3 style="font-size:16px;font-weight:700;margin:0 0 6px 0">No ingredients in bank</h3>
      <button class="btn primary sm" type="button" onclick="openIngredientFamilyDetailsModal(null)">+ Add Ingredient</button>
    </div>`;
    return;
  }

  let hierarchy = buildPantryHierarchy(ingredients, products);

  const curFilter = selectedCategoryFilter || activeCategoryFilter;
  if (curFilter && curFilter !== 'all') {
    const targetSlug = slugCategory(curFilter);
    hierarchy = hierarchy.filter(g => 
      slugCategory(g.category) === targetSlug || 
      slugCategory(g.cat) === targetSlug
    );
  }

  const searchInput = typeof document !== 'undefined' ? document.getElementById('ingredient-group-search') : null;
  const query = (searchInput?.value || '').trim().toLowerCase();
  const querySlug = slugCategory(query);
  if (query) {
    hierarchy = hierarchy.map(g => {
      const matchCat = (g.category || '').toLowerCase().includes(query) || (querySlug && slugCategory(g.category) === querySlug);
      const filteredIngs = g.ingredients.filter(ing => {
        if (matchCat) return true;
        if ((ing.name || '').toLowerCase().includes(query) || (querySlug && slugCategory(ing.name).includes(querySlug))) return true;
        if (Array.isArray(ing.aliases) && ing.aliases.some(a => (a || '').toLowerCase().includes(query) || (querySlug && slugCategory(a).includes(querySlug)))) return true;
        if (Array.isArray(ing.subtypes) && ing.subtypes.some(st => (st.name || '').toLowerCase().includes(query) || (querySlug && slugCategory(st.name).includes(querySlug)))) return true;
        return false;
      });
      return { ...g, ingredients: filteredIngs };
    }).filter(g => g.ingredients.length > 0);
  }

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
                  <button type="button" class="btn xs ghost subtype-toggle-btn" onclick="openAddSubtypeModal('${escapeAttr(ing.id)}')" title="Add child sub-type">+ Sub-type</button>
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
  const update = () => { renderIngredientBank(); renderProductBank(); };
  subscribe('ingredients', update); subscribe('products', update);
  if (typeof document !== 'undefined') {
    document.addEventListener('plateplan:state:ingredients', update);
    document.addEventListener('plateplan:state:products', update);
  }
}

export function mount(container) { initBankSubscriptions(); renderIngredientBank(); renderProductBank(); }

export const renderPantryBankView = renderIngredientBank; export { renderProductBank, openProductEditModal };
export function openAddSubtypeModal(parentId) { openIngredientFamilyDetailsModal(null, parentId); }
export function openCategoryManager() { renderCategoryManagerModal(); }

if (typeof window !== 'undefined') {
  Object.assign(window, {
    renderIngredientBank, renderPantryBankView, openIngredientFamilyDetailsModal, closeIngredientFamilyDetailsModal,
    openAddSubtypeModal,
    saveIngredientFamilyDetailsModal, handleSetDefaultProduct, promptAddAlias, promptRemoveAlias,
    promptAddSubtype, promptMerge, promptDemote, handlePromoteSubtype, handleDeleteIngredient,
    openCategoryManager, openCategoryManagerModal: openCategoryManager,
    updateActiveCategoryFilter, setActiveCategoryFilter, resetCategoryFilter, getFilteredIngredients,
    createIngredientFamilyPrompt: () => openIngredientFamilyDetailsModal(null),
    
    toggleSubtypeCollapse(btn, ingId) {
      const container = document.getElementById(`subtypes-container-${ingId}`);
      if (!container) return;
      const isCollapsed = container.style.display === 'none';
      container.style.display = isCollapsed ? 'flex' : 'none'; container.classList.toggle('is-expanded', isCollapsed);
      btn.textContent = `${isCollapsed ? '▲' : '▼'} SUB-TYPES (${container.children.length})`;
    },
    toggleCardMoreMenu(btn, ingId) {
      document.querySelectorAll('.card-more-menu').forEach(m => { if (m.id !== `card-more-menu-${ingId}`) m.style.display = 'none'; });
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
