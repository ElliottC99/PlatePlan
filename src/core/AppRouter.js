/**
 * src/core/AppRouter.js
 * Core Application Router & View Lifecycle Mounting Engine
 * Apple HIG Navigation & Large Title Scroll Orchestration
 */

import * as TodayView from '../views/TodayView.js';
import * as PlannerView from '../views/PlannerView.js';
import * as RecipeVaultView from '../views/RecipeVaultView.js';
import * as SettingsView from '../views/SettingsView.js';
import * as PantryBankView from '../views/PantryBankView.js';
import * as ProductBankView from '../views/ProductBankView.js';
import * as DataQualityView from '../views/DataQualityView.js';

let activeViewModule = null;

const viewModuleMap = {
  today: TodayView,
  planner: PlannerView,
  planlib: PlannerView,
  vault: RecipeVaultView,
  settings: SettingsView,
  prefs: SettingsView,
  ingredients: PantryBankView,
  pantry: PantryBankView,
  bank: ProductBankView,
  data: DataQualityView,
  quality: DataQualityView,
  shopping: PlannerView
};

// Global scroll listener for Apple Large Title collapsing behavior
if (typeof window !== 'undefined' && !window._iosNavScrollInitialized) {
  window._iosNavScrollInitialized = true;
  window.addEventListener('scroll', () => {
    const navBar = document.querySelector('.view.active .ios-nav-bar') || document.querySelector('.ios-nav-bar');
    if (navBar) {
      navBar.classList.toggle('scrolled', window.scrollY > 20);
    }
  }, { passive: true });
}

export function syncMobileNavigation(viewId) {
  const mobileNav = document.getElementById('mobile-nav');
  if (!mobileNav) return;
  const normalized = viewId === 'pantry' ? 'ingredients' : viewId;
  const buttons = mobileNav.querySelectorAll('button[data-view], .ios-tab-item[data-view]');
  buttons.forEach(btn => {
    const isTarget = btn.dataset.view === viewId || btn.dataset.view === normalized;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
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

  if (viewId === 'shopping') {
    if (typeof PlannerView.setPlannerWizardStep === 'function') {
      PlannerView.setPlannerWizardStep(3);
    }
  }

  // 1. Teardown active view module if it has unmount()
  if (activeViewModule && typeof activeViewModule.unmount === 'function') {
    try {
      activeViewModule.unmount();
    } catch (e) {
      console.warn('[AppRouter] Error unmounting previous view:', e);
    }
  }

  // Update desktop sidebar tabs
  const normalizedViewId = (viewId === 'pantry' || viewId === 'ingredients') ? 'ingredients' : (viewId === 'shopping' ? 'planner' : viewId);
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

  // Update mobile navigation tabs
  syncMobileNavigation(viewId);

  // Reset scroll state on nav bar
  const navBar = viewEl?.querySelector('.ios-nav-bar') || document.querySelector('.ios-nav-bar');
  if (navBar) {
    navBar.classList.remove('scrolled');
  }

  if (window.platePlanDirtyViews && window.platePlanDirtyViews.delete) {
    window.platePlanDirtyViews.delete(viewId);
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
}
