---
title: Paste & Parse Cookbook Format Fixes and Recipe Notes
date: 2026-11-26
type: fix
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Paste & Parse Cookbook Format Fixes and Recipe Notes

## Goal Capsule

- **Objective:** Pasting cookbook-formatted recipes into PlatePlan populates title, source, prep/cook times, servings, ingredients, method steps, and recipe tips into the right fields without manual cleanup.
- **Product authority:** Scope covers Paste & Parse parsing accuracy plus storing, editing, and displaying a dedicated Recipe Notes field. Additional Paste & Parse or importer issues the user raises later are outside this plan's active scope.
- **Open blockers:** None.

---

## Product Contract

### Summary

Cookbook recipes pasted into Paste & Parse fail when they use structured headers (`Source Type`, `Source Name`, `(hours and minutes)` durations), place `Serves N` inside the Ingredients block, include compound split-quantity lines (`4 tsp olive oil, plus 4 tbsp`), or place tip/hack callouts (`Make it Vegetarian:`, `Cooking Hacks:`) between Ingredients and Method. This change fixes those parsing failures and introduces a dedicated Recipe Notes field that captures non-ingredient callout blocks and surfaces them in the Recipe Wizard and Recipe Detail modal.

### Problem Frame

When a user pastes a formatted cookbook recipe such as Fresh Mob into Paste & Parse, the cookbook name overwrites the recipe title, prep and cook times fall back to defaults, `Serves 2` and multi-line cooking tips are imported as fake ingredients, and split-quantity oil lines break into bogus rows (`42 g Tbsp`). Users have to manually delete bogus ingredients, re-enter title/source/times/servings, and lose the cookbook's tips or vegetarian swap notes.

### Requirements

- R1. Parse `Source Type:` (e.g., `Book`, `Online`) and `Source Name:` as book/online source metadata without overwriting the recipe title set by `Recipe Title:` or `Title:`.
- R2. Parse `Prep Time` and `Cook Time` headers regardless of parenthetical unit labels, including `(hours and minutes)` and `(Hours & Mins)`, preserving explicit `0 Hours 0 Mins` as `0` minutes instead of falling back to defaults.
- R3. Extract `Serves N` / `Makes N` / `Yield N` lines as the recipe's `servings` value even when they appear inside the Ingredients block, and exclude them from the parsed ingredients list.
- R4. Combine compound split-quantity ingredient lines (such as `4 tsp olive oil, plus 4 tbsp` or `1 tbsp oil, plus 2 tsp`) into a single ingredient line whose quantity is the sum of the compatible units, preserving the original split expression (e.g., `4 tsp + 4 tbsp`) in the ingredient's `notes`.
- R5. When a compound split-quantity line mixes incompatible units that cannot be summed cleanly, keep the first quantity on the ingredient line and preserve the extra portion in the ingredient's `notes` instead of splitting it into a broken second ingredient.
- R6. Strip trailing parenthetical dietary alternatives (such as `(or vegetarian alternative)`) from the ingredient name and move them into the ingredient's `notes` so taxonomy matching sees the clean ingredient name.
- R7. Detect non-ingredient callout and tip blocks appearing between Ingredients and Method (such as `Make it Vegetarian:`, `Cooking Hacks:`, `Tips:`, `Chef's Tip:`, `Notes:`, including their continuation lines up to the `Method:` header) and capture them into a dedicated `notes` field on the recipe rather than parsing them as ingredients.
- R8. Display non-empty Recipe Notes in a dedicated section of the Recipe Detail modal, and allow viewing and editing Recipe Notes in the Recipe Wizard before saving or when editing an existing recipe.

### Key Decisions

- Capture callout/tip blocks into a dedicated Recipe Notes field shown in the Recipe Detail modal (`session-settled: user-selected`, over dropping them or appending them to Method — keeps ingredients and numbered method steps clean while preserving cookbook tips). Governs R7, R8.
- Sum compatible compound split-quantity lines into a single ingredient row with the original split in notes (`session-settled: user-selected`, over splitting into two lines or dropping the second quantity — keeps macro calculations and shopping list totals accurate). Governs R4, R5.
- Make Recipe Notes editable in the Recipe Wizard alongside displaying them in the Recipe Detail modal (inferred default — lets users review and tweak imported tips before saving). Governs R8.

### Scope Boundaries

- Existing saved recipes are not retroactively re-parsed; Recipe Notes and the improved parser apply to new Paste & Parse imports and manual edits.
- Broader bulk-import UX redesigns or unrelated issues the user plans to raise next remain out of scope for this plan.

### Acceptance Examples

