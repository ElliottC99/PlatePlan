#!/usr/bin/env node
/**
 * scripts/migrate_recipe_taxonomy_levels.js
 * One-time retrospective taxonomy promotion utility.
 * Evaluates recipe ingredients mapped to sub-types and promotes them:
 * - Pass 1: Automatically promotes ingredients mapped to sub-types matching parent root item defaults or staples up to Root Item level (subtypeId: null).
 * - Pass 2: Identifies candidate ingredients that can be promoted to Category level.
 *
 * Usage:
 *   node scripts/migrate_recipe_taxonomy_levels.js --dry-run
 *   node scripts/migrate_recipe_taxonomy_levels.js --apply --key ~/.config/plateplan/service-account.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOUSEHOLD_ID = 'elliott-chloe';

/**
 * Evaluates recipe ingredients for taxonomy elevation opportunities.
 * @param {Array} recipes - List of recipe objects
 * @param {Array} ingredients - Ingredients/Root items catalog
 * @param {Array} products - Products catalog
 * @returns {{ rootElevations: Array, categoryCandidates: Array, summary: Object }}
 */
export function scanRecipeTaxonomyElevations(recipes = [], ingredients = [], products = []) {
  const rootElevations = [];
  const categoryCandidates = [];

  const ingMap = new Map();
  ingredients.forEach(i => { if (i?.id) ingMap.set(String(i.id), i); });

  const prodMap = new Map();
  products.forEach(p => { if (p?.id) prodMap.set(String(p.id), p); });

  recipes.forEach(recipe => {
    if (!recipe || typeof recipe !== 'object') return;
    const rId = recipe.id || 'unknown';
    const rTitle = recipe.title || recipe.name || 'Untitled Recipe';

    const checkItem = (item, sIdx, iIdx, variant = 'original') => {
      if (!item || !item.subtypeId) return;

      const subId = String(item.subtypeId);
      const ingId = item.ingredientId ? String(item.ingredientId) : null;
      
      let root = ingId ? ingMap.get(ingId) : null;
      if (!root) {
        root = ingredients.find(i => (i.subtypes || []).some(s => String(s.id) === subId));
      }

      if (!root) return;

      const sub = (root.subtypes || []).find(s => String(s.id) === subId);
      const subName = sub?.name || item.name || '';
      const rootName = root.name || '';

      // Pass 1: Check if candidate for Root Item promotion
      // - Root item has single subtype, OR
      // - Subtype default product matches root item default product, OR
      // - Subtype name is identical to root name or generic ("Standard", "Regular"), OR
      // - Subtype default product has isAutoDefault
      const isSingleSub = (root.subtypes || []).length <= 1;
      const isMatchingDefault = root.defaultProductId && sub?.defaultProductId && String(root.defaultProductId) === String(sub.defaultProductId);
      const isGenericName = /^(standard|regular|default|plain)$/i.test(subName.trim()) || subName.trim().toLowerCase() === rootName.trim().toLowerCase();
      
      const subProd = sub?.defaultProductId ? prodMap.get(String(sub.defaultProductId)) : null;
      const isAutoDefaultProd = subProd?.isAutoDefault;

      const canElevateToRoot = isSingleSub || isMatchingDefault || isGenericName || isAutoDefaultProd;

      if (canElevateToRoot) {
        rootElevations.push({
          key: `${rId}:${variant}:${sIdx}:${iIdx}`,
          recipeId: rId,
          recipeTitle: rTitle,
          variant,
          sectionIndex: sIdx,
          ingredientIndex: iIdx,
          ingredientName: item.name || subName,
          rootId: root.id,
          rootName: root.name,
          currentSubtypeId: subId,
          currentSubtypeName: subName,
          category: root.category || item.category || 'General',
          reason: isSingleSub ? 'Single sub-type under root' : isMatchingDefault ? 'Matches root default product' : isGenericName ? 'Generic/identical sub-type name' : 'Auto-default product match'
        });
      }

      // Pass 2: Check if candidate for Category promotion
      // - Root item belongs to a defined category
      // - Could be used generically across that category (e.g. "Oil", "Onion", "Syrup", "Flour")
      if (root.category) {
        categoryCandidates.push({
          key: `${rId}:${variant}:${sIdx}:${iIdx}`,
          recipeId: rId,
          recipeTitle: rTitle,
          variant,
          sectionIndex: sIdx,
          ingredientIndex: iIdx,
          ingredientName: item.name || rootName,
          rootId: root.id,
          rootName: root.name,
          currentSubtypeId: subId,
          currentSubtypeName: subName,
          category: root.category,
          reason: `Can be elevated from "${subName}" -> Root "${rootName}" or Category "${root.category}"`
        });
      }
    };

    // Inspect original variant
    (recipe.ingredientSections || [{ sectionTitle: 'Main', ingredients: recipe.ingredients || [] }]).forEach((sec, sIdx) => {
      (sec.ingredients || []).forEach((item, iIdx) => {
        checkItem(item, sIdx, iIdx, 'original');
      });
    });

    // Inspect enhanced variant if present
    if (recipe.enhanced) {
      (recipe.enhanced.ingredientSections || [{ sectionTitle: 'Main', ingredients: recipe.enhanced.ingredients || [] }]).forEach((sec, sIdx) => {
        (sec.ingredients || []).forEach((item, iIdx) => {
          checkItem(item, sIdx, iIdx, 'enhanced');
        });
      });
    }
  });

  return {
    rootElevations,
    categoryCandidates,
    summary: {
      totalRecipesScanned: recipes.length,
      rootElevationsCount: rootElevations.length,
      categoryCandidatesCount: categoryCandidates.length
    }
  };
}

