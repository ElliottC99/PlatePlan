import { createLegacyView } from './create-legacy-view.js?v=3.0.8';

/**
 * Returns literal HTML template string for Tesco Import Review Modal
 */
export function renderTescoImportReviewModalHtml() {
  return `
    <div id="import-review-fields-container" style="background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:12px;">
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
          </select>
        </div>
        <div>
          <label style="font-size:12px; font-weight:600;">Storage (ambient/chilled/frozen)</label>
          <input type="text" id="import-storage" placeholder="ambient/chilled/frozen" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);">
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
    category: categoryEl?.value || 'Pantry',
    cat: categoryEl?.value || 'Pantry',
    storage: storageEl?.value || 'ambient',
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
