/**
 * src/main.js
 * Main application entry point for PlatePlan's modernized ES6 architecture.
 */

import { hydrateHouseholdData } from './services/HydrationService.js';

// Listen for reactive store broadcast of recipes
document.addEventListener('plateplan:state:recipes', (e) => {
  console.log(`[Modern Bootstrapper] SUCCESS! Reactive Store broadcasted ${e.detail.length} recipes from the elliott-chloe household.`);
});

console.log('[Modern Bootstrapper] Initializing ES6 Application...');
hydrateHouseholdData();
