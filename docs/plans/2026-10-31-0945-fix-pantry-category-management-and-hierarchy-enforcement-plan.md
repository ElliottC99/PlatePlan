---
title: Pantry Bank Category Management & Hierarchy Enforcement - Plan
type: fix
date: 2026-10-31
topic: pantry-bank-category-hierarchy
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-explore
execution: code
---

# Pantry Bank Category Management & Hierarchy Enforcement - Plan

> Status: Implemented (Tested on localhost & offline test suite)

## Goal Capsule

- **Objective:** Fix the four broken and frustrating workflows in the Pantry Bank:
  1. Ensure all categories (including newly created ones and ones implicitly on ingredients/products) appear in the Move search.
  2. Implement the missing Category Manager UI so the "Categories" toolbar button opens a scrollable, manageable list of categories with item counts, rename, and safe delete (with mandatory reallocation).
  3. Replace clumsy native `<select>` dropdowns in reorganise/reallocation modals with segmented button groups (for operations) and live auto-completing search inputs (for target categories).
  4. Enforce complete hierarchy completion when adding an item in the Pantry Bank (`Category → Item → Sub-type → Product`).
- **Means:** 
  - Build `src/components/pantry/CategoryManagerModalUI.js` (<350 lines).
  - Update `src/services/ActionBridge.js` to route `manage-categories` directly.
  - Upgrade `src/components/pantry/ReorganiseModalUI.js` to use `getUnifiedCategories(state)` and button toggle pills instead of `<select>`.
  - Upgrade `src/components/pantry/AddToBankHubUI.js` into a 3-step wizard that guarantees a sub-type and product are defined/linked before committing.
  - Ensure `saveCategories` synchronises `state.categories` and broadcasts state events.
- **Product authority:** Elliott and Chloe use the app daily for household shopping and meal planning. Elliott's design preference: buttons for few choices (2–4), live auto-completing search for many choices (categories/items), and zero orphan/headless items without products.
- **Authority order:** The Product Contract, then this plan's Key Technical Decisions, then `CLAUDE.md`, `plateplan-architecture.md`, and `workflow-enforcer.md`.
- **Stop conditions:**
  - Stop if any file exceeds 400 lines (adhere strictly to modular decomposition).
  - Stop if a change deletes or bypasses `CategoryManagementRepository.js` cascading reallocations or `PantryTaxonomyService.js` atomic saves.
  - Stop if branching or PR commits target `main` directly.
- **Execution profile:** Browser ES modules with no bundler. Standalone Node test scripts (`node scripts/test_*.js`). Local testing via `npm run dev`.
- **Who ships:** Elliott develops on `dev/pantry-bank-category-hierarchy`, opens PR to `development`. After review and green CI, merges to `development`, tests on phones, then release PR to `main`.
- **Open blockers:** Awaiting approval/merge of PR #18 into `development`.

---

## Product Contract

### Summary

Preserve and enforce the 4-tier Pantry Bank hierarchy:
$$\text{Category} \longrightarrow \text{Item} \longrightarrow \text{Sub-type} \longrightarrow \text{Product}$$

1. **Move Category Search**: Always shows all active and unified categories without requiring page reload.
2. **Category Manager**: A dedicated modal listing all categories with item/product counts, rename button, and safe delete button. Deleting a category strictly enforces reallocating its items and products to another chosen category.
3. **UI Modernisation**: No awkward dropdowns for simple 2–4 option choices; use sleek segmented button strips. Category reallocation uses live search.
4. **Enforced Hierarchy**: Adding an item guides the user through defining at least one sub-type and linking an existing or new product before saving.

### Problem Frame

- **Move Root Item**: `ReorganiseModalUI.js` only reads `state.categories`, missing categories created during the session or present only on existing items/products.
- **Categories Button**: The toolbar button in `index.html` has `data-action="manage-categories"`, which is ignored by `ActionBridge.js`. In `PantryBankView.js`, it opens `ReorganiseModalUI.js` with no entity, which pops up an edit modal for a non-existent category called `"Category"`. There is no screen to view or manage categories as a collection.
- **Clunky Modal UX**: Several modals still use `<select>` elements for choosing actions (Move, Merge, Transform, Alias) and for selecting reallocation targets.
- **Incomplete Hierarchy**: Users can create orphan root items with zero sub-types and zero products. Because the app expects items to map to products for shopping lists, recipes with unlinked items fail or create incomplete shopping lists.

### Key Technical Decisions (KTD)

- **KTD1: Unified Category SSOT & Live Reactivity**: All category pickers MUST consume `getUnifiedCategories(state)` from `src/services/CategoryRepository.js`. When a category is created or updated via `saveCategories`, it must update `state.categories` and dispatch `plateplan:state:categories` so no stale state persists.
- **KTD2: Dedicated Category Manager Modal**: Implement `src/components/pantry/CategoryManagerModalUI.js` (<350 lines). Wire `data-action="manage-categories"` in `ActionBridge.js` and `PantryBankView.js` directly to this modal.
- **KTD3: Reorganise Modal UX Refactor**: Replace `<select>` elements in `ReorganiseModalUI.js` with pill button groups for operations. Use `createTaxonomySearchInput` for reallocation destination category.
- **KTD4: Add to Bank Guided Stepper**: In `AddToBankHubUI.js`, when "Item" is selected, transition through a 3-step wizard:
  1. *Item & Category*: Item name + category live search.
  2. *Sub-type*: Pre-fill with "Standard" (editable) or custom sub-type name.
  3. *Product*: Choose between:
     - Search existing unlinked products.
     - Search Tesco store products (via Tesco import modal).
     - Enter custom product name & unit.
  4. *Atomic Commit*: Call `commitAtomicChain` with all 4 levels populated.

