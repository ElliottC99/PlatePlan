/**
 * src/utils/RecipeAuditService.js (v3.30.0)
 * Diagnostic and repair utility for Recipe Mapping & Master Catalog relational integrity.
 * Audits recipes for orphaned IDs, legacy strings, and unlinked ingredients.
 */

import { getState, setRecipes } from '../store/store.js';
import { saveRecipe } from '../services/HouseholdRepository.js';

/**
 * Normalizes text for comparison.
 */
function normalizeText(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

/**
 * Calculates dice similarity coefficient.
 */
function calculateSimilarity(str1, str2) {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const intersection = words1.filter(w => words2.includes(w) && w.length > 2);
  if (intersection.length > 0) {
    return (2.0 * intersection.length) / (words1.length + words2.length);
  }
  return 0;
}

/**
 * Suggests best Master Catalog item or sub-type for a raw ingredient name.
 */
export function findBestCatalogMatch(rawName, ingredients = []) {
  if (!rawName || !Array.isArray(ingredients)) return null;
  const target = normalizeText(rawName);
  let bestMatch = null;
  let highestScore = 0;

  for (const ing of ingredients) {
    if (!ing || !ing.name) continue;
    const ingScore = calculateSimilarity(target, ing.name);
    if (ingScore > highestScore) {
      highestScore = ingScore;
      bestMatch = {
        ingredientId: ing.id,
        ingredientName: ing.name,
        category: ing.category || 'Pantry',
        subtypeId: null,
        subtypeName: null,
        displayName: ing.name,
        score: ingScore
      };
    }

    if (Array.isArray(ing.subtypes)) {
      for (const sub of ing.subtypes) {
        if (!sub || !sub.name) continue;
        const subScore = calculateSimilarity(target, `${ing.name} ${sub.name}`);
        if (subScore > highestScore) {
          highestScore = subScore;
          bestMatch = {
            ingredientId: ing.id,
            ingredientName: ing.name,
            category: ing.category || 'Pantry',
            subtypeId: sub.id,
            subtypeName: sub.name,
            displayName: `${ing.name} ➔ ${sub.name}`,
            score: subScore
          };
        }
      }
    }
  }

  return highestScore >= 0.5 ? bestMatch : null;
}

/**
 * Audits every recipe in state.recipes against state.ingredients and nested subtypes.
 * Identifies:
 *  a. Orphaned references (ingredientId or subtypeId not found in state).
 *  b. Legacy string-only ingredients lacking valid relational IDs.
 *  c. Mismatched or unlinked items.
 */
export function auditRecipeMappings(stateData = null) {
  const state = stateData || getState() || {};
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];

  const ingredientById = new Map();
  const subtypeMap = new Map();

  ingredients.forEach(ing => {
    if (ing && ing.id) {
      ingredientById.set(String(ing.id), ing);
      if (Array.isArray(ing.subtypes)) {
        ing.subtypes.forEach(sub => {
          if (sub && sub.id) {
            subtypeMap.set(String(sub.id), { subtype: sub, parentId: String(ing.id), parentName: ing.name });
          }
        });
      }
    }
  });

  const issues = [];

  recipes.forEach(recipe => {
    if (!recipe || typeof recipe !== 'object') return;
    const rawIngs = recipe.ingredients || recipe.recipe?.ingredients || recipe.parsedIngredients || [];
    const items = Array.isArray(rawIngs) ? rawIngs : (typeof rawIngs === 'object' ? Object.values(rawIngs) : []);

    items.forEach((item, index) => {
      let issueType = null;
      let message = '';
      let itemName = '';
      let currentIngredientId = null;
      let currentSubtypeId = null;
      let currentIngredientName = null;

      if (typeof item === 'string') {
        issueType = 'legacy_string';
        itemName = item.trim();
        message = 'Legacy string format lacking relational IDs.';
      } else if (item && typeof item === 'object') {
        itemName = String(item.name || item.ingredient || item.ingredientName || 'Unnamed Ingredient').trim();
        currentIngredientId = item.ingredientId || null;
        currentSubtypeId = item.subtypeId || null;

        if (!currentIngredientId && !currentSubtypeId) {
          issueType = 'unlinked';
          message = 'Ingredient lacks Master Catalog link.';
        } else if (currentIngredientId && !ingredientById.has(String(currentIngredientId))) {
          issueType = 'orphaned';
          message = `Orphaned ingredient ID "${currentIngredientId}" not in Master Catalog.`;
        } else if (currentIngredientId && ingredientById.has(String(currentIngredientId))) {
          const parent = ingredientById.get(String(currentIngredientId));
          currentIngredientName = parent.name;
          if (currentSubtypeId) {
            const hasSub = Array.isArray(parent.subtypes) && parent.subtypes.some(s => String(s.id) === String(currentSubtypeId));
            if (!hasSub) {
              issueType = 'orphaned';
              message = `Sub-type ID "${currentSubtypeId}" does not exist under "${parent.name}".`;
            }
          }
        } else if (currentSubtypeId && !subtypeMap.has(String(currentSubtypeId))) {
          issueType = 'orphaned';
          message = `Orphaned sub-type ID "${currentSubtypeId}".`;
        }
      }

      if (issueType) {
        const suggestion = findBestCatalogMatch(itemName, ingredients);
        issues.push({
          id: `audit_issue_${recipe.id}_${index}`,
          recipeId: String(recipe.id),
          recipeName: recipe.name || recipe.title || 'Untitled Recipe',
          itemIndex: index,
          itemRaw: item,
          itemName,
          qty: typeof item === 'object' ? (item.qty ?? item.amount ?? '') : '',
          unit: typeof item === 'object' ? (item.unit ?? item.measure ?? '') : '',
          currentIngredientId,
          currentSubtypeId,
          currentIngredientName,
          issueType,
          message,
          suggestedMatch: suggestion
        });
      }
    });
  });

  const flaggedRecipeIds = new Set(issues.map(i => i.recipeId));

  return {
    issues,
    summary: {
      totalRecipes: recipes.length,
      flaggedRecipesCount: flaggedRecipeIds.size,
      cleanRecipesCount: Math.max(0, recipes.length - flaggedRecipeIds.size),
      orphanedCount: issues.filter(i => i.issueType === 'orphaned').length,
      legacyCount: issues.filter(i => i.issueType === 'legacy_string').length,
      unlinkedCount: issues.filter(i => i.issueType === 'unlinked').length,
      mismatchedCount: issues.filter(i => i.issueType === 'mismatched').length,
      totalIssues: issues.length
    }
  };
}

