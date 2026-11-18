# Attic

Files here were moved out of `src/` because `npm run ledger` labelled them dead or dead shim: nothing in the app loads them. The build doesn't copy `attic/`, so none of this is published.

Each file keeps its original path under `attic/`. To restore one, move it back (for example `git mv attic/src/views/X.js src/views/X.js`), delete its row below, and run `npm run ledger`.

A file may be deleted after two weeks of normal use on both phones with no related problem. When you delete one, remove its row in the same commit and run `npm run ledger`.

| File | Moved | Delete after |
|---|---|---|
| `src/services/RecipeTaxonomyManager.js` | 2026-11-10 | 2026-11-24 |
| `src/services/RecipeWizardFilterService.js` | 2026-11-10 | 2026-11-24 |
| `src/services/RecipeWizardNavigationService.js` | 2026-11-10 | 2026-11-24 |
| `src/services/RecipeWizardStep2FieldsRenderService.js` | 2026-11-10 | 2026-11-24 |
| `src/services/RecipeWizardStep2RenderService.js` | 2026-11-10 | 2026-11-24 |
| `src/services/RecipeWizardStep3RenderService.js` | 2026-11-10 | 2026-11-24 |
| `src/services/RecipeWizardStepRenderService.js` | 2026-11-10 | 2026-11-24 |
| `src/services/RecipeWizardStepValidator.js` | 2026-11-10 | 2026-11-24 |
| `src/services/RecipeWizardSubmissionService.js` | 2026-11-10 | 2026-11-24 |
| `src/services/RecipeWizardValidationService.js` | 2026-11-10 | 2026-11-24 |
| `src/services/TaxonomyMapper.js` | 2026-11-10 | 2026-11-24 |
| `src/services/DataQualityEngine.js` | 2026-11-10 | 2026-11-24 |
| `src/components/recipe-editor/RecipeImportParserForm.js` | 2026-11-18 | 2026-12-02 |
| `src/store/state.js` | 2026-11-18 | 2026-12-02 | Consolidated into `src/store/coreState.js` |
| `src/state/AppState.js` | 2026-11-18 | 2026-12-02 | Consolidated into `src/store/store.js` / `src/store/coreState.js` |
| `src/models/StateModel.js` | 2026-11-18 | 2026-12-02 | Consolidated into `src/store/coreState.js` |
| `src/services/DataQualityScannerService.js` | 2026-11-18 | 2026-12-02 | Consolidated into `src/services/DataQualityScanner.js` |
| `src/services/DataQualityService.js` | 2026-11-18 | 2026-12-02 | Consolidated into `src/services/DataQualityScanner.js` |
| `src/components/pantry/ActionSheetUI.js` | 2026-11-18 | 2026-12-02 | Consolidated into `src/components/navigation/ActionSheetUI.js` |
| `src/config/restoredGnocchi.js` | 2026-11-18 | 2026-12-02 | One-off recipe recovery seed removed from main.js |
| `src/services/RecipeRepository.js` | 2026-11-18 | 2026-12-02 | Consolidated into `src/services/RecipeFirestoreRepository.js` |
| `src/services/PantryFirestoreRepository.js` | 2026-11-18 | 2026-12-02 | Consolidated into `src/services/PantryTaxonomyService.js` |
| `src/services/RootItemRepository.js` | 2026-11-18 | 2026-12-02 | Consolidated into `src/services/PantryTaxonomyService.js` |
