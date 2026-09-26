/**
 * src/main.js (v3.3.32)
 * Phase 11.2: Hydration & Firestore Persistence Bridge for Preferences & Targets.
 */
import { waitForAuth } from './services/AuthService.js';
import { hydrateHouseholdData } from './services/HydrationService.js';
import { savePreferences } from './services/HouseholdRepository.js';
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

// ----------------------------------------------------------------------------
// PHASE 10: SHOPPING LIST LAYOUT & SUMMARY
// ----------------------------------------------------------------------------
export function renderShoppingSummary() {
  const summaryContainer = document.getElementById('shop-summary');
  if (!summaryContainer) return;

  const shoppingData = window.state?.confirmedShopping || [];
  let totalItemCount = 0;
  let totalPrice = 0;

  shoppingData.forEach(group => {
    if (Array.isArray(group.items)) {
      group.items.forEach(item => {
        totalItemCount += 1;
        totalPrice += Number(item.price || item.cost || 2.50);
      });
    }
  });

  if (totalItemCount === 0 && window.state?.ingredients?.length > 0) {
    totalItemCount = Math.min(24, window.state.ingredients.length);
    totalPrice = totalItemCount * 1.85;
  }

  summaryContainer.innerHTML = `
    <style>
      .pp-summary-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    </style>
    <div class="pp-summary-card">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px;">
        <div style="display: flex; gap: 20px; align-items: center;">
          <div>
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Est. Total Cost</div>
            <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 1px;">£${totalPrice.toFixed(2)}</div>
          </div>
          <div style="border-left: 1px solid #e2e8f0; height: 32px;"></div>
          <div>
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Total Items</div>
            <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 1px;">${totalItemCount} <span style="font-size: 13px; font-weight: 500; color: #64748b;">items</span></div>
          </div>
        </div>

        <div style="font-size: 12px; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 8px;">
          🛒 Shopping list generated from active household meal plan.
        </div>
      </div>
    </div>
  `;
}

