# Exploration: Recipe Servings Flow, Terminology Drift, and Macro Scaling

> Date: 2026-10-31  
> Topic: Analysis of `baseServings`, `currentServings`, and `targetServings` in Recipe Wizard, Vault, and Planner  
> Status: Exploration Complete — Ready for Architectural Simplification  

---

## 1. Executive Summary

The user's skepticism regarding the confusing serving terms (`baseServings`, `currentServings`, `targetServings`) is completely justified. 

Our investigation reveals:
1. **Conflation of "Recipe Yield" with "Cooking Portions"**:
   PlatePlan currently conflates **The Recipe (a static template with an author's yield, e.g. "Makes 8 pizzas" or "Serves 4")** with **A Planned Meal (a household execution, e.g. "Elliott & Chloe cooking 2 portions tonight")**.
2. **Dead Terminology Drift (`currentServings`)**:
   `currentServings` is an obsolete artifact from an old manual input form in Step 1A. It is set in state but never read anywhere in the application; it is 100% redundant with `baseServings`.
3. **Destructive Mutation of Ingredient Quantities on Save**:
   When a user adjusts "Target Servings" in Wizard Step 2 or 3, the wizard permanently overwrites the author's ingredient quantities with scaled quantities (`i.qty = scaledQty`) and drops `baseServings`. This leaves method steps detached from ingredient quantities (e.g. method says *"divide into 8 balls"*, but ingredients were permanently scaled down to 2 balls).
4. **Why This Causes Inflated / Inaccurate Macros**:
   - **Yield Misdetection**: When recipes have no explicit `Serves:` line (e.g. *Sausage Party Pizza*, which yields 8 pizzas), PlatePlan defaults to `baseServings = 4`. When scaled to 2 target servings (0.5x), the recipe still contains 4 whole pizzas divided between 2 people (2 whole pizzas per person = 2,000+ kcal).
   - **Step 3 Servings Desync**: Step 2 scales ingredient quantities in the DOM, while Step 3 has a separate `Servings` input (`#tp-serving-size`). If a user edits servings in Step 3, `recalculateWizardMacros` divides the already-scaled ingredients by the new number, creating a severe ratio mismatch.

---

## 2. Anatomy of the Current System: Where the Three Servings Live

```
Step 1: Input / Parse
├── Manual (Step 1A):
│   ├── "Current Servings" [Input]  ──> saved to rec.currentServings & rec.baseServings (Redundant!)
│   └── "Target Servings"  [Input]  ──> saved to rec.targetServings
└── Bulk Parse (Step 1B):
    └── Regex parse `serves:\s*(\d+)` ──> defaults to 4 if not found ──> rec.baseServings = 4

Step 2: Mapping & Scaling
├── Banner displays: "(Base: 4 servings) | Target Servings: [ 2 ] (0.50x)"
├── updateServingsScale(newServings):
│   ├── scaleFactor = targetServings / baseServings (e.g. 2 / 4 = 0.50x)
│   ├── Overwrites DOM: input.value = baseQty * scaleFactor
│   └── Overwrites objects: item.scaledQty = baseQty * scaleFactor
└── recalculateWizardMacros():
    ├── Sums total calories from all `item.scaledQty`
    └── Divides by targetServings: calories = totalCal / targetServings (Per portion)

Step 3: Review & Crossbar
├── Crossbar: "Dual-Profile Split (${recipe.targetServings || 4} servings)"
│   └── Multiplies baselineCal * batchServes(2) * sharePct (Elliott 59%, Chloe 41%)
├── Input: `<input id="tp-serving-size" value="${recipe.targetServings || 4}">`
└── On Save (onSaveRecipe):
    ├── rec.servings = safeServings (e.g. 2)
    ├── rec.serves = safeServings (e.g. 2)
    ├── rec.targetServings = safeServings (e.g. 2)
    ├── rec.baseServings is DISCARDED (Not saved to Firestore!)
    └── rec.ingredients saved as `i.qty = i.scaledQty || i.qty` (PERMANENTLY MUTATED!)

Vault / Planner / Shopping List
├── Recipe in Vault has only `recipe.servings = 2` (Original author quantities lost!)
└── Planner / Shopping List scales dynamically:
    `scaleMultiplier = meal.servings / recipe.servings`
```

---

## 3. The 4 Fatal Flaws in This Architecture

### Flaw 1: Industry Violation — Mutating Base Data on Save
According to software engineering and culinary data-model standards (e.g. RMS best practices):
> *"Always store the recipe in its base/authoring state (e.g. '4 servings' or '8 pizzas'). Never mutate base ingredient quantities in the database when a user requests a 2-serving batch. Perform scaling on-the-fly in the application layer or read view."*

When PlatePlan saves `scaledQty` into `qty`:
- The recipe permanently loses its canonical reference quantities.
- If you import a recipe from a book that makes 8 portions and scale it to 2, the recipe now says `Servings: 2`. If you later cook for 4 friends, scaling it to 4 multiplies the already-halved recipe by 2, returning to 4 portions, but the original yield is forever obscured.
- The method instructions become incongruous: *Sausage Party Pizza* instructions say *"Divide dough into 8 equal balls; wrap 4 in clingfilm to freeze"*, but the ingredient list only has 250g of flour (enough for 2 dough balls, not 8).

### Flaw 2: The Redundant `currentServings`
In Step 1A, having both "Current Servings" and "Target Servings" makes no logical sense. When a user manually inputs a recipe from a recipe card, they are inputting the author's recipe. There is only one number at that moment: **Recipe Yield** (how many portions this recipe makes). "Target Servings" is only relevant when deciding how much *you* want to cook today.

### Flaw 3: Double-Scaling Risk in Step 3
Step 2 scales the ingredient quantities (`item.scaledQty = baseQty * (target / base)`). 
Step 3 has an editable text input: `<input id="tp-serving-size" name="rev_servings">`.
If the user in Step 2 scaled a 4-serving recipe to 2 servings (`scaledQty` = half), and then in Step 3 changes the `Servings` input to 4:
- `recalculateWizardMacros` divides the *halved* quantities by 4!
- The calories drop to $\frac{1}{4}$ of what they should be.
Conversely, if the user in Step 3 changes it from 4 to 2 without Step 2 having updated `scaledQty`:
- It divides the full 4-portion ingredients by 2, doubling the calories per serving!

### Flaw 4: Why This Inflated Sausage Party Pizza
1. *Sausage Party Pizza* yields **8 individual 10-inch pizzas** (1kg flour, 8 sausages, 140ml oil, 800g tomatoes, 240g dip).
2. The text lacked a `Servings: 8` header.
3. PlatePlan defaulted to `baseServings = 4`.
4. The user saw `Base: 4` and wanted dinner for 2, so they selected `Target Servings: 2`.
5. The wizard scaled the ingredients by $2 / 4 = 0.5x$ (reducing 8 pizzas to 4 pizzas).
6. It then calculated `calories = totalCal / targetServings = totalCal / 2`.
7. Each serving represented **2 entire 10-inch pizzas per person** ($\approx 1,800$ kcal).
8. Had the author's yield been recognized or set as **8 servings (pizzas)**, scaling to 2 would have yielded $2 / 8 = 0.25x$ (1 pizza per person = $\approx 850$ kcal).

---

## 4. Proposed Solution: The Simplified "Single Truth" Serving Model

We can dramatically simplify the mental model, eliminate UI confusion, and prevent macro errors by adopting the standard RMS model:

### 1. Decouple `Recipe Yield` from `Planned Portions`
A Recipe document in the Vault should only have ONE immutable serving number:
- **`recipe.yield` (or `recipe.servings`)**: How many portions or units the recipe as written produces (e.g. 4 servings, 8 pizzas, 12 muffins).
- **`recipe.ingredients`**: ALWAYS stored with unscaled, canonical author quantities (`baseQty`). Never permanently mutated on save.

### 2. Eliminate `currentServings` and `targetServings` from the Storage Model
- Delete `currentServings` completely across the codebase.
- In Step 1: Only ask for **"Recipe Yield (Servings)"** (defaulting to whatever was parsed from text, or 4 if unstated).
- In Step 2: Allow the user to adjust the **"Recipe Yield"** directly if the parser guessed wrong (e.g. "This makes 8 pizzas, not 4").
- Remove the scaling slider from Step 2 entirely! A user importing a recipe into their Vault is saving the *recipe*, not logging tonight's dinner.
- Or, if household default scaling is desired: Keep scaling purely as a **runtime view projection** (`previewServings`), never mutating the underlying saved ingredient quantities.

### 3. Clean Macro Calculation Pipeline
The formula becomes crystal clear and impossible to desync:
$$\text{Total Recipe Calories} = \sum (\text{canonical ingredient qty} \times \text{product kcal/unit})$$
$$\text{Calories Per Serving} = \frac{\text{Total Recipe Calories}}{\text{recipe.servings}}$$
$$\text{Elliott Portion (Dinner)} = \text{Calories Per Serving} \times 2 \times 0.59$$
$$\text{Chloe Portion (Dinner)} = \text{Calories Per Serving} \times 2 \times 0.41$$

### 4. Comparison: Before vs After

| Concept | Current System | Simplified Proposed System |
| :--- | :--- | :--- |
| **Step 1 Inputs** | "Current Servings" & "Target Servings" | **"Recipe Yield / Servings"** (Single Input) |
| **Bulk Parsing** | Guesses 4, hides yield in Step 1B | Displays parsed yield; user can edit if unstated |
| **Step 2 Action** | Mutates ingredient quantities to `scaledQty` | Ingredients remain canonical author amounts |
| **Step 3 Display** | Dual servings inputs (`targetServings` & `servings`) | **Servings: [ X ]** (Edits the Recipe Yield) |
| **Firestore Storage** | Saves scaled quantities; drops `baseServings` | Saves canonical ingredients + `servings: X` |
| **Planner / Cooking** | Dynamic scaling against mutated base | Dynamic scaling against canonical yield |
| **Method Steps** | Incongruous with scaled ingredient amounts | Perfectly matches canonical recipe steps |
