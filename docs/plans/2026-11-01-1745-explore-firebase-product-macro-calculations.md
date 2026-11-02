# Exploration: Firebase Product Macro Calculations and High-Calorie Root Causes

**Date:** 2026-11-01  
**Scope:** Firebase Products Catalog, Taxonomy Resolution, Nutrition Calculation Engine (`NutritionService.js`), Auto-Default Strategy (`HydrationService.js`, `SettingsView.js`), and *Gaeng Phed Ped Yang with Coconut Rice*  
**Author:** Antigravity (Advanced Agentic Coding) & Elliott  

---

## 1. Problem Statement

Users observed that macro calculations in PlatePlan appear excessively high for certain recipes, specifically pointing to *Gaeng Phed Ped Yang with Coconut Rice* and *Sausage Party Pizza* where single-serving calorie allocations climb into the thousands of calories.

This investigation explores the **definitive data within the Firebase database** (`products`, `ingredients`, and `settings/preferences` collections), traces how PlatePlan's calculation pipeline transforms those exact database records into recipe macros, and evaluates why user-configured **Auto-Default Strategies** in preferences fail to optimize product selections.

---

## 2. Key Findings from the Firebase Database

### Finding 1: The "Coconut Rice" Taxonomy Match Trap
When *Coconut Rice* is entered as an ingredient line in a recipe (e.g. `300g Coconut Rice` or `250g Coconut Rice`):
1. PlatePlan's `matchIngredientTaxonomy` and `resolveProductForIngredient` attempt to resolve the ingredient name against the database.
2. In the household's Firebase product catalog, there is **no product named "Coconut Rice"**.
3. The resolver falls back to keyword/stem matching on "Coconut", matching:
   - **Product ID:** `ing1788293496759`
   - **Product Name:** `Desiccated Coconut` (East End)
   - **Firebase Stored Macros:** `cal: 633`, `fat: 62.0g`, `prot: 5.6g`, `carb: 6.4g` per 100g.
4. **The Mathematical Impact:**
   - For `300g Coconut Rice`, PlatePlan calculates:
     $$\text{Calories} = 3.00 \times 633 = \mathbf{1,899\text{ kcal}}$$
     $$\text{Fat} = 3.00 \times 62\text{g} = \mathbf{186\text{g fat}}$$
   - Real cooked coconut rice (jasmine rice cooked in diluted coconut milk) is approximately **150 kcal / 100g** (~450 kcal total).
   - This single inadvertent product match injects a **+1,449 calorie surplus and +180g of pure fat** into the recipe pot.

---

### Finding 2: kJ Stored as kcal in Firebase Products
A systematic Atwater macro scan ($4\text{P} + 4\text{C} + 9\text{F}$) across all 402 products in the Firebase `products` subcollection identified several products where **energy in kilojoules (kJ)** was entered into the `cal` / `kcal` field:

