/**
 * scripts/utils/vault-calc.js
 * PlatePlan Vault & Today Calculation Utilities
 * Classic global namespace & modular helper library.
 */

(() => {
  window.PlatePlanVault = window.PlatePlanVault || {};

  // == DATE & TEXT FORMATTERS ==

  function formatTodayDateLabel(value) {
    const parseFn = window.parsePlanLocalDate || window.PlatePlanPlanner?.parsePlanLocalDate;
    const date = typeof parseFn === 'function' ? parseFn(value) : null;
    return date ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date) : '';
  }

  function formatStockIngredientText(ing, scale = 1) {
    if (!ing || !ing.stockWaterMl) return '';
    const qty = Math.round(((+ing.qty || 1) * scale) * 10) / 10;
    const water = Math.round((+ing.stockWaterMl || 0) * scale);
    const name = ing.name || 'Stock Cube';
    return `${qty} ${name}${qty === 1 ? '' : 's'} mixed with ${water}ml water`;
  }

  function ingRaw(ing) {
    if (typeof ing === 'string') return ing;
    const stockText = formatStockIngredientText(ing);
    if (stockText) return stockText;
    return ing?.raw || [ing?.qty || '', ing?.unit || '', ing?.name || ''].filter(Boolean).join(' ');
  }

  // == FAVORITE VARIANT MATH & PREFS INITIALIZATION ==

  function hasVariantFavoritingInitialized() {
    const st = typeof state !== 'undefined' ? state : window.state;
    const list = st?.userPrefs?.favouriteVariantIds || st?.prefs?.favouriteVariantIds || st?.userPrefs?.favoriteVariantIds || st?.prefs?.favoriteVariantIds;
    return Array.isArray(list);
  }

  function ensureVariantFavoritingPrefs() {
    let st = typeof state !== 'undefined' ? state : window.state;
    if (!st) {
      if (typeof window !== 'undefined') {
        window.state = window.state || {};
        st = window.state;
      } else {
        st = {};
      }
    }
    if (!st.prefs) st.prefs = {};
    if (!st.userPrefs) st.userPrefs = st.prefs;
    const existing = st.userPrefs.favouriteVariantIds || st.prefs.favouriteVariantIds || st.userPrefs.favoriteVariantIds || st.prefs.favoriteVariantIds;
    if (!Array.isArray(existing)) {
      st.userPrefs.favouriteVariantIds = [];
      (st.recipes || []).forEach(r => {
        if (r && r.id && (r.isFavourite || r.isFavorite)) {
          const key = `${r.id}_original`;
          if (!st.userPrefs.favouriteVariantIds.includes(key)) {
            st.userPrefs.favouriteVariantIds.push(key);
          }
        }
      });
    } else {
      st.userPrefs.favouriteVariantIds = existing;
    }
    st.prefs.favouriteVariantIds = st.userPrefs.favouriteVariantIds;
    st.userPrefs.favoriteVariantIds = st.userPrefs.favouriteVariantIds;
    st.prefs.favoriteVariantIds = st.userPrefs.favouriteVariantIds;
    return st.userPrefs.favouriteVariantIds;
  }

  function isRecipeVariantFavourite(recipeId, variantKey = 'original') {
    if (!recipeId) return false;
    const list = ensureVariantFavoritingPrefs();
    const key = `${recipeId}_${variantKey}`;
    if (Array.isArray(list) && list.includes(key)) {
      return true;
    }
    const hasInit = hasVariantFavoritingInitialized();
    if (!hasInit && variantKey === 'original') {
      const st = typeof state !== 'undefined' ? state : window.state;
      const rec = (st?.recipes || []).find(r => r && r.id === recipeId);
      if (rec && (rec.isFavourite || rec.isFavorite)) return true;
    }
    return false;
  }

  const isRecipeVariantFavorite = isRecipeVariantFavourite;

  // == TARGET MACRO ALLOCATOR ==

  function calculateVaultTargetMacros(prefs = {}, selectedMealType = 'dinner') {
    const ecal = Number(prefs.ecal) || 2400;
    const eprot = Number(prefs.eprot) || 130;
    const ccal = Number(prefs.ccal) || 1700;
    const cprot = Number(prefs.cprot) || 100;

    const eAlloc = prefs.eAlloc || { b: 15, l: 25, d: 45, s: 15 };
    const cAlloc = prefs.cAlloc || { b: 25, l: 30, d: 35, s: 10 };
    const eProtAlloc = prefs.eProtAlloc || eAlloc;
    const cProtAlloc = prefs.cProtAlloc || cAlloc;

    let mKey = 'd';
    if (selectedMealType.includes('breakfast')) mKey = 'b';
    else if (selectedMealType.includes('lunch')) mKey = 'l';
    else if (selectedMealType.includes('snack')) mKey = 's';
    else if (selectedMealType.includes('dinner')) mKey = 'd';

    const eTgt = {
      cal: ecal * ((eAlloc[mKey] ?? 45) / 100),
      prot: eprot * ((eProtAlloc[mKey] ?? eAlloc[mKey] ?? 45) / 100)
    };
    const cTgt = {
      cal: ccal * ((cAlloc[mKey] ?? 35) / 100),
      prot: cprot * ((cProtAlloc[mKey] ?? cAlloc[mKey] ?? 35) / 100)
    };
    return {
      mealType: selectedMealType,
      targetCal_E: eTgt.cal,
      targetProt_E: eTgt.prot,
      targetCal_C: cTgt.cal,
      targetProt_C: cTgt.prot,
      e: eTgt,
      c: cTgt,
      prefs: { ecal, eprot, ccal, cprot }
    };
  }

  // == NAMESPACE & GLOBAL ATTACHMENTS ==

  window.PlatePlanVault.formatTodayDateLabel = formatTodayDateLabel;
  window.PlatePlanVault.formatStockIngredientText = formatStockIngredientText;
  window.PlatePlanVault.ingRaw = ingRaw;
  window.PlatePlanVault.hasVariantFavoritingInitialized = hasVariantFavoritingInitialized;
  window.PlatePlanVault.ensureVariantFavoritingPrefs = ensureVariantFavoritingPrefs;
  window.PlatePlanVault.isRecipeVariantFavourite = isRecipeVariantFavourite;
  window.PlatePlanVault.isRecipeVariantFavorite = isRecipeVariantFavorite;
  window.PlatePlanVault.calculateVaultTargetMacros = calculateVaultTargetMacros;

  window.formatTodayDateLabel = formatTodayDateLabel;
  window.formatStockIngredientText = formatStockIngredientText;
  window.ingRaw = ingRaw;
  window.hasVariantFavoritingInitialized = hasVariantFavoritingInitialized;
  window.ensureVariantFavoritingPrefs = ensureVariantFavoritingPrefs;
  window.isRecipeVariantFavourite = isRecipeVariantFavourite;
  window.isRecipeVariantFavorite = isRecipeVariantFavorite;
  window.calculateVaultTargetMacros = calculateVaultTargetMacros;
})();
