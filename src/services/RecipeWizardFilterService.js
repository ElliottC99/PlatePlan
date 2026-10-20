/**
 * src/services/RecipeWizardFilterService.js (v3.38.59)
 * Handles dropdown filtering and autocomplete logic for the Recipe Wizard.
 */

import { toTitleCase } from './RecipeImporter.js';
import { escapeHtml, escapeAttr } from '../utils/stringUtils.js';

export function bindCategoryAutocomplete({
  modalEl,
  wizardData,
  existingCategories,
  defaultCat
}) {
  const catInput = modalEl.querySelector('#map-cat-search-input');
  const catDropdown = modalEl.querySelector('#map-cat-dropdown');
  if (!catInput || !catDropdown) return;

  const filterCats = (query) => {
    const q = (query || '').toLowerCase().trim();
    const matches = existingCategories.filter(c => c.toLowerCase().includes(q));
    let html = `<div class="map-cat-opt" data-cat="${escapeAttr(query || defaultCat)}" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:600; color:var(--primary,#4f46e5); border-bottom:1px solid #eee;">✨ New Category "${escapeHtml(query || defaultCat)}"</div>`;
    html += matches.map(c => `
      <div class="map-cat-opt" data-cat="${escapeAttr(c)}" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:500;">
        📂 ${escapeHtml(c)}
      </div>
    `).join('');
    catDropdown.innerHTML = html;
    catDropdown.style.display = 'block';

    catDropdown.querySelectorAll('.map-cat-opt').forEach(opt => {
      opt.onclick = () => {
        const chosenCat = toTitleCase(opt.dataset.cat || query || defaultCat);
        wizardData.selectedCategory = chosenCat;
        wizardData.category = chosenCat;
        catInput.value = chosenCat;
        catDropdown.style.display = 'none';
      };
    });
  };

  catInput.onfocus = () => filterCats(catInput.value);
  catInput.oninput = (e) => {
    wizardData.selectedCategory = e.target.value;
    wizardData.category = e.target.value;
    filterCats(e.target.value);
  };
}

export function filterItems({
  modalEl,
  wizardData,
  query,
  ingredients,
  defaultCat,
  renderWizard,
  bindCategoryAutocompleteFn
}) {
  const itemInput = modalEl.querySelector('#map-item-search-input');
  const itemDropdown = modalEl.querySelector('#map-item-dropdown');
  if (!itemInput || !itemDropdown) return;

  const q = (query || '').toLowerCase().trim();
  const matches = ingredients.filter(i => (i.name || '').toLowerCase().includes(q));
  let html = `<div class="map-item-opt" data-id="" data-name="${escapeAttr(query || wizardData.name)}" data-cat="" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:600; color:var(--primary,#4f46e5); border-bottom:1px solid #eee;">✨ Create New Item "${escapeHtml(query || wizardData.name)}"</div>`;
  html += matches.map(i => `
    <div class="map-item-opt" data-id="${escapeAttr(i.id)}" data-name="${escapeAttr(i.name)}" data-cat="${escapeAttr(i.category || defaultCat)}" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:500;">
      ${escapeHtml(i.name)} <span style="font-size:10.5px; color:var(--text2);">[${escapeHtml(i.category || defaultCat)}]</span>
    </div>
  `).join('');
  itemDropdown.innerHTML = html;
  itemDropdown.style.display = 'block';

  itemDropdown.querySelectorAll('.map-item-opt').forEach(opt => {
    opt.onclick = () => {
      const selectedId = opt.dataset.id || '';
      const selectedName = toTitleCase(opt.dataset.name || query || wizardData.name);
      wizardData.selectedItemId = selectedId;
      wizardData.newItemName = selectedName;
      wizardData.item = selectedName;
      itemInput.value = selectedName;
      itemDropdown.style.display = 'none';

      if (wizardData.entityType === 'subtype') {
        if (selectedId) {
          const parentIng = ingredients.find(i => String(i.id) === String(selectedId));
          const lockedCat = parentIng?.category || opt.dataset.cat || defaultCat;
          wizardData.isExistingParentItem = true;
          wizardData.selectedCategory = lockedCat;
          wizardData.category = lockedCat;
        } else {
          wizardData.isExistingParentItem = false;
        }
        renderWizard();
      }
    };
  });
}

