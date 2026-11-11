---
date: "2026-11-03"
problem_type: "logic_error"
component: "javascript_logic"
severity: "high"
symptoms:
  - "Ingredients in Step 2 defaulted to sub-types (e.g. Eggs became Medium Eggs) when mapped from linked products"
  - "Step 2 threw a blocking toast 'Cannot proceed: 12 ingredient(s) retain an unlinked New Item status' when advancing to Step 3"
  - "Deleting the enhanced variant of Spicy Dan Dan Noodles repeatedly resurrected due to a background recovery subscription loop"
  - "Auto-Enhance modal threw ReferenceError: escapeAttr is not defined and routeNavHtml is not defined"
root_cause: "incorrect_algorithm"
tags:
  - "recipe-wizard"
  - "taxonomy-mapping"
  - "auto-default-hierarchy"
  - "variant-isolation"
  - "cleanup"
related_issues: []
related_solutions:
  - "docs/solutions/logic-errors/recipe-vault-enhanced-variant-safe-deletion-20261101.md"
  - "docs/solutions/logic-errors/atomic-hierarchy-staging-and-pantry-taxonomy-enforcement-20261031.md"
last_referenced: "2026-11-11"
---

# Recipe Wizard Taxonomy Hierarchy Precedence, Exact User Level Preservation, and Dual-Variant Isolation

## Problem Statement

When users reviewed recipes or auto-enhanced variants in the Recipe Wizard:
1. Ingredients mapped from products eagerly collapsed to the most specific sub-type (e.g. "Eggs" mapped to "Medium Eggs") rather than preserving root items or categories where the product is the designated auto-default.
2. Clicking **Next** from Step 2 to Step 3 blocked the user with a toast error claiming ingredients retained an unlinked "✨ New Item" status.
3. Enhanced variant deletion for Spicy Dan Dan Noodles was blocked by an automatic re-restoration hook running in `main.js` reactive subscriptions.
4. Auto-Enhance modal crashed on opening due to undefined references (`escapeAttr`, `routeNavHtml`).

## Symptoms

1. **Hierarchy Downgrading**: Product "Medium Free Range Eggs" was automatically assigned to Sub-Type "Medium Eggs", stripping the user's root item assignment "Eggs".
2. **Transition Block**: `syncStep2InputsToState` failed to recognize `prod:` input values as mapped, resetting them to unlinked items and blocking Step 3 transition.
3. **Resurrecting Variant**: Deleting the enhanced variant removed it locally, but within seconds `subscribe('recipes')` triggered `restoreDanDanNoodles()`, recreating the variant.
4. **Runtime Errors**: Opening the auto-enhance modal triggered `ReferenceError: escapeAttr is not defined` and `ReferenceError: routeNavHtml is not defined`.

## Root Cause Analysis

1. **Taxonomy Precedence**: In `RecipeWizardTaxonomySearch.js`, when resolving a product to taxonomy, the code checked `if (prod.subtypeId)` first, which always favored sub-types over root items, even when the product was the primary auto-default for the parent root item (`rootItem.defaultProductId === prod.id`).
2. **Step 2 Input Synchronization**: `syncStep2InputsToState` had no translation layer for `prod:` prefixes, blanking them out to empty strings and forcing `isNewTaxonomyItem: true`.
3. **Ghost Subscriptions**: A recovery hook designed for a one-off database restoration was placed inside `subscribe('recipes')` in `main.js`. Because `subscribe` fires on every Firestore update (including deletions), deleting the variant triggered the check `if (danDan && !danDan.enhanced)` and restored it immediately.

## Solution

### 1. Highest Auto-Default Hierarchy Precedence (`resolveHighestAutoDefaultTaxonomy`)

Introduced `resolveHighestAutoDefaultTaxonomy(prod, { ingredients, products })` following strict hierarchy:
```javascript
export function resolveHighestAutoDefaultTaxonomy(prod, { ingredients = [], products = [] } = {}) {
  if (!prod || typeof prod !== 'object') return { level: 'unknown' };
  const pId = String(prod.id);

  // 1. Check if Category Auto-Default
  if (prod.isCategoryDefault || ((prod.category || prod.cat) && prod.isAutoDefault && !prod.ingredientId && !prod.subtypeId)) {
    return { level: 'category', categoryId: prod.category || prod.cat };
  }

  // 2. Check if Root Item Auto-Default (Category > Root Item > Sub-Type)
  const rootItemDef = (ingredients || []).find(i => 
    String(i.defaultProductId) === pId || (String(i.id) === String(prod.ingredientId) && prod.isAutoDefault && !prod.subtypeId)
  );
  if (rootItemDef) {
    return { level: 'root', ingredientId: rootItemDef.id, name: rootItemDef.name };
  }

  // 3. Check if Sub-Type Auto-Default
  for (const ing of (ingredients || [])) {
    for (const sub of (ing.subtypes || [])) {
      if (String(sub.defaultProductId) === pId || (String(sub.id) === String(prod.subtypeId) && prod.isAutoDefault)) {
        return { level: 'subtype', ingredientId: ing.id, subtypeId: sub.id, name: sub.name };
      }
    }
  }

  // Fallback to structural hierarchy if not an auto-default...
}
```

