/**
 * src/services/ActionBridge.js (v3.7.4)
 * Centralized Action Bridge & Event Dispatcher for Atomic Modular Architecture.
 * Idempotently handles delegated events, data-action parsing, shopping toggles, and modal routing.
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

/**
 * Initialize DOM mutation observer for label consistency.
 */
function initLabelObserver() {
  if (typeof window === 'undefined' || window.__pp_label_observer_active) return;
  window.__pp_label_observer_active = true;

  const observer = new MutationObserver(() => patchSwapLabels());
  observer.observe(document.body, { childList: true, subtree: true });
  patchSwapLabels();
}

/**
 * Parse arguments from function call strings like "fn('a', 2, true)".
 * @param {string} str 
 * @returns {Array<any>}
 */
function parseFunctionArgs(str) {
  if (!str || !str.includes('(')) return [];
  const raw = str.substring(str.indexOf('(') + 1, str.lastIndexOf(')'));
  return raw.split(',').map(s => {
    const val = s.trim().replace(/^['"]|['"]$/g, '');
    if (val === 'null' || val === 'undefined' || val === '') return null;
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (!isNaN(val) && val !== '') return Number(val);
    return val;
  });
}

/**
 * Route modular actions to their corresponding ES6 views or handlers.
 * @param {string} actionName 
 * @param {HTMLElement} target 
 * @param {Event} event 
 */
export function routeAction(actionName, target, event) {
  const ds = target.dataset || {};
  const normalizedAction = actionName.toLowerCase().trim();

  // 1. Recipe Modal / View
  if (normalizedAction === 'view-recipe' || normalizedAction === 'viewrecipe' || normalizedAction.includes('viewrecipe') || normalizedAction.includes('openrecipemodal')) {
    const recipeId = ds.recipeId || ds.id || parseFunctionArgs(actionName)[0];
    const instanceId = ds.instanceId || parseFunctionArgs(actionName)[1] || null;
    const variant = ds.variant || parseFunctionArgs(actionName)[2] || 'original';
    const targetPerson = ds.targetPerson || parseFunctionArgs(actionName)[3] || 'both';

    if (recipeId) {
      if (typeof window.viewRecipe === 'function') {
        window.viewRecipe(recipeId, instanceId, variant, targetPerson);
      } else if (typeof window.openRecipeModal === 'function') {
        window.openRecipeModal(recipeId, instanceId, variant, targetPerson);
      }
    }
    return true;
  }

  // 2. Recipe Favourite Toggle
  if (normalizedAction === 'toggle-fav' || normalizedAction === 'togglefavourite' || normalizedAction.includes('togglerecipefavourite')) {
    const recipeId = ds.recipeId || ds.id || parseFunctionArgs(actionName)[0];
    const variant = ds.variant || parseFunctionArgs(actionName)[2] || 'original';
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
  if (normalizedAction === 'swap-product' || normalizedAction === 'toggleinlineshoppingsubst' || normalizedAction.includes('toggleinlineshoppingsubst')) {
    const groupKey = ds.groupKey || ds.groupId || parseFunctionArgs(actionName)[0] || '';
    const itemKey = ds.itemKey || parseFunctionArgs(actionName)[1] || '';
    renderScrollableSwapModal(groupKey, itemKey);
    return true;
  }

  // 5. Shopping Item Acquired Checkbox
  if (normalizedAction === 'toggle-shopping-item' || normalizedAction === 'toggleshoppingathome' || normalizedAction.includes('toggleshoppingathome')) {
    const groupKey = ds.groupKey || ds.groupId || parseFunctionArgs(actionName)[0] || '';
    const itemKey = ds.itemKey || parseFunctionArgs(actionName)[1] || '';
    toggleShoppingItemAcquired(groupKey, itemKey);
    return true;
  }

  // 6. View Switcher Navigation
  if (normalizedAction === 'show-view' || normalizedAction.includes('showview')) {
    const viewName = ds.view || parseFunctionArgs(actionName)[0];
    if (viewName) {
      if (typeof window.showView === 'function') {
        window.showView(viewName);
      }
      if (viewName === 'vault') setTimeout(renderRecipeVault, 30);
      else if (viewName === 'planner') setTimeout(renderPlanner, 30);
      else if (viewName === 'prefs' || viewName === 'settings') setTimeout(renderSettingsView, 30);
      else if (viewName === 'shopping') setTimeout(renderShoppingListUI, 30);
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

  return false;
}

/**
 * Install centralized delegated action listener with strict idempotency and double-binding prevention.
 */
export function setupActionBridge() {
  if (typeof window === 'undefined') return;
  if (isBridgeInitialized || window.__plateplan_action_bridge_attached) {
    console.log('[ActionBridge v3.7.4] Action bridge already registered. Skipping redundant attachment.');
    return;
  }

  isBridgeInitialized = true;
  window.__plateplan_action_bridge_attached = true;
  initLabelObserver();

  // Delegated capture listener on document
  document.addEventListener('click', (event) => {
    patchSwapLabels();

    const target = event.target.closest('[data-action], [data-pp-click], [onclick*="toggleInlineShoppingSubst"], [onclick*="viewRecipe"], [onclick*="openRecipeModal"], [onclick*="toggleRecipeFavourite"], button');
    if (!target) return;

    const dataAction = target.getAttribute('data-action') || target.dataset.action || '';
    const ppClickStr = target.dataset.ppClick || target.getAttribute('data-pp-click') || '';
    const onclickStr = target.getAttribute('onclick') || '';
    const actionDescriptor = dataAction || ppClickStr || onclickStr;

    if (!actionDescriptor) return;

    // Check if intercepted by modern routeAction
    const wasHandled = routeAction(actionDescriptor, target, event);

    if (wasHandled) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    // Handle data-pp-click or legacy inline action delegation
    if (ppClickStr || dataAction) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (typeof window.runPlatePlanDelegatedAction === 'function') {
        window.runPlatePlanDelegatedAction(ppClickStr || dataAction, event, target);
      } else {
        try {
          const execFn = new Function('event', `with(window) { ${ppClickStr || dataAction} }`);
          execFn.call(target, event);
        } catch (err) {
          console.warn('[ActionBridge v3.5.0] Error evaluating delegated action:', err);
        }
      }
    }
  }, true);

  console.log('[ActionBridge v3.5.0] Centralized Action Bridge installed successfully.');
}
