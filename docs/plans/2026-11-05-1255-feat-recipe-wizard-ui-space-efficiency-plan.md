---
title: "feat: Recipe Wizard UI Space Efficiency, Sticky Action Footer & Compact Step Sizing"
date: "2026-11-05"
type: feat
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-ideate
execution: code
---

# Recipe Wizard UI Space Efficiency, Sticky Action Footer & Compact Step Sizing

## Goal Capsule

- **Objective:** Overhaul the Recipe Wizard interface (`RecipeWizardModal.js`, `RecipeWizardStep2View.js`, `RecipeWizardStep2Handlers.js`) to maximize vertical space efficiency, anchor critical navigation and gating status in a persistent sticky footer, compact method steps, and tighten ingredient row layout without sacrificing readability or autocomplete ergonomics.
- **Means:** 
  1. Relocate navigation buttons (`← Back`, `Next: Final Inline Review →`) and the unmapped ingredient gating banner into a fixed glassmorphic `.ios-fullscreen-footer`.
  2. Add an interactive status pill in the footer (`⚠️ X unmapped items` / `✓ All items linked`) that auto-scrolls directly to the first unmapped row on tap.
  3. Consolidate three stacked top banners (~240px) into a single high-density header toolbar (~46px).
  4. Convert method step textareas to compact single-line inputs (32px) that auto-expand on focus/typing.
  5. Compact ingredient rows into a dense two-tier layout tucking `Raw: "..."` text as subtext under the parsed name.
  6. Add slim section dividers with ingredient count badges.
- **Authority & Constraints:** Preserve all existing data structures and validation invariants (`isIngredientUnlinked`, `syncStep2InputsToState`, `promptRecipeWizardAliases`, `calculateMealFitScore`). Never replace searchable taxonomy autocomplete with native `<select>`.
- **Stop Conditions:** Step 2 displays the consolidated header and at least 6–8 ingredient rows above the fold; the footer remains pinned to the bottom on all screen sizes; unmapped gating actively blocks advancement; method steps consume minimal vertical space; all regression tests pass.

---

## Product Contract

### Problem Frame
The current Recipe Wizard modal suffers from severe vertical bloat:
1. **Buried Navigation & Blockers:** Navigation buttons and the gating alert (`⚠️ Action Required: X ingredients unlinked...`) sit at the bottom of the scroll container. On dishes with 15+ ingredients and 10 steps, users must scroll several screens down just to see why Next is disabled or to advance.
2. **Top Header Overhead:** Three stacked cards (Dish index/title card, Dual-Profile Macro Crossbar, and Recipe Mapping Yield banner) consume ~240px before the first ingredient row is visible.
3. **Bulky Method Step Inputs:** Each method step renders a multiline `rows="2"` textarea with ~70px height, causing 10-step recipes to consume 700px+ of scrolling real estate.
4. **Wasted Table Width:** The table dedicates 35% of horizontal space to a read-only `Raw: "..."` string column, compressing the taxonomy autocomplete picker and stretching row height.

### Requirements

- **R1 (Sticky Action Footer):** The Recipe Wizard modal must have a persistent footer fixed at the bottom of the viewport (`.ios-fullscreen-footer`) across all screen sizes, containing `← Back`, a centered live gating pill, and `Next →`.
- **R2 (Interactive Gating Pill):** When unmapped ingredients exist, the footer pill must display `⚠️ X unmapped items` (with warning styling) and when tapped must smooth-scroll the scroll container directly to the first unmapped ingredient and focus its autocomplete input. When all ingredients are linked, it displays `✓ All items linked` (with calm green badge styling).
- **R3 (Consolidated Header Toolbar):** Step 2 must replace the three stacked banners with a single compact bar (~46px) containing:
  - Left: Dish queue badge (`Dish 1 of 67`), Recipe Title, Fit Score badge, and inline macro pill (`E: 748kcal 22g | C: 518kcal 15g`).
  - Right: Compact servings stepper/input (`Yield: [ 4 ] serv`).
