/**
 * src/services/ShoppingCalculationService.js (v3.14.4)
 * Precision unit pricing, pack weight normalization, and robust fallbacks
 * for household shopping list generation.
 */

const DEFAULT_ITEM_PACK_GRAMS = {
  tofu: 350,
  tempeh: 200,
  cucumber: 350,
  onion: 150,
  shallot: 250,
  garlic: 60,
  carrot: 500,
  potato: 1000,
  parsnip: 500,
  broccoli: 350,
  cauliflower: 500,
  cabbage: 600,
  spinach: 200,
  lettuce: 200,
  tomato: 400,
  pepper: 160,
  chilli: 50,
  mushroom: 250,
  celery: 350,
  egg: 350,
  milk: 1136,
  cream: 300,
  cheese: 250,
  yogurt: 500,
  butter: 250,
  chicken: 500,
  beef: 500,
  mince: 500,
  pork: 500,
  salmon: 240,
  cod: 260,
  tuna: 145,
  prawn: 180,
  noodles: 300,
  pasta: 500,
  rice: 500,
  stock: 80,
  sauce: 150,
  oil: 500
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
    if (clean.includes(item.match)) {
      return { ...item };
    }
  }
  return {
    name: rawName || 'Pantry Essential',
    brand: 'Generic',
    price: 1.25,
    packSize: 250,
    packUnit: 'g',
    cat: 'Store Cupboard'
  };
}

export function normalizeProductPackGrams(product, itemName = '') {
  if (!product && !itemName) return 250;
  const pSize = Number(product?.packSize || product?.pack_size || 0);
  const pUnit = String(product?.packUnit || product?.pack_unit || 'g').toLowerCase().trim();
  const itemWeight = Number(product?.itemWeight || product?.item_weight || 0);

  if (pUnit === 'kg' && pSize > 0) return pSize * 1000;
  if (pUnit === 'l' && pSize > 0) return pSize * 1000;
  if ((pUnit === 'g' || pUnit === 'ml') && pSize >= 20) return pSize;

  if (itemWeight > 0) {
    const total = (pSize > 0 ? pSize : 1) * itemWeight;
    if (total >= 20) return total;
  }

  const name = String(product?.name || itemName || '').toLowerCase();
  for (const [kw, defaultG] of Object.entries(DEFAULT_ITEM_PACK_GRAMS)) {
    if (name.includes(kw)) {
      return (pSize > 1 && pSize <= 12) ? pSize * (defaultG / 2) : defaultG;
    }
  }

  if (pSize >= 20) return pSize;
  return 250;
}

export function calculateShoppingItemCost(item, bankIng = null) {
  const effectiveProduct = bankIng || item?.bankIng || getFallbackProductData(item?.name);
  const rawPrice = Number(effectiveProduct?.price || effectiveProduct?.cost || 0);
  const price = rawPrice > 0 ? rawPrice : Number(getFallbackProductData(item?.name).price);

  const isItemUnit = item?.needUnit === 'item' || String(item?.unit || '').toLowerCase().includes('qty') || String(item?.unit || '').toLowerCase().includes('item');
  const requiredQty = Number(item?.needQty ?? item?.qty ?? 1);
  const requiredGrams = Number(item?.grams ?? item?.weight ?? 0);

  let packsNeeded = 1;

  if (isItemUnit && requiredQty > 0) {
    const itemCount = Number(effectiveProduct?.itemCount || effectiveProduct?.packSize || 1);
    packsNeeded = Math.ceil(requiredQty / Math.max(1, itemCount));
  } else {
    const grams = requiredGrams > 0 ? requiredGrams : (requiredQty > 0 ? requiredQty * 100 : 250);
    const packGrams = normalizeProductPackGrams(effectiveProduct, item?.name);
    packsNeeded = Math.ceil(grams / Math.max(20, packGrams));
  }

  packsNeeded = Math.max(1, packsNeeded);
  let totalCost = price * packsNeeded;

  if (totalCost > 45) {
    const reasonablePackGrams = normalizeProductPackGrams(effectiveProduct, item?.name);
    const safeGrams = requiredGrams > 0 ? requiredGrams : 250;
    const safePacks = Math.max(1, Math.ceil(safeGrams / Math.max(50, reasonablePackGrams)));
    totalCost = Math.min(totalCost, price * safePacks);
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
  if (item.quantity && item.quantity !== '0g' && item.quantity !== '0' && item.quantity !== '0 g' && !item.quantity.startsWith('0')) {
    return item.quantity;
  }
  const qty = Number(item.needQty ?? item.qty ?? item.count ?? 0);
  const unit = String(item.needUnit ?? item.unit ?? '').toLowerCase().trim();
  const grams = Number(item.grams ?? item.weight ?? 0);

  if (['qty', 'item', 'count', 'piece', 'clove', 'cube', 'bulb', 'head', 'tin', 'can', 'pack', 'stalk', 'sprig', 'slice'].includes(unit) || !unit) {
    if (qty > 0) {
      const unitLabel = (unit === 'qty' || unit === 'item' || !unit) ? 'x' : ` ${unit}${qty > 1 ? 's' : ''}`;
      return (unit === 'qty' || unit === 'item' || !unit) ? `${qty}x` : `${qty}${unitLabel}`;
    }
  }

  if (grams > 0) {
    return grams >= 1000 ? `${(grams / 1000).toFixed(1).replace(/\.0$/, '')}kg` : `${Math.round(grams)}g`;
  }

  if (qty > 0) {
    if (['g', 'ml', 'kg', 'l'].includes(unit)) return `${qty}${unit}`;
    return `${qty}x`;
  }

  return '1x';
}

if (typeof window !== 'undefined') {
  window.ShoppingCalculationService = {
    normalizeProductPackGrams,
    calculateShoppingItemCost,
    getFallbackProductData,
    formatShoppingItemQuantity
  };
  window.calculateShoppingItemCost = calculateShoppingItemCost;
  window.normalizeProductPackGrams = normalizeProductPackGrams;
  window.formatShoppingItemQuantity = formatShoppingItemQuantity;
}
