/**
 * src/views/PantryBankView.js (v3.19.13)
 * Modular ES6 View for Category ➔ Ingredient ➔ Sub-type Hierarchy Bank.
 * Features Aliasing, Merging, Sub-type creation, Promoting/demoting, and Auto-default product previews.
 */

import { getState, setIngredients, subscribe } from '../store/store.js';
import { saveIngredient, deleteIngredient } from '../services/HouseholdRepository.js';
import { 
  buildPantryHierarchy, 
  aliasIngredient, 
  removeAlias, 
  addSubtypeToIngredient, 
  promoteToIngredient, 
  demoteToSubtype, 
  mergeIngredients,
  setAutoDefaultProduct,
  getActiveCategories
} from '../models/PantryHierarchyModel.js';
import { renderProductBank, openProductEditModal } from './ProductBankView.js';

let activeEditingIngredientId = null;

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
  const state = getState() || {};
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
  const products = Array.isArray(state.products) ? state.products : [];

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
    const categories = getActiveCategories(state);
    catEl.innerHTML = categories.map(c => `<option value="${escapeAttr(c.toLowerCase())}" ${ing?.category?.toLowerCase() === c.toLowerCase() ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
  }

  if (msgEl) {
    if (ing) {
      const linkedProds = products.filter(p => String(p.ingredientId) === String(ing.id) || String(p.groupId) === String(ing.id));
      msgEl.innerHTML = `
        <div style="margin-top:14px;padding:10px;background:var(--surface2,#f5f5f4);border-radius:8px;border:1px solid var(--border,#e7e5e4)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:12px;font-weight:750">Linked Products (${linkedProds.length})</span>
            <button type="button" class="btn sm ghost" onclick="openProductEditModal(null)" style="font-size:11px">+ Add Product</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto">
            ${linkedProds.length ? linkedProds.map(p => `
              <div style="padding:6px 8px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:6px;display:flex;align-items:center;justify-content:space-between">
                <div>
                  <span style="font-size:12px;font-weight:600">${escapeHtml(p.name)}</span>
                  <div style="font-size:11px;color:var(--text2,#78716c)">${escapeHtml(p.brand || '')} · £${Number(p.price || 0).toFixed(2)} · ${p.cal || 0} kcal</div>
                </div>
                <div style="display:flex;gap:4px">
                  ${p.isAutoDefault ? '<span class="tag" style="font-size:10px;background:rgba(16,185,129,0.15);color:var(--green,#10b981);font-weight:700">Default</span>' : `<button type="button" class="btn xs ghost" onclick="handleSetDefaultProduct('${escapeAttr(p.id)}', '${escapeAttr(ing.id)}')">Set Default</button>`}
                  <button type="button" class="btn xs ghost" onclick="openProductEditModal('${escapeAttr(p.id)}')">Edit</button>
                </div>
              </div>
            `).join('') : '<div style="font-size:12px;color:var(--text2,#78716c)">No products linked directly.</div>'}
          </div>
        </div>
      `;
    } else {
      msgEl.innerHTML = '';
    }
  }

  modalWrap.classList.add('open');
}

export async function saveIngredientFamilyDetailsModal() {
  const nameEl = document.getElementById('ingredient-family-details-name');
  const catEl = document.getElementById('ingredient-family-details-cat');
  const notesEl = document.getElementById('ingredient-family-details-notes');

  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) return;

  const category = catEl ? catEl.value : 'other';
  const notes = notesEl ? notesEl.value.trim() : '';

  const state = getState() || {};
  const currentIngs = Array.isArray(state.ingredients) ? [...state.ingredients] : [];

  const updatedIng = {
    ...(activeEditingIngredientId ? currentIngs.find(i => String(i.id) === String(activeEditingIngredientId)) : {}),
    id: activeEditingIngredientId || `ing_${Date.now()}`,
    name,
    category,
    notes,
    updatedAt: new Date().toISOString()
  };

  const existingIdx = currentIngs.findIndex(i => String(i.id) === String(updatedIng.id));
  if (existingIdx >= 0) {
    currentIngs[existingIdx] = updatedIng;
  } else {
    currentIngs.push(updatedIng);
  }

  setIngredients(currentIngs);
  closeIngredientFamilyDetailsModal();
  renderIngredientBank();

  try {
    await saveIngredient(updatedIng);
  } catch (e) {
    console.warn('[PantryBankView] Cloud sync fallback for ingredient:', e);
  }
}

export async function handleSetDefaultProduct(prodId, ingId, subtypeId = null) {
  await setAutoDefaultProduct(prodId, ingId, subtypeId);
  renderIngredientBank();
  openIngredientFamilyDetailsModal(ingId);
}

export async function promptAddAlias(ingId) {
  const alias = prompt('Enter alias for matching recipe ingredients (e.g. "linguine" for Pasta):');
  if (alias) {
    await aliasIngredient(ingId, alias);
    renderIngredientBank();
  }
}

export async function promptRemoveAlias(ingId, alias) {
  if (confirm(`Remove alias "${alias}"?`)) {
    await removeAlias(ingId, alias);
    renderIngredientBank();
  }
}

export async function promptAddSubtype(ingId) {
  const subName = prompt('Enter sub-type name (e.g. "Firm Tofu", "Silken Tofu"):');
  if (subName) {
    await addSubtypeToIngredient(ingId, subName);
    renderIngredientBank();
  }
}

export async function promptMerge(sourceIngId) {
  const state = getState() || {};
  const ings = Array.isArray(state.ingredients) ? state.ingredients.filter(i => String(i.id) !== String(sourceIngId)) : [];
  if (!ings.length) {
    alert('No other ingredients available to merge into.');
    return;
  }
  const promptText = `Select target ingredient to merge INTO:\n` + ings.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n') + `\nEnter number:`;
  const selectedIdx = prompt(promptText);
  const num = parseInt(selectedIdx, 10);
  if (!isNaN(num) && num >= 1 && num <= ings.length) {
    const target = ings[num - 1];
    if (confirm(`Merge this ingredient into "${target.name}"? Aliases and products will be moved.`)) {
      await mergeIngredients(sourceIngId, target.id);
      renderIngredientBank();
    }
  }
}

export async function promptDemote(ingId) {
  const state = getState() || {};
  const ings = Array.isArray(state.ingredients) ? state.ingredients.filter(i => String(i.id) !== String(ingId)) : [];
  if (!ings.length) {
    alert('No parent ingredients available.');
    return;
  }
  const promptText = `Select parent ingredient to turn this into a sub-type of:\n` + ings.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n') + `\nEnter number:`;
  const selectedIdx = prompt(promptText);
  const num = parseInt(selectedIdx, 10);
  if (!isNaN(num) && num >= 1 && num <= ings.length) {
    const target = ings[num - 1];
    await demoteToSubtype(ingId, target.id);
    renderIngredientBank();
  }
}

export async function handlePromoteSubtype(subId, parentId) {
  if (confirm('Promote this sub-type to a top-level ingredient?')) {
    await promoteToIngredient(subId, parentId);
    renderIngredientBank();
  }
}

export async function handleDeleteIngredient(ingId, ingName) {
  if (confirm(`Delete ingredient "${ingName}"?`)) {
    const state = getState() || {};
    const ings = (state.ingredients || []).filter(i => String(i.id) !== String(ingId));
    setIngredients(ings);
    renderIngredientBank();
    await deleteIngredient(ingId);
  }
}

export function renderIngredientBank() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('ingredient-groups-list');
  if (!container) return;

  const state = getState() || {};
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
  const products = Array.isArray(state.products) ? state.products : [];

  if (ingredients.length === 0) {
    container.innerHTML = `
      <div class="card" style="padding:32px 20px;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px;margin-top:12px;">
        <div style="font-size:32px;margin-bottom:8px">🥗</div>
        <h3 style="font-size:16px;font-weight:700;margin:0 0 6px 0">No ingredients in bank</h3>
        <p style="font-size:13px;color:var(--text2,#78716c);margin:0 0 16px 0">Add core ingredients to configure Category ➔ Ingredient ➔ Sub-type hierarchies and auto-defaults.</p>
        <button class="btn primary sm" type="button" onclick="openIngredientFamilyDetailsModal(null)">+ Add Ingredient</button>
      </div>
    `;
    return;
  }

  const hierarchy = buildPantryHierarchy(ingredients, products);

  const html = hierarchy.map(group => `
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
          const defProd = ing.defaultProduct;
          const subtypes = ing.subtypes || [];
          const aliases = ing.aliases || [];

          return `
            <div class="ingredient-card-node" style="padding:12px 14px;border-radius:10px;background:var(--surface2,#f5f5f4);border:1px solid var(--border,#e7e5e4);display:flex;flex-direction:column;gap:8px">
              <!-- Top Row: Name, Default Product Preview & Actions -->
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
                <div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:14px;font-weight:750;color:var(--text,#1c1917)">${escapeHtml(ing.name)}</span>
                    ${ing.unit ? `<span style="font-size:11px;color:var(--text2,#78716c)">(${escapeHtml(ing.unit)})</span>` : ''}
                  </div>
                  <!-- Auto-default Product Preview Badge -->
                  <div style="margin-top:4px;display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text2,#78716c)">
                    <span style="font-weight:600">Auto default:</span>
                    ${defProd ? `
                      <span class="tag" style="background:rgba(79,70,229,0.1);color:var(--primary,#4f46e5);font-weight:700;font-size:11px">
                        ⭐ ${escapeHtml(defProd.brand ? `${defProd.brand} - ` : '')}${escapeHtml(defProd.name)} (£${Number(defProd.price || 0).toFixed(2)} · ${defProd.prot || 0}g P · ${defProd.cal || 0} kcal)
                      </span>
                    ` : '<span style="font-style:italic">None linked</span>'}
                  </div>
                </div>

                <!-- Rich Action Buttons -->
                <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
                  <button type="button" class="btn xs ghost" onclick="openIngredientFamilyDetailsModal('${escapeAttr(ing.id)}')" title="Edit properties">Edit</button>
                  <button type="button" class="btn xs ghost" onclick="promptAddAlias('${escapeAttr(ing.id)}')" title="Add alias">+ Alias</button>
                  <button type="button" class="btn xs ghost" onclick="promptAddSubtype('${escapeAttr(ing.id)}')" title="Add child sub-type">+ Sub-type</button>
                  <button type="button" class="btn xs ghost" onclick="promptMerge('${escapeAttr(ing.id)}')" title="Merge into another ingredient">Merge</button>
                  <button type="button" class="btn xs ghost" onclick="promptDemote('${escapeAttr(ing.id)}')" title="Make a sub-type of another ingredient">Make Sub-type</button>
                  <button type="button" class="btn xs ghost" onclick="handleDeleteIngredient('${escapeAttr(ing.id)}', '${escapeAttr(ing.name)}')" style="color:var(--red,#ef4444)">Delete</button>
                </div>
              </div>

              <!-- Aliases list if any -->
              ${aliases.length ? `
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px">
                  <span style="color:var(--text3,#a8a29e);font-weight:600">Aliases:</span>
                  ${aliases.map(a => `
                    <span class="tag" style="font-size:10px;padding:2px 6px;background:var(--surface,#fff)">
                      ${escapeHtml(a)} <span style="cursor:pointer;margin-left:2px;color:var(--text3)" onclick="promptRemoveAlias('${escapeAttr(ing.id)}', '${escapeAttr(a)}')">&times;</span>
                    </span>
                  `).join('')}
                </div>
              ` : ''}

              <!-- Sub-types hierarchy tree -->
              ${subtypes.length ? `
                <div style="margin-top:6px;padding-left:14px;border-left:2px solid var(--border,#e7e5e4);display:flex;flex-direction:column;gap:6px">
                  <span style="font-size:11px;font-weight:700;color:var(--text2,#78716c);text-transform:uppercase;letter-spacing:0.04em">Sub-types (${subtypes.length})</span>
                  ${subtypes.map(st => `
                    <div style="padding:6px 10px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:6px;display:flex;align-items:center;justify-content:space-between">
                      <div style="display:flex;align-items:center;gap:8px">
                        <span style="font-size:12px;font-weight:650">↳ ${escapeHtml(st.name)}</span>
                        ${st.defaultProduct ? `<span class="tag" style="font-size:10px;background:rgba(79,70,229,0.08);color:var(--primary)">⭐ ${escapeHtml(st.defaultProduct.name)}</span>` : ''}
                      </div>
                      <button type="button" class="btn xs ghost" onclick="handlePromoteSubtype('${escapeAttr(st.id)}', '${escapeAttr(ing.id)}')" title="Promote to top-level ingredient">Make Ingredient</button>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

let isSubscribed = false;
export function initBankSubscriptions() {
  if (isSubscribed) return;
  isSubscribed = true;

  subscribe('ingredients', () => renderIngredientBank());
  subscribe('products', () => {
    renderIngredientBank();
    renderProductBank();
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('plateplan:state:ingredients', () => renderIngredientBank());
    document.addEventListener('plateplan:state:products', () => {
      renderIngredientBank();
      renderProductBank();
    });
  }
}

export function mount(container) {
  initBankSubscriptions();
  renderIngredientBank();
  renderProductBank();
}

export { renderProductBank, openProductEditModal };

if (typeof window !== 'undefined') {
  window.renderIngredientBank = renderIngredientBank;
  window.openIngredientFamilyDetailsModal = openIngredientFamilyDetailsModal;
  window.closeIngredientFamilyDetailsModal = closeIngredientFamilyDetailsModal;
  window.saveIngredientFamilyDetailsModal = saveIngredientFamilyDetailsModal;
  window.createIngredientFamilyPrompt = () => openIngredientFamilyDetailsModal(null);
  window.handleSetDefaultProduct = handleSetDefaultProduct;
  window.promptAddAlias = promptAddAlias;
  window.promptRemoveAlias = promptRemoveAlias;
  window.promptAddSubtype = promptAddSubtype;
  window.promptMerge = promptMerge;
  window.promptDemote = promptDemote;
  window.handlePromoteSubtype = handlePromoteSubtype;
  window.handleDeleteIngredient = handleDeleteIngredient;
}
