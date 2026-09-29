/**
 * src/core/AppInitializer.js (v3.10.0)
 * Core Application Bootstrapping, Service Worker & Toast Notifications
 */

export function showPlatePlanToast(msg, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function' && window.showPlatePlanToast !== showPlatePlanToast) {
    return window.showPlatePlanToast(msg, type);
  }
  const existing = document.getElementById('pp-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'pp-toast';
  toast.className = `pp-toast pp-toast-${type}`;
  toast.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:var(--text, #1c1917);color:var(--bg, #fff);padding:10px 18px;border-radius:999px;font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;pointer-events:none;transition:opacity 0.2s ease;opacity:0';
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

let isSwRegistered = false;
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || isSwRegistered) return;
  isSwRegistered = true;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.info('[PlatePlan PWA] Service Worker registered with scope:', reg.scope);
      reg.addEventListener('updatefound', () => {
        const installingWorker = reg.installing;
        if (!installingWorker) return;
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showPlatePlanToast('✨ PlatePlan updated! Reloading to apply changes...', 'info');
            setTimeout(() => window.location.reload(), 1500);
          }
        });
      });
    }).catch(err => {
      console.warn('[PlatePlan PWA] Service Worker registration failed:', err);
    });
  });
}

export function initHeaderDelegation() {
  if (typeof document === 'undefined') return;
  const header = document.querySelector('.app-header');
  if (!header || header.dataset.delegated) return;
  header.dataset.delegated = 'true';

  header.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === 'sync-now' && typeof window.syncNow === 'function') {
      window.syncNow();
    } else if (action === 'logout' && typeof window.logout === 'function') {
      window.logout();
    }
  });
}

export function initNavigationDelegation() {
  if (typeof document === 'undefined') return;
  const navContainer = document.body;
  if (!navContainer || navContainer.dataset.navDelegated) return;
  navContainer.dataset.navDelegated = 'true';

  navContainer.addEventListener('click', (e) => {
    const viewEl = e.target.closest('[data-view]');
    if (!viewEl) return;
    const actionEl = e.target.closest('[data-action]');
    const isNavAction = actionEl && actionEl.dataset.action === 'navigate-view';
    if (isNavAction || viewEl.classList.contains('ntab') || viewEl.closest('#mobile-nav')) {
      const viewId = viewEl.dataset.view;
      if (viewId && viewId !== 'more') {
        if (typeof window.showView === 'function') {
          window.showView(viewId);
        }
      }
    }
  });
}

export function initPlannerGridDelegation() {
  if (typeof document === 'undefined') return;
  const plannerView = document.getElementById('view-planner') || document.body;
  if (!plannerView || plannerView.dataset.plannerDelegated) return;
  plannerView.dataset.plannerDelegated = 'true';

  plannerView.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const ds = actionEl.dataset;

    if (action === 'view-meal-detail' && ds.recipeId) {
      if (typeof window.viewRecipe === 'function') {
        window.viewRecipe(ds.recipeId, ds.instanceId || '', ds.variant || '');
      }
    } else if (action === 'swap-slot' && ds.day && ds.slot) {
      if (typeof window.openSwapMealModal === 'function') {
        window.openSwapMealModal(Number(ds.day), ds.slot);
      }
    } else if (action === 'searchable-swap-slot' && ds.day && ds.slot) {
      if (typeof window.openSearchableRecipeSwapModal === 'function') {
        window.openSearchableRecipeSwapModal(Number(ds.day), ds.slot, ds.shared === 'true');
      }
    } else if (action === 'planned-meal-actions' && ds.day && ds.slot) {
      if (typeof window.openPlannedMealActions === 'function') {
        window.openPlannedMealActions(Number(ds.day), ds.slot);
      }
    } else if (action === 'clear-slot-reason' && ds.day && ds.slot) {
      if (typeof window.clearPlanSlotReason === 'function') {
        window.clearPlanSlotReason(Number(ds.day), ds.slot);
      }
    } else if (action === 'open-saved-plan-recipe-cards' && ds.index !== undefined) {
      if (typeof window.openSavedPlanRecipeCards === 'function') {
        window.openSavedPlanRecipeCards(Number(ds.index));
      }
    } else if (action === 'open-plan-history-actions' && ds.index !== undefined) {
      if (typeof window.openPlanHistoryActions === 'function') {
        window.openPlanHistoryActions(Number(ds.index));
      }
    }
  });

  plannerView.addEventListener('change', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const ds = actionEl.dataset;
    if (action === 'set-plan-day-date' && ds.day) {
      if (typeof window.setPlanDayDate === 'function') {
        window.setPlanDayDate(Number(ds.day), e.target.value);
      }
    }
  });
}

