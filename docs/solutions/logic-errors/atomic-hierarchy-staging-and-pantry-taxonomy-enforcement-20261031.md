---
date: "2026-10-31"
problem_type: "logic_error"
component: "javascript_logic"
severity: "medium"
symptoms:
  - "Premature creation of orphaned sub-types and root items when user exits or cancels an addition modal early"
  - "Duplicate category rows appearing in Category Manager due to case and punctuation variations"
  - "Inability to delete empty categories without encountering forced reassignment prompts"
  - "Reorganising an existing item to a new category redirects to a blank creation wizard instead of reallocating in-place"
  - "Add Product search dropdown displaying bare categories and root items instead of valid sub-types"
root_cause: "wrong_assumption"
tags:
  - "pantry-bank"
  - "hierarchy-enforcement"
  - "atomic-commit"
  - "state-staging"
  - "taxonomy-reorganisation"
related_issues: []
last_referenced: "2026-10-31"
status: "active"
---

# Atomic Hierarchy Staging & Pantry Taxonomy Enforcement

## Problem Statement

**What happened:**
The Pantry Bank taxonomy model requires strict hierarchical containment:
`Category ➔ Root Item ➔ Sub-Type ➔ Product`.
However, users experienced several breakdown points:
1. **Premature Persistence on Early Exit:** Navigating into the Product creation step of the Add-to-Bank wizard committed the upstream Category, Root Item, and Sub-Type to Firestore *before* the product was saved. If a user cancelled or closed the modal, orphaned taxonomy records with no linked products were permanently saved.
2. **Reorganisation Dropdown Bypass:** Moving an existing root item with established sub-types and products (e.g. `Flat Noodles`) to a newly typed category (e.g. `Noodles`) bounced the user into a blank creation wizard instead of updating the root item, its sub-types, and products in-place.
3. **Invalid Taxonomy Selectors:** The "Add Product" selector displayed bare categories and bare root items even though products can strictly only link to sub-types.
4. **Casing Duplication:** Categories differing only by character case or punctuation (e.g. `"and"` vs `"And"`) appeared as distinct entries in the Category Manager with duplicate item counts.
5. **Blocked Empty Category Deletion:** Categories with 0 items and 0 products could not be deleted without selecting a reassignment target.

**Impact:**
Pantry database records became fragmented with orphan sub-types and empty items, while users encountered friction and duplicate categories during routine pantry maintenance.

---

## Symptoms Observed

1. Exiting the product modal left incomplete taxonomy chains in Firestore without linked products.
2. Category Manager rendered duplicate rows (e.g. `Baking, Chocolate and Sweets` and `Baking, Chocolate And Sweets`) showing identical item/product counts.
3. Attempting to delete an empty category failed or forced selecting an unnecessary reassignment category.
4. Reorganising a root item to a new category did not preserve its existing sub-types and products.

---

## Investigation Steps

| Attempt | Hypothesis | Result |
|---|---|---|
| 1. Trace Add-to-Bank Product transitions | `proceedToProduct()` was running `commitAtomicChain()` prematurely before the product modal was confirmed | ✅ Confirmed: database writes executed prior to product form submission |
| 2. Inspect Reallocate modal inline sub-type creation | Inline "Save Sub-Type" immediately invoked `saveIngredient()` | ✅ Confirmed: cancelling the reallocate modal left the sub-type persisted |
| 3. Audit Category Manager duplicate keys | `getUnifiedCategories()` used raw case-sensitive strings in a `Set` | ✅ Confirmed: casing variants produced duplicate category entries |
| 4. Audit Move Category flow in Reorganise modal | `onNewClick` redirected to `openAddItemWizard()` rather than passing target to `executeSafeReallocation()` | ✅ Confirmed: existing hierarchy was discarded instead of reallocated |

---

## Root Cause Analysis

* **Premature Eager Commits:** The application assumed that staging an entity required writing it to the database immediately, rather than maintaining draft state in memory until the entire atomic chain is complete.
* **Lack of Normalization in Taxonomy SSOT:** String comparison in category sets did not normalize alphanumeric keys, causing Firestore case variants to bifurcate into duplicate display entries.
* **Modal Context Switching:** Reorganise operations failed to treat "create new target category" as an in-place property assignment on the active item, unnecessarily spawning a secondary wizard.

---

## Working Solution

### 1. In-Memory Atomic Staging Pattern
In `AddItemWizardUI.js`, transitions to the Product step no longer write to Firestore. Instead, the hierarchy is staged in `window.__pendingHierarchyCommit`:
```javascript
window.__pendingHierarchyCommit = {
  category: wizardData.category || 'General',
  rootItemName: wizardData.itemName,
  subtypeName: wizardData.subtypeName || 'Standard'
};
```
In `ProductBankView.js`, `saveManualIng()` checks for `window.__pendingHierarchyCommit`. Only when the user clicks **Save** does `commitAtomicChain()` execute, committing all 4 tiers atomically:
```javascript
if (window.__pendingHierarchyCommit) {
  const pending = window.__pendingHierarchyCommit;
  window.__pendingHierarchyCommit = null;
  await commitAtomicChain({
    category: pending.category || inheritedCategory,
    rootItemName: pending.rootItemName,
    subtypeName: pending.subtypeName,
    productPayload: updatedProd
  });
  cancelManualIng();
  return;
}
```
If the user cancels or closes the modal, `cancelManualIng()` purges `window.__pendingHierarchyCommit` and **zero database writes occur**.

### 2. In-Place Reorganisation with Cascading Category Reassignment
In `ReorganiseModalUI.js` and `PantryTaxonomyService.js`, selecting or typing a new category name in "1. Move Category" updates `sourceItem.category`, all child `subtypes`, and all linked `products` in one operation without leaving the Reorganise modal.

### 3. Strict Sub-Type Only Filtering for Products
`createTaxonomySearchInput({ subtypesOnly: true })` restricts options strictly to sub-types formatted with parent context:
`🏷️ [Sub-Type Name] · 📂 [Category] › 📦 [Root Item]`

### 4. Alphanumeric Category Normalization
`getUnifiedCategories()` now unifies categories using normalized alphanumeric keys (`normKey = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')`), safely collapsing casing and punctuation variants into a single canonical entry.

### 5. Instant Empty Category Deletion
In `CategoryManagerModalUI.js`, categories with 0 items and 0 products bypass the reassignment selector and delete immediately upon confirmation.

---

## Prevention Strategies

1. **Never persist partial domain models:** Multi-step guided creation wizards must keep draft state in memory and execute persistence exclusively upon final submission.
2. **Canonical keys for user-input taxonomy:** Always normalize identifiers via slugification or alphanumeric cleansing when aggregating taxonomy tags.
3. **Automated Unit Verification:** Verify atomic commits and category cascades using `scripts/test_category_manager.js`.
