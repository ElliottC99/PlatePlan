---
title: Universal Partial-Token and Typo-Tolerant Search
date: 2026-11-26
type: feat
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Universal Partial-Token and Typo-Tolerant Search

## Goal Capsule

- **Objective:** Typing partial words, out-of-order fragments, cross-field terms, unaccented text, or minor typos in any PlatePlan search input reliably finds the intended recipes, pantry items, sub-types, or products without slowing down the UI.
- **Product authority:** Active scope is Area B (Universal Partial/Token Search). Area A (Recipe Wizard & Parser Fixes) is already implemented; Area C (Data Quality Servings & Meal-Type Review Wizard) is a separate future workstream outside this plan.
- **Open blockers:** None.

---

## Product Contract

### Summary

Search bars and autocomplete pickers across PlatePlan currently require exact contiguous substrings (`text.includes(query)`), causing searches like `"cauli pesto"`, `"tesco tofu"`, `"jalapeno"`, or `"pistacio"` to return zero results. This change introduces one shared search matching engine used across all views and modals that normalizes accents and punctuation, matches all typed word fragments in any order across combined searchable fields, tolerates 1-character typos on 4+ character fragments, and ranks closer matches higher in autocomplete pickers while preserving explicit view sort orders.

### Problem Frame

Users searching large recipe, pantry, and product catalogs rarely type exact consecutive phrases from a single field. Because each view and modal implements its own `.includes(q)` check against individual fields, partial multi-word queries, brand-plus-item queries, accented characters, and single-letter typos fail inconsistently across the app.

### Requirements

- R1. Provide one shared search utility that normalizes case, diacritics/accents (e.g., `jalapeño` → `jalapeno`), and punctuation/hyphens into space-separated tokens.
- R2. Match a query when every typed token matches somewhere in the item's combined searchable text in any order—via exact word, prefix, substring, or (for tokens of length 4+) 1-character edit distance (Damerau-Levenshtein: insertion, deletion, substitution, or adjacent transposition) against any candidate word or prefix.
- R3. Expose a relevance score helper so autocomplete dropdowns and modal pickers rank exact/prefix matches ahead of mid-word substring matches and typo matches, while views with explicit sort controls (Recipe Vault, Product Bank) preserve their user-selected sort order.
- R4. Wire the shared matcher across all primary view search bars—Recipe Vault, Pantry Bank, and Product Bank—matching across combined searchable fields (e.g., product brand + name + category; pantry item name + aliases + sub-types; recipe title + tags + ingredients + notes).
- R5. Wire the shared matcher across all modal search inputs and autocomplete pickers—Recipe Wizard taxonomy autocomplete, shared taxonomy dropdown helper, Planner recipe swap modals, Pantry product linker / reallocate / guided-delete / duplicate modals, Recipe Audit & Enhancement modals, and Data Quality unlinked-item modals.
- R6. Maintain sub-10ms filtering latency across the household catalog (~150 recipes, ~400 products, ~300 pantry items) by avoiding per-keystroke allocations and short-circuiting exact/substring checks before edit-distance checks.

### Key Decisions

- Use multi-word partial-token matching (AND across tokens, any order) with 1-character typo tolerance on 4+ character tokens (`session-settled: user-selected`, over strict substring-only or Spotlight subsequence fuzzy — balances recall with low noise). Governs R1, R2.
- Preserve user-selected view sorting in Recipe Vault and Product Bank while ranking by relevance score in autocomplete dropdowns and modal pickers (`session-settled: user-confirmed`). Governs R3.

### Scope Boundaries

- Area C (Data Quality Servings & Meal-Type Review Wizard) is out of scope for this plan and will be scoped separately.
- No third-party search library is added (PlatePlan is a zero-bundler static ES module PWA).

<!-- ce-section: work-relationships -->
### How This Work Fits Together

This plan covers Area B (Universal Partial/Token Search) from the 3-area polish batch. Area A (Recipe Wizard & Parser Fixes) is complete on `dev/fix-paste-parse-and-recipe-notes`; Area C (Data Quality Servings & Meal-Type Review Wizard) remains an independent follow-up.

### Acceptance Examples

