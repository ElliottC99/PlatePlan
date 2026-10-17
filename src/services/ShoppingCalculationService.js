import { convertToStrictUnit } from './UnitConversionService.js';
import { getState } from '../store/store.js';

/**
 * src/services/ShoppingCalculationService.js (v3.31.31)
 * Precision unit pricing, pack weight normalisation, and robust fallbacks
 * for household shopping list generation.
 */

const DEFAULT_ITEM_PACK_GRAMS = {
  tofu: 350, tempeh: 200, cucumber: 350, onion: 150, shallot: 250, garlic: 60,
  carrot: 500, potato: 1000, parsnip: 500, broccoli: 350, cauliflower: 500, cabbage: 600,
  spinach: 200, lettuce: 200, tomato: 400, pepper: 160, chilli: 50, mushroom: 250,
  celery: 350, egg: 350, milk: 1136, cream: 300, cheese: 250, yogurt: 500,
  butter: 250, chicken: 500, beef: 500, mince: 500, pork: 500, salmon: 240,
  cod: 260, tuna: 145, prawn: 180, noodles: 300, pasta: 500, rice: 500, stock: 80, sauce: 150, oil: 500
};

const DEFAULT_FALLBACK_PRODUCTS = [
  { match: 'vegetable stock', name: 'Vegetable Stock Cubes', brand: 'Knorr', price: 1.45, packSize: 80, packUnit: 'g', cat: 'Store Cupboard' },
  { match: 'chicken stock', name: 'Chicken Stock Cubes', brand: 'Knorr', price: 1.45, packSize: 80, packUnit: 'g', cat: 'Store Cupboard' },
  { match: 'beef stock', name: 'Beef Stock Cubes', brand: 'Knorr', price: 1.45, packSize: 80, packUnit: 'g', cat: 'Store Cupboard' },
  { match: 'instant noodles', name: 'Egg Noodles / Instant Noodles', brand: 'Amoy', price: 1.25, packSize: 300, packUnit: 'g', cat: 'Grains & Pasta' },
  { match: 'noodles', name: 'Medium Egg Noodles', brand: 'Amoy', price: 1.35, packSize: 300, packUnit: 'g', cat: 'Grains & Pasta' },
  { match: 'shallot', name: 'Echalion Shallots', brand: 'Tesco', price: 1.35, packSize: 300, packUnit: 'g', cat: 'Fresh Produce' },
  { match: 'celery', name: 'Celery Sticks', brand: 'Tesco', price: 0.89, packSize: 350, packUnit: 'g', cat: 'Fresh Produce' },
  { match: 'spring onion', name: 'Spring Onions', brand: 'Tesco', price: 0.65, packSize: 100, packUnit: 'g', cat: 'Fresh Produce' },
  { match: 'ginger', name: 'Fresh Root Ginger', brand: 'Tesco', price: 0.70, packSize: 100, packUnit: 'g', cat: 'Fresh Produce' },
  { match: 'garlic', name: 'Garlic Bulbs 3 Pack', brand: 'Tesco', price: 0.95, packSize: 150, packUnit: 'g', cat: 'Fresh Produce' },
  { match: 'tofu', name: 'Organic Firm Tofu', brand: 'Tofoo Co', price: 2.30, packSize: 280, packUnit: 'g', cat: 'Meat & Protein' },
  { match: 'cucumber', name: 'Whole Cucumber', brand: 'Tesco', price: 0.89, packSize: 350, packUnit: 'g', cat: 'Fresh Produce' }
];

export function getFallbackProductData(rawName = '') {
  const clean = String(rawName || '').toLowerCase().trim();
  for (const item of DEFAULT_FALLBACK_PRODUCTS) {
    if (clean.includes(item.match)) return { ...item };
  }
  return { name: rawName || 'Pantry Essential', brand: 'Generic', price: 1.25, packSize: 250, packUnit: 'g', cat: 'Store Cupboard' };
}

