/**
 * src/views/ShoppingView.js (v3.3.34)
 * Componentized Shopping List and Product Substitution Modal View.
 */

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
  
  if (typeof patchSwapLabels === 'function') {
    patchSwapLabels();
  }
}

export function calculateMetrics(item) {
  const protein = Number(item.protein || item.macros?.protein || 0);
  const kcal = Number(item.calories || item.kcal || item.macros?.calories || 0);
  const price = Number(item.price || item.cost || 0);

  const proteinPerKcal = kcal > 0 ? (protein / kcal) : 0;
  const proteinPerPound = price > 0 ? (protein / price) : 0;

  return { protein, kcal, price, proteinPerKcal, proteinPerPound };
}

export function resolveTargetItem(groupKey, itemKey) {
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

export function renderScrollableSwapModal(groupKey, itemKey) {
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

  renderList();

  if (searchInput) searchInput.oninput = (e) => renderList(e.target.value);
  if (sortSelect) sortSelect.onchange = (e) => { currentSort = e.target.value; renderList(searchInput.value); };
  
  const closeBtn = container.querySelector('#pp-modal-close');
  if (closeBtn) closeBtn.onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

export function executeSwapInState(groupKey, itemKey, newProduct, scope) {
  console.log(`[Swap Executed] Scope: ${scope}, Target Group: ${groupKey}, Item: ${itemKey}, Replacement:`, newProduct);

  const shoppingLists = ['confirmedShopping', 'shoppingList', 'generatedList'];

  shoppingLists.forEach(listKey => {
    if (!Array.isArray(window.state[listKey])) return;

    window.state[listKey].forEach(group => {
      if (scope === 'recipe' && group.key !== groupKey && group.id !== groupKey) return;

      if (Array.isArray(group.items)) {
        group.items.forEach(item => {
          const { item: targetItem } = resolveTargetItem(groupKey, itemKey);
          if (item.key === itemKey || item.id === itemKey || (targetItem && item.name === targetItem.name)) {
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

// Bind Global Aliases for Action Bridge and Legacy Compatibility
if (typeof window !== 'undefined') {
  window.renderShopping = renderShoppingListUI;
  window.renderShoppingList = renderShoppingListUI;
  window.toggleInlineShoppingSubst = renderScrollableSwapModal;
}
