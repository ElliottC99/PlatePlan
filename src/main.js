/**
 * src/main.js (v3.3.1)
 * Main entry point enforcing auth-first execution order.
 */

import { hydrateHouseholdData } from './services/HydrationService.js';
import { waitForAuth } from './services/AuthService.js';

document.addEventListener('plateplan:state:recipes', (e) => {
  console.log(`[Modern Bootstrapper v3.3.1] SUCCESS! Reactive Store broadcasted ${e.detail.length} recipes from elliott-chloe.`);
});

async function initApp() {
  console.log('[Modern Bootstrapper v3.3.1] Initializing ES6 Application...');
  await waitForAuth();
  await hydrateHouseholdData();
}

initApp();
