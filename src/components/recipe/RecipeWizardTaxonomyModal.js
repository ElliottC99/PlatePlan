/**
 * src/components/recipe/RecipeWizardTaxonomyModal.js (v3.28.4)
 * New Ingredient Mapping Wizard Modal component.
 * 3-step wizard for mapping raw recipe ingredients into Category -> Item -> Sub-Type hierarchy.
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { saveIngredient } from '../../services/HouseholdRepository.js';
import { toTitleCase } from '../../services/RecipeImporter.js';
import { openSubtypeProductLinkerModal, openTescoImportModal } from '../pantry/SubtypeProductLinkerModalUI.js';

const STANDARD_CATEGORIES = [
  'Store Cupboard',
  'Produce',
  'Refrigerated & Dairy',
  'Frozen',
  'Bakery',
  'Spices & Oils'
];

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

export function openNewIngredientMappingWizardModal({ sIdx, iIdx, initialName = '', onComplete = null } = {}) {
  const storeState = getState() || {};
  const ingredients = storeState.ingredients || [];
  const existingCategories = Array.from(
    new Set([...STANDARD_CATEGORIES, ...(storeState.categories || []), ...ingredients.map(i => i.category).filter(Boolean)])
  ).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

  const cleanInitialName = toTitleCase(initialName || 'New Item');

  let currentStep = 1;
  let wizardData = {
    entityType: 'subtype', // 'subtype' | 'item' | 'category'
    name: cleanInitialName,
    selectedItemId: '',
    newItemName: '',
    selectedCategory: existingCategories[0] || 'Store Cupboard',
    subTypeName: cleanInitialName,
    createdIngredientId: null,
    createdSubtypeId: null
  };

  let modalEl = document.getElementById('new-ingredient-mapping-wizard-modal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'new-ingredient-mapping-wizard-modal';
    modalEl.className = 'modal-wrap';
    modalEl.style.zIndex = '1200';
    document.body.appendChild(modalEl);
  }

  const renderWizard = () => {
    let stepHtml = '';

    if (currentStep === 1) {
      stepHtml = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <label for="map-wiz-name" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">
              Entity Name <span style="color:#dc2626">*</span>
            </label>
            <input type="text" 
                   id="map-wiz-name" 
                   name="map_wiz_name"
                   value="${escapeAttr(wizardData.name)}" 
                   placeholder="e.g. Extra Firm Tofu, Smoked Paprika" 
                   style="width: 100%; padding: 10px 12px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 13.5px; background: var(--surface); color: var(--text); box-sizing: border-box;" />
          </div>

          <div>
            <label style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 8px; color: var(--text);">
              Define Entity Type <span style="color:#dc2626">*</span>
            </label>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label for="type-subtype" style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid var(--border, #e5e7eb); border-radius: 8px; background: ${wizardData.entityType === 'subtype' ? '#eef2ff' : 'var(--surface)'}; cursor: pointer;">
                <input type="radio" id="type-subtype" name="wiz-entity-type" value="subtype" ${wizardData.entityType === 'subtype' ? 'checked' : ''} style="margin-top: 3px;" />
                <div>
                  <div style="font-size: 13px; font-weight: 700;">Sub-Type (Specific Variant)</div>
                  <div style="font-size: 11.5px; color: var(--text2, #666);">e.g. Extra Firm Tofu, Smoked Paprika, Oat Milk</div>
                </div>
              </label>

              <label for="type-item" style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid var(--border, #e5e7eb); border-radius: 8px; background: ${wizardData.entityType === 'item' ? '#eef2ff' : 'var(--surface)'}; cursor: pointer;">
                <input type="radio" id="type-item" name="wiz-entity-type" value="item" ${wizardData.entityType === 'item' ? 'checked' : ''} style="margin-top: 3px;" />
                <div>
                  <div style="font-size: 13px; font-weight: 700;">Item (Primary Food Entity)</div>
                  <div style="font-size: 11.5px; color: var(--text2, #666);">e.g. Tofu, Paprika, Milk</div>
                </div>
              </label>

              <label for="type-category" style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid var(--border, #e5e7eb); border-radius: 8px; background: ${wizardData.entityType === 'category' ? '#eef2ff' : 'var(--surface)'}; cursor: pointer;">
                <input type="radio" id="type-category" name="wiz-entity-type" value="category" ${wizardData.entityType === 'category' ? 'checked' : ''} style="margin-top: 3px;" />
                <div>
                  <div style="font-size: 13px; font-weight: 700;">Category (High-Level Group)</div>
                  <div style="font-size: 11.5px; color: var(--text2, #666);">e.g. Produce, Store Cupboard, Refrigerated & Dairy</div>
                </div>
              </label>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
            <button type="button" class="btn ghost" id="btn-close-map-wiz">Cancel</button>
            <button type="button" class="btn primary" id="btn-next-step1">Next: Hierarchy Mapping →</button>
          </div>
        </div>
      `;
    } else if (currentStep === 2) {
      stepHtml = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="background: #eef2ff; border: 1px solid #c7d2fe; padding: 10px 12px; border-radius: 8px; font-size: 12.5px; color: #3730a3;">
            Creating <strong>${escapeHtml(wizardData.name)}</strong> as <strong>${escapeHtml(wizardData.entityType.toUpperCase())}</strong>
          </div>

          ${wizardData.entityType === 'subtype' ? `
            <!-- Sub-Type: Searchable Item & Category Selection -->
            <div>
              <label for="map-item-search-input" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">
                1) Select or Create Parent Item <span style="color:#dc2626">*</span>
              </label>
              <div style="position: relative;">
                <input type="text" 
                       id="map-item-search-input" 
                       name="map_item_search_input"
                       value="${escapeAttr(wizardData.newItemName || wizardData.name)}" 
                       placeholder="Type to search existing items..." 
                       autocomplete="off"
                       style="width: 100%; padding: 8px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface);" />
                <div id="map-item-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; max-height:160px; overflow-y:auto; background:var(--surface,#fff); border:1px solid var(--border,#ccc); border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.15); z-index:1100; margin-top:2px;"></div>
              </div>
            </div>

            <div>
              <label for="map-cat-search-input" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">
                2) Select or Create Parent Category <span style="color:#dc2626">*</span>
              </label>
              <div style="position: relative;">
                <input type="text" 
                       id="map-cat-search-input" 
                       name="map_cat_search_input"
                       value="${escapeAttr(wizardData.selectedCategory)}" 
                       placeholder="Type to search existing categories..." 
                       autocomplete="off"
                       style="width: 100%; padding: 8px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface);" />
                <div id="map-cat-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; max-height:160px; overflow-y:auto; background:var(--surface,#fff); border:1px solid var(--border,#ccc); border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.15); z-index:1100; margin-top:2px;"></div>
              </div>
            </div>
          ` : wizardData.entityType === 'item' ? `
            <!-- Item: Sub-Type Name & Category Selection -->
            <div>
              <label for="map-sub-name-input" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">
                1) Sub-Type Name underneath Item <span style="color:#dc2626">*</span>
              </label>
              <input type="text" 
                     id="map-sub-name-input" 
                     name="map_sub_name_input"
                     value="${escapeAttr(wizardData.subTypeName)}" 
                     placeholder="e.g. Standard / Generic" 
                     style="width: 100%; padding: 8px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface);" />
            </div>

            <div>
              <label for="map-cat-search-input" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">
                2) Select or Create Category <span style="color:#dc2626">*</span>
              </label>
              <div style="position: relative;">
                <input type="text" 
                       id="map-cat-search-input" 
                       name="map_cat_search_input"
                       value="${escapeAttr(wizardData.selectedCategory)}" 
                       placeholder="Type to search existing categories..." 
                       autocomplete="off"
                       style="width: 100%; padding: 8px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface);" />
                <div id="map-cat-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; max-height:160px; overflow-y:auto; background:var(--surface,#fff); border:1px solid var(--border,#ccc); border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.15); z-index:1100; margin-top:2px;"></div>
              </div>
            </div>
          ` : `
            <!-- Category: Item Search & Sub-Type Input -->
            <div>
              <label for="map-item-search-input" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">
                1) Assign or Create Item under Category <span style="color:#dc2626">*</span>
              </label>
              <div style="position: relative;">
                <input type="text" 
                       id="map-item-search-input" 
                       name="map_item_search_input"
                       value="${escapeAttr(wizardData.newItemName || wizardData.name)}" 
                       placeholder="Type or search Item..." 
                       autocomplete="off"
                       style="width: 100%; padding: 8px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface);" />
                <div id="map-item-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; max-height:160px; overflow-y:auto; background:var(--surface,#fff); border:1px solid var(--border,#ccc); border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.15); z-index:1100; margin-top:2px;"></div>
              </div>
            </div>

            <div>
              <label for="map-sub-name-input" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">
                2) Assign Sub-Type Name <span style="color:#dc2626">*</span>
              </label>
              <input type="text" 
                     id="map-sub-name-input" 
                     name="map_sub_name_input"
                     value="${escapeAttr(wizardData.subTypeName)}" 
                     placeholder="e.g. Standard" 
                     style="width: 100%; padding: 8px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface);" />
            </div>
          `}

          <div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
            <button type="button" class="btn ghost" id="btn-back-step2">← Back</button>
            <button type="button" class="btn primary" id="btn-next-step2">Next: Linked Product →</button>
          </div>
        </div>
      `;
    } else if (currentStep === 3) {
      stepHtml = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 8px; font-size: 13px; color: #166534;">
            ✅ <strong>Hierarchy Structured:</strong> Category ➔ <strong>${escapeHtml(wizardData.selectedCategory)}</strong> | Item ➔ <strong>${escapeHtml(wizardData.newItemName || wizardData.name)}</strong> | Sub-Type ➔ <strong>${escapeHtml(wizardData.subTypeName)}</strong>
          </div>

          <div style="background: var(--surface2, #f9f8f6); padding: 14px; border-radius: 10px; border: 1px solid var(--border, #e5e7eb);">
            <div style="font-size: 13.5px; font-weight: 700; margin-bottom: 6px;">Linked Store Product</div>
            <p style="font-size: 12px; color: var(--text2, #666); margin: 0 0 12px 0;">
              No store products currently linked to this sub-type. You can use existing product management tools below or complete mapping without a linked product.
            </p>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn sm secondary" id="btn-wiz-open-add-product">+ Add Product</button>
              <button type="button" class="btn sm ghost" id="btn-wiz-open-tesco-import">🛒 Import from Tesco</button>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
            <button type="button" class="btn ghost" id="btn-back-step3">← Back</button>
            <button type="button" class="btn primary" id="btn-complete-map-wiz">✨ Complete & Link Item</button>
          </div>
        </div>
      `;
    }

    modalEl.innerHTML = `
      <div class="modal-backdrop" id="map-wiz-backdrop"></div>
      <div class="modal" style="max-width: 520px; width: 92%; max-height: 90vh; overflow-y: auto; padding: 22px; background: var(--surface, #fff); border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.3); border: 1px solid var(--border, #ddd);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border, #eee); padding-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">✨</span>
            <h3 style="margin: 0; font-size: 17px; font-weight: 700; color: var(--text, #111);">New Ingredient Mapping Wizard</h3>
          </div>
          <button type="button" class="btn sm ghost" id="btn-close-map-wiz-top" style="font-size: 16px;">✕</button>
        </div>
        ${stepHtml}
      </div>
    `;

    // Bind common events
    const closeModal = () => modalEl.classList.remove('open');
    modalEl.querySelector('#map-wiz-backdrop')?.addEventListener('click', closeModal);
    modalEl.querySelector('#btn-close-map-wiz-top')?.addEventListener('click', closeModal);
    modalEl.querySelector('#btn-close-map-wiz')?.addEventListener('click', closeModal);

    if (currentStep === 1) {
      const nameInput = modalEl.querySelector('#map-wiz-name');
      if (nameInput) {
        nameInput.oninput = (e) => { wizardData.name = e.target.value; };
      }

      modalEl.querySelectorAll('input[name="wiz-entity-type"]').forEach(radio => {
        radio.onchange = (e) => {
          wizardData.entityType = e.target.value;
          renderWizard();
        };
      });

      const btnNext1 = modalEl.querySelector('#btn-next-step1');
      if (btnNext1) {
        btnNext1.onclick = () => {
          const nameVal = modalEl.querySelector('#map-wiz-name')?.value.trim();
          if (!nameVal) {
            alert('Please enter an Entity Name');
            return;
          }
          wizardData.name = toTitleCase(nameVal);
          wizardData.subTypeName = wizardData.name;
          wizardData.newItemName = wizardData.name;
          currentStep = 2;
          renderWizard();
        };
      }
    } else if (currentStep === 2) {
      modalEl.querySelector('#btn-back-step2').onclick = () => {
        currentStep = 1;
        renderWizard();
      };

      // Bind searchable item input with live autocomplete dropdown
      const itemInput = modalEl.querySelector('#map-item-search-input');
      const itemDropdown = modalEl.querySelector('#map-item-dropdown');
      if (itemInput && itemDropdown) {
        const filterItems = (query) => {
          const q = (query || '').toLowerCase().trim();
          const matches = ingredients.filter(i => (i.name || '').toLowerCase().includes(q));
          let html = `<div class="map-item-opt" data-id="" data-name="${escapeAttr(query || wizardData.name)}" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:600; color:var(--primary,#4f46e5); border-bottom:1px solid #eee;">✨ Create New Item "${escapeHtml(query || wizardData.name)}"</div>`;
          html += matches.map(i => `
            <div class="map-item-opt" data-id="${escapeAttr(i.id)}" data-name="${escapeAttr(i.name)}" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:500;">
              ${escapeHtml(i.name)} <span style="font-size:10.5px; color:var(--text2);">[${escapeHtml(i.category || 'General')}]</span>
            </div>
          `).join('');
          itemDropdown.innerHTML = html;
          itemDropdown.style.display = 'block';

          itemDropdown.querySelectorAll('.map-item-opt').forEach(opt => {
            opt.onclick = () => {
              wizardData.selectedItemId = opt.dataset.id || '';
              wizardData.newItemName = opt.dataset.name || query;
              itemInput.value = wizardData.newItemName;
              itemDropdown.style.display = 'none';
            };
          });
        };

        itemInput.onfocus = () => filterItems(itemInput.value);
        itemInput.oninput = (e) => {
          wizardData.newItemName = e.target.value;
          filterItems(e.target.value);
        };
      }

      // Bind searchable category input with live autocomplete dropdown
      const catInput = modalEl.querySelector('#map-cat-search-input');
      const catDropdown = modalEl.querySelector('#map-cat-dropdown');
      if (catInput && catDropdown) {
        const filterCats = (query) => {
          const q = (query || '').toLowerCase().trim();
          const matches = existingCategories.filter(c => c.toLowerCase().includes(q));
          let html = `<div class="map-cat-opt" data-cat="${escapeAttr(query || 'Store Cupboard')}" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:600; color:var(--primary,#4f46e5); border-bottom:1px solid #eee;">✨ New Category "${escapeHtml(query || 'Store Cupboard')}"</div>`;
          html += matches.map(c => `
            <div class="map-cat-opt" data-cat="${escapeAttr(c)}" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:500;">
              📂 ${escapeHtml(c)}
            </div>
          `).join('');
          catDropdown.innerHTML = html;
          catDropdown.style.display = 'block';

          catDropdown.querySelectorAll('.map-cat-opt').forEach(opt => {
            opt.onclick = () => {
              wizardData.selectedCategory = opt.dataset.cat || query;
              catInput.value = wizardData.selectedCategory;
              catDropdown.style.display = 'none';
            };
          });
        };

        catInput.onfocus = () => filterCats(catInput.value);
        catInput.oninput = (e) => {
          wizardData.selectedCategory = e.target.value;
          filterCats(e.target.value);
        };
      }

      const subInput = modalEl.querySelector('#map-sub-name-input');
      if (subInput) {
        subInput.oninput = (e) => { wizardData.subTypeName = e.target.value; };
      }

      const btnNext2 = modalEl.querySelector('#btn-next-step2');
      if (btnNext2) {
        btnNext2.onclick = () => {
          const finalItemName = toTitleCase(itemInput?.value?.trim() || wizardData.newItemName || wizardData.name);
          const finalCatName = toTitleCase(catInput?.value?.trim() || wizardData.selectedCategory || 'Store Cupboard');
          const finalSubName = toTitleCase(subInput?.value?.trim() || wizardData.subTypeName || wizardData.name);

          wizardData.newItemName = finalItemName;
          wizardData.selectedCategory = finalCatName;
          wizardData.subTypeName = finalSubName;

          currentStep = 3;
          renderWizard();
        };
      }
    } else if (currentStep === 3) {
      modalEl.querySelector('#btn-back-step3').onclick = () => {
        currentStep = 2;
        renderWizard();
      };

      const btnAddProd = modalEl.querySelector('#btn-wiz-open-add-product');
      if (btnAddProd) {
        btnAddProd.onclick = () => {
          if (typeof openSubtypeProductLinkerModal === 'function') {
            openSubtypeProductLinkerModal(wizardData.createdSubtypeId, wizardData.createdIngredientId);
          } else if (typeof window.openSubtypeProductLinkerModal === 'function') {
            window.openSubtypeProductLinkerModal(wizardData.createdSubtypeId, wizardData.createdIngredientId);
          } else {
            alert('Store product management tools are ready.');
          }
        };
      }

      const btnTesco = modalEl.querySelector('#btn-wiz-open-tesco-import');
      if (btnTesco) {
        btnTesco.onclick = () => {
          if (typeof openTescoImportModal === 'function') {
            openTescoImportModal(wizardData.createdSubtypeId, wizardData.createdIngredientId);
          } else if (typeof window.openTescoImportModal === 'function') {
            window.openTescoImportModal(wizardData.createdSubtypeId, wizardData.createdIngredientId);
          }
        };
      }

      const btnComplete = modalEl.querySelector('#btn-complete-map-wiz');
      if (btnComplete) {
        btnComplete.onclick = async () => {
          btnComplete.disabled = true;
          btnComplete.textContent = 'Saving...';

          try {
            const currentStoreState = getState() || {};
            const currentIngredients = [...(currentStoreState.ingredients || [])];

            let targetParent = currentIngredients.find(i => String(i.id) === String(wizardData.selectedItemId) || i.name.toLowerCase() === wizardData.newItemName.toLowerCase());

            const subtypeId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const newSubtype = {
              id: subtypeId,
              name: wizardData.subTypeName,
              defaultProductId: null,
              aliases: [wizardData.subTypeName.toLowerCase()]
            };

            if (!targetParent) {
              const parentId = `ing_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              targetParent = {
                id: parentId,
                name: wizardData.newItemName,
                category: wizardData.selectedCategory,
                cat: wizardData.selectedCategory.toLowerCase().replace(/\s+/g, '_'),
                subtypes: [newSubtype],
                aliases: [wizardData.newItemName.toLowerCase(), wizardData.subTypeName.toLowerCase()],
                updatedAt: new Date().toISOString()
              };
              currentIngredients.push(targetParent);
            } else {
              targetParent.subtypes = [...(targetParent.subtypes || []), newSubtype];
              targetParent.aliases = Array.from(new Set([...(targetParent.aliases || []), wizardData.subTypeName.toLowerCase()]));
              targetParent.updatedAt = new Date().toISOString();
            }

            setIngredients(currentIngredients);
            await saveIngredient(targetParent);

            closeModal();

            if (typeof onComplete === 'function') {
              onComplete({
                ingredientId: targetParent.id,
                subtypeId: subtypeId,
                category: wizardData.selectedCategory,
                parentName: targetParent.name,
                subtypeName: wizardData.subTypeName,
                sIdx,
                iIdx
              });
            }
          } catch (err) {
            console.error('[NewIngredientMappingWizardModal] Save failed:', err);
            alert(`Could not save item: ${err.message}`);
            btnComplete.disabled = false;
            btnComplete.textContent = '✨ Complete & Link Item';
          }
        };
      }
    }
  };

  renderWizard();
  modalEl.classList.add('open');
}

// Backwards compatibility export
export const openTaxonomyCreationModal = openNewIngredientMappingWizardModal;
