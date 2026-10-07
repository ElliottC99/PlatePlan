/**
 * src/services/DataQualityEngine.js
 * Expanded Data Quality Audit Engine with self-healing audit rules.
 * Decoupled from UI rendering and fully localized inside the services domain.
 */

import { calculateRecipeDynamicMacros } from './DataQualityScannerService.js';

/**
 * Fallback Macro Resolution Helper
 * Resolves effective macros for an ingredient, falling back to defaultProduct if root macros are null/missing.
 */
export function getEffectiveIngredientMacros(ingredient, productStore) {
  if (!ingredient) return null;
  if (ingredient.calories != null && ingredient.protein != null) {
    return { calories: Number(ingredient.calories), protein: Number(ingredient.protein), source: 'ingredient' };
  }
  if (ingredient.cal != null && ingredient.prot != null) {
    return { calories: Number(ingredient.cal), protein: Number(ingredient.prot), source: 'ingredient' };
  }
  const defaultProductId = ingredient.defaultProductId || ingredient.defaultProduct;
  const defaultProduct = defaultProductId && productStore ? (typeof productStore.get === 'function' ? productStore.get(defaultProductId) : (Array.isArray(productStore) ? productStore.find(p => String(p.id) === String(defaultProductId)) : null)) : null;
  if (defaultProduct && (defaultProduct.calories != null || defaultProduct.cal != null)) {
    return { calories: Number(defaultProduct.calories ?? defaultProduct.cal), protein: Number(defaultProduct.protein ?? defaultProduct.prot), source: 'default_product' };
  }
  return null; // Truly missing specs
}

/**
 * Automated Macro Drift Recalibration (Replaces manual trigger)
 */
export function autoRecalibrateRecipeDrift(recipe, ingredientStore, productStore) {
  const calculated = calculateRecipeDynamicMacros(recipe, ingredientStore, productStore) || { perServing: { cal: 0, prot: 0, carb: 0, fat: 0 } };
  const perServing = calculated.perServing || calculated;
  const calcCalories = perServing.cal ?? perServing.calories ?? 0;
  const calcProtein = perServing.prot ?? perServing.protein ?? 0;
  const calcCarbs = perServing.carb ?? perServing.carbs ?? 0;
  const calcFat = perServing.fat ?? 0;

  const storedCalories = Number(recipe.macros?.calories ?? recipe.macros?.cal ?? recipe.calories ?? recipe.cal ?? 0);
  const driftRatio = Math.abs(storedCalories - calcCalories) / Math.max(1, storedCalories);
  
  if (driftRatio > 0.02) {
    recipe.macros = {
      calories: Math.round(calcCalories),
      protein: Number(calcProtein.toFixed(1)),
      carbs: Number(calcCarbs.toFixed(1)),
      fat: Number(calcFat.toFixed(1))
    };
    return { updated: true, recipe };
  }
  return { updated: false, recipe };
}

/**
 * Calculates string similarity using Sorensen-Dice coefficient.
 * Returns a value between 0.0 and 1.0.
 */
