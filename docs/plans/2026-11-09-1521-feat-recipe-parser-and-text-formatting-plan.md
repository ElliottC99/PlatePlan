---
title: Recipe Parser and Text Formatting - Plan
type: feat
date: 2026-11-09
topic: recipe-parser-and-text-formatting
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Recipe Parser and Text Formatting - Plan

## Goal Capsule

- **Objective:** Recipes pasted from social-media captions or typed manually parse into clean Unicode-cased titles, sections, ingredients, and method steps without mis-capitalized accents, stray unmeasured salt/pepper rows, or collapsed single-line text.
- **Means:** Unify `toTitleCase` on Unicode-aware word matching (`KTD1`), filter unmeasured standalone salt and black pepper lines in `parseIngredientString` (`KTD2`), and add social-caption structural pre-normalization to `RecipeParserService.js` (`KTD3`).
- **Product Authority:** `Product Contract` (`R1`–`R9`, `AE1`–`AE4`). Work Unit 4 (Recipe Vault visibility and deduplication) is out of active scope.
- **Stop Conditions:** All tests in `scripts/test_recipe_wizard.js`, `scripts/test_variant_save_and_taxonomy_mapping.js`, and `scripts/test_ledger.js` pass, and `npm run build` succeeds cleanly.
- **Execution Profile:** Single PR (`dev/recipe-parser-and-formatting` → `development`), finished and verified in this session.

---

## Product Contract

Product Contract unchanged.

### Summary

Normalize Unicode title casing so accented words (`Crème`, `Jalapeño`) and contractions (`You're`, `Don’t`) never capitalize internal letters, drop unmeasured standalone salt and black pepper lines from parsed ingredients while keeping explicit measurements (`1 tsp salt`), and extend the recipe text parser to unpack single-line social-media captions such as the TikTok Cinnamon Roll Baked Oats into structured title, servings, ingredient subsections (`Main Ingredients`, `Cinnamon Swirl`, `Cream Cheese`), and numbered method steps (`1`–`6`).

### Problem Frame

Three recurring text-parsing defects degrade imported recipes in the Recipe Wizard:

