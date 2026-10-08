/**
 * src/components/recipe-editor/RecipeImportParserForm.js (v3.14.1)
 * Modular UI component for Recipe Import & Text/URL Scraper:
 * - URL recipe scraper forms & web import inputs
 * - Raw text parser inputs & review cards
 * - Parsed recipe preview card generation
 */

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

/**
 * Renders the URL scraper & raw text import form shell.
 */
export function renderRecipeImportParserForm() {
  return `
    <div class="card pp-recipe-import-parser" style="padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:16px">
      <h3 style="margin:0 0 8px;font-size:15px;font-weight:700">Import & Parse Recipe</h3>
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Paste raw recipe text or import directly from web links.</div>

      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label for="recipe-paste-text" style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">PASTE RAW TEXT OR RECIPE BODY</label>
          <textarea id="recipe-paste-text" class="input" style="width:100%;height:100px;font-family:inherit;font-size:12.5px" placeholder="Paste ingredients, method, or full recipe block here..." name="recipe-paste-text"></textarea>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn primary sm" data-pp-click="reviewPastedRecipeText()" style="font-weight:700">
            ✨ Parse & Structure Recipe
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders a structured preview card for imported/parsed recipes.
 */
export function renderParsedRecipePreviewCard(parsed = {}) {
  const name = parsed.name || 'Parsed Recipe';
  const serves = parsed.servings || parsed.serves || 2;
  const time = parsed.timeMinutes || parsed.time || 30;
  const ingsCount = (parsed.ingredients || []).length;
  const stepsCount = (parsed.method || parsed.steps || []).length;

  return `
    <div class="card pp-parsed-preview-card" style="padding:14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <h4 style="margin:0;font-size:14px;font-weight:700">${escapeHtml(name)}</h4>
        <span class="tag" style="background:var(--green-bg, rgba(16,185,129,0.15));color:var(--green);font-weight:600">Parsed Successfully</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:6px;font-size:12px;color:var(--text2)">
        <span>Serves: ${serves}</span> ·
        <span>Time: ${time}m</span> ·
        <span>${ingsCount} ingredients</span> ·
        <span>${stepsCount} steps</span>
      </div>
    </div>
  `;
}