function getStringSimilarity(str1, str2) {
  const s1 = String(str1 || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const s2 = String(str2 || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const s1Bigrams = new Map();
  for (let i = 0; i < s1.length - 1; i++) {
    const bigram = s1.substr(i, 2);
    const count = s1Bigrams.has(bigram) ? s1Bigrams.get(bigram) + 1 : 1;
    s1Bigrams.set(bigram, count);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substr(i, 2);
    const count = s1Bigrams.get(bigram) || 0;
    if (count > 0) {
      intersection++;
      s1Bigrams.set(bigram, count - 1);
    }
  }

  return (2.0 * intersection) / (s1.length + s2.length - 2);
}

/**
 * Run data quality audits across recipes, products, and ingredients.
 * @param {Object} state Current application state
 * @returns {Object} Grouped audit issues
 */
export function runAudit(state = {}) {
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
  const products = Array.isArray(state.products) ? state.products : [];
  const currentPlan = state.currentPlan || null;
  const preferences = state.preferences || state.userPrefs || {};

  const dismissed = Array.isArray(preferences.dismissedQualityAdvisories)
    ? preferences.dismissedQualityAdvisories
    : [];

  const results = {
    macroDrift: [],
    planDesync: [],
    incompleteMacros: [],
    densityMismatch: [],
    orphans: [],
    unmappedItems: [],
    duplicates: [],
    storageHealth: [],
    totalCount: 0
  };

  const volumeUnits = ['ml', 'l', 'tbsp', 'tsp', 'cup', 'teaspoon', 'tablespoon', 'liquid', 'fl oz'];

  // 1. Recipe Macro Drift (> 2%) with auto-recalibration check
  recipes.forEach(r => {
    autoRecalibrateRecipeDrift(r, ingredients, products);
    const dynamic = calculateRecipeDynamicMacros(r, ingredients, products);
    if (!dynamic) return;

    const storedCal = Number(r.macros?.calories ?? r.calories ?? r.cal ?? 0);
    const storedProt = Number(r.macros?.protein ?? r.protein ?? r.prot ?? 0);
    const storedCarb = Number(r.macros?.carbs ?? r.carbs ?? r.carb ?? 0);
    const storedFat = Number(r.macros?.fat ?? r.fat ?? 0);

    const calcCal = dynamic.perServing.cal;
    const calcProt = dynamic.perServing.prot;
    const calcCarb = dynamic.perServing.carb;
    const calcFat = dynamic.perServing.fat;

    const calDiff = Math.abs(storedCal - calcCal) / Math.max(1, calcCal);
    const protDiff = Math.abs(storedProt - calcProt) / Math.max(1, calcProt);
    const carbDiff = Math.abs(storedCarb - calcCarb) / Math.max(1, calcCarb);
    const fatDiff = Math.abs(storedFat - calcFat) / Math.max(1, calcFat);

    if (calDiff > 0.02 || protDiff > 0.02 || carbDiff > 0.02 || fatDiff > 0.02) {
      results.macroDrift.push({
        key: `drift:recipe:${r.id}`,
        recipeId: r.id,
        recipeName: r.name || r.title,
        stored: { cal: storedCal, prot: storedProt, carb: storedCarb, fat: storedFat },
        calculated: { cal: calcCal, prot: calcProt, carb: calcCarb, fat: calcFat },
        message: `Stored recipe macros differ from calculated ingredients by > 2% (${Math.round(storedCal)} kcal stored vs ${Math.round(calcCal)} kcal calculated).`,
        severity: 'advisory'
      });
    }
  });

  // 2. Active Meal Plan Desync
  if (currentPlan && currentPlan.slots) {
    Object.keys(currentPlan.slots).forEach(dayKey => {
      const dayObj = currentPlan.slots[dayKey];
      if (!dayObj || typeof dayObj !== 'object') return;

      Object.keys(dayObj).forEach(mealKey => {
        const node = dayObj[mealKey];
        if (!node || typeof node !== 'object' || node.isSkipped) return;

        const rId = node.recipeId || node.id;
        if (!rId) return;

        const template = recipes.find(r => String(r.id) === String(rId));
        if (template) {
          const nodeCal = node.cal ?? node.calories ?? node.macros?.calories ?? node.macros?.cal;
          const nodeProt = node.prot ?? node.protein ?? node.macros?.protein ?? node.macros?.prot;

          const tempCal = template.cal ?? template.calories ?? template.macros?.calories ?? template.macros?.cal ?? 0;
          const tempProt = template.prot ?? template.protein ?? template.macros?.protein ?? template.macros?.prot ?? 0;

          if (nodeCal !== undefined && (Math.abs(nodeCal - tempCal) > 1 || Math.abs((nodeProt ?? 0) - tempProt) > 0.5)) {
            results.planDesync.push({
              key: `desync:plan:${dayKey}:${mealKey}:${rId}`,
              dayKey,
              mealKey,
              recipeId: rId,
              recipeName: template.name || 'Unnamed Recipe',
              nodeCal,
              nodeProt,
              tempCal,
              tempProt,
              message: `Active meal plan slot for "${template.name}" on Day ${dayKey} has outdated macros (${Math.round(nodeCal)} kcal vs current template ${Math.round(tempCal)} kcal).`,
              severity: 'advisory'
            });
          }
        }
      });
    });
  }

  // 3. Incomplete Macros Validation using getEffectiveIngredientMacros (Atwater logic removed)
  ingredients.forEach(ing => {
    const effective = getEffectiveIngredientMacros(ing, products);
    if (!effective) {
      results.incompleteMacros.push({
        key: `incomplete:ing:${ing.id}`,
        ingredientId: ing.id,
        ingredientName: ing.name,
        type: 'incomplete',
        message: `Ingredient "${ing.name}" lacks complete calorie or protein specifications (neither direct nor default product specs available).`,
        severity: 'gap'
      });
    }
  });

  // 4. Density Factor Mismatch
  recipes.forEach(r => {
    const rawIngs = r.ingredients || r.recipe?.ingredients || r.parsedIngredients || [];
    const items = Array.isArray(rawIngs) ? rawIngs : (typeof rawIngs === 'object' ? Object.values(rawIngs) : []);

    items.forEach(item => {
      if (!item.ingredientId) return;
      const unit = String(item.unit || item.measure || '').toLowerCase().trim();
      if (volumeUnits.includes(unit)) {
        const baseIng = ingredients.find(ing => String(ing.id) === String(item.ingredientId));
        if (baseIng && (baseIng.density === undefined || baseIng.density === null || baseIng.density === 0 || baseIng.density === "")) {
          results.densityMismatch.push({
            key: `density:recipe:${r.id}:ing:${baseIng.id}`,
            recipeId: r.id,
            recipeName: r.name || r.title,
            ingredientId: baseIng.id,
            ingredientName: baseIng.name,
            unit,
            message: `Recipe "${r.name || r.title}" uses volume (${unit}) for "${baseIng.name}" but the ingredient lacks a density conversion factor.`,
            severity: 'gap'
          });
        }
      }
    });
  });

  // 5. Orphaned Products / Unlinked Sub-Types
  products.forEach(p => {
    if (p.ingredientId) {
      const parentIng = ingredients.find(ing => String(ing.id) === String(p.ingredientId));
      if (!parentIng) {
        results.orphans.push({
          key: `orphan:product:${p.id}:no-ing`,
          productId: p.id,
          productName: p.name,
          subtypeId: p.subtypeId,
          type: 'no-ingredient',
          message: `Product "${p.name}" references parent ingredient ID "${p.ingredientId}" which does not exist in the database.`,
          severity: 'blocker'
        });
        return;
      }

      if (p.subtypeId) {
        const hasSubtype = Array.isArray(parentIng.subtypes) && parentIng.subtypes.some(s => String(s.id) === String(p.subtypeId));
        if (!hasSubtype) {
          results.orphans.push({
            key: `orphan:product:${p.id}:no-sub`,
            productId: p.id,
            productName: p.name,
            subtypeId: p.subtypeId,
            parentId: parentIng.id,
            parentName: parentIng.name,
            type: 'no-subtype',
            message: `Product "${p.name}" references sub-type ID "${p.subtypeId}" which is missing from parent ingredient "${parentIng.name}".`,
            severity: 'blocker'
          });
        }
      }
    }
  });

  // 6. Unmapped Store Items
  ingredients.forEach(ing => {
    if (ing.ignoreStoreMapping === true) return;

    const hasDirectProduct = products.some(p => String(p.ingredientId) === String(ing.id));
    const hasSubtypeProduct = Array.isArray(ing.subtypes) && ing.subtypes.some(st => {
      return products.some(p => String(p.subtypeId) === String(st.id));
    });

    if (!hasDirectProduct && !hasSubtypeProduct) {
      results.unmappedItems.push({
        key: `unmapped:ing:${ing.id}`,
        ingredientId: ing.id,
        ingredientName: ing.name,
        message: `Ingredient "${ing.name}" is completely unmapped and has zero attached products in the store catalog.`,
        severity: 'gap'
      });
    }
  });

  // 7. Duplicate Ingredient Detection (> 85% similarity)
  for (let i = 0; i < ingredients.length; i++) {
    for (let j = i + 1; j < ingredients.length; j++) {
      const ing1 = ingredients[i];
      const ing2 = ingredients[j];
      const score = getStringSimilarity(ing1.name, ing2.name);
      if (score > 0.85) {
        results.duplicates.push({
          key: `duplicate:ing:${ing1.id}:${ing2.id}`,
          ing1Id: ing1.id,
          ing1Name: ing1.name,
          ing2Id: ing2.id,
          ing2Name: ing2.name,
          score,
          message: `Potential duplicates: "${ing1.name}" and "${ing2.name}" have a similarity score of ${Math.round(score * 100)}%.`,
          severity: 'advisory'
        });
      }
    }
  }

  // 8. Preference Storage Health (> 500 KB)
  let payloadStr = '';
  try {
    payloadStr = JSON.stringify(preferences);
  } catch (e) {
    payloadStr = '{}';
  }
  const sizeBytes = new TextEncoder().encode(payloadStr).length;
  if (sizeBytes > 500000) {
    results.storageHealth.push({
      key: `health:preference-size`,
      sizeBytes,
      sizeKb: Math.round(sizeBytes / 1024),
      message: `System Alert: Preference payload size is ${Math.round(sizeBytes / 1024)} KB, exceeding the 500 KB performance threshold.`,
      severity: 'advisory'
    });
  }

  // Filter out dismissed advisories across all audit categories
  Object.keys(results).forEach(cat => {
    if (Array.isArray(results[cat])) {
      results[cat] = results[cat].filter(issue => !dismissed.includes(issue.key));
      results.totalCount += results[cat].length;
    }
  });

  return results;
}
