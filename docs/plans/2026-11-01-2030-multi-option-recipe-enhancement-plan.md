---
title: Multi-Option Recipe Enhancement Engine
type: feat
date: 2026-11-01
topic: recipe-enhancement-multi-strategy
---

# Multi-Option Recipe Enhancement Engine

> Created: 2026-11-01
> Status: Approved ✓ (Reviewed 2026-11-01)

## Summary
Extend the automated recipe enhancement engine (`RecipeEnhancementService`) and the Apple HIG interactive modal (`RecipeEnhancementModalUI`) to generate and present **multiple distinct optimization strategies** (e.g., "Smart Swaps", "High-Protein Volume", and "Plant/Fiber Booster") when feasible, allowing users to choose the culinary direction that best suits their appetite, pantry stock, and preferences while guaranteeing every proposed option achieves a Fit Score $\ge 85\%$.

---

## Problem Statement
Currently, the Nutritional Optimizer generates a single linear enhancement plan. In real households, there are multiple valid culinary ways to balance a meal for fitness and household macro targets:
1. One person may prefer keeping portions unchanged and making smart pantry swaps (e.g. 5% lean beef, reduced-fat cheese, light coconut milk).
2. Another day, they may be post-workout, prefer double protein volume (e.g. 2 patties ➔ 4 patties), and trim excess oil or starches.
3. Another day, they may prefer adding high-protein plant wholefoods (e.g., lentils, black beans, edamame, tofu) to boost fiber and micronutrients.

Presenting a single rigid suggestion forces the user into one culinary philosophy. Allowing the engine to generate 2–3 distinct, high-scoring ($\ge 85\%$) strategy options with an Apple HIG segmented picker empowers Elliott and Chloe with choice and transparency.

---

## Prior Solutions & Patterns
- [`docs/plans/2026-11-01-1945-automated-recipe-enhancement-to-85-fit-score-plan.md`](file:///Users/elliottcallender/Downloads/PlatePlan-main/docs/plans/2026-11-01-1945-automated-recipe-enhancement-to-85-fit-score-plan.md): Established the 5 culinary levers, discrete item scaling, and 85+ score targeting.
- `Pattern #10: Atomic State Transitions`: Ensure switching between enhancement options is instantaneous and idempotent, preserving immutability until explicit user acceptance.
- `Pattern #09: Rigorous Planning & Multi-Order Thinking`: Analyze downstream impacts on shopping list aggregation, recipe wizard edits, and Firestore persistence.

---

## Multi-Order Thinking & Architecture Analysis

### 1st Order (Direct Effects)
- `RecipeEnhancementService.js`: Refactor `generateEnhancementPlan` to return `strategies: [...]` (or `options: [...]`), where each strategy has:
  - `id`: e.g. `'strategy_smart_swaps'`, `'strategy_protein_boost'`, `'strategy_plant_blend'`
  - `name`: e.g. `'Smart Swaps'`, `'Protein Boost'`, `'Plant & Fiber Booster'`
  - `description`: Summary of culinary approach
  - `predictedScore`: Computed fit score $\ge 85\%$
  - `predictedTier`: e.g. `'🟢 Ideal Match'`
  - `macros`: `{ perServing, total }`
  - `adjustments`: Specific checklist of actions with `preTaxonomy` and `postTaxonomy`
  - `enhancedRecipePayload`: Complete recipe payload for that strategy.
- `RecipeEnhancementModalUI.js`: Render an Apple HIG segmented control / tab switcher at the top of the modal when `plan.strategies.length > 1`.

### 2nd Order (Downstream Components)
- `RecipeWizardStep3Handlers.js` & `RecipeDetailModalService.js`: Both call `openEnhancementModal`. The `onApply` callback continues to receive the selected `enhancedRecipePayload`, ensuring 100% backward compatibility without changing callers.
- Checkbox live re-scoring must recalculate against the **currently selected strategy's baseline**, not leak state across strategies.

### 3rd Order (Data & Persistence)
- `recipe.enhanced`: Only the user-selected strategy is written to `recipe.enhanced` when "Accept & Apply Enhanced Variant" is clicked. Unselected options are discarded, keeping the Firestore document lean and preserving SSOT.

### 4th Order (Culinary Feasibility)
- Not every recipe has enough levers to produce 3 wildly different options. If a recipe only admits 1 sensible strategy (e.g. pure fat moderation on an already high-protein curry), the engine must gracefully present just that 1 strategy without creating artificial or nonsensical options.

---

## Concrete Proposed Strategies

1. **Strategy A: "Smart Swaps" (Lean Pantry Substitution)**
   - Prioritizes Lever 4 (Pantry Swaps: 5% lean beef/mince, reduced fat cheese, light coconut milk/mayo) and Lever 1 (fat moderation).
   - Minimal volume change; familiar plate appearance and texture.
   - Ideal for calorie control while meeting protein goals.

2. **Strategy B: "Protein Volume Boost" (Portion Scaling)**
   - Prioritizes Lever 2 (Scaling primary protein: e.g. 2 patties ➔ 3 or 4 patties, 200g chicken ➔ 300g chicken).
   - Pairs with Lever 3 (Carb balancing / gentle bun/rice trimming) or Lever 1 (oil moderation) to prevent calorie overshoot.
   - Ideal for high satiety, post-workout, and double-protein meals.

3. **Strategy C: "Fiber & Plant Booster" (Wholefood Enrichment)**
   - Prioritizes adding or blending a plant-based protein booster (e.g. black beans into burgers, chickpeas/lentils into curries, or edamame/tofu into stir-fries).
   - High micronutrient and fiber density, lower saturated fat.

---

## Acceptance Criteria
- [ ] `generateEnhancementPlan` evaluates and returns an array of `strategies` (1 to 3 valid options, each scoring $\ge 85\%$).
- [ ] If multiple strategies achieve $\ge 85\%$, `RecipeEnhancementModalUI` displays an Apple HIG segmented control allowing the user to click between strategies.
- [ ] Switching strategies updates the headline fit score badge, target impacts, adjustment rows, and pre/post swap taxonomy in real time.
- [ ] Toggling adjustment checkboxes within the selected strategy updates that strategy's live fit score.
- [ ] Clicking "Accept & Apply Enhanced Variant" saves strictly the selected strategy's payload into `recipe.enhanced`.
- [ ] Unit test suite in `scripts/test_recipe_enhancement_service.js` covers multi-strategy generation, verifying distinct adjustment sets and valid scores across options.
- [ ] All existing test suites pass; production build compiles cleanly.

---

## Implementation Steps
1. **Extend `RecipeEnhancementService.js`**:
   - Decompose plan generation into modular strategy builders: `buildSmartSwapsStrategy`, `buildProteinBoostStrategy`, `buildPlantBoosterStrategy`.
   - Aggregate valid strategies that achieve $\ge 85\%$ (or top-ranking if baseline is very low).
   - Return `{ selectedStrategyId, strategies: [...], ...primaryStrategy }` for 100% backward compatibility.
2. **Update `RecipeEnhancementModalUI.js`**:
   - Add Apple HIG segmented pill bar (`.enh-strategy-picker`) when `strategies.length > 1`.
   - Wire click handler to switch `activeStrategyId` and re-render interactive adjustments.
3. **Expand Test Suite**:
   - Add Test 7 in `scripts/test_recipe_enhancement_service.js` verifying multi-option generation on burger and curry recipes.
4. **Verification & Build**:
   - Run tests, run `npm run build`, push to git.
