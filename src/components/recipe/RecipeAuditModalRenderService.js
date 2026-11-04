/**
 * src/components/recipe/RecipeAuditModalRenderService.js (v3.38.73)
 * Pure template generation service for the Recipe Audit Modal.
 */

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

/**
 * Renders the filter chips for the KPI summary.
 */
export function renderKPIBadge(type, count, label, currentFilter) {
  const isActive = currentFilter === type;
  const bgColor = isActive ? 'var(--primary,#4f46e5)' : '#f1f5f9';
  const textColor = isActive ? '#fff' : '#475569';
  const countBg = isActive ? 'rgba(255,255,255,0.25)' : '#e2e8f0';

  return `
    <button type="button" class="ram-filter-chip" data-filter="${type}" style="border:none; cursor:pointer; padding:6px 12px; border-radius:20px; font-size:12px; font-weight:700; display:inline-flex; align-items:center; gap:6px; background:${bgColor}; color:${textColor};">
      <span>${label}</span>
      <span style="background:${countBg}; padding:1px 6px; border-radius:10px; font-size:11px;">${count}</span>
    </button>
  `;
}

/**
 * Renders an individual issue card with an autocomplete search mount.
 */
export function renderIssueCard(issue, ingredients) {
  const suggested = issue.suggestedMatch;
  const preSelectIng = suggested ? suggested.ingredientId : issue.currentIngredientId;
  const preSelectSub = suggested ? suggested.subtypeId : issue.currentSubtypeId;

  let badgeStyle = 'background:#fef3c7; color:#b45309;';
  let badgeText = 'Unlinked';
  if (issue.issueType === 'orphaned') { badgeStyle = 'background:#fee2e2; color:#b91c1c;'; badgeText = 'Orphaned ID'; }
  if (issue.issueType === 'legacy_string') { badgeStyle = 'background:#e0e7ff; color:#3730a3;'; badgeText = 'Legacy String'; }

  return `
    <div class="ram-issue-card" id="ram-issue-${issue.id}" style="background:#fff; border:1px solid var(--border,#e2e8f0); border-radius:12px; padding:14px; box-shadow:0 1px 3px rgba(0,0,0,0.03); display:flex; flex-direction:column; gap:10px; position:relative;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px; flex-wrap:wrap;">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:13.5px; font-weight:750; color:var(--text,#0f172a);">${escapeHtml(issue.recipeName)}</span>
            <span style="font-size:10.5px; font-weight:750; padding:2px 8px; border-radius:12px; ${badgeStyle}">${badgeText}</span>
          </div>
          <div style="font-size:12px; color:var(--text2,#64748b); margin-top:2px;">
            Ingredient text: <strong style="color:#0f172a;">"${escapeHtml(issue.itemName)}"</strong> &bull; ${escapeHtml(issue.message)}
          </div>
        </div>
        ${suggested ? `
          <span style="font-size:11px; background:#dcfce7; color:#15803d; font-weight:700; padding:2px 8px; border-radius:8px;">
            💡 Suggestion: ${escapeHtml(suggested.displayName)}
          </span>
        ` : ''}
      </div>

      <div style="display:grid; grid-template-columns:1fr 70px 70px auto; gap:8px; align-items:center;">
        <div class="ram-search-mount" id="ram-mount-${escapeAttr(issue.id)}" data-issue-id="${escapeAttr(issue.id)}" data-selected-id="${escapeAttr(preSelectIng || '')}" data-selected-sub-id="${escapeAttr(preSelectSub || '')}" style="min-width:0; position:relative;"></div>
        <div>
          <input type="text" id="ram-qty-${issue.id}" name="ram_qty_${issue.id}" aria-label="Quantity for ${escapeAttr(issue.itemName)}" value="${escapeAttr(issue.qty)}" placeholder="Qty" style="width:100%; padding:7px 8px; font-size:12px; border:1px solid var(--border,#cbd5e1); border-radius:8px; outline:none; box-sizing:border-box; text-align:center;" />
        </div>
        <div>
          <input type="text" id="ram-unit-${issue.id}" name="ram_unit_${issue.id}" aria-label="Unit for ${escapeAttr(issue.itemName)}" value="${escapeAttr(issue.unit)}" placeholder="Unit" style="width:100%; padding:7px 8px; font-size:12px; border:1px solid var(--border,#cbd5e1); border-radius:8px; outline:none; box-sizing:border-box; text-align:center;" />
        </div>
        <div>
          <button type="button" class="btn sm primary ram-save-fix-btn" data-recipe-id="${escapeAttr(issue.recipeId)}" data-item-index="${issue.itemIndex}" data-issue-id="${escapeAttr(issue.id)}" data-item-name="${escapeAttr(issue.itemName)}" style="background:var(--primary,#4f46e5); color:#fff; font-weight:700; padding:7px 14px; border-radius:8px; cursor:pointer; white-space:nowrap;">
            Save &amp; Fix
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the empty state or all-clean state.
 */
export function renderEmptyState(isAllClean) {
  return `
    <div style="text-align:center; padding:48px 16px; color:var(--text2,#64748b);">
      <div style="font-size:36px; margin-bottom:8px;">🎉</div>
      <h3 style="margin:0; font-size:16px; font-weight:750; color:var(--text,#0f172a);">
        ${isAllClean ? 'All Recipes Perfectly Mapped!' : 'No issues match your current filters.'}
      </h3>
      <p style="margin:6px 0 0 0; font-size:13px;">
        ${isAllClean ? 'All ingredients link to valid Master Catalog entries and sub-types.' : 'Try adjusting the search query or issue category filter.'}
      </p>
    </div>
  `;
}
