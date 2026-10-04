/**
 * src/components/pantry/PantryBankHTMLTemplate.js (v3.19.72)
 * Extracted HTML UI renderer for the Category -> Ingredient -> Sub-type Hierarchy.
 * Helps keep PantryBankView.js compact and focused strictly under the 400-line limit.
 */

export function buildIngredientBankHTML(hierarchy, escapeHtml, escapeAttr) {
  return hierarchy.map(group => `
    <div class="card" style="margin-bottom:16px;padding:16px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border,#e7e5e4)">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:16px">🏷️</span>
          <h3 style="margin:0;font-size:15px;font-weight:750;text-transform:capitalize">${escapeHtml(group.category)}</h3>
        </div>
        <span class="tag" style="font-size:11px;font-weight:600;background:var(--surface2,#f5f5f4)">${group.ingredients.length} items</span>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px">
        ${group.ingredients.map(ing => {
          const defProd = ing.defaultProduct, subtypes = ing.subtypes || [], aliases = ing.aliases || [];
          return `
            <div class="ingredient-card-node" style="padding:12px 14px;border-radius:10px;background:var(--surface2,#f5f5f4);border:1px solid var(--border,#e7e5e4);display:flex;flex-direction:column;gap:8px">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
                <div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:14px;font-weight:750;color:var(--text,#1c1917)">${escapeHtml(ing.name)}</span>
                    ${ing.unit ? `<span style="font-size:11px;color:var(--text2,#78716c)">(${escapeHtml(ing.unit)})</span>` : ''}
                  </div>
                  <div style="margin-top:4px;display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text2,#78716c)">
                    <span style="font-weight:600">Auto default:</span>
                    ${defProd ? `
                      <span class="badge badge-success" style="background:rgba(16,185,129,0.15);color:var(--green,#10b981);font-weight:700;padding:2px 8px;border-radius:6px;font-size:11px">
                        Auto default for: ${escapeHtml(ing.name)} (${escapeHtml(defProd.brand ? `${defProd.brand} - ` : '')}${escapeHtml(defProd.name)})
                      </span>
                    ` : '<span style="font-style:italic">None linked</span>'}
                  </div>
                </div>

                <div style="display:flex;align-items:center;gap:6px;position:relative">
                  <button type="button" class="btn xs ghost" onclick="openIngredientFamilyDetailsModal('${escapeAttr(ing.id)}')" title="Edit properties">Edit</button>
                  <button type="button" class="btn xs ghost subtype-toggle-btn" onclick="openAddSubtypeModal('${escapeAttr(ing.id)}')" title="Add child sub-type">+ Sub-type</button>
                  <div style="position:relative;display:inline-block">
                    <button type="button" class="btn xs ghost" onclick="toggleCardMoreMenu(this, '${escapeAttr(ing.id)}')" title="More actions" style="padding:2px 6px;font-weight:700">•••</button>
                    <div id="card-more-menu-${escapeAttr(ing.id)}" class="card-more-menu" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,0.08);z-index:100;min-width:130px;flex-direction:column;padding:4px">
                      <button type="button" class="btn xs ghost" onclick="promptAddAlias('${escapeAttr(ing.id)}')" style="justify-content:flex-start;padding:6px 10px;width:100%;font-size:12px;text-align:left">🏷️ + Alias</button>
                      <button type="button" class="btn xs ghost" onclick="window.openIngredientReorganiseModal('${escapeAttr(ing.id)}')" style="justify-content:flex-start;padding:6px 10px;width:100%;font-size:12px;text-align:left">🔄 Reorganise</button>
                      <div style="height:1px;background:var(--border,#e7e5e4);margin:4px 0"></div>
                      <button type="button" class="btn xs ghost" onclick="handleDeleteIngredient('${escapeAttr(ing.id)}', '${escapeAttr(ing.name)}')" style="justify-content:flex-start;padding:6px 10px;width:100%;color:var(--red,#ef4444);font-size:12px;text-align:left">🗑️ Delete</button>
                    </div>
                  </div>
                </div>
              </div>

              ${aliases.length ? `
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px">
                  <span style="color:var(--text3,#a8a29e);font-weight:600">Aliases:</span>
                  ${aliases.map(a => `<span class="tag" style="font-size:10px;padding:2px 6px;background:var(--surface,#fff)">${escapeHtml(a)} <span style="cursor:pointer;margin-left:2px" onclick="promptRemoveAlias('${escapeAttr(ing.id)}', '${escapeAttr(a)}')">&times;</span></span>`).join('')}
                </div>
              ` : ''}

              ${subtypes.length ? `
                <div style="margin-top:4px">
                  <button type="button" class="btn xs ghost subtype-toggle-btn" onclick="toggleSubtypeCollapse(this, '${escapeAttr(ing.id)}')" style="font-size:11px;font-weight:700;color:var(--text2,#78716c);display:flex;align-items:center;gap:4px;padding:2px 6px">▼ SUB-TYPES (${subtypes.length})</button>
                  <div id="subtypes-container-${escapeAttr(ing.id)}" class="subtypes-collapsible" style="display:none;margin-top:6px;padding-left:14px;border-left:2px solid var(--border,#e7e5e4);flex-direction:column;gap:6px">
                    ${subtypes.map(st => `
                      <div style="padding:6px 10px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:6px;display:flex;align-items:center;justify-content:space-between">
                        <div style="display:flex;align-items:center;gap:8px">
                          <span style="font-size:12px;font-weight:650">↳ ${escapeHtml(st.name)}</span>
                          ${st.defaultProduct ? `<span class="tag" style="font-size:10px;background:rgba(79,70,229,0.08);color:var(--primary)">⭐ ${escapeHtml(st.defaultProduct.name)}</span>` : ''}
                        </div>
                        <div class="subtype-actions-container" style="position:relative;display:inline-block">
                          <button type="button" class="btn xs ghost dropdown-trigger-btn" onclick="toggleCardMoreMenu(this, '${escapeAttr(st.id)}')" title="More options" style="padding:2px 6px;font-weight:700">•••</button>
                          <div id="card-more-menu-${escapeAttr(st.id)}" class="card-more-menu" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,0.08);z-index:100;min-width:140px;flex-direction:column;padding:4px">
                            <button type="button" class="btn xs ghost" onclick="window.openEditSubtypeModal('${escapeAttr(st.id)}', '${escapeAttr(ing.id)}')" style="justify-content:flex-start;padding:6px 10px;width:100%;font-size:12px;text-align:left">📝 Edit Details</button>
                            <button type="button" class="btn xs ghost" onclick="window.openSubtypeLinkSelectionModal('${escapeAttr(st.id)}', '${escapeAttr(ing.id)}')" style="justify-content:flex-start;padding:6px 10px;width:100%;font-size:12px;text-align:left">🔗 Link Product</button>
                            <button type="button" class="btn xs ghost" onclick="window.openSubtypeReorganizeModal('${escapeAttr(st.id)}', '${escapeAttr(ing.id)}')" style="justify-content:flex-start;padding:6px 10px;width:100%;font-size:12px;text-align:left">🔄 Reorganize</button>
                            <button type="button" class="btn xs ghost" onclick="window.openSubtypeAliasModal('${escapeAttr(st.id)}', '${escapeAttr(ing.id)}')" style="justify-content:flex-start;padding:6px 10px;width:100%;font-size:12px;text-align:left">🏷️ Manage Aliases</button>
                            <div style="height:1px;background:var(--border,#e7e5e4);margin:4px 0"></div>
                            <button type="button" class="btn xs ghost" onclick="window.openSubtypeDeleteModal('${escapeAttr(st.id)}', '${escapeAttr(ing.id)}')" style="justify-content:flex-start;padding:6px 10px;width:100%;color:var(--red,#ef4444);font-size:12px;text-align:left">🗑️ Delete</button>
                          </div>
                        </div>
                      </div>
                    `).join('')}
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
