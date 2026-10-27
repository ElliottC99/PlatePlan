Workflow Enforcer
Enforce system architectural discipline, complete branch decision coverage, single-owner canonical routing, and strict UI standards.

Absolute Ban on Native Browser Pop-ups: Never generate code that calls alert(), confirm(), or prompt(). Use src/components/ui/DialogHelpers.js.

Audit-First Implementation: Never write implementation code without first performing a read-only audit of the existing state. Never wrap errors in empty catch(e) {} blocks. Fail loud.

The Ownership Rule: One canonical owner per domain. Extend existing files instead of creating parallel modules or arbitrary splits.

Stamp, Don't Type: Ban manual multi-file version bumps. Version stamping belongs to the build script. Edit index.html as the single source of truth.

Quarantine Before Delete: Before deleting suspected dead code, verify zero callers exist. Move proven-dead files to attic/ before permanent deletion.

The 95% Confidence Threshold: If your self-critical review reveals ANY doubt, DO NOT output implementation code—issue a read-only audit prompt first.

One Door Per Firestore Collection: Each Firestore collection under households/elliott-chloe must have exactly one Repository module allowed to write to it, normalising data to a single schema (schemaVersion).
