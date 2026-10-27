---
title: Today View and Step 3 Shopping List - Plan
type: fix
date: 2026-10-27
topic: today-and-step3-shopping
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Today View and Step 3 Shopping List - Plan

## Goal Capsule

- **Objective:** Elliott and Chloe can open Today to see each day's planned meals and tick them off as eaten. They can mark items they already have on the planner's Step 3 shopping list. Both kinds of tick show on both phones and survive a reload. The app no longer carries a Shopping screen nobody can reach.
- **Means:** read the loaded plan and its per-person meal slots the way the planner does, and save ticks through the existing plan save (KTD1, KTD2).
- **Product authority:** Elliott and Chloe decide behaviour; Barrie relays their answers and reviews the work. The Product Contract wins on behaviour; KTDs win on mechanism.
- **Execution profile:** U1–U4 are already committed on `dev/review-state` and unpushed. U5, U9 and U6–U8 remain, run step by step with Barrie, not autonomously.
- **Stop conditions:** stop and ask if the code review finds a defect that changes product behaviour, if any test in the acceptance pass writes something other than a tick, or if a check shows the plan's meal slots changed.
- **Who finishes:** Claude carries out U5, U9, U6 and U7 with Barrie's approval at each push or merge. Barrie releases U8 to `main`, and Elliott and Chloe confirm it on their phones.
- **Open blockers:** U8 waits on the separate version-stamping fix (KTD5). Nothing blocks U5, U9, U6 or U7.

---

## Product Contract

Product Contract preservation: the two Outstanding Questions are resolved in place as KTD4 and the Copy List check in U7; changed: R2 — clarified that different versions of the same recipe count as split, matching the planner's rule (Barrie approved, 2026-10-27).

### Summary

Today becomes a working daily view of the current meal plan, with eaten ticks, day navigation and View Recipe. The planner's Step 3 list stays the household's only shopping list, and its at-home ticks are saved. The unlinked standalone Shopping screen is removed.

### Problem Frame

Elliott and Chloe plan their week in PlatePlan and want a daily view of what they're eating. Today has shown "No meals assigned to this day" for every day since September, even with a full plan in place, so they lost that view. Its day arrows and Today button also did nothing.

They shop from Step 3 of the Meal Planner. Ticking an item as already at home there did not stay ticked, and the confirmation showed an internal ID instead of the item name, so the list could not be trimmed to what they actually need to buy.

The code also contains a second, separate Shopping screen. No menu links to it, it renders empty, and its controls are dead. It adds confusion for anyone, human or AI, working on the code.

### Key Decisions

- **Keep and fix Today.** (session-settled: user-directed — chosen over dropping the Today screen: Elliott and Chloe want to use it daily and it broke in September.) Governs R1–R6.
- **Planner Step 3 is the shopping list.** (session-settled: user-directed — chosen over a separate Shopping tab: it is how Elliott and Chloe shop now.) Governs R7–R9.
- **Remove the unlinked Shopping screen.** (session-settled: user-directed — chosen over linking it into the menus: they do not need it.) Governs R10.
- **Ticks are household-wide, not per device.** Both people see the same eaten and at-home ticks because they share one plan. Governs R4, R8.
- **A meal shows once when shared and once per person when split.** This follows the planner's own rule for when Elliott and Chloe are eating the same recipe. Governs R2.
- **Treat the three changes as one piece of work.** They share one underlying fault (Today and Step 3 read the plan from the wrong place) and are tested and released together.

### Requirements

**Today**

- R1. Today shows the meals planned for the selected date from the current plan.
- R2. A meal Elliott and Chloe share appears as one card; a meal where they eat different recipes, or different versions of the same recipe, appears as one card per person, labelled with that person.
- R3. Each card shows the recipe name with its calories and protein per serving, and shows a prep time only when the recipe has one.
- R4. Each card lets the household tick the meal as eaten: a shared card for both people or either one, a per-person card for that person only.
- R5. Eaten ticks are saved to the shared plan, so they appear on the other phone and survive a reload; unticking clears them the same way.
- R6. The previous-day, next-day and Today controls move the selected date, and View Recipe opens the recipe.

**Step 3 shopping list**

