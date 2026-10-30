---
date: "2026-10-30"
problem_type: "ui_bug"
component: "javascript_logic"
severity: "medium"
symptoms:
  - "Long views (Recipe Vault, Pantry Bank, Product Bank) require manual scrolling back to top"
  - "Scroll listener on window alone can miss scroll events inside nested scrollable containers"
  - "Protein macro icon inconsistent across TodayView (🥩), MacroTrendChart (🍗), and ingredient sanitizer regex (unitConverter.js)"
root_cause: "edge_case_unhandled"
tags:
  - scroll-to-top
  - floating-button
  - action-bridge
  - mobile-bottom-bar
  - emoji-standardization
  - unit-converter
related_issues: []
related_solutions:
  - "es-module-connection-reset-and-build-cache-20261030.md"
related_exploration: "scroll-to-top-and-protein-emoji-20261030.md"
last_referenced: "2026-10-30"
---

# Floating Scroll-to-Top Shell Control & Protein Emoji Standardization (`💪`)

## Problem Statement

**What happened:**
1. Long views in PlatePlan (Recipe Vault with 100+ cards, Pantry Bank, Product Bank) had no quick way to return to the top search/filter controls.
2. The protein macro icon used `🥩` in `src/views/TodayView.js` and `🍗` in `src/components/analytics/MacroTrendChart.js`, while `src/utils/unitConverter.js` stripped `🥩` and `🍗` prefixes when pasting recipe ingredient lines.

**Impact:**
Users on mobile and desktop had to manually scroll through long lists to reach search/filter bars, and protein macro iconography was inconsistent across views.

## Symptoms

The following symptoms were observed:

1. **Floating Button Positioning & Scroll Detection Across Containers**
   - On mobile (`@media (max-width: 839px)`), the bottom navigation bar (`#mobile-bottom-bar`) occupies the bottom ~64px of the viewport (`z-index: 950`), so any floating button placed at `bottom: 24px` would collide with the **Shop** / **Pantry** tabs.
   - Scroll events on nested elements do not bubble to `window` unless captured (`{ capture: true, passive: true }`).

2. **Emoji Replacement Side Effects in `unitConverter.js`**
   - Replacing `🥩` blindly across the codebase would have broken `cleanIngredientLinePrefix` in `src/utils/unitConverter.js` when users paste legacy recipe text prefixed with `🥩` or `🍗`.

## Investigation Steps

### What Was Tried

| Attempt | Hypothesis | Result |
|---------|------------|--------|
| 1. Blind global find-and-replace of `🥩` → `💪` | Quickest way to update emoji | ❌ Rejected during `/explore`: would break `src/utils/unitConverter.js` ingredient-line prefix stripping for `🥩` and miss `🍗` in `MacroTrendChart.js` |
| 2. Attach `window.addEventListener('scroll', ..., { passive: true })` and rely solely on external `responsive.css` | Standard window scroll listener + stylesheet | ❌ Could miss scroll events inside nested scrollable containers and failed to style if browser cached `responsive.css` |
| 3. Capture-phase scroll listener (`{ capture: true, passive: true }`) + `requestAnimationFrame` + self-contained fallback `<style>` + `ActionBridge` (`data-action="scroll-to-top"`) | Detects both window and container scroll events at 60fps and guarantees styling even under cached CSS | ✅ Smooth fade-in after `220px`, respects `prefers-reduced-motion`, clears mobile bottom bar (`calc(78px + env(safe-area-inset-bottom))`), and passes all 36 Code Ledger checks |

### Key Discoveries

- **Discovery 1 (`unitConverter.js` Backward Compatibility):** `src/utils/unitConverter.js` lines 57 and 70 use regexes to strip decorative emojis from pasted recipe lines. Keeping `🍗|🥩` and adding `|💪` preserves backward compatibility while supporting the new `💪` icon.
- **Discovery 2 (Capture-Phase Scroll Detection):** Because `scroll` events do not bubble in the DOM, attaching `window.addEventListener('scroll', onScroll, { capture: true, passive: true })` allows a single listener to detect scrolling on both `window`/`document.scrollingElement` and any nested scrollable container (`event.target.scrollTop`).