export function normalizeProductPackGrams(product, itemName = '') {
  if (!product && !itemName) return 250;
  const pSize = Number(product?.packSize || product?.pack_size || 0);
  const pUnit = String(product?.packUnit || product?.pack_unit || 'g').toLowerCase().trim();
  const itemWeight = Number(product?.itemWeight || product?.item_weight || 0);

  if (pUnit === 'kg' && pSize > 0) return pSize * 1000;
  if (pUnit === 'l' && pSize > 0) return pSize * 1000;
  if ((pUnit === 'g' || pUnit === 'ml') && pSize >= 20) return pSize;
  if (itemWeight > 0 && (pSize > 0 ? pSize : 1) * itemWeight >= 20) return (pSize > 0 ? pSize : 1) * itemWeight;

  const name = String(product?.name || itemName || '').toLowerCase();
  for (const [kw, defaultG] of Object.entries(DEFAULT_ITEM_PACK_GRAMS)) {
    if (name.includes(kw)) return (pSize > 1 && pSize <= 12) ? pSize * (defaultG / 2) : defaultG;
  }
  return pSize >= 20 ? pSize : 250;
}

export function calculateShoppingItemCost(item, bankIng = null) {
  const effectiveProduct = bankIng || item?.bankIng || getFallbackProductData(item?.name);
  const rawPrice = Number(effectiveProduct?.price || effectiveProduct?.cost || 0);
  const price = rawPrice > 0 ? rawPrice : Number(getFallbackProductData(item?.name).price);
  const isItemUnit = item?.needUnit === 'item' || String(item?.unit || '').toLowerCase().includes('qty') || String(item?.unit || '').toLowerCase().includes('item');
  const requiredQty = Number(item?.needQty ?? item?.buyQty ?? item?.qty ?? 1);
  const requiredGrams = Number(item?.grams ?? item?.weight ?? 0);

  let packsNeeded = 1;
  if (isItemUnit && requiredQty > 0) {
    packsNeeded = Math.ceil(requiredQty / Math.max(1, Number(effectiveProduct?.itemCount || effectiveProduct?.packSize || 1)));
  } else {
    const grams = requiredGrams > 0 ? requiredGrams : (requiredQty > 0 ? requiredQty * 100 : 250);
    packsNeeded = Math.ceil(grams / Math.max(20, normalizeProductPackGrams(effectiveProduct, item?.name)));
  }

  packsNeeded = Math.max(1, packsNeeded);
  let totalCost = price * packsNeeded;
  if (totalCost > 45) {
    const safeGrams = requiredGrams > 0 ? requiredGrams : 250;
    totalCost = Math.min(totalCost, price * Math.max(1, Math.ceil(safeGrams / Math.max(50, normalizeProductPackGrams(effectiveProduct, item?.name)))));
  }

  return {
    cost: Math.round(totalCost * 100) / 100,
    price: Math.round(price * 100) / 100,
    packsNeeded,
    packGrams: normalizeProductPackGrams(effectiveProduct, item?.name)
  };
}

export function formatShoppingItemQuantity(item) {
  if (!item) return '1x';
  if (item.quantity && !['0g', '0', '0 g'].includes(item.quantity) && !item.quantity.startsWith('0')) return item.quantity;
  const qty = Number(item.buyQty ?? item.needQty ?? item.qty ?? item.count ?? 0);
  const unit = String(item.unit ?? item.needUnit ?? '').toLowerCase().trim();
  if (unit === 'qty' || unit === 'item' || unit === 'x' || !unit) return `${qty}x`;
  if (['g', 'ml', 'kg', 'l'].includes(unit)) return `${qty}${unit}`;
  return `${qty} ${unit}`;
}

