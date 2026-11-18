/**
 * src/services/RecipeActionBridge.js (v3.38.69)
 * Sub-bridge for Recipe and Vault related actions.
 */

import { toggleRecipeFavourite, toggleVaultFavouritesFilter } from '../views/RecipeVaultView.js';
import { closeRecipePreview } from './RecipeDetailModalService.js';
import { reindexModalMethodRows } from '../components/recipe-editor/RecipeStepRow.js';

/**
 * Routes recipe-specific actions.
 * @returns {boolean} True if the action was handled.
 */
export function routeRecipeAction(actionName, target, event, parseArgsString) {
  const ds = target.dataset || {};
  const normalizedAction = actionName.toLowerCase().trim();

  // 1. Recipe Modal / View / Fix
  if (normalizedAction === 'fix-issue' || normalizedAction === 'fix-recipe') {
    const issueKey = ds.issueKey || target.getAttribute('data-issue-key') || '';
    if (issueKey && (issueKey.startsWith('advisory:') || issueKey.includes('recipe-macro-sync') || issueKey.includes('recipe-low-cal') || issueKey.includes('macro-sync'))) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const recipeId = issueKey.split(':').pop() || ds.entityId || ds.recipeId || ds.id;
      if (typeof window.autoRecalibrateRecipeMacros === 'function') {
        window.autoRecalibrateRecipeMacros(recipeId);
      }
      return true;
    }
  }

  if (normalizedAction === 'view-recipe' || normalizedAction === 'viewrecipe' || normalizedAction.includes('viewrecipe') || normalizedAction.includes('openrecipemodal')) {
    const args = parseArgsString(actionName);
    const recipeId = ds.recipeId || ds.id || args[0];
    const instanceId = ds.instanceId || args[1] || null;
    const variant = ds.variant || args[2] || 'original';
    const targetPerson = ds.targetPerson || args[3] || 'both';

    if (recipeId) {
      if (typeof window.viewRecipe === 'function') {
        window.viewRecipe(recipeId, instanceId, variant, targetPerson);
      } else if (typeof window.openRecipeModal === 'function') {
        window.openRecipeModal(recipeId, instanceId, variant, targetPerson);
      }
    }
    return true;
  }

  // Fit score details modal
  if (normalizedAction === 'open-fit-details' || normalizedAction.includes('openvaultfitdetails')) {
    const args = parseArgsString(actionName);
    const recipeId = ds.recipeId || ds.id || args[1];
    const variant = ds.variant || args[2] || 'original';
    const person = ds.person || args[3] || 'e';
    if (typeof window.openVaultFitDetails === 'function') {
      window.openVaultFitDetails(target, recipeId, variant, person);
    }
    return true;
  }

  // Recipe Actions Menu
  if (normalizedAction === 'open-recipe-actions' || normalizedAction.includes('openrecipeactions')) {
    const recipeId = ds.recipeId || ds.id || parseArgsString(actionName)[0];
    if (typeof window.openRecipeActions === 'function') {
      window.openRecipeActions(recipeId);
    }
    return true;
  }

  if (normalizedAction === 'open-enhanced-recipe-actions' || normalizedAction.includes('openenhancedrecipeactions')) {
    const recipeId = ds.recipeId || ds.id || parseArgsString(actionName)[0];
    if (typeof window.openEnhancedRecipeActions === 'function') {
      window.openEnhancedRecipeActions(recipeId);
    }
    return true;
  }

  if (normalizedAction === 'open-enhance-recipe' || normalizedAction.includes('openenhancerecipemodal')) {
    const recipeId = ds.recipeId || ds.id || parseArgsString(actionName)[0];
    if (recipeId && typeof window.openEnhanceRecipeModalForCurrent === 'function') {
      window.openEnhanceRecipeModalForCurrent(recipeId);
    }
    return true;
  }

  if (normalizedAction.includes('copymethodfromoriginalrecipe')) {
    const recipeId = ds.recipeId || ds.id || parseArgsString(actionName)[0];
    if (recipeId && typeof window.copyMethodFromOriginalRecipe === 'function') {
      window.copyMethodFromOriginalRecipe(recipeId);
    }
    return true;
  }

  // 2. Recipe Favourite Toggle
  if (normalizedAction === 'toggle-favorite' || normalizedAction === 'toggle-fav' || normalizedAction === 'togglefavourite' || normalizedAction.includes('togglerecipefavourite')) {
    const recipeId = ds.recipeId || ds.id || parseArgsString(actionName)[0];
    const variant = ds.variant || parseArgsString(actionName)[2] || 'original';
    if (recipeId) {
      toggleRecipeFavourite(recipeId, event, variant);
    }
    return true;
  }

  // 3. Vault Favourites Filter
  if (normalizedAction === 'toggle-vault-fav-filter' || normalizedAction === 'toggle-favourites-filter' || normalizedAction.includes('togglevaultfavouritesfilter')) {
    toggleVaultFavouritesFilter();
    return true;
  }

  if (normalizedAction.includes('openrecipeauditmodal')) {
    if (typeof window.openRecipeAuditModal === 'function') {
      const recId = ds.recipeId || parseArgsString(actionName)[0] || null;
      window.openRecipeAuditModal(recId);
    }
    return true;
  }

  if (normalizedAction === 'close-recipe-preview') {
    closeRecipePreview();
    return true;
  }

  if (normalizedAction === 'switch-view-tab') {
    window.switchViewTab?.(ds.tab || 'original');
    return true;
  }

  if (normalizedAction === 'open-enhance-recipe-modal') {
    window.openEnhanceRecipeModalForCurrent?.(ds.recipeId || '');
    return true;
  }

  if (normalizedAction === 'open-recipe-wizard-review') {
    closeRecipePreview();
    window.openRecipeWizard?.('review', ds.recipeId || '', ds.variant || 'original');
    return true;
  }

  if (normalizedAction === 'remove-current-enhanced-variant') {
    window.removeCurrentEnhancedVariant?.(ds.recipeId || '');
    return true;
  }

  if (normalizedAction === 'switch-preview-serving-mode') {
    window.switchPreviewServingMode?.(ds.mode || 'both');
    return true;
  }

  if (normalizedAction === 'go-to-wizard-step') {
    window.goToWizardStep?.(Number(ds.step));
    return true;
  }

  if (normalizedAction === 'close-recipe-wizard') {
    window.closeRecipeWizard?.();
    return true;
  }

  if (normalizedAction === 'search-substitute-for-ingredient') {
    window.searchSubstituteForIngredient?.(ds.prefix || 'orig', ds.name || '');
    return true;
  }

  if (normalizedAction === 'highlight-review-ingredient-row') {
    window.highlightReviewIngredientRow?.(ds.prefix || 'orig', Number(ds.idx));
    return true;
  }

  if (normalizedAction === 'remove-modal-method-step') {
    target.closest('.rev-method-row')?.remove();
    reindexModalMethodRows(ds.mode || 'orig');
    return true;
  }

  if (normalizedAction === 'remove-review-ingredient-row') {
    window.removeReviewIngredientRow?.(target, ds.prefix || 'orig');
    return true;
  }

  if (normalizedAction === 'open-review-mapping-modal-from-status') {
    window.openReviewMappingModalFromStatus?.(target);
    return true;
  }

  if (normalizedAction === 'edit-modal-row-ingredient') {
    window.editModalRowIngredient?.(target);
    return true;
  }

  if (normalizedAction === 'open-modal-ingredient-replace') {
    window.openModalIngredientReplace?.(target);
    return true;
  }

  if (normalizedAction === 'open-review-ingredient-actions') {
    window.openReviewIngredientActions?.(target, ds.prefix || 'orig');
    return true;
  }

  return false;
}