- **R4 (Compact Auto-Fitting Method Steps):** Step instruction inputs must render as compact single-line text inputs (`min-height: 32px; height: 32px; font-size: 12.5px; padding: 4px 8px;`) that automatically expand to fit multi-line content on focus or typing, and compact on blur.
- **R5 (Dense Two-Tier Ingredient Rows):** The dedicated "Raw" column must be eliminated. The raw string must appear as subtle muted subtext (10.5px italic) directly beneath the parsed ingredient name. Table cell padding must be tightened to 3–4px, allocating expanded width (~260px+) to the autocomplete picker.
- **R6 (Slim Section Dividers):** Section headers must be slimmed down with section title input, ingredient count badge (e.g. `[16 items]`), `+ Add Line`, and `Remove Section`.

### Acceptance Examples

- **AE1 (Immediate Visibility):** Opening Step 2 on a laptop or mobile viewport immediately displays the consolidated header and at least 6 ingredient rows without initial scrolling.
- **AE2 (Live Sticky Gating):** On a recipe with 20 ingredients where item #18 is "✨ New Item", the bottom footer is immediately visible with `⚠️ 1 unmapped item` and disabled `Next →`. Tapping the warning pill scrolls row 18 into view and focuses its search picker.
- **AE3 (Advancement Unlock):** Selecting a valid product or category in row 18 immediately updates the footer pill to `✓ All items linked` and enables the `Next: Final Inline Review →` button without requiring any scroll to the bottom.
- **AE4 (Method Step Footprint):** A 10-step recipe method list occupies less than 360px vertical height when unfocused, compared to over 700px previously.

### Scope Boundaries

- **In Scope:** `RecipeWizardModal.js`, `RecipeWizardStep2View.js`, `RecipeWizardStep2Handlers.js`, `RecipeWizardStep3View.js` (for footer consistency), CSS styles for footer and compact inputs in `index.html`.
- **Deferred to Follow-Up Work:** Automated swap link improvements and auto-enhance rules for enhanced recipe variants (explicitly banked by user).
- **Out of Scope:** Native `<select>` replacements for taxonomy (never allowed), modifications to Firestore schema.

---

## Planning Contract

### Key Technical Decisions

- **KTD1 (Fixed Footer Shell in `RecipeWizardModal.js`):**  
  *(session-settled: user-directed — chosen over per-view inline footer: keeps footer persistent across modal lifecycle without re-rendering flicker)*  
  The `.ios-fullscreen-modal` structure is updated to render:
  1. `.ios-fullscreen-nav` (top bar: Cancel, Title, Step Badge, Done)
  2. `.ios-fullscreen-body` (scrollable content with `padding-bottom: 70px` to clear footer)
  3. `.ios-fullscreen-footer` (fixed glassmorphic bottom bar)
- **KTD2 (Footer Content Delegation & Dynamic State Sync):**  
  In Step 2, the footer hosts `#wizard-back-btn`, `#wiz-gate-pill`, and `#btn-next-step2`. Event handlers in `RecipeWizardStep2Handlers.js` bind to these buttons seamlessly.
- **KTD3 (Scroll-to-Unmapped Target Anchor):**  
  Each ingredient row marked unlinked receives a class `wiz-row-unlinked` and an `id="wiz-ing-row-${sIdx}-${iIdx}"`. Tapping `#wiz-gate-pill` queries `.wiz-row-unlinked:first-of-type` and executes `el.scrollIntoView({ behavior: 'smooth', block: 'center' })` and focuses the inner autocomplete input.
- **KTD4 (CSS Single-Line Auto-Grow Textarea Pattern):**  
  Use CSS `min-height: 32px; height: 32px; resize: vertical; overflow-y: hidden;` with an `input` / `focus` listener that adjusts `el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px';` on focus/typing and resets on blur if empty or short.
