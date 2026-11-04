---
title: Competing CSS dark-mode overrides and split theme persistence make text unreadable in Dark Mode
date: "2026-11-04"
category: ui-bugs
module: appearance and theme tokens (styles/tokens.css, styles/responsive.css, SettingsView)
problem_type: ui_bug
component: frontend
severity: high
symptoms:
  - "In Dark Mode, cards on Today and other views render with light sage-green backgrounds (#DBE1DC) while card titles and labels use white text (#FFFFFF), making recipe names unreadable"
  - "Switching Appearance Theme in Preferences toggles html.theme-dark or html.theme-light and writes localStorage key plateplan-appearance, but reloading the page ignores the choice because index.html reads plateplan_appearance and sets html[data-theme]"
  - "Primary buttons (.btn.primary) set background: var(--text) with color: #fff, which turns white-on-white when --text resolves to #FFFFFF in Dark Mode"
  - "Inline JS template strings hardcode light hex backgrounds (#ffffff, #f8fafc, #dcfce7) alongside semantic text tokens or vice versa"
root_cause: config_error
resolution_type: code_fix
related_components:
  - css_styling
  - javascript_logic
tags:
  - dark-mode
  - light-mode
  - apple-hig
  - css-custom-properties
  - theme-persistence
  - fit-score-badges
  - contrast
---

# Competing CSS dark-mode overrides and split theme persistence make text unreadable in Dark Mode

## Problem

In Dark Mode, meal cards and modals across PlatePlan rendered light backgrounds behind white text (`--label: #FFFFFF`), or dark slate text (`#0f172a`) on dark charcoal surfaces (`#1C1C1E`). Toggling the Appearance Theme in Preferences also failed to persist cleanly across reloads because the boot script and the settings handler wrote and read different `localStorage` keys and DOM attributes.

## Symptoms

- On the Today view in Dark Mode, meal cards appeared as light grey-green blocks (`#DBE1DC`) while recipe titles (`color: var(--label)`) rendered in pure white (`#FFFFFF`), making the meal titles nearly invisible.
- Primary buttons (`.btn.primary`, `.cf.active`) used `background: var(--text); color: #fff`, which became white text on a white background whenever `--text` resolved to `#FFFFFF` in Dark Mode.
- Changing Appearance Theme in Preferences (`src/views/SettingsView.js`) applied `.theme-dark` or `.theme-light` classes to `<html>` and saved `localStorage.setItem('plateplan-appearance', theme)` (hyphen), whereas the inline head script in `index.html` read `localStorage.getItem('plateplan_appearance')` (underscore) and set `document.documentElement.dataset.theme`.
- Over 30 JS template renderers mixed hardcoded light surfaces (`background: #fff`, `#f8fafc`, `#f1f5f9`) with semantic text tokens (`var(--text)`), or hardcoded dark slate text (`#0f172a`, `#1e293b`) on `var(--surface)`.

## Root Cause

Three independent layers conflicted when resolving Light and Dark Mode:

1. **Cascade collision between `styles/tokens.css` and `styles/responsive.css`:**
   `index.html` loads `styles/tokens.css` first and `styles/responsive.css` last. `styles/tokens.css` defined Apple HIG dark tokens under `@media (prefers-color-scheme: dark)` (`:root:not([data-theme="light"])`) and `html[data-theme="dark"]`, mapping `--bg: var(--system-grouped-bg)` only at `:root`. Because CSS custom properties resolve var references at the element where they are declared unless re-declared, and because `styles/responsive.css` contained two later `@media (prefers-color-scheme: dark)` and `html[data-theme="dark"]` blocks from an older theme layer, the later stylesheet overwrote `--bg`, `--surface`, `--text`, and `--action` with a different palette (`#111214` / `#0969da`) and left `--card` and `--surface3` out of sync.

2. **Split theme state between `index.html` and `src/views/SettingsView.js`:**
   - `index.html` checked `localStorage.getItem('plateplan_appearance')` and set `document.documentElement.dataset.theme = platePlanAppearance`.
   - `applyTheme` in `src/views/SettingsView.js` wrote `localStorage.getItem('plateplan-appearance')` and `plateplan-theme`, and toggled `.theme-dark` / `.theme-light` classes on `document.documentElement`.
   - `styles/tokens.css` only matched `html[data-theme="dark"]` and `:root:not([data-theme="light"])`, ignoring `.theme-dark` and `.theme-light`. When a user selected Light Theme on an OS running in Dark Mode, `:root:not([data-theme="light"])` could still match if only `.theme-light` was present.

