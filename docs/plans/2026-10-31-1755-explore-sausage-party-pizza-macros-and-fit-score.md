# Exploration: Sausage Party Pizza High Macros & Blank Fit Score in Recipe Vault

> Date: 2026-10-31  
> Topic: Recipe Wizard discrete item unit conversions, macro calculations, and Vault FitScoreBadge zero-score rendering  
> Status: Completed  

---

## 1. Executive Summary

Our deep investigation confirmed that the user's intuition was **100% correct**: *Sausage Party Pizza* (and other recipes) were calculating **wildly inaccurate, inflated macros**, and Recipe Vault was displaying a **misleading blank `⚪ --` badge** with a false "Missing Calorie/Protein Data" tooltip.

There are three distinct root causes:
1. **The 100g Discrete Fallback & Post-Fixed Unit Defect in Unit Conversion**:
   - `20 pitted green olives` was converted to **2,000 grams (2 kilograms)** of olives (+2,800 kcal, +300g fat) because `olive` was missing from `COMMON_DISCRETE_WEIGHTS` and defaulted to `100g` each.
   - `4 rosemary sprigs`, `3 thyme sprigs`, and `2 large bay leaves` had units like "sprigs" or "leaves" positioned after the herb name (e.g. `rosemary sprigs`). The parser failed to extract the unit, fell back to `unit: "qty"`, and defaulted to `100g` per sprig/leaf (**400g of rosemary**, **300g of thyme**, **200g of bay leaves**).
   - `6 spring onions` matched `onion: 150g` in substring matching and was converted to **900 grams** of spring onions (a spring onion weighs ~15g).
   - `8 plant-based sausages` defaulted to `100g` per sausage (**800g** instead of ~440g).
2. **The Recipe Serving Misalignment (8 Pizzas vs 2 Servings)**:
   - *Sausage Party Pizza* lists 1kg of flour (850g strong white flour + 150g semolina) and its method states: *"Divide the risen dough into 8 equal balls; wrap 4 balls tightly in cling film to freeze for another day"*.
   - The recipe makes **8 individual pizzas**.
   - Because the source text lacked a `Servings:` header, PlatePlan defaulted to 4 servings. In Step 2, the user scaled it to 2 servings (0.5x), meaning each portion represented **TWO entire 10-inch pizzas per person**.
3. **The Blank `⚪ --` Fit Score Masking Bug in `FitScoreBadge.js`**:
   - When a recipe's macros exceed the upper target ceiling ($r \ge 1.4\times$ for calories, $r \ge 2.0\times$ for protein), the fit score engine calculates `calScore = 0%` and `protScore = 0%`, yielding `fitScore = 0%`.
   - In [`FitScoreBadge.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/FitScoreBadge.js#L67), the condition:
     ```javascript
     if (!fitResult || fitResult.score <= 0 || fitResult.error || fitResult.isMissingMacros)
     ```
     treated `score <= 0` as missing data, rendering a neutral grey badge **`⚪ --`** with tooltip `"Missing Calorie/Protein Data"`, instead of rendering a legitimate poor match badge (**`🔴 0% - Poor Match`**).

---

## 2. Forensic Investigation & Evidence

### A. Discrete Ingredient Weights Breakdown for Sausage Party Pizza

| Ingredient | Raw Line | Parsed Unit | Previous `toGrams` Weight | Actual Culinary Weight | Calorie / Fat Discrepancy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pitted Green Olives** | `20 pitted green olives` | `qty` (20) | **2,000 g (2 kg)** | **70 g** (~3.5g/olive) | **+2,800 kcal, +300g fat** |
| **Rosemary Sprigs** | `4 rosemary sprigs` | `qty` (4) | **400 g** | **8 g** (~2g/sprig) | **+520 kcal** |
| **Plant-Based Sausages** | `8 plant-based sausages` | `qty` (8) | **800 g** | **440 g** (~55g/sausage) | **+700 kcal, +35g protein** |
| **Thyme Sprigs** (*Poutine*) | `3 thyme sprigs` | `qty` (3) | **300 g** | **6 g** (~2g/sprig) | **+300 kcal** |
| **Bay Leaves** (*Poutine*) | `2 large bay leaves` | `qty` (2) | **200 g** | **2 g** (~1g/leaf) | **+200 kcal** |
| **Spring Onions** (*Enchiladas*) | `6 spring onions` | `qty` (6) | **900 g** (matched 150g onion) | **90 g** (~15g/onion) | **+280 kcal** |
| **Corn Tortillas** (*Enchiladas*) | `8 large corn tortillas` | `qty` (8) | **800 g** | **240 g** (~30g/tortilla) | **+1,200 kcal** |

### B. Why Did the Wizard Total Exceed 11,000 kcal?

When the unit weights exploded:
- **Olives:** +2,800 kcal
- **Rosemary:** +520 kcal
- **Sausages (800g):** +1,800 kcal
- **Flour (1kg):** +3,500 kcal
- **Olive Oil (140ml):** +1,160 kcal
- **Mayo & Crème Fraîche Dip:** +1,010 kcal
- **Mozzarella:** +340 kcal
**Total raw recipe calories:** **~11,200 kcal!**

When scaled to 2 servings (0.5x scale):
- **Per serving:** **~5,600 kcal** and **~140g protein**!
- For Elliott (59% split): **~6,600 kcal** and **~165g protein** against a dinner target of **735 kcal** and **49g protein** ($9\times$ calorie target, $3.3\times$ protein target).

### C. Why Recipe Vault Showed `⚪ --` Instead of a Score

In [`src/utils/macroScoringUtils.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/utils/macroScoringUtils.js):
- `calHighCeilPct = 140%` ($1.4\times$). Any meal with calories $\ge 1.4\times$ target scores `0%`.
- `protHighCeilPct = 200%` ($2.0\times$). Any meal with protein $\ge 2.0\times$ target scores `0%`.
- Because both were at 900% and 330%, `fitScore = Math.round((0 * 0.5) + (0 * 0.5)) = 0`.