- **KTD5 (Two-Tier Row Cell Layout):**  
  Column 1: `Qty` (55px) + `Unit` (60px) inline group.  
  Column 2: `Parsed Name` input with `<div class="wiz-raw-subtext">Raw: "${escapeHtml(rawDisplay)}"</div>` underneath.  
  Column 3: Taxonomy search input (`renderTaxonomySearchHTML`) taking remaining width (`min-width: 250px`).  
  Column 4: Delete button (32px).

### High-Level Technical Design

```
+--------------------------------------------------------------------------+
| Cancel                     Recipe Wizard Step 2                   Done   | [.ios-fullscreen-nav]
+--------------------------------------------------------------------------+
| [Dish 1/67] Boeuf Bourguignon [37% Poor Match] | Yield: [ 4 ] | Macros   | [Consolidated Header Bar]
+--------------------------------------------------------------------------+
|  Ingredient Sections                                                     | [.ios-fullscreen-body]
|  +--------------------------------------------------------------------+  | (overflow-y: auto,
|  | Main Section [16 items]                    [+ Add Line] [Remove]   |  |  padding-bottom: 72px)
|  |--------------------------------------------------------------------|  |
|  | [ 2 ] [ qty ] | Onions                               | [🔍 Onions] |🗑|  |
|  |               | Raw: "2 brown onions"                |             |  |  |
|  | [ 3 ] [ qty ] | Garlic                               | [🔍 Garlic] |🗑|  |
|  |               | Raw: "3 cloves garlic"               |             |  |  |
|  +--------------------------------------------------------------------+  |
|  Method Steps (8)                                                        |
|  1. [ Sauté onions until golden...                         ] 🗑          |
|  2. [ Add garlic and plant-based steak...                  ] 🗑          |
+--------------------------------------------------------------------------+
| [ ← Back ]          [ ⚠️ 1 unmapped item ]          [ Next Review → ]    | [.ios-fullscreen-footer]
+--------------------------------------------------------------------------+
```

### File Inventory

- `src/components/recipe/RecipeWizardModal.js` — Add `.ios-fullscreen-footer` container and dynamic step footer rendering.
- `src/components/recipe/RecipeWizardStep2View.js` — Rewrite to render consolidated header bar, 2-tier ingredient table, and compact method steps.
- `src/components/recipe/RecipeWizardStep2Handlers.js` — Wire footer events, smooth-scroll on gating pill tap, and dynamic textarea auto-grow.
- `index.html` — Add CSS for `.ios-fullscreen-footer` and `.wiz-raw-subtext` if needed.
- `scripts/test_recipe_wizard_ui_space_efficiency.js` — New standalone verification test script.

---

## Implementation Units

### U1. Sticky Action Footer in Wizard Modal
**Goal:** Add a persistent bottom footer `.ios-fullscreen-footer` to `RecipeWizardModal.js` that renders the appropriate navigation and gating controls per step.  
**Requirements:** R1, R2.  
**Dependencies:** None.  
**Files:** `src/components/recipe/RecipeWizardModal.js`, `index.html`.  
**Approach:**
1. In `RecipeWizardModal.js`, introduce a `renderWizardFooter()` helper called at the root of `renderWizardModal()`.
2. In Step 2, the footer renders:
   - Left: `<button type="button" class="btn ghost" id="wizard-back-btn">← Back</button>`
   - Center: `<button type="button" class="wiz-gate-pill" id="wiz-gate-pill" style="...">⚠️ <span class="wiz-unlinked-count">X</span> unmapped item(s)</button>`
   - Right: `<button type="button" class="btn primary" id="btn-next-step2">Next: Final Inline Review →</button>`
3. Add CSS for `.ios-fullscreen-footer` in `index.html` ensuring `position: sticky; bottom: 0; z-index: 50; background: var(--surface); border-top: 1px solid var(--border); padding: 12px 20px; display: flex; justify-content: space-between; align-items: center;`.
4. Ensure `.ios-fullscreen-body` has `padding-bottom: 80px;` so bottom content scrolls clear of the footer.  
**Test scenarios:**
- *Scenario 1.1:* Step 2 modal renders `.ios-fullscreen-footer` with Back, gating pill, and Next buttons present in DOM.
- *Scenario 1.2:* Modal body has bottom padding preventing content clipping behind the footer.  
**Verification:** DOM inspection verifies footer element exists and is styled fixed/sticky.

