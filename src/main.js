/**
 * src/main.js (v3.3.25)
 * Native Delegated Action Bridge with Scrollable Product Substitution Routing (v3.3.25).
 */
import { waitForAuth } from './services/AuthService.js';
import { hydrateHouseholdData } from './services/HydrationService.js';
import { getState } from './store/store.js';

// 1. STRICT TYPE SANITIZATION
if (typeof window !== 'undefined') {
  if (typeof window.state !== 'object' || window.state === null) window.state = {};
  if (typeof window.state.userPrefs !== 'object' || window.state.userPrefs === null) window.state.userPrefs = {};
  if (typeof window.state.settings !== 'object' || window.state.settings === null) window.state.settings = {};

  window.state.recipes = Array.isArray(window.state.recipes) ? window.state.recipes : [];
  window.state.favourites = Array.isArray(window.state.favourites) ? window.state.favourites : [];
  window.state.userFavourites = Array.isArray(window.state.userFavourites) ? window.state.userFavourites : [];
  window.state.ingredients = Array.isArray(window.state.ingredients) ? window.state.ingredients : [];
  window.state.confirmedShopping = Array.isArray(window.state.confirmedShopping) ? window.state.confirmedShopping : [];
  
  window.state.userPrefs.favouriteVariantIds = Array.isArray(window.state.userPrefs.favouriteVariantIds) ? window.state.userPrefs.favouriteVariantIds : [];
  window.state.userPrefs.favourites = Array.isArray(window.state.userPrefs.favourites) ? window.state.userPrefs.favourites : [];

  window.favourites = window.state.favourites;
  window.userFavourites = window.state.userFavourites;
}

// Helper: Strip forced inline styles from all modal wrappers
function purgeModalOverrides() {
  const wrappers = document.querySelectorAll('#tesco-modal-wrap, .modal-wrap, .modal');
  wrappers.forEach((el) => {
    el.style.removeProperty('display');
    el.style.removeProperty('opacity');
    el.style.removeProperty('visibility');
    el.style.removeProperty('z-index');
    el.style.removeProperty('background');
    el.style.removeProperty('backdrop-filter');
  });
}

