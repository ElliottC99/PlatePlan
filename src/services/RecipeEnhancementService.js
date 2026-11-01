/**
 * src/services/RecipeEnhancementService.js
 * Domain service for automated recipe macro enhancement to 85+ Fit Score.
 * Analyzes macro gaps, applies culinary levers, and outputs recipe.enhanced payloads.
 */

import { getState } from '../store/coreState.js';
import { calculateMealFitScore, getTarget } from '../utils/fitScoreCalculator.js';
import { calculateItemNutrition, normalizeEnergyKcal, resolveProductItemWeight } from './NutritionService.js';
import { toGrams } from './UnitConversionService.js';
import { resolveProductForIngredient } from '../components/recipe/RecipeWizardStep3Handlers.js';

/**
 * Resolves full Pantry Bank taxonomy (Category / Root Item / Sub-type) and Linked Product.
 */
export function resolvePantryTaxonomy(item, { ingredients = [], products = [] } = {}) {
  if (!item || typeof item !== 'object') {
    return { category: 'General', rootItem: 'Unknown', subtype: 'Standard', productName: 'None' };
  }

  // 1. Resolve product
  let prod = item._matchedProduct || null;
  if (!prod && item.productId) {
    prod = products.find(p => String(p.id) === String(item.productId));
  }
  if (!prod && item.bankId) {
    prod = products.find(p => String(p.id) === String(item.bankId));
  }
  if (!prod && item.productName) {
    prod = products.find(p => p.name && p.name.toLowerCase() === String(item.productName).toLowerCase());
  }
  if (!prod) {
    prod = resolveProductForIngredient(item, { products, ingredients });
  }

  // 2. Resolve root ingredient
  let rootIng = null;
  if (item.ingredientId) {
    rootIng = ingredients.find(i => String(i.id) === String(item.ingredientId));
  }
  if (!rootIng && prod?.ingredientId) {
    rootIng = ingredients.find(i => String(i.id) === String(prod.ingredientId));
  }
  if (!rootIng && (prod?.groupId || item.groupId)) {
    const gId = prod?.groupId || item.groupId;
    rootIng = ingredients.find(i => String(i.groupId || i.id) === String(gId));
  }
  if (!rootIng && item.name) {
    const cleanName = String(item.name).trim().toLowerCase();
    rootIng = ingredients.find(i => i.name && (i.name.toLowerCase() === cleanName || cleanName.includes(i.name.toLowerCase())));
  }

  // 3. Resolve subtype
  let subtypeName = item.subtypeName || null;
  if (!subtypeName && item.subtypeId && rootIng?.subtypes) {
    const st = rootIng.subtypes.find(s => String(s.id) === String(item.subtypeId));
    if (st) subtypeName = st.name;
  }
  if (!subtypeName && prod?.subtypeId && rootIng?.subtypes) {
    const st = rootIng.subtypes.find(s => String(s.id) === String(prod.subtypeId));
    if (st) subtypeName = st.name;
  }
  if (!subtypeName) {
    if (rootIng?.name && item.name && rootIng.name.toLowerCase() !== item.name.toLowerCase()) {
      subtypeName = item.name;
    } else {
      subtypeName = 'Standard';
    }
  }

  const category = rootIng?.category || prod?.category || item.category || 'General';
  const rootItem = rootIng?.name || item.name || 'Unknown';
  const productName = prod?.name || item.productName || item.productMatch?.name || 'Default Product';

  return {
    category,
    rootItem,
    subtype: subtypeName,
    productName,
    productId: prod?.id || item.productId || null,
    ingredientId: rootIng?.id || item.ingredientId || null,
    subtypeId: prod?.subtypeId || item.subtypeId || null
  };
}

/**
 * Resolves post-swap Pantry Bank taxonomy (Category / Root Item / Sub-type) and Linked Product.
 */
