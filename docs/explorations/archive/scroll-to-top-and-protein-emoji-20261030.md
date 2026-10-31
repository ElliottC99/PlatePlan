---
date: "2026-10-30"
exploration_type: investigation
component: "UI Shell & Macro Badges (TodayView, MacroTrendChart, ScrollToTop)"
status: concluded
time_box: "30m"
outcome: proceed_to_plan
tags: [ui, ux, scroll-to-top, accessibility, emoji, macros, vegetarian]
---

# Scroll-to-Top Floating Control & Protein Emoji Standardization (`🥩` → `💪`)

## Question
1. What is the cleanest, most performant way to introduce a floating "Scroll to Top" button on long pages (such as Recipe Vault, Pantry Bank, and Product Bank) in PlatePlan's vanilla ES6 + `ActionBridge` architecture without overlapping mobile bottom navigation or hurting scroll performance?
2. Where does the `🥩` (steak) emoji appear for protein across the codebase, and what 2nd-order effects must we guard against when updating it to `💪`?

## Scope
- **Time-box:** 30 minutes
- **Success Criteria:**
  - Identify every occurrence of `🥩` (and any other meat-based protein icons like `🍗`) across `src/` and `index.html`.
  - Determine how PlatePlan scrolls (`window` vs inner containers) and how mobile vs desktop viewports position fixed bottom elements.
  - Design a zero-dependency, accessible (`aria-label`, `prefers-reduced-motion`) Scroll-to-Top component wired through `data-action="scroll-to-top"` in `src/services/ActionBridge.js`.
- **Out of Scope:**
  - Virtual scrolling or pagination of the Pantry/Product lists.
  - Modifying inner modal scrollbars.

## Best Practices Research

### Industry Standards
1. **Scroll-to-Top Button UX & Performance (NN/g & MDN):**
   - **Threshold:** Show the button only after the user has scrolled down ~400px–500px (roughly 1–1.5 viewport heights) so it never clutters short views (like Settings or a short Today view).
   - **Passive Scroll Listener + `requestAnimationFrame` throttling:** Attach `{ passive: true }` to the `window` `scroll` event so the browser's compositor thread never blocks while scrolling on mobile.
   - **Accessibility:** Must be a `<button type="button" aria-label="Scroll to top">` with a minimum `44x44px` touch target, keyboard focusable (`tabindex` managed or hidden when invisible via `pointer-events: none; visibility: hidden`), and respect `prefers-reduced-motion: reduce` (using `'instant'` instead of `'smooth'` if reduced motion is enabled).
   - **Safe-Area & Mobile Nav Clearance:** On mobile (`<= 640px`), `.mobile-nav` sits fixed at `bottom: 0` with `z-index: 120` and ~62px height + `env(safe-area-inset-bottom)`. The floating button must sit at `bottom: calc(78px + env(safe-area-inset-bottom))` on mobile and `bottom: 24px` on desktop (`right: 20px`, `z-index: 115` so it floats above cards but below open modals).
2. **Emoji Standardization in Domain Apps:**
   - PlatePlan is a high-protein vegetarian household planner (`plateplan-architecture.md`). Using `💪` aligns the visual language with vegetarian nutrition while avoiding meat imagery (`🥩`, `🍗`).
   - **Regex Parser Separation:** Text-cleaning regexes (such as `src/utils/unitConverter.js`) that strip emojis from external recipe pastes must *retain* `🥩` and `🍗` in their strip list (and add `💪`) so imported recipes continue to have decorative emojis stripped cleanly.

## Multi-Order Analysis (Think Hard)

### Direct Effects (1st Order)
- **Protein Emoji:** TodayView meal cards (`src/views/TodayView.js:170`) display `💪 {X}g P` instead of `🥩 {X}g P`. (Optional sibling cleanup: `src/components/analytics/MacroTrendChart.js:114` also uses `🍗 {prot}g Protein` and can be unified to `💪`).
- **Scroll-to-Top:** When scrolling down long views (`RecipeVaultView` with 147 recipes, `PantryBankView` with 291 ingredients, `ProductBankView` with 402 products), a floating `↑` button smoothly fades in at the bottom-right corner and scrolls the viewport back to `top: 0` when clicked.