### U2. Consolidated Header Bar in Step 2
**Goal:** Merge the three stacked cards in `RecipeWizardStep2View.js` into a single high-density header bar (~46px).  
**Requirements:** R3.  
**Dependencies:** U1.  
**Files:** `src/components/recipe/RecipeWizardStep2View.js`, `src/components/recipe/RecipeWizardStep2Handlers.js`.  
**Approach:**
1. Remove the separate title card, dual-profile crossbar, and servings banner in `RecipeWizardStep2View.js`.
2. Clean up rogue extra closing `</div>` tags currently at lines 184-185 of `RecipeWizardStep2View.js`.
3. Render a unified header toolbar:
   - Left: Queue index (`Dish X of Y`), Dish title heading (truncate on narrow screens with title tooltip), Fit Score badge container (`#wiz-step2-fit-badge-container`), and dual-profile micro-summary (`#wiz-step2-macro-pill`).
   - Right: Compact yield input (`Yield: [ 4 ] serv`).
4. Update `RecipeWizardStep2Handlers.js` `updateLiveStep2NutritionDOM` to update `#wiz-step2-macro-pill` and `#wiz-step2-fit-badge-container` on input change.  
**Test scenarios:**
- *Scenario 2.1:* Header renders as a single flex toolbar with Dish count, Title, Fit badge, and Servings input.
- *Scenario 2.2:* Changing servings input triggers `updateLiveStep2NutritionDOM` and recalibrates macros dynamically.  
**Verification:** Standalone DOM test checks header markup height and presence of `#wiz-servings-input`.

### U3. Dense Two-Tier Ingredient Table Layout
**Goal:** Eliminate the dedicated "Raw" column and render raw string as subtext under the parsed ingredient name.  
**Requirements:** R5.  
**Dependencies:** U1.  
**Files:** `src/components/recipe/RecipeWizardStep2View.js`.  
**Approach:**
1. Update table header and row markup in `RecipeWizardStep2View.js`:
   - Combine Qty and Unit into an adjacent flex column.
   - Place `Raw: "${escapeHtml(rawDisplay)}"` as a 10.5px italicized subtext under the parsed name input.
   - Allocate table width: Qty+Unit (~110px), Name+Raw subtext (25%), Taxonomy Picker (Remaining ~50%), Delete (36px).
   - Add class `wiz-row-unlinked` to `<tr>` if the ingredient is unlinked, with a subtle left accent border (`border-left: 3px solid #f43f5e;`).
   - Reduce cell padding to `padding: 4px 6px;`.  
**Test scenarios:**
- *Scenario 3.1:* Ingredient row table contains no separate raw column; raw text is rendered as `.wiz-raw-subtext` under the name input.
- *Scenario 3.2:* Unlinked ingredient row has `wiz-row-unlinked` class and contains target anchor id.  
**Verification:** Standalone test confirms table structure and `.wiz-raw-subtext` presence.

### U4. Compact Auto-Fitting Method Steps
**Goal:** Shrink method step textareas to single-line 32px height with dynamic auto-expansion on focus and typing.  
**Requirements:** R4.  
**Dependencies:** U1.  
**Files:** `src/components/recipe/RecipeWizardStep2View.js`, `src/components/recipe/RecipeWizardStep2Handlers.js`.  
**Approach:**
1. In `RecipeWizardStep2View.js`, render `.wiz-step-input` textareas with `rows="1"` and inline style `min-height: 32px; height: 32px; padding: 5px 8px; font-size: 12.5px; line-height: 1.35; resize: vertical; overflow-y: hidden;`.
2. In `RecipeWizardStep2Handlers.js`, attach delegated `focusin`, `input`, and `focusout` event listeners:
   - On `focusin` or `input`: `e.target.style.height = 'auto'; e.target.style.height = Math.max(32, e.target.scrollHeight) + 'px';`
   - On `focusout`: if text is short (1 line), collapse back to `32px`.  
