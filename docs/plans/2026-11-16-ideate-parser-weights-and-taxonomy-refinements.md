# Ideation: Recipe Parser, Single-Item Weights, Alias Sanitization & Taxonomy Search Refinements

**Date:** 2026-11-16  
**Context:** Recipe Ingestion Parser, Pantry Bank Taxonomy, Product Weight Resolution & Step 2 Validation Gate  
**Status:** Ideation Completed, Clarified & Evaluated  

---

## 1. Grounding: Root Causes & Codebase Evidence

### Issue 1: Aliases Keep Measurements Instead of Stripping Them
* **Symptom:** Learned or manually edited aliases on Root Items and Sub-Types retain quantities, units, and packaging words (e.g. `"400g chopped tomatoes"`, `"cheddar cheese 100g"`, `"1 pouch 250g cooked rice"`).
* **Causal Chain & Evidence:**
  1. `cleanIngredientPhraseForAlias()` in `src/services/RecipeIngredientParser.js:437–454` delegates to `parseIngredientString(str)`, which only strips a single leading number and unit. Any mid-string or trailing weights/volumes (`"Cheddar Cheese 100g"`, `"1 tbsp / 15ml soy sauce"`), no-space multipliers (`"2x400g tins"` where `compMatch` at line 290 requires `\s+` after `[xX]`), or container nouns (`pouch`, `sachet`, `pot`, `tub`, `carton`, `jar`, `bottle`, `bag`) survive inside `parsed.name`.
  2. `normalizeTaxonomyName()` (`RecipeIngredientParser.js:416–419`) strips punctuation and diacritics, but does not strip embedded numeric measurements (`\b\d+(?:\.\d+)?\s*(?:g|kg|ml|l|oz|lb|tbsp|tsp|cups?|qty|cm|mm|inch(?:es)?)\b`) or container nouns.
  3. Manual alias editing in `src/components/pantry/EditPantryTaxonomyModalUI.js:108, 209` splits on commas and calls `.trim()` without passing each alias through `cleanIngredientPhraseForAlias()`.
  4. Existing Firestore records in `households/elliott-chloe/ingredients` still carry historical measurement-polluted aliases learned before stricter stripping.

### Issue 2: "1 Usable Item Size" Copies Total Pack Size & Syncs Unit Dropdowns
* **Symptom:** Single-item weight (`itemWeight`) defaults to the total pack size (`packSize`), and changing the unit dropdown on `1 Usable item size` overwrites the `Total pack size` unit.
* **Causal Chain & Evidence:**
  1. **Bookmarklet Duplication (`index.html:581`):** In `parsePack(str)`, a single weight like `"500g"` returns `{ count: 1, each: 500, total: 500, unit: 'g' }`. Then `pick()` sets `iw = r.each != null ? r.each : r.total`, populating `itemWeight: 500` alongside `packSize: 500` for every single-weight product.
  2. **Blind Trust in `guessItemWeight` (`src/services/TescoImportService.js:106–115`):** `if (explicit > 0) return explicit;` runs first. Because the bookmarklet set `itemWeight = packSize`, `guessItemWeight()` immediately returns `packSize` (e.g. `400g` for `"6 Pork Sausages 400g"` or `500g` for `"Natural Yoghurt 500g"`), bypassing `packSize / count` and ignoring embedded counts in product titles.
  3. **Override of `resolveProductItemWeight` (`src/services/NutritionService.js:96–101`):** Because `product.itemWeight` is already populated with `packSize`, `resolveProductItemWeight()` returns `packSize` at step 1 and never reaches step 2 (`packSize / itemCount`) or step 4 (title count parsing at lines 125–146).
  4. **Forced Unit Coupling (`src/views/ProductBankView.js:309–313, 368–377`):** `syncUnitSelects(unifiedUnit)` binds `#mi-pack-unit`, `#mi-item-weight-unit`, and `#mi-drained-weight-unit` together so changing one overwrites the other two.

