/**
 * scripts/utils/shopping-calc.js
 * PlatePlan Shopping Calculation & Pack Optimization Pure Subsystem
 * Classic global namespace script.
 */

(() => {
  window.PlatePlanShoppingList = window.PlatePlanShoppingList || {};
  window.PlatePlanShopping = window.PlatePlanShopping || window.PlatePlanShoppingList;

  function getPackVariants(baseIng) {
    if (!baseIng) return [];
    let options = [];
    if (baseIng.packSize && baseIng.price) {
      options.push({
        size: baseIng.packSize,
        unit: baseIng.packUnit,
        price: baseIng.price,
        itemWeight: baseIng.itemWeight,
        itemCount: baseIng.itemCount,
        drainedWeight: baseIng.drainedWeight,
        drainedWeightUnit: baseIng.drainedWeightUnit
      });
    }
    if (baseIng.packOptions && baseIng.packOptions.length > 0) {
      baseIng.packOptions.forEach(po => {
        options.push({
          size: po.packSize,
          unit: po.packUnit,
          price: po.price,
          itemWeight: po.itemWeight,
          itemCount: po.itemCount,
          drainedWeight: po.drainedWeight || baseIng.drainedWeight,
          drainedWeightUnit: po.drainedWeightUnit || baseIng.drainedWeightUnit
        });
      });
    }
    let uniq = [];
    options.forEach(opt => {
      const model = {
        packSize: opt.size,
        packUnit: opt.unit,
        itemWeight: opt.itemWeight,
        itemWeightUnit: opt.itemWeightUnit || 'g',
        drainedWeight: opt.drainedWeight,
        drainedWeightUnit: opt.drainedWeightUnit || 'g'
      };
      const grossG = typeof getProductGrossPackAmount === 'function' ? getProductGrossPackAmount(model) : (opt.size || 100);
      const drainedG = +opt.drainedWeight > 0 && typeof getProductUsablePackAmount === 'function' ? getProductUsablePackAmount(model) : 0;
      const g = typeof getProductUsablePackAmount === 'function' ? getProductUsablePackAmount(model) : grossG;
      if (g > 0 && opt.price > 0 && !uniq.some(uo => uo.g === g && uo.price === opt.price)) {
        uniq.push({ ...opt, g, grossG, drainedG, key: `${g}|${opt.price}` });
      }
    });
    return uniq;
  }

  function getOptimalPurchase(neededGrams, baseIng) {
    let uniqueOptions = getPackVariants(baseIng);
    if (uniqueOptions.length === 0) return null;

    const activeState = typeof window !== 'undefined' ? (window.state || (typeof state !== 'undefined' ? state : null)) : null;
    const pick = activeState?.packPicks?.[baseIng?.id];
    if (pick) {
      const chosen = uniqueOptions.find(o => o.key === pick);
      if (chosen) {
        const qty = Math.max(1, Math.ceil(neededGrams / chosen.g));
        const formatDisplay = typeof formatPackDisplay === 'function' ? formatPackDisplay(chosen.size, chosen.unit, chosen.itemWeight) : `${chosen.size}${chosen.unit || 'g'}`;
        return { desc: `${qty} × ${formatDisplay}`, cost: Math.round(qty * chosen.price * 100) / 100, manual: true };
      }
    }

    if (uniqueOptions.length <= 1) {
      const o = uniqueOptions[0];
      const qty = Math.max(1, Math.ceil(neededGrams / o.g));
      const formatDisplay = typeof formatPackDisplay === 'function' ? formatPackDisplay(o.size, o.unit, o.itemWeight) : `${o.size}${o.unit || 'g'}`;
      return { desc: `${qty} × ${formatDisplay}`, cost: Math.round(qty * o.price * 100) / 100 };
    }

    const reqGrams = Math.ceil(neededGrams);
    const maxOptGrams = Math.max(...uniqueOptions.map(o => o.g));
    const limit = reqGrams + maxOptGrams;

    let dp = new Array(limit + 1).fill(Infinity);
    let choice = new Array(limit + 1).fill(null);
    let itemsCount = new Array(limit + 1).fill(0);

    dp[0] = 0;

    for (let i = 0; i <= limit; i++) {
      if (dp[i] === Infinity) continue;
      for (let opt of uniqueOptions) {
        let next = i + opt.g;
        if (next <= limit) {
          let newCost = Math.round((dp[i] + opt.price) * 100) / 100;
          let newCount = itemsCount[i] + 1;

          if (newCost < dp[next] || (newCost === dp[next] && newCount < itemsCount[next])) {
            dp[next] = newCost;
            choice[next] = { opt, prev: i };
            itemsCount[next] = newCount;
          }
        }
      }
    }

    let bestIdx = -1;
    let bestCost = Infinity;
    let bestCount = Infinity;

    for (let i = reqGrams; i <= limit; i++) {
      if (dp[i] < bestCost || (dp[i] === bestCost && itemsCount[i] < bestCount)) {
        bestCost = dp[i];
        bestCount = itemsCount[i];
        bestIdx = i;
      }
    }

    if (bestIdx === -1 || bestCost === Infinity) return null;

    let combo = [];
    let curr = bestIdx;
    while (curr > 0 && choice[curr]) {
      combo.push(choice[curr].opt);
      curr = choice[curr].prev;
    }

    const counts = {};
    combo.forEach(o => {
      const formatDisplay = typeof formatPackDisplay === 'function' ? formatPackDisplay(o.size, o.unit, o.itemWeight) : `${o.size}${o.unit || 'g'}`;
      const k = formatDisplay || `${o.size}${o.unit}`;
      counts[k] = (counts[k] || 0) + 1;
    });

    return {
      desc: Object.keys(counts).map(k => `${counts[k]} × ${k}`).join(' and '),
      cost: bestCost
    };
  }

  function calculateShoppingPriceFromAggregates(agg) {
    const byProduct = {};
    Object.values(agg || {}).forEach(item => {
      if (!item.bankId || !item.grams) return;
      if (!byProduct[item.bankId]) byProduct[item.bankId] = { bankId: item.bankId, grams: 0, names: new Set() };
      byProduct[item.bankId].grams += +item.grams || 0;
      byProduct[item.bankId].names.add(item.name || item.productName || item.bankId);
    });
    const lines = Object.values(byProduct).map(line => {
      const product = typeof getProduct === 'function' ? getProduct(line.bankId) : null;
      if (!product) return null;
      const purchase = getOptimalPurchase(line.grams, product);
      const variants = getPackVariants(product);
      const cheapestBasis = variants.length ? variants.slice().sort((a, b) => (a.price / a.g) - (b.price / b.g))[0] : null;
      const consumedCost = cheapestBasis && cheapestBasis.g > 0 ? (cheapestBasis.price / cheapestBasis.g) * line.grams : 0;
      const pricePer100 = cheapestBasis && cheapestBasis.g > 0 ? cheapestBasis.price / cheapestBasis.g * 100 : 0;
      const flags = [];
      if (!variants.length) flags.push('missing pack data');
      if (pricePer100 > 8) flags.push(`high £/100g (£${pricePer100.toFixed(2)})`);
      if ((purchase?.cost || 0) > 20) flags.push('high checkout contribution');
      return { ...line, product, purchase, consumedCost, pricePer100, flags, name: [...line.names][0] || product.name };
    }).filter(Boolean);
    const estimatedTotal = lines.reduce((sum, line) => sum + (+line.purchase?.cost || 0), 0);
    const consumedTotal = lines.reduce((sum, line) => sum + (+line.consumedCost || 0), 0);
    const lineByBankId = Object.fromEntries(lines.map(line => [line.bankId, line]));
    return { estimatedTotal, consumedTotal, lines: lines.sort((a, b) => (b.purchase?.cost || 0) - (a.purchase?.cost || 0)), lineByBankId };
  }

  function encodeShopTarget(target) {
    return encodeURIComponent(JSON.stringify(target));
  }

  function decodeShopTarget(value) {
    try { return JSON.parse(decodeURIComponent(value || '')); } catch (e) { return null; }
  }

  function formatShoppingBatchAmount(grams) {
    return `${Math.round((+grams || 0) * 10) / 10}g`;
  }

  function getShoppingLineStateKey(groupId, bankId, fallback = '') {
    return [String(groupId || (typeof normaliseAliasText === 'function' ? normaliseAliasText(fallback) : fallback) || 'unresolved'), String(bankId || 'unresolved')].join('|');
  }

  function groupShoppingAllocationsByMeal(allocations) {
    const map = new Map();
    (allocations || []).forEach(al => {
      const key = [al.day, al.mealKey, al.recipeId, al.variant || 'original'].join('|');
      if (!map.has(key)) {
        map.set(key, {
          key,
          day: al.day,
          mealKey: al.mealKey,
          mealLabel: al.mealLabel,
          recipeId: al.recipeId,
          recipeTitle: al.recipeTitle || al.recipeName,
          variant: al.variant || 'original',
          people: new Set(),
          grams: 0,
          substituted: false,
          replacedNames: new Set(),
          targets: []
        });
      }
      const row = map.get(key);
      row.people.add(al.person || '');
      row.grams += +al.qtyGrams || 0;
      row.substituted = row.substituted || !!al.isSubstituted;
      if (al.replacedIngredientName) row.replacedNames.add(al.replacedIngredientName);
      if (al.planMealId && al.originalKey) {
        row.targets.push({
          planMealId: al.planMealId,
          originalKey: al.originalKey,
          groupId: al.groupId || '',
          bankId: al.bankId || '',
          recipeId: al.recipeId || '',
          recipeName: al.recipeTitle || al.recipeName || '',
          day: al.day,
          mealKey: al.mealKey || '',
          person: al.person || ''
        });
      }
    });
    return [...map.values()].sort((a, b) => (+a.day || 0) - (+b.day || 0) || String(a.mealKey).localeCompare(String(b.mealKey)) || String(a.recipeTitle).localeCompare(String(b.recipeTitle)));
  }

  function readableHerbQuantity(qty, unit, factor) {
    const clean = String(unit || '').toLowerCase().replace(/s$/, '');
    if (clean === 'tbsp' || clean === 'tsp') {
      const teaspoons = qty * (clean === 'tbsp' ? 3 : 1) * factor;
      if (teaspoons >= 3 && Math.abs(teaspoons / 3 - Math.round(teaspoons / 3)) < 0.01) return { qty: Math.round(teaspoons / 3 * 10) / 10, unit: 'tbsp' };
      return { qty: Math.round(teaspoons * 10) / 10, unit: 'tsp' };
    }
    return { qty: Math.round(qty * factor * 10) / 10, unit: clean || unit || '' };
  }

  function buildHerbConversion(target, replacement) {
    const ing = typeof getPlannedIngredientForSubstitutionTarget === 'function' ? getPlannedIngredientForSubstitutionTarget(target) : null;
    if (!ing || !replacement) return null;
    const sourceGroup = typeof getIngredientGroup === 'function' ? getIngredientGroup(ing.groupId || (typeof getProduct === 'function' ? getProduct(ing.bankId)?.groupId : '')) : null;
    const targetGroup = typeof getIngredientGroup === 'function' ? getIngredientGroup(replacement.groupId) : null;
    const isHerbsFn = typeof isHerbsAndSpicesGroup === 'function' ? isHerbsAndSpicesGroup : (() => false);
    if (!isHerbsFn(sourceGroup) || !isHerbsFn(targetGroup) || !sourceGroup?.herbForm || !targetGroup?.herbForm || sourceGroup.herbForm === targetGroup.herbForm || !sourceGroup.herbKey || sourceGroup.herbKey !== targetGroup.herbKey) return null;
    const factor = sourceGroup.herbForm === 'fresh' && targetGroup.herbForm === 'dried' ? 1 / 3 : 3;
    const compatible = ['g', 'ml', 'tsp', 'tbsp'].includes(String(ing.unit || '').toLowerCase().replace(/s$/, ''));
    const converted = readableHerbQuantity(+ing.qty || 0, ing.unit, factor);
    return { sourceForm: sourceGroup.herbForm, targetForm: targetGroup.herbForm, herbKey: sourceGroup.herbKey, originalQty: +ing.qty || 0, originalUnit: ing.unit || '', qty: compatible ? converted.qty : (+ing.qty || 0), unit: compatible ? converted.unit : (ing.unit || ''), manual: !compatible, ratio: factor };
  }

  // == Namespace Attachments ==
  Object.assign(window.PlatePlanShoppingList, {
    getPackVariants,
    getOptimalPurchase,
    calculateShoppingPriceFromAggregates,
    encodeShopTarget,
    decodeShopTarget,
    encodeSubstTargetsPayload: encodeShopTarget,
    decodeSubstTargetsPayload: decodeShopTarget,
    formatShoppingBatchAmount,
    getShoppingLineStateKey,
    groupShoppingAllocationsByMeal,
    readableHerbQuantity,
    buildHerbConversion
  });

  if (window.PlatePlanShopping && window.PlatePlanShopping !== window.PlatePlanShoppingList) {
    Object.assign(window.PlatePlanShopping, window.PlatePlanShoppingList);
  }

  // == Global Window Aliases ==
  if (typeof window !== 'undefined') {
    window.getPackVariants = getPackVariants;
    window.getOptimalPurchase = getOptimalPurchase;
    window.calculateShoppingPriceFromAggregates = calculateShoppingPriceFromAggregates;
    window.encodeShopTarget = encodeShopTarget;
    window.decodeShopTarget = decodeShopTarget;
    window.encodeSubstTargetsPayload = encodeShopTarget;
    window.decodeSubstTargetsPayload = decodeShopTarget;
    window.formatShoppingBatchAmount = formatShoppingBatchAmount;
    window.getShoppingLineStateKey = getShoppingLineStateKey;
    window.groupShoppingAllocationsByMeal = groupShoppingAllocationsByMeal;
    window.readableHerbQuantity = readableHerbQuantity;
    window.buildHerbConversion = buildHerbConversion;
  }
})();
