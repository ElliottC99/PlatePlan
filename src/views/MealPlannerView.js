/**
 * src/views/MealPlannerView.js (v3.20.01)
 * Modular Meal Planner View Facade.
 * Re-exports core planner lifecycle and sanitised reset handlers from PlannerView.js.
 */

export {
  createCleanEmptyPlanSchema,
  renderPlanner,
  renderPlannerWizard,
  renderPlan,
  toggleSlotVariant,
  prioritiseAllPlannedEnhancedRecipes,
  openPlannedMealActions,
  swapSlot,
  openSwapMealModal,
  setSwapModalFilter,
  selectSwapModalRecipe,
  confirmSwapMealModal,
  renderSwapModalOptionsList,
  executeSwapSlotAndClose,
  closeSwapMealModal,
  quickRandomizeSwap,
  clearPlan,
  showPlanSetup,
  renderPlanOverallSummary,
  setPlannerWizardStep,
  resetPlannerStartFresh,
  mount,
  unmount
} from './PlannerView.js';
