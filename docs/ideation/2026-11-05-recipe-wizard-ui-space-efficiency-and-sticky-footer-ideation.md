---
date: "2026-11-05"
topic: "recipe-wizard-ui-space-efficiency-and-sticky-footer"
focus: "Make Recipe Wizard UI more space-efficient, lock bottom options/action/navigation into a sticky footer, and resize step text boxes"
mode: "repo-grounded"
---

# Recipe Wizard UI Space-Efficiency, Sticky Action Footer & Compact Step Sizing

## Grounding Context

* **Active Files:** `src/components/recipe/RecipeWizardModal.js`, `src/components/recipe/RecipeWizardStep2View.js`, `src/components/recipe/RecipeWizardStep2Handlers.js`, `src/components/recipe/RecipeWizardStep1View.js`.
* **Current Structure:** 
  * Modal shell uses `.ios-fullscreen-modal` with top nav `.ios-fullscreen-nav` (`Cancel`, `Recipe Wizard`, `Done`) and `.ios-fullscreen-body` containing the entire scrolling view.
  * In Step 2 (`RecipeWizardStep2View.js`), three separate tall banners precede the ingredient list:
    1. Dish Title Banner (`Dish 1 of 67`, Title, Fit Score Badge) ~50px.
    2. Dual-Profile Macro Crossbar (`Dual-Profile Per-Portion Split`, Elliott kcal/prot, Chloe kcal/prot) ~65px.
    3. Servings/Yield Banner (`Recipe Mapping Canonical Author Quantities`, `Yield: [4] servings`) ~60px.
    *Total top header consumption: ~230–260px before the first ingredient is visible.*
  * Ingredient table displays 6 columns, with Column 1 dedicated to `Raw: "..."` string, consuming 35% of width and inflating row height.
  * Method steps at the bottom use multiline `rows="2"` textareas for every step, adding ~70px per step (e.g. 10 steps = 700px+ of scroll).
  * Navigation controls (`← Back`, `⚠️ Action Required: X ingredients unlinked...`, `Next: Final Inline Review →`) are rendered at the bottom of the scrollable content. Users must scroll past 20+ ingredients and 10 steps just to see the warning notice or click Next.

---

## Topic Axes

1. **Persistent Action Footer & Live Gating:** Keeping navigation buttons and mapping status permanently anchored and visible.
2. **Header & Metadata Consolidation:** Collapsing redundant stacked banners into a compact, unified toolbar.
3. **Step Instruction Ergonomics & Height:** Resizing method step inputs to prevent vertical explosion on multi-step recipes.
4. **Ingredient Grid Density:** Eliminating wasted horizontal and vertical space in ingredient mapping rows.

---

## Ranked Ideas

### 1. Locked Bottom Action Footer with Live Gating Pill (Rank 1)
* **Axis:** Persistent Action Footer & Live Gating
* **Basis:** `direct:src/components/recipe/RecipeWizardModal.js:332-348`, `direct:src/components/recipe/RecipeWizardStep2View.js:203-222`
* **Description:**  
  Extract the bottom navigation buttons (`← Back`, `Next: Final Inline Review →`) and the gating warning banner from the scrollable `ios-fullscreen-body` into a fixed, glassmorphic bottom footer `.ios-fullscreen-footer` docked at the bottom of `.ios-fullscreen-modal`.  
  Inside the footer:
  * Left: `← Back` button.
  * Center: Live Action Status pill — when items are unlinked, displays `⚠️ 2 unmapped items`; when all linked, transitions to `✓ All items linked`. Clicking the warning pill can auto-scroll the view directly to the first unmapped ingredient.
  * Right: `Next →` button, styled with standard Apple HIG primary styling, disabled while unmapped items exist.
* **Rationale:**  
  Eliminates the primary friction point where users on long recipes (e.g. 20+ ingredients) must scroll to the very bottom to see why "Next" is blocked or to advance to Step 3.
* **Tradeoffs & Downsides:** Requires adjusting `.ios-fullscreen-body` padding-bottom so the bottom-most ingredient isn't obscured behind the fixed footer.
* **Confidence:** 95%
* **Complexity:** Low

```
+--------------------------------------------------------------------------+
|  Cancel                     Recipe Wizard Step 2                   Done  | [Top Nav]
+--------------------------------------------------------------------------+
|  [Dish 1/67] Boeuf Bourguignon [37% Poor Match] | Yield: [ 4 ] | Macros  | [Consolidated Bar]
+--------------------------------------------------------------------------+
|                                                                          |
|  [ Scrollable Ingredient Rows & Compact Method Steps ]                   | [Scroll Area]
|                                                                          |
+--------------------------------------------------------------------------+
| [ ← Back ]          [ ⚠️ 1 item unmapped ]          [ Next Review → ]   | [Sticky Footer]
+--------------------------------------------------------------------------+
```

