/**
 * src/components/componentRegistry.js (v3.19.8)
 * Aggregator module for UI components, drawers, and modal lifecycle elements.
 * Keeps main.js lean and under strict ES6 file size limits.
 */

import * as DataQualityDrawer from './data-quality/DataQualityDrawer.js';
import * as DataQualityIssueRow from './data-quality/DataQualityIssueRow.js';
import * as DataQualityFixModal from './data-quality/DataQualityFixModal.js';
import * as RecipeEditorModal from './recipe-editor/RecipeEditorModal.js';
import * as RecipeIngredientRow from './recipe-editor/RecipeIngredientRow.js';
import * as RecipeStepRow from './recipe-editor/RecipeStepRow.js';
import * as IngredientEditorRows from './recipe-editor/IngredientEditorRows.js';
import * as RecipeImportParserForm from './recipe-editor/RecipeImportParserForm.js';
import * as ShoppingBatchToolbar from './shopping/ShoppingBatchToolbar.js';
import * as ShoppingCategoryGroup from './shopping/ShoppingCategoryGroup.js';
import * as ShoppingItemRow from './shopping/ShoppingItemRow.js';
import * as ShoppingAisleGroup from './shopping/ShoppingAisleGroup.js';
import * as ShoppingListToolbar from './shopping/ShoppingListToolbar.js';
import * as PlannerDayCard from './planner/PlannerDayCard.js';
import * as PlannerMealSlot from './planner/PlannerMealSlot.js';
import * as PlannerGridToolbar from './planner/PlannerGridToolbar.js';
import * as ProfileMacroEditor from './profile/ProfileMacroEditor.js';
import * as ProfilePreferencesForm from './profile/ProfilePreferencesForm.js';
import * as ProfileSettingsModal from './profile/ProfileSettingsModal.js';
import * as GeneratorWizardModal from './generator/GeneratorWizardModal.js';
import * as GeneratorConstraintsForm from './generator/GeneratorConstraintsForm.js';
import * as GeneratorCandidateDrawer from './generator/GeneratorCandidateDrawer.js';
import * as RecipeNutritionCard from './analytics/RecipeNutritionCard.js';
import * as RecipePortionScaler from './analytics/RecipePortionScaler.js';
import * as RecipeCostBreakdown from './analytics/RecipeCostBreakdown.js';
import * as MacroTrendChart from './analytics/MacroTrendChart.js';
import * as NutriScoreBadgeCard from './analytics/NutriScoreBadgeCard.js';
import * as WeeklySummaryToolbar from './analytics/WeeklySummaryToolbar.js';
import * as VaultFilterToolbar from './vault/VaultFilterToolbar.js';
import * as VaultRecipeCard from './vault/VaultRecipeCard.js';
import * as VaultGridContainer from './vault/VaultGridContainer.js';
import * as VaultGridUI from './vault/VaultGridUI.js';
import * as RecipeDetailModalUI from './recipe/RecipeDetailModalUI.js';
import * as RecipeEditorModalUI from './recipe/RecipeEditorModalUI.js';
import * as PantryItemRow from './pantry/PantryItemRow.js';
import * as PantryCategoryGroup from './pantry/PantryCategoryGroup.js';
import * as PantryToolbar from './pantry/PantryToolbar.js';
import * as PantryInventoryUI from './pantry/PantryInventoryUI.js';
import * as ShoppingListUI from './shopping/ShoppingListUI.js';
import * as ShoppingSubstUI from './shopping/ShoppingSubstUI.js';
import * as UseUpEditorUI from './pantry/UseUpEditorUI.js';
import * as UseUpFinderModalUI from './pantry/UseUpFinderModalUI.js';
import * as PlannerGridUI from './planner/PlannerGridUI.js';
import * as PlannerModalsUI from './planner/PlannerModalsUI.js';
import * as PlannerWizardUI from './planner/PlannerWizardUI.js';
import * as PlannerSwapModalUI from './planner/PlannerSwapModalUI.js';
import * as PrepStepCard from './prep/PrepStepCard.js';
import * as PrepContainerPlanner from './prep/PrepContainerPlanner.js';
import * as PrepSummaryToolbar from './prep/PrepSummaryToolbar.js';
import * as ProfileAllocationCard from './settings/ProfileAllocationCard.js';
import * as DietaryExclusionManager from './settings/DietaryExclusionManager.js';
import * as HouseholdSyncCard from './settings/HouseholdSyncCard.js';
import * as SettingsMacroUI from './settings/SettingsMacroUI.js';
import * as SettingsExclusionsUI from './settings/SettingsExclusionsUI.js';
import * as SettingsHouseholdUI from './profile/SettingsHouseholdUI.js';
import * as HeaderUI from './shell/HeaderUI.js';
import * as NavigationUI from './shell/NavigationUI.js';

export const registeredComponents = {
  DataQualityDrawer, DataQualityIssueRow, DataQualityFixModal, RecipeEditorModal,
  RecipeIngredientRow, RecipeStepRow, IngredientEditorRows, RecipeImportParserForm,
  ShoppingBatchToolbar, ShoppingCategoryGroup, ShoppingItemRow, ShoppingAisleGroup,
  ShoppingListToolbar, PlannerDayCard, PlannerMealSlot, PlannerGridToolbar,
  ProfileMacroEditor, ProfilePreferencesForm, ProfileSettingsModal, GeneratorWizardModal,
  GeneratorConstraintsForm, GeneratorCandidateDrawer, RecipeNutritionCard, RecipePortionScaler,
  RecipeCostBreakdown, MacroTrendChart, NutriScoreBadgeCard, WeeklySummaryToolbar,
  VaultFilterToolbar, VaultRecipeCard, VaultGridContainer, VaultGridUI,
  RecipeDetailModalUI, RecipeEditorModalUI, PantryItemRow, PantryCategoryGroup,
  PantryToolbar, PantryInventoryUI, ShoppingListUI, ShoppingSubstUI, UseUpEditorUI,
  UseUpFinderModalUI, PlannerGridUI, PlannerModalsUI, PlannerWizardUI, PlannerSwapModalUI,
  PrepStepCard, PrepContainerPlanner, PrepSummaryToolbar, ProfileAllocationCard,
  DietaryExclusionManager, HouseholdSyncCard, SettingsMacroUI, SettingsExclusionsUI,
  SettingsHouseholdUI, HeaderUI, NavigationUI
};