### Issue 3: "Bay Leaves" Is Parsed as "Bay"
* **Symptom:** `"2 bay leaves"` (as well as `"curry leaves"`, `"kaffir lime leaves"`, `"vine leaves"`) is parsed with name `"Bay"` and unit `"g"` (`2g Bay`).
* **Causal Chain & Evidence:**
  1. `UNIT_MAP` (`src/services/RecipeIngredientParser.js:48`) maps `leaf: 'leaf', leaves: 'leaf'`.
  2. `trailingUnitMatch` (`RecipeIngredientParser.js:365`) matches `/^(.*?)\s+(sprigs?|leaves?|leaf|...)\b/i`, treating `"leaves"` in `"2 bay leaves"` as a trailing measurement unit and stripping it from the noun, leaving `rawName = "bay"` and `parsedUnit = "leaf"`.
  3. `convertToStrictUnit()` (`src/services/UnitConversionService.js:60, 132`) converts `leaf` via `ESTIMATED_GRAMS_PER_UNIT` (`1g` per leaf) into `2g Bay`.

### Issue 4: Recipe Parser Does Not Flag Non-Discrete Ingredients Measured in `qty`
* **Symptom:** Amorphous or bulk ingredients (e.g. `"1 qty of natural yoghurt"`, `"soy sauce"`, `"milk"`, `"rice"`, `"chopped tomatoes"`, `"flour"`) can land in Step 2 with `unit: 'qty'`.
* **Causal Chain & Evidence:**
  1. `normalizeUnit()` (`RecipeIngredientParser.js:165–169`) and `convertToStrictUnit()` (`UnitConversionService.js:80–84, 130, 142`) collapse missing units and container words (`pot`, `tub`, `jar`, `tin`, `can`, `pack`, `bottle`, `block`) into `unit: 'qty'`.
  2. Neither `RecipeIngredientParser.js` nor `UnitConversionService.js` checks whether the ingredient is a liquid, bulk dairy/paste/sauce, or loose grain/powder that cannot be counted as discrete whole items.

### Issue 5: Recipe Wizard Allows `qty` Ingredients When Mapped Product Has No Calculable Item Weight
* **Symptom:** When an ingredient in Step 2 is measured in `qty` and mapped to a product that has no single-item weight (`itemWeight`), the wizard does not warn the user or block progression, and `NutritionService.js:178` silently falls back to `DEFAULT_ITEM_GRAMS = 100g`.
* **Causal Chain & Evidence:**
  1. `renderStep2Footer()` (`src/components/recipe/RecipeWizardStep2View.js:33–58`) and the Step 2 → Step 3 Next handler (`src/components/recipe/RecipeWizardStep2Handlers.js`) only gate on `isIngredientUnlinked()`.
  2. There is no validation check verifying that an ingredient with `unit === 'qty'` resolves to a product with `resolveProductItemWeight(prod) > 0` (or uses a known culinary count unit like garlic cloves).

### Issue 6: "Noodles" Missing in Add Root Item Category Search & Dropdown Not Filtering to Categories Only
* **Symptom:** In the Add Root Item modal (`src/components/pantry/AddItemWizardUI.js`), the existing `"Noodles"` category does not appear in the Category search dropdown, and the dropdown lists Root Items and Sub-Types alongside Categories.
* **Causal Chain & Evidence:**
  1. `AddItemWizardUI.js:105, 284–285` computes `const categories = getUnifiedCategories(state)` (which aggregates categories from `state.categories`, `state.ingredients`, and `state.products`) and passes `{ categories, rootItems: [], newItemType: 'category' }` to `createTaxonomySearchInput()`.
  2. Inside `src/components/pantry/RecipeSearchDropdownHelper.js:98–103`:
     ```js
     const liveRootItems = Array.isArray(state?.ingredients) && state.ingredients.length > 0 ? state.ingredients : rootItems;
     const liveCategories = Array.isArray(state?.categories) && state.categories.length > 0 ? state.categories : categories;
     ```
  3. Because `state.categories` (the raw `settings/categories` document) is non-empty, `liveCategories` discards the `categories` argument (`getUnifiedCategories(state)`) and omits any category (such as `"Noodles"`) present on items/products in the bank.
  4. Because `state.ingredients` is non-empty, `liveRootItems` discards `rootItems: []` and renders all Root Items and Sub-Types at lines 160–186 even when `resolvedNewType === 'category'`.

---

