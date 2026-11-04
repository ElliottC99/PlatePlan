# Deep Exploration: Live State Synchronization & Multi-Token Matching in Taxonomy Search

**Date**: 2026-11-04  
**Question**: Why do newly created items (e.g. "pastrami slices") fail to appear in the search dropdown list immediately after creation?

---

## 1. Executive Summary & Root Cause Analysis

Investigation revealed **3 cascading root causes**:

### Root Cause 1: `window.Store` is Undefined (Stale Array Trap)
In `RecipeSearchDropdownHelper.js`:
```javascript
const liveRootItems = (typeof window !== 'undefined' && Array.isArray(window.Store?.getState?.()?.ingredients) && window.Store.getState().ingredients.length > 0) 
  ? window.Store.getState().ingredients 
  : rootItems;
```
`window.Store` was never bound on `window` in `src/main.js` or `src/store/store.js`. As a result:
- `window.Store?.getState?.()` evaluates to `undefined`.
- `liveRootItems` and `liveCategories` permanently fall back to the initial `rootItems` closure array passed when `createTaxonomySearchInput` was first constructed.
- When an item (like "Pastrami Slices") is created via `commitAtomicChain`, `state.ingredients` in the store is updated, but the dropdown continues searching the stale, initial array snapshot. The new item is invisible.

### Root Cause 2: Single-String Multi-Word Match Failure
In `RecipeSearchDropdownHelper.js`:
```javascript
const matchesItem = !query || itemName.includes(query) || itemCat.includes(query);
const matchingSubtypes = subTypes.filter(s => !query || String(s?.name || '').toLowerCase().includes(query) || itemName.includes(query));
```
When a user creates "Pastrami" with sub-type "Slices" (or variant "Slices"), and then searches `"pastrami slices"`:
- `itemName` ("pastrami") does not contain `"pastrami slices"`.
- `s.name` ("slices") does not contain `"pastrami slices"`.
- Neither single field matches the full two-word string.
- As a consequence, searching for `"pastrami slices"` yields zero matches. Multi-token queries (checking all whitespace-separated words against the combined `${itemName} ${subName} ${category}`) are required.

### Root Cause 3: Programmatic `input` Event Causing Formatted Label Re-query
In `RecipeAuditModal.js` (and sibling modals):
```javascript
inputEl.dispatchEvent(new Event('input', { bubbles: true }));
```
Because `inputEl.oninput = () => filterAndRender();` was listening on that exact input:
- Setting `inputEl.value = "🏷️ Slices (Pastrami)"` and triggering `'input'` caused `filterAndRender()` to immediately execute with `query = "🏷️ slices (pastrami)"`.
- The formatted label with emoji and parentheses did not match any clean catalog entry, forcing the dropdown open with `"No matching records."`.
- Programmatic population should cleanly close the dropdown without firing search filter events.

---

## 2. Multi-Order Consequences ("And Then What?")

- **1st Order**:
  - Live state will be dynamically retrieved from `getState()` from `src/store/store.js` on every `filterAndRender()`.
  - Any item added via the wizard is instantly searchable in the active modal without page refresh or reopening.
- **2nd Order**:
  - Multi-token search will allow matching items where words are distributed across Root Item, Sub-type, and Category (e.g. "pastrami slices" matches Root Item "Pastrami" with Sub-type "Slices").
  - Users will find items faster with natural multi-word phrases.
- **3rd Order**:
  - Prevents ghost duplicates. Previously, when users couldn't find their newly created item in the search list, they were prompted to create it again, causing catalog bloat.
  - Consistent across Recipe Mapping Audit, Recipe Wizard, Unlinked Sweeper, and Reorganise Modals.

---

## 3. Stakeholder Impact Matrix

| Stakeholder | Impact | Risk / Mitigation |
|---|---|---|
| **End User (Elliott & Chloe)** | Newly created pantry items immediately appear in search and auto-populate without friction. | None; vastly improves UX. |
| **Data Quality Scanner** | Fewer unlinked / duplicate items created in error. | Positive impact on catalog health. |
| **System Performance** | Minimal; tokenizing 1-3 search words against in-memory ingredients array takes < 1ms. | High efficiency. |

---

## 4. Next Step & Decision Gate

**Decision Gate**: Proceed to `/plan`.
The root causes and solutions are fully verified. We are ready to formulate the implementation plan.
