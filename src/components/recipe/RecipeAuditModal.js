/**
 * src/components/recipe/RecipeAuditModal.js (v3.30.0)
 * Modal UI component for Recipe Mapping Audit & Data Integrity.
 * Displays flagged recipes, orphaned IDs, legacy strings, and enables instant inline relinking.
 */

import { getState } from '../../store/store.js';
import { auditRecipeMappings, relinkRecipeIngredient, batchRelinkRecipeMappings } from '../../utils/RecipeAuditService.js';

let modalOverlay = null;
let currentFilter = 'all';
let currentSearch = '';
let targetRecipeFilter = null;

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

function buildCatalogOptions(ingredients = [], selectedIngId = null, selectedSubId = null) {
  const sorted = [...ingredients].sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''));
  const html = ['<option value="">-- Select Master Catalog Target --</option>'];

  sorted.forEach(ing => {
    const isIngSelected = String(ing.id) === String(selectedIngId) && !selectedSubId;
    html.push(`<option value="${escapeAttr(ing.id)}:" ${isIngSelected ? 'selected' : ''}>[${escapeHtml(ing.category || 'Pantry')}] ${escapeHtml(ing.name)} (Item-level)</option>`);

    if (Array.isArray(ing.subtypes) && ing.subtypes.length > 0) {
      ing.subtypes.forEach(sub => {
        const isSubSelected = String(ing.id) === String(selectedIngId) && String(sub.id) === String(selectedSubId);
        html.push(`<option value="${escapeAttr(ing.id)}:${escapeAttr(sub.id)}" ${isSubSelected ? 'selected' : ''}>&nbsp;&nbsp;↳ ${escapeHtml(ing.name)} ➔ ${escapeHtml(sub.name)} (Sub-type)</option>`);
      });
    }
  });

  return html.join('');
}

