/**
 * src/services/RecipeProductSolver.js
 * Pure, zero-DOM combinatorial product selection engine for PlatePlan.
 * Evaluates combinations of pantry products across a recipe's ingredients to
 * maximize Fit Score for a specific (variant, mealType, activeProfile) context
 * using pre-indexed pools, constant folding, interval-bounded Branch-and-Bound,
 * and 2D bucketed DP fallback.
 */

import {
  calculateItemNutrition,
  resolveProductItemWeight,
  classifyIngredientRole
} from './NutritionService.js';
import { compareProductsByStrategy } from './PantryHierarchyService.js';
import {
  DEFAULT_SPLITS,
  resolveFitScoreParams,
  calculateCalorieScoreWithParams,
  calculateProteinScoreWithParams,
  extractRecipeIngredients
} from '../utils/fitScoreWeights.js';

const DISCRETE_UNITS = new Set(['', 'qty', 'piece', 'pieces', 'item', 'items', 'patty', 'patties', 'burger', 'burgers', 'slice', 'slices', 'each', 'unit', 'units', 'fillet', 'fillets', 'egg', 'eggs', 'clove', 'cloves', 'bunch', 'bunches', 'sprig', 'sprigs', 'tin', 'tins', 'can', 'cans', 'pack', 'packs']);
const CHURN_GATE_POINTS = 3;
const BNB_MAX_VARIABLE_LINES = 6;
const BNB_MAX_NODES = 2500;
const DP_MAX_OPTIONS_PER_LINE = 12;
const DP_MAX_STATES = 600;
const MEMO_MAX_ENTRIES = 3000;

let catalogEpoch = 1;
let prefsEpoch = 1;
const catalogIndexWeakMap = new WeakMap();
const solverMemoCache = new Map();

export function bumpSolverCatalogEpoch() {
  catalogEpoch += 1;
  solverMemoCache.clear();
  return catalogEpoch;
}

export function bumpSolverPrefsEpoch() {
  prefsEpoch += 1;
  solverMemoCache.clear();
  return prefsEpoch;
}

export function invalidateSolverCache() {
  catalogEpoch += 1;
  prefsEpoch += 1;
  solverMemoCache.clear();
}

function normalizeId(val) {
  if (val === undefined || val === null || val === '') return null;
  return String(val).replace(/^grp_/, '');
}

/**
 * Builds an O(P + I) indexed view of the pantry catalog.
 * Cached via WeakMap on the products array reference paired with ingredients length/epoch.
 */
export function buildCatalogIndex(products = [], ingredients = []) {
  const prodsList = Array.isArray(products) ? products : [];
  const ingsList = Array.isArray(ingredients) ? ingredients : [];

  if (Array.isArray(products)) {
    const cached = catalogIndexWeakMap.get(products);
    if (
      cached &&
      cached.productsLen === prodsList.length &&
      cached.ingredientsRef === ingredients &&
      cached.ingredientsLen === ingsList.length &&
      cached.epoch === catalogEpoch
    ) {
      return cached.index;
    }
  }

  const productsById = new Map();
  const productsBySubtypeId = new Map();
  const productsByIngredientId = new Map();
  const productsByCategoryLower = new Map();
  const productsByNameLower = new Map();
  const ingredientsById = new Map();
  const ingredientsByNameLower = new Map();
  const subtypeById = new Map();
  const subtypeToRootId = new Map();

  for (const ing of ingsList) {
    if (!ing || !ing.id) continue;
    const idStr = String(ing.id);
    ingredientsById.set(idStr, ing);
    const nameKey = String(ing.name || '').trim().toLowerCase();
    if (nameKey && !ingredientsByNameLower.has(nameKey)) {
      ingredientsByNameLower.set(nameKey, ing);
    }
    if (Array.isArray(ing.subtypes)) {
      for (const sub of ing.subtypes) {
        if (!sub || !sub.id) continue;
        const subIdStr = String(sub.id);
        subtypeById.set(subIdStr, sub);
        subtypeToRootId.set(subIdStr, idStr);
      }
    }
  }

  const pushToMap = (map, key, val) => {
    if (!key) return;
    let list = map.get(key);
    if (!list) {
      list = [];
      map.set(key, list);
    }
    list.push(val);
  };

  for (const prod of prodsList) {
    if (!prod || !prod.id) continue;
    const pId = String(prod.id);
    productsById.set(pId, prod);

    const pName = String(prod.name || '').trim().toLowerCase();
    if (pName && !productsByNameLower.has(pName)) {
      productsByNameLower.set(pName, prod);
    }

    const subId = prod.subtypeId || prod.subTypeId;
    if (subId) {
      const subStr = String(subId);
      pushToMap(productsBySubtypeId, subStr, prod);
      const rootFromSub = subtypeToRootId.get(subStr);
      if (rootFromSub) {
        pushToMap(productsByIngredientId, rootFromSub, prod);
      }
    }

    const rootId = normalizeId(prod.ingredientId || prod.pantryItemId);
    if (rootId) {
      const existing = productsByIngredientId.get(rootId);
      if (!existing || !existing.includes(prod)) {
        pushToMap(productsByIngredientId, rootId, prod);
      }
    }

    const cat = String(prod.category || prod.cat || '').trim().toLowerCase();
    if (cat) {
      pushToMap(productsByCategoryLower, cat, prod);
    }
  }

  // Also ensure category index includes products belonging to root items in that category
  for (const ing of ingsList) {
    const cat = String(ing?.category || '').trim().toLowerCase();
    if (!cat || !ing?.id) continue;
    const rootProds = productsByIngredientId.get(String(ing.id)) || [];
    for (const prod of rootProds) {
      const existing = productsByCategoryLower.get(cat);
      if (!existing || !existing.includes(prod)) {
        pushToMap(productsByCategoryLower, cat, prod);
      }
    }
  }

  const index = {
    products: prodsList,
    ingredients: ingsList,
    productsById,
    productsBySubtypeId,
    productsByIngredientId,
    productsByCategoryLower,
    productsByNameLower,
    ingredientsById,
    ingredientsByNameLower,
    subtypeById,
    subtypeToRootId
  };

  if (Array.isArray(products)) {
    catalogIndexWeakMap.set(products, {
      productsLen: prodsList.length,
      ingredientsRef: ingredients,
      ingredientsLen: ingsList.length,
      epoch: catalogEpoch,
      index
    });
  }

  return index;
}

