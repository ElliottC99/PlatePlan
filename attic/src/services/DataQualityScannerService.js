/**
 * src/services/DataQualityScannerService.js
 * Forwarding facade to canonical owner src/services/DataQualityScanner.js
 */
export {
  calculateRecipeDynamicMacros,
  getEffectiveIngredientMacros,
  autoRecalibrateRecipeDrift,
  runAudit as runDataQualityScan,
  runAudit,
  scanDataQualitySummary
} from './DataQualityScanner.js';
