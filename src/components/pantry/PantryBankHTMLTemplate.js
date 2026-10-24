/**
 * src/components/pantry/PantryBankHTMLTemplate.js (v3.45.1)
 * Modular HTML template renderer for Pantry Bank Master Catalog hierarchy.
 * Clean face buttons and zero inline event handlers or inline dropdown menus.
 * Strictly under 350 lines.
 */

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

function formatBrandProductTag(p) {
  if (!p) return '';
  const brand = p.brand || p.vendor || '';
  const name = p.name || p.title || '';
  const packSize = p.packSize ? `${p.packSize}${p.packUnit || 'g'}` : '';
  const parts = [brand, name, packSize].filter(Boolean);
  return parts.join(' • ');
}

export function buildIngredientBankHTML(hierarchy = []) {
  if (!Array.isArray(hierarchy) || hierarchy.length === 0) {
    return `
      <div class="card" style="padding:32px 20px;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px;margin-top:12px;">
        <div style="font-size:32px;margin-bottom:8px">🏛️</div>
        <h3 style="font-size:16px;font-weight:700;margin:0 0 6px 0">No items match filter</h3>
        <p style="font-size:12.5px;color:var(--text2,#78716c);margin:0 0 12px 0">Try selecting a different category or clearing search.</p>
        <button class="btn primary sm" type="button" data-action="add-to-bank">Add to Bank</button>
      </div>
    `;
  }

  return hierarchy.map(group => `
    <div class="card ingredient-group-card" data-category="${escapeAttr(group.category)}" style="margin-bottom:16px;padding:16px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px">
      <div class="ingredient-group-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border,#e7e5e4);flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <h3 style="margin:0;font-size:15px;font-weight:750;color:var(--text,#1c1917)">📂 ${escapeHtml(group.category)}</h3>
          <span class="badge" style="background:var(--surface2,#f5f4ee);color:var(--text2,#78716c);font-weight:700;padding:2px 8px;border-radius:12px;font-size:11px">
            ${(group.ingredients || []).length} items
          </span>
        </div>
        <button type="button" class="btn xs btn-ghost ghost" data-action="manage-categories" style="font-size:11.5px;font-weight:600;color:var(--purple,#4f46e5)">⚙️ Reorganise Category</button>
      </div>

      <div class="ingredient-items-list" style="display:flex;flex-direction:column;gap:10px">
        ${(group.ingredients || []).map(ing => {
          const autoDefaultLabel = ing.defaultProduct ? formatBrandProductTag(ing.defaultProduct) : '';
          const subtypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];

          return `
            <div class="pantry-item-card" data-id="${escapeAttr(ing.id)}" style="padding:12px;background:var(--surface2,#fbfbf9);border:1px solid var(--border,#e7e5e4);border-radius:10px">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span style="font-size:14px;font-weight:750;color:var(--text,#1c1917)">${escapeHtml(ing.name)}</span>
                    ${ing.unit ? `<span style="font-size:11px;color:var(--text2,#78716c)">(${escapeHtml(ing.unit)})</span>` : ''}
                  </div>
                  <div style="margin-top:4px;display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text2,#78716c);flex-wrap:wrap">
                    <span style="font-weight:600">Auto default:</span>
                    ${autoDefaultLabel ? `
                      <span class="badge badge-success" style="background:var(--green-bg,#EAF4EF);color:var(--green,#1A6B4A);border:1px solid rgba(26,107,74,0.25);font-weight:700;padding:2px 8px;border-radius:var(--radius-sm,6px);font-size:11px">
                        ⭐ ${escapeHtml(autoDefaultLabel)}
                      </span>
                    ` : '<span style="font-style:italic">None linked</span>'}
                  </div>
                </div>

                <div style="display:flex;align-items:center;gap:6px;position:relative;flex-wrap:wrap">
                  <button type="button" class="btn xs btn-outline outline" data-action="edit-item" data-id="${escapeAttr(ing.id)}" title="Edit properties">Edit</button>
                  <button type="button" class="btn xs btn-secondary secondary" data-action="add-subtype-shortcut" data-id="${escapeAttr(ing.id)}" title="Add child sub-type">+ Sub-type</button>
                  <button type="button" class="btn xs btn-ghost ghost" data-action="item-action-sheet" data-id="${escapeAttr(ing.id)}" title="More actions" style="padding:2px 8px;font-weight:700">•••</button>
                </div>
              </div>

              ${subtypes.length ? `
                <div style="margin-top:4px">
                  <button type="button" class="btn xs btn-ghost ghost subtype-toggle-btn" data-action="toggle-subtype-collapse" data-id="${escapeAttr(ing.id)}" style="font-size:11px;font-weight:700;color:var(--text2,#78716c);display:flex;align-items:center;gap:4px;padding:2px 6px">▼ SUB-TYPES (${subtypes.length})</button>
                  <div id="subtypes-container-${escapeAttr(ing.id)}" class="subtypes-collapsible" style="display:none;margin-top:6px;padding-left:14px;border-left:2px solid var(--border,#e7e5e4);flex-direction:column;gap:6px">
                    ${subtypes.map(st => {
                      const stDefaultLabel = st.defaultProduct ? formatBrandProductTag(st.defaultProduct) : '';
                      return `
                      <div class="pantry-subtype-row" data-subtype-id="${escapeAttr(st.id)}" data-subtype-name="${escapeAttr(st.name || '')}" style="padding:6px 10px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:var(--radius-sm,6px);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                          <span style="font-size:12px;font-weight:650">↳ ${escapeHtml(st.name)}</span>
                          ${stDefaultLabel ? `<span class="badge badge-success" style="font-size:10.5px;padding:2px 8px;border-radius:var(--radius-sm,6px);background:var(--green-bg,#EAF4EF);color:var(--green,#1A6B4A)">⭐ ${escapeHtml(stDefaultLabel)}</span>` : ''}
                        </div>
                        <div class="subtype-actions-container" style="position:relative;display:inline-flex;align-items:center;gap:6px">
                          <button type="button" class="btn xs btn-secondary" data-action="edit-subtype" data-subtype-id="${escapeAttr(st.id)}" data-parent-id="${escapeAttr(ing.id)}">Edit</button>
                          <button type="button" class="btn xs btn-ghost ghost" data-action="subtype-action-sheet" data-subtype-id="${escapeAttr(st.id)}" data-parent-id="${escapeAttr(ing.id)}" title="More options" style="padding:2px 8px;font-weight:700">•••</button>
                        </div>
                      </div>
                    `;
                    }).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}
