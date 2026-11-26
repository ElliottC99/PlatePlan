/**
 * src/services/RecipeEnhancementService.js
 * Domain service for automated recipe macro enhancement to 85+ Fit Score.
 * Orchestrates enhancement routes and payload assembly; nutrition and swap helpers
 * live in RecipeEnhancementNutrition.js and RecipeEnhancementSwaps.js.
 */

import { getState } from "../store/coreState.js";
import { normalizeMethodSteps } from "../utils/stringUtils.js";
import { solveOptimalRecipeProducts } from "./RecipeProductSolver.js";
import { calculateMealFitScore } from "../utils/fitScoreCalculator.js";
import { calculateItemNutrition, normalizeEnergyKcal, resolveProductItemWeight } from "./NutritionService.js";
import { toGrams } from "./UnitConversionService.js";
import { resolveProductForIngredient } from "../components/recipe/RecipeWizardStep3Handlers.js";
import {
  resolvePantryTaxonomy,
  resolvePantryTaxonomyForSwap,
  quantizeQuantity,
  classifyIngredientRole,
  resolveRecipeTargets,
  cloneAndTraverseIngredients,
  calculateBatchMacros
} from "./RecipeEnhancementNutrition.js";
import {
  SWAP_OPPORTUNITIES,
  findCulinarySwapCandidates
} from "./RecipeEnhancementSwaps.js";

export {
  resolvePantryTaxonomy,
  resolvePantryTaxonomyForSwap,
  quantizeQuantity,
  classifyIngredientRole,
  resolveRecipeTargets,
  cloneAndTraverseIngredients,
  calculateBatchMacros,
  SWAP_OPPORTUNITIES,
  findCulinarySwapCandidates
};