export function renderShoppingListUI() {
  renderShoppingSummary();

  const contentContainer = document.getElementById('shop-content');
  if (!contentContainer) return;

  const rawShopping = window.state?.confirmedShopping || [];
  const ingredients = window.state?.ingredients || [];

  let categoriesMap = {};

  if (rawShopping.length > 0) {
    rawShopping.forEach(group => {
      const catName = group.name || group.category || 'General Groceries';
      if (!categoriesMap[catName]) categoriesMap[catName] = [];
      if (Array.isArray(group.items)) {
        group.items.forEach(item => categoriesMap[catName].push({ ...item, groupKey: group.key }));
      }
    });
  } else if (ingredients.length > 0) {
    ingredients.forEach(ing => {
      const cat = ing.category || ing.type || 'Produce & Fresh';
      if (!categoriesMap[cat]) categoriesMap[cat] = [];
      categoriesMap[cat].push({
        key: ing.id || ing.name,
        name: ing.name,
        brand: ing.brand || 'Tesco',
        quantity: '1 pack',
        price: ing.price || 1.85,
        groupKey: cat
      });
    });
  } else {
    categoriesMap = {
      'Fresh Produce': [
        { key: 'item-1', name: 'Fresh Salad Tomatoes', brand: 'Tesco', quantity: '6 pack', price: 1.25, groupKey: 'Fresh Produce' },
        { key: 'item-2', name: 'Organic Brown Onions', brand: 'Tesco Organic', quantity: '1kg', price: 1.10, groupKey: 'Fresh Produce' }
      ],
      'Dairy & Eggs': [
        { key: 'item-3', name: 'British Semi Skimmed Milk', brand: 'Tesco', quantity: '4 Pints', price: 1.55, groupKey: 'Dairy & Eggs' },
        { key: 'item-4', name: 'Free Range Large Eggs', brand: 'St Ewe', quantity: '6 pack', price: 2.40, groupKey: 'Dairy & Eggs' }
      ],
      'Meat & Protein': [
        { key: 'item-5', name: 'Lean Beef Mince 5% Fat', brand: 'Tesco Finest', quantity: '500g', price: 4.25, groupKey: 'Meat & Protein' }
      ]
    };
  }

  let html = `
    <style>
      .pp-shop-category { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
      .pp-shop-cat-header { background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
      .pp-shop-item { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; gap: 12px; transition: background 0.1s ease; }
      .pp-shop-item:last-child { border-bottom: none; }
      .pp-shop-item:hover { background: #fafafa; }
      .pp-swap-btn { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
      .pp-swap-btn:hover { background: #e2e8f0; color: #0f172a; border-color: #94a3b8; }
    </style>
    <div style="display: flex; flex-direction: column; gap: 4px;">
  `;

  Object.keys(categoriesMap).forEach(catName => {
    const items = categoriesMap[catName];
    if (!items || items.length === 0) return;

    html += `
      <div class="pp-shop-category">
        <div class="pp-shop-cat-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 700; font-size: 15px; color: #0f172a;">${catName}</span>
            <span style="background: #e2e8f0; color: #475569; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 10px;">${items.length}</span>
          </div>
        </div>

        <div>
          ${items.map(item => `
            <div class="pp-shop-item">
              <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <input type="checkbox" style="width: 16px; height: 16px; cursor: pointer; accent-color: #2563eb;">
                <div>
                  <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span style="font-weight: 600; font-size: 14px; color: #1e293b;">${item.name}</span>
                    ${item.brand ? `<span style="font-size: 11px; font-weight: 600; background: #f1f5f9; color: #64748b; padding: 1px 6px; border-radius: 4px;">${item.brand}</span>` : ''}
                  </div>
                  <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                    Qty: <strong>${item.quantity || '1'}</strong> &bull; Est. £${Number(item.price || 1.85).toFixed(2)}
                  </div>
                </div>
              </div>

              <div>
                <button class="pp-swap-btn" data-pp-click="toggleInlineShoppingSubst('${item.groupKey || catName}', '${item.key || item.name}')">
                  🔁 Swap Product
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  contentContainer.innerHTML = html;
  patchSwapLabels();
}

window.renderShopping = function() {
  renderShoppingListUI();
};
window.renderShoppingList = function() {
  renderShoppingListUI();
};

// ----------------------------------------------------------------------------
// PHASE 11.1: SETTINGS VIEW & USER PREFERENCES
// ----------------------------------------------------------------------------
export function renderSettingsView() {
  const container = document.getElementById('view-prefs') || document.getElementById('view-settings');
  if (!container) return;

  const prefs = window.state?.userPrefs || {};
  const settings = window.state?.settings || {};
  const targets = prefs.nutritionTargets || {};
  const eTargets = targets.elliott || {};
  const eMeals = eTargets.meals || {};
  const cTargets = targets.chloe || {};
  const cMeals = cTargets.meals || {};

  const elliottDailyCal = prefs.elliottCal || eTargets.dailyKcal || 2200;
  const elliottDailyProt = prefs.elliottProt || eTargets.dailyProtein || 140;
  const elliottBfCal = eMeals.breakfast?.kcal ?? 550;
  const elliottBfProt = eMeals.breakfast?.protein ?? 35;
  const elliottLuCal = eMeals.lunch?.kcal ?? 650;
  const elliottLuProt = eMeals.lunch?.protein ?? 40;
  const elliottDiCal = eMeals.dinner?.kcal ?? 750;
  const elliottDiProt = eMeals.dinner?.protein ?? 45;
  const elliottSnCal = eMeals.snacking?.kcal ?? 250;
  const elliottSnProt = eMeals.snacking?.protein ?? 20;

  const chloeDailyCal = prefs.chloeCal || cTargets.dailyKcal || 1800;
  const chloeDailyProt = prefs.chloeProt || cTargets.dailyProtein || 110;
  const chloeBfCal = cMeals.breakfast?.kcal ?? 450;
  const chloeBfProt = cMeals.breakfast?.protein ?? 25;
  const chloeLuCal = cMeals.lunch?.kcal ?? 500;
  const chloeLuProt = cMeals.lunch?.protein ?? 30;
  const chloeDiCal = cMeals.dinner?.kcal ?? 650;
  const chloeDiProt = cMeals.dinner?.protein ?? 40;
  const chloeSnCal = cMeals.snacking?.kcal ?? 200;
  const chloeSnProt = cMeals.snacking?.protein ?? 15;

  container.innerHTML = `
    <style>
      .pp-settings-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
      .pp-settings-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; }
      .pp-settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
      .pp-input-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
      .pp-input-group label { font-size: 12px; font-weight: 600; color: #475569; }
      .pp-input-group input, .pp-input-group select { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; outline: none; background: #fff; }
      .pp-input-group input:focus, .pp-input-group select:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.2); }
      .pp-badge-status { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; background: #dcfce7; color: #15803d; display: inline-block; }
    </style>

    <div style="margin-bottom: 20px;">
      <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Preferences & Settings</h2>
      <p style="font-size: 13px; color: #64748b; margin: 0;">Configure household targets, dietary restrictions, product mapping, and system parameters.</p>
    </div>

    <!-- 1. Household & Profile Info -->
    <div class="pp-settings-card">
      <div class="pp-settings-title">🏠 Household & Account Profile</div>
      <div class="pp-settings-grid">
        <div style="background: #f8fafc; border: 1px solid #f1f5f9; padding: 14px; border-radius: 10px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Household Scope</div>
          <div style="font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 2px;">elliott-chloe</div>
          <div style="margin-top: 6px;"><span class="pp-badge-status">Active Session</span></div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #f1f5f9; padding: 14px; border-radius: 10px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Household Members</div>
          <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">Elliott & Chloe</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Synchronized across all devices</div>
        </div>
      </div>
    </div>

    <!-- 2. Dietary Preferences & Restrictions -->
    <div class="pp-settings-card">
      <div class="pp-settings-title">🥗 Dietary Preferences & Restrictions</div>
      <div class="pp-settings-grid">
        <div class="pp-input-group">
          <label for="pp-setting-diet">Dietary Pattern</label>
          <select id="pp-setting-diet">
            <option value="none" ${prefs.diet === 'none' ? 'selected' : ''}>No Restrictions</option>
            <option value="vegetarian" ${prefs.diet === 'vegetarian' ? 'selected' : ''}>Vegetarian</option>
            <option value="vegan" ${prefs.diet === 'vegan' ? 'selected' : ''}>Vegan</option>
            <option value="pescatarian" ${prefs.diet === 'pescatarian' ? 'selected' : ''}>Pescatarian</option>
          </select>
        </div>

        <div class="pp-input-group">
          <label for="pp-setting-strategy">Default Product Auto-Mapping Strategy</label>
          <select id="pp-setting-strategy">
            <option value="protein_per_kcal" ${settings.mappingStrategy === 'protein_per_kcal' ? 'selected' : ''}>Protein per kcal (Recommended)</option>
            <option value="protein_per_pound" ${settings.mappingStrategy === 'protein_per_pound' ? 'selected' : ''}>Protein per £</option>
            <option value="lowest_cost_per_g" ${settings.mappingStrategy === 'lowest_cost_per_g' ? 'selected' : ''}>Lowest £ per Gram</option>
            <option value="lowest_cost_per_unit" ${settings.mappingStrategy === 'lowest_cost_per_unit' ? 'selected' : ''}>Lowest £ per Unit</option>
          </select>
        </div>
      </div>

      <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 16px;">
        <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
          <input type="checkbox" id="pp-setting-gf" ${prefs.glutenFree ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #2563eb;"> Gluten-Free Only
        </label>
        <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
          <input type="checkbox" id="pp-setting-df" ${prefs.dairyFree ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #2563eb;"> Dairy-Free Only
        </label>
        <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
          <input type="checkbox" id="pp-setting-nutfree" ${prefs.nutFree ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #2563eb;"> Nut-Free
        </label>
      </div>
    </div>

    <!-- 3. Macro Targets & Allocation -->
    <div class="pp-settings-card">
      <div class="pp-settings-title">⚡ Daily Nutritional Targets & 4-Meal Breakdown</div>
      <p style="font-size: 12px; color: #64748b; margin: -4px 0 16px 0;">Individual calorie and protein targets across Breakfast, Lunch, Dinner, and Snacking/Drinking for Elliott & Chloe.</p>

      <div class="pp-settings-grid">
        <!-- Elliott Card -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 12px;">
          <div style="font-weight: 700; font-size: 15px; color: #2563eb; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <span>Elliott's Targets</span>
            <span style="font-size: 11px; background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 10px; font-weight: 600;">Member 1</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1;">
            <div class="pp-input-group" style="margin-bottom:0;">
              <label>Daily Calories (kcal)</label>
              <input type="number" id="pp-macro-e-cal" value="${elliottDailyCal}">
            </div>
            <div class="pp-input-group" style="margin-bottom:0;">
              <label>Daily Protein (g)</label>
              <input type="number" id="pp-macro-e-prot" value="${elliottDailyProt}">
            </div>
          </div>

          <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 8px; text-transform: uppercase;">4-Meal Slot Breakdown</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🍳 Breakfast</span>
              <input type="number" id="pp-macro-e-bf-cal" value="${elliottBfCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-e-bf-prot" value="${elliottBfProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>

            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🥗 Lunch</span>
              <input type="number" id="pp-macro-e-lu-cal" value="${elliottLuCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-e-lu-prot" value="${elliottLuProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>

            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🍲 Dinner</span>
              <input type="number" id="pp-macro-e-di-cal" value="${elliottDiCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-e-di-prot" value="${elliottDiProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>

            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🥤 Snacking</span>
              <input type="number" id="pp-macro-e-sn-cal" value="${elliottSnCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-e-sn-prot" value="${elliottSnProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>
          </div>
        </div>

        <!-- Chloe Card -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 12px;">
          <div style="font-weight: 700; font-size: 15px; color: #ec4899; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <span>Chloe's Targets</span>
            <span style="font-size: 11px; background: #fce7f3; color: #be185d; padding: 2px 8px; border-radius: 10px; font-weight: 600;">Member 2</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1;">
            <div class="pp-input-group" style="margin-bottom:0;">
              <label>Daily Calories (kcal)</label>
              <input type="number" id="pp-macro-c-cal" value="${chloeDailyCal}">
            </div>
            <div class="pp-input-group" style="margin-bottom:0;">
              <label>Daily Protein (g)</label>
              <input type="number" id="pp-macro-c-prot" value="${chloeDailyProt}">
            </div>
          </div>

          <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 8px; text-transform: uppercase;">4-Meal Slot Breakdown</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🍳 Breakfast</span>
              <input type="number" id="pp-macro-c-bf-cal" value="${chloeBfCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-c-bf-prot" value="${chloeBfProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>

            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🥗 Lunch</span>
              <input type="number" id="pp-macro-c-lu-cal" value="${chloeLuCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-c-lu-prot" value="${chloeLuProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>

            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🍲 Dinner</span>
              <input type="number" id="pp-macro-c-di-cal" value="${chloeDiCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-c-di-prot" value="${chloeDiProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>

            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🥤 Snacking</span>
              <input type="number" id="pp-macro-c-sn-cal" value="${chloeSnCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-c-sn-prot" value="${chloeSnProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. System & Display Settings -->
    <div class="pp-settings-card">
      <div class="pp-settings-title">⚙️ System & Display</div>
      <div class="pp-settings-grid">
        <div class="pp-input-group">
          <label>Appearance Theme</label>
          <select id="pp-setting-theme">
            <option value="system" ${settings.theme === 'system' ? 'selected' : ''}>System Default</option>
            <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light Theme</option>
            <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark Theme</option>
          </select>
        </div>

        <div class="pp-input-group">
          <label>Active Architecture Version</label>
          <input type="text" value="v3.3.32 (ES6 Modern)" readonly style="background: #f8fafc; color: #475569; font-weight: 600;">
        </div>
      </div>

      <div style="margin-top: 16px; display: flex; gap: 10px;">
        <button id="pp-save-settings-btn" style="background: #2563eb; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">
          Save Preferences
        </button>
        <button id="pp-refresh-data-btn" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer;">
          Refresh Household Data
        </button>
      </div>
    </div>
  `;

  // Attach Save listener
  const saveBtn = container.querySelector('#pp-save-settings-btn');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      window.state.userPrefs = window.state.userPrefs || {};
      window.state.userPrefs.diet = container.querySelector('#pp-setting-diet')?.value || 'none';
      window.state.userPrefs.glutenFree = container.querySelector('#pp-setting-gf')?.checked || false;
      window.state.userPrefs.dairyFree = container.querySelector('#pp-setting-df')?.checked || false;
      window.state.userPrefs.nutFree = container.querySelector('#pp-setting-nutfree')?.checked || false;

      const eDailyCal = Number(container.querySelector('#pp-macro-e-cal')?.value || 2200);
      const eDailyProt = Number(container.querySelector('#pp-macro-e-prot')?.value || 140);
      const cDailyCal = Number(container.querySelector('#pp-macro-c-cal')?.value || 1800);
      const cDailyProt = Number(container.querySelector('#pp-macro-c-prot')?.value || 110);

      window.state.userPrefs.elliottCal = eDailyCal;
      window.state.userPrefs.elliottProt = eDailyProt;
      window.state.userPrefs.chloeCal = cDailyCal;
      window.state.userPrefs.chloeProt = cDailyProt;

      window.state.userPrefs.nutritionTargets = {
        elliott: {
          dailyKcal: eDailyCal,
          dailyProtein: eDailyProt,
          meals: {
            breakfast: {
              kcal: Number(container.querySelector('#pp-macro-e-bf-cal')?.value || 550),
              protein: Number(container.querySelector('#pp-macro-e-bf-prot')?.value || 35)
            },
            lunch: {
              kcal: Number(container.querySelector('#pp-macro-e-lu-cal')?.value || 650),
              protein: Number(container.querySelector('#pp-macro-e-lu-prot')?.value || 40)
            },
            dinner: {
              kcal: Number(container.querySelector('#pp-macro-e-di-cal')?.value || 750),
              protein: Number(container.querySelector('#pp-macro-e-di-prot')?.value || 45)
            },
            snacking: {
              kcal: Number(container.querySelector('#pp-macro-e-sn-cal')?.value || 250),
              protein: Number(container.querySelector('#pp-macro-e-sn-prot')?.value || 20)
            }
          }
        },
        chloe: {
          dailyKcal: cDailyCal,
          dailyProtein: cDailyProt,
          meals: {
            breakfast: {
              kcal: Number(container.querySelector('#pp-macro-c-bf-cal')?.value || 450),
              protein: Number(container.querySelector('#pp-macro-c-bf-prot')?.value || 25)
            },
            lunch: {
              kcal: Number(container.querySelector('#pp-macro-c-lu-cal')?.value || 500),
              protein: Number(container.querySelector('#pp-macro-c-lu-prot')?.value || 30)
            },
            dinner: {
              kcal: Number(container.querySelector('#pp-macro-c-di-cal')?.value || 650),
              protein: Number(container.querySelector('#pp-macro-c-di-prot')?.value || 40)
            },
            snacking: {
              kcal: Number(container.querySelector('#pp-macro-c-sn-cal')?.value || 200),
              protein: Number(container.querySelector('#pp-macro-c-sn-prot')?.value || 15)
            }
          }
        }
      };

      window.state.settings = window.state.settings || {};
      window.state.settings.mappingStrategy = container.querySelector('#pp-setting-strategy')?.value || 'protein_per_kcal';
      window.state.settings.theme = container.querySelector('#pp-setting-theme')?.value || 'system';

      console.log('[Settings v3.3.32] Saved user preferences to state:', window.state.userPrefs);
      
      // Persist to Firestore
      await savePreferences(window.state.userPrefs, window.state.settings);

      // Dispatch CustomEvent
      document.dispatchEvent(new CustomEvent('plateplan:state:preferences', { detail: window.state.userPrefs }));

      saveBtn.disabled = false;
      saveBtn.textContent = '✓ Preferences Saved';
      saveBtn.style.background = '#16a34a';
      setTimeout(() => {
        saveBtn.textContent = 'Save Preferences';
        saveBtn.style.background = '#2563eb';
      }, 1800);
    };
  }

  // Attach Refresh Data listener
  const refreshBtn = container.querySelector('#pp-refresh-data-btn');
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      console.log('[Settings v3.3.32] Triggering household data refresh...');
      hydrateHouseholdData();
    };
  }
}

