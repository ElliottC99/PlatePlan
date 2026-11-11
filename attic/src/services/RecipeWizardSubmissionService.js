/**
 * src/services/RecipeWizardSubmissionService.js (v3.38.16)
 * Handles form submission, payload validation, and database persistence for the Recipe Wizard.
 */

import { getState, setIngredients, setProducts, setCategories } from '../store/store.js';
import { saveRootItem as saveIngredient } from '../services/RootItemRepository.js';
import { saveProduct } from '../services/ProductRepository.js';

export async function handleWizardSubmission({
  modalEl,
  wizardData,
  closeModal,
  onComplete,
  sIdx,
  iIdx
}) {
  const btnComplete = modalEl.querySelector('#btn-complete-map-wiz');
  if (!btnComplete) return;

  btnComplete.disabled = true;
  btnComplete.textContent = 'Saving...';

  try {
    const currentStoreState = getState();
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
}
