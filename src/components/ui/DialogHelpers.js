/**
 * src/components/ui/DialogHelpers.js
 * Apple HIG Compliant Dialog Utilities (Alert, Confirm, Prompt, Action Sheet).
 * Strictly zero native window.alert/confirm/prompt browser dialogs.
 */

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function showModal(html) {
  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (wrap && content) {
    wrap.style.setProperty('z-index', '100050', 'important');
    content.style.setProperty('z-index', '100050', 'important');
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

/**
 * Apple System Alert (Single Action / Notice)
 */
export function showCustomAlert(message, title = 'Notice') {
  if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast(message, 'info');
    return;
  }
  const html = `
    <div class="ios-alert-modal" style="margin:0 auto;">
      <div class="ios-alert-content">
        <div class="ios-alert-title">${escapeHtml(title)}</div>
        <div class="ios-alert-message">${escapeHtml(message)}</div>
      </div>
      <div class="ios-alert-actions">
        <button type="button" class="ios-alert-btn bold" id="btn-alert-ok">OK</button>
      </div>
    </div>
  `;
  showModal(html);
  const btn = document.getElementById('btn-alert-ok');
  if (btn) btn.onclick = closeModal;
}

/**
 * Apple System Confirm Alert (Promise-based)
 */
export function showConfirm(options = {}) {
  const {
    title = 'Confirm Action',
    message = 'Are you sure?',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    isDanger = false
  } = typeof options === 'string' ? { message: options } : options;

  return new Promise((resolve) => {
    let settled = false;
    const wrap = document.getElementById('view-modal-wrap');

    const finish = (val) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      if (wrap) wrap.removeEventListener('click', onBackdrop);
      closeModal();
      resolve(val);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') finish(false);
    };

    const onBackdrop = (e) => {
      if (e.target === wrap) finish(false);
    };

    const html = `
      <div class="ios-alert-modal" style="margin:0 auto;">
        <div class="ios-alert-content">
          <div class="ios-alert-title">${escapeHtml(title)}</div>
          <div class="ios-alert-message">${escapeHtml(message)}</div>
        </div>
        <div class="ios-alert-actions">
          <button type="button" class="ios-alert-btn" id="btn-promise-confirm-cancel">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="ios-alert-btn bold ${isDanger ? 'destructive' : ''}" id="btn-promise-confirm-yes">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;
    showModal(html);

    document.addEventListener('keydown', onKey);
    if (wrap) wrap.addEventListener('click', onBackdrop);

    const cancelBtn = document.getElementById('btn-promise-confirm-cancel');
    if (cancelBtn) cancelBtn.onclick = () => finish(false);
    const yesBtn = document.getElementById('btn-promise-confirm-yes');
    if (yesBtn) yesBtn.onclick = () => finish(true);
  });
}

/**
 * Apple System Prompt Alert (Promise-based Text Input)
 */
export function showPrompt(options = {}) {
  const {
    title = 'Enter Value',
    message = '',
    defaultValue = '',
    confirmLabel = 'Save',
    cancelLabel = 'Cancel'
  } = typeof options === 'string' ? { title: options } : options;

  return new Promise((resolve) => {
    let settled = false;
    const wrap = document.getElementById('view-modal-wrap');

    const finish = (val) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      if (wrap) wrap.removeEventListener('click', onBackdrop);
      closeModal();
      resolve(val);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') finish(null);
    };

    const onBackdrop = (e) => {
      if (e.target === wrap) finish(null);
    };

    const html = `
      <div class="ios-alert-modal" style="margin:0 auto;">
        <div class="ios-alert-content">
          <div class="ios-alert-title">${escapeHtml(title)}</div>
          ${message ? `<div class="ios-alert-message">${escapeHtml(message)}</div>` : ''}
          <div class="ios-alert-input-wrap">
            <input type="text" id="prompt-modal-input" class="ios-alert-input" value="${escapeHtml(defaultValue)}" />
          </div>
        </div>
        <div class="ios-alert-actions">
          <button type="button" class="ios-alert-btn" id="btn-prompt-cancel">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="ios-alert-btn bold" id="btn-prompt-save">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;
    showModal(html);

    document.addEventListener('keydown', onKey);
    if (wrap) wrap.addEventListener('click', onBackdrop);

    const inputEl = document.getElementById('prompt-modal-input');
    if (inputEl) {
      setTimeout(() => {
        inputEl.focus();
        inputEl.select();
      }, 50);
      inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(inputEl.value);
        } else if (e.key === 'Escape') {
          finish(null);
        }
      };
    }
    const cancelBtn = document.getElementById('btn-prompt-cancel');
    if (cancelBtn) cancelBtn.onclick = () => finish(null);
    const saveBtn = document.getElementById('btn-prompt-save');
    if (saveBtn) saveBtn.onclick = () => finish(inputEl ? inputEl.value : defaultValue);
  });
}

/**
 * Apple Action Sheet (Bottom Sheet Choices)
 */
