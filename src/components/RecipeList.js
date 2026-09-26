/**
 * src/components/RecipeList.js (v3.3.4)
 * Reactive UI component for rendering the household recipe catalog.
 */

import { getState } from '../store/store.js';

export function initRecipeList(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`[RecipeList v3.3.4] Container element #${containerId} not found in DOM.`);
    return;
  }

  function render() {
    const { recipes } = getState();
    if (!recipes || recipes.length === 0) {
      container.innerHTML = `<div class="p-4 text-gray-500">Loading recipes or catalog empty...</div>`;
      return;
    }

    // Render a clean, high-performance template literal list
    container.innerHTML = `
      <div class="mb-4 text-sm font-semibold text-gray-700">Loaded Recipes (${recipes.length})</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${recipes.map(recipe => `
          <div class="p-4 bg-white rounded-lg shadow border border-gray-100">
            <h3 class="font-bold text-gray-800">${escapeHtml(recipe.title || recipe.name || 'Untitled Recipe')}</h3>
            <p class="text-xs text-gray-500 mt-1">Prep: ${escapeHtml(String(recipe.prepTime || recipe.time || 'N/A'))} mins | Servings: ${escapeHtml(String(recipe.servings || recipe.serves || 'N/A'))}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Simple HTML escaping helper to prevent injection flaws in template literals
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // Listen for reactive store dispatches
  document.addEventListener('plateplan:state:recipes', () => {
    render();
  });

  // Initial render check if data is already present
  render();
}
