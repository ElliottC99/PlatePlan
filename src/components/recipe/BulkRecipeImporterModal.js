/**
 * src/components/recipe/BulkRecipeImporterModal.js (v3.22.0)
 * Modal UI for pasting, scraping, and previewing recipes via JSON-LD, HTML, or raw text.
 */

import { importRecipeFromHtml, parseBulkRecipeText } from '../../services/RecipeImporter.js';
import { getState, setRecipes, setState } from '../../store/store.js';
import { saveRecipe } from '../../services/HouseholdRepository.js';

export function openBulkRecipeImporterModal() {
  const existingModal = document.getElementById('bulk-import-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-wrap open';
  modal.id = 'bulk-import-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="document.getElementById('bulk-import-modal').remove()"></div>
    <div class="modal-content" style="max-width:700px; padding:24px; background:var(--surface); border-radius:14px; box-shadow:0 8px 32px rgba(0,0,0,0.25); max-height:90vh; display:flex; flex-direction:column; gap:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="margin:0; font-size:18px; font-weight:700;">Import Recipe (JSON-LD / HTML / Text)</h3>
        <button class="btn ghost sm" onclick="document.getElementById('bulk-import-modal').remove()" aria-label="Close">✕</button>
      </div>
      
      <p style="margin:0; font-size:13px; color:var(--text-muted, #666);">
        Paste raw HTML (with JSON-LD schema), microdata, or text from BBC Good Food, Cookie and Kate, Serious Eats, etc.
      </p>

      <textarea id="bulk-import-text" placeholder="Paste HTML markup, JSON-LD, or raw recipe text here..." style="width:100%; height:180px; padding:12px; border:1px solid var(--border, #ccc); border-radius:8px; font-family:monospace; font-size:12px; resize:vertical; background:var(--surface2, #fbfbf9);"></textarea>

      <div id="import-preview-area" style="display:none; max-height:260px; overflow-y:auto; padding:12px; border:1px solid var(--border, #ddd); border-radius:8px; background:var(--surface); flex-direction:column; gap:12px;"></div>

      <div style="display:flex; gap:12px; justify-content:flex-end; align-items:center; margin-top:4px;">
        <button class="btn ghost" onclick="document.getElementById('bulk-import-modal').remove()">Cancel</button>
        <button id="btn-parse-preview" class="btn secondary">Preview Parsed Recipe</button>
        <button id="btn-parse-save" class="btn primary">Save to Recipe Vault</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  let currentParsedRecipes = [];

  const textInput = modal.querySelector('#bulk-import-text');
  const previewArea = modal.querySelector('#import-preview-area');

  const renderPreview = (recipes) => {
    if (!recipes || recipes.length === 0) {
      previewArea.style.display = 'none';
      previewArea.innerHTML = '';
      return;
    }

    previewArea.style.display = 'flex';
    let html = '';

    recipes.forEach((r, idx) => {
      html += `
        <div style="border-bottom:1px solid var(--border, #eee); padding-bottom:12px;">
          <h4 style="margin:0 0 6px; font-size:15px; color:var(--text);">#${idx + 1}: ${r.title || 'Untitled Recipe'}</h4>
          <div style="font-size:12px; color:var(--text-muted); display:flex; gap:12px; margin-bottom:8px;">
            <span><strong>Servings:</strong> ${r.servings || 4}</span>
            <span><strong>Prep:</strong> ${r.prepTimeMinutes || 0}m</span>
            <span><strong>Cook:</strong> ${r.cookTimeMinutes || 0}m</span>
            <span><strong>Macros:</strong> ${r.macros?.calories || 0} kcal, ${r.macros?.protein || 0}g protein</span>
          </div>
          
          <div style="font-size:12px; font-weight:600; margin-bottom:4px;">Parsed Ingredients (${r.ingredients?.length || 0}):</div>
          <div style="display:flex; flex-direction:column; gap:4px;">
      `;

      (r.ingredients || []).forEach(ing => {
        const badgeColor = ing.isNewTaxonomyItem ? 'background:#fff3cd; color:#856404; border:1px solid #ffeeba;' : 'background:#d4edda; color:#155724; border:1px solid #c3e6cb;';
        const badgeText = ing.isNewTaxonomyItem ? 'New Taxonomy Item' : `Matched: ${ing.matchedName || ing.name}`;

        html += `
          <div style="font-size:12px; display:flex; justify-content:space-between; align-items:center; background:var(--surface2, #f5f5f0); padding:4px 8px; border-radius:4px;">
            <span><strong>${ing.qty} ${ing.unit}</strong> ${ing.name} ${ing.notes ? `<em style="color:#777">(${ing.notes})</em>` : ''}</span>
            <span style="font-size:10px; padding:2px 6px; border-radius:999px; font-weight:600; ${badgeColor}">${badgeText}</span>
          </div>
        `;
      });

      html += `</div></div>`;
    });

    previewArea.innerHTML = html;
  };

  modal.querySelector('#btn-parse-preview').addEventListener('click', () => {
    const rawContent = textInput.value;
    if (!rawContent.trim()) return;

    const single = importRecipeFromHtml(rawContent);
    if (single) {
      currentParsedRecipes = [single];
    } else {
      currentParsedRecipes = parseBulkRecipeText(rawContent).map(r => ({
        id: crypto.randomUUID(),
        ...r,
        createdAt: new Date().toISOString()
      }));
    }

    renderPreview(currentParsedRecipes);
  });

  modal.querySelector('#btn-parse-save').addEventListener('click', async () => {
    const rawContent = textInput.value;
    if (!rawContent.trim()) return;

    if (currentParsedRecipes.length === 0) {
      const single = importRecipeFromHtml(rawContent);
      if (single) {
        currentParsedRecipes = [single];
      } else {
        currentParsedRecipes = parseBulkRecipeText(rawContent).map(r => ({
          id: crypto.randomUUID(),
          ...r,
          createdAt: new Date().toISOString()
        }));
      }
    }

    if (currentParsedRecipes.length === 0) {
      alert('Could not parse any valid recipe from the provided input.');
      return;
    }

    // Save strictly to recipes collection in Firestore without mutating root preferences
    for (const recipe of currentParsedRecipes) {
      const recipeToSave = {
        ...recipe,
        id: recipe.id || crypto.randomUUID(),
        createdAt: recipe.createdAt || new Date().toISOString()
      };
      await saveRecipe(recipeToSave);
    }

    // Update local Store state
    const currentState = getState() || {};
    const existingRecipes = currentState.recipes || [];
    const updatedRecipes = [...existingRecipes, ...currentParsedRecipes];
    setRecipes(updatedRecipes);

    modal.remove();

    if (typeof window.renderRecipeVault === 'function') {
      window.renderRecipeVault();
    }
  });
}

if (typeof window !== 'undefined') {
  window.openBulkRecipeImporterModal = openBulkRecipeImporterModal;
}
