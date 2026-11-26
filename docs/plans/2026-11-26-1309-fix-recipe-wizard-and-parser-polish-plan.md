---
title: Recipe Wizard Footer, Blank Times, Stock Parsing, Clean Aliases, and Root Item Mapping
date: 2026-11-26
type: fix
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Recipe Wizard Footer, Blank Times, Stock Parsing, Clean Aliases, and Root Item Mapping

## Goal Capsule

- **Objective:** Recipes flow through Paste & Parse and the Recipe Wizard with a fixed Step 3/4 footer, blank unentered prep/cook times, accurate liquid-stock cube + water parsing, weight/volume-free aliases, and preserved ingredient names mapped to newly created Root Items.
- **Product authority:** Active scope is Area A (Recipe Wizard & Parser Fixes). Area B (Universal Partial/Token Search) and Area C (Data Quality Servings & Meal-Type Review Wizard) are separate future workstreams outside this plan.
- **Open blockers:** None.

---

## Product Contract

### Summary

Five bugs in the Recipe Wizard and Parser create unnecessary manual cleanup during recipe import and editing. This plan fixes the Step 3/4 footer layout so Save/Back stay pinned at the bottom like Step 2, stops auto-defaulting omitted Prep/Cook times to 15m/30m, parses liquid stock volumes (such as `1000ml vegetable stock`) as `1 qty` stock cube with `waterMl` equal to the parsed volume, enforces weight/volume stripping whenever aliases are learned, and keeps the recipe's parsed ingredient name while mapping to the Root Item when a user creates a new Root Item inside the Recipe Wizard.

### Problem Frame

When reviewing imported recipes in the Recipe Wizard, users have to scroll to the bottom of Step 3/4 to reach Back/Save, clear phantom 15m/30m prep and cook times that were never in the recipe, manually fix liquid stock rows that show `1000 ml` alongside a wrong `400 ml` water default, clean weights/volumes out of learned aliases, and undo ingredient-name overwrites and unwanted sub-type mappings after creating a new Root Item in the Wizard.

### Requirements

- R1. Pin the Step 3/4 Review & Save action bar (Back and Save buttons) in the fixed bottom modal footer, matching Step 2's fixed footer behavior, rather than rendering it inside the scrolling body.
- R2. Leave Prep Time and Cook Time blank when a recipe text or existing recipe does not provide them, instead of auto-defaulting to 15 minutes and 30 minutes in the parser or Recipe Wizard.
- R3. Parse liquid stock ingredient lines (such as `1000ml vegetable stock`, `1L chicken stock`, or `500ml veg stock`) as `qty: 1`, `unit: 'qty'`, canonical stock cube name (e.g., `Vegetable Stock Cube`), and `waterMl` set to the parsed volume in ml (e.g., `1000`, `500`), rather than keeping the liquid volume as the ingredient's primary quantity with a `400 ml` default.
- R4. Strip all weights, volumes, counts, multipliers, and measurement units from any phrase before storing it as an ingredient or sub-type alias across all alias-learning paths.
- R5. When a user creates a new Root Item from inside the Recipe Wizard (starting at Root Item in the Add Item flow), keep the recipe row's parsed ingredient name unchanged and map the row to the newly created Root Item rather than a sub-type.

### Key Decisions

- Default liquid stock lines (e.g., `1000ml vegetable stock`, `1L chicken stock`) to `qty: 1` stock cube with `waterMl` set to the parsed ml volume (`session-settled: user-directed` — user can adjust cube count in Step 2 if needed). Governs R3.
- Do not retroactively rewrite existing saved recipes' 15m/30m times or previously saved aliases; apply fixes to new imports, edits, and newly learned aliases going forward (`session-settled: user-confirmed`). Governs R2, R4.

### Scope Boundaries

- Area B (Universal Partial/Token Search across the app) is out of scope for this plan and will be scoped separately.
- Area C (Data Quality Servings & Meal-Type Review Wizard) is out of scope for this plan and will be scoped separately.
- Existing saved recipes and existing stored aliases are not migrated automatically.

<!-- ce-section: work-relationships -->
### How This Work Fits Together

This plan covers Area A (Recipe Wizard & Parser Fixes) from a 3-area polish batch alongside Area B (Universal Partial/Token Search) and Area C (Data Quality Servings & Meal-Type Review Wizard). Area A builds on the same Paste & Parse / Recipe Wizard pipeline as PR #83; Areas B and C are independent and can proceed in either order afterward.

### Acceptance Examples

