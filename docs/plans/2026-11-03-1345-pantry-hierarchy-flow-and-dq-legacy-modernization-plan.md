---
title: Enforce 4-Tier Pantry Bank Process for New Items and Modernize Data Health Cards
type: fix
date: 2026-11-03
topic: pantry-hierarchy-and-dq-cards
---

# Enforce 4-Tier Pantry Bank Process for New Items and Modernize Data Health Cards

> Created: 2026-11-03
> Status: Implemented ✓

## Summary
Enforces the canonical 4-tier Pantry Bank process (`Category ➔ Root Item ➔ Sub-Type ➔ Product`) whenever a user creates a new item from recipe audits, autocomplete search dropdowns, or unlinked sweeper wizards. Fixes the `undefined (undefined)` bug in the Sweeper when products are created via Tesco or Manual pathways by standardizing callback payloads across `ProductBankView.js` and `AddItemWizardUI.js`. Modernizes legacy Data Health Centre cards ("Unmapped Core Ingredients" and "Weight-to-Volume Density Mismatch") with updated taxonomy terminology, non-blocking product linker options, produce liquid recognition, and replaces native `prompt()` with `DialogHelpers`.

---

## Prior Solutions
- `docs/solutions/logic-errors/atomic-hierarchy-staging-and-pantry-taxonomy-enforcement-20261031.md`
- `docs/solutions/logic-errors/recipe-wizard-taxonomy-auto-default-hierarchy-and-variant-isolation-20261103.md`

---

## Problem Statement

1. **New Item Hierarchy Bypass:**
   When users click "+ Create New Item" in `RecipeAuditModal` or `UnlinkedSweeperUI`, `openRecipeWizardTaxonomyModal` launches `AddItemWizardUI` starting at `item`, which groups Root Item Name and Category onto a single screen with loose inputs, rather than following the canonical Pantry Bank creation chain (`Category ➔ Root Item ➔ Sub-Type ➔ Product`). This prevents users from cleanly selecting an existing Category first, picking or creating a Root Item, defining a Sub-Type, and linking a Product.

2. **`undefined (undefined)` on Tesco and Manual Product Completion:**
   While commit `66ee35a` standardized the callback payload for the `existing` product selection path, saving a product through the `tesco` or `manual` pathways triggers `saveManualIng()` in `ProductBankView.js`. When `commitAtomicChain` completes, `window.__onHierarchyComplete` is invoked with raw `res`, where `ingredientId` and `parentName` are only nested under `res.rootItem`. Because the sweeper expects `data.ingredientId` and `data.parentName` at the root, the card displays `🏷️ undefined (undefined)`.

3. **Legacy Data Health Cards:**
   - **"Unmapped Core Ingredients":** Uses obsolete pre-4-tier terminology ("Core Ingredients" instead of "Root Items" or "Pantry Items"). Its primary action, `[Find Tesco Match]`, forces the user into a raw Tesco bookmarklet JSON paste modal with no option to link an existing product or enter a manual product.
   - **"Weight-to-Volume Density Mismatch":** Violates repository guidelines by calling native browser `prompt()`, which is blocked or awkward on mobile/PWA. Furthermore, culinary items like *Limes*, *Lemons*, and *Creamed Coconut* are flagged because volume measures (e.g. `15 ml lime juice`) linked to whole produce lack density entries in `UnitConversionService.js`.

---

## Proposed Changes

### 1. Enforce Canonical Pantry Bank Sequence in `AddItemWizardUI.js` & `RecipeWizardTaxonomyModal.js`
- In `RecipeWizardTaxonomyModal.js`:
  Configure `openAddItemWizard` to launch with `startAt: 'category'` (or step through the canonical sequence).
- In `AddItemWizardUI.js`:
  Ensure the wizard sequentially walks the user through:
  - **Step 1: Category** — Select an existing category via `createTaxonomySearchInput` or type a new category.
  - **Step 2: Root Item** — Filter existing root items in that category via `createTaxonomySearchInput` or type a new root item (pre-filling with the user's initial search query/phrase).
  - **Step 3: Sub-Type** — Select an existing sub-type or define a new sub-type (defaulting to "Standard").
  - **Step 4: Product** — Associate via Link Existing, Add Manually, or Import Tesco.

### 2. Standardize Atomic Commit Callback in `ProductBankView.js`
- In `src/views/ProductBankView.js` (line 397):
  Normalize the callback payload to always expose:
  ```javascript
  const rootObj = res?.rootItem || { id: pending.rootItemName, name: pending.rootItemName };
  const subObj = res?.subtype || { id: res?.subtypeId || pending.subtypeName, name: pending.subtypeName };
  cb({
    ...res,
    ingredientId: rootObj?.id || pending.rootItemName,
    parentName: rootObj?.name || pending.rootItemName,
    subtypeId: subObj?.id || pending.subtypeName,
    subtypeName: subObj?.name || pending.subtypeName,
    category: pending.category || res?.category || 'General',
    rootItem: rootObj,
    subtype: subObj,
    product: res?.product || updatedProd
  });
  ```
  This guarantees that whether a product is linked from an existing record, entered manually, or imported via Tesco, the Sweeper and Recipe Audit always receive fully populated `ingredientId`, `parentName`, `subtypeId`, and `subtypeName`.

### 3. Modernize Data Health Centre Cards
- **Card 1: "Pantry Items Lacking Store Products"**
  - Update `DataQualityScanner.js` and `DataQualityTableRenderService.js` to rename "Unmapped Core Ingredients" to "Pantry Items Lacking Store Products".
  - Replace `[Find Tesco Match]` with `[Link Product]`, which opens the modern product linker (`openAddItemWizard({ startAt: 'product' })` or `openProductEditModal`), allowing users to pick an existing product, import Tesco, or add manual details.
  - Retain `[Ignore]` with clear action text: "Mark Non-Store Staple".
- **Card 2: "Weight-to-Volume Density Mismatch"**
  - In `src/services/UnitConversionService.js`:
    Add culinary citrus/produce items (`lime`, `lemon`, `citrus`, `creamed coconut`, `coconut milk`) to `LIQUID_WORDS` or treat them with standard liquid density ($1.0\text{ g/ml}$) so recipes calling for `ml` of lime/lemon juice do not trigger false-positive dry good density warnings.
  - In `src/views/DataQualityTableRenderService.js`:
    Replace native `prompt()` with a `DialogHelpers` prompt or preset modal giving 1-click selections:
    - 💧 Liquid / Juice (1.0 g/ml)
    - 🥣 Flour / Powder (0.5 g/ml)
    - 🍚 Grains / Sugar (0.85 g/ml)
    - ✏️ Custom density input

---

## Acceptance Criteria
- [x] Clicking "+ Create New Item" guides the user through Category ➔ Root Item ➔ Sub-Type ➔ Product, allowing selection of existing categories, root items, and sub-types at each step.
- [x] Completing product association via Tesco or Manual pathways immediately updates the Unlinked Sweeper with valid `parentName` and `subtypeName` (no `undefined (undefined)`).
- [x] "Unmapped Core Ingredients" card is renamed to "Pantry Items Lacking Store Products" and offers a multi-option `[Link Product]` button.
- [x] "Weight-to-Volume Density Mismatch" no longer flags *Limes*, *Lemons*, or *Creamed Coconut* measured in `ml`, and replaces native `prompt()` with `DialogHelpers`.
- [x] `node scripts/test_data_quality_wizards.js` passes 100%.
- [x] `npm run build` succeeds cleanly.
