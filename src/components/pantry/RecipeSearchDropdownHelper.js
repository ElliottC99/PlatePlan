/**
 * src/components/pantry/RecipeSearchDropdownHelper.js (v3.43.2)
 * Custom DOM-rendered taxonomy autocomplete search component replacing native <select> tags.
 * Reuses the exact Recipe Wizard CSS classes and container structures.
 * Strictly under 350 lines.
 */

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

/**
 * Renders and binds a custom taxonomy autocomplete search dropdown into a target DOM container.
 * @param {Object} params
 * @param {HTMLElement} params.container - DOM container element to mount into
 * @param {Array<Object>} [params.categories=[]] - List of category strings or objects
 * @param {Array<Object>} [params.rootItems=[]] - List of Root Item objects with subtypes
 * @param {string} [params.placeholder='Search category, item, or sub-type...']
 * @param {string} [params.initialValue='']
 * @param {string} [params.inputId='']
 * @param {Function} [params.onSelect] - Callback when an option is selected ({ val, label, inputEl, dropdownEl })
 * @returns {{ inputEl: HTMLElement, dropdownEl: HTMLElement, destroy: Function }}
 */
export function createTaxonomySearchInput({
  container,
  categories = [],
  rootItems = [],
  placeholder = 'Search category, item, or sub-type...',
  initialValue = '',
  inputId = '',
  onSelect
}) {
  if (!container || typeof container !== 'object') return null;

  const uniqueId = inputId || `tax-search-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  container.innerHTML = `
    <div class="wiz-tax-autocomplete-container" style="position:relative; width:100%;">
      <input type="text"
             id="${uniqueId}"
             class="wiz-ing-tax-search"
             value="${escapeAttr(initialValue)}"
             placeholder="${escapeAttr(placeholder)}"
             autocomplete="off"
             style="width:100%; padding:8px 12px; border-radius:8px; font-size:12.5px; border:1px solid var(--border,#e7e5e4); background:var(--surface,#fff); outline:none;" />
      <div class="wiz-tax-dropdown"
           id="${uniqueId}-dropdown"
           style="display:none; position:absolute; top:100%; left:0; right:0; max-height:220px; overflow-y:auto; background:var(--surface,#fff); border:1px solid var(--border,#ddd); border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.18); z-index:1050; margin-top:4px;">
      </div>
    </div>
  `;

  const inputEl = container.querySelector(`#${uniqueId}`);
  const dropdownEl = container.querySelector(`#${uniqueId}-dropdown`);

  const filterAndRender = () => {
    const query = (inputEl.value || '').toLowerCase().trim();
    let html = `
      <div class="wiz-tax-opt" data-val="new_item" data-label="✨ New Item" style="padding:7px 10px; font-size:12px; cursor:pointer; font-weight:600; color:var(--green,#059669); border-bottom:1px solid var(--border,#eee);">
        ✨ New Item
      </div>
    `;

    // Render Categories
    (categories || []).forEach(rawCat => {
      const catName = typeof rawCat === 'string' ? rawCat : (rawCat?.name || rawCat?.categoryName || '');
      if (!catName) return;
      if (!query || catName.toLowerCase().includes(query)) {
        html += `
          <div class="wiz-tax-opt wiz-tax-category" data-val="cat:${escapeAttr(catName)}" data-label="📂 [Category] ${escapeAttr(catName)}" style="padding:6px 10px; font-size:12px; cursor:pointer; font-weight:700; color:var(--purple,#4f46e5); background:var(--surface2,#f5f4ee); border-bottom:1px solid var(--border,#eee);">
            📂 <span class="badge" style="background:#eef2ff; color:#4f46e5; font-size:10px; padding:1px 5px; border-radius:4px; margin-right:4px;">[Category]</span> ${escapeHtml(catName)}
          </div>
        `;
      }
    });

    // Render Root Items & Sub-types
    (rootItems || []).forEach(item => {
      if (!item) return;
      const itemName = String(item.name || '').toLowerCase();
      const itemCat = String(item.category || 'General').toLowerCase();
      const subTypes = Array.isArray(item.subtypes) ? item.subtypes : [];

      const matchesItem = !query || itemName.includes(query) || itemCat.includes(query);
      const matchingSubtypes = subTypes.filter(s => !query || String(s?.name || '').toLowerCase().includes(query) || itemName.includes(query));

      if (matchesItem || matchingSubtypes.length > 0) {
        html += `
          <div class="wiz-tax-opt wiz-tax-main" data-val="${escapeAttr(item.id)}" data-label="📦 ${escapeAttr(item.name)} [${escapeAttr(item.category || 'General')}]" style="padding:6px 10px; font-size:12px; cursor:pointer; font-weight:700; color:var(--text,#1c1917); background:var(--surface2,#fbfbf9);">
            📦 ${escapeHtml(item.name)} <span style="font-size:10.5px; font-weight:normal; color:var(--text2,#78716c);">[${escapeHtml(item.category || 'General')}]</span>
          </div>
        `;

        (matchesItem ? subTypes : matchingSubtypes).forEach(sub => {
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

    dropdownEl.innerHTML = html;
    dropdownEl.style.display = 'block';

    dropdownEl.querySelectorAll('.wiz-tax-opt').forEach(opt => {
      opt.onclick = (e) => {
        e.stopPropagation();
        const val = opt.dataset.val;
        const label = opt.dataset.label;
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
