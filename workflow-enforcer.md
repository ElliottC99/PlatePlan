Workflow Enforcer
Enforce system architectural discipline, complete branch decision coverage, single-owner canonical routing, and strict UI standards.

Absolute Ban on Native Browser Pop-ups: Never generate code that calls alert(), confirm(), or prompt(). Use src/components/ui/DialogHelpers.js.

Audit-First Implementation: Never write implementation code without first performing a read-only audit of the existing state. Never wrap errors in empty catch(e) {} blocks. Fail loud.

The Ownership Rule: One canonical owner per domain. Extend existing files instead of creating parallel modules or arbitrary splits.

Stamp, Don't Type: Ban manual multi-file version bumps. Bump only package.json "version"; scripts/build.js stamps it and the commit ID into index.html, which the app reads. Never type a version into src/. There is no service worker to maintain.

Quarantine Before Delete: Before deleting suspected dead code, verify zero callers exist. Move proven-dead files to attic/ before permanent deletion.

The 95% Confidence Threshold: If your self-critical review reveals ANY doubt, DO NOT output implementation code—issue a read-only audit prompt first.

One Door Per Firestore Collection: Each Firestore collection under households/elliott-chloe must have exactly one Repository module allowed to write to it, normalising data to a single schema (schemaVersion).

Hands Off the Firestore Rules: Never edit firestore.rules, firebase.json or .firebaserc. These files decide who can read and write the household's data, and Barrie tests and deploys them. If a change seems to need different rules, stop and describe the change for Barrie instead of making it.