- AE1. Fixed Step 3/4 footer and blank omitted times
  - **Covers:** R1, R2
  - **Given:** A recipe imported with no Prep Time or Cook Time lines reaches Step 3/4 (Review & Save) in the Recipe Wizard.
  - **When:** The user views Step 3/4.
  - **Then:** The Back and Save buttons are rendered in the fixed modal footer outside the scrollable body, and both Prep Time and Cook Time inputs are blank (not `15` and `30`).

- AE2. Liquid stock parses to 1 cube + parsed ml water
  - **Covers:** R3
  - **Given:** A recipe contains `1000ml vegetable stock` (or `1L chicken stock`).
  - **When:** Paste & Parse parses the ingredient and opens Step 2.
  - **Then:** The row has `qty: 1`, `unit: 'qty'`, name `Vegetable Stock Cube` (or `Chicken Stock Cube`), and `waterMl: 1000`.

- AE3. Aliases exclude weights and volumes
  - **Covers:** R4
  - **Given:** An ingredient line such as `400g red kidney beans` or `2 x 400ml coconut milk` triggers alias learning.
  - **When:** The alias is persisted.
  - **Then:** Only the clean ingredient phrase (`red kidney beans`, `coconut milk`) is stored—no digits, weights, or volume units.

- AE4. New Root Item in Wizard preserves ingredient name and maps to Root Item
  - **Covers:** R5
  - **Given:** A recipe row has parsed ingredient name `Cavolo Nero` and the user creates a new Root Item `Kale` from the Recipe Wizard.
  - **When:** The new-item flow finishes and returns to Step 2.
  - **Then:** The recipe row's ingredient name remains `Cavolo Nero` and its taxonomy mapping points to Root Item `Kale` (`subtypeId: null`), not a sub-type.

### Outstanding Questions

- None.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Fixed Step 3/4 modal footer** — Extract the Back/Save action bar from the scrolling body of `renderState3Review()` (`src/components/recipe/RecipeWizardStep3View.js:376-379`) into a new `renderStep3Footer()` using `.ios-fullscreen-footer`, and wire `wizardState.currentStep === 3` in `renderWizardFooter()` (`src/components/recipe/RecipeWizardModal.js:407-412`) alongside `renderStep2Footer()`. Adjust `#wiz-queue-saved-banner` in `RecipeWizardStep3Handlers.js:523-535` to use compact inline footer styling (`margin: 0; padding: 6px 12px; width: 100%`) so it fits cleanly inside the 60px `.ios-fullscreen-footer` without clipping. Governs R1.
- KTD2. **Blank unentered Prep & Cook times** — Initialize `prepMinutes = null, cookMinutes = null` in `parseSingleRecipeText` (`src/services/RecipeParserService.js:452`) and pass `null` fallback to `parseDurationMinutes(line, null)` so omitted or digitless time lines return `{ hours: '', minutes: '' }` (while explicit `0 Hours 0 Mins` still returns `{ hours: 0, minutes: 0 }`). Update `normalizeTime` defaults and call sites in `RecipeWizardModal.js:24-41, 126-131` and `RecipeWizardStep1Handlers.js:272-274` to preserve `{ hours: '', minutes: '' }` when missing/blank instead of reviving `15`/`30`, and compute `time` using `0` for blank components. Governs R2.
- KTD3. **Liquid stock cube + waterMl parsing** — Add a liquid-stock pattern in `parseIngredientString` (`src/services/RecipeIngredientParser.js`, immediately after section `0.` compound stock cube + liquid) matching `<qty> <ml|l|litres|millilitres> [optional modifiers] [<type>] (?:stock|bouillon|broth)` (supporting decimals/fractions like `1.5L`, `1000ml vegetable stock`, `1L chicken stock`, `500ml stock`, `500ml hot veg stock`) and returning `{ raw: s, qty: 1, unit: 'qty', isEstimated: false, name: '<Type> Stock Cube', notes: 'dissolved in <waterMl>ml water', waterMl, isToServe: false }`. Preserve `waterMl: parsed.waterMl ?? null` in Step 1A manual parsing (`RecipeWizardStep1Handlers.js:113-127`), and extend `RecipeWizardStep2View.js:122` to parse decimal litres (`(\d+(?:\.\d+)?)` × `1000`) in addition to `ml` when backfilling `waterMl` on legacy rows. Governs R3.
- KTD4. **Weight/volume-free alias learning across all paths** — Strengthen `cleanIngredientPhraseForAlias` (`src/services/RecipeIngredientParser.js:503-538`) so unspaced, decimal, multiplier, and hyphen/en-dash range weight & volume tokens (`400g`, `1.5L`, `2x400ml`, `100-150g`, `250 ml`, `1/2 tsp`) and stray unit words / bare numbers are stripped cleanly. Clean phrases before calling `learnIngredientAlias` in `RecipeWizardStep2Handlers.js:579-588`, remove the weak `|| rawPhrase.replace(...)` fallback in `RecipeWizardAliasesPrompt.js:48`, and in `pantryActions.js:110-120` always adopt `parsedClean` (aborting if empty or purely numeric rather than falling back to dirty `rawString`). Governs R4.
- KTD5. **Preserve parsed ingredient name & map to Root Item on new Root Item creation** — Include `startAt` in the `onComplete` payload emitted by `AddItemWizardUI.js:491-501` (and forward `startAt` if Step 3 chains through manual product creation). Extract an exported helper `applyCreatedTaxonomySelection` in `RecipeWizardTaxonomySearch.js` (`lines 437-474`) that never overwrites `rowNameInput.value`, and when `created.startAt === 'item'` clears both `subId = null` and `subName = ''` so both `dataset.taxVal` (`${ingId}`) and `displayLabel` (`📦 ${parentName}`) consistently map to the newly created Root Item. Governs R5.