function buildRoutePlan({
  routeId,
  name,
  badge,
  description,
  mode, // 'swaps' | 'portions' | 'hybrid'
  recipe,
  initialServings,
  targets,
  options,
  beforeScore,
  products,
  allIngredients,
  targetMealType,
  swapOpportunities
}) {
  let proposedServings = initialServings;
  const adjustments = [];

  // Clone fresh ingredients
  const { ingredientSections, ingredients } = cloneAndTraverseIngredients(recipe, i => i);
  let workingIngredients = JSON.parse(JSON.stringify(ingredients));

  workingIngredients.forEach((item, idx) => {
    item._idx = idx;
    item._matchedProduct = resolveProductForIngredient(item, { products, ingredients: allIngredients });
    item._role = classifyIngredientRole(item, item._matchedProduct);
  });

  let currentMacros = calculateBatchMacros(workingIngredients, initialServings, { products, allIngredients });
  let currentKcal = currentMacros.perServing.calories;
  let currentProt = currentMacros.perServing.protein;

  // Lever 0: Yield Rebalance (if batch calories > 1000)
  if (currentKcal > 1000) {
    proposedServings = initialServings + 1;
    currentMacros = calculateBatchMacros(workingIngredients, proposedServings, { products, allIngredients });
    currentKcal = currentMacros.perServing.calories;
    currentProt = currentMacros.perServing.protein;
    adjustments.push({
      id: 'adj_yield',
      type: 'yield',
      label: `Increase serving yield from ${initialServings} to ${proposedServings} portions`,
      detail: `Normalizes excessive calorie density (${Math.round(currentMacros.total.cal / initialServings)} kcal down to ${currentKcal} kcal/serving).`,
      deltaKcal: currentKcal - Math.round(currentMacros.total.cal / initialServings),
      deltaProt: currentProt - Math.round(currentMacros.total.prot / initialServings),
      active: true
    });
  }

  // Lever 1: Cooking Fat Moderation
  const runFatModeration = (threshold) => {
    if (currentKcal > threshold) {
      const fats = workingIngredients.filter(i => i._role === 'cooking_fat');
      fats.forEach(fatItem => {
        const origQty = Number(fatItem.qty ?? fatItem.amount ?? 1) || 1;
        const unit = String(fatItem.unit || 'g').toLowerCase();
        const perServingQty = origQty / proposedServings;
        if (perServingQty > 7) {
          const targetPerServing = 5;
          const proposedTotal = quantizeQuantity(targetPerServing * proposedServings, unit);
          if (proposedTotal < origQty) {
            const origNut = calculateItemNutrition(fatItem._matchedProduct, origQty, unit);
            const newNut = calculateItemNutrition(fatItem._matchedProduct, proposedTotal, unit);
            const dKcal = Math.round((newNut.kcal - origNut.kcal) / proposedServings);

            fatItem.qty = proposedTotal;
            fatItem.amount = proposedTotal;
            currentKcal += dKcal;
            const taxonomy = resolvePantryTaxonomy(fatItem, { ingredients: allIngredients, products });
            adjustments.push({
              id: `adj_fat_${fatItem.name}`,
              type: 'quantity',
              ingredientName: fatItem.name,
              originalQty: origQty,
              proposedQty: proposedTotal,
              unit,
              label: `Moderate cooking fat: ${origQty}${unit} ➔ ${proposedTotal}${unit} ${fatItem.name}`,
              detail: `Saves ~${Math.abs(dKcal)} kcal/serving without altering recipe flavour.`,
              deltaKcal: dKcal,
              deltaProt: 0,
              taxonomy,
              active: true
            });
          }
        }
      });
    }
  };

  // Lever 4: Smart Pantry Swaps
  const runSwaps = (maxSwaps = 99) => {
    let appliedCount = 0;
    workingIngredients.forEach(item => {
      if (appliedCount >= maxSwaps) return;
      const rawName = String(item.name || '').toLowerCase();
      for (const swap of swapOpportunities) {
        if (swap.match.test(rawName) && !swap.exclude.test(rawName)) {
          const q = Number(item.qty ?? item.amount ?? 1) || 1;
          const u = String(item.unit || 'g').toLowerCase().trim().replace(/s$/, '');
          let itemGramsPerServing = 100;
          if (u === 'g' || u === 'ml') {
            itemGramsPerServing = q / proposedServings;
          } else if (u === 'qty' || u === 'piece' || u === 'patty' || u === 'burger' || u === 'item') {
            const singleWeight = resolveProductItemWeight(item._matchedProduct) 
              || (toGrams(1, u, item.name, 0))
              || 100;
            itemGramsPerServing = (q * singleWeight) / proposedServings;
          } else if (u === 'slice') {
            itemGramsPerServing = (q * 25) / proposedServings;
          } else {
            itemGramsPerServing = toGrams(q, u, item.name, 100 * proposedServings) / proposedServings;
          }

          const factor = Math.max(0.2, itemGramsPerServing / 100);
          const dKcal = Math.round(swap.kcalPer100gDiff * factor);
          const dProt = Math.round((swap.protPer100gDiff * factor) * 10) / 10;

          const wouldBeKcal = currentKcal + dKcal;
          const canSwap = (currentKcal > targets.targetKcal || currentProt < targets.minProt) && 
                          (wouldBeKcal >= targets.minKcal || currentProt < targets.minProt);
          if (canSwap) {
            const preTaxonomy = resolvePantryTaxonomy(item, { ingredients: allIngredients, products });
            const postTaxonomy = resolvePantryTaxonomyForSwap(swap, item, { ingredients: allIngredients, products });

            adjustments.push({
              id: `swap_${item.name}`,
              type: 'swap',
              ingredientName: item.name,
              swapTo: swap.swapTo,
              label: `Swap ${item.name} ➔ ${swap.swapTo}`,
              detail: `${swap.reason} (${dKcal} kcal/serving).`,
              deltaKcal: dKcal,
              deltaProt: dProt,
              preTaxonomy,
              postTaxonomy,
              active: true
            });
            currentKcal = wouldBeKcal;
            currentProt += dProt;
            appliedCount++;
            break;
          }
        }
      }
    });
  };

  // Lever 2: Primary Protein Scaling
  const runProteinScaling = (scaleRatio = 1.0) => {
    if (currentProt < targets.minProt) {
      const proteins = workingIngredients.filter(i => i._role === 'primary_protein');
      if (proteins.length > 0) {
        proteins.sort((a, b) => {
          const pA = (a._matchedProduct?.protein || a._matchedProduct?.prot || 20);
          const pB = (b._matchedProduct?.protein || b._matchedProduct?.prot || 20);
          return pB - pA;
        });
        const mainProt = proteins[0];
        const origQty = Number(mainProt.qty ?? mainProt.amount ?? 1) || 1;
        const unit = String(mainProt.unit || 'g').toLowerCase();
        const u = unit.trim().replace(/s$/, '');
        const isDiscrete = u === 'qty' || u === 'item' || u === 'piece' || u === 'patty' || u === 'burger' || u === 'breast' || u === 'fillet' || u === 'thigh' || u === 'egg' || u === 'sausage' || u === 'slice';

        const neededProtPerServing = (targets.minProt - currentProt) * scaleRatio;
        const neededProtTotal = neededProtPerServing * proposedServings;
        const protPer100g = (Number(mainProt._matchedProduct?.protein || mainProt._matchedProduct?.prot) || 20);

        let newQty = origQty;
        if (isDiscrete) {
          const singleWeight = resolveProductItemWeight(mainProt._matchedProduct) 
            || (origQty > 0 ? (toGrams(origQty, unit, mainProt.name, 0) / origQty) : 0)
            || 100;
          const protPerItem = (protPer100g / 100) * singleWeight;
          const neededItems = protPerItem > 0 ? Math.ceil(neededProtTotal / protPerItem) : 1;
          const maxBatchCount = Math.max(origQty, proposedServings * 2);
          newQty = Math.min(maxBatchCount, origQty + Math.max(1, neededItems));
        } else {
          const additionalGrams = (neededProtTotal / protPer100g) * 100;
          const maxBatchQty = proposedServings * 220;
          newQty = quantizeQuantity(Math.min(maxBatchQty, origQty + additionalGrams), unit);
        }

        if (newQty > origQty) {
          const origNut = calculateItemNutrition(mainProt._matchedProduct, origQty, unit);
          const newNut = calculateItemNutrition(mainProt._matchedProduct, newQty, unit);
          const dKcal = Math.round((newNut.kcal - origNut.kcal) / proposedServings);
          const dProt = Math.round(((newNut.protein - origNut.protein) / proposedServings) * 10) / 10;

          if (dProt > 0 || dKcal !== 0) {
            mainProt.qty = newQty;
            mainProt.amount = newQty;
            currentKcal += dKcal;
            currentProt += dProt;
            const taxonomy = resolvePantryTaxonomy(mainProt, { ingredients: allIngredients, products });
            adjustments.push({
              id: `adj_prot_${mainProt.name}`,
              type: 'quantity',
              ingredientName: mainProt.name,
              originalQty: origQty,
              proposedQty: newQty,
              unit,
              label: `Boost lean protein: ${origQty}${unit} ➔ ${newQty}${unit} ${mainProt.name}`,
              detail: `Adds +${dProt}g protein per serving to reach household target (${targets.minProt}g).`,
              deltaKcal: dKcal,
              deltaProt: dProt,
              taxonomy,
              active: true
            });
          }
        }
      }
    }
  };

  // Lever 3: Carb Balancing
  const runCarbBalancing = () => {
    if (currentKcal > targets.maxKcal) {
      const carbs = workingIngredients.filter(i => i._role === 'starch_carb');
      carbs.forEach(carbItem => {
        const origQty = Number(carbItem.qty ?? carbItem.amount ?? 100) || 100;
        const unit = String(carbItem.unit || 'g').toLowerCase();
        const perServingQty = origQty / proposedServings;
        if (perServingQty > 85 && (unit === 'g' || unit === 'gram')) {
          const proposedTotal = quantizeQuantity(70 * proposedServings, unit);
          if (proposedTotal < origQty) {
            const origNut = calculateItemNutrition(carbItem._matchedProduct, origQty, unit);
            const newNut = calculateItemNutrition(carbItem._matchedProduct, proposedTotal, unit);
            const dKcal = Math.round((newNut.kcal - origNut.kcal) / proposedServings);
            const dProt = Math.round(((newNut.protein - origNut.protein) / proposedServings) * 10) / 10;
            if (dKcal !== 0 || dProt !== 0) {
              carbItem.qty = proposedTotal;
              carbItem.amount = proposedTotal;
              currentKcal += dKcal;
              currentProt += dProt;
              const taxonomy = resolvePantryTaxonomy(carbItem, { ingredients: allIngredients, products });
              adjustments.push({
                id: `adj_carb_${carbItem.name}`,
                type: 'quantity',
                ingredientName: carbItem.name,
                originalQty: origQty,
                proposedQty: proposedTotal,
                unit,
                label: `Balance carbs: ${origQty}${unit} ➔ ${proposedTotal}${unit} ${carbItem.name}`,
                detail: `Trims ~${Math.abs(dKcal)} kcal/serving for optimal carbohydrate ratio.`,
                deltaKcal: dKcal,
                deltaProt: dProt,
                taxonomy,
                active: true
              });
            }
          }
        }
      });
    }
  };

  // Mode Execution:
  if (mode === 'protein') {
    // Route 2: High Protein Boost
    runFatModeration(targets.targetKcal);
    runProteinScaling(1.2);
    runCarbBalancing();
  } else if (mode === 'servings') {
    // Route 3: Rebalanced Servings
    if (proposedServings === initialServings && currentKcal > 600) {
      proposedServings = initialServings + 1;
      currentMacros = calculateBatchMacros(workingIngredients, proposedServings, { products, allIngredients });
      currentKcal = currentMacros.perServing.calories;
      currentProt = currentMacros.perServing.protein;
      adjustments.push({
        id: 'adj_yield',
        type: 'yield',
        label: `Rebalance yield: ${initialServings} ➔ ${proposedServings} portions`,
        detail: `Normalizes portion calories to ${currentKcal} kcal/serving.`,
        deltaKcal: currentKcal - Math.round(currentMacros.total.cal / initialServings),
        deltaProt: currentProt - Math.round(currentMacros.total.prot / initialServings),
        active: true
      });
    }
    runFatModeration(targets.targetKcal);
    runProteinScaling(1.0);
  } else {
    // Route 1 (Default): Balanced Quantity Tuning
    runFatModeration(targets.maxKcal);
    runProteinScaling(1.0);
    runCarbBalancing();
  }

  // Fallback Lever 5: Lean Protein Addition (If no primary protein in recipe at all)
  if (currentProt < 25 && workingIngredients.filter(i => i._role === 'primary_protein').length === 0) {
    const boosterName = 'Firm Tofu (or Diced Chicken Breast)';
    const boosterQty = quantizeQuantity(125 * proposedServings, 'g');
    adjustments.push({
      id: 'adj_add_protein',
      type: 'addition',
      ingredientName: boosterName,
      proposedQty: boosterQty,
      unit: 'g',
      label: `Add protein booster: +${boosterQty}g ${boosterName}`,
      detail: `Infuses +24g protein per serving to meet minimum household nutritional targets.`,
      deltaKcal: +140,
      deltaProt: +24,
      taxonomy: {
        category: 'Refrigerated & Dairy',
        rootItem: boosterName,
        subtype: 'Firm Tofu',
        productName: 'Organic Firm Tofu 280g'
      },
      active: true
    });
    currentKcal += 140;
    currentProt += 24;
  }

  // Attach safe culinary swap candidates to adjustments
  const swapPreferences = options?.swapPreferences || {};
  adjustments.forEach(adj => {
    if (adj.type === 'quantity') {
      const origItem = workingIngredients.find(i => i.name === adj.ingredientName);
      if (origItem) {
        adj.swapCandidates = findCulinarySwapCandidates(origItem, { products, allIngredients, swapPreferences });
      }
    }
  });

  // Also check remaining ingredients for optional lighter culinary alternatives
  workingIngredients.forEach(item => {
    const hasAdj = adjustments.some(a => a.ingredientName === item.name);
    if (!hasAdj) {
      const candidates = findCulinarySwapCandidates(item, { products, allIngredients, swapPreferences });
      if (candidates.length > 0) {
        const taxonomy = resolvePantryTaxonomy(item, { ingredients: allIngredients, products });
        const q = Number(item.qty ?? item.amount ?? 1) || 1;
        const u = String(item.unit || 'g').toLowerCase();
        adjustments.push({
          id: `adj_opt_swap_${item.name}`,
          type: 'optional_swap',
          ingredientName: item.name,
          originalQty: q,
          unit: u,
          label: `Optional Swap: ${item.name}`,
          detail: `Select a lighter substitute from your pantry bank to trim calories.`,
          deltaKcal: 0,
          deltaProt: 0,
          taxonomy,
          swapCandidates: candidates,
          active: false
        });
      }
    }
  });

  const finalMacros = {
    perServing: {
      calories: Math.max(100, Math.round(currentKcal)),
      protein: Math.max(5, Math.round(currentProt * 10) / 10),
      carbs: Math.max(10, Math.round(currentMacros.perServing.carbs)),
      fat: Math.max(5, Math.round(currentMacros.perServing.fat)),
      cal: Math.max(100, Math.round(currentKcal)),
      prot: Math.max(5, Math.round(currentProt * 10) / 10)
    },
    total: {
      cal: Math.round(currentKcal * proposedServings),
      prot: Math.round(currentProt * proposedServings),
      carb: Math.round(currentMacros.perServing.carbs * proposedServings),
      fat: Math.round(currentMacros.perServing.fat * proposedServings)
    }
  };

  const simulatedEnhanced = buildEnhancedRecipePayload(recipe, workingIngredients, proposedServings, adjustments, finalMacros);
  const simulatedRecipe = {
    ...recipe,
    enhanced: simulatedEnhanced,
    _variant: 'enhanced'
  };
  const simFit = calculateMealFitScore(simulatedRecipe, targetMealType, { ...options, variant: 'enhanced' });
  const predictedScore = Math.max(beforeScore, Math.round(Number(simFit?.score) || beforeScore));

  return {
    id: routeId,
    routeId,
    name,
    badge,
    description,
    originalRecipe: recipe,
    beforeScore,
    predictedScore,
    predictedTier: simFit?.tierLabel || 'Ideal Match',
    predictedColor: simFit?.color || '#16a34a',
    proposedServings,
    adjustments,
    macros: finalMacros,
    enhancedRecipePayload: simulatedEnhanced
  };
}