/**
 * Resolves a stable, collision-safe key for an ingredient line within a recipe.
 */
export function buildRecipeLineKeys(ingredients = []) {
  const counts = new Map();
  const baseKeys = ingredients.map((line, idx) => {
    if (!line || typeof line !== 'object') return `line_${idx}`;
    const subId = line.subtypeId || line.subTypeId;
    const ingId = normalizeId(line.ingredientId || line.pantryItemId || line.groupId);
    const catId = line.categoryId || line.category || line.cat;
    const name = String(line.name || line.raw || '').trim().toLowerCase();
    const base = subId ? String(subId)
      : (ingId ? String(ingId)
        : (catId ? `cat:${String(catId).trim().toLowerCase()}` : (name || `line_${idx}`)));
    counts.set(base, (counts.get(base) || 0) + 1);
    return base;
  });

  const seen = new Map();
  return baseKeys.map((base) => {
    if ((counts.get(base) || 0) <= 1) return base;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
}

function resolveOverrideProduct(line, lineKey, productOverrides, index) {
  if (!productOverrides || typeof productOverrides !== 'object') return null;
  const subId = line?.subtypeId || line?.subTypeId || null;
  const ingId = normalizeId(line?.ingredientId || line?.pantryItemId || line?.groupId);
  const catId = line?.categoryId || line?.category || line?.cat || null;
  const prodId = line?.productId || line?.bankId || null;
  const rawName = String(line?.name || line?.raw || '').trim();

  const keys = [
    lineKey,
    subId,
    ingId,
    catId ? `cat:${String(catId).trim().toLowerCase()}` : null,
    catId,
    prodId,
    rawName
  ].filter(Boolean).map(String);

  for (const k of keys) {
    const val = productOverrides[k];
    if (!val) continue;
    const targetId = typeof val === 'object' ? (val.productId || val.id) : val;
    if (!targetId) continue;
    const found = index.productsById.get(String(targetId))
      || index.productsByNameLower.get(String(targetId).trim().toLowerCase());
    if (found) return found;
  }
  return null;
}

function pickBaselineFromPool(pool, explicitDefaultId, criterion, { respectExplicitAutoDefault = true } = {}) {
  if (!pool || pool.length === 0) return null;
  if (explicitDefaultId) {
    const def = pool.find(p => String(p.id) === String(explicitDefaultId));
    if (def) return def;
  }
  if (respectExplicitAutoDefault) {
    const explicitAuto = pool.find(p => p && p.isAutoDefault);
    if (explicitAuto) return explicitAuto;
  }
  const sorted = [...pool].sort((a, b) => compareProductsByStrategy(a, b, criterion));
  return sorted[0] || null;
}

/**
 * Builds the culinary-safe candidate pool and baseline product for a single recipe ingredient line.
 * Binding precedence: productOverrides > subtypeId > ingredientId > categoryId > productId > name.
 */
export function buildLineCandidates(line, lineKey, index, { criterion = 'highest_protein_per_kcal', productOverrides = null } = {}) {
  if (!line || typeof line !== 'object') {
    return { pool: [], baseline: null, pinned: false, bindingLevel: 'none' };
  }

  // 0. Explicit override (manual swap or frozen plan selection)
  const overrideProd = resolveOverrideProduct(line, lineKey, productOverrides, index);
  if (overrideProd) {
    return { pool: [overrideProd], baseline: overrideProd, pinned: true, bindingLevel: 'override' };
  }

  const subId = line.subtypeId || line.subTypeId || null;
  const ingId = normalizeId(line.ingredientId || line.pantryItemId || line.groupId);
  const cat = line.categoryId || line.category || line.cat || null;
  const directProdId = line.productId || line.bankId || null;

  // 1. Sub-Type binding (locked within sub-type for culinary safety)
  if (subId) {
    const subStr = String(subId);
    const subObj = index.subtypeById.get(subStr);
    const subPool = index.productsBySubtypeId.get(subStr) || [];
    if (subPool.length > 0) {
      const defProd = subObj?.defaultProductId ? index.productsById.get(String(subObj.defaultProductId)) : null;
      const pool = defProd && !subPool.includes(defProd) ? [defProd, ...subPool] : subPool;
      const baseline = pickBaselineFromPool(pool, subObj?.defaultProductId, criterion, { respectExplicitAutoDefault: true });
      return { pool, baseline, pinned: false, bindingLevel: 'subtype' };
    }
    if (subObj?.defaultProductId) {
      const defProd = index.productsById.get(String(subObj.defaultProductId));
      if (defProd) return { pool: [defProd], baseline: defProd, pinned: false, bindingLevel: 'subtype' };
    }
    // Fall through to root item only if sub-type has 0 products
  }

  // 2. Root Item binding (explores sibling sub-types bi-directionally)
  if (ingId) {
    const rootItem = index.ingredientsById.get(String(ingId));
    const rootPool = index.productsByIngredientId.get(String(ingId)) || [];
    if (rootPool.length > 0) {
      const defProd = rootItem?.defaultProductId ? index.productsById.get(String(rootItem.defaultProductId)) : null;
      const pool = defProd && !rootPool.includes(defProd) ? [defProd, ...rootPool] : rootPool;
      const baseline = pickBaselineFromPool(pool, rootItem?.defaultProductId, criterion, { respectExplicitAutoDefault: true });
      return { pool, baseline, pinned: false, bindingLevel: 'ingredient' };
    }
    if (rootItem?.defaultProductId) {
      const defProd = index.productsById.get(String(rootItem.defaultProductId));
      if (defProd) return { pool: [defProd], baseline: defProd, pinned: false, bindingLevel: 'ingredient' };
    }
  }

  // 3. Category binding (guarded by culinary role + discrete item weight)
  if (cat) {
    const normCat = String(cat).trim().toLowerCase();
    const rawPool = index.productsByCategoryLower.get(normCat) || [];
    if (rawPool.length > 0) {
      const baseline = pickBaselineFromPool(rawPool, null, criterion, { respectExplicitAutoDefault: false });
      const lineRole = classifyIngredientRole(line);
      const unitNorm = String(line.unit || '').trim().toLowerCase();
      const isDiscrete = DISCRETE_UNITS.has(unitNorm);

      let filtered = rawPool;
      if (lineRole !== 'other') {
        const roleMatches = filtered.filter(p => classifyIngredientRole(p, p) === lineRole);
        if (roleMatches.length > 0) filtered = roleMatches;
      }
      if (isDiscrete) {
        const weighted = filtered.filter(p => resolveProductItemWeight(p) > 0);
        if (weighted.length > 0) filtered = weighted;
      }
      if (filtered.length === 0 && baseline) filtered = [baseline];
      const finalBaseline = filtered.includes(baseline) ? baseline : pickBaselineFromPool(filtered, null, criterion, { respectExplicitAutoDefault: false });
      return { pool: filtered, baseline: finalBaseline, pinned: false, bindingLevel: 'category' };
    }
  }

  // 4. Direct productId binding (fixed/pinned when no taxonomy binding exists)
  if (directProdId) {
    const matched = index.productsById.get(String(directProdId));
    if (matched) return { pool: [matched], baseline: matched, pinned: true, bindingLevel: 'product' };
  }

  // 5. Name fallback (exact product or exact root item name)
  const rawName = String(line.name || line.matchedName || line.ingredient || '').trim().toLowerCase();
  if (rawName) {
    const exactProd = index.productsByNameLower.get(rawName);
    if (exactProd) return { pool: [exactProd], baseline: exactProd, pinned: false, bindingLevel: 'name' };

    const exactRoot = index.ingredientsByNameLower.get(rawName);
    if (exactRoot) {
      const rootPool = index.productsByIngredientId.get(String(exactRoot.id)) || [];
      if (rootPool.length > 0) {
        const baseline = pickBaselineFromPool(rootPool, exactRoot.defaultProductId, criterion, { respectExplicitAutoDefault: true });
        return { pool: rootPool, baseline, pinned: false, bindingLevel: 'name' };
      }
    }
  }

  return { pool: [], baseline: null, pinned: false, bindingLevel: 'none' };
}

function getTargetForProfile(profile, type, meal) {
  if (!profile || typeof profile !== 'object') return 0;
  const normMeal = String(meal || 'dinner').toLowerCase();
  const altMeal = normMeal === 'snack' ? 'snacking' : (normMeal === 'snacking' ? 'snack' : normMeal);

  const override = profile.meals?.[normMeal]?.[type] ?? profile.meals?.[altMeal]?.[type];
  if (override !== undefined && override !== null && Number(override) > 0) {
    return Number(override);
  }

  const daily = type === 'kcal'
    ? (Number(profile.dailyKcal ?? profile.cal) || 0)
    : (Number(profile.dailyProtein ?? profile.prot) || 0);
  if (daily <= 0) return 0;

  const splitKey = type === 'kcal' ? 'calorieSplits' : 'proteinSplits';
  const splitsObj = profile[splitKey] || {};
  const rawSplit = splitsObj[normMeal] ?? splitsObj[altMeal];
  if (rawSplit !== undefined && rawSplit !== null && !Number.isNaN(Number(rawSplit))) {
    if (Number(rawSplit) <= 0) return 0;
    return daily * (Number(rawSplit) / 100);
  }
  const splitPct = DEFAULT_SPLITS[normMeal] ?? 35;
  return daily * (splitPct / 100);
}

function resolveProfilesFromPrefs(preferences = {}) {
  const p = preferences || {};
  const rawProfiles = p.profiles || {};
  const nutritionTargets = p.nutritionTargets || {};
  const eRaw = rawProfiles.elliott || rawProfiles.e || {};
  const cRaw = rawProfiles.chloe || rawProfiles.c || {};
  const eTargets = nutritionTargets.elliott || {};
  const cTargets = nutritionTargets.chloe || {};

  return {
    elliott: {
      ...eTargets,
      ...eRaw,
      dailyKcal: Number(eRaw.dailyKcal ?? eTargets.dailyKcal ?? p.elliottCal ?? p.ecal ?? 2100) || 2100,
      dailyProtein: Number(eRaw.dailyProtein ?? eTargets.dailyProtein ?? p.elliottProt ?? p.eprot ?? 140) || 140
    },
    chloe: {
      ...cTargets,
      ...cRaw,
      dailyKcal: Number(cRaw.dailyKcal ?? cTargets.dailyKcal ?? p.chloeCal ?? p.ccal ?? 1650) || 1650,
      dailyProtein: Number(cRaw.dailyProtein ?? cTargets.dailyProtein ?? p.chloeProt ?? p.cprot ?? 105) || 105
    }
  };
}

/**
 * Compiles meal targets, household split multipliers, and curve parameters once per solve.
 */
export function compileScoringContext(recipe, mealType = 'dinner', activeProfile = 'everyone', preferences = {}, customFitScoreParams = null) {
  const normMeal = String(mealType || 'dinner').toLowerCase();
  const rawProfile = String(activeProfile || 'everyone').toLowerCase();
  const normProfile = (rawProfile === 'both' || rawProfile === 'all') ? 'everyone' : rawProfile;

  const { elliott: profileE, chloe: profileC } = resolveProfilesFromPrefs(preferences);
  const params = resolveFitScoreParams(customFitScoreParams || preferences?.fitScoreParams || {});

  const targetCalE = getTargetForProfile(profileE, 'kcal', normMeal);
  const targetProtE = getTargetForProfile(profileE, 'protein', normMeal);
  const targetCalC = getTargetForProfile(profileC, 'kcal', normMeal);
  const targetProtC = getTargetForProfile(profileC, 'protein', normMeal);

  const totalHH = (Number(profileE.dailyKcal) || 0) + (Number(profileC.dailyKcal) || 0);
  const shareE = totalHH > 0 ? (Number(profileE.dailyKcal) / totalHH) : 0.5;
  const shareC = totalHH > 0 ? (Number(profileC.dailyKcal) / totalHH) : 0.5;

  const serves = Number(recipe?.serves || recipe?.servings || recipe?.yield || 2);
  const isSnack = normMeal === 'snack' || normMeal === 'snacking'
    || String(recipe?.type || '').toLowerCase() === 'snack'
    || (Array.isArray(recipe?.types) && recipe.types.some(t => String(t).toLowerCase() === 'snack'));
  const batchSize = (serves === 1 || isSnack) ? 1 : 2;

  const multE = Number.isFinite(batchSize * shareE) ? (batchSize * shareE) : 1;
  const multC = Number.isFinite(batchSize * shareC) ? (batchSize * shareC) : 1;

  return {
    mealType: normMeal,
    activeProfile: normProfile,
    params,
    calWeight: params.calorieWeight ?? 0.5,
    protWeight: params.proteinWeight ?? 0.5,
    targetCalE,
    targetProtE,
    targetCalC,
    targetProtC,
    hasTargetE: targetCalE > 0 && targetProtE > 0,
    hasTargetC: targetCalC > 0 && targetProtC > 0,
    multE,
    multC
  };
}

/**
 * Zero-allocation O(1) Fit Score evaluator matching calculateSingleMealTypeFitScore exactly.
 */
export function scoreMacroPair(perServingCal, perServingProt, ctx) {
  if (perServingCal <= 0 || perServingProt <= 0) {
    return { finalScore: 0, fitScoreE: 0, fitScoreC: 0, minScore: 0 };
  }

  const calScoreE = calculateCalorieScoreWithParams(perServingCal * ctx.multE, ctx.targetCalE, ctx.params);
  const protScoreE = calculateProteinScoreWithParams(perServingProt * ctx.multE, ctx.targetProtE, ctx.params);
  const calScoreC = calculateCalorieScoreWithParams(perServingCal * ctx.multC, ctx.targetCalC, ctx.params);
  const protScoreC = calculateProteinScoreWithParams(perServingProt * ctx.multC, ctx.targetProtC, ctx.params);

  const fitScoreE = Math.round((calScoreE * ctx.calWeight) + (protScoreE * ctx.protWeight));
  const fitScoreC = Math.round((calScoreC * ctx.calWeight) + (protScoreC * ctx.protWeight));

  let finalScore = 0;
  let minScore = 0;
  if (ctx.activeProfile === 'elliott' || ctx.activeProfile === 'e') {
    finalScore = fitScoreE;
    minScore = fitScoreE;
  } else if (ctx.activeProfile === 'chloe' || ctx.activeProfile === 'c') {
    finalScore = fitScoreC;
    minScore = fitScoreC;
  } else {
    if (ctx.hasTargetE && ctx.hasTargetC) {
      finalScore = Math.round((fitScoreE * 0.5) + (fitScoreC * 0.5));
      minScore = Math.min(fitScoreE, fitScoreC);
    } else if (ctx.hasTargetE) {
      finalScore = fitScoreE;
      minScore = fitScoreE;
    } else if (ctx.hasTargetC) {
      finalScore = fitScoreC;
      minScore = fitScoreC;
    }
  }

  return { finalScore, fitScoreE, fitScoreC, minScore };
}

function maxUnimodalScore(lo, hi, target, mult, scoreFn, minOpt, maxOpt) {
  if (!target || target <= 0) return 0;
  const rLo = (lo * mult) / target;
  const rHi = (hi * mult) / target;
  if (rHi >= minOpt && rLo <= maxOpt) return 100;
  const sLo = scoreFn(lo * mult, target);
  const sHi = scoreFn(hi * mult, target);
  return sLo >= sHi ? sLo : sHi;
}

function computeUpperBound(calLo, calHi, protLo, protHi, ctx) {
  const p = ctx.params;
  const calFn = (a, t) => calculateCalorieScoreWithParams(a, t, p);
  const protFn = (a, t) => calculateProteinScoreWithParams(a, t, p);

  const maxCalE = maxUnimodalScore(calLo, calHi, ctx.targetCalE, ctx.multE, calFn, p.calMinOpt, p.calMaxOpt);
  const maxProtE = maxUnimodalScore(protLo, protHi, ctx.targetProtE, ctx.multE, protFn, p.protMinOpt, p.protMaxOpt);
  const ubE = Math.min(100, Math.round(maxCalE * ctx.calWeight + maxProtE * ctx.protWeight) + 1);

  if (ctx.activeProfile === 'elliott' || ctx.activeProfile === 'e') return ubE;

  const maxCalC = maxUnimodalScore(calLo, calHi, ctx.targetCalC, ctx.multC, calFn, p.calMinOpt, p.calMaxOpt);
  const maxProtC = maxUnimodalScore(protLo, protHi, ctx.targetProtC, ctx.multC, protFn, p.protMinOpt, p.protMaxOpt);
  const ubC = Math.min(100, Math.round(maxCalC * ctx.calWeight + maxProtC * ctx.protWeight) + 1);

  if (ctx.activeProfile === 'chloe' || ctx.activeProfile === 'c') return ubC;
  if (ctx.hasTargetE && ctx.hasTargetC) return Math.min(100, Math.round(ubE * 0.5 + ubC * 0.5) + 1);
  return ctx.hasTargetE ? ubE : ubC;
}

/**
 * Lexicographic comparator returning true if candidate A strictly beats candidate B.
 * Order: finalScore (desc) > minScore (desc, shared only) > departures (asc) > strategyRank (asc) > cost (asc).
 */
function isBetterCombo(a, b, isShared) {
  if (!b) return true;
  if (a.finalScore !== b.finalScore) return a.finalScore > b.finalScore;
  if (isShared && a.minScore !== b.minScore) return a.minScore > b.minScore;
  if (a.departures !== b.departures) return a.departures < b.departures;
  if (a.strategyRank !== b.strategyRank) return a.strategyRank < b.strategyRank;
  return a.cost < b.cost - 1e-6;
}

function buildRecipeFingerprint(recipe, variant, ingredients, serves) {
  const id = String(recipe?.id || recipe?.name || recipe?.title || 'anon');
  let qtySum = 0;
  let token = '';
  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    if (!ing || ing.excludeNutrition) continue;
    qtySum += Number(ing.qty ?? ing.quantity ?? ing.amount ?? 1) || 0;
    if (i === 0 || i === ingredients.length - 1 || i % 3 === 0) {
      token += `|${ing.subtypeId || ing.ingredientId || ing.categoryId || ing.productId || ing.name || ''}:${ing.unit || ''}`;
    }
  }
  return `${id}::${variant}::s${serves}::n${ingredients.length}::q${Math.round(qtySum * 100)}${token}`;
}

function solveForSingleMealType(recipe, variant, ingredients, lineKeys, index, ctx, { criterion, productOverrides }) {
  const servesRaw = variant === 'enhanced'
    ? (recipe?.enhanced?.servings ?? recipe?.enhanced?.serves ?? recipe?.servings ?? recipe?.serves ?? 1)
    : (recipe?.servings ?? recipe?.serves ?? 1);
  const serves = Math.max(1, Number(servesRaw) || 1);

  const lineEntries = [];
  let fixedCal = 0;
  let fixedProt = 0;
  let fixedCost = 0;
  let matchedCount = 0;
  let nutritionLineCount = 0;
  let unresolvedMajorCount = 0;
  let hasOverride = false;

  const fixedSelections = new Map();
  const baselineSelections = new Map();
  let baselineCal = 0;
  let baselineProt = 0;
  let baselineCost = 0;

  for (let i = 0; i < ingredients.length; i++) {
    const line = ingredients[i];
    const lineKey = lineKeys[i];
    if (!line || line.excludeNutrition) continue;
    nutritionLineCount++;

    const { pool, baseline, pinned, bindingLevel } = buildLineCandidates(line, lineKey, index, {
      criterion,
      productOverrides
    });
    if (bindingLevel === 'override') hasOverride = true;

    if (!baseline || pool.length === 0) {
      const role = classifyIngredientRole(line);
      if (role !== 'seasoning' && role !== 'produce') {
        unresolvedMajorCount++;
      }
      continue;
    }

    matchedCount++;
    const qty = Number(line.qty ?? line.quantity ?? line.amount ?? 1) || 1;
    const unit = line.unit || 'g';
    const nutOpts = {
      isCloveCount: Boolean(line.isCloveCount || /\bcloves?\b/i.test(line.raw || ''))
    };

    const baseNut = calculateItemNutrition(baseline, qty, unit, nutOpts);
    const baseLineCal = (baseNut.kcal ?? baseNut.cal ?? 0) / serves;
    const baseLineProt = (baseNut.protein ?? baseNut.prot ?? 0) / serves;
    const baseLineCost = (baseNut.cost ?? 0) / serves;

    baselineCal += baseLineCal;
    baselineProt += baseLineProt;
    baselineCost += baseLineCost;
    baselineSelections.set(lineKey, baseline);

    if (pinned || pool.length <= 1) {
      fixedCal += baseLineCal;
      fixedProt += baseLineProt;
      fixedCost += baseLineCost;
      fixedSelections.set(lineKey, baseline);
      continue;
    }

    // Sort candidates by household strategy so strategyRank reflects preference order
    const sortedPool = [...pool].sort((a, b) => compareProductsByStrategy(a, b, criterion));
    const scoredOptions = sortedPool.map((prod, rankIdx) => {
      const isBase = String(prod.id) === String(baseline.id);
      const nut = isBase ? baseNut : calculateItemNutrition(prod, qty, unit, nutOpts);
      return {
        product: prod,
        cal: (nut.kcal ?? nut.cal ?? 0) / serves,
        prot: (nut.protein ?? nut.prot ?? 0) / serves,
        cost: (nut.cost ?? 0) / serves,
        isBaseline: isBase,
        strategyRank: rankIdx
      };
    });

    // Check macro spread — fold zero-variance lines into fixed baseline
    let minC = Infinity, maxC = -Infinity, minP = Infinity, maxP = -Infinity;
    for (const opt of scoredOptions) {
      if (opt.cal < minC) minC = opt.cal;
      if (opt.cal > maxC) maxC = opt.cal;
      if (opt.prot < minP) minP = opt.prot;
      if (opt.prot > maxP) maxP = opt.prot;
    }

    if ((maxC - minC) < 0.5 && (maxP - minP) < 0.05) {
      fixedCal += baseLineCal;
      fixedProt += baseLineProt;
      fixedCost += baseLineCost;
      fixedSelections.set(lineKey, baseline);
      continue;
    }

    // Tight macro bucketing only when > 6 candidates, always preserving baseline unpruned
    let prunedOptions = scoredOptions;
    if (scoredOptions.length > 6) {
      const buckets = new Map();
      for (const opt of scoredOptions) {
        const bKey = `${Math.round(opt.cal)}:${Math.round(opt.prot * 10)}`;
        const prev = buckets.get(bKey);
        if (!prev || opt.isBaseline || (!prev.isBaseline && opt.strategyRank < prev.strategyRank)) {
          buckets.set(bKey, opt);
        }
      }
      prunedOptions = Array.from(buckets.values());
    }

    // Recompute min/max after bucketing and put baseline first for fast incumbent seeding
    prunedOptions.sort((a, b) => (b.isBaseline ? 1 : 0) - (a.isBaseline ? 1 : 0) || a.strategyRank - b.strategyRank);

    lineEntries.push({
      lineKey,
      line,
      baseline,
      options: prunedOptions,
      minCal: minC,
      maxCal: maxC,
      minProt: minP,
      maxProt: maxP,
      swing: (maxC - minC) + 10 * (maxP - minP)
    });
  }

  // Join-order variable lines descending by macro swing BEFORE building baselineResult.chosen
  // so baselineResult.chosen[i] always aligns 1:1 with lineEntries[i].
  lineEntries.sort((a, b) => b.swing - a.swing);

  const baselineEval = scoreMacroPair(baselineCal, baselineProt, ctx);
  const baselineResult = {
    finalScore: baselineEval.finalScore,
    fitScoreE: baselineEval.fitScoreE,
    fitScoreC: baselineEval.fitScoreC,
    minScore: baselineEval.minScore,
    cal: baselineCal,
    prot: baselineProt,
    cost: baselineCost,
    departures: 0,
    strategyRank: 0,
    chosen: lineEntries.map(e => e.options.find(o => o.isBaseline) || e.options[0])
  };

  if (lineEntries.length === 0 || matchedCount === 0) {
    return buildSolverOutput({
      winner: baselineResult,
      baselineResult,
      lineEntries,
      fixedSelections,
      baselineSelections,
      matchedCount,
      nutritionLineCount,
      unresolvedMajorCount,
      mealType: ctx.mealType,
      usedCombo: false
    });
  }

  const K = lineEntries.length;
  const isShared = ctx.activeProfile === 'everyone';

  // Suffix envelopes for interval upper bounds
  const sufMinCal = new Array(K + 1).fill(0);
  const sufMaxCal = new Array(K + 1).fill(0);
  const sufMinProt = new Array(K + 1).fill(0);
  const sufMaxProt = new Array(K + 1).fill(0);
  for (let i = K - 1; i >= 0; i--) {
    sufMinCal[i] = sufMinCal[i + 1] + lineEntries[i].minCal;
    sufMaxCal[i] = sufMaxCal[i + 1] + lineEntries[i].maxCal;
    sufMinProt[i] = sufMinProt[i + 1] + lineEntries[i].minProt;
    sufMaxProt[i] = sufMaxProt[i + 1] + lineEntries[i].maxProt;
  }

  let best = {
    ...baselineResult,
    chosen: lineEntries.map(e => e.options.find(o => o.isBaseline) || e.options[0])
  };
  let nodesVisited = 0;
  let exceededBudget = false;
  const currentChosen = new Array(K);

  function branchAndBound(idx, curCal, curProt, curCost, curDep, curRank) {
    if (exceededBudget) return;
    nodesVisited++;
    if (nodesVisited > BNB_MAX_NODES) {
      exceededBudget = true;
      return;
    }

    if (idx === K) {
      const ev = scoreMacroPair(curCal, curProt, ctx);
      const cand = {
        finalScore: ev.finalScore,
        fitScoreE: ev.fitScoreE,
        fitScoreC: ev.fitScoreC,
        minScore: ev.minScore,
        cal: curCal,
        prot: curProt,
        cost: curCost,
        departures: curDep,
        strategyRank: curRank,
        chosen: [...currentChosen]
      };
      if (isBetterCombo(cand, best, isShared)) {
        best = cand;
      }
      return;
    }

    // Admissible upper bound over remaining lines (prune only when strictly worse than best)
    const ub = computeUpperBound(
      curCal + sufMinCal[idx],
      curCal + sufMaxCal[idx],
      curProt + sufMinProt[idx],
      curProt + sufMaxProt[idx],
      ctx
    );
    if (ub < best.finalScore) return;

    const opts = lineEntries[idx].options;
    for (let j = 0; j < opts.length; j++) {
      const opt = opts[j];
      currentChosen[idx] = opt;
      branchAndBound(
        idx + 1,
        curCal + opt.cal,
        curProt + opt.prot,
        curCost + opt.cost,
        curDep + (opt.isBaseline ? 0 : 1),
        curRank + opt.strategyRank
      );
      if (exceededBudget) return;
    }
  }

  if (K <= BNB_MAX_VARIABLE_LINES) {
    branchAndBound(0, fixedCal, fixedProt, fixedCost, 0, 0);
  } else {
    exceededBudget = true;
  }

  // 2D Bucketed DP fallback for outlier recipes with >6 variable lines or huge branching
  if (exceededBudget) {
    let states = new Map();
    const calBucketSize = 5;
    const protBucketScale = 2;
    states.set(`${Math.round(fixedCal / calBucketSize)}:${Math.round(fixedProt * protBucketScale)}`, {
      cal: fixedCal,
      prot: fixedProt,
      cost: fixedCost,
      departures: 0,
      strategyRank: 0,
      chosen: []
    });

    for (let i = 0; i < K; i++) {
      const nextStates = new Map();
      const rawOpts = lineEntries[i].options;
      // Cap per-line branching in DP fallback while preserving baseline and macro-diverse extremes
      let opts = rawOpts;
      if (rawOpts.length > DP_MAX_OPTIONS_PER_LINE) {
        const picked = new Set();
        const baselineOpt = rawOpts.find(o => o.isBaseline) || rawOpts[0];
        if (baselineOpt) picked.add(baselineOpt);
        const byCal = [...rawOpts].sort((a, b) => a.cal - b.cal);
        const byProt = [...rawOpts].sort((a, b) => b.prot - a.prot);
        picked.add(byCal[0]);
        picked.add(byCal[byCal.length - 1]);
        picked.add(byProt[0]);
        picked.add(byProt[byProt.length - 1]);
        for (const o of rawOpts) {
          if (picked.size >= DP_MAX_OPTIONS_PER_LINE) break;
          picked.add(o);
        }
        opts = Array.from(picked);
      }

      for (const st of states.values()) {
        for (const opt of opts) {
          const nCal = st.cal + opt.cal;
          const nProt = st.prot + opt.prot;
          const nCost = st.cost + opt.cost;
          const nDep = st.departures + (opt.isBaseline ? 0 : 1);
          const nRank = st.strategyRank + opt.strategyRank;
          const key = `${Math.round(nCal / calBucketSize)}:${Math.round(nProt * protBucketScale)}`;
          const prev = nextStates.get(key);
          if (
            !prev ||
            nDep < prev.departures ||
            (nDep === prev.departures && (nRank < prev.strategyRank || (nRank === prev.strategyRank && nCost < prev.cost)))
          ) {
            nextStates.set(key, {
              cal: nCal,
              prot: nProt,
              cost: nCost,
              departures: nDep,
              strategyRank: nRank,
              chosen: [...st.chosen, opt]
            });
          }
        }
      }

      // Beam-cap DP state count so extreme category-level recipes stay bounded (<20ms)
      if (nextStates.size > DP_MAX_STATES) {
        const remMinCal = sufMinCal[i + 1];
        const remMaxCal = sufMaxCal[i + 1];
        const remMinProt = sufMinProt[i + 1];
        const remMaxProt = sufMaxProt[i + 1];
        const ranked = Array.from(nextStates.entries()).map(([k, st]) => ({
          k,
          st,
          ub: computeUpperBound(st.cal + remMinCal, st.cal + remMaxCal, st.prot + remMinProt, st.prot + remMaxProt, ctx)
        }));
        ranked.sort((a, b) => b.ub - a.ub || a.st.departures - b.st.departures || a.st.strategyRank - b.st.strategyRank);
        const trimmed = new Map();
        for (let rIdx = 0; rIdx < DP_MAX_STATES; rIdx++) {
          trimmed.set(ranked[rIdx].k, ranked[rIdx].st);
        }
        states = trimmed;
      } else {
        states = nextStates;
      }
    }

    for (const st of states.values()) {
      const ev = scoreMacroPair(st.cal, st.prot, ctx);
      const cand = {
        finalScore: ev.finalScore,
        fitScoreE: ev.fitScoreE,
        fitScoreC: ev.fitScoreC,
        minScore: ev.minScore,
        cal: st.cal,
        prot: st.prot,
        cost: st.cost,
        departures: st.departures,
        strategyRank: st.strategyRank,
        chosen: st.chosen
      };
      if (isBetterCombo(cand, best, isShared)) {
        best = cand;
      }
    }
  }

  // Apply recipe-level +3 pt churn gate over baseline (unless explicit productOverrides pinned a line)
  const passesChurnGate = hasOverride || (best.finalScore >= baselineResult.finalScore + CHURN_GATE_POINTS);
  const winner = passesChurnGate ? best : baselineResult;

  return buildSolverOutput({
    winner,
    baselineResult,
    lineEntries,
    fixedSelections,
    baselineSelections,
    matchedCount,
    nutritionLineCount,
    unresolvedMajorCount,
    mealType: ctx.mealType,
    usedCombo: passesChurnGate && winner.departures > 0
  });
}

function buildSolverOutput({
  winner,
  baselineResult,
  lineEntries,
  fixedSelections,
  baselineSelections,
  matchedCount,
  nutritionLineCount,
  unresolvedMajorCount,
  mealType,
  usedCombo
}) {
  const selections = new Map(fixedSelections);
  const departures = [];

  for (let i = 0; i < lineEntries.length; i++) {
    const entry = lineEntries[i];
    const opt = winner.chosen[i];
    if (!opt || !opt.product) continue;
    selections.set(entry.lineKey, opt.product);
    if (!opt.isBaseline && entry.baseline) {
      departures.push({
        lineKey: entry.lineKey,
        ingredientName: entry.line.name || entry.line.raw || entry.lineKey,
        baselineProductId: entry.baseline.id,
        baselineProductName: entry.baseline.name,
        chosenProductId: opt.product.id,
        chosenProductName: opt.product.name,
        recipeFitLift: winner.finalScore - baselineResult.finalScore
      });
    }
  }

  return {
    mealType,
    score: winner.finalScore,
    baselineScore: baselineResult.finalScore,
    fitLift: winner.finalScore - baselineResult.finalScore,
    fitScoreE: winner.fitScoreE,
    fitScoreC: winner.fitScoreC,
    usedCombo,
    macros: {
      cal: Math.round(winner.cal),
      prot: Math.round(winner.prot * 10) / 10
    },
    baselineMacros: {
      cal: Math.round(baselineResult.cal),
      prot: Math.round(baselineResult.prot * 10) / 10
    },
    selections,
    baselineSelections,
    departures,
    matchedCount,
    nutritionLineCount,
    unresolvedMajorCount,
    isComplete: matchedCount > 0 && unresolvedMajorCount === 0 && winner.cal > 0 && winner.prot > 0
  };
}

function getEligibleMealTypesLocal(recipe) {
  const valid = ['breakfast', 'lunch', 'dinner', 'snack'];
  const rawTypes = Array.isArray(recipe?.types) && recipe.types.length > 0
    ? recipe.types
    : (recipe?.type ? [recipe.type] : ['dinner']);
  const normalized = rawTypes
    .map(t => String(t || '').toLowerCase().trim())
    .map(t => (t === 'snacking' ? 'snack' : t))
    .filter(t => valid.includes(t));
  return normalized.length > 0 ? [...new Set(normalized)] : ['dinner'];
}

/**
 * Solves the optimal pantry product combination for a recipe in the requested context.
 *
 * @param {Object} recipe
 * @param {Object} context - { variant, mealType, activeProfile, products, ingredients, preferences, fitScoreParams, productOverrides }
 */
export function solveOptimalRecipeProducts(recipe, context = {}) {
  const r = recipe?.recipe || recipe || {};
  const variant = context.variant || (r._variant === 'enhanced' ? 'enhanced' : 'original');
  const ingredients = extractRecipeIngredients(r, variant);
  if (!ingredients || ingredients.length === 0) return null;

  const products = Array.isArray(context.products) ? context.products : [];
  const pantryIngredients = Array.isArray(context.ingredients) ? context.ingredients : [];
  if (products.length === 0) return null;

  const preferences = context.preferences || context.userPrefs || {};
  const criterion = preferences.autoDefaultStrategy || preferences.autoDefaultCriterion || preferences.productPriority || 'highest_protein_per_kcal';
  const rawMealType = String(context.mealType || 'all').toLowerCase();
  const activeProfile = String(context.activeProfile || 'everyone').toLowerCase();
  const productOverrides = context.productOverrides || null;
  const hasOverrides = Boolean(productOverrides && Object.keys(productOverrides).length > 0);

  const servesRaw = variant === 'enhanced'
    ? (r.enhanced?.servings ?? r.enhanced?.serves ?? r.servings ?? r.serves ?? 1)
    : (r.servings ?? r.serves ?? 1);
  const serves = Math.max(1, Number(servesRaw) || 1);

  // Check memo cache when no ad-hoc overrides are passed
  let memoKey = null;
  if (!hasOverrides) {
    const fp = buildRecipeFingerprint(r, variant, ingredients, serves);
    const paramsSig = context.fitScoreParams
      ? `${context.fitScoreParams.calorieWeightPct ?? ''}_${context.fitScoreParams.calMinOptPct ?? ''}_${context.fitScoreParams.calMaxOptPct ?? ''}_${context.fitScoreParams.protMinOptPct ?? ''}_${context.fitScoreParams.protMaxOptPct ?? ''}`
      : '';
    memoKey = `${fp}::${rawMealType}::${activeProfile}::${criterion}::${paramsSig}::c${catalogEpoch}::p${prefsEpoch}::n${products.length}::i${pantryIngredients.length}`;
    const hit = solverMemoCache.get(memoKey);
    if (hit) return hit;
  }

  const index = buildCatalogIndex(products, pantryIngredients);
  const lineKeys = buildRecipeLineKeys(ingredients);

  let result = null;
  if (rawMealType === 'all' || rawMealType === 'any' || !rawMealType) {
    const eligible = getEligibleMealTypesLocal(r);
    for (const mt of eligible) {
      const ctx = compileScoringContext(r, mt, activeProfile, preferences, context.fitScoreParams || null);
      const res = solveForSingleMealType(r, variant, ingredients, lineKeys, index, ctx, { criterion, productOverrides });
      if (!result || res.score > result.score) {
        result = res;
      }
    }
  } else {
    const ctx = compileScoringContext(r, rawMealType, activeProfile, preferences, context.fitScoreParams || null);
    result = solveForSingleMealType(r, variant, ingredients, lineKeys, index, ctx, { criterion, productOverrides });
  }

  if (memoKey && result) {
    if (solverMemoCache.size >= MEMO_MAX_ENTRIES) {
      // Evict oldest 25% of entries instead of wiping the entire memo cache
      const evictCount = Math.floor(MEMO_MAX_ENTRIES * 0.25);
      let evicted = 0;
      for (const oldKey of solverMemoCache.keys()) {
        solverMemoCache.delete(oldKey);
        if (++evicted >= evictCount) break;
      }
    }
    solverMemoCache.set(memoKey, result);
  }

  return result;
}