---

## Technical Architecture & File Boundaries

### 1. `src/components/pantry/CategoryManagerModalUI.js` (NEW, ~250 lines)
- **Exports:** `openCategoryManagerModal()`
- **Responsibilities:**
  - Renders a clean, scrollable modal listing all unified categories.
  - Computes item and product counts for each category.
  - Provides a "+ New Category" input at the top.
  - Action button: **Rename** (prompts with custom prompt or inline input, calls `renameCategory` from `CategoryManagementRepository.js`).
  - Action button: **Delete** (opens safe reallocation dialog requiring destination selection via `createTaxonomySearchInput`, calls `deleteCategory`).
  - Updates local store and re-renders bank upon changes.

### 2. `src/services/ActionBridge.js` (~240 lines, edit lines 168-172)
- Route `manage-categories` and `open-category-manager` to `CategoryManagerModalUI.openCategoryManagerModal()`.

### 3. `src/views/PantryBankView.js` (~300 lines, edit lines 247-251)
- Route `action === 'manage-categories'` to `CategoryManagerModalUI.openCategoryManagerModal()`.

### 4. `src/components/pantry/ReorganiseModalUI.js` (~420 lines -> refactor to <380 lines)
- Import `getUnifiedCategories` from `CategoryRepository.js`.
- Replace `<select id="reorg-operation-select">` and `<select id="cat-reorg-op">` with segmented button groups (`.pill-toggle-group`).
- Replace `<select id="cat-realloc-select">` with `createTaxonomySearchInput`.
- Extract standalone category management functions into `CategoryManagerModalUI.js`.

### 5. `src/components/pantry/AddToBankHubUI.js` (~280 lines -> ~350 lines)
- When adding an Item:
  - Step 1: Category & Item Name.
  - Step 2: Sub-type Name (defaults to "Standard").
  - Step 3: Product selection / creation.
  - Saves the full chain with `commitAtomicChain`.
- When adding a standalone Category:
  - Call `saveCategories` and immediately update `state.categories` via `setCategories`.

### 6. `src/services/CategoryRepository.js` (68 lines, edit lines 55-64)
- Update `saveCategories(categories)` to call `setCategories(categories)` on the store and dispatch a custom event.

---

## Verification & Testing Strategy

1. **Automated Unit Tests**:
   - Create `scripts/test_category_manager.js`:
     - Test `getUnifiedCategories` returns newly added categories.
     - Test category renaming cascades to items and products.
     - Test category deletion safely reallocates items and products to the fallback category.
     - Test `commitAtomicChain` enforces `Category → Item → Sub-type → Product`.
2. **Localhost Manual Verification** (`npm run dev`):
   - Click "Categories" button in Pantry view: Category Manager modal opens with scrollable list and accurate counts.
   - Add a new category: Verify it appears immediately in the Category Manager and in the Move Item search without page refresh.
   - Rename a category: Verify items and products reflect the new category name.
   - Delete a category: Verify forced reallocation dialog requires choosing a destination category, and items are cleanly moved.
   - Move an item: Verify segmented buttons toggle cleanly, and target category search includes all categories.
   - Add to Bank -> Item: Verify it guides through Item -> Sub-type -> Product, and creates a fully linked hierarchy.
3. **CI Check**:
   - `npm run lint` and syntax check of all modified modules.

---

## Implementation Steps

### Phase 1: Preparation & Branching
1. Ensure PR #18 is merged into `development`.
2. `git switch development && git pull`.
3. `git switch -c dev/pantry-bank-category-hierarchy`.

### Phase 2: Category State & Action Bridge Routing
1. Update `CategoryRepository.js` `saveCategories` to update `setCategories` in the store.
2. Build `CategoryManagerModalUI.js` with scrollable list, counts, rename, and delete with reallocation.
3. Route `data-action="manage-categories"` in `ActionBridge.js` and `PantryBankView.js`.

### Phase 3: Modernise ReorganiseModalUI
1. Replace `<select>` operation dropdowns with segmented pill button groups.
2. Use `getUnifiedCategories(state)` for all category searches.
3. Use `createTaxonomySearchInput` for category reallocation destination.

### Phase 4: Enforce Hierarchy in AddToBankHubUI
1. Convert Add Item into a 3-step wizard (`Category & Item` → `Sub-type` → `Product`).
2. Wire product selection to either link an existing unlinked product, open Tesco import, or create custom product.
3. Commit atomically via `commitAtomicChain`.

### Phase 5: Verification & PR
1. Run `node scripts/test_category_manager.js`.
2. Run all existing tests (`node scripts/test_shopping_list.js`, etc.).
3. Test manually on localhost (`http://localhost:3000`).
4. Inspect `git diff --stat origin/development` for diff hygiene.
5. Open PR into `development` using `.github/pull_request_template.md`.