- R7. Ticking an item as at home on Step 3 keeps it ticked, removes its cost from the total, and counts it as "marked at home".
- R8. At-home ticks are saved to the current plan, so they appear on the other phone and survive a reload; a newly generated plan starts with none.
- R9. The tick confirmation names the item, and Copy List copies the Step 3 list.

**Removal**

- R10. The standalone Shopping screen and the code that only it used are removed, and every remaining screen, including Step 3, works as before.

### Acceptance Examples

- AE1. **Covers R2, R4.** **Given** breakfast on 27 Oct is the same recipe for both, **when** Today opens on 27 Oct, **then** one Breakfast card shows with Mark Eaten, E and C.
- AE2. **Covers R2, R4.** **Given** Elliott and Chloe have different dinners on a day, **when** Today opens on that day, **then** two Dinner cards show, labelled Elliott and Chloe, each with a single Mark Eaten.
- AE3. **Covers R5.** **Given** Elliott ticks E on a shared breakfast, **when** either phone reloads, **then** breakfast shows "✓ E"; **when** E is tapped again, **then** the tick is gone on both phones.
- AE4. **Covers R7, R8.** **Given** Step 3 shows £191.68 for 59 items, **when** Vegetable Oil is ticked at home, **then** the header shows £183.18 with 58 to buy and 1 marked at home, and it is still ticked after a reload.
- AE5. **Covers R1.** **Given** no meals are planned for the selected date, **when** Today shows that date, **then** it says no meals are assigned.

### Scope Boundaries

**Deferred for later**

- Ticks from two people at almost the same moment can lose one; acceptable for now.
- The fit-score badge on Today cards (currently 41–47%, "Poor Match"), until Elliott says whether the numbers look right.
- A visible Sign in button; signed-out users currently land in local mode with no way to sign in.
- Generic routing for the other dead buttons across the app.
- Fixing `__APP_VERSION__` version stamping on the live site (its own brainstorm).

**Outside this work**

- Changes to how plans are generated, or to the Step 1–2 planner flow.
- Per-device or private ticks.
- Considered and not built: a "could not save" message when a tick fails to save. A lost tick shows quickly as missing on the other phone, and the app's other saves give no such message either. Revisit if ticks are reported going missing.

**Deferred to Follow-Up Work**

- Repoint or remove `scripts/test_accessibility_dom.js` and `scripts/test_plan_generator.js`, which still reference files studio deleted (`PlatePlan.html`, `src/services/PlanGeneratorService.js`).
- `src/services/RecipeWizardEventService.js` imports `../../views/ProductBankView.js` (wrong path, present since v3.45.7); nothing imports the module, so it belongs with the dead-code tidy-up.
- View Recipe on a per-person Today card (Elliott or Chloe only) opens the recipe for both; pass that person through to the recipe view (code review, 2026-10-27).
- A product swap can start from a stale `state.plan` copy, because the realtime plan update refreshes only `currentPlan`; the swap then merge-writes the older plan and can bring back an untick. This predates the round, but tick saves make it more reachable (code review, 2026-10-27).
- The version-stamping fix (KTD5) must change the service-worker cache name, or installed phones may start the new code with stale cached modules (code review, 2026-10-27).

### Dependencies / Assumptions

- Testing on `dev/review-state` uses the live Firestore data. A backup taken on 2026-10-27 is the restore point.
- Updates reach installed phones only after the version-stamping fix. Until then a release to `main` may stay hidden behind the old cached version.
- Assumed: Elliott and Chloe want ticks shared between their phones rather than private (not asked directly).

### Sources / Research