/**
 * Core Heuristic Engine: Analyzes a recipe and generates 85+ Fit Score enhancement routes.
 */
export function generateEnhancementPlan(recipe, options = {}) {
  if (!recipe || typeof recipe !== 'object') return null;

  const state = typeof getState === 'function' ? (getState() || {}) : {};
  const products = Array.isArray(options.products) ? options.products : (state.products || []);
  const allIngredients = Array.isArray(options.ingredients) ? options.ingredients : (state.rootItems || state.ingredients || []);
  const swapPreferences = options.swapPreferences || state.preferences?.swapPreferences || {};

  const targets = resolveRecipeTargets(recipe, options);
  const targetMealType = targets.mealType;
  const currentServings = Number(recipe.servings || recipe.serves || 2) || 2;

  // Stage A: Zero-edit pantry product combination check before mutating recipe quantities/yield
  const stageA = products.length > 0
    ? solveOptimalRecipeProducts(recipe, {
        variant: 'original',
        mealType: targetMealType,
        activeProfile: targets.audience || 'everyone',
        products,
        ingredients: allIngredients,
        preferences: options.preferences || options.userPrefs || state.preferences || state.userPrefs || state.settings || {}
      })
    : null;

  if (stageA && stageA.usedCombo && stageA.score >= 85 && !options.forceStageB) {
    const stageARoute = {
      id: 'route_pantry_combo',
      name: 'Pantry Combo (Zero Recipe Edits)',
      badge: '✨ Pantry Combo',
      description: 'Reaches 85+ Fit Score using existing pantry products alone — no quantity changes or Enhanced variant needed.',
      beforeScore: stageA.baselineScore,
      predictedScore: stageA.score,
      proposedServings: currentServings,
      adjustments: [],
      stageAOptimal: true,
      noForkNeeded: true,
      stageADepartures: stageA.departures,
      enhancedRecipePayload: null
    };
    return {
      recipeId: recipe.id,
      recipeTitle: recipe.name || recipe.title || 'Recipe',
      originalRecipe: recipe,
      originalServings: currentServings,
      targets,
      beforeScore: stageA.baselineScore,
      predictedScore: stageA.score,
      proposedServings: currentServings,
      adjustments: [],
      stageAOptimal: true,
      noForkNeeded: true,
      stageADepartures: stageA.departures,
      enhancedRecipePayload: null,
      selectedRouteId: stageARoute.id,
      routes: [stageARoute]
    };
  }

  const initialFit = calculateMealFitScore(recipe, targetMealType, { ...options, variant: 'original' });
  const beforeScore = Math.round(Number(initialFit?.score) || 0);

  // Build candidate routes (Quantity-focused)
  const r1 = buildRoutePlan({
    routeId: 'route_balanced',
    name: 'Route 1: Balanced Quantity Tuning',
    badge: '⚖️ Balanced',
    description: 'Reaches goal through balanced portion tuning and light cooking fat moderation.',
    mode: 'balanced',
    recipe,
    initialServings: currentServings,
    targets,
    options: { ...options, swapPreferences },
    beforeScore,
    products,
    allIngredients,
    targetMealType,
    swapOpportunities: SWAP_OPPORTUNITIES
  });

  const r2 = buildRoutePlan({
    routeId: 'route_protein',
    name: 'Route 2: High Protein Boost',
    badge: '💪 Protein',
    description: 'Reaches goal by scaling protein cut (fillet, patty, or chicken) to household targets.',
    mode: 'protein',
    recipe,
    initialServings: currentServings,
    targets,
    options: { ...options, swapPreferences },
    beforeScore,
    products,
    allIngredients,
    targetMealType,
    swapOpportunities: SWAP_OPPORTUNITIES
  });

  const r3 = buildRoutePlan({
    routeId: 'route_servings',
    name: 'Route 3: Rebalanced Servings',
    badge: '🍽️ Servings',
    description: 'Reaches goal by re-portioning batch count to optimize per-serving calorie density.',
    mode: 'servings',
    recipe,
    initialServings: currentServings,
    targets,
    options: { ...options, swapPreferences },
    beforeScore,
    products,
    allIngredients,
    targetMealType,
    swapOpportunities: SWAP_OPPORTUNITIES
  });

  const candidateRoutes = [r1, r2, r3].filter(Boolean);

  // De-duplicate routes with identical adjustment signatures
  const seenSignatures = new Set();
  const uniqueRoutes = [];
  candidateRoutes.forEach(r => {
    const sig = (r.adjustments || []).map(a => `${a.type}:${a.ingredientName || a.label}:${a.proposedQty || ''}`).sort().join('|');
    if (sig && !seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      uniqueRoutes.push(r);
    }
  });

  // Filter routes reaching target tier (>= 85% or improving)
  let qualifyingRoutes = uniqueRoutes.filter(r => r.predictedScore >= 85);
  if (qualifyingRoutes.length === 0) {
    qualifyingRoutes = uniqueRoutes.length > 0 ? [uniqueRoutes[0]] : candidateRoutes;
  }

  // Sort qualifying routes by score descending
  qualifyingRoutes.sort((a, b) => b.predictedScore - a.predictedScore);

  const primaryRoute = qualifyingRoutes[0] || r1;

  return {
    recipeId: recipe.id,
    recipeTitle: recipe.name || recipe.title || 'Recipe',
    originalRecipe: recipe,
    beforeScore,
    predictedScore: primaryRoute.predictedScore,
    proposedServings: primaryRoute.proposedServings,
    originalServings: currentServings,
    targets,
    adjustments: primaryRoute.adjustments,
    enhancedRecipePayload: primaryRoute.enhancedRecipePayload,
    selectedRouteId: primaryRoute.id,
    routes: qualifyingRoutes
  };
}

