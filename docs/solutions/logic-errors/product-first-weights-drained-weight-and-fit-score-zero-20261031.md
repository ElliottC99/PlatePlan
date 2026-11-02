---
date: "2026-10-31"
problem_type: "logic_error"
component: "javascript_logic"
severity: "medium"
symptoms:
  - "Sausage Party Pizza and other multi-ingredient recipes produced massively inflated macros (e.g. 2,000+ kcal per serving)"
  - "Tinned and jarred products (e.g. 400g can of black beans) calculated calories using the full gross container weight rather than the consumed drained weight (240g)"
  - "Legitimate poor-match recipes scoring 0% in Recipe Vault rendered as a neutral blank '⚪ --' ('Missing Calorie/Protein Data') instead of '🔴 0%'"
  - "Postfixed measurement units such as '4 rosemary sprigs' or '2 bay leaves' were parsed as discrete counts of generic food items defaulting to 100g each"
root_cause: "wrong_assumption"
tags:
  - "nutrition"
  - "fit-score"
  - "drained-weight"
  - "unit-conversion"
  - "recipe-parser"
related_issues: []
last_referenced: "2026-10-31"
status: "active"
---

# Product-First Weights, Drained Weight Normalization & Fit Score 0% Badge

## Problem Statement

During recipe parsing and macro calculation:
1. **Inflated Discrete Weights**: Discrete units (`qty`, `count`, `item`) were resolving to `DEFAULT_ITEM_GRAMS = 100g`. A recipe with "20 pitted green olives" calculated 2,000g (2kg) of olives (+2,800 kcal, +300g fat), and "4 rosemary sprigs" added 400g of rosemary.
2. **Gross vs Drained Weight for Canned Goods**: `calculateItemNutritionalWeight` in `NutritionService.js` looked for `product.netWeight`, but PlatePlan stores gross pack weight as `product.packSize`. The check always evaluated to false, so canned legumes (e.g. 400g can of black beans) were evaluated at 400g gross weight instead of the 240g drained weight consumed.
3. **Masked 0% Fit Scores**: When macros were excessively high (e.g. calories $\ge 1.4\times$ target), `macroScoringUtils.js` accurately assigned a score of `0%`. However, `FitScoreBadge.js` checked `if (fitResult.score <= 0)`, grouping legitimate 0% scores with missing macro data and rendering a neutral `⚪ --` badge.

---

## Symptoms Observed

- *Sausage Party Pizza* (which yielded 8 individual pizzas across 1kg flour, 8 sausages, 140ml oil, 800g tomatoes, 240g dip) lacked an explicit `Servings:` header, defaulted to 4 servings, was scaled to 2 servings, and computed huge macros because:
  - 20 olives $\rightarrow$ 2,000g (instead of the 190g drained weight of an olive jar).
  - 4 rosemary sprigs $\rightarrow$ 400g.
- The Recipe Vault badge showed `⚪ --` ("Missing Calorie/Protein Data") even though all macro data was populated.
- Beans and chickpeas in recipes specified as 400g tins were calculating calories on liquid brine weight.

---

## Root Cause Analysis

1. **Measurement Units vs Product Bank Separation**: Measurement units (`pinch`, `sprig`, `leaf`, `drizzle`, `dash`, `clove`, `handful`, `tsp`, `tbsp`) describe *how much* was added and must be converted to grams/ml via density tables in `UnitConversionService.js`. Food items (`sausages`, `peppers`, `beans`, `olives`) are physical grocery products whose individual piece weights and pack structures exist in `ProductRepository`.
2. **Missing Property Lookup for Pack Weight**: `calculateItemNutritionalWeight` inspected `product.netWeight`, which is undefined in PlatePlan's data model (PlatePlan uses `product.packSize` and `product.drainedWeight`).
3. **False Equivalence of 0% Score with Missing Macros**: `FitScoreBadge.js` treated `score <= 0` identically to `!fitResult` or `isMissingMacros`, hiding poor match feedback from users.

---

## Working Solution

### 1. Trailing Measurement Unit Parsing (`src/services/RecipeIngredientParser.js`)

Added regex detection in `parseIngredientString` to catch postfixed measurement units:
```javascript
// Trailing measurement unit check e.g. "4 rosemary sprigs", "2 large bay leaves", "4 garlic cloves"
if (parsedUnit === 'qty') {
  const trailingUnitMatch = remainder.match(/^(.*?)\s+(sprigs?|leaves?|leaf|cloves?|slices?|stalks?|heads?|bulbs?)\b(?:\s+(?:of\s+)?(.*))?$/i);
  if (trailingUnitMatch) {
    const uWord = trailingUnitMatch[2].toLowerCase();
    if (UNIT_MAP[uWord]) {
      parsedUnit = UNIT_MAP[uWord];
      const prefix = trailingUnitMatch[1].trim();
      const suffix = (trailingUnitMatch[3] || '').trim();
      rawName = suffix ? `${prefix} ${suffix}`.trim() : prefix;
    }
  }
}
```

