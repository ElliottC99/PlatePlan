---
date: "2026-11-01"
last_updated: "2026-11-09"
problem_type: "logic_error"
component: "javascript_logic"
severity: "medium"
symptoms:
  - "'¼–½ Tsp Cayenne Pepper' parsed as 0.25 qty with name '–1/2 Tsp Cayenne Pepper' rather than converted to grams"
  - "'2.5cm piece of fresh ginger' parsed as 2.5 qty of ginger roots rather than metric root weight (12.5g)"
  - "'20g unsalted peanuts (to serve)' remained in Main Ingredients with '(to serve)' in the item name instead of separating into a 'To Serve' section"
  - "Accented words and contractions in titles and ingredients capitalized the letter after the accent or apostrophe ('CrèMe', 'JalapeñO', 'You’Re')"
  - "Unmeasured 'salt and black pepper' lines imported as 1-unit items, and single-line TikTok captions collapsed into the recipe title with 0 ingredients"
root_cause: "edge_case_unhandled"
tags:
  - "recipe-wizard"
  - "recipe-parser"
  - "unit-conversion"
  - "fraction-ranges"
  - "serving-qualifiers"
  - "unicode-title-case"
  - "social-caption-parsing"
related_issues: []
status: "active"
---

# Recipe Wizard Ingestion Tuning: Fraction Ranges, Dimensioned Roots, and Serving Qualifiers

## Problem Statement

When users imported or manually typed recipes into Step 1 of the Recipe Wizard:
1. **Fraction and Mixed-Number Ranges**: Inputs like `"¼–½ Tsp Cayenne Pepper"` parsed as `0.25 qty` with name `"–1/2 Tsp Cayenne Pepper"`. The quantity parser matched only whole number/decimal ranges (`3-4`), falling through to single-fraction matching (`1/4`) and leaving `"–1/2"` in the remainder string, which broke subsequent unit matching.
2. **Dimensioned Fresh Roots**: Inputs like `"2.5cm piece of fresh ginger"` parsed as `2.5 qty` of discrete ginger units ($250\text{g}$). Because length units (`cm`, `inch`) were absent from `UNIT_MAP`, length measurements fell back to discrete piece count.
3. **Serving Qualifiers**: Inputs with trailing serving instructions like `"20g unsalted peanuts (to serve)"` retained `(to serve)` inside the ingredient name and remained in `"Main Ingredients"` rather than auto-routing into a separate `"To Serve"` ingredient section.

---

## Symptoms Observed

- In Step 2 of the Recipe Wizard:
  - `"¼–½ Tsp Cayenne Pepper"` appeared with `0.25` count, no unit, and a corrupted ingredient title (`–1/2 Tsp Cayenne Pepper`).
  - `"2.5cm piece of fresh ginger"` appeared as `2.5` count of `"Cm Piece Of Fresh Ginger"`, inflating recipe calories and shopping requirements by $\approx 20\times$.
  - `"20g unsalted peanuts (to serve)"` cluttered the core cooking ingredients list instead of appearing in a dedicated `"To Serve"` garnish section.

---

## Root Cause Analysis

1. **Fraction Range Support in `parseQuantity`**:
   `parseQuantity` in `src/services/RecipeIngredientParser.js` checked `rangeMatch` with `^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)`. This regex stopped matching when encountering `/` in Unicode-expanded fraction strings (`1/4–1/2`), falling through to `fracMatch` which consumed only the first fraction (`1/4`) and left the range operator and upper bound (`–1/2`) in `remainder`.
2. **Absence of Length Dimension Mappings**:
   `UNIT_MAP` did not map length dimensions (`cm`, `inch`). Standard culinary guidelines indicate 1 cm of fresh ginger root weighs $\approx 5\text{g}$ ($2.5\text{cm} / 1\text{ inch} \approx 12.5\text{g} - 15\text{g}$). Without length handling, `convertToStrictUnit` defaulted to discrete item count.
3. **Monolithic Ingredient Sections**:
   Neither `parseSectionedIngredients` in `RecipeWizardStep1Handlers.js` nor `parseIngredientLine` in `RecipeParserService.js` inspected inline serving qualifiers (`(to serve)`, `, to serve`, `(for serving)`, `(to garnish)`). Only explicit header lines (`To Serve:`) triggered section creation.

---

## Working Solution

### 1. Extended `parseQuantity` for Fraction and Mixed Ranges
In `src/services/RecipeIngredientParser.js`:
- Added `parseFractionOrNumber` to parse whole numbers, fractions (`1/4`), or mixed numbers (`1 1/2`).
- Replaced integer-only range check with a comprehensive fraction and mixed range regex:
```javascript
const rangeMatch = text.match(/^((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?)\s*(.*)/i);
if (rangeMatch) {
  const q1 = parseFractionOrNumber(rangeMatch[1]);
  const q2 = parseFractionOrNumber(rangeMatch[2]);
  const avg = (q1 + q2) / 2;
  return { qty: avg, remainder: rangeMatch[3].trim() };
}
```
For `"¼–½ Tsp Cayenne Pepper"`:
`q1 = 0.25`, `q2 = 0.5`, `avg = 0.375`.
`remainder = "Tsp Cayenne Pepper"`.
`convertToStrictUnit(0.375, 'tsp', 'Cayenne Pepper')` yields `1.3g Cayenne Pepper`.

