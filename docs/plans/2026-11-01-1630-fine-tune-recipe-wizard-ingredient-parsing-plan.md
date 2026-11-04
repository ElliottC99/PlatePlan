---
title: Fine-Tune Recipe Wizard Ingredient Parsing & Section Classification
type: fix
date: 2026-11-01
topic: recipe-wizard-parsing-tuning
---

# Fine-Tune Recipe Wizard Ingredient Parsing & Section Classification

> Created: 2026-11-01  
> Status: Implemented  
> Branch: `dev/recipe-bulk-parse-instruction-fix`

## Summary

When recipes are entered manually or pasted into the Recipe Wizard, three specific ingredient patterns currently parse incorrectly in Step 2:
1. **Fraction & mixed-number ranges with units** (e.g., `"¼–½ Tsp Cayenne Pepper"`): parses as `0.25 qty` with name `"–1/2 Tsp Cayenne Pepper"` because `parseQuantity` only matches integer/decimal ranges, leaving the second fraction in the remainder where it blocks unit matching.
2. **Dimensioned root items** (e.g., `"2.5cm piece of fresh ginger"`): parses as `2.5 qty` of `"Cm Piece Of Fresh Ginger"` because `cm` is not in `UNIT_MAP`, defaulting to discrete piece count (2.5 whole ginger roots).
3. **Serving qualifiers** (e.g., `"20g unsalted peanuts (to serve)"`): leaves `(to serve)` inside the ingredient name and leaves the item in `"Main Ingredients"` instead of routing it to a separate `"To Serve"` ingredient section.

This plan details the technical root causes, non-breaking architectural solutions, and test specifications to fine-tune the ingestion pipeline.

---

## Prior Solutions & Patterns

- `docs/solutions/logic-errors/product-first-weights-drained-weight-and-fit-score-zero-20261031.md`: Established the principle of measurement unit separation, preventing discrete unit inflation and handling postfixed units.
- `docs/plans/2026-10-28-2301-refactor-one-unit-converter-plan.md`: Established `src/services/UnitConversionService.js` as the single owner of unit conversions.
- Critical Pattern #9: Rigorous Multi-Order Thinking — ensures changes to `parseIngredientString` preserve backwards compatibility with all 92 unit conversion fixtures.

---

## Detailed Problem Analysis

### Problem 1: `"¼–½ Tsp Cayenne Pepper"` $\rightarrow$ `0.25 qty`

- **Current Behavior**:
  ```javascript
  parseIngredientString('¼–½ Tsp Cayenne Pepper');
  // Output:
  {
    raw: '¼–½ Tsp Cayenne Pepper',
    qty: 0.25,
    unit: 'qty',
    name: '–1/2 Tsp Cayenne Pepper',
    notes: ''
  }
  ```
- **Root Cause Trace**:
  1. `clean` replaces Unicode fractions: `"¼–½ Tsp Cayenne Pepper"` $\rightarrow$ `"1/4–1/2 Tsp Cayenne Pepper"`.
  2. In `parseQuantity(clean)`, the range check regex `^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)(.*)` only matches whole numbers or decimals.
  3. When looking at `"1/4–1/2"`, `\d+` matches `"1"`, but it is immediately followed by `"/"`, so `rangeMatch` fails.
  4. Execution falls through to `fracMatch` (`^(\d+)\/(\d+)(.*)`), which matches only the first fraction `"1/4"`.
  5. `qty` is set to `0.25`, and `remainder` becomes `"–1/2 Tsp Cayenne Pepper"`.
  6. In `parseIngredientString`, `unitMatch` (`remainder.match(/^([a-zA-Z]+)\b/)`) tests `"–1/2 Tsp..."`. Because it starts with punctuation, `unitMatch` is null.
  7. `parsedUnit` defaults to `'qty'`, `rawName` becomes `"–1/2 Tsp Cayenne Pepper"`, and `convertToStrictUnit` is never called for teaspoons.

### Problem 2: `"2.5cm piece of fresh ginger"` $\rightarrow$ `2.5 qty`

- **Current Behavior**:
  ```javascript
  parseIngredientString('2.5cm piece of fresh ginger');
  // Output:
  {
    raw: '2.5cm piece of fresh ginger',
    qty: 2.5,
    unit: 'qty',
    name: 'Cm Piece Of Fresh Ginger',
    notes: ''
  }
  ```
- **Root Cause Trace**:
  1. `parseQuantity` extracts `qty: 2.5` and `remainder: "cm piece of fresh ginger"`.
  2. `UNIT_MAP` in `RecipeIngredientParser.js` does not contain `"cm"` or `"inch"`.
  3. `parsedUnit` defaults to `'qty'`.
  4. `rawName` retains `"cm piece of fresh ginger"`.
  5. The nutrition engine interprets `2.5 qty` of ginger as 2.5 whole items (or $2.5 \times 100\text{g} = 250\text{g}$), when in standard culinary practice, a 2.5cm (1 inch) piece of fresh ginger weighs approximately **12.5g – 15g** (about 1 level tablespoon finely grated).

