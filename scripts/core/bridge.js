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
    normalizeNutrientKey: safeResolve('normalizeNutrientKey'),
    numericNutritionValues: safeResolve('numericNutritionValues'),
    normalizeEnergyKcal: safeResolve('normalizeEnergyKcal'),
    normalizeNutritionPayload: safeResolve('normalizeNutritionPayload'),
    calculateItemNutrition: safeResolve('calculateItemNutrition'),
    calculateRecipeNutrition: safeResolve('calculateRecipeNutrition'),
    calculateFit: safeResolve('calculateFit'),
    getBudgets: safeResolve('getBudgets'),
    calculatePlanDayTotals: safeResolve('calculatePlanDayTotals'),
    computeMacroProgress: safeResolve('computeMacroProgress'),
    resolveProductForIngredientWithContext: safeResolve('resolveProductForIngredientWithContext'),
    getGroupProducts: safeResolve('getGroupProducts'),
    getFamilyGroups: safeResolve('getFamilyGroups'),
    getGroupHierarchyText: safeResolve('getGroupHierarchyText'),
    needsItemWeightForQtyIngredient: safeResolve('needsItemWeightForQtyIngredient'),
    getIngredientMappingWarning: safeResolve('getIngredientMappingWarning'),
    round1: safeResolve('round1'),
    getBankState: safeResolve('getBankState'),
    resetState: safeResolve('resetState'),
    getCloudState: safeResolve('getCloudState'),
    resetCloudState: safeResolve('resetState'),
    getEditorState: safeResolve('getEditorState'),
    resetEditorState: safeResolve('resetState'),
    normaliseAliasText: safeResolve('normaliseAliasText'),
    inferIngredientFamilyFromText: safeResolve('inferIngredientFamilyFromText'),
    getIngredientById: safeResolve('getIngredientById'),
    getProductById: safeResolve('getProductById'),
    getEffectiveProductPrice: safeResolve('getEffectiveProductPrice'),
    calculateIngredientCost: safeResolve('calculateIngredientCost'),
    formatProductPackSummary: safeResolve('formatProductPackSummary'),
    formatPackDisplay: safeResolve('formatPackDisplay'),
    formatIngredientPackVariantLabel: safeResolve('formatIngredientPackVariantLabel'),
    getProductProteinPer100Kcal: safeResolve('getProductProteinPer100Kcal'),
    parsePlainNutritionLabel: safeResolve('parsePlainNutritionLabel'),
    familyKey: safeResolve('familyKey'),
    inferHerbMetadata: safeResolve('inferHerbMetadata'),
    getIngredientGroupSearchText: safeResolve('getIngredientGroupSearchText'),
    isPowderOrSupplementProduct: safeResolve('isPowderOrSupplementProduct'),
    parsePlanLocalDate: safeResolve('parsePlanLocalDate'),
    getPlatePlanLocalToday: safeResolve('getPlatePlanLocalToday'),
    formatPlanLocalDateValue: safeResolve('formatPlanLocalDateValue'),
    buildPlanDayDates: safeResolve('buildPlanDayDates'),
    formatPlanDayLabel: safeResolve('formatPlanDayLabel'),
    getPlanDateRangeLabel: safeResolve('getPlanDateRangeLabel'),
    validatePlanDayDates: safeResolve('validatePlanDayDates'),
    getMealTypeFromSlotKey: safeResolve('getMealTypeFromSlotKey'),
    parsePlanRecipeValue: safeResolve('parsePlanRecipeValue'),
    makePlanSlot: safeResolve('makePlanSlot'),
    getPlanSlotReasonKey: safeResolve('getPlanSlotReasonKey'),
    formatPlanSlotReason: safeResolve('formatPlanSlotReason'),
    getPlanSlotCounterpartKey: safeResolve('getPlanSlotCounterpartKey'),
    planSlotsCanMoveTogether: safeResolve('planSlotsCanMoveTogether'),
    calculatePlanScore: safeResolve('calculatePlanScore'),
    calculatePlanDayScoreFromTotals: safeResolve('calculatePlanDayScoreFromTotals'),
    fmtPlanDelta: safeResolve('fmtPlanDelta'),
    planDeltaColor: safeResolve('planDeltaColor'),
    parsePlannerVisibleMacro: safeResolve('parsePlannerVisibleMacro'),
    mealPrepPeopleKey: safeResolve('mealPrepPeopleKey'),
    mealPrepIdentityKey: safeResolve('mealPrepIdentityKey'),
    mealPrepSuggestionKey: safeResolve('mealPrepSuggestionKey'),
    formatMealPrepDays: safeResolve('formatMealPrepDays'),
    getUseUpAvailableAmount: safeResolve('getUseUpAvailableAmount'),
    getRecipeUseUpCoverage: safeResolve('getRecipeUseUpCoverage'),
    normaliseExclusionList: safeResolve('normaliseExclusionList'),
    recipeMatchesExclusion: safeResolve('recipeMatchesExclusion'),
    recipeAllowedForPerson: safeResolve('recipeAllowedForPerson'),
    getUsedRecipeIdsFromHistory: safeResolve('getUsedRecipeIdsFromHistory'),
    getPlanRecipeIds: safeResolve('getPlanRecipeIds'),
    resetStudioSession: safeResolve('resetStudioSession'),
    resetSwapContext: safeResolve('resetSwapContext'),
    sanitizePayloadForFirestore: safeResolve('sanitizePayloadForFirestore'),
    unwrapAndCleanItem: safeResolve('unwrapAndCleanItem'),
    sanitizePlanForFirestore: safeResolve('sanitizePlanForFirestore'),
    sanitizeRecipeForFirestore: safeResolve('sanitizeRecipeForFirestore'),
    sanitizeIngredientForFirestore: safeResolve('sanitizeIngredientForFirestore'),
    cleanObject: safeResolve('cleanObject'),
    computePayloadSignature: safeResolve('computePayloadSignature'),
    capturePlatePlanEditBaseline: safeResolve('capturePlatePlanEditBaseline'),
    getPlatePlanDeviceId: safeResolve('getPlatePlanDeviceId'),
    clearLocks: safeResolve('clearLocks'),
    getSyncDiagnostics: safeResolve('getSyncDiagnostics'),
    applyScaleToRecipeDefinition: safeResolve('applyScaleToRecipeDefinition'),
    renderProteinEfficiencyAnalysisSection: safeResolve('renderProteinEfficiencyAnalysisSection'),
    normaliseRecipeIngredientSection: safeResolve('normaliseRecipeIngredientSection'),
    orderRecipeIngredientsBySection: safeResolve('orderRecipeIngredientsBySection'),
    uniqueSectionNames: safeResolve('uniqueSectionNames'),
    normaliseReviewCompareText: safeResolve('normaliseReviewCompareText'),
    comparableReviewIngredients: safeResolve('comparableReviewIngredients'),
    comparableReviewSteps: safeResolve('comparableReviewSteps'),
    applyReviewContextToIngredients: safeResolve('applyReviewContextToIngredients'),
    safeFileName: safeResolve('safeFileName'),
    getPlatePlanBackupPayload: safeResolve('getPlatePlanBackupPayload'),
    validatePlatePlanImport: safeResolve('validatePlatePlanImport'),
    renderBakedStateDifferenceSummary: safeResolve('renderBakedStateDifferenceSummary'),
    dataQualityFingerprint: safeResolve('dataQualityFingerprint'),
    createDataQualityIssue: safeResolve('createDataQualityIssue'),
    resetRecipeEditorState: safeResolve('resetRecipeEditorState', (...args) => (window.PlatePlanRecipeEditor?.resetState || (() => {}))(...args)),
    getRecipeEditorState: safeResolve('getRecipeEditorState', (...args) => (window.PlatePlanRecipeEditor?.getEditorState || (() => ({})))(...args)),
    resetSettingsBackupState: safeResolve('resetSettingsBackupState', (...args) => (window.PlatePlanSettingsBackup?.resetState || (() => {}))(...args)),
    getSettingsBackupState: safeResolve('getSettingsBackupState', (...args) => (window.PlatePlanSettingsBackup?.getSettingsState || (() => ({})))(...args)),
    resetNutritionState: safeResolve('resetNutritionState', (...args) => (window.PlatePlanNutrition?.resetState || (() => {}))(...args)),
    getNutritionState: safeResolve('getNutritionState', (...args) => (window.PlatePlanNutrition?.getNutritionState || (() => ({})))(...args)),
    resetShoppingState: safeResolve('resetShoppingState', (...args) => (window.PlatePlanShoppingList?.resetState || (() => {}))(...args)),
    getShoppingState: safeResolve('getShoppingState', (...args) => (window.PlatePlanShoppingList?.getShoppingState || (() => ({})))(...args)),
    getPackVariants: safeResolve('getPackVariants'),
    getOptimalPurchase: safeResolve('getOptimalPurchase'),
    calculateShoppingPriceFromAggregates: safeResolve('calculateShoppingPriceFromAggregates'),
    encodeShopTarget: safeResolve('encodeShopTarget'),
    decodeShopTarget: safeResolve('decodeShopTarget'),
    formatShoppingBatchAmount: safeResolve('formatShoppingBatchAmount'),
    getShoppingLineStateKey: safeResolve('getShoppingLineStateKey'),
    groupShoppingAllocationsByMeal: safeResolve('groupShoppingAllocationsByMeal'),
    readableHerbQuantity: safeResolve('readableHerbQuantity'),
    buildHerbConversion: safeResolve('buildHerbConversion'),
    formatTodayDateLabel: safeResolve('formatTodayDateLabel'),
    formatStockIngredientText: safeResolve('formatStockIngredientText'),
    ingRaw: safeResolve('ingRaw'),
    hasVariantFavoritingInitialized: safeResolve('hasVariantFavoritingInitialized'),
    ensureVariantFavoritingPrefs: safeResolve('ensureVariantFavoritingPrefs'),
    isRecipeVariantFavourite: safeResolve('isRecipeVariantFavourite'),
    isRecipeVariantFavorite: safeResolve('isRecipeVariantFavorite'),
    calculateVaultTargetMacros: safeResolve('calculateVaultTargetMacros'),
    resetVaultState: safeResolve('resetVaultState', (...args) => (window.PlatePlanRecipes?.resetState || (() => {}))(...args)),
    getVaultState: safeResolve('getVaultState', (...args) => (window.PlatePlanRecipes?.getRecipesState || (() => ({})))(...args))
  });

  // Assign the global properties only if they aren't already defined as different functions
  const assignGlobal = (name, fallback) => {
    const existing = window[name];
    if (!existing || existing === bridgeFunctions[name]) {
      window[name] = fallback;
    }
  };

  assignGlobal('formatProductPackSummary', safeResolve('formatProductPackSummary', (...args) => (window.PlatePlanIngredients?.formatProductPackSummary || window.formatProductPackSummary || (() => ''))(...args)));
  assignGlobal('formatPackDisplay', safeResolve('formatPackDisplay', (...args) => (window.PlatePlanIngredients?.formatPackDisplay || window.formatPackDisplay || ((s, u = 'g') => `${s}${u}`))(...args)));
  assignGlobal('formatIngredientPackVariantLabel', safeResolve('formatIngredientPackVariantLabel', (...args) => (window.PlatePlanIngredients?.formatIngredientPackVariantLabel || window.formatIngredientPackVariantLabel || (() => ''))(...args)));
  assignGlobal('getProductProteinPer100Kcal', safeResolve('getProductProteinPer100Kcal', (...args) => (window.PlatePlanNutrition?.getProductProteinPer100Kcal || window.getProductProteinPer100Kcal || (() => 0))(...args)));
  assignGlobal('parsePlainNutritionLabel', safeResolve('parsePlainNutritionLabel', (...args) => (window.PlatePlanNutrition?.parsePlainNutritionLabel || window.parsePlainNutritionLabel || (async () => ({})))(...args)));
  assignGlobal('familyKey', safeResolve('familyKey', (...args) => (window.PlatePlanIngredients?.familyKey || window.familyKey || (s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')))(...args)));
  assignGlobal('inferHerbMetadata', safeResolve('inferHerbMetadata', (...args) => (window.PlatePlanIngredients?.inferHerbMetadata || window.inferHerbMetadata || (() => ({ herbForm: '', herbKey: '' })))(...args)));
  assignGlobal('getIngredientGroupSearchText', safeResolve('getIngredientGroupSearchText', (...args) => (window.PlatePlanIngredients?.getIngredientGroupSearchText || window.getIngredientGroupSearchText || (() => ''))(...args)));
  assignGlobal('isPowderOrSupplementProduct', safeResolve('isPowderOrSupplementProduct', (...args) => (window.PlatePlanIngredients?.isPowderOrSupplementProduct || window.isPowderOrSupplementProduct || (() => false))(...args)));

  assignGlobal('parsePlanLocalDate', safeResolve('parsePlanLocalDate', (value) => {
    if (window.PlatePlanPlanner?.parsePlanLocalDate) return window.PlatePlanPlanner.parsePlanLocalDate(value);
    if (!value || typeof value !== 'string') return null;
    const parts = value.split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
    const [y, m, d] = parts;
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
  }));

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
  assignGlobal('resetModalContext', safeResolve('resetModalContext', (...args) => (window.PlatePlanIngredientBank?.resetModalContext || (() => {}))(...args)));
  assignGlobal('getPlatePlanBackupPayload', safeResolve('getPlatePlanBackupPayload', (...args) => (window.PlatePlanSettingsBackup?.getPlatePlanBackupPayload || window.getPlatePlanBackupPayload || (() => ({})))(...args)));
  assignGlobal('validatePlatePlanImport', safeResolve('validatePlatePlanImport', (...args) => (window.PlatePlanSettingsBackup?.validatePlatePlanImport || window.validatePlatePlanImport || (() => ({ valid: false, errors: [] })))(...args)));
  assignGlobal('renderBakedStateDifferenceSummary', safeResolve('renderBakedStateDifferenceSummary', (...args) => (window.PlatePlanSettingsBackup?.renderBakedStateDifferenceSummary || window.renderBakedStateDifferenceSummary || (() => ''))(...args)));
  assignGlobal('dataQualityFingerprint', safeResolve('dataQualityFingerprint', (...args) => (window.PlatePlanSettingsBackup?.dataQualityFingerprint || window.dataQualityFingerprint || (() => ''))(...args)));
  assignGlobal('createDataQualityIssue', safeResolve('createDataQualityIssue', (...args) => (window.PlatePlanSettingsBackup?.createDataQualityIssue || window.createDataQualityIssue || (() => ({})))(...args)));
  assignGlobal('resetSettingsBackupState', safeResolve('resetSettingsBackupState', (...args) => (window.PlatePlanSettingsBackup?.resetState || (() => {}))(...args)));
  assignGlobal('getSettingsBackupState', safeResolve('getSettingsBackupState', (...args) => (window.PlatePlanSettingsBackup?.getSettingsState || (() => ({})))(...args)));
  assignGlobal('formatTodayDateLabel', safeResolve('formatTodayDateLabel', (...args) => (window.PlatePlanToday?.formatTodayDateLabel || window.formatTodayDateLabel || (d => d))(...args)));
  assignGlobal('formatStockIngredientText', safeResolve('formatStockIngredientText', (...args) => (window.PlatePlanToday?.formatStockIngredientText || window.formatStockIngredientText || (() => ''))(...args)));
  assignGlobal('ingRaw', safeResolve('ingRaw', (...args) => (window.PlatePlanToday?.ingRaw || window.ingRaw || (i => String(i || '')))(...args)));
  assignGlobal('hasVariantFavoritingInitialized', safeResolve('hasVariantFavoritingInitialized', (...args) => (window.PlatePlanRecipes?.hasVariantFavoritingInitialized || (() => false))(...args)));
  assignGlobal('ensureVariantFavoritingPrefs', safeResolve('ensureVariantFavoritingPrefs', (...args) => (window.PlatePlanRecipes?.ensureVariantFavoritingPrefs || (() => []))(...args)));
  assignGlobal('isRecipeVariantFavourite', safeResolve('isRecipeVariantFavourite', (...args) => (window.PlatePlanRecipes?.isRecipeVariantFavourite || (() => false))(...args)));
  assignGlobal('isRecipeVariantFavorite', safeResolve('isRecipeVariantFavorite', (...args) => (window.PlatePlanRecipes?.isRecipeVariantFavorite || (() => false))(...args)));
  assignGlobal('calculateVaultTargetMacros', safeResolve('calculateVaultTargetMacros', (...args) => (window.PlatePlanRecipes?.calculateVaultTargetMacros || (() => ({})))(...args)));
  assignGlobal('resetVaultState', safeResolve('resetVaultState', (...args) => (window.PlatePlanRecipes?.resetState || (() => {}))(...args)));
  assignGlobal('getVaultState', safeResolve('getVaultState', (...args) => (window.PlatePlanRecipes?.getRecipesState || (() => ({})))(...args)));
  assignGlobal('resetStudioSession', safeResolve('resetStudioSession', (...args) => (window.PlatePlanPlanner?.resetStudioSession || window.resetStudioSession || (() => {}))(...args)));

  window.dispatchEvent(new CustomEvent('plateplan:legacy-ready', { detail: { version: window.PLATEPLAN_APP_VERSION || '3.3.7-mod' } }));
})();
