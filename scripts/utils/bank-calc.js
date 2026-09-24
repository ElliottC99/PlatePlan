/**
 * scripts/utils/bank-calc.js
 * Pure price, macro, pack ratio calculations, and search text normalizers for the Bank domain.
 */
(function() {
  'use strict';
  
  // Pure helper functions (moved from other modules)
  window.PlatePlanBank = window.PlatePlanBank || {};
  window.PlatePlanBank.Utils = {
    canonicalGroupKey: (s) => String(s || '').toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim(),
    familyKey: (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    toTitleCase: (s) => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
    ppEscapeHtml: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'),
    ppEscapeAttr: (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
  };
})();
