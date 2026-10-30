---
date: "2026-10-30"
problem_type: "runtime_error"
component: "environment_config"
severity: "high"
symptoms:
  - ":3000/src/utils/fitScoreCalculator.js:1 Failed to load resource: net::ERR_CONNECTION_RESET"
  - "Uncaught FirebaseError: Firebase: No Firebase App '[DEFAULT]' has been created - call Firebase App.initializeApp() (app-compat/no-app)"
  - "Uncommitted JS/CSS changes in dist/ not appearing on localhost:3000 after refresh"
root_cause: "wrong_config_value"
tags:
  - localhost
  - express
  - es-modules
  - firebase-auth
  - cache-busting
  - build-id
related_issues: []
related_solutions:
  - "floating-scroll-to-top-button-pattern-20261030.md"
related_exploration: "scroll-to-top-and-protein-emoji-20261030.md"
last_referenced: "2026-10-30"
---

# ES Module Connection Reset & Local Build Cache-Busting on `localhost:3000`

## Problem Statement

**What happened:**
When serving `dist/` locally on `http://localhost:3000` to verify uncommitted UI changes:
1. The browser cached old `?v=<git-hash>` URLs for `src/main.js` and `styles/responsive.css` because `git rev-parse --short HEAD` had not changed yet.
2. When serving `dist/` with Python's single-threaded `socketserver.TCPServer` (`http.server`), hard-refreshing the browser caused `net::ERR_CONNECTION_RESET` on ES module imports (`fitScoreCalculator.js`), aborting `src/main.js` before `firebase.initializeApp()` could execute.

**Impact:**
Developers testing uncommitted changes locally could not see newly mounted components (`ScrollToTopButton.js`) and could not authenticate with Firebase (`firebase.auth().signInWithPopup(...)` threw `app-compat/no-app`).

## Symptoms

The following symptoms were observed:

1. **ES Module Connection Reset & Firebase Initialization Failure**
   - Console error: `:3000/src/utils/fitScoreCalculator.js:1 Failed to load resource: net::ERR_CONNECTION_RESET`
   - Console error when running `firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())`:
     ```text
     Uncaught FirebaseError: Firebase: No Firebase App '[DEFAULT]' has been created - call Firebase App.initializeApp() (app-compat/no-app).
     ```
   - Occurred immediately after a hard refresh (`Cmd+Shift+R`) against a Python `socketserver.TCPServer` dev server.

2. **Stale Assets in `dist/` Before Git Commit**
   - `scripts/build.js` stamps `__BUILD_ID__` with `git rev-parse --short HEAD`.
   - When rebuilding `dist/` multiple times before committing, `?v=f74a8c6` stayed identical, causing the browser to serve cached `src/main.js?v=f74a8c6` and `styles/responsive.css?v=f74a8c6`.

## Investigation Steps

### What Was Tried

| Attempt | Hypothesis | Result |
|---------|------------|--------|
| 1. Build `dist/` with git hash `__BUILD_ID__` and serve via Python `socketserver.TCPServer` | Standard static server should serve `dist/` on port 3000 | ❌ Browser cached `?v=f74a8c6` from prior run; hard refresh overwhelmed single-threaded Python socket backlog across 189 ES modules |
| 2. Stamp `__BUILD_ID__` with `<git-hash>-<timestamp>` for uncommitted local builds | Unique query string forces browser to fetch updated `src/main.js` and `styles/responsive.css` | ✅ Browser fetched latest modules, but Python `TCPServer` still reset connections under 189-module burst |
| 3. Run `/usr/local/bin/node server.js` (Express) instead of Python `TCPServer` | Node/Express uses an asynchronous event loop (`libuv`) that handles 189+ concurrent HTTP requests without dropping sockets | ✅ Zero `ERR_CONNECTION_RESET` errors; `src/main.js` and `firebase.initializeApp()` completed cleanly; Google Auth popup succeeded |

### Key Discoveries