In [`src/components/FitScoreBadge.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/FitScoreBadge.js#L67):
```javascript
if (!fitResult || fitResult.score <= 0 || fitResult.error || fitResult.isMissingMacros) {
  return `<span class="pp-fit-badge pp-fit-neutral" ... title="${escapeHtml(fitResult?.error || 'Missing Calorie/Protein Data')}">⚪ --</span>`;
}
```
`FitScoreBadge` checked `fitResult.score <= 0` and treated a mathematically valid `0%` score (Poor Match) as missing macro data!

---

## 3. Recommended Remediation Plan

### 1. Enrich `UnitConversionService.js` with Culinary Discrete Weights
1. **Add specific weights to `COMMON_DISCRETE_WEIGHTS`**:
   - `olive: 3.5` (pitted green/black olive)
   - `sausage: 55` (average sausage link)
   - `tortilla: 30` (corn/flour tortilla)
   - `aubergine: 250`, `eggplant: 250`
   - `zucchini: 200`, `courgette: 200`
   - `'pak choi': 100`, `'bok choy': 100`
   - `'spring onion': 15`, `'scallion': 15` (evaluated *before* `onion: 150` to prevent substring collision)
2. **Handle Herb Sprigs & Leaves by Name**:
   - In `inferIngredientWeightByName`: if text includes `'sprig'` $\rightarrow$ `2g`.
   - If text includes `'leaf'` or `'leaves'` $\rightarrow$ `1g`.
   - If text includes `'sesame'` or `'sprinkle'` $\rightarrow$ `2g`.

### 2. Fix Unit Detection for Post-Fixed Units in `RecipeIngredientParser.js`
When ingredients are written as:
- `4 rosemary sprigs`
- `3 thyme sprigs`
- `2 large bay leaves`
Recognize trailing count units (`sprig`, `sprigs`, `leaf`, `leaves`, `clove`, `cloves`, `slice`, `slices`) even when preceded by the ingredient name, rather than defaulting the unit to `qty`.

### 3. Correct `FitScoreBadge.js` Zero Score vs Missing Macros Logic
Update line 67 in `FitScoreBadge.js`:
```javascript
// Differentiate actual missing data from a legitimate 0% Poor Match score
const isActuallyMissing = !fitResult || fitResult.isMissingMacros || fitResult.error || (typeof fitResult.score !== 'number');
if (isActuallyMissing) {
  return `<span class="pp-fit-badge pp-fit-neutral" ... title="${escapeHtml(fitResult?.error || 'Missing Calorie/Protein Data')}">⚪ --</span>`;
}
```
If `fitResult.score === 0` and `!fitResult.isMissingMacros`, render:
`<span class="pp-fit-badge gradient-badge" ... data-fit-score="0" data-fit-tier="red">🔴 0%</span>`.

### 4. Yield / Servings Guidance in Recipe Wizard
For recipes like pizza or sharing platters that make multiples (e.g. "makes 8 pizzas"):
Provide a visible helper in Step 2 when base servings is defaulted:
*(e.g. "Base: 4 servings (defaulted) — adjust if recipe yields more, e.g. 8 pizzas")*.
When the user sets the correct yield (8 servings), the scaled quantities and per-serving calories naturally align with standard single-meal expectations (~500–700 kcal).
