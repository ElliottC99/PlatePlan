/**
 * src/components/pantry/WizardDuplicateHelper.js
 * Live Duplicate Detection Helper for text inputs in pantry wizards.
 * Renders matching suggestion pills as the user types.
 * Strictly under 100 lines.
 */

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function attachDuplicateDetector({ inputEl, containerEl, items, icon = '📦', onSelect }) {
  if (!inputEl || !containerEl || !Array.isArray(items)) return;

  inputEl.oninput = () => {
    const q = inputEl.value.trim().toLowerCase();
    if (q.length < 2) {
      containerEl.innerHTML = '';
      return;
    }

    const matches = items.filter(it => {
      const name = typeof it === 'string' ? it : (it.name || '');
      return name.toLowerCase().includes(q);
    }).slice(0, 3);

    if (matches.length === 0) {
      containerEl.innerHTML = '';
      return;
    }

    containerEl.innerHTML = `
      <div style="font-size:11px; font-weight:700; color:var(--text2,#78716c); margin-bottom:4px;">Already in bank (click to select):</div>
      <div style="display:flex; flex-wrap:wrap; gap:4px;">
        ${matches.map(m => {
          const name = typeof m === 'string' ? m : m.name;
          const meta = typeof m === 'object' && m.category ? ` [${m.category}]` : '';
          return `
            <button type="button" class="btn xs ghost btn-wiz-dup-pill" style="font-size:11px; padding:2px 8px; border:1px solid var(--border,#e7e5e4); background:#fff;">
              ${icon} ${escapeHtml(name)} <span style="opacity:0.6;">${escapeHtml(meta)}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;

    containerEl.querySelectorAll('.btn-wiz-dup-pill').forEach((btn, idx) => {
      btn.onclick = () => {
        const selected = matches[idx];
        const name = typeof selected === 'string' ? selected : selected.name;
        inputEl.value = name;
        if (typeof onSelect === 'function') onSelect(selected);
        containerEl.innerHTML = `<div style="font-size:11px; color:var(--green,#059669); font-weight:600;">✓ Selected "${escapeHtml(name)}"</div>`;
      };
    });
  };
}
