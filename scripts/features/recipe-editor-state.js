/**
 * scripts/features/recipe-editor-state.js
 * Centralized state container for the Recipe Editor domain.
 */
(function() {
  'use strict';
  
  window.PlatePlanRecipeEditor = window.PlatePlanRecipeEditor || {};
  window.PlatePlanRecipeEditor.State = window.PlatePlanRecipeEditor.State || {
    activeDraft: null,
    stepReorderIndex: 0,
    mappingTargets: [],
    modalState: {}
  };

  window.PlatePlanRecipeEditor.getEditorState = () => window.PlatePlanRecipeEditor.State;
  window.PlatePlanRecipeEditor.resetState = () => {
    window.PlatePlanRecipeEditor.State = {
        activeDraft: null,
        stepReorderIndex: 0,
        mappingTargets: [],
        modalState: {}
    };
  };
})();