// Helper: Rename "Swap Brand" to "Swap Product" across DOM nodes
function patchSwapLabels() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = walker.nextNode()) {
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

// Initialize Real-Time Label Patching Observer
function initLabelObserver() {
  if (typeof window === 'undefined' || window.__pp_label_observer_active) return;
  window.__pp_label_observer_active = true;

  const observer = new MutationObserver(() => {
    patchSwapLabels();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  patchSwapLabels();
}

// 2. NATIVE DELEGATED ACTION BRIDGE & SCROLLABLE SUBSTITUTION ROUTING
function setupRecipeActionBridge() {
  if (typeof window === 'undefined' || window.__plateplan_action_bridge_attached) return;
  window.__plateplan_action_bridge_attached = true;

  initLabelObserver();

  const observeModals = () => {
    const tescoMaster = document.getElementById('tesco-modal-wrap');
    const modalWraps = document.querySelectorAll('.modal-wrap, .modal');
    const allTargets = [tescoMaster, ...modalWraps].filter(Boolean);

    allTargets.forEach((target) => {
      if (target.__pp_observed) return;
      target.__pp_observed = true;

      const observer = new MutationObserver(() => {
        const openChild = document.querySelector('.modal-wrap.open, .modal.open, [id$="-modal-wrap"].open');
        if (!openChild) {
          purgeModalOverrides();
        }
      });
      observer.observe(target, { attributes: true, attributeFilter: ['class'] });
    });
  };

  observeModals();

  document.addEventListener('click', (event) => {
    observeModals();
    patchSwapLabels();

    const closeBtn = event.target.closest('.close, .close-modal, .modal-backdrop, [data-pp-click*="close"]');
    const actionBtn = event.target.closest('[data-pp-click]');

    if (closeBtn && !actionBtn) {
      const activeModal = closeBtn.closest('.modal-wrap, .modal, [id$="-modal-wrap"]');
      if (activeModal) activeModal.classList.remove('open');
      setTimeout(purgeModalOverrides, 20);
      return;
    }

    if (!actionBtn) return;

    const actionStr = actionBtn.dataset.ppClick || actionBtn.getAttribute('data-pp-click');
    if (!actionStr) return;

    event.preventDefault();
    console.log(`[Action Bridge v3.3.25] Delegating action: "${actionStr}"`);

    try {
      // Robust Direct Routing for Scrollable Substitution Panels
      if (actionStr.includes('toggleInlineShoppingSubst')) {
        const rawArgs = actionStr.substring(actionStr.indexOf('(') + 1, actionStr.lastIndexOf(')'));
        const args = rawArgs.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
        
        if (typeof window.toggleInlineShoppingSubst === 'function' && args.length >= 2) {
          console.log(`[Action Bridge v3.3.25] Executing toggleInlineShoppingSubst with scrollable modal target:`, args[0], args[1]);
          window.toggleInlineShoppingSubst(args[0], args[1]);
          patchSwapLabels();
          return;
        }
      }

      if (typeof window.runPlatePlanDelegatedAction === 'function') {
        window.runPlatePlanDelegatedAction(actionStr, event, actionBtn);
      } else {
        const execFn = new Function('event', `with(window) { ${actionStr} }`);
        execFn.call(actionBtn, event);
      }

      // View & Substitution Interceptors
      if (actionStr.includes('planner') || actionStr.includes("showView('planner')")) {
        setTimeout(() => {
          if (typeof window.ensurePlannerShell === 'function') window.ensurePlannerShell();
        }, 50);
      }

      if (actionStr.includes('shopping') || actionStr.includes("showView('shopping')")) {
        setTimeout(() => {
          if (typeof window.renderShopping === 'function') {
            window.renderShopping();
            patchSwapLabels();
          }
        }, 50);
      }

      setTimeout(() => {
        const openChild = document.querySelector('.modal-wrap.open, .modal.open, [id$="-modal-wrap"].open');
        
        if (!openChild) {
          purgeModalOverrides();
        } else {
          const tescoMaster = document.getElementById('tesco-modal-wrap');
          if (tescoMaster) {
            tescoMaster.style.setProperty('display', 'block', 'important');
            tescoMaster.style.setProperty('background', 'transparent', 'important');
            tescoMaster.style.setProperty('backdrop-filter', 'none', 'important');
          }

          openChild.style.setProperty('display', 'flex', 'important');
          openChild.style.setProperty('visibility', 'visible', 'important');
          openChild.style.setProperty('opacity', '1', 'important');
          openChild.style.setProperty('z-index', '99999', 'important');
        }
      }, 50);

    } catch (err) {
      console.error(`[Action Bridge v3.3.25] Execution error for: ${actionStr}`, err);
    }
  }, true);
}

// Deep mutator to ensure clean recipes and variants
function deepMutate(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => deepMutate(item));
  
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (obj[key] === undefined || obj[key] === null) {
      if (['tags', 'categories', 'favourites', 'labels', 'ingredients', 'variants', 'steps', 'allergens', 'favouritedBy', 'userFavourites'].includes(key)) {
        obj[key] = [];
      } else {
        obj[key] = '';
      }
    } else {
      obj[key] = deepMutate(obj[key]);
    }
  }
  
  if (!Array.isArray(obj.tags)) obj.tags = [];
  if (!Array.isArray(obj.categories)) obj.categories = [];
  if (!Array.isArray(obj.variants)) obj.variants = [];
  if (!Array.isArray(obj.favourites)) obj.favourites = [];
  
  return obj;
}

function sanitizeRecipes(recipes) {
  if (!Array.isArray(recipes)) return [];
  return recipes.map(recipe => deepMutate(JSON.parse(JSON.stringify(recipe))));
}

function updateVersionBadge() {
  const footerEl = document.getElementById('app-version');
  if (footerEl) {
    footerEl.textContent = 'v3.3.25 (ES6 Modern)';
  }
}

document.addEventListener('plateplan:state:recipes', (e) => {
  const rawRecipes = e.detail || [];
  const cleanRecipes = sanitizeRecipes(rawRecipes);
  
  if (typeof window !== 'undefined') {
    window.state.recipes = cleanRecipes;
    window.allRecipes = cleanRecipes;
    if (typeof window.renderAll === 'function') {
      try { window.renderAll(); } catch (err) { console.warn('[Modern Bridge] renderAll warning:', err); }
    }
  }
  console.log(`[Modern Bridge v3.3.25] Action bridge synchronized with ${cleanRecipes.length} recipes.`);
});

async function initApp() {
  console.log('[Modern Bridge v3.3.25] Initializing secure ES6 bridge & authenticating...');
  updateVersionBadge();
  setupRecipeActionBridge();
  await waitForAuth();
  await hydrateHouseholdData();
}

initApp();
