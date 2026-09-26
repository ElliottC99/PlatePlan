/**
 * src/main.js (v3.3.2)
 * Updated to initialize modern UI components post-hydration.
 */

import { hydrateHouseholdData } from './services/HydrationService.js';
import { waitForAuth } from './services/AuthService.js';
import { initRecipeList } from './components/RecipeList.js';

document.addEventListener('plateplan:state:recipes', (e) => {
  console.log(`[Modern Bootstrapper v3.3.2] Reactive Store broadcasted ${e.detail.length} recipes.`);
});

async function initApp() {
  console.log('[Modern Bootstrapper v3.3.2] Initializing ES6 Application & UI Components...');

  // Initialize UI mount points if available
  initRecipeList('recipe-container');

  await waitForAuth();
  await hydrateHouseholdData();
}

initApp();
