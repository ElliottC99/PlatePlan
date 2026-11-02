# Exploration: Auto-Default Strategy Preference & Recipe Macro Auto-Update Pipeline

> Date: 2026-11-02  
> Topic: auto-default-preference-and-recipe-recalculation  
> Question: Why is the auto-default preference not set to "Highest Protein Density", why is auto-default resolution not selecting the expected products, and why don't recipes auto-update when defaults change?  
> Status: Exploration Complete  

---

## 1. Executive Summary

The user observed two related architectural anomalies:
1. **Auto-Default Preference Disconnect:** The household preference should be set to "Highest Protein Density" (`highest_protein_per_kcal`), but the app currently behaves as though it is set to "Lowest Absolute Price" (`lowest_absolute_price`).
2. **Recipes Do Not Auto-Update:** When pantry products or default product assignments change, existing recipes in the Vault do not recalculate their macros (calories, protein, fit scores).

### Core Findings
1. **Preference Key Mismatch & Hardcoded Fallbacks:**
   - In Firestore (`households/elliott-chloe/settings/preferences`), the user's saved preference was originally stored under legacy keys:
     - `productPriority: "protein_per_kcal"`
     - `autoMappingStrategy: "protein_per_kcal"`
   - The current UI (`DietaryExclusionManager.js`), hydration (`HydrationService.js`), and hierarchy resolution (`PantryHierarchyService.js`) strictly look for `autoDefaultStrategy` or `autoDefaultCriterion`.
   - Because neither key is aliased from `productPriority` or `autoMappingStrategy`, all four resolution paths fall back to the hardcoded string `'lowest_absolute_price'`.
   - Furthermore, `whitelistPreferences` in `PreferenceRepository.js:14` omits `autoDefaultStrategy` and `autoDefaultCriterion` from its allowed top-level keys, causing preference writes to drop them if saved outside `settings`.

2. **The `isAutoDefault` Precedence Trap:**
   - In `PantryHierarchyService.js` and `PantryHierarchyModel.js`, `resolveDefaultProduct(item, products)` checks:
     ```javascript
     const autoDefault = list.find(p => ... && (p.isAutoDefault === true || p.is_default === true));
     if (autoDefault) return { ...autoDefault, isAutoDefault: true };
     if (item.defaultProductId) return ...
     ```
   - Even when `sweepAndRecalibrateIngredientDefaults()` runs and sets `ing.defaultProductId = bestProduct.id`, it **never updates `products` collection `isAutoDefault` flags**. Any product that has legacy `isAutoDefault: true` trumps `ing.defaultProductId` and overrides the strategy sort.
   - 41 ingredients in the household database have a better product option under `highest_protein_per_kcal` (e.g. Linda McCartney Sausages with 17g protein / 123 kcal vs 8.7g protein / 148 kcal; Light Mayonnaise vs full-fat Mayonnaise; Lighter Cypriot Cheese vs full-fat Halloumi), but they are blocked by stale `isAutoDefault` flags or missing recalibrations.

3. **Recipes Store Frozen Snapshot Macros with Pinned Product IDs:**
   - In PlatePlan, `recipe.nutrition` and `recipe.macros` are **static snapshots** serialized to Firestore when a recipe is saved in the Recipe Wizard (`recalculateWizardMacros`).
   - There is **no reactive recalculation pipeline** connecting Product/Default changes to Recipe documents.
   - 1,611 out of 1,687 recipe ingredients across the household database store a hardcoded `productId` directly on the ingredient. When macros are evaluated, `resolveProductForIngredient(item)` uses `item.productId` first. Even if the ingredient's default product changes, the recipe continues to point to the specifically pinned product ID.
   - A simulation against the household database revealed that **94 recipes** would have significant macro shifts (e.g. `Sausage Potato Bake`: 1,186 kcal $\to$ 738 kcal; `Crispy Korean Wings`: 12,365 kcal $\to$ 646 kcal) if recalculated using their ingredients' optimal defaults.

---

## 2. Root Cause Breakdown

### Issue A: Why Preference is Not "Highest Protein Density"

```
[Firestore: households/elliott-chloe/settings/preferences]
  ├── userPrefs.productPriority: "protein_per_kcal"  (Legacy)
  ├── userPrefs.autoMappingStrategy: "protein_per_kcal"  (Legacy)
  └── userPrefs.autoDefaultStrategy: undefined  (Missing)
                          │
                          ▼
[HydrationService.js:54 / DietaryExclusionManager.js:28]
  criterion = userPrefs.autoDefaultStrategy || userPrefs.autoDefaultCriterion || 'lowest_absolute_price'
                          │
                          ▼
             Defaults to 'lowest_absolute_price' !
```

1. **Missing Aliasing**: Neither `HydrationService.js` nor `DietaryExclusionManager.js` checks `productPriority` or `autoMappingStrategy`.
2. **Hardcoded Fallbacks**:
   - `src/services/HydrationService.js:54`: defaults to `'lowest_absolute_price'`
   - `src/services/PantryHierarchyService.js:125`: defaults to `'lowest_absolute_price'`
   - `src/services/PantryHierarchyService.js:65`: defaults to `'lowest_absolute_price'`
   - `src/components/settings/DietaryExclusionManager.js:28`: defaults to `'lowest_absolute_price'`
   **The system default is hardcoded to Price, not Protein Density.**
