---
title: GitHub Pages served the unbuilt repo, so the version placeholders went live and the build never ran
date: 2026-10-28
category: integration-issues
module: hosting and release (GitHub Pages, scripts/build.js)
problem_type: integration_issue
component: infrastructure
symptoms:
  - "The live page source showed literal __APP_VERSION__ and __BUILD_ID__ in its meta tags and ?v= strings"
  - "The header showed a hand-typed v3.45.7 while package.json said 3.35.4"
  - "Nobody could tell which release a phone was running"
root_cause: config_error
resolution_type: config_change
severity: medium
related_components:
  - development_workflow
  - frontend
tags: [github-pages, github-actions, deploy, build, version-stamping, placeholders, release-order, service-worker, cache]
---

# GitHub Pages served the unbuilt repo, so the version placeholders went live and the build never ran

## Problem

`index.html` and `sw.js` held `__APP_VERSION__` / `__BUILD_ID__` placeholders that `scripts/build.js` stamps into `dist/`. But GitHub Pages was set to "Deploy from a branch" (`main`, root), and branch deploys never run `npm run build`. So the build was dead code for users: the live site served the raw placeholders, and the only visible version was a stale constant typed into `src/main.js`.

## Symptoms

- Live page source contained the literal placeholders (checked with `curl`).
- `gh api repos/ElliottC99/PlatePlan/pages` reported `build_type: legacy`, `source: main /`.
- AI Studio syncs straight to GitHub and never runs the build either, so no human or tool step stamped anything.

## What Didn't Work

- Stamping only into `dist/` while Pages served the root: correct build, never published.
- Treating the never-changing service-worker cache name as the reason phones might miss updates. It wasn't: `src/main.js` unregistered every service worker and wiped every cache on each load, so updates already reached phones (Elliott's installed phone showed a new release on 2026-10-28). The real gap was only that no one could see which release had arrived.

## Solution

Publish the built copy through GitHub Actions (`.github/workflows/pages.yml`):

- `npm run build` runs on every push to `main`, `development` and `dev/**`, so a broken build shows on a branch before release.
- Only `main` uploads `dist/` (`actions/upload-pages-artifact`) and deploys it (`actions/deploy-pages`); the deploy job `needs: build`, so a failed build publishes nothing and the previous release stays live.
- `scripts/build.js` fails, naming the file, if any placeholder survives in what the page loads (it skips `dist/scripts/`, which names the placeholders on purpose).
- `package.json` `version` is the only typed number; the build stamps it and `git rev-parse --short HEAD` into `index.html` meta tags, and `formatAppVersion` in `src/core/AppInitializer.js` renders the header as `3.46.0 (ad2339d)`, or `dev` on an unbuilt page.

Repo admin must set Settings → Pages → Source to **GitHub Actions**. Verified live 2026-10-28: run 40704668335 deployed `ad2339d`, the page carried `3.46.0` / `ad2339d` with no placeholders, and both phones read `3.46.0 (ad2339d)`.

## Why This Works

The only artifact users load is now the build's output, and the build is the one place the version is stamped, so the version cannot drift from what was released.

## Prevention

- **Release order:** switch Pages to "GitHub Actions" *before* pushing `main`. Switching the source with no deployment pending leaves the last deployment live (observed 2026-10-28), so there is no gap. Pushing first makes the deploy job fail against a branch-source site and needs a manual rerun.
- **Branch deploys mean "what's committed is what's served".** If Pages is ever switched back to "Deploy from a branch", the header shows `dev` and placeholders return; check `build_type` with `gh api repos/ElliottC99/PlatePlan/pages`.
- **Module version skew after a release:** only `main.js` and `firebase-config.js` carry `?v=<commit>`; the modules they import do not, and Pages sends `cache-control: max-age=600`. For about 10 minutes a phone can pair a new `main.js` with an older cached module. Code in `initApp` that calls a newly added export must tolerate its absence (the version label checks `typeof AppInitializer.formatAppVersion === 'function'`), or the outer `try` skips sign-in and hydration for that load.

## Related Issues

- `docs/plans/2026-10-28-1153-fix-version-stamping-plan.md` (R11 and KTD7 hold the release order)
- `docs/solutions/runtime-errors/sw-precache-one-missing-path-empties-the-cache.md` (service worker since removed)
