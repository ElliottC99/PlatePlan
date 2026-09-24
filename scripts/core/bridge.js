// == COMPATIBILITY BRIDGE ==
globalThis.PlatePlanLegacy = Object.freeze({
  version: window.PLATEPLAN_APP_VERSION || '3.3.7-mod',
  expectedCache: window.PLATEPLAN_EXPECTED_CACHE || 'plateplan-shell-v94',
  getState: () => (typeof state !== 'undefined' ? state : (window.state || {})),
  saveState: (...args) => (window.saveState || window.PlatePlanCloud?.saveState || (typeof saveState !== 'undefined' ? saveState : () => {}))(...args),
  getRecipe: (...args) => (window.getRecipe || (typeof getRecipe !== 'undefined' ? getRecipe : () => null))(...args),
  getProduct: (...args) => (window.getProduct || (typeof getProduct !== 'undefined' ? getProduct : () => null))(...args),
  calculateRecipeDisplayNutrition: (...args) => (window.calculateRecipeDisplayNutrition || window.PlatePlanNutrition?.calculateRecipeDisplayNutrition || (typeof calculateRecipeDisplayNutrition !== 'undefined' ? calculateRecipeDisplayNutrition : () => {}))(...args),
  getPlanContextForInstance: (...args) => (window.getPlanContextForInstance || window.PlatePlanPlanner?.getPlanContextForInstance || (typeof getPlanContextForInstance !== 'undefined' ? getPlanContextForInstance : () => {}))(...args),
  refreshPlatePlanDerivedState: (...args) => (window.refreshPlatePlanDerivedState || (typeof refreshPlatePlanDerivedState !== 'undefined' ? refreshPlatePlanDerivedState : () => {}))(...args),
  renderLegacyView: (...args) => (window.renderPlatePlanLegacyView || (typeof renderPlatePlanLegacyView !== 'undefined' ? renderPlatePlanLegacyView : () => {}))(...args),
  renderers: typeof platePlanFeatureRenderers !== 'undefined' ? platePlanFeatureRenderers : (window.platePlanFeatureRenderers || {}),
  openSearchResult: (...args) => (window.openPlatePlanSearchResult || (typeof openPlatePlanSearchResult !== 'undefined' ? openPlatePlanSearchResult : () => {}))(...args),
  runDelegatedAction: (...args) => (window.runPlatePlanDelegatedAction || (typeof runPlatePlanDelegatedAction !== 'undefined' ? runPlatePlanDelegatedAction : () => {}))(...args),
  showInfo: (...args) => (window.openAppInfoModal || window.PlatePlanIngredientBank?.openAppInfoModal || (typeof openAppInfoModal !== 'undefined' ? openAppInfoModal : () => {}))(...args),
  closeInfo: (...args) => (window.closeAppConfirmModal || (typeof closeAppConfirmModal !== 'undefined' ? closeAppConfirmModal : () => {}))(...args),
  showOverlay: (...args) => (window.showOverlay || (typeof showOverlay !== 'undefined' ? showOverlay : () => {}))(...args),
  hideOverlay: (...args) => (window.hideOverlay || (typeof hideOverlay !== 'undefined' ? hideOverlay : () => {}))(...args),
  showToast: (...args) => (window.showPlatePlanToast || (typeof showPlatePlanToast !== 'undefined' ? showPlatePlanToast : () => {}))(...args),
  createRecoveryPoint: (...args) => (window.createRecoveryPoint || (typeof createRecoveryPoint !== 'undefined' ? createRecoveryPoint : () => {}))(...args),
  renderRecoveryPanel: (...args) => (window.renderRecoveryPanel || (typeof renderRecoveryPanel !== 'undefined' ? renderRecoveryPanel : () => {}))(...args),
  initCloudSync: (...args) => (window.initPlatePlanCloudSync || window.PlatePlanCloud?.initPlatePlanCloudSync || (typeof initPlatePlanCloudSync !== 'undefined' ? initPlatePlanCloudSync : () => {}))(...args),
  signOut: (...args) => (window.signOutPlatePlan || window.PlatePlanCloud?.signOutPlatePlan || (typeof signOutPlatePlan !== 'undefined' ? signOutPlatePlan : () => {}))(...args),
  renderAll: (...args) => (window.renderAll || (typeof renderAll !== 'undefined' ? renderAll : () => {}))(...args),
  saveIngredient: (...args) => (window.saveIngredient || window.PlatePlanIngredientBank?.saveIngredient || (typeof saveIngredient !== 'undefined' ? saveIngredient : () => {}))(...args),
  addIngredient: (...args) => (window.addIngredient || window.PlatePlanIngredientBank?.addIngredient || (typeof addIngredient !== 'undefined' ? addIngredient : () => {}))(...args),
  deleteIngredient: (...args) => (window.deleteIngredient || window.PlatePlanIngredientBank?.deleteIngredient || (typeof deleteIngredient !== 'undefined' ? deleteIngredient : () => {}))(...args),
  saveManualIng: (...args) => (window.saveManualIng || window.PlatePlanIngredientBank?.saveManualIng || (typeof saveManualIng !== 'undefined' ? saveManualIng : () => {}))(...args),
  deleteIng: (...args) => (window.deleteIng || (typeof deleteIng !== 'undefined' ? deleteIng : () => {}))(...args),
  abortBatchImport: (...args) => (window.abortBatchImport || (typeof abortBatchImport !== 'undefined' ? abortBatchImport : () => {}))(...args),
  skipBatchImportRecipe: (...args) => (window.skipBatchImportRecipe || (typeof skipBatchImportRecipe !== 'undefined' ? skipBatchImportRecipe : () => {}))(...args),
  confirmBatchIdentification: (...args) => (window.confirmBatchIdentification || (typeof confirmBatchIdentification !== 'undefined' ? confirmBatchIdentification : () => {}))(...args),
  loadBatchRecipeIntoStepA: (...args) => (window.loadBatchRecipeIntoStepA || (typeof loadBatchRecipeIntoStepA !== 'undefined' ? loadBatchRecipeIntoStepA : () => {}))(...args),
  openConfirmRecipeIdentificationModal: (...args) => (window.openConfirmRecipeIdentificationModal || (typeof openConfirmRecipeIdentificationModal !== 'undefined' ? openConfirmRecipeIdentificationModal : () => {}))(...args),
  updateBatchUiBanners: (...args) => (window.updateBatchUiBanners || (typeof updateBatchUiBanners !== 'undefined' ? updateBatchUiBanners : () => {}))(...args),
  openTescoModal: (...args) => (window.openTescoModal || window.PlatePlanRecipeEditor?.openTescoModal || (typeof openTescoModal !== 'undefined' ? openTescoModal : () => {}))(...args),
  showTescoSearchModal: (...args) => (window.showTescoSearchModal || window.PlatePlanRecipeEditor?.showTescoSearchModal || (typeof showTescoSearchModal !== 'undefined' ? showTescoSearchModal : () => {}))(...args),
  openAddProductModal: (...args) => (window.openAddProductModal || window.PlatePlanRecipeEditor?.openAddProductModal || (typeof openAddProductModal !== 'undefined' ? openAddProductModal : () => {}))(...args),
  openProductPicker: (...args) => (window.openProductPicker || window.PlatePlanRecipeEditor?.openProductPicker || (typeof openProductPicker !== 'undefined' ? openProductPicker : () => {}))(...args),
  showTescoImport: (...args) => (window.showTescoImport || window.PlatePlanIngredientBank?.showTescoImport || (typeof showTescoImport !== 'undefined' ? showTescoImport : () => {}))(...args),
  closeTescoModal: (...args) => (window.closeTescoModal || window.PlatePlanIngredientBank?.closeTescoModal || (typeof closeTescoModal !== 'undefined' ? closeTescoModal : () => {}))(...args),
  openUnifiedMappingModal: (...args) => (window.openUnifiedMappingModal || window.PlatePlanRecipeEditor?.openUnifiedMappingModal || (typeof openUnifiedMappingModal !== 'undefined' ? openUnifiedMappingModal : () => {}))(...args),
  closeUnifiedMappingModal: (...args) => (window.closeUnifiedMappingModal || window.PlatePlanRecipeEditor?.closeUnifiedMappingModal || (typeof closeUnifiedMappingModal !== 'undefined' ? closeUnifiedMappingModal : () => {}))(...args),
  openTescoImportFromSubst: (...args) => (window.openTescoImportFromSubst || window.PlatePlanIngredientBank?.openTescoImportFromSubst || (typeof openTescoImportFromSubst !== 'undefined' ? openTescoImportFromSubst : () => {}))(...args),
  closeSubstituteModal: (...args) => (window.closeSubstituteModal || window.PlatePlanShoppingList?.closeSubstituteModal || (typeof closeSubstituteModal !== 'undefined' ? closeSubstituteModal : () => {}))(...args),
  confirmSubstitute: (...args) => (window.confirmSubstitute || window.PlatePlanShoppingList?.confirmSubstitute || (typeof confirmSubstitute !== 'undefined' ? confirmSubstitute : () => {}))(...args),
  extractTescoProduct: (...args) => (window.extractTescoProduct || window.PlatePlanIngredientBank?.extractTescoProduct || (typeof extractTescoProduct !== 'undefined' ? extractTescoProduct : () => {}))(...args),
  saveTescoIngredient: (...args) => (window.saveTescoIngredient || window.PlatePlanIngredientBank?.saveTescoIngredient || (typeof saveTescoIngredient !== 'undefined' ? saveTescoIngredient : () => {}))(...args),
  runDataQualityAudits: (...args) => (window.runDataQualityAudits || (typeof runDataQualityAudits !== 'undefined' ? runDataQualityAudits : () => {}))(...args),
  updateDataQualityBadge: (...args) => (window.updateDataQualityBadge || (typeof updateDataQualityBadge !== 'undefined' ? updateDataQualityBadge : () => {}))(...args),
  fixSubtypeDataQuality: (...args) => (window.fixSubtypeDataQuality || (typeof fixSubtypeDataQuality !== 'undefined' ? fixSubtypeDataQuality : () => {}))(...args)
});

