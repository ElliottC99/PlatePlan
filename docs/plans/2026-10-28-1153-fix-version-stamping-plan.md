---
title: Version Stamping and Service Worker Removal - Plan
type: fix
date: 2026-10-28
topic: version-stamping
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Version Stamping and Service Worker Removal - Plan

## Goal Capsule

- **Objective:** Anyone looking at PlatePlan on a phone can see exactly which release it is running, and the app no longer carries a service worker that does nothing.
- **Means:** GitHub Pages publishes the built site from a GitHub Actions workflow on every push to `main`; the build stamps the version, and the service worker is removed (KTD1, KTD4).
- **Product authority:** Barrie made this work's product decisions and agrees them with Elliott, who owns the repo settings. The Product Contract wins on behaviour; KTDs win on mechanism.
- **Execution profile:** U1–U6 run step by step with Barrie on a `dev/*` branch, not autonomously. U7 is the release and needs Elliott.
- **Stop conditions:** stop and ask if the GitHub build fails for a reason the plan did not foresee, if removing the service worker breaks sign-in, Today, Step 3 or saving, or if anything would push to `main` before R11 is met.
- **Who finishes:** Claude carries out U1–U6 and the U7 pushes with Barrie's approval at each push or merge. Elliott switches the Pages setting, and Elliott and Chloe confirm on their phones.
- **Open blockers:** Elliott switched Pages to "GitHub Actions" early, on 2026-10-28. Barrie has asked him to switch it back to "Deploy from a branch". Nothing goes to `main` until Elliott confirms that (R11). U1–U6 are not blocked.

---

## Product Contract

Product Contract preservation: unchanged.

### Summary

Every push to `main` builds the site on GitHub and publishes the built copy. Each release shows one version in the app: a deliberately bumped number plus the commit ID, for example `3.46.0 (217f485)`. The service worker and its precache list are removed, and phones that still hold the old worker drop it without anyone acting.

### Problem Frame

Nobody can tell which release a phone is running. The header badge shows `v3.45.7`, hand-typed in `src/main.js`. The page's version tags show the literal `__APP_VERSION__`, because GitHub Pages serves the repo as committed and never runs `scripts/build.js`, which is the only thing that fills them in. `package.json` says `3.35.4`. Three sources disagree and none of them changes on release.

The service worker looks like it matters but does nothing. `src/main.js` registers `sw.js`, and also unregisters every service worker and deletes every cache on each load (present since the original import). So there is no offline use, the hand-kept precache list in `sw.js` protects nothing, and the cache names never changing is harmless. On 2026-10-28 Elliott confirmed on his installed phone that the 217f485 release reached it: Today showed meals and an eaten tick stuck. Updates already arrive; what is missing is being able to see which one arrived.

The dead service worker still costs effort. The 2026-10-27 round had to keep its precache list in step with deleted modules (`docs/solutions/runtime-errors/sw-precache-one-missing-path-empties-the-cache.md`), and project guidance tells Elliott's AI to maintain it.

### Key Decisions

- **Show a bumped number and the commit ID together.** The commit ID keeps the version true when nobody bumps the number. (session-settled: user-directed — chosen over an automatic-only identifier and a bumped-only number: the number carries meaning and the commit ID never goes stale.) Governs R1, R2, R3.
- **Publish through a GitHub Actions workflow.** It is the only way to stamp the commit ID, because AI Studio syncs straight to GitHub and never runs the build. (session-settled: user-directed — chosen over keeping Pages serving `main` unbuilt, which would allow only a bumped number.) Governs R5, R6, R7.
- **Remove the service worker instead of making it work.** It provides nothing today, and keeping it costs maintenance. (session-settled: user-directed — chosen over a version-only change that leaves it, and over a working offline service worker: offline use was not wanted at that cost.) Governs R8, R9.
- **Next number is 3.46.0.** It sits above the `v3.45.7` people have seen and the `3.35.4` in `package.json`, so the shown version never appears to go backwards. Governs R2.