## 2. Topic-Surface Decomposition (Axes)

1. **Axis 1: Alias Normalization & Historical Cleanup** — How raw ingredient text and manual alias edits are stripped of quantities, units, and containers, and how existing Firestore aliases are cleaned.
2. **Axis 2: Product Pack vs. Single-Item Weight Separation** — How the Tesco bookmarklet, `TescoImportService`, `NutritionService`, and `ProductBankView` distinguish total pack size from 1 usable item weight and keep their units independent.
3. **Axis 3: Culinary Leaf Parsing & Non-Discrete `qty` Detection** — How the parser preserves compound leaf nouns (`Bay Leaves`) as `qty` while flagging amorphous/bulk ingredients that default to `qty`.
4. **Axis 4: Step 2 Uncalculable `qty` Validation Gate & Inline Resolution** — How Step 2 detects when a `qty` ingredient maps to a product without a single-item weight and provides fast inline fixes before allowing Step 3.
5. **Axis 5: Mode-Strict Taxonomy Autocomplete** — How `createTaxonomySearchInput` honors `getUnifiedCategories(state)` and strictly isolates Category-only, Root-Item-only, and Sub-Type-only dropdown modes.

---

## 3. Candidate Solutions & Critique

### Area A: Alias Stripping & Cleanup (Issue 1)
* **Candidate A1 (Selected — Confirmed by User):** Strengthen `cleanIngredientPhraseForAlias()` with a multi-pass stripper (removing leading/mid/trailing numeric + unit tokens, multiplier prefixes like `2x400g`, parenthetical dimensions/weights, and container nouns like `pouch`, `pot`, `tub`, `sachet`, `tin`, `can`, `jar`, `pack`, `bag`, `bottle`), apply it in `EditPantryTaxonomyModalUI.js` on save, and run an automatic idempotent migration/hydration pass that sanitizes and deduplicates existing saved aliases in Firestore.
  * *Critique:* Fixes both future alias learning and existing polluted aliases in the database without manual editing.
* **Candidate A2 (Rejected):** Only strip measurements on new aliases in `RecipeWizardAliasesPrompt.js`.
  * *Rejection Reason:* Leaves existing polluted aliases in Firestore and fails when aliases are edited manually in `EditPantryTaxonomyModalUI.js`.

### Area B: Single-Item Weight (`itemWeight`) vs. Pack Size (Issue 2)
* **Candidate B1 (Selected):**
  1. **Decouple Unit Selectors in `ProductBankView.js`:** Remove `syncUnitSelects()`. Initialize `#mi-pack-unit`, `#mi-item-weight-unit`, and `#mi-drained-weight-unit` from their own respective fields (`prod.packUnit || 'g'`, `prod.itemWeightUnit || 'g'`, `prod.drainedWeightUnit || 'g'`).
  2. **Fix Bookmarklet & `guessItemWeight()` (`TescoImportService.js`):** Never copy `packSize` into `itemWeight` when `count <= 1`. Only populate `itemWeight` when:
     - The bookmarklet or title carries an explicit multipack multiplier (`4 x 50g` → `itemWeight = 50`), OR
     - `itemCount > 1` or title/notes count (`"6 Sausages"`, `"4 Pack"`, `"Twin Pack"`) divides `drainedWeight || packSize`, OR
     - Nutrition basis header specifies a per-item weight (e.g. `"Per 1 wrap (62g)"` → `62g`), OR
     - `packUnit === 'each'` / loose single item.
     Otherwise, set `itemWeight: null`.
  3. **Guard `resolveProductItemWeight()` (`NutritionService.js`) & Sanitize Existing Products:** In `resolveProductItemWeight()`, if `product.itemWeight === product.packSize`:
     - If an embedded count `> 1` exists (`itemCount > 1` or title count like `"6 Vegan Sausages"`), compute `packSize / count` instead of returning the un-divided `packSize`.
     - If the product is a bulk/liquid/amorphous item (e.g. yoghurt, milk, pasta, rice, oil, chopped tomatoes, flour, sauce) and `itemWeight === packSize`, treat `itemWeight` as `0` (not a single discrete item) and clear the bogus duplicated `itemWeight` during product hygiene/recalibration.
  * *Critique:* Directly fixes the root cause in the bookmarklet, the import parser, the product editor UI, and runtime nutrition calculation for already-imported products.
