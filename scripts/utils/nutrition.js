/**
 * scripts/utils/nutrition.js
 * PlatePlan Nutrition Engine & Resolution Coordinator
 * Classic global namespace script.
 */

(() => {
  window.PlatePlanNutrition = window.PlatePlanNutrition || {};
  window.PlatePlanNutrition.State = window.PlatePlanNutrition.State || {
    isRefreshingDerivedState: false
  };

  const NutritionState = window.PlatePlanNutrition.State;

  const getEffectiveIngredientGrams = (ing, product) => {
    if (!ing) return 0;
    const qty = parseFloat(ing.qty ?? ing.amount ?? ing.grams ?? 0);
    const unit = (ing.unit || '').toLowerCase().trim();
    const itemWeight = product ? (parseFloat(product.itemWeight) || 100) : 100;
    return window.toGrams ? window.toGrams(qty, unit, itemWeight) : qty;
  };

  const resolveProductForIngredient = (ingredientOrId, contextOrState = null, targetState = null) => {
    if (typeof window !== 'undefined' && typeof window.PlatePlanIngredients?.resolveProductForIngredient === 'function') {
      return window.PlatePlanIngredients.resolveProductForIngredient(ingredientOrId, contextOrState, targetState);
    }

    if (!ingredientOrId) {
      return { product: null, group: null, productId: null, groupId: null };
    }

    let s = targetState;
    let resolutionContext = null;

    if (contextOrState && (contextOrState.ingredients || contextOrState.ingredientGroups || contextOrState.ingredientProductMappings || contextOrState.recipes)) {
      s = contextOrState;
    } else if (contextOrState && typeof contextOrState === 'object') {
      resolutionContext = contextOrState;
    }
    if (!s) {
      s = (typeof window !== 'undefined' ? window.state : null) || (typeof state !== 'undefined' ? state : null);
    }

    const productsList = s?.ingredients || s?.products || [];
    const groupsList = s?.ingredientGroups || [];
    const mappings = s?.ingredientProductMappings || {};

    let ing = ingredientOrId;
    let directId = null;
    if (typeof ing === 'string' || typeof ing === 'number') {
      directId = String(ing);
      ing = { id: directId, productId: directId, bankId: directId };
    }

    const findProductById = (id) => {
      if (!id) return null;
      const str = String(id);
      if (typeof window !== 'undefined' && window.platePlanIndexes?.products) {
        const idxP = window.platePlanIndexes.products.get(str) || window.platePlanIndexes.products.get(id);
        if (idxP) return idxP;
      }
      if (typeof window !== 'undefined' && typeof window.getProduct === 'function') {
        const p = window.getProduct(id);
        if (p) return p;
      }
      return productsList.find(p => p && (String(p.id) === str || p.name === id)) || null;
    };

    const findGroupById = (id) => {
      if (!id) return null;
      const str = String(id);
      if (typeof window !== 'undefined' && window.platePlanIndexes?.groups) {
        const idxG = window.platePlanIndexes.groups.get(str) || window.platePlanIndexes.groups.get(id);
        if (idxG) return idxG;
      }
      if (typeof window !== 'undefined' && typeof window.getIngredientGroup === 'function') {
        const g = window.getIngredientGroup(id);
        if (g) return g;
      }
      return groupsList.find(g => g && (String(g.id) === str || g.name === id)) || null;
    };

    let product = null;
    let group = null;

    if (resolutionContext) {
      const overId = (ing.id && resolutionContext.productOverrides?.[ing.id]) ||
                     (ing.id && resolutionContext.substitutions?.[ing.id]) ||
                     (ing.groupId && resolutionContext.productSelections?.[ing.groupId]) ||
                     (ing.groupId && resolutionContext.productOverrides?.[ing.groupId]);
      if (overId) {
        product = findProductById(overId);
      }
    }

    if (!product && ing.product && typeof ing.product === 'object') {
      product = ing.product;
    }

    if (!product && mappings) {
      const mappedId = (ing.ingredientId && mappings[ing.ingredientId]) ||
                       (ing.id && mappings[ing.id]) ||
                       (ing.name && mappings[ing.name]);
      if (mappedId) {
        product = findProductById(mappedId);
      }
    }

    if (!product) {
      const pId = ing.productId || ing.bankId;
      if (pId) {
        product = findProductById(pId);
      }
    }

    const targetGroupId = ing.groupId || ing.subTypeId;
    if (targetGroupId) {
      group = findGroupById(targetGroupId);
    }

    if (product && !group) {
      const pGroupId = product.groupId || product.subTypeId;
      if (pGroupId) {
        group = findGroupById(pGroupId);
      }
    }

    if (!product && group) {
      const defId = group.manualDefaultProductId || group.defaultProductId;
      if (defId) {
        product = findProductById(defId);
      }
      if (!product) {
        const groupProducts = productsList.filter(p => p && (p.groupId === group.id || p.subTypeId === group.id));
        if (groupProducts.length > 0) {
          product = groupProducts.find(p => p && (+p.cal > 0 || +p.prot > 0)) || groupProducts[0];
        }
      }
    }

    if (!product && directId && !group) {
      group = findGroupById(directId);
      if (group) {
        const defId = group.manualDefaultProductId || group.defaultProductId;
        if (defId) product = findProductById(defId);
        if (!product) {
          const groupProducts = productsList.filter(p => p && (p.groupId === group.id || p.subTypeId === group.id));
          if (groupProducts.length > 0) product = groupProducts[0];
        }
      }
    }

    if (!product && !group && (ing.ingredientId || ing.familyId)) {
      const famId = ing.ingredientId || ing.familyId;
      const fam = (s?.ingredientFamilies || []).find(f => f && (f.id === famId || f.name === famId));
      if (fam) {
        const defaultGroup = fam.defaultTypeId ? findGroupById(fam.defaultTypeId) : null;
        if (defaultGroup) {
          group = defaultGroup;
          const defId = defaultGroup.manualDefaultProductId || defaultGroup.defaultProductId;
          if (defId) product = findProductById(defId);
          if (!product) {
            const groupProducts = productsList.filter(p => p && (p.groupId === defaultGroup.id || p.subTypeId === defaultGroup.id));
            if (groupProducts.length > 0) product = groupProducts[0];
          }
        }
      }
    }

    return {
      ...(product || {}),
      product: product || null,
      group: group || null,
      productId: product?.id || null,
      groupId: group?.id || ing.groupId || null
    };
  };

  const getEffectiveIngredientAmount = (ing, resolutionContext) => {
    if (resolutionContext && resolutionContext.ingredientQuantityOverrides?.[ing.id] !== undefined) {
      return parseFloat(resolutionContext.ingredientQuantityOverrides[ing.id]) || 0;
    }
    return parseFloat(ing.qty ?? ing.amount ?? ing.grams ?? 1);
  };

  const resetState = function() {
    NutritionState.isRefreshingDerivedState = false;
    return getNutritionState();
  };

  const getNutritionState = function() {
    return { ...NutritionState };
  };

  const ensureIngredientGroups = (target = null) => {
    const s = target || (typeof window !== 'undefined' ? window.state : null) || (typeof state !== 'undefined' ? state : null);
    if (!s || typeof s !== 'object') return [];
    if (!Array.isArray(s.ingredientGroups)) {
      s.ingredientGroups = [];
    }
    if (!Array.isArray(s.ingredientFamilies)) {
      s.ingredientFamilies = [];
    }
    if (!Array.isArray(s.ingredients)) {
      s.ingredients = [];
    }
    if (Array.isArray(s.recipes)) {
      s.recipes.forEach(r => {
        if (!r || typeof r !== 'object') return;
        if (!Array.isArray(r.ingredientGroups)) {
          r.ingredientGroups = [];
        }
        if (r.enhanced && typeof r.enhanced === 'object' && !Array.isArray(r.enhanced.ingredientGroups)) {
          r.enhanced.ingredientGroups = [];
        }
      });
    }
    if (typeof window !== 'undefined' && window.platePlanIndexes?.groups) {
      s.ingredientGroups.forEach(g => {
        if (g && g.id) window.platePlanIndexes.groups.set(g.id, g);
      });
    }
    return s.ingredientGroups;
  };

  const ensureIngredientFamilies = (target = null) => {
    const s = target || (typeof window !== 'undefined' ? window.state : null) || (typeof state !== 'undefined' ? state : null);
    if (!s || typeof s !== 'object') return [];
    if (!Array.isArray(s.ingredientFamilies)) {
      s.ingredientFamilies = [];
    }
    if (typeof window !== 'undefined' && window.platePlanIndexes?.families) {
      s.ingredientFamilies.forEach(f => {
        if (f && f.id) window.platePlanIndexes.families.set(f.id, f);
      });
    }
    return s.ingredientFamilies;
  };

  const hasUsableIngredientNutrition = (ingredient) => {
    if (!ingredient) return false;
    let target = ingredient;
    if (typeof target === 'string' || typeof target === 'number') {
      const s = typeof window !== 'undefined' ? window.state : (typeof state !== 'undefined' ? state : null);
      if (s?.ingredients) {
        if (Array.isArray(s.ingredients)) {
          target = s.ingredients.find(i => i && (i.id === target || String(i.id) === String(target)));
        } else if (typeof s.ingredients === 'object') {
          target = s.ingredients[target] || Object.values(s.ingredients).find(i => i && (i.id === target || String(i.id) === String(target)));
        }
      }
      if (!target && typeof window !== 'undefined' && window.platePlanIndexes?.ingredients) {
        target = window.platePlanIndexes.ingredients.get(ingredient);
      }
    }
    if (!target || typeof target !== 'object') return false;

    const n = (target.nutrition && typeof target.nutrition === 'object') ? target.nutrition : {};
    const cal = target.cal ?? target.calories ?? target.kcal ?? target.kcals ?? target.energy ?? n.cal ?? n.calories ?? n.kcal ?? n.kcals;
    const prot = target.prot ?? target.protein ?? n.prot ?? n.protein;
    const carb = target.carb ?? target.carbs ?? n.carb ?? n.carbs;
    const fat = target.fat ?? n.fat;
    const fibre = target.fibre ?? target.fiber ?? n.fibre ?? n.fiber;

    const isValidNum = (v) => v !== null && v !== undefined && v !== '' && !isNaN(Number(v)) && Number(v) >= 0;

    if (isValidNum(cal) && Number(cal) > 0) return true;
    if ((isValidNum(prot) && Number(prot) > 0) || (isValidNum(carb) && Number(carb) > 0) || (isValidNum(fat) && Number(fat) > 0) || (isValidNum(fibre) && Number(fibre) > 0)) return true;
    if (isValidNum(cal) && isValidNum(prot) && isValidNum(carb)) return true;

    return false;
  };

  const getGroupIngredientFamily = (groupOrId, targetState = null) => {
    if (!groupOrId) return null;
    const s = targetState || (typeof window !== 'undefined' ? window.state : null) || (typeof state !== 'undefined' ? state : null);
    const families = s?.ingredientFamilies || [];
    const groups = s?.ingredientGroups || [];

    let group = groupOrId;
    if (typeof group === 'string' || typeof group === 'number') {
      const strId = String(group);
      if (typeof window !== 'undefined' && window.platePlanIndexes?.groups) {
        group = window.platePlanIndexes.groups.get(strId) || window.platePlanIndexes.groups.get(group);
      }
      if (!group || typeof group !== 'object') {
        group = groups.find(g => g && (String(g.id) === strId || g.name === groupOrId));
      }
      if (!group) {
        if (typeof window !== 'undefined' && window.platePlanIndexes?.families) {
          const directFam = window.platePlanIndexes.families.get(strId) || window.platePlanIndexes.families.get(groupOrId);
          if (directFam) return directFam;
        }
        return families.find(f => f && (String(f.id) === strId || f.name === groupOrId)) || null;
      }
    }

    if (!group || typeof group !== 'object') return null;

    const familyId = group.ingredientId || group.familyId;
    if (familyId) {
      if (typeof window !== 'undefined' && window.platePlanIndexes?.families) {
        const found = window.platePlanIndexes.families.get(String(familyId)) || window.platePlanIndexes.families.get(familyId);
        if (found) return found;
      }
      const found = families.find(f => f && (String(f.id) === String(familyId) || f.name === familyId));
      if (found) return found;
    }

    if (group.family) {
      const famStr = String(group.family).trim().toLowerCase();
      const found = families.find(f => f && (String(f.id) === group.family || String(f.name || '').trim().toLowerCase() === famStr));
      if (found) return found;
      return { id: group.ingredientId || group.familyId || group.family, name: group.family, cat: group.cat || 'other' };
    }

    if (group.cat) {
      const found = families.find(f => f && (f.cat === group.cat || f.id === group.cat));
      if (found) return found;
    }

    return null;
  };

  // == Attach methods to Namespace ==
  Object.assign(window.PlatePlanNutrition, {
    getEffectiveIngredientGrams,
    getEffectiveIngredientAmount,
    resolveProductForIngredient,
    ensureIngredientGroups,
    ensureIngredientFamilies,
    hasUsableIngredientNutrition,
    getGroupIngredientFamily,
    resetState,
    getNutritionState
  });

  // == Attach methods to Window ==
  if (typeof window !== 'undefined') {
    window.resolveProductForIngredient = resolveProductForIngredient;
    window.getEffectiveIngredientGrams = getEffectiveIngredientGrams;
    window.getEffectiveIngredientAmount = getEffectiveIngredientAmount;
    window.ensureIngredientGroups = ensureIngredientGroups;
    window.ensureIngredientFamilies = ensureIngredientFamilies;
    window.hasUsableIngredientNutrition = hasUsableIngredientNutrition;
    window.getGroupIngredientFamily = getGroupIngredientFamily;
    window.resetNutritionState = resetState;
    window.getNutritionState = getNutritionState;

    try {
      Object.defineProperty(window, 'isRefreshingDerivedState', {
        get() { return NutritionState.isRefreshingDerivedState; },
        set(val) { NutritionState.isRefreshingDerivedState = !!val; },
        configurable: true,
        enumerable: true
      });
    } catch (_) {
      window.isRefreshingDerivedState = NutritionState.isRefreshingDerivedState;
    }
  }
})();
