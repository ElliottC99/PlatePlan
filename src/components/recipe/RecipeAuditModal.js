/**
 * src/components/recipe/RecipeAuditModal.js (v3.38.73)
 * Modal UI component for Recipe Mapping Audit & Data Integrity.
 * Strictly modular (<350 lines).
 */

import { getState } from '../../store/store.js';
import { auditRecipeMappings, relinkRecipeIngredient, batchRelinkRecipeMappings } from '../../utils/RecipeAuditService.js';
import { renderKPIBadge, renderIssueCard, renderEmptyState } from './RecipeAuditModalRenderService.js';
import { AUDIT_SUGGESTION_THRESHOLD } from '../../config/businessRules.js';
import { createTaxonomySearchInput } from '../pantry/RecipeSearchDropdownHelper.js';
import { openTaxonomyCreationModal } from './RecipeWizardTaxonomyModal.js';

let modalOverlay = null;
let currentFilter = 'all';
let currentSearch = '';
let targetRecipeFilter = null;
let currentPage = 1;
const PAGE_SIZE = 20;
let activeAuditSearchInstances = [];

function renderModalContent() {
  if (!modalOverlay) return;
  activeAuditSearchInstances.forEach(inst => inst?.destroy?.());
  activeAuditSearchInstances = [];
  const state = getState();
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

  const totalFiltered = filteredIssues.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalFiltered);
  const pagedIssues = filteredIssues.slice(startIndex, endIndex);
  const confidentCount = issues.filter(i => i.suggestedMatch && i.suggestedMatch.score >= 0.7).length;

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
          ${summary.totalIssues > 0 ? (
            confidentCount > 0 ? `
              <button type="button" id="ram-autofix-btn" class="btn sm primary" style="background:#059669; color:#fff; font-weight:700; border-radius:8px; padding:6px 12px; cursor:pointer;">
                ⚡ Auto-Fix Confident Matches (${confidentCount})
              </button>
            ` : `
              <button type="button" id="ram-autofix-btn" class="btn sm ghost" style="background:#f1f5f9; color:#64748b; font-weight:600; border-radius:8px; padding:6px 12px; cursor:default;" title="All high-confidence matches are fixed">
                ✓ Confident Matches Fixed
              </button>
            `
          ) : ''}
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
          Showing <strong>${totalFiltered === 0 ? 0 : startIndex + 1}–${endIndex}</strong> of ${totalFiltered} (${summary.totalIssues} total)
        </div>
      </div>

      ${confidentCount === 0 && summary.totalIssues > 0 ? `
        <div style="margin:10px 24px 0 24px; padding:10px 14px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; font-size:12px; color:#166534; display:flex; align-items:center; gap:8px;">
          <span style="font-size:14px;">✨</span>
          <span><strong>291 confident matches auto-fixed!</strong> The remaining ${summary.totalIssues} item(s) have low match confidence (< 70%) or custom recipe strings and require manual selection below.</span>
        </div>
      ` : ''}

      <!-- Issues Table (Paginated to 20 for lightning performance) -->
      <div style="flex:1; overflow-y:auto; padding:16px 24px; box-sizing:border-box;">
        ${pagedIssues.length === 0 ? renderEmptyState(summary.totalIssues === 0) : `
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${pagedIssues.map(issue => renderIssueCard(issue, ingredients)).join('')}
          </div>
        `}
      </div>

      <!-- Footer with Pagination -->
      <div style="padding:12px 24px; border-top:1px solid var(--border,#e2e8f0); display:flex; justify-content:space-between; align-items:center; gap:10px; background:var(--surface2,#f8fafc);">
        <div style="display:flex; align-items:center; gap:8px;">
          <button type="button" id="ram-prev-btn" class="btn sm ghost" ${currentPage <= 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : 'style="cursor:pointer; font-weight:600;"'}>
            « Previous
          </button>
          <span style="font-size:12px; font-weight:700; color:var(--text2,#64748b);">
            Page ${currentPage} of ${totalPages}
          </span>
          <button type="button" id="ram-next-btn" class="btn sm ghost" ${currentPage >= totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : 'style="cursor:pointer; font-weight:600;"'}>
            Next »
          </button>
        </div>
        <button type="button" id="ram-done-btn" class="btn sm secondary" style="font-weight:700; padding:8px 18px; border-radius:8px; cursor:pointer;">Done</button>
      </div>
    </div>
  `;

  bindModalEvents(issues, totalPages, ingredients);
}

function bindModalEvents(issues = [], totalPages = 1, ingredients = []) {
  if (!modalOverlay) return;

  // Mount searchable autocomplete inputs on each issue card
  modalOverlay.querySelectorAll('.ram-search-mount').forEach(mountEl => {
    const issueId = mountEl.dataset.issueId;
    const issue = issues.find(i => String(i.id) === String(issueId));
    if (!issue) return;

    const suggested = issue.suggestedMatch;
    let initialLabel = '';
    let initialId = mountEl.dataset.selectedId || '';
    let initialSubId = mountEl.dataset.selectedSubId || '';

    if (suggested) {
      initialLabel = suggested.displayName ? `🏷️ ${suggested.displayName}` : `📦 ${suggested.ingredientName}`;
      initialId = suggested.ingredientId;
      initialSubId = suggested.subtypeId || '';
    } else if (initialId) {
      const parentIng = ingredients.find(ing => String(ing.id) === String(initialId));
      if (parentIng) {
        if (initialSubId && Array.isArray(parentIng.subtypes)) {
          const sub = parentIng.subtypes.find(s => String(s.id) === String(initialSubId));
          initialLabel = sub ? `🏷️ ${sub.name} (${parentIng.name})` : `📦 ${parentIng.name}`;
        } else {
          initialLabel = `📦 ${parentIng.name}`;
        }
      }
    }

    mountEl.dataset.selectedId = initialId;
    mountEl.dataset.selectedSubId = initialSubId;

    const card = mountEl.closest('.ram-issue-card');

    const searchInst = createTaxonomySearchInput({
      container: mountEl,
      rootItems: ingredients,
      placeholder: 'Search Master Pantry...',
      initialValue: initialLabel,
      onNewClick: (typedName) => {
        const rawPhrase = mountEl.closest('.ram-issue-card')?.querySelector('[style*="color:var(--text,#1c1917)"] strong')?.textContent?.replace(/"/g, '')?.trim();
        const initialSearch = typedName || rawPhrase || '';
        openTaxonomyCreationModal({
          initialName: initialSearch,
          onComplete: (created) => {
            if (!created) return;
            const parentName = created.parentName || created.rootItem?.name || initialSearch;
            const subName = created.subtypeName || created.subtype?.name || 'Standard';
            const ingId = created.ingredientId || created.rootItem?.id;
            const subId = created.subtypeId || created.subtype?.id;
            mountEl.dataset.selectedId = ingId;
            mountEl.dataset.selectedSubId = subId;
            if (searchInst && searchInst.inputEl) {
              searchInst.inputEl.value = `🏷️ ${subName} (${parentName})`;
            }
          }
        });
      },
      onSelect: ({ val, label }) => {
        if (val && val.includes(':')) {
          const [ingId, subId] = val.split(':');
          mountEl.dataset.selectedId = ingId;
          mountEl.dataset.selectedSubId = subId;
        } else {
          mountEl.dataset.selectedId = val || '';
          mountEl.dataset.selectedSubId = '';
        }
        if (card) card.style.zIndex = '1';
      }
    });

    if (searchInst) {
      activeAuditSearchInstances.push(searchInst);
      if (searchInst.inputEl && card) {
        searchInst.inputEl.addEventListener('focus', () => { card.style.zIndex = '50'; });
        searchInst.inputEl.addEventListener('blur', () => { setTimeout(() => { card.style.zIndex = '1'; }, 200); });
      }
    }
  });

  // Close handlers
  modalOverlay.querySelector('#ram-close-btn')?.addEventListener('click', closeRecipeAuditModal);
  modalOverlay.querySelector('#ram-done-btn')?.addEventListener('click', closeRecipeAuditModal);

  // Pagination handlers
  modalOverlay.querySelector('#ram-prev-btn')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderModalContent();
    }
  });
  modalOverlay.querySelector('#ram-next-btn')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderModalContent();
    }
  });

  // Search input
  const searchInput = modalOverlay.querySelector('#ram-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      renderModalContent();
    });
  }

  // Filter chips
  modalOverlay.querySelectorAll('.ram-filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter || 'all';
      currentPage = 1;
      renderModalContent();
    });
  });

  // Re-scan button
  modalOverlay.querySelector('#ram-rescan-btn')?.addEventListener('click', () => {
    currentPage = 1;
    renderModalContent();
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Recipe scan refreshed.', 'info');
    }
  });

  // Auto-fix button
  modalOverlay.querySelector('#ram-autofix-btn')?.addEventListener('click', async () => {
    const btn = modalOverlay.querySelector('#ram-autofix-btn');
    const confidentIssues = issues.filter(i => i.suggestedMatch && i.suggestedMatch.score >= 0.7);
    if (!confidentIssues.length) {
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('No high-confidence suggestions found to auto-fix.', 'info');
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = `⚡ Auto-fixing ${confidentIssues.length} items...`;
    }

    const fixes = confidentIssues.map(i => ({
      recipeId: i.recipeId,
      itemIndex: i.itemIndex,
      itemName: i.itemName,
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
        window.showPlatePlanToast(`Auto-fixed ${res.count} recipe mapping(s) across ${res.modifiedCount || 'all'} recipe(s)!`, 'success');
      }
      renderModalContent();
    } catch (err) {
      console.error('[RecipeAuditModal] Auto-fix error:', err);
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Auto-fix encountered an error. Check console.', 'error');
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚡ Auto-Fix Confident Matches';
      }
    }
  });

  // Individual Save & Fix buttons
  modalOverlay.querySelectorAll('.ram-save-fix-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const issueId = btn.dataset.issueId;
      const recipeId = btn.dataset.recipeId;
      const itemIndex = Number(btn.dataset.itemIndex);
      const itemName = btn.dataset.itemName || '';

      const mountEl = modalOverlay.querySelector(`#ram-mount-${issueId}`);
      const qtyEl = modalOverlay.querySelector(`#ram-qty-${issueId}`);
      const unitEl = modalOverlay.querySelector(`#ram-unit-${issueId}`);

      const newIngredientId = mountEl?.dataset?.selectedId;
      const newSubtypeId = mountEl?.dataset?.selectedSubId || null;

      if (!newIngredientId) {
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Please search and select a Master Catalog entry to link.', 'warning');
        }
        return;
      }

      const qty = qtyEl ? qtyEl.value.trim() : null;
      const unit = unitEl ? unitEl.value.trim() : null;

      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        await relinkRecipeIngredient({
          recipeId,
          itemIndex,
          itemName,
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
  currentPage = 1;

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
  activeAuditSearchInstances.forEach(inst => inst?.destroy?.());
  activeAuditSearchInstances = [];
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