export function filterSubtypes({
  modalEl,
  wizardData,
  query,
  existingSubtypes,
  defaultCat,
  renderWizard
}) {
  const subInput = modalEl.querySelector('#map-sub-name-input');
  const subDropdown = modalEl.querySelector('#map-sub-dropdown');
  if (!subInput || !subDropdown) return;

  const q = (query || '').toLowerCase().trim();
  const matches = existingSubtypes.filter(s =>
    (s.name || '').toLowerCase().includes(q) ||
    (s.parentItemName || '').toLowerCase().includes(q)
  );
  const fallbackName = query || wizardData.item || wizardData.name;
  let html = `<div class="map-sub-opt" data-id="" data-name="${escapeAttr(fallbackName)}" data-cat="" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:600; color:var(--primary,#4f46e5); border-bottom:1px solid #eee;">✨ Create New Sub-Type "${escapeHtml(fallbackName)}"</div>`;
  html += matches.map(s => `
    <div class="map-sub-opt" data-id="${escapeAttr(s.id)}" data-name="${escapeAttr(s.name)}" data-cat="${escapeAttr(s.category || defaultCat)}" style="padding:8px 10px; font-size:12.5px; cursor:pointer; font-weight:500;">
      🏷️ ${escapeHtml(s.name)} <span style="font-size:10.5px; color:var(--text2);">(${escapeHtml(s.parentItemName)} · [${escapeHtml(s.category || defaultCat)}])</span>
    </div>
  `).join('');
  subDropdown.innerHTML = html;
  subDropdown.style.display = 'block';

  subDropdown.querySelectorAll('.map-sub-opt').forEach(opt => {
    opt.onclick = () => {
      const selectedId = opt.dataset.id || '';
      const selectedName = toTitleCase(opt.dataset.name || fallbackName);
      wizardData.selectedSubtypeId = selectedId;
      wizardData.subTypeName = selectedName;
      wizardData.subType = selectedName;
      subInput.value = selectedName;
      subDropdown.style.display = 'none';

      if (selectedId) {
        const matchedSub = existingSubtypes.find(s => String(s.id) === String(selectedId));
        const lockedCat = matchedSub?.category || opt.dataset.cat || defaultCat;
        wizardData.isExistingChildSubtype = true;
        wizardData.selectedCategory = lockedCat;
        wizardData.category = lockedCat;
      } else {
        wizardData.isExistingChildSubtype = false;
      }
      renderWizard();
    };
  });
}

export function filterProducts({
  modalEl,
  wizardData,
  query,
  products,
  productSearchQuery,
  showProductSearch,
  renderWizard
}) {
  const searchDropdown = modalEl.querySelector('#wiz-product-search-dropdown');
  if (!searchDropdown) return;

  productSearchQuery.set(query);
  const q = (query || '').toLowerCase().trim();
  const filtered = products.filter(p => !q || (p.name || '').toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q));

  if (!filtered.length) {
    searchDropdown.innerHTML = `<div style="padding: 10px; font-size: 12px; color: var(--text2); text-align: center;">No products found matching "${escapeHtml(q)}".</div>`;
  } else {
    searchDropdown.innerHTML = filtered.slice(0, 20).map(p => `
      <div class="wiz-prod-opt" data-id="${escapeAttr(p.id)}" style="padding: 8px 10px; font-size: 12.5px; cursor: pointer; border-bottom: 1px solid #f0fdf4; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="color: var(--text);">${escapeHtml(p.name)}</strong>
          <div style="font-size: 11px; color: var(--text2);">${escapeHtml(p.brand || 'No brand')} · £${Number(p.price || 0).toFixed(2)}</div>
        </div>
        <span style="font-size: 11px; font-weight: 600; color: #047857;">Link →</span>
      </div>
    `).join('');
  }
  searchDropdown.style.display = 'block';

  searchDropdown.querySelectorAll('.wiz-prod-opt').forEach(opt => {
    opt.onclick = () => {
      const p = products.find(prod => String(prod.id) === String(opt.dataset.id));
      if (p) {
        wizardData.linkedProduct = p;
        showProductSearch.set(false);
        productSearchQuery.set('');
        renderWizard();
      }
    };
  });
}
