/**
 * src/components/data-quality/DataQualityDrawer.js (v3.8.1)
 * Main Data Quality view shell, navigation return stack, and badge controller.
 */

import { renderIssueSection, renderAdvisorySection } from './DataQualityIssueRow.js';

function escapeAttr(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch])).replace(/`/g, '&#96;');
}

export function updateDataQualityBadge(count = 0, blockers = 0, gaps = 0) {
  document.querySelectorAll('[data-view="data"]').forEach(el => {
    let badge = el.querySelector('.dq-nav-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'dq-nav-badge';
        badge.style.cssText = 'margin-left:6px;font-size:11px;font-weight:700;padding:2px 6px;border-radius:10px;line-height:1;display:inline-block;';
        el.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : count;
      badge.title = `${blockers} blockers, ${gaps} gaps, ${count} total issues`;
      if (blockers > 0) {
        badge.style.background = 'var(--red-bg, rgba(239,68,68,0.15))';
        badge.style.color = 'var(--red, #dc2626)';
      } else {
        badge.style.background = 'var(--amber-bg, rgba(245,158,11,0.15))';
        badge.style.color = 'var(--amber, #d97706)';
      }
    } else if (badge) {
      badge.remove();
    }
  });

  document.querySelectorAll('[data-pp-click*="mobileMoreView(\'data\')"], [onclick*="mobileMoreView(\'data\')"]').forEach(el => {
    let badge = el.querySelector('.dq-nav-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'dq-nav-badge';
        badge.style.cssText = 'margin-left:auto;margin-right:6px;background:var(--amber-bg, rgba(245,158,11,0.15));color:var(--amber,#d97706);font-size:11px;font-weight:700;padding:2px 6px;border-radius:10px;line-height:1;display:inline-block;';
        const arrow = el.querySelector('[aria-hidden="true"]');
        if (arrow) el.insertBefore(badge, arrow);
        else el.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : count;
      if (blockers > 0) {
        badge.style.background = 'var(--red-bg, rgba(239,68,68,0.15))';
        badge.style.color = 'var(--red, #dc2626)';
      } else {
        badge.style.background = 'var(--amber-bg, rgba(245,158,11,0.15))';
        badge.style.color = 'var(--amber, #d97706)';
      }
    } else if (badge) {
      badge.remove();
    }
  });
}

export function beginDataQualityFix(entityType, entityId, issueKey) {
  const section = document.querySelector(`[data-dq-key="${CSS.escape(issueKey || '')}"]`)?.closest('details');
  if (window.editorNavigationStack) {
    window.editorNavigationStack.push({ view: 'data', issueKey, scrollY: window.scrollY, sectionOpen: !!section?.open, openedAt: Date.now() });
  }
  if ((issueKey && issueKey.includes('unmapped-counted-ingredient')) || entityType === 'recipe-ingredient') {
    return window.openProductMappingModal?.(entityId, issueKey);
  }
  if (entityType === 'product') return window.editIng?.(entityId);
  if (entityType === 'ingredient') return window.openProductMappingModal?.(entityId, issueKey);
  if (entityType === 'subtype') return window.fixSubtypeDataQuality?.(entityId, issueKey);
  if (entityType === 'recipe') {
    const parts = String(entityId).split(':');
    return window.editRecipeModalView?.(parts[0], parts[1] === 'enhanced' ? 'enhanced' : 'original');
  }
}

export function abandonEditorReturn() {
  if (!window.editorNavigationStack) return;
  const context = window.editorNavigationStack[window.editorNavigationStack.length - 1];
  if (context?.view === 'data') window.editorNavigationStack.pop();
}

export function finishEditorReturn(defaultView = '') {
  if (!window.editorNavigationStack) return false;
  const context = window.editorNavigationStack.pop();
  if (!context) {
    if (defaultView && typeof window.showView === 'function') window.showView(defaultView);
    return false;
  }
  if (typeof window.showView === 'function') window.showView(context.view || 'data');
  requestAnimationFrame(() => {
    const row = document.querySelector(`[data-dq-key="${CSS.escape(context.issueKey || '')}"]`);
    const host = document.getElementById('dq-missing-list');
    if (row) {
      row.closest('details')?.setAttribute('open', '');
      row.classList.add('dq-return-highlight');
      row.scrollIntoView({ block: 'center' });
      if (host) host.insertAdjacentHTML('afterbegin', '<div class="msg" style="margin:0 0 10px">Saved. This issue still needs attention.</div>');
    } else {
      window.scrollTo({ top: Math.max(0, context.scrollY || 0), behavior: 'instant' });
      if (host) host.insertAdjacentHTML('afterbegin', '<div class="msg success" style="margin:0 0 10px">Issue fixed and Data Quality has been refreshed.</div>');
    }
  });
  return true;
}

let isAuditing = false;

export function renderDataQualityView() {
  const missingTarget = document.getElementById('dq-missing-list');
  const advisoryTarget = document.getElementById('dq-duplicate-list');
  const state = window.state || {};

  if (!state.isCloudHydrated) {
    const skeletonHtml = `<div class="ios-activity-skeleton">
      <div class="spinner"></div>
      <span class="ios-activity-skeleton-text">Syncing live cloud data before audit...</span>
    </div>`;
    if (missingTarget) missingTarget.innerHTML = skeletonHtml;
    if (advisoryTarget) advisoryTarget.innerHTML = '';
    return;
  }
  if (isAuditing) return;
  isAuditing = true;

  const spinnerHtml = `<div class="dq-audit-loading" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 16px;gap:12px;color:var(--text2)">
    <div style="width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--action-fill,#0969da);border-radius:50%;animation:spin 0.8s linear infinite"></div>
    <span style="font-size:13px;font-weight:600">Running data audit...</span>
  </div>`;
  if (missingTarget) missingTarget.innerHTML = spinnerHtml;
  if (advisoryTarget) advisoryTarget.innerHTML = '';

  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        const audit = window.DataQualityService?.runDataQualityAudit(state) || { issues: [], advisories: [], blockers: [], gaps: [], totalCount: 0 };
        const { issues = [], advisories = [], blockers = [], gaps = [], totalCount = 0 } = audit;

        if (missingTarget) {
          missingTarget.innerHTML = renderIssueSection('Calculation blockers', blockers, 'No calculation blockers detected.', true) +
            renderIssueSection('Other data gaps', gaps, 'No other data gaps detected.', false);
        }

        if (advisoryTarget) {
          advisoryTarget.innerHTML = renderAdvisorySection(advisories);
        }

        updateDataQualityBadge(totalCount, blockers.length, gaps.length);

        const catBox = document.getElementById('dq-cat-list')?.closest('.card');
        if (catBox) catBox.style.display = 'none';
      } finally {
        isAuditing = false;
      }
    }, 40);
  });
}
