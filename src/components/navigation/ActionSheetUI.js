/**
 * src/components/navigation/ActionSheetUI.js (v3.31.25)
 * Responsive Action Sheet & Creation Launcher Modal for PlatePlan.
 */

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function openCreateActionSheet() {
  const existing = document.getElementById('pp-action-sheet-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'pp-action-sheet-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);backdrop-filter:blur(3px);z-index:999999;display:flex;align-items:flex-end;justify-content:center;';

  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--surface,#ffffff);width:100%;max-width:500px;border-radius:20px 20px 0 0;padding:20px;box-shadow:0 -10px 30px rgba(0,0,0,0.2);display:flex;flex-direction:column;gap:12px;animation:slideUp 0.2s ease-out;';

  sheet.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid var(--border,#e2e8f0);">
      <h3 style="margin:0;font-size:17px;font-weight:700;color:var(--text,#0f172a);">Quick Actions</h3>
      <button id="pp-action-sheet-close" aria-label="Close action sheet" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text2,#64748b);line-height:1;padding:4px 8px;">&times;</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <button type="button" id="act-add-recipe" class="btn secondary" style="justify-content:flex-start;padding:12px 16px;font-size:14px;font-weight:600;border-radius:10px;">🍲 Add New Recipe</button>
      <button type="button" id="act-tesco-import" class="btn secondary" style="justify-content:flex-start;padding:12px 16px;font-size:14px;font-weight:600;border-radius:10px;">🛒 Import Grocery Items</button>
      <button type="button" id="act-pantry-item" class="btn secondary" style="justify-content:flex-start;padding:12px 16px;font-size:14px;font-weight:600;border-radius:10px;">📦 Add Item Family / Group</button>
    </div>
  `;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  const closeBtn = sheet.querySelector('#pp-action-sheet-close');
  if (closeBtn) closeBtn.onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  const btnAddRecipe = sheet.querySelector('#act-add-recipe');
  if (btnAddRecipe) {
    btnAddRecipe.onclick = () => {
      overlay.remove();
      if (typeof window.openRecipeWizard === 'function') window.openRecipeWizard('manual');
      else if (typeof window.showView === 'function') window.showView('vault');
    };
  }

  const btnTesco = sheet.querySelector('#act-tesco-import');
  if (btnTesco) {
    btnTesco.onclick = () => {
      overlay.remove();
      if (typeof window.showTescoImport === 'function') window.showTescoImport();
    };
  }

  const btnPantry = sheet.querySelector('#act-pantry-item');
  if (btnPantry) {
    btnPantry.onclick = () => {
      overlay.remove();
      if (typeof window.createIngredientFamilyPrompt === 'function') window.createIngredientFamilyPrompt();
    };
  }
}

export function closeMobileActionSheet() {
  document.getElementById('mobile-action-sheet-wrap')?.classList.remove('open');
  document.getElementById('pp-mobile-action-sheet')?.remove();
  document.getElementById('pp-action-sheet-modal')?.remove();
}

export function openMobileActionSheet(title = 'Actions', actions = []) {
  const existing = document.getElementById('pp-mobile-action-sheet');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'pp-mobile-action-sheet';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);backdrop-filter:blur(3px);z-index:999999;display:flex;align-items:flex-end;justify-content:center;';

  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--surface,#ffffff);width:100%;max-width:500px;border-radius:20px 20px 0 0;padding:20px;box-shadow:0 -10px 30px rgba(0,0,0,0.2);display:flex;flex-direction:column;gap:12px;';

  let actionsHtml = '';
  actions.forEach((act, idx) => {
    actionsHtml += `<button type="button" class="btn secondary pp-sheet-act-btn" data-idx="${idx}" style="justify-content:flex-start;padding:12px 16px;font-size:14px;font-weight:600;border-radius:10px;width:100%;">${escapeHtml(act.label || act.name || 'Action')}</button>`;
  });

  sheet.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--border,#e2e8f0);">
      <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--text,#0f172a);">${escapeHtml(title)}</h3>
      <button id="pp-sheet-close" aria-label="Close menu" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text2,#64748b);line-height:1;padding:4px 8px;">&times;</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow-y:auto;">
      ${actionsHtml}
    </div>
  `;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  const closeBtn = sheet.querySelector('#pp-sheet-close');
  if (closeBtn) closeBtn.onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  sheet.querySelectorAll('.pp-sheet-act-btn').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const act = actions[idx];
      overlay.remove();
      if (act && typeof act.action === 'function') act.action();
      else if (act && typeof act.handler === 'function') act.handler();
    };
  });
}

/**
 * Renders and opens an Apple HIG bottom action sheet overlay.
 * Enforces immediate DOM removal before executing option callbacks.
 * @param {Object} params
 * @param {string} [params.title='Actions']
 * @param {string} [params.subtitle='']
 * @param {Array<{label: string, icon?: string, isDestructive?: boolean, onClick?: Function}>} [params.options=[]]
 */
export function openActionSheet({ title = 'Actions', subtitle = '', options = [] } = {}) {
  if (typeof document === 'undefined') return;

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

  const closeSheetAndExecute = (callback) => {
    wrap.remove();
    if (typeof callback === 'function') {
      callback();
    }
  };

  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) {
      closeSheetAndExecute(null);
    }
  });

  const cancelBtn = sheet.querySelector('.pp-action-sheet-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => closeSheetAndExecute(null));
  }

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

if (typeof window !== 'undefined') {
  window.openCreateActionSheet = openCreateActionSheet;
  window.openMobileActionSheet = openMobileActionSheet;
  window.closeMobileActionSheet = closeMobileActionSheet;
  window.openActionSheet = openActionSheet;
}
