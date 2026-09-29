/**
 * src/utils/safeJson.js (v3.8.3)
 * Bulletproof circular-safe JSON serialization and deep cloning.
 * Handles circular references, DOM nodes, Window/Event instances,
 * and minified library constructors (e.g. Firebase Firestore 'un', 'P').
 */

// Install circular-safe fallback on native JSON.stringify to globally prevent TypeError exceptions
if (typeof JSON !== 'undefined' && JSON.stringify && !JSON.stringify._isPlatePlanGuarded) {
  const _origStringify = JSON.stringify;
  const guardedStringify = function(value, replacer, space) {
    try {
      return _origStringify(value, replacer, space);
    } catch (err) {
      if (err instanceof TypeError && /circular|cyclic/i.test(err.message)) {
        const seen = new WeakSet();
        const safeReplacer = (k, v) => {
          let current = typeof replacer === 'function' ? replacer(k, v) : v;
          if (typeof current === 'object' && current !== null) {
            if (k === 'src' || k === 'target' || k === 'view' || k === '_delegate' || k === 'firestore' || k === 'auth' || k === 'i') {
              if (seen.has(current)) return undefined;
            }
            if (current.constructor && (current.constructor.name === 'un' || current.constructor.name === 'P')) return undefined;
            if (seen.has(current)) return undefined;
            seen.add(current);
          }
          return current;
        };
        try {
          return _origStringify(value, safeReplacer, space);
        } catch (_fallbackErr) {
          return Array.isArray(value) ? '[]' : '{}';
        }
      }
      throw err;
    }
  };
  guardedStringify._isPlatePlanGuarded = true;
  JSON.stringify = guardedStringify;
}

export function safeJsonStringify(value, space = null, fallback = '{}') {
  if (value === undefined || value === null) {
    return space !== null && space !== undefined ? 'null' : fallback;
  }
  try {
    const seen = new WeakSet();
    const replacer = (key, val) => {
      if (typeof val === 'number') return isNaN(val) || !isFinite(val) ? null : val;
      if (val === undefined) return undefined;
      if (typeof val === 'function' || typeof val === 'symbol') return undefined;
      if (typeof BigInt !== 'undefined' && typeof val === 'bigint') return String(val);
      if (typeof Node !== 'undefined' && (val instanceof Node || val instanceof Window)) return undefined;
      if (typeof Event !== 'undefined' && val instanceof Event) return undefined;
      if (typeof val === 'object' && val !== null) {
        if (key === 'src' || key === 'target' || key === 'view' || key === '_delegate' || key === 'firestore' || key === 'auth' || key === 'i') {
          if (seen.has(val)) return undefined;
        }
        if (val.constructor && (
          val.constructor.name === 'un' ||
          val.constructor.name === 'P' ||
          val.constructor.name === 'HTMLImageElement' ||
          val.constructor.name === 'HTMLCanvasElement' ||
          val.constructor.name === 'SyntheticBaseEvent'
        )) {
          return undefined;
        }
        if ('nodeType' in val || 'ownerDocument' in val) return undefined;
        if (seen.has(val)) return undefined;
        seen.add(val);
      }
      return val;
    };
    const result = space !== null && space !== undefined
      ? JSON.stringify(value, replacer, space)
      : JSON.stringify(value, replacer);
    return result !== undefined ? result : fallback;
  } catch (_e) {
    return fallback;
  }
}

export function safeClone(value) {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  try {
    const serialized = safeJsonStringify(value, null, 'null');
    return serialized === 'null' ? value : JSON.parse(serialized);
  } catch (_e) {
    if (Array.isArray(value)) return [...value];
    return { ...value };
  }
}

// Attach globally for universal script interop
if (typeof window !== 'undefined') {
  window.safeJsonStringify = safeJsonStringify;
  window.clonePlatePlanValue = safeClone;
}

