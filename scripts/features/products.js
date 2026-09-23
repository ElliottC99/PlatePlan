import { createLegacyView } from './create-legacy-view.js?v=3.3.4-mod';

/**
 * Returns literal HTML template string for Tesco Import Review Modal
 */
export function renderTescoImportReviewModalHtml() {
  return `
    <div class="tesco-import-review-modal" style="padding: 16px;">
      <!-- Section 1: Product Name & Brand inputs -->
      <div class="grid2" style="gap:10px; margin-bottom:10px;">
        <div>
          <label style="font-size:12px; font-weight:600;">Product Name</label>
          <input type="text" id="tp-name" placeholder="Product name" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);">
        </div>
        <div>
          <label style="font-size:12px; font-weight:600;">Brand</label>
          <input type="text" id="tp-brand" placeholder="Brand" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);">
        </div>
      </div>

      <!-- Section 2: "Import Review Inputs" card -->
      <div class="import-review-inputs-card" style="background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="font-size:12px; font-weight:700; color:var(--text); margin-bottom:8px;">Import Review Inputs</div>
        <div class="grid2" style="gap:10px; margin-bottom:10px;">
          <div>
            <label style="font-size:12px; font-weight:600;">Category</label>
            <select id="import-category" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);">
              <option value="Produce">Produce</option>
              <option value="Grains">Grains</option>
              <option value="Proteins">Proteins</option>
              <option value="Dairy">Dairy</option>
              <option value="Pantry">Pantry</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:600;">Storage (Ambient/Chilled/Frozen)</label>
            <select id="import-storage" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);">
              <option value="Ambient">Ambient</option>
              <option value="Chilled">Chilled</option>
              <option value="Frozen">Frozen</option>
            </select>
          </div>
        </div>
        <div class="grid2" style="gap:10px; margin-bottom:10px;">
          <div>
            <label style="font-size:12px; font-weight:600;">Drained / Usable weight (g)</label>
            <input type="number" id="import-usable-weight" placeholder="e.g. 235" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);">
          </div>
          <div>
            <label style="font-size:12px; font-weight:600;">Fibre (g)</label>
            <input type="number" id="import-fibre" step="0.1" placeholder="0.0" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);">
          </div>
        </div>
        <div>
          <label style="font-size:12px; font-weight:600;">Notes</label>
          <textarea id="import-notes" placeholder="Additional notes..." style="width:100%; min-height:48px; padding:6px; border-radius:6px; border:1px solid var(--border);"></textarea>
        </div>
      </div>

      <!-- Section 3: Pack Price (£), Pack Size & Unit, Usable Weight grid -->
      <div class="grid3" style="gap:10px; margin-bottom:10px;">
        <div>
          <label style="font-size:12px; font-weight:600;">Pack Price (£)</label>
          <input type="number" id="tp-price" placeholder="0.00" step="0.01" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);">
        </div>
        <div>
          <label style="font-size:12px; font-weight:600;">Pack Size & Unit</label>
          <div style="display:flex; gap:5px;">
            <input type="number" id="tp-pack" placeholder="500" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);">
            <select id="tp-pack-unit" style="width:75px; border:1px solid var(--border); border-radius:6px; padding:6px;">
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="qty">qty</option>
            </select>
          </div>
        </div>
        <div>
          <label style="font-size:12px; font-weight:600;">Usable Weight</label>
          <input type="number" id="tp-drained-weight" placeholder="e.g. 235" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);">
        </div>
      </div>

      <!-- Section 4: Nutrition per 100g grid (Calories, Protein, Carbs, Fat, Fibre) -->
      <div style="background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:10px;">
        <div style="font-size:12px; font-weight:700; color:var(--text2); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.04em;">Nutrition per 100g</div>
        <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:8px;">
          <div><label style="font-size:11px;">Calories (kcal)</label><input type="number" id="tp-cal" placeholder="0" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);"></div>
          <div><label style="font-size:11px;">Protein (g)</label><input type="number" id="tp-prot" placeholder="0" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);"></div>
          <div><label style="font-size:11px;">Carbs (g)</label><input type="number" id="tp-carb" placeholder="0" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);"></div>
          <div><label style="font-size:11px;">Fat (g)</label><input type="number" id="tp-fat" placeholder="0" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);"></div>
          <div><label style="font-size:11px;">Fibre (g)</label><input type="number" id="tp-fibre" placeholder="0" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);"></div>
        </div>
      </div>

      <!-- Section 5: Primary submit button -->
      <div class="btn-row" style="margin-top:12px;">
        <button class="btn primary" id="tesco-save-btn" style="width:100%; justify-content:center;">Save to Product Bank</button>
      </div>
    </div>
  `;
}

/**
 * Reads values from the Tesco import review modal DOM elements
 */
export function readTescoImportReviewModalInputs() {
  const categoryEl = document.getElementById('import-category') || document.getElementById('tp-cat');
  const storageEl = document.getElementById('import-storage') || document.getElementById('tp-storage');
  const usableWeightEl = document.getElementById('import-usable-weight') || document.getElementById('tp-drained-weight');
  const fibreEl = document.getElementById('import-fibre') || document.getElementById('tp-fibre');
  const notesEl = document.getElementById('import-notes') || document.getElementById('tp-notes');

  return {
    category: categoryEl?.value || 'Other',
    cat: categoryEl?.value || 'Other',
    storage: storageEl?.value || 'Ambient',
    drainedWeight: usableWeightEl?.value ? +usableWeightEl.value : null,
    usableWeight: usableWeightEl?.value ? +usableWeightEl.value : null,
    fibre: fibreEl?.value ? +fibreEl.value : 0,
    notes: notesEl?.value?.trim() || ''
  };
}

export function showTescoImportReviewModal(productData = {}, targetSubtype = null) {
  if (typeof window.showTescoImportReviewModal === 'function') {
    return window.showTescoImportReviewModal(productData, targetSubtype);
  }
}

export default createLegacyView({ id: 'bank', rootId: 'view-bank' });
