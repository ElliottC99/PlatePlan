/**
 * src/components/pantry/PantryItemRow.js (v3.29.0)
 * Modular UI component for Pantry Stock Item Row:
 * - Stock row templates & item metadata
 * - Expiration urgency badges & freshness indicators
 * - Use-Up toggle & quick quantity adjustment controls
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
  const name = item.customName || item.name || item.item || 'Pantry Item';
  const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
  const unit = item.unit || 'qty';
  const expiry = item.expiryDate || item.expiry || item.expiresAt || '';
  const id = item.id || '';
  const isUseUp = Boolean(item.isUseUp);
  const storage = (item.storage || 'cupboard').toLowerCase();
  const storageLabel = storage === 'fridge' ? '❄️ Fridge' : (storage === 'freezer' ? '🧊 Freezer' : '🥫 Cupboard');

  let expiryBadge = '';
  if (expiry) {
    const daysLeft = Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) {
      expiryBadge = `<span class="tag" style="background:#fee2e2;color:#dc2626;font-weight:700;font-size:11px;padding:2px 7px;border-radius:6px">⚠️ Expired</span>`;
    } else if (daysLeft <= 3) {
      expiryBadge = `<span class="tag" style="background:#fef3c7;color:#d97706;font-weight:700;font-size:11px;padding:2px 7px;border-radius:6px">⏳ Expires in ${daysLeft}d</span>`;
    } else {
      expiryBadge = `<span class="tag" style="background:var(--surface2,#f5f5f4);color:var(--text2,#78716c);font-size:11px;padding:2px 7px;border-radius:6px">📅 Exp: ${escapeHtml(expiry)}</span>`;
    }
  }

  return `
    <div class="pantry-item-row" data-id="${escapeAttr(id)}" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--surface,#fff);border:1px solid ${isUseUp ? '#fbbf24' : 'var(--border,#e7e5e4)'};border-radius:10px;margin-bottom:8px;gap:12px;flex-wrap:wrap">
      <div style="min-width:180px;flex:1">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:750;font-size:13.5px;color:var(--text,#1c1917)">${escapeHtml(name)}</span>
          ${isUseUp ? `<span class="badge" style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:999px">🔥 Priority Use-Up</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:5px;flex-wrap:wrap">
          <span class="tag" style="background:var(--green-bg,#EAF4EF);color:var(--green,#1A6B4A);font-weight:700;font-size:11.5px;padding:2px 8px;border-radius:6px">Qty: ${qty} ${escapeHtml(unit)}</span>
          <span class="tag" style="background:var(--surface2,#f5f5f4);color:var(--text2,#78716c);font-size:11px;padding:2px 7px;border-radius:6px">${storageLabel}</span>
          ${expiryBadge}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <button type="button" class="btn xs ${isUseUp ? 'secondary' : 'ghost'}" onclick="window.togglePantryUseUp('${escapeAttr(id)}')" title="Toggle priority use-up flag" style="font-size:11.5px;font-weight:650;padding:4px 8px;${isUseUp ? 'background:#fef3c7;color:#b45309;border:1px solid #f59e0b;' : ''}">
          🔥 ${isUseUp ? 'Use-Up On' : 'Use Up'}
        </button>
        <button type="button" class="btn xs ghost" onclick="window.adjustPantryStock('${escapeAttr(id)}', -1)" aria-label="Decrease quantity" style="padding:4px 9px;font-weight:700">−</button>
        <button type="button" class="btn xs ghost" onclick="window.adjustPantryStock('${escapeAttr(id)}', 1)" aria-label="Increase quantity" style="padding:4px 9px;font-weight:700">+</button>
        <button type="button" class="btn xs ghost" onclick="window.removePantryStock('${escapeAttr(id)}')" style="color:var(--red,#ef4444);font-size:11.5px;padding:4px 8px">Remove</button>
      </div>
    </div>
  `;
}
