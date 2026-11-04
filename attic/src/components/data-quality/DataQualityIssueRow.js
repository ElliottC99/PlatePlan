/**
 * src/components/data-quality/DataQualityIssueRow.js (v3.8.1)
 * Component for rendering individual data quality audit issues,
 * blockers, gaps, and heuristic advisory rows.
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

export function dataQualityFixButton(issue) {
  const supported = ['product', 'ingredient', 'subtype', 'recipe', 'recipe-ingredient'];
  const target = issue.fixTarget || { entityType: issue.entityType, entityId: issue.entityId };
  if (!supported.includes(target.entityType)) {
    return String(issue.fixButtonHtml || '').replace(/class="btn sm ghost"/, 'class="btn sm dq-fix-btn"');
  }
  const actionAttr = target.entityType === 'subtype' ? ` data-action="fix-subtype" data-subtype-id="${escapeAttr(target.entityId)}"` : '';
  return `<button class="btn sm dq-fix-btn"${actionAttr} onclick="beginDataQualityFix('${escapeAttr(target.entityType)}','${escapeAttr(target.entityId)}','${escapeAttr(issue.key)}')">Fix</button>`;
}

export function renderDataQualityIssue(issue, dismissible = false) {
  const ignoreButton = dismissible
    ? `<button class="btn sm ghost" onclick="ignoreDataQualityWarning('${escapeAttr(issue.key)}','${escapeAttr(issue.fingerprint)}')">Looks right</button>`
    : '';
  const severityLabel = issue.severity === 'blocker' ? '<span class="tag bad" style="margin-left:6px">Blocks calculation</span>' : '';
  return `<div class="dq-issue-row" data-dq-key="${escapeAttr(issue.key)}">
    <div style="min-width:0"><div style="font-weight:600;font-size:13px">${escapeHtml(issue.title)}${severityLabel}</div><div class="dq-warning">${escapeHtml(issue.message)}</div></div>
    <div class="dq-issue-actions">${ignoreButton}${dataQualityFixButton(issue)}</div>
  </div>`;
}

export function renderDataQualityWarningRow(title, message, fixButtonHtml = '', ignoreKey = '') {
  const ignoreButton = ignoreKey ? `<button class="btn sm ghost" onclick="ignoreDataQualityWarning('${escapeAttr(ignoreKey)}')">Looks right</button>` : '';
  return `
  <div class="dq-issue-row">
      <div>
          <div style="font-weight:600; font-size:13px;">${escapeHtml(title)}</div>
          <div class="dq-warning">${escapeHtml(message)}</div>
      </div>
      <div class="dq-issue-actions">${ignoreButton}${String(fixButtonHtml || '').replace(/class="btn sm ghost"/, 'class="btn sm dq-fix-btn"')}</div>
  </div>`;
}

export function renderIssueSection(title, rows = [], emptyText = '', open = true) {
  return `<details ${open ? 'open' : ''} style="margin-bottom:12px">
    <summary style="cursor:pointer;font-weight:700;font-size:13px;margin-bottom:4px">${escapeHtml(title)} (${rows.length})</summary>
    ${rows.length ? rows.map(issue => renderDataQualityIssue(issue)).join('') : `<div class="msg success" style="margin:6px 0 0">${escapeHtml(emptyText)}</div>`}
  </details>`;
}

export function renderAdvisorySection(advisories = []) {
  return `<details>
    <summary style="cursor:pointer;font-weight:700;font-size:13px">Heuristic advisories (${advisories.length})</summary>
    <div style="margin-top:6px">${advisories.length ? advisories.map(issue => renderDataQualityIssue(issue, true)).join('') : '<div class="msg success" style="margin:0">No active advisories.</div>'}</div>
  </details>`;
}
