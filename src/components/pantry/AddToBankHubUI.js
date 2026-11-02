/**
 * src/components/pantry/AddToBankHubUI.js
 * Master Router for Pantry Bank Additions:
 * 1) Category; 2) Root Item; 3) Sub-Type; 4) Product.
 * Every route delegates to AddItemWizardUI to enforce the complete hierarchical chain.
 * Strictly under 150 lines.
 */

import { openAddItemWizard } from './AddItemWizardUI.js';

function showHubModal(html) {
  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (wrap && content) {
    wrap.style.setProperty('z-index', '25005', 'important');
    content.style.setProperty('z-index', '25005', 'important');
    content.innerHTML = html;
    wrap.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

export function closeAddToBankModal() {
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) {
    wrap.classList.remove('open');
    document.body.style.overflow = '';
  }
}

export function openAddToBankModal(initialMode = null, prefillData = {}) {
  if (initialMode) {
    openAddItemWizard({ startAt: initialMode, ...prefillData });
    return;
  }

  const html = `
    <div class="add-to-bank-hub-modal" style="padding: 24px; max-width: 520px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.1);">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:750; color:var(--text,#1c1917); display:flex; align-items:center; gap:8px;">
          <span>🏛️</span> Add to Pantry Bank
        </h3>
        <button type="button" class="btn xs ghost" id="btn-hub-close" style="font-weight:700;">✕</button>
      </div>
      <p style="font-size:12.5px; color:var(--text2,#78716c); margin:0 0 20px 0;">
        Select what you would like to add. Every option completes the full chain down to product:
      </p>

      <div class="hub-tiles-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
        <button type="button" class="hub-tile-btn" data-hub-mode="category" style="padding:16px 14px; border:1px solid var(--border,#e7e5e4); border-radius:12px; background:var(--surface2,#fbfbf9); text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:22px;">📂</span>
          <span style="font-size:13.5px; font-weight:750; color:var(--text,#1c1917);">Category</span>
          <span style="font-size:11px; color:var(--text2,#78716c);">New section with first item, sub-type &amp; product</span>
        </button>
        <button type="button" class="hub-tile-btn" data-hub-mode="item" style="padding:16px 14px; border:1px solid var(--border,#e7e5e4); border-radius:12px; background:var(--surface2,#fbfbf9); text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:22px;">📦</span>
          <span style="font-size:13.5px; font-weight:750; color:var(--text,#1c1917);">Root Item</span>
          <span style="font-size:11px; color:var(--text2,#78716c);">New root item with sub-type &amp; product</span>
        </button>
        <button type="button" class="hub-tile-btn" data-hub-mode="subtype" style="padding:16px 14px; border:1px solid var(--border,#e7e5e4); border-radius:12px; background:var(--surface2,#fbfbf9); text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:22px;">🏷️</span>
          <span style="font-size:13.5px; font-weight:750; color:var(--text,#1c1917);">Sub-Type</span>
          <span style="font-size:11px; color:var(--text2,#78716c);">Add a variant under an existing item with a product</span>
        </button>
        <button type="button" class="hub-tile-btn" data-hub-mode="product" style="padding:16px 14px; border:1px solid var(--border,#e7e5e4); border-radius:12px; background:var(--surface2,#fbfbf9); text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:22px;">🛒</span>
          <span style="font-size:13.5px; font-weight:750; color:var(--text,#1c1917);">Product</span>
          <span style="font-size:11px; color:var(--text2,#78716c);">Link store product to an existing sub-type</span>
        </button>
      </div>
    </div>
  `;

  showHubModal(html);

  const closeBtn = document.getElementById('btn-hub-close');
  if (closeBtn) closeBtn.onclick = closeAddToBankModal;

  document.querySelectorAll('.hub-tile-btn').forEach(btn => {
    btn.onclick = () => {
      const mode = btn.dataset.hubMode;
      closeAddToBankModal();
      openAddItemWizard({ startAt: mode });
    };
  });
}
