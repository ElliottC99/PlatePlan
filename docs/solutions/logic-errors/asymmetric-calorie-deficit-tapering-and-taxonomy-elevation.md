---
module: "recipe-taxonomy-and-fit-scoring"
date: "2026-11-11"
problem_type: "logic_error"
component: "service_layer"
severity: "high"
symptoms:
  - "Fit scores plummeted from 90+ into the 60s after elevating recipe ingredients to root items or categories"
  - "Recipes selecting optimal protein-dense products (highest_protein_per_kcal) were heavily penalized despite perfect protein scores"
  - "Recipe ingredients remained frozen to historical concrete products and sub-types, bypassing pantry auto-default recalibrations"
  - "Stage 2 category elevation review required repetitive manual decisions across dozens of matching recipes"
root_cause: "incorrect_algorithm"
resolution_type: "code_fix"
tags:
  - "fit-score"
  - "tapering-curve"
  - "calorie-deficit-paradox"
  - "taxonomy-elevation"
  - "auto-default-strategy"
  - "pointer-stripping"
  - "batch-elevation"
related_issues:
  - "PR #49"
  - "PR #50"
related_solutions:
  - "docs/solutions/logic-errors/universal-fit-score-drift-and-tapering-curve-20261030.md"
  - "docs/solutions/logic-errors/auto-default-strategy-and-recipe-macro-recalibration-20261102.md"
  - "docs/solutions/logic-errors/recipe-wizard-taxonomy-auto-default-hierarchy-and-variant-isolation-20261103.md"
last_referenced: "2026-11-11"
status: "active"
---

# Asymmetric Calorie Deficit Tapering & Retrospective Taxonomy Elevation Architecture

## Problem Statement

When users ran the Retrospective Taxonomy Elevation Wizard to decouple legacy recipes from pinned sub-types and products, recipes successfully unlocked to dynamic pantry resolution under the household preference **"Highest Protein Density"** (`highest_protein_per_kcal`). However, recipe Fit Scores unexpectedly collapsed across the Recipe Vault—many recipes dropping from 90+ into the 60s.

Investigation revealed two interconnected architectural challenges:
1. **The Calorie Deficit Paradox in Dual-Target (50/50) Fit Scoring:** By selecting ultra-lean ingredient defaults (e.g. Eatlean cheese, zero-calorie syrups, 0% fat dairy), recipe calories dropped by 150–250 kcal per serving. Under equal 50% Calorie and 50% Protein weighting, the existing symmetric Calorie Tapering Curve penalized eating under the calorie target with the exact same harsh cliff as overeating. A meal achieving a 100% Protein Score received an 18–30 Calorie Score, dragging the overall score down.
2. **Retrospective Legacy Ingredient Pinning:** 96% of historical recipe ingredients possessed concrete `subtypeId` and `productId` references that bypassed runtime auto-default updates. Upgrading recipes required reverse-engineering auto-defaults, partitioning category substitutions for manual review, stripping concrete pointers, and executing atomic batch updates.

## Symptoms

1. **Vault Fit Score Collapse Post-Elevation:**
   - Recipes whose ingredients were elevated to root items or categories saw immediate macro updates (protein efficiency maximized, calories reduced).
   - Despite meeting or exceeding the user's protein goals, overall Fit Scores dropped sharply into yellow (🟡) or orange (🟠) tiers.
2. **Severe Calorie Tapering Penalty on Deficits:**
   - Under the symmetric curve (`calMinOpt: 95%, calMinGrace: 85%, calLowFloor: 50%`), any recipe sitting 20% below target calories received an aggressive penalty, treating a healthy calorie deficit identically to a calorie surplus.
3. **Pantry Auto-Default Disconnection in Pre-Existing Recipes:**
   - Even after setting household auto-default product priority to `highest_protein_per_kcal` and running pantry recalibration, recipes in the Vault failed to benefit because recipe ingredients stored explicit `productId` and `subtypeId` pointers.
4. **Stage 2 Review Fatigue:**
   - In the category elevation review (Stage 2), users had to evaluate dozens of individual recipe cards sequentially for the same ingredient without a way to apply decisions to all remaining matching recipes.