export function getCanonicalIngredientId(item, ingredientsBank = []) {
  if (!item) return null;
  if (item.ingredientId) return String(item.ingredientId);
  if (item.bankId) return String(item.bankId);
  if (item.groupId) {
    const cleanGroup = String(item.groupId).replace(/^grp_/, '');
    if (cleanGroup.startsWith('ing')) return cleanGroup;
    return String(item.groupId);
  }
  if (item.familyId) return String(item.familyId);
  if (item.id && String(item.id).startsWith('ing')) return String(item.id);

  const rawName = String(item.name || item.ingredient || item.productName || item.raw || '').toLowerCase().trim();
  if (Array.isArray(ingredientsBank) && ingredientsBank.length && rawName) {
    const matched = ingredientsBank.find(b => 
      String(b.id) === String(item.id) ||
      String(b.groupId) === String(item.groupId) ||
      String(b.name || '').toLowerCase().trim() === rawName
    );
    if (matched) return String(matched.id);
  }
  return String(item.id || rawName.replace(/\s+/g, '_'));
}

export function aggregateShoppingListFromPlan(plan = null, state = null) {
  const storeState = getState ? getState() : {};
  const appState = state || storeState || (typeof window !== 'undefined' ? window.state : {}) || {};
  const activePlan = plan || appState.plan || {};
  const vaultRecipes = (Array.isArray(appState.recipes) && appState.recipes.length ? appState.recipes : null)
    || (typeof window !== 'undefined' && Array.isArray(window.recipes) ? window.recipes : []);
  const ingredientsBank = Array.isArray(appState.ingredients) ? appState.ingredients : [];
  const productsBank = Array.isArray(appState.products) ? appState.products : [];
  const atHomeMap = activePlan.shoppingAtHome || {};
  const prepGroups = Array.isArray(activePlan.mealPrepGroups) ? activePlan.mealPrepGroups : [];

  const aggregatedMap = new Map();
  const rawSlots = activePlan.slots && typeof activePlan.slots === 'object' ? activePlan.slots : {};

  const processSlotNode = (slotNode, portionWeight = 0.5, dayNum = 1, mealType = 'meal') => {
    if (!slotNode || slotNode.isSkipped || slotNode.skipped) return;
    if (slotNode.isSplit && (slotNode.elliott || slotNode.chloe)) {
      if (slotNode.elliott) processSlotNode(slotNode.elliott, 0.5, dayNum, mealType);
      if (slotNode.chloe) processSlotNode(slotNode.chloe, 0.5, dayNum, mealType);
      return;
    }
    const recipeId = typeof slotNode === 'string' ? slotNode : (slotNode.recipeId || slotNode.id);
    if (!recipeId) return;

    const fullRecipe = vaultRecipes.find(r => r && String(r.id) === String(recipeId));
    if (!fullRecipe) return;

    const variant = typeof slotNode === 'object' && slotNode.variant ? slotNode.variant : 'original';
    const rawIngs = (variant === 'enhanced' && fullRecipe.enhanced && Array.isArray(fullRecipe.enhanced.ingredients))
      ? fullRecipe.enhanced.ingredients
      : (Array.isArray(fullRecipe.ingredients) ? fullRecipe.ingredients : []);

    const recipeName = fullRecipe.title || fullRecipe.name || 'Recipe';
    const matchedPrep = prepGroups.find(g => String(g.recipeId) === String(recipeId) && Array.isArray(g.days) && g.days.some(d => Number(d) === Number(dayNum)));
    const prepGroupId = matchedPrep?.id || matchedPrep?.prepGroupId || matchedPrep?.key || (matchedPrep ? `prep_${matchedPrep.recipeId}` : null);
    const slotInstanceId = (typeof slotNode === 'object' && slotNode.instanceId) ? slotNode.instanceId : `instance_${recipeId}_d${dayNum}_${mealType}`;
    const cookingEventId = prepGroupId || slotInstanceId;

    rawIngs.forEach(ing => {
      if (!ing) return;
      const rawName = typeof ing === 'string' ? ing : (ing.name || ing.ingredient || ing.title || ing.item || ing.raw || '');
      if (!rawName) return;

      const ingId = typeof ing === 'object' ? (ing.id || ing.ingredientId || ing.groupId || null) : null;
      const subId = typeof ing === 'object' ? (ing.subtypeId || ing.subTypeId || null) : null;
      const prodId = typeof ing === 'object' ? (ing.productId || ing.bankId || null) : null;

      const canonicalIngId = getCanonicalIngredientId(ing, ingredientsBank);

      const stateOverrides = appState.overrides || {};
      const instanceProductOverrides = stateOverrides?.[cookingEventId]?.productOverrides || stateOverrides?.[cookingEventId]?.substitutions || {};
      const planSubstitutions = activePlan.substitutions || {};
      const planProductSelections = activePlan.productSelections || {};

      const lookupKeys = [
        canonicalIngId, ing.bankId, ing.productId, ing.id, ing.ingredientId, ing.groupId, ingId, rawName
      ].filter(Boolean).map(String);

      let overriddenProductId = null;
      for (const k of lookupKeys) {
        if (instanceProductOverrides?.[k]) { overriddenProductId = instanceProductOverrides[k]; break; }
        const scopedSub = planSubstitutions?.[`${cookingEventId}:${k}`];
        if (scopedSub) { overriddenProductId = typeof scopedSub === 'object' ? (scopedSub.productId || scopedSub.id) : scopedSub; break; }
      }
      if (!overriddenProductId) {
        for (const k of lookupKeys) {
          const globalSub = planSubstitutions?.[k];
          if (globalSub) { overriddenProductId = typeof globalSub === 'object' ? (globalSub.productId || globalSub.id) : globalSub; break; }
        }
      }
      if (!overriddenProductId) {
        for (const k of lookupKeys) {
          if (planProductSelections?.[k]) { overriddenProductId = planProductSelections[k]; break; }
        }
      }

      const matchedIng = ingredientsBank.find(i =>
        (canonicalIngId && String(i.id) === String(canonicalIngId)) ||
        (ingId && String(i.id) === String(ingId)) ||
        String(i.name || '').toLowerCase() === String(rawName).toLowerCase()
      ) || null;

      let overriddenProduct = null;
      if (overriddenProductId) {
        overriddenProduct = productsBank.find(p => String(p.id) === String(overriddenProductId) || String(p.name).toLowerCase() === String(overriddenProductId).toLowerCase())
          || ingredientsBank.find(i => String(i.id) === String(overriddenProductId) || String(i.name).toLowerCase() === String(overriddenProductId).toLowerCase());
      }

      const matchedProd = overriddenProduct || productsBank.find(p =>
        (prodId && String(p.id) === String(prodId)) ||
        (subId && String(p.subtypeId) === String(subId) && p.isAutoDefault) ||
        (matchedIng && String(p.id) === String(matchedIng.defaultProductId)) ||
        (matchedIng && String(p.ingredientId) === String(matchedIng.id) && p.isAutoDefault) ||
        (matchedIng && String(p.ingredientId) === String(matchedIng.id))
      ) || getFallbackProductData(rawName);

      const key = String(canonicalIngId || rawName).toLowerCase().replace(/\s+/g, '_');
      const rawQty = Number(ing.qty ?? ing.quantity ?? ing.amount ?? 1);
      const rawUnit = String(ing.unit || '').trim();

      const strict = convertToStrictUnit(rawQty, rawUnit, rawName);
      const convertedAmount = Math.round((strict.qty * portionWeight) * 10) / 10;
      const canonicalUnit = strict.unit;

      const existing = aggregatedMap.get(key) || {
        key,
        id: key,
        groupId: canonicalIngId || matchedIng?.id || ingId || key,
        ingredientId: canonicalIngId || matchedIng?.id || ingId,
        name: matchedIng?.name || rawName,
        brand: matchedProd?.brand || 'Tesco',
        cat: matchedIng?.category || ing.categoryId || ing.category || matchedProd?.category || matchedProd?.cat || 'General Groceries',
        category: matchedIng?.category || ing.categoryId || ing.category || matchedProd?.category || matchedProd?.cat || 'General Groceries',
        bankIng: matchedProd,
        buyQty: 0,
        requiredQty: 0,
        inStockQty: 0,
        unit: canonicalUnit,
        recipeBreakdown: [],
        isAtHome: !!atHomeMap[key],
        checked: !!atHomeMap[key]
      };

      if (!existing.unit && canonicalUnit) existing.unit = canonicalUnit;

      existing.buyQty += convertedAmount;
      existing.requiredQty += convertedAmount;
      existing.recipeBreakdown.push({
        cookingEventId, recipeName, day: dayNum, mealType,
        servings: slotNode.servings || fullRecipe.serves || 4, qty: convertedAmount
      });

      aggregatedMap.set(key, existing);
    });
  };

  Object.entries(rawSlots).forEach(([dayKey, dayObj], dayIdx) => {
    if (!dayObj || typeof dayObj !== 'object') return;
    const dayNum = dayIdx + 1;
    Object.entries(dayObj).forEach(([slotKey, slotVal]) => {
      const weight = (slotKey.endsWith('E') || slotKey.endsWith('C')) ? 0.5 : 1;
      const mealType = slotKey.replace(/[EC]$/, '');
      processSlotNode(slotVal, weight, dayNum, mealType);
    });
  });

  const items = [];
  const groupsMap = new Map();
  let totalCost = 0;

  aggregatedMap.forEach(entry => {
    entry.buyQty = Math.round(entry.buyQty * 10) / 10;
    entry.requiredQty = Math.round(entry.requiredQty * 10) / 10;

    const recipeSummaryMap = new Map();
    (entry.recipeBreakdown || []).forEach(b => {
      const groupKey = b.cookingEventId || b.recipeName || 'Recipe';
      if (!recipeSummaryMap.has(groupKey)) {
        recipeSummaryMap.set(groupKey, { cookingEventId: b.cookingEventId || '', recipeName: b.recipeName, totalQty: 0, usages: [] });
      }
      const sumEntry = recipeSummaryMap.get(groupKey);
      sumEntry.totalQty += b.qty;
      sumEntry.usages.push({ day: b.day, mealType: b.mealType, servings: b.servings, qty: b.qty });
    });

    entry.recipeSummary = Array.from(recipeSummaryMap.values()).map(rs => ({
      ...rs, totalQty: Math.round(rs.totalQty * 10) / 10
    }));

    entry.needQty = entry.buyQty;
    entry.needUnit = entry.unit;
    entry.grams = ['g', 'ml'].includes(entry.unit) ? entry.buyQty : entry.buyQty * 100;

    const costInfo = calculateShoppingItemCost(entry, entry.bankIng);
    entry.cost = costInfo.cost;
    entry.price = costInfo.price;
    entry.quantity = formatShoppingItemQuantity(entry);
    if (!entry.isAtHome) totalCost += entry.cost;
    items.push(entry);

    const cat = entry.category || 'General Groceries';
    if (!groupsMap.has(cat)) groupsMap.set(cat, { key: cat, name: cat, category: cat, items: [] });
    groupsMap.get(cat).items.push(entry);
  });

  return {
    items,
    groups: Array.from(groupsMap.values()),
    totalCost: Math.round(totalCost * 100) / 100
  };
}

if (typeof window !== 'undefined') {
  window.ShoppingCalculationService = {
    normalizeProductPackGrams, calculateShoppingItemCost, getFallbackProductData,
    formatShoppingItemQuantity, getCanonicalIngredientId, aggregateShoppingListFromPlan
  };
  window.calculateShoppingItemCost = calculateShoppingItemCost;
  window.normalizeProductPackGrams = normalizeProductPackGrams;
  window.formatShoppingItemQuantity = formatShoppingItemQuantity;
  window.getCanonicalIngredientId = getCanonicalIngredientId;
  window.aggregateShoppingListFromPlan = aggregateShoppingListFromPlan;
  window.computeWizardShoppingAgg = aggregateShoppingListFromPlan;
}
