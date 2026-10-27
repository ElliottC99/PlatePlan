/**
 * src/utils/shoppingUtils.js
 * Shopping List aggregation, deterministic key generation, and state helpers.
 * Fully decoupled ES6 utility module with global window registration.
 */

/**
 * Generates a safe, deterministic key for shopping list item aggregation and state tracking.
 * Handles grouped ingredients, bank product identifiers, or raw item strings.
 * 
 * @param {string} [groupId] - Ingredient group ID or category.
 * @param {string} [actualBankId] - Bank item ID or name.
 * @param {string} [raw] - Raw ingredient string descriptor.
 * @returns {string} Normalized deterministic state key.
 */
export function getShoppingLineStateKey(groupId, actualBankId, raw) {
  if (groupId && actualBankId && !raw) {
    return `${groupId}_${actualBankId}`.toLowerCase().replace(/\s+/g, '_');
  }
  if (groupId) {
    return `group_${groupId}`.toLowerCase().replace(/\s+/g, '_');
  }
  if (actualBankId) {
    return `bank_${actualBankId}`.toLowerCase().replace(/\s+/g, '_');
  }
  if (raw) {
    return `raw_${String(raw).toLowerCase().replace(/\s+/g, '_')}`;
  }
  return 'item_unknown';
}

// Ensure global availability on window for legacy scripts and event bridges
if (typeof window !== 'undefined') {
  window.getShoppingLineStateKey = getShoppingLineStateKey;
}