---

### 2. Consolidated Single-Row Dish & Macro Header Bar (Rank 2)
* **Axis:** Header & Metadata Consolidation
* **Basis:** `direct:src/components/recipe/RecipeWizardStep2View.js:154-184`
* **Description:**  
  Merge the 3 separate stacked banners (Dish Title banner, Dual-profile split card, and Yield banner) into a single compact, high-density toolbar:
  * Top/Left: Dish index badge (`1 of 67`), Title input/heading, and Fit Score badge inline.
  * Right: Compact Yield selector (`Yield: [ 4 ] serv`) and Dual-Profile micro-pills (`E: 748kcal 22g | C: 518kcal 15g`).
* **Rationale:**  
  Recovers over **180px of vertical viewport height** instantly. On desktop and laptop screens, the first 6–8 ingredients immediately become visible without needing to scroll down.
* **Tradeoffs & Downsides:** Requires responsive flex-wrapping on narrow mobile screens so pills drop to a second compact row if needed.
* **Confidence:** 90%
* **Complexity:** Low

---

### 3. Compact Auto-Fitting Method Step Textareas (Rank 3)
* **Axis:** Step Instruction Ergonomics & Height
* **Basis:** `direct:src/components/recipe/RecipeWizardStep2View.js:137`
* **Description:**  
  Replace the heavy `rows="2"` multiline textareas with compact single-line height textareas (`min-height: 32px`, `height: 32px`, padding: `4px 8px`, font-size: `12.5px`).  
  When clicked or focused, the textarea expands naturally to fit full paragraph content via `scrollHeight`, and shrinks back when blurred if no edits were made. Alternatively, set natural CSS auto-sizing (`field-sizing: content` with fallback).
* **Rationale:**  
  Recipes with 10–15 steps currently consume 700–1,000px of scrolling space just for text boxes. Compacting them reduces their footprint by 60%, keeping the wizard fast and scannable.
* **Tradeoffs & Downsides:** Long multi-sentence steps will truncate or scroll horizontally when not focused unless hovered/focused.
* **Confidence:** 92%
* **Complexity:** Low

---

### 4. Dense Two-Tier Ingredient Rows with Sub-Text Raw Strings (Rank 4)
* **Axis:** Ingredient Grid Density
* **Basis:** `direct:src/components/recipe/RecipeWizardStep2View.js:81-105`
* **Description:**  
  Re-architect the 6-column ingredient table into a 5-column layout:
  * Remove the dedicated "Raw" column that wastes 30–40% horizontal width.
  * Place `Raw: "..."` as a subtle, muted 10px subtext directly underneath the parsed Ingredient Name input in Column 3.
  * Group `Qty` (50px) + `Unit` (55px) into a combined segmented group.
  * Provide generous width for the Autocomplete search picker (`min-width: 260px`).
* **Rationale:**  
  Gives the autocomplete search picker ample breathing room while making each row more compact vertically and horizontally.
* **Tradeoffs & Downsides:** Subtext increases individual row height slightly by ~12px if raw text is long, though net table width and layout stability improve significantly.
* **Confidence:** 88%
* **Complexity:** Medium

---

### 5. Slim Collapsible Section Cards with Ingredient Counts (Rank 5)
* **Axis:** Table Space Efficiency
* **Basis:** `direct:src/components/recipe/RecipeWizardStep2View.js:109-124`
* **Description:**  
  For recipes with multiple sections ("For the boeuf bourguignon", "For the mashed potato"):
  * Style the section header as a slim bar with a subtle border and section title input.
  * Display a badge showing the ingredient count in that section (e.g. `[16 ingredients]`).
  * Include a small toggle to collapse completed sections when working on multi-course dishes.
* **Rationale:**  
  Helps users navigate complex recipes with multiple subsections without feeling overwhelmed by an endless vertical list.
* **Tradeoffs & Downsides:** Collapsing sections could hide unlinked items unless the section badge reflects unmapped warnings (e.g. `⚠️ 1 unmapped`).
* **Confidence:** 80%
* **Complexity:** Medium

---

## Rejection Summary

* **Accordion Wizard (One Step per View):** Rejected as too modal and click-heavy; users prefer seeing all recipe ingredients together during mapping.
* **Drawer / Slide-out Mapping Sheet:** Rejected because the wizard modal is already full-screen and introducing a secondary nested drawer adds modal stack complexity.
* **Floating Header Tooltips for Raw Text:** Rejected because tooltips require hover, which does not translate well to mobile touch screens. Subtext in row is cleaner.
