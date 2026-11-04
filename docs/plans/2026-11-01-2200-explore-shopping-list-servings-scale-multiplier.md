# Exploration: Shopping List Quantity Scaling & Multi-Serving Recipe Aggregation

> Date: 2026-11-01  
> Topic: shopping-list-recipe-servings-scaling  
> Focus: Diagnosing why multi-day/multi-serving recipes (e.g. Harissa Chicken & Grain Salad) produce 6 qty instead of 3 qty in the shopping list.  
> Status: Exploration Complete  

---

## 1. Executive Summary & Incident Analysis

### The User's Observation
In Step 3 of the Meal Planner Wizard (Shopping List & Substitutions):
- Under **"Red Peppers Each"**, the breakdown shows:
  - **Cheesy Chilli Macaroni**: `1qty`
  - **Harissa Chicken & Grain Salad**: `6qty`
  - Total: `7qty`
- The user noted:
  > *"why do I get the wrong shopping list quantities here, this should be 3 (for 4 servings) rather than 6 as we're having it each for two days"*

### The Math Behind What the User Expected vs What PlatePlan Did

#### The Recipe Metadata
1. **Harissa Chicken & Grain Salad** (`id: "r1784044348904"`):
   - Baseline Yield: **`serves: 4`**
   - Recipe Ingredient: **`3 Red Peppers`** (unit: `qty`)
2. **Cheesy Chilli Macaroni**:
   - Baseline Yield: **`serves: 2`**
   - Recipe Ingredient: **`1 Red Pepper`** (unit: `qty`)

#### The Meal Plan Schedule
- Elliott and Chloe have Harissa Chicken for lunch on **two consecutive days** (Day 1 and Day 2):
  - Day 1: 1 lunch portion for Elliott (`lunchE`) + 1 lunch portion for Chloe (`lunchC`) = **2 servings**
  - Day 2: 1 lunch portion for Elliott (`lunchE`) + 1 lunch portion for Chloe (`lunchC`) = **2 servings**
  - Total planned consumption across both days = **4 servings** (2 people $\times$ 2 days = 4 servings).

#### The Expected Shopping Quantity
- The recipe yields **4 servings** and requires **3 Red Peppers**.
- Since the household is consuming exactly 4 servings ($1.0 \times$ recipe yield), the shopping list should buy:
  $$4 \text{ servings} \times \left(\frac{3 \text{ Red Peppers}}{4 \text{ servings}}\right) = \mathbf{3\text{ Red Peppers}}$$

#### The Actual Shopping Quantity (Why it became 6)
In `src/services/ShoppingCalculationService.js`:
```javascript
// Line 258:
const weight = (slotKey.endsWith('E') || slotKey.endsWith('C')) ? 0.5 : 1;
const mealType = slotKey.replace(/[EC]$/, '');
processSlotNode(slotVal, weight, dayNum, mealType);
...
// Line 218:
const convertedAmount = Math.round((strict.qty * portionWeight) * 10) / 10;
```

Notice:
1. `weight` was **hardcoded to `0.5`** for any slot ending in `'E'` or `'C'`.
2. Whoever wrote that formula assumed that **every recipe in the vault serves 2**. Under that naive assumption, 1 person eating is $0.5$ of a recipe.
3. Because `portionWeight = 0.5` is multiplied directly by the recipe ingredient quantity without dividing by `recipe.serves`:
   - Day 1 `lunchE`: $3 \times 0.5 = 1.5$ peppers
   - Day 1 `lunchC`: $3 \times 0.5 = 1.5$ peppers
   - Day 2 `lunchE`: $3 \times 0.5 = 1.5$ peppers
   - Day 2 `lunchC`: $3 \times 0.5 = 1.5$ peppers
   - Total for Harissa Chicken = $1.5 + 1.5 + 1.5 + 1.5 = \mathbf{6\text{ Red Peppers}}$!

The system bought **8 servings worth of food** for a 4-serving plan, exactly doubling the required amount.

Conversely, for Cheesy Chilli Macaroni:
- `serves = 2`
- Day X `dinnerE`: $1 \times 0.5 = 0.5$ pepper
- Day X `dinnerC`: $1 \times 0.5 = 0.5$ pepper
- Total = $0.5 + 0.5 = \mathbf{1\text{ Red Pepper}}$.
Because Cheesy Chilli Macaroni coincidentally has `serves: 2`, the hardcoded `0.5` happened to produce the right answer for it, concealing the bug.

---

## 2. Root Cause Breakdown