window.renderAll = typeof renderAll !== 'undefined' ? renderAll : (window.renderAll || window.PlatePlanLegacy?.renderAll);
window.saveIngredient = typeof saveIngredient !== 'undefined' ? saveIngredient : (window.saveIngredient || window.PlatePlanIngredientBank?.saveIngredient);
window.addIngredient = typeof addIngredient !== 'undefined' ? addIngredient : (window.addIngredient || window.PlatePlanIngredientBank?.addIngredient);
window.deleteIngredient = typeof deleteIngredient !== 'undefined' ? deleteIngredient : (window.deleteIngredient || window.PlatePlanIngredientBank?.deleteIngredient);
window.saveManualIng = typeof saveManualIng !== 'undefined' ? saveManualIng : (window.saveManualIng || window.PlatePlanIngredientBank?.saveManualIng);
window.deleteIng = typeof deleteIng !== 'undefined' ? deleteIng : (window.deleteIng || window.PlatePlanIngredientBank?.deleteIng);
window.abortBatchImport = typeof abortBatchImport !== 'undefined' ? abortBatchImport : window.abortBatchImport;
window.skipBatchImportRecipe = typeof skipBatchImportRecipe !== 'undefined' ? skipBatchImportRecipe : window.skipBatchImportRecipe;
window.confirmBatchIdentification = typeof confirmBatchIdentification !== 'undefined' ? confirmBatchIdentification : window.confirmBatchIdentification;
window.loadBatchRecipeIntoStepA = typeof loadBatchRecipeIntoStepA !== 'undefined' ? loadBatchRecipeIntoStepA : window.loadBatchRecipeIntoStepA;
window.openConfirmRecipeIdentificationModal = typeof openConfirmRecipeIdentificationModal !== 'undefined' ? openConfirmRecipeIdentificationModal : window.openConfirmRecipeIdentificationModal;
window.updateBatchUiBanners = typeof updateBatchUiBanners !== 'undefined' ? updateBatchUiBanners : window.updateBatchUiBanners;
window.openTescoModal = typeof openTescoModal !== 'undefined' ? openTescoModal : (window.openTescoModal || window.PlatePlanRecipeEditor?.openTescoModal);
window.showTescoSearchModal = typeof showTescoSearchModal !== 'undefined' ? showTescoSearchModal : (window.showTescoSearchModal || window.PlatePlanRecipeEditor?.showTescoSearchModal);
window.openAddProductModal = typeof openAddProductModal !== 'undefined' ? openAddProductModal : (window.openAddProductModal || window.PlatePlanRecipeEditor?.openAddProductModal);
window.openProductPicker = typeof openProductPicker !== 'undefined' ? openProductPicker : (window.openProductPicker || window.PlatePlanRecipeEditor?.openProductPicker);
window.showTescoImport = typeof showTescoImport !== 'undefined' ? showTescoImport : (window.showTescoImport || window.PlatePlanIngredientBank?.showTescoImport);
window.closeTescoModal = typeof closeTescoModal !== 'undefined' ? closeTescoModal : (window.closeTescoModal || window.PlatePlanIngredientBank?.closeTescoModal);
window.openUnifiedMappingModal = typeof openUnifiedMappingModal !== 'undefined' ? openUnifiedMappingModal : (window.openUnifiedMappingModal || window.PlatePlanRecipeEditor?.openUnifiedMappingModal);
window.closeUnifiedMappingModal = typeof closeUnifiedMappingModal !== 'undefined' ? closeUnifiedMappingModal : (window.closeUnifiedMappingModal || window.PlatePlanRecipeEditor?.closeUnifiedMappingModal);
window.openTescoImportFromSubst = typeof openTescoImportFromSubst !== 'undefined' ? openTescoImportFromSubst : (window.openTescoImportFromSubst || window.PlatePlanIngredientBank?.openTescoImportFromSubst);
window.closeSubstituteModal = typeof closeSubstituteModal !== 'undefined' ? closeSubstituteModal : (window.closeSubstituteModal || window.PlatePlanShoppingList?.closeSubstituteModal);
window.confirmSubstitute = typeof confirmSubstitute !== 'undefined' ? confirmSubstitute : (window.confirmSubstitute || window.PlatePlanShoppingList?.confirmSubstitute);
window.extractTescoProduct = typeof extractTescoProduct !== 'undefined' ? extractTescoProduct : (window.extractTescoProduct || window.PlatePlanIngredientBank?.extractTescoProduct);
window.saveTescoIngredient = typeof saveTescoIngredient !== 'undefined' ? saveTescoIngredient : (window.saveTescoIngredient || window.PlatePlanIngredientBank?.saveTescoIngredient);
window.runDataQualityAudits = typeof runDataQualityAudits !== 'undefined' ? runDataQualityAudits : window.runDataQualityAudits;
window.updateDataQualityBadge = typeof updateDataQualityBadge !== 'undefined' ? updateDataQualityBadge : window.updateDataQualityBadge;
window.fixSubtypeDataQuality = typeof fixSubtypeDataQuality !== 'undefined' ? fixSubtypeDataQuality : window.fixSubtypeDataQuality;
window.renderVault = typeof renderVault !== 'undefined' ? renderVault : window.renderVault;
window.isRecipeVariantFavourite = typeof isRecipeVariantFavourite !== 'undefined' ? isRecipeVariantFavourite : window.isRecipeVariantFavourite;
window.isRecipeVariantFavorite = typeof isRecipeVariantFavourite !== 'undefined' ? isRecipeVariantFavourite : window.isRecipeVariantFavorite;

window.dispatchEvent(new CustomEvent('plateplan:legacy-ready', { detail: { version: window.PLATEPLAN_APP_VERSION || '3.3.7-mod' } }));
