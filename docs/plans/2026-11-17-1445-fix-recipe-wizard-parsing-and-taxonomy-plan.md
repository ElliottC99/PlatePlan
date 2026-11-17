---
title: Recipe Wizard Source/Title Editing, Handful/Clove Units, Preference Learning & Root Item Creation - Plan
type: fix
date: 2026-11-17
topic: recipe-wizard-parsing-and-taxonomy
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Recipe Wizard Source/Title Editing, Handful/Clove Units, Preference Learning & Root Item Creation - Plan

## Goal Capsule

- **Objective:** Users importing or editing recipes in the Recipe Wizard get accurate parsed metadata (title and source editable before Step 3), gram-based handful conversions, predictable 6g garlic clove weights, remembered root-item vs sub-type preferences, and direct root-item mapping after creating a new root item.
- **Means:** Extract source metadata during text parsing and expose Title/Source inputs in Step 2 (KTD1); add sized handful conversion entries (`10g`/`20g`/`30g`) in `UnitConversionService` and `looseMatch`/`unitMatch` (KTD2); enforce 6g/clove nutrition weighting via `COUNT_UNIT_GRAMS.clove` and clove-origin metadata across nutrition callers (KTD3); learn Step 2 disambiguation choices via `aliases` with exact-alias precedence and dynamic store reads in `RecipeWizardTaxonomySearch` (KTD4).
- **Authority Hierarchy:** Product Contract (`R1`–`R9` and `Key Decisions`) governs user-visible behavior; Planning Contract (`KTD1`–`KTD4`) governs implementation mechanisms within those constraints; Implementation Units (`U1`–`U4`) execute those decisions without overriding either.
- **Execution Profile:** Single pull request targeting `development` with 4 implementation units (`U1`–`U4`), verified via standalone Node assertion suites (`scripts/test_*.js`), `npm run ledger`, and `npm run build`.
- **Stop Conditions:** Stop and surface to the user if updating `handful` weights breaks unrelated shopping-list assertions beyond the `2 handfuls spinach` fixture or if `AddItemWizardUI` root-item-only creation conflicts with existing Pantry Bank flows.
- **Completion Owner:** `ce-work` implements `U1`–`U4`, runs all verification suites, and prepares the branch for review/PR.

---

## Product Contract

*Product Contract preservation: Product Contract unchanged from `ce-brainstorm`.*

### Summary

This work resolves six usability and parsing gaps in the Recipe Wizard and ingredient taxonomy matcher:
1. Extract recipe titles and source metadata (URL, Book, Page) during raw text parsing and make both editable directly in Step 2 (as well as Step 3).
2. Parse `"Small Handful Of..."`, `"Handful Of..."`, and `"Large/Generous Handful Of..."` herbs and garnishes as grams (`10g`, `20g`, `30g`) rather than `1 qty`.
3. Keep garlic cloves (`3 cloves garlic`) as `3 qty Garlic` in Step 2 and always weigh them at `6g` per clove for nutrition calculations, regardless of the mapped Garlic product's bulb/pack `itemWeight`.
4. Automatically remember the user's Step 2 taxonomy choice (Root Item vs Sub-Type) when both share similar names (such as `"lemons"` mapped to Root Item `Lemon` vs Sub-Type `Lemons`), so future parses prefer the chosen level.
5. Map to the exact taxonomy level finished at when creating a new item from Step 2's `"✨ New Item"` flow (`Finish & Save Item` maps to the Root Item, not an auto-generated `"Standard"` Sub-Type) and refresh the Step 2 dropdown immediately so the new Root Item and Sub-Type are both selectable.

### Problem Frame

