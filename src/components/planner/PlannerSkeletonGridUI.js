/**
 * src/components/planner/PlannerSkeletonGridUI.js (v3.38.62)
 * Dual-Dot Fit Score Scope Timeline, Pre-Generation Interactive Skeleton Grid,
 * and Split Household Slot Configurator (Elliott & Chloe) with Unified Fit & Duplication Badges.
 * Decomposed: Rendering factories moved to PlannerGridRenderService.js.
 */
import { getState } from '../../store/coreState.js';

import { saveCurrentPlan } from '../../services/HouseholdRepository.js';
import { 
  getSkeletonSlotConfig, 
  renderFitScoreScopeUI, 
  renderSkeletonGridUI, 
  renderRecipeCandidateRows, 
  renderSlotConfiguratorModal 
} from './PlannerGridRenderService.js';

export { getSkeletonSlotConfig, renderFitScoreScopeUI, renderSkeletonGridUI };

export function openSlotConfigurator(dayIndex, mealType, forceSplitMode = null) {
  if (typeof window === 'undefined') return;
  const state = getState();
  const skeletonGrid = state.skeletonGrid || {};
  const currentConfig = getSkeletonSlotConfig(skeletonGrid, dayIndex, mealType) || { status: 'unassigned', isSkipped: false, isSplit: false };
  const isSplit = forceSplitMode !== null ? Boolean(forceSplitMode) : Boolean(currentConfig.isSplit);
  window.__slotConfigContext = { day: dayIndex, meal: mealType, isSplit };

  const existing = document.getElementById('slot-configurator-overlay');
  if (existing) existing.remove();

  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
  const hasAnyConfig = currentConfig.status && currentConfig.status !== 'unassigned';

  const overlay = document.createElement('div');
  overlay.id = 'slot-configurator-overlay';
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:9999;background:rgba(15,23,42,0.45);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

  overlay.innerHTML = renderSlotConfiguratorModal({
    dayIndex,
    mealLabel,
    mealType,
    isSplit,
    hasAnyConfig,
    currentConfig,
    recipes,
    skeletonGrid
  });

  document.body.appendChild(overlay);
}

export function closeSlotConfigurator() {
  const el = document.getElementById('slot-configurator-overlay');
  if (el) el.remove();
}

export function setSlotConfiguredStatus(dayIndex, mealType, status, recipeId = null) {
  if (!getState()) getState() = {};
  if (!getState().skeletonGrid) getState().skeletonGrid = {};

  const slotKey = `${dayIndex}_${mealType}`;
  if (status === 'unassigned') {
    delete getState().skeletonGrid[slotKey];
  } else if (status === 'skipped') {
    getState().skeletonGrid[slotKey] = {
      status: 'skipped',
      isSkipped: true,
      isSplit: false,
      elliott: { isSkipped: true },
      chloe: { isSkipped: true }
    };
  } else {
    const [baseRecipeId, variantStr] = (recipeId || '').split('::');
    const finalVariant = variantStr || 'original';

    getState().skeletonGrid[slotKey] = {
      status: 'pinned',
      isSkipped: false,
      isSplit: false,
      pinned: true,
      recipeId: baseRecipeId || null,
      variant: finalVariant,
      elliott: { recipeId: baseRecipeId || null, variant: finalVariant, isSkipped: false, pinned: true },
      chloe: { recipeId: baseRecipeId || null, variant: finalVariant, isSkipped: false, pinned: true }
    };
  }

  if (typeof saveCurrentPlan === 'function') saveCurrentPlan(getState().currentPlan);
  closeSlotConfigurator();
  if (typeof window.renderPlannerWizard === 'function') window.renderPlannerWizard();
}

export function setSplitPersonSlotStatus(dayIndex, mealType, personKey, status, recipeId = null) {
  if (!getState()) getState() = {};
  if (!getState().skeletonGrid) getState().skeletonGrid = {};

  const slotKey = `${dayIndex}_${mealType}`;
  const existing = getSkeletonSlotConfig(getState().skeletonGrid, dayIndex, mealType) || {};
  const elliott = { ...(existing.elliott || (existing.recipeId ? { recipeId: existing.recipeId, pinned: true } : (existing.isSkipped ? { isSkipped: true } : {}))) };
  const chloe = { ...(existing.chloe || (existing.recipeId ? { recipeId: existing.recipeId, pinned: true } : (existing.isSkipped ? { isSkipped: true } : {}))) };
  delete elliott.recipeName;
  delete chloe.recipeName;

  const [baseSplitId, variantSplitStr] = (recipeId || '').split('::');
  const finalSplitVariant = variantSplitStr || 'original';

  const targetObj = status === 'skipped'
    ? { isSkipped: true }
    : (status === 'pinned' && baseSplitId ? { recipeId: baseSplitId, variant: finalSplitVariant, isSkipped: false, pinned: true } : {});

  const nextElliott = personKey === 'elliott' ? targetObj : elliott;
  const nextChloe = personKey === 'chloe' ? targetObj : chloe;

  getState().skeletonGrid[slotKey] = {
    status: 'split',
    isSkipped: Boolean(nextElliott.isSkipped && nextChloe.isSkipped),
    isSplit: true,
    elliott: nextElliott,
    chloe: nextChloe
  };

  if (typeof window.saveState === 'function') window.saveState();
  if (typeof window.renderPlannerWizard === 'function') window.renderPlannerWizard();
  openSlotConfigurator(dayIndex, mealType, true);
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    renderFitScoreScopeUI,
    renderSkeletonGridUI,
    openSlotConfigurator,
    closeSlotConfigurator,
    setSlotConfiguredStatus,
    setSplitPersonSlotStatus,
    toggleSlotConfiguratorMode(isSplit) {
      const ctx = window.__slotConfigContext || { day: 1, meal: 'dinner' };
      openSlotConfigurator(ctx.day, ctx.meal, Boolean(isSplit));
    },
    handleFitScoreMinChange(val) {
      if (!getState()) getState() = {};
      if (!getState().prefs) getState().prefs = {};
      getState().prefs.minFitScore = parseInt(val, 10) || 0;
      if (typeof window.saveState === 'function') window.saveState();
      if (typeof window.renderPlannerWizard === 'function') window.renderPlannerWizard();
    },
    handleFitScoreMaxChange(val) {
      if (!getState()) getState() = {};
      if (!getState().prefs) getState().prefs = {};
      getState().prefs.maxFitScore = parseInt(val, 10) || 100;
      if (typeof window.saveState === 'function') window.saveState();
      if (typeof window.renderPlannerWizard === 'function') window.renderPlannerWizard();
    },
    filterSlotConfigRecipes(query, person = 'both') {
      const ctx = window.__slotConfigContext || { day: 1, meal: 'dinner' };
      const listEl = document.getElementById(`slot-config-recipe-list-${person}`) || document.getElementById('slot-config-recipe-list-both');
      if (!listEl) return;
      const recipes = Array.isArray(getState()?.recipes) ? getState().recipes : [];
      const skeletonGrid = getState()?.skeletonGrid || {};
      listEl.innerHTML = renderRecipeCandidateRows(recipes, {
        dayIndex: ctx.day,
        mealType: ctx.meal,
        person,
        query,
        skeletonGrid
      });
    }
  });
}