### 2. Dimensioned Produce Conversion
Added dedicated pattern matching for length and thumb dimensions:
```javascript
const dimMatch = clean.match(/^(\d+(?:\.\d+)?)\s*(cm|inch(?:es)?|in\.?)\s*(?:piece(?:\s+of)?|chunk(?:\s+of)?|slice(?:\s+of)?)?\s+(?:of\s+)?(.*)/i);
if (dimMatch) {
  const dimVal = parseFloat(dimMatch[1]) || 1;
  const dimUnit = dimMatch[2].toLowerCase().startsWith('in') ? 'inch' : 'cm';
  const cmTotal = dimUnit === 'inch' ? dimVal * 2.54 : dimVal;
  const gramsPerCm = 5; // Standard culinary conversion for ginger, turmeric, galangal
  const calculatedGrams = Math.round(cmTotal * gramsPerCm * 10) / 10;
  const cleanItemName = dimMatch[3].replace(/^(?:piece|chunk|slice)\s+(?:of\s+)?/i, '').trim();
  const servingInfo = extractServingQualifier(cleanItemName);

  return {
    raw: s,
    qty: calculatedGrams,
    unit: 'g',
    isEstimated: true,
    name: toTitleCase(servingInfo.name),
    notes: servingInfo.isToServe ? `${dimVal}${dimUnit} piece, to serve` : `${dimVal}${dimUnit} piece`,
    isToServe: servingInfo.isToServe
  };
}
```

### 3. Serving Qualifier Cleaning & Auto-Section Routing
- Extracted `(to serve)`, `, to serve`, `(for serving)`, `(to garnish)` from ingredient names, moving the qualifier into `notes: 'to serve'` and flagging `isToServe: true`.
- In `parseSectionedIngredients` (`RecipeWizardStep1Handlers.js`) and `parseIngredientLine` (`RecipeParserService.js`), lines marked `isToServe` are automatically placed in a dedicated `"To Serve"` section at the end of the section list.

### 4. Unicode-Aware Title Casing, Implied Salt/Pepper Filtering, and Social-Caption Unpacking (Nov 2026 Update)
- **Unicode Property Escapes in `toTitleCase` (`src/utils/stringUtils.js`)**: JavaScript's `\b` and `\w` are ASCII-only, treating accented characters (`è`, `é`, `ñ`) and curly apostrophes (`’`) as word boundaries (`CrèMe`, `You’Re`). Normalizing to NFC and matching `/[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu` keeps accented words and contractions intact while capitalizing hyphenated segments (`Five-Minute`). `src/services/RecipeIngredientParser.js` re-exports this canonical implementation.
- **Implied Salt & Black Pepper Filtering (`isImpliedSaltOrPepperLine` in `src/services/RecipeIngredientParser.js`)**: `parseIngredientString` returns `null` for standalone unmeasured salt/pepper lines (`"Salt and freshly ground black pepper"`, `"sea salt, to taste"`, `"a pinch of salt"`), while preserving explicit numeric culinary measurements (`"1 tsp sea salt"`, `"1/2 tsp black pepper"`) and culinary peppers/blends (`"1 red bell pepper"`, `"1 tsp garlic salt"`). Step 1A manual parsing in `src/components/recipe/RecipeWizardStep1Handlers.js` filters out `null` entries via `.filter(Boolean)`. Spoon descriptors (`heaped`, `level`, `generous`, `scant`, `rounded`) are stripped before `UNIT_MAP` lookup and trailing `*` footnote markers are stripped from `cleanedName`.
- **Single-Line Social Caption Unpacking (`normalizeSocialCaptionText` in `src/services/RecipeParserService.js`)**:
  - When splitting an ALL-CAPS leading title glued to a sentence-case blurb (`CINNAMON ROLL BAKED OATSAll the flavours...`), the capture group must end on an uppercase letter (`/^([A-Z0-9\s&'’\-]{3,}[A-Z])(?=[A-Z][a-z]{2,})/`) so space-separated acronym titles (`"BBQ Pulled Pork"`) are not truncated at the space.
  - Glued social-caption tokens like `pleaseMakes 4-5 servings.` and `cinnamonFor the top:` have no word boundary (`\b`) between the lowercase end of the preceding word and the uppercase start of `Makes`/`For`, so split regexes must not depend on a leading `\b`.
  - In `unpackCollapsedSteps`, inline numbered steps glued to sentence punctuation (`fan.2. In a 9×6`) must preserve the sentence-ending punctuation (`$1\n\n`) rather than replacing `[\.!?]` with `\n\n`.

---

## Prevention Strategies

1. **Test Complex Multi-Format Quantities**: Every time quantity parsing is modified, run test cases containing Unicode fractions, ASCII fractions, mixed fractions, ranges, and multipliers.
2. **Preserve Unit Test Fixtures**: `scripts/test_unit_conversion.js` asserts 92 strict unit conversion rules. Never alter these fixtures without explicit architectural review.
3. **Guard Callers of `parseIngredientString` Against `null`**: Because `parseIngredientString` returns `null` for section headers, orphaned multipliers, and unmeasured salt/pepper lines, any caller mapping over raw ingredient lines must guard `if (!parsed) return null` and `.filter(Boolean)`.
4. **Regression Tests**: Verified in `scripts/test_recipe_wizard.js` (`Test 14`–`Test 16`) and `scripts/test_recipe_wizard_tuning.js`.

---

## Cross-References

- Plan: `docs/plans/2026-11-01-1630-fine-tune-recipe-wizard-ingredient-parsing-plan.md`
- Plan: `docs/plans/2026-11-09-1521-feat-recipe-parser-and-text-formatting-plan.md`
- Tests: `scripts/test_recipe_wizard.js`, `scripts/test_recipe_wizard_tuning.js`
- Prior solution: `docs/solutions/logic-errors/product-first-weights-drained-weight-and-fit-score-zero-20261031.md`
