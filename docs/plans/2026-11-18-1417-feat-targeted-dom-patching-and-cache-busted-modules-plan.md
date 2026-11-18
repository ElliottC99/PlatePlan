---
title: "feat: Targeted Step 3 shopping DOM patching and cache-busted module graph"
date: 2026-11-18
type: feat
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# feat: Targeted Step 3 shopping DOM patching and cache-busted module graph

## Goal Capsule
- Objective: Eliminate full Planner Wizard re-renders when toggling a shopping item in Step 3, and prevent browsers from serving mixed old/new ES modules after a GitHub Pages deploy.
- Means: Extract a `#planner-step3-shopping-content` container + `patchWizardStep3Shopping(plan)` helper in `PlannerRenderService.js` called by `ShoppingView.js`, and rewrite relative static/dynamic `.js` import specifiers inside `dist/src/**/*.js` to append `?v=<gitHash>` during `scripts/build.js`.
- Authority: Session-settled brainstorm decisions govern scope (in-place Step 3 shopping container patching preserving scroll + `dist/src/` specifier rewriting); `npm run dev` unbuilt serving remains untouched.
- Stop condition: Do not mutate repo `src/` files with `?v=` placeholders, and do not re-introduce a service worker.

## Product Contract

### Problem Frame
`ShoppingView.js:41` calls `window.renderPlannerWizard()` on every checkbox toggle, rebuilding the entire Planner Wizard DOM instead of updating only the Step 3 shopping region. Meanwhile, `scripts/build.js` only stamps `?v=__BUILD_ID__` onto `index.html`'s `src/main.js` and `src/config/firebase-config.js`, leaving all internal ES module imports unversioned in `dist/src/`.

### Requirements
- R1. Toggling a shopping item via `toggleShoppingItemAcquired` patches only `#planner-step3-shopping-content` in place when mounted (preserving scroll position and Steps 1–2 DOM), falling back to `window.renderPlannerWizard()` only when Step 3 is not mounted.
- R2. `scripts/build.js` rewrites relative static (`import`/`export ... from './...'`) and dynamic (`import('./...')`) `.js` specifiers in `dist/src/**/*.js` to append `?v=<gitHash>` while leaving source `src/` untouched for `npm run dev`.
- R3. `scripts/test_pwa_build.js` verifies that built `dist/src/` modules carry `?v=<gitHash>` on relative imports and pass syntax checks, while `scripts/test_shopping_list.js` verifies targeted Step 3 patching without calling full `renderPlannerWizard`.

### Scope Boundaries
- In scope: `src/views/PlannerRenderService.js`, `src/views/ShoppingView.js`, `scripts/build.js`, `scripts/test_pwa_build.js`, `scripts/test_shopping_list.js`.
- Out of scope: Rewriting other views' `innerHTML` renders or adding a service worker.

## Planning Contract

### Key Technical Decisions
- KTD1. Re-render `#planner-step3-shopping-content` in place on shopping tick (preserving scroll and Steps 1–2) and rewrite relative static/dynamic `.js` imports inside `dist/src/` with `?v=<gitHash>` during build (session-settled: user-directed — chosen over single-row surgical DOM mutation and importmap injection: keeps toolbar totals + category grouping consistent on tick without bloating `index.html` with an import map). Covers R1, R2.
- KTD2. Keep `PlannerRenderService.js` as owner of Step 3 markup (`renderWizardStep3Content` + `patchWizardStep3Shopping`) and keep `ShoppingView.js` calling it, avoiding parallel renderers. Covers R1.

### Sequencing
1. Create `dev/targeted-dom-and-cache-busted-modules` from updated `development`.
2. Execute `U1` (`PlannerRenderService.js` + `ShoppingView.js` + `test_shopping_list.js`).
3. Execute `U2` (`scripts/build.js` + `scripts/test_pwa_build.js`).
4. Run `npm run lint`, `npm test`, and `npm run build`.

## Implementation Units

### U1. Targeted Step 3 shopping container patching
- Covers: R1, R3, KTD1, KTD2
- Files: `src/views/PlannerRenderService.js`, `src/views/ShoppingView.js`, `scripts/test_shopping_list.js`
- Approach:
  1. In `src/views/PlannerRenderService.js`, extract `renderWizardStep3Content(plan)` rendering `${topToolbarHtml}${listHtml}`, wrap it in `<div id="planner-step3-shopping-content" style="display:flex;flex-direction:column;gap:16px">...</div>` inside `renderWizardStep3(plan)`, and export `patchWizardStep3Shopping(plan)` to replace only that element's `innerHTML` (guarding `typeof document !== 'undefined' && typeof document.getElementById === 'function'`, and guarding `typeof window !== 'undefined' && typeof window.scrollTo === 'function'` before restoring `scrollY`) when `#planner-step3-shopping-content` exists, otherwise calling `window.renderPlannerWizard?.()`.
  2. Update `src/views/ShoppingView.js:41` (`toggleShoppingItemAcquired`) to call `patchWizardStep3Shopping(plan)`.
  3. Add a test in `scripts/test_shopping_list.js` verifying that when `#planner-step3-shopping-content` is mounted in `document`, `toggleShoppingItemAcquired` updates that container without invoking `window.renderPlannerWizard`.
- Test scenarios:
  1. `node scripts/test_shopping_list.js` passes including the targeted `#planner-step3-shopping-content` patch check.
  2. `node scripts/test_today_view.js`, `node scripts/test_planner_controls.js`, and `node scripts/test_dead_controls.js` pass.

### U2. Cache-busted module graph in `dist/src/`
- Covers: R2, R3, KTD1
- Files: `scripts/build.js`, `scripts/test_pwa_build.js`
- Approach:
  1. In `scripts/build.js`, add `stampModuleImports(path.join(distDir, 'src'), gitHash)` after `dist/src` copy and `gitHash` resolution: walk every `.js` file under `dist/src/` and append `?v=${gitHash}` to relative static (`from './...'` / `from '../...'` and bare `import './...'`) and relative dynamic (`import('./...')` / `import('../...')`, including backtick literals without `${` such as in `PantryBankView.js`) `.js` specifiers that do not already contain `?`.
  2. Extend `scripts/test_pwa_build.js` (before its `leftover-placeholder.js` failure test) to assert that `dist/src/main.js` and `dist/src/views/PantryBankView.js` carry `?v=<gitHash>` on relative imports and pass `node --check`, while source `src/main.js` remains unstamped.
- Test scenarios:
  1. `node scripts/test_pwa_build.js` passes including module-graph stamping assertions.
  2. `npm run build` succeeds and `node --check dist/src/main.js` passes cleanly.

## Verification Contract
- `npm run lint` passes (exit 0)
- `npm test` passes all 53 suites (exit 0)
- `npm run build` succeeds and leaves zero unstamped placeholders

## Definition of Done
- `toggleShoppingItemAcquired` patches `#planner-step3-shopping-content` in place when mounted without rebuilding Steps 1–2.
- `scripts/build.js` stamps `?v=<gitHash>` onto relative static and dynamic `.js` imports across `dist/src/` while keeping `src/` clean for `npm run dev`.
- `npm run lint`, `npm test`, and `npm run build` pass on `dev/targeted-dom-and-cache-busted-modules`.
