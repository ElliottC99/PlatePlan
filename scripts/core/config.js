// == CONFIGURATION ==
const PLATEPLAN_APP_VERSION = '3.3.7-mod';
const PLATEPLAN_SCHEMA_VERSION = 1;
const SK = 'plateplan_v2';
const BAKED_CANDIDATE_SK = 'plateplan_v2_baked_candidate';
const RECOVERY_SK = 'plateplan_v2_recovery';
const PLATEPLAN_APPEARANCE_SK = 'plateplan_appearance';
const PLATEPLAN_SIDEBAR_SK = 'plateplan_sidebar_groups';
const PLATEPLAN_MODULAR_MIGRATION_SK = 'plateplan_modular_migration_20_4';
const PLATEPLAN_EXPECTED_CACHE = 'plateplan-shell-v94';

function safeJsonStringify(obj, replacer = null, spaces = null) {
  const seen = new Set();
  const safeReplacer = function (key, value) {
    if (value !== null && typeof value === 'object') {
      if (typeof value.nodeType === 'number') return '[DOM Node]';
      if (typeof value.preventDefault === 'function') return '[Event]';
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (replacer) {
      return replacer(key, value);
    }
    return value;
  }
  try {
    return JSON.stringify(obj, safeReplacer, spaces);
  } catch (err) {
    console.warn('[safeJsonStringify failed]', err);
    return '"[Unserializable]"';
  }
}
window.safeJsonStringify = safeJsonStringify;

function safeLocalStorageSet(key, val) {
  try {
    const payload = typeof val === 'string' ? val : (typeof safeJsonStringify === 'function' ? safeJsonStringify(val) : JSON.stringify(val));
    localStorage.setItem(key, payload);
    return true;
  } catch (e) {
    console.warn('[LocalStorage Write Warning]', e);
    return false;
  }
}
window.safeLocalStorageSet = safeLocalStorageSet;

function safeSaveHistoryBackup(historyList) {
  try {
    const payload = typeof safeJsonStringify === 'function' ? safeJsonStringify(historyList || []) : JSON.stringify(historyList || []);
    localStorage.setItem('plateplan_history_backup', payload);
    return true;
  } catch (e) {
    console.warn('[History Backup Warning]', e);
    return false;
  }
}
window.safeSaveHistoryBackup = safeSaveHistoryBackup;

function clonePlatePlanValue(val) {
  if (val === null || val === undefined) return val;
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(val);
    }
  } catch (e) {}

  const seen = new Map();
  const cloner = (x, depth = 0) => {
    if (x === null || typeof x !== 'object') return x;
    if (depth > 20) return null;
    if (seen.has(x)) return seen.get(x);

    if (x instanceof Date) return new Date(x.getTime());
    if (x instanceof RegExp) return new RegExp(x.source, x.flags);
    if (typeof x.nodeType === 'number' || (typeof Element !== 'undefined' && x instanceof Element)) return null;
    if (x === window || (typeof global !== 'undefined' && x === global)) return null;
    if (typeof x.preventDefault === 'function' || (typeof Event !== 'undefined' && x instanceof Event)) return null;

    if (Array.isArray(x)) {
      const copy = [];
      seen.set(x, copy);
      for (const item of x) {
        copy.push(cloner(item, depth + 1));
      }
      return copy;
    }

    const copy = {};
    seen.set(x, copy);
    try {
      for (const [k, v] of Object.entries(x)) {
        copy[k] = cloner(v, depth + 1);
      }
    } catch (err) {}
    return copy;
  };
  return cloner(val);
}
window.clonePlatePlanValue = clonePlatePlanValue;

var platePlanNutritionCache = new Map();
window.platePlanNutritionCache = platePlanNutritionCache;

const STANDARD_CATS = {
  'meat-substitute': 'Meat substitutes',
  'legume': 'Legumes & pulses',
  'dairy-alternative': 'Dairy & alternatives',
  'tofu-tempeh': 'Tofu & tempeh',
  'egg': 'Eggs',
  'nuts-seeds': 'Nuts & seeds',
  'supplement': 'Supplements',
  'grain': 'Grains',
  'vegetables': 'Vegetables',
  'fruit': 'Fruit',
  'carbs-pasta-rice': 'Carbs (Pasta/Rice/Potato)',
  'sauces-condiments': 'Sauces & Condiments',
  'baking-spices': 'Baking & Spices',
  'beverages': 'Beverages',
  'store-cupboard': 'Store Cupboard',
  'other': 'Other'
};

let CAT = { ...STANDARD_CATS };

const SLOTS = [
  {key:'breakfastE',short:'Brekkie E',color:'var(--green)',cls:'badge-green'},
  {key:'breakfastC',short:'Brekkie C',color:'var(--green)',cls:'badge-green'},
  {key:'lunchE',short:'Lunch E',color:'var(--purple)',cls:'badge-purple'},
  {key:'lunchC',short:'Lunch C',color:'var(--purple)',cls:'badge-purple'},
  {key:'dinnerE',short:'Dinner E',color:'var(--coral)',cls:'badge-coral'},
  {key:'dinnerC',short:'Dinner C',color:'var(--coral)',cls:'badge-coral'},
];

const SLOT_LABELS = {
  breakfastE: 'Breakfast\nElliott',
  breakfastC: 'Breakfast\nChloe',
  lunchE: 'Lunch\nElliott',
  lunchC: 'Lunch\nChloe',
  dinnerE: 'Dinner\nElliott',
  dinnerC: 'Dinner\nChloe'
};

const SLOT_COLORS = {
  breakfastE: 'var(--green)',
  breakfastC: 'var(--green)',
  lunchE: 'var(--purple)',
  lunchC: 'var(--purple)',
  dinnerE: 'var(--coral)',
  dinnerC: 'var(--coral)'
};

const UNIT_TO_GRAMS = {
  g: 1, kg: 1000, ml: 1, l: 1000,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  tbsp: 15, tablespoon: 15, tablespoons: 15,
  cup: 240, cups: 240,
  oz: 28.35, ounce: 28.35, ounces: 28.35,
  lb: 453.6, lbs: 453.6, pound: 453.6, pounds: 453.6,
  'fl oz': 30, 'fl. oz': 30, 'fl. oz.': 30, 'fluid oz': 30, 'floz': 30,
  tin: 400, can: 400,
  handful: 30, handfuls: 30,
  'small bunch': 15, 'small bunches': 15,
  'large bunch': 30, 'large bunches': 30,
  bunch: 20, bunches: 20,
  pinch: 1, dash: 1,
  slice: 30, slices: 30, piece: 100, pieces: 100, stalk: 50, stalks: 50,
  sprig: 2, sprigs: 2, leaf: 1, leaves: 2
};

const defaultState = {
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

const URL_TYPES = ['tiktok', 'website', 'youtube', 'instagram'];

// Expose under window.PlatePlanConfig
window.PlatePlanConfig = {
  APP_VERSION: PLATEPLAN_APP_VERSION,
  PLATEPLAN_SCHEMA_VERSION,
  SK,
  BAKED_CANDIDATE_SK,
  RECOVERY_SK,
  PLATEPLAN_APPEARANCE_SK,
  PLATEPLAN_SIDEBAR_SK,
  PLATEPLAN_MODULAR_MIGRATION_SK,
  PLATEPLAN_EXPECTED_CACHE,
  STANDARD_CATS,
  CAT,
  SLOTS,
  SLOT_LABELS,
  SLOT_COLORS,
  UNIT_TO_GRAMS,
  defaultState,
  URL_TYPES
};

// Also expose directly on window for other scripts to use
Object.assign(window, window.PlatePlanConfig);