### Problem 3: `"20g unsalted peanuts (to serve)"` Not Routed to `"To Serve"` Section

- **Current Behavior**:
  ```javascript
  parseIngredientString('20g unsalted peanuts (to serve)');
  // Output:
  {
    raw: '20g unsalted peanuts (to serve)',
    qty: 20,
    unit: 'g',
    name: 'Unsalted Peanuts (To Serve)',
    notes: ''
  }
  ```
- **Root Cause Trace**:
  1. `parseSectionedIngredients` only detects section headers when a line is a standalone header (e.g. `Pizza Bases:`, `For the dressing:`).
  2. An ingredient line ending with `(to serve)` or `, to serve` is placed inside `Main Ingredients`.
  3. `parseIngredientString` does not strip `(to serve)` from `rawName`, resulting in `name: "Unsalted Peanuts (To Serve)"`.
  4. The user expects serving/garnish items to automatically form a separate `"To Serve"` ingredient section.

---

## Acceptance Criteria

### AC1: Fraction & Range Parsing with Metric Conversion
- [ ] `"¼–½ Tsp Cayenne Pepper"` parses as:
  - `qty`: `1` (or `1.3`), `unit`: `'g'`, `isEstimated`: `true`
  - `name`: `"Cayenne Pepper"`
  - `notes`: `""` (or author note if present)
- [ ] Fraction ranges like `"1/4 - 1/2 tsp"`, `"1/2 to 3/4 cup"`, `"1 1/2 - 2 tbsp"` compute their midpoint quantity (`0.375 tsp`, `0.625 cup`, `1.75 tbsp`) and convert to strict metric (`g` / `ml`).
- [ ] `DENSITY_TABLE` in `UnitConversionService.js` includes `spice: 0.5`, `pepper: 0.5` so ground spices convert at $\approx 0.5\text{g/ml}$ ($2.5\text{g}$ per level tsp).

### AC2: Dimensioned Produce / Root Conversion
- [ ] `"2.5cm piece of fresh ginger"` parses as:
  - `qty`: `12.5` (or `15`), `unit`: `'g'`, `isEstimated`: `true`
  - `name`: `"Fresh Ginger"`
  - `notes`: `"2.5cm piece"`
- [ ] `"1 inch piece of fresh ginger"` / `"3cm ginger"` converts similarly based on culinary standard ($5\text{g}$ per cm, $\approx 12.5\text{g} - 15\text{g}$ per inch).
- [ ] Extraneous descriptors (`piece of`, `chunk of`, `slice of`) are stripped from `name` and preserved in `notes`.

### AC3: Automatic "To Serve" Section Allocation
- [ ] When input text contains an ingredient with `(to serve)`, `, to serve`, `(for serving)`, or `, for serving` (e.g. `"20g unsalted peanuts (to serve)"`):
  - In `RecipeWizardStep1Handlers.js` (`parseSectionedIngredients`) and `RecipeParserService.js`, the ingredient is routed into an ingredient section titled `"To Serve"`.
  - If a `"To Serve"` section already exists, the ingredient is appended to it.
  - If a `"To Serve"` section does not exist, it is created and positioned after main ingredient sections.
- [ ] The ingredient's `name` is cleaned to `"Unsalted Peanuts"`, with `notes` recording `"to serve"`.
- [ ] In Step 2 of the Recipe Wizard, the user sees a dedicated `"To Serve"` section card containing the serving ingredients.

### AC4: Regression Prevention
- [ ] All 92 existing unit conversion tests in `scripts/test_unit_conversion.js` continue to pass with 0 failures.
- [ ] All existing multi-recipe parser tests and servings recalibration tests pass.

---

## Proposed Implementation Details

### 1. `src/services/RecipeIngredientParser.js`

#### A. Fraction & Range Parser Enhancement (`parseQuantity`)
Add support for fraction and mixed-number ranges before single-fraction checks:
```javascript
// Fraction / mixed-number range e.g. "1/4 - 1/2", "1/4 to 1/2", "1 1/2 - 2"
const fracRangeMatch = text.match(/^((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?)\s*(.*)/i);
if (fracRangeMatch) {
  const v1 = parseFractionOrNumber(fracRangeMatch[1]);
  const v2 = parseFractionOrNumber(fracRangeMatch[2]);
  const avg = (v1 + v2) / 2;
  return { qty: avg, remainder: fracRangeMatch[3].trim() };
}
```
Where `parseFractionOrNumber(str)` parses `"1 1/2"` $\rightarrow 1.5$, `"1/4"` $\rightarrow 0.25$, `"2"` $\rightarrow 2$.

