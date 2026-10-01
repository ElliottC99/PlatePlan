/**
 * src/services/DataQualityScannerService.js (v3.19.15)
 * Automated catalog data quality auditor, anomaly scanner, and advisor.
 * Pure service layer with zero DOM references.
 */

import { getState } from '../store/store.js';
import { buildPantryHierarchy } from '../models/PantryHierarchyModel.js';

export function runDataQualityScan(state = {}) {
  const ingredientsList = Array.isArray(state.ingredients) ? state.ingredients : Object.values(state.ingredients || {});
  const productsList = Array.isArray(state.products) ? state.products : Object.values(state.products || {});
  const recipes = Array.isArray(state.recipes) ? state.recipes : Object.values(state.recipes || {});

  // Diagnostic telemetry log
  console.log(`[DataQualityScanner] Auditing ${ingredientsList.length} ingredients against ${productsList.length} products.`);

  // Scanner Hydration Guard
  if (ingredientsList.length > 0 && productsList.length === 0) {
    return {
      blockers: [],
      gaps: [],
      advisories: [],
      totalCount: 0,
      isHydrating: true
    };
  }

  // Use the multidirectional hierarchy builder to resolve all linked direct/subtype products and defaults
  const hierarchy = buildPantryHierarchy(ingredientsList, productsList);
  const ingredients = [];
  hierarchy.forEach(catGroup => {
    if (Array.isArray(catGroup.ingredients)) {
      ingredients.push(...catGroup.ingredients);
    }
  });

  // Resolve dismissed advisories from preferences
  const dismissed = state.preferences?.dismissedQualityAdvisories || 
                    state.userPrefs?.dismissedQualityAdvisories || [];

  const blockers = [];
  const gaps = [];
  const advisories = [];

  // 1. Calculation Blockers Heuristics
  productsList.forEach(p => {
    const isMissingCal = p.cal === undefined || p.cal === null || p.cal === "";
    const isMissingProt = p.prot === undefined || p.prot === null || p.prot === "";
    const isMissingPack = p.pack === undefined || p.pack === null || p.pack === 0 || p.pack === "";

    if (isMissingCal || isMissingProt || isMissingPack) {
      blockers.push({
        key: `blocker:product:${p.id}`,
        entityType: 'product',
        entityId: p.id,
        title: p.name || 'Unnamed Product',
        message: `Missing essential properties for planning calculation (Kcal: ${isMissingCal ? 'missing' : p.cal}, Protein: ${isMissingProt ? 'missing' : p.prot + 'g'}, Pack size: ${isMissingPack ? 'missing' : p.pack + (p.packUnit || 'g')}).`,
        severity: 'blocker',
        fixTarget: { entityType: 'product', entityId: p.id }
      });
    }
  });

  ingredients.forEach(ing => {
    const totalProducts = (ing.directProducts?.length || 0) + 
                          (ing.subtypes || []).reduce((acc, st) => acc + (st.products?.length || 0), 0);
    const autoDefault = ing.defaultProduct;
    const hasBaseNutrition = (ing.cal && ing.cal > 0) || (ing.prot && ing.prot > 0);

    if (totalProducts > 0 && !autoDefault && !hasBaseNutrition) {
      blockers.push({
        key: `blocker:ingredient:${ing.id}:no-default`,
        entityType: 'ingredient',
        entityId: ing.id,
        title: ing.name,
        message: `Has products in catalog but lacks an designated "Auto default" product for calorie/protein estimates.`,
        severity: 'blocker',
        fixTarget: { entityType: 'ingredient', entityId: ing.id }
      });
    }
  });

  // 2. Other Data Gaps Heuristics
  ingredients.forEach(ing => {
    const totalProducts = (ing.directProducts?.length || 0) + 
                          (ing.subtypes || []).reduce((acc, st) => acc + (st.products?.length || 0), 0);
    if (totalProducts === 0) {
      gaps.push({
        key: `gap:ingredient:${ing.id}`,
        entityType: 'ingredient',
        entityId: ing.id,
        title: ing.name,
        message: `This core ingredient has zero mapped products in the Product Bank.`,
        severity: 'gap',
        fixTarget: { entityType: 'ingredient', entityId: ing.id }
      });
    }

    const subtypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];
    subtypes.forEach(st => {
      if ((st.products?.length || 0) === 0) {
        gaps.push({
          key: `gap:subtype:${st.id}`,
          entityType: 'subtype',
          entityId: st.id,
          parentIngredientId: ing.id,
          title: `${ing.name} ➔ ${st.name}`,
          message: `Sub-type "${st.name}" has no linked grocery products.`,
          severity: 'gap',
          fixTarget: { entityType: 'subtype', entityId: st.id }
        });
      }
    });
  });

  // 3. Heuristic Advisories Heuristics
  // Pack size check
  productsList.forEach(p => {
    if (Number(p.pack) > 5000) {
      advisories.push({
        key: `advisory:pack-size:${p.id}`,
        entityType: 'product',
        entityId: p.id,
        title: p.name,
        message: `Unusually large pack size detected: ${p.pack}${p.packUnit || 'g'}. Ensure unit matches baseline metrics.`,
        severity: 'advisory',
        fixTarget: { entityType: 'product', entityId: p.id }
      });
    }
  });

  // Recipe calorie outliers
  recipes.forEach(r => {
    const serves = Number(r.serves) || 1;
    const rawCal = Number(r.cal) || 0;
    const calPerServing = rawCal / serves;

    if (calPerServing > 1500) {
      advisories.push({
        key: `advisory:recipe-high-cal:${r.id}`,
        entityType: 'recipe',
        entityId: r.id,
        title: r.name,
        message: `Unusually high calories per serving detected: ${Math.round(calPerServing)} kcal (baseline serves ${serves}).`,
        severity: 'advisory',
        fixTarget: { entityType: 'recipe', entityId: r.id }
      });
    } else if (rawCal > 0 && calPerServing < 150) {
      advisories.push({
        key: `advisory:recipe-low-cal:${r.id}`,
        entityType: 'recipe',
        entityId: r.id,
        title: r.name,
        message: `Unusually low calories per serving detected: ${Math.round(calPerServing)} kcal (baseline serves ${serves}).`,
        severity: 'advisory',
        fixTarget: { entityType: 'recipe', entityId: r.id }
      });
    }
  });

  // Duplicate ingredient normalized names
  const seenNorms = new Map();
  ingredients.forEach(ing => {
    const norm = String(ing.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    if (!norm) return;

    if (seenNorms.has(norm)) {
      const match = seenNorms.get(norm);
      advisories.push({
        key: `advisory:duplicate-ingredient:${ing.id}:${match.id}`,
        entityType: 'ingredient',
        entityId: ing.id,
        title: `${ing.name} & ${match.name}`,
        message: `These ingredients have highly identical normalized names. Consider merging to avoid recipe estimation splitting.`,
        severity: 'advisory',
        fixTarget: { entityType: 'ingredient', entityId: ing.id },
        duplicateIngredientId: match.id
      });
    } else {
      seenNorms.set(norm, ing);
    }
  });

  // Filter out any dismissed advisories
  const activeAdvisories = advisories.filter(adv => !dismissed.includes(adv.key));

  const totalCount = blockers.length + gaps.length + activeAdvisories.length;

  return {
    blockers,
    gaps,
    advisories: activeAdvisories,
    totalCount
  };
}
