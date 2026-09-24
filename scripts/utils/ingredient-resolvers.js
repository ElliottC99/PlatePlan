/**
 * scripts/utils/ingredient-resolvers.js
 * PlatePlan Fuzzy Matchers, Hierarchy Resolvers & Product Mapping Engine
 */

window.PlatePlanIngredients = window.PlatePlanIngredients || {};

(() => {
  const fuzzyMatchBank = (name) => {
    if (!name) return null;
    const getSearchVariantsFn = window.getSearchVariants || (str => [str.toLowerCase()]);
    const variants = getSearchVariantsFn(name);
    let best = null, bestScore = 0;

    const productBank = window.state?.ingredients || [];
    for (const ing of productBank) {
      const ingWords = ing.name.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length > 2);
      if (!ingWords.length) continue;

      variants.forEach(variant => {
        const words = variant.replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length > 2);
        if (!words.length) return;
        const intersection = words.filter(w => ingWords.some(iw => iw.includes(w) || w.includes(iw)));
        const union = new Set([...words, ...ingWords]);
        const score = intersection.length / union.size;
        if (score > bestScore) { bestScore = score; best = ing; }
      });
    }
    return bestScore >= 0.4 ? best : null;
  };

  const canonicalGroupKey = (str) => {
    return String(str || '')
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const canonicalGroupNameFromProduct = (product) => {
    if (!product) return '';
    let name = String(product.name || '').trim();
    if (product.brand && product.brand !== 'Generic' && name.toLowerCase().startsWith(product.brand.toLowerCase())) {
      name = name.slice(product.brand.length).trim();
    }
    name = name.replace(/\b\d+(?:\.\d+)?\s*(?:g|kg|ml|l|pack|pk|tins?|cans?)\b/gi, '').trim();
    name = name.replace(/\s+/g, ' ').trim();
    return name || product.name || '';
  };

  const fuzzyMatchIngredientGroup = (name) => {
    const groups = window.state?.ingredientGroups || [];
    if (!name || !groups.length) return null;
    const getSearchVariantsFn = window.getSearchVariants || (str => [str.toLowerCase()]);
    const variants = getSearchVariantsFn(name);
    let best = null, bestScore = 0;

    for (const group of groups) {
      const canonicalKeyFn = canonicalGroupKey;
      const exactFields = [group.name, group.family, ...(group.aliases || [])].map(canonicalKeyFn);
      if (variants.some(variant => exactFields.includes(canonicalKeyFn(variant)))) return group;

      const getSearchTextFn = window.getIngredientGroupSearchText || (() => '');
      const haystack = getSearchTextFn(group);
      const groupWords = haystack.replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length > 2);
      if (!groupWords.length) continue;

      variants.forEach(variant => {
        const words = variant.replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length > 2);
        if (!words.length) return;
        const intersection = words.filter(w => groupWords.some(gw => gw.includes(w) || w.includes(gw)));
        const union = new Set([...words, ...groupWords]);
        const score = intersection.length / union.size;
        if (score > bestScore) { bestScore = score; best = group; }
      });
    }
    return bestScore >= 0.35 ? best : null;
  };

  const inferIngredientFamilyFromText = (text) => {
    if (!text) return '';
    const clean = String(text).trim();
    const s = typeof window !== 'undefined' ? window.state : null;
    const families = s?.ingredientFamilies || [];
    const found = families.find(f => f && (f.name.toLowerCase() === clean.toLowerCase() || clean.toLowerCase().includes(f.name.toLowerCase())));
    return found ? found.name : clean;
  };

  const getIngredientById = (id, targetState = null) => {
    if (!id) return null;
    const s = targetState || (typeof window !== 'undefined' ? window.state : null);
    const families = s?.ingredientFamilies || [];
    return families.find(f => f && (f.id === id || f.name === id)) || null;
  };

  const getProductById = (id, targetState = null) => {
    if (!id) return null;
    const s = targetState || (typeof window !== 'undefined' ? window.state : null);
    const prods = s?.ingredients || s?.products || [];
    return prods.find(p => p && (p.id === id || p.name === id)) || null;
  };

  const getGroupProducts = (groupId, targetState = null) => {
    if (!groupId) return [];
    const s = targetState || (typeof window !== 'undefined' ? window.state : null) || (typeof state !== 'undefined' ? state : null);
    const list = s?.ingredients || s?.products || [];
    return list.filter(p => p && (p.groupId === groupId || p.subTypeId === groupId || (Array.isArray(p.groupIds) && p.groupIds.includes(groupId))));
  };

  const getFamilyGroups = (familyId, targetState = null) => {
    if (!familyId) return [];
    const s = targetState || (typeof window !== 'undefined' ? window.state : null) || (typeof state !== 'undefined' ? state : null);
    const families = s?.ingredientFamilies || [];
    const groups = s?.ingredientGroups || [];
    const family = (typeof window !== 'undefined' && window.platePlanIndexes?.families?.get(familyId)) ||
                   families.find(f => f && (f.id === familyId || f.name === familyId)) || null;

    if (family?.typeIds && Array.isArray(family.typeIds) && family.typeIds.length > 0) {
      const mapped = family.typeIds.map(id => {
        return (typeof window !== 'undefined' && window.platePlanIndexes?.groups?.get(id)) ||
               groups.find(g => g && g.id === id) || null;
      }).filter(Boolean);
      if (mapped.length > 0) return mapped;
    }

    return groups.filter(g => g && (g.ingredientId === familyId || g.familyId === familyId || (family && g.family === family.name)));
  };

  const getGroupHierarchyText = (group) => {
    if (!group) return '';
    const catMap = (typeof CAT !== 'undefined' && CAT) || {};
    const cat = catMap[group.cat] || group.cat || 'Other';
    const resolveFamily = typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily : (window.getGroupIngredientFamily || (() => null));
    const fam = group.family || resolveFamily(group)?.name || 'Ingredient';
    const typeName = (typeof getGroupTypeName === 'function' ? getGroupTypeName(group) : (window.getGroupTypeName ? window.getGroupTypeName(group) : group.name)) || 'Sub-type';
    return `${cat} > ${fam} > ${typeName}`;
  };

  const resolveProductForIngredient = (ingredientOrId, contextOrState = null, targetState = null) => {
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
      if (overId) product = findProductById(overId);
    }

    if (!product && ing.product && typeof ing.product === 'object') {
      product = ing.product;
    }

    if (!product && mappings) {
      const mappedId = (ing.ingredientId && mappings[ing.ingredientId]) ||
                       (ing.id && mappings[ing.id]) ||
                       (ing.name && mappings[ing.name]);
      if (mappedId) product = findProductById(mappedId);
    }

    if (!product) {
      const pId = ing.productId || ing.bankId;
      if (pId) product = findProductById(pId);
    }

    const targetGroupId = ing.groupId || ing.subTypeId;
    if (targetGroupId) group = findGroupById(targetGroupId);

    if (product && !group) {
      const pGroupId = product.groupId || product.subTypeId;
      if (pGroupId) group = findGroupById(pGroupId);
    }

    if (!product && group) {
      const defId = group.manualDefaultProductId || group.defaultProductId;
      if (defId) product = findProductById(defId);
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

  const resolveProductForIngredientWithContext = (ingredientOrId, context, targetState = null) => {
    return resolveProductForIngredient(ingredientOrId, context, targetState);
  };

  const familyKey = (name) => {
    if (!name) return '';
    return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  const inferHerbMetadata = (...values) => {
    const normaliseAlias = window.normaliseAliasText || (t => String(t || '').trim());
    const text = normaliseAlias(values.filter(Boolean).join(' ')).toLowerCase();
    const herbs = ['basil', 'coriander', 'cilantro', 'parsley', 'thyme', 'rosemary', 'oregano', 'mint', 'sage', 'dill', 'chives', 'marjoram', 'tarragon'];
    const herbKey = herbs.find(herb => new RegExp(`\\b${herb}\\b`).test(text)) || '';
    if (!herbKey) return { herbForm: '', herbKey: '' };
    return { herbForm: /\b(dried|dry)\b/.test(text) ? 'dried' : 'fresh', herbKey };
  };

  const getIngredientGroupSearchText = (group) => {
    if (!group) return '';
    const products = getGroupProducts(group.id);
    const family = typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily(group) : (window.getGroupIngredientFamily ? window.getGroupIngredientFamily(group) : null);
    const catMap = (typeof CAT !== 'undefined' ? CAT : {}) || {};
    return [
      group.name,
      group.cat,
      catMap[group.cat],
      group.family,
      family?.name,
      ...(family?.aliases || []),
      getGroupHierarchyText(group),
      ...(group.aliases || []),
      ...products.flatMap(p => [p.name, p.brand])
    ].filter(Boolean).join(' ').toLowerCase();
  };

  const isPowderOrSupplementProduct = (ing) => {
    const text = [ing?.name, ing?.brand, ing?.cat, ing?.family, ing?.notes].filter(Boolean).join(' ').toLowerCase();
    return /protein|whey|powder|creatine|supplement|casein|isolate|mass gainer|pre workout/.test(text);
  };

  Object.assign(window.PlatePlanIngredients, {
    fuzzyMatchBank,
    canonicalGroupKey,
    canonicalGroupNameFromProduct,
    fuzzyMatchIngredientGroup,
    inferIngredientFamilyFromText,
    getIngredientById,
    getProductById,
    getGroupProducts,
    getFamilyGroups,
    getGroupHierarchyText,
    resolveProductForIngredient,
    resolveProductForIngredientWithContext,
    familyKey,
    inferHerbMetadata,
    getIngredientGroupSearchText,
    isPowderOrSupplementProduct
  });

  if (typeof window !== 'undefined') {
    window.fuzzyMatchBank = fuzzyMatchBank;
    window.canonicalGroupKey = canonicalGroupKey;
    window.canonicalGroupNameFromProduct = canonicalGroupNameFromProduct;
    window.fuzzyMatchIngredientGroup = fuzzyMatchIngredientGroup;
    window.inferIngredientFamilyFromText = inferIngredientFamilyFromText;
    window.getIngredientById = getIngredientById;
    window.getProductById = getProductById;
    window.getGroupProducts = getGroupProducts;
    window.getFamilyGroups = getFamilyGroups;
    window.getGroupHierarchyText = getGroupHierarchyText;
    window.resolveProductForIngredient = resolveProductForIngredient;
    window.resolveProductForIngredientWithContext = resolveProductForIngredientWithContext;
    window.familyKey = familyKey;
    window.inferHerbMetadata = inferHerbMetadata;
    window.getIngredientGroupSearchText = getIngredientGroupSearchText;
    window.isPowderOrSupplementProduct = isPowderOrSupplementProduct;
  }
})();