/**
 * Builds the complete `recipe.enhanced` payload adhering to RecipeAuthoringService schema.
 */
export function buildEnhancedRecipePayload(originalRecipe, adjustedIngredients, serves, adjustments = [], calculatedMacros = null) {
  const origName = originalRecipe.name || originalRecipe.title || 'Recipe';
  const s = Math.max(1, Number(serves) || 2);

  // Preserve ingredientSections if present
  let finalSections = [];
  let finalIngredients = [];

  if (Array.isArray(originalRecipe.ingredientSections) && originalRecipe.ingredientSections.length > 0) {
    finalSections = originalRecipe.ingredientSections.map(sec => {
      const updatedSecIngs = (sec.ingredients || []).map(ing => {
        const matchedAdj = adjustedIngredients.find(ai => (ai.id && ai.id === ing.id) || (ai.name && ai.name.toLowerCase() === ing.name.toLowerCase()));
        if (matchedAdj) {
          return {
            ...ing,
            qty: matchedAdj.qty,
            amount: matchedAdj.qty,
            unit: matchedAdj.unit || ing.unit
          };
        }
        return { ...ing };
      });
      return { ...sec, ingredients: updatedSecIngs };
    });
    finalIngredients = finalSections.flatMap(s => s.ingredients);
  } else {
    finalIngredients = adjustedIngredients.map(ing => {
      const copy = { ...ing };
      delete copy._idx;
      delete copy._matchedProduct;
      delete copy._role;
      return copy;
    });
  }

  // Handle addition adjustments
  adjustments.filter(a => a.type === 'addition' && a.active !== false).forEach(addAdj => {
    const addedItem = {
      id: `enh_add_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: addAdj.ingredientName,
      qty: addAdj.proposedQty,
      amount: addAdj.proposedQty,
      unit: addAdj.unit || 'g',
      raw: `${addAdj.proposedQty}${addAdj.unit || 'g'} ${addAdj.ingredientName}`
    };
    finalIngredients.push(addedItem);
    if (finalSections.length > 0) {
      finalSections[0].ingredients.push(addedItem);
    }
  });

  // Handle swap adjustments
  adjustments.filter(a => a.type === 'swap' && a.active !== false).forEach(swapAdj => {
    const targetName = String(swapAdj.ingredientName || '').toLowerCase();
    const replaceName = (item) => {
      if (String(item.name || '').toLowerCase() === targetName) {
        item.name = swapAdj.swapTo;
        item.raw = `${item.qty || 1}${item.unit || 'g'} ${swapAdj.swapTo}`;
        if (swapAdj.postTaxonomy) {
          if (swapAdj.postTaxonomy.productId) item.productId = swapAdj.postTaxonomy.productId;
          if (swapAdj.postTaxonomy.productName) item.productName = swapAdj.postTaxonomy.productName;
          if (swapAdj.postTaxonomy.ingredientId) item.ingredientId = swapAdj.postTaxonomy.ingredientId;
          if (swapAdj.postTaxonomy.subtypeId) item.subtypeId = swapAdj.postTaxonomy.subtypeId;
          if (swapAdj.postTaxonomy.subtype) item.subtypeName = swapAdj.postTaxonomy.subtype;
          if (swapAdj.postTaxonomy.category) item.category = swapAdj.postTaxonomy.category;
        }
      }
    };
    finalIngredients.forEach(replaceName);
    finalSections.forEach(sec => (sec.ingredients || []).forEach(replaceName));
  });

  const changesList = adjustments
    .filter(a => a.active !== false)
    .map(a => a.label)
    .join('; ');

  const perServing = calculatedMacros?.perServing || {
    calories: 620,
    protein: 42,
    carbs: 60,
    fat: 18,
    cal: 620,
    prot: 42
  };

  const total = calculatedMacros?.total || {
    cal: Math.round(perServing.calories * s),
    prot: Math.round(perServing.protein * s),
    carb: Math.round(perServing.carbs * s),
    fat: Math.round(perServing.fat * s)
  };

  const methodSteps = normalizeMethodSteps(originalRecipe);

  return {
    name: `${origName} (Enhanced)`,
    title: `${origName} (Enhanced)`,
    serves: s,
    servings: s,
    ...perServing,
    macros: perServing,
    nutrition: {
      total,
      perServing
    },
    fitScore: calculatedMacros?.fitScore ?? calculatedMacros?.liveScore ?? null,
    _computedFitScore: calculatedMacros?.fitScore ?? calculatedMacros?.liveScore ?? null,
    changes: changesList || 'Nutritionally optimized for household macro targets.',
    ingredientSections: finalSections,
    ingredients: finalIngredients,
    methodSteps,
    method: methodSteps,
    steps: methodSteps,
    instructions: methodSteps,
    updatedAt: new Date().toISOString()
  };
}

if (typeof window !== 'undefined') {
  window.RecipeEnhancementService = {
    quantizeQuantity,
    classifyIngredientRole,
    resolveRecipeTargets,
    resolvePantryTaxonomy,
    resolvePantryTaxonomyForSwap,
    generateEnhancementPlan,
    buildEnhancedRecipePayload
  };
}
