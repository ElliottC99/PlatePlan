/**
 * src/components/recipe/RecipeAuditModal.js (v3.38.73)
 * Modal UI component for Recipe Mapping Audit & Data Integrity.
 * Strictly modular (<350 lines).
 */

import { getState } from '../../store/store.js';
import { auditRecipeMappings, relinkRecipeIngredient, batchRelinkRecipeMappings } from '../../utils/RecipeAuditService.js';
import { renderKPIBadge, renderIssueCard, renderEmptyState } from './RecipeAuditModalRenderService.js';

let modalOverlay = null;
let currentFilter = 'all';
let currentSearch = '';
let targetRecipeFilter = null;


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
            Audits recipe ingredients against Master Catalog hierarchy.
          </p>
        </div>
        <button type="button" id="ram-close-btn" class="btn sm ghost" style="font-size:18px; padding:4px 8px; border-radius:8px; line-height:1; cursor:pointer;" aria-label="Close Recipe Audit Modal">✕</button>
      </div>

      <!-- KPI Summary -->
      <div style="padding:12px 24px; background:#fff; border-bottom:1px solid var(--border,#e2e8f0); display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${renderKPIBadge('all', summary.totalIssues, 'All Issues', currentFilter)}
          ${renderKPIBadge('orphaned', summary.orphanedCount, '⚠️ Orphaned IDs', currentFilter)}
          ${renderKPIBadge('unlinked', summary.unlinkedCount, '🛒 Unlinked Items', currentFilter)}
          ${renderKPIBadge('legacy_string', summary.legacyCount, '📜 Legacy Strings', currentFilter)}
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
          <input type="search" id="ram-search-input" name="recipe_audit_search" aria-label="Search recipes or ingredients" placeholder="Filter by recipe name or ingredient text..." value="${String(currentSearch || '').replace(/"/g, '&quot;')}" style="width:100%; padding:7px 12px; font-size:12.5px; border:1px solid var(--border,#cbd5e1); border-radius:8px; outline:none; box-sizing:border-box; background:#fff;" />
        </div>
        <div style="font-size:12px; color:var(--text2,#64748b); white-space:nowrap;">
          Showing <strong>${filteredIssues.length}</strong> of ${summary.totalIssues} issue(s)
        </div>
      </div>

      <!-- Issues Table -->
      <div style="flex:1; overflow-y:auto; padding:16px 24px; box-sizing:border-box;">
        ${filteredIssues.length === 0 ? renderEmptyState(summary.totalIssues === 0) : `
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${filteredIssues.map(issue => renderIssueCard(issue, ingredients)).join('')}
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
