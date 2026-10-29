# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PlatePlan is a no-bundler PWA for shared household meal planning: recipes ("vault"), an ingredient/product bank ("pantry"), a weekly planner with an automatic plan generator, and shopping lists. It is plain browser ES modules served as static files. The data lives in Firebase Firestore, scoped to one hard-coded household (`HOUSEHOLD_ID = 'elliott-chloe'` in `src/config/firebase.js`).

Elliott builds it mostly through Google AI Studio. Barrie reviews and helps with process. `workflow-enforcer.md` and `plateplan-architecture.md` are the rules and target design Elliott's AI works to. Read them before changing structure.

Plans live in `docs/plans/`. Learnings from solved problems live in `docs/solutions/`; check there before changing the area a learning covers.

## Branches and hosting

GitHub Pages publishes from `.github/workflows/pages.yml` (Settings → Pages → Source: "GitHub Actions"). Every push to `main`, `development` or `dev/**` syntax-checks every module in `src/` and runs `npm run build` on GitHub; only `main` publishes the built `dist/`. The build fails if it cannot read the git commit ID. A failed build publishes nothing and the previous release stays live. Work happens on `dev/*` branches, goes to `development` for testing, then to `main`. Don't commit straight to `main`.

## Commands

```bash
npm run dev          # Express static server on http://0.0.0.0:3000 (serves dist/ if built, else repo root)
npm run build        # Copy assets into dist/ and stamp __APP_VERSION__ / __BUILD_ID__ (no transpile/bundle)
npm run lint         # node --check server.js + static a11y scan (scripts/test_accessibility_dom.js)
npm run ledger       # rewrite LEDGER.md: dead, needs-a-check and live modules, parallel versions, the attic
npm run test:rules   # firestore.rules checks in the emulator (offline demo-plateplan project; needs Java 21+)
npm run deploy:rules # runs test:rules, then publishes firestore.rules only (Barrie, after `npx firebase login`)
node --check src/path/File.js     # quick syntax check of one module
```

There's no test runner. Each test is a standalone Node script that uses `node:assert` and exits non-zero on failure. Run one with:

```bash
node scripts/test_shopping_list.js
```

The tests are `scripts/test_*.js` plus `test_vault_fit_score.js` at the repo root. They import `src/` modules directly and stub `global.window`. The exception is `test_firestore_rules.js`, which needs the emulator, so run it with `npm run test:rules`. Three fail before any change is made:
- `test_accessibility_dom.js` (so `npm run lint` fails too) still reads the deleted `PlatePlan.html`.
- `test_plan_generator.js` still imports the deleted `PlanGeneratorService.js`.
- `test_recipe_wizard.js` fails an ingredient-name assertion.

If `npm run dev` is serving a stale `dist/`, delete `dist/` or rebuild.

## Backups

`scripts/backup_firestore.js` is the backup to use. It uses the Firebase Admin SDK with a service-account key, so it ignores security rules, and it saves every collection and subcollection with Firestore types tagged. Its header has the usage. `firebase-admin` is installed with `--no-save` and isn't in `package.json`. Backups go outside the repo (`~/PlatePlan-backups/`) because the repo is public. `scripts/backup-db.js` is an older script that relies on Anonymous sign-in, which is now off, so it no longer works. Take a backup before any data migration.

## Architecture

**One HTML shell.** `index.html` (about 1,400 lines) holds the inline CSS and the app shell markup. It loads the Firebase **compat** SDK from the gstatic CDN as globals (`window.firebase`), then `src/config/firebase-config.js`, then `src/main.js` as a module. `PlatePlan.html` and the old `scripts/` runtime have been deleted. `scripts/` now holds only build, backup and test scripts.

**Check for an existing module before adding one.** The codebase grew by adding new modules alongside existing ones. Some of that has been cleaned up, but not all:
- **`LEDGER.md`** (rewritten by `npm run ledger`) lists every `src/` module as live, live shim, needs a check, dead shim or dead, and counts the parallel versions. Read it instead of grepping for importers. `scripts/ledger.js` explains the labels; `scripts/test_ledger.js` runs like the other tests.
- **Parallel implementations that are still live** are listed per job in the owner table in `plateplan-architecture.md`, which the ledger reads: app state, Data Quality and the action sheets. Unit conversion has one owner, `src/services/UnitConversionService.js`. Add a new parallel module there, and take one out when it is merged away. Separately, the plan read falls back from a subcollection to a legacy doc (`HydrationService.js` `subcollPlan || legacyPlan`).
- **`attic/`** holds modules the ledger proved dead, at their original paths, with move and delete-after dates in `attic/README.md`. The build doesn't copy it. Restore one by moving it back.
- **Firestore writers.** The aim is one writer per collection. `products` is now written only by `ProductRepository`. `recipes` and `ingredients` are still referenced by several modules. Extend the existing owner instead of adding another writer.