window.renderSettings = function() {
  renderSettingsView();
};

// ----------------------------------------------------------------------------
// HELPER & PRODUCT SWAP UTILITIES
// ----------------------------------------------------------------------------
function calculateMetrics(item) {
  const protein = Number(item.protein || item.macros?.protein || 0);
  const kcal = Number(item.calories || item.kcal || item.macros?.calories || 0);
  const price = Number(item.price || item.cost || 0);

  const proteinPerKcal = kcal > 0 ? (protein / kcal) : 0;
  const proteinPerPound = price > 0 ? (protein / price) : 0;

  return { protein, kcal, price, proteinPerKcal, proteinPerPound };
}

function resolveTargetItem(groupKey, itemKey) {
  const sources = [
    window.state?.confirmedShopping,
    window.state?.shoppingList,
    window.state?.generatedList
  ];

  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const group of source) {
      if (group.key === groupKey || group.id === groupKey || group.name === groupKey) {
        const item = group.items?.find(i => i.key === itemKey || i.id === itemKey || i.name === itemKey);
        if (item) return { item, group, source };
      }
      const item = group.items?.find(i => i.key === itemKey || i.id === itemKey);
      if (item) return { item, group, source };
    }
  }

  const ing = (window.state?.ingredients || []).find(i => i.id === itemKey || i.key === itemKey || i.name === itemKey);
  if (ing) return { item: ing, group: null, source: null };

  return { item: { name: itemKey || 'Selected Item' }, group: null, source: null };
}

