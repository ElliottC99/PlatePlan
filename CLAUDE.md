# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PlatePlan is a no-bundler PWA for shared household meal planning: recipes ("vault"), an ingredient/product bank ("pantry"), a weekly planner with an automatic plan generator, and shopping lists. It is plain browser ES modules served as static files. The data lives in Firebase Firestore, scoped to one hard-coded household (`HOUSEHOLD_ID = 'elliott-chloe'` in `src/config/firebase.js`).

Elliott builds it mostly through Google AI Studio. Barrie reviews and helps with process. `workflow-enforcer.md` and `plateplan-architecture.md` are the rules and target design Elliott's AI works to. Read them before changing structure.

## Branches and hosting

GitHub Pages serves `main` from the repo root. It does **not** run `npm run build`, so whatever is committed to `main` is exactly what users load. Work happens on `dev/*` branches, goes to `development` for testing, then to `main`. Don't commit straight to `main`.

## Commands

```bash
npm run dev          # Express static server on http://0.0.0.0:3000 (serves dist/ if built, else repo root)
npm run build        # Copy assets into dist/ and stamp __APP_VERSION__ / __BUILD_ID__ (no transpile/bundle)
npm run lint         # node --check server.js + static a11y scan (scripts/test_accessibility_dom.js)
node --check src/path/File.js     # quick syntax check of one module
```

There's no test runner. Each test is a standalone Node script that uses `node:assert` and exits non-zero on failure. Run one with:

```bash
node scripts/test_shopping_list.js
```

The tests are `scripts/test_*.js` plus `test_vault_fit_score.js` at the repo root. They import `src/` modules directly and stub `global.window`. Four fail before any change is made:
- `test_accessibility_dom.js` (so `npm run lint` fails too) still reads the deleted `PlatePlan.html`.
- `test_plan_generator.js` still imports the deleted `PlanGeneratorService.js`.
- `test_pwa_build.js` expects an old version string.
- `test_recipe_wizard.js` fails an ingredient-name assertion.

If `npm run dev` is serving a stale `dist/`, delete `dist/` or rebuild.

## Backups

`scripts/backup_firestore.js` is the backup to use. It uses the Firebase Admin SDK with a service-account key, so it ignores security rules, and it saves every collection and subcollection with Firestore types tagged. Its header has the usage. `firebase-admin` is installed with `--no-save` and isn't in `package.json`. Backups go outside the repo (`~/PlatePlan-backups/`) because the repo is public. `scripts/backup-db.js` is an older script that relies on Anonymous sign-in, which is now off, so it no longer works. Take a backup before any data migration.

## Architecture

**One HTML shell.** `index.html` (about 1,400 lines) holds the inline CSS and the app shell markup. It loads the Firebase **compat** SDK from the gstatic CDN as globals (`window.firebase`), then `src/config/firebase-config.js`, then `src/main.js` as a module. `PlatePlan.html` and the old `scripts/` runtime have been deleted. `scripts/` now holds only build, backup and test scripts.

**Check for an existing module before adding one.** The codebase grew by adding new modules alongside existing ones. Some of that has been cleaned up, but not all:
- **Re-export shims with no importers** remain: `services/firebase.js`, `components/RecipeWizardModal.js`, `components/recipe/VaultRecipeCard.js`, `components/recipe/ViewRecipeModal.js` and `views/ProfileAllocationCard.js`. Grep for importers (and `window` / `data-action` uses) before deleting one.
- **Plan generation** has a single module, `MealPlanGeneratorService`.
- **Parallel implementations that are still live:**
  - unit converters: `UnitConversionService`, `RecipeUnitConverter` and `UnitConverter`
  - Data Quality: `DataQualityEngine`, `DataQualityScanner`, `DataQualityScannerService` and `DataQualityService`
  - `ActionSheetUI` in both `components/navigation/` and `components/pantry/`
  - the plan read, which falls back from a subcollection to a legacy doc (`HydrationService.js` `subcollPlan || legacyPlan`)
