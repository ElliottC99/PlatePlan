// scripts/generate-golden-master.js
// Generates a deterministic Golden Master baseline from households_elliott-chloe_backup.json
// through PlanGeneratorService, MealPlanGeneratorService, and ShoppingListService.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateWeeklyPlan, generateMealPlan } from '../src/services/MealPlanGeneratorService.js';
import { generateShoppingListFromPlan } from '../src/services/ShoppingListService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUP_FILE = path.join(ROOT_DIR, 'households_elliott-chloe_backup.json');
const OUTPUT_FILE = process.argv[2]
  ? path.resolve(ROOT_DIR, process.argv[2])
  : path.join(ROOT_DIR, 'attic', 'golden_master_post_refactor.json');

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

  // Deterministic sample subset of 25 recipes and 5 sample pantry stock items
  const sampleRecipes = allRecipes.slice(0, 25);
  const sampleInventory = allIngredients.slice(0, 5).map((ing, idx) => ({
    id: `inv_sample_${idx + 1}`,
    ingredientId: ing.id,
    name: ing.name,
    status: 'in_stock',
    quantity: 200,
    unit: 'g',
    isUseUp: idx === 0
  }));

  const weeklyPlan = generateWeeklyPlan({
    days: 7,
    startDate: '2026-10-26',
    dailyTargets: { calories: 2000, protein: 140, carbs: 200, fat: 65 },
    recipes: sampleRecipes,
    inventory: sampleInventory,
    pantryPriorityWeight: 1.5,
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
    sampleInventory,
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
        totalProductsInBackup: allProducts.length,
        sampleInventoryItems: sampleInventory.length
      }
    },
    weeklyPlanOutput: weeklyPlan,
    householdPlanOutput: householdPlan,
    shoppingListOutput: shoppingList
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(baseline, null, 2), 'utf8');
  console.log(`[GoldenMaster] Wrote baseline to ${OUTPUT_FILE}`);
}

generateGoldenMaster().catch(err => {
  console.error('[GoldenMaster] FATAL ERROR:', err);
  process.exit(1);
});