function renderScrollableSwapModal(groupKey, itemKey) {
  const existing = document.getElementById('pp-swap-product-modal');
  if (existing) existing.remove();

  const { item: targetItem, group: targetGroup } = resolveTargetItem(groupKey, itemKey);
  const ingredients = window.state?.ingredients || [];

  const targetSubtype = targetItem.subtype || targetItem.category || '';
  const targetName = targetItem.name || targetItem.ingredient || '';

  const tier1SameSubtype = ingredients.filter(i => 
    targetSubtype && (i.subtype === targetSubtype || i.category === targetSubtype) && i.name !== targetName
  );

  const tier2SameIngredient = ingredients.filter(i => 
    targetName && (i.name?.toLowerCase().includes(targetName.toLowerCase()) || i.ingredient?.toLowerCase().includes(targetName.toLowerCase())) &&
    !tier1SameSubtype.includes(i)
  );

  let currentSort = 'relevance';
  let currentScope = 'global';

  const overlay = document.createElement('div');
  overlay.id = 'pp-swap-product-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);backdrop-filter:blur(3px);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

  const container = document.createElement('div');
  container.style.cssText = 'background:#fff;width:94%;max-width:620px;max-height:88vh;border-radius:16px;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;';

  container.innerHTML = `
    <style>
      .pp-swap-card { padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 8px; cursor: pointer; transition: all 0.15s ease; background: #fff; }
      .pp-swap-card:hover { border-color: #2563eb; background: #eff6ff; }
      .pp-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px; }
      .pp-badge-primary { background: #dbeafe; color: #1e40af; }
      .pp-badge-secondary { background: #f3f4f6; color: #374151; }
      .pp-metric-pill { font-size: 11px; background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; margin-right: 6px; display: inline-block; }
    </style>
    
    <div style="padding: 18px 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: #fafafa;">
      <div>
        <h3 style="margin: 0; font-size: 17px; font-weight: 700; color: #0f172a;">Swap Product</h3>
        <p style="margin: 2px 0 0 0; font-size: 13px; color: #64748b;">
          Swapping: <strong style="color: #2563eb;">${targetItem.brand ? targetItem.brand + ' - ' : ''}${targetItem.name}</strong>
        </p>
      </div>
      <button id="pp-modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #94a3b8; line-height: 1;">&times;</button>
    </div>

    <div style="padding: 12px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 10px;">
      ${targetGroup?.recipeName ? `
      <div style="display: flex; gap: 10px; align-items: center; font-size: 12px; background: #fff; padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1;">
        <span style="font-weight: 600; color: #334155;">Swap Scope:</span>
        <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
          <input type="radio" name="pp-swap-scope" value="global" checked> All recipes
        </label>
        <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; margin-left: 10px;">
          <input type="radio" name="pp-swap-scope" value="recipe"> Only for "${targetGroup.recipeName}"
        </label>
      </div>
      ` : ''}

      <div style="display: flex; gap: 10px;">
        <input type="text" id="pp-product-search" placeholder="🔍 Search catalog..." style="flex: 1; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; outline: none;">
        
        <select id="pp-product-sort" style="padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; background: #fff; cursor: pointer;">
          <option value="relevance">Sort: Default</option>
          <option value="name">Sort: Name (A-Z)</option>
          <option value="proteinPerKcal">Sort: Protein / kcal</option>
          <option value="proteinPerPound">Sort: Protein / £</option>
          <option value="price">Sort: Price (Low to High)</option>
        </select>
      </div>
    </div>

    <div id="pp-product-list" style="padding: 16px 20px; overflow-y: auto; flex-grow: 1;"></div>
  `;

  overlay.appendChild(container);
  document.body.appendChild(overlay);

  const listEl = container.querySelector('#pp-product-list');
  const searchInput = container.querySelector('#pp-product-search');
  const sortSelect = container.querySelector('#pp-product-sort');

  container.querySelectorAll('input[name="pp-swap-scope"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentScope = e.target.value;
    });
  });

  function sortItems(items) {
    const sorted = [...items];
    switch (currentSort) {
      case 'name':
        return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      case 'proteinPerKcal':
        return sorted.sort((a, b) => calculateMetrics(b).proteinPerKcal - calculateMetrics(a).proteinPerKcal);
      case 'proteinPerPound':
        return sorted.sort((a, b) => calculateMetrics(b).proteinPerPound - calculateMetrics(a).proteinPerPound);
      case 'price':
        return sorted.sort((a, b) => calculateMetrics(a).price - calculateMetrics(b).price);
      default:
        return sorted;
    }
  }

  function renderCardHTML(item, badgeText, badgeClass) {
    const metrics = calculateMetrics(item);
    return `
      <div class="pp-swap-card" data-ing-id="${item.id || item.name}">
        <div style="display:flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">${item.brand || 'Generic'}</span>
            <div style="font-weight: 600; color: #1e293b; font-size: 14px; margin-top: 1px;">${item.name}</div>
          </div>
          ${badgeText ? `<span class="pp-badge ${badgeClass}">${badgeText}</span>` : ''}
        </div>
        <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;">
          ${metrics.price ? `<span class="pp-metric-pill">£${metrics.price.toFixed(2)}</span>` : ''}
          ${metrics.protein ? `<span class="pp-metric-pill">${metrics.protein}g protein</span>` : ''}
          ${metrics.proteinPerKcal ? `<span class="pp-metric-pill">${(metrics.proteinPerKcal * 100).toFixed(1)}g prot/100kcal</span>` : ''}
          ${metrics.proteinPerPound ? `<span class="pp-metric-pill">${metrics.proteinPerPound.toFixed(1)}g prot/£</span>` : ''}
        </div>
      </div>`;
  }

  function renderList(query = '') {
    let html = '';
    const cleanQ = query.toLowerCase().trim();

    if (!cleanQ) {
      const sortedT1 = sortItems(tier1SameSubtype);
      if (sortedT1.length > 0) {
        html += `<div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #2563eb; margin-bottom: 8px;">Tier 1: Same Subtype (${targetSubtype})</div>`;
        sortedT1.forEach(item => html += renderCardHTML(item, 'Subtype Match', 'pp-badge-primary'));
      }

      const sortedT2 = sortItems(tier2SameIngredient);
      if (sortedT2.length > 0) {
        html += `<div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; margin: 16px 0 8px 0;">Tier 2: Same Ingredient Family</div>`;
        sortedT2.forEach(item => html += renderCardHTML(item, 'Ingredient Match', 'pp-badge-secondary'));
      }
    }

    const globalList = ingredients.filter(i => 
      !cleanQ ? (!tier1SameSubtype.includes(i) && !tier2SameIngredient.includes(i)) :
      (i.name?.toLowerCase().includes(cleanQ) || i.brand?.toLowerCase().includes(cleanQ) || i.subtype?.toLowerCase().includes(cleanQ))
    );

    const sortedT3 = sortItems(globalList).slice(0, 30);
    if (sortedT3.length > 0) {
      html += `<div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 16px 0 8px 0;">
        ${cleanQ ? 'Search Results' : 'Tier 3: Full Product Catalog'} (${sortedT3.length})
      </div>`;
      sortedT3.forEach(item => html += renderCardHTML(item, item.subtype || '', 'pp-badge-secondary'));
    }

    if (!html) {
      html = `<div style="text-align: center; padding: 30px; color: #94a3b8; font-size: 14px;">No matching products found.</div>`;
    }

    listEl.innerHTML = html;

    listEl.querySelectorAll('.pp-swap-card').forEach(card => {
      card.onclick = () => {
        const selectedId = card.dataset.ingId;
        const selectedProduct = ingredients.find(i => (i.id || i.name) === selectedId) || { name: selectedId };
        
        executeSwapInState(groupKey, itemKey, selectedProduct, currentScope);
        overlay.remove();
      };
    });
  }

  function executeSwapInState(groupKey, itemKey, newProduct, scope) {
    console.log(`[Swap Executed] Scope: ${scope}, Target Group: ${groupKey}, Item: ${itemKey}, Replacement:`, newProduct);

    const shoppingLists = ['confirmedShopping', 'shoppingList', 'generatedList'];

    shoppingLists.forEach(listKey => {
      if (!Array.isArray(window.state[listKey])) return;

      window.state[listKey].forEach(group => {
        if (scope === 'recipe' && group.key !== groupKey && group.id !== groupKey) return;

        if (Array.isArray(group.items)) {
          group.items.forEach(item => {
            if (item.key === itemKey || item.id === itemKey || item.name === targetItem.name) {
              item.name = newProduct.name;
              item.brand = newProduct.brand || '';
              item.ingredientId = newProduct.id || item.ingredientId;
              item.price = newProduct.price || item.price;
              item.protein = newProduct.protein || item.protein;
              item.calories = newProduct.calories || item.calories;
            }
          });
        }
      });
    });

    document.dispatchEvent(new CustomEvent('plateplan:state:shopping', { detail: window.state.confirmedShopping }));
    renderShoppingListUI();
  }

  renderList();

  searchInput.oninput = (e) => renderList(e.target.value);
  sortSelect.onchange = (e) => { currentSort = e.target.value; renderList(searchInput.value); };
  container.querySelector('#pp-modal-close').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