- AE1. Structured Fresh Mob cookbook recipe parses cleanly
  - **Covers:** R1, R2, R3, R4, R6, R7
  - **Given:** The user pastes the "Parmesan Cauliflower Steaks with Pistachio Pesto" recipe containing `Recipe Title:`, `Source Type: Book`, `Source Name: FRESH MOB (Weekend)`, `Page number: 153`, `Prep Time (hours and minutes): 0 Hours 0 Mins`, `Cook Time (Hours and minutes): 0 Hours 45 Mins`, `Serves 2` under `Ingredients:`, `4 tsp olive oil, plus 4 tbsp`, `75g (2¾oz) Parmesan (or vegetarian alternative)`, `Make it Vegetarian: ...`, and `Cooking Hacks: ...` (2 lines) before `Method:`.
  - **When:** Paste & Parse parses the text.
  - **Then:** `title` is `"Parmesan Cauliflower Steaks With Pistachio Pesto"` (matching `toTitleCase`), `sourceType` is `"book"`, `sourceBook` is `"FRESH MOB (Weekend)"`, `sourcePage` is `"153"`, `prepTime` is `0h 0m`, `cookTime` is `0h 45m`, `servings` is `2`, olive oil parses as a single `80 ml` `Olive Oil` ingredient with the split noted, Parmesan parses as `75 g` `Parmesan` with `(or vegetarian alternative)` in notes, neither `Serves 2` nor the callout blocks appear in `ingredients`, and the callout blocks are preserved in `recipe.notes`.

- AE2. Recipe Notes round-trip through Wizard and Detail modal
  - **Covers:** R7, R8
  - **Given:** A recipe imported with non-empty `notes` (or edited to add `notes` in the Recipe Wizard).
  - **When:** The user saves the recipe and opens it in the Recipe Detail modal.
  - **Then:** The Recipe Detail modal renders a dedicated Recipe Notes section displaying the saved notes, and reopening the recipe in the Wizard populates the editable Recipe Notes field.

### Outstanding Questions

- **Deferred to Planning:** Resolved below in KTD4 — Recipe Notes renders as a full-width card below the two-column Ingredients/Method grid in `RecipeDetailModalUI.js` (only when non-empty) and as a multiline `<textarea>` in the Recipe Wizard (Steps 1, 2, and 3).

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Header & block-boundary hygiene in `RecipeParserService.js`** — Restrict the `Name:`/`Title:` header split in `unpackAndSplitRecipeBlocks` (`src/services/RecipeParserService.js:42`) so it never splits after `Source ` (including inline `Source Name:` or when `Source Name:` precedes `Source Type:`), extend `applySourceLine` and `isHeaderMetadataLine` to recognize `Source Type:` and `Source Name:` (mapping `Source Name:` to `sourceBook` when book or `sourceUrl` when URL), relax `Prep Time`/`Cook Time` regexes to accept any parenthetical label (`\([^)]*\)`), and return `0` from `parseDurationMinutes` when explicit `0` hours/mins were matched rather than defaulting to `15`. Also use `??` instead of `||` for prep/cook minutes in direct bulk import (`src/components/recipe/RecipeWizardStep1Handlers.js:272`). Governs R1, R2.
- KTD2. **In-ingredients `Serves N` extraction & callout block capture** — Inside `parseSingleRecipeText` (`src/services/RecipeParserService.js`), detect `Serves N` / `Makes N` / `Yield N` lines inside `rawIngText` (setting `servings` and skipping ingredient parsing), and detect non-ingredient callout headers (`Make it Vegetarian:`, `Make it Vegan:`, `Cooking Hacks:`, `Cook's Tip:`, `Chef's Tip:`, `Tips?:`, `Notes?:`, `Serving Suggestions?:`, `Storage:`) plus their subsequent prose/continuation lines up to `Method:` (capturing them into `recipe.notes` as newline-separated paragraphs instead of ingredients). Inside a callout block, exit only on another callout header, an explicit ingredient section header (`For the ...:` / `To serve:`), or a strict leading quantity+unit ingredient line — never `isIngredientOrSectionLine` (whose `\bcans?\b` matches the English verb `"can"`). Governs R3, R7.
- KTD3. **Compound split-quantity summation & multi-parenthetical stripping** — Mask compound split-quantity tails (`(?:,\s*|\s+)(?:plus|\+)\s+<qty>\s*<unit>...`) before `.split(...)` in `parseIngredientLine` (`src/services/RecipeParserService.js:737`, matching the existing `parens` mask for Safari/WebKit compatibility), and parse those tails in `parseIngredientString` (`src/services/RecipeIngredientParser.js`) by capturing the raw primary `<q1> <u1>` before strict conversion, passing `primaryParsed.name` to `convertToStrictUnit(q2, u2, primaryParsed.name)` so liquid density resolves (`4 tbsp` → `60 ml`), combining `isEstimated`, restoring `raw: s`, and summing when both resolve to the same strict unit (recording `4 tsp + 4 tbsp` plus any trailing qualifier in `notes`), or keeping the primary quantity with `plus <extra>` in `notes` when units are incompatible. Replace the single parenthetical regex (`src/services/RecipeIngredientParser.js:394`) with a global extraction loop so all parentheticals (e.g. `(2¾oz)` and `(or vegetarian alternative)`) move to `notes`. Governs R4, R5, R6.
- KTD4. **Recipe Notes field across Wizard, Repository, Importer, and Detail Modal** — Persist `notes` (trimmed string, default `''`) alongside `sourceBook`/`sourcePage` in `RecipeWizardState.js`, `RecipeWizardModal.js` (including `loadNextRecipeFromQueue`), `RecipeWizardStep1Handlers.js` (including `#btn-import-all-direct`), `RecipeWizardStep2View.js`, `RecipeWizardStep2Handlers.js`, `RecipeWizardStep3View.js`, `RecipeWizardStep3Handlers.js`, `RecipeWizardViews.js`, `RecipeImporter.js`, and `RecipeFirestoreRepository.js` (coerced to `''` in `sanitizeForFirestore` and preserved in `mergeDuplicateRecipeCluster`). Render a full-width `📝 Recipe Notes` card after `.recipe-modal-body` inside `.recipe-view-scroll-body` in `RecipeDetailModalUI.js` (reading `String(props.notes ?? activeR.notes ?? r.notes ?? '').trim()` directly so direct callers work without `RecipeDetailModalService.js`) only when non-empty, with HTML escaping and `white-space: pre-line`. Governs R8.

