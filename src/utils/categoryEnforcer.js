/**
 * src/utils/categoryEnforcer.js (v3.20.10)
 * Category Single Source of Truth (SSOT) Enforcement Utility.
 * Ensures products and sub-types strictly inherit category strings from their parent ingredients.
 */

export function toCanonicalCategoryName(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().split(/\s+/).map(w => w ? (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : '').join(' ');
}

export const slugifyToKebab = (str) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function enforceCategorySSOT(state = {}) {
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
  const products = Array.isArray(state.products) ? state.products : [];

  const ingCatMap = new Map();
  ingredients.forEach(i => {
    if (i?.id && (i.category || i.cat)) {
      ingCatMap.set(String(i.id), i.category || i.cat);
    }
  });

  ingredients.forEach(ing => {
    const parentCat = ing.category || ing.cat;
    if (parentCat && Array.isArray(ing.subtypes)) {
      ing.subtypes.forEach(st => {
        const canonicalCat = toCanonicalCategoryName(parentCat);
        const kebabCat = slugifyToKebab(canonicalCat);
        st.category = canonicalCat;
        st.cat = kebabCat;
      });
    }
  });

  products.forEach(p => {
    let parentCat = null;
    if (p.ingredientId && ingCatMap.has(String(p.ingredientId))) {
      parentCat = ingCatMap.get(String(p.ingredientId));
    } else if (p.groupId && ingCatMap.has(String(p.groupId))) {
      parentCat = ingCatMap.get(String(p.groupId));
    } else if (p.subtypeId) {
      for (const ing of ingredients) {
        if (Array.isArray(ing.subtypes) && ing.subtypes.some(st => String(st.id) === String(p.subtypeId))) {
          parentCat = ing.category || ing.cat;
          break;
        }
      }
    }

    if (parentCat) {
      const targetCat = toCanonicalCategoryName(parentCat);
      const targetKebab = slugifyToKebab(targetCat);
      p.category = targetCat;
      p.cat = targetKebab;
    }
  });

  return { ...state, ingredients, products };
}
