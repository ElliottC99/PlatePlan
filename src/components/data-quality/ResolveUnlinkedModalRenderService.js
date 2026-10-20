/**
 * src/components/data-quality/ResolveUnlinkedModalRenderService.js (v3.38.72)
 * Pure template generation service for the Resolve Unlinked Items modal.
 * Isolates HTML string building from resolution logic.
 */

const safeEscapeHtml = (str) => String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const safeEscapeAttr = (str) => safeEscapeHtml(str).replace(/`/g, '&#96;');

/**
 * Renders the main modal shell and its four resolution paths.
 */
export function renderResolveModalShell({ targetName, searchTerm, tescoSearchUrl }) {
  return `
    <div style="width:100%;max-width:580px;max-height:85vh;overflow-y:auto;padding:20px;box-sizing:border-box;background:var(--system-grouped-bg,#f2f2f7);border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,0.25);position:relative">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px">
        <div>
          <h2 style="font-size:18px;font-weight:750;margin:0;color:var(--text,#1c1917)">Resolve Unlinked Item</h2>
          <div style="font-size:13px;color:var(--text2,#78716c);margin-top:4px">Target Item: <strong style="color:var(--text,#1c1917)">${safeEscapeHtml(targetName)}</strong></div>
        </div>
        <button type="button" class="modal-close-btn btn sm btn-ghost ghost" onclick="closeResolveUnlinkedModal()" title="Close" aria-label="Close modal">✕</button>
      </div>
      <p style="font-size:12.5px;color:var(--text2,#78716c);line-height:1.5;margin-bottom:16px">Choose one of the resolution paths below to attach grocery items or link directly to an existing Pantry Bank entity:</p>
      
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="background:#fff;border-radius:14px;padding:14px;border:1px solid var(--border-color,#e5e7eb);box-shadow:0 1px 3px rgba(0,0,0,0.04)">
          <label for="resolve-remap-search" style="font-weight:750;font-size:13.5px;margin-bottom:4px;color:var(--text,#1c1917);display:block">🔄 Re-map to Existing Ingredient / Sub-type</label>
          <div style="font-size:12px;color:var(--text2,#78716c);margin-bottom:8px">Point this item directly to an existing Pantry Bank ingredient or sub-type without creating products.</div>
          <input type="search" id="resolve-remap-search" class="input" placeholder="Search ingredient or sub-type..." style="font-size:12.5px;padding:7px 10px;width:100%;border-radius:8px;border:1px solid var(--border,#e7e5e4);box-sizing:border-box" oninput="filterResolveRemapOptions(this.value)" onfocus="filterResolveRemapOptions(this.value)" name="resolve-remap-search">
          <div id="resolve-remap-results" style="margin-top:6px;max-height:160px;overflow-y:auto;display:none;border:1px solid var(--border,#e7e5e4);border-radius:8px;background:var(--surface,#fff)"></div>
        </div>

        <div style="background:#fff;border-radius:14px;padding:14px;border:1px solid var(--border-color,#e5e7eb);box-shadow:0 1px 3px rgba(0,0,0,0.04)">
          <label for="resolve-link-search" style="font-weight:750;font-size:13.5px;margin-bottom:4px;color:var(--text,#1c1917);display:block">🔗 1. Link Existing Product</label>
          <div style="font-size:12px;color:var(--text2,#78716c);margin-bottom:8px">Search your Product Bank and re-bind an existing product to this item.</div>
          <input type="search" id="resolve-link-search" class="input" placeholder="Search product by name or brand..." style="font-size:12.5px;padding:7px 10px;width:100%;border-radius:8px;border:1px solid var(--border,#e7e5e4);box-sizing:border-box" oninput="filterResolveLinkProducts(this.value)" name="resolve-link-search">
          <div id="resolve-link-results" style="margin-top:6px;max-height:160px;overflow-y:auto;display:none;border:1px solid var(--border,#e7e5e4);border-radius:8px;background:var(--surface,#fff)"></div>
        </div>

        <div style="background:#fff;border-radius:14px;padding:14px;border:1px solid var(--border-color,#e5e7eb);box-shadow:0 1px 3px rgba(0,0,0,0.04)">
          <label for="resolve-tesco-json" style="font-weight:750;font-size:13.5px;color:var(--text,#1c1917);margin-bottom:4px;display:block">🛒 2. Import from Tesco</label>
          <div style="margin-bottom:8px"><a href="${safeEscapeAttr(tescoSearchUrl)}" target="_blank" rel="noopener noreferrer" class="btn sm ghost" style="display:inline-flex;align-items:center;gap:6px;color:var(--primary,#4f46e5);font-weight:600;font-size:12px;padding:4px 8px;border:1px solid rgba(79,70,229,0.2);background:rgba(79,70,229,0.05);border-radius:6px;text-decoration:none">🔍 Search Tesco for "${safeEscapeHtml(searchTerm)}" ↗</a></div>
          <textarea id="resolve-tesco-json" placeholder='{"name":"Tesco Bagels 4 Pack","price":1.50,"brand":"Tesco",...}' style="width:100%;height:75px;font-family:monospace;font-size:11.5px;padding:6px;border:1px solid var(--border,#e7e5e4);border-radius:6px;background:#fff;color:var(--text,#1c1917);box-sizing:border-box;resize:vertical" name="resolve-tesco-json"></textarea>
          <div id="resolve-tesco-error" style="display:none;color:var(--red,#ef4444);font-size:12px;margin-top:4px;font-weight:600"></div>
          <button type="button" class="btn sm btn-primary primary" style="width:100%;margin-top:6px;font-weight:700" onclick="submitResolveTescoImport()">Parse &amp; Link Product</button>
        </div>

        <div style="background:#fff;border-radius:14px;padding:14px;border:1px solid var(--border-color,#e5e7eb);box-shadow:0 1px 3px rgba(0,0,0,0.04);cursor:pointer;" onclick="submitResolveNewProduct()">
          <div style="font-weight:750;font-size:13.5px;margin-bottom:2px;color:var(--text,#1c1917);display:flex;align-items:center;justify-content:space-between">
            <span>✨ 3. Create New Product</span><span class="btn sm btn-ghost ghost" style="pointer-events:none;font-size:11.5px">Open Blank Form &rarr;</span>
          </div>
          <div style="font-size:12px;color:var(--text2,#78716c)">Manually insert and configure a custom grocery product.</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders an individual row for the re-mapping search results.
 */
export function renderRemapMatchRow(opt) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border,#e7e5e4)">
      <div>
        <div style="font-size:12.5px;font-weight:700;color:var(--text,#1c1917)">${safeEscapeHtml(opt.label)}</div>
        <div style="font-size:11px;color:var(--text2,#78716c)">${opt.type}</div>
      </div>
      <button type="button" class="btn sm primary" style="font-size:11px;padding:3px 8px" onclick="submitResolveRemapTarget('${safeEscapeAttr(opt.ingredientId)}', '${safeEscapeAttr(opt.subtypeId)}')">Re-map</button>
    </div>
  `;
}

/**
 * Renders an individual row for the product linking search results.
 */
export function renderLinkProductRow(p) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border,#e7e5e4)">
      <div>
        <div style="font-size:12.5px;font-weight:700;color:var(--text,#1c1917)">${safeEscapeHtml(p.name)}</div>
        <div style="font-size:11px;color:var(--text2,#78716c)">${safeEscapeHtml(p.brand || 'No brand')} · £${Number(p.price || 0).toFixed(2)}</div>
      </div>
      <button type="button" class="btn sm primary" style="font-size:11px;padding:3px 8px" onclick="submitResolveLinkExisting('${safeEscapeAttr(p.id)}')">Link</button>
    </div>
  `;
}