### Ripple Effects (2nd-4th Order)
- **2nd Order (Parser & Event Delegation):**
  - If someone ran a naive global search-and-replace of `🥩` → `💪`, `src/utils/unitConverter.js` (lines 57 and 70) would lose `🥩` from its ingredient-line cleanup regex. Instead, we must keep `🥩` in `unitConverter.js` and add `💪` to the character class.
  - Because PlatePlan enforces strict `data-action` delegation (`plateplan-architecture.md` Rule #3), the Scroll-to-Top button must use `data-action="scroll-to-top"` handled in `src/services/ActionBridge.js` rather than an inline `onclick`.
- **3rd Order (View Switching & Print Styles):**
  - `src/core/AppRouter.js:93` already runs `window.scrollTo({ top: 0, behavior: 'instant' })` when switching views, which naturally fires the scroll listener and hides the button on the new view.
  - `styles/print.css` hides navigation chrome when printing a meal plan or shopping list; `.scroll-top-btn` should also be hidden in `@media print`.
- **4th Order (Pattern Standardization):**
  - Establishes how global shell micro-controls are mounted (`src/components/shell/ScrollToTopButton.js` + `ActionBridge.js`) without bloating `index.html` or view files.

### Stakeholder Impact Matrix
| Stakeholder | Potential Impact | Severity |
|-------------|-----------------|----------|
| End Users (Elliott & Chloe) | Faster navigation on 290+ item Pantry/Product views; consistent `💪` protein iconography on Today view. | Positive (High UX value) |
| Developers | Clean modular component under 80 lines; zero new dependencies. | Low |
| Ops/Support | None (client-side UI only, zero Firestore impact). | None |
| Downstream Systems | `unitConverter.js` regex preserved so recipe imports remain unaffected. | None |

## Findings

### Key Learnings
1. **Exhaustive `🥩` (and Meat Emoji) Scan Across Repository & Database:**
   - Scanned all project files (`index.html`, `src/`, `styles/`, `scripts/`) for literal emojis (`🥩`, `🍗`, `🍖`, `🥓`), Unicode escape sequences (`1F969`, `DD69`), and HTML entities (`&#129385;`), as well as all 858 documents in `households_elliott-chloe_backup.json`.
   - **Firestore Database (`households_elliott-chloe_backup.json`):** `0` occurrences of `🥩`, `🍗`, `🍖`, or `🥓`.
   - **UI Display Occurrences (2 total across the entire app):**
     - `src/views/TodayView.js:170` — `<span>🥩 ${Math.round(recipe.nutrition?.perServing?.prot ?? recipe.macros?.protein ?? 0)}g P</span>` (Only UI occurrence of `🥩`).
     - `src/components/analytics/MacroTrendChart.js:114` — `<div style="color:var(--blue)">🍗 ${prot}g Protein</div>` (Only UI occurrence of `🍗`).
   - **Text-Sanitizer Regex Occurrences (2 lines in 1 utility file):**
     - `src/utils/unitConverter.js:57` & `src/utils/unitConverter.js:70` — Used to strip decorative leading emojis from copy-pasted recipe ingredient lines. Must **keep** `🥩` and `🍗` in the strip regex and **add** `💪` so pasted lines starting with `💪` are also cleaned.
2. **Scroll Architecture in PlatePlan (Deferred / On Hold per User Decision):**
   - The primary page scroll container is `window` (confirmed in `src/core/AppRouter.js:93` and `src/components/data-quality/DataQualityDrawer.js:108`, both calling `window.scrollTo(...)`).
   - Mobile bottom navigation (`.mobile-nav` in `styles/responsive.css:151,707`) is `position: fixed; bottom: 0; z-index: 120` on screens `<= 640px`. (Scroll-to-top implementation is currently on hold; knowledge preserved here for when we revisit it.)

## Long-Term Implications
- **6 months / 1 year:** Zero maintenance overhead; uses native `window.scrollTo` and CSS transitions.
- **Reversibility:** Type 2 (easily reversible two-way door — isolated CSS + small shell component + 1-line emoji change).
- **Tech Debt Impact:** Reduces UI inconsistency by aligning `TodayView.js` (and optionally `MacroTrendChart.js`) with the rest of the app's `💪` protein icon.

## Decision

**Recommendation:** Proceed to `/plan`

**Rationale:** Scope is crystal-clear, edge cases (regex preservation in `unitConverter.js` and mobile nav clearance) are identified, and all changes fit cleanly within PlatePlan's modular architecture.

## Next Steps
- [x] Run `/plan` to generate the step-by-step implementation plan in `plans/`.

## References
- `src/views/TodayView.js`
- `src/utils/unitConverter.js`
- `src/components/analytics/MacroTrendChart.js`
- `src/core/AppRouter.js`
- `src/services/ActionBridge.js`
- `styles/responsive.css`
