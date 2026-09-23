/**
 * scripts/utils/dom.js
 * PlatePlan UI & DOM Utilities Engine
 * Classic global namespace script.
 */

(() => {
const platePlanToastActions = new Map();

const runPlatePlanToastAction = (id) => {
  const action = platePlanToastActions.get(id);
  platePlanToastActions.delete(id);
  const toastEl = document.getElementById(`plateplan-toast-${id}`);
  if (toastEl) toastEl.remove();
  if (typeof action === 'function') action();
};

const showPlatePlanToast = (message, action = null) => {
  let region = document.getElementById('plateplan-toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'plateplan-toast-region';
    region.className = 'plateplan-toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  if (action?.onclick) platePlanToastActions.set(id, action.onclick);

  const escapeHtmlFn = window.ppEscapeHtml || (s => s);
  const escapeAttrFn = window.ppEscapeAttr || (s => s);

  region.innerHTML = `
    <div class="plateplan-toast" id="plateplan-toast-${id}">
      <span>${escapeHtmlFn(message)}</span>
      ${action?.onclick ? `<button onclick="runPlatePlanToastAction('${escapeAttrFn(id)}')">${escapeHtmlFn(action.label || 'Undo')}</button>` : ''}
    </div>
  `;
  setTimeout(() => {
    const el = document.getElementById(`plateplan-toast-${id}`);
    if (el) el.remove();
    platePlanToastActions.delete(id);
  }, action?.onclick ? 8000 : 4200);
};

const showToast = (message, action = null) => {
  return showPlatePlanToast(message, action);
};

const showMsg = (id, msg, type) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '<div class="msg ' + type + '">' + msg + '</div>';
  setTimeout(() => {
    if (el) el.innerHTML = '';
  }, 4000);
};

const showOverlay = (msg, sub) => {
  const msgEl = document.getElementById('overlay-msg');
  const subEl = document.getElementById('overlay-sub');
  const overlayEl = document.getElementById('overlay');
  if (msgEl) msgEl.textContent = msg;
  if (subEl) subEl.textContent = sub || '';
  if (overlayEl) overlayEl.classList.add('visible');
};

const hideOverlay = () => {
  const overlayEl = document.getElementById('overlay');
  if (overlayEl) overlayEl.classList.remove('visible');
};

const openAppInfoModal = (title, copy) => {
  if (window.PlatePlanIngredientBank && typeof window.PlatePlanIngredientBank.openAppInfoModal === 'function' && window.PlatePlanIngredientBank.openAppInfoModal !== openAppInfoModal) {
    return window.PlatePlanIngredientBank.openAppInfoModal(title, copy);
  }
  const wrap = document.getElementById('app-confirm-wrap');
  if (wrap) {
    const tEl = document.getElementById('app-confirm-title');
    const cEl = document.getElementById('app-confirm-copy');
    if (tEl) tEl.textContent = title || 'Information';
    if (cEl) cEl.innerHTML = copy || '';
    const btn = document.getElementById('app-confirm-ok');
    if (btn) {
      btn.textContent = 'Close';
      btn.onclick = () => wrap.classList.remove('open');
    }
    const cancel = wrap.querySelector('.btn-row .btn.ghost');
    if (cancel) cancel.style.display = 'none';
    wrap.classList.add('open');
  } else {
    console.info(`[AppInfoModal] ${title}: ${copy}`);
  }
};

const closeAppConfirmModal = (confirmed = false) => {
  const wrap = document.getElementById('app-confirm-wrap');
  if (wrap) wrap.classList.remove('open');
};

if (typeof window !== 'undefined') {
  window.PlatePlanDOM = {
    runPlatePlanToastAction,
    showPlatePlanToast,
    showToast,
    showMsg,
    showOverlay,
    hideOverlay,
    openAppInfoModal,
    closeAppConfirmModal
  };
  Object.assign(window, window.PlatePlanDOM);
  window.openAppInfoModal = openAppInfoModal;
  window.closeAppConfirmModal = closeAppConfirmModal;
}
})();
