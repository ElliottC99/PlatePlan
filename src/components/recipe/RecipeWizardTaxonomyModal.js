/**
 * src/components/recipe/RecipeWizardTaxonomyModal.js (v3.28.5)
 * New Ingredient Mapping Wizard Modal component.
 * 3-step wizard for mapping raw recipe ingredients into Category -> Item -> Sub-Type hierarchy.
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { saveIngredient, saveProduct } from '../../services/HouseholdRepository.js';
import { toTitleCase } from '../../services/RecipeImporter.js';
import { openSubtypeProductLinkerModal, openTescoImportModal } from '../pantry/SubtypeProductLinkerModalUI.js';
import { openProductEditModal } from '../../views/ProductBankView.js';

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
  let showProductSearch = false;
  let productSearchQuery = '';

  let wizardData = {
    entityType: 'subtype', // 'subtype' | 'item' | 'category'
    name: cleanInitialName,
    selectedItemId: '',
    newItemName: '',
    selectedCategory: existingCategories[0] || 'Store Cupboard',
    subTypeName: cleanInitialName,
    createdIngredientId: null,
    createdSubtypeId: null,
    linkedProduct: null
  };

  let modalEl = document.getElementById('new-ingredient-mapping-wizard-modal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'new-ingredient-mapping-wizard-modal';
    modalEl.className = 'modal-wrap';
    modalEl.style.zIndex = '12000';
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
            <label style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 10px; color: var(--text);">
              Define Entity Type <span style="color:#dc2626">*</span>
            </label>

            <!-- Unified Space-Efficient Clickable Card Layout -->
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <label for="type-subtype" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1.5px solid ${wizardData.entityType === 'subtype' ? 'var(--primary, #4f46e5)' : 'var(--border, #e5e7eb)'}; border-radius: 10px; background: ${wizardData.entityType === 'subtype' ? 'rgba(79, 70, 229, 0.05)' : 'var(--surface, #fff)'}; cursor: pointer; transition: all 0.15s ease; box-shadow: ${wizardData.entityType === 'subtype' ? '0 2px 8px rgba(79, 70, 229, 0.1)' : 'none'};">
                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                  <input type="radio" id="type-subtype" name="wiz-entity-type" value="subtype" ${wizardData.entityType === 'subtype' ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary, #4f46e5); cursor: pointer; flex-shrink: 0;" />
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 13.5px; font-weight: 750; color: var(--text, #111827); line-height: 1.3;">Sub-Type <span style="font-size: 12px; font-weight: 500; color: var(--text2, #6b7280);">(Specific Variant / Brand)</span></div>
                    <div style="font-size: 11.5px; color: var(--text2, #6b7280); margin-top: 2px;">e.g. Extra Firm Tofu, Smoked Paprika, Oat Milk</div>
                  </div>
                </div>
                <span style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: ${wizardData.entityType === 'subtype' ? '#e0e7ff' : '#f3f4f6'}; color: ${wizardData.entityType === 'subtype' ? '#3730a3' : '#4b5563'}; flex-shrink: 0; margin-left: 8px;">Variant Level</span>
              </label>

              <label for="type-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1.5px solid ${wizardData.entityType === 'item' ? 'var(--primary, #4f46e5)' : 'var(--border, #e5e7eb)'}; border-radius: 10px; background: ${wizardData.entityType === 'item' ? 'rgba(79, 70, 229, 0.05)' : 'var(--surface, #fff)'}; cursor: pointer; transition: all 0.15s ease; box-shadow: ${wizardData.entityType === 'item' ? '0 2px 8px rgba(79, 70, 229, 0.1)' : 'none'};">
                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                  <input type="radio" id="type-item" name="wiz-entity-type" value="item" ${wizardData.entityType === 'item' ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary, #4f46e5); cursor: pointer; flex-shrink: 0;" />
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 13.5px; font-weight: 750; color: var(--text, #111827); line-height: 1.3;">Item <span style="font-size: 12px; font-weight: 500; color: var(--text2, #6b7280);">(Primary Food Entity)</span></div>
                    <div style="font-size: 11.5px; color: var(--text2, #6b7280); margin-top: 2px;">e.g. Tofu, Paprika, Milk</div>
                  </div>
                </div>
                <span style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: ${wizardData.entityType === 'item' ? '#e0e7ff' : '#f3f4f6'}; color: ${wizardData.entityType === 'item' ? '#3730a3' : '#4b5563'}; flex-shrink: 0; margin-left: 8px;">Primary Item</span>
              </label>

              <label for="type-category" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1.5px solid ${wizardData.entityType === 'category' ? 'var(--primary, #4f46e5)' : 'var(--border, #e5e7eb)'}; border-radius: 10px; background: ${wizardData.entityType === 'category' ? 'rgba(79, 70, 229, 0.05)' : 'var(--surface, #fff)'}; cursor: pointer; transition: all 0.15s ease; box-shadow: ${wizardData.entityType === 'category' ? '0 2px 8px rgba(79, 70, 229, 0.1)' : 'none'};">
                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                  <input type="radio" id="type-category" name="wiz-entity-type" value="category" ${wizardData.entityType === 'category' ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary, #4f46e5); cursor: pointer; flex-shrink: 0;" />
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 13.5px; font-weight: 750; color: var(--text, #111827); line-height: 1.3;">Category <span style="font-size: 12px; font-weight: 500; color: var(--text2, #6b7280);">(High-Level Group)</span></div>
                    <div style="font-size: 11.5px; color: var(--text2, #6b7280); margin-top: 2px;">e.g. Produce, Store Cupboard, Refrigerated & Dairy</div>
                  </div>
                </div>
                <span style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: ${wizardData.entityType === 'category' ? '#e0e7ff' : '#f3f4f6'}; color: ${wizardData.entityType === 'category' ? '#3730a3' : '#4b5563'}; flex-shrink: 0; margin-left: 8px;">Top Level</span>
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
          <!-- Hierarchy Summary Header -->
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 14px; border-radius: 10px; font-size: 12.5px; color: #166534; display: flex; align-items: flex-start; gap: 8px;">
            <span style="font-size: 16px; margin-top: -1px;">✅</span>
            <div style="flex: 1; min-width: 0;">
              <strong style="font-size: 13px;">Hierarchy Structured:</strong>
              <div style="font-size: 12px; color: #15803d; margin-top: 3px; line-height: 1.4;">
                Category ➔ <strong>${escapeHtml(wizardData.selectedCategory)}</strong> | Item ➔ <strong>${escapeHtml(wizardData.newItemName || wizardData.name)}</strong> | Sub-Type ➔ <strong>${escapeHtml(wizardData.subTypeName)}</strong>
              </div>
            </div>
          </div>

          <!-- Store Product Section -->
          <div style="background: var(--surface2, #f9f8f6); padding: 16px; border-radius: 12px; border: 1px solid var(--border, #e5e7eb);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="font-size: 13.5px; font-weight: 750; color: var(--text);">Linked Store Product</div>
              ${wizardData.linkedProduct ? `<span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; background: #dcfce7; color: #15803d;">Product Attached</span>` : `<span style="font-size: 11px; color: var(--text2);">Optional</span>`}
            </div>

            ${wizardData.linkedProduct ? `
              <div style="background: #fff; border: 1px solid #a7f3d0; border-radius: 8px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                  <span style="font-size: 18px;">🛒</span>
                  <div style="min-width: 0;">
                    <div style="font-size: 13px; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(wizardData.linkedProduct.name)}</div>
                    <div style="font-size: 11.5px; color: var(--text2);">${escapeHtml(wizardData.linkedProduct.brand || 'No Brand')} · £${Number(wizardData.linkedProduct.price || 0).toFixed(2)}</div>
                  </div>
                </div>
                <button type="button" class="btn sm ghost" id="btn-remove-linked-product" style="color: #dc2626; font-size: 12px; padding: 4px 8px;">✕ Remove</button>
              </div>
            ` : `
              <p style="font-size: 12px; color: var(--text2, #666); margin: 0 0 12px 0; line-height: 1.4;">
                No store product currently linked to this sub-type. You can attach a product or complete mapping without a linked product.
              </p>
            `}

            <!-- 3 Clear Action Buttons -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(125px, 1fr)); gap: 8px;">
              <button type="button" class="btn sm secondary" id="btn-wiz-open-add-product" style="display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 650; font-size: 12px; padding: 8px 10px;">
                <span>+</span> Add Product
              </button>
              <button type="button" class="btn sm ghost" id="btn-wiz-open-tesco-import" style="display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 650; font-size: 12px; padding: 8px 10px; border: 1px solid var(--border, #e5e7eb);">
                <span>🛒</span> Import Tesco
              </button>
              <button type="button" class="btn sm" id="btn-wiz-toggle-link-existing" style="display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 650; font-size: 12px; padding: 8px 10px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">
                <span>🔍</span> Link Existing
              </button>
            </div>

            <!-- Interactive Searchable Input Container for Existing Product Linker -->
            <div id="wiz-product-search-container" style="display: ${showProductSearch ? 'block' : 'none'}; margin-top: 12px; position: relative;">
              <label for="wiz-product-search-input" style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px; color: #047857;">
                🔍 Search Product to Reassign / Move
              </label>
              <input type="text" 
                     id="wiz-product-search-input" 
                     name="wiz_product_search_input"
                     value="${escapeAttr(productSearchQuery)}" 
                     placeholder="Type product name or brand..." 
                     autocomplete="off"
                     style="width: 100%; padding: 8px 12px; border: 1.5px solid #a7f3d0; border-radius: 8px; font-size: 12.5px; background: #fff; box-sizing: border-box;" />
              <div id="wiz-product-search-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; max-height: 180px; overflow-y: auto; background: #fff; border: 1px solid #a7f3d0; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 13000; margin-top: 2px;"></div>
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

      const btnRemoveLinked = modalEl.querySelector('#btn-remove-linked-product');
      if (btnRemoveLinked) {
        btnRemoveLinked.onclick = () => {
          wizardData.linkedProduct = null;
          renderWizard();
        };
      }

      // Action 1: + Add Product
      const btnAddProd = modalEl.querySelector('#btn-wiz-open-add-product');
      if (btnAddProd) {
        btnAddProd.onclick = () => {
          window.__prefilledResolveBinding = {
            ingredientId: wizardData.createdIngredientId,
            subtypeId: wizardData.createdSubtypeId,
            parentCategory: wizardData.selectedCategory,
            subtypeDraftName: wizardData.subTypeName
          };
          if (typeof openProductEditModal === 'function') {
            openProductEditModal(null);
          } else if (typeof window.openProductEditModal === 'function') {
            window.openProductEditModal(null);
          } else {
            alert('Add product editor ready.');
          }
        };
      }

      // Action 2: 🛒 Import from Tesco
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

      // Action 3: 🔍 Link Existing Product
      const btnToggleExisting = modalEl.querySelector('#btn-wiz-toggle-link-existing');
      if (btnToggleExisting) {
        btnToggleExisting.onclick = () => {
          showProductSearch = !showProductSearch;
          renderWizard();
          if (showProductSearch) {
            setTimeout(() => {
              const input = modalEl.querySelector('#wiz-product-search-input');
              if (input) input.focus();
            }, 50);
          }
        };
      }

      // Searchable Product Input Handler
      const searchInput = modalEl.querySelector('#wiz-product-search-input');
      const searchDropdown = modalEl.querySelector('#wiz-product-search-dropdown');
      if (searchInput && searchDropdown) {
        const products = getState()?.products || [];
        const filterProducts = (query) => {
          productSearchQuery = query;
          const q = (query || '').toLowerCase().trim();
          const filtered = products.filter(p => !q || (p.name || '').toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q));

          if (!filtered.length) {
            searchDropdown.innerHTML = `<div style="padding: 10px; font-size: 12px; color: var(--text2); text-align: center;">No products found matching "${escapeHtml(q)}".</div>`;
          } else {
            searchDropdown.innerHTML = filtered.slice(0, 20).map(p => `
              <div class="wiz-prod-opt" data-id="${escapeAttr(p.id)}" style="padding: 8px 10px; font-size: 12.5px; cursor: pointer; border-bottom: 1px solid #f0fdf4; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong style="color: var(--text);">${escapeHtml(p.name)}</strong>
                  <div style="font-size: 11px; color: var(--text2);">${escapeHtml(p.brand || 'No brand')} · £${Number(p.price || 0).toFixed(2)}</div>
                </div>
                <span style="font-size: 11px; font-weight: 600; color: #047857;">Link →</span>
              </div>
            `).join('');
          }
          searchDropdown.style.display = 'block';

          searchDropdown.querySelectorAll('.wiz-prod-opt').forEach(opt => {
            opt.onclick = () => {
              const p = products.find(prod => String(prod.id) === String(opt.dataset.id));
              if (p) {
                wizardData.linkedProduct = p;
                showProductSearch = false;
                productSearchQuery = '';
                renderWizard();
              }
            };
          });
        };

        searchInput.onfocus = () => filterProducts(searchInput.value);
        searchInput.oninput = (e) => filterProducts(e.target.value);
      }

      // Complete & Link Button
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
              defaultProductId: wizardData.linkedProduct ? wizardData.linkedProduct.id : null,
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

            // Reassign / Move linked existing product to this new subtype hierarchy
            if (wizardData.linkedProduct) {
              const allProducts = [...(currentStoreState.products || [])];
              const pIdx = allProducts.findIndex(p => String(p.id) === String(wizardData.linkedProduct.id));
              const updatedProduct = {
                ...wizardData.linkedProduct,
                ingredientId: targetParent.id,
                subtypeId: subtypeId,
                updatedAt: new Date().toISOString()
              };
              if (pIdx >= 0) allProducts[pIdx] = updatedProduct;
              else allProducts.push(updatedProduct);

              setProducts(allProducts);
              await saveProduct(updatedProduct);
            }

            closeModal();

            if (typeof onComplete === 'function') {
              onComplete({
                ingredientId: targetParent.id,
                subtypeId: subtypeId,
                category: wizardData.selectedCategory,
                parentName: targetParent.name,
                subtypeName: wizardData.subTypeName,
                productId: wizardData.linkedProduct ? wizardData.linkedProduct.id : null,
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
