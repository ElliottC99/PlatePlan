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
  return str.normalize('NFC').toLowerCase().replace(/[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu, (word) => {
    return word.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('-');
  });
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

export function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}
