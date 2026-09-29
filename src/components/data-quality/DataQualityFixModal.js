/**
 * src/components/data-quality/DataQualityFixModal.js (v3.8.1)
 * Resolution modals for Data Quality issues (subtype linking, Tesco JSON imports, product merges, category reassignments).
 */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export function openSubtypeResolutionModal(subTypeId, issueKey = '') {
  if (issueKey && window.editorNavigationStack) {
    const section = document.querySelector(`[data-dq-key="${CSS.escape(issueKey)}"]`)?.closest('details');
    window.editorNavigationStack.push({ view: 'data', issueKey, scrollY: window.scrollY, sectionOpen: !!section?.open, openedAt: Date.now() });
  }
  const group = typeof window.getIngredientGroup === 'function' ? window.getIngredientGroup(subTypeId) : null;
  const subTypeName = group ? (group.name || (typeof window.getGroupTypeName === 'function' ? window.getGroupTypeName(group) : '')) : (subTypeId || '');

  let modal = document.getElementById('subtype-resolution-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'subtype-resolution-modal';
    document.body.appendChild(modal);
  }
  modal.className = 'modal active';
  modal.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;padding:16px;';

  modal.innerHTML = `
    <div class="card" style="width:100%;max-width:540px;padding:24px;border-radius:14px;background:var(--surface,#fff);box-shadow:0 12px 36px rgba(0,0,0,0.25);position:relative;max-height:90vh;overflow-y:auto">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px">
        <div>
          <h2 style="font-size:18px;font-weight:700;margin:0;color:var(--text)">Resolve Unlinked Sub-type</h2>
          <div style="font-size:13px;color:var(--text2);margin-top:4px">
            Sub-type: <strong style="color:var(--text)">${escapeHtml(subTypeName)}</strong>
          </div>
        </div>
        <button type="button" class="btn sm ghost" style="padding:4px 8px;font-size:16px;line-height:1" onclick="closeSubtypeResolutionModal()" title="Close">✕</button>
      </div>

      <p style="font-size:13px;color:var(--text2);line-height:1.5;margin-bottom:18px">
        This sub-type currently has no linked products in your catalog. Choose one of the 3 resolution paths:
      </p>

      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="card" style="padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface2)">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:var(--text);display:flex;align-items:center;gap:6px">
            <span>🔗 1. Link Existing Product</span>
          </div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:10px">
            Search your Product Bank and assign an existing product to this sub-type.
          </div>
          <input type="search" id="subtype-link-search" class="input" placeholder="Search product by name or brand..." style="font-size:13px;padding:8px 12px;width:100%;border-radius:8px;box-sizing:border-box" oninput="filterSubtypeLinkProducts(this.value, '${escapeAttr(subTypeId)}')">
          <div id="subtype-link-results" style="margin-top:8px;max-height:160px;overflow-y:auto;display:none;border:1px solid var(--border);border-radius:8px;background:var(--surface)"></div>
        </div>

        <div class="card" style="padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface2);cursor:pointer;transition:border-color 0.15s ease" onclick="resolveSubtypeViaTesco('${escapeAttr(subTypeId)}')" onmouseover="this.style.borderColor='var(--action)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:var(--text);display:flex;align-items:center;justify-content:space-between">
            <span>🛒 2. Import from Tesco</span>
            <span class="btn sm primary" style="pointer-events:none;font-size:12px">Paste Bookmarklet JSON →</span>
          </div>
          <div style="font-size:12px;color:var(--text2)">
            Paste output from the Tesco product bookmarklet to automatically extract title, brand, nutrition, price, and pack weight.
          </div>
        </div>

        <div class="card" style="padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface2);cursor:pointer;transition:border-color 0.15s ease" onclick="resolveSubtypeViaManual('${escapeAttr(subTypeId)}')" onmouseover="this.style.borderColor='var(--action)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:var(--text);display:flex;align-items:center;justify-content:space-between">
            <span>✨ 3. Create New Product</span>
            <span class="btn sm ghost" style="pointer-events:none;font-size:12px">Blank Form →</span>
          </div>
          <div style="font-size:12px;color:var(--text2)">
            Open the full blank product creation form with this sub-type pre-assigned.
          </div>
        </div>
      </div>
    </div>
  `;
}

export function closeSubtypeResolutionModal() {
  const modal = document.getElementById('subtype-resolution-modal');
  if (modal) modal.style.display = 'none';
}

