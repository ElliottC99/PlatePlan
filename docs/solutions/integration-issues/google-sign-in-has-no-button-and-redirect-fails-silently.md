---
title: PlatePlan has no sign-in button, and Google redirect sign-in fails silently in Chrome
date: 2026-10-27
category: integration-issues
module: authentication (AuthService)
problem_type: integration_issue
component: authentication
symptoms:
  - "A signed-out user lands in local mode with no sign-in screen and no button to open one"
  - "Signing in through the app's own login modal returns to the app still signed out, with no error shown"
  - "No new user appears under Firebase Authentication -> Users after the redirect"
root_cause: wrong_api
resolution_type: workflow_improvement
severity: high
related_components:
  - frontend
tags: [firebase-auth, google-sign-in, signInWithRedirect, signInWithPopup, getRedirectResult, third-party-storage, local-mode, logout]
---

# PlatePlan has no sign-in button, and Google redirect sign-in fails silently in Chrome

## Problem

Two faults stack up. Once someone is signed out, nothing in the app lets them sign back in, and the sign-in code the app does have doesn't work in Chrome. Both fail without an error. On 2026-10-27 Barrie could not sign in to test the app. Elliott and Chloe would be locked out the same way if they pressed Log Out.

## Symptoms

- When nobody is signed in, the app opens in local mode, with no sign-in prompt and no button.
- Opening the login modal by hand and choosing "Sign in with Google" goes to Google, comes back, and the user is still signed out. No message appears.
- Firebase Authentication -> Users shows no new user after the attempt. Firestore reads then fail the security rules, which allow only the household's UIDs.

## What Didn't Work

- Looking for a sign-in screen in the app, or signing out and back in to the Firebase console. The app never opens its login modal: nothing calls `showLoginUI` (`src/services/AuthService.js`) or its `window.openPlatePlanLogin` alias. This was already so in v3.45.7, before Elliott's studio changes.
- Running `openPlatePlanLogin()` in the DevTools console and clicking the modal's Google button. That button uses `signInWithRedirect`, which failed as described.

## Root cause

- **No entry point.** `showLoginUI` exists and is exported to `window`, but no code or markup calls it. `waitForAuth` just resolves with no user after its timeout.
- **Redirect sign-in loses its result.** `signInWithGoogle` calls `firebase.auth().signInWithRedirect(provider)`. The site runs on `github.io`, and `authDomain` is `plateplan-a5131.firebaseapp.com` (`src/config/firebase-config.js`). The redirect flow passes its result through storage on the `authDomain`, which Chrome partitions or blocks as third-party storage. So the result is very likely lost on the way back. This cause was inferred, not proven.
- **Errors are swallowed.** `waitForAuth` calls `authInstance.getRedirectResult().catch(() => {})`, so any redirect error is thrown away. The modal's `.catch` only catches errors from starting the redirect, and starting it succeeds.

## Solution

Verified workaround, used on localhost on 2026-10-27: sign in with a popup instead of a redirect. In the DevTools console:

```js
firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())
```

That created Barrie's user, and Barrie then added its UID to the Firestore rules. The popup flow returns its result straight to the opening page, so the blocked storage doesn't matter.

The permanent fix is not built yet. It's a follow-up: a visible Sign in button that calls `signInWithPopup`, falling back to redirect only if the popup is blocked. The `getRedirectResult` error should be logged and shown, not discarded.

## Prevention

- Until that button ships, Elliott and Chloe must **not** press Log Out. That's the `logoutBtn` in the `index.html` header and the item in the mobile "more" menu. Signing back in currently takes the DevTools workaround.
- When testing auth, check Firebase Authentication -> Users for the new user, not just the app's screen. A silent failure looks the same as local mode.
- Never write `.catch(() => {})` on an auth call. Log the error at least.
- Prefer `signInWithPopup` for an app hosted on a different domain from its `authDomain`.

## Related Issues

- `docs/solutions/database-issues/plan-whole-document-save-erases-unlisted-fields.md` (found during the same 2026-10-27 testing).
- Follow-up recorded in `docs/plans/2026-10-27-1549-fix-today-and-step3-shopping-plan.md`'s scope notes: a visible sign-in button.
