# Exploration: Automated Recipe Enhancement to 85+ Fit Score Engine

**Date:** 2026-11-01  
**Scope:** Universal Fit Score System (`fitScoreCalculator.js`, `fitScoreWeights.js`), Recipe Enhancement Schema (`recipe.enhanced`), Recipe Authoring / Wizard (`RecipeWizardStep3Handlers.js`), Recipe Detail Modal (`RecipeDetailModalUI.js`), and Household Nutrition Targets (`NutritionService.js`).  
**Author:** Antigravity (Advanced Agentic Coding) & Elliott  

---

## 1. Problem Statement & Objective

PlatePlan's **Universal Fit Score Engine** evaluates how well a recipe matches Elliott and Chloe's personal daily nutritional targets (for dinner, lunch, breakfast, or snacking). 
The score is divided into four distinct tiers:
- 🟢 **85–100% — Ideal Match** (`#22c55e`, Green)
- 🟡 **70–84% — Needs Work** (`#eab308`, Yellow)
- 🟠 **50–69% — Suboptimal** (`#f97316`, Orange)
- 🔴 **< 50% — Poor Match** (`#ef4444`, Red)

Currently, recipes imported from external websites or typed manually frequently land in the **Yellow (70–84%)**, **Orange (50–69%)**, or **Red (< 50%)** tiers. To make them fit household goals, the user must manually calculate and rewrite the recipe in Step 3 of the Recipe Wizard.

**The Goal:**  
Design and implement an automated **Recipe Enhancement Engine** that analyzes a recipe's current fit score, identifies the specific macro bottlenecks (excess calories, fat surplus, or protein deficiency), and algorithmically generates an **Enhanced Recipe (`recipe.enhanced`)** with adjusted quantities, swaps, and actionable cooking notes to guarantee a fit score of **at least 85 (🟢 Ideal Match)** while strictly preserving the original recipe unchanged.

---

## 2. Existing Architectural Foundation

PlatePlan **already possesses the architectural foundations** required for recipe variants:

### 2.1 Native `recipe.enhanced` Schema
The codebase already natively recognizes and supports dual-variant recipes:
- **`RecipeAuthoringService.js`**: Defines the recipe structure with optional `recipe.enhanced` containing distinct `ingredients`, `nutrition`, `macros`, `method`, `portions`, and `changes`.
- **`RecipeWizardStep3View.js` & `RecipeWizardStep3Handlers.js`**: Already contains an inline segmented toggle between `Original` and `✨ Enhanced`.
- **`PlannerMealSlot.js` & `PlannerSwapModalUI.js`**: Users can already select either the `original` or `enhanced` variant in the weekly meal planner, complete with dedicated `[Enh]` / `Enhanced` badges.
- **`ShoppingCalculationService.js`**: Automatically reads `recipe.enhanced.ingredients` if the meal plan slot uses the enhanced variant, ensuring the grocery shopping list buys the correct modified quantities.
- **`FitScoreService.js`**: Has built-in logic to evaluate both variants and flag `_bestVariant = scoreEnh > scoreOrig ? 'enhanced' : 'original'`.

### 2.2 Ingredient-by-Ingredient Macro Attribution
In `src/components/recipe/RecipeWizardStep3Handlers.js` (`recalculateWizardMacros`), PlatePlan resolves every recipe ingredient to its mapped pantry product and calculates exact individual macro contributions via `NutritionService.calculateItemNutrition(product, qty, unit)`.
This means the system knows **exactly which ingredient contributes how many calories and how much protein**.

### 2.3 Mathematical Target for 85+ Fit Score
In `src/utils/fitScoreWeights.js` and `macroScoringUtils.js`, the asymmetric scoring curve defines the 85+ threshold:
For household dinner (with Elliott at 2,100 kcal / 140g protein and Chloe at 1,650 kcal / 105g protein):
- **Per-serving Calorie Target:** ~656 kcal.
  - To achieve $\ge 85$ calorie score: actual calories per serving must fall within **85% to 105% of target** (approx **558 kcal to 689 kcal**).
- **Per-serving Protein Target:** ~43g protein.
  - To achieve $\ge 85$ protein score: actual protein per serving must be **$\ge 95\%$ of target** (approx **41g protein or higher**).
