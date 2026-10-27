---
title: Testing on localhost uses up the household's daily Firestore read quota
date: 2026-10-27
category: workflow-issues
module: testing against live Firestore (Spark plan)
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "Testing the app signed in on localhost, which reads the live household data"
  - "Running scripts/backup_firestore.js more than once in a day"
tags: [firestore, spark-plan, read-quota, resource-exhausted, localhost-testing, backup]
---

# Testing on localhost uses up the household's daily Firestore read quota

## Context

PlatePlan is on Firebase's free Spark plan, which allows 50,000 Firestore document reads a day. The count resets at midnight Pacific time, which is 08:00 in the UK. There's only one database. Localhost, the live site, Elliott's and Chloe's phones and the backup script all read the same `households/elliott-chloe` data, so they all share that one quota.

On 2026-10-27 a day of testing on localhost went over it. Barrie confirmed this in Firestore → Usage. The testing involved many signed-in page reloads plus three full backups. Then `scripts/backup_firestore.js` failed with `RESOURCE_EXHAUSTED`, though the app's own single-document reads still worked. The acceptance pass (U7) had to wait until the next day. If the quota runs out, Elliott and Chloe's app can fail to load or save until 08:00.

## Guidance

What costs reads:

- **A full backup reads every document**: about 1,585 on 2026-10-27, including 402 products, 292 ingredients, 289 ingredient groups and 147 recipes.
- **Each signed-in reload of the app reads every collection again.** `HydrationService.js` loads recipes, ingredients, products, preferences and the plan, then opens realtime listeners on the same collections. That's likely about 850 to 1,700 reads per reload. This is an estimate from the collection sizes, not a measurement. A few dozen reloads can therefore use most of a day's quota.

How to test within it:

- Take **one** backup a day, before any test that writes. Don't take a second "just to be safe".
- Plan the test so it needs few reloads. Make several changes, then reload once. Prefer checking state through the console over reloading.
- Check data with single-document reads (for example `plans/current`), not a full backup.
- Check Firestore → Usage before a long test session, and stop when reads pass about 40,000.
- Run unit tests (`scripts/test_*.js`) before testing in the browser. They use no reads.
- Don't test late in the UK day if Elliott and Chloe still need the app that evening.

## Applicability

This applies while the project stays on the Spark plan with one shared database. It would stop applying with a separate test project, the Firestore emulator, or the Blaze plan, where reads above the free tier are billed instead of refused.

Recovery isn't verified yet. The quota should reset at 08:00 UK on 2026-10-28, and the next backup should then succeed. Record here if it doesn't.

## Related Issues

- `docs/plans/2026-10-27-1549-fix-today-and-step3-shopping-plan.md`: U7 (acceptance pass) was paused by this.
