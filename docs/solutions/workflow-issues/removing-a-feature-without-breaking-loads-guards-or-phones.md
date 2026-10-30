---
title: Removing a whole feature without breaking loading, the guards or the phones' caches
date: 2026-10-30
last_updated: 2026-10-30
category: workflow-issues
module: feature removal (Active Stock, 3.50.0)
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "Removing a feature that has UI, store state, a cached field and a Firestore collection"
  - "Unregistering components from componentRegistry.js while their files stay in src/"
  - "Clearing a localStorage key or cached field that older releases left on the phones"
  - "Deciding whether firestore.rules can close one collection under the household"
  - "Deciding to keep a neighbouring feature that a removal touches"
related_components: [frontend, data_model, testing_framework]
tags: [feature-removal, attic, ledger, dead-controls, cache, indexeddb, firestore-rules, active-stock, use-up]
---

# Removing a whole feature without breaking loading, the guards or the phones' caches

## Context

Elliott asked for Active Stock to be removed entirely (PR #10, released as 3.50.0 through PR #11). The feature reached the UI, the store, the local cache, a Firestore repository and several readers: Vault sorts, card tags, the generator and the shopping list. Three things were easy to get wrong, and none of them shows in the final code.

## Guidance

**1. Remove from the outside in, and keep every commit loading.** First stop the readers (UI, sorts, generator, shopping list). Then remove the data layer (hydration, store slice, cache field, repository). Move files to `attic/` last, once `npm run ledger` lists them under "Dead". The store slice still has readers until both the Pantry view and the services have stopped subscribing. Removing it first breaks the imports.

**2. Move unregistered UI files to the attic in the same commit that unregisters them.** `scripts/test_dead_controls.js` scans every file in `src/components/pantry/` (`scopeFiles`, `listJs('src/components/pantry')`), not only the registered ones. Once `componentRegistry.js` and the view stop putting a component's handlers on `window`, the component's own inline `onclick="window.adjustPantryStock(...)"` lines are reported as dead, and the guard fails. Moving the files out of `src/` in the same commit keeps it green. The plan had put the move in a later unit, and the guard failed in between.

**3. Clear an old cached field before the IndexedDB early return.** `loadStateCache` in `src/store/cacheSlice.js` reads IndexedDB first and `return idbData` whenever it holds recipes. On a phone with a working cache, the localStorage fallback below it never runs. A `localStorage.removeItem(...)` written inside that fallback therefore does nothing on the phones that matter. Put the clean-up at the top of `loadStateCache`, in its own try/catch that logs a warning (`workflow-enforcer.md` bans an empty catch). Also stop `initStoreCache` copying the field, so a stale value left in the IndexedDB blob is ignored until the next save drops it. Don't bump `CACHE_KEY` for this: that would throw away every phone's recipe cache.

**4. firestore.rules cannot close one household collection with a deny rule.** The rules have a single `match /households/elliott-chloe/{document=**}` allow. Firestore combines allow rules with OR, so a `match .../inventory/{doc=**} { allow read, write: if false; }` beside it changes nothing. Closing one collection means rewriting the wildcard into a list of allowed collections, or a condition on the collection name. That changes the rules for the whole household and needs `scripts/test_firestore_rules.js` updated, so we decided to leave the rules alone for the Active Stock removal.

**5. Before keeping a neighbouring feature, check it has live callers.** The Active Stock plan kept "Use up ingredients" (its R11) because the code read as working: templates, helpers, a Vault button. In fact the button called `openUseUpRecipeFinder()`, which nothing defined, and none of the helpers had a caller. It was removed in 3.51.0 (`docs/plans/2026-10-30-1212-refactor-remove-use-up-ingredients-plan.md`). Two cheap checks would have caught it. First, grep for callers of the exported functions outside their own files. Second, run a copy of `scripts/test_dead_controls.js` with its `OUT_OF_SCOPE` exclusion removed. A guard exclusion is exactly where unchecked dead code hides.

## Why This Matters

Each trap fails quietly. Getting 1 wrong breaks the app at module load. Getting 2 wrong leaves a red guard that looks like a real dead control. Getting 3 wrong passes in Node, because there is no `indexedDB` there and the fallback always runs, yet the stale data stays on both phones. Getting 4 wrong produces a rules change that deploys, passes a careless test, and closes nothing. Getting 5 wrong commits a plan to keeping something that never worked, and the next session has to unpick that decision.

## When to Apply

- Any removal that touches `componentRegistry.js`, `src/store/`, `cacheSlice.js` or a Firestore collection.
- Any clean-up of something that older releases cached on the phones.

## Examples

- Guard tests that keep a removal from coming back: `scripts/test_no_active_stock.js`, a text scan of `src/` and `index.html` with a reasoned allowlist, and `scripts/test_stock_data_removed.js`. The second test fakes IndexedDB so that both cache paths, IndexedDB and the localStorage fallback, are exercised.
- To prove "nothing else changed", record the output of the affected functions with the feature's data empty before editing, and assert the same output afterwards. `scripts/test_plan_generator.js` and `scripts/test_shopping_list.js` do this.

## Related

- Plan: `docs/plans/2026-10-30-0748-refactor-remove-active-stock-plan.md`
- `docs/solutions/runtime-errors/sw-precache-one-missing-path-empties-the-cache.md`: an earlier case of a removed module leaving a silent dangling reference.
- `docs/solutions/integration-issues/pages-served-the-unbuilt-repo-so-version-placeholders-went-live.md`: only `main.js` and `firebase-config.js` carry `?v=`, so a cached older module can import a file now in `attic/` for a few minutes after release.
