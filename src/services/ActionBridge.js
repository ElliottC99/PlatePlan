/**
 * src/services/ActionBridge.js (v3.38.69)
 * Centralized Action Bridge & Event Dispatcher for Atomic Modular Architecture.
 * Strictly maps delegated data-action events to ES6 module handlers.
 */

import { renderSettingsView } from '../views/SettingsView.js';
import { renderScrollableSwapModal, toggleShoppingItemAcquired, toggleInlineShoppingSubst } from '../views/ShoppingView.js';
import { renderPlanner } from '../views/PlannerView.js';
import { renderRecipeVault, handleVaultSortChange } from '../views/RecipeVaultView.js';
import { openProductEditModal, saveManualIng, cancelManualIng, clearProductGroupFilter, showTescoImport } from '../views/ProductBankView.js';
import { renderDataQualityView } from '../views/DataQualityView.js';
import { moveTodayDate, resetTodayDate, toggleMealEaten } from '../views/TodayView.js';
import { showView } from '../core/AppRouter.js';
import { closeRecipePreview } from './RecipeDetailModalService.js';
import { routeRecipeAction } from './RecipeActionBridge.js';

let isBridgeInitialized = false;

/**
 * Route modular data-action values to their corresponding ES6 views or handlers.
 */
export function routeAction(actionName, target, event) {
  const ds = target.dataset || {};
  const normalizedAction = String(actionName || '').toLowerCase().trim();

  // 1. Recipe & Vault Actions (Delegated to RecipeActionBridge)
  if (routeRecipeAction(actionName, target, event, () => [])) {
    return true;
  }

  // 1b. Today View: date navigation and meal-eaten toggles
  if (normalizedAction === 'today-prev' || normalizedAction === 'today-next') {
    moveTodayDate(normalizedAction === 'today-next' ? 1 : -1);
    return true;
  }

  if (normalizedAction === 'today-reset') {
    resetTodayDate();
    return true;
  }

  if (normalizedAction === 'toggle-meal-eaten') {
    if (ds.mealType) toggleMealEaten(ds.mealType, ds.person || 'both');
    return true;
  }

  // 2. Shopping Product Substitution
  if (normalizedAction === 'swap-product' || normalizedAction === 'toggle-inline-subst' || normalizedAction === 'toggleinlineshoppingsubst' || normalizedAction.includes('toggleinlineshoppingsubst')) {
    const containerEl = target.closest('[data-item-key], [data-group-key], [data-group-id], [data-ingredient-name], .pp-shop-item, .shopping-list-row, .item-row') || target;
    const groupKey = ds.groupKey || ds.groupId || containerEl.dataset?.groupKey || containerEl.dataset?.groupId || '';
    const itemKey = ds.itemKey || containerEl.dataset?.itemKey || '';
    const instanceId = ds.instanceId || containerEl.dataset?.instanceId || null;
    if (typeof toggleInlineShoppingSubst === 'function') {
      toggleInlineShoppingSubst(itemKey, groupKey, instanceId);
    } else {
      renderScrollableSwapModal(itemKey, groupKey, null, { instanceId });
    }
    return true;
  }

  // 3. Explicit Sub-type Deletion Case
  if (normalizedAction === 'delete-subtype' || normalizedAction === 'deletesubtype' || normalizedAction.includes('deletesubtype')) {
    const subtypeId = ds.subtypeId || ds.id || target.getAttribute('data-subtype-id') || target.getAttribute('data-id') || null;
    const parentId = ds.parentId || ds.ingredientId || ds.parentIngredientId || target.getAttribute('data-parent-id') || null;
    import('../components/pantry/ReorganiseModalUI.js').then(m => m.openReorganiseModal('subtype', { id: subtypeId, parentId }));
    return true;
  }

  // 4. Ingredient & Product Bank Modals
  if (normalizedAction === 'open-ingredient-modal' || normalizedAction.includes('openingredientfamilydetailsmodal')) {
    const ingId = ds.ingredientId || ds.id || null;
    import('../components/pantry/ReorganiseModalUI.js').then(m => m.openReorganiseModal('item', { id: ingId }));
    return true;
  }

  if (normalizedAction === 'open-product-modal' || normalizedAction.includes('openproducteditmodal') || normalizedAction.includes('showadding')) {
    const prodId = ds.productId || ds.id || null;
    openProductEditModal(prodId);
    return true;
  }

  if (normalizedAction === 'save-manual-ing' || normalizedAction.includes('savemanualing')) {
    saveManualIng();
    return true;
  }

  if (normalizedAction === 'cancel-manual-ing' || normalizedAction.includes('cancelmanualing')) {
    cancelManualIng();
    return true;
  }

  // 3b. Pantry › sub-type › Link Product routes, and Cancel for the pantry dialogs on view-modal
  if (normalizedAction === 'link-existing-product' || normalizedAction === 'link-manual-product' || normalizedAction === 'link-tesco-product') {
    const subtypeId = ds.subtypeId || null;
    const parentId = ds.parentId || null;
    import('../components/pantry/SubtypeProductLinkerModalUI.js').then(m => {
      if (normalizedAction === 'link-existing-product') m.openSubtypeExistingProductPickerModal(subtypeId, parentId);
      else if (normalizedAction === 'link-tesco-product') m.openTescoImportModal(subtypeId, parentId);
      else m.openManualProductForSubtype(subtypeId, parentId);
    });
    return true;
  }

  if (normalizedAction === 'close-pantry-dialog') {
    import('../components/pantry/SubtypeProductLinkerModalUI.js').then(m => m.closePantryDialog());
    return true;
  }

  if (normalizedAction === 'tesco-import') {
    showTescoImport();
    return true;
  }

  if (normalizedAction === 'add-to-bank' || normalizedAction.includes('createingredientfamilyprompt')) {
    import('../components/pantry/AddToBankHubUI.js').then(m => m.openAddToBankModal());
    return true;
  }

  // 5. Shopping Item Acquired Checkbox
  if (normalizedAction === 'toggle-shopping-item' || normalizedAction === 'toggle-shopping-at-home' || normalizedAction === 'toggleshoppingathome' || normalizedAction.includes('toggleshoppingathome')) {
    const containerEl = target.closest('[data-item-key], .pp-shop-item, .shopping-list-row, .item-row') || target;
    const atHomeKey = ds.atHomeKey || containerEl.dataset?.atHomeKey || ds.itemKey || containerEl.dataset?.itemKey || '';
    toggleShoppingItemAcquired(atHomeKey);
    return true;
  }

  // 6. View Switcher Navigation & Mobile Drawer Routing
  if (normalizedAction === 'navigate-view' || normalizedAction === 'show-view' || normalizedAction.includes('mobilemoreview') || normalizedAction.includes('showview')) {
    if (normalizedAction.includes('clearproductgroupfilter')) {
      clearProductGroupFilter();
    }
    const match = actionName.match(/(?:mobileMoreView|showView)\(['"]?([^'"]+)['"]?\)/i);
    const viewName = ds.view || (match ? match[1] : null);
    if (viewName) {
      document.getElementById('mobile-more-wrap')?.classList.remove('open');
      showView(viewName);
      if (viewName === 'vault') setTimeout(renderRecipeVault, 30);
      else if (viewName === 'planner') setTimeout(renderPlanner, 30);
      else if (viewName === 'prefs' || viewName === 'settings') setTimeout(renderSettingsView, 30);
      else if (viewName === 'data' || viewName === 'quality') setTimeout(renderDataQualityView, 30);
    }
    return true;
  }

  // 7. Modal Close Actions
  if (normalizedAction === 'close-modal' || normalizedAction.includes('closemodal') || normalizedAction.includes('closerecipepreview')) {
    const modalWrap = target.closest('.modal-wrap');
    if (modalWrap) {
      modalWrap.classList.remove('open');
    }
    closeRecipePreview();
    return true;
  }

  // 8. Mobile Menu & Toolbar Actions
  if (normalizedAction === 'open-category-manager' || normalizedAction.includes('opencategorymanagermodal')) {
    import('../components/pantry/ReorganiseModalUI.js').then(m => m.openReorganiseModal('category'));
    return true;
  }

  if (normalizedAction === 'open-mobile-more' || normalizedAction.includes('openmobilemore')) {
    document.getElementById('mobile-more-wrap')?.classList.add('open');
    return true;
  }

  if (normalizedAction === 'close-mobile-more' || normalizedAction.includes('closemobilemore')) {
    document.getElementById('mobile-more-wrap')?.classList.remove('open');
    if (normalizedAction.includes('opencreateactionsheet')) {
      import('../components/navigation/ActionSheetUI.js').then(m => m.openCreateActionSheet?.());
    }
    return true;
  }

  if (normalizedAction === 'vault-sort' || normalizedAction.includes('vaultsort') || normalizedAction.includes('handlevaultsortchange')) {
    const val = target.value || ds.sort || '';
    handleVaultSortChange(val);
    return true;
  }

  return false;
}

/**
 * Install centralized delegated action listener for data-action attributes.
 */
export function setupActionBridge() {
  if (typeof window === 'undefined') return;
  if (isBridgeInitialized) {
    console.log('[ActionBridge] Action bridge already registered. Skipping redundant attachment.');
    return;
  }

  isBridgeInitialized = true;

  // Delegated capture listener on document for data-action click
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const actionString = target.getAttribute('data-action') || target.dataset.action || '';
    if (!actionString) return;

    const actionEvent = new CustomEvent('plateplan-action', {
      detail: {
        action: actionString,
        target,
        id: target.getAttribute('data-id') || target.getAttribute('data-recipe-id') || target.getAttribute('data-ingredient-id')
      }
    });
    document.dispatchEvent(actionEvent);

    const handled = routeAction(actionString, target, event);
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }, true);
}
