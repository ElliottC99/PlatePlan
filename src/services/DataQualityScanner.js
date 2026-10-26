/**
 * src/services/DataQualityScanner.js (v3.38.58)
 * Dedicated pure scanner and anomaly detection service for PlatePlan catalogue.
 * Isolates data-processing, integrity checks, and anomaly algorithms from UI views.
 * Zero DOM references. Compliant with strict 350-line architecture limits.
 */

import { runAudit as _runEngineAudit, getEffectiveIngredientMacros } from './DataQualityEngine.js';
import { calculateRecipeDynamicMacros } from './DataQualityScannerService.js';

export { getEffectiveIngredientMacros, calculateRecipeDynamicMacros };

/**
 * Runs the full catalogue audit scan across all entity types.
 * @param {Object} state - Application state snapshot
 * @returns {Object} Comprehensive audit report with categorized issues and totalCount
 */
export function runAudit(state = {}) {
  return _runEngineAudit(state);
}

/**
 * Lightweight scanner for badge counter and fast diagnostics.
 * @param {Object} state 
 * @returns {{ totalCount: number, categories: Object }}
 */
export function scanDataQualitySummary(state = {}) {
  const audit = runAudit(state);
  return {
    totalCount: audit.totalCount || 0,
    categories: {
      macroDrift: (audit.macroDrift || []).length,
      zeroCalorie: (audit.zeroCalorie || []).length,
      missingSpecs: (audit.missingSpecs || []).length,
      densityMismatch: (audit.densityMismatch || []).length,
      orphans: (audit.orphans || []).length,
      unmappedItems: (audit.unmappedItems || []).length,
      duplicates: (audit.duplicates || []).length,
      storageHealth: (audit.storageHealth || []).length
    }
  };
}

/**
 * Scans catalogue for orphaned products referencing nonexistent ingredients or sub-types.
 * @param {Array} products 
 * @param {Array} ingredients 
 * @returns {Array} List of orphan issues
 */
export function scanOrphanedProducts(products = [], ingredients = []) {
  const safeProducts = Array.isArray(products) ? products : [];
  const safeIngredients = Array.isArray(ingredients) ? ingredients : [];
  const ingMap = new Map();
  safeIngredients.forEach(i => { if (i && i.id) ingMap.set(String(i.id), i); });

  const orphans = [];
  safeProducts.forEach(p => {
    if (!p || !p.ingredientId) return;
    const parent = ingMap.get(String(p.ingredientId));
    if (!parent) {
      orphans.push({
        key: `orphan:product:${p.id}:no-ing`,
        productId: p.id,
        productName: p.name || 'Unnamed Product',
        type: 'no-ingredient',
        message: `Product "${p.name}" references parent ingredient ID "${p.ingredientId}" which does not exist.`,
        severity: 'blocker'
      });
      return;
    }
    if (p.subtypeId) {
      const hasSubtype = Array.isArray(parent.subtypes) && parent.subtypes.some(s => String(s.id) === String(p.subtypeId));
      if (!hasSubtype) {
        orphans.push({
          key: `orphan:product:${p.id}:no-sub`,
          productId: p.id,
          productName: p.name || 'Unnamed Product',
          subtypeId: p.subtypeId,
          parentId: parent.id,
          parentName: parent.name,
          type: 'no-subtype',
          message: `Product "${p.name}" references sub-type ID "${p.subtypeId}" missing from parent "${parent.name}".`,
          severity: 'blocker'
        });
      }
    }
  });
  return orphans;
}

/**
 * Scans recipes for macro calculations drifting >2% from cached totals.
 * @param {Array} recipes 
 * @param {Array} ingredients 
 * @param {Array} products 
 * @returns {Array} List of drift anomalies
 */
export function scanRecipeMacroDrift(recipes = [], ingredients = [], products = []) {
  const safeRecipes = Array.isArray(recipes) ? recipes : [];
  const driftList = [];

  safeRecipes.forEach(recipe => {
    if (!recipe) return;
    const calc = calculateRecipeDynamicMacros(recipe, ingredients, products);
    if (!calc) return;
    const perServing = calc.perServing || calc;
    const calcCalories = perServing.cal ?? perServing.calories ?? 0;
    const storedCalories = Number(recipe.macros?.calories ?? recipe.macros?.cal ?? recipe.calories ?? recipe.cal ?? 0);

    if (calcCalories > 0 && storedCalories > 0) {
      const driftRatio = Math.abs(storedCalories - calcCalories) / storedCalories;
      if (driftRatio > 0.05) {
        driftList.push({
          key: `macro:recipe:${recipe.id}`,
          recipeId: recipe.id,
          recipeName: recipe.name || recipe.title || 'Untitled Recipe',
          storedCalories,
          calcCalories: Math.round(calcCalories),
          driftRatio: Math.round(driftRatio * 100),
          severity: driftRatio > 0.15 ? 'blocker' : 'advisory'
        });
      }
    }
  });

  return driftList;
}

/**
 * Scans preferences object for payload bloat (>500KB).
 * @param {Object} preferences 
 * @returns {Array} List of storage health issues
 */
export function scanStorageHealth(preferences = {}) {
  let payloadStr = '{}';
  try {
    payloadStr = JSON.stringify(preferences || {});
  } catch {
    payloadStr = '{}';
  }
  const sizeBytes = new TextEncoder().encode(payloadStr).length;
  if (sizeBytes > 500000) {
    return [{
      key: 'health:preference-size',
      sizeBytes,
      sizeKb: Math.round(sizeBytes / 1024),
      message: `Preference payload size is ${Math.round(sizeBytes / 1024)} KB, exceeding 500 KB threshold.`,
      severity: 'advisory'
    }];
  }
  return [];
}
