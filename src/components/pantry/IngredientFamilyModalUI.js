/**
 * src/components/pantry/IngredientFamilyModalUI.js (v3.19.35)
 * Encapsulates presentation, labeling, and real-time Tesco helper search integrations for the Ingredient Family modal.
 */

export function updateIngredientFamilyModalUI(ing, parent) {
  const labelEl = document.getElementById('ingredient-family-details-name-label');
  const nameEl = document.getElementById('ingredient-family-details-name');
  const parentWrap = document.getElementById('parent-ingredient-display-wrap');
  const actionsWrap = document.getElementById('subtype-product-actions-wrap');
  const tescoEl = document.getElementById('tesco-search-helper-link');

  // 1. Reset dynamic fields
  if (tescoEl) tescoEl.innerHTML = '';
  if (nameEl) nameEl.oninput = null; // Clear previous listener

  // 2. Handle sub-type vs standard ingredient mode
  if (parent && !ing) {
    if (labelEl) labelEl.textContent = 'Sub-type Name';
    if (nameEl) {
      nameEl.placeholder = 'e.g. Mini 4 Pack, Sourdough, Frozen';
    }
    if (parentWrap) {
      parentWrap.style.display = 'block';
      parentWrap.innerHTML = `<span>Parent Ingredient:</span> <span style="font-weight:700;color:var(--primary,#4f46e5)">${parent.name}</span>`;
    }
    if (actionsWrap) actionsWrap.style.display = 'flex';

    // Real-time Tesco search helper
    if (nameEl && tescoEl) {
      const updateTescoLink = () => {
        const val = nameEl.value.trim();
        const query = `${parent.name} ${val}`.trim();
        tescoEl.innerHTML = `
          <a href="https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(query)}" 
             target="_blank" rel="noopener" 
             style="color:var(--primary,#4f46e5);font-weight:600;text-decoration:underline;display:inline-flex;align-items:center;gap:4px">
            🔍 Search Tesco for "${query}" ↗
          </a>
        `;
      };
      nameEl.oninput = updateTescoLink;
      updateTescoLink();
    }
  } else {
    // Standard mode / Edit mode
    if (labelEl) labelEl.textContent = 'Ingredient name';
    if (nameEl) nameEl.placeholder = 'e.g. Pasta, Asparagus, Tofu';
    if (parentWrap) parentWrap.style.display = 'none';
    if (actionsWrap) actionsWrap.style.display = 'none';
  }
}
