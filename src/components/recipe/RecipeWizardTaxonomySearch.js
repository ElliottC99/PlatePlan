/**
 * src/components/recipe/RecipeWizardTaxonomySearch.js (v3.28.7)
 * Searchable Category & Item Autocomplete Component for Recipe Ingestion Wizard.
 * Features:
 * - Dynamic substring filtering across ingredients & sub-types
 * - Interactive New Ingredient Mapping Wizard for new items
 * - Visual distinction between main categories and indented sub-types
 * - Click & keyboard navigation (Arrow keys, Enter, Escape)
 */

import { getState } from '../../store/store.js';
import { getUnifiedCategories } from '../../services/HouseholdRepository.js';
import { openTaxonomyCreationModal } from './RecipeWizardTaxonomyModal.js';
import { resolveProductForIngredient } from './RecipeWizardStep3Handlers.js';

/**
 * Validates whether an ingredient is truly unlinked.
 * An item is LINKED if:
 * - it has a known productId in products
 * - it has an ingredientId in ingredients
 * - it has a categoryId
 * - it resolves via resolveProductForIngredient
 */
export function isIngredientUnlinked(item, products = [], ingredients = []) {
  if (!item || typeof item !== 'object') return false;
  if (item.isNewTaxonomyItem || item.ingredientId === 'new_item') return true;
  if (item.categoryId) return false;
  if (item.subtypeId) return false;
  if (item.ingredientId && item.ingredientId !== 'new_item') return false;
  if (item.productId && (products || []).some(p => String(p.id) === String(item.productId))) return false;
  if (item.bankId && (products || []).some(p => String(p.id) === String(item.bankId))) return false;
  if (typeof resolveProductForIngredient === 'function') {
    const resolved = resolveProductForIngredient(item, { products, ingredients });
    if (resolved) return false;
  }
  return true;
}

export function getTaxonomyLabel(arg1, arg2, arg3 = '', arg4 = [], arg5 = null, arg6 = []) {
  let item = null;
  let ingredientId = null;
  let subtypeId = null;
  let rawName = '';
  let categoryId = null;
  let ingBank = [];
  let prodBank = [];

  if (typeof arg1 === 'object' && arg1 !== null) {
    item = arg1;
    ingredientId = item.ingredientId;
    subtypeId = item.subtypeId;
    rawName = item.name || item.raw || '';
    categoryId = item.categoryId;
    ingBank = Array.isArray(arg2) ? arg2 : (Array.isArray(arg4) ? arg4 : (getState()?.ingredients || []));
    prodBank = Array.isArray(arg3) ? arg3 : (Array.isArray(arg6) && arg6.length ? arg6 : (getState()?.products || []));
  } else {
    ingredientId = arg1;
    subtypeId = arg2;
    rawName = arg3;
    ingBank = Array.isArray(arg4) ? arg4 : (getState()?.ingredients || []);
    categoryId = arg5;
    prodBank = Array.isArray(arg6) ? arg6 : (getState()?.products || []);
  }

  if (categoryId) {
    return `📂 ${categoryId}`;
  }

  // 1. Subtype mapping in ingredientsBank (Priority: Taxonomy Sub-Type)
  if (subtypeId) {
    for (const ing of (ingBank || [])) {
      const sub = (ing.subtypes || []).find(s => String(s.id) === String(subtypeId) || String(s.name) === String(subtypeId));
      if (sub) {
        return `🏷️ ${sub.name}`;
      }
    }
  }

  // 2. Root ingredient mapping in ingredientsBank
  if (ingredientId && ingredientId !== 'new_item') {
    const ing = (ingBank || []).find(i => String(i.id) === String(ingredientId));
    if (ing) {
      return `📦 ${ing.name}`;
    }
  }

  // 3. Fallback for items with direct productId or bankId
  const directProdId = item?.productId || item?.bankId;
  if (directProdId) {
    const prod = (prodBank || []).find(p => String(p.id) === String(directProdId));
    if (prod) {
      if (prod.subtypeId) {
        for (const ing of (ingBank || [])) {
          const sub = (ing.subtypes || []).find(s => String(s.id) === String(prod.subtypeId));
          if (sub) return `🏷️ ${sub.name}`;
        }
      }
      if (prod.ingredientId) {
        const ing = (ingBank || []).find(i => String(i.id) === String(prod.ingredientId));
        if (ing) return `📦 ${ing.name}`;
      }
      if (prod.category) {
        return `📂 ${prod.category}`;
      }
      return `📦 ${prod.name || prod.productName}`;
    }
    if (item?.productName) {
      return `📦 ${item.productName}`;
    }
  }

  // 4. Resolve via canonical resolver if item exists
  if (item && typeof resolveProductForIngredient === 'function') {
    const resolved = resolveProductForIngredient(item, { products: prodBank, ingredients: ingBank });
    if (resolved) {
      if (resolved.subtypeId) {
        for (const ing of (ingBank || [])) {
          const sub = (ing.subtypes || []).find(s => String(s.id) === String(resolved.subtypeId));
          if (sub) return `🏷️ ${sub.name}`;
        }
      }
      if (resolved.ingredientId) {
        const ing = (ingBank || []).find(i => String(i.id) === String(resolved.ingredientId));
        if (ing) return `📦 ${ing.name}`;
      }
      if (resolved.category) {
        return `📂 ${resolved.category}`;
      }
      return `📦 ${resolved.name}`;
    }
  }

  return `✨ New Item`;
}

