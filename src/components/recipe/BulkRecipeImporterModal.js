/**
 * src/components/recipe/BulkRecipeImporterModal.js
 * Modal for pasting and parsing multiple recipes.
 */

import { parseBulkRecipeText } from '../../services/RecipeImporter.js';
import { getState } from '../../store/store.js';
import { save } from '../../services/HouseholdRepository.js';

export function openBulkRecipeImporterModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-wrap open';
  modal.id = 'bulk-import-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="document.getElementById('bulk-import-modal').remove()"></div>
    <div class="modal-content" style="max-width:600px; padding:20px; background:var(--surface); border-radius:12px;">
      <h3>Paste & Parse Recipes</h3>
      <textarea id="bulk-import-text" style="width:100%; height:300px; margin-bottom:10px;"></textarea>
      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button class="btn ghost" onclick="document.getElementById('bulk-import-modal').remove()">Cancel</button>
        <button id="btn-parse-save" class="btn primary">Parse & Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#btn-parse-save').addEventListener('click', async () => {
    const rawText = modal.querySelector('#bulk-import-text').value;
    const parsed = parseBulkRecipeText(rawText);
    
    const recipesToSave = parsed.map(r => ({
      ...r,
      id: crypto.randomUUID(),
      ingredients: r.rawIngredients.map(ing => ({ ...ing, id: crypto.randomUUID() })),
      createdAt: new Date().toISOString()
    }));
    
    if (recipesToSave.length > 0) {
      const currentState = getState() || {};
      const updatedRecipes = [...(currentState.recipes || []), ...recipesToSave];
      
      // Persist to store/database
      await save({ ...currentState, recipes: updatedRecipes });
      
      modal.remove();
      if (typeof window.renderRecipeVault === 'function') window.renderRecipeVault();
    }
  });
}

if (typeof window !== 'undefined') {
  window.openBulkRecipeImporterModal = openBulkRecipeImporterModal;
}
