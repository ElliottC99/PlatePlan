// scripts/generate-golden-master.js
// Generates a deterministic Golden Master baseline from households_elliott-chloe_backup.json
// through MealPlanGeneratorService and ShoppingListService. Household stock isn't tracked,
// so neither the plan nor the shopping list takes a stock list.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateWeeklyPlan, generateMealPlan } from '../src/services/MealPlanGeneratorService.js';
import { generateShoppingListFromPlan } from '../src/services/ShoppingListService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUP_FILE = path.join(ROOT_DIR, 'households_elliott-chloe_backup.json');
// The output is built from household data, so by default it goes next to the
// backups outside the repo, never into the tracked attic/.
const OUTPUT_FILE = process.argv[2]
  ? path.resolve(ROOT_DIR, process.argv[2])
  : path.join(os.homedir(), 'PlatePlan-backups', 'golden_master_post_refactor.json');

async function generateGoldenMaster() {
  const rawBackup = await fs.readFile(BACKUP_FILE, 'utf8');
  const backup = JSON.parse(rawBackup);

  const sub = backup.subcollections || {};
  const allRecipes = Object.values(sub.recipes || {})
    .map(doc => ({ id: doc.id, ...doc.data }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const allIngredients = Object.values(sub.ingredients || {})
    .map(doc => ({ id: doc.id, ...doc.data }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const allProducts = Object.values(sub.products || {})
    .map(doc => ({ id: doc.id, ...doc.data }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // Deterministic sample subset of 25 recipes
  const sampleRecipes = allRecipes.slice(0, 25);

  const weeklyPlan = generateWeeklyPlan({
    days: 7,
    startDate: '2026-10-26',
    dailyTargets: { calories: 2000, protein: 140, carbs: 200, fat: 65 },
    recipes: sampleRecipes,
    proteinRotation: true
  });

  const householdPlan = generateMealPlan({
    days: { plannerDays: { plan: { days: 7 } } },
    startDate: { plannerStartDate: '2026-10-26' },
    cadence: { prefs: { mealRepeatCadence: { breakfast: 1, lunch: 2, dinner: 2 } } },
    minFitScore: 0,
    maxFitScore: 100,
    recipes: sampleRecipes
  });

  const shoppingList = generateShoppingListFromPlan(
    weeklyPlan,
    sampleRecipes,
    allIngredients
  );

  const baseline = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceBackupExportedAt: backup.meta?.exportedAt || null,
      sampleCounts: {
        totalRecipesInBackup: allRecipes.length,
        sampleRecipesUsed: sampleRecipes.length,
        totalIngredientsInBackup: allIngredients.length,
        totalProductsInBackup: allProducts.length
      }
    },
    weeklyPlanOutput: weeklyPlan,
    householdPlanOutput: householdPlan,
    shoppingListOutput: shoppingList
  };

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(baseline, null, 2), 'utf8');
  console.log(`[GoldenMaster] Wrote baseline to ${OUTPUT_FILE}`);
}

generateGoldenMaster().catch(err => {
  console.error('[GoldenMaster] FATAL ERROR:', err);
  process.exit(1);
});