- `docs/ideation/2026-10-25-plateplan-rescue-ideation.html` — the rescue ideas this round draws on (usage census, "working" checklist).
- Click-through census on localhost, 2026-10-27: Today read the wrong plan field and slot names; Step 3 ticks were written to a field the list never reads; `#view-shopping` had no navigation link.
- Live checks, 2026-10-27: a meal-eaten tick and an at-home tick were each saved, survived a reload and cleared, with the plan's 42 meal slots unchanged.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Read the loaded plan from `currentPlan` and resolve per-person slots with the planner's shared rule.** The store keeps the plan in `currentPlan`; the leftover `state.plan` reads were the root fault. Today reads `<meal>E` / `<meal>C` slots and treats them as shared when recipe and variant match, as `src/views/PlannerRenderService.js` does, falling back to a plain `<meal>` key for older plans. Governs R1, R2.
- KTD2. **Save ticks through the existing plan save, not a new writer.** `saveCurrentPlan` already owns `plans/current`; `stripPlanPayload` in `src/models/MealPlannerModel.js` gains sanitised `eatenMeals` and `shoppingAtHome` maps that keep only ticked entries. Because the save replaces the whole document, both tick handlers refuse to save when no plan with slots is loaded. Governs R5, R8.
- KTD3. **New controls use named `data-action` values routed in `routeAction`.** `today-prev`, `today-next`, `today-reset`, `toggle-meal-eaten` and the existing `view-recipe` route explicitly in `src/services/ActionBridge.js`, matching studio's direction; a generic function-call fallback stays deferred. Governs R4, R6, R7.
- KTD4. **Barrie tests on localhost against live data; Elliott and Chloe confirm after release.** (session-settled: user-approved — chosen over Elliott and Chloe testing before release on a hosted preview: only `main` is hosted today.) Reverting the release merge on `main` is the fallback.
- KTD5. **Release to `main` waits for the version-stamping fix.** (session-settled: user-approved — chosen over releasing now and relying on phones picking it up: the live cache name never changes, so updates may not reach installed phones.)
- KTD6. **Cover split meals with an automated test.** (session-settled: user-approved — chosen over relying on live data: no meal in the current week is split.) Governs R2.

### Risks

- **Old code wipes ticks.** Phones still run the old `main`, whose plan save drops `eatenMeals` and `shoppingAtHome`. Any plan save from an old phone before release clears ticks made during testing. Low impact, because testing leaves no ticks behind.
- **Whole-document save.** A plan save from any screen replaces `plans/current`, so a stale in-memory plan could overwrite newer data. KTD2's no-plan guard covers the empty-plan case only; two-person races are deferred (Scope Boundaries).

---

## Implementation Units

### U1. Today shows the day's meals and saves eaten ticks

- **Goal:** Today renders the selected day's meals from the current plan, with working ticks, arrows and View Recipe.
- **Requirements:** R1–R6; KTD1, KTD2, KTD3; AE1, AE3, AE5.
- **Dependencies:** none.
- **Files:** `src/views/TodayView.js`, `src/services/ActionBridge.js`, `src/models/MealPlannerModel.js`, `index.html`, `scripts/test_today_view.js`.
- **Approach:** delivered in commit `a9d0498`.
  1. Today reads `currentPlan` and builds cards per KTD1.
  2. Cards read calories and protein from `nutrition.perServing`, with `macros` as fallback.
  3. Tick and navigation buttons become named actions per KTD3; `index.html` date buttons switch to them.
  4. `stripPlanPayload` keeps eaten ticks per KTD2.
- **Test scenarios:**
  - Ticking E, then C, on a shared meal makes it count as eaten by both.
  - Unticking both clears E and C.
  - `stripPlanPayload` keeps ticked entries and still strips heavy recipe fields.
  - Unticked and malformed keys are dropped; a plan without ticks saves an empty map.
- **Verification:** `scripts/test_today_view.js` passes. On localhost, 27 Oct shows three shared cards with kcal and protein, the arrows change the day's meals, and View Recipe opens. A live E tick on breakfast saved, survived a reload and cleared, with 42 slots unchanged.

### U2. Step 3 at-home tick sticks and saves

- **Goal:** an at-home tick on Step 3 stays ticked, updates the total and is saved to the plan.
- **Requirements:** R7–R9; KTD2; AE4.
- **Dependencies:** U1 (shares the `stripPlanPayload` change).
- **Files:** `src/views/ShoppingView.js`, `src/services/ActionBridge.js`, `src/components/shopping/ShoppingItemRow.js`, `src/components/shopping/ShoppingBatchToolbar.js`, `src/models/MealPlannerModel.js`, `scripts/test_today_view.js`.
- **Approach:** delivered in commit `70851ad`.
  1. `toggleShoppingItemAcquired` toggles `currentPlan.shoppingAtHome` by item key, saves, redraws the planner and names the item in the toast.
  2. The checkbox's inline `onchange` is removed so a tick cannot fire twice.
  3. Copy List reads `currentPlan`.
