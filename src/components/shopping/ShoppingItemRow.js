/**
 * src/components/shopping/ShoppingItemRow.js (v3.31.21)
 * Apple HIG Compliant UI component for individual shopping list items.
 * Renders inside Apple Inset Grouped tables with green tint checkbox and smooth check animations.
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

  const formattedQty = (item.buyQty !== undefined ? item.buyQty : (item.needQty || item.qty || 1)) + (item.unit ? ` ${item.unit}` : 'x');

  const costDisplay = (item.bankIng && item.cost > 0)
    ? `<div style="font-weight: 600; color: var(--tint-color); margin-top: 2px; font-size: 13px;">£${Number(item.cost).toFixed(2)}</div>`
    : '';

  const photoHtml = item.bankIng?.photo
    ? `<img src="${escapeAttr(item.bankIng.photo)}" style="width: 38px; height: 38px; border-radius: var(--radius-sm); object-fit: cover; margin-right: 12px; flex-shrink: 0; border: 0.5px solid var(--separator);" alt="${escapeAttr(item.name)}" onerror="this.style.display='none'" />`
    : '';

  const isChecked = !!item.isAtHome || !!item.checked || !!item.isChecked;
  const recipeSummary = item.recipeSummary || [];
  const hasBreakdown = recipeSummary.length > 0;

  return `
    <div class="ios-list-row" style="background: var(--secondary-system-grouped-bg); padding: 12px 16px;">
      <input type="checkbox" 
        id="chk-shop-item-${escapeAttr(item.key)}" 
        name="chkShopItem-${escapeAttr(item.key)}" 
        aria-label="Mark ${escapeAttr(item.name)} as acquired" 
        class="acquired-checkbox" 
        style="width: 22px; height: 22px; accent-color: var(--tint-color); margin-right: 12px; cursor: pointer; flex-shrink: 0; border-radius: 4px;" 
        ${isChecked ? 'checked' : ''} 
        data-action="toggle-shopping-at-home" 
        data-item-key="${escapeAttr(item.key)}" 
        data-at-home-key="${escapeAttr(item.atHomeKey || item.key)}" />
      
      ${photoHtml}

      <div class="title-block" style="flex: 1; display: flex; flex-direction: column; min-width: 0; padding-right: 12px;">
        <span class="primary-subtype" style="${isChecked ? 'text-decoration: line-through; opacity: 0.5;' : 'font-weight: 600; color: var(--label);'}; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em;">
          ${escapeHtml(item.name)}
        </span>
        <span class="secondary-brand-title" style="font-size: 13px; color: var(--secondary-label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
          ${escapeHtml(brandTitle)}
        </span>
        ${hasBreakdown ? `
          <button type="button" id="breakdown-btn-${escapeAttr(item.key)}" class="ios-nav-btn" style="font-size: 11.5px; padding: 2px 0; margin-top: 4px; align-self: flex-start; color: var(--tint-color);" onclick="toggleItemBreakdown('${escapeAttr(item.key)}')">
            ▼ Recipe Breakdown
          </button>
        ` : ''}
      </div>

      <div class="qty-cost" style="text-align: right; font-size: 13px; color: var(--secondary-label); flex-shrink: 0; margin-right: 12px;">
        <div style="font-weight: 500">${escapeHtml(formattedQty)}</div>
        ${costDisplay}
      </div>

      <div class="swap-dropdown" style="flex-shrink: 0;">
        <button type="button" class="btn sm" style="font-size: 11.5px; padding: 4px 8px; border-radius: var(--radius-sm);" data-action="toggle-inline-subst" data-item-key="${escapeAttr(item.key)}" data-group-id="${escapeAttr(item.groupId || '')}" onclick="toggleInlineShoppingSubst('${escapeAttr(item.key)}', '${escapeAttr(item.groupId || '')}')">
          Swap ▾
        </button>
      </div>
    </div>
    ${hasBreakdown ? `
      <div id="breakdown-drawer-${escapeAttr(item.key)}" style="display:none; background: var(--system-gray6); border-bottom: 0.5px solid var(--separator); padding: 10px 16px 12px 52px; flex-direction: column; gap: 6px;">
        <div style="font-size: 11px; font-weight: 700; color: var(--secondary-label); text-transform: uppercase; letter-spacing: 0.03em;">Recipe Usage Breakdown:</div>
        ${recipeSummary.map(r => `
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--label); margin-bottom: 4px;">
            <span><strong>${escapeHtml(r.recipeName)}</strong></span>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-weight: 600; color: var(--tint-color);">${r.totalQty}${item.unit || ''}</span>
              <button type="button" class="btn sm ghost" style="font-size: 10px; padding: 2px 6px;" 
                data-action="toggle-inline-subst" 
                data-item-key="${escapeAttr(item.key)}" 
                data-instance-id="${escapeAttr(r.cookingEventId)}"
                onclick="toggleInlineShoppingSubst('${escapeAttr(item.key)}', '${escapeAttr(item.groupId || '')}', '${escapeAttr(r.cookingEventId)}')">
                Swap Product ▾
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}
    <div id="subst-drawer-${escapeAttr(item.key)}" class="subst-row-drawer" style="display:none"></div>
  `;
}

export function renderSubstDrawerContent(groupId, products = []) {
  if (!products.length) {
    return '<div style="font-size:12px;color:var(--secondary-label);padding:6px">No alternate products found in this sub-type.</div>';
  }
  return `
    <div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--label)">Select brand replacement:</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${products.map(p => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:var(--secondary-system-grouped-bg);border:0.5px solid var(--separator);border-radius:var(--radius-control)">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--label)">${escapeHtml(p.name)}</div>
            <div style="font-size:11px;color:var(--secondary-label)">${escapeHtml(p.brand || 'No brand')} · £${(+p.price || 0).toFixed(2)} (${p.packSize || ''}${p.packUnit || ''})</div>
          </div>
          <button type="button" class="btn sm ghost" style="font-size:11px;padding:3px 8px;color:var(--tint-color)" data-action="select-shopping-product-override" data-group-id="${escapeAttr(groupId)}" data-product-id="${escapeAttr(p.id)}" onclick="selectShoppingProductOverride('${escapeAttr(groupId)}', '${escapeAttr(p.id)}')">Use This</button>
        </div>
      `).join('')}
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.toggleItemBreakdown = function(key) {
    const el = document.getElementById(`breakdown-drawer-${key}`);
    const btn = document.getElementById(`breakdown-btn-${key}`);
    if (el) {
      const isHidden = el.style.display === 'none' || el.style.display === '';
      el.style.display = isHidden ? 'flex' : 'none';
      if (btn) {
        btn.textContent = isHidden ? '▲ Hide Breakdown' : '▼ Recipe Breakdown';
      }
    }
  };
}