### Requirements

**Version shown**

- R1. The app header shows one version for the running release, made of the bumped number and the short commit ID.
- R2. The bumped number is typed in exactly one place, starts at 3.46.0, and every other place that shows or records a version takes it from there.
- R3. The commit ID is filled in at release time without anyone typing it.
- R4. The page's version tags and stylesheet and script version strings show the same release as the header, never a literal placeholder.

**Release path**

- R5. Every push to `main`, including AI Studio syncs, builds the site and publishes the built copy to the existing Pages address.
- R6. A push whose build fails is not published, and the previously published release stays live.
- R7. The build fails if any version placeholder survives in the output it would publish.

**Service worker removal**

- R8. The app no longer registers a service worker, and the service worker file, its precache list and its update-banner code are removed.
- R9. A phone that still has the old service worker registered loses it, and its caches, on its next opens without the user doing anything.
- R10. Removing the service worker leaves sign-in, Today, the planner's Step 3 and saving working as before.

**Rollout**

- R11. Nothing is pushed to `main` until Elliott confirms Pages is back on "Deploy from a branch", so any push to `main` before this work is released still publishes. At release, Elliott switches Pages to "GitHub Actions" before `development` is merged into `main`.

**Guidance and tests**

- R12. `CLAUDE.md`, `workflow-enforcer.md` and `plateplan-architecture.md` describe the new release path, where the version number lives, and that there is no service worker, so Elliott's AI works from the right model.
- R13. `scripts/test_pwa_build.js` checks the new version scheme and the absence of a service worker, instead of the old v3.30.0 values.

### Acceptance Examples

- AE1. **Covers R1, R3, R4.** **Given** `main` is at commit `abc1234` with version 3.46.0, **when** a phone opens the live site after the deploy finishes, **then** the header shows `3.46.0 (abc1234)` and the page source contains no `__APP_VERSION__` or `__BUILD_ID__`.
- AE2. **Covers R3.** **Given** an AI Studio sync pushes to `main` without bumping the number, **when** the deploy finishes, **then** the header shows the same number with the new commit ID.
- AE3. **Covers R6, R7.** **Given** a push to `main` whose build fails or leaves a placeholder, **when** the workflow runs, **then** nothing is published and the site still serves the previous release.
- AE4. **Covers R9.** **Given** Elliott's phone, which had the old worker registered, **when** he opens the app twice after the release, **then** no service worker is registered for the site and the app shows the new version.

### Scope Boundaries

- Offline use: there is none today and this work adds none.
- An "update available" banner or prompt.
- Publishing `development` or `dev/*` branches anywhere. They are built on GitHub as a check (KTD3) but never published.
- The `/** src/path/File.js (vX.Y.Z) */` header comments in modules; they are not shown to users.
- Narrowing the Firestore rules to `households/elliott-chloe`.
- The other Deferred to Follow-Up items in `docs/plans/2026-10-27-1549-fix-today-and-step3-shopping-plan.md`.
- Considered and not built: a version string on module imports inside `src/` (`import ... from './x.js'`). Pages' 10-minute browser cache already bounds staleness, and Elliott's phone showed updates arriving; revisit only if a phone is seen mixing old and new modules after a release.
- Considered and not built: trimming `scripts/`, `server.js` and `package.json` from the published copy. The repo is public, so publishing them exposes nothing new.

### Dependencies / Assumptions

