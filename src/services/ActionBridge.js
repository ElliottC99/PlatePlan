/**
 * src/services/ActionBridge.js (v3.20.16)
 * Centralized Action Bridge & Event Dispatcher for Atomic Modular Architecture.
 * Idempotently handles delegated events, data-action/data-pp-click, mobile drawer routing, and sub-type deletion.
 * Strictly ZERO eval() or new Function().
 */

import { renderSettingsView } from '../views/SettingsView.js';
import { renderShoppingListUI, renderScrollableSwapModal, toggleShoppingItemAcquired } from '../views/ShoppingView.js';
import { renderPlanner } from '../views/PlannerView.js';
import { renderRecipeVault, toggleRecipeFavourite, toggleVaultFavouritesFilter } from '../views/RecipeVaultView.js';

let isBridgeInitialized = false;

/**
 * Patch legacy labels like "Swap Brand" to "Swap Product" across DOM nodes.
 */
export function patchSwapLabels() {
  if (typeof document === 'undefined') return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeValue && node.nodeValue.includes('Swap Brand')) {
      node.nodeValue = node.nodeValue.replace(/Swap Brand/g, 'Swap Product');
    }
  }
  document.querySelectorAll('button, a, span, label, div').forEach(el => {
    if (el.title && el.title.includes('Swap Brand')) {
      el.title = el.title.replace(/Swap Brand/g, 'Swap Product');
    }
    if (el.placeholder && el.placeholder.includes('Swap Brand')) {
      el.placeholder = el.placeholder.replace(/Swap Brand/g, 'Swap Product');
    }
  });
}

