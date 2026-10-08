/**
 * src/core/AppRouter.js (v3.12.1)
 * Core Application Router & View Lifecycle Mounting Engine
 */

import * as TodayView from '../views/TodayView.js';
import * as PlannerView from '../views/PlannerView.js';
import * as RecipeVaultView from '../views/RecipeVaultView.js';
import * as ShoppingView from '../views/ShoppingView.js';
import * as SettingsView from '../views/SettingsView.js';
import * as PantryBankView from '../views/PantryBankView.js';
import * as ProductBankView from '../views/ProductBankView.js';
import * as DataQualityView from '../views/DataQualityView.js';

let activeViewModule = null;

const viewModuleMap = {
  today: TodayView,
  planner: PlannerView,
  vault: RecipeVaultView,
  shopping: ShoppingView,
  settings: SettingsView,
  prefs: SettingsView,
  ingredients: PantryBankView,
  pantry: PantryBankView,
  bank: ProductBankView,
  data: DataQualityView,
  quality: DataQualityView
};

export function syncMobileNavigation(viewId) {
  const mobileNav = document.getElementById('mobile-nav');
  if (!mobileNav) return;
  const buttons = mobileNav.querySelectorAll('button[data-view]');
  buttons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });
}

export function requestPlatePlanViewRender(viewId) {
  if (typeof window.renderPlatePlanView === 'function') {
    return window.renderPlatePlanView(viewId);
  }
  if (typeof window.renderPlatePlanLegacyView === 'function') {
    return window.renderPlatePlanLegacyView(viewId);
  }
}

export function showView(viewId) {
  if (typeof document === 'undefined') return;

  // 1. Teardown active view module if it has unmount()
  if (activeViewModule && typeof activeViewModule.unmount === 'function') {
    try {
      activeViewModule.unmount();
    } catch (e) {
      console.warn('[AppRouter] Error unmounting previous view:', e);
    }
  }

  // Update desktop sidebar tabs
  const normalizedViewId = viewId === 'pantry' ? 'ingredients' : viewId;
  document.querySelectorAll('.desktop-sidebar .ntab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === normalizedViewId || tab.dataset.view === viewId);
  });

  // Activate view container
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const viewEl = document.getElementById('view-' + normalizedViewId) || document.getElementById('view-' + viewId);
  if (viewEl) {
    viewEl.classList.add('active');
  }

  // 2. Mount next view module
  const nextModule = viewModuleMap[viewId];
  if (nextModule && typeof nextModule.mount === 'function') {
    try {
      nextModule.mount(viewEl);
    } catch (e) {
      console.warn('[AppRouter] Error mounting view ' + viewId + ':', e);
    }
  } else {
    requestPlatePlanViewRender(viewId);
  }

  activeViewModule = nextModule || null;

  // Update mobile nav
  syncMobileNavigation(viewId);

  if (window.platePlanDirtyViews && window.platePlanDirtyViews.delete) {
    window.platePlanDirtyViews.delete(viewId);
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
}
