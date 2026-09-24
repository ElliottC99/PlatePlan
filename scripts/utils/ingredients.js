/**
 * scripts/utils/ingredients.js
 * PlatePlan Ingredient Public API, Pack Math & Cost Calculators
 */

window.PlatePlanIngredients = window.PlatePlanIngredients || {};
window.PlatePlanIngredients.State = window.PlatePlanIngredients.State || {
  productMapCache: new Map(),
  groupMapCache: new Map()
};

(() => {
  const round1 = (value) => Math.round((parseFloat(value) || 0) * 10) / 10;

  const normaliseAliasText = (text) => String(text || '').replace(/\s+/g, ' ').trim();

  const getEffectiveProductPrice = (product) => {
    if (!product) return 0;
    return parseFloat(product.price) || 0;
  };

  const needsItemWeightForQtyIngredient = (ingredient, product) => {
    if (!ingredient || !product) return false;
    const unitStr = String(ingredient.unit || '').toLowerCase().trim();
    const isCounted = ['qty', 'count', 'item', 'items', 'whole', 'piece', 'pieces', 'pack', 'unit', 'units'].includes(unitStr) || (!unitStr && +(ingredient.qty || ingredient.grams || 0) > 0);
    if (!isCounted) return false;
    const packUnit = String(product.packUnit || '').toLowerCase().trim();
    if (packUnit === 'qty' && +(product.itemWeight || 0) > 0) return false;
    if (['g', 'ml', 'kg', 'l'].includes(packUnit) && !(+product.itemWeight > 0)) return true;
    if (!(+product.itemWeight > 0) && !(+product.drainedWeight > 0) && packUnit !== 'qty') return true;
    return false;
  };

  const getIngredientMappingWarning = (ingredient, resolved) => {
    if (!ingredient || !resolved) return null;
    if (ingredient.groupId && resolved.group?.id && ingredient.groupId !== resolved.group.id) {
      return `Sub-type mismatch: ingredient specifies ${ingredient.groupId} but mapped to ${resolved.group.id}.`;
    }
    return null;
  };

  const calculateIngredientCost = (ingredient, product, serves = 1) => {
    if (!ingredient || !product || !(+product.price > 0)) return 0;
    const getGrams = typeof getEffectiveIngredientGrams === 'function' ? getEffectiveIngredientGrams : (window.getEffectiveIngredientGrams || (() => 0));
    const grams = getGrams(ingredient, product);
    const getUsable = typeof getProductUsablePackAmount === 'function' ? getProductUsablePackAmount : (window.getProductUsablePackAmount || (() => +(product.packSize || 100)));
    const packGrams = getUsable(product);
    if (!(grams > 0 && packGrams > 0)) return 0;
    const activeServes = +(serves) || 1;
    return ((+product.price / packGrams) * grams) / activeServes;
  };

  const formatProductPackSummary = (product) => {
    if (!product) return '';
    const size = product.packSize ?? '';
    const unit = product.packUnit || 'g';
    const itemWeight = product.itemWeight;
    const itemWeightUnit = product.itemWeightUnit || 'g';
    const drainedWeight = product.drainedWeight;
    const drainedWeightUnit = product.drainedWeightUnit || 'g';

    let base = size !== '' && size !== null && size !== undefined ? `${size}${unit}` : '';
    const parts = [];
    if (base) parts.push(base);
    if (drainedWeight && +drainedWeight > 0) {
      parts.push(`drained: ${drainedWeight}${drainedWeightUnit}`);
    }
    if (itemWeight && +itemWeight > 0) {
      parts.push(`1 item: ${itemWeight}${itemWeightUnit}`);
    }
    return parts.join(' · ') || `${size || ''}${unit || ''}`.trim();
  };

  const formatPackDisplay = (size, unit = 'g', itemWeight = null) => {
    if (!size && size !== 0) return '';
    const u = unit || 'g';
    if (itemWeight && +itemWeight > 0 && u !== 'g' && u !== 'ml') {
      return `${size}${u} (${itemWeight}g/item)`;
    }
    return `${size}${u}`;
  };

  const formatIngredientPackVariantLabel = (po) => {
    if (!po) return '';
    const size = po.packSize ?? po.size;
    const unit = po.packUnit || po.unit || 'g';
    const itemWeight = po.itemWeight || null;
    let label = formatProductPackSummary({
      packSize: size,
      packUnit: unit,
      itemWeight,
      itemWeightUnit: po.itemWeightUnit || 'g',
      drainedWeight: po.drainedWeight,
      drainedWeightUnit: po.drainedWeightUnit || 'g'
    });
    if (!label && itemWeight) label = `${itemWeight}g item`;
    if (po.price) label += `${label ? ' · ' : ''}£${(+po.price).toFixed(2)}`;
    return label;
  };

  function getIngredientState() {
    return window.PlatePlanIngredients.State;
  }

  function resetIngredientState() {
    window.PlatePlanIngredients.State.productMapCache.clear();
    window.PlatePlanIngredients.State.groupMapCache.clear();
  }

  Object.assign(window.PlatePlanIngredients, {
    round1,
    normaliseAliasText,
    getEffectiveProductPrice,
    needsItemWeightForQtyIngredient,
    getIngredientMappingWarning,
    calculateIngredientCost,
    formatProductPackSummary,
    formatPackDisplay,
    formatIngredientPackVariantLabel,
    getIngredientState,
    resetIngredientState,
    resetState: resetIngredientState
  });

  if (typeof window !== 'undefined') {
    window.round1 = round1;
    window.normaliseAliasText = normaliseAliasText;
    window.getEffectiveProductPrice = getEffectiveProductPrice;
    window.needsItemWeightForQtyIngredient = needsItemWeightForQtyIngredient;
    window.getIngredientMappingWarning = getIngredientMappingWarning;
    window.calculateIngredientCost = calculateIngredientCost;
    window.formatProductPackSummary = formatProductPackSummary;
    window.formatPackDisplay = formatPackDisplay;
    window.formatIngredientPackVariantLabel = formatIngredientPackVariantLabel;
    window.getIngredientState = getIngredientState;
    window.resetIngredientState = resetIngredientState;
  }
})();