When users paste recipes from social media, blogs, or cookbooks into the Recipe Wizard, several small friction points force manual cleanup across Steps 2 and 3:
- Step 2 displays the recipe title as static truncated text and hides Recipe Source controls until Step 3, while `parseSingleRecipeText()` ignores URLs and `Source:`/`Book:` lines in pasted text.
- Leading size adjectives (`"Small Handful Of Fresh Thai Basil"`) miss the loose-measure parser regex and fall back to `1 qty`, triggering the Step 2 uncalculable `qty` warning.
- Garlic cloves (`"3 cloves garlic"`) risk colliding with whole-bulb product weights if the mapped Garlic product carries an `itemWeight` for a whole bulb (`~60g`).
- When a Root Item and a Sub-Type have identical or near-identical stemmed names (`Lemon` vs `Lemons`), `matchIngredientTaxonomy()` deterministically picks the Sub-Type or first match without learning from the user's Step 2 correction.
- Finishing `"✨ New Item"` at the Root Item step still creates and selects a `"Standard"` Sub-Type and does not refresh the open Step 2 dropdown snapshot, locking users out of selecting the Root Item directly.

### Key Decisions

- **Title & source extraction and early editing:** Auto-extract Title and Source (`online` URL or `book`/page) during text parsing and make both editable in Step 2's header as well as Step 3. Governs R1, R2. *(session-settled: user-directed — chosen over Step 1.5 queue editing or Step 2-only editing without text extraction)*
- **Sized handful gram weights:** Convert `"Small Handful"` to `10g`, `"Handful"` to `20g`, and `"Large/Generous Handful"` to `30g` (all unit `g`). Governs R3. *(session-settled: user-directed — chosen over 15g/30g/45g and over keeping handfuls in `qty`)*
- **Garlic clove handling:** Keep garlic cloves as `qty` in Recipe Wizard (`3 qty Garlic`) and always weigh cloves at `6g` per clove for nutrition, overriding any mapped garlic bulb `itemWeight`. Governs R4, R5. *(session-settled: user-directed — chosen over converting cloves to `g` at parse time or deferring to the mapped product's `itemWeight`)*
- **Automatic preference learning for Root Item vs Sub-Type collisions:** Automatically remember the user's Step 2 selection (Root Item vs Sub-Type) for a phrase so future parses prefer the chosen taxonomy level over name-matching a sibling or child node. Governs R6, R7. *(session-settled: user-directed — chosen over manual alias-prompt confirmation only or hard-coding Root Item precedence)*
- **Exact-level mapping on `"✨ New Item"` creation:** Map the Step 2 row to the exact taxonomy level finished at (`Finish & Save Item` maps to the Root Item; `Finish` at Sub-Type or Product maps to the Sub-Type) and refresh the Step 2 autocomplete list immediately so both levels are selectable. Governs R8, R9. *(session-settled: user-directed — chosen over always mapping to Root Item or only refreshing the dropdown)*

### Requirements

**Earlier Title & Source Editing**
- R1. Raw recipe text parsing (`parseSingleRecipeText`) must detect source metadata from header/footer lines (`Source:`, standalone `https://...` URLs, or `Book:` / `Page:` markers) and populate `sourceType` (`'online'` or `'book'`), `sourceUrl`, `sourceBook`, and `sourcePage` on the parsed recipe.
- R2. Recipe Wizard Step 2 must render editable Title and Source controls (type toggle `None` / `Online (URL)` / `Book`, plus URL or Book/Page inputs) in its header so users can review and edit both before advancing to Step 3.

**Sized Handfuls & Garlic Cloves**
- R3. Recipe ingredient parsing and unit conversion must recognize sized handful prefixes (`small handful`, `handful`, `large handful`, `generous handful`, `big handful`, with optional leading `a `) and convert them to `g` at `10g` (small handful), `20g` (handful), and `30g` (large/generous/big handful).
- R4. Garlic cloves (e.g., `"3 cloves garlic"`, `"2 garlic cloves"`, `"1 clove of garlic"`) must parse and remain as `unit: 'qty'` in Recipe Wizard Step 2 without triggering the missing-`itemWeight` gate.
- R5. Nutritional weight calculation for ingredients originating as cloves (or garlic rows parsed from cloves) must always use `6g` per clove, even when the mapped Pantry Bank Garlic product carries a different `itemWeight` (such as a whole garlic bulb).

**Root Item vs Sub-Type Preference & Creation**
- R6. When a user changes an ingredient's mapping in Recipe Wizard Step 2 to a Root Item (or a Sub-Type) for a phrase that also matches a same-named or similarly-named Sub-Type/Root Item (e.g., `"lemons"` mapped to Root Item `Lemon` instead of Sub-Type `Lemons`), the app must automatically record that phrase preference on the chosen taxonomy target.
- R7. Future `matchIngredientTaxonomy()` evaluations for that phrase must prefer the remembered taxonomy level over name-matching a competing Root Item or Sub-Type.
- R8. Finishing `"✨ New Item"` at the Root Item step (`Finish & Save Item`) in `AddItemWizardUI` must create and return the Root Item without forcing a `"Standard"` Sub-Type selection, and `RecipeWizardTaxonomySearch` must map the ingredient row to the exact level finished at (Root Item when no Sub-Type was created/selected, Sub-Type when finished at Sub-Type or Product).
- R9. After creating any new Category, Root Item, or Sub-Type from Step 2, the Step 2 autocomplete dropdown must read the updated store taxonomy immediately so the user can switch between the new Root Item and any Sub-Types without closing or re-rendering the wizard.

### Acceptance Examples

- AE1. **Source & Title parsed and editable before Step 3** (`Covers R1, R2`)
  - **Given:** User pastes a recipe containing `Garlic Chili Noodles`, `Source: https://example.com/noodles`, ingredients, and method steps.
  - **When:** The user reaches Step 2.
  - **Then:** The Step 2 header displays an editable Title input with `Garlic Chili Noodles` and an editable Source selector pre-filled with `Online (URL)` and `https://example.com/noodles`, and edits persist into Step 3 and Save.
- AE2. **Sized handful herbs convert to grams** (`Covers R3`)
  - **Given:** Recipe lines `"Small Handful Of Fresh Thai Basil"`, `"Handful Of Fresh Mint"`, and `"Large Handful Of Fresh Coriander"`.
  - **When:** Parsed by `parseIngredientString()`.
  - **Then:** They produce `10 g Fresh Thai Basil`, `20 g Fresh Mint`, and `30 g Fresh Coriander`, none flagged as `qty`.
- AE3. **Garlic cloves stay `qty` at 6g/clove** (`Covers R4, R5`)
  - **Given:** Recipe line `"3 garlic cloves"` mapped to a Garlic product whose `itemWeight` is `65g` (whole bulb).
  - **When:** Rendered in Step 2 and evaluated for macros.
  - **Then:** Step 2 shows `3 qty Garlic` with no missing-weight warning, and nutrition calculates `3 * 6g = 18g` of garlic.
- AE4. **Root Item vs Sub-Type preference learned automatically** (`Covers R6, R7`)
  - **Given:** Pantry Bank contains Root Item `Lemon` and Sub-Type `Lemons`, and `"2 lemons"` initially matched Sub-Type `Lemons`.
  - **When:** User switches the Step 2 mapping to Root Item `Lemon`.
  - **Then:** The app records `"lemons"` as a learned preference for Root Item `Lemon`, and parsing `"1 lemon"` or `"2 lemons"` in the next recipe automatically selects Root Item `Lemon`.
- AE5. **Adding a new Root Item in Step 2 maps to the Root Item and keeps it selectable** (`Covers R8, R9`)
  - **Given:** User clicks `✨ New Item` on a Step 2 row, picks `Root Item`, enters `"Thai Sweet Basil"`, and clicks `Finish & Save Item`.
  - **When:** The creation modal closes.
  - **Then:** The row maps to `📦 Thai Sweet Basil` (Root Item, `subtypeId: null`), and reopening the row's dropdown immediately lists `📦 Thai Sweet Basil`.

### Scope Boundaries

- **Deferred for later:** Step 1.5 batch-queue inline title/source editing (title and source edits happen in Step 2 and Step 3).
- **Non-goals:** Changing `itemWeight` storage schema on products for non-clove ingredients, or retroactively altering existing saved recipes' titles/sources.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Header/footer source extraction and Step 2 inline header row:** `parseSingleRecipeText` and `loadNextRecipeFromQueue` in `src/services/RecipeParserService.js` and `src/components/recipe/RecipeWizardModal.js` carry `sourceType`, `sourceUrl`, `sourceBook`, and `sourcePage` extracted from `headerText`, trailing `rawIngText` (when no method section exists), and trailing `rawMethodText` lines (`Source:`, standalone URLs, or `Book:` / `Page:`), and Step 2 renders a compact second row inside `.wiz-step2-header-container` synced by `syncStep2InputsToState` (`Governs R1, R2`).
- KTD2. **Sized handful unit entries in `UnitConversionService` and `RecipeIngredientParser`:** Extend `ESTIMATED_GRAMS_PER_UNIT` with `'small handful': 10`, `'handful': 20`, `'large handful': 30`, `'generous handful': 30`, `'big handful': 30` (and plural variants), and update `looseMatch`, `unitMatch`, and `isIngredientOrSectionLine` to capture optional size qualifiers (`small`, `large`, `generous`, `big`) before `handful(s)` without stripping `generous` before `handful` (`Governs R3`, `session-settled: user-directed` instantiation).
- KTD3. **Clove-origin nutrition override without modifying product `itemWeight`:** Mark parsed clove rows with `isCloveCount: true` (and preserve it in Step 1A/queue paths) so `NutritionService.calculateItemNutrition` and `computeDynamicMacrosFromIngredients` in `src/utils/macroScoringUtils.js` pass `{ isCloveCount }` and route count units (`qty` / `clove`) through `COUNT_UNIT_GRAMS.clove` (`6g` in `UnitConversionService.js`) before checking `resolvedItemWeight`, while leaving `g`/`ml`/`pack` units untouched (`Governs R4, R5`, `session-settled: user-directed` instantiation).
- KTD4. **Alias-backed disambiguation + dynamic store reads + optional sub-type on Step 1 finish:** Record exact-phrase disambiguation preferences on the chosen Root Item or Sub-Type via `learnIngredientAlias` (removing any stale exact-alias entry from competing sibling/parent nodes) and evaluate exact normalized aliases (`score 98`) before name-matching in `matchIngredientTaxonomy()`, read `getState()` inside `filterAndRenderDropdown` on every focus/input in `RecipeWizardTaxonomySearch.js`, and pass `subtypeName: null` / `subtypeId: null` to both `commitAtomicChain` and the `onComplete` callback when finishing `AddItemWizardUI` at Step 1 (`Governs R6, R7, R8, R9`, `session-settled: user-directed` instantiation).

### Assumptions & Risks

- **Assumption:** Updating `handful` from `30g` to `20g` affects `scripts/fixtures/unit-conversion-lines.json` and `scripts/test_unit_conversion_report.js`, which are updated together in `U2`.
- **Risk:** Source URLs inside method steps (such as affiliate links) should only be extracted from header lines or trailing `Source:` / standalone URL lines at the end of a block so inline cooking links are not misclassified.

---

## Implementation Units

### U1. Extract Title & Source During Parsing and Expose Editable Controls in Step 2

- **Goal:** Parse source URLs and book/page references from pasted recipe text and render editable Title and Source controls in Step 2's header.
- **Requirements:** R1, R2 (AE1)
- **Dependencies:** None
- **Files:**
  - `src/services/RecipeParserService.js`
  - `src/components/recipe/RecipeWizardStep1Handlers.js`
  - `src/components/recipe/RecipeWizardStep2View.js`
  - `src/components/recipe/RecipeWizardStep2Handlers.js`
  - `src/components/recipe/RecipeWizardStep3Handlers.js`
  - `src/components/recipe/RecipeWizardState.js`
  - `scripts/test_multi_recipe_parser.js`
- **Approach:**
  1. In `src/services/RecipeParserService.js`, add `isHeaderMetadataLine` recognition for `Source:`, `URL:`, `Book:`, and `Page:`, skip metadata/URL lines before picking the line-0 fallback title, and add a `parseSourceMetadata` helper inside `parseSingleRecipeText()` that extracts `Source: https://...`, standalone `http(s)://...` lines in header or trailing lines of `rawIngText`/`rawMethodText` (removing them so they don't become bogus ingredients/steps), and `Book:` / `Page:` markers.
  2. In `src/components/recipe/RecipeWizardStep2View.js`, replace the static `<h3>` title in `.wiz-step2-header-container` with `#wiz-step2-title` text input and add a compact Source row (`#wiz-step2-source-type` pills `None` / `Online (URL)` / `Book`, `#wiz-step2-source-url`, `#wiz-step2-source-book`, `#wiz-step2-source-page`).
  3. In `src/components/recipe/RecipeWizardStep2Handlers.js`, `src/components/recipe/RecipeWizardState.js`, `src/components/recipe/RecipeWizardStep1Handlers.js`, and `src/components/recipe/RecipeWizardStep3Handlers.js`: wire source-type pill switching without full modal rebuild, sync `#wiz-step2-title` and source fields inside `syncStep2InputsToState(modalWrap)` using optional chaining (`modalWrap.querySelector?.(...)`), carry source fields in `#btn-import-all-direct`, and preserve explicit `''` (`None`) in `RecipeWizardStep3Handlers.js` when saving.
- **Test scenarios:**
  - *Covers AE1:* Parsing a recipe block with a `Source: https://...` line or standalone URL sets `sourceType: 'online'` and `sourceUrl`, and strips the standalone URL line from `ingredients` and `methodSteps`.
  - Parsing a recipe block with `Book: Ottolenghi Simple, p. 142` sets `sourceType: 'book'`, `sourceBook`, and `sourcePage`.
  - Rendering `renderState2Mapping()` includes `#wiz-step2-title` and `#wiz-step2-source-url` / `#wiz-step2-source-book`, and `syncStep2InputsToState` updates `wizardState.activeRecipe.title` and source fields (including mock wraps without `querySelector`).
- **Verification:** `node scripts/test_multi_recipe_parser.js` and `node scripts/test_recipe_wizard_ui_space_efficiency.js` pass.

### U2. Sized Handful Conversions (`10g` / `20g` / `30g`)

- **Goal:** Recognize `"Small Handful Of..."`, `"Handful Of..."`, and `"Large/Generous Handful Of..."` and convert them to grams (`10g`, `20g`, `30g`) instead of `qty`.
- **Requirements:** R3 (AE2)
- **Dependencies:** None
- **Files:**
  - `src/services/UnitConversionService.js`
  - `src/services/RecipeIngredientParser.js`
  - `src/services/RecipeParserService.js`
  - `scripts/fixtures/unit-conversion-lines.json`
  - `scripts/test_unit_conversion_report.js`
  - `scripts/unit_conversion_report.js`
  - `scripts/test_parser_aliases_and_leaves.js`
- **Approach:**
  1. In `src/services/UnitConversionService.js`, update `ESTIMATED_GRAMS_PER_UNIT` so `handful`/`handfuls` = `20`, `small handful`/`small handfuls` = `10`, and `large handful`/`large handfuls`/`generous handful`/`generous handfuls`/`big handful`/`big handfuls` = `30`.
  2. In `src/services/RecipeIngredientParser.js`, update `looseMatch` and `unitMatch` (preserving `generous` when followed by `handful`/`handfuls` before stripping modifiers) to match optional size adjectives `(small|large|generous|big)` before `handful|handfuls|bunch|bunches`, passing the combined unit (`"small handful"`) to `convertToStrictUnit`; extend `isIngredientOrSectionLine` in `src/services/RecipeParserService.js` for `large/generous/big handful`.
  3. Update the `2 handfuls spinach` expectation (`60` → `40`) in `scripts/fixtures/unit-conversion-lines.json`, `scripts/test_unit_conversion_report.js`, and `scripts/unit_conversion_report.js`, and add AE2 tests in `scripts/test_parser_aliases_and_leaves.js`.
- **Test scenarios:**
  - *Covers AE2:* `"Small Handful Of Fresh Thai Basil"`, `"Handful Of Fresh Mint"`, and `"Large Handful Of Fresh Coriander"` (plus `"1 generous handful coriander"`) parse to `10 g`, `20 g`, and `30 g` respectively with `isEstimated: true` and `isInvalidQtyUnit: false`.
  - `"2 handfuls spinach"` converts to `40 g` in `test_unit_conversion.js` and `test_unit_conversion_report.js`.
- **Verification:** `node scripts/test_unit_conversion.js`, `node scripts/test_unit_conversion_report.js`, and `node scripts/test_parser_aliases_and_leaves.js` pass.

### U3. Predictable `6g` Garlic Clove Nutrition Weighting

- **Goal:** Keep garlic cloves in `qty` in Step 2 and ensure nutrition always weighs clove-based lines at `6g` per clove regardless of mapped product `itemWeight`.
- **Requirements:** R4, R5 (AE3)
- **Dependencies:** None
- **Files:**
  - `src/services/RecipeIngredientParser.js`
  - `src/services/NutritionService.js`
  - `src/utils/macroScoringUtils.js`
  - `src/components/recipe/RecipeWizardStep1Handlers.js`
  - `src/components/recipe/RecipeWizardStep3Handlers.js`
  - `scripts/test_recipe_wizard_qty_gate.js`
- **Approach:**
  1. In `src/services/RecipeIngredientParser.js`, set `isCloveCount: true` on parsed items when `parsedUnit === 'clove'` (covers `"3 cloves garlic"`, `"2 garlic cloves"`, `"1 clove of garlic"`), and preserve `isCloveCount` in Step 1A manual and `#btn-import-all-direct` in `src/components/recipe/RecipeWizardStep1Handlers.js`.
  2. In `src/services/NutritionService.js` (`calculateItemNutrition`), support `options = { isCloveCount }` so when `u === 'clove'` OR (`(u === 'qty' || u === 'item' || u === 'count')` and `options.isCloveCount` is true), it routes through `toGrams(q, 'clove', item.name, 0)` (`6g` per clove via `COUNT_UNIT_GRAMS.clove`) before checking `resolvedItemWeight`, while leaving `g`/`ml`/`pack` units untouched; pass `{ isCloveCount: Boolean(item.isCloveCount || /\bcloves?\b/i.test(item.raw || item.name || '')) }` from `recalculateWizardMacros` in `src/components/recipe/RecipeWizardStep3Handlers.js` and `computeDynamicMacrosFromIngredients` in `src/utils/macroScoringUtils.js`.
- **Test scenarios:**
  - *Covers AE3:* `"3 garlic cloves"` mapped to a Garlic product with `itemWeight: 65` parses as `3 qty Garlic Cloves` (`isCloveCount: true`), triggers no Step 2 `qty` gate warning, and evaluates `calculateItemNutrition` and `computeDynamicMacrosFromIngredients` at `18g` (`3 * 6g`).
  - Switching the Step 2 row unit from `qty` to `g` (`20 g`) evaluates at `20g`, not `20 * 6g`.
  - Whole `"1 garlic bulb"` / `"1 head garlic"` (not cloves) continues using `resolvedItemWeight` or `head: 65g`.
- **Verification:** `node scripts/test_recipe_wizard_qty_gate.js` and `node scripts/test_product_item_weights.js` pass.

### U4. Automatic Root Item vs Sub-Type Preference Learning & Exact-Level New Item Creation

- **Goal:** Automatically remember Step 2 Root Item vs Sub-Type disambiguation choices for similar names and ensure adding a new Root Item via `"✨ New Item"` maps to the Root Item and refreshes the dropdown immediately.
- **Requirements:** R6, R7, R8, R9 (AE4, AE5)
- **Dependencies:** None
- **Files:**
  - `src/store/actions/pantryActions.js`
  - `src/services/RecipeIngredientParser.js`
  - `src/components/recipe/RecipeWizardStep2Handlers.js`
  - `src/components/recipe/RecipeWizardTaxonomySearch.js`
  - `src/components/recipe/RecipeAuditModal.js`
  - `src/components/pantry/AddItemWizardUI.js`
  - `scripts/test_variant_save_and_taxonomy_mapping.js`
- **Approach:**
  1. In `src/services/RecipeIngredientParser.js` (`matchIngredientTaxonomy`), score exact normalized alias matches (`normAl === normParsed || (cleanedRawPhrase && normAl === cleanedRawPhrase)`) at `98` ahead of `normIng === normParsed` / `normSub === normParsed` (without promoting stemmed-only alias matches), so a remembered disambiguation alias (such as `"lemons"` stored on Root Item `Lemon`) wins over a name collision with Sub-Type `Lemons`.
  2. In `src/store/actions/pantryActions.js` (`learnIngredientAlias`), allow storing an exact normalized phrase alias when a competing sibling/parent node shares the stemmed name and strip that exact alias from the competing node on the same root item; in `src/components/recipe/RecipeWizardStep2Handlers.js`, automatically call `learnIngredientAlias` inside the Step 2 taxonomy selection callback when the selected Root Item or Sub-Type competes with a same-stemmed node for that row's phrase.
  3. In `src/components/pantry/AddItemWizardUI.js`, when `executeFinishCommit` finishes at Step 1 (`startAt === 'item'` or `'category'`), pass `subtypeName: null` to `commitAtomicChain` and return `{ subtypeId: null, subtype: null, subtypeName: '' }` in `cb({...})`; update `src/components/recipe/RecipeWizardTaxonomySearch.js` (`onComplete` maps to `ingId` when `created.subtypeId` and `created.subtype` are absent, and `filterAndRenderDropdown` reads `getState()` dynamically) and `src/components/recipe/RecipeAuditModal.js` (avoid `'Standard'` fallback when `subtypeName`/`subtype` are empty).
- **Test scenarios:**
  - *Covers AE4:* Given Root Item `Lemon` and Sub-Type `Lemons`, calling `learnIngredientAlias('ing_lemon', 'lemons', null)` persists `"lemons"` on `Lemon`, and `matchIngredientTaxonomy({ name: 'Lemons', raw: '2 lemons' }, bank)` returns Root Item `Lemon` (`subtypeId: null`).
  - *Covers AE5:* `AddItemWizardUI` Step 1 finish returns `{ ingredientId, subtypeId: null, subtype: null }`, `RecipeWizardTaxonomySearch` `onComplete` sets `taxVal` to `ingId` (`📦 Thai Sweet Basil`), and `filterAndRenderDropdown` reflects newly added items in `getState()` without re-binding.
- **Verification:** `node scripts/test_variant_save_and_taxonomy_mapping.js`, `node scripts/test_parser_aliases_and_leaves.js`, and `node scripts/test_category_manager.js` pass.

---

## Verification Contract

| Unit | Command | Expected Outcome |
|---|---|---|
| U1 | `node scripts/test_multi_recipe_parser.js && node scripts/test_recipe_wizard_ui_space_efficiency.js` | Source/title parsing and Step 2 header rendering assertions pass |
| U2 | `node scripts/test_unit_conversion.js && node scripts/test_unit_conversion_report.js && node scripts/test_parser_aliases_and_leaves.js` | Sized handfuls (`10g`/`20g`/`30g`) and updated spinach fixture pass |
| U3 | `node scripts/test_recipe_wizard_qty_gate.js && node scripts/test_product_item_weights.js` | Garlic clove `qty` + `6g`/clove override checks pass |
| U4 | `node scripts/test_variant_save_and_taxonomy_mapping.js && node scripts/test_category_manager.js` | Disambiguation preference learning and Root Item creation mapping pass |
| All | `npm run ledger && node scripts/test_ledger.js && npm run build && node scripts/test_pwa_build.js` | Ledger clean, production build succeeds with stamped version |

---

## Definition of Done

- All 4 Implementation Units (`U1`–`U4`) implemented on a fresh `dev/*` branch from `development`.
- All Verification Contract commands pass after final edits with zero skipped assertions.
- Ledger regenerated (`npm run ledger`) and `npm run build` succeeds cleanly.
- PR opened targeting `development` using `.github/pull_request_template.md`.