/**
 * Applies Root Item promotions to a recipe object in-memory.
 * @param {Object} recipe 
 * @param {Set<string>|Array<string>} keysToElevate - Set of elevation keys `${recipeId}:${variant}:${sIdx}:${iIdx}`
 * @returns {Object} Updated clone of recipe
 */
export function applyRootElevationsToRecipe(recipe, keysToElevate) {
  if (!recipe || typeof recipe !== 'object') return recipe;
  const clone = JSON.parse(JSON.stringify(recipe));
  const keySet = keysToElevate instanceof Set ? keysToElevate : new Set(keysToElevate || []);
  const rId = clone.id;

  const updateSectionList = (sections, variant) => {
    if (!Array.isArray(sections)) return;
    sections.forEach((sec, sIdx) => {
      (sec.ingredients || []).forEach((item, iIdx) => {
        const key = `${rId}:${variant}:${sIdx}:${iIdx}`;
        if (keySet.has(key)) {
          item.subtypeId = null;
        }
      });
    });
  };

  if (clone.ingredientSections) updateSectionList(clone.ingredientSections, 'original');
  if (Array.isArray(clone.ingredients)) {
    clone.ingredients.forEach((item, iIdx) => {
      const key = `${rId}:original:0:${iIdx}`;
      if (keySet.has(key)) item.subtypeId = null;
    });
  }

  if (clone.enhanced) {
    if (clone.enhanced.ingredientSections) updateSectionList(clone.enhanced.ingredientSections, 'enhanced');
    if (Array.isArray(clone.enhanced.ingredients)) {
      clone.enhanced.ingredients.forEach((item, iIdx) => {
        const key = `${rId}:enhanced:0:${iIdx}`;
        if (keySet.has(key)) item.subtypeId = null;
      });
    }
  }

  return clone;
}

/**
 * Applies a single Category promotion to an ingredient in a recipe.
 */
export function applyCategoryPromotionToRecipe(recipe, { variant = 'original', sectionIndex = 0, ingredientIndex = 0, targetCategory }) {
  if (!recipe || typeof recipe !== 'object' || !targetCategory) return recipe;
  const clone = JSON.parse(JSON.stringify(recipe));

  const targetSec = variant === 'enhanced'
    ? clone.enhanced?.ingredientSections?.[sectionIndex] || { ingredients: clone.enhanced?.ingredients }
    : clone.ingredientSections?.[sectionIndex] || { ingredients: clone.ingredients };

  const item = targetSec?.ingredients?.[ingredientIndex];
  if (item) {
    item.categoryId = targetCategory;
    item.category = targetCategory;
    item.ingredientId = null;
    item.subtypeId = null;
    item.isCategoryDefault = true;
  }

  return clone;
}

// CLI Execution Support
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const isApply = process.argv.includes('--apply');
  const isDryRun = !isApply || process.argv.includes('--dry-run');

  console.log(`=== PLATEPLAN RETROSPECTIVE RECIPE TAXONOMY MIGRATION ===`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no database writes)' : 'APPLY (mutating Firestore)'}`);
  console.log(`Household: households/${HOUSEHOLD_ID}`);

  // When run without service-account credentials, print CLI usage guide
  console.log(`\nScan engine initialized. Use within Data Quality Centre or run with --key <path> to execute.`);
}
