/**
 * src/utils/pantryUtils.js (v3.38.60)
 * Pure utility functions for pantry category slugging and naming conventions.
 */

/**
 * Converts a category name to a searchable slug.
 * @param {string} str 
 * @returns {string}
 */
export const slugCategory = (str) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

/**
 * Converts a string to kebab-case for URL or class name usage.
 * @param {string} str 
 * @returns {string}
 */
export const slugifyToKebab = (str) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Standardizes category casing (Title Case).
 * @param {string} str 
 * @returns {string}
 */
export function toCanonicalCategoryName(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().split(/\s+/).map(w => w ? (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : '').join(' ');
}

/**
 * Advanced slugification with basic pluralization normalization.
 * @param {string} str 
 * @returns {string}
 */
export function slugify(str) {
  if (!str || typeof str !== 'string') return '';
  let norm = str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  if (norm.endsWith('oes') && norm.length > 4) norm = norm.slice(0, -2);
  else if (norm.endsWith('s') && !norm.endsWith('ss') && norm.length > 3) norm = norm.slice(0, -1);
  return norm;
}