function initLabelObserver() {
  if (typeof window === 'undefined' || window.__pp_label_observer_active) return;
  window.__pp_label_observer_active = true;

  const observer = new MutationObserver(() => patchSwapLabels());
  observer.observe(document.body, { childList: true, subtree: true });
  patchSwapLabels();
}

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

  // 1. Recipe Modal / View
  if (normalizedAction === 'fix-issue' || normalizedAction === 'fix-recipe') {
    const issueKey = ds.issueKey || target.getAttribute('data-issue-key') || '';
    if (issueKey && (issueKey.startsWith('advisory:') || issueKey.includes('recipe-macro-sync') || issueKey.includes('recipe-low-cal') || issueKey.includes('macro-sync'))) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const recipeId = issueKey.split(':').pop() || ds.entityId || ds.recipeId || ds.id;
      if (typeof window.autoRecalibrateRecipeMacros === 'function') {
        window.autoRecalibrateRecipeMacros(recipeId);
      }
      return true; // CRITICAL: Prevent fall-through to ResolveUnlinkedModal
    }
  }

  if (normalizedAction === 'view-recipe' || normalizedAction === 'viewrecipe' || normalizedAction.includes('viewrecipe') || normalizedAction.includes('openrecipemodal')) {
    const recipeId = ds.recipeId || ds.id || parseArgsString(actionName)[0];
    const instanceId = ds.instanceId || parseArgsString(actionName)[1] || null;
    const variant = ds.variant || parseArgsString(actionName)[2] || 'original';
    const targetPerson = ds.targetPerson || parseArgsString(actionName)[3] || 'both';

    if (recipeId) {
      if (typeof window.viewRecipe === 'function') {
        window.viewRecipe(recipeId, instanceId, variant, targetPerson);
      } else if (typeof window.openRecipeModal === 'function') {
        window.openRecipeModal(recipeId, instanceId, variant, targetPerson);
      }
    }
    return true;
  }

  // Fit score details modal
  if (normalizedAction === 'open-fit-details' || normalizedAction.includes('openvaultfitdetails')) {
    const recipeId = ds.recipeId || ds.id || parseArgsString(actionName)[1];
    const variant = ds.variant || parseArgsString(actionName)[2] || 'original';
    const person = ds.person || parseArgsString(actionName)[3] || 'e';
    if (typeof window.openVaultFitDetails === 'function') {
      window.openVaultFitDetails(target, recipeId, variant, person);
    }
    return true;
  }

  // Recipe Actions Menu
  if (normalizedAction === 'open-recipe-actions' || normalizedAction.includes('openrecipeactions')) {
    const recipeId = ds.recipeId || ds.id || parseArgsString(actionName)[0];
    if (typeof window.openRecipeActions === 'function') {
      window.openRecipeActions(recipeId);
    }
    return true;
  }

  if (normalizedAction === 'open-enhanced-recipe-actions' || normalizedAction.includes('openenhancedrecipeactions')) {
    const recipeId = ds.recipeId || ds.id || parseArgsString(actionName)[0];
    if (typeof window.openEnhancedRecipeActions === 'function') {
      window.openEnhancedRecipeActions(recipeId);
    }
    return true;
  }

  // 2. Recipe Favourite Toggle
  if (normalizedAction === 'toggle-favorite' || normalizedAction === 'toggle-fav' || normalizedAction === 'togglefavourite' || normalizedAction.includes('togglerecipefavourite')) {
    const recipeId = ds.recipeId || ds.id || parseArgsString(actionName)[0];
    const variant = ds.variant || parseArgsString(actionName)[2] || 'original';
    if (recipeId) {
      toggleRecipeFavourite(recipeId, event, variant);
    }
    return true;
  }

  // 3. Vault Favourites Filter
  if (normalizedAction === 'toggle-vault-fav-filter' || normalizedAction.includes('togglevaultfavouritesfilter')) {
    toggleVaultFavouritesFilter();
    return true;
  }

  // 4. Shopping Product Substitution
  if (normalizedAction === 'swap-product' || normalizedAction === 'toggle-inline-subst' || normalizedAction === 'toggleinlineshoppingsubst' || normalizedAction.includes('toggleinlineshoppingsubst')) {
    const containerEl = target.closest('[data-item-key], [data-group-key], [data-group-id], [data-ingredient-name], .pp-shop-item, .shopping-list-row, .item-row') || target;
    const groupKey = ds.groupKey || ds.groupId || containerEl.dataset?.groupKey || containerEl.dataset?.groupId || parseArgsString(actionName)[0] || '';
    const itemKey = ds.itemKey || containerEl.dataset?.itemKey || parseArgsString(actionName)[1] || parseArgsString(actionName)[0] || '';
    const ingredientName = ds.ingredientName || containerEl.dataset?.ingredientName || '';
    renderScrollableSwapModal(groupKey, itemKey, ingredientName);
    return true;
  }

  // 4b. Explicit Sub-type Deletion Case
  if (normalizedAction === 'delete-subtype' || normalizedAction === 'deletesubtype' || normalizedAction.includes('deletesubtype')) {
    const subtypeId = ds.subtypeId || ds.id || target.getAttribute('data-subtype-id') || target.getAttribute('data-id') || parseArgsString(actionName)[0];
    const parentId = ds.parentId || ds.ingredientId || ds.parentIngredientId || target.getAttribute('data-parent-id') || parseArgsString(actionName)[1];
    if (typeof window.openSubtypeDeleteModal === 'function') {
      window.openSubtypeDeleteModal(subtypeId, parentId);
    } else if (typeof window.deleteSubtype === 'function') {
      window.deleteSubtype(parentId, subtypeId);
    }
    return true;
  }

  // 4c. Ingredient & Product Bank Modals
  if (normalizedAction === 'open-ingredient-modal' || normalizedAction.includes('openingredientfamilydetailsmodal')) {
    const ingId = ds.ingredientId || ds.id || parseArgsString(actionName)[0] || null;
    if (typeof window.openIngredientFamilyDetailsModal === 'function') {
      window.openIngredientFamilyDetailsModal(ingId);
    }
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
    if (typeof window.createIngredientFamilyPrompt === 'function') {
      window.createIngredientFamilyPrompt();
    } else if (typeof window.openIngredientFamilyDetailsModal === 'function') {
      window.openIngredientFamilyDetailsModal(null);
    }
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
    if (typeof window.openCategoryManager === 'function') window.openCategoryManager();
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
  initLabelObserver();

  // Delegated capture listener on document
  document.addEventListener('click', (event) => {
    patchSwapLabels();

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
}