- When both are met, the combined weighted fit score is guaranteed to be **$\ge 85$ (🟢 Ideal Match)**.

---

## 3. Why Recipes Score Under 85 in Practice

Analyzing the household recipe vault reveals four recurring archetypes of suboptimal fit scores:

| Recipe Archetype | Example | Typical Initial Score | Primary Bottleneck | Required Adjustment Direction |
| :--- | :--- | :--- | :--- | :--- |
| **High-Fat / Calorie Bomb** | *Gaeng Phed Ped Yang*, *Creamy Carbonara*, *Tikka Masala* | 45–65% (🔴 / 🟠) | Excessive cooking oil (e.g. 30–45ml), full-fat coconut cream, or heavy dairy fat. | Reduce cooking oil to 5–10ml; swap full-fat coconut milk for light coconut milk; moderate carb portions. |
| **Protein-Deficient Carbs** | *Pasta Pomodoro*, *Vegetable Biryani*, *Mushroom Risotto* | 50–70% (🟠 / 🟡) | Plenty of carbs and calories, but only 10–18g protein per serving. | Protein cannot be fixed by quantity tuning alone; requires adding a lean protein booster (edamame, tofu, chicken, pulses). |
| **Under-Portioned Protein** | *Beef Stir Fry*, *Chicken Fajitas* | 68–78% (🟡) | Good overall composition, but only 120g meat/tofu per person (~24g protein), leaving a 15–20g protein deficit. | Scale up the primary protein source from 250g $\to$ 380g across the batch. |
| **Mislabeled Servings** | *Homemade Pizza*, *Lasagne* | 35–55% (🔴) | A recipe yielding 2,800 total kcal marked as "Serves 2" (1,400 kcal/portion). | Increase base recipe yield from 2 servings to 3 or 4 servings. |

---

## 4. Architectural Implementation Options

### Option A: Algorithmic Multi-Lever Optimizer (Pure Quantity Tuning)
**How it works:**  
The engine leaves the ingredient list intact (no new ingredients added). It tags each ingredient by culinary role using existing categories/taxonomy:
1. `cooking_fat` (vegetable oil, olive oil, butter)
2. `primary_protein` (chicken, beef, tofu, salmon, eggs, mince)
3. `starch_carb` (pasta, rice, noodles, potatoes)
4. `fresh_veg` (broccoli, onions, carrots, peppers)

**The Adjustment Algorithm:**
1. **Lever 1 (Trim Empty Calories):** If calories exceed the upper limit (> 689 kcal), decrease cooking fat towards a culinary minimum (e.g. 5ml per serving).
2. **Lever 2 (Boost Protein Source):** If protein is below target (< 41g), increase the `primary_protein` ingredient quantity in 10% increments up to a sensible ceiling (e.g., max 200g meat/tofu per serving).
3. **Lever 3 (Carb Tapering):** If calories are still high after boosting protein, taper dry carb quantities (e.g. from 100g to 75g per serving).
4. Run `calculateMealFitScore()` after each iteration. Terminate as soon as score reaches $\ge 85$ (or reaches optimal peak).
5. Auto-populate `recipe.enhanced` with modified quantities and generate summary text in `enhanced.changes`.

*Pros:* Deterministic, fast (<50ms execution), no external API calls, preserves recipe flavor identity completely.  
*Cons:* Cannot fix recipes that inherently lack any protein source (e.g., plain tomato pasta).

---

### Option B: Smart Pantry Swaps + Lean Protein Additions (Hybrid)
**How it works:**  
Includes all of Option A, plus an intelligent rule-based swap dictionary and pantry matcher:
1. **Direct Product Swaps:**
   - Full-fat coconut milk $\to$ Light coconut milk (saves ~100 kcal / 100ml)
   - 20% fat beef mince $\to$ 5% lean beef mince (saves ~120 kcal & adds protein)
   - Sour cream / Mayo $\to$ 0% Greek yoghurt or light mayo
   - Regular cheese $\to$ Reduced fat cheese / Cypriot light halloumi
2. **Protein Booster Suggestion:**
   - If a recipe has no primary protein source (total protein < 20g/serving), the engine suggests adding a matching protein booster from the household's pantry favorites:
     - Asian/Curry: *"Add 280g Firm Tofu or 300g Chicken Breast"*
     - Italian/Pasta: *"Add 150g Edamame beans or 250g 5% Mince"*
     - Mexican: *"Add 1 can Black Beans or 250g Turkey Breast"*