export function showActionSheet(options = {}) {
  const {
    title = '',
    message = '',
    actions = [],
    cancelLabel = 'Cancel'
  } = options;

  return new Promise((resolve) => {
    let settled = false;
    const wrap = document.getElementById('view-modal-wrap');

    const finish = (actionIndex) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      if (wrap) wrap.removeEventListener('click', onBackdrop);
      closeModal();
      resolve(actionIndex);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') finish(-1);
    };

    const onBackdrop = (e) => {
      if (e.target === wrap) finish(-1);
    };

    const actionButtonsHtml = actions.map((act, idx) => `
      <button type="button" class="ios-action-sheet-btn ${act.isDestructive ? 'destructive' : ''}" data-action-index="${idx}">
        ${escapeHtml(act.label)}
      </button>
    `).join('');

    const html = `
      <div class="ios-action-sheet-container" style="margin:auto auto 16px auto;">
        <div class="ios-action-sheet-group">
          ${(title || message) ? `
            <div class="ios-action-sheet-header">
              ${title ? `<div class="ios-action-sheet-title">${escapeHtml(title)}</div>` : ''}
              ${message ? `<div class="ios-action-sheet-message">${escapeHtml(message)}</div>` : ''}
            </div>
          ` : ''}
          ${actionButtonsHtml}
        </div>
        <div class="ios-action-sheet-group">
          <button type="button" class="ios-action-sheet-btn ios-action-sheet-cancel" id="btn-action-sheet-cancel">
            ${escapeHtml(cancelLabel)}
          </button>
        </div>
      </div>
    `;
    showModal(html);

    document.addEventListener('keydown', onKey);
    if (wrap) wrap.addEventListener('click', onBackdrop);

    const cancelBtn = document.getElementById('btn-action-sheet-cancel');
    if (cancelBtn) cancelBtn.onclick = () => finish(-1);

    const actionBtns = wrap.querySelectorAll('[data-action-index]');
    actionBtns.forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.actionIndex);
        if (actions[idx] && typeof actions[idx].onSelect === 'function') {
          actions[idx].onSelect();
        }
        finish(idx);
      };
    });
  });
}

export function showCustomConfirm(message, title = 'Confirm Action', onConfirm) {
  showConfirm({ title, message }).then(confirmed => {
    if (confirmed && typeof onConfirm === 'function') onConfirm();
  });
}

export function showCustomCopyModal(title, textToCopy) {
  const html = `
    <div class="ios-grouped-card" style="padding:20px; max-width:440px; width:100%; margin:0 auto;">
      <h3 style="margin:0 0 8px 0; font-size:17px; font-weight:600; color:var(--label);">${escapeHtml(title)}</h3>
      <textarea id="copy-modal-text" name="copy_modal_text" aria-label="Text to copy" style="width:100%; height:120px; font-family:monospace; font-size:12px; padding:10px; border:0.5px solid var(--separator); border-radius:var(--radius-control); margin-bottom:14px; resize:none; background:var(--system-bg); color:var(--label);" readonly>${escapeHtml(textToCopy)}</textarea>
      <div style="display:flex; gap:10px; justify-content:flex-end;">
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
    <div class="ios-grouped-card" style="padding:20px; max-width:440px; width:100%; margin:0 auto;">
      <h3 style="margin:0 0 6px 0; font-size:17px; font-weight:600; color:var(--label);">🧪 Set Density Factor</h3>
      <p style="font-size:13px; color:var(--secondary-label); margin:0 0 14px 0;">
        Set the weight-to-volume ratio in g/ml for <strong>${escapeHtml(ingredientName)}</strong>:
      </p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">
        <button type="button" class="btn sm density-preset-btn" data-density="1.0" style="padding:8px 10px; font-size:12px; text-align:left; font-weight:500;">
          💧 Liquid / Juice (1.0)
        </button>
        <button type="button" class="btn sm density-preset-btn" data-density="0.85" style="padding:8px 10px; font-size:12px; text-align:left; font-weight:500;">
          🍚 Grains / Sugar (0.85)
        </button>
        <button type="button" class="btn sm density-preset-btn" data-density="0.5" style="padding:8px 10px; font-size:12px; text-align:left; font-weight:500;">
          🥣 Flour / Powder (0.5)
        </button>
        <button type="button" class="btn sm density-preset-btn" data-density="0.9" style="padding:8px 10px; font-size:12px; text-align:left; font-weight:500;">
          🧈 Butter / Fat (0.9)
        </button>
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px; color:var(--secondary-label);">Custom Density (g/ml)</label>
        <input type="number" id="custom-density-input" step="0.05" min="0.1" max="5.0" value="${currentDensity}" style="width:100%; padding:8px 12px; border:0.5px solid var(--separator); border-radius:var(--radius-control); font-size:14px; background:var(--system-bg); color:var(--label);" />
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

const DialogHelpers = {
  showCustomAlert,
  showCustomConfirm,
  showCustomCopyModal,
  showCustomDensityModal,
  showConfirm,
  showPrompt,
  showActionSheet
};

export default DialogHelpers;