## Root Cause Analysis

### 1. The Symmetric Calorie Tapering Curve
In [`src/utils/fitScoreWeights.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/utils/fitScoreWeights.js#L14-L29), the default calorie curve was calibrated symmetrically:
- `calLowFloorPct: 50%`
- `calMinGracePct: 85%`
- `calMinOptPct: 95%`
- `calMaxOptPct: 100%`
- `calMaxGracePct: 105%`
- `calHighCeilPct: 140%`

In [`src/utils/macroScoringUtils.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/utils/macroScoringUtils.js), `calculateMealFitScore` computes:
$$\text{Fit Score} = 0.5 \times \text{Calorie Score} + 0.5 \times \text{Protein Score}$$

When a 500 kcal dinner target recipe picks ultra-lean ingredients, its calories drop to 380 kcal ($76\%$ of target). Under `calMinGrace: 85%` and `calLowFloor: 50%`, the score linearly interpolated to:
$$\text{Calorie Score} = \frac{76 - 50}{85 - 50} \times 85 \approx 63.1$$
If calories dropped to 360 kcal ($72\%$), Calorie Score became 53.4. Combined with a 100% protein score, the resulting Fit Score was:
$$0.5 \times 53.4 + 0.5 \times 100 = 76.7$$
The algorithm treated eating 25% under target calories with the exact same harshness as consuming 25% surplus calories over target.

### 2. Auto-Default Collapse & Pointer Residue
When recipes were originally authored or imported, the wizard and repository stored `ingredientId`, `subtypeId`, and `productId`. If `productId` or `subtypeId` remained on the ingredient object, [`src/utils/macroScoringUtils.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/utils/macroScoringUtils.js#L11-L25) resolved the explicit product directly, completely bypassing [`resolveDynamicProductForIngredient`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/PantryTaxonomyService.js).

### 3. Stage 1 vs Stage 2 Candidate Collision
Any product matching a Category auto-default is also under a Root Item. Without strict candidate partitioning, Stage 1 batch elevation would elevate category-level candidates to root items, wiping out the user's opportunity to review category substitutions in Stage 2.

## Working Solution

### 1. Asymmetric Calorie Deficit Tapering Configuration
To preserve the user's fitness goal of **equal 50/50 Calorie and Protein weighting** without penalizing lean, protein-efficient ingredients:
- **Widen the Calorie Deficit Sweet Spot:**
  - `calLowFloorPct`: `40%` (was `50%`)
  - `calMinGracePct`: `70%` (was `85%`)
  - `calMinOptPct`: `85%` (was `95%`)
- **Maintain Strict Protection Against Calorie Surpluses:**
  - `calMaxOptPct`: `105%` (was `100%`)
  - `calMaxGracePct`: `115%` (was `105%`)
  - `calHighCeilPct`: `135%` (was `140%`)
- **Preserve Protein Targets:**
  - `protLowFloorPct`: `70%`
  - `protMinGracePct`: `95%`
  - `protMinOptPct`: `100%`
  - `protMaxOptPct`: `120%`
  - `protMaxGracePct`: `130%`
  - `protHighCeilPct`: `200%`

#### Verification Across 147 Real Household Recipes
Simulating this curve across the household's actual database snapshot (`households_elliott-chloe_backup.json` containing 147 recipes):
- **+20 additional recipes** crossed into the 85+ (🟢 Green Tier / Ideal Match) range (increasing from 14 to 34 recipes, a **+143% increase**).
- Average Fit Score across the entire vault increased by **+10.3 points** (from 67.9 to 78.2).
- Top beneficiaries:
  - *Chilli and Rice*: 67 ➔ **97** (+30 pts)
  - *Chicken and Rice*: 63 ➔ **92** (+29 pts)
  - *Tenderstem Broccoli Rigatoni*: 64 ➔ **90** (+26 pts)
  - *Thai Yellow Chicken Curry*: 70 ➔ **94** (+24 pts)
  - *Sausage Pasta Bake*: 70 ➔ **93** (+23 pts)

### 2. Retrospective Taxonomy Elevation Engine ([`src/services/RecipeTaxonomyElevationService.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/RecipeTaxonomyElevationService.js))