* **Candidate B2 (Rejected):** Keep `itemWeight = packSize` and try to guess in the recipe wizard whether `packSize` is "too big" (e.g. `> 250g`).
  * *Rejection Reason:* A 350g whole cucumber or 300g steak is a valid single item, whereas a 150g pot of yoghurt or 200g bag of spinach is a pack/container. Arbitrary gram cutoffs fail in both directions.

### Area C: "Bay Leaves" & Leaf Ingredient Parsing (Issue 3)
* **Candidate C1 (Selected — Confirmed by User):**
  1. Protect botanical leaf ingredients (`bay leaf`/`bay leaves`, `curry leaf`/`curry leaves`, `lime leaf`/`lime leaves`, `kaffir lime leaf`/`kaffir lime leaves`, `vine leaf`/`vine leaves`, `salad leaves`) in `RecipeIngredientParser.js` so `trailingUnitMatch` never strips `leaf`/`leaves` from their name, and output `unit: 'qty'` with the full name (`"Bay Leaves"`).
  2. Only treat `leaf`/`leaves` as a unit when written in the explicit prepositional form `"N leaves of [herb]"` (e.g. `"4 leaves of basil"` → `4 qty Fresh Basil` or `leaf` unit), and keep `leaf`/`leaves` out of `stemIngredientName()` stripping when preceded by `bay`, `curry`, `lime`, or `vine`.
  3. In `UnitConversionService.js` (`inferIngredientWeightByName`), ensure `"bay leaves"`, `"curry leaves"`, and `"lime leaves"` resolve to `1g` per leaf when converting `qty` to grams for nutrition, so `2 qty Bay Leaves` = `2g` nutritionally without needing a product `itemWeight` override.
  * *Critique:* Preserves the exact name `"Bay Leaves"` and unit `qty` in the recipe and shopping list while keeping nutrition accurate at ~1g per leaf.
* **Candidate C2 (Rejected):** Convert `"2 bay leaves"` to `2g Bay Leaves` at parse time.
  * *Rejection Reason:* Rejected by user; recipes and shopping lists should show `2 qty Bay Leaves`, not `2g`.

