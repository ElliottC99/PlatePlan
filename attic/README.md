# Attic

Files here were moved out of `src/` because `npm run ledger` labelled them dead or dead shim: nothing in the app loads them. The build doesn't copy `attic/`, so none of this is published.

Each file keeps its original path under `attic/`. To restore one, move it back (for example `git mv attic/src/views/X.js src/views/X.js`), delete its row below, and run `npm run ledger`.

A file may be deleted after two weeks of normal use on both phones with no related problem. When you delete one, remove its row in the same commit and run `npm run ledger`.

| File | Moved | Delete after |
|---|---|---|
| `src/components/RecipeWizardModal.js` | 2026-10-28 | 2026-11-11 |
| `src/components/data-quality/HierarchyWizardModalUI.js` | 2026-10-28 | 2026-11-11 |
| `src/components/data-quality/HierarchyWizardRenderService.js` | 2026-10-28 | 2026-11-11 |
| `src/components/meal-planner/MealPlannerHTMLTemplate.js` | 2026-10-28 | 2026-11-11 |
| `src/components/pantry/AddToBankModalUI.js` | 2026-10-28 | 2026-11-11 |
| `src/components/pantry/CategoryManagerOperations.js` | 2026-10-28 | 2026-11-11 |
| `src/components/pantry/CategoryManagerTemplates.js` | 2026-10-28 | 2026-11-11 |
| `src/components/pantry/IngredientActionModalsRenderService.js` | 2026-10-28 | 2026-11-11 |
| `src/components/pantry/StorageZoneGroup.js` | 2026-10-28 | 2026-11-11 |
| `src/components/planner/PlanGeneratorModal.js` | 2026-10-28 | 2026-11-11 |
| `src/components/recipe/VaultRecipeCard.js` | 2026-10-28 | 2026-11-11 |
| `src/components/recipe/ViewRecipeModal.js` | 2026-10-28 | 2026-11-11 |
| `src/services/FitScoreEngine.js` | 2026-10-28 | 2026-11-11 |
| `src/services/RecipeUnitConverter.js` | 2026-10-29 | 2026-11-12 |
| `src/services/RecipeWizardEventService.js` | 2026-10-28 | 2026-11-11 |
| `src/services/SubtypeActionService.js` | 2026-10-28 | 2026-11-11 |
| `src/services/UnitConverter.js` | 2026-10-29 | 2026-11-12 |
| `src/services/firebase.js` | 2026-10-28 | 2026-11-11 |
| `src/views/MealPlannerView.js` | 2026-10-28 | 2026-11-11 |
| `src/views/PantryBankModalService.js` | 2026-10-28 | 2026-11-11 |
| `src/views/ProfileAllocationCard.js` | 2026-10-28 | 2026-11-11 |
| `src/views/SettingsEventService.js` | 2026-10-28 | 2026-11-11 |
| `src/views/VaultRecipeRenderService.js` | 2026-10-28 | 2026-11-11 |
| `src/components/pantry/TescoImportModalUI.js` | 2026-10-29 | 2026-11-12 |
| `src/components/pantry/PantryCategoryGroup.js` | 2026-10-30 | 2026-11-13 |
| `src/components/pantry/PantryInventoryRenderService.js` | 2026-10-30 | 2026-11-13 |
| `src/components/pantry/PantryInventoryUI.js` | 2026-10-30 | 2026-11-13 |
| `src/components/pantry/PantryItemRow.js` | 2026-10-30 | 2026-11-13 |
| `src/components/pantry/PantryStockToolbar.js` | 2026-10-30 | 2026-11-13 |
| `src/components/pantry/PantryToolbar.js` | 2026-10-30 | 2026-11-13 |
| `src/repositories/InventoryRepository.js` | 2026-10-30 | 2026-11-13 |
| `src/services/InventoryService.js` | 2026-10-30 | 2026-11-13 |
| `src/store/inventorySlice.js` | 2026-10-30 | 2026-11-13 |
