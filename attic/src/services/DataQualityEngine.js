/**
 * src/services/DataQualityEngine.js
 * Forwarding facade to canonical owner src/services/DataQualityScanner.js
 */
export {
  runAudit,
  getEffectiveIngredientMacros,
  autoRecalibrateRecipeDrift,
  calculateRecipeDynamicMacros,
  getStringSimilarity
} from './DataQualityScanner.js';