**Test scenarios:**
- *Scenario 4.1:* Step input textareas render with `rows="1"` and compact height style.
- *Scenario 4.2:* Typing multi-line text triggers height auto-expansion.  
**Verification:** Standalone test inspects textarea attributes and simulated height calculation.

### U5. Interactive Footer Gating & Smooth Scroll
**Goal:** Wire the sticky footer's gating pill to auto-scroll to the first unmapped ingredient on click, and maintain live button enabling/disabling.  
**Requirements:** R1, R2.  
**Dependencies:** U1, U3.  
**Files:** `src/components/recipe/RecipeWizardStep2Handlers.js`.  
**Approach:**
1. In `RecipeWizardStep2Handlers.js`, update `updateStep2NextButtonState()`:
   - Query all unmapped rows via `isIngredientUnlinked`.
   - Update `#wiz-gate-pill` text: `⚠️ ${count} unmapped item(s)` when blocked, `✓ All items linked` when clear.
   - Toggle disabled attribute and opacity on `#btn-next-step2`.
2. Attach click listener to `#wiz-gate-pill`:
   - Find first `.wiz-row-unlinked` or unlinked taxonomy input.
   - Call `row.scrollIntoView({ behavior: 'smooth', block: 'center' })`.
   - Focus the inner autocomplete search input with a brief highlight pulse.  
**Test scenarios:**
- *Scenario 5.1:* Unlinked ingredients keep `#btn-next-step2` disabled and pill showing warning.
- *Scenario 5.2:* Clicking `#wiz-gate-pill` identifies first unmapped row and targets it for focus.  
**Verification:** Verified via standalone test and simulated click event.

### U6. Standalone Regression Test Suite
**Goal:** Create `scripts/test_recipe_wizard_ui_space_efficiency.js` covering all new markup, sticky footer, compact sizing, and gating behaviors.  
**Requirements:** R1, R2, R3, R4, R5, R6.  
**Dependencies:** U1, U2, U3, U4, U5.  
**Files:** `scripts/test_recipe_wizard_ui_space_efficiency.js`.  
**Approach:**
1. Construct tests verifying:
   - Footer rendering and sticky structure.
   - Consolidated single-row header bar with yield input.
   - Dense two-tier ingredient table without standalone raw column.
   - Compact step textarea markup.
   - Gating pill state transitions between unmapped and all-linked.
2. Run alongside existing test suite: `node scripts/test_recipe_wizard_and_auth.js` and `node scripts/test_vault_enhanced_fit_and_wizard_gate.js`.  
**Test scenarios:**
- *Scenario 6.1:* All assertions in `scripts/test_recipe_wizard_ui_space_efficiency.js` exit code 0.
- *Scenario 6.2:* No regressions in existing test scripts.  
**Verification:** Clean run of all test scripts in terminal.

---

## Verification Contract

Run the following test commands:
```bash
node scripts/test_recipe_wizard_ui_space_efficiency.js
node scripts/test_vault_enhanced_fit_and_wizard_gate.js
node scripts/test_recipe_wizard_and_auth.js
node scripts/test_recipe_wizard_enhanced_macros.js
```

---

## Definition of Done

1. Step 2 loads with the consolidated header (~46px) instead of 3 stacked cards.
2. The sticky footer is fixed at the base of the modal with Back, live gating pill, and Next buttons.
3. Unmapped items are clearly visible in the gating pill, and tapping the pill scrolls directly to the problem row.
4. Next button is strictly gated until all ingredients are linked.
5. Method step inputs default to compact single-line height (32px).
6. Ingredient rows use dense 2-tier layout with raw text as subtext under the parsed name.
7. All automated test suites pass with exit code 0.
