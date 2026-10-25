# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PlatePlan is a no-bundler PWA for shared household meal planning: recipes ("vault"), an ingredient/product bank ("pantry"), a weekly planner with an automatic plan generator, and shopping lists. It is plain browser ES modules served as static files. The data lives in Firebase Firestore, scoped to one hard-coded household (`HOUSEHOLD_ID = 'elliott-chloe'` in `src/config/firebase.js`).

## Commands

```bash
npm run dev          # Express static server on http://0.0.0.0:3000 (serves dist/ if built, else repo root)
npm run build        # Copy assets into dist/ (no transpile/bundle); dist/index.html is generated from PlatePlan.html
npm run lint         # node --check server.js + static a11y scan (scripts/test_accessibility_dom.js)
node --check src/path/File.js     # quick syntax check of one module
```

There's no test runner. Each test is a standalone Node script that uses `node:assert` and exits non-zero on failure. Run one with:

```bash
node scripts/test_shopping_list.js
```

The tests are `scripts/test_*.js` plus `test_vault_fit_score.js` at the repo root. They import `src/` modules directly and stub `global.window`. Right now `test_pwa_build.js` (it expects an old version string) and `test_recipe_wizard.js` fail before any change is made.

If `npm run dev` is serving a stale `dist/`, delete `dist/` or rebuild.

## Architecture

**Two HTML shells, kept identical.** `index.html` and `PlatePlan.html` are byte-for-byte copies, about 1,350 lines each, holding the inline CSS and the app shell markup. Any edit to one must go into the other. They load the Firebase **compat** SDK from the gstatic CDN as globals (`window.firebase`), then `src/config/firebase-config.js`, then `src/main.js` as a module.

**Live code is in `src/`.** `scripts/core|features|services|ui|main.js` is an older v3.28 runtime. Neither the HTML (since commit `00538fd`) nor any test loads it, because the tests import `src/`. `scripts/` is still copied into `dist/` and holds the build and test scripts. Make app changes in `src/`.

**Check for an existing module before adding one.** The codebase grew by adding new modules alongside existing ones, so many concerns have more than one module:
- **Re-export shims.** Some files are one-line `export * from ...` pass-throughs to the real module. Some shims are still imported: `services/InventoryRepository.js` and `services/PlanRepository.js` are used by `HydrationService.js`. Others have no importers: `utils/ActionBridge.js`, `components/recipe/VaultRecipeCard.js`, `views/ProfileAllocationCard.js`. Grep for importers before deleting or editing a shim.
- **Real parallel implementations that are both live:**
  - plan generators: `PlanGeneratorService` and `MealPlanGeneratorService`
  - unit converters: `UnitConversionService` and `RecipeUnitConverter`
  - Data Quality: `DataQualityEngine`, `DataQualityScanner`, `DataQualityScannerService` and `DataQualityService`
  - `ActionSheetUI` in both `components/navigation/` and `components/pantry/`
  - the plan read, which falls back from a subcollection to a legacy doc (`HydrationService.js` `subcollPlan || legacyPlan`)
- **State.** `store/coreState.js` is the state holder most of the code imports. `store/state.js`, `state/AppState.js` and `models/StateModel.js` also exist.
- **Firestore writers.** Several collections are written by more than one repository. For example, `products` is written by both `ProductRepository` and `ShoppingFirestoreRepository`. Extend the existing owner instead of adding another writer.
- **`src/views/PantryBankModalService.js`** fails `node --check`, but nothing imports it.

Layers in `src/`:
- `main.js`: the lifecycle coordinator. It waits for auth (`AuthService`), hydrates household data and realtime subscriptions (`HydrationService`), wires the store, and attaches many functions to `window.*` for the HTML and the action bridge.
- `store/`: the custom reactive store (`store.js` is the facade). It combines slices (`cacheSlice`, `inventorySlice`, `planSlice`, `shoppingSlice`, `recipeStore`) and `actions/`, and broadcasts changes as DOM `CustomEvent`s. Change state through the store's setters or `Store.setState()`. Don't assign `window.state` directly. `cacheSlice` keeps a localStorage cache keyed by `CACHE_KEY`.
- `services/`: domain logic and Firestore repositories. All persistence goes under `households/{HOUSEHOLD_ID}/...` (subcollections such as `ingredients`, `settings/preferences`, `shoppingLists`). `src/repositories/` holds a few more repositories.
- `components/componentRegistry.js`: imported by `main.js`, which spreads every registered component onto `window`. Components reached only this way, such as `components/analytics/*` and `components/prep/*`, are loaded, but no callers have been found. A missing direct import doesn't prove a component is unused, so also grep for its use as a `window` global and in `data-action` strings.
- `views/` + `components/`: render functions that build HTML strings. Larger views are split into `*View.js` (orchestration), `*RenderService.js` / `*HTMLTemplate.js` (markup), and `*UI.js` (modals and widgets). `core/AppRouter.js` switches between views.
- `services/ActionBridge.js`: one delegated document-level click/change listener. Templates declare handlers as `data-action="fn('arg')"`, `data-pp-click`, or `data-pp-change`. The bridge parses these without `eval` and sends them to known handlers or `window` functions. Use these data attributes in new markup, not inline `onclick`. Inline handlers that interpolate names break on apostrophes (see `Audit_Report_v3.20.md`). Escape interpolated values with `escapeAttr`.
- `components/ui/DialogHelpers.js`: the shared custom confirm/prompt dialogs. Use these, never native `alert`/`confirm`.
- `config/businessRules.js`, `config/systemConfig.js`: tunable constants. Fit-score weights live in `utils/fitScoreWeights.js`.

**Service worker (`sw.js`)** precaches an explicit list of module paths. If you add a module that must work offline, add it to `PLATEPLAN_PRECACHE_ASSETS`. Some dynamic imports add `?v=${Date.now()}` to get past caches.

## Versioning convention

Each change ends with a version bump, and the version string is repeated by hand in several places. Keep them in sync:
- `index.html` and `PlatePlan.html`: the `app-version` / `version` meta tags
- `src/main.js`: `export const APP_VERSION`
- `sw.js`: the header comment, `PLATEPLAN_CACHE`, `PLATEPLAN_STORE_CACHE`, `PLATEPLAN_IMAGE_CACHE`, `PLATEPLAN_APP_VERSION`

Changing the cache names in `sw.js` is what makes installed clients update. Stylesheet `?v=` query strings, `package.json` `version`, and `cacheSlice` `CACHE_KEY` follow their own, older version numbers. Change those only when you mean to bust that specific cache.

Many modules start with a header comment like `/** src/path/File.js (vX.Y.Z) ... */`. Some headers also claim "Strictly modular (<350 lines)", and `Audit_Report_v3.20.md` cites a 400-line ceiling. Splitting files to meet that size rule has produced fragments nothing imports, such as `CategoryManagerOperations.js`. So don't create a new file just to stay under a line count. Extend the module that already owns the job, and split only along a real responsibility boundary.

## Data

There is no `firestore.rules` or `firebase.json` in the repo, so the deployed Firestore security rules are unknown from source. The household ID `'elliott-chloe'` is redeclared in several modules, not only in `src/config/firebase.js`.