### Sequencing

1. U1 (Parser headers, durations, servings, callouts) and U2 (Compound split quantities & multi-parentheticals) land first and are unit-tested against the exact Fresh Mob recipe and edge cases.
2. U3 (Recipe Notes wiring in Wizard Steps 1–3, Repository, Importer, and Detail Modal) builds on `recipe.notes` produced by U1.
3. U4 (Regression tests & full suite verification) validates AE1, AE2, and zero regressions across all 55+ existing test suites.

---

## Implementation Units

### U1. Cookbook metadata, durations, servings, and callout-to-notes parsing

- **Covers:** R1, R2, R3, R7
- **Files:** `src/services/RecipeParserService.js`, `src/services/RecipeImporter.js`
- **Changes:**
  - Fix `unpackAndSplitRecipeBlocks` (`line 42`) so bare `(?:Title|Name):` never splits inside `Source Name:`.
  - Update `isHeaderMetadataLine` (`line 298`) and `applySourceLine` (`lines 453-511`) to handle `Source Type: Book|Online` and `Source Name: <value>` (assigning `sourceBook` when book or `sourceUrl` when URL, regardless of whether `Source Name:` appears before or after `Source Type:`).
  - Update `Prep Time` / `Cook Time` header checks (`lines 552-559`) to match optional parentheticals like `(hours and minutes)` or `(Hours & Mins)`, and update `parseDurationMinutes` (`lines 720-727`) to return `0` when explicit `0` hours/minutes are matched.
  - Inside `parseSingleRecipeText` (`lines 574-597`), intercept `Serves N` / `Makes N` / `Yield N` lines in `ingLines` to populate `servings` (when not yet set) without passing them to `parseIngredientLine`.
  - Detect callout headers (`Make it Vegetarian:`, `Make it Vegan:`, `Cooking Hacks:`, `Tips?:`, `Chef's Tip:`, `Cook's Tip:`, `Notes?:`, `Storage:`, `Variations?:`) in `rawIngText` before `unpackCollapsedIngredients` runs, and capture each callout line plus its continuation lines up to `Method:` (stopping only on another callout header, explicit `For the ...:`/`To serve:` header, or a strict leading quantity+unit ingredient line — not `isIngredientOrSectionLine`) into `recipe.notes`, removing them from `rawIngText`. Forward `notes` (and `sourceType`/`sourceUrl`/`sourceBook`/`sourcePage`) in `RecipeImporter.js` fallback.

### U2. Compound split-quantity summation and multi-parenthetical stripping