| Product ID | Brand & Product Name | Stored `cal` in Firebase | True Macro Energy (Atwater) | Energy in kJ | Ratio | Real-World Impact |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ing1782459259201` | **THIS Fillet Steak** (220g) | **857** | **197 kcal** | 825 kJ | **4.3x** | 1 pack (220g) calculates to **1,885 kcal** instead of 433 kcal. |
| `ing1784377310871` | **Summer Pride Butter Beans** (400g) | **446** | **92.5 kcal** | 387 kJ | **4.8x** | 1 can (400g) calculates to **1,784 kcal** instead of 370 kcal. |
| `ing1788292179441` | **Tesco Shaoxing Rice Wine** (150ml) | **133** | **26.9 kcal** | 113 kJ | **4.9x** | 30ml calculates to 40 kcal instead of 8 kcal. |
| `ing1788293582490` | **Schwartz Za'atar** (35g) | **470** | **203 kcal** | 851 kJ | **2.3x** | High calorie skew on seasoning. |

Whenever a recipe matches one of these products, `NutritionService.js` scales the stored `cal` field directly:
$$\text{calVal} = \text{product.cal} \times \left(\frac{\text{grams}}{100}\right)$$
Because `product.cal` is $4.2\times$ higher than reality, the calculated recipe calories explode.

---

### Finding 3: The Broken "Auto-Default Strategy" in Preferences & Hydration

In Elliott & Chloe's preferences (`settings/preferences`), the user has selected:
```json
{
  "autoDefaultStrategy": "highest_protein_per_kcal",
  "autoDefaultCriterion": "highest_protein_per_kcal"
}
```
The intention of this preference is that whenever ingredients have multiple product options in the pantry bank, PlatePlan automatically picks the product with the highest protein density per calorie (e.g. Light Mayonnaise over Regular Mayonnaise, Lighter Cypriot Cheese over full-fat Halloumi, Quorn/THIS pieces over high-fat battered pieces).

#### The Smoking Gun Bug in `HydrationService.js`:
In `src/services/HydrationService.js` (line 70):
```javascript
export async function sweepAndRecalibrateIngredientDefaults() {
  ...
  const updatedIngredients = ingredients.map(ing => {
    ...
    if (matchedProducts.length > 0) {
      const bestProduct = compareProductsByStrategy(matchedProducts, criterion);
      if (bestProduct && String(ing.defaultProductId || '') !== String(bestProduct.id)) {
        updatedCount++;
        return { ...ing, defaultProductId: bestProduct.id, updatedAt: new Date().toISOString() };
      }
    }
    return ing;
  });
```

Look closely at line 70:
`compareProductsByStrategy` in `PantryHierarchyService.js` is a **two-item comparator**:
```javascript
export function compareProductsByStrategy(a, b, criterion = 'lowest_absolute_price')
```
It expects two products `(a, b)` and a criterion string.
In `HydrationService.js`, line 70 passes `matchedProducts` (an array) as `a`, and `criterion` (a string) as `b`!
Because `a` is an array and `b` is a string:
* `a.price` is `undefined` $\rightarrow$ `0`
* `b.price` is `undefined` $\rightarrow$ `0`
* `compareProductsByStrategy` returns `0` (a numeric comparison score, not a product object!).
* `bestProduct.id` is `undefined`.
* **Result:** `sweepAndRecalibrateIngredientDefaults` exits having updated **0 ingredients**!

#### The Impact on Pantry Defaults:
* When the user changes the Auto-Default Strategy dropdown in Settings, it calls `sweepAndRecalibrateIngredientDefaults()`, which **does nothing**.
* When the user clicks "⚡ Recalibrate All Defaults Now", it **updates 0 ingredients**.
* On app hydration/startup, it **updates 0 ingredients**.
* In our simulation across the 60 multi-product ingredients in the household bank, **41 ingredients are currently stuck on high-calorie, lower-protein defaults** instead of the user's preferred `highest_protein_per_kcal`:
  - **Mayonnaise:** Stuck on standard Mayonnaise (**670 kcal**) instead of Light Mayonnaise (**269 kcal**).
  - **Halloumi:** Stuck on standard Halloumi (**300 kcal, 20.7g prot**) instead of Lighter Cypriot Cheese (**259 kcal, 23.7g prot**).
  - **Chicken Pieces:** Stuck on Chicken-Style Pieces (**227 kcal**) instead of THIS Isn't Chicken Lightly Seasoned (**140 kcal, 22g prot**).
  - **Chicken Strips:** Stuck on Southern-Fried Strips (**296 kcal**) instead of Chicken Style Dippers (**211 kcal**).
  - **Sausages:** Stuck on Richmond Sausages (**148 kcal, 8.7g prot**) instead of Linda McCartney Red Onion & Rosemary (**123 kcal, 17g prot**).

---

### Finding 4: Cooked vs Raw Inconsistency in Grains
In the Firebase product bank:
* `ing1782490173352` (**Tesco Jasmine Rice**):
  - Pack: `1000g` (raw dry bag)
  - Firebase fields: `cal: 136`, `prot: 2.5g`, `carb: 29.0g`, `fat: 1.0g` per 100g.
  - *Origin:* These numbers come from the "100g cooked as per instructions" table on the back of the Tesco packet.
* `ing1784042172702` (**Tesco Sushi Rice**):
  - Pack: `500g`
  - Firebase fields: `cal: 349`, `prot: 6.0g`, `carb: 78.8g`, `fat: 0.8g` per 100g.
  - *Origin:* Raw dry grain weight.

---

### Finding 5: Recipe Baseline Yield vs Dual-Profile Dinner Split
In `src/utils/fitScoreCalculator.js`:
```javascript
const batchSize = (serves === 1 || isSnack) ? 1 : 2;
const multE = Number.isFinite(batchSize * shareE) ? (batchSize * shareE) : 1;
const multC = Number.isFinite(batchSize * shareC) ? (batchSize * shareC) : 1;

const actualKcalE = totalKcal * multE;
const actualKcalC = totalKcal * multC;
```
For dinners:
1. `batchSize = 2` (both Elliott and Chloe eat).
2. Elliott's share `shareE` is **59%**, so `multE = 2 * 0.59 = 1.18`.
3. Chloe's share `shareC` is **41%**, so `multC = 2 * 0.41 = 0.82`.

If a recipe yielding 4 servings (e.g. full pot of curry or pizza dough) is saved with **`Serves 2 baseline`**:
* The per-serving baseline is doubled: $\text{Per Serving} = \frac{\text{Total Pot}}{2}$.
* Elliott's portion is then $1.18 \times \text{Per Serving}$, allocating **59% of the entire 4-person pot** to his single dinner.

---

## 3. End-to-End Simulation: Gaeng Phed Ped Yang with Coconut Rice

Testing two realistic ingestion variations against the exact Firebase database records:

### Scenario 1: Using "Coconut Rice" as an Ingredient (Current Behavior)
```text
- 300g Coconut Rice        --> Desiccated Coconut (cal: 633)    --> 1,899 kcal (186g fat)
- 400ml Coconut Milk       --> Light Coconut Milk (cal: 61)     -->   244 kcal (24g fat)
- 2 tbsp Red Curry Paste   --> Madras Curry Paste (cal: 279)    -->    59 kcal (4.9g fat)
- 1 tbsp Fish Sauce        --> Fish Sauce (cal: 50)             -->     8 kcal (0g fat)
- 1 tbsp Palm Sugar        --> Granulated Sugar (cal: 400)      -->    51 kcal (0g fat)
- 400g Duck Breast / Meat  --> (Unmatched or mapped to meat)    -->  ~800–1,000 kcal
---------------------------------------------------------------------------------
Total Pot Calories:                                              ~3,061 – 3,261 kcal
If saved as Serves 2 baseline:                                   ~1,530 – 1,630 kcal/serving
Elliott (59% Dinner Split):                                      ~1,806 – 1,924 kcal (🔥 +1,100 kcal over budget)
```

### Scenario 2: With Corrected Taxonomy & Yield
```text
- 300g Jasmine Rice        --> Jasmine Rice (cal: 136)          -->   408 kcal (3g fat)
- 400ml Coconut Milk       --> Light Coconut Milk (cal: 61)     -->   244 kcal (24g fat)
- 2 tbsp Red Curry Paste   --> Madras Curry Paste (cal: 279)    -->    59 kcal (4.9g fat)
- 1 tbsp Fish Sauce        --> Fish Sauce (cal: 50)             -->     8 kcal (0g fat)
- 1 tbsp Palm Sugar        --> Granulated Sugar (cal: 400)      -->    51 kcal (0g fat)
- 400g Duck Breast / Meat  --> (Unmatched or mapped to meat)    -->  ~800–1,000 kcal
---------------------------------------------------------------------------------
Total Pot Calories:                                              ~1,570 – 1,770 kcal
If saved as Serves 4 baseline:                                   ~392 – 442 kcal/serving
Elliott (59% Dinner Split for 2 portions):                       ~462 – 522 kcal (✅ On Target)
```

---

## 4. Architectural Remediation Plan (Next Steps)

1. **Fix `sweepAndRecalibrateIngredientDefaults` in `HydrationService.js`**:
   Replace the invalid `compareProductsByStrategy(matchedProducts, criterion)` call with the correct array sort:
   ```javascript
   const sorted = [...matchedProducts].sort((a, b) => compareProductsByStrategy(a, b, criterion));
   const bestProduct = sorted[0];
   ```
   This will immediately allow all 41 ingredients to auto-recalibrate to the user's preferred `highest_protein_per_kcal` (or `lowest_calorie_count`).
2. **Fix Taxonomy Mapping for "Coconut Rice"**:
   Add a specific taxonomy mapping or alias so "Coconut Rice" routes to Jasmine Rice (or a dedicated cooked rice product) rather than stemming into `East End Desiccated Coconut` (633 kcal / 62g fat).
3. **Data Scrub of Confirmed kJ Values in Firebase**:
   Correct the 4 products stored with kJ values (`THIS Fillet Steak` 857 kJ $\rightarrow$ 205 kcal, `Summer Pride Butter Beans` 446 kJ $\rightarrow$ 92 kcal, `Tesco Shaoxing Rice Wine` 133 kJ $\rightarrow$ 27 kcal, `Schwartz Za'atar` 470 kJ $\rightarrow$ 203 kcal).