- AE1. Partial, out-of-order, accented, and typo-tolerant matching
  - **Covers:** R1, R2, R4
  - **Given:** Recipe `"Parmesan Cauliflower Steaks With Pistachio Pesto"`, recipe `"Jalapeño Cornbread"`, product `{ name: "Organic Firm Tofu", brand: "Tesco", category: "Tofu, Tempeh and Seitan" }`, and pantry item `{ name: "Kale", subtypes: [{ name: "Cavolo Nero" }] }`.
  - **When:** A user searches `"cauli pesto"`, `"pistacio steaks"`, `"jalapeno"`, `"tesco tofu"`, or `"kale cavolo"`.
  - **Then:** Each query matches its corresponding recipe, product, or pantry item.

- AE2. Autocomplete ranking puts exact and prefix matches first
  - **Covers:** R3, R5
  - **Given:** Taxonomy options containing `"Olive Oil"`, `"Black Olives"`, and `"Cloves"`.
  - **When:** A user types `"oliv"` in the Recipe Wizard taxonomy autocomplete or shared taxonomy search input.
  - **Then:** `"Olive Oil"` and `"Black Olives"` match and rank ahead of any typo match (`"Cloves"` does not outrank `"Olive Oil"`).

- AE3. Short-token noise guard & catalog performance
  - **Covers:** R2, R6
  - **Given:** A 3-character query `"pea"` and a catalog of 400 products / 150 recipes.
  - **When:** The matcher filters `"pea"` (no typo fuzziness on <4 char tokens) and filters a multi-token query across all items.
  - **Then:** `"pea"` matches `"Peas"` and `"Peanut Butter"` without matching `"Tea"` or `"Bean"` via typo, and a full-catalog filter completes well under 10 ms.

### Outstanding Questions

- None.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Single zero-dependency search module (`src/utils/searchUtils.js`)** — Export `normalizeSearchText`, `tokenizeSearchQuery`, `isWithinEditDistance1`, `scoreSearchMatch`, `matchesSearchQuery`, and `filterAndRankBySearch`. Diacritics strip via NFD normalization; punctuation/hyphens collapse to spaces; every token must match via exact word (100), prefix (80), substring (55), or (when `token.length >= 4`) O(N) zero-allocation Damerau-Levenshtein distance <= 1 against word (35) or prefix (25). Governs R1, R2, R3, R6.
- KTD2. **Primary views preserve explicit sort orders** — `RecipeVaultView.js` (including `r.notes` in `getFastRecipeSearchText`), `PantryBankView.js` (matching across combined `name + category + aliases + subtypes`), and `ProductBankView.js` (matching across combined `name + brand + category`) filter with `matchesSearchQuery(tokens, combinedText)` while preserving their existing sort/grouping behavior. Governs R3, R4, R6.
- KTD3. **Autocomplete & modal pickers rank by relevance** — `RecipeWizardTaxonomySearch.js`, `RecipeSearchDropdownHelper.js`, `PlannerGridRenderService.js`, `SubtypeProductLinkerModalUI.js`, `ReallocateProductModalUI.js`, `GuidedDeleteModalUI.js`, `WizardDuplicateHelper.js`, `RecipeAuditModal.js`, `RecipeEnhancementModalUI.js`, `ResolveUnlinkedModalUI.js`, and `UnlinkedSweeperUI.js` switch from `.includes(q)` to `matchesSearchQuery` / `filterAndRankBySearch` so closer matches appear first. Governs R3, R5.

### Implementation Units

- U1. Create `src/utils/searchUtils.js` with normalized partial-token + 1-edit typo matching and relevance scoring.
- U2. Wire `src/utils/searchUtils.js` into primary views (`RecipeVaultView.js`, `PantryBankView.js`, `ProductBankView.js`) and all modal/autocomplete pickers listed in KTD3.
- U3. Add `scripts/test_universal_search.js` verifying AE1–AE3 and sub-10ms catalog latency, then run `npm run lint`, `npm test`, `npm run build`, and independent code review.

---

## Verification Contract

- `node scripts/test_universal_search.js` passes all assertions and `< 10 ms` catalog benchmark.
- `npm run lint`, `npm test`, `npm run build`, and `node --check` on all `src/**/*.js` pass with zero regressions.

---

## Definition of Done

- All requirements R1–R6 and acceptance examples AE1–AE3 pass and are verified by `scripts/test_universal_search.js`.
- Independent code review finds zero unresolved P0/P1 issues.
- Changes are committed and pushed to `dev/fix-paste-parse-and-recipe-notes` (PR #83 targeting `development`).
