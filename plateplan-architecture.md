PlatePlan Architecture Blueprint
1. Core Architectural Tenets
Live Runtime Boundary (src/ Only): The live application runs exclusively from src/ (entered via index.html). The legacy scripts/ tree is dead runtime weight.

Canon Ownership: Every domain and Firestore collection has a single canonical owner. Never create parallel services or duplicate writers.

Data Safety First: Household data under households/elliott-chloe must be backed up to dated JSON before schema migrations.

Stamp, Don't Type: Version numbers and sw.js manifests are build outputs, not hand-typed edits.

2. Canon Ownership Table & Consolidation Targets
App State: src/store/coreState.js

Firebase Config & Auth: src/config/firebase.js

Products Collection: src/services/ProductRepository.js (Must remove duplicate write in ShoppingFirestoreRepository.js)

Ingredients / Pantry: src/services/PantryTaxonomyService.js

Recipes Collection: src/services/RecipeFirestoreRepository.js (Normalise schema on write)

Meal Plans: src/services/PlanRepository.js

Plan Generation: Must unify PlanGeneratorService.js vs MealPlanGeneratorService.js

Data Quality: src/services/DataQualityScanner.js (Target state is a single read-only report)

UI Overlays & Dialogs: src/components/pantry/ActionSheetUI.js and src/components/ui/DialogHelpers.js

3. Quarantine & Repo Hygiene Targets (attic/)
Untrack & Ignore: cookies.txt, syntax_check.log, app/applet/ must be added to .gitignore.

Dead / Unreferenced Candidates for attic/:

scripts/core, scripts/features, scripts/services, scripts/ui, scripts/main.js

Unreferenced shims: src/utils/ActionBridge.js, src/components/recipe/VaultRecipeCard.js, FitScoreEngine
