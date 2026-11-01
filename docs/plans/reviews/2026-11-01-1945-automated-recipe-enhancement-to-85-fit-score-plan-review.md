# Plan Review: Automated Recipe Enhancement to 85+ Fit Score Engine

**Plan:** `docs/plans/2026-11-01-1945-automated-recipe-enhancement-to-85-fit-score-plan.md`  
**Reviewer:** Antigravity (Advanced Agentic Coding)  
**Date:** 2026-11-01  
**Verdict:** **Needs Target Revisions Before Execution (Minor Architecture & Edge Case Additions)**

---

## 1. Executive Summary & Assessment

The plan addresses an outstanding core pain point in PlatePlan: converting low-scoring recipes (Red/Orange/Yellow tiers) into household-aligned 85%+ Green matches without tedious manual macro recalculations. It leverages existing foundational systems (`recipe.enhanced`, `calculateMealFitScore`, `recalculateWizardMacros`, `PlannerMealSlot.js`) and adheres to single-writer and data safety rules.

However, a **deep, critical architectural inspection** reveals 7 specific gaps, edge cases, and culinary failure modes that will cause bugs or bad UX during implementation if not addressed upfront in the plan:

1. **Recipe Sections Hierarchy (`ingredientSections` vs flat `ingredients`):** The plan describes updating `recipe.ingredients`, but many vault recipes organize ingredients into sections (e.g. *"For the Sauce"*, *"Main Dish"*, *"To Serve"*). Flattening or ignoring sections will break the recipe view.
2. **Discrete Unit Quantities (`can`, `pack`, `egg`, `slice`):** Continuous mathematical scaling (e.g. multiplying by 0.65) produces awkward quantities like `0.65 cans of coconut milk` or `1.3 chicken breasts`. The optimizer needs discrete quantization rules.
3. **Target Persona Alignment (`who: 'both' | 'elliott' | 'chloe'`):** Elliott and Chloe have different macro targets (735 kcal / 49g prot vs 578 kcal / 37g prot). The plan must explicitly factor in the recipe's `who` field and `activeProfile` when computing the target.
4. **Cooking Method Instructions Parity:** When ingredients are swapped or added, `recipe.enhanced.method` cannot remain a disconnected copy that references the old ingredients.
5. **Unattainable 85+ Target (Dessert / Pure Fat edge cases):** For dishes like Chocolate Brownies or Garlic Bread, an 85+ fit score is mathematically impossible without turning the dish into a different meal entirely. The solver needs an exit ceiling and graceful fallback.
6. **Existing Enhanced Variant Collision:** Re-running enhancement on a recipe that already has an enhanced variant must ask to replace or edit rather than blindly corrupting user edits.
7. **Mobile Viewport Constraint (PWA on iOS/Android):** The interactive comparison modal must follow PlatePlan's scrollable bottom-sheet pattern to avoid overflow issues on 375px screens.

---

## 2. Completeness Check

| Category | Item | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Requirements** | Clear problem statement | ✅ Pass | Specific to 85% threshold and household targets. |
| | Measurable success criteria | ✅ Pass | 6 concrete acceptance criteria defined. |
| | Explicit scope boundaries | ⚠️ Partial | Scope of method/steps modification needs clarification. |
| **Research** | Codebase patterns cited | ✅ Pass | Cites `universal-fit-score-drift`, `single-truth-recipe-yield`, and single-writer rules. |
| | Alternative approaches evaluated | ✅ Pass | Pure quantity tuning vs hybrid vs interactive studio compared. |
| **Implementation** | Actionable phase tasks | ✅ Pass | Broken into 5 distinct phases. |
| | Risk mitigations | ⚠️ Partial | Culinary quantization and discrete units not yet mitigated. |
| **Lifecycle** | Automated verification plan | ✅ Pass | Standalone test script planned. |

---

## 3. Deep Gap Analysis & Critical Critiques

### Critique 1: The `ingredientSections` Structural Trap
* **The Problem:** In PlatePlan, modern recipes store ingredients in `recipe.ingredientSections: [{ name: "Curry", ingredients: [...] }, { name: "To Serve", ingredients: [...] }]`, with a fallback to `recipe.ingredients: [...]`.
* **The Failure Mode:** If `RecipeEnhancementService` only manipulates a flat list of `ingredients` and writes it to `recipe.enhanced.ingredients`, then `RecipeDetailModalUI` and `RecipeWizardStep3View` (which render by iterating over `ingredientSections` first) will either render the old unenhanced ingredients or omit section groupings completely.
* **Required Plan Revision:** `RecipeEnhancementService` must traverse and preserve `recipe.ingredientSections`, updating the matching ingredient lines in-place within their original sections, and mirror the structure to `recipe.enhanced.ingredientSections`.