### Area D: Invalid `qty` Flagging & Step 2 Uncalculable `qty` Gate (Issues 4 & 5)
* **Candidate D1 (Selected — Confirmed by User):**
  1. **Parser & Bulk-Item `qty` Detection (`RecipeIngredientParser.js` & `UnitConversionService.js`):**
     - Define a canonical helper `isNonDiscreteBulkIngredient(name, category)` covering liquids, yoghurts/creams/milks, oils, sauces/pastes/condiments, flours/sugars/powders, loose grains/rice/pasta/noodles/oats/lentils, tinned tomatoes/beans, and grated/minced/chopped bulk items.
     - When `parseIngredientString()` produces `unit === 'qty'` for a non-discrete bulk ingredient, mark `item.isInvalidQtyUnit = true`.
  2. **Unified Step 2 Row Warning & Blocking Gate (`RecipeWizardStep2View.js`, `RecipeWizardStep2Handlers.js`, `RecipeWizardTaxonomySearch.js`):**
     - Introduce `hasUncalculableQty(item, productsBank, ingredientsBank)`: returns `true` when `item.unit === 'qty'` AND either:
       - The ingredient is flagged as a non-discrete bulk item (`isNonDiscreteBulkIngredient`), OR
       - The ingredient is mapped to a taxonomy item/product whose resolved product has `resolveProductItemWeight(prod) <= 0` (and is not a self-weighed culinary staple like water or bay leaves/spices).
     - **Visual Row Banner & Inline Quick-Fix Actions:** When `hasUncalculableQty` is true on a row in Step 2:
       - Highlight the row with an amber/red warning border and an inline banner explaining why (e.g. `⚠️ Measured in "qty", but "Tesco Natural Yoghurt 500G" has no single-item weight (or cannot be measured in qty)`).
       - Render **3 inline quick-fix controls** right in the banner:
         1. **Switch Unit**: Quick buttons `Use g` / `Use ml` (switches the row's unit dropdown to `g` or `ml` and focuses the quantity input).
         2. **Set 1 Item Weight on Product**: An inline input `[ e.g. 120 ] g [Save to Product]` (when a product is resolved and the item is genuinely countable, saves `itemWeight` directly to that product in Store + Firestore and immediately clears the warning).
         3. **Re-map**: Focuses the row's taxonomy autocomplete input to map to a different item/product.
     - **Footer Gate Integration:** Update `renderStep2Footer()` and the `#wiz-gate-pill` jump button so the Step 2 → Step 3 gate blocks on both `unlinkedIngs` AND `invalidQtyIngs` (e.g. `⚠️ 1 unmapped, 1 invalid qty (jump)`).
  * *Critique:* Combines Issues 4 and 5 into a cohesive, zero-dead-end workflow in Step 2 with inline 1-click resolution.
* **Candidate D2 (Rejected):** Force the user to open the full Product Bank Editor modal from Step 2 whenever `itemWeight` is missing.
  * *Rejection Reason:* Rejected by user; switching modals mid-wizard is high-friction, especially when the fix is simply changing `1 qty` of yoghurt to `150g` or typing `120g` for a single item weight inline.

### Area E: Category Search Filtering & Missing "Noodles" Category in Add Root Item Modal (Issue 6)
* **Candidate E1 (Selected — Confirmed by User):**
  1. In `src/components/pantry/RecipeSearchDropdownHelper.js`:
     - Replace `state.categories` with `getUnifiedCategories(state)` when resolving `liveCategories`, and merge any caller-supplied `categories` array so categories present on items/products or custom categories (like `"Noodles"`) are always included.
     - Respect the caller's mode: when `resolvedNewType === 'category'` (or `categoriesOnly: true`), **only render Categories** (never render `liveRootItems` or Sub-Types).
     - Conversely, when `resolvedNewType === 'item'` or `categories` was explicitly passed as `[]` for a Root Item picker (`#wiz-parent-item-container` / `#wiz-item-container`), **only render Root Items** (never pollute with Category rows).
  2. In `src/components/pantry/EditPantryTaxonomyModalUI.js`:
     - Replace the legacy `<select id="edit-item-category">` with `createTaxonomySearchInput({ newItemType: 'category', ... })` so editing an existing Root Item's category also uses the category-only searchable autocomplete (adhering to the `CLAUDE.md` UI standard).
  * *Critique:* Fixes both the missing `"Noodles"` category and the root-item/subtype pollution in a single clean change in `RecipeSearchDropdownHelper.js`.

---

## 4. Summary of Confirmed Decisions

| # | Issue | Confirmed Solution |
|---|---|---|
| **1** | **Aliases keep measurements** | Strip all leading/mid/trailing numbers, units, multipliers, and container words in `cleanIngredientPhraseForAlias()` + manual alias edits, and run a one-time cleanup over existing saved aliases in Firestore. |
| **2** | **1 Usable Item Size copies Pack Size** | Decouple unit dropdowns in `ProductBankView.js`, stop bookmarklet/`guessItemWeight` from copying `packSize` into `itemWeight` when `count <= 1`, derive `packSize / count` for multipacks, and clear bogus `itemWeight === packSize` on bulk products. |
| **3** | **"Bay Leaves" parsed as "Bay"** | Preserve botanical leaf nouns (`Bay Leaves`, `Curry Leaves`, `Lime Leaves`, `Vine Leaves`) with `unit: 'qty'`; only treat `leaf`/`leaves` as a unit in `"N leaves of [herb]"`. |
| **4 & 5** | **Invalid `qty` & missing product item weight** | Flag non-discrete bulk ingredients in `qty` and any `qty` row whose mapped product has no single-item weight; block Step 2 → Step 3 progression with an inline banner offering quick-fixes (`Switch to g/ml`, `Inline-set product itemWeight (g)`, or `Re-map`). |
| **6** | **"Noodles" missing & Category search pollution** | Use `getUnifiedCategories(state)` inside `RecipeSearchDropdownHelper.js` and enforce strict category-only rendering when `newItemType === 'category'`. |
