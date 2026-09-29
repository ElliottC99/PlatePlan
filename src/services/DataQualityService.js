/**
 * src/services/DataQualityService.js (v3.8.1)
 * Pure Data Quality, Product Integrity, and Orphaned Hierarchy Audit Service.
 * Quarantined from page DOM queries, UI rendering, and direct database operations.
 */

export function dataQualityFingerprint(value) {
  let text = '';
  try {
    text = JSON.stringify(value ?? null);
  } catch (_e) {
    text = String(value ?? '');
  }
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function isDataQualityWarningIgnored(key, fingerprint = '', dismissals = {}, ignoredWarnings = []) {
  if (!key) return false;
  if (new Set(ignoredWarnings || []).has(key)) return true;
  if (dismissals && typeof dismissals === 'object' && dismissals[key]) {
    if (!fingerprint) return true;
    return dismissals[key] === fingerprint;
  }
  return false;
}

export function createDataQualityIssue({ entityType, entityId, code, severity = 'gap', title, message, fixButtonHtml = '', fixTarget = null, source = null, legacyKey = '' }) {
  const key = `${entityType}:${entityId}:${code}`;
  return {
    entityType,
    entityId,
    code,
    severity,
    title,
    message,
    fixButtonHtml,
    fixTarget,
    key,
    legacyKey,
    fingerprint: dataQualityFingerprint(source)
  };
}

export function isAllowedZeroNutritionIngredient(ing) {
  const text = `${ing?.name || ''} ${ing?.cat || ''}`.toLowerCase();
  return /\b(water|salt|msg|monosodium glutamate|creatine|stock cube|stock pot|seasoning cube)\b/.test(text);
}

export function hasUsableIngredientNutrition(ing) {
  if (!ing) return false;
  if (isAllowedZeroNutritionIngredient(ing)) return true;
  return !!((+ing.cal || 0) || (+ing.prot || 0) || (+ing.carb || 0) || (+ing.fat || 0) || (+ing.fibre || 0));
}

export function dataQualityRecipeVariants(recipe) {
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

export function dataQualityVariantPerServing(recipe, variant) {
  if (variant.data?.nutrition?.perServing) return variant.data.nutrition.perServing;
  if (variant.label === 'Original' && recipe.nutrition?.perServing) return recipe.nutrition.perServing;
  return variant.data || {};
}

export function auditProducts(products = [], hierarchy = {}) {
  const issues = [];
  const { groups = [], families = [] } = hierarchy;
  const groupMap = new Map((groups || []).map(g => [g.id, g]));
  const familyMap = new Map((families || []).map(f => [f.id, f]));

  (products || []).forEach(product => {
    if (!product || typeof product !== 'object') return;
    const id = product.id;
    const name = product.name || 'Unnamed product';

    if (!hasUsableIngredientNutrition(product)) {
      issues.push(createDataQualityIssue({ entityType: 'product', entityId: id, code: 'unusable-nutrition', severity: 'blocker', title: name, message: 'No usable mapped nutrition is available.', source: [product.cal, product.prot, product.carb, product.fat, product.fibre, name] }));
    }
    if (!(+(product.price) > 0)) {
      issues.push(createDataQualityIssue({ entityType: 'product', entityId: id, code: 'missing-price', title: name, message: 'Price is missing.', source: product.price }));
    }
    if (!(+(product.packSize) > 0) || !product.packUnit) {
      issues.push(createDataQualityIssue({ entityType: 'product', entityId: id, code: 'missing-pack', title: name, message: 'Pack size or unit is missing.', source: [product.packSize, product.packUnit] }));
    }
    if (!product.storage) {
      issues.push(createDataQualityIssue({ entityType: 'product', entityId: id, code: 'missing-storage', title: name, message: 'Storage location is missing.', source: product.storage }));
    }

    const linkedGroup = product.groupId ? groupMap.get(product.groupId) : null;
    let parentFamily = linkedGroup?.ingredientId ? familyMap.get(linkedGroup.ingredientId) : null;
    if (!parentFamily && product.ingredientId) parentFamily = familyMap.get(product.ingredientId);
    if (!parentFamily && product.cat) parentFamily = familyMap.get(product.cat);

    const familySubGroups = parentFamily ? (groups || []).filter(g => g.ingredientId === parentFamily.id) : [];
    const familyHasNoSubtypes = !!parentFamily && familySubGroups.length === 0;
    const isCompliantWithoutSubtype = familyHasNoSubtypes && (product.subTypeId === null || product.subTypeId === 'default' || product.groupId === 'default' || !product.groupId);

    if (!linkedGroup && !isCompliantWithoutSubtype) {
      issues.push(createDataQualityIssue({ entityType: 'product', entityId: id, code: 'missing-hierarchy-link', title: name, message: 'Product is not linked to a valid ingredient sub-type.', source: [product.groupId, product.cat] }));
    }

    const packUnit = String(product.packUnit || '').toLowerCase();
    const itemWeightUnit = String(product.itemWeightUnit || 'g').toLowerCase();
    const drainedUnit = String(product.drainedWeightUnit || packUnit || 'g').toLowerCase();

    if (+product.drainedWeight > 0 && packUnit !== 'qty' && drainedUnit !== packUnit) {
      issues.push(createDataQualityIssue({ entityType: 'product', entityId: id, code: 'incompatible-pack-units', title: name, message: `Pack size uses ${packUnit}, but drained weight uses ${drainedUnit}.`, source: [product.packSize, packUnit, product.drainedWeight, drainedUnit] }));
    }
    if (+product.itemWeight > 0 && packUnit !== 'qty' && itemWeightUnit !== packUnit) {
      issues.push(createDataQualityIssue({ entityType: 'product', entityId: id, code: 'incompatible-item-unit', title: name, message: `Pack size uses ${packUnit}, but one item uses ${itemWeightUnit}.`, source: [product.packSize, packUnit, product.itemWeight, itemWeightUnit] }));
    }
    if (['g', 'ml'].includes(packUnit) && packUnit === itemWeightUnit && +product.itemWeight > 0 && +product.packSize > 0 && +product.itemWeight > +product.packSize) {
      issues.push(createDataQualityIssue({ entityType: 'product', entityId: id, code: 'item-heavier-than-pack', title: name, message: `Pack size (${product.packSize}${packUnit}) is smaller than one item (${product.itemWeight}${itemWeightUnit}).`, source: [product.packSize, packUnit, product.itemWeight, itemWeightUnit, product.price] }));
    }
    if (packUnit === 'qty' && !(+product.itemWeight > 0)) {
      issues.push(createDataQualityIssue({ entityType: 'product', entityId: id, code: 'count-pack-missing-item-weight', title: name, message: 'Counted pack missing single-item weight.', source: [product.packSize, product.packUnit, product.itemWeight, product.itemWeightUnit] }));
    }
  });

  return issues;
}

export function auditHierarchy(families = [], groups = [], products = []) {
  const issues = [];
  const groupMap = new Map((groups || []).map(g => [g.id, g]));
  const familyMap = new Map((families || []).map(f => [f.id, f]));
  const productsByGroup = new Map();

  (products || []).forEach(p => {
    if (p?.groupId) {
      if (!productsByGroup.has(p.groupId)) productsByGroup.set(p.groupId, []);
      productsByGroup.get(p.groupId).push(p);
    }
  });

  (families || []).forEach(family => {
    const fGroups = (groups || []).filter(g => g.ingredientId === family.id);
    const title = family.name || 'Unnamed ingredient';
    if (!fGroups.length) {
      issues.push(createDataQualityIssue({ entityType: 'ingredient', entityId: family.id, code: 'no-subtypes', title, message: 'Ingredient has no sub-types.', source: family.typeIds }));
    }
    if (!family.cat || family.cat === 'other') {
      issues.push(createDataQualityIssue({ entityType: 'ingredient', entityId: family.id, code: 'missing-category', title, message: 'Ingredient has no sorted category.', source: family.cat }));
    }
  });

  (groups || []).forEach(group => {
    const gProducts = productsByGroup.get(group.id) || [];
    const title = group.name || group.typeName || 'Unnamed sub-type';
    if (!group.ingredientId || !familyMap.has(group.ingredientId)) {
      issues.push(createDataQualityIssue({ entityType: 'subtype', entityId: group.id, code: 'missing-ingredient-link', title, message: 'Sub-type is not linked to a valid ingredient.', source: group.ingredientId }));
    }
    if (!gProducts.length) {
      issues.push(createDataQualityIssue({ entityType: 'subtype', entityId: group.id, code: 'no-products', title, message: 'Sub-type has no linked products.', source: [] }));
    }
    if (!group.cat || group.cat === 'other') {
      issues.push(createDataQualityIssue({ entityType: 'subtype', entityId: group.id, code: 'missing-category', title, message: 'Sub-type has no sorted category.', source: group.cat }));
    }
  });

  return issues;
}

export function detectDuplicateProducts(products = [], ignoredDuplicates = []) {
  const groups = {};
  (products || []).forEach(product => {
    const norm = String(product.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!norm) return;
    (groups[norm] ||= []).push(product);
  });
  const ignored = new Set(ignoredDuplicates || []);
  const advisories = [];

  Object.entries(groups).forEach(([norm, prods]) => {
    if (prods.length <= 1) return;
    const legacyKey = `product-dupe-${norm}`;
    if (ignored.has(legacyKey)) return;
    advisories.push(createDataQualityIssue({
      entityType: 'product-set',
      entityId: norm,
      code: 'possible-duplicate',
      severity: 'advisory',
      title: 'Possible duplicate products',
      message: prods.map(p => p.name).join(', '),
      source: prods.map(p => [p.id, p.name, p.brand]).sort(),
      legacyKey
    }));
  });

  return advisories;
}

export function collectUnusualNumberWarnings(products = [], recipes = []) {
  const warnings = [];
  (products || []).forEach(product => {
    const title = product.name || 'Unnamed product';
    const addWarning = (field, value, message) => {
      const rounded = Math.round((+value || 0) * 10) / 10;
      warnings.push({ key: `product-${product.id}-${field}-${rounded}`, title, message, entityType: 'product', entityId: product.id });
    };
    if ((+product.cal || 0) > 900) addWarning('cal', product.cal, `Calories look unusually high: ${product.cal} kcal per 100g/ml.`);
    ['prot', 'fat', 'carb', 'fibre'].forEach(field => {
      const val = +product[field] || 0;
      if (val > 100) addWarning(field, val, `${field === 'prot' ? 'Protein' : field.toUpperCase()} looks unusually high: ${val}g per 100g/ml.`);
    });
    if ((+product.price || 0) > 25) addWarning('price', product.price, `Price looks unusually high: £${product.price}.`);
    if ((+product.packSize || 0) > 5000) addWarning('packSize', product.packSize, `Pack size looks unusually large: ${product.packSize}${product.packUnit || ''}.`);
  });

  (recipes || []).forEach(recipe => {
    const mealTypes = recipe.types || [];
    const isMainMeal = mealTypes.some(t => ['lunch', 'dinner'].includes(t));
    dataQualityRecipeVariants(recipe).forEach(variant => {
      const title = `${recipe.name || 'Untitled recipe'} (${variant.label})`;
      const ps = dataQualityVariantPerServing(recipe, variant);
      const cal = +ps.cal || 0;
      const prot = +ps.prot || 0;
      if (isMainMeal && cal > 1400) warnings.push({ key: `recipe-${recipe.id}-${variant.label}-cal-${Math.round(cal)}`, title, message: `Calories look unusually high: ${Math.round(cal)} kcal.`, entityType: 'recipe', entityId: recipe.id });
      if (isMainMeal && cal > 0 && cal < 150) warnings.push({ key: `recipe-${recipe.id}-${variant.label}-cal-low-${Math.round(cal)}`, title, message: `Calories look unusually low: ${Math.round(cal)} kcal.`, entityType: 'recipe', entityId: recipe.id });
      if (prot > 120) warnings.push({ key: `recipe-${recipe.id}-${variant.label}-prot-${Math.round(prot)}`, title, message: `Protein looks unusually high: ${Math.round(prot)}g.`, entityType: 'recipe', entityId: recipe.id });
    });
  });

  return warnings;
}

export function runDataQualityAudit(stateData = {}) {
  const { ingredients = [], recipes = [], ingredientGroups = [], ingredientFamilies = [], dataQualityDismissals = {}, ignoredDataQualityWarnings = [], ignoredGroupMergeSuggestions = [] } = stateData;
  const productIssues = auditProducts(ingredients, { groups: ingredientGroups, families: ingredientFamilies });
  const hierarchyIssues = auditHierarchy(ingredientFamilies, ingredientGroups, ingredients);
  const issues = [...productIssues, ...hierarchyIssues];

  const duplicateAdvisories = detectDuplicateProducts(ingredients, ignoredGroupMergeSuggestions);
  const unusualWarnings = collectUnusualNumberWarnings(ingredients, recipes);
  const advisoryIssues = unusualWarnings.map(w => createDataQualityIssue({
    entityType: w.entityType || 'advisory',
    entityId: w.entityId || w.key,
    code: `advisory-${w.key}`,
    severity: 'advisory',
    title: w.title,
    message: w.message,
    source: w.message,
    legacyKey: w.key
  })).concat(duplicateAdvisories).filter(a => !isDataQualityWarningIgnored(a.key, a.fingerprint, dataQualityDismissals, ignoredDataQualityWarnings) && !(a.legacyKey && isDataQualityWarningIgnored(a.legacyKey, '', dataQualityDismissals, ignoredDataQualityWarnings)));

  const blockers = issues.filter(i => i.severity === 'blocker');
  const gaps = issues.filter(i => i.severity === 'gap');
  const totalCount = issues.length + advisoryIssues.length;

  return {
    issues,
    advisories: advisoryIssues,
    blockers,
    gaps,
    totalCount,
    blockerCount: blockers.length,
    gapCount: gaps.length
  };
}