export function renderTaxonomySearchHTML(sIdx, iIdx, item, ingredientsBank = [], productsBank = []) {
  const pBank = Array.isArray(productsBank) && productsBank.length ? productsBank : (getState()?.products || []);
  const iBank = Array.isArray(ingredientsBank) && ingredientsBank.length ? ingredientsBank : (getState()?.ingredients || []);

  let selectedVal = 'new_item';
  if (item.categoryId) {
    selectedVal = `cat:${item.categoryId}`;
  } else if (item.subtypeId && item.ingredientId) {
    selectedVal = `${item.ingredientId}:${item.subtypeId}`;
  } else if (item.ingredientId && item.ingredientId !== 'new_item') {
    selectedVal = item.ingredientId;
  } else if (item.productId || item.bankId) {
    const prodId = item.productId || item.bankId;
    const prod = pBank.find(p => String(p.id) === String(prodId));
    if (prod?.ingredientId && prod?.subtypeId) {
      selectedVal = `${prod.ingredientId}:${prod.subtypeId}`;
    } else if (prod?.ingredientId) {
      selectedVal = prod.ingredientId;
    } else if (prod?.category) {
      selectedVal = `cat:${prod.category}`;
    } else {
      selectedVal = `prod:${prodId}`;
    }
  }

  const selectedLabel = getTaxonomyLabel(item, iBank, pBank);
  const isCat = Boolean(item.categoryId) || selectedVal.startsWith('cat:');
  const catInputStyle = isCat ? 'background:#eef2ff; border:1px solid #818cf8; color:#4338ca; font-weight:600;' : 'background:var(--surface,#fff); border:1px solid var(--border,#ccc); color:var(--text);';

  return `
    <div class="wiz-tax-autocomplete-container" style="position:relative; width:100%;">
      <input type="text"
             id="wiz-ing-tax-search-${sIdx}-${iIdx}"
             name="wiz_ing_tax_search_${sIdx}_${iIdx}"
             aria-label="Search category or item for ingredient section ${sIdx} item ${iIdx}"
             class="wiz-ing-tax-search"
             data-sidx="${sIdx}"
             data-iidx="${iIdx}"
             data-tax-val="${escapeAttr(selectedVal)}"
             value="${escapeAttr(selectedLabel)}"
             placeholder="Search category, root item, or sub-type..."
             autocomplete="off"
             style="width:100%; padding:6px 8px; border-radius:6px; font-size:12px; ${catInputStyle}" />
      <div class="wiz-tax-dropdown"
           id="wiz-tax-dropdown-${sIdx}-${iIdx}"
           style="display:none; position:absolute; top:100%; left:0; right:0; max-height:220px; overflow-y:auto; background:var(--surface,#fff); border:1px solid var(--border,#ddd); border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.18); z-index:1050; margin-top:2px;">
      </div>
    </div>
  `;
}

