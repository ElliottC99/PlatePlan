/**
 * Validate the stable PlatePlan state shape without changing or migrating it.
 * The checks intentionally accept empty state on a new device.
 * @param {unknown} candidate
 * @returns {{valid:boolean, problems:string[]}}
 */
export function validatePlatePlanState(candidate) {
  const problems = [];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { valid: false, problems: ['State must be an object.'] };
  }
  const state = /** @type {Record<string, unknown>} */ (candidate);
  for (const field of ['recipes', 'ingredients', 'ingredientFamilies', 'ingredientGroups']) {
    if (!Array.isArray(state[field])) problems.push(`${field} must be an array.`);
  }
  if (state.plan != null && (typeof state.plan !== 'object' || Array.isArray(state.plan))) {
    problems.push('plan must be an object.');
  }
  if (state.overrides != null && (typeof state.overrides !== 'object' || Array.isArray(state.overrides))) {
    problems.push('overrides must be an object.');
  }
  return { valid: problems.length === 0, problems };
}

/**
 * Check that the compatibility bridge exposes the calculation and persistence
 * interfaces which must remain universal throughout the migration.
 * @param {Record<string, unknown>} bridge
 */
export function assertAuthoritativeInterfaces(bridge) {
  const required = [
    'getState',
    'saveState',
    'calculateRecipeDisplayNutrition',
    'getPlanContextForInstance',
    'refreshPlatePlanDerivedState',
    'renderLegacyView',
    'runDelegatedAction',
  ];
  const missing = required.filter(name => typeof bridge?.[name] !== 'function');
  if (missing.length) throw new Error(`PlatePlan compatibility bridge is missing: ${missing.join(', ')}`);
}
