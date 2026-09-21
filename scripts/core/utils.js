/**
 * Standalone pure utility functions extracted from the old system.
 */

export function safeJsonStringify(val, replacer, space) {
  try {
    return JSON.stringify(val, replacer, space);
  } catch (err) {
    console.warn('safeJsonStringify failed:', err);
    return '{}';
  }
}

export function clonePlatePlanValue(value) {
  try {
    const str = safeJsonStringify(value, null, 'null');
    return str === 'null' ? value : JSON.parse(str);
  } catch (e) {
    return value;
  }
}

export function unwrapAndCleanItem(item) {
  if (!item || typeof item !== 'object') return item;
  let target = item;
  if (target.value && typeof target.value === 'object') {
    target = { ...target.value, ...target };
    delete target.value;
  }
  const clean = { ...target };
  delete clean.deviceId;
  delete clean.operationId;
  delete clean.revision;
  delete clean.updatedBy;
  delete clean._syncStatus;
  delete clean._dirty;
  
  // Never save calculated total macros into Firestore or state
  delete clean.totalKcal;
  delete clean.totalProtein;
  delete clean.totalCarb;
  delete clean.totalFat;
  delete clean.totalNutrition;
  
  if (clean.ingredients && Array.isArray(clean.ingredients)) {
    clean.isFavorite = (clean.isFavorite !== undefined) ? !!clean.isFavorite : false;
    clean.isFavourite = clean.isFavorite;
  }
  return clean;
}

export function stripUndefinedValues(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefinedValues);
  const copy = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      copy[k] = stripUndefinedValues(v);
    }
  }
  return copy;
}

export function sanitizePayloadForFirestore(data) {
  if (data === undefined) return null;
  try {
    const cleaned = stripUndefinedValues(data);
    const jsonStr = safeJsonStringify(cleaned, null, 'null');
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('[PAYLOAD SANITIZATION ERROR]', err);
    return data;
  }
}

export function getIngredientGroup(groupId) {
  if (!groupId) return null;
  return (window.state?.ingredientGroups || []).find(g => g.id === groupId) || null;
}

export function getProduct(productId) {
  if (!productId) return null;
  return (window.state?.ingredients || []).find(i => i.id === productId) || null;
}

export function getRecipe(recipeId) {
  if (!recipeId) return null;
  return (window.state?.recipes || []).find(r => r.id === recipeId) || null;
}

export function loadState() {
  let s = {
    recipes: [],
    ingredients: [],
    ingredientGroups: [],
    ingredientFamilies: [],
    ignoredGroupMergeSuggestions: [],
    ignoredDataQualityWarnings: [],
    dataQualityDismissals: {},
    useUpProducts: {},
    plan: {},
    planHistory: [],
    excluded: {},
    prefs: {
      exclude: 'mushrooms, courgette',
      exclusions: { shared: [], elliott: [], chloe: [] },
      diet: 'vegetarian',
      ecal: 2400,
      eprot: 130,
      ccal: 1700,
      cprot: 100,
      shopGroupBy: 'family',
      productPriority: 'protein',
      prioritiseUseUpProducts: false
    },
    customCats: {},
    isCloudHydrated: false
  };
  try {
    const d = localStorage.getItem('plateplan_v2');
    if (d) {
      const parsed = JSON.parse(d);
      s = { ...s, ...parsed };
    }
  } catch (e) {
    console.warn('loadState failed:', e);
  }
  return s;
}

export function saveState(stateToSave) {
  const target = stateToSave || window.state;
  if (!target) return false;
  try {
    target.updatedAt = new Date().toISOString();
    localStorage.setItem('plateplan_v2', JSON.stringify(target));
    window.dispatchEvent(new CustomEvent('plateplan:state-saved', { detail: { source: 'local', savedAt: Date.now() } }));
    return true;
  } catch (e) {
    console.warn('saveState failed:', e);
    return false;
  }
}

