/**
 * scripts/features/bank-products-core.js
 * Product bank CRUD operations and state resolvers.
 */
(function() {
  'use strict';
  
  // Bank state initialization
  window.PlatePlanBank = window.PlatePlanBank || {};
  window.PlatePlanBank.State = window.PlatePlanBank.State || {
    currentTescoImportPayloadCache: '',
    currentTescoImportData: null,
    ingredientSubTypesOpenIds: new Set(),
    ingredientGroupPickerContext: null,
    ingredientGroupPickerMode: 'type'
  };

  // State Accessors
  window.PlatePlanBank.getBankState = () => window.PlatePlanBank.State;
  window.PlatePlanBank.resetState = () => {
    window.PlatePlanBank.State = {
      currentTescoImportPayloadCache: '',
      currentTescoImportData: null,
      ingredientSubTypesOpenIds: new Set(),
      ingredientGroupPickerContext: null,
      ingredientGroupPickerMode: 'type'
    };
  };

  // Core Product CRUD (Placeholder for migrated logic)
  window.PlatePlanBank.persistProductToBank = async (product) => {
    console.log('Persisting product:', product);
    // Migration target: persistProductToBank logic from bank-products.js
  };
})();