- **Discovery 1 (189 ES Modules Burst):** PlatePlan uses native ES modules without bundling (`189` live modules in `src/`). A single page load triggers ~190 concurrent HTTP GET requests within milliseconds. Single-threaded servers like `socketserver.TCPServer` have a default listen backlog of `5`, causing the OS kernel to send TCP RST (`net::ERR_CONNECTION_RESET`) on queued module requests.
- **Discovery 2 (Why Firebase Failed):** In ES modules, if *any* static dependency in the import graph fails with `ERR_CONNECTION_RESET` (such as `src/utils/fitScoreCalculator.js`), the browser aborts execution of the entire module tree (`src/main.js`), so `initializeFirebase()` in `src/config/firebase.js` never runs.
- **Discovery 3 (Node Path in Agent Shell):** On macOS with Antigravity's non-login `zsh` shell, `/usr/local/bin` may not be in default `$PATH`. Invoking `/usr/local/bin/node` directly reliably executes Node and Express.

## Root Cause Analysis

**The actual problem:**
1. Python's `socketserver.TCPServer` processes requests synchronously one at a time with a tiny socket backlog (`request_queue_size = 5`), which cannot handle PlatePlan's 189-module ES6 import graph.
2. `index.html` relies on `?v=__BUILD_ID__` cache-busting, which only changes on a new Git commit unless a timestamp suffix is appended during uncommitted local testing.

**Why it happened:**
Because `node` wasn't on the default shell `$PATH`, a Python static server was used as a fallback instead of locating `/usr/local/bin/node` and running PlatePlan's built-in Express server (`server.js`).

## Lessons Learned

### Mistakes Made

- **Assumption:** `node` was not installed because `which node` failed in the default sandboxed shell `$PATH`.
  - **Why it was wrong:** `/usr/local/bin/node` was installed on the host machine, just outside the minimal `/usr/bin:/bin:/usr/sbin:/sbin` `$PATH`.
  - **Correction:** Always check `/usr/local/bin/node` on macOS and use `server.js` (Express) to serve PlatePlan.

### Key Breakthroughs

- **Insight:** `Firebase: No Firebase App '[DEFAULT]' has been created` was a *downstream symptom* of `net::ERR_CONNECTION_RESET` on `fitScoreCalculator.js` aborting the ES module graph before `src/main.js` could run.
- **Impact:** Switching from Python `TCPServer` to `/usr/local/bin/node server.js` immediately resolved both the module load error and Firebase authentication.

### What We'd Do Differently

- Always start PlatePlan's local server via `/usr/local/bin/node server.js`.
- When rebuilding `dist/` for uncommitted changes, append a timestamp to `__BUILD_ID__` so the browser never serves stale `?v=<git-hash>` assets.

## Working Solution

### The Fix

```bash
# 1. Build dist/ using Node
/usr/local/bin/node scripts/build.js

# 2. Always serve dist/ using PlatePlan's Express server (handles 189 concurrent ES modules)
/usr/local/bin/node server.js
```

When signing into Firebase from the `localhost:3000` DevTools console after switching port or clearing site data:

```javascript
firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).then(() => location.reload())
```

### Verification

```bash
# Verify Express server responds and serves dist/index.html cleanly
curl -I http://localhost:3000
```

## Prevention Strategies

### Immediate Prevention

- [x] Always invoke `/usr/local/bin/node` directly in shell commands when `/usr/local/bin` is not in `$PATH`.
- [x] Never use `python3 -m http.server` or single-threaded `socketserver.TCPServer` for PlatePlan's unbundled ES module architecture.

### Long-term Prevention

- **Pattern to follow:** Use `/usr/local/bin/node server.js` for all local verification on `http://localhost:3000`.
- **Early detection:** If `Uncaught FirebaseError: Firebase: No Firebase App '[DEFAULT]' has been created` appears in the console, check the Network/Console tab immediately above it for a failed ES module load (`ERR_CONNECTION_RESET` or `404`).

## Cross-References

### Related Solutions

- [floating-scroll-to-top-button-pattern-20261030.md](../ui-bugs/floating-scroll-to-top-button-pattern-20261030.md)
- Exploration: [scroll-to-top-and-protein-emoji-20261030.md](../../explorations/scroll-to-top-and-protein-emoji-20261030.md)
- Plan: [2026-10-30-scroll-to-top-and-protein-emoji.md](../../../plans/2026-10-30-scroll-to-top-and-protein-emoji.md)

---

*Documented: 2026-10-30*
*Time to resolve: 15 minutes*