3. **Whitelist Stripping**:
   `src/services/PreferenceRepository.js:14`:
   `allowedKeys = ['nutritionTargets', 'profiles', 'fitScoreParams', 'settings', 'theme', ...]`
   `autoDefaultStrategy` is omitted from `allowedKeys`.

---

### Issue B: Why Auto-Default Resolution Does Not Select Optimal Products

1. **Precedence Flaw in `resolveDefaultProduct`**:
   In `src/services/PantryHierarchyService.js:112`:
   ```javascript
   export function resolveDefaultProduct(item, products = []) {
     if (!item) return null;
     const list = Array.isArray(products) ? products : Object.values(products || {});
     // Step 1: Any product with isAutoDefault: true wins immediately
     const autoDefault = list.find(p => ... && (p.isAutoDefault === true || p.is_default === true));
     if (autoDefault) return { ...autoDefault, isAutoDefault: true };

     // Step 2: Stored defaultProductId on ingredient
     if (item.defaultProductId) {
       const matched = list.find(p => String(p.id) === String(item.defaultProductId));
       if (matched) return { ...matched, isAutoDefault: true };
     }

     // Step 3: Strategy sort only runs if Step 1 AND Step 2 are empty!
     ...
   }
   ```
   If a product was marked `isAutoDefault: true` in the past, or if the ingredient had a legacy `defaultProductId`, the strategy sorting logic (Step 3) **never executes**!

2. **Incomplete Recalibration in `sweepAndRecalibrateIngredientDefaults`**:
   When the user taps "Recalibrate All Defaults Now", `sweepAndRecalibrateIngredientDefaults` updates `ing.defaultProductId = bestProduct.id` in `ingredients`. However:
   - It **does not update `products` collection**.
   - Any product that still has `isAutoDefault: true` in the `products` bank continues to win in `resolveDefaultProduct` and `ShoppingCalculationService.js:223`!
   - In `ProductBankView.js:347`, when a new product is linked to an ingredient, it sets `isAutoDefault: true` unconditionally.

---

### Issue C: Why Recipes Do Not Auto-Update

1. **Decoupled Architecture (Static Recipe Documents)**:
   - A recipe in Firestore has fixed macro fields:
     - `recipe.macros = { calories, protein, carbs, fat }`
     - `recipe.nutrition = { perServing: { cal, prot, ... }, total: { ... } }`
   - When the recipe card is rendered in the Vault (`VaultRecipeCard.js`), it reads `recipe.nutrition.perServing` or `recipe.macros`.
   - When `calculateMealFitScore` calculates fit scores, `extractRecipeMacros` reads `recipe.nutrition.perServing` or `recipe.macros`.
   - **Recipe macros are not dynamically computed from products at render time.** They are purely static data.

2. **Pinned Ingredient Product IDs**:
   - In 96% of recipe ingredients (1,611 / 1,687), `item.productId` is populated with a specific product ID.
   - When `recalculateWizardMacros` runs:
     ```javascript
     const directId = item.productId || item.bankId || item.mappedItemId;
     if (directId) {
       const prod = products.find(p => String(p.id) === String(directId));
       if (prod) return prod;
     }
     ```
   - It honors the pinned `productId` and never looks up the parent ingredient's default product.

3. **No Batch Recalibration Command or Event Hook**:
   - `MaintenanceService.alignAllFitScores` exists, but it only recalculates fit scores against *existing recipe macros*.
   - There is currently no `recalculateAllRecipeMacros()` function in the codebase to re-evaluate recipes against their ingredients' default products.

---

## 3. Real-World Household Impact (Simulation Data)

Running `highest_protein_per_kcal` against the household database revealed:

### Top Default Product Shifts
| Ingredient | Current Default | Optimal Default (`highest_protein_per_kcal`) | Impact |
| :--- | :--- | :--- | :--- |
| **Sausages** | 8 Meat Free Vegan Sausages (148 kcal, 8.7g P) | Linda McCartney 6 Vegan Red Onion Sausages (123 kcal, 17.0g P) | **+95% protein density** |
| **Beef Burgers** | Takeaway Quarter Pounder (147 kcal, 15.0g P) | Tesco Plant Chef Meat-Free Burgers (124 kcal, 17.6g P) | **+38% protein density** |
| **Mayonnaise** | Mayonnaise (670 kcal, 0.9g P) | Light Mayonnaise (269 kcal, 0.6g P) | **-60% calories** |
| **Halloumi** | Halloumi (300 kcal, 20.7g P) | Lighter Cypriot Cheese (259 kcal, 23.7g P) | **+32% protein density** |
| **Broccoli** | Broccoli (40 kcal, 4.3g P) | Tenderstem Broccoli (38 kcal, 4.4g P) | **Slight optimization** |

