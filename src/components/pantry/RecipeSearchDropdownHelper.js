/**
 * src/components/pantry/RecipeSearchDropdownHelper.js
 * Search and autocomplete helper for Pantry Category / Item / Sub-type taxonomy locking.
 * Dynamic "Create New" options with dedicated category/item routing and live store synchronization.
 * Multi-token substring filtering across the entire lineage.
 */

import { getState } from '../../store/store.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

function cleanSearchQuery(rawVal) {
  if (!rawVal) return '';
  let str = String(rawVal).trim();
  str = str.replace(/^[📦🏷️📂🛒✨\s]+/, '');
  str = str.replace(/^\[Category\]\s*/i, '');
  str = str.replace(/^\[Root Item\]\s*/i, '');
  str = str.replace(/^\[Sub-Type\]\s*/i, '');
  str = str.replace(/[()[\]]/g, ' ');
  return str.toLowerCase().trim();
}

export function createTaxonomySearchInput({
  container,
  categories = [],
  rootItems = [],
  products = [],
  subtypesOnly = false,
  placeholder = 'Search category, item, or sub-type...',
  initialValue = '',
  inputId = '',
  newItemType = null,
  onSelect,
  onNewClick
}) {
  if (!container || typeof container !== 'object') return null;

  const uniqueId = inputId || `tax-search-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const resolvedNewType = newItemType !== null 
    ? newItemType 
    : (subtypesOnly ? 'subtype' : (categories.length > 0 && rootItems.length === 0 ? 'category' : (rootItems.length > 0 ? 'item' : 'none')));

  container.innerHTML = `
    <div class="wiz-tax-autocomplete-container" style="position:relative; width:100%;">
      <input type="text"
             id="${uniqueId}"
             class="wiz-ing-tax-search"
             value="${escapeAttr(initialValue)}"
             placeholder="${escapeAttr(placeholder)}"
             autocomplete="off"
             style="width:100%; padding:8px 32px 8px 12px; border-radius:8px; font-size:12.5px; border:1px solid var(--border,#e7e5e4); background:var(--surface,#fff); outline:none;" />
      <div class="wiz-tax-chevron" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); pointer-events:none; font-size:10px; color:var(--text2,#78716c);">▼</div>
      <div class="wiz-tax-dropdown"
           id="${uniqueId}-dropdown"
           style="display:none; position:absolute; top:100%; left:0; right:0; max-height:280px; overflow-y:auto; background:var(--surface,#fff); border:1px solid var(--border,#ddd); border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.18); z-index:1050; margin-top:4px;">
      </div>
    </div>
  `;

  const inputEl = container.querySelector(`#${uniqueId}`);
  const dropdownEl = container.querySelector(`#${uniqueId}-dropdown`);

  const filterAndRender = () => {
    const rawVal = inputEl.value || '';
    const cleanQuery = cleanSearchQuery(rawVal);
    const searchTokens = cleanQuery.split(/\s+/).filter(Boolean);

    const matchesTokens = (text) => {
      if (!searchTokens.length) return true;
      const t = String(text || '').toLowerCase();
      return searchTokens.every(tok => t.includes(tok));
    };

    let html = '';

    if (resolvedNewType === 'category') {
      html += `
        <div class="wiz-tax-opt wiz-tax-new-btn" data-val="new_category" data-label="${escapeAttr(rawVal || 'New Category')}" style="padding:8px 10px; font-size:12px; cursor:pointer; font-weight:700; color:var(--primary,#4f46e5); border-bottom:1px solid var(--border,#eee); background:rgba(79,70,229,0.04);">
          ✨ Create New Category ${rawVal.trim() ? `"${escapeHtml(rawVal.trim())}"` : ''} ➔
        </div>
      `;
    } else if (resolvedNewType === 'item') {
      html += `
        <div class="wiz-tax-opt wiz-tax-new-btn" data-val="new_item" data-label="${escapeAttr(rawVal || 'New Item')}" style="padding:8px 10px; font-size:12px; cursor:pointer; font-weight:700; color:var(--green,#059669); border-bottom:1px solid var(--border,#eee); background:rgba(5,150,105,0.04);">
          ✨ Create New Item ${rawVal.trim() ? `"${escapeHtml(rawVal.trim())}"` : ''} ➔
        </div>
      `;
    } else if (resolvedNewType === 'subtype') {
      html += `
        <div class="wiz-tax-opt wiz-tax-new-btn" data-val="new_subtype" data-label="${escapeAttr(rawVal || 'New Sub-Type')}" style="padding:8px 10px; font-size:12px; cursor:pointer; font-weight:700; color:var(--purple,#7c3aed); border-bottom:1px solid var(--border,#eee); background:rgba(124,58,237,0.04);">
          ✨ Create New Sub-Type ${rawVal.trim() ? `"${escapeHtml(rawVal.trim())}"` : ''} ➔
        </div>
      `;
    }

    const state = (typeof getState === 'function' ? getState() : null) || (typeof window !== 'undefined' ? (window.Store?.getState?.() || window.state) : null) || {};
    const liveRootItems = Array.isArray(state?.ingredients) && state.ingredients.length > 0 
      ? state.ingredients 
      : rootItems;
    const liveCategories = Array.isArray(state?.categories) && state.categories.length > 0 
      ? state.categories 
      : categories;
    const liveProducts = Array.isArray(products) && products.length > 0
      ? products
      : (Array.isArray(state?.products) ? state.products : []);

    // Dedicated Product Search Mode (e.g. within AddItemWizard existing product picker)
    if (products.length > 0 && liveRootItems.length === 0 && liveCategories.length === 0) {
      products.forEach(prod => {
        if (!prod) return;
        const pName = String(prod.name || prod.title || '');
        const pBrand = String(prod.brand || '');
        const fullProdText = `${pName} ${pBrand}`;
        if (matchesTokens(fullProdText)) {
          html += `
            <div class="wiz-tax-opt wiz-tax-product" data-val="${escapeAttr(prod.id)}" data-label="${escapeAttr(pName)}${pBrand ? ` (${escapeAttr(pBrand)})` : ''}" style="padding:6px 10px; font-size:12px; cursor:pointer; color:var(--text,#1c1917); border-bottom:1px solid rgba(0,0,0,0.03);">
              🛒 <strong>${escapeHtml(pName)}</strong> ${pBrand ? `<span style="font-size:10.5px; color:var(--text2,#78716c);">(${escapeHtml(pBrand)})</span>` : ''}
            </div>
          `;
        }
      });
    } else if (subtypesOnly) {
      (liveRootItems || []).forEach(item => {
        if (!item) return;
        const itemName = String(item.name || '');
        const itemCat = String(item.category || 'General');
        const subTypes = Array.isArray(item.subtypes) ? item.subtypes : [];

        subTypes.forEach(sub => {
          if (!sub) return;
          const subName = String(sub.name || '');
          const combinedText = `${subName} ${itemName} ${itemCat}`;
          if (matchesTokens(combinedText)) {
            const subKey = `${item.id}:${sub.id || sub.name}`;
            html += `
              <div class="wiz-tax-opt wiz-tax-sub" data-val="${escapeAttr(subKey)}" data-label="🏷️ ${escapeAttr(sub.name)} (${escapeAttr(itemName)})" style="padding:7px 10px; font-size:12px; cursor:pointer; color:var(--text,#1c1917); border-bottom:1px solid rgba(0,0,0,0.04); display:flex; align-items:center; justify-content:space-between;">
                <div>🏷️ <strong>${escapeHtml(sub.name)}</strong></div>
                <div style="font-size:10px; color:var(--text2,#78716c);">📂 ${escapeHtml(itemCat)} › 📦 ${escapeHtml(itemName)}</div>
              </div>
            `;
          }
        });
      });
    } else {
      // Render Categories
      (liveCategories || []).forEach(rawCat => {
        const catName = typeof rawCat === 'string' ? rawCat : (rawCat?.name || rawCat?.categoryName || '');
        if (!catName) return;
        if (matchesTokens(catName)) {
          html += `
            <div class="wiz-tax-opt wiz-tax-category" data-val="cat:${escapeAttr(catName)}" data-label="📂 [Category] ${escapeAttr(catName)}" style="padding:7px 10px; font-size:12px; cursor:pointer; font-weight:700; color:var(--purple,#4f46e5); background:var(--surface2,#f5f4ee); border-bottom:1px solid var(--border,#eee);">
              📂 <span class="badge" style="background:#eef2ff; color:#4f46e5; font-size:10px; padding:1px 5px; border-radius:4px; margin-right:4px;">[Category]</span> ${escapeHtml(catName)}
            </div>
          `;
        }
      });

      // Render Root Items & Sub-types
      (liveRootItems || []).forEach(item => {
        if (!item) return;
        const itemName = String(item.name || '');
        const itemCat = String(item.category || 'General');
        const subTypes = Array.isArray(item.subtypes) ? item.subtypes : [];

        const itemMatches = matchesTokens(`${itemName} ${itemCat}`);
        const matchingSubtypes = subTypes.filter(s => matchesTokens(`${s?.name || ''} ${itemName} ${itemCat}`));

        if (itemMatches || matchingSubtypes.length > 0) {
          html += `
            <div class="wiz-tax-opt wiz-tax-main" data-val="${escapeAttr(item.id)}" data-label="📦 ${escapeAttr(item.name)} [${escapeAttr(item.category || 'General')}]" style="padding:6px 10px; font-size:12px; cursor:pointer; font-weight:700; color:var(--text,#1c1917); background:var(--surface2,#fbfbf9);">
              📦 ${escapeHtml(item.name)} <span style="font-size:10.5px; font-weight:normal; color:var(--text2,#78716c);">[${escapeHtml(item.category || 'General')}]</span>
            </div>
          `;

          (itemMatches ? subTypes : matchingSubtypes).forEach(sub => {
            if (!sub) return;
            const subKey = `${item.id}:${sub.id || sub.name}`;
            html += `
              <div class="wiz-tax-opt wiz-tax-sub" data-val="${escapeAttr(subKey)}" data-label="🏷️ ${escapeAttr(sub.name)} (${escapeAttr(item.name)})" style="padding:5px 10px 5px 24px; font-size:11.5px; cursor:pointer; color:var(--text,#1c1917); border-bottom:1px solid rgba(0,0,0,0.03);">
                ↳ 🏷️ ${escapeHtml(sub.name)}
              </div>
            `;
          });
        }
      });
    }

    dropdownEl.innerHTML = html || `<div style="padding:10px; font-size:12px; color:var(--text2,#78716c); text-align:center;">No matching records.</div>`;
    dropdownEl.style.display = 'block';

    dropdownEl.querySelectorAll('.wiz-tax-opt').forEach(opt => {
      opt.onclick = (e) => {
        e.stopPropagation();
        const val = opt.dataset.val;
        const label = opt.dataset.label;

        if (val === 'new_category' || val === 'new_item' || val === 'new_subtype') {
          dropdownEl.style.display = 'none';
          if (typeof onNewClick === 'function') {
            onNewClick(inputEl.value.trim());
            return;
          }
        }

        inputEl.dataset.taxVal = val;
        inputEl.value = label;
        dropdownEl.style.display = 'none';

        if (typeof onSelect === 'function') {
          onSelect({ val, label, inputEl, dropdownEl });
        }
      };
    });
  };

  inputEl.onfocus = () => filterAndRender();
  inputEl.oninput = () => filterAndRender();

  const handleDocumentClick = (e) => {
    if (!container.contains(e.target)) {
      dropdownEl.style.display = 'none';
    }
  };
  document.addEventListener('click', handleDocumentClick);

  return {
    inputEl,
    dropdownEl,
    destroy: () => {
      document.removeEventListener('click', handleDocumentClick);
    }
  };
}
