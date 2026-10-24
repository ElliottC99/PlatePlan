/**
 * src/services/ActionBridge.js (v3.38.69)
 * Centralized Action Bridge & Event Dispatcher for Atomic Modular Architecture.
 * Idempotently handles delegated events, data-action/data-pp-click, mobile drawer routing, and sub-type deletion.
 * Strictly modular (<350 lines).
 */

import { renderSettingsView } from '../views/SettingsView.js';
import { renderShoppingListUI, renderScrollableSwapModal, toggleShoppingItemAcquired } from '../views/ShoppingView.js';
import { renderPlanner } from '../views/PlannerView.js';
import { renderRecipeVault, handleVaultSortChange } from '../views/RecipeVaultView.js';
import { routeRecipeAction } from './RecipeActionBridge.js';


let isBridgeInitialized = false;


/**
 * Clean argument token parser without eval.
 */
function cleanArgToken(token, event, target) {
  const val = token.trim();
  if (val === 'this') return target;
  if (val === 'event') return event;
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null') return null;
  if (val === 'undefined') return undefined;
  if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
  return val.replace(/^['"`]|['"`]$/g, '');
}

function parseArgsString(rawArgsStr, event, target) {
  if (!rawArgsStr || !rawArgsStr.trim()) return [];
  const args = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < rawArgsStr.length; i++) {
    const char = rawArgsStr[i];
    if (char === "'" || char === '"' || char === '`') {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuote = false;
        quoteChar = '';
      } else {
        current += char;
      }
    } else if (char === ',' && !inQuote) {
      args.push(cleanArgToken(current, event, target));
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim().length > 0) {
    args.push(cleanArgToken(current, event, target));
  }
  return args;
}

/**
 * Route modular actions to their corresponding ES6 views or handlers.
 */
export function routeAction(actionName, target, event) {
  const ds = target.dataset || {};
  const normalizedAction = actionName.toLowerCase().trim();

  // 1. Recipe & Vault Actions (Delegated to RecipeActionBridge)
  if (routeRecipeAction(actionName, target, event, parseArgsString)) {
    return true;
  }

  // 4. Shopping Product Substitution
  if (normalizedAction === 'swap-product' || normalizedAction === 'toggle-inline-subst' || normalizedAction === 'toggleinlineshoppingsubst' || normalizedAction.includes('toggleinlineshoppingsubst')) {
    const containerEl = target.closest('[data-item-key], [data-group-key], [data-group-id], [data-ingredient-name], .pp-shop-item, .shopping-list-row, .item-row') || target;
    const groupKey = ds.groupKey || ds.groupId || containerEl.dataset?.groupKey || containerEl.dataset?.groupId || parseArgsString(actionName)[0] || '';
    const itemKey = ds.itemKey || containerEl.dataset?.itemKey || parseArgsString(actionName)[1] || parseArgsString(actionName)[0] || '';
    const instanceId = ds.instanceId || containerEl.dataset?.instanceId || parseArgsString(actionName)[2] || null;
    if (typeof window.toggleInlineShoppingSubst === 'function') {
      window.toggleInlineShoppingSubst(itemKey, groupKey, instanceId);
    } else {
      renderScrollableSwapModal(itemKey, groupKey, null, { instanceId });
    }
    return true;
  }

  // 4b. Explicit Sub-type Deletion Case
  if (normalizedAction === 'delete-subtype' || normalizedAction === 'deletesubtype' || normalizedAction.includes('deletesubtype')) {
    const subtypeId = ds.subtypeId || ds.id || target.getAttribute('data-subtype-id') || target.getAttribute('data-id') || parseArgsString(actionName)[0];
    const parentId = ds.parentId || ds.ingredientId || ds.parentIngredientId || target.getAttribute('data-parent-id') || parseArgsString(actionName)[1];
    import('../components/pantry/ReorganiseModalUI.js').then(m => m.openReorganiseModal('subtype', { id: subtypeId, parentId }));
    return true;
  }

  // 4c. Ingredient & Product Bank Modals
  if (normalizedAction === 'open-ingredient-modal' || normalizedAction.includes('openingredientfamilydetailsmodal')) {
    const ingId = ds.ingredientId || ds.id || parseArgsString(actionName)[0] || null;
    import('../components/pantry/ReorganiseModalUI.js').then(m => m.openReorganiseModal('item', { id: ingId }));
    return true;
  }

  if (normalizedAction === 'open-product-modal' || normalizedAction.includes('openproducteditmodal') || normalizedAction.includes('showadding')) {
    const prodId = ds.productId || ds.id || parseArgsString(actionName)[0] || null;
    if (typeof window.openProductEditModal === 'function') {
      window.openProductEditModal(prodId);
    } else if (typeof window.showAddIng === 'function') {
      window.showAddIng(prodId);
    }
    return true;
  }

  if (normalizedAction.includes('closeingredientfamilydetailsmodal')) {
    if (typeof window.closeIngredientFamilyDetailsModal === 'function') {
      window.closeIngredientFamilyDetailsModal();
    }
    return true;
  }

  if (normalizedAction.includes('saveingredientfamilydetailsmodal')) {
    if (typeof window.saveIngredientFamilyDetailsModal === 'function') {
      window.saveIngredientFamilyDetailsModal();
    }
    return true;
  }

  if (normalizedAction.includes('savemanualing')) {
    if (typeof window.saveManualIng === 'function') {
      window.saveManualIng();
    }
    return true;
  }

  if (normalizedAction.includes('cancelmanualing')) {
    if (typeof window.cancelManualIng === 'function') {
      window.cancelManualIng();
    }
    return true;
  }

  if (normalizedAction.includes('createingredientfamilyprompt')) {
    import('../components/pantry/AddToBankHubUI.js').then(m => m.openAddToBankModal());
    return true;
  }


  // 5. Shopping Item Acquired Checkbox
  if (normalizedAction === 'toggle-shopping-item' || normalizedAction === 'toggle-shopping-at-home' || normalizedAction === 'toggleshoppingathome' || normalizedAction.includes('toggleshoppingathome')) {
    const containerEl = target.closest('[data-item-key], [data-group-key], [data-group-id], .pp-shop-item, .shopping-list-row, .item-row') || target;
    const groupKey = ds.groupKey || ds.groupId || containerEl.dataset?.groupKey || containerEl.dataset?.groupId || parseArgsString(actionName)[0] || '';
    const itemKey = ds.itemKey || containerEl.dataset?.itemKey || parseArgsString(actionName)[1] || parseArgsString(actionName)[0] || '';
    toggleShoppingItemAcquired(groupKey, itemKey);
    return true;
  }

  // 6. View Switcher Navigation & Mobile Drawer Routing
  if (normalizedAction.includes('mobilemoreview') || normalizedAction === 'show-view' || normalizedAction.includes('showview')) {
    const match = actionName.match(/(?:mobileMoreView|showView)\(['"]?([^'"]+)['"]?\)/i);
    const viewName = match ? match[1] : (ds.view || parseArgsString(actionName)[0]);
    if (viewName) {
      if (typeof window.closeMobileMore === 'function') window.closeMobileMore();
      if (typeof window.mobileMoreView === 'function') {
        window.mobileMoreView(viewName);
      } else if (typeof window.showView === 'function') {
        window.showView(viewName);
      }
      if (viewName === 'vault') setTimeout(renderRecipeVault, 30);
      else if (viewName === 'planner') setTimeout(renderPlanner, 30);
      else if (viewName === 'prefs' || viewName === 'settings') setTimeout(renderSettingsView, 30);
      else if (viewName === 'shopping') setTimeout(renderShoppingListUI, 30);
      else if (viewName === 'data' || viewName === 'quality') {
        if (typeof window.renderDataQualityView === 'function') {
          setTimeout(window.renderDataQualityView, 30);
        }
      }
    }
    return true;
  }

  // 7. Modal Close Actions
  if (normalizedAction === 'close-modal' || normalizedAction.includes('closemodal') || normalizedAction.includes('closerecipepreview')) {
    const modalWrap = target.closest('.modal-wrap');
    if (modalWrap) {
      modalWrap.classList.remove('open');
    }
    if (typeof window.closeRecipePreview === 'function') {
      window.closeRecipePreview();
    }
    return true;
  }

  // 8. Mobile Menu & Toolbar Actions
  if (normalizedAction.includes('opencategorymanagermodal')) {
    import('../components/pantry/ReorganiseModalUI.js').then(m => m.openReorganiseModal('category'));
    return true;
  }

  if (normalizedAction.includes('openmobilemore')) {
    if (typeof window.openMobileMore === 'function') window.openMobileMore();
    return true;
  }

  if (normalizedAction.includes('closemobilemore')) {
    if (typeof window.closeMobileMore === 'function') window.closeMobileMore();
    return true;
  }

  if (normalizedAction.includes('openplateplansyncpanel')) {
    if (typeof window.openPlatePlanSyncPanel === 'function') window.openPlatePlanSyncPanel();
    return true;
  }

  if (normalizedAction.includes('closeplateplansyncpanel')) {
    if (typeof window.closePlatePlanSyncPanel === 'function') window.closePlatePlanSyncPanel();
    return true;
  }

  if (normalizedAction.includes('vaultsort') || normalizedAction.includes('handlevaultsortchange')) {
    const val = target.value || parseArgsString(actionName)[0];
    if (typeof handleVaultSortChange === 'function') handleVaultSortChange(val);
    return true;
  }

  if (normalizedAction.includes('skipbatchimportrecipe')) {
    if (typeof window.skipBatchImportRecipe === 'function') window.skipBatchImportRecipe();
    return true;
  }

  if (normalizedAction.includes('abortbatchimport')) {
    if (typeof window.abortBatchImport === 'function') window.abortBatchImport();
    return true;
  }

  if (normalizedAction.includes('handlesubtypeproductaction')) {
    const arg = parseArgsString(actionName)[0];
    if (typeof window.handleSubtypeProductAction === 'function') window.handleSubtypeProductAction(arg);
    return true;
  }

  return false;
}

/**
 * Install centralized delegated action listener with strict idempotency and double-binding prevention.
 */
export function setupActionBridge() {
  if (typeof window === 'undefined') return;
  if (isBridgeInitialized || window.__plateplan_action_bridge_attached) {
    console.log('[ActionBridge] Action bridge already registered. Skipping redundant attachment.');
    return;
  }

  isBridgeInitialized = true;
  window.__plateplan_action_bridge_attached = true;

  // Delegated capture listener on document for click
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action], [data-pp-click], button');
    if (!target) return;

    const actionString = target.getAttribute('data-action') || target.dataset.action || '';
    const ppClickStr = target.getAttribute('data-pp-click') || target.dataset.ppClick || '';
    const expr = actionString || ppClickStr;

    if (expr) {
      const actionEvent = new CustomEvent('plateplan-action', { 
        detail: { 
          action: expr, 
          target: target,
          id: target.getAttribute('data-id') || target.getAttribute('data-recipe-id') || target.getAttribute('data-ingredient-id')
        } 
      });
      document.dispatchEvent(actionEvent);
      
      const handled = routeAction(expr, target, event);
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
      return;
    }
  }, true);

  // Delegated capture listener for change (data-pp-change)
  document.addEventListener('change', (event) => {
    const target = event.target.closest('[data-pp-change]');
    if (!target) return;
    const expr = target.getAttribute('data-pp-change') || target.dataset.ppChange || '';
    if (expr) {
      const handled = routeAction(expr, target, event);
      if (handled) {
        event.preventDefault();
      }
    }
  }, true);

  // Delegated capture listener for input (data-pp-input)
  document.addEventListener('input', (event) => {
    const target = event.target.closest('[data-pp-input]');
    if (!target) return;
    const expr = target.getAttribute('data-pp-input') || target.dataset.ppInput || '';
    if (expr) {
      const handled = routeAction(expr, target, event);
      if (handled) {
        event.preventDefault();
      }
    }
  }, true);
}