export function resolvePantryTaxonomyForSwap(swap, originalItem, { ingredients = [], products = [] } = {}) {
  const searchRegex = swap.productSearchRegex || new RegExp(swap.swapTo.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
  const matchedProd = products.find(p => p.name && searchRegex.test(p.name));

  if (matchedProd) {
    let rootIng = null;
    if (matchedProd.ingredientId) {
      rootIng = ingredients.find(i => String(i.id) === String(matchedProd.ingredientId));
    }
    if (!rootIng && matchedProd.groupId) {
      rootIng = ingredients.find(i => String(i.groupId || i.id) === String(matchedProd.groupId));
    }

    let subtypeName = null;
    if (matchedProd.subtypeId && rootIng?.subtypes) {
      const st = rootIng.subtypes.find(s => String(s.id) === String(matchedProd.subtypeId));
      if (st) subtypeName = st.name;
    }
    if (!subtypeName) {
      subtypeName = swap.targetTaxonomy?.subtype || swap.swapTo;
    }

    return {
      category: matchedProd.category || rootIng?.category || swap.targetTaxonomy?.category || 'Store Cupboard',
      rootItem: rootIng?.name || swap.targetTaxonomy?.rootItem || swap.swapTo,
      subtype: subtypeName,
      productName: matchedProd.name,
      productId: matchedProd.id,
      ingredientId: rootIng?.id || null,
      subtypeId: matchedProd.subtypeId || null
    };
  }

  const matchedIng = ingredients.find(i => i.name && searchRegex.test(i.name));
  if (matchedIng) {
    let defProd = null;
    if (matchedIng.defaultProductId) {
      defProd = products.find(p => String(p.id) === String(matchedIng.defaultProductId));
    }
    return {
      category: matchedIng.category || swap.targetTaxonomy?.category || 'Store Cupboard',
      rootItem: matchedIng.name,
      subtype: swap.targetTaxonomy?.subtype || 'Standard',
      productName: defProd?.name || swap.targetTaxonomy?.productName || swap.swapTo,
      productId: defProd?.id || null,
      ingredientId: matchedIng.id,
      subtypeId: null
    };
  }

  if (swap.targetTaxonomy) {
    return { ...swap.targetTaxonomy };
  }

  return {
    category: 'Store Cupboard',
    rootItem: swap.swapTo,
    subtype: 'Standard',
    productName: swap.swapTo,
    productId: null,
    ingredientId: null,
    subtypeId: null
  };
}

/**
 * Quantizes ingredient quantities to natural culinary increments.
 */
export function quantizeQuantity(qty, unit = 'g') {
  const num = Number(qty);
  if (!Number.isFinite(num) || num <= 0) return 0;
  const u = String(unit || 'g').trim().toLowerCase().replace(/s$/, '');

  if (u === 'g' || u === 'ml') {
    if (num < 50) return Math.max(5, Math.round(num / 5) * 5);
    return Math.round(num / 10) * 10;
  }
  if (u === 'tbsp' || u === 'tsp' || u === 'tablespoon' || u === 'teaspoon') {
    return Math.max(0.5, Math.round(num * 2) / 2);
  }
  if (u === 'can' || u === 'tin' || u === 'pack' || u === 'pot') {
    return Math.max(0.5, Math.round(num * 2) / 2);
  }
  if (u === 'qty' || u === 'piece' || u === 'clove' || u === 'item' || u === 'egg' || u === 'breast' || u === 'fillet') {
    if (num <= 1) return 1;
    return Math.round(num);
  }
  return Math.round(num * 10) / 10;
}

/**
 * Classifies ingredient into a culinary role based on name, category, and macros.
 */
export function classifyIngredientRole(item, matchedProduct = null) {
  const rawName = String(item?.name || item?.raw || '').toLowerCase();
  const prodName = String(matchedProduct?.name || '').toLowerCase();
  const cat = String(item?.categoryId || item?.category || matchedProduct?.category || '').toLowerCase();
  const text = `${rawName} ${prodName} ${cat}`;

  // 1. Cooking Fats & Pure Oils
  if (/\b(oil|olive oil|vegetable oil|sunflower oil|sesame oil|rapeseed oil|butter|ghee|lard|frylight|cooking spray|margarine)\b/i.test(text)
      && !/\b(sardines? in oil|tuna in oil)\b/i.test(text)) {
    return 'cooking_fat';
  }

  // 2. Rich Dairy / Fats
  if (/\b(coconut milk|coconut cream|double cream|heavy cream|single cream|sour cream|cream cheese|mayo|mayonnaise|cheddar|parmesan|mozzarella|cheese)\b/i.test(text)) {
    return 'rich_dairy_fat';
  }

  // 3. Primary Proteins
  if (/\b(chicken|turkey|beef|steak|mince|pork|lamb|bacon|salmon|tuna|cod|prawns?|shrimp|tofu|tempeh|seitan|quorn|eggs?|egg whites?|lentils?|chickpeas?|black beans?|kidney beans?|edamame)\b/i.test(text)
      || cat.includes('meat') || cat.includes('fish') || cat.includes('seafood') || cat.includes('protein')) {
    return 'primary_protein';
  }

  // 4. Starch / Carbs
  if (/\b(rice|pasta|spaghetti|penne|fusilli|noodles?|potatoes?|sweet potatoes?|bread|toast|couscous|quinoa|wrap|tortilla|oats?|flour)\b/i.test(text)
      || cat.includes('carbs') || cat.includes('grains') || cat.includes('pasta')) {
    return 'starch_carb';
  }

  // 5. Produce (Vegetables, Fruit, Aromatics)
  if (/\b(onion|garlic|ginger|pepper|peppers|broccoli|spinach|mushroom|mushrooms|carrot|carrots|tomato|tomatoes|chilli|chillies|lemon|lime|coriander|parsley|basil|kale|courgette|cucumber)\b/i.test(text)
      || cat.includes('produce') || cat.includes('veg') || cat.includes('fruit')) {
    return 'produce';
  }

  // 6. Seasonings & Condiments
  if (/\b(salt|black pepper|soy sauce|fish sauce|vinegar|paprika|cumin|turmeric|oregano|thyme|stock|stock cube|paste)\b/i.test(text)
      || cat.includes('spice') || cat.includes('seasoning')) {
    return 'seasoning';
  }

  return 'other';
}

/**
 * Resolves specific macro targets for a recipe based on its audience and meal type.
 */
export function resolveRecipeTargets(recipe, options = {}) {
  const winState = typeof getState === 'function' ? (getState() || {}) : {};
  const rawProfiles = options?.userPrefs?.profiles || winState.preferences?.profiles || winState.userPrefs?.profiles || {};
  const eRaw = rawProfiles.elliott || rawProfiles.e || {};
  const cRaw = rawProfiles.chloe || rawProfiles.c || {};

  const profileE = {
    ...eRaw,
    dailyKcal: Number(eRaw.dailyKcal ?? 2100) || 2100,
    dailyProtein: Number(eRaw.dailyProtein ?? 140) || 140
  };
  const profileC = {
    ...cRaw,
    dailyKcal: Number(cRaw.dailyKcal ?? 1650) || 1650,
    dailyProtein: Number(cRaw.dailyProtein ?? 105) || 105
  };

  const mealType = String(options.mealType || recipe?.mealSuitability?.[0] || recipe?.types?.[0] || recipe?.type || 'dinner').toLowerCase();
  const who = String(options.activeProfile || recipe?.who || 'both').toLowerCase();

  const eTargetKcal = getTarget(profileE, 'kcal', mealType) || 735;
  const eTargetProt = getTarget(profileE, 'protein', mealType) || 49;
  const cTargetKcal = getTarget(profileC, 'kcal', mealType) || 578;
  const cTargetProt = getTarget(profileC, 'protein', mealType) || 37;

  let targetKcal = 656;
  let targetProt = 43;

  if (who === 'elliott' || who === 'e') {
    targetKcal = Math.round(eTargetKcal);
    targetProt = Math.round(eTargetProt);
  } else if (who === 'chloe' || who === 'c') {
    targetKcal = Math.round(cTargetKcal);
    targetProt = Math.round(cTargetProt);
  } else {
    // Weighted household batch targets
    const totalDaily = profileE.dailyKcal + profileC.dailyKcal;
    const shareE = totalDaily > 0 ? (profileE.dailyKcal / totalDaily) : 0.56;
    const shareC = totalDaily > 0 ? (profileC.dailyKcal / totalDaily) : 0.44;
    targetKcal = Math.round((eTargetKcal * shareE) + (cTargetKcal * shareC));
    targetProt = Math.round((eTargetProt * shareE) + (cTargetProt * shareC));
  }

  return {
    mealType,
    who,
    targetKcal,
    targetProt,
    minKcal: Math.round(targetKcal * 0.85),
    maxKcal: Math.round(targetKcal * 1.05),
    minProt: Math.round(targetProt * 0.95),
    maxProt: Math.round(targetProt * 1.30)
  };
}

/**
 * Recursively maps and updates ingredients while preserving sections.
 */
function cloneAndTraverseIngredients(recipe, mutatorFn) {
  let hasSections = Array.isArray(recipe.ingredientSections) && recipe.ingredientSections.length > 0;
  
  if (hasSections) {
    const updatedSections = recipe.ingredientSections.map(sec => ({
      ...sec,
      ingredients: (sec.ingredients || []).map(ing => mutatorFn({ ...ing }))
    }));
    const flatIngredients = updatedSections.flatMap(s => s.ingredients);
    return { ingredientSections: updatedSections, ingredients: flatIngredients };
  }

  const flatList = (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map(ing => mutatorFn({ ...ing }));
  return { ingredientSections: [], ingredients: flatList };
}

/**
 * Calculates per-serving macros for an ingredient list.
 */
function calculateBatchMacros(ingredients, serves, { products = [], allIngredients = [] }) {
  let totalCal = 0, totalProt = 0, totalCarb = 0, totalFat = 0;

  ingredients.forEach(item => {
    if (!item || item.excludeNutrition) return;
    const matched = resolveProductForIngredient(item, { products, ingredients: allIngredients });
    if (matched) {
      const q = Number(item.qty ?? item.amount ?? 1) || 1;
      const u = item.unit || 'g';
      const nut = calculateItemNutrition(matched, q, u);
      totalCal += (nut.kcal ?? nut.cal ?? 0);
      totalProt += (nut.protein ?? nut.prot ?? 0);
      totalCarb += (nut.carbs ?? nut.carb ?? 0);
      totalFat += (nut.fat ?? 0);
    }
  });

  const s = Math.max(1, Number(serves) || 2);
  return {
    total: { cal: Math.round(totalCal), prot: Math.round(totalProt), carb: Math.round(totalCarb), fat: Math.round(totalFat) },
    perServing: {
      calories: Math.round(totalCal / s),
      protein: Math.round((totalProt / s) * 10) / 10,
      carbs: Math.round((totalCarb / s) * 10) / 10,
      fat: Math.round((totalFat / s) * 10) / 10,
      cal: Math.round(totalCal / s),
      prot: Math.round((totalProt / s) * 10) / 10
    }
  };
}

/**
 * Core Heuristic Engine: Analyzes a recipe and generates an 85+ Fit Score enhancement plan.
 */
export function generateEnhancementPlan(recipe, options = {}) {
  if (!recipe || typeof recipe !== 'object') return null;

  const state = typeof getState === 'function' ? (getState() || {}) : {};
  const products = Array.isArray(options.products) ? options.products : (state.products || []);
  const allIngredients = Array.isArray(options.ingredients) ? options.ingredients : (state.ingredients || []);

  const targets = resolveRecipeTargets(recipe, options);
  const targetMealType = targets.mealType;
  const initialFit = calculateMealFitScore(recipe, targetMealType, { ...options, variant: 'original' });
  const beforeScore = Math.round(Number(initialFit?.score) || 0);

  let currentServings = Number(recipe.servings || recipe.serves || 2) || 2;
  let proposedServings = currentServings;
  const adjustments = [];

  // Extract all ingredients with role and product attribution
  const { ingredientSections, ingredients } = cloneAndTraverseIngredients(recipe, i => i);
  let workingIngredients = JSON.parse(JSON.stringify(ingredients));

  // Pre-calculate line nutrition
  workingIngredients.forEach((item, idx) => {
    item._idx = idx;
    item._matchedProduct = resolveProductForIngredient(item, { products, ingredients: allIngredients });
    item._role = classifyIngredientRole(item, item._matchedProduct);
  });

  let currentMacros = calculateBatchMacros(workingIngredients, currentServings, { products, allIngredients });
  let currentKcal = currentMacros.perServing.calories;
  let currentProt = currentMacros.perServing.protein;

  // --- LEVER 0: Yield Rebalance for Massive Batch Calories ---
  if (currentKcal > 1000) {
    proposedServings = currentServings + 1;
    currentMacros = calculateBatchMacros(workingIngredients, proposedServings, { products, allIngredients });
    currentKcal = currentMacros.perServing.calories;
    currentProt = currentMacros.perServing.protein;
    adjustments.push({
      id: 'adj_yield',
      type: 'yield',
      label: `Increase serving yield from ${currentServings} to ${proposedServings} portions`,
      detail: `Normalizes excessive calorie density (${Math.round(currentMacros.total.cal / currentServings)} kcal down to ${currentKcal} kcal/serving).`,
      deltaKcal: currentKcal - Math.round(currentMacros.total.cal / currentServings),
      deltaProt: currentProt - Math.round(currentMacros.total.prot / currentServings),
      active: true
    });
  }

  // --- LEVER 1: Cooking Fat Moderation ---
  if (currentKcal > targets.maxKcal) {
    const fats = workingIngredients.filter(i => i._role === 'cooking_fat');
    fats.forEach(fatItem => {
      const origQty = Number(fatItem.qty ?? fatItem.amount ?? 1) || 1;
      const unit = String(fatItem.unit || 'g').toLowerCase();
      const perServingQty = origQty / proposedServings;

      // If cooking fat exceeds 8ml / 8g per serving, trim it to 5-6ml per serving
      if (perServingQty > 8) {
        const targetPerServing = 5;
        const proposedTotal = quantizeQuantity(targetPerServing * proposedServings, unit);
        if (proposedTotal < origQty) {
          const origNut = calculateItemNutrition(fatItem._matchedProduct, origQty, unit);
          const newNut = calculateItemNutrition(fatItem._matchedProduct, proposedTotal, unit);
          const dKcal = Math.round((newNut.kcal - origNut.kcal) / proposedServings);

          fatItem.qty = proposedTotal;
          fatItem.amount = proposedTotal;
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

    currentMacros = calculateBatchMacros(workingIngredients, proposedServings, { products, allIngredients });
    currentKcal = currentMacros.perServing.calories;
    currentProt = currentMacros.perServing.protein;
  }

  // --- LEVER 2: Primary Protein Scaling ---
  if (currentProt < targets.minProt) {
    const proteins = workingIngredients.filter(i => i._role === 'primary_protein');
    if (proteins.length > 0) {
      // Pick the highest protein density item
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

      // Estimate needed protein
      const neededProtPerServing = targets.minProt - currentProt;
      const neededProtTotal = neededProtPerServing * proposedServings;
      const protPer100g = (Number(mainProt._matchedProduct?.protein || mainProt._matchedProduct?.prot) || 20);

      let newQty = origQty;

      if (isDiscrete) {
        // Resolve weight of a single discrete item
        const singleWeight = resolveProductItemWeight(mainProt._matchedProduct) 
          || (origQty > 0 ? (toGrams(origQty, unit, mainProt.name, 0) / origQty) : 0)
          || 100;
        const protPerItem = (protPer100g / 100) * singleWeight;
        const neededItems = protPerItem > 0 ? Math.ceil(neededProtTotal / protPerItem) : 1;
        
        // Ceiling: max 2 large pieces (burgers, chicken breasts, steaks) per serving
        const maxBatchCount = Math.max(origQty, proposedServings * 2);
        newQty = Math.min(maxBatchCount, origQty + neededItems);
      } else {
        // Continuous weight (g, ml)
        const additionalGrams = (neededProtTotal / protPer100g) * 100;
        const maxBatchQty = proposedServings * 220; // max 220g meat/tofu per serving
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
    currentMacros = calculateBatchMacros(workingIngredients, proposedServings, { products, allIngredients });
    currentKcal = currentMacros.perServing.calories;
    currentProt = currentMacros.perServing.protein;
  }

  // --- LEVER 3: Carb Balancing ---
  if (currentKcal > targets.maxKcal) {
    const carbs = workingIngredients.filter(i => i._role === 'starch_carb');
    carbs.forEach(carbItem => {
      const origQty = Number(carbItem.qty ?? carbItem.amount ?? 100) || 100;
      const unit = String(carbItem.unit || 'g').toLowerCase();
      const perServingQty = origQty / proposedServings;

      // If dry carbs exceed 85g/serv, scale to 70g/serv
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
    currentMacros = calculateBatchMacros(workingIngredients, proposedServings, { products, allIngredients });
    currentKcal = currentMacros.perServing.calories;
    currentProt = currentMacros.perServing.protein;
  }

  // --- LEVER 4: Smart Pantry Swaps ---
  const swapOpportunities = [
    {
      match: /\b(coconut milk|coconut cream)\b/i,
      exclude: /\blight\b/i,
      swapTo: 'Light Coconut Milk',
      productSearchRegex: /\blight coconut\b/i,
      kcalPer100gDiff: -110,
      protPer100gDiff: 0,
      reason: 'Cuts saturated fat calories',
      targetTaxonomy: {
        category: 'Store Cupboard',
        rootItem: 'Coconut Milk',
        subtype: 'Light Coconut Milk',
        productName: 'Light Coconut Milk 400ml'
      }
    },
    {
      match: /\b(beef burgers?|smashed burgers?|beef patties?|beef mince|mince)\b/i,
      exclude: /\b(5%|lean|turkey|chicken|vegan|plant)\b/i,
      swapTo: 'Lean Beef Burgers (5% Fat)',
      productSearchRegex: /\b(5% lean|lean beef|5% fat|lean mince|5% mince)\b/i,
      kcalPer100gDiff: -110,
      protPer100gDiff: +4.5,
      reason: 'Reduces heavy fat calories while boosting protein',
      targetTaxonomy: {
        category: 'Meat & Poultry',
        rootItem: 'Beef Burgers',
        subtype: 'Lean Beef Burgers (5% Fat)',
        productName: 'Lean Beef Burgers (5% Fat)'
      }
    },
    {
      match: /\b(cheddar|cheese|american cheese|monterey jack)\b/i,
      exclude: /\b(reduced|light|low fat|lighter)\b/i,
      swapTo: 'Reduced Fat Cheese Slices',
      productSearchRegex: /\b(reduced fat.*slice|mild slices?|lighter.*slice|30% reduced fat)\b/i,
      kcalPer100gDiff: -180,
      protPer100gDiff: +1,
      reason: 'Saves fat calories while maintaining creamy texture',
      targetTaxonomy: {
        category: 'Dairy & Eggs',
        rootItem: 'American Cheese Slices',
        subtype: 'Mild American Cheese Slices',
        productName: '10 Reduced Fat Mild Slices'
      }
    },
    {
      match: /\b(mayo|mayonnaise|burger sauce|aioli|sour cream)\b/i,
      exclude: /\b(light|reduced|low fat|0%)\b/i,
      swapTo: 'Light Mayonnaise / Light Burger Sauce',
      productSearchRegex: /\b(light mayo|lighter mayo|light mayonnaise)\b/i,
      kcalPer100gDiff: -400,
      protPer100gDiff: 0,
      reason: 'Significantly lowers condiment calories',
      targetTaxonomy: {
        category: 'Sauces, Condiments & Pastes',
        rootItem: 'Mayonnaise',
        subtype: 'Light Mayonnaise',
        productName: 'Light Mayonnaise'
      }
    },
    {
      match: /\b(greek yogurt|greek yoghurt|natural yogurt|natural yoghurt|creme fraiche)\b/i,
      exclude: /\b(0%|fat free|light|low fat)\b/i,
      swapTo: '0% Fat Greek Yogurt',
      productSearchRegex: /\b(0% fat|fat free|0% greek|skyr)\b/i,
      kcalPer100gDiff: -70,
      protPer100gDiff: +2,
      reason: 'High-protein, fat-free dairy substitute',
      targetTaxonomy: {
        category: 'Dairy & Eggs',
        rootItem: 'Greek Yogurt',
        subtype: '0% Fat Greek Yogurt',
        productName: '0% Fat Greek Style Yogurt'
      }
    }
  ];

  workingIngredients.forEach(item => {
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
        if ((currentKcal > targets.targetKcal || currentProt < targets.minProt) && wouldBeKcal >= targets.minKcal) {
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
          break;
        }
      }
    }
  });

  // --- LEVER 5: Lean Protein Addition (If no primary protein exists) ---
  if (currentProt < 25 && workingIngredients.filter(i => i._role === 'primary_protein').length === 0) {
    const boosterName = 'Firm Tofu (or Diced Chicken Breast)';
    const boosterQty = quantizeQuantity(125 * proposedServings, 'g');
    const boosterTaxonomy = {
      category: 'Refrigerated & Dairy',
      rootItem: boosterName,
      subtype: 'Firm Tofu',
      productName: 'Organic Firm Tofu 280g'
    };
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
      taxonomy: boosterTaxonomy,
      active: true
    });
    currentKcal += 140;
    currentProt += 24;
  }

  // Build the simulated enhanced recipe object
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
    recipeId: recipe.id,
    recipeTitle: recipe.name || recipe.title || 'Recipe',
    beforeScore,
    predictedScore,
    proposedServings,
    originalServings: currentServings,
    targets,
    adjustments,
    enhancedRecipePayload: simulatedEnhanced
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

  const methodSteps = Array.isArray(originalRecipe.method) ? [...originalRecipe.method] : (Array.isArray(originalRecipe.steps) ? [...originalRecipe.steps] : []);

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
    changes: changesList || 'Nutritionally optimized for household macro targets.',
    ingredientSections: finalSections,
    ingredients: finalIngredients,
    method: methodSteps,
    steps: methodSteps,
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