export function bindTaxonomyAutocompleteEvents(modalWrap, onSelectCallback) {
  const storeState = getState();
  const ingredientsBank = storeState.rootItems || storeState.ingredients || [];
  const productsBank = storeState.products || [];
  const existingCategories = getUnifiedCategories(storeState);

  const filterAndRenderDropdown = (inputEl, dropdownEl) => {
    const query = (inputEl.value || '').toLowerCase().trim();
    const sIdx = inputEl.dataset.sidx;
    const iIdx = inputEl.dataset.iidx;

    let html = `
      <div class="wiz-tax-opt" data-val="new_item" data-label="✨ New Item" style="padding:7px 10px; font-size:12px; cursor:pointer; font-weight:600; color:var(--green,#059669); border-bottom:1px solid var(--border,#eee);">
        ✨ New Item
      </div>
    `;

    // Render category mappings with high visibility
    existingCategories.forEach(cat => {
      const catLower = cat.toLowerCase();
      if (!query || catLower.includes(query) || '[category]'.includes(query)) {
        html += `
          <div class="wiz-tax-opt wiz-tax-category" data-val="cat:${escapeAttr(cat)}" data-label="📂 ${escapeAttr(cat)}" style="padding:6px 10px; font-size:12px; cursor:pointer; font-weight:700; color:var(--purple,#4f46e5); background:var(--surface2,#f5f4ee); border-bottom:1px solid var(--border,#eee);">
            📂 ${escapeHtml(cat)}
          </div>
        `;
      }
    });

    // Render taxonomy root items & sub-types (clean and concise names only)
    ingredientsBank.forEach(ing => {
      const ingName = String(ing.name || '').toLowerCase();
      const ingCategory = String(ing.category || '').toLowerCase();
      const subTypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];

      // Check if any product belonging to this root item matches query (enables searching by product name!)
      const hasMatchingProduct = query && productsBank.some(p => 
        String(p.ingredientId) === String(ing.id) && String(p.name || '').toLowerCase().includes(query)
      );

      const matchesIng = !query || ingName.includes(query) || ingCategory.includes(query) || hasMatchingProduct;
      const matchingSubtypes = subTypes.filter(s => {
        if (!query) return true;
        const sName = String(s.name || '').toLowerCase();
        const hasSubProd = productsBank.some(p => 
          String(p.subtypeId) === String(s.id) && String(p.name || '').toLowerCase().includes(query)
        );
        return sName.includes(query) || ingName.includes(query) || hasSubProd;
      });

      if (matchesIng || matchingSubtypes.length > 0) {
        html += `
          <div class="wiz-tax-opt wiz-tax-main" data-val="${escapeAttr(ing.id)}" data-label="📦 ${escapeAttr(ing.name)}" style="padding:6px 10px; font-size:12px; cursor:pointer; font-weight:700; color:var(--text); background:var(--surface2,#fbfbf9);">
            📦 ${escapeHtml(ing.name)}
          </div>
        `;

        (matchesIng ? subTypes : matchingSubtypes).forEach(sub => {
          const subKey = `${ing.id}:${sub.id || sub.name}`;
          html += `
            <div class="wiz-tax-opt wiz-tax-sub" data-val="${escapeAttr(subKey)}" data-label="🏷️ ${escapeAttr(sub.name)}" style="padding:5px 10px 5px 24px; font-size:11.5px; cursor:pointer; color:var(--text); border-bottom:1px solid rgba(0,0,0,0.03);">
              ↳ 🏷️ ${escapeHtml(sub.name)}
            </div>
          `;
        });
      }
    });

    dropdownEl.innerHTML = html;
    dropdownEl.style.display = 'block';

    // Option click handling
    dropdownEl.querySelectorAll('.wiz-tax-opt').forEach(opt => {
      opt.onclick = (e) => {
        e.stopPropagation();
        const val = opt.dataset.val;
        const label = opt.dataset.label;
        inputEl.dataset.taxVal = val;
        inputEl.value = label;
        dropdownEl.style.display = 'none';

        if (val.startsWith('cat:')) {
          inputEl.style.background = '#eef2ff';
          inputEl.style.border = '1px solid #818cf8';
          inputEl.style.color = '#4338ca';
          inputEl.style.fontWeight = '600';
        } else {
          inputEl.style.background = 'var(--surface,#fff)';
          inputEl.style.border = '1px solid var(--border,#ccc)';
          inputEl.style.color = 'var(--text)';
          inputEl.style.fontWeight = 'normal';
        }

        if (val === 'new_item') {
          const rowNameInput = modalWrap.querySelector(`.wiz-ing-name[data-sidx="${sIdx}"][data-iidx="${iIdx}"]`);
          const currentIngName = rowNameInput ? rowNameInput.value : '';
          openTaxonomyCreationModal({
            sIdx,
            iIdx,
            initialName: currentIngName,
            onComplete: (created) => {
              const ingId = created.ingredientId || created.rootItem?.id || created.id || 'custom';
              const subId = created.subtypeId || created.subtype?.id || created.subtypeName || 'standard';
              const parentName = created.parentName || created.rootItem?.name || created.rootItemName || currentIngName;
              const subName = created.subtypeName || created.subtype?.name || parentName;
              const combinedKey = `${ingId}:${subId}`;
              const displayLabel = `🏷️ ${subName} (${parentName})`;
              inputEl.dataset.taxVal = combinedKey;
              inputEl.value = displayLabel;
              if (rowNameInput) {
                rowNameInput.value = subName;
              }
              if (typeof onSelectCallback === 'function') {
                onSelectCallback(sIdx, iIdx, combinedKey, created);
              }
            }
          });
          return;
        }

        if (typeof onSelectCallback === 'function') {
          onSelectCallback(sIdx, iIdx, val);
        }
      };
      opt.onmouseenter = () => {
        dropdownEl.querySelectorAll('.wiz-tax-opt').forEach(o => o.style.background = o.classList.contains('wiz-tax-main') ? 'var(--surface2,#fbfbf9)' : 'transparent');
        opt.style.background = 'var(--purple-bg, #eef2ff)';
      };
    });
  };

  modalWrap.querySelectorAll('.wiz-ing-tax-search').forEach(input => {
    const sIdx = input.dataset.sidx;
    const iIdx = input.dataset.iidx;
    const dropdown = modalWrap.querySelector(`#wiz-tax-dropdown-${sIdx}-${iIdx}`);
    if (!dropdown) return;

    input.onfocus = () => {
      modalWrap.querySelectorAll('.wiz-tax-dropdown').forEach(d => { if (d !== dropdown) d.style.display = 'none'; });
      filterAndRenderDropdown(input, dropdown);
    };

    input.oninput = () => {
      filterAndRenderDropdown(input, dropdown);
    };

    input.onkeydown = (e) => {
      if (e.key === 'Escape') {
        dropdown.style.display = 'none';
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const items = Array.from(dropdown.querySelectorAll('.wiz-tax-opt'));
        const active = dropdown.querySelector('.wiz-tax-opt-active');
        let nextIdx = 0;
        if (active) {
          active.classList.remove('wiz-tax-opt-active');
          active.style.background = 'transparent';
          nextIdx = (items.indexOf(active) + 1) % items.length;
        }
        if (items[nextIdx]) {
          items[nextIdx].classList.add('wiz-tax-opt-active');
          items[nextIdx].style.background = 'var(--purple-bg, #eef2ff)';
          items[nextIdx].scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(dropdown.querySelectorAll('.wiz-tax-opt'));
        const active = dropdown.querySelector('.wiz-tax-opt-active');
        let prevIdx = items.length - 1;
        if (active) {
          active.classList.remove('wiz-tax-opt-active');
          active.style.background = 'transparent';
          prevIdx = (items.indexOf(active) - 1 + items.length) % items.length;
        }
        if (items[prevIdx]) {
          items[prevIdx].classList.add('wiz-tax-opt-active');
          items[prevIdx].style.background = 'var(--purple-bg, #eef2ff)';
          items[prevIdx].scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'Enter') {
        const active = dropdown.querySelector('.wiz-tax-opt-active');
        if (active) {
          e.preventDefault();
          active.click();
        }
      }
    };
  });

  // Close dropdown on outside click
  modalWrap.addEventListener('click', (e) => {
    if (!e.target.closest('.wiz-tax-autocomplete-container')) {
      modalWrap.querySelectorAll('.wiz-tax-dropdown').forEach(d => d.style.display = 'none');
    }
  });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}
