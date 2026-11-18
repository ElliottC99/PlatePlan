/**
 * src/services/RecipeEnhancementSwaps.js
 * Canonical smart pantry swap opportunities and candidate matching for recipe enhancement.
 */

import { resolveProductForIngredient } from "../components/recipe/RecipeWizardStep3Handlers.js";
import { resolvePantryTaxonomyForSwap } from "./RecipeEnhancementNutrition.js";

// --- Canonical Smart Pantry Swap Opportunities ---
export const SWAP_OPPORTUNITIES = [
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
    match: /\b(creme fraiche|sour cream)\b/i,
    exclude: /\b(half fat|50% less|light|reduced fat|low fat)\b/i,
    swapTo: 'Half-Fat Creme Fraiche',
    productSearchRegex: /\b(half fat|50% less|light creme fraiche)\b/i,
    kcalPer100gDiff: -140,
    protPer100gDiff: 0,
    reason: 'Maintains creamy culinary sauce while cutting 50% fat calories',
    targetTaxonomy: {
      category: 'Dairy & Eggs',
      rootItem: 'Creme Fraiche',
      subtype: 'Half-Fat Creme Fraiche',
      productName: '50% Less Fat Creme Fraiche'
    }
  },
  {
    match: /\b(greek yogurt|greek yoghurt|natural yogurt|natural yoghurt)\b/i,
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

/**
 * Discovers safe culinary swap candidates for an ingredient using pantry hierarchy & learned memory.
 * Strictly prevents self-swapping and culinary mismatches.
 */
export function findCulinarySwapCandidates(item, { products = [], allIngredients = [], swapPreferences = {} } = {}) {
  if (!item) return [];
  const matchedProd = item._matchedProduct || resolveProductForIngredient(item, { products, ingredients: allIngredients });
  const matchedId = String(matchedProd?.id || '').toLowerCase();
  const matchedName = String(matchedProd?.name || item.name || '').toLowerCase();
  const rawIngName = String(item.name || '').toLowerCase();

  const candidates = [];
  const seenProductIds = new Set();
  if (matchedId) seenProductIds.add(matchedId);

  // 1. Household Swap Learning Memory (Top priority)
  const ingKey = rawIngName.trim().replace(/[^a-z0-9]/g, '_');
  const learned = swapPreferences[ingKey] || (matchedId ? swapPreferences[matchedId] : null);
  if (learned && learned.preferredProductId && !seenProductIds.has(String(learned.preferredProductId).toLowerCase())) {
    const prod = products.find(p => String(p.id) === String(learned.preferredProductId));
    if (prod) {
      seenProductIds.add(String(prod.id).toLowerCase());
      const pKcal = Number(prod.cal || prod.calories || prod.kcal || prod.macros?.calories || 0);
      const pProt = Number(prod.prot || prod.protein || prod.macros?.protein || 0);
      const origKcal = Number(matchedProd?.cal || matchedProd?.calories || matchedProd?.kcal || matchedProd?.macros?.calories || 0);
      const origProt = Number(matchedProd?.prot || matchedProd?.protein || matchedProd?.macros?.protein || 0);
      candidates.push({
        productId: prod.id,
        productName: prod.name,
        subtype: learned.preferredSubtype || prod.subtype || 'Preferred Substitute',
        category: prod.category || 'Dairy & Eggs',
        rootItem: learned.preferredRootItem || prod.rootItem || item.name,
        kcalPer100g: pKcal,
        protPer100g: pProt,
        deltaKcalPer100g: pKcal - origKcal,
        deltaProtPer100g: Math.round((pProt - origProt) * 10) / 10,
        isLearned: true,
        label: `⭐ ${prod.name} (${Math.round(pKcal - origKcal)} kcal/100g)`
      });
    }
  }

  // 2. Query Pantry Bank Hierarchy
  const ingDef = allIngredients.find(i => String(i.id) === String(item.ingredientId)) ||
                 allIngredients.find(i => String(i.name || '').toLowerCase() === rawIngName);

  if (ingDef) {
    const siblingProducts = products.filter(p => {
      if (!p || !p.id) return false;
      if (seenProductIds.has(String(p.id).toLowerCase())) return false;
      const matchesIng = String(p.ingredientId) === String(ingDef.id);
      const matchesSub = Array.isArray(ingDef.subtypes) && ingDef.subtypes.some(s => String(s.id) === String(p.subTypeId));
      return matchesIng || matchesSub;
    });

    siblingProducts.forEach(prod => {
      const pKcal = Number(prod.cal || prod.calories || prod.kcal || prod.macros?.calories || 0);
      const origKcal = Number(matchedProd?.cal || matchedProd?.calories || matchedProd?.kcal || matchedProd?.macros?.calories || 0);
      // Strictly prevent self-swap or zero-benefit swap
      if (pKcal < origKcal - 15) {
        seenProductIds.add(String(prod.id).toLowerCase());
        const pProt = Number(prod.prot || prod.protein || prod.macros?.protein || 0);
        const origProt = Number(matchedProd?.prot || matchedProd?.protein || matchedProd?.macros?.protein || 0);
        candidates.push({
          productId: prod.id,
          productName: prod.name,
          subtype: prod.subtype || ingDef.name,
          category: prod.category || ingDef.category || 'Pantry',
          rootItem: ingDef.name,
          kcalPer100g: pKcal,
          protPer100g: pProt,
          deltaKcalPer100g: pKcal - origKcal,
          deltaProtPer100g: Math.round((pProt - origProt) * 10) / 10,
          isLearned: false,
          label: `${prod.name} (${Math.round(pKcal - origKcal)} kcal/100g)`
        });
      }
    });
  }

  // 3. Curated Opportunities fallback (safely guarded against self-swaps)
  for (const opp of SWAP_OPPORTUNITIES) {
    if (opp.match.test(rawIngName) && !opp.exclude.test(rawIngName)) {
      // Discard if the current product already matches target (prevents Cheddar self-swap!)
      const alreadyMatchesTarget = opp.exclude.test(matchedName);
      if (alreadyMatchesTarget) continue;

      let matchedPantryProd = null;
      if (opp.productSearchRegex) {
        matchedPantryProd = products.find(p => 
          opp.productSearchRegex.test(p.name || '') && !seenProductIds.has(String(p.id).toLowerCase())
        );
      }
      if (matchedPantryProd) {
        seenProductIds.add(String(matchedPantryProd.id).toLowerCase());
        const pKcal = Number(matchedPantryProd.cal || matchedPantryProd.calories || matchedPantryProd.kcal || 0);
        const origKcal = Number(matchedProd?.cal || matchedProd?.calories || matchedProd?.kcal || (pKcal - opp.kcalPer100gDiff));
        candidates.push({
          productId: matchedPantryProd.id,
          productName: matchedPantryProd.name,
          subtype: opp.targetTaxonomy?.subtype || opp.swapTo,
          category: opp.targetTaxonomy?.category || 'General',
          rootItem: opp.targetTaxonomy?.rootItem || item.name,
          kcalPer100g: pKcal,
          protPer100g: Number(matchedPantryProd.protein || matchedPantryProd.prot || 0),
          deltaKcalPer100g: opp.kcalPer100gDiff,
          deltaProtPer100g: opp.protPer100gDiff,
          isLearned: false,
          label: `${matchedPantryProd.name} (${opp.kcalPer100gDiff} kcal/100g)`
        });
      } else {
        candidates.push({
          productId: null,
          productName: opp.targetTaxonomy?.productName || opp.swapTo,
          subtype: opp.targetTaxonomy?.subtype || opp.swapTo,
          category: opp.targetTaxonomy?.category || 'General',
          rootItem: opp.targetTaxonomy?.rootItem || item.name,
          kcalPer100g: 0,
          protPer100g: 0,
          deltaKcalPer100g: opp.kcalPer100gDiff,
          deltaProtPer100g: opp.protPer100gDiff,
          isLearned: false,
          label: `${opp.swapTo} (${opp.kcalPer100gDiff} kcal/100g)`
        });
      }
    }
  }

  return candidates;
}

/**
 * Evaluates a single optimization route towards the household macro targets.
 */
