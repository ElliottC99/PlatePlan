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
      if (typeof window.openRecipeEditor === 'function') window.openRecipeEditor();
      else if (typeof window.showView === 'function') window.showView('recipes');
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
      if (typeof window.createIngredientGroupPrompt === 'function') window.createIngredientGroupPrompt();
    };
  }
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

if (typeof window !== 'undefined') {
  window.openCreateActionSheet = openCreateActionSheet;
  window.openMobileActionSheet = openMobileActionSheet;
}