1. **Accented and apostrophe title-casing defects:** `src/utils/stringUtils.js` uses `\b[a-z]+` and `src/services/RecipeIngredientParser.js` defines a duplicate `toTitleCase` using `\b\w`. Because JavaScript regex word boundaries (`\b`) and `\w` are ASCII-only, any accented character (`è`, `é`, `ñ`, `ô`) or curly apostrophe (`’`) acts as a word boundary and capitalizes the immediately following letter (`CrèMe`, `JalapeñO`, `You’Re`).
2. **Unmeasured salt and black pepper clutter:** Recipes routinely list `"salt and black pepper"`, `"sea salt & freshly ground black pepper, to taste"`, or `"a pinch of salt"` as seasoning reminders. Importing these as 1-unit or 1-gram recipe ingredients pollutes ingredient mapping and shopping lists when no explicit quantity (`tsp`, `tbsp`, `g`) was specified.
3. **Single-line social-media caption collapse:** Social captions (such as TikTok's `CINNAMON ROLL BAKED OATS`) omit explicit `Ingredients:` and `Method:` headings and arrive on a single line with Unicode square bullets (`▫️`), inline hyphen sub-items (`- 1 tsp ground cinnamon`), ALL-CAPS titles glued directly to intro blurbs (`CINNAMON ROLL BAKED OATSAll the flavours...`), `Makes 4-5 servings.`, `*` footnotes, and inline numbered steps glued to periods (`.1. Preheat...2. In a 9×6...`) followed by `ENJOY! #hashtags`. Because `parseSingleRecipeText` looks only for `Ingredients:` and `Method:` headers, the entire caption is placed into `title` with zero ingredients and zero method steps.

### Key Decisions

- **Unmeasured Salt & Pepper Filtering Rule** `(session-settled: user-approved — chosen over dropping all salt/pepper lines regardless of measurement or keeping "pinch of salt/pepper": preserves intentional measured baking/cooking quantities like "1 tsp salt" while eliminating kitchen-staple seasoning noise)`: Drop standalone salt and black pepper lines that have no explicit numeric measurement (including `"to taste"`, `"a pinch of"`, `"sea salt & black pepper"`), and keep explicit measurements such as `"1 tsp salt"` or `"1/2 tsp black pepper"`. Governs `R3`, `R4`.
- **Social Caption Subsection & Footnote Handling** `(session-settled: user-approved — chosen over keeping a single "For The Top" section or appending the "*" footnote as a method step: keeps ingredient groups scannable and removes caption noise)`: Group social-caption sub-headers into distinct ingredient sections (`Main Ingredients`, `Cinnamon Swirl`, `Cream Cheese`), and strip the intro blurb, `* If you're using...` footnote, and trailing `ENJOY! #hashtags`. Governs `R6`, `R7`, `R8`.

<!-- ce-section: work-relationships -->
### How This Work Fits Together

This plan covers **Work Unit 3 (Recipe Parser & Text Formatting)** of the 4-unit weekend feedback sequence. Earlier and later units are contextual only:
- **Work Unit 1 — Pantry Taxonomy & Deduplication**: Completed and merged to `development`.
- **Work Unit 2 — Recipe Wizard & Add Recipe Form**: Completed and merged to `development`.
- **Work Unit 4 — Recipe Vault Visibility & Deduplication**:
  - `Can proceed independently of` Work Unit 3 after this branch merges to `development`.

### Requirements

**Unicode Title Casing**
- R1. `toTitleCase` in `src/utils/stringUtils.js` must treat Unicode letters (`\p{L}\p{M}`) and internal apostrophes (`'` and `’`) as part of the same word so accented words (`Crème Fraîche`, `Jalapeño`, `Sautéed`, `Pâté`) and contractions (`You’re`, `Don't`) never capitalize the letter following an accent or apostrophe.
- R2. `src/services/RecipeIngredientParser.js` must re-use the canonical `toTitleCase` from `src/utils/stringUtils.js` instead of maintaining a separate `\b\w` implementation.

**Implied Salt & Black Pepper Filtering**
- R3. `parseIngredientString` must return `null` when an ingredient line represents standalone salt, black pepper, or combined salt and pepper (`salt`, `sea salt`, `kosher salt`, `flaky sea salt`, `black pepper`, `freshly ground black pepper`, `cracked black pepper`, `white pepper`, `salt and pepper`, `salt & black pepper`) without an explicit numeric unit measurement (`g`, `kg`, `oz`, `lb`, `tsp`, `tbsp`, `cup`, `ml`, `l`), including unnumbered lines, `"to taste"`, `"for seasoning"`, and `"pinch"` / `"dash"` of salt or pepper.
- R4. `parseIngredientString` must preserve salt or pepper lines that specify an explicit numeric culinary measure (such as `"1 tsp salt"`, `"1/2 tsp black pepper"`, or `"10g sea salt"`) and must preserve compound spice blends (`"garlic salt"`, `"celery salt"`, `"lemon pepper"`, `"cayenne pepper"`, `"bell pepper"`, `"red pepper"`, `"chilli pepper"`, `"sichuan pepper"`, `"black peppercorns"`).

**Social Caption & Single-Line Recipe Unpacking**
- R5. `parseIngredientString` must strip optional volume descriptors (`heaped`, `heaping`, `level`, `generous`, `scant`, `rounded`) immediately preceding a unit (`"1 heaped tsp baking powder"` → parsed unit `'tsp'` converted to `qty: 2.5`, `unit: 'g'`, `name: 'Baking Powder'`) and strip trailing footnote asterisks (`*`) from ingredient names (`"350-450ml milk*"` → `name: 'Milk'`).
- R6. When a recipe block lacks explicit `Ingredients:` or `Method:` headers (such as social-media captions), `parseSingleRecipeText` must split the block into header, ingredient section, and numbered method steps by detecting Unicode/symbol bullets (`▫️`, `▪️`, `•`, `●`, `◦`, `▪`, `▫`) and inline numbered step boundaries (`1. ... 2. ...`).
- R7. In social-caption blocks, `parseSingleRecipeText` must extract an ALL-CAPS leading title even when glued to a sentence-case intro blurb (`"CINNAMON ROLL BAKED OATSAll the flavours..."` → title `"Cinnamon Roll Baked Oats"`), extract servings from `"Makes 4-5 servings"` or `"Serves 4-5"` (resolving ranges to the lower integer `4`), and strip the intro blurb, `* ...` footnote explanations, and trailing sign-offs/hashtags (`ENJOY!`, `[#tag](...)`, `#tag`).
- R8. Bullet-prefixed sub-headers followed by inline hyphen items (`"▫️ Cinnamon swirl- 1 tsp ground cinnamon- 1 tsp brown sugar- 2 tsp melted butter/olive oil"`) must unpack into named ingredient sections (`Cinnamon Swirl`, `Cream Cheese`) with each hyphenated item parsed as an ingredient in that section.
- R9. Step 1A manual ingredient parsing in `src/components/recipe/RecipeWizardStep1Handlers.js` must filter out `null` results from `parseIngredientString` so dropped unmeasured salt/pepper lines do not cause a null-dereference.

### Acceptance Examples

- AE1. **Covers R1, R2.** Calling `toTitleCase('CRÈME FRAÎCHE & JALAPEÑO PÂTÉ')` returns `'Crème Fraîche & Jalapeño Pâté'`, and `toTitleCase("if you’re using chef's crème")` returns `"If You’re Using Chef's Crème"`.
- AE2. **Covers R3, R4, R9.** Calling `parseIngredientString` on `"Salt and freshly ground black pepper"`, `"sea salt, to taste"`, `"Black pepper"`, or `"a pinch of salt"` returns `null`, whereas calling `parseIngredientString("1 tsp sea salt")` or `parseIngredientString("1/2 tsp black pepper")` returns a valid parsed ingredient object (`3.5g` / `1.8g`).
- AE3. **Covers R5.** Calling `parseIngredientString("1 heaped tsp baking powder")` resolves parsed unit `'tsp'` (`2.5g`, `unit: 'g'`) and `name` as `'Baking Powder'` (not `'Heaped Tsp Baking Powder'`), and `parseIngredientString("350-450ml milk*")` resolves `qty: 400`, `unit: 'ml'`, `name: 'Milk'`.
- AE4. **Covers R6, R7, R8.** Calling `parseBulkRecipeText` on the exact TikTok `CINNAMON ROLL BAKED OATS` caption returns 1 recipe with `title: 'Cinnamon Roll Baked Oats'`, `servings: 4`, 3 `ingredientSections` (`Main Ingredients` with 6 items, `Cinnamon Swirl` with 3 items, `Cream Cheese` with 2 items), and 6 `methodSteps` starting with `'Preheat your oven to 180°C fan.'` and ending with `'Slice into portions. Microwave for 1 minute to warm through or enjoy cold for more of an oat-bar vibe. Store leftovers in an airtight container in the fridge for up to 5 days.'` (without `ENJOY!` or `#bakedoats` hashtags).

### Scope Boundaries

- **Out of scope:** Modifying the NutritionService or UnitConversionService gram weights for measured `tsp`/`tbsp`.
- **Deferred to Follow-Up Work:** Work Unit 4 (Recipe Vault visibility and recipe deduplication).

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Unicode Property Escapes in Canonical `toTitleCase`**: Replace `\b[a-z]+(?:-[a-z]+)*\b` in `src/utils/stringUtils.js` with a Unicode-aware word matcher `/[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu` so accented characters and apostrophes stay inside a single word token, and import `toTitleCase` from `src/utils/stringUtils.js` into `src/services/RecipeIngredientParser.js` (`Governs R1, R2`).
- KTD2. **Implied Salt & Pepper Guard & Descriptor Stripping in `parseIngredientString`**: Add an `isImpliedSaltOrPepperLine(rawStr)` check in `src/services/RecipeIngredientParser.js` that matches standalone salt/pepper phrases (with optional qualifiers like `sea`, `kosher`, `flaky`, `table`, `freshly ground`, `cracked`, `coarse`, `fine`, `to taste`, `for seasoning`, `optional`, or `a pinch/dash of`) when no explicit numeric culinary unit is present `(session-settled: user-approved — chosen over dropping all salt/pepper lines: keeps explicit measured quantities like "1 tsp salt", Governs R3, R4)`. Also strip leading spoon descriptors (`heaped`, `heaping`, `level`, `generous`, `scant`, `rounded`) before unit lookup and strip trailing `*` markers from cleaned ingredient names (`Governs R5`).
- KTD3. **Social-Caption Pre-Normalizer in `RecipeParserService.js`**: Add `normalizeSocialCaptionText(rawBlock)` in `src/services/RecipeParserService.js` that pre-processes blocks lacking explicit `Ingredients:` / `Method:` headers by: (a) separating a leading ALL-CAPS title from a glued sentence-case blurb (`/[A-Z]{2,}(?=[A-Z][a-z])/`), (b) isolating `Makes X-Y servings` / `Serves X` lines, (c) stripping `* ...` footnote explanations before step `1.` and trailing `ENJOY!` / markdown `[#tag](...)` / `#hashtag` tails, (d) expanding `▫️` / bullet markers and `▫️ Section Name- qty unit item` subsection patterns into newline-delimited `Section Name:` headers and ingredient lines, and (e) splitting inline numbered steps (`1. ... 2. ...`) even when glued directly after a period (`.1. Preheat`) into a `Method:` block `(session-settled: user-approved — chosen over flat ingredient list and keeping footnotes: produces clean sections and step text, Governs R6, R7, R8)`.

---

## Implementation Units

### U1. Unicode-Aware `toTitleCase` Consolidation

- **Goal:** Ensure `toTitleCase` handles accented Latin characters and apostrophes cleanly across the entire app and parser.
- **Requirements:** `R1`, `R2`, `AE1`
- **Dependencies:** None
- **Files:**
  - `src/utils/stringUtils.js`
  - `src/services/RecipeIngredientParser.js`
  - `scripts/test_recipe_wizard.js`
- **Approach:**
  1. Update `toTitleCase(str)` in `src/utils/stringUtils.js` to lower-case the input and match word tokens with `/[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu`.
  2. For hyphenated words (`five-minute`), capitalize the first character of each hyphen-separated segment while keeping apostrophe suffixes (`you’re`, `chef's`) lower-case after the apostrophe, preserving Every-Word Title Case (`For The Salsa`, `Tomato And Lentil Curry`) expected by `scripts/test_recipe_wizard.js`.
  3. Replace the duplicate `export function toTitleCase` in `src/services/RecipeIngredientParser.js` with `import { toTitleCase } from '../utils/stringUtils.js'; export { toTitleCase };` so all importers share the single Unicode-aware implementation.
- **Patterns to follow:** `src/utils/stringUtils.js`
- **Test scenarios:**
  - `Covers AE1.` `toTitleCase('CRÈME FRAÎCHE & JALAPEÑO PÂTÉ')` returns `'Crème Fraîche & Jalapeño Pâté'`.
  - `Covers AE1.` `toTitleCase("if you’re using chef's crème")` returns `"If You’re Using Chef's Crème"`.
  - `toTitleCase('FIVE-MINUTE SAUTÉED SHISHITO PEPPERS')` returns `'Five-Minute Sautéed Shishito Peppers'`.
- **Verification:** `node scripts/test_recipe_wizard.js` passes all existing and new Unicode title-case assertions.

### U2. Implied Salt & Black Pepper Filtering and Spoon/Asterisk Normalization

- **Goal:** Drop unmeasured standalone salt and black pepper lines while keeping measured salt/pepper and culinary pepper varieties, and normalize `heaped tsp` descriptors and trailing `*` footnote markers.
- **Requirements:** `R3`, `R4`, `R5`, `R9`, `AE2`, `AE3`
- **Dependencies:** `U1`
- **Files:**
  - `src/services/RecipeIngredientParser.js`
  - `src/components/recipe/RecipeWizardStep1Handlers.js`
  - `scripts/test_recipe_wizard.js`
- **Approach:**
  1. Add `isImpliedSaltOrPepperLine(rawStr)` in `src/services/RecipeIngredientParser.js` and call it near the top of `parseIngredientString(rawStr)`. Return `true` (so `parseIngredientString` returns `null`) when the line—after stripping bullets, `"to taste"`, `"for seasoning"`, `"optional"`, `"a pinch/dash of"`, and qualifiers (`sea`, `kosher`, `flaky`, `table`, `maldon`, `freshly ground`, `cracked`, `coarse`, `fine`)—consists solely of `salt`, `black pepper`, `white pepper`, `pepper`, or combinations thereof (`salt and black pepper`, `salt & pepper`, `salt/pepper`) AND does not start with an explicit numeric culinary measurement (`g`, `kg`, `mg`, `oz`, `lb`, `tsp`, `tbsp`, `cup`, `ml`, `l`).
  2. In `parseIngredientString`, strip optional spoon descriptors (`heaped`, `heaping`, `level`, `generous`, `scant`, `rounded`) from `remainder` before matching `UNIT_MAP` so `"1 heaped tsp baking powder"` parses `unit = 'tsp'` and `rawName = 'baking powder'`.
  3. Strip trailing asterisks (`*`) and surrounding whitespace from `cleanedName` (`cleanedName = cleanedName.replace(/\*+$/g, '').trim()`).
  4. In `src/components/recipe/RecipeWizardStep1Handlers.js` (Step 1A manual ingredient parsing), guard `if (!parsed) return null;` and chain `.filter(Boolean)` on `sec.lines.map(...)`.
- **Patterns to follow:** `src/services/RecipeIngredientParser.js` (`parseIngredientString`)
- **Test scenarios:**
  - `Covers AE2.` `parseIngredientString('Salt and freshly ground black pepper')`, `parseIngredientString('sea salt, to taste')`, `parseIngredientString('Black pepper')`, and `parseIngredientString('a pinch of salt')` all return `null`.
  - `Covers AE2.` `parseIngredientString('1 tsp sea salt')` and `parseIngredientString('1/2 tsp black pepper')` return non-null parsed objects with converted gram weights (`3.5g` and `1.8g`).
  - `parseIngredientString('1 red bell pepper')` and `parseIngredientString('1 tsp garlic salt')` return non-null parsed objects.
  - `Covers AE3.` `parseIngredientString('1 heaped tsp baking powder')` returns `unit: 'g'`, `qty: 2.5`, `name: 'Baking Powder'`, and `parseIngredientString('350-450ml milk*')` returns `qty: 400`, `unit: 'ml'`, `name: 'Milk'`.
- **Verification:** `node scripts/test_recipe_wizard.js` passes all salt/pepper and unit-descriptor assertions.

### U3. Social-Media Caption & Single-Line Recipe Unpacking (`CINNAMON ROLL BAKED OATS`)

- **Goal:** Parse single-line and headerless social-media captions (including the TikTok `CINNAMON ROLL BAKED OATS` recipe) into clean title, servings, ingredient sections, and numbered method steps.
- **Requirements:** `R6`, `R7`, `R8`, `AE4`
- **Dependencies:** `U1`, `U2`
- **Files:**
  - `src/services/RecipeParserService.js`
  - `scripts/test_recipe_wizard.js`
- **Approach:**
  1. In `src/services/RecipeParserService.js`, add `normalizeSocialCaptionText(rawBlock)` invoked at the start of `parseSingleRecipeText(block)` (and `unpackCollapsedSteps`):
     - Strip trailing social sign-offs and hashtags (`ENJOY!`, markdown links `[#...](...)`, and `#hashtag` runs at the end of the text).
     - Split a leading ALL-CAPS title glued directly to a Capitalized+lowercase sentence (`/^([A-Z0-9\s&'’\-]{4,}?)(?=[A-Z][a-z]{2,})/m` → `$1\n`) so `CINNAMON ROLL BAKED OATSAll the flavours...` separates cleanly into line 1 (`CINNAMON ROLL BAKED OATS`) and the intro blurb.
     - Insert newlines before `Makes \d+(?:\s*[-–]\s*\d+)?\s*servings?\.?` / `Serves \d+` and support `Makes X-Y servings` in header parsing (`servings = parseInt(match[1], 10)`).
     - Split inline numbered method steps that follow sentence punctuation or text without a newline (`/(?<=[.!?])\s*(?=[1-9]\d?\.\s+[A-Z])/g` → `\n\n`), and remove inline `* ...` footnote explanations appearing immediately before `1. <Step>` (`/\*\s*If\s+you['’]re\s+using[\s\S]*?(?=\n*\s*1\.\s+[A-Z])/i`).
     - Expand Unicode bullet markers (`[▫️▪️•●◦▪▫]`) onto their own lines; when a bullet item has the shape `▫️ <SubHeader>- <qty> <unit> ...` (a non-numeric phrase followed by one or more `- <qty>` sub-items), emit `<SubHeader>:` as a section header line followed by each `- <qty>...` item on its own line.
     - When no explicit `Ingredients:` or `Method:` header exists in the normalized block, split `headerText`, `rawIngText`, and `rawMethodText` at the first ingredient bullet/section line and the first `1. <Step>` method line.
  2. Update `unpackCollapsedSteps(rawMethodText)` so inline numbered steps glued immediately to a period (e.g. `fan.2. In a 9×6`) split cleanly and strip trailing `ENJOY!` / `#hashtags`.
- **Patterns to follow:** `src/services/RecipeParserService.js` (`unpackCollapsedIngredients`, `unpackCollapsedSteps`, `parseSingleRecipeText`)
- **Test scenarios:**
  - `Covers AE4.` Passing the exact TikTok `CINNAMON ROLL BAKED OATS` string to `parseBulkRecipeText` returns 1 recipe with:
    - `title === 'Cinnamon Roll Baked Oats'`
    - `servings === 4`
    - `ingredientSections` containing `Main Ingredients` (6 items: Bananas, Rolled Oats, Flavoured Soy Protein Powder, Baking Powder, Milk, Cinnamon), `Cinnamon Swirl` (3 items: Ground Cinnamon, Brown Sugar, Melted Butter/Olive Oil), and `Cream Cheese` (2 items: Cream Cheese, Honey)
    - `methodSteps` containing exactly 6 clean steps (`Preheat your oven to 180°C fan.` through `Slice into portions... up to 5 days.`) with no `* If you're using...` footnote and no `ENJOY!` or `[#bakedoats]` hashtags.
- **Verification:** `node scripts/test_recipe_wizard.js` passes the exact TikTok `CINNAMON ROLL BAKED OATS` end-to-end test.

---

## Verification Contract

| Check | Command | Applies To | Pass Signal |
|---|---|---|---|
| Recipe Wizard & Parser Suite | `node scripts/test_recipe_wizard.js` | `U1`–`U3` | Exits `0` with all tests passing |
| Variant & Taxonomy Mapping Suite | `node scripts/test_variant_save_and_taxonomy_mapping.js` | `U1`–`U3` | Exits `0` |
| Code Ledger Check | `npm run ledger && node scripts/test_ledger.js` | `U1`–`U3` | Exits `0` |
| Production Build Stamp | `npm run build` | `U1`–`U3` | Exits `0` and updates `dist/` |

---

## Definition of Done

- All 3 implementation units (`U1`–`U3`) are implemented and verified by automated tests in `scripts/test_recipe_wizard.js`.
- All commands in the Verification Contract exit `0`.
- `dist/` is rebuilt via `npm run build` so localhost testing serves the updated modules.
- No temporary or dead-end code remains in the diff.