### Critique 2: Discrete Unit Quantities & Fractional Granularity
* **The Problem:** A mathematical solver multiplying ingredient quantities by continuous coefficients (e.g. $\times 0.72$) will produce:
  - `0.72 can Coconut Milk`
  - `2.16 cloves Garlic`
  - `1.44 Chicken Breasts`
* **The Failure Mode:** Cooks cannot measure `0.72 can` easily, and opening a can to discard 28% causes food waste and user frustration.
* **Required Plan Revision:** The solver must incorporate **unit-aware rounding & quantization**:
  - `g` / `ml`: Round to nearest 5 or 10 (e.g., 137g $\to$ 140g).
  - `tbsp` / `tsp`: Round to nearest 0.5 (e.g., 1.5 tbsp, 1 tsp).
  - Discrete containers (`can`, `tin`, `pack`): If scaled, either switch unit to `ml`/`g` or round to $0.5$ or $1.0$.
  - Discrete items (`egg`, `breast`, `thigh`): Round to nearest whole number or half piece.

### Critique 3: Profile Scoping (`who` and `activeProfile`)
* **The Problem:** Section 2.3 of the plan assumes a dinner target of `656 kcal` and `43g protein` based on the household average. But:
  - What if the recipe is tagged `who: 'elliott'` (e.g. Elliott's high-protein lunch)? Target should be **735 kcal / 49g prot**.
  - What if the recipe is tagged `who: 'chloe'`? Target should be **578 kcal / 37g prot**.
  - What if the recipe is a snack or breakfast (`DEFAULT_SPLITS`: Breakfast 25%, Snack 10%)?
* **The Failure Mode:** Optimizing a snack (target ~200 kcal) using dinner targets (~656 kcal) will inflate the recipe by 300%.
* **Required Plan Revision:** The target macro calculation must call `fitScoreCalculator.getTarget(profile, type, mealType)` and pass the recipe's declared meal type and `who` assignment directly into `analyzeRecipeMacroGaps()`.

### Critique 4: Adaptation of Cooking Instructions (`enhanced.method`)
* **The Problem:** If the optimizer adjusts quantities (e.g. from 2 tbsp oil to 1 tsp oil) or swaps an ingredient (e.g. coconut milk $\to$ light coconut milk), the text in `recipe.method` (e.g. *"Heat 2 tablespoons of oil in a wok and add the full-fat coconut cream"*) becomes contradictory.
* **Required Plan Revision:** 
  1. `recipe.enhanced.changes` must hold a human-readable list of all modifications (e.g. *"• Reduced olive oil from 30ml to 10ml\n• Increased chicken breast from 250g to 360g\n• Swapped coconut milk for light coconut milk"*).
  2. For `recipe.enhanced.method`: Rather than attempting brittle NLP text-replacement on instruction sentences, clone the method steps and prepend an **"Enhanced Cooking Note"** banner at the top of the method card detailing the substitutions.

### Critique 5: Unattainable 85+ Guardrail & Max Iteration Exit
* **The Problem:** Some recipes (sweet treats, high-sugar sauces, cheese fondues) cannot reach 85% fit without completely destroying the culinary nature of the dish. An unbounded heuristic loop could loop infinitely or strip all fat/carbs down to 0g.
* **Required Plan Revision:**
  - Cap solver iterations to a maximum of **5 passes**.
  - If the maximum achievable score is below 85% (e.g. 78%), the engine should still return the best possible configuration, with a badge note: *"Best Achievable Match: 78% (Dessert/High-Fat baseline)"* and allow the user to accept it.

---

## 4. Suggested Plan Enhancements

To make the implementation plan production-ready:
1. Update Section 4 (Architectural Design) with `IngredientSection` traversal logic and `quantizeQuantity(qty, unit)` helper.
2. Update Section 5 (Acceptance Criteria) to include tests for discrete unit rounding, section preservation, and meal-type targeting.
3. Update Section 6 (Implementation Steps) to specify the exact mobile-first CSS rules for `RecipeEnhancementModalUI.js`.

---

## 5. Review Decision

**Verdict:** **Approved with Revisions**.  
The core architecture is sound and well-scoped. Incorporating the 5 critical critiques above into the plan will ensure seamless implementation without edge-case rewrites during `/work`.