#### B. Dimensioned Length Conversion
In `parseIngredientString(rawStr)`:
- Add a pattern for dimensioned roots before generic quantity parsing:
  ```javascript
  const dimMatch = clean.match(/^(\d+(?:\.\d+)?)\s*(cm|inch(?:es)?|in\.?)\s*(?:piece(?:\s+of)?|chunk(?:\s+of)?|slice(?:\s+of)?)?\s+(?:of\s+)?(.*)/i);
  if (dimMatch) {
    const dimVal = parseFloat(dimMatch[1]) || 1;
    const dimUnit = dimMatch[2].toLowerCase().startsWith('in') ? 'inch' : 'cm';
    const rawName = dimMatch[3].trim();
    // For ginger/galangal/turmeric: 1 cm ≈ 5g, 1 inch ≈ 12.5g
    const gramsPerCm = (rawName.toLowerCase().includes('ginger') || rawName.toLowerCase().includes('turmeric') || rawName.toLowerCase().includes('galangal')) ? 5 : 5;
    const cmTotal = dimUnit === 'inch' ? dimVal * 2.54 : dimVal;
    const calculatedGrams = Math.round(cmTotal * gramsPerCm * 10) / 10;
    
    return {
      raw: s,
      qty: calculatedGrams,
      unit: 'g',
      isEstimated: true,
      name: toTitleCase(rawName.replace(/^(?:piece|chunk|slice)\s+(?:of\s+)?/i, '').trim()),
      notes: `${dimVal}${dimUnit} piece`
    };
  }
  ```

#### C. Serving Qualifier Cleaning
In `parseIngredientString`, detect and strip `(to serve)` from `rawName`:
```javascript
const serveMatch = rawName.match(/(?:,\s*|\s*\()(?:\b(?:to\s+serve|for\s+serving|to\s+garnish|for\s+garnish)\b)\)?$/i);
let isToServe = false;
let cleanedName = rawName;
let serveNote = '';

if (serveMatch) {
  isToServe = true;
  serveNote = 'to serve';
  cleanedName = rawName.replace(/(?:,\s*|\s*\()(?:\b(?:to\s+serve|for\s+serving|to\s+garnish|for\s+garnish)\b)\)?$/i, '').trim();
}
```
Return `isToServe` flag on the parsed ingredient object and assign `notes: serveNote` if notes are empty.

---

### 2. `src/services/UnitConversionService.js`

Update `DENSITY_TABLE`:
```javascript
const DENSITY_TABLE = {
  flour: 0.5,
  sugar: 0.85,
  rice: 0.8,
  oats: 0.4,
  nuts: 0.6,
  seeds: 0.6,
  lentils: 0.85,
  beans: 0.8,
  butter: 0.9,
  powder: 0.5,
  spice: 0.5,
  pepper: 0.5
};
```
This ensures `Cayenne Pepper` (matching `pepper`) calculates at $0.5\text{g/ml}$, converting `0.375 tsp` ($1.875\text{ml}$) to $\approx 1\text{g}$.

---

### 3. `src/components/recipe/RecipeWizardStep1Handlers.js` & `src/services/RecipeParserService.js`

In `parseSectionedIngredients(rawText)` and `parseIngredientLine`:
- When iterating through ingredient lines:
  - Check if the line has `/(?:,\s*|\s*\()(?:to\s+serve|for\s+serving|to\s+garnish|for\s+garnish)\)?/i`.
  - If so, route the line into a dedicated `"To Serve"` section bucket.
  - If the line is an explicit header `To Serve:`, treat all following lines until the next header as part of the `"To Serve"` section.
  - Return `"To Serve"` as a distinct section in `ingredientSections`.

---

## Testing Plan

Create automated test script `scripts/test_recipe_wizard_tuning.js`:
1. **Test 1**: Verify `"¼–½ Tsp Cayenne Pepper"` parses to `qty: 1` (or `1.3`), `unit: 'g'`, `name: 'Cayenne Pepper'`.
2. **Test 2**: Verify `"2.5cm piece of fresh ginger"` parses to `qty: 12.5`, `unit: 'g'`, `name: 'Fresh Ginger'`, `notes: '2.5cm piece'`.
3. **Test 3**: Verify `"1 inch piece of fresh ginger"` parses to `qty: 12.7` (or `13`), `unit: 'g'`, `name: 'Fresh Ginger'`.
4. **Test 4**: Verify `"20g unsalted peanuts (to serve)"` in a raw ingredient text block produces:
   - Section 1: `"Main Ingredients"`
   - Section 2: `"To Serve"` containing `"Unsalted Peanuts"`, `20g`.
5. **Regression Verification**:
   - Run `node scripts/test_unit_conversion.js` (must pass all 92 assertions).
   - Run `node scripts/test_recipe_wizard_edit.js`.
   - Run `node scripts/test_recipe_servings_recalibration.js`.

---

## File Constraints Checklist

- [x] No bundlers (plain ES modules).
- [x] Files stay near or under 400 lines (`RecipeIngredientParser.js` currently 358 lines; keep tight).
- [x] Bump `package.json` and stamp into `dist/`.