- **Test scenarios:**
  - `stripPlanPayload` keeps ticked at-home entries and drops unticked ones.
  - A missing at-home map saves as empty.
- **Verification:** on localhost, ticking Vegetable Oil showed £183.18 with "1 marked at home", survived a reload, and unticking restored £191.68 for 59 items with 42 slots unchanged.

### U3. Remove the unlinked Shopping screen

- **Goal:** the standalone Shopping screen and the code only it used are gone, with every other screen unaffected.
- **Requirements:** R10.
- **Dependencies:** U2 (the at-home tick no longer redraws that screen).
- **Files:** `index.html`, `src/core/AppRouter.js`, `src/core/AppInitializer.js`, `src/main.js`, `src/services/ActionBridge.js`, `src/services/MealPlanGeneratorService.js`, `src/components/ProductSwapModal.js`, `src/components/shell/NavigationUI.js`, `src/components/componentRegistry.js`, `src/views/ShoppingView.js`, `sw.js`; deleted `src/components/shopping/ShoppingListUI.js`, `ShoppingListToolbar.js`, `ShoppingListView.js`, `ShoppingAisleGroup.js`.
- **Approach:** delivered in commit `5ee2c08`. Removing `#view-shopping` alone would have bound its click delegation to `document.body`, so that delegation is removed with it. The `sw.js` precache list drops the deleted files, because a missing file stops the service worker installing.
- **Test expectation:** none -- removal only; verified by the checks below rather than new tests.
- **Verification:** no import points at a missing file; every precache path exists. On localhost the app boots with no console errors, Today shows three cards, and Step 3 shows 59 items with Breakdown and Swap Product working.

### U4. Note the routed actions in CLAUDE.md

- **Goal:** `CLAUDE.md` no longer lists the meal-eaten ticks as broken and tells future work to use named routed actions.
- **Requirements:** supports KTD3.
- **Dependencies:** U1.
- **Files:** `CLAUDE.md`.
- **Approach:** delivered in commit `a1cae69`.
- **Test expectation:** none -- documentation only.
- **Verification:** the ActionBridge entry in `CLAUDE.md` matches the current routing.

### U5. Test the split-meal cards

- **Goal:** prove Today's card rule for shared, split, one-sided and older plans without relying on live data.
- **Requirements:** R2; KTD1, KTD6; AE1, AE2.
- **Dependencies:** U1.
- **Files:** `scripts/test_today_view.js`.
- **Approach:** exercise `getTodayMealCards` from `src/views/TodayView.js` with in-memory day plans and a stubbed recipe list. Importing `TodayView.js` pulls in the Firebase config and store modules, so the test extends the existing `window` and `localStorage` stubs as needed.
- **Patterns to follow:** the stubs and assert style already in `scripts/test_today_view.js`.
- **Test scenarios:**
  - Covers AE1. Same recipe and variant in `breakfastE` and `breakfastC` gives one card for both.
  - Covers AE2. Different recipes in `dinnerE` and `dinnerC` give two cards, Elliott then Chloe.
  - Same recipe with different variants gives two cards.
  - A skipped Chloe slot with an Elliott recipe gives one Elliott card.
  - An older plan with only a plain `lunch` key gives one shared card.
  - A slot whose recipe is not in the recipe list gives no card.
- **Verification:** the new scenarios pass, and each fails if the shared rule is broken.

### U9. Keep Step 3 swaps when a tick is saved

- **Goal:** a Swap Product choice on Step 3 survives an at-home or eaten tick, in memory and in `plans/current`, as it did before ticks were saved.
- **Requirements:** R10; KTD2.
- **Dependencies:** U1, U2.
- **Files:** `src/models/MealPlannerModel.js`, `src/services/HydrationService.js`, `scripts/test_today_view.js`.
- **Approach:** Swap Product saves its choice to `plans/current` (`setActivePlan` merge-writes `substitutions` and `productSelections`), but the tick save replaces the whole document with `stripPlanPayload`'s output, which dropped both (KTD2). `stripPlanPayload` keeps sanitised copies of both maps so the tick save round-trips them. A first attempt (commit `ec811ba`) carried the fields in memory only, on the wrong premise that swaps were never saved; the code review found it, and the carry helper is removed.
- **Test scenarios:**
  - `stripPlanPayload` keeps `substitutions` entries (product id, name, brand, price, timestamp) and `productSelections` ids.
  - Malformed or extra swap fields are dropped, and a plan without swaps saves empty maps.
