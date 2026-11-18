/**
 * src/services/ActionBridge.js (v3.38.69)
 * Centralized Action Bridge & Event Dispatcher for Atomic Modular Architecture.
 * Strictly maps delegated data-action events to ES6 module handlers.
 */

import { renderSettingsView } from '../views/SettingsView.js';
import { renderScrollableSwapModal, toggleShoppingItemAcquired, toggleInlineShoppingSubst } from '../views/ShoppingView.js';
import { renderPlanner } from '../views/PlannerView.js';
import { renderRecipeVault, handleVaultSortChange } from '../views/RecipeVaultView.js';
import { openProductEditModal, saveManualIng, cancelManualIng, clearProductGroupFilter, showTescoImport, toggleTescoUpdate, applyTescoUpdate } from '../views/ProductBankView.js';
import { renderDataQualityView } from '../views/DataQualityView.js';
import { moveTodayDate, resetTodayDate, toggleMealEaten, openTodayRearrangeModal, closeTodaySwapModal, executeTodaySlotSwap } from '../views/TodayView.js';
import { showView } from '../core/AppRouter.js';
import { closeRecipePreview } from './RecipeDetailModalService.js';
import { routeRecipeAction } from './RecipeActionBridge.js';
import { scrollToTop } from '../components/shell/ScrollToTopButton.js';
import { clearSkeletonGrid } from '../components/planner/PlannerSkeletonGridUI.js';

let isBridgeInitialized = false;

/**
 * Parse positional arguments from a function-call style data-action string,
 * e.g. "toggleRecipeFavourite('rec_1', event, 'enhanced')" -> ['rec_1', 'event', 'enhanced'].
 */
function parseArgsString(actionStr) {
  const str = String(actionStr || '');
  const openIdx = str.indexOf('(');
  const closeIdx = str.lastIndexOf(')');
  if (openIdx === -1 || closeIdx <= openIdx) return [];
  const inner = str.slice(openIdx + 1, closeIdx).trim();
  if (!inner) return [];
  return inner.split(',').map(part => {
    const trimmed = part.trim();
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  });
}

/**
 * Route modular data-action values to their corresponding ES6 views or handlers.
 */