export function filterSubtypeLinkProducts(query, subTypeId) {
  const container = document.getElementById('subtype-link-results');
  if (!container) return;
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  const ingredients = window.state?.ingredients || [];
  const matches = ingredients.filter(p => {
    const name = String(p?.name || '').toLowerCase();
    const brand = String(p?.brand || '').toLowerCase();
    return name.includes(q) || brand.includes(q);
  }).slice(0, 10);

  if (!matches.length) {
    container.style.display = 'block';
    container.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--text3);text-align:center">No matching products found in bank.</div>';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = matches.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${escapeHtml(p.name || 'Unnamed')}</div>
        <div style="font-size:11px;color:var(--text2)">${escapeHtml(p.brand || 'No brand')} · ${p.packSize || ''}${p.packUnit || ''}</div>
      </div>
      <button type="button" class="btn sm primary" style="font-size:11px;padding:3px 8px" onclick="resolveSubtypeViaExisting('${escapeAttr(subTypeId)}', '${escapeAttr(p.id)}')">Link Product</button>
    </div>
  `).join('');
}

export function openTescoJsonImportModal(subTypeId) {
  closeSubtypeResolutionModal();
  let modal = document.getElementById('tesco-json-import-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'tesco-json-import-modal';
    document.body.appendChild(modal);
  }
  modal.className = 'modal active';
  modal.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;padding:16px;';

  const group = typeof window.getIngredientGroup === 'function' ? window.getIngredientGroup(subTypeId) : null;
  const subTypeName = group ? (group.name || (typeof window.getGroupTypeName === 'function' ? window.getGroupTypeName(group) : '')) : (subTypeId || '');
  const searchUrl = `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(subTypeName)}`;

  modal.innerHTML = `
    <div class="card" style="width:100%;max-width:580px;padding:24px;border-radius:14px;background:var(--surface,#fff);box-shadow:0 12px 36px rgba(0,0,0,0.25);position:relative;max-height:90vh;overflow-y:auto">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px">
        <div>
          <h2 style="font-size:18px;font-weight:700;margin:0;color:var(--text)">Import from Tesco</h2>
          <div style="font-size:13px;color:var(--text2);margin-top:4px">
            Target Sub-type: <strong style="color:var(--text)">${escapeHtml(subTypeName)}</strong>
          </div>
        </div>
        <button type="button" class="btn sm ghost" style="padding:4px 8px;font-size:16px;line-height:1" onclick="closeTescoJsonImportModal()" title="Close">✕</button>
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="font-size:13px;color:var(--text)">
          Search for your item on Tesco.com and paste bookmarklet JSON output:
        </div>
        <a href="${escapeAttr(searchUrl)}" target="_blank" rel="noopener noreferrer" class="btn sm ghost" style="font-size:12px;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;text-decoration:none">
          🔍 Search "${escapeHtml(subTypeName)}" on Tesco ↗
        </a>
      </div>

      <textarea id="tesco-json-payload" placeholder="Paste Tesco Bookmarklet JSON payload here..." style="width:100%;height:140px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;padding:12px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);box-sizing:border-box;resize:vertical" autofocus></textarea>
      
      <div id="tesco-json-error" style="display:none;color:var(--red,#dc2626);font-size:12px;margin-top:8px"></div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
        <button type="button" class="btn ghost sm" onclick="closeTescoJsonImportModal()">Cancel</button>
        <button type="button" class="btn primary sm" style="font-weight:700" onclick="previewTescoJsonPayload('${escapeAttr(subTypeId)}')">Parse JSON →</button>
      </div>
    </div>
  `;
}

export function closeTescoJsonImportModal() {
  const modal = document.getElementById('tesco-json-import-modal');
  if (modal) modal.style.display = 'none';
}

export function openMergeModal(primaryId, groupKey) {
  const ingredients = window.state?.ingredients || [];
  const group = ingredients.filter(i => String(i.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === groupKey);
  const primary = group.find(i => i.id === primaryId);
  const others = group.filter(i => i.id !== primaryId);
  
  window.mergeContext = { primary, others };
  
  const html = `
      <div style="background:var(--green-bg); border:1px solid var(--green); border-radius:8px; padding:10px; margin-bottom:10px;">
          <div style="font-weight:600; color:var(--green); margin-bottom:4px;">PRIMARY (Keeping):</div>
          <div style="font-size:13px;">${escapeHtml(primary?.name || '')} <span style="color:var(--text2)">(${escapeHtml(primary?.brand || 'No brand')})</span></div>
      </div>
      <div style="font-weight:600; font-size:12px; margin-bottom:6px;">WILL BE DELETED & REPLACED BY PRIMARY:</div>
      ${others.map(o => `
          <div style="background:var(--red-bg); border:1px solid var(--red); border-radius:8px; padding:10px; margin-bottom:6px;">
              <div style="font-size:13px;">${escapeHtml(o.name || '')} <span style="color:var(--text2)">(${escapeHtml(o.brand || 'No brand')})</span></div>
          </div>
      `).join('')}
  `;
  
  const target = document.getElementById('merge-options-container');
  if (target) target.innerHTML = html;
  document.getElementById('merge-modal-wrap')?.classList.add('open');
}

export function closeMergeModal() {
  document.getElementById('merge-modal-wrap')?.classList.remove('open');
  window.mergeContext = null;
}