3. **Hardcoded hex colors in JS template literals and Fit Score badges:**
   `getFitScoreTierMeta` in `src/utils/fitScoreWeights.js`, `FIT_SCORE_TIERS` in `src/config/businessRules.js`, and `renderFitScoreBadge` in `src/components/FitScoreBadge.js` returned hardcoded light pastel hex strings (`#dcfce7`, `#fef9c3`, `#ffedd5`, `#fee2e2`). Similarly, modal and view templates across `src/components/` and `src/views/` used inline `style="background:#fff; color:var(--text)"`.

## Solution

1. **Single token owner in `styles/tokens.css`:**
   - Consolidated Light Mode under `:root, html[data-theme="light"], html.theme-light` (`color-scheme: light`) and Dark Mode under both `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]):not(.theme-light) }` and `html[data-theme="dark"], html.theme-dark` (`color-scheme: dark`).
   - Re-bound all legacy aliases (`--bg`, `--surface`, `--surface2`, `--surface3`, `--card`, `--text`, `--text2`, `--text3`, `--border`, `--border-strong`, `--primary`, `--action`, `--danger`) inside every light and dark scope so aliases always resolve against the active theme's Apple HIG system tokens.
   - Added adaptive semantic status badge tokens (`--badge-green-bg/text/border`, `--badge-yellow-*`, `--badge-orange-*`, `--badge-red-*`, `--badge-blue-*`, `--badge-neutral-*`) for both Light and Dark Mode, and wired `src/utils/fitScoreWeights.js`, `src/config/businessRules.js`, and `src/components/FitScoreBadge.js` to use them.
   - Removed the duplicate `:root`, `@media (prefers-color-scheme: dark)`, `html[data-theme="light"]`, and `html[data-theme="dark"]` token blocks from `styles/responsive.css`.
   - Changed `.btn.primary` and `.cf.active` in `index.html` and `styles/components.css` from `background: var(--text)` to `background: var(--tint-color)` with `#ffffff` label text.

2. **Synchronized theme persistence (`index.html` & `src/views/SettingsView.js`):**
   - Updated `applyTheme(theme)` in `src/views/SettingsView.js` to synchronize `document.documentElement.dataset.theme`, `.theme-dark`/`.theme-light` classes, `document.documentElement.style.colorScheme`, and both `plateplan-appearance` and `plateplan_appearance` keys in `localStorage`.
   - Updated the boot script in `index.html` to read `plateplan-appearance || plateplan_appearance || plateplan-theme` and apply both `dataset.theme` and `classList.add('theme-' + platePlanAppearance)` before first paint.

3. **Replaced hardcoded inline hex surfaces and text across JS templates:**
   - Replaced raw `#fff`/`#ffffff`/`#f8fafc`/`#f1f5f9` backgrounds and `#0f172a`/`#1e293b`/`#334155`/`#475569`/`#64748b` text colors across 36 view, modal, and wizard modules with semantic CSS custom properties (`var(--surface)`, `var(--surface2)`, `var(--secondary-system-grouped-bg)`, `var(--tertiary-system-grouped-bg)`, `var(--label)`, `var(--secondary-label)`, `var(--separator)`, and `var(--badge-*)`).

## Verification

`scripts/test_hig_dark_mode.js` verifies:
- `styles/tokens.css` defines all required Apple HIG system, alias, and `--badge-*` tokens across light and dark selectors.
- `styles/responsive.css` and `styles/components.css` contain no competing dark-mode palette blocks or `background: var(--text)` primary button rules.
- `applyTheme('dark' | 'light' | 'system')` keeps `dataset.theme`, `classList`, `style.colorScheme`, and `localStorage` keys in sync.
- Static scan across the 37 targeted view/component modules confirms zero raw light hex backgrounds or dark slate text colors outside `var(...)` fallbacks.

## Prevention

- **Never add theme palettes outside `styles/tokens.css`.** `styles/tokens.css` is the sole owner of color and surface custom properties. Other stylesheets (`styles/components.css`, `styles/responsive.css`, `styles/print.css`) must consume tokens, never re-declare `:root` or `@media (prefers-color-scheme: dark)` palettes.
- **Never pair a hardcoded hex background with a CSS variable text color (or vice versa) in JS template strings.** In inline `style="..."` strings, always pair `background: var(--surface)` (or `var(--secondary-system-grouped-bg)`) with `color: var(--text)` (or `var(--label)`), and use `var(--badge-*)` for status pills.
- **Never use `var(--text)` or `var(--label)` as a button background with fixed `#fff` text.** In Dark Mode `--text` and `--label` resolve to `#FFFFFF`. Use `var(--tint-color)` or `var(--system-blue)` with `color: #ffffff` for filled action buttons.
- Run `node scripts/test_hig_dark_mode.js` whenever editing CSS files or inline styles in `src/views/` and `src/components/`.

## Related Issues

- Plan: `docs/plans/2026-11-04-1730-fix-apple-hig-light-dark-mode-plan.md`
- Regression test: `scripts/test_hig_dark_mode.js`