export function initVaultDelegation() {
  if (typeof document === 'undefined') return;
  const vaultView = document.getElementById('view-vault') || document.body;
  if (!vaultView || vaultView.dataset.vaultDelegated) return;
  vaultView.dataset.vaultDelegated = 'true';

  vaultView.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const ds = actionEl.dataset;

    if (action === 'view-recipe' && ds.recipeId) {
      if (typeof window.viewRecipe === 'function') {
        window.viewRecipe(ds.recipeId, null, ds.variant === 'enhanced' ? 'enhanced' : 'original');
      }
    } else if (action === 'toggle-favorite' && ds.recipeId) {
      if (typeof window.toggleRecipeFavourite === 'function') {
        window.toggleRecipeFavourite(ds.recipeId, e, ds.variant || 'original');
      }
    } else if (action === 'open-recipe-actions' && ds.recipeId) {
      if (typeof window.openRecipeActions === 'function') {
        window.openRecipeActions(ds.recipeId);
      }
    } else if (action === 'open-enhanced-recipe-actions' && ds.recipeId) {
      if (typeof window.openEnhancedRecipeActions === 'function') {
        window.openEnhancedRecipeActions(ds.recipeId);
      }
    } else if (action === 'open-fit-details' && ds.recipeId) {
      if (typeof window.openVaultFitDetails === 'function') {
        window.openVaultFitDetails(actionEl, ds.recipeId, ds.variant || 'original', ds.person || 'e');
      }
    } else if (action === 'toggle-favourites-filter') {
      if (typeof window.toggleVaultFavouritesFilter === 'function') {
        window.toggleVaultFavouritesFilter();
      }
    }
  });
}

export function initShoppingDelegation() {
  if (typeof document === 'undefined') return;
  const shoppingView = document.getElementById('view-shopping') || document.body;
  if (!shoppingView || shoppingView.dataset.shoppingDelegated) return;
  shoppingView.dataset.shoppingDelegated = 'true';

  shoppingView.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const ds = actionEl.dataset;

    if (action === 'clear-completed-shopping-items') {
      if (typeof window.clearCompletedShoppingItems === 'function') {
        window.clearCompletedShoppingItems();
      }
    } else if (action === 'toggle-inline-subst' && ds.itemKey) {
      if (typeof window.toggleInlineShoppingSubst === 'function') {
        window.toggleInlineShoppingSubst(ds.itemKey, ds.groupId || '');
      }
    } else if (action === 'select-shopping-product-override' && ds.groupId && ds.productId) {
      if (typeof window.selectShoppingProductOverride === 'function') {
        window.selectShoppingProductOverride(ds.groupId, ds.productId);
      }
    }
  });

  shoppingView.addEventListener('change', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const ds = actionEl.dataset;

    if (action === 'toggle-shopping-at-home' && ds.itemKey) {
      if (typeof window.toggleShoppingAtHome === 'function') {
        window.toggleShoppingAtHome(ds.itemKey);
      }
    } else if (action === 'switch-supermarket-store') {
      if (typeof window.switchSupermarketStore === 'function') {
        window.switchSupermarketStore(e.target.value);
      }
    }
  });
}

export function initSettingsDelegation() {
  if (typeof document === 'undefined') return;
  const settingsView = document.getElementById('view-settings') || document.body;
  if (!settingsView || settingsView.dataset.settingsDelegated) return;
  settingsView.dataset.settingsDelegated = 'true';

  settingsView.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const ds = actionEl.dataset;

    if (action === 'add-exclusion') {
      if (typeof window.handleAddExclusionFromInput === 'function') {
        window.handleAddExclusionFromInput();
      }
    } else if (action === 'remove-exclusion' && ds.index !== undefined) {
      if (typeof window.handleRemoveExclusion === 'function') {
        window.handleRemoveExclusion(Number(ds.index));
      }
    } else if (action === 'generate-invite-link') {
      if (typeof window.generateHouseholdInviteLink === 'function') {
        window.generateHouseholdInviteLink();
      }
    } else if (action === 'refresh-data') {
      if (typeof window.handleRefreshData === 'function') {
        window.handleRefreshData();
      } else if (typeof window.hydrateHouseholdData === 'function') {
        window.hydrateHouseholdData();
      }
    }
  });
}

export function initModalDelegation() {
  if (typeof document === 'undefined') return;
  const modalContainer = document.getElementById('modal-container') || document.body;
  if (!modalContainer || modalContainer.dataset.modalDelegated) return;
  modalContainer.dataset.modalDelegated = 'true';

  modalContainer.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'close-modal') {
      const modal = actionEl.closest('.modal, .modal-backdrop, [role="dialog"]');
      if (modal) {
        modal.style.display = 'none';
      } else if (typeof window.closeAllModals === 'function') {
        window.closeAllModals();
      }
    }
  });
}

export function initPlatePlanApp() {
  console.info('[PlatePlan Core] Initializing ES6 Modern Application Shell & Event Delegation...');
  registerServiceWorker();
  initHeaderDelegation();
  initNavigationDelegation();
  initPlannerGridDelegation();
  initVaultDelegation();
  initShoppingDelegation();
  initSettingsDelegation();
  initModalDelegation();
}
