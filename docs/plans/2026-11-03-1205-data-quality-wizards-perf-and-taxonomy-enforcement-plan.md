---
title: Data Quality Wizards Performance, Sub-Type Search Enforcement & Unlinked Sweeper Fix
type: fix
date: 2026-11-03
topic: data-quality-wizards-perf-and-taxonomy-enforcement
---

# Plan: Data Quality Wizards Performance, Sub-Type Search Enforcement & Unlinked Sweeper Fix

> Created: 2026-11-03  
> Status: Implemented ✓  
> Author: Antigravity Pair Programming

## Summary

This plan addresses 3 operational issues discovered during live testing of the Data Health Centre resolution wizards:
1. **Resolve Orphans Hierarchy & Search**: Products in PlatePlan strictly belong to **Sub-types** under a root ingredient (`Category ➔ Root Item ➔ Sub-Type ➔ Product`). The current modal uses a clumsy HTML `<select>` dropdown and allows converting to bare parent-level. We replace this dropdown with PlatePlan's canonical `createTaxonomySearchInput({ subtypesOnly: true })` autocomplete search from `RecipeSearchDropdownHelper.js`, strictly enforcing sub-type assignment while enabling fast keyboard search and in-line sub-type creation.
2. **Unlinked Sweeper Crash**: `scanUnlinkedRecipeIngredients()` in `UnlinkedSweeperUI.js` attempted to read `window.Store?.getState?.()`, returning `undefined` when `window.Store` is not exposed, causing `Async Error: Cannot read properties of undefined (reading 'recipes')`. We replace this with the imported `getState()` helper.
3. **Recipe Mapping Audit Thread Freeze**: The Recipe Mapping Audit found 326 issues (primarily 277 legacy `fam_...` IDs). For every single issue, `renderIssueCard` generates a full `<select>` element with 300 pantry items, synchronously constructing $\approx 97,800$ HTML `<option>` nodes on the main thread and freezing the UI for 5–10 seconds. We introduce pagination / chunking (20 items per page), reducing synchronous DOM elements to $\approx 6,000$ (<50ms launch time), while keeping the 1-click `⚡ Auto-Fix Confident Matches` batch resolver intact.

---

## Prior Solutions Referenced

- [`docs/solutions/logic-errors/atomic-hierarchy-staging-and-pantry-taxonomy-enforcement-20261031.md`](file:///Users/elliottcallender/Downloads/PlatePlan-main/docs/solutions/logic-errors/atomic-hierarchy-staging-and-pantry-taxonomy-enforcement-20261031.md):
  - Pattern: `createTaxonomySearchInput({ subtypesOnly: true })` restricts product linking strictly to sub-types formatted with parent context: `🏷️ [Sub-Type Name] · 📂 [Category] › 📦 [Root Item]`.
- [`docs/solutions/logic-errors/recipe-wizard-taxonomy-auto-default-hierarchy-and-variant-isolation-20261103.md`](file:///Users/elliottcallender/Downloads/PlatePlan-main/docs/solutions/logic-errors/recipe-wizard-taxonomy-auto-default-hierarchy-and-variant-isolation-20261103.md):
  - Pattern: Sub-type selection format `ingredientId:subtypeId`.

---

## Acceptance Criteria

- [ ] **Strict Sub-Type Search in Orphan Resolver**:
  - `SubtypeOrphanResolverModal.js` replaces the `<select>` dropdown with `createTaxonomySearchInput({ subtypesOnly: true, rootItems, onSelect, onNewClick })`.
  - Every product resolution targets a valid sub-type (`ingredientId` + `subtypeId`), or deletion (`🗑️ Delete Product`).
  - Supports in-line creation of a new sub-type if the target does not exist yet.
- [ ] **Unlinked Sweeper Stability**:
  - `scanUnlinkedRecipeIngredients` in `UnlinkedSweeperUI.js` uses imported `getState()` from `../../store/store.js` with safe fallback.
  - Clicking `Unlinked Sweeper` opens the modal immediately without any async error.
- [ ] **Recipe Mapping Audit Performance**:
  - `RecipeAuditModal.js` paginates the issue list (20 items per page with Prev / Next pagination controls).
  - Modal launches immediately without freezing the browser thread.
  - `⚡ Auto-Fix Confident Matches` remains functional across the entire dataset (not just the current page), resolving high-confidence matches in one atomic batch.

---

## Implementation Steps

### Step 1: Replace Dropdown with Sub-Type Autocomplete in `SubtypeOrphanResolverModal.js`
- Import `createTaxonomySearchInput` from `../pantry/RecipeSearchDropdownHelper.js`.
- In `openSubtypeOrphanResolverModal`:
  - For each affected product row, render a search mount container:
    ```html
    <div class="product-tax-search-mount" data-prod-id="${escapeHtml(p.id)}"></div>
    ```
    alongside a small action pill / button for `🗑️ Delete Product`.
  - Mount `createTaxonomySearchInput({ container, rootItems: ingredients, subtypesOnly: true, placeholder: 'Search sub-type (e.g. Protein Bagels)...', onSelect: (res) => ... })`.
  - Store selected `{ ingredientId, subtypeId }` on the row or state map.
  - Commit logic saves the reassigned `{ ingredientId, subtypeId }` via `batchResolveOrphansWithNewSubtypeInDb`.

### Step 2: Fix State Reference in `UnlinkedSweeperUI.js`
- In `src/components/data-quality/UnlinkedSweeperUI.js`:
  - Change line 29 from `const state = (typeof window !== 'undefined' ? (window.Store?.getState?.() ) : {});` to:
    ```js
    const state = (typeof getState === 'function' ? getState() : (typeof window !== 'undefined' && window.Store?.getState ? window.Store.getState() : {})) || {};
    const recipes = Array.isArray(state.recipes) ? state.recipes : Object.values(state.recipes || {});
    ```

### Step 3: Paginate Recipe Mapping Audit in `RecipeAuditModal.js` & `RecipeAuditModalRenderService.js`
- In `src/components/recipe/RecipeAuditModal.js`:
  - Add `currentPage = 1`, `pageSize = 20`.
  - Filter issues based on `currentFilter` and `currentSearch`.
  - Slice visible issues: `const pageIssues = filteredIssues.slice((currentPage - 1) * pageSize, currentPage * pageSize);`.
  - Render pagination controls (Showing X–Y of Z, [Previous] [Next]).
  - Reset `currentPage = 1` on filter or search changes.
  - Ensure `⚡ Auto-Fix Confident Matches` evaluates `issues` (all filtered confident issues), not just `pageIssues`.

### Step 4: Verification & Build
- Verify syntax with `node --check`.
- Run automated tests in `scripts/test_data_quality_wizards.js`.
- Run `npm run build` and `npm run ledger`.
