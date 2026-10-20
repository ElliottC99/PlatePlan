/**
 * src/services/RecipeWizardEventService.js (v3.38.15)
 * Event controller for the Recipe Wizard Taxonomy Modal.
 */

import { getState, setIngredients, setProducts, setCategories } from '../store/store.js';
import { saveIngredient } from '../services/IngredientRepository.js';
import { saveProduct } from '../services/ProductRepository.js';
import { toTitleCase } from '../services/RecipeImporter.js';
import { openTescoImportModal } from '../components/pantry/SubtypeProductLinkerModalUI.js';
import { openProductEditModal } from '../../views/ProductBankView.js';
import { escapeHtml, escapeAttr } from '../utils/stringUtils.js';
import { renderStep2SubtypeFields } from './RecipeWizardStep2RenderService.js';
import { renderStep2ItemCategorySection } from './RecipeWizardStep2FieldsRenderService.js';

export function bindWizardEvents({
  modalEl,
  wizardData,
  currentStep,
  renderWizard,
  closeModal,
  existingCategories,
  existingSubtypes,
  ingredients,
  defaultCat,
  syncTierStateFromStep1,
  onComplete,
  sIdx,
  iIdx,
  showProductSearch,
  productSearchQuery
}) {
  modalEl.querySelector('#map-wiz-backdrop')?.addEventListener('click', closeModal);
  modalEl.querySelector('#btn-close-map-wiz-top')?.addEventListener('click', closeModal);
  modalEl.querySelector('#btn-close-map-wiz')?.addEventListener('click', closeModal);

  const bindCategoryAutocomplete = () => {
    const catInput = modalEl.querySelector('#map-cat-search-input');
    const catDropdown = modalEl.querySelector('#map-cat-dropdown');
    if (!catInput || !catDropdown) return;

    const filterCats = (query) => {
      const q = (query || '').toLowerCase().trim();
      const matches = existingCategories.filter(c => c.toLowerCase().includes(q));
      let html = `<div class="map-cat-opt" data-cat="${escapeAttr(query || defaultCat)}" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:600; color:var(--primary,#4f46e5); border-bottom:1px solid #eee;">✨ New Category "${escapeHtml(query || defaultCat)}"</div>`;
      html += matches.map(c => `
        <div class="map-cat-opt" data-cat="${escapeAttr(c)}" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:500;">
          📂 ${escapeHtml(c)}
        </div>
      `).join('');
      catDropdown.innerHTML = html;
      catDropdown.style.display = 'block';

      catDropdown.querySelectorAll('.map-cat-opt').forEach(opt => {
        opt.onclick = () => {
          const chosenCat = toTitleCase(opt.dataset.cat || query || defaultCat);
          wizardData.selectedCategory = chosenCat;
          wizardData.category = chosenCat;
          catInput.value = chosenCat;
          catDropdown.style.display = 'none';
        };
      });
    };

    catInput.onfocus = () => filterCats(catInput.value);
    catInput.oninput = (e) => {
      wizardData.selectedCategory = e.target.value;
      wizardData.category = e.target.value;
      filterCats(e.target.value);
    };
  };

  if (currentStep.get() === 1) {
    const nameInput = modalEl.querySelector('#map-wiz-name');
    if (nameInput) {
      nameInput.oninput = (e) => { wizardData.name = e.target.value; };
    }

    modalEl.querySelectorAll('input[name="wiz-entity-type"]').forEach(radio => {
      radio.onchange = (e) => {
        const currentNameVal = modalEl.querySelector('#map-wiz-name')?.value?.trim() || wizardData.name;
        syncTierStateFromStep1(currentNameVal, e.target.value);
        renderWizard();
      };
    });

    const btnNext1 = modalEl.querySelector('#btn-next-step1');
    if (btnNext1) {
      btnNext1.onclick = () => {
        const nameVal = modalEl.querySelector('#map-wiz-name')?.value.trim();
        if (!nameVal) {
          if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
            window.showPlatePlanToast('Please enter an Entity Name', 'warning');
          }
          return;
        }
        syncTierStateFromStep1(nameVal, wizardData.entityType);
        currentStep.set(2);
        renderWizard();
      };
    }
  } else if (currentStep.get() === 2) {
    modalEl.querySelector('#btn-back-step2').onclick = () => {
      currentStep.set(1);
      renderWizard();
    };

    const itemInput = modalEl.querySelector('#map-item-search-input');
    const itemDropdown = modalEl.querySelector('#map-item-dropdown');
    if (itemInput && itemDropdown) {
      const filterItems = (query) => {
        const q = (query || '').toLowerCase().trim();
        const matches = ingredients.filter(i => (i.name || '').toLowerCase().includes(q));
        let html = `<div class="map-item-opt" data-id="" data-name="${escapeAttr(query || wizardData.name)}" data-cat="" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:600; color:var(--primary,#4f46e5); border-bottom:1px solid #eee;">✨ Create New Item "${escapeHtml(query || wizardData.name)}"</div>`;
        html += matches.map(i => `
          <div class="map-item-opt" data-id="${escapeAttr(i.id)}" data-name="${escapeAttr(i.name)}" data-cat="${escapeAttr(i.category || defaultCat)}" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:500;">
            ${escapeHtml(i.name)} <span style="font-size:10.5px; color:var(--text2);">[${escapeHtml(i.category || defaultCat)}]</span>
          </div>
        `).join('');
        itemDropdown.innerHTML = html;
        itemDropdown.style.display = 'block';

        itemDropdown.querySelectorAll('.map-item-opt').forEach(opt => {
          opt.onclick = () => {
            const selectedId = opt.dataset.id || '';
            const selectedName = toTitleCase(opt.dataset.name || query || wizardData.name);
            wizardData.selectedItemId = selectedId;
            wizardData.newItemName = selectedName;
            wizardData.item = selectedName;
            itemInput.value = selectedName;
            itemDropdown.style.display = 'none';

            if (wizardData.entityType === 'subtype') {
              if (selectedId) {
                const parentIng = ingredients.find(i => String(i.id) === String(selectedId));
                const lockedCat = parentIng?.category || opt.dataset.cat || defaultCat;
                wizardData.isExistingParentItem = true;
                wizardData.selectedCategory = lockedCat;
                wizardData.category = lockedCat;
              } else {
                wizardData.isExistingParentItem = false;
              }
              renderWizard();
            }
          };
        });
      };

      itemInput.onfocus = () => filterItems(itemInput.value);
      itemInput.oninput = (e) => {
        const val = e.target.value;
        wizardData.newItemName = val;
        wizardData.item = val;
        if (wizardData.entityType === 'subtype') {
          const exactMatch = ingredients.find(i => (i.name || '').toLowerCase() === val.trim().toLowerCase());
          const wasExisting = wizardData.isExistingParentItem;
          if (exactMatch) {
            wizardData.selectedItemId = exactMatch.id;
            wizardData.isExistingParentItem = true;
            wizardData.selectedCategory = exactMatch.category || defaultCat;
            wizardData.category = wizardData.selectedCategory;
          } else {
            wizardData.selectedItemId = '';
            wizardData.isExistingParentItem = false;
          }
          if (wasExisting !== wizardData.isExistingParentItem) {
            const catSection = modalEl.querySelector('#map-subtype-cat-section');
            if (catSection) {
              catSection.innerHTML = renderStep2SubtypeFields(wizardData).split('<div id="map-subtype-cat-section">')[1].replace(/<\/div>\s*$/, '');
              bindCategoryAutocomplete();
            }
          }
        }
        filterItems(val);
      };
    }

    bindCategoryAutocomplete();

    const subInput = modalEl.querySelector('#map-sub-name-input');
    const subDropdown = modalEl.querySelector('#map-sub-dropdown');
    if (subInput) {
      if (wizardData.entityType === 'item' && subDropdown) {
        const filterSubtypes = (query) => {
          const q = (query || '').toLowerCase().trim();
          const matches = existingSubtypes.filter(s =>
            (s.name || '').toLowerCase().includes(q) ||
            (s.parentItemName || '').toLowerCase().includes(q)
          );
          const fallbackName = query || wizardData.item || wizardData.name;
          let html = `<div class="map-sub-opt" data-id="" data-name="${escapeAttr(fallbackName)}" data-cat="" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:600; color:var(--primary,#4f46e5); border-bottom:1px solid #eee;">✨ Create New Sub-Type "${escapeHtml(fallbackName)}"</div>`;
          html += matches.map(s => `
            <div class="map-sub-opt" data-id="${escapeAttr(s.id)}" data-name="${escapeAttr(s.name)}" data-cat="${escapeAttr(s.category || defaultCat)}" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:500;">
              🏷️ ${escapeHtml(s.name)} <span style="font-size:10.5px; color:var(--text2);">(${escapeHtml(s.parentItemName)} · [${escapeHtml(s.category || defaultCat)}])</span>
            </div>
          `).join('');
          subDropdown.innerHTML = html;
          subDropdown.style.display = 'block';

          subDropdown.querySelectorAll('.map-sub-opt').forEach(opt => {
            opt.onclick = () => {
              const selectedId = opt.dataset.id || '';
              const selectedName = toTitleCase(opt.dataset.name || fallbackName);
              wizardData.selectedSubtypeId = selectedId;
              wizardData.subTypeName = selectedName;
              wizardData.subType = selectedName;
              subInput.value = selectedName;
              subDropdown.style.display = 'none';

              if (selectedId) {
                const matchedSub = existingSubtypes.find(s => String(s.id) === String(selectedId));
                const lockedCat = matchedSub?.category || opt.dataset.cat || defaultCat;
                wizardData.isExistingChildSubtype = true;
                wizardData.selectedCategory = lockedCat;
                wizardData.category = lockedCat;
              } else {
                wizardData.isExistingChildSubtype = false;
              }
              renderWizard();
            };
          });
        };

        subInput.onfocus = () => filterSubtypes(subInput.value);
        subInput.oninput = (e) => {
          const val = e.target.value;
          wizardData.subTypeName = val;
          wizardData.subType = val;

          const exactSub = existingSubtypes.find(s => (s.name || '').toLowerCase() === val.trim().toLowerCase());
          const wasExistingSub = wizardData.isExistingChildSubtype;
          const prevCat = wizardData.selectedCategory;
          if (exactSub) {
            wizardData.selectedSubtypeId = exactSub.id;
            wizardData.isExistingChildSubtype = true;
            wizardData.selectedCategory = exactSub.category || defaultCat;
            wizardData.category = wizardData.selectedCategory;
          } else {
            wizardData.selectedSubtypeId = '';
            wizardData.isExistingChildSubtype = false;
          }
          if (wasExistingSub !== wizardData.isExistingChildSubtype || (wizardData.isExistingChildSubtype && prevCat !== wizardData.selectedCategory)) {
            const catSection = modalEl.querySelector('#map-item-cat-section');
            if (catSection) {
              catSection.innerHTML = renderStep2ItemCategorySection(wizardData);
              bindCategoryAutocomplete();
            }
          }
          filterSubtypes(val);
        };
      } else {
        subInput.oninput = (e) => {
          wizardData.subTypeName = e.target.value;
          wizardData.subType = e.target.value;
        };
      }
    }

    const btnNext2 = modalEl.querySelector('#btn-next-step2');
    if (btnNext2) {
      btnNext2.onclick = () => {
        const catInput = modalEl.querySelector('#map-cat-search-input');
        let finalCatName = wizardData.selectedCategory || wizardData.category || defaultCat;
        let finalItemName = wizardData.newItemName || wizardData.item || wizardData.name;
        let finalSubName = wizardData.subTypeName || wizardData.subType || wizardData.name;

        if (wizardData.entityType === 'subtype') {
          finalSubName = toTitleCase(wizardData.subTypeName || wizardData.name);
          finalItemName = toTitleCase(itemInput?.value?.trim() || wizardData.newItemName || wizardData.name);
          if (wizardData.isExistingParentItem && wizardData.selectedItemId) {
            const parentIng = ingredients.find(i => String(i.id) === String(wizardData.selectedItemId));
            finalCatName = toTitleCase(parentIng?.category || wizardData.selectedCategory || defaultCat);
          } else {
            finalCatName = toTitleCase(catInput?.value?.trim() || wizardData.selectedCategory || defaultCat);
          }
        } else if (wizardData.entityType === 'item') {
          finalItemName = toTitleCase(wizardData.newItemName || wizardData.name);
          finalSubName = toTitleCase(subInput?.value?.trim() || wizardData.subTypeName || finalItemName);
          if (wizardData.isExistingChildSubtype && wizardData.selectedSubtypeId) {
            const matchedSub = existingSubtypes.find(s => String(s.id) === String(wizardData.selectedSubtypeId));
            finalCatName = toTitleCase(matchedSub?.category || wizardData.selectedCategory || defaultCat);
          } else {
            finalCatName = toTitleCase(catInput?.value?.trim() || wizardData.selectedCategory || defaultCat);
          }
        } else if (wizardData.entityType === 'category') {
          finalCatName = toTitleCase(wizardData.selectedCategory || wizardData.category || wizardData.name);
          finalItemName = toTitleCase(itemInput?.value?.trim() || wizardData.newItemName || finalCatName);
          finalSubName = toTitleCase(subInput?.value?.trim() || wizardData.subTypeName || finalCatName);
        }

        wizardData.category = finalCatName;
        wizardData.selectedCategory = finalCatName;
        wizardData.item = finalItemName;
        wizardData.newItemName = finalItemName;
        wizardData.subType = finalSubName;
        wizardData.subTypeName = finalSubName;

        currentStep.set(3);
        renderWizard();
      };
    }
  } else if (currentStep.get() === 3) {
    modalEl.querySelector('#btn-back-step3').onclick = () => {
      currentStep.set(2);
      renderWizard();
    };

    const btnRemoveLinked = modalEl.querySelector('#btn-remove-linked-product');
    if (btnRemoveLinked) {
      btnRemoveLinked.onclick = () => {
        wizardData.linkedProduct = null;
        renderWizard();
      };
    }

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
        }
        const manualPanel = document.getElementById('manual-ing-panel');
        if (manualPanel) {
          manualPanel.style.setProperty('z-index', '25005', 'important');
        }
      };
    }

    const btnTesco = modalEl.querySelector('#btn-wiz-open-tesco-import');
    if (btnTesco) {
      btnTesco.onclick = () => {
        window.__draftSubtypePayload = {
          name: wizardData.subTypeName,
          parentCategory: wizardData.selectedCategory
        };
        if (typeof openTescoImportModal === 'function') {
          openTescoImportModal(wizardData.createdSubtypeId, wizardData.createdIngredientId);
        } else if (typeof window.openTescoImportModal === 'function') {
          window.openTescoImportModal(wizardData.createdSubtypeId, wizardData.createdIngredientId);
        }
        const viewWrap = document.getElementById('view-modal-wrap');
        if (viewWrap) {
          viewWrap.style.setProperty('z-index', '25005', 'important');
        }
        const tescoWrap = document.getElementById('tesco-modal-wrap');
        if (tescoWrap) {
          tescoWrap.style.setProperty('z-index', '25005', 'important');
        }
      };
    }

    const btnToggleExisting = modalEl.querySelector('#btn-wiz-toggle-link-existing');
    if (btnToggleExisting) {
      btnToggleExisting.onclick = () => {
        showProductSearch.set(!showProductSearch.get());
        renderWizard();
        if (showProductSearch.get()) {
          setTimeout(() => {
            const input = modalEl.querySelector('#wiz-product-search-input');
            if (input) input.focus();
          }, 50);
        }
      };
    }

    const searchInput = modalEl.querySelector('#wiz-product-search-input');
    const searchDropdown = modalEl.querySelector('#wiz-product-search-dropdown');
    if (searchInput && searchDropdown) {
      const products = getState()?.products || [];
      const filterProducts = (query) => {
        productSearchQuery.set(query);
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
              showProductSearch.set(false);
              productSearchQuery.set('');
              renderWizard();
            }
          };
        });
      };

      searchInput.onfocus = () => filterProducts(searchInput.value);
      searchInput.oninput = (e) => filterProducts(e.target.value);
    }

    const btnComplete = modalEl.querySelector('#btn-complete-map-wiz');
    if (btnComplete) {
      btnComplete.onclick = async () => {
        btnComplete.disabled = true;
        btnComplete.textContent = 'Saving...';

        try {
          const currentStoreState = getState() || {};
          const currentIngredients = [...(currentStoreState.ingredients || [])];
          const currentCategories = Array.isArray(currentStoreState.categories) ? [...currentStoreState.categories] : [];

          if (wizardData.selectedCategory && !currentCategories.some(c => String(c).toLowerCase() === wizardData.selectedCategory.toLowerCase())) {
            currentCategories.push(wizardData.selectedCategory);
            if (typeof setCategories === 'function') {
              setCategories(currentCategories);
            }
          }

          let targetParent = currentIngredients.find(i => String(i.id) === String(wizardData.selectedItemId) || (i.name || '').toLowerCase() === wizardData.newItemName.toLowerCase());

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
              aliases: Array.from(new Set([wizardData.newItemName.toLowerCase(), wizardData.subTypeName.toLowerCase()])),
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
          if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
            window.showPlatePlanToast(`Could not save item: ${err.message}`, 'error');
          }
          btnComplete.disabled = false;
          btnComplete.textContent = '✨ Complete & Link Item';
        }
      };
    }
  }
}