export function routeAction(actionName, target, event) {
  const ds = target.dataset || {};
  const normalizedAction = String(actionName || '').toLowerCase().trim();

  // 1. Recipe & Vault Actions (Delegated to RecipeActionBridge)
  if (routeRecipeAction(actionName, target, event, parseArgsString)) {
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

  if (normalizedAction === 'open-today-rearrange-modal') {
    const dayKey = ds.dayKey || target.getAttribute('data-day-key');
    const mealType = ds.mealType || target.getAttribute('data-meal-type') || 'dinner';
    openTodayRearrangeModal(dayKey, mealType);
    return true;
  }

  if (normalizedAction === 'close-today-swap-modal' || normalizedAction.includes('closetodayswapmodal')) {
    if (normalizedAction.includes('event.target===this') && event && event.target !== target) {
      return false;
    }
    closeTodaySwapModal();
    return true;
  }

  if (normalizedAction === 'execute-today-slot-swap') {
    const srcDay = ds.sourceDay || target.getAttribute('data-source-day');
    const tgtDay = ds.targetDay || target.getAttribute('data-target-day');
    const mealType = ds.mealType || target.getAttribute('data-meal-type') || 'dinner';
    executeTodaySlotSwap(srcDay, tgtDay, mealType);
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

  if (normalizedAction === 'tesco-update') {
    toggleTescoUpdate();
    return true;
  }

  if (normalizedAction === 'tesco-update-apply') {
    applyTescoUpdate();
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

  // 4b. Meal Plan Library Actions
  if (normalizedAction === 'restore-saved-plan') {
    const planId = ds.planId || target.getAttribute('data-plan-id');
    import('../views/PlannerView.js').then(m => m.restoreSavedPlan(planId));
    return true;
  }

  if (normalizedAction === 'delete-saved-plan') {
    const planId = ds.planId || target.getAttribute('data-plan-id');
    import('../views/PlannerView.js').then(m => m.deleteSavedPlan(planId));
    return true;
  }

  if (normalizedAction === 'open-saved-plan-recipe-cards') {
    const planId = ds.planId || target.getAttribute('data-plan-id') || (ds.index !== undefined ? ds.index : null);
    import('../views/PlannerView.js').then(m => m.openSavedPlanRecipeCards(planId));
    return true;
  }

  if (normalizedAction === 'open-active-plan-recipe-cards') {
    import('../views/PlannerView.js').then(m => m.openActivePlanRecipeCards());
    return true;
  }

  if (normalizedAction === 'close-plan-recipe-cards') {
    const modal = document.getElementById('plan-recipe-cards-modal-wrap');
    if (modal) modal.remove();
    return true;
  }

  if (normalizedAction === 'open-planner-view') {
    showView('planner');
    return true;
  }

  if (normalizedAction === 'clear-skeleton-grid') {
    clearSkeletonGrid();
    return true;
  }

  if (normalizedAction === 'opensavemealplanmodal()' || normalizedAction === 'open-save-meal-plan-modal' || normalizedAction.includes('opensavemealplanmodal')) {
    import('../views/PlannerView.js').then(m => m.openSaveMealPlanModal());
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
    if (normalizedAction.includes('clearproductgroupfilter') || ds.view === 'bank') {
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
  if (normalizedAction === 'manage-categories' || normalizedAction === 'open-category-manager' || normalizedAction.includes('opencategorymanagermodal') || normalizedAction.includes('managecategories')) {
    import('../components/pantry/CategoryManagerModalUI.js').then(m => m.openCategoryManagerModal());
    return true;
  }

  if (normalizedAction === 'open-mobile-more' || normalizedAction.includes('openmobilemore')) {
    document.getElementById('mobile-more-wrap')?.classList.add('open');
    return true;
  }

  if (normalizedAction === 'close-mobile-more' || normalizedAction.includes('closemobilemore')) {
    if (normalizedAction.includes('event.target===this') && event && event.target !== target) {
      return false;
    }
    document.getElementById('mobile-more-wrap')?.classList.remove('open');
    if (normalizedAction.includes('opencreateactionsheet')) {
      import('../components/navigation/ActionSheetUI.js').then(m => m.openCreateActionSheet?.());
    }
    if (normalizedAction.includes('syncnow') && typeof window.syncNow === 'function') {
      window.syncNow();
    }
    if (normalizedAction.includes('logout') && typeof window.logout === 'function') {
      window.logout();
    }
    return true;
  }

  if (normalizedAction === 'close-mobile-action-sheet' || normalizedAction.includes('closemobileactionsheet')) {
    if (normalizedAction.includes('event.target===this') && event && event.target !== target) {
      return false;
    }
    document.getElementById('mobile-action-sheet-wrap')?.classList.remove('open');
    document.getElementById('pp-mobile-action-sheet')?.remove();
    document.getElementById('pp-action-sheet-modal')?.remove();
    return true;
  }

  if (normalizedAction === 'openplateplansyncpanel()' || normalizedAction === 'open-sync-panel' || normalizedAction.includes('openplateplansyncpanel')) {
    if (typeof window.openPlatePlanSyncPanel === 'function') window.openPlatePlanSyncPanel();
    return true;
  }

  if (normalizedAction === 'openplateplanlogin()' || normalizedAction === 'window.openplateplanlogin()' || normalizedAction.includes('openplateplanlogin')) {
    if (typeof window.openPlatePlanLogin === 'function') window.openPlatePlanLogin();
    return true;
  }

  if (normalizedAction === 'sync-now' || normalizedAction === 'refresh-data' || normalizedAction === 'window.syncnow()' || normalizedAction.includes('syncnow')) {
    if (typeof window.syncNow === 'function') window.syncNow();
    return true;
  }

  if (normalizedAction === 'logout' || normalizedAction === 'window.logout()' || normalizedAction.includes('logout')) {
    if (typeof window.logout === 'function') window.logout();
    return true;
  }

  if (normalizedAction === 'back-to-plan') {
    if (typeof window.setPlannerWizardStep === 'function') window.setPlannerWizardStep(2);
    return true;
  }

  if (normalizedAction === 'copy-list') {
    import('../components/shopping/ShoppingBatchToolbar.js').then(m => m.exportShoppingListToClipboard());
    return true;
  }

  if (normalizedAction === 'vault-sort' || normalizedAction.includes('vaultsort') || normalizedAction.includes('handlevaultsortchange')) {
    const val = target.value || ds.sort || '';
    handleVaultSortChange(val);
    return true;
  }

  if (normalizedAction === 'scroll-to-top') {
    scrollToTop();
    return true;
  }

  if (normalizedAction === 'open-create-action-sheet') {
    import('../components/navigation/ActionSheetUI.js').then(m => m.openCreateActionSheet?.());
    return true;
  }

  if (normalizedAction === 'toggle-item-breakdown') {
    window.toggleItemBreakdown?.(ds.itemKey || '');
    return true;
  }

  if (normalizedAction === 'select-shopping-product-override') {
    window.selectShoppingProductOverride?.(ds.groupId || '', ds.productId || '');
    return true;
  }

  if (normalizedAction === 'manual-recalibrate-defaults') {
    window.handleManualRecalibrateDefaults?.();
    return true;
  }

  if (normalizedAction === 'manual-recalibrate-recipe-macros') {
    window.handleManualRecalibrateRecipeMacros?.();
    return true;
  }

  if (normalizedAction === 'add-exclusion') {
    window.handleAddExclusionFromInput?.();
    return true;
  }

  if (normalizedAction === 'remove-exclusion') {
    window.handleRemoveExclusion?.(Number(ds.index));
    return true;
  }

  if (normalizedAction === 'generate-invite-link') {
    window.generateHouseholdInviteLink?.();
    return true;
  }

  if (normalizedAction === 'trigger-csv-export') {
    window.triggerCsvExport?.();
    return true;
  }

  if (normalizedAction === 'open-print-prep-label-modal') {
    window.openPrintPrepLabelModal?.(Number(ds.index));
    return true;
  }

  if (normalizedAction === 'adjust-prep-containers') {
    window.adjustPrepContainers?.(Number(ds.index));
    return true;
  }

  if (normalizedAction === 'start-prep-timer') {
    window.startPrepTimer?.(Number(ds.timer), ds.stepLabel || '');
    return true;
  }

  if (normalizedAction === 'toggle-prep-step-complete') {
    window.togglePrepStepComplete?.(Number(ds.index));
    return true;
  }

  if (normalizedAction === 'mark-all-prep-steps-complete') {
    window.markAllPrepStepsComplete?.();
    return true;
  }

  if (normalizedAction === 'print-meal-prep-guide') {
    window.printMealPrepGuide?.();
    return true;
  }

  if (normalizedAction === 'set-step' && ds.step) {
    window.setPlannerWizardStep?.(Number(ds.step));
    return true;
  }

  if (normalizedAction === 'commit-plan') {
    window.commitPlannerWizardPlan?.();
    return true;
  }

  if (normalizedAction === 'reset-planner-start-fresh') {
    window.resetPlannerStartFresh?.();
    return true;
  }

  if (normalizedAction === 'reload-plan') {
    window.renderPlan?.();
    return true;
  }

  if (normalizedAction === 'open-apply-plan-from-library') {
    window.openApplyPlanFromLibraryModal?.();
    return true;
  }

  if (normalizedAction === 'close-searchable-recipe-swap-modal') {
    (window.PlannerMealSlot?.closeSearchableRecipeSwapModal || window.closeSearchableRecipeSwapModal)?.();
    return true;
  }

  if (normalizedAction === 'select-and-swap-recipe') {
    (window.PlannerMealSlot?.selectAndSwapRecipe || window.selectAndSwapRecipe)?.(ds.recipeId || '', ds.variant || 'original');
    return true;
  }

  if (normalizedAction === 'open-slot-configurator') {
    window.openSlotConfigurator?.(Number(ds.day), ds.meal || 'dinner');
    return true;
  }

  if (normalizedAction === 'close-slot-configurator') {
    window.closeSlotConfigurator?.();
    return true;
  }

  if (normalizedAction === 'set-slot-configured-status') {
    window.setSlotConfiguredStatus?.(Number(ds.day), ds.meal || 'dinner', ds.status || 'unassigned', ds.recipeId || null);
    return true;
  }

  if (normalizedAction === 'set-split-person-slot-status') {
    window.setSplitPersonSlotStatus?.(Number(ds.day), ds.meal || 'dinner', ds.person || 'elliott', ds.status || 'unassigned', ds.recipeId || null);
    return true;
  }

  if (normalizedAction === 'toggle-slot-configurator-mode') {
    window.toggleSlotConfiguratorMode?.(ds.split === 'true');
    return true;
  }

  if (normalizedAction === 'close-swap-meal-modal') {
    window.closeSwapMealModal?.();
    return true;
  }

  if (normalizedAction === 'execute-swap-slot-and-close') {
    window.executeSwapSlotAndClose?.(Number(ds.day), ds.slot || '', ds.value ?? '');
    return true;
  }

  if (normalizedAction === 'set-swap-modal-filter') {
    window.setSwapModalFilter?.(ds.filter || 'all');
    return true;
  }

  if (normalizedAction === 'quick-randomize-swap') {
    window.quickRandomizeSwap?.(Number(ds.day), ds.slot || '');
    return true;
  }

  if (normalizedAction === 'confirm-swap-meal-modal') {
    window.confirmSwapMealModal?.();
    return true;
  }

  if (normalizedAction === 'select-swap-modal-recipe') {
    const val = ds.value || target.closest('[data-value]')?.dataset?.value || '';
    window.selectSwapModalRecipe?.(val);
    return true;
  }

  if (normalizedAction === 'toggle-swap-candidate-favourite') {
    const idAttr = ds.recipeId || '';
    const varAttr = ds.variant || 'original';
    window.toggleRecipeFavourite?.(idAttr, event, varAttr);
    if (typeof window.currentSwapModalContext !== 'undefined' && window.currentSwapModalContext) {
      (window.currentSwapModalContext.items || []).forEach(it => {
        if (it.id === idAttr) {
          it.isFavourite = !it.isFavourite;
          it.isFavorite = it.isFavourite;
        }
      });
      window.renderSwapModalOptionsList?.();
    }
    return true;
  }

  if (normalizedAction === 'toggle-create-ingredient-box') {
    const openArg = ds.open === 'false' ? false : (ds.open === 'true' ? true : undefined);
    window.toggleCreateIngredientBox?.(openArg);
    return true;
  }

  if (normalizedAction === 'submit-create-new-ingredient-from-reallocate') {
    window.submitCreateNewIngredientFromReallocate?.();
    return true;
  }

  if (normalizedAction === 'close-macro-drift-preview-modal') {
    window.closeMacroDriftPreviewModal?.();
    return true;
  }

  if (normalizedAction === 'close-subtype-orphan-resolver-modal') {
    window.closeSubtypeOrphanResolverModal?.();
    return true;
  }

  if (normalizedAction === 'close-meal-plan-sync-warning-modal') {
    window.closeMealPlanSyncWarningModal?.();
    return true;
  }

  if (normalizedAction === 'close-merge-ingredients-modal') {
    window.closeMergeIngredientsModal?.();
    return true;
  }

  if (normalizedAction === 'close-resolve-unlinked-modal') {
    window.closeResolveUnlinkedModal?.();
    return true;
  }

  if (normalizedAction === 'submit-resolve-tesco-import') {
    window.submitResolveTescoImport?.();
    return true;
  }

  if (normalizedAction === 'submit-resolve-new-product') {
    window.submitResolveNewProduct?.();
    return true;
  }

  if (normalizedAction === 'submit-resolve-remap-target') {
    window.submitResolveRemapTarget?.(ds.ingredientId || '', ds.subtypeId || '');
    return true;
  }

  if (normalizedAction === 'submit-resolve-link-existing') {
    window.submitResolveLinkExisting?.(ds.productId || '');
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
