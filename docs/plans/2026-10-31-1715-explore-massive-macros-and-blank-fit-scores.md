# Exploration: Massive Macros and Blank Fit Scores in Recipe Wizard

**Date:** 2026-10-31  
**Scope:** Recipe Wizard Ingestion, Unit Conversion, Nutrition Calculation, and Universal Fit Score Engine  
**Author:** Antigravity (Advanced Agentic Coding) & Elliott  

---

## 1. Problem Statement

When parsing and reviewing recipes in the Recipe Wizard (specifically tested on the four recipes: *Poutine*, *Sausage Party Pizza*, *Cheesy Chicken Enchiladas and Mexican-Style Corn Salad*, and *Blackened Monk Chicken Noodles*), users experience:
1. **Massive, unrealistic macro calculations** (often 2,000 to 6,000+ kcal per serving, with hundreds of grams of fat).
2. **Blank fit scores (`⚪ --`)** appearing on saved recipe cards in the Vault and review screens.

---

## 2. Root Cause Analysis (Deep Dive)

### Root Cause 1: The `packSize` Single-Item Multiplier Bug in `NutritionService.js`
In `src/services/NutritionService.js` (lines 74–82):
```javascript
if (u === 'item' || u === 'piece' || u === 'qty' || u === 'pack' || u === 'can' || u === 'tin') {
  const itemWeight = parseFloat(item.itemWeight) || parseFloat(item.drainedWeight) || parseFloat(item.packSize) || 0;
  grams = q * itemWeight;
} else if (u === 'g' || u === 'gram' || u === 'ml') {
  grams = q;
} else {
  grams = toGrams(q, u, item.name, item.itemWeight);
}
```

When an ingredient has `unit: 'qty'` or `'item'`, almost no supermarket product in the database has an explicit `itemWeight` (e.g. weight of 1 single onion or 1 clove of garlic). Instead, products have a `packSize` representing the **entire supermarket package** (e.g. 1kg bag of onions, 1L bottle of oil, 200g pack of garlic bulbs, 500g tub of salt).

Because line 75 fell back to `parseFloat(item.packSize)`:
- **"Vegetable oil or olive oil, for frying"** (`qty: 1`, `unit: 'qty'`) $\rightarrow$ multiplied by `packSize: 1000` (1L bottle) $\rightarrow$ **1,000g of vegetable oil** = **8,280 kcal** and **920g fat**!
- **"4 garlic cloves"** (`qty: 4`, `unit: 'qty'`) $\rightarrow$ multiplied by `packSize: 200` (garlic 3-pack) $\rightarrow$ **800g of garlic** = **1,192 kcal**!
- **"3 red onions"** (`qty: 3`, `unit: 'qty'`) $\rightarrow$ multiplied by `packSize: 1000` (1kg onion bag) $\rightarrow$ **3,000g of onions** = **1,260 kcal**!
- **"1 vegetable stock pot"** (`qty: 1`, `unit: 'qty'`) $\rightarrow$ multiplied by `packSize: 112` (4-pack of pots) $\rightarrow$ **112g of stock** = **146 kcal**!

Just these 4 lines alone added **over 10,800 kcal** to a single dish.

---

### Root Cause 2: Discrete & Seasoning Weight Estimation Gaps in `UnitConversionService.js`
In `src/services/UnitConversionService.js`:
```javascript
const COMMON_DISCRETE_WEIGHTS = {
  lime: 60, lemon: 90, cucumber: 350, onion: 150, shallot: 35,
  garlic: 6, clove: 6, bulb: 65, head: 65, carrot: 100, potato: 180,
  avocado: 170, egg: 60, tomato: 100, pepper: 160, chilli: 15,
  apple: 150, banana: 120, mushroom: 30, stock: 10, cube: 10
};

function inferIngredientWeightByName(name) {
  const text = String(name || '').toLowerCase();
  for (const [kw, g] of Object.entries(COMMON_DISCRETE_WEIGHTS)) {
    if (text.includes(kw)) return g;
  }
  return DEFAULT_ITEM_GRAMS; // 100g
}
```

Two critical estimation flaws exist here:
1. **"Black pepper" / "White pepper" matched `pepper: 160`**: Because `text.includes('pepper')` matched the bell pepper entry, a pinch of black pepper was assigned **160 grams** (nearly 400 calories of pure black pepper!).
2. **Seasonings and oils without volume defaulted to 100g**: "Sea salt" has no entry in `COMMON_DISCRETE_WEIGHTS`, so it received `DEFAULT_ITEM_GRAMS = 100g` (100g of salt!). Unmeasured cooking oil ("vegetable oil, for frying") received 100g of oil (900 kcal!).

---