## Root Cause Analysis

**The actual problem:**
1. PlatePlan had no global shell utility for returning to the top of long views, and mobile layouts require clearing the fixed `#mobile-bottom-bar`.
2. Emoji literals in UI templates (`TodayView.js`, `MacroTrendChart.js`) vs parser regexes (`unitConverter.js`) serve different purposes (display vs input sanitization) and must be updated selectively.

## Lessons Learned

### Mistakes Made

- **Assumption:** `window.scrollY` is always the only scroll offset in the app.
  - **Why it was wrong:** Depending on viewport/container rules or modal/view wrappers, a nested element can also hold `scrollTop > 0`.
  - **Correction:** Track both `getWindowScrollTop()` and `activeScrollContainer` via a capture-phase scroll listener, and reset both in `scrollToTop()`.

### Key Breakthroughs

- **Insight:** Injecting a small idempotent `<style id="plateplan-scroll-top-styles">` inside `ScrollToTopButton.js` alongside the rules in `styles/responsive.css` guarantees the button is never rendered unstyled if a browser caches an older CSS bundle.

## Working Solution

### The Fix

```javascript
// File: src/components/shell/ScrollToTopButton.js
// Capture-phase passive scroll listener with requestAnimationFrame throttling
export function initScrollToTopButton() {
  if (initialized || typeof document === 'undefined' || typeof window === 'undefined') return;
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => initScrollToTopButton(), { once: true });
    return;
  }
  initialized = true;
  ensureScrollToTopStyles();
  ensureButtonElement();
  updateVisibility();
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
}
```

```javascript
// File: src/services/ActionBridge.js (lines 194-197)
if (normalizedAction === 'scroll-to-top') {
  scrollToTop();
  return true;
}
```

```javascript
// File: src/utils/unitConverter.js (lines 57 & 70)
// Keep 🍗|🥩 and add 💪 so both legacy and new emoji prefixes are stripped cleanly
s = s.replace(/^(?:[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|🟢|🟡|🔴|⚪|🛒|🧴|🫙|🥫|❄️|🧊|🥖|🧀|🍗|🥩|💪|🥬|🥕|🍎|🧅|🧄|🥔|🍋|🌿|🌾|🍚|🍝|🫘|🥜|🍞|🥛|🥚|🧈|🍯|🧂|🫒|🍷|🍫|🧁|🍪|🥄|🍴|🍽️|🥣|🥗|🍲|🥘|🍳|🔪|\*|-|\+|\d+\.|\d+\))\s*/i, '');
```

### Verification

```bash
/usr/local/bin/node scripts/ledger.js && /usr/local/bin/node scripts/test_ledger.js
```

## Prevention Strategies

### Immediate Prevention

- [x] Always run `grep` across both `src/` and backup data before replacing emojis or symbols to distinguish **display templates** from **input parser regexes**.
- [x] Position any floating bottom-right control at `bottom: calc(78px + env(safe-area-inset-bottom))` inside `@media (max-width: 839px)` so it never overlaps `#mobile-bottom-bar`.
- [x] Add floating shell controls to `styles/print.css` (`display: none !important`) so they never appear on printed meal plans or shopping lists.

### Long-term Prevention

- **Pattern to follow:** Route all shell button clicks through `data-action="..."` in `src/services/ActionBridge.js` and keep module size well under the 400-line ceiling (`ScrollToTopButton.js` is 143 lines).

## Cross-References

### Related Solutions

- [es-module-connection-reset-and-build-cache-20261030.md](../runtime-errors/es-module-connection-reset-and-build-cache-20261030.md)
- Exploration: [scroll-to-top-and-protein-emoji-20261030.md](../../explorations/scroll-to-top-and-protein-emoji-20261030.md)
- Plan: [2026-10-30-scroll-to-top-and-protein-emoji.md](../../../plans/2026-10-30-scroll-to-top-and-protein-emoji.md)

---

*Documented: 2026-10-30*
*Time to resolve: 35 minutes*