- **Verification:** on localhost, swap a product on Step 3, tick a different item at home, reload, and the swap and its cost still show; `plans/current` still holds the swap.

### U6. Review the round's commits

- **Goal:** an independent code review of U1–U5 and U9 before anything is pushed, with accepted fixes applied.
- **Requirements:** all; cross-checks KTD1–KTD3.
- **Dependencies:** U1–U5, U9.
- **Files:** as U1–U5 and U9.
- **Approach:** run `ce-code-review` over the commits after `73e8ebe` on `dev/review-state`. Fixes that change product behaviour stop for Barrie per the Goal Capsule stop conditions.
- **Test expectation:** none -- review; any fix carries its own test.
- **Verification:** the review's findings are fixed, or recorded with a reason, and the test suite result is unchanged apart from fixes.

### U7. Acceptance pass on localhost, then push and merge to development

- **Goal:** confirm the round on real data, then share it on `development`.
- **Requirements:** R1–R10; KTD4; AE1, AE3, AE4, AE5.
- **Dependencies:** U6.
- **Files:** none expected.
- **Approach:**
  1. Take a fresh backup with `scripts/backup_firestore.js`.
  2. On `npm run dev`, walk AE1, AE3, AE4 and AE5, and check the arrows, View Recipe, Breakdown and Swap Product.
  3. Click Copy List and check the clipboard holds the Step 3 list.
  4. Swap a product on Step 3, then tick a different item at home, and check the swap still shows.
  5. Check the console shows no errors and the plan's 42 slots are unchanged.
  6. With Barrie's approval, push `dev/review-state` and merge it into `development`.
- **Test expectation:** none -- manual acceptance; automated coverage lives in U1, U2 and U5.
- **Verification:** every step above passes, and `origin/development` contains the round's commits.

### U8. Release to main and confirm on the phones

- **Goal:** Elliott and Chloe have the working Today and Step 3 on their phones.
- **Requirements:** R1–R10; KTD4, KTD5.
- **Dependencies:** U7 and the version-stamping fix.
- **Files:** none expected.
- **Approach:** Barrie merges `development` into `main`. Elliott and Chloe open Today and Step 3 on their phones and try a tick. If either breaks, revert the release merge on `main`.
- **Test expectation:** none -- release; confirmed by Elliott and Chloe.
- **Verification:** both phones show the new Today, and a tick made on one shows on the other.

---

## Verification Contract

| Gate | Command or check | Applies to | Passes when |
|---|---|---|---|
| Today and tick tests | `node scripts/test_today_view.js` | U1, U2, U5, U9 | exits 0 |
| Full script suite | each `node scripts/test_*.js` and `node test_vault_fit_score.js` | all code units | only the four known failures remain: `test_accessibility_dom`, `test_plan_generator`, `test_pwa_build`, `test_recipe_wizard` |
| Syntax | `node --check <changed file>` | every changed `.js` | no errors; `src/views/PantryBankModalService.js` is a known pre-existing failure |
| Browser smoke | `npm run dev`, then load Today and Step 3 | U3, U7 | no console errors |
| Data safety | read `plans/current` before and after any tick test | U7 | meal slots unchanged; only `eatenMeals`, `shoppingAtHome` and `updatedAt` differ |

`npm run lint` is not a gate for this round: it fails on `test_accessibility_dom.js`'s reference to the deleted `PlatePlan.html` (Deferred to Follow-Up Work).

---

## Definition of Done

- U1–U9 each meet their Verification line.
- The Verification Contract gates pass for the units they apply to.
- No experimental or abandoned code remains in the diff, and no temporary test helpers are left in the page or repo.
- Any ticks made during testing are cleared, and the 2026-10-27 or later backup is kept.
- `development` and `main` contain the round, and Elliott and Chloe have confirmed it on both phones.