Layers in `src/`:
- `main.js`: the lifecycle coordinator. It waits for auth (`AuthService`, Google sign-in only), hydrates household data and realtime subscriptions (`HydrationService`), wires the store, and attaches many functions to `window.*` for the HTML and the action bridge.
- `store/`: the custom reactive store (`store.js` is the facade). It combines slices (`cacheSlice`, `inventorySlice`, `planSlice`, `shoppingSlice`, `recipeStore`) and `actions/`, and broadcasts changes as DOM `CustomEvent`s. Change state through the store's setters or `Store.setState()`. Don't assign `window.state` directly. `cacheSlice` keeps a localStorage cache keyed by `CACHE_KEY`.
- `services/`: domain logic and Firestore repositories. All persistence goes under `households/{HOUSEHOLD_ID}/...`. `src/repositories/` holds a few more repositories.
- `components/componentRegistry.js`: imported by `main.js`, which spreads every registered component onto `window`. A missing direct import doesn't prove a component is unused, so also grep for its use as a `window` global and in `data-action` strings.
- `views/` + `components/`: render functions that build HTML strings. Larger views are split into `*View.js` (orchestration), `*RenderService.js` / `*HTMLTemplate.js` (markup), and `*UI.js` (modals and widgets). `core/AppRouter.js` switches between views.
- `services/ActionBridge.js`: one delegated document-level click listener for `data-action="fn('arg')"` only. Use `data-action` in new markup, not inline `onclick`, and escape interpolated values with `escapeAttr`. **Known bug:** the bridge no longer handles `data-pp-click`, `data-pp-change` or `data-pp-input`, but 38 of them remain in `index.html` and more in `src/` templates. Those controls (vault filter and sort, pantry search, add-ingredient, Tesco import and others) currently do nothing. Many `data-action="fn()"` values also name functions that no longer exist. New handlers should be named actions routed in `routeAction`, as the Today view's are.
- `components/ui/DialogHelpers.js`: the shared custom confirm/prompt dialogs. Use these, never native `alert`/`confirm`/`prompt`.
- `config/businessRules.js`, `config/systemConfig.js`: tunable constants. Fit-score weights live in `utils/fitScoreWeights.js`.

**No service worker.** `sw.js` was removed on 2026-10-28; it did nothing, because `src/main.js` unregistered it and wiped the caches on every load. That cleanup block in `src/main.js` stays, so phones that installed the old worker lose it. There is no offline use. Don't add a service worker back without a plan for versioned caches and updates.

## Versioning

`package.json` `version` is the only place the version number is typed. Bump it for a meaningful release; nothing else needs editing. `index.html` holds `__APP_VERSION__` and `__BUILD_ID__` placeholders in its meta tags and `?v=` strings. `scripts/build.js` replaces them in `dist/` with that version and the short git hash, and fails if any placeholder is left in what the page loads. The header shows `<version> (<commit>)`, read from the meta tags by `formatAppVersion` in `src/core/AppInitializer.js`, or `dev` on an unbuilt page such as `npm run dev` without `dist/`. Never type a version into `src/`. `cacheSlice` `CACHE_KEY` has its own version; change it only to bust that cache.

Many modules start with a header comment like `/** src/path/File.js (vX.Y.Z) ... */`, and some claim a line-count limit. Splitting files to meet a size rule has produced fragments nothing imports. Don't create a new file just to stay under a line count. Extend the module that already owns the job, and split only along a real responsibility boundary.

## Data and security

`firestore.rules` is the deployed Firestore rules, published from the repo since 2026-10-28. It allows read and write only under `households/elliott-chloe`, and only for Elliott's, Chloe's and Barrie's UIDs. Barrie's is temporary and comes out when the rescue ends. Every other path and account is refused. Change the rules only in this file, never in the console. `scripts/test_firestore_rules.js` checks the allow and deny cases, so update it in the same change. Barrie deploys with `npm run deploy:rules`, which runs the test first and stops if it fails. `firebase.json` covers Firestore rules only, and no CI step deploys them. The emulator needs Java 21 or later, and `.tool-versions` selects asdf's openjdk 25.0.2 for this repo. `npm install` removes the unsaved `firebase-admin`, so reinstall it before a backup. The repo is public, so name people in rules comments and never give their email addresses. The household ID `'elliott-chloe'` is also redeclared in `src/repositories/ShoppingListRepository.js`.
