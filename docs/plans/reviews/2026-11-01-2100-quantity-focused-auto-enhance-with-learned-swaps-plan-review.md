---
title: "Plan Review: Quantity-Focused Recipe Auto-Enhance with Interactive Learned Swaps"
date: 2026-11-01
target_plan: "docs/plans/2026-11-01-2100-quantity-focused-auto-enhance-with-learned-swaps-plan.md"
verdict: "Approved with Critical Enhancements ✓"
---

# Plan Review: Quantity-Focused Recipe Auto-Enhance with Interactive Learned Swaps

## Review Executive Summary
The plan directly addresses the two root UX flaws discovered in real-world testing:
1. **Culinary mismatches** (e.g. curdling yogurt in hot pasta sauces).
2. **Redundant self-swapping** (e.g. Cheddar already linked to Reduced Fat Cheddar proposing a swap to itself).

By shifting the core automated engine to **pure quantity adjustments** (protein scaling, fat moderation, carb balancing, serving rebalancing) and making product swaps **user-controlled via an interactive dropdown that feeds household memory**, the solution ensures 100% culinary authenticity, zero curdling, and intelligent long-term personalization.

---

## Deep Gap Analysis & Mitigations

### 1. High-Fat / Low-Protein Edge Cases (Can Quantity-Only Hit 85%?)
- **Potential Risk**: Some recipes (e.g., pork sausage gnocchi with full cream) have so much inherent fat that simply reducing 15ml of cooking oil may not bring the Fit Score to 85% without either increasing servings or swapping the cream/sausage.
- **Mitigation in Engine**:
  - Route 1: Boost protein portion (lean cuts/items) + moderate cooking fat.
  - Route 2: Rebalance servings (e.g., 2 servings $\rightarrow$ 3 portions), which dilutes per-serving saturated fat and calorie excess into ideal dinner ranges.
  - If a route remains under 85%, the UI surfaces the interactive swap dropdown as a highlighted suggestion ("Select lighter substitute to reach 90%+"), giving the user full culinary agency.

### 2. Swap Candidate Discovery (Pantry Hierarchy First)
- **Potential Risk**: Cross-category keyword search could suggest absurd substitutes (e.g. search for "creme" matches cream cheese or ice cream).
- **Mitigation**:
  - Candidate discovery must query the **Pantry Bank hierarchy first**:
    1. Products under the *same Root Item* or *same Subtype* (e.g., `Dairy & Eggs / Creme Fraiche` $\rightarrow$ `50% Less Fat Creme Fraiche`).
    2. Any previously saved household preference for this ingredient in `preferences.swapPreferences`.
    3. Explicitly exclude any product whose ID matches the currently linked product or whose macro profile provides zero nutritional improvement.

### 3. Volume Preservation Guarantee
- **Rule**: As requested, volume must not change when substituting.
- **Implementation**: 
  - When swapping product $A \rightarrow B$, the quantity $Q$ and unit $U$ are strictly preserved: $Q_{post} = Q_{pre}$.
  - The macros are recalculated as: $\Delta \text{kcal} = (B_{\text{kcal}/100g} - A_{\text{kcal}/100g}) \times (Q / 100)$.

### 4. Single-Writer Persistence & State Isolation
- **Swap Preferences**: Saved under `households/elliott-chloe/settings/preferences` via a merged update to `swapPreferences: { [ingredientKey]: preference }`. Does not overwrite user splits or profile preferences.
- **Recipe Changes**: Saved strictly to `recipe.enhanced` via `HouseholdRepository.saveRecipe`. Original recipe remains untouched.

---

## Acceptance Checklist

- [x] Automated routes prioritize quantity scaling, fat moderation, and serving rebalancing.
- [x] Zero self-swapping (pre-linked product is checked against proposed candidates).
- [x] Interactive Apple-style inline dropdown (`[ Product Substitute ▼ ]`) allows user selection on demand.
- [x] Volume is preserved 1:1 when swapping.
- [x] User-selected swaps are persisted to `preferences.swapPreferences` for long-term household learning.
- [x] No service workers, no bundler dependencies, ES modules only.

## Verdict
**APPROVED ✓** — Ready to proceed with `/work`.
