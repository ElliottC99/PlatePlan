/**
 * src/services/DataQualityScannerService.js (v3.20.06)
 * Automated catalogue data quality auditor, anomaly scanner, and advisor with dynamic macro synchronisation.
 * Pure service layer with zero DOM references.
 */

import { getState } from '../store/store.js';
import { buildPantryHierarchy } from '../models/PantryHierarchyModel.js';
import { calculateItemNutrition, rollupNutritionTotals } from './NutritionService.js';

let scanTimer = null;
let lastChecksum = '';
let cachedScanResult = null;

export function runDataQualityScanDebounced(state = {}, callback) {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = setTimeout(() => {
    const res = runDataQualityScan(state);
    if (typeof callback === 'function') callback(res);
  }, 250);
  return cachedScanResult || runDataQualityScan(state);
}

export function runDataQualityDiagnostics(state = {}, verbose = true) {
  const res = runDataQualityScan(state, { force: true, verbose });
  return res;
}

export function calculateRecipeDynamicMacros(recipe, ingredientsList = [], productsList = []) {
  if (!recipe || typeof recipe !== 'object') return null;
  const rawIngs = recipe.ingredients || recipe.recipe?.ingredients || recipe.parsedIngredients || [];
  const items = Array.isArray(rawIngs) ? rawIngs : (typeof rawIngs === 'object' ? Object.values(rawIngs) : []);
  if (!items.length) return null;

  const productMap = new Map();
  (productsList || []).forEach(p => { if (p?.id) productMap.set(String(p.id), p); });

  const ingredientMap = new Map();
  (ingredientsList || []).forEach(i => { if (i?.id) ingredientMap.set(String(i.id), i); });

  const nutritionList = [];

  items.forEach(item => {
    if (item.excludeNutrition) return;
    let matchedSource = null;
    if (item.productId && productMap.has(String(item.productId))) {
      matchedSource = productMap.get(String(item.productId));
    }
    if (!matchedSource && item.ingredientId) {
      const ing = ingredientMap.get(String(item.ingredientId));
      if (ing) {
        if (item.subtypeId && Array.isArray(ing.subtypes)) {
          const sub = ing.subtypes.find(s => String(s.id) === String(item.subtypeId));
          if (sub && sub.defaultProduct) matchedSource = productMap.get(String(sub.defaultProduct));
        }
        if (!matchedSource && ing.defaultProduct) matchedSource = productMap.get(String(ing.defaultProduct));
        if (!matchedSource && ing.cal !== undefined) matchedSource = ing;
      }
    }
    if (!matchedSource && item.name) {
      const qName = String(item.name).toLowerCase().trim();
      matchedSource = (productsList || []).find(p => String(p.name || '').toLowerCase().includes(qName)) ||
                      (ingredientsList || []).find(i => String(i.name || '').toLowerCase().includes(qName));
    }

    if (matchedSource) {
      const qty = Number(item.qty ?? item.amount ?? item.quantity ?? 1) || 1;
      const unit = item.unit || item.measure || 'g';
      nutritionList.push(calculateItemNutrition(matchedSource, qty, unit));
    }
  });

  if (!nutritionList.length) return null;
  const serves = Number(recipe.serves ?? recipe.recipe?.serves ?? 2) || 2;
  return rollupNutritionTotals(nutritionList, serves);
}

export function runDataQualityScan(state = {}, options = {}) {
  const ingredientsList = Array.isArray(state.ingredients) ? state.ingredients : Object.values(state.ingredients || {});
  const productsList = Array.isArray(state.products) ? state.products : Object.values(state.products || {});
  const recipes = Array.isArray(state.recipes) ? state.recipes : Object.values(state.recipes || {});

  const checksum = `${ingredientsList.length}_${productsList.length}_${recipes.length}`;
  if (!options.force && checksum === lastChecksum && cachedScanResult) {
    return cachedScanResult;
  }
  lastChecksum = checksum;

  if (options.verbose) {
    console.log(`[DataQualityScanner] Auditing ${ingredientsList.length} ingredients against ${productsList.length} products.`);
  }

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

  const hierarchy = buildPantryHierarchy(ingredientsList, productsList);
  const ingredients = [];
  hierarchy.forEach(catGroup => {
    if (Array.isArray(catGroup.ingredients)) {
      ingredients.push(...catGroup.ingredients);
    }
  });

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
    const hasSubtypeDefault = (ing.subtypes || []).some(st => !!st.defaultProduct);

    if (totalProducts > 0 && !autoDefault && !hasBaseNutrition && !hasSubtypeDefault) {
      blockers.push({
        key: `blocker:ingredient:${ing.id}:no-default`,
        entityType: 'ingredient',
        entityId: ing.id,
        title: ing.name,
        message: `Has products in catalogue but lacks a designated "Auto default" product for calorie/protein estimates.`,
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
        message: `This ingredient has zero mapped products in the Product Bank.`,
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

  // Recipe calorie outliers with dynamic macro synchronisation
  recipes.forEach(r => {
    const serves = Number(r.serves) || 2;
    const rawCal = Number(r.cal ?? r.calories ?? r.macros?.cal ?? r.macros?.calories ?? 0);
    const calPerServing = serves > 0 ? (rawCal / serves) : rawCal;

    const dynamic = calculateRecipeDynamicMacros(r, ingredientsList, productsList);
    const dynamicCalPerServing = dynamic ? dynamic.perServing.cal : null;

    if (calPerServing > 1500) {
      advisories.push({
        key: `advisory:recipe-high-cal:${r.id}`,
        entityType: 'recipe',
        entityId: r.id,
        title: r.name || r.title,
        message: `Unusually high calories per serving detected: ${Math.round(calPerServing)} kcal (baseline serves ${serves}).`,
        severity: 'advisory',
        fixTarget: { entityType: 'recipe', entityId: r.id }
      });
    } else if (rawCal > 0 && calPerServing < 200) {
      if (dynamicCalPerServing !== null && dynamicCalPerServing >= 200) {
        advisories.push({
          key: `advisory:recipe-macro-sync:${r.id}`,
          entityType: 'recipe',
          entityId: r.id,
          title: r.name || r.title,
          message: `Static recipe macros are out of sync with dynamic ingredient calculation.`,
          severity: 'advisory',
          isMacroSyncError: true,
          fixTarget: { entityType: 'recipe', entityId: r.id }
        });
      } else {
        advisories.push({
          key: `advisory:recipe-low-cal:${r.id}`,
          entityType: 'recipe',
          entityId: r.id,
          title: r.name || r.title,
          message: `Unusually low calories per serving detected: ${Math.round(calPerServing)} kcal (baseline serves ${serves}).`,
          severity: 'advisory',
          fixTarget: { entityType: 'recipe', entityId: r.id }
        });
      }
    }
  });

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
        message: `These ingredients have highly identical normalised names. Consider merging to avoid recipe estimation splitting.`,
        severity: 'advisory',
        fixTarget: { entityType: 'ingredient', entityId: ing.id },
        duplicateIngredientId: match.id
      });
    } else {
      seenNorms.set(norm, ing);
    }
  });

  const activeAdvisories = advisories.filter(adv => !dismissed.includes(adv.key));
  const totalCount = blockers.length + gaps.length + activeAdvisories.length;

  cachedScanResult = {
    blockers,
    gaps,
    advisories: activeAdvisories,
    totalCount
  };

  return cachedScanResult;
}
