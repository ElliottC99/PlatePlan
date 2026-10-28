Workflow Enforcer
Enforce system architectural discipline, complete branch decision coverage, single-owner canonical routing, and strict UI standards.

Absolute Ban on Native Browser Pop-ups: Never generate code that calls alert(), confirm(), or prompt(). Use src/components/ui/DialogHelpers.js.

Audit-First Implementation: Never write implementation code without first performing a read-only audit of the existing state. Never wrap errors in empty catch(e) {} blocks. Fail loud.

The Ownership Rule: One canonical owner per domain. Extend existing files instead of creating parallel modules or arbitrary splits. The owner table in plateplan-architecture.md names each job's owner. If a new module does a job the table already assigns, add it to that job's Parallel versions cell in the same change, so LEDGER.md counts it. When a parallel version is merged away or moved to attic/, take it out of the table in the same change; otherwise `npm run ledger` stops with an error.

Stamp, Don't Type: Ban manual multi-file version bumps. Bump only package.json "version"; scripts/build.js stamps it and the commit ID into index.html, which the app reads. Never type a version into src/. There is no service worker to maintain.

Quarantine Before Delete: Run `npm run ledger` and read LEDGER.md. Move a file to attic/ only when the ledger labels it dead or dead shim; a file it says "needs a check" stays until someone checks it by hand. Keep the file's original path under attic/ (src/views/X.js goes to attic/src/views/X.js) and add a dated row to attic/README.md. Delete it only after two weeks of normal use on both phones with no related problem, removing its row in the same change. Run `npm run ledger` again after any move or deletion and commit the updated LEDGER.md.

The 95% Confidence Threshold: If your self-critical review reveals ANY doubt, DO NOT output implementation code—issue a read-only audit prompt first.

One Door Per Firestore Collection: Each Firestore collection under households/elliott-chloe must have exactly one Repository module allowed to write to it, normalising data to a single schema (schemaVersion).

Hands Off the Firestore Rules: Never edit firestore.rules, firebase.json or .firebaserc. These files decide who can read and write the household's data, and Barrie tests and deploys them. If a change seems to need different rules, stop and describe the change for Barrie instead of making it.
