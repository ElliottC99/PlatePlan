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

/**
 * Extracts non-empty method steps from one or more recipe/variant objects or step arrays/strings,
 * skipping empty arrays or blank strings so fallback sources are reached.
 * @param {...(object|string|Array)} sources
 * @returns {string[]}
 */
export function normalizeMethodSteps(...sources) {
  for (const src of sources) {
    if (!src) continue;
    const candidates = (typeof src === 'object' && !Array.isArray(src))
      ? [src.methodSteps, src.steps, src.method, src.instructions]
      : [src];
    for (const cand of candidates) {
      if (!cand) continue;
      const list = (Array.isArray(cand) ? cand : String(cand).split('\n'))
        .map(s => (typeof s === 'string' ? s : (s?.instruction || s?.text || s?.step || '')).trim())
        .filter(Boolean);
      if (list.length > 0) return list;
    }
  }
  return [];
}
