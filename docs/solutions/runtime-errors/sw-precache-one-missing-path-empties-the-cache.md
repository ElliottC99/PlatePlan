---
title: One missing path in the sw.js precache list leaves the whole precache empty, with only a console warning
date: 2026-10-27
category: runtime-errors
module: service worker (sw.js)
problem_type: runtime_error
component: frontend
symptoms:
  - "The service worker installs, but none of the precache list is in the cache"
  - "The console shows \"Non-fatal precache warning\" during install"
  - "Offline, screens whose modules were never fetched online fail to load"
root_cause: missing_workflow_step
resolution_type: code_fix
severity: medium
related_components:
  - infrastructure
tags: [service-worker, sw-js, precache, cache-addAll, offline, module-removal]
---

# One missing path in the sw.js precache list leaves the whole precache empty, with only a console warning

> **Update 2026-10-28:** `sw.js` and its precache list were removed (`docs/plans/2026-10-28-1153-fix-version-stamping-plan.md`). This lesson applies only if a service worker is added back.

## Problem

`sw.js` precaches an explicit, hand-kept list of files (`PLATEPLAN_PRECACHE_ASSETS`). On 2026-10-27, removing the unlinked Shopping screen deleted four modules: ShoppingListUI, ShoppingListToolbar, ShoppingListView and ShoppingAisleGroup. Their paths had to come off that list in the same commit (`5ee2c08` on `dev/review-state`, pending merge to `main`).

That commit's message says the install "would otherwise fail". That overstates it. The real effect is quieter:

## Root cause

The install handler does this:

```js
await cache.addAll(PLATEPLAN_PRECACHE_ASSETS).catch(err => {
  console.warn(`[SW ${PLATEPLAN_APP_VERSION}] Non-fatal precache warning:`, err);
});
```

`cache.addAll` is all-or-nothing. If any one URL returns a 404, it rejects and stores **none** of the list. The `.catch` turns that into a warning, so the service worker installs and activates as normal. The app still works online, and the fetch handler caches files as they're requested. But anything not yet fetched online is missing offline. Nobody sees a failure unless they read the console during install.

## Solution

When a module is deleted or renamed, remove or update its path in `PLATEPLAN_PRECACHE_ASSETS` in the same commit. To check that every listed path exists, run from the repo root:

```bash
node -e "
const fs=require('fs');const s=fs.readFileSync('sw.js','utf8');
const m=s.match(/PLATEPLAN_PRECACHE_ASSETS = \[([\s\S]*?)\];/)[1];
const p=[...m.matchAll(/'([^']+)'/g)].map(x=>x[1].split('?')[0]).filter(x=>x&&x!=='./');
console.log(p.length,'paths; missing:',p.filter(x=>!fs.existsSync(x)));"
```

On 2026-10-27, after `5ee2c08`, it reported 97 paths and none missing.

## Prevention

- Run the check above whenever a module is added, renamed or deleted. CLAUDE.md already covers adding.
- When testing the service worker, look for "Non-fatal precache warning" in the console. Its absence is the only sign that the precache succeeded.
- The cache names are built from `__APP_VERSION__`, which GitHub Pages serves unstamped (see CLAUDE.md, Versioning). They never change, so the old caches are never cleared on activate. Don't assume a corrected list gives installed phones a fresh cache until the version-stamping fix ships.
