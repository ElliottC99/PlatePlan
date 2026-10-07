/**
 * src/components/recipe/RecipeWizardTaxonomySearch.js (v3.27.2)
 * Searchable Taxonomy Autocomplete Component for Recipe Ingestion Wizard.
 * Features:
 * - Dynamic substring filtering across ingredients & sub-types
 * - Visual distinction between main categories and indented sub-types
 * - Click & keyboard navigation (Arrow keys, Enter, Escape)
 */

import { getState } from '../../store/store.js';

export function getTaxonomyLabel(ingredientId, subtypeId, rawName = '', ingredientsBank = []) {
  if (!ingredientId || ingredientId === 'new_item') {
    return `✨ New Item: ${rawName || 'Custom'}`;
  }

  const ing = ingredientsBank.find(i => String(i.id) === String(ingredientId));
  if (!ing) return `✨ New Item: ${rawName || 'Custom'}`;

  if (subtypeId) {
    const sub = (ing.subtypes || []).find(s => String(s.id) === String(subtypeId) || String(s.name) === String(subtypeId));
    if (sub) {
      return `🏷️ ${sub.name} (${ing.name})`;
    }
  }

  return `📦 ${ing.name} [${ing.category || 'General'}]`;
}

export function renderTaxonomySearchHTML(sIdx, iIdx, item, ingredientsBank = []) {
  const selectedVal = item.subtypeId ? `${item.ingredientId}:${item.subtypeId}` : (item.ingredientId || 'new_item');
  const selectedLabel = getTaxonomyLabel(item.ingredientId, item.subtypeId, item.name, ingredientsBank);

  return `
    <div class="wiz-tax-autocomplete-container" style="position:relative; width:100%;">
      <input type="text"
             class="wiz-ing-tax-search"
             data-sidx="${sIdx}"
             data-iidx="${iIdx}"
             data-tax-val="${escapeAttr(selectedVal)}"
             value="${escapeAttr(selectedLabel)}"
             placeholder="Search taxonomy..."
             autocomplete="off"
             style="width:100%; padding:6px 8px; border:1px solid var(--border,#ccc); border-radius:6px; font-size:12px; background:var(--surface,#fff); color:var(--text);" />
      <div class="wiz-tax-dropdown"
           id="wiz-tax-dropdown-${sIdx}-${iIdx}"
           style="display:none; position:absolute; top:100%; left:0; right:0; max-height:220px; overflow-y:auto; background:var(--surface,#fff); border:1px solid var(--border,#ddd); border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.18); z-index:1050; margin-top:2px;">
      </div>
    </div>
  `;
}

export function bindTaxonomyAutocompleteEvents(modalWrap, onSelectCallback) {
  const storeState = getState() || {};
  const ingredientsBank = storeState.ingredients || [];

  const filterAndRenderDropdown = (inputEl, dropdownEl) => {
    const query = (inputEl.value || '').toLowerCase().trim();
    const sIdx = inputEl.dataset.sidx;
    const iIdx = inputEl.dataset.iidx;

    let html = `
      <div class="wiz-tax-opt" data-val="new_item" data-label="✨ New Taxonomy Item" style="padding:7px 10px; font-size:12px; cursor:pointer; font-weight:600; color:var(--green,#059669); border-bottom:1px solid var(--border,#eee);">
        ✨ New Taxonomy Item
      </div>
    `;

    ingredientsBank.forEach(ing => {
      const ingName = String(ing.name || '').toLowerCase();
      const ingCategory = String(ing.category || '').toLowerCase();
      const subTypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];

      const matchesIng = !query || ingName.includes(query) || ingCategory.includes(query);
      const matchingSubtypes = subTypes.filter(s => !query || String(s.name || '').toLowerCase().includes(query) || ingName.includes(query));

      if (matchesIng || matchingSubtypes.length > 0) {
        html += `
          <div class="wiz-tax-opt wiz-tax-main" data-val="${escapeAttr(ing.id)}" data-label="📦 ${escapeAttr(ing.name)} [${escapeAttr(ing.category || 'General')}]" style="padding:6px 10px; font-size:12px; cursor:pointer; font-weight:700; color:var(--text); background:var(--surface2,#fbfbf9);">
            📦 ${escapeHtml(ing.name)} <span style="font-size:10.5px; font-weight:normal; color:var(--text2);">[${escapeHtml(ing.category || 'General')}]</span>
          </div>
        `;

        (matchesIng ? subTypes : matchingSubtypes).forEach(sub => {
          const subKey = `${ing.id}:${sub.id || sub.name}`;
          html += `
            <div class="wiz-tax-opt wiz-tax-sub" data-val="${escapeAttr(subKey)}" data-label="🏷️ ${escapeAttr(sub.name)} (${escapeAttr(ing.name)})" style="padding:5px 10px 5px 24px; font-size:11.5px; cursor:pointer; color:var(--text); border-bottom:1px solid rgba(0,0,0,0.03);">
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