### Root Cause 3: Why Massive Macros Directly Trigger Blank Fit Scores (`⚪ --`)
In `src/utils/macroScoringUtils.js`, `calculateCalorieScore(actual, target)`:
```javascript
if (r > maxGrace) {
  if (r >= highCeil) return 0;
  const span = highCeil - maxGrace;
  return span > 0 ? (1 - ((r - maxGrace) / span)) * 85 : 0;
}
```
When actual calories exceed the upper ceiling (`highCeil`, typically $1.6\times$ to $2.0\times$ the meal target of ~735 kcal for Elliott or ~578 kcal for Chloe):
- Any recipe with $\ge 1,500$ kcal per serving gets a **0% calorie score**.
- With $0$ calorie score and skewed protein ratios, the universal fit score drops to **0%**.

In `src/components/FitScoreBadge.js` (lines 67–69):
```javascript
if (!fitResult || fitResult.score <= 0 || fitResult.error || fitResult.isMissingMacros) {
  return `<span class="pp-fit-badge pp-fit-neutral" ... title="Missing Calorie/Protein Data">⚪ --</span>`;
}
```
Whenever `fitResult.score <= 0`, PlatePlan renders the neutral badge **`⚪ --`** (the "blank fit score").
**Therefore, the massive macros are the direct mathematical cause of the blank fit score.**

---

### Root Cause 4: Recipe Batch Servings Compression
In recipes like *Sausage Party Pizza* (making 8 pizzas) or *Cheesy Chicken Enchiladas* (8 large filled tortillas + a full bowl of corn salad):
- Cookbooks often omit an explicit `Serves: X` header line.
- The multi-recipe parser properly tags them with `servings: null` (unknown servings).
- The Recipe Wizard UI defaults unknown servings to 4 (or 2 if the user reduces target servings).
- Compressing an 8-portion or multi-meal feast into 2 servings doubles or quadruples the per-portion intake even before conversion bugs.

---

## 3. Systematic Multi-Order Impact ("And Then What?")

| Order | Consequence |
|---|---|
| **1st Order (Immediate)** | Fixing `NutritionService.js` and `UnitConversionService.js` brings Poutine from 6,269 kcal/serving down to **~530 kcal/serving** (or 1,061 kcal for a 2-serving half-batch). |
| **2nd Order (Fit Score)** | Realistic macros fall back into the optimal bell-curve range ($\approx 500\text{--}800\text{ kcal}$), allowing `calculateMealFitScore` to calculate valid scores ($\mathbf{80\%\text{--}92\%}$). The `⚪ --` badge disappears and is replaced by green/amber tier badges. |
| **3rd Order (Shopping Lists)** | The shopping list aggregator uses `UnitConversionService.convertToStrictUnit`. Fixing loose seasoning and discrete weight resolution prevents the shopping list from requesting kilograms of salt or litres of frying oil for a single dinner. |
| **4th Order (Plan Generator)** | The automated weekly plan generator relies on recipe macros to balance daily targets ($2,000\text{ kcal} / 140\text{g protein}$). Correct macros enable newly parsed recipes to be legitimately scheduled in weekly meal plans without breaking calorie budgets. |

---

## 4. Proposed Solution & Architecture

### Component 1: Fix `NutritionService.calculateItemNutrition`
In `src/services/NutritionService.js`:
- Reserve `packSize` / `drainedWeight` strictly for units that represent containers: `'pack'`, `'can'`, `'tin'`.
- For `'qty'`, `'item'`, `'piece'`:
  - If `product.itemWeight > 0`, use `q * product.itemWeight`.
  - Otherwise, delegate to `toGrams(q, u, product.name, 0)` so it uses the canonical discrete weights table and never multiplies by the supermarket package size.

### Component 2: Enhance `UnitConversionService.toGrams`
In `src/services/UnitConversionService.js`:
- **Seasonings**: "salt", "sea salt", "black pepper", "white pepper", "cayenne": default to `0.5g` (a culinary pinch), not 100g or 160g.
- **Unmeasured Cooking Oils**: "vegetable oil, for frying", "olive oil, for cooking", "drizzle of oil": default to `15g` (1 tablespoon / 15ml), not 100g or 1,000g.
- **Differentiate Spices from Vegetables**: Ensure "black pepper" / "white pepper" / "peppercorns" do not match the 160g bell pepper entry.

### Component 3: Integration with Wizard Step 2 & Step 3 Macro Rollup
- As established in our earlier Step 3 exploration, connect `RecipeWizardStep2Handlers.js` and `RecipeWizardStep3View.js` to the unified `recalculateWizardMacros` helper so all dishes calculate their macros dynamically and display live, accurate fit scores.
