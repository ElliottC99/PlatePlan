---
title: "feat: Restore npm run lint and add single-command CI test runner"
date: 2026-11-18
type: feat
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# feat: Restore npm run lint and add single-command CI test runner

## Goal Capsule
- Objective: Make `npm run lint` and all 53 non-emulator `scripts/test_*.js` + `test_vault_fit_score.js` suites pass cleanly, expose a single `npm test` command in `package.json`, and run `npm run lint` + `npm test` automatically in `.github/workflows/pages.yml` on every push.
- Means: Fix the 2 UI template defects (`RecipeWizardViews.js:123` missing `id`, `RecipeWizardStep2View.js:44` hardcoded `#fff`), update `test_recipe_wizard_edit.js` for I1's `data-action` migration, resolve the `test_recipe_wizard.js` Test 8 alias-fallback failure, add `scripts/run_tests.js` (`"test": "node scripts/run_tests.js"`), and add `npm run lint` + `npm test` to `.github/workflows/pages.yml`.
- Authority: Session-settled brainstorm decisions govern scope (all 5 baseline issues fixed + all 53 non-emulator tests run via `npm test` and CI); `test_firestore_rules.js` remains under `npm run test:rules`.
- Stop condition: Do not run `test_firestore_rules.js` inside `npm test` or GitHub Pages CI (it requires Java 21+ and the Firebase emulator).

## Product Contract

### Problem Frame
GitHub Actions (`.github/workflows/pages.yml`) currently runs only `node --check` on `src/` and `npm run build`, leaving all 53 behavioral test scripts unexecuted on PRs. Meanwhile, `npm run lint` fails on 1 missing `id` attribute (`RecipeWizardViews.js:123`), `test_hig_dark_mode.js` fails on 1 hardcoded `#fff` (`RecipeWizardStep2View.js:44`), `test_recipe_wizard_edit.js` fails on a pre-I1 `onclick` assertion, and `test_recipe_wizard.js` fails on Test 8.

### Requirements
- R1. `npm run lint` (`node --check server.js && node scripts/test_accessibility_dom.js`) passes with exit code 0.
- R2. `node scripts/test_hig_dark_mode.js`, `node scripts/test_recipe_wizard_edit.js`, and `node scripts/test_recipe_wizard.js` pass with exit code 0.
- R3. `npm test` runs all 53 non-emulator tests (`52` `scripts/test_*.js` excluding `test_firestore_rules.js`, plus `test_vault_fit_score.js`) via `scripts/run_tests.js` with a per-test timeout >= 30s so `test_planner_controls.js` exits cleanly, failing non-zero if any test fails.
- R4. `.github/workflows/pages.yml` runs `npm run lint` and `npm test` in the `build` job on every push to `main`, `development`, and `dev/**`.

### Scope Boundaries
- In scope: `package.json`, `.github/workflows/pages.yml`, `scripts/run_tests.js`, `src/components/recipe/RecipeWizardViews.js`, `src/components/recipe/RecipeWizardStep2View.js`, `scripts/test_recipe_wizard_edit.js`, `scripts/test_recipe_wizard.js`, and `src/services/PantryTaxonomyService.js` (for Test 8d alias lookup).
- Out of scope: Running Firebase emulator rule checks (`test_firestore_rules.js`) in `npm test` or `pages.yml`.

## Planning Contract

### Key Technical Decisions
- KTD1. Fix all 5 failing/timing-out baseline tests and run all 53 non-emulator tests via `npm test` and GitHub Actions CI (session-settled: user-directed — chosen over a smaller curated subset: all 53 already run in ~15–20s total, giving full regression coverage on every PR). Covers R1, R2, R3, R4.
- KTD2. Implement `scripts/run_tests.js` using Node's built-in `fs` and `child_process.spawnSync` with a 30s per-file timeout rather than adding a third-party test runner dependency, keeping PlatePlan zero-dependency in its test harness. Covers R3.
- KTD3. Place `npm run lint` and `npm test` in the `build` job of `.github/workflows/pages.yml` before `npm run build` so PRs targeting `development` fail fast on any regression without waiting for deploy. Covers R4.

### Sequencing
1. Create a fresh `dev/restore-lint-and-ci-test-runner` branch from updated `development`.
2. Execute `U1` (lint + dark-mode UI fixes) and `U2` (`test_recipe_wizard_edit.js` + `test_recipe_wizard.js` fixes).
3. Execute `U3` (`scripts/run_tests.js` + `package.json` `"test"` script) and `U4` (`.github/workflows/pages.yml`).
4. Run `npm run lint`, `npm test`, and `npm run build`.

