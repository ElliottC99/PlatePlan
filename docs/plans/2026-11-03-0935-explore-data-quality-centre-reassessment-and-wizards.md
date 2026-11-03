# Exploration: Data Quality Centre Architecture, Anomaly Audit & Wizard Resolution System

> **Date:** 2026-11-03  
> **Topic:** Data Quality Centre Reassessment, Audit Scanner Untangling & Guided Resolution Wizards  
> **Status:** Deep Exploration & Discovery Complete  
> **Author:** Antigravity Pair Programming

---

## 1. Executive Summary & Core Objectives

The **Data Quality Centre** exists to maintain the health and operational integrity of PlatePlan's database (recipes, products, ingredients, taxonomy, meal plans, and storage).

When data health deteriorates:
- Recipes calculate inaccurate macros and fit scores.
- Shopping lists fail to aggregate items or resolve buy quantities.
- Active weekly plans drift out of sync with recipe templates.
- Orphaned products and duplicate taxonomy items clutter the search dropdowns and product bank.

**The User's Core Vision**:
1. Evaluate and reassess the Data Quality tab.
2. Clearly identify what is currently broken or tangled behind the scenes.
3. Define what *should* be going on to keep household data genuinely healthy without drowning the user in false alarms.
4. Establish guided, interactive **Wizards** (the user's preferred resolution modality) for every actionable issue category.
5. Involve the user with clear steers and questions to align on the target experience.

---

## 2. What Is Currently Going On? (Deep Codebase Audit)

Running an audit on the live household backup (`147 recipes`, `402 products`, `291 ingredients`) surfaced critical structural and UI breakdowns:

```
=== REAL HOUSEHOLD AUDIT REPORT ===
Total Issues Flagged: 289
1. Macro Drift: 13 recipes
2. Plan Desync: 0
3. Incomplete Macros: 0
4. Density Mismatch: 262 instances (Noise Flood!)
5. Orphan Products: 2 products (actual corrupted subtypeId)
6. Unmapped Core Items: 9 ingredients (0 products linked)
7. Duplicate Ingredients: 3 items (actual duplicates from testing)
8. Storage Health: 0 (healthy)
```

### Critical Findings & Broken Mechanics:

### A. The Broken UI: 100% Dead Action Buttons
In [`DataQualityTableRenderService.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/views/DataQualityTableRenderService.js#L231-L234):
- The service renders 8 distinct audit cards with action buttons:
  - `Manual Inspect` (`.rec-manual-inspect-btn`)
  - `Sync Active Week` (`.plan-sync-active-btn`)
  - `Fix Macros` (`.math-fix-macros-btn`)
  - `Add Conversion` (`.density-add-conversion-btn`)
  - `Resolve Links` (`.orphan-resolve-btn`)
  - `Find Tesco Match` (`.unmapped-tesco-btn`)
  - `Review & Merge` (`.duplicate-merge-btn`)
  - `Clean History Cache` (`.health-clean-btn`)
- **None of these buttons are wired up.** Line 232 contains an unfulfilled comment:
  `// Bind all actions... This is too much code in the render function. I need to delegate action handlers.`
- Result: **Clicking any button on any issue card does absolutely nothing.** The user is completely stranded.

### B. The 262-Item Density Noise Flood
- `DataQualityEngine.js` iterates over every ingredient line of all 147 recipes.
- If a recipe uses volume (`ml`, `tbsp`, `tsp`) and `ingredient.density` is not typed into Firestore, it generates a full error card.
- Common liquids like **Soy Sauce, Sesame Oil, Rice Wine Vinegar, and Water** generate **262 separate warnings**!
- Yet [`UnitConversionService.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/UnitConversionService.js) already knows standard liquids (`LIQUID_WORDS`) and safely defaults to `1.0 g/ml` for water-based liquids or standard oil densities.
- Result: The user opens Data Quality and sees 262 identical, un-actionable density cards that drown out genuine data issues.

### C. Conflicting Scanners & Duplicate Views (Architectural Debt)
- **4 parallel services**: `DataQualityScanner.js` (canonical owner per `plateplan-architecture.md`), `DataQualityEngine.js`, `DataQualityScannerService.js`, and `DataQualityService.js`.
- **2 conflicting views**:
  - `DataQualityDrawer.js` (targets `#dq-missing-list` and `#dq-duplicate-list` in `index.html`).
  - `DataQualityTableRenderService.js` (completely wipes `#view-data` and replaces with its own layout).
- **Modals already written but disconnected**:
  - `MergeIngredientsModal.js`: side-by-side duplicate ingredient merge.
  - `SubtypeOrphanResolverModal.js`: batch reassigning orphaned products.
  - `MacroDriftPreviewModal.js`: batch recalibrating recipe macros.
  - `MealPlanSyncWarningModal.js`: syncing outdated meal plan slots.
  - `UnlinkedSweeperUI.js`: batch scanning unlinked items.
  - `RecipeAuditModal.js`: auditing recipe ingredient mappings.

### D. The Real Actionable Data In Elliott & Chloe's Household Today:
1. **2 Orphaned Products**:
   - `Mini White Tortilla Wraps Plain` references deleted subtype `sub_1791031730133`.
   - `Protein Boost Sliced Bagels` references deleted subtype `sub_1791038085297`.
2. **3 Duplicate Ingredients**:
   - `Medium Noodles`, `Medium Noodles 2`, and `MediumNoodles 3` (similarity >92%).
3. **9 Unmapped Pantry Ingredients**:
   - Ingredients in the pantry that have 0 products linked (e.g. Milled Flax Seed Mix, Plant-based Fish Sauce, Dried Penne, Jackfruit, Sherry).
4. **13 Recipes with Macro Drift**:
   - Recipes whose stored macros differ slightly from dynamic ingredient sums (e.g. Sesame Tempeh Bowls, Crispy Tofu Sandwich).

---

## 3. What Should Be Going On? (Target Vision)

The Data Quality Centre should be an executive **Data Health & Maintenance Dashboard**:

```
+-------------------------------------------------------------------------------+
|  🩺 Data Health Centre                                 [ Run Full Health Scan ]|
|  Overall Household Health: 88% Healthy  ·  24 Actionable Items                |
+-------------------------------------------------------------------------------+
|                                                                               |
|  [ 👥 Merge Duplicates (3) ]   [ 🔗 Resolve Orphans (2) ]   [ 📉 Macro Drift (13) ]
|  [ 🛒 Unmapped Items (9)   ]   [ 🧹 Sweeper Tool        ]   [ 📖 Recipe Audit     ]
|                                                                               |
+-------------------------------------------------------------------------------+
|  HEALTH PILLARS                                                               |
|                                                                               |
|  1. 👥 Catalogue Deduplication (3 Candidates)                                 |
|     "Medium Noodles", "Medium Noodles 2", "MediumNoodles 3"                   |
|     --> [ Launch Deduplication Wizard ]                                       |
|                                                                               |
|  2. 🔗 Broken / Orphaned Products (2 Products)                               |
|     "Protein Boost Sliced Bagels" has missing Sub-Type                        |
|     --> [ Launch Orphan Resolver Wizard ]                                     |
|                                                                               |
|  3. 📉 Recipe Macro Alignment (13 Drifted Recipes)                           |
|     Stored calories differ by >2% from active pantry auto-defaults            |
|     --> [ Review & 1-Click Recalibrate Wizard ]                               |
|                                                                               |
|  4. 🛒 Unmapped Pantry Ingredients (9 Items with no store products)          |
|     "Milled Flax Seed Mix", "Plant-based Fish Sauce", "Dried Penne"...        |
|     --> [ Launch Product Linker / Tesco Wizard ]                              |
|                                                                               |
|  5. 🧪 Density & Conversions (Grouped by Ingredient, not by Recipe!)        |
|     Only non-liquid dry goods measuring in volume                             |
|     --> [ Set Conversion Factor ]                                             |
+-------------------------------------------------------------------------------+
```

### Guiding Principles for the Target State:
1. **Never Flood with Redundant Noise**:
   - An issue must be grouped by the **entity causing it**, not repeated for every recipe or day. (e.g. 1 card for "Sesame Oil density", NOT 262 cards for 262 recipe occurrences).
   - Known liquids defined in `UnitConversionService.js` (`water`, `oil`, `vinegar`, `soy sauce`, etc.) automatically have a liquid density (1.0 g/ml or standard table value) and must **never** be flagged.
2. **Step-by-Step Wizards for Every Action**:
   - The user clicks a button and is greeted by a focused, modal Wizard.
   - The wizard clearly displays:
     - What's wrong and why it matters.
     - Side-by-side preview of what will change (e.g. "Merging Medium Noodles 2 into Medium Noodles will update 4 recipes and 1 meal plan").
     - A single, prominent primary action button ("Confirm & Merge").
3. **Single Canonical Service Owner**:
   - Collapse `DataQualityEngine.js` and `DataQualityScannerService.js` into the owner `src/services/DataQualityScanner.js`.
   - Single source of truth for all diagnostics and audits.

---

## 4. How Do We Get Between Them? (The Untangling Roadmap)

### Phase 1: Architectural Consolidation & Scanner Sanitization
1. Consolidate `DataQualityEngine.js` and `DataQualityScannerService.js` into `src/services/DataQualityScanner.js`.
2. Fix the Density Mismatch audit:
   - Exclude recognized liquids from `UnitConversionService.js`.
   - Group any remaining dry-volume issues **per ingredient** (reducing 262 cards to 0 or 1).
3. Ensure all audit items output consistent, clean payloads with proper keys and IDs.

### Phase 2: Action Delegation & Wizard Wiring
1. Wire up delegated click handling on `#view-data` so every action button reliably dispatches to its respective wizard.
2. Modernize the existing modals into cohesive, Apple HIG-style **Data Health Wizards**:
   - **Wizard 1: Deduplication & Merge Wizard** (`MergeIngredientsModal.js`):
     - Displays two duplicate ingredients side-by-side.
     - Highlights which one has more products/recipes linked.
     - Automatically cascades merges across `recipes`, `products`, and `plans`.
   - **Wizard 2: Orphan Linker Wizard** (`SubtypeOrphanResolverModal.js`):
     - Shows orphaned product (e.g. `Protein Boost Sliced Bagels`).
     - Offers 3 clear choices: (1) Reassign to parent root item default, (2) Assign to an existing sub-type, or (3) Create new sub-type.
   - **Wizard 3: Recipe Macro Recalibration Wizard** (`MacroDriftPreviewModal.js`):
     - Shows the 13 drifted recipes side-by-side with stored vs calculated macros.
     - Offers "Recalibrate All 13 Recipes" or selective toggles.
   - **Wizard 4: Unmapped Product Linker Wizard** (`ResolveUnlinkedModalUI.js` / Tesco Import):
     - Steps through unmapped ingredients with 1-click Tesco search link or manual product link.

### Phase 3: Shell Cleanup & Legacy Retirement
1. Clean up `index.html` lines 529-545 (remove obsolete placeholder cards that get overwritten anyway).
2. Move dead shims and duplicate drawers (`DataQualityDrawer.js`, `DataQualityFixModal.js`, `DataQualityIssueRow.js`) into `attic/` per `plateplan-architecture.md`.
3. Update `plateplan-architecture.md` and `LEDGER.md` (`npm run ledger`).
4. Run automated tests and verify.

---

## 5. Steers & Questions for the User

Before we move to `/plan`, I would like your guidance on a few design and functional choices:

1. **Dashboard Layout**:
   - Would you prefer the Data Quality tab to show a **top summary KPI banner** (e.g. *Overall Health: 94% · 3 Duplicates · 2 Orphans · 13 Macro Drifts*) with quick-launch wizard buttons at the top, followed by clean categorized sections?
2. **Density Warnings**:
   - Should we completely silence density warnings for standard kitchen liquids (Soy Sauce, Sesame Oil, Vinegars, Stocks) since `UnitConversionService` already calculates their ml accurately?
3. **Auto-Recalibrate vs Manual Approval for Macro Drift**:
   - For recipes whose macros differ by 1–5 calories due to auto-default product updates, would you prefer a **1-click "Recalibrate All Drifted Recipes"** button, or do you always want to inspect each recipe individually in a wizard first?
4. **Duplicate Ingredients**:
   - When merging duplicate ingredients (e.g. `Medium Noodles 2` into `Medium Noodles`), would you like the wizard to default to keeping the one that has the most linked recipes/products, with a single button to "Merge & Re-link All"?