### 2. Strict User Selection Preservation in Wizard State

In `syncStep2InputsToState` ([`RecipeWizardState.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/recipe/RecipeWizardState.js)), the user's selection is strictly preserved:
- Category selection (`cat:X`): sets `categoryId: X`, clears `ingredientId`, `subtypeId`, and `productId`.
- Root Item selection (`ingId`): sets `ingredientId: ingId`, clears `categoryId`, `subtypeId`, and `productId`.
- Sub-Type selection (`ingId:subId`): sets `ingredientId: ingId`, `subtypeId: subId`, clears `categoryId` and `productId`.
- In all valid selections, `isNewTaxonomyItem` is set to `false`, resolving the blocking toast error.

### 3. Removal of Ghost Subscriptions and Cleanup of Temporary Recovery Code

1. Removed the automatic check in `subscribe('recipes')` in `main.js`.
2. Attached `removeCurrentEnhancedVariant` directly to `window` for reliable action bridge delegation.
3. Completely deleted the static recovery payload [`src/config/restoredDanDan.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/config/restoredDanDan.js) and removed its import and window hook from `main.js`.

### 4. UI Hardening

Defined `escapeAttr` and removed orphaned `${routeNavHtml}` references in [`RecipeEnhancementModalUI.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/recipe/RecipeEnhancementModalUI.js).

### 5. Step 3 Persistence Level Preservation & Operator Precedence (Updated 2026-11-11)

Even when Step 2 correctly recorded `ingredientId: 'ing_maple'` and `subtypeId: null`, Step 3 persistence in [`RecipeWizardStep3Handlers.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/recipe/RecipeWizardStep3Handlers.js) fell back to the resolved default product's `subtypeId` (`const resolvedSubId = i.subtypeId || resolvedProd?.subtypeId || null;`), permanently baking sub-type bindings into saved recipes.

Additionally, checking taxonomy levels requires strict operator precedence:
```javascript
// WRONG: i.categoryId by itself evaluates to true, wiping ingredientId on all existing recipes with categoryId metadata!
if (i.categoryId || (i.category && !i.ingredientId && !i.subtypeId))

// CORRECT:
if ((i.categoryId || i.category) && !i.ingredientId && !i.subtypeId) {
  finalCat = i.categoryId || i.category;
  finalIngId = null;
  finalSubId = null;
  isCatDefault = true;
} else if (i.ingredientId && !i.subtypeId) {
  finalIngId = i.ingredientId;
  finalSubId = null;
  finalCat = i.category || resolvedProd?.category || null;
}
```

Retrospective elevation logic was encapsulated in [`src/services/RecipeTaxonomyElevationService.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/RecipeTaxonomyElevationService.js) as a pure, zero-dependency browser ES module to ensure compatibility with client PWAs without crashing on Node.js built-ins (`node:fs`, `node:path`).

## Verification

- Automated test suites passing:
  - `scripts/test_variant_save_and_taxonomy_mapping.js`
  - `scripts/test_recipe_review_and_auto_enhance_flow.js`
  - `scripts/test_vault_recipe_card_menu.js`
  - `scripts/test_shopping_list.js`
  - `scripts/test_dynamic_recipe_product_resolution.js`
  - `scripts/test_data_quality_wizards.js`
  - `scripts/test_hig_dark_mode.js`
- Clean `npm run ledger` and `npm run build`.

## Prevention & Lessons Learned

1. **Never Wire Data Recovery Hooks into Reactive Subscriptions**: Recovery code must always be an intentional, explicit, one-shot script or dev tool command. Putting conditional restoration inside reactive streams will fight against legitimate user deletions.
2. **Auto-Default Precedence Must Flow Top-Down**: When resolving products to abstract taxonomy, always evaluate from broadest to narrowest (`Category > Root Item > Sub-Type`). If a product is the designated default for a Root Item, mapping it to a sub-type loses the user's intentional abstraction.
3. **Respect Explicit User Choices**: The wizard must never mutate or downgrade explicit user selections. Always preserve the exact level selected by the user.
4. **Never Fall Back to Concrete Products for Abstract Mappings on Save**: When mapping is preserved at Root Item or Category level, persist `subtypeId: null` in Firestore. Let runtime resolution (`resolveDynamicProductForIngredient`) determine products dynamically so changes to pantry defaults take effect without modifying recipes.
5. **Enforce Browser-Safe Domain Boundaries**: Place all domain transformation functions in `src/services/` free of Node.js built-ins (`node:fs`, `node:path`, `process.argv`), and have CLI runners in `scripts/` import from them.
