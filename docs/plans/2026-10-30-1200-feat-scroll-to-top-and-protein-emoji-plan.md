---
title: Scroll-to-Top Floating Button & Protein Emoji Standardization - Plan
type: feat
date: 2026-10-30
topic: scroll-to-top-and-protein-emoji
---

# Scroll-to-Top Floating Button & Protein Emoji Standardization (`🥩` / `🍗` → `💪`)

## Summary
Standardize all user-facing protein macro badges across PlatePlan to use the `💪` emoji (replacing the remaining `🥩` in `TodayView.js` and `🍗` in `MacroTrendChart.js`, while preserving `🥩`/`🍗` and adding `💪` in `unitConverter.js`'s ingredient-paste sanitizer), and introduce an accessible, zero-dependency floating "Scroll to Top" button (`src/components/shell/ScrollToTopButton.js`) that appears when scrolling down long views (`> 400px`) and routes its click action through `src/services/ActionBridge.js` via `data-action="scroll-to-top"`.

## Prior Solutions & Pattern Check
- **Prior Solutions Searched:** `docs/solutions/` (Pattern #18 Mobile Responsiveness, Pattern #2 Single Source of Truth for UI Components, Pattern #17 Sibling Parity).
- **Exploration Artifact:** [scroll-to-top-and-protein-emoji-20261030.md](../docs/explorations/scroll-to-top-and-protein-emoji-20261030.md).
- **Governance Rules Applied (`workflow-enforcer.md` & `plateplan-architecture.md`):**
  - Strict `data-action` event delegation via `src/services/ActionBridge.js` (no inline `onclick=`).
  - Every modified/created file strictly under the 400-line ceiling.
  - Zero empty `catch (e) {}` blocks.

## Problem Statement
1. **Protein Iconography Drift:** PlatePlan is a high-protein vegetarian household planner. While almost all views (`PlannerSwapModalRenderService.js`, `RecipeWizardStep3View.js`, `GeneratorCandidateDrawer.js`, `RecipeDetailModalService.js`) use `💪` for protein, `TodayView.js` (line 170) still displays `🥩` and `MacroTrendChart.js` (line 114) displays `🍗`.
2. **Long-Page Navigation Friction:** Views such as **Recipe Vault** (147 recipes), **Pantry Bank** (291 ingredients), and **Product Bank** (402 products) produce very tall pages. Scrolling manually back to the top search/filter toolbar—especially on mobile—is tedious.

## Research Findings

### Codebase Patterns
- **Shell Component Pattern:** `src/components/shell/OfflineBanner.js:1-53` mounts a self-contained floating shell element at `bottom: 20px; left: 20px` and is imported in `src/main.js:42`.
- **Action Delegation:** `src/services/ActionBridge.js:23-192` routes all `[data-action]` clicks across the application.
- **Scroll Container:** `src/core/AppRouter.js:93` uses `window.scrollTo({ top: 0, behavior: 'instant' })`, confirming `window` is the canonical scroll container for all main views.
- **Mobile Navigation Clearance:** `styles/responsive.css:151,707` positions `.mobile-nav` at `position: fixed; bottom: 0; z-index: 120` on viewports `<= 640px`.
- **Print Styles:** `styles/print.css:4` hides shell chrome (`header, nav, .mobile-nav, .desktop-sidebar, .plateplan-toast-region`) when printing.

## Proposed Solution

### Part 1: Protein Emoji Standardization (`🥩` / `🍗` → `💪`)
1. **`src/views/TodayView.js` (line 170):**
   Replace `🥩` with `💪`:
   ```javascript
   <span>💪 ${Math.round(recipe.nutrition?.perServing?.prot ?? recipe.macros?.protein ?? 0)}g P</span>
   ```
2. **`src/components/analytics/MacroTrendChart.js` (line 114):**
   Replace `🍗` with `💪`:
   ```javascript
   <div style="color:var(--blue)">💪 ${prot}g Protein</div>
   ```
3. **`src/utils/unitConverter.js` (lines 57 & 70):**
   Keep `🍗|🥩` in both emoji-stripping regexes and add `|💪` right after `🥩` so pasted recipe lines starting with `💪` are also sanitized cleanly.

### Part 2: Floating "Scroll to Top" Button
1. **Create `src/components/shell/ScrollToTopButton.js` (~65 lines):**
   - Renders `<button type="button" id="plateplan-scroll-top-btn" class="scroll-top-btn" data-action="scroll-to-top" aria-label="Scroll to top" title="Scroll to top">↑</button>`.
   - Listens to `window` `scroll` with `{ passive: true }` and `requestAnimationFrame` throttling, toggling `.visible` when `window.scrollY > 400`.
   - Exports `scrollToTop()` which checks `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and calls `window.scrollTo({ top: 0, behavior: prefersReduced ? 'instant' : 'smooth' })`.
2. **Wire Action in `src/services/ActionBridge.js`:**
   - Import `scrollToTop` from `../components/shell/ScrollToTopButton.js`.
   - Handle `normalizedAction === 'scroll-to-top'` in `routeAction()`.
3. **Mount in `src/main.js` & Register in `sw.js`:**
   - Import `./components/shell/ScrollToTopButton.js` in `src/main.js` right next to `./components/shell/OfflineBanner.js`.
4. **Style in `styles/responsive.css` & `styles/print.css`:**
   - Add `.scroll-top-btn` styles in `styles/responsive.css`:
     - Desktop: `position: fixed; right: 20px; bottom: 24px; z-index: 115; width: 44px; height: 44px; border-radius: 999px; opacity: 0; pointer-events: none; transform: translateY(10px); transition: opacity 0.2s ease, transform 0.2s ease;`
     - `.scroll-top-btn.visible`: `opacity: 1; pointer-events: auto; transform: translateY(0);`
     - Mobile (`@media (max-width: 640px)`): `bottom: calc(78px + env(safe-area-inset-bottom)); right: 14px;` (clears `.mobile-nav`).
   - Add `.scroll-top-btn` to `@media print` in `styles/print.css` so it never appears on printed meal plans or shopping lists.

## Acceptance Criteria
- [x] `src/views/TodayView.js` displays `💪` instead of `🥩` for protein on Today meal cards.
- [x] `src/components/analytics/MacroTrendChart.js` displays `💪` instead of `🍗` for protein in chart tooltips.
- [x] `src/utils/unitConverter.js` retains `🥩` and `🍗` and includes `💪` in its ingredient prefix sanitizer regexes (lines 57 and 70).
- [x] `src/components/shell/ScrollToTopButton.js` mounts `#plateplan-scroll-top-btn` with `data-action="scroll-to-top"`, hidden at top of page (`scrollY <= 400`) and visible when `scrollY > 400`.
- [x] Clicking `#plateplan-scroll-top-btn` routes through `src/services/ActionBridge.js` and scrolls the window to `top: 0` smoothly (or instantly if `prefers-reduced-motion` is enabled).
- [x] On mobile screens (`<= 640px`), `#plateplan-scroll-top-btn` sits above `.mobile-nav` without overlapping any navigation buttons.
- [x] Production build (`dist/`) compiles cleanly and updates the local server at `http://localhost:3000`.

## Technical Considerations
- **Dependencies:** Zero external dependencies.
- **Risks & Mitigations:**
  - *Scroll jank:* Mitigated by using `{ passive: true }` and a `requestAnimationFrame` lock (`ticking` flag) so DOM class toggles happen at most once per frame and only when crossing the `400px` threshold.
  - *Modal overlap:* Setting `z-index: 115` keeps the button below open modals (`z-index: 200+`) and mobile bottom navigation (`z-index: 120`).

## Implementation Steps
1. **Task 1 (Protein Emoji Update):** Edit `src/views/TodayView.js`, `src/components/analytics/MacroTrendChart.js`, and `src/utils/unitConverter.js`.
2. **Task 2 (Scroll-to-Top Component & Styling):** Create `src/components/shell/ScrollToTopButton.js` and add responsive/print CSS rules to `styles/responsive.css` and `styles/print.css`.
3. **Task 3 (ActionBridge & Entry Point Wiring):** Register `scroll-to-top` in `src/services/ActionBridge.js` and import `./components/shell/ScrollToTopButton.js` in `src/main.js`.
4. **Task 4 (Build & Verify):** Rebuild `dist/` so the changes are live on `http://localhost:3000`.

## References
- [docs/explorations/scroll-to-top-and-protein-emoji-20261030.md](../docs/explorations/scroll-to-top-and-protein-emoji-20261030.md)
- [workflow-enforcer.md](../workflow-enforcer.md)
- [plateplan-architecture.md](../plateplan-architecture.md)
