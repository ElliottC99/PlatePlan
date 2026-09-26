/**
 * src/main.js (v3.3.27)
 * Native Delegated Action Bridge with Native Onclick Interception & Tiered Product Swap Modal.
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
  window.state.userPrefs.favourites = Array.isArray(window.state.userPrefs.favourites) ? window.state.favourites : [];

  window.favourites = window.state.favourites;
  window.userFavourites = window.state.userFavourites;
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

// 2. ENHANCED SWAP PRODUCT MODAL ROUTER
function renderScrollableSwapModal(groupKey, itemKey) {
  const existing = document.getElementById('pp-swap-product-modal');
  if (existing) existing.remove();

  const ingredients = window.state.ingredients || [];
  const currentGroup = window.state.confirmedShopping?.find(g => g.key === groupKey) || {};
  const targetItem = currentGroup.items?.find(i => i.key === itemKey) || {};

  // Match tier logic
  const sameSubtype = ingredients.filter(i => targetItem.subtype && i.subtype === targetItem.subtype);
  const sameIngredient = ingredients.filter(i => targetItem.name && i.name === targetItem.name && !sameSubtype.includes(i));

  const overlay = document.createElement('div');
  overlay.id = 'pp-swap-product-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);backdrop-filter:blur(3px);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

  const container = document.createElement('div');
  container.style.cssText = 'background:#fff;width:92%;max-width:580px;max-height:85vh;border-radius:16px;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;animation:ppPopIn 0.2s ease-out;';

  container.innerHTML = `
    <style>
      @keyframes ppPopIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      .pp-swap-card { padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 8px; cursor: pointer; transition: all 0.15s ease; background: #fff; }
      .pp-swap-card:hover { border-color: #3b82f6; background: #eff6ff; transform: translateY(-1px); }
      .pp-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px; display: inline-block; }
      .pp-badge-primary { background: #dbeafe; color: #1e40af; }
      .pp-badge-secondary { background: #f3f4f6; color: #374151; }
    </style>
    <div style="padding: 18px 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: #fafafa;">
      <div>
        <h3 style="margin: 0; font-size: 17px; font-weight: 700; color: #0f172a;">Swap Product</h3>
        <p style="margin: 2px 0 0 0; font-size: 13px; color: #64748b;">Target: <strong style="color: #334155;">${targetItem.name || 'Selected Item'}</strong></p>
      </div>
      <button id="pp-modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #94a3b8; line-height: 1;">&times;</button>
    </div>
    
    <div style="padding: 12px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
      <input type="text" id="pp-product-search" placeholder="🔍 Search product strings for alternatives..." style="width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box; outline: none;">
    </div>

    <div id="pp-product-list" style="padding: 16px 20px; overflow-y: auto; flex-grow: 1;">
      <!-- Populated dynamically -->
    </div>
  `;

  overlay.appendChild(container);
  document.body.appendChild(overlay);

  const listEl = container.querySelector('#pp-product-list');
  const searchInput = container.querySelector('#pp-product-search');

  function renderList(query = '') {
    let html = '';
    const cleanQ = query.toLowerCase().trim();

    if (!cleanQ) {
      // Tier 1: Same Subtype
      if (sameSubtype.length > 0) {
        html += `<div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #2563eb; margin-bottom: 8px;">First Preference: Same Subtype</div>`;
        sameSubtype.forEach(item => {
          html += `
            <div class="pp-swap-card" data-ing-id="${item.id || item.name}">
              <div style="display:flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; color: #1e293b; font-size: 14px;">${item.name}</span>
                <span class="pp-badge pp-badge-primary">Subtype Match</span>
              </div>
              ${item.brand ? `<div style="font-size: 12px; color: #64748b; margin-top: 4px;">Brand: ${item.brand}</div>` : ''}
            </div>`;
        });
      }

      // Tier 2: Same Ingredient
      if (sameIngredient.length > 0) {
        html += `<div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin: 16px 0 8px 0;">Second Preference: Same Ingredient Family</div>`;
        sameIngredient.forEach(item => {
          html += `
            <div class="pp-swap-card" data-ing-id="${item.id || item.name}">
              <div style="display:flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; color: #1e293b; font-size: 14px;">${item.name}</span>
                <span class="pp-badge pp-badge-secondary">Ingredient Match</span>
              </div>
            </div>`;
        });
      }
    }

    // Tier 3: Search Results / Global Search
    const filterMatches = ingredients.filter(i => 
      i.name?.toLowerCase().includes(cleanQ) || 
      i.subtype?.toLowerCase().includes(cleanQ) || 
      i.brand?.toLowerCase().includes(cleanQ)
    ).slice(0, 30);

    if (cleanQ || (sameSubtype.length === 0 && sameIngredient.length === 0)) {
      html += `<div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 8px;">Product Catalog (${filterMatches.length})</div>`;
      filterMatches.forEach(item => {
        html += `
          <div class="pp-swap-card" data-ing-id="${item.id || item.name}">
            <div style="display:flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 600; color: #1e293b; font-size: 14px;">${item.name}</span>
              ${item.subtype ? `<span class="pp-badge pp-badge-secondary">${item.subtype}</span>` : ''}
            </div>
          </div>`;
      });
    }

    if (!html) {
      html = `<div style="text-align: center; padding: 30px; color: #94a3b8; font-size: 14px;">No matching products found.</div>`;
    }

    listEl.innerHTML = html;

    // Attach click handlers to cards
    listEl.querySelectorAll('.pp-swap-card').forEach(card => {
      card.onclick = () => {
        const selectedId = card.dataset.ingId;
        console.log(`[Swap Product] Selected alternative: ${selectedId} for item: ${itemKey}`);
        if (typeof window.applyProductSwap === 'function') {
          window.applyProductSwap(groupKey, itemKey, selectedId);
        }
        overlay.remove();
      };
    });
  }

  renderList();

  searchInput.oninput = (e) => renderList(e.target.value);
  container.querySelector('#pp-modal-close').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

// Global override for toggleInlineShoppingSubst
window.toggleInlineShoppingSubst = function(groupKey, itemKey) {
  console.log(`[Modern Bridge v3.3.27] Launching Swap Product Modal for:`, groupKey, itemKey);
  renderScrollableSwapModal(groupKey, itemKey);
};

// 3. NATIVE DELEGATED ACTION BRIDGE WITH ONCLICK INTERCEPTION
function setupRecipeActionBridge() {
  if (typeof window === 'undefined' || window.__plateplan_action_bridge_attached) return;
  window.__plateplan_action_bridge_attached = true;

  initLabelObserver();

  document.addEventListener('click', (event) => {
    patchSwapLabels();

    // Target elements with data-pp-click OR inline onclick matching toggleInlineShoppingSubst
    const target = event.target.closest('[data-pp-click], [onclick*="toggleInlineShoppingSubst"], button');
    if (!target) return;

    const onclickStr = target.getAttribute('onclick') || '';
    const ppClickStr = target.dataset.ppClick || target.getAttribute('data-pp-click') || '';
    const actionStr = ppClickStr || onclickStr;

    if (actionStr.includes('toggleInlineShoppingSubst')) {
      event.preventDefault();
      event.stopPropagation();

      const rawArgs = actionStr.substring(actionStr.indexOf('(') + 1, actionStr.lastIndexOf(')'));
      const args = rawArgs.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));

      console.log(`[Action Bridge v3.3.27] Intercepted Swap Action:`, args);
      window.toggleInlineShoppingSubst(args[0] || '', args[1] || '');
      return;
    }

    if (ppClickStr) {
      event.preventDefault();
      if (typeof window.runPlatePlanDelegatedAction === 'function') {
        window.runPlatePlanDelegatedAction(ppClickStr, event, target);
      } else {
        const execFn = new Function('event', `with(window) { ${ppClickStr} }`);
        execFn.call(target, event);
      }
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
  return obj;
}

function sanitizeRecipes(recipes) {
  if (!Array.isArray(recipes)) return [];
  return recipes.map(recipe => deepMutate(JSON.parse(JSON.stringify(recipe))));
}

function updateVersionBadge() {
  const footerEl = document.getElementById('app-version');
  if (footerEl) {
    footerEl.textContent = 'v3.3.27 (ES6 Modern)';
  }
}

document.addEventListener('plateplan:state:recipes', (e) => {
  const rawRecipes = e.detail || [];
  const cleanRecipes = sanitizeRecipes(rawRecipes);
  if (typeof window !== 'undefined') {
    window.state.recipes = cleanRecipes;
    window.allRecipes = cleanRecipes;
  }
});

async function initApp() {
  console.log('[Modern Bridge v3.3.27] Initializing secure ES6 bridge & authenticating...');
  updateVersionBadge();
  setupRecipeActionBridge();
  await waitForAuth();
  await hydrateHouseholdData();
}

initApp();
