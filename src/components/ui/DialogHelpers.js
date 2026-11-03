/**
 * src/components/ui/DialogHelpers.js (v3.45.5)
 * Isolated DOM Dialog Utilities (Alert, Confirm, Copy Modal).
 * Decoupled from domain views and reorganisation components.
 * Strictly under 350 lines.
 */

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function showModal(html) {
  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (wrap && content) {
    wrap.style.setProperty('z-index', '100010', 'important');
    content.style.setProperty('z-index', '100010', 'important');
    content.innerHTML = html;
    wrap.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal() {
  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (wrap) {
    wrap.classList.remove('open');
    wrap.style.setProperty('z-index', '25005', 'important');
    document.body.style.overflow = '';
  }
  if (content) {
    content.style.setProperty('z-index', '25005', 'important');
  }
}

export function showCustomAlert(message, title = 'Notice') {
  if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast(message, 'info');
    return;
  }
  const html = `
    <div style="padding:20px; max-width:420px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:12px; text-align:center;">
      <h3 style="margin:0 0 8px 0; font-size:1.1rem; font-weight:750;">${escapeHtml(title)}</h3>
      <p style="font-size:13px; color:var(--text2,#78716c); margin:0 0 16px 0;">${escapeHtml(message)}</p>
      <button type="button" class="btn primary sm" id="btn-alert-ok">OK</button>
    </div>
  `;
  showModal(html);
  const btn = document.getElementById('btn-alert-ok');
  if (btn) btn.onclick = closeModal;
}

export function showCustomConfirm(message, title = 'Confirm Action', onConfirm) {
  const html = `
    <div style="padding:20px; max-width:420px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:12px; text-align:center;">
      <h3 style="margin:0 0 8px 0; font-size:1.1rem; font-weight:750;">${escapeHtml(title)}</h3>
      <p style="font-size:13px; color:var(--text2,#78716c); margin:0 0 16px 0;">${escapeHtml(message)}</p>
      <div style="display:flex; gap:8px; justify-content:center;">
        <button type="button" class="btn sm" id="btn-confirm-cancel">Cancel</button>
        <button type="button" class="btn primary sm" id="btn-confirm-yes">Confirm</button>
      </div>
    </div>
  `;
  showModal(html);
  const cancelBtn = document.getElementById('btn-confirm-cancel');
  if (cancelBtn) cancelBtn.onclick = closeModal;
  const yesBtn = document.getElementById('btn-confirm-yes');
  if (yesBtn) {
    yesBtn.onclick = () => {
      closeModal();
      if (typeof onConfirm === 'function') onConfirm();
    };
  }
}

export function showCustomCopyModal(title, textToCopy) {
  const html = `
    <div style="padding:20px; max-width:460px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:12px;">
      <h3 style="margin:0 0 8px 0; font-size:1.1rem; font-weight:750;">${escapeHtml(title)}</h3>
      <textarea id="copy-modal-text" name="copy_modal_text" aria-label="Text to copy" style="width:100%; height:120px; font-family:monospace; font-size:12px; padding:8px; border:1px solid var(--border,#e7e7e4); border-radius:8px; margin-bottom:12px; resize:none;" readonly>${escapeHtml(textToCopy)}</textarea>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button type="button" class="btn sm" id="btn-copy-close">Close</button>
        <button type="button" class="btn primary sm" id="btn-copy-action">📋 Copy</button>
      </div>
    </div>
  `;
  showModal(html);
  const closeBtn = document.getElementById('btn-copy-close');
  if (closeBtn) closeBtn.onclick = closeModal;
  const copyBtn = document.getElementById('btn-copy-action');
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard?.writeText(textToCopy);
      copyBtn.textContent = '✅ Copied!';
      setTimeout(closeModal, 800);
    };
  }
}

export function showCustomDensityModal({ ingredientName, currentDensity = 1.0, onSave }) {
  const html = `
    <div style="padding:20px; max-width:440px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:12px;">
      <h3 style="margin:0 0 6px 0; font-size:1.1rem; font-weight:750;">🧪 Set Density Factor</h3>
      <p style="font-size:12.5px; color:var(--text2,#78716c); margin:0 0 14px 0;">
        Set the weight-to-volume ratio in g/ml for <strong>${escapeHtml(ingredientName)}</strong>:
      </p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">
        <button type="button" class="btn sm density-preset-btn" data-density="1.0" style="padding:8px 10px; font-size:11.5px; text-align:left; font-weight:600;">
          💧 Liquid / Juice (1.0)
        </button>
        <button type="button" class="btn sm density-preset-btn" data-density="0.85" style="padding:8px 10px; font-size:11.5px; text-align:left; font-weight:600;">
          🍚 Grains / Sugar (0.85)
        </button>
        <button type="button" class="btn sm density-preset-btn" data-density="0.5" style="padding:8px 10px; font-size:11.5px; text-align:left; font-weight:600;">
          🥣 Flour / Powder (0.5)
        </button>
        <button type="button" class="btn sm density-preset-btn" data-density="0.9" style="padding:8px 10px; font-size:11.5px; text-align:left; font-weight:600;">
          🧈 Butter / Fat (0.9)
        </button>
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Custom Density (g/ml)</label>
        <input type="number" id="custom-density-input" step="0.05" min="0.1" max="5.0" value="${currentDensity}" style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:13px;" />
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button type="button" class="btn sm" id="btn-density-cancel">Cancel</button>
        <button type="button" class="btn sm primary" id="btn-density-save" style="font-weight:600;">Save Density</button>
      </div>
    </div>
  `;
  showModal(html);

  const inputEl = document.getElementById('custom-density-input');
  const cancelBtn = document.getElementById('btn-density-cancel');
  if (cancelBtn) cancelBtn.onclick = closeModal;

  document.querySelectorAll('.density-preset-btn').forEach(btn => {
    btn.onclick = () => {
      const val = Number(btn.dataset.density);
      closeModal();
      if (typeof onSave === 'function' && !isNaN(val) && val > 0) onSave(val);
    };
  });

  const saveBtn = document.getElementById('btn-density-save');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const val = Number(inputEl ? inputEl.value : currentDensity);
      if (isNaN(val) || val <= 0) return;
      closeModal();
      if (typeof onSave === 'function') onSave(val);
    };
  }
}
