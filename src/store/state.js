/**
 * src/store/state.js
 * Centralized application state and event handling.
 */

import { state, getState } from './coreState.js';
export { state, getState };

/**
 * Dispatch a custom event on the document in a safe microtask.
 */
export function dispatchStateEvent(eventName, detail) {
  if (typeof document !== 'undefined') {
    Promise.resolve().then(() => {
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
    });
  }
}

/**
 * Subscribe to state changes on a specific domain or globally.
 */
export function subscribe(domainOrCallback, maybeCallback) {
  if (typeof document === 'undefined') return () => {};
  if (typeof domainOrCallback === 'function') {
    const listener = domainOrCallback;
    const handler = (e) => listener(state, e.detail);
    document.addEventListener('plateplan:state:patch', handler);
    return () => {
      document.removeEventListener('plateplan:state:patch', handler);
    };
  }
  const domain = domainOrCallback;
  const callback = maybeCallback;
  if (typeof callback !== 'function') return () => {};
  const eventName = `plateplan:state:${domain}`;
  const handler = (e) => callback(e.detail);
  document.addEventListener(eventName, handler);
  return () => {
    document.removeEventListener(eventName, handler);
  };
}

export function updateState(patch) {
  if (!patch || typeof patch !== 'object') return;
  Object.assign(state, patch);
}

