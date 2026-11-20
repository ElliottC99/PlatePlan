/**
 * src/components/pantry/ActionSheetUI.js (v3.45.1)
 * Apple HIG Transient Bottom Action Sheet Component.
 * Enforces immediate DOM removal before executing option callbacks.
 * Strictly under 350 lines.
 */

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/**
 * Renders and opens a bottom sheet overlay.
 * @param {Object} params
 * @param {string} [params.title='Actions']
 * @param {string} [params.subtitle='']
 * @param {Array<{label: string, icon?: string, isDestructive?: boolean, onClick?: Function}>} [params.options=[]]
 */
export function openActionSheet({ title = 'Actions', subtitle = '', options = [] } = {}) {
  if (typeof document === 'undefined') return;

  // Remove any pre-existing action sheet overlays
  document.querySelectorAll('.pp-action-sheet-wrap').forEach(el => el.remove());

  const wrap = document.createElement('div');
  wrap.className = 'pp-action-sheet-wrap';
  wrap.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: 26000;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: ppSheetFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  `;

  const sheet = document.createElement('div');
  sheet.className = 'pp-action-sheet-container';
  sheet.style.cssText = `
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
    background: var(--surface, #ffffff);
    border-top-left-radius: 18px;
    border-top-right-radius: 18px;
    padding: 16px 16px max(24px, env(safe-area-inset-bottom)) 16px;
    box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.15);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;

  let innerHTML = `
    <div style="width: 36px; height: 4px; background: var(--border, #e2e8f0); border-radius: 2px; margin: 0 auto 12px auto;"></div>
    ${title ? `<div style="font-size: 14px; font-weight: 750; color: var(--text, #1c1917); text-align: center; margin-bottom: 2px;">${escapeHtml(title)}</div>` : ''}
    ${subtitle ? `<div style="font-size: 11.5px; color: var(--text2, #78716c); text-align: center; margin-bottom: 10px;">${escapeHtml(subtitle)}</div>` : ''}
    <div class="action-sheet-options" style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
  `;

  options.forEach((opt, idx) => {
    const isDestructive = Boolean(opt.isDestructive);
    const bg = isDestructive ? 'var(--red-bg, #fef2f2)' : 'var(--surface2, #f8fafc)';
    const color = isDestructive ? 'var(--red, #ef4444)' : 'var(--text, #1c1917)';
    const border = isDestructive ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--border, #e2e8f0)';

    innerHTML += `
      <button type="button" class="pp-action-sheet-opt" data-opt-idx="${idx}" style="
        width: 100%;
        padding: 12px 16px;
        border-radius: 12px;
        background: ${bg};
        color: ${color};
        border: ${border};
        font-size: 13.5px;
        font-weight: 650;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: transform 0.1s ease, background 0.15s ease;
        text-align: left;
      ">
        ${opt.icon ? `<span style="font-size: 15px;">${escapeHtml(opt.icon)}</span>` : ''}
        <span>${escapeHtml(opt.label)}</span>
      </button>
    `;
  });

  innerHTML += `
    </div>
    <button type="button" class="pp-action-sheet-cancel" style="
      width: 100%;
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--surface, #ffffff);
      color: var(--text2, #64748b);
      border: 1px solid var(--border, #e2e8f0);
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 6px;
      text-align: center;
    ">Cancel</button>
  `;

  sheet.innerHTML = innerHTML;
  wrap.appendChild(sheet);
  document.body.appendChild(wrap);

  // Clean DOM removal helper
  const closeSheetAndExecute = (callback) => {
    wrap.remove(); // CRITICAL: Complete DOM destruction BEFORE invoking callback
    if (typeof callback === 'function') {
      callback();
    }
  };

  // Backdrop click handler
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) {
      closeSheetAndExecute(null);
    }
  });

  // Cancel button handler
  const cancelBtn = sheet.querySelector('.pp-action-sheet-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => closeSheetAndExecute(null));
  }

  // Option buttons click handler
  sheet.querySelectorAll('.pp-action-sheet-opt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.optIdx, 10);
      const selectedOpt = options[idx];
      if (selectedOpt) {
        closeSheetAndExecute(selectedOpt.onClick);
      } else {
        closeSheetAndExecute(null);
      }
    });
  });
}
