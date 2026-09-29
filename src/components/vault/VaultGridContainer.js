/**
 * src/components/vault/VaultGridContainer.js (v3.8.6)
 * Modular UI component for Recipe Vault Grid Container:
 * - Grid layout containers & empty state handling
 * - Progressive list pagination buttons & loading skeletons
 */

import { renderVaultRecipeCard } from './VaultRecipeCard.js';

export function renderVaultGridContainer({
  recipes = [],
  mealType = 'dinner',
  isLoading = false,
  progressiveBtn = ''
} = {}) {
  if (isLoading) {
    return `
      <div class="ios-activity-skeleton" style="padding:40px;text-align:center">
        <div class="spinner"></div>
        <span class="ios-activity-skeleton-text" style="margin-top:10px;display:block">Syncing live recipes from cloud...</span>
      </div>
    `;
  }

  if (!recipes || recipes.length === 0) {
    return `
      <div class="card empty" style="padding:40px;text-align:center;color:var(--text2);background:var(--surface);border:1px solid var(--border);border-radius:12px">
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">No matching recipes found</div>
        <div style="font-size:13px">Try adjusting your search query, filters, or favourite toggle.</div>
      </div>
    `;
  }

  const cardsHtml = recipes.map(r => renderVaultRecipeCard(r, { mealType })).join('');
  return `
    <div class="vault-grid" style="display:flex;flex-direction:column;gap:12px">
      ${cardsHtml}
      ${progressiveBtn}
    </div>
  `;
}