### 2. Loose Measurement Conversion (`src/services/UnitConversionService.js`)

Moved `sprig` (`2g`) and `leaf` (`1g`) into `ESTIMATED_GRAMS_PER_UNIT` so they convert to metric grams instead of being reduced to discrete counts (`qty`).

### 3. Product-First Discrete Weight Resolution & Jar Ceiling Guard (`src/services/NutritionService.js`)

Implemented `resolveProductItemWeight`:
```javascript
export function resolveProductItemWeight(product) {
  if (!product || typeof product !== 'object') return 0;
  const explicit = parseFloat(product.itemWeight || product.item_weight || 0);
  if (explicit > 0) return explicit;

  const packSize = parseFloat(product.packSize || product.pack_size || 0);
  const itemCount = parseFloat(product.itemCount || product.item_count || 0);
  if (packSize > 0 && itemCount > 1) {
    return Math.round((packSize / itemCount) * 10) / 10;
  }

  const name = String(product.name || product.title || '');
  const leadingCountMatch = name.match(/^(\d+)\s+(?:pack\s+of\s+)?([a-zA-Z\s]+)/i);
  if (leadingCountMatch && packSize > 0) {
    const count = parseInt(leadingCountMatch[1], 10);
    if (count > 1 && count <= 50) {
      return Math.round((packSize / count) * 10) / 10;
    }
  }

  const packUnit = String(product.packUnit || product.pack_unit || product.unit || '').toLowerCase();
  if ((packUnit === 'each' || packUnit === 'item' || /\beach\b/i.test(name)) && packSize > 0 && packSize <= 1000) {
    return packSize;
  }

  return 0;
}
```
Added container ceiling guard for discrete counts:
```javascript
if (u === 'qty' || u === 'item' || u === 'count') {
  const maxContainerWeight = parseFloat(item.drainedWeight) || parseFloat(item.usablePackAmount) || parseFloat(item.packSize) || 0;
  if (maxContainerWeight > 0 && grams > maxContainerWeight) {
    grams = maxContainerWeight;
  }
}
```

### 4. Drained Weight Normalization (`src/services/NutritionService.js`)

Updated `calculateItemNutritionalWeight` to inspect `packSize`:
```javascript
export function calculateItemNutritionalWeight(product, requestedGramWeight) {
  if (!product || typeof product !== 'object' || requestedGramWeight <= 0) return requestedGramWeight;
  const drained = parseFloat(product.drainedWeight || product.drainedWeightG || product.drained_weight || 0);
  const pack = parseFloat(product.packSize || product.netWeight || product.netWeightG || product.usablePackAmount || 0);

  if (drained > 0 && pack > 0 && drained < pack) {
    if (Math.abs(requestedGramWeight - pack) / pack <= 0.15) {
      return drained * (requestedGramWeight / pack);
    }
    const drainedRatio = drained / pack;
    return requestedGramWeight * drainedRatio;
  }
  return requestedGramWeight;
}
```

### 5. Fit Score 0% Badge Display (`src/components/FitScoreBadge.js`)

Updated check to strictly check missing data:
```javascript
const isActuallyMissing = !fitResult 
  || fitResult.isMissingMacros 
  || fitResult.error 
  || typeof fitResult.score !== 'number'
  || Number.isNaN(fitResult.score);

if (isActuallyMissing) {
  return `<span class="pp-fit-badge pp-fit-neutral" ...>⚪ --</span>`;
}
```
Valid scores of `0%` now render `🔴 0%` with their tooltip breakdown.

---

## Prevention Strategies

1. **Clear Division of Responsibility**:
   - Measurement units (volume/count descriptors) $\rightarrow$ `UnitConversionService.js`.
   - Food item physical attributes $\rightarrow$ `ProductRepository.js` and `NutritionService.js`.
2. **Container Boundary Validation**:
   - Any discrete count mapped to a containerized product (tin, jar, bottle) must never exceed the total solid contents of the container.
3. **Data Field Alignment**:
   - Always reference canonical PlatePlan product schema fields (`packSize`, `drainedWeight`, `itemWeight`) rather than ad-hoc names (`netWeight`).
