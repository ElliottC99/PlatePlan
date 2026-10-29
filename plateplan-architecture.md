PlatePlan Architecture Blueprint
1. Core Architectural Tenets
Live Runtime Boundary (src/ Only): The live application runs exclusively from src/ (entered via index.html). The legacy scripts/ tree is dead runtime weight.

Canon Ownership: Every domain and Firestore collection has a single canonical owner. Never create parallel services or duplicate writers.

Data Safety First: Household data under households/elliott-chloe must be backed up to dated JSON before schema migrations.

Stamp, Don't Type: The version number is typed only in package.json; scripts/build.js stamps it and the commit ID into index.html when GitHub Actions builds the site. There is no service worker or precache list.

2. Canon Ownership Table & Consolidation Targets
One owner per job. Parallel versions are other modules that still do the same job; merge each into the owner, then take it out of this table. A new module doing a job listed here goes into its Parallel versions cell in the same change. `npm run ledger` reads this table (keep the header and the `path` cells exactly as they are) and counts the parallel versions in LEDGER.md.

| Job | Owner | Parallel versions |
|---|---|---|
| App state | `src/store/coreState.js` | `src/store/state.js`, `src/state/AppState.js`, `src/models/StateModel.js` |
| Firebase config and auth | `src/config/firebase.js` | — |
| Products collection | `src/services/ProductRepository.js` | — |
| Ingredients and pantry | `src/services/PantryTaxonomyService.js` | — |
| Recipes collection | `src/services/RecipeFirestoreRepository.js` (normalise the schema on write) | — |
| Meal plans | `src/repositories/PlanRepository.js` | — |
| Plan generation | `src/services/MealPlanGeneratorService.js` | — |
| Unit conversion | `src/services/UnitConversionService.js` | — |
| Data Quality | `src/services/DataQualityScanner.js` (target: a single read-only report) | `src/services/DataQualityEngine.js`, `src/services/DataQualityScannerService.js`, `src/services/DataQualityService.js` |
| Action sheets | `src/components/navigation/ActionSheetUI.js` | `src/components/pantry/ActionSheetUI.js` |
| Dialogs | `src/components/ui/DialogHelpers.js` | — |

3. Quarantine (attic/)
LEDGER.md, written by `npm run ledger`, lists what is dead, what needs a check, and what is waiting in the attic. A file moves into attic/ only when the ledger labels it dead or dead shim; it keeps its original path there and gets a dated row in attic/README.md. It is deleted after two weeks of normal use on both phones with no related problem.
