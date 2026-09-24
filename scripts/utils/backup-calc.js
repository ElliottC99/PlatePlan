/**
 * scripts/utils/backup-calc.js
 * Pure Backup Payload, Validation, Diffing, and Data Quality Analysis Utilities
 */

(() => {
  window.PlatePlanSettingsBackup = window.PlatePlanSettingsBackup || {};
  window.PlatePlanSettings = window.PlatePlanSettings || {};

  function getPlatePlanBackupPayload() {
    const appVer = typeof PLATEPLAN_APP_VERSION !== 'undefined' ? PLATEPLAN_APP_VERSION : (window.PLATEPLAN_APP_VERSION || '3.3.7-mod');
    const schemaVer = typeof PLATEPLAN_SCHEMA_VERSION !== 'undefined' ? PLATEPLAN_SCHEMA_VERSION : (window.PLATEPLAN_SCHEMA_VERSION || 1);
    const currentState = typeof state !== 'undefined' ? state : (window.state || {});
    return {
      exportedAt: new Date().toISOString(),
      app: 'PlatePlan',
      version: appVer,
      schemaVersion: schemaVer,
      state: currentState
    };
  }

  function getPlatePlanStateCounts(candidate) {
    return {
      recipes: Array.isArray(candidate?.recipes) ? candidate.recipes.length : 0,
      products: Array.isArray(candidate?.ingredients) ? candidate.ingredients.length : 0,
      ingredients: Array.isArray(candidate?.ingredientFamilies) ? candidate.ingredientFamilies.length : 0,
      subTypes: Array.isArray(candidate?.ingredientGroups) ? candidate.ingredientGroups.length : 0,
      planDays: +candidate?.plan?.days || Object.keys(candidate?.plan?.slots || {}).length,
      planHistory: Array.isArray(candidate?.planHistory) ? candidate.planHistory.length : 0
    };
  }

  function validatePlatePlanImport(candidate, metadata = {}) {
    const errors = [], warnings = [];
    const maxSchemaVer = typeof PLATEPLAN_SCHEMA_VERSION !== 'undefined' ? PLATEPLAN_SCHEMA_VERSION : (window.PLATEPLAN_SCHEMA_VERSION || 1);
    if (!candidate || typeof candidate !== 'object') errors.push('The backup does not contain a PlatePlan state object.');
    if (!Array.isArray(candidate?.recipes)) errors.push('Recipes are missing or invalid.');
    if (!Array.isArray(candidate?.ingredients)) errors.push('Products are missing or invalid.');
    const schemaVersion = +(metadata.schemaVersion || candidate?.meta?.schemaVersion || 1);
    if (schemaVersion > maxSchemaVer) errors.push(`This backup uses newer data schema ${schemaVersion}; this PlatePlan supports schema ${maxSchemaVer}.`);
    const duplicateIds = (items, label) => {
      if (!Array.isArray(items)) return;
      const seen = new Set(), duplicates = new Set();
      items.forEach(item => { if (!item?.id) return; if (seen.has(item.id)) duplicates.add(item.id); else seen.add(item.id); });
      if (duplicates.size) errors.push(`${label} contain ${duplicates.size} duplicate ID${duplicates.size === 1 ? '' : 's'}.`);
    };
    duplicateIds(candidate?.recipes, 'Recipes');
    duplicateIds(candidate?.ingredients, 'Products');
    duplicateIds(candidate?.ingredientFamilies, 'Ingredients');
    duplicateIds(candidate?.ingredientGroups, 'Sub-types');
    if (candidate?.plan != null && typeof candidate.plan !== 'object') errors.push('The meal plan is invalid.');
    if (!Array.isArray(candidate?.ingredientFamilies)) warnings.push('Ingredient hierarchy will be rebuilt from compatible product data.');
    if (!Array.isArray(candidate?.ingredientGroups)) warnings.push('Sub-types will be rebuilt from compatible product data.');
    if (!candidate?.prefs || typeof candidate.prefs !== 'object') warnings.push('Default preferences will be applied where settings are missing.');
    return { valid: errors.length === 0, errors, warnings, schemaVersion, counts: getPlatePlanStateCounts(candidate) };
  }

  function stableStateComparisonValue(value, seen = new WeakSet(), depth = 0) {
    if (depth > 20) return null;
    if (value && typeof value === 'object') {
      if (typeof value.nodeType === 'number' || (typeof Element !== 'undefined' && value instanceof Element)) return null;
      if (value === window || (typeof global !== 'undefined' && value === global)) return null;
      if (typeof value.preventDefault === 'function' || (typeof Event !== 'undefined' && value instanceof Event)) return null;
      if (seen.has(value)) return null;
      seen.add(value);
    }
    if (Array.isArray(value)) return value.map(v => stableStateComparisonValue(v, seen, depth + 1));
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((out, key) => {
        try {
          out[key] = stableStateComparisonValue(value[key], seen, depth + 1);
        } catch (_) {}
        return out;
      }, {});
    }
    return value;
  }

  function stateValuesMatch(a, b) {
    const stringify = typeof safeJsonStringify === 'function' ? safeJsonStringify : (typeof window !== 'undefined' && window.safeJsonStringify ? window.safeJsonStringify : (v => JSON.stringify(v)));
    try {
      return stringify(stableStateComparisonValue(a)) === stringify(stableStateComparisonValue(b));
    } catch (_e) {
      return false;
    }
  }

  function describeVersionCollection(browserItems, fileItems, label, nameForItem) {
    const browserList = Array.isArray(browserItems) ? browserItems : [];
    const fileList = Array.isArray(fileItems) ? fileItems : [];
    const keyFor = (item, index) => String(item?.id || item?.key || item?.name || index);
    const browserMap = new Map(browserList.map((item, index) => [keyFor(item, index), item]));
    const fileMap = new Map(fileList.map((item, index) => [keyFor(item, index), item]));
    const onlyFile = [], onlyBrowser = [], changed = [];
    const escapeHtml = typeof ppEscapeHtml === 'function' ? ppEscapeHtml : (typeof window !== 'undefined' && window.ppEscapeHtml ? window.ppEscapeHtml : (v => String(v ?? '')));
    fileMap.forEach((item, key) => {
      if (!browserMap.has(key)) onlyFile.push(nameForItem(item));
      else if (!stateValuesMatch(browserMap.get(key), item)) changed.push(nameForItem(item) || nameForItem(browserMap.get(key)));
    });
    browserMap.forEach((item, key) => { if (!fileMap.has(key)) onlyBrowser.push(nameForItem(item)); });
    if (!onlyFile.length && !onlyBrowser.length && !changed.length) return '';
    const brief = (heading, names) => {
      if (!names.length) return '';
      const visible = names.slice(0, 4).map(escapeHtml).join(', ');
      return `${heading} ${names.length}${visible ? ` (${visible}${names.length > 4 ? ` +${names.length - 4} more` : ''})` : ''}`;
    };
    const parts = [brief('only in file:', onlyFile), brief('only in browser:', onlyBrowser), brief('changed:', changed)].filter(Boolean);
    return `<div><strong>${label}:</strong> file ${fileList.length}, browser ${browserList.length}<div style="color:var(--text3);margin-top:2px">${parts.join(' &middot; ')}</div></div>`;
  }

  function countPlannedMeals(plan) {
    return Object.values(plan?.slots || {}).reduce((total, day) => total + Object.values(day || {}).filter(Boolean).length, 0);
  }

  function renderBakedStateDifferenceSummary(browserState, fileState) {
    const rows = [
      describeVersionCollection(browserState?.recipes, fileState?.recipes, 'Recipes', item => item?.name || 'Unnamed recipe'),
      describeVersionCollection(browserState?.ingredients, fileState?.ingredients, 'Products', item => item?.name || 'Unnamed product'),
      describeVersionCollection(browserState?.ingredientFamilies, fileState?.ingredientFamilies, 'Ingredients', item => item?.name || 'Unnamed ingredient'),
      describeVersionCollection(browserState?.ingredientGroups, fileState?.ingredientGroups, 'Sub-types', item => item?.name || item?.family || 'Unnamed sub-type')
    ].filter(Boolean);
    const browserCats = browserState?.customCats || {};
    const fileCats = fileState?.customCats || {};
    if (!stateValuesMatch(browserCats, fileCats)) {
      rows.push(`<div><strong>Categories:</strong> file ${Object.keys(fileCats).length}, browser ${Object.keys(browserCats).length} <span style="color:var(--text3)">(category definitions differ)</span></div>`);
    }
    if (!stateValuesMatch(browserState?.plan || {}, fileState?.plan || {})) {
      rows.push(`<div><strong>Current meal plan:</strong> file ${countPlannedMeals(fileState?.plan)} planned meals, browser ${countPlannedMeals(browserState?.plan)} planned meals</div>`);
    }
    if (!stateValuesMatch(browserState?.overrides || {}, fileState?.overrides || {})) rows.push('<div><strong>Shopping/meal overrides:</strong> differ</div>');
    if (!stateValuesMatch(browserState?.prefs || {}, fileState?.prefs || {})) rows.push('<div><strong>Preferences and targets:</strong> differ</div>');
    if (!stateValuesMatch(browserState?.planHistory || [], fileState?.planHistory || [])) {
      rows.push(`<div><strong>Plan history:</strong> file ${(fileState?.planHistory || []).length}, browser ${(browserState?.planHistory || []).length}</div>`);
    }
    if (!rows.length) return '<div style="color:var(--text2)">No content differences were found; only JSON formatting or property order differs.</div>';
    return rows.join('');
  }

  function dataQualityFingerprint(value) {
    const stringify = typeof safeJsonStringify === 'function' ? safeJsonStringify : (typeof window !== 'undefined' && window.safeJsonStringify ? window.safeJsonStringify : (v => JSON.stringify(v ?? null)));
    const text = stringify(value ?? null) || '';
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function createDataQualityIssue({ entityType, entityId, code, severity = 'gap', title, message, fixButtonHtml = '', fixTarget = null, source = null, legacyKey = '' }) {
    const key = `${entityType}:${entityId}:${code}`;
    return { entityType, entityId, code, severity, title, message, fixButtonHtml, fixTarget, key, legacyKey, fingerprint: dataQualityFingerprint(source) };
  }

  function dataQualityRecipeVariants(recipe) {
    const rows = [{ label: 'Original', data: recipe, ingredients: recipe.ingredients || [], steps: recipe.steps || recipe.method || [] }];
    if (recipe.enhanced) {
      rows.push({
        label: 'Enhanced',
        data: recipe.enhanced,
        ingredients: recipe.enhanced.ingredients || [],
        steps: recipe.enhanced.method || recipe.enhanced.steps || []
      });
    }
    return rows;
  }

  function dataQualityVariantPerServing(recipe, variant) {
    if (variant.data?.nutrition?.perServing) return variant.data.nutrition.perServing;
    if (variant.label === 'Original' && recipe.nutrition?.perServing) return recipe.nutrition.perServing;
    return variant.data || {};
  }

  function recipeVariantHasOilIngredient(ingredients) {
    const resolveFamily = typeof getGroupIngredientFamily === 'function'
      ? getGroupIngredientFamily
      : (typeof window !== 'undefined' && typeof window.getGroupIngredientFamily === 'function'
          ? window.getGroupIngredientFamily
          : (() => null));
    const resolveProduct = typeof resolveProductForIngredient === 'function'
      ? resolveProductForIngredient
      : (typeof window !== 'undefined' && typeof window.resolveProductForIngredient === 'function'
          ? window.resolveProductForIngredient
          : (() => ({ product: null, group: null })));
    return (ingredients || []).some(ing => {
      const resolved = resolveProduct(ing) || {};
      const family = resolved.group ? resolveFamily(resolved.group) : null;
      const text = [ing.raw, ing.name, resolved.group?.name, ...(resolved.group?.aliases || []), family?.name, ...(family?.aliases || []), resolved.product?.name].filter(Boolean).join(' ').toLowerCase();
      return /\b(olive|vegetable|sesame|rapeseed|sunflower|avocado|coconut)?\s*oil\b/.test(text);
    });
  }

  function recipeVariantMethodSuggestsOil(steps) {
    const text = (steps || []).join(' ').toLowerCase();
    return /\b(oil|drizzle|fry|pan[-\s]?fry|sauté|saute|roast|bake|air[-\s]?fry)\b/.test(text);
  }

  const pureCalcExports = {
    getPlatePlanBackupPayload,
    getPlatePlanStateCounts,
    validatePlatePlanImport,
    stableStateComparisonValue,
    stateValuesMatch,
    describeVersionCollection,
    countPlannedMeals,
    renderBakedStateDifferenceSummary,
    dataQualityFingerprint,
    createDataQualityIssue,
    dataQualityRecipeVariants,
    dataQualityVariantPerServing,
    recipeVariantHasOilIngredient,
    recipeVariantMethodSuggestsOil
  };

  Object.assign(window.PlatePlanSettingsBackup, pureCalcExports);
  Object.assign(window.PlatePlanSettings, pureCalcExports);

  if (typeof window !== 'undefined') {
    Object.assign(window, pureCalcExports);
  }
})();
