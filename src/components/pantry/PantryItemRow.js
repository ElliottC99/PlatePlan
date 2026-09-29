/**
 * src/components/pantry/PantryItemRow.js (v3.8.7)
 * Modular UI component for Pantry Stock Item Row:
 * - Stock row templates & item metadata
 * - Expiration urgency badges & freshness indicators
 * - Quick quantity adjustment controls & stock actions
 */

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

export function renderPantryItemRow(item = {}) {
  const name = item.name || item.item || 'Pantry Item';
  const qty = item.qty || item.quantity || 1;
  const unit = item.unit || 'units';
  const expiry = item.expiry || item.expiresAt || '';
  const id = item.id || '';

  let expiryBadge = '';
  if (expiry) {
    const daysLeft = Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) {
      expiryBadge = `<span class="tag" style="background:#fee2e2;color:#ef4444;font-weight:600">Expired</span>`;
    } else if (daysLeft <= 3) {
      expiryBadge = `<span class="tag" style="background:#fef3c7;color:#d97706;font-weight:600">Expires in ${daysLeft}d</span>`;
    } else {
      expiryBadge = `<span class="tag" style="background:var(--surface2);color:var(--text2)">Expires: ${escapeHtml(expiry)}</span>`;
    }
  }

  return `
    <div class="pantry-item-row" data-id="${escapeAttr(id)}" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;gap:10px">
      <div style="min-width:0;flex:1">
        <div style="font-weight:700;font-size:13.5px;color:var(--text)">${escapeHtml(name)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:3px;flex-wrap:wrap">
          <span class="tag" style="background:var(--surface2);color:var(--text2)">Qty: ${qty} ${escapeHtml(unit)}</span>
          ${expiryBadge}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <button type="button" class="btn sm ghost" onclick="adjustPantryStock('${escapeAttr(id)}', -1)">-</button>
        <button type="button" class="btn sm ghost" onclick="adjustPantryStock('${escapeAttr(id)}', 1)">+</button>
        <button type="button" class="btn sm danger" onclick="removePantryStock('${escapeAttr(id)}')">Remove</button>
      </div>
    </div>
  `;
}