- **Covers:** R4, R5, R6
- **Files:** `src/services/RecipeParserService.js`, `src/services/RecipeIngredientParser.js`
- **Changes:**
  - In `RecipeParserService.js` (`parseIngredientLine`, `line 737`), mask compound split-quantity tails `(?:,\s*|\s+)(?:plus|\+)\s+(?:\d+...)` before `.split(...)` (matching the existing `parens` mask for Safari/WebKit safety) and unmask afterward.
  - In `RecipeIngredientParser.js` (`parseIngredientString`), detect trailing compound split-quantity clauses before standard parsing: extract the raw primary `<q1> <u1>`, parse the primary ingredient, convert the secondary quantity with `convertToStrictUnit(q2, u2, primaryParsed.name)` so liquid density resolves (`4 tbsp` → `60 ml`), combine `isEstimated`, restore `raw: s`, and sum when both resolve to the same strict unit (appending `"<q1> <u1> + <q2> <u2>"` plus any qualifier to `notes`), or keep the primary quantity and append `"plus <q2> <u2>"` to `notes` when incompatible.
  - Replace the single-match parenthetical extraction (`line 394`) with a global loop extracting all `(...)` groups into `extraNotes` (collapsing extra whitespace) so `75g (2¾oz) Parmesan (or vegetarian alternative)` yields `name: "Parmesan"` and `notes: "2 3/4oz, or vegetarian alternative"`.

### U3. Recipe Notes UI and persistence across Wizard and Detail Modal

- **Covers:** R8
- **Files:** `src/components/recipe/RecipeWizardState.js`, `src/components/recipe/RecipeWizardModal.js`, `src/components/recipe/RecipeWizardViews.js`, `src/components/recipe/RecipeWizardStep1Handlers.js`, `src/components/recipe/RecipeWizardStep2View.js`, `src/components/recipe/RecipeWizardStep2Handlers.js`, `src/components/recipe/RecipeWizardStep3View.js`, `src/components/recipe/RecipeWizardStep3Handlers.js`, `src/services/RecipeFirestoreRepository.js`, `src/services/RecipeDetailModalService.js`, `src/components/recipe/RecipeDetailModalUI.js`
- **Changes:**
  - Thread `notes: ''` through wizard state defaults (`RecipeWizardState.js`), bulk queue loading (`RecipeWizardModal.js` `loadNextRecipeFromQueue`), direct bulk import (`RecipeWizardStep1Handlers.js` `#btn-import-all-direct`, also fixing `prepTime.minutes ?? 15` / `cookTime.minutes ?? 30` so `0`m is preserved), existing-recipe edit hydration, step sync helpers, and final save payload (`RecipeWizardStep3Handlers.js`).
  - Add a labelled `<textarea>` for Recipe Notes (with accessible `id`, `name`, and `aria-label` so `test_accessibility_dom.js` stays green) in Manual Step 1 (`RecipeWizardViews.js`), Step 2 (`RecipeWizardStep2View.js` + `RecipeWizardStep2Handlers.js`), and Step 3 Review (`RecipeWizardStep3View.js`).
  - Preserve `notes` (normalized to `''`, never `undefined`) in `RecipeFirestoreRepository.js` (`sanitizeForFirestore` and `mergeDuplicateRecipeCluster`).
  - Render a `📝 Recipe Notes` card in `RecipeDetailModalUI.js` after `.recipe-modal-body` inside `.recipe-view-scroll-body` whenever `String(props.notes ?? activeR.notes ?? r.notes ?? '').trim()` is non-empty (escaped safely with `escapeHtml` and `white-space: pre-line`), also passing `notes` from `RecipeDetailModalService.js`.

### U4. Regression tests

- **Covers:** AE1, AE2, R1–R8
- **Files:** `scripts/test_paste_parse_cookbook_and_notes.js`
- **Changes:**
  - Test the exact Fresh Mob "Parmesan Cauliflower Steaks with Pistachio Pesto" recipe end-to-end through `parseBulkRecipeText` asserting every field in AE1.
  - Test incompatible compound split quantities (R5 fallback), explicit `0 Hours 0 Mins` vs omitted times (R2), multiple parentheticals (R6), and `renderRecipeDetailModalContent` rendering/hiding the Recipe Notes section (AE2).

---

## Verification Contract

- `node scripts/test_paste_parse_cookbook_and_notes.js` passes all assertions for AE1, AE2, and edge cases.
- `npm run lint` passes (verifies `server.js` syntax and static DOM accessibility for any new wizard `<textarea>` inputs).
- `npm test` passes with zero regressions across all existing parser, wizard, and detail modal suites.
- `npm run build` succeeds and `find src -name "*.js" -exec node --check {} +` passes (delete `dist/` afterward so `npm run dev` serves live `src/`).

---

## Definition of Done

- All requirements R1–R8 and acceptance examples AE1–AE2 are implemented and verified by `scripts/test_paste_parse_cookbook_and_notes.js`.
- `npm run lint`, `npm test`, `npm run build`, and `node --check` on all `src/**/*.js` pass cleanly.
- Work is committed on a fresh `dev/<topic>` branch off latest `origin/development` with a PR targeting `development`.
