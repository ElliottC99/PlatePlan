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
    wrap.style.setProperty('z-index', '25005', 'important');
    content.style.setProperty('z-index', '25005', 'important');
    content.innerHTML = html;
    wrap.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal() {
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) {
    wrap.classList.remove('open');
    document.body.style.overflow = '';
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