function renderModalContent() {
  if (!modalOverlay) return;
  const state = getState() || {};
  const auditReport = auditRecipeMappings(state);
  const ingredients = state.ingredients || [];
  const { summary, issues } = auditReport;

  const filteredIssues = issues.filter(issue => {
    if (targetRecipeFilter && issue.recipeId !== targetRecipeFilter) return false;
    if (currentFilter !== 'all' && issue.issueType !== currentFilter) return false;
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      const matchRec = issue.recipeName.toLowerCase().includes(q);
      const matchIng = issue.itemName.toLowerCase().includes(q);
      if (!matchRec && !matchIng) return false;
    }
    return true;
  });

  const countBadge = (type, count, label) => `
    <button type="button" class="ram-filter-chip" data-filter="${type}" style="border:none; cursor:pointer; padding:6px 12px; border-radius:20px; font-size:12px; font-weight:700; display:inline-flex; align-items:center; gap:6px; background:${currentFilter === type ? 'var(--primary,#4f46e5)' : '#f1f5f9'}; color:${currentFilter === type ? '#fff' : '#475569'};">
      <span>${label}</span>
      <span style="background:${currentFilter === type ? 'rgba(255,255,255,0.25)' : '#e2e8f0'}; padding:1px 6px; border-radius:10px; font-size:11px;">${count}</span>
    </button>
  `;

  modalOverlay.innerHTML = `
    <div class="ram-dialog" style="width:100%; max-width:880px; max-height:90vh; background:var(--surface,#fff); border-radius:16px; box-shadow:0 20px 50px rgba(0,0,0,0.3); display:flex; flex-direction:column; overflow:hidden; box-sizing:border-box;">
      
      <!-- Header -->
      <div style="padding:18px 24px; border-bottom:1px solid var(--border,#e2e8f0); display:flex; align-items:center; justify-content:space-between; gap:12px; background:var(--surface2,#f8fafc);">
        <div>
          <h2 style="margin:0; font-size:18px; font-weight:800; color:var(--text,#0f172a); display:flex; align-items:center; gap:8px;">
            <span>📖</span> Recipe Mapping Audit &amp; Data Integrity
          </h2>
          <p style="margin:4px 0 0 0; font-size:12.5px; color:var(--text2,#64748b);">
            Audits recipe ingredients against Master Catalog hierarchy (Categories ➔ Items ➔ Sub-types).
          </p>
        </div>
        <button type="button" id="ram-close-btn" class="btn sm ghost" style="font-size:18px; padding:4px 8px; border-radius:8px; line-height:1; cursor:pointer;" aria-label="Close Recipe Audit Modal">✕</button>
      </div>

      <!-- KPI Summary -->
      <div style="padding:12px 24px; background:#fff; border-bottom:1px solid var(--border,#e2e8f0); display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${countBadge('all', summary.totalIssues, 'All Issues')}
          ${countBadge('orphaned', summary.orphanedCount, '⚠️ Orphaned IDs')}
          ${countBadge('unlinked', summary.unlinkedCount, '🛒 Unlinked Items')}
          ${countBadge('legacy_string', summary.legacyCount, '📜 Legacy Strings')}
        </div>
        <div style="display:flex; gap:8px;">
          ${summary.totalIssues > 0 ? `
            <button type="button" id="ram-autofix-btn" class="btn sm primary" style="background:#059669; color:#fff; font-weight:700; border-radius:8px; padding:6px 12px; cursor:pointer;">
              ⚡ Auto-Fix Confident Matches
            </button>
          ` : ''}
          <button type="button" id="ram-rescan-btn" class="btn sm ghost" style="font-weight:600; padding:6px 10px; border-radius:8px; cursor:pointer;">
            🔄 Refresh Scan
          </button>
        </div>
      </div>

      <!-- Search & Filters -->
      <div style="padding:10px 24px; background:var(--surface2,#f8fafc); border-bottom:1px solid var(--border,#e2e8f0); display:flex; gap:12px; align-items:center;">
        <div style="position:relative; flex:1;">
          <input type="search" id="ram-search-input" name="recipe_audit_search" aria-label="Search recipes or ingredients" placeholder="Filter by recipe name or ingredient text..." value="${escapeAttr(currentSearch)}" style="width:100%; padding:7px 12px; font-size:12.5px; border:1px solid var(--border,#cbd5e1); border-radius:8px; outline:none; box-sizing:border-box; background:#fff;" />
        </div>
        <div style="font-size:12px; color:var(--text2,#64748b); white-space:nowrap;">
          Showing <strong>${filteredIssues.length}</strong> of ${summary.totalIssues} issue(s) (${summary.cleanRecipesCount}/${summary.totalRecipes} recipes clean)
        </div>
      </div>

      <!-- Issues Table -->
      <div style="flex:1; overflow-y:auto; padding:16px 24px; box-sizing:border-box;">
        ${filteredIssues.length === 0 ? `
          <div style="text-align:center; padding:48px 16px; color:var(--text2,#64748b);">
            <div style="font-size:36px; margin-bottom:8px;">🎉</div>
            <h3 style="margin:0; font-size:16px; font-weight:750; color:var(--text,#0f172a);">
              ${summary.totalIssues === 0 ? 'All Recipes Perfectly Mapped!' : 'No issues match your current filters.'}
            </h3>
            <p style="margin:6px 0 0 0; font-size:13px;">
              ${summary.totalIssues === 0 ? 'All ingredients link to valid Master Catalog entries and sub-types.' : 'Try adjusting the search query or issue category filter.'}
            </p>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${filteredIssues.map((issue) => {
              const rowId = `ram-issue-${issue.id}`;
              const suggested = issue.suggestedMatch;
              const preSelectIng = suggested ? suggested.ingredientId : issue.currentIngredientId;
              const preSelectSub = suggested ? suggested.subtypeId : issue.currentSubtypeId;
              const optionsHtml = buildCatalogOptions(ingredients, preSelectIng, preSelectSub);

              let badgeStyle = 'background:#fef3c7; color:#b45309;';
              let badgeText = 'Unlinked';
              if (issue.issueType === 'orphaned') { badgeStyle = 'background:#fee2e2; color:#b91c1c;'; badgeText = 'Orphaned ID'; }
              if (issue.issueType === 'legacy_string') { badgeStyle = 'background:#e0e7ff; color:#3730a3;'; badgeText = 'Legacy String'; }

              return `
                <div class="ram-issue-card" id="${rowId}" style="background:#fff; border:1px solid var(--border,#e2e8f0); border-radius:12px; padding:14px; box-shadow:0 1px 3px rgba(0,0,0,0.03); display:flex; flex-direction:column; gap:10px;">
                  
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

                  <!-- Inline Fix Form -->
                  <div style="display:grid; grid-template-columns:1fr 70px 70px auto; gap:8px; align-items:center;">
                    <div>
                      <select id="ram-select-${issue.id}" name="ram_target_catalog_${issue.id}" aria-label="Select Master Catalog entry for ${escapeAttr(issue.itemName)}" style="width:100%; padding:7px 10px; font-size:12px; border:1px solid var(--border,#cbd5e1); border-radius:8px; background:#fff; outline:none;">
                        ${optionsHtml}
                      </select>
                    </div>
                    <div>
                      <input type="text" id="ram-qty-${issue.id}" name="ram_qty_${issue.id}" aria-label="Quantity for ${escapeAttr(issue.itemName)}" value="${escapeAttr(issue.qty)}" placeholder="Qty" style="width:100%; padding:7px 8px; font-size:12px; border:1px solid var(--border,#cbd5e1); border-radius:8px; outline:none; box-sizing:border-box; text-align:center;" />
                    </div>
                    <div>
                      <input type="text" id="ram-unit-${issue.id}" name="ram_unit_${issue.id}" aria-label="Unit for ${escapeAttr(issue.itemName)}" value="${escapeAttr(issue.unit)}" placeholder="Unit" style="width:100%; padding:7px 8px; font-size:12px; border:1px solid var(--border,#cbd5e1); border-radius:8px; outline:none; box-sizing:border-box; text-align:center;" />
                    </div>
                    <div>
                      <button type="button" class="btn sm primary ram-save-fix-btn" data-recipe-id="${escapeAttr(issue.recipeId)}" data-item-index="${issue.itemIndex}" data-issue-id="${escapeAttr(issue.id)}" style="background:var(--primary,#4f46e5); color:#fff; font-weight:700; padding:7px 14px; border-radius:8px; cursor:pointer; white-space:nowrap;">
                        Save &amp; Fix
                      </button>
                    </div>
                  </div>

                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Footer -->
      <div style="padding:14px 24px; border-top:1px solid var(--border,#e2e8f0); display:flex; justify-content:flex-end; gap:10px; background:var(--surface2,#f8fafc);">
        <button type="button" id="ram-done-btn" class="btn sm secondary" style="font-weight:700; padding:8px 18px; border-radius:8px; cursor:pointer;">Done</button>
      </div>

    </div>
  `;

  bindModalEvents(filteredIssues);
}

function bindModalEvents(issues = []) {
  if (!modalOverlay) return;

  // Close handlers
  modalOverlay.querySelector('#ram-close-btn')?.addEventListener('click', closeRecipeAuditModal);
  modalOverlay.querySelector('#ram-done-btn')?.addEventListener('click', closeRecipeAuditModal);

  // Search input
  const searchInput = modalOverlay.querySelector('#ram-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      renderModalContent();
    });
  }

  // Filter chips
  modalOverlay.querySelectorAll('.ram-filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter || 'all';
      renderModalContent();
    });
  });

  // Re-scan button
  modalOverlay.querySelector('#ram-rescan-btn')?.addEventListener('click', () => {
    renderModalContent();
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Recipe scan refreshed.', 'info');
    }
  });

  // Auto-fix button
  modalOverlay.querySelector('#ram-autofix-btn')?.addEventListener('click', async () => {
    const confidentIssues = issues.filter(i => i.suggestedMatch && i.suggestedMatch.score >= 0.7);
    if (!confidentIssues.length) {
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('No high-confidence suggestions found to auto-fix.', 'info');
      }
      return;
    }

    const fixes = confidentIssues.map(i => ({
      recipeId: i.recipeId,
      itemIndex: i.itemIndex,
      newIngredientId: i.suggestedMatch.ingredientId,
      newSubtypeId: i.suggestedMatch.subtypeId,
      newIngredientName: i.suggestedMatch.ingredientName,
      newSubtypeName: i.suggestedMatch.subtypeName,
      qty: i.qty,
      unit: i.unit
    }));

    try {
      const res = await batchRelinkRecipeMappings(fixes);
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast(`Auto-fixed ${res.count} recipe mapping(s)!`, 'success');
      }
      renderModalContent();
    } catch (err) {
      console.error('[RecipeAuditModal] Auto-fix error:', err);
    }
  });

  // Individual Save & Fix buttons
  modalOverlay.querySelectorAll('.ram-save-fix-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const issueId = btn.dataset.issueId;
      const recipeId = btn.dataset.recipeId;
      const itemIndex = Number(btn.dataset.itemIndex);

      const selectEl = modalOverlay.querySelector(`#ram-select-${issueId}`);
      const qtyEl = modalOverlay.querySelector(`#ram-qty-${issueId}`);
      const unitEl = modalOverlay.querySelector(`#ram-unit-${issueId}`);

      if (!selectEl || !selectEl.value) {
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Please select a Master Catalog entry to link.', 'warning');
        }
        return;
      }

      const [newIngredientId, newSubtypeId] = selectEl.value.split(':');
      const qty = qtyEl ? qtyEl.value.trim() : null;
      const unit = unitEl ? unitEl.value.trim() : null;

      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        await relinkRecipeIngredient({
          recipeId,
          itemIndex,
          newIngredientId,
          newSubtypeId: newSubtypeId || null,
          qty,
          unit
        });

        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Recipe ingredient relinked successfully!', 'success');
        }

        renderModalContent();
      } catch (err) {
        console.error('[RecipeAuditModal] Relink error:', err);
        btn.disabled = false;
        btn.textContent = 'Save & Fix';
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Failed to relink ingredient.', 'error');
        }
      }
    });
  });
}

/**
 * Opens the Recipe Mapping Audit modal.
 */
export function openRecipeAuditModal(targetRecipeId = null) {
  targetRecipeFilter = targetRecipeId ? String(targetRecipeId) : null;
  currentFilter = 'all';
  currentSearch = '';

  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'recipe-audit-modal-overlay';
    modalOverlay.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.65); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; padding:16px; box-sizing:border-box;';
    document.body.appendChild(modalOverlay);

    // Close on backdrop click
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeRecipeAuditModal();
    });
  }

  modalOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  renderModalContent();
}

/**
 * Closes the Recipe Mapping Audit modal.
 */
export function closeRecipeAuditModal() {
  if (modalOverlay) {
    modalOverlay.style.display = 'none';
  }
  document.body.style.overflow = '';
}

// Global browser compatibility bindings
if (typeof window !== 'undefined') {
  window.openRecipeAuditModal = openRecipeAuditModal;
  window.closeRecipeAuditModal = closeRecipeAuditModal;
}