*Pros:* Can elevate *any* recipe to 85+ fit score, even vegetarian carb-heavy meals.  
*Cons:* Modifies ingredient composition; requires user consent before adding ingredients.

---

### Option C: Interactive "Enhancement Studio" Modal
**How it works:**  
Rather than applying changes silently, clicking a **"✨ Optimize to 85+ Fit"** button opens a focused comparison sheet:
1. **Live Fit Score Preview:** `🔴 58% ➔ 🟢 92%`
2. **Interactive Tweak Cards:**
   - `[x] Reduce Vegetable Oil from 30ml to 10ml (-180 kcal)`
   - `[x] Increase Chicken Breast from 250g to 360g (+28g protein)`
   - `[x] Reduce Basmati Rice from 180g to 140g (-140 kcal)`
3. User can uncheck any adjustment they don't want (e.g. if they insist on full rice) and watch the predicted score update in real-time.
4. Clicking **"Accept & Save Enhanced Version"** creates `recipe.enhanced`.

*Pros:* Maximum user agency; highly educational; avoids unintended culinary compromises.  
*Cons:* Requires a new modal component or embedding into Recipe Wizard Step 3.

---

## 5. UI Integration Points in PlatePlan

Where should this capability appear in the user interface?

1. **Recipe Wizard Step 3 ("Inline Editable Review"):**
   - In the `Variant Toggle` (`Original` vs `✨ Enhanced`):
   - Currently, clicking `✨ Enhanced` simply creates a duplicate copy of the original recipe.
   - We can place an **"⚡ Auto-Optimize to 85+ Fit"** action directly here. One click instantly adjusts the enhanced tab's ingredient quantities and recalculates the macros to reach Green 85+!
2. **Recipe Detail Modal (`RecipeDetailModalUI.js`):**
   - When viewing an existing vault recipe whose score is $< 85$ and has no enhanced variant:
   - Display a prompt banner or action button: **"✨ Generate 85+ Enhanced Version"**.
   - Opens the comparison / review flow.
3. **Recipe Vault Card ("More" menu):**
   - Add **"✨ Create 85+ Enhanced Variant"** to the dropdown menu in [`VaultRecipeCard.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/vault/VaultRecipeCard.js).

---

## 6. Multi-Order Consequences ("And Then What?")

- **1st Order (Immediate):** Users get instant, mathematically validated recipe modifications that hit household macro targets with zero guesswork.
- **2nd Order (Meal Planning & Shopping):** The weekly meal planner generator can automatically favor or swap into the enhanced variant. The shopping list calculates exact purchases based on whichever variant is chosen on the planner.
- **3rd Order (Data Safety):** Original recipes remain 100% immutable in the `recipe` root document; all adjustments are isolated to the `recipe.enhanced` sub-object.
- **4th Order (Culinary Quality):** Strict guardrails are necessary to prevent absurd outputs (e.g. optimizer cutting cooking fat to 0g or multiplying protein to 1kg). Bounded min/max limits must govern every lever.

---

## 7. Key Decisions & Questions for User Alignment

Before creating the formal implementation plan, we need your input on key design decisions:

1. **Adjustments Scope:**  
   Should the auto-enhancer only adjust **quantities of existing ingredients** (Option A), or should it also be allowed to suggest **pantry product swaps** (e.g. Light Coconut Milk, 5% Mince) and **protein additions** when a recipe has no protein (Option B)?
2. **User Experience:**  
   Do you prefer a **one-click instant optimizer** inside Recipe Wizard Step 3 (that populates the Enhanced tab immediately), an **interactive modal preview** with checkboxes where you can approve individual tweaks, or **both**?
3. **Vault Integration:**  
   Should we also enable generating an enhanced version for **existing recipes already saved in your Vault** (via the Recipe Detail Modal / Vault Card menu)?
4. **Yield / Servings Flexibility:**  
   If a recipe's calories are outrageously high (e.g. 1,400 kcal/serving), should the engine have permission to recommend increasing the recipe's base serving yield (e.g. Serves 2 $\to$ Serves 3 or 4) to balance the portion?