window.toggleInlineShoppingSubst = function(groupKey, itemKey) {
  renderScrollableSwapModal(groupKey, itemKey);
};

// ----------------------------------------------------------------------------
// NATIVE DELEGATED ACTION BRIDGE
// ----------------------------------------------------------------------------
function setupRecipeActionBridge() {
  if (typeof window === 'undefined' || window.__plateplan_action_bridge_attached) return;
  window.__plateplan_action_bridge_attached = true;

  initLabelObserver();

  document.addEventListener('click', (event) => {
    patchSwapLabels();

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

      console.log(`[Action Bridge v3.3.32] Intercepted Swap Action:`, args);
      window.toggleInlineShoppingSubst(args[0] || '', args[1] || '');
      return;
    }

    if (actionStr.includes('shopping') || actionStr.includes("showView('shopping')")) {
      setTimeout(() => {
        renderShoppingListUI();
      }, 50);
    }

    if (actionStr.includes('prefs') || actionStr.includes('settings') || actionStr.includes("showView('prefs')")) {
      setTimeout(() => {
        renderSettingsView();
      }, 50);
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
  const footerEl = document.getElementById('app-version') || document.getElementById('plateplan-update-version');
  if (footerEl) {
    footerEl.textContent = 'v3.3.32 (ES6 Modern)';
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

document.addEventListener('plateplan:state:shopping', () => {
  renderShoppingListUI();
});

document.addEventListener('plateplan:state:preferences', () => {
  renderSettingsView();
});

async function initApp() {
  console.log('[Modern Bridge v3.3.32] Initializing secure ES6 bridge & authenticating...');
  updateVersionBadge();
  setupRecipeActionBridge();
  await waitForAuth();
  await hydrateHouseholdData();
}

initApp();