## Implementation Units

### U1. Fix `npm run lint` (`RecipeWizardViews.js`) and `test_hig_dark_mode.js` (`RecipeWizardStep2View.js`)
- Covers: R1, R2
- Files: `src/components/recipe/RecipeWizardViews.js`, `src/components/recipe/RecipeWizardStep2View.js`
- Approach:
  1. In `src/components/recipe/RecipeWizardViews.js:122-123`, add `id="wiz-source-type-${opt.val || 'none'}"` to the `wiz_source_type` radio `<input>` and matching `for="wiz-source-type-${opt.val || 'none'}"` on its wrapping `<label>` so `test_accessibility_dom.js` pairs them.
  2. In `src/components/recipe/RecipeWizardStep2View.js:44`, replace `background: #fff;` on `#wiz-inline-item-weight-${sIdx}-${iIdx}` with `background: var(--surface, #ffffff); color: var(--text, #1c1917);`.
- Test scenarios:
  1. `npm run lint` passes with zero accessibility issues.
  2. `node scripts/test_hig_dark_mode.js` passes with zero contrast violations.

### U2. Fix `test_recipe_wizard_edit.js` and `test_recipe_wizard.js`
- Covers: R2
- Files: `scripts/test_recipe_wizard_edit.js`, `scripts/test_recipe_wizard.js`, `src/services/PantryTaxonomyService.js`
- Approach:
  1. In `scripts/test_recipe_wizard_edit.js:123`, update Test 2 to assert `data-action="open-recipe-wizard-review"` and `data-recipe-id="rec_pizza_1"` instead of `onclick="openRecipeWizard(...)"`.
  2. Update `resolveDynamicProductForIngredient` in `src/services/PantryTaxonomyService.js:761-814` so alias matching normalizes/stems aliases (matching singular/plural and cleaned phrases like `scallion` -> `scallions`, `cilantro` -> `fresh cilantro`) instead of only exact raw lowercase equality.
- Test scenarios:
  1. `node scripts/test_recipe_wizard_edit.js` passes all 3 tests.
  2. `node scripts/test_recipe_wizard.js` passes all tests including Test 8d (`Scallion` -> `prod_spring_onion`, `Cilantro` -> `prod_coriander`).

### U3. Add `scripts/run_tests.js` and `"test"` script in `package.json`
- Covers: R3, KTD1, KTD2
- Files: `scripts/run_tests.js`, `package.json`
- Approach:
  1. Create `scripts/run_tests.js` to collect all `scripts/test_*.js` files excluding `scripts/test_firestore_rules.js`, append `test_vault_fit_score.js`, execute each via `spawnSync(process.execPath, [file], { timeout: 30000, stdio: 'pipe' })`, print concise per-test status + failure output, and exit `1` if any test fails or times out.
  2. Add `"test": "node scripts/run_tests.js"` to `package.json` `scripts`.
- Test scenarios:
  1. `npm test` runs all 53 non-emulator tests and exits `0` with `53 passed, 0 failed`.

### U4. Wire `npm run lint` and `npm test` into `.github/workflows/pages.yml`
- Covers: R4, KTD3
- Files: `.github/workflows/pages.yml`
- Approach:
  1. Add `npm run lint` and `npm test` steps to the `build` job in `.github/workflows/pages.yml` between the `node --check` step and `npm run build`.
- Test scenarios:
  1. Inspect `.github/workflows/pages.yml` to confirm `npm run lint`, `npm test`, and `npm run build` all run under `jobs.build.steps` for `main`, `development`, and `dev/**`.

## Verification Contract
- `npm run lint` passes (exit 0)
- `npm test` runs all 53 non-emulator tests and passes (`53 passed, 0 failed`, exit 0)
- `npm run build` passes (exit 0)
- `npm run ledger && node scripts/test_ledger.js` passes with `0 dead, 0 dead shims, 0 parallel`

## Definition of Done
- `npm run lint`, `npm test` (all 53 non-emulator tests), and `npm run build` pass cleanly on `dev/restore-lint-and-ci-test-runner`.
- `.github/workflows/pages.yml` runs `npm run lint` and `npm test` on every PR/push.
