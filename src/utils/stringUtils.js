/**
 * src/utils/stringUtils.js
 * Pure utility functions for string manipulation and formatting.
 */

/**
 * Converts a string to Title Case.
 * Handles entirely upper-case strings correctly.
 * Example: "FIVE-MINUTE NOODLES" -> "Five-Minute Noodles"
 * @param {string} str 
 * @returns {string}
 */
export function toTitleCase(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
}
