/**
 * src/main.js (v3.3.3)
 * Main application entry point for PlatePlan's modernized ES6 architecture.
 */

import { hydrateHouseholdData } from './services/HydrationService.js';
import { waitForAuth } from './services/AuthService.js';
import { initRecipeList } from './components/RecipeList.js';
import { initVersionFooter } from './components/VersionFooter.js';

document.addEventListener('plateplan:state:recipes', (e) => {
  console.log(`[Modern Bootstrapper v3.3.3] Reactive Store broadcasted ${e.detail.length} recipes.`);
});

async function initApp() {
  console.log('[Modern Bootstrapper v3.3.3] Initializing ES6 Application & UI Components...');

  // Initialize UI components and mount points
  initRecipeList('recipe-container');
  initVersionFooter('app-version');

  await waitForAuth();
  await hydrateHouseholdData();
}

initApp();