### Top Recipe Macro Shifts (if Recipes Were Recalculated)
- **Sausage, Pesto & Mozzarella Potato Bake**: 1,186 kcal $\to$ **738 kcal** (-38% kcal, leaner profile)
- **Crispy Korean-Style Chicken Wings**: 12,365 kcal (legacy parsing artifact) $\to$ **646 kcal** (normalized)
- **Cornflake Crunch Tofu Ciabattas**: 1,201 kcal $\to$ **846 kcal** (-30% kcal)
- Total recipes with significant macro improvements: **94 recipes**

---

## 4. Multi-Order Consequences Analysis

### 1st Order Consequences
- Setting `autoDefaultStrategy` to `'highest_protein_per_kcal'` will correctly prioritize high-protein, calorie-efficient products across the Pantry Bank.
- Clearing stale `isAutoDefault` flags on non-optimal products ensures the strategy-sorted product is actually treated as the default.

### 2nd Order Consequences
- **Recipe Fit Scores**: If recipes are recalculated to use optimal default products, Vault fit scores will significantly increase (many recipes moving from Amber/Yellow to Green 85%+).
- **Meal Plan Generation**: The automated meal planner (`MealPlanGeneratorService.js`) will select recipes that align closer with Elliott and Chloe's daily calorie and protein targets.
- **Shopping List Accuracy**: Step 3 of the planner will automatically select the leaner/higher-protein product brands.

### 3rd Order Consequences
- **User Agency vs Automation**: If a user intentionally chose a specific brand for a recipe (e.g. Richmond sausages for taste, even though Linda McCartney is leaner), an indiscriminate recipe wipe of `productId` would overwrite their brand choice.
- **Recipe Immutability Principle**: Recipes should only update their ingredient product pointers if the ingredient was mapped generically (following the default) rather than deliberately overridden.

---

## 5. Architectural Options for Recipe Auto-Update

### Option 1: Live Dynamic Recipe Macro Computation (Compute-at-Render)
- *Concept*: Stop storing `macros` on recipes; compute recipe macros dynamically on the fly whenever a recipe is rendered.
- *Pros*: Never out of sync with product changes.
- *Cons*: High CPU cost during Vault scrolling (rendering 90+ recipes requires looping thousands of ingredients and products on every frame); breaks offline cache snapshots; contradicts single-source-of-truth Firestore document schema.

### Option 2: Explicit Batch Recalibration Tool ("Recalibrate All Recipes")
- *Concept*: Keep recipe macros stored in Firestore, but provide an explicit administrative / settings tool:
  `⚡ Recalibrate Recipes from Optimal Defaults`
  which iterates recipes, resolves ingredients via current default products (unless explicitly pinned by user), recalculates macros via `recalculateWizardMacros`, and commits batch updates to Firestore.
- *Pros*: Predictable, transparent, allows dry-run preview, does not lag the UI, preserves custom brand overrides.
- *Cons*: Requires user to tap a button or trigger maintenance.

### Option 3: Event-Driven Propagation on Strategy Change
- *Concept*: When the user changes Auto-Default Strategy in Settings, or runs "Recalibrate Defaults", PlatePlan simultaneously updates `defaultProductId` across ingredients and runs a background batch update across recipes.
- *Pros*: Fully automated; fulfills the user expectation that changing the strategy updates recipes.
- *Cons*: Longer background save on strategy toggle.

---

## 6. Recommendations & Action Plan

1. **Fix Preference Aliasing & Whitelisting**:
   - In `HydrationService.js` and `DietaryExclusionManager.js`:
     Alias `autoDefaultStrategy` from `userPrefs.productPriority` and `userPrefs.autoMappingStrategy`.
   - Change system default fallback from `'lowest_absolute_price'` to `'highest_protein_per_kcal'`.
   - Update `whitelistPreferences` in `PreferenceRepository.js` to allow `autoDefaultStrategy` and `autoDefaultCriterion`.

2. **Fix `resolveDefaultProduct` & `sweepAndRecalibrateIngredientDefaults`**:
   - In `PantryHierarchyService.js:112`: Do not let stale `p.isAutoDefault` override the active strategy when `ing.defaultProductId` is explicitly set or when strategy is active.
   - In `sweepAndRecalibrateIngredientDefaults`: Synchronously update `isAutoDefault` on products (`bestProduct.isAutoDefault = true`, siblings `false`).

3. **Build "Recalibrate Recipes from Defaults" Service**:
   - Create a dedicated utility `recalculateAllRecipeMacros({ dryRun = false })` in `MaintenanceService.js`.
   - Expose a button in Settings under Auto-Default Strategy:
     `⚡ Recalibrate Recipe Macros from Optimal Defaults`
   - Wire it so when strategy changes, user can automatically propagate the new macros to all recipes in the Vault.

---

## 7. Decision Gate

* **Decision**: Proceed to **/plan** to implement:
  1. Setting `highest_protein_per_kcal` as default and aliasing legacy keys.
  2. Whitelisting `autoDefaultStrategy` in `PreferenceRepository.js`.
  3. Fixing `resolveDefaultProduct` precedence so strategy and `defaultProductId` win.
  4. Adding `recalculateAllRecipeMacros` to propagate optimal default product macros to all Vault recipes.
