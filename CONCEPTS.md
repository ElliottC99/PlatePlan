# Concepts

> Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound captures and refreshes learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Pantry Hierarchy & Taxonomy

### Category
The top-level grouping of household foods (e.g. Produce, Dairy, Spices & Seasonings) representing broad culinary domains.
*Avoid: Department, Aisle*

A Category contains Root Items. In recipe ingredient mapping, Category-level mapping allows dynamic product selection across all sub-types and root items within the category.

### Root Item
An abstract, unbranded culinary ingredient (e.g. "Cheddar Cheese", "Maple Syrup", "Basmati Rice") that defines cooking intent without brand or packaging specifics.
*Avoid: Master Ingredient, Canonical Ingredient*

A Root Item belongs to exactly one Category and groups one or more Sub-Types. When recipe ingredients map to a Root Item, dynamic resolution picks the household's optimal auto-default product across its sub-types.

### Sub-Type
A specific variety, preparation, or nutritional tier of a Root Item (e.g. "Mature Cheddar", "Zero-Calorie Maple Syrup", "Brown Basmati Rice").
*Avoid: Variant, Sub-category*

A Sub-Type belongs to a single Root Item and groups concrete branded products. It establishes nutritional and culinary differentiation within a general root item.

### Product
A concrete, purchasable grocery item with specific brand packaging, pack size, price, and nutritional profile per 100g/ml.
*Avoid: SKU, Grocery Item*

Products strictly belong to a Sub-Type. One product within each taxonomy entity serves as the designated auto-default for automatic recipe nutrition resolution.

## Recipe Taxonomy & Scoring

### Taxonomy Elevation
The process of raising an ingredient's mapping level from a concrete Product or Sub-Type to an abstract Root Item or Category.

Elevation strips fixed product pointers (`productId`, `subtypeId`), unlocking the recipe to dynamic runtime pantry resolution as household preferences or grocery offerings change.

### Fit Score
A composite satisfaction score evaluating how closely a recipe's per-serving macronutrients match a user's meal-specific nutritional targets.

Combines Calorie Score and Protein Score under configurable relative weights (defaulting to 50% calories, 50% protein) mapped across four visual tiers: Ideal Match (85+), Needs Work (70–84), Suboptimal (50–69), and Poor Match (<50).

### Tapering Curve
A continuous piecewise linear interpolation function that translates the ratio of actual-to-target nutritional values into a 0–100 percentage score.

Evaluates an optimal sweet spot plateau, inner grace zones with gradual drop-off, and outer tapering zones extending to zero-score boundaries. Calorie deficit and calorie surplus curves are calibrated asymmetrically to accommodate lean ingredient substitutions without penalizing healthy deficits.