/**
 * Relinks a single recipe ingredient item to the Master Catalog.
 */
export async function relinkRecipeIngredient({ recipeId, itemIndex, newIngredientId, newSubtypeId = null, newIngredientName = '', newSubtypeName = '', qty = null, unit = null }) {
  const state = getState() || {};
  const recipes = Array.isArray(state.recipes) ? [...state.recipes] : [];
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];

  const recIndex = recipes.findIndex(r => String(r.id) === String(recipeId));
  if (recIndex < 0) {
    throw new Error(`Recipe ID "${recipeId}" not found in state.`);
  }

  const recipe = JSON.parse(JSON.stringify(recipes[recIndex]));
  const ingsList = Array.isArray(recipe.ingredients) ? [...recipe.ingredients] : [];
  if (itemIndex < 0 || itemIndex >= ingsList.length) {
    throw new Error(`Ingredient index ${itemIndex} out of bounds for recipe "${recipe.name}".`);
  }

  const parentIng = ingredients.find(i => String(i.id) === String(newIngredientId));
  const subType = parentIng && newSubtypeId && Array.isArray(parentIng.subtypes) 
    ? parentIng.subtypes.find(s => String(s.id) === String(newSubtypeId))
    : null;

  const originalItem = ingsList[itemIndex];
  const originalQty = typeof originalItem === 'object' ? (originalItem.qty ?? originalItem.amount ?? 1) : 1;
  const originalUnit = typeof originalItem === 'object' ? (originalItem.unit ?? originalItem.measure ?? 'g') : 'g';

  const effectiveQty = qty !== null && qty !== undefined && qty !== '' ? Number(qty) || qty : originalQty;
  const effectiveUnit = unit !== null && unit !== undefined && unit !== '' ? unit : originalUnit;
  const effectiveIngName = parentIng?.name || newIngredientName || (typeof originalItem === 'string' ? originalItem : originalItem?.name);
  const effectiveSubName = subType?.name || newSubtypeName || '';

  const updatedItem = {
    name: effectiveSubName ? `${effectiveIngName} (${effectiveSubName})` : effectiveIngName,
    ingredientName: effectiveIngName,
    ingredientId: String(newIngredientId),
    subtypeId: newSubtypeId ? String(newSubtypeId) : null,
    subtypeName: effectiveSubName,
    qty: effectiveQty,
    unit: effectiveUnit
  };

  ingsList[itemIndex] = updatedItem;
  recipe.ingredients = ingsList;
  recipe.updatedAt = new Date().toISOString();

  // Optimistic store update
  recipes[recIndex] = recipe;
  setRecipes(recipes);

  document.dispatchEvent(new CustomEvent('plateplan:state:recipes', { detail: recipes }));
  document.dispatchEvent(new CustomEvent('plateplan:recipes-updated', { detail: recipes }));

  // Firestore write
  await saveRecipe(recipe);
  return { success: true, recipe, updatedItem };
}

/**
 * Batch relinks multiple recipe ingredient mapping issues.
 */
export async function batchRelinkRecipeMappings(fixes = []) {
  if (!Array.isArray(fixes) || fixes.length === 0) return { success: true, count: 0 };
  let appliedCount = 0;

  for (const fix of fixes) {
    try {
      await relinkRecipeIngredient(fix);
      appliedCount++;
    } catch (err) {
      console.warn('[RecipeAuditService] Failed relinking fix:', fix, err);
    }
  }

  return { success: true, count: appliedCount };
}