### Sequencing

1. U1 (Fixed Step 3 footer + blank Prep/Cook times) and U2 (Liquid stock parsing + clean alias sanitization) are independent and can land together.
2. U3 (New Root Item preservation & mapping) updates `AddItemWizardUI.js` and `RecipeWizardTaxonomySearch.js`.
3. U4 (Regression tests & full suite verification) validates AE1–AE4 and all existing 56 test suites.

---

## Implementation Units

### U1. Fixed Step 3/4 footer and blank omitted Prep/Cook times

- **Covers:** R1, R2
- **Files:** `src/components/recipe/RecipeWizardStep3View.js`, `src/components/recipe/RecipeWizardStep3Handlers.js`, `src/components/recipe/RecipeWizardModal.js`, `src/services/RecipeParserService.js`, `src/components/recipe/RecipeWizardStep1Handlers.js`
- **Changes:**
  - Export `renderStep3Footer()` from `RecipeWizardStep3View.js` returning `<div class="ios-fullscreen-footer" id="wizard-step3-footer">` with the Back (`data-action="go-to-wizard-step" data-step="2"`) and Save (`id="btn-save-wizard-recipe"`) buttons, and remove that inline button row (`lines 376-379`) from `renderState3Review()`.
  - Call `renderStep3Footer()` from `renderWizardFooter()` in `RecipeWizardModal.js` when `wizardState.currentStep === 3`, and make `#wiz-queue-saved-banner` in `RecipeWizardStep3Handlers.js:523-535` compact (`margin:0; padding:6px 12px; width:100%`) so it fits inside `.ios-fullscreen-footer`.
  - In `RecipeParserService.js`, change `prepMinutes` and `cookMinutes` initializers from `15`/`30` to `null` and pass `null` fallback to `parseDurationMinutes`; return `{ hours: '', minutes: '' }` when `null`, and `{ hours: Math.floor(m / 60), minutes: m % 60 }` when parsed (including `0`).
  - In `RecipeWizardModal.js` (`lines 24-41, 126-131`) and `RecipeWizardStep1Handlers.js` (`lines 270-274`), preserve blank `{ hours: '', minutes: '' }` when no prep/cook time is present instead of substituting `15`/`30`.

### U2. Liquid stock parsing and weight/volume-free alias learning

