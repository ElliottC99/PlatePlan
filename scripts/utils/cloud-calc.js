/**
 * scripts/utils/cloud-calc.js
 * PlatePlan Cloud Sync Calculations, Sanitization, Hashing & Device Identifier Utilities
 */
(function() {
  'use strict';
  window.PlatePlanCloudSync = window.PlatePlanCloudSync || {};

  const SYNC_DEVICE_SK = 'plateplan_v1_device_id';

  function sanitizePayloadForFirestore(data) {
    if (typeof window !== 'undefined' && window.PlatePlanState && typeof window.PlatePlanState.sanitizePayloadForFirestore === 'function') {
      return window.PlatePlanState.sanitizePayloadForFirestore(data);
    }
    if (typeof window !== 'undefined' && typeof window.sanitizePayloadForFirestore === 'function' && window.sanitizePayloadForFirestore !== sanitizePayloadForFirestore) {
      return window.sanitizePayloadForFirestore(data);
    }
    if (data === undefined) return null;
    try {
      return JSON.parse(JSON.stringify(data));
    } catch (e) {
      return data;
    }
  }

  function unwrapAndCleanItem(item) {
    if (typeof window !== 'undefined' && window.PlatePlanState && typeof window.PlatePlanState.unwrapAndCleanItem === 'function') {
      return window.PlatePlanState.unwrapAndCleanItem(item);
    }
    if (typeof window !== 'undefined' && typeof window.unwrapAndCleanItem === 'function' && window.unwrapAndCleanItem !== unwrapAndCleanItem) {
      return window.unwrapAndCleanItem(item);
    }
    return item;
  }

  function sanitizePlanForFirestore(plan) {
    if (typeof window !== 'undefined' && window.PlatePlanState && typeof window.PlatePlanState.sanitizePlanForFirestore === 'function') {
      return window.PlatePlanState.sanitizePlanForFirestore(plan);
    }
    if (typeof window !== 'undefined' && typeof window.sanitizePlanForFirestore === 'function' && window.sanitizePlanForFirestore !== sanitizePlanForFirestore) {
      return window.sanitizePlanForFirestore(plan);
    }
    return sanitizePayloadForFirestore(unwrapAndCleanItem(plan));
  }

  function sanitizeRecipeForFirestore(recipe) {
    if (typeof window !== 'undefined' && window.PlatePlanState && typeof window.PlatePlanState.sanitizeRecipeForFirestore === 'function') {
      return window.PlatePlanState.sanitizeRecipeForFirestore(recipe);
    }
    if (typeof window !== 'undefined' && typeof window.sanitizeRecipeForFirestore === 'function' && window.sanitizeRecipeForFirestore !== sanitizeRecipeForFirestore) {
      return window.sanitizeRecipeForFirestore(recipe);
    }
    return sanitizePayloadForFirestore(unwrapAndCleanItem(recipe));
  }

  function sanitizeIngredientForFirestore(ing) {
    if (typeof window !== 'undefined' && window.PlatePlanState && typeof window.PlatePlanState.sanitizeIngredientForFirestore === 'function') {
      return window.PlatePlanState.sanitizeIngredientForFirestore(ing);
    }
    if (typeof window !== 'undefined' && typeof window.sanitizeIngredientForFirestore === 'function' && window.sanitizeIngredientForFirestore !== sanitizeIngredientForFirestore) {
      return window.sanitizeIngredientForFirestore(ing);
    }
    return sanitizePayloadForFirestore(unwrapAndCleanItem(ing));
  }

  function cleanObject(obj) {
    if (typeof window !== 'undefined' && window.PlatePlanState && typeof window.PlatePlanState.cleanObject === 'function') {
      return window.PlatePlanState.cleanObject(obj);
    }
    if (typeof window !== 'undefined' && typeof window.cleanObject === 'function' && window.cleanObject !== cleanObject) {
      return window.cleanObject(obj);
    }
    return sanitizePayloadForFirestore(unwrapAndCleanItem(obj));
  }

  function computePayloadSignature(obj) {
    if (!obj || typeof obj !== 'object') return '';
    try {
      return JSON.stringify(obj);
    } catch (e) {
      return String(Date.now());
    }
  }

  function capturePlatePlanEditBaseline(key) {
    return true;
  }

  function getPlatePlanDeviceId() {
    try {
      let id = localStorage.getItem(SYNC_DEVICE_SK);
      if (!id) {
        id = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem(SYNC_DEVICE_SK, id);
      }
      return id;
    } catch (e) {
      return 'dev-session-' + Date.now().toString(36);
    }
  }

  const moduleExports = {
    sanitizePayloadForFirestore,
    unwrapAndCleanItem,
    sanitizePlanForFirestore,
    sanitizeRecipeForFirestore,
    sanitizeIngredientForFirestore,
    cleanObject,
    computePayloadSignature,
    capturePlatePlanEditBaseline,
    getPlatePlanDeviceId
  };

  window.PlatePlanCloudSync = Object.assign(window.PlatePlanCloudSync || {}, moduleExports);
  if (typeof window !== 'undefined') {
    for (const k of Object.keys(moduleExports)) {
      if (!window[k] || window[k] === moduleExports[k]) {
        window[k] = moduleExports[k];
      }
    }
  }
})();