- **State.** `store/coreState.js` is the state holder most of the code imports. `store/state.js`, `state/AppState.js` and `models/StateModel.js` also exist.
- **Firestore writers.** The aim is one writer per collection (`plateplan-architecture.md` has the owner table). `products` is now written only by `ProductRepository`. `recipes` and `ingredients` are still referenced by several modules. Extend the existing owner instead of adding another writer.
- **`src/views/PantryBankModalService.js`** fails `node --check`, but nothing imports it.

Layers in `src/`:
- `main.js`: the lifecycle coordinator. It waits for auth (`AuthService`, Google sign-in only), hydrates household data and realtime subscriptions (`HydrationService`), wires the store, and attaches many functions to `window.*` for the HTML and the action bridge.
- `store/`: the custom reactive store (`store.js` is the facade). It combines slices (`cacheSlice`, `inventorySlice`, `planSlice`, `shoppingSlice`, `recipeStore`) and `actions/`, and broadcasts changes as DOM `CustomEvent`s. Change state through the store's setters or `Store.setState()`. Don't assign `window.state` directly. `cacheSlice` keeps a localStorage cache keyed by `CACHE_KEY`.
- `services/`: domain logic and Firestore repositories. All persistence goes under `households/{HOUSEHOLD_ID}/...`. `src/repositories/` holds a few more repositories.
- `components/componentRegistry.js`: imported by `main.js`, which spreads every registered component onto `window`. A missing direct import doesn't prove a component is unused, so also grep for its use as a `window` global and in `data-action` strings.
- `views/` + `components/`: render functions that build HTML strings. Larger views are split into `*View.js` (orchestration), `*RenderService.js` / `*HTMLTemplate.js` (markup), and `*UI.js` (modals and widgets). `core/AppRouter.js` switches between views.
- `services/ActionBridge.js`: one delegated document-level click listener for `data-action="fn('arg')"` only. Use `data-action` in new markup, not inline `onclick`, and escape interpolated values with `escapeAttr`. **Known bug:** the bridge no longer handles `data-pp-click`, `data-pp-change` or `data-pp-input`, but 38 of them remain in `index.html` and more in `src/` templates. Those controls (vault filter and sort, pantry search, add-ingredient, Tesco import and others) currently do nothing. Many `data-action="fn()"` values also name functions that no longer exist. New handlers should be named actions routed in `routeAction`, as the Today view's are.
- `components/ui/DialogHelpers.js`: the shared custom confirm/prompt dialogs. Use these, never native `alert`/`confirm`/`prompt`.
- `config/businessRules.js`, `config/systemConfig.js`: tunable constants. Fit-score weights live in `utils/fitScoreWeights.js`.

**Service worker (`sw.js`)** precaches an explicit list of module paths. If you add a module that must work offline, add it to `PLATEPLAN_PRECACHE_ASSETS`.

## Versioning

`index.html` and `sw.js` now hold `__APP_VERSION__` and `__BUILD_ID__` placeholders, which `scripts/build.js` replaces in `dist/` from `package.json` `version` and the git hash. **Known bug:** Pages serves the unbuilt root, so the live site shows the literal placeholders, and the service-worker cache names never change. Installed clients may therefore not pick up updates. Until that's fixed, don't assume a deploy reaches installed phones.

`src/main.js` still has a hand-typed `export const APP_VERSION` (`v3.45.7`), which doesn't match `package.json` (`3.35.4`). Stylesheet `?v=` strings follow the placeholder. `cacheSlice` `CACHE_KEY` has its own version; change it only to bust that cache.

Many modules start with a header comment like `/** src/path/File.js (vX.Y.Z) ... */`, and some claim a line-count limit. Splitting files to meet a size rule has produced fragments nothing imports. Don't create a new file just to stay under a line count. Extend the module that already owns the job, and split only along a real responsibility boundary.

## Data and security

The live Firestore rules are set in the Firebase console and allow read and write only for Elliott's and Chloe's UIDs (published 2026-10-27). `firestore.rules` in the repo is an older, looser draft (any signed-in user) and is **not** what's deployed. There's no `firebase.json`, so rules can't be deployed from the repo. If the real rules are added here, leave out the email comments, because the repo is public. The household ID `'elliott-chloe'` is also redeclared in `src/repositories/ShoppingListRepository.js`.
