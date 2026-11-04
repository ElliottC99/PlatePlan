# Plan: Taxonomy Search Live State Synchronization & Multi-Token Matching

**Date**: 2026-11-04  
**Status**: Completed ✓  
**Target Branch**: `dev/recipe-bulk-parse-instruction-fix`

---

## 1. Overview & Problem Statement

When a user in **Recipe Mapping Audit** (or Recipe Wizard / Data Quality) creates a new item (e.g., "pastrami slices"):
1. The item is saved to the store and persisted via `commitAtomicChain`.
2. However, upon returning to the search input, typing or searching for "pastrami slices" fails to show the newly created item in the dropdown list.
3. Investigation revealed 4 distinct issues:
   - **Stale Array Trap**: `RecipeSearchDropdownHelper.js` attempted to read `window.Store?.getState?.()`, but `window.Store` was never bound on `window`. It permanently fell back to the initial `rootItems` array snapshot taken when the modal was opened.
   - **Broken Multi-Word Matching**: The filtering logic checked `itemName.includes(query)` and `subName.includes(query)`. If the Root Item is "Pastrami" and the Sub-type is "Slices", searching for `"pastrami slices"` returns false on both individual fields, yielding zero matches.
   - **Programmatic Input Event Loop**: In `RecipeAuditModal.js`, dispatching an `'input'` event after auto-populating `inputEl.value = "🏷️ Slices (Pastrami)"` caused `inputEl.oninput` to re-filter the dropdown with the formatted string (including emojis/parentheses), displaying `"No matching records."`.
   - **Ignored Products**: `createTaxonomySearchInput` did not accept or filter products attached to root items or sub-types.

---

## 2. Acceptance Criteria

- [x] `createTaxonomySearchInput` dynamically queries live state from `getState()` (`src/store/store.js`) on every search filter call, instantly reflecting newly created ingredients, categories, and products.
- [x] Multi-word queries like `"pastrami slices"` match items where tokens are distributed across the hierarchy (e.g., Root Item `"Pastrami"` with variant `"Slices"`, or Root Item `"Pastrami Slices"`).
- [x] Search query normalization strips visual badges/prefixes (`🏷️`, `📦`, `📂 [Category]`) so existing selections can be focused and re-searched without producing "No matching records.".
- [x] Programmatic auto-population sets the input value, attribute, dataset IDs, and styles cleanly without firing search re-filtering.
- [x] `window.Store` and `window.store` are explicitly exported on `window` in `src/store/store.js` and `src/main.js` for universal backward compatibility.
- [x] All automated tests pass (`node scripts/test_data_quality_wizards.js`) and `npm run build` succeeds.

---

## 3. Implementation Steps

### Step 1: Update `src/components/pantry/RecipeSearchDropdownHelper.js`
- Import `getState` directly from `../../store/store.js`.
- In `filterAndRender()`:
  - Dynamically read `state = getState()`, resolving live `state.ingredients`, `state.categories`, and `state.products`.
  - Strip visual decorative prefixes from `rawVal` (e.g., `🏷️`, `📦`, `📂 [Category]`, `(...)`) to produce `cleanQuery`.
  - Tokenize `cleanQuery` into search words (`cleanQuery.split(/\s+/).filter(Boolean)`).
  - Implement token-based matching across the combined string `${item.name} ${sub.name} ${item.category}` and any attached products.
  - Support `products` searching when passed or present in live store.

### Step 2: Global Store Exposure in `src/store/store.js` & `src/main.js`
- Assign `window.Store = store` and `window.store = store` in `src/store/store.js` and `src/main.js` to ensure legacy references and helper tools reliably access central reactive state.

### Step 3: Polish Programmatic Auto-Population in `RecipeAuditModal.js`
- In `onComplete`:
  - Set `inputEl.value = displayLabel` and `inputEl.setAttribute('value', displayLabel)`.
  - Set `inputEl.dataset.taxVal = ...`, `mountEl.dataset.selectedId = ...`, `mountEl.dataset.selectedSubId = ...`.
  - Explicitly hide dropdown `dropdownEl.style.display = 'none'`.
  - Do NOT dispatch an `'input'` event (which triggers `oninput` re-filtering of the formatted label); dispatch `'change'` to notify external listeners safely.
  - Replicate same clean dispatch in `RecipeWizardTaxonomySearch.js` and `UnlinkedSweeperUI.js`.

### Step 4: Verification
- Run `node scripts/test_data_quality_wizards.js`.
- Run `npm run build`.
- Verify multi-word matching ("pastrami slices") against newly created items.

---

## 4. Multi-Order Impact & Architectural Considerations
- **SSOT (Pattern #1 & #2)**: Live state in the store is the single source of truth; no component depends on stale closure snapshots.
- **Sibling Parity (Pattern #17)**: The fix applies universally to all search inputs using `createTaxonomySearchInput`.
- **Zero Overhead**: In-memory token matching on 100-500 ingredients takes <1ms and does not add any external dependencies.