- **Covers:** R3, R4
- **Files:** `src/services/RecipeIngredientParser.js`, `src/components/recipe/RecipeWizardStep1Handlers.js`, `src/components/recipe/RecipeWizardStep2View.js`, `src/components/recipe/RecipeWizardStep2Handlers.js`, `src/components/recipe/RecipeWizardAliasesPrompt.js`, `src/store/actions/pantryActions.js`
- **Changes:**
  - In `RecipeIngredientParser.js` (`parseIngredientString`), match liquid stock lines (`1000ml vegetable stock`, `1L chicken stock`, `500ml stock`, `1.5L beef broth`, `500ml hot veg stock`), converting `l`/`litre(s)` × 1000 to `waterMl`, normalizing `veg` → `Vegetable` (default `Vegetable` when omitted), and returning `qty: 1`, `unit: 'qty'`, `name: '<Type> Stock Cube'`, `waterMl`, `notes: 'dissolved in <waterMl>ml water'`.
  - In `RecipeWizardStep1Handlers.js` (`lines 113-127`), preserve `waterMl: parsed.waterMl ?? null` during Step 1A manual parsing; in `RecipeWizardStep2View.js` (`lines 120-124`), parse decimal litres (`(\d+(?:\.\d+)?)` × `1000`) in addition to `ml` when backfilling `waterMl`.
  - In `RecipeIngredientParser.js` (`cleanIngredientPhraseForAlias`), strip glued/unspaced, decimal, multiplier, and hyphen/en-dash range weight/volume tokens (`400g`, `1000ml`, `1.5L`, `2x400g`, `100-150g`), stray unit words (`g`, `kg`, `ml`, `l`, `tbsp`, `tsp`, `oz`, `lb`), and leading/trailing numbers.
  - In `RecipeWizardStep2Handlers.js` (`lines 579-588`), clean `phrase` with `cleanIngredientPhraseForAlias` before stemming/learning; in `RecipeWizardAliasesPrompt.js` (`line 48`), remove the weak `|| rawPhrase.replace(...)` fallback; in `pantryActions.js` (`learnIngredientAlias`), always adopt `parsedClean` and abort if empty or purely numeric.

### U3. Preserve parsed ingredient name and map to Root Item in Recipe Wizard

- **Covers:** R5
- **Files:** `src/components/pantry/AddItemWizardUI.js`, `src/components/recipe/RecipeWizardTaxonomySearch.js`
- **Changes:**
  - In `AddItemWizardUI.js` (`line 491`), include `startAt` in the `cb({ ... })` completion payload.
  - In `RecipeWizardTaxonomySearch.js` (`lines 437-474`), extract and export `applyCreatedTaxonomySelection({ created, inputEl, dropdownEl, currentIngName, sIdx, iIdx, onSelectCallback })`, remove `rowNameInput.value = subName || parentName`, and when `created.startAt === 'item'` clear both `subId = null` and `subName = ''` so both `dataset.taxVal` (`${ingId}`) and `displayLabel` (`📦 ${parentName}`) map consistently to the newly created Root Item.

### U4. Regression tests and verification

- **Covers:** AE1, AE2, AE3, AE4, R1–R5
- **Files:** `scripts/test_recipe_wizard_and_parser_polish.js`
- **Changes:**
  - Test `renderWizardFooter()` on Step 3 contains `#wizard-step3-footer`, `#btn-save-wizard-recipe`, and `go-to-wizard-step`, and `renderState3Review()` does not duplicate them inside the scrolling body (AE1).
  - Test `parseBulkRecipeText` without Prep/Cook Time lines returns `{ hours: '', minutes: '' }` and Step 3 inputs render blank (AE1).
  - Test `parseIngredientString` on `1000ml vegetable stock`, `1L chicken stock`, `1.5L beef stock`, and `500ml stock` returns `qty: 1`, `unit: 'qty'`, and matching `waterMl` (AE2).
  - Test `cleanIngredientPhraseForAlias` and `learnIngredientAlias` on `400g red kidney beans`, `2 x 400ml coconut milk`, `1.5L vegetable stock`, and `100-150g baby spinach` strip all weights/volumes and reject unit-only strings like `400g` (AE3).
  - Test `applyCreatedTaxonomySelection` with `{ startAt: 'item', ingredientId: 'ing_kale', subtypeId: 'sub_std', parentName: 'Kale', subtypeName: 'Standard' }` preserves `rowNameInput.value === 'Cavolo Nero'`, sets `taxVal === 'ing_kale'`, and sets `displayLabel === '📦 Kale'` (AE4).

---

## Verification Contract

- `node scripts/test_recipe_wizard_and_parser_polish.js` passes all assertions for AE1–AE4.
- `npm run lint` passes.
- `npm test` passes with zero regressions across all existing suites (including `test_recipe_wizard.js`, `test_multi_recipe_parser.js`, `test_parser_aliases_and_leaves.js`, and `test_paste_parse_cookbook_and_notes.js`).
- `npm run build` succeeds and `find src -name "*.js" -exec node --check {} +` passes (delete `dist/` afterward so `npm run dev` serves live `src/`).

---

## Definition of Done

- All requirements R1–R5 and acceptance examples AE1–AE4 are implemented and verified by `scripts/test_recipe_wizard_and_parser_polish.js`.
- `npm run lint`, `npm test`, `npm run build`, and `node --check` on all `src/**/*.js` pass cleanly.
- Changes are committed and pushed to `dev/fix-paste-parse-and-recipe-notes` (PR #83 targeting `development`).