### Flaw A: Missing `baseServings` Division in `ShoppingCalculationService.js`
In `aggregateShoppingListFromPlan`:
- It loops through all plan slots (`rawSlots`).
- When examining a recipe, it looks up `fullRecipe = vaultRecipes.find(...)`.
- However, it **never reads `fullRecipe.serves`**!
- It applies a static `portionWeight = 0.5` regardless of whether the recipe serves 1, 2, 4, 6, or 8.

### Flaw B: Distortion Across Non-2-Serving Recipes
- **4-Serving Recipes (e.g. Traybakes, Curries, Batch Salads)**:
  - 1 person eating 1 portion is charged $0.5$ of the whole recipe instead of $0.25$ ($1/4$).
  - Over-purchases by **$200\%$**.
- **1-Serving Recipes (e.g. Protein Shakes, Single Bowls, Omelettes)**:
  - 1 person eating 1 portion is charged $0.5$ of the recipe instead of $1.0$ ($1/1$).
  - Under-purchases by **$50\%$** (buys half of what is needed).
- **6-Serving Recipes (e.g. Big Batch Bolognese, Chilli, Stews)**:
  - 1 person eating 1 portion is charged $0.5$ of the recipe instead of $0.167$ ($1/6$).
  - Over-purchases by **$300\%$**.

---

## 3. Systematic Mathematical Solution

### The Correct Scaling Formula
Let:
- $\text{personCount} = 1$ if the slot is an individual person slot (`slotKey.endsWith('E') || slotKey.endsWith('C')`, or `slotNode.elliott`, or `slotNode.chloe`).
- $\text{personCount} = 2$ if the slot is a shared household slot (legacy or un-suffixed).
- $\text{targetServings} = \text{Number}(\text{slotNode.servings} || \text{personCount} || 1)$.
- $\text{baseServings} = \max(1, \text{Number}(fullRecipe.serves || fullRecipe.servings || 2) || 2)$.

The true **portion scaling fraction** for any planned slot is:
$$\text{scaleMultiplier} = \frac{\text{targetServings}}{\text{baseServings}}$$

And the ingredient quantity contributed by that slot is:
$$\text{slotQty} = \text{strict.qty} \times \text{scaleMultiplier}$$

### Verification Across All Scenarios

| Recipe | Base Serves | Planned Usage | Target Servings | Scale Multiplier | Recipe Base Qty | Shopping List Result |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Harissa Chicken** | **4** | 2 days $\times$ 2 people | 4 | $4 \times (1 / 4) = 1.0$ | 3 Red Peppers | **3 qty** (Target achieved!) |
| **Cheesy Chilli Macaroni** | **2** | 1 day $\times$ 2 people | 2 | $2 \times (1 / 2) = 1.0$ | 1 Red Pepper | **1 qty** (Preserved!) |
| **Protein Shake** | **1** | 1 day $\times$ 1 person | 1 | $1 \times (1 / 1) = 1.0$ | 1 Banana | **1 qty** (Corrected from 0.5!) |
| **Slow Cooker Chilli** | **6** | 2 days $\times$ 2 people | 4 | $4 \times (1 / 6) = 0.67$ | 600g Beef | **400g** (Accurate 4-portion yield!) |

---

## 4. Multi-Order Thinking & Systemic Impact

### 1st Order Consequences
- Step 3 of the Meal Planner Wizard and the Shopping List view will display exact, chef-accurate quantities.
- "Red Peppers Each" will correctly reflect 3 qty for Harissa Chicken & Grain Salad (for 4 total person-servings over 2 days) + 1 qty for Cheesy Chilli Macaroni = **4 qty total** instead of 7 qty.
- No wasted groceries or excessive basket totals.

### 2nd Order Consequences
- **Pack Multiple Estimation**: Because `calculateShoppingItemCost` uses `entry.buyQty` to calculate how many packs/items to buy and the estimated grocery basket £, total basket cost will drop from inflated estimates to realistic household expenditure.
- **Recipe Usage Breakdown Drawer**: When tapping "▼ Show Breakdown" on an ingredient row in `ShoppingItemRow.js`, each recipe's row will accurately state its true share of the ingredient (e.g. Harissa Chicken: 3qty, Cheesy Chilli Macaroni: 1qty).

### 3rd Order Consequences
- **At-Home Ticking & Subcollection Sync**: Toggling at-home checkboxes or swapping products preserves the accurately scaled net quantities.
- Single source of truth restored between Recipe Servings (`fullRecipe.serves`), Meal Plan Generation (`MealPlanGeneratorService.js`), and Shopping Calculation (`ShoppingCalculationService.js`).

---

## 5. Decision Gate & Next Steps

* **Decision**: Proceed immediately to `/plan` to implement the `scaleMultiplier = targetServings / baseServings` fix in `src/services/ShoppingCalculationService.js`, verify with automated regression tests, and rebuild.
