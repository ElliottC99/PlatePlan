/**
 * PlatePlan v3.3.6 - Pure Core Utilities
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim();
}

export function formatCurrency(amount, currency = '£') {
  const num = parseFloat(amount);
  if (isNaN(num)) return currency + '0.00';
  return currency + num.toFixed(2);
}

export function parseDate(dateStr) {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function slugify(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
}

export function safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'function') return undefined;
    if (typeof Element !== 'undefined' && value instanceof Element) return undefined;
    if (typeof Node !== 'undefined' && value instanceof Node) return undefined;
    if (typeof value === 'object') {
      if (seen.has(value)) return undefined;
      seen.add(value);
    }
    return value;
  });
}

