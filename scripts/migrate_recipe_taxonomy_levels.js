#!/usr/bin/env node
/**
 * scripts/migrate_recipe_taxonomy_levels.js
 * One-time retrospective taxonomy promotion utility CLI.
 * Evaluates recipe ingredients mapped to sub-types and promotes them:
 * - Pass 1: Automatically promotes ingredients mapped to sub-types matching parent root item defaults or staples up to Root Item level (subtypeId: null).
 * - Pass 2: Identifies candidate ingredients that can be promoted to Category level.
 *
 * Usage:
 *   node scripts/migrate_recipe_taxonomy_levels.js --dry-run
 *   node scripts/migrate_recipe_taxonomy_levels.js --apply --key ~/.config/plateplan/service-account.json
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HOUSEHOLD_ID,
  scanRecipeTaxonomyElevations,
  applyRootElevationsToRecipe,
  applyCategoryPromotionToRecipe
} from '../src/services/RecipeTaxonomyElevationService.js';

export {
  HOUSEHOLD_ID,
  scanRecipeTaxonomyElevations,
  applyRootElevationsToRecipe,
  applyCategoryPromotionToRecipe
};

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
