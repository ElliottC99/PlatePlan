// == COMPATIBILITY BRIDGE ==
(() => {
  const escapeHtmlFallback = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const escapeAttrFallback = (value) => escapeHtmlFallback(value).replace(/`/g, '&#96;');
  if (typeof window !== 'undefined') {
    if (!window.ppEscapeHtml) window.ppEscapeHtml = escapeHtmlFallback;
    if (!window.ppEscapeAttr) window.ppEscapeAttr = escapeAttrFallback;
  }

  const bridgeFunctions = {};

  const safeResolve = (globalName, fallback = () => {}) => {
    const bridgeFn = (...args) => {
      // Find the actual target function on window
      const fn = window[globalName];
      // Make sure we don't call ourselves recursively
      if (fn && typeof fn === 'function' && fn !== bridgeFn) {
        return fn(...args);
      }
      return fallback(...args);
    };
    bridgeFunctions[globalName] = bridgeFn;
    return bridgeFn;
  };

  globalThis.PlatePlanLegacy = Object.freeze({
    version: window.PLATEPLAN_APP_VERSION || '3.3.7-mod',
    expectedCache: window.PLATEPLAN_EXPECTED_CACHE || 'plateplan-shell-v94',
    getState: () => (typeof state !== 'undefined' ? state : (window.state || {})),
    saveState: safeResolve('saveState'),
    getRecipe: safeResolve('getRecipe'),
    getProduct: safeResolve('getProduct'),
    calculateRecipeDisplayNutrition: safeResolve('calculateRecipeDisplayNutrition'),
    getPlanContextForInstance: safeResolve('getPlanContextForInstance'),
    refreshPlatePlanDerivedState: safeResolve('refreshPlatePlanDerivedState'),
    renderLegacyView: safeResolve('renderPlatePlanLegacyView'),
    get renderers() {
      return typeof platePlanFeatureRenderers !== 'undefined' ? platePlanFeatureRenderers : (window.platePlanFeatureRenderers || window.PlatePlanRouter?.platePlanFeatureRenderers || {});
    },
    openSearchResult: safeResolve('openPlatePlanSearchResult'),
    runDelegatedAction: safeResolve('runPlatePlanDelegatedAction'),
    showInfo: safeResolve('openAppInfoModal'),
    closeInfo: safeResolve('closeAppConfirmModal'),
    showOverlay: safeResolve('showOverlay'),
    hideOverlay: safeResolve('hideOverlay'),
    showToast: safeResolve('showPlatePlanToast'),
    createRecoveryPoint: safeResolve('createRecoveryPoint'),
    renderRecoveryPanel: safeResolve('renderRecoveryPanel'),
    initCloudSync: safeResolve('initPlatePlanCloudSync'),
    signOut: safeResolve('signOutPlatePlan'),
    renderAll: safeResolve('renderAll'),
    saveIngredient: safeResolve('saveIngredient'),
    addIngredient: safeResolve('addIngredient'),
    deleteIngredient: safeResolve('deleteIngredient'),
    saveManualIng: safeResolve('saveManualIng'),
    deleteIng: safeResolve('deleteIng'),
    abortBatchImport: safeResolve('abortBatchImport'),
    skipBatchImportRecipe: safeResolve('skipBatchImportRecipe'),
    confirmBatchIdentification: safeResolve('confirmBatchIdentification'),
    loadBatchRecipeIntoStepA: safeResolve('loadBatchRecipeIntoStepA'),
    openConfirmRecipeIdentificationModal: safeResolve('openConfirmRecipeIdentificationModal'),
    updateBatchUiBanners: safeResolve('updateBatchUiBanners'),
    openTescoModal: safeResolve('openTescoModal'),
    showTescoSearchModal: safeResolve('showTescoSearchModal'),
    openAddProductModal: safeResolve('openAddProductModal'),
    openProductPicker: safeResolve('openProductPicker'),
    showTescoImport: safeResolve('showTescoImport'),
    closeTescoModal: safeResolve('closeTescoModal'),
    openUnifiedMappingModal: safeResolve('openUnifiedMappingModal'),
    closeUnifiedMappingModal: safeResolve('closeUnifiedMappingModal'),
    openTescoImportFromSubst: safeResolve('openTescoImportFromSubst'),
    closeSubstituteModal: safeResolve('closeSubstituteModal'),
    confirmSubstitute: safeResolve('confirmSubstitute'),
    extractTescoProduct: safeResolve('extractTescoProduct'),
    saveTescoIngredient: safeResolve('saveTescoIngredient'),
    runDataQualityAudits: safeResolve('runDataQualityAudits'),
    updateDataQualityBadge: safeResolve('updateDataQualityBadge'),
    fixSubtypeDataQuality: safeResolve('fixSubtypeDataQuality'),
    ensureIngredientGroups: safeResolve('ensureIngredientGroups'),
    ensureIngredientFamilies: safeResolve('ensureIngredientFamilies'),
    hasUsableIngredientNutrition: safeResolve('hasUsableIngredientNutrition'),
    getGroupIngredientFamily: safeResolve('getGroupIngredientFamily'),
    resolveProductForIngredient: safeResolve('resolveProductForIngredient'),
    resolveProductForIngredientWithContext: safeResolve('resolveProductForIngredientWithContext'),
    getGroupProducts: safeResolve('getGroupProducts'),
    getFamilyGroups: safeResolve('getFamilyGroups'),
    getGroupHierarchyText: safeResolve('getGroupHierarchyText'),
    needsItemWeightForQtyIngredient: safeResolve('needsItemWeightForQtyIngredient'),
    getIngredientMappingWarning: safeResolve('getIngredientMappingWarning'),
    round1: safeResolve('round1'),
    normaliseAliasText: safeResolve('normaliseAliasText'),
    inferIngredientFamilyFromText: safeResolve('inferIngredientFamilyFromText'),
    getIngredientById: safeResolve('getIngredientById'),
    getProductById: safeResolve('getProductById'),
    getEffectiveProductPrice: safeResolve('getEffectiveProductPrice'),
    calculateIngredientCost: safeResolve('calculateIngredientCost')
  });

  // Assign the global properties only if they aren't already defined as different functions
  const assignGlobal = (name, fallback) => {
    const existing = window[name];
    if (!existing || existing === bridgeFunctions[name]) {
      window[name] = fallback;
    }
  };

  assignGlobal('resolveProductForIngredient', safeResolve('resolveProductForIngredient', (...args) => (window.PlatePlanIngredients?.resolveProductForIngredient || window.PlatePlanNutrition?.resolveProductForIngredient || window.resolveProductForIngredient || (() => ({ product: null, group: null, productId: null, groupId: null })))(...args)));
  assignGlobal('resolveProductForIngredientWithContext', safeResolve('resolveProductForIngredientWithContext', (...args) => (window.PlatePlanIngredients?.resolveProductForIngredientWithContext || window.resolveProductForIngredientWithContext || window.resolveProductForIngredient || (() => ({ product: null, group: null, productId: null, groupId: null })))(...args)));
  assignGlobal('getGroupProducts', safeResolve('getGroupProducts', (...args) => (window.PlatePlanIngredients?.getGroupProducts || window.getGroupProducts || (() => []))(...args)));
  assignGlobal('getFamilyGroups', safeResolve('getFamilyGroups', (...args) => (window.PlatePlanIngredients?.getFamilyGroups || window.getFamilyGroups || (() => []))(...args)));
  assignGlobal('getGroupHierarchyText', safeResolve('getGroupHierarchyText', (...args) => (window.PlatePlanIngredients?.getGroupHierarchyText || window.getGroupHierarchyText || (g => g?.name || ''))(...args)));
  assignGlobal('needsItemWeightForQtyIngredient', safeResolve('needsItemWeightForQtyIngredient', (...args) => (window.PlatePlanIngredients?.needsItemWeightForQtyIngredient || window.needsItemWeightForQtyIngredient || (() => false))(...args)));
  assignGlobal('getIngredientMappingWarning', safeResolve('getIngredientMappingWarning', (...args) => (window.PlatePlanIngredients?.getIngredientMappingWarning || window.getIngredientMappingWarning || (() => null))(...args)));
  assignGlobal('round1', safeResolve('round1', (...args) => (window.PlatePlanIngredients?.round1 || window.round1 || (v => Math.round((+v || 0) * 10) / 10))(...args)));
  assignGlobal('normaliseAliasText', safeResolve('normaliseAliasText', (...args) => (window.PlatePlanIngredients?.normaliseAliasText || window.normaliseAliasText || (t => String(t || '').trim()))(...args)));
  assignGlobal('inferIngredientFamilyFromText', safeResolve('inferIngredientFamilyFromText', (...args) => (window.PlatePlanIngredients?.inferIngredientFamilyFromText || window.inferIngredientFamilyFromText || (t => String(t || '').trim()))(...args)));
  assignGlobal('getIngredientById', safeResolve('getIngredientById', (...args) => (window.PlatePlanIngredients?.getIngredientById || window.getIngredientById || (() => null))(...args)));
  assignGlobal('getProductById', safeResolve('getProductById', (...args) => (window.PlatePlanIngredients?.getProductById || window.getProductById || (() => null))(...args)));
  assignGlobal('getEffectiveProductPrice', safeResolve('getEffectiveProductPrice', (...args) => (window.PlatePlanIngredients?.getEffectiveProductPrice || window.getEffectiveProductPrice || (() => 0))(...args)));
  assignGlobal('calculateIngredientCost', safeResolve('calculateIngredientCost', (...args) => (window.PlatePlanIngredients?.calculateIngredientCost || window.calculateIngredientCost || (() => 0))(...args)));
  assignGlobal('getGroupIngredientFamily', safeResolve('getGroupIngredientFamily', (...args) => (window.PlatePlanNutrition?.getGroupIngredientFamily || window.PlatePlanModals?.getGroupIngredientFamily || window.getGroupIngredientFamily || (() => null))(...args)));
  assignGlobal('hasUsableIngredientNutrition', safeResolve('hasUsableIngredientNutrition', (...args) => (window.PlatePlanNutrition?.hasUsableIngredientNutrition || hasUsableIngredientNutrition || (() => false))(...args)));
  assignGlobal('ensureIngredientGroups', safeResolve('ensureIngredientGroups', (...args) => (window.PlatePlanState?.ensureIngredientGroups || window.PlatePlanNutrition?.ensureIngredientGroups || (() => []))(...args)));
  assignGlobal('ensureIngredientFamilies', safeResolve('ensureIngredientFamilies', (...args) => (window.PlatePlanState?.ensureIngredientFamilies || window.PlatePlanNutrition?.ensureIngredientFamilies || (() => []))(...args)));
  assignGlobal('renderAll', bridgeFunctions['renderAll']);
  assignGlobal('saveIngredient', safeResolve('saveIngredient', (...args) => (window.PlatePlanIngredientBank?.saveIngredient || (() => {}))(...args)));
  assignGlobal('addIngredient', safeResolve('addIngredient', (...args) => (window.PlatePlanIngredientBank?.addIngredient || (() => {}))(...args)));
  assignGlobal('deleteIngredient', safeResolve('deleteIngredient', (...args) => (window.PlatePlanIngredientBank?.deleteIngredient || (() => {}))(...args)));
  assignGlobal('saveManualIng', safeResolve('saveManualIng', (...args) => (window.PlatePlanIngredientBank?.saveManualIng || (() => {}))(...args)));
  assignGlobal('deleteIng', safeResolve('deleteIng', (...args) => (window.PlatePlanIngredientBank?.deleteIng || (() => {}))(...args)));

  assignGlobal('openTescoModal', safeResolve('openTescoModal', (...args) => (window.PlatePlanRecipeEditor?.openTescoModal || (() => {}))(...args)));
  assignGlobal('showTescoSearchModal', safeResolve('showTescoSearchModal', (...args) => (window.PlatePlanRecipeEditor?.showTescoSearchModal || (() => {}))(...args)));
  assignGlobal('openAddProductModal', safeResolve('openAddProductModal', (...args) => (window.PlatePlanRecipeEditor?.openAddProductModal || (() => {}))(...args)));
  assignGlobal('openProductPicker', safeResolve('openProductPicker', (...args) => (window.PlatePlanRecipeEditor?.openProductPicker || (() => {}))(...args)));
  assignGlobal('showTescoImport', safeResolve('showTescoImport', (...args) => (window.PlatePlanIngredientBank?.showTescoImport || (() => {}))(...args)));
  assignGlobal('closeTescoModal', safeResolve('closeTescoModal', (...args) => (window.PlatePlanIngredientBank?.closeTescoModal || (() => {}))(...args)));
  assignGlobal('openUnifiedMappingModal', safeResolve('openUnifiedMappingModal', (...args) => (window.PlatePlanRecipeEditor?.openUnifiedMappingModal || (() => {}))(...args)));
  assignGlobal('closeUnifiedMappingModal', safeResolve('closeUnifiedMappingModal', (...args) => (window.PlatePlanRecipeEditor?.closeUnifiedMappingModal || (() => {}))(...args)));
  assignGlobal('openTescoImportFromSubst', safeResolve('openTescoImportFromSubst', (...args) => (window.PlatePlanIngredientBank?.openTescoImportFromSubst || (() => {}))(...args)));
  assignGlobal('closeSubstituteModal', safeResolve('closeSubstituteModal', (...args) => (window.PlatePlanShoppingList?.closeSubstituteModal || (() => {}))(...args)));
  assignGlobal('confirmSubstitute', safeResolve('confirmSubstitute', (...args) => (window.PlatePlanShoppingList?.confirmSubstitute || (() => {}))(...args)));
  assignGlobal('extractTescoProduct', safeResolve('extractTescoProduct', (...args) => (window.PlatePlanIngredientBank?.extractTescoProduct || (() => {}))(...args)));
  assignGlobal('saveTescoIngredient', safeResolve('saveTescoIngredient', (...args) => (window.PlatePlanIngredientBank?.saveTescoIngredient || (() => {}))(...args)));

  window.dispatchEvent(new CustomEvent('plateplan:legacy-ready', { detail: { version: window.PLATEPLAN_APP_VERSION || '3.3.7-mod' } }));
})();
