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
      <div class="ios-grouped-card" style="padding:32px 20px;text-align:center;margin:16px 0;">
        <div style="font-size:32px;margin-bottom:8px">🏛️</div>
        <h3 style="font-size:17px;font-weight:600;margin:0 0 4px 0;color:var(--label)">No items match filter</h3>
        <p style="font-size:13px;color:var(--secondary-label);margin:0 0 14px 0">Try selecting a different category or clearing search.</p>
        <button class="btn primary sm" type="button" data-action="add-to-bank">Add to Bank</button>
      </div>
    `;
  }

  return hierarchy.map(group => `
    <div class="ios-grouped-section ingredient-group-card" data-category="${escapeAttr(group.category)}" style="margin: 0 0 20px 0;">
      <div class="ios-section-header" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="display:flex;align-items:center;gap:6px">
          <span>📂 ${escapeHtml(group.category)}</span>
          <span style="font-size:11px;font-weight:500;color:var(--tertiary-label)">(${(group.ingredients || []).length})</span>
        </div>
        <button type="button" class="ios-nav-btn" data-action="manage-categories" style="font-size:12px;padding:0;">Reorganise</button>
      </div>

      <div class="ios-grouped-card">
        ${(group.ingredients || []).map(ing => {
          const autoDefaultLabel = ing.defaultProduct ? formatBrandProductTag(ing.defaultProduct) : '';
          const subtypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];

          return `
            <div class="ios-list-row pantry-item-card" data-id="${escapeAttr(ing.id)}" style="flex-direction:column;align-items:stretch;gap:8px;padding:12px 16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span style="font-size:15px;font-weight:600;color:var(--label)">${escapeHtml(ing.name)}</span>
                    ${ing.unit ? `<span style="font-size:12px;color:var(--secondary-label)">(${escapeHtml(ing.unit)})</span>` : ''}
                  </div>
                  <div style="margin-top:3px;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--secondary-label);flex-wrap:wrap">
                    <span style="font-weight:500">Auto default:</span>
                    ${autoDefaultLabel ? `
                      <span class="badge badge-success" style="background:var(--tint-color-muted);color:var(--tint-color);font-weight:600;padding:2px 8px;border-radius:var(--radius-sm);font-size:11px">
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
                  <button type="button" class="btn xs btn-ghost ghost subtype-toggle-btn" data-action="toggle-subtype-collapse" data-id="${escapeAttr(ing.id)}" style="font-size:11px;font-weight:600;color:var(--secondary-label);display:flex;align-items:center;gap:4px;padding:2px 4px">▼ SUB-TYPES (${subtypes.length})</button>
                  <div id="subtypes-container-${escapeAttr(ing.id)}" class="subtypes-collapsible" style="display:none;margin-top:6px;padding-left:12px;border-left:2px solid var(--separator);flex-direction:column;gap:6px">
                    ${subtypes.map(st => {
                      const stDefaultLabel = st.defaultProduct ? formatBrandProductTag(st.defaultProduct) : '';
                      return `
                      <div class="pantry-subtype-row" data-subtype-id="${escapeAttr(st.id)}" data-subtype-name="${escapeAttr(st.name || '')}" style="padding:6px 10px;background:var(--system-gray6);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                          <span style="font-size:13px;font-weight:600;color:var(--label)">↳ ${escapeHtml(st.name)}</span>
                          ${stDefaultLabel ? `<span class="badge badge-success" style="font-size:10.5px;padding:2px 6px;border-radius:var(--radius-sm);background:var(--tint-color-muted);color:var(--tint-color)">⭐ ${escapeHtml(stDefaultLabel)}</span>` : ''}
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
