/**
 * src/components/shopping/ShoppingItemRow.js (v3.8.1)
 * UI component for individual shopping list items, quantity adjustments,
 * check-off toggles, and inline product brand substitution drawers.
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

export function renderShoppingItemRow(item) {
  const brandTitle = item.bankIng
    ? ((item.bankIng.brand ? item.bankIng.brand + ' - ' : '') + (item.bankIng.name || item.name))
    : (item.name || 'Store product');

  const formattedQty = item.needUnit === 'item'
    ? `${item.needQty} item${item.needQty > 1 ? 's' : ''}`
    : `${Math.round(item.grams || 0)}g`;

  const costDisplay = (item.bankIng && item.cost > 0)
    ? `<div style="font-weight: 600; color: var(--action, #0969da); margin-top: 2px;">£${Number(item.cost).toFixed(2)}</div>`
    : '';

  const photoHtml = item.bankIng?.photo
    ? `<img src="${escapeAttr(item.bankIng.photo)}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover; margin-right: 12px; flex-shrink: 0;" alt="${escapeAttr(item.name)}" onerror="this.style.display='none'" />`
    : '';

  const isChecked = !!item.isAtHome || !!item.checked;

  return `
    <div class="shopping-list-row" style="display: flex; align-items: center; background: #FFFFFF; border-bottom: 1px solid #E5E5EA; padding: 12px 16px;">
      <input type="checkbox" id="chk-shop-item-${escapeAttr(item.key)}" name="chkShopItem-${escapeAttr(item.key)}" aria-label="Mark ${escapeAttr(item.name)} as acquired" class="acquired-checkbox" style="width: 24px; height: 24px; accent-color: #007AFF; margin-right: 12px; cursor: pointer; flex-shrink: 0;" ${isChecked ? 'checked' : ''} data-action="toggle-shopping-at-home" data-item-key="${escapeAttr(item.key)}" onchange="toggleShoppingAtHome('${escapeAttr(item.key)}')" />
      ${photoHtml}
      <div class="title-block" style="flex: 1; display: flex; flex-direction: column; min-width: 0; padding-right: 12px;">
        <span class="primary-subtype" style="${isChecked ? 'text-decoration: line-through; opacity: 0.6;' : 'font-weight: 600; color: #1C1C1E;'}; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.name)}</span>
        <span class="secondary-brand-title" style="font-size: 13px; color: #8E8E93; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">${escapeHtml(brandTitle)}</span>
      </div>
      <div class="qty-cost" style="text-align: right; font-size: 13px; color: var(--text2, #666); flex-shrink: 0; margin-right: 14px;">
        <div style="font-weight: 500">${formattedQty}</div>
        ${costDisplay}
      </div>
      <div class="swap-dropdown" style="flex-shrink: 0;">
        <button type="button" class="btn sm ghost" style="font-size: 11px; padding: 4px 8px;" data-action="toggle-inline-subst" data-item-key="${escapeAttr(item.key)}" data-group-id="${escapeAttr(item.groupId || '')}" onclick="toggleInlineShoppingSubst('${escapeAttr(item.key)}', '${escapeAttr(item.groupId || '')}')">Swap Brand ▾</button>
      </div>
    </div>
    <div id="subst-drawer-${escapeAttr(item.key)}" class="subst-row-drawer" style="display:none"></div>
  `;
}

export function renderSubstDrawerContent(groupId, products = []) {
  if (!products.length) {
    return '<div style="font-size:12px;color:var(--text3);padding:6px">No alternate products found in this sub-type.</div>';
  }
  return `
    <div style="font-size:12px;font-weight:700;margin-bottom:6px">Select brand replacement:</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${products.map(p => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:8px">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text)">${escapeHtml(p.name)}</div>
            <div style="font-size:11px;color:var(--text2)">${escapeHtml(p.brand || 'No brand')} · £${(+p.price || 0).toFixed(2)} (${p.packSize || ''}${p.packUnit || ''})</div>
          </div>
          <button type="button" class="btn sm ghost" style="font-size:11px;padding:3px 8px" data-action="select-shopping-product-override" data-group-id="${escapeAttr(groupId)}" data-product-id="${escapeAttr(p.id)}" onclick="selectShoppingProductOverride('${escapeAttr(groupId)}', '${escapeAttr(p.id)}')">Use This</button>
        </div>
      `).join('')}
    </div>
  `;
}