1. **Auto-Default Reverse Engineering (`scanRecipeTaxonomyElevations`):**
   - Compares an ingredient's currently assigned product against the auto-default product for its Root Item and Category.
   - If the assigned product matches the Category default $\to$ flags as `categoryCandidates`.
   - If the assigned product matches the Root Item default $\to$ flags as `rootCandidates`.
2. **Strict Candidate Partitioning:**
   - Category candidates are partitioned first and strictly excluded from Root Item candidates. This prevents Stage 1 batch elevation from consuming candidates intended for Stage 2 manual review.
3. **Pointer Stripping Invariant:**
   - When elevating an ingredient, both `subtypeId` and `productId` (and legacy `bankId`) are explicitly deleted from the ingredient record.
   - Deleting concrete pointers allows runtime resolution ([`resolveDynamicProductForIngredient`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/PantryTaxonomyService.js)) to evaluate pantry defaults dynamically based on household strategy.
4. **Multi-Variant Recalculation & Atomic Persistence:**
   - Both `original` and `enhanced` variants recompute nutrition dynamically.
   - Updates are committed atomically via Firestore batch writes in chunks of 400.

### 3. Stage 2 Multi-Recipe Batch Selection ([`src/components/data-quality/CategoryPromotionModalUI.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/data-quality/CategoryPromotionModalUI.js))
- Added an **"Apply decision to all N remaining matching recipes using [Ingredient Name]"** toggle (PR #50).
- When toggled, action buttons dynamically pluralize (e.g. *Elevate All 3 to Category*, *Keep Sub-type on All 3*, *Skip All 3*).
- All matching recipes for that root item are resolved in an atomic multi-document commit, reducing user review friction from $O(N)$ repetitive clicks to a single decision.

## Verification

- **Automated Unit Tests ([`scripts/test_recipe_taxonomy_elevation.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/scripts/test_recipe_taxonomy_elevation.js)):**
  - Test 1: Category candidate identification.
  - Test 2: Root Item candidate identification.
  - Test 3: Candidate partitioning isolation.
  - Test 4: Elevation execution and pointer stripping (`subtypeId: null`, `productId: null`).
  - Test 5: Rejection of unmatched/explicit custom products.
  - Test 6: Commit service and Store synchronization.
  - Test 7: Multi-recipe batch apply for matching root items in Stage 2.
- **Pull Requests:**
  - PR #49 (`feat(data-quality): implement retrospective taxonomy elevation wizard with auto-default reverse engineering`) merged into `development`.
  - PR #50 (`feat(data-quality): add apply to all remaining matching recipes toggle to stage 2 category review`) opened and green on `development`.

## Prevention & Lessons Learned

1. **Dual-Target Scoring Requires Asymmetric Deficit Tolerances:** When a fitness model scores both calories and macros, an optimizing agent will naturally reduce calories to maximize protein ratio. If the calorie curve is symmetric, the deficit will be penalized as severely as an excess. Deficit floors must be wide enough (`40%–85%`) to accommodate lean substitutions while ceiling limits remain strict (`105%–135%`) to prevent surplus overeating.
2. **Pointers Break Reactive Abstraction:** Persisting concrete entity pointers (`productId`, `subtypeId`) on dependent records destroys the dynamic benefits of an abstract taxonomy hierarchy. Abstract levels (Root Item, Category) must strictly persist `null` pointers and rely on pure runtime resolution.
3. **Partition Broader Candidates First:** When building retrospective classification pipelines where entities belong to hierarchical levels ($A \subset B$), partition candidates at the broadest level ($A$) first to prevent narrower stages ($B$) from preemptively consuming them.
4. **Offer Batch Application on Grouped Repetitions:** Whenever an audit or promotion wizard presents items grouped by an underlying parent entity, provide an "Apply to all remaining matching items" control to avoid user review fatigue.