- Elliott has admin on `ElliottC99/PlatePlan`; Barrie has push only (`admin: false` via the GitHub API, 2026-10-28), so both Pages switches are Elliott's.
- On 2026-10-28 Pages reported `build_type: workflow` with no workflow in the repo, and its latest build was 217f485 at 09:49:48 UTC. The live site kept serving that build, so switching the source does not take the site down; the last deployment stays live until a new one replaces it.
- GitHub Pages sends `cache-control: max-age=600`, so a release can take up to about 10 minutes to reach a phone. That is the same as today.
- Chrome on Android has offered "Install app" with no service worker since version 108, and iOS Add to Home Screen has never needed one. Assumed, not yet seen: both phones' installed apps keep opening after the worker is gone (checked in U7).
- `docs/plans/2026-10-27-1549-fix-today-and-step3-shopping-plan.md` treated this fix as blocking its U8 release. Barrie released U8 on 2026-10-28 before this fix, and Elliott's phone confirmed it, so this plan blocks nothing.

### Sources / Research

- `src/main.js` hand-typed `APP_VERSION` and its header badge and stored-version use in `initApp`; the `AppInitializer.registerServiceWorker()` call in `initApp`; the unregister-all and cache-wipe block at module level.
- `scripts/build.js` already copies the site into `dist/` and stamps `index.html` and `sw.js`.
- `src/core/AppInitializer.js` service worker registration, `showUpdateBanner` and `checkAndUpdateApp` (no callers outside the file).
- `index.html` version meta tags (lines 16–17), stylesheet links (68–71) and script tags (1336–1339).
- `server.js` serves `dist/` when built, else the repo root.
- `scripts/test_pwa_build.js` still asserts v3.30.0, reads deleted `PlatePlan.html`, and expects manifest `start_url` `/` where `manifest.json` has `./`.
- `workflow-enforcer.md` and `plateplan-architecture.md` "Stamp, Don't Type".
- `docs/solutions/runtime-errors/sw-precache-one-missing-path-empties-the-cache.md`.
- [Revisiting Chrome's installability criteria](https://developer.chrome.com/blog/update-install-criteria) — no service worker needed to install since Chrome 108 on mobile.
- [W3C ServiceWorker issue #204 discussion](https://lists.w3.org/Archives/Public/public-webapps-github/2017Nov/0565.html) — a 404 on the worker script is not clearly specified to unregister it.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **`package.json` `version` is the only typed number; the build stamps it, with the short commit ID, into `index.html`, and the app reads both from the page's meta tags.** `index.html` gains a build-ID meta tag beside the existing version tags. `src/main.js` stops carrying its own constant. This keeps `index.html` the single place the running page learns its version, as `workflow-enforcer.md` asks. Governs R1, R2, R3 (Key Decision "Show a bumped number and the commit ID together").
- KTD2. **The build refuses to finish if any `__APP_VERSION__` or `__BUILD_ID__` remains in what the page loads: every text file in `dist/` except `dist/scripts/`.** `dist/scripts/` holds build and test tooling that names the placeholders on purpose. `scripts/build.js` already has a verification step; the placeholder scan joins it and names each offending file. Governs R7.
- KTD3. **One workflow file builds on every push to `main`, `development` and `dev/**`, and publishes only from `main`.** The deploy job depends on the build job and runs only for `main`, using GitHub's Pages artifact upload and deploy actions, with Pages and ID-token write permission and a single-flight concurrency group. Building other branches proves the build works on GitHub before release without publishing them. A manual run trigger lets Elliott republish after switching the setting. Governs R5, R6 (Key Decision "Publish through a GitHub Actions workflow").
- KTD4. **The cleanup that unregisters every service worker and deletes every cache on load stays permanently; registration, `sw.js` and the update-banner code go.** A missing `sw.js` is not reliably enough to unregister a worker already on a phone, and the cleanup costs nothing on phones that have none. Its reload-on-`controllerchange` listener goes, since nothing will take control any more. Governs R8, R9 (Key Decision "Remove the service worker instead of making it work").
- KTD5. **Stylesheet and script links carry the commit ID as their `?v=` value.** Each release then asks for fresh copies of those files, including releases that do not bump the number. Governs R4.
- KTD6. **When the page still holds placeholders, the app shows `dev`.** That covers `npm run dev` on unbuilt files and the gap if Pages ever serves `main` unbuilt again. The version-formatting logic lives in `src/core/AppInitializer.js`, which already owns bootstrapping and imports nothing, so a test can load it without Firebase. Governs R1.
- KTD7. **Release order: Elliott switches Pages to "GitHub Actions" first, then `development` is merged to `main`.** The switch alone leaves the last deployment live (seen 2026-10-28), so there is no gap; the push then deploys. If the push came first, its deploy job would fail against a branch-source site and need a manual rerun. Governs R11.

### High-Level Technical Design

```mermaid
flowchart LR
  P[push] --> B{branch}
  B -->|dev/**, development| BO[build job only:<br/>build.js stamps dist/,<br/>placeholder scan]
  B -->|main| BM[build job] --> D[deploy job:<br/>publish dist/ to Pages]
  BM -->|build or scan fails| X[nothing published,<br/>previous release stays live]
  D --> S[site serves index.html with<br/>version + build-ID meta]
  S --> A[app reads meta,<br/>header shows 3.46.0 (abc1234)]
```

### Assumptions

- `git rev-parse --short HEAD` works in a shallow GitHub Actions checkout, so the existing hash step in `scripts/build.js` needs no change.
- No module outside `src/main.js` imports `APP_VERSION` (grep, 2026-10-28).
- The store's own cache key in `src/store/cacheSlice.js` is unrelated to the release version and stays as it is.

### Sequencing

U1 lands first. U2 and U3 can then land in either order, and all three precede U5, whose tests cover them. U4 needs U1's placeholder scan. U6 follows U1–U5 so the guidance describes what exists. U7 needs everything else plus R11.

---

## Implementation Units

### U1. Stamp one version source and refuse leftover placeholders

- **Goal:** `npm run build` produces a `dist/` whose `index.html` carries the `package.json` version and the commit ID, and the build fails if any placeholder survives.
- **Requirements:** R2, R3, R4, R7; KTD1, KTD2, KTD5.
- **Dependencies:** none.
- **Files:** `package.json`, `scripts/build.js`, `index.html`, `scripts/test_pwa_build.js`.
- **Approach:**
  1. Set `package.json` `version` to 3.46.0.
  2. In `index.html`, add a build-ID meta tag next to the version tags, and change the stylesheet and script `?v=` values to the build-ID placeholder.
  3. In `scripts/build.js`, stop copying `sw.js` and drop it from the required artifacts, keep the existing stamping of `index.html`, and add the placeholder scan per KTD2, which fails the build and names the files.
- **Patterns to follow:** the existing stamping loop and missing-artifact check in `scripts/build.js`.
- **Test scenarios:** in U5.
- **Verification:** `npm run build` succeeds and `dist/index.html` shows 3.46.0 and the current short hash; adding a stray placeholder to a copied file makes the build fail and name it.

### U2. Show the stamped version in the app

- **Goal:** the header badge shows `3.46.0 (abc1234)` on a built page and `dev` on an unbuilt one.
- **Requirements:** R1, R2; AE1; KTD1, KTD6.
- **Dependencies:** U1 (meta tag exists).
- **Files:** `src/core/AppInitializer.js`, `src/main.js`, `scripts/test_pwa_build.js`.
- **Approach:**
  1. Add a small exported function to `src/core/AppInitializer.js` that turns the version and build-ID meta values into the display string, returning `dev` when either is empty or still unstamped. Detect unstamped values by shape (a value wrapped in double underscores) rather than by naming the placeholders, so `src/` never contains the literal placeholder strings that KTD2's scan rejects.
  2. In `src/main.js`, remove the `APP_VERSION` constant and use that function's result for the header badge and the stored-version sync in `initApp`.
- **Patterns to follow:** the existing badge update in `initApp`.
- **Test scenarios:** in U5.
- **Verification:** on `npm run dev` with no `dist/`, the badge reads `dev`; after `npm run build`, the badge reads `3.46.0 (<hash>)`.

### U3. Remove the service worker and keep the cleanup

- **Goal:** the app registers no service worker, `sw.js` is gone, and phones with an old worker lose it.
- **Requirements:** R8, R9, R10; AE4; KTD4.
- **Dependencies:** none.
- **Files:** `sw.js` (delete), `src/core/AppInitializer.js`, `src/main.js`, `scripts/test_pwa_build.js`.
- **Approach:**
  1. Delete `sw.js`.
  2. In `src/core/AppInitializer.js`, remove `showUpdateBanner`, `checkAndUpdateApp`, `initServiceWorker`, the `registerServiceWorker` alias, their module flags, and the `registerServiceWorker()` call in `initPlatePlanApp`.
  3. In `src/main.js`, remove the `AppInitializer.registerServiceWorker()` call and the `controllerchange` reload listener. Keep the unregister-all and cache-wipe block, with a one-line comment saying why it stays (KTD4).
  4. Grep `index.html` and `src/` for any remaining reference to the removed names or `sw.js`.
- **Execution note:** a browser smoke check matters more than unit coverage here. Use one signed-in load on localhost and check the console, to stay inside the read quota (`docs/solutions/workflow-issues/localhost-testing-uses-the-household-firestore-read-quota.md`).
- **Test scenarios:** in U5.
- **Verification:** on localhost, after one load, no service worker is registered for the origin, the console has no errors, and Today and Step 3 render.

### U4. Publish from a GitHub Actions workflow

- **Goal:** pushes build on GitHub, and only `main` publishes the built copy to Pages.
- **Requirements:** R5, R6; AE2, AE3; KTD3.
- **Dependencies:** U1.
- **Files:** `.github/workflows/pages.yml` (new).
- **Approach:** one workflow per KTD3: a build job (checkout, Node, `npm run build`, upload `dist/` as the Pages artifact) on pushes to `main`, `development` and `dev/**` plus manual runs, and a deploy job that needs the build and runs only on `main`. Pin each action to a current major version.
- **Execution note:** this is configuration; prove it by a real run. Pushing the `dev/*` branch must show a green build job and a skipped deploy job.
- **Test expectation:** none -- workflow configuration, proven by the GitHub run in Verification.
- **Verification:** the pushed `dev/*` branch shows a successful build and no deploy in the Actions tab.

### U5. Rewrite the build test for the new scheme

- **Goal:** `node scripts/test_pwa_build.js` proves U1–U3 instead of asserting v3.30.0.
- **Requirements:** R13; AE1; covers U1, U2, U3.
- **Dependencies:** U1, U2, U3.
- **Files:** `scripts/test_pwa_build.js`.
- **Approach:** replace the old assertions. The test runs the build, inspects `dist/`, imports the formatting function from `src/core/AppInitializer.js` under the stubs used by `scripts/test_today_view.js`, and reads source files for the service-worker checks. Keep the manifest check, corrected to `start_url` `./`.
- **Patterns to follow:** `node:assert` style and `window` stubs in `scripts/test_today_view.js`.
- **Test scenarios:**
  - Covers AE1. After the build, `dist/index.html` contains no `__APP_VERSION__` or `__BUILD_ID__`, its version meta equals `package.json` `version`, and its build-ID meta is a short hex hash.
  - The stylesheet and script `?v=` values in `dist/index.html` equal the build-ID meta.
  - `package.json` `version` is 3.46.0, and `src/main.js` declares no `APP_VERSION` constant and holds no quoted version string such as `'v3.45.7'` (its `(v3.39.2)` header comment is out of scope and stays).
  - The formatting function returns `3.46.0 (abc1234)` for those two values.
  - It returns `dev` when either value is empty or is still an unstamped placeholder.
  - No file under `src/` contains the literal `__APP_VERSION__` or `__BUILD_ID__`.
  - A `dist/` file containing a placeholder makes the build's scan fail and name that file.
  - `sw.js` exists in neither the repo root nor `dist/`, and no file under `src/` or `index.html` calls `serviceWorker.register`.
  - `src/main.js` still unregisters service workers and deletes caches.
  - `manifest.json` has `display` `standalone`, `start_url` `./` and at least four icons.
- **Verification:** the test exits 0, and it fails if any one scenario's condition is reversed.

### U6. Update the guidance Elliott's AI reads

- **Goal:** project guidance matches the new release path and the missing service worker.
- **Requirements:** R12.
- **Dependencies:** U1–U5.
- **Files:** `CLAUDE.md`, `workflow-enforcer.md`, `plateplan-architecture.md`, `docs/solutions/runtime-errors/sw-precache-one-missing-path-empties-the-cache.md`.
- **Approach:**
  1. `CLAUDE.md`: Pages now publishes the build from the workflow on pushes to `main`. Bump `package.json` `version` for a meaningful release; the commit ID is automatic. There is no service worker. Drop the old Versioning known bug and the precache instruction. The known failing tests drop to three.
  2. `workflow-enforcer.md` and `plateplan-architecture.md`: "Stamp, Don't Type" names `package.json` as the number's home and the build as the stamper, and drops "sw.js manifests".
  3. The precache learning gets a short note at the top that `sw.js` was removed on this date, so the lesson applies only if a service worker returns.
- **Test expectation:** none -- documentation only.
- **Verification:** none of the four files tells a reader to maintain `sw.js`, its precache list or a hand-typed version.

### U7. Release with Elliott

- **Goal:** the live site publishes from the workflow and both phones show the stamped version.
- **Requirements:** R11; AE1, AE3, AE4; KTD7.
- **Dependencies:** U1–U6, and Elliott's confirmation that Pages is on "Deploy from a branch" (R11).
- **Files:** none expected.
- **Approach:**
  1. With Barrie's approval, push the `dev/*` branch and check U4's build run.
  2. Merge into `development` and push; check the build run again.
  3. Elliott switches Pages to "GitHub Actions" and confirms.
  4. With Barrie's approval, merge `development` into `main` and push; watch the deploy job.
  5. Check the live page shows the new version and contains no placeholders, then ask Elliott and Chloe to open the app twice and read the header.
  6. If the deploy fails, the previous release stays live (R6); fix forward on a branch, or have Elliott switch back to "Deploy from a branch".
- **Test expectation:** none -- release; confirmed on the live site and the phones.
- **Verification:** the live page source shows `3.46.0` and the deployed commit's hash, and both phones' headers show `3.46.0 (<hash>)`.

---

## Verification Contract

| Gate | Command or check | Applies to | Passes when |
|---|---|---|---|
| Build test | `node scripts/test_pwa_build.js` | U1, U2, U3, U5 | exits 0 |
| Build | `npm run build` | U1 | succeeds; `dist/index.html` stamped, no `dist/sw.js` |
| Full script suite | each `node scripts/test_*.js` and `node test_vault_fit_score.js` | all code units | only `test_accessibility_dom`, `test_plan_generator` and `test_recipe_wizard` fail |
| Syntax | `node --check <changed file>` | every changed `.js` | no errors |
| Browser smoke | one signed-in load of `npm run dev` | U2, U3 | no console errors; Today and Step 3 render; no service worker registered |
| GitHub build | Actions run for the pushed `dev/*` branch | U4, U7 | build job green, deploy job skipped |
| Live release | live page source and phone headers | U7 | `3.46.0 (<hash>)`, no placeholders |

---

## Definition of Done

- U1–U7 each meet their Verification line, and the Verification Contract gates pass for the units they apply to.
- `main` publishes from the workflow, and Elliott and Chloe have each read `3.46.0 (<hash>)` on their phone.
- No experimental or abandoned code remains in the diff, and no temporary test helpers are left in the page or repo.
- `dist/` is not committed.
