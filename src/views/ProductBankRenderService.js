/**
 * src/views/ProductBankRenderService.js (v3.38.61)
 * Pure rendering service for Product Bank HTML templates.
 */

import { escapeHtml, escapeAttr } from '../utils/stringUtils.js';

/**
 * Renders the base structure of the product bank (search input and wrapper).
 */
export function renderProductBankBase(query) {
  return `
    <div style="margin-bottom:14px;display:flex;gap:8px;align-items:center">
      <label for="product-bank-search" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Search products</label>
      <input type="search" id="product-bank-search" name="product-bank-search" placeholder="Search products, brands, or categories..." value="${escapeAttr(query)}" style="width:100%;padding:8px 12px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;background:var(--surface,#fff);box-sizing:border-box" />
    </div>
    <div id="product-bank-cards-wrap"></div>
  `;
}

/**
 * Renders an empty state when no products exist at all.
 */
export function renderEmptyProductBank() {
  return `
    <div class="card" style="padding:32px 20px;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px;margin-top:12px;">
      <div style="font-size:32px;margin-bottom:8px">📦</div>
      <h3 style="font-size:16px;font-weight:700;margin:0 0 6px 0">No products in product bank</h3>
      <p style="font-size:13px;color:var(--text2,#78716c);margin:0 0 16px 0">Import groceries from Tesco or add products to calculate prices and nutrition.</p>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary primary sm" type="button" data-action="open-product-modal">+ Add Product</button>
        <button class="btn btn-outline outline sm" type="button" data-action="tesco-import" style="background:var(--purple-bg,#f3e8ff);color:var(--purple,#7e22ce)">Import Tesco</button>
      </div>
    </div>
  `;
}

/**
 * Renders a "no results" state when search query returns nothing.
 */
export function renderNoMatchingProducts(query) {
  return `
    <div class="card" style="padding:24px;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px;margin-top:12px;font-size:13.5px;color:var(--text2)">
      No matching products found for "${escapeHtml(query)}".
    </div>
  `;
}

/**
 * Renders a single product card item.
 */
export function renderProductCard({ p, mappedIng, efficiency, tescoSearchUrl }) {
  return `
    <div class="product-bank-card-item" style="padding:12px;border-radius:10px;background:var(--surface2,#f5f5f4);border:1px solid var(--border,#e7e5e4);display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
        <div>
          <div style="font-size:13.5px;font-weight:750;color:var(--text,#1c1917)">${escapeHtml(p.name)}</div>
          ${p.brand ? `<div style="font-size:11px;color:var(--text2,#78716c);font-weight:600">${escapeHtml(p.brand)}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-size:13.5px;font-weight:750;color:var(--green,#10b981)">£${Number(p.price || 0).toFixed(2)}</div>
          ${p.pack ? `<div style="font-size:10.5px;color:var(--text3,#a8a29e)">${p.pack}${escapeHtml(p.packUnit || 'g')}</div>` : ''}
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:6px;font-size:11px;flex-wrap:wrap">
        <span style="color:var(--text3);font-weight:600">Maps to:</span>
        ${mappedIng ? `
          <span class="tag" style="background:var(--surface,#fff);font-weight:600">↳ ${escapeHtml(mappedIng.name)}</span>
        ` : '<span style="color:var(--amber,#f59e0b);font-style:italic">Unallocated</span>'}
        ${(p.isAutoDefault || (mappedIng && (mappedIng.defaultProductId === p.id || mappedIng.autoDefaultProduct === p.id))) ? `
          <span class="badge badge-success" style="background:rgba(16,185,129,0.15);color:var(--green,#10b981);font-weight:700;padding:2px 8px;border-radius:6px">Auto default for: ${escapeHtml(mappedIng ? mappedIng.name : 'Ingredient')}</span>
        ` : ''}
      </div>

      <div style="display:flex;gap:4px;flex-wrap:wrap;font-size:11px">
        <span class="tag" style="background:var(--surface,#fff);font-weight:650">🔥 ${p.cal || 0} kcal</span>
        <span class="tag" style="background:var(--surface,#fff);font-weight:650;color:var(--primary,#4f46e5)">🫘 ${p.prot || 0}g P</span>
        <span class="tag" style="background:var(--surface,#fff);font-weight:650">🍞 ${p.carb || 0}g C</span>
        <span class="tag" style="background:var(--surface,#fff);font-weight:650">🥑 ${p.fat || 0}g F</span>
        ${p.fibre ? `<span class="tag" style="background:var(--surface,#fff);font-weight:650">🌾 ${p.fibre}g Fib</span>` : ''}
        ${efficiency ? `<span class="tag" style="background:rgba(16,185,129,0.12);color:var(--green,#10b981);font-weight:700">💪 ${efficiency}</span>` : ''}
      </div>

      <div style="display:flex;align-items:center;justify-content:flex-start;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:6px;border-top:1px solid var(--border,#e7e5e4);width:100%">
        <button type="button" class="btn xs btn-ghost ghost" data-action="edit-product" data-product-id="${escapeAttr(p.id)}" style="height:32px;padding:0 10px;border-radius:var(--radius-sm,6px);font-size:13px;font-weight:500">Edit</button>
        <button type="button" class="btn xs btn-ghost ghost" data-action="reallocate-product" data-product-id="${escapeAttr(p.id)}" style="height:32px;padding:0 10px;border-radius:var(--radius-sm,6px);font-size:13px;font-weight:500">Reallocate</button>
        ${mappedIng && !p.isAutoDefault ? `<button type="button" class="btn xs btn-ghost ghost" data-action="make-auto-default" data-product-id="${escapeAttr(p.id)}" data-ingredient-id="${escapeAttr(mappedIng.id)}" style="height:32px;padding:0 10px;border-radius:var(--radius-sm,6px);font-size:13px;font-weight:500">Default</button>` : ''}
        <a href="${escapeAttr(tescoSearchUrl)}" target="_blank" rel="noopener noreferrer" class="btn xs btn-ghost ghost" style="text-decoration:none;font-size:13px;font-weight:500;color:var(--primary);height:32px;padding:0 10px;border-radius:var(--radius-sm,6px);display:inline-flex;align-items:center" title="Search on Tesco">Tesco ↗</a>
        <button type="button" class="btn xs btn-ghost ghost" data-action="delete-product" data-product-id="${escapeAttr(p.id)}" style="color:var(--red,#ef4444);height:32px;padding:0 10px;border-radius:var(--radius-sm,6px);font-size:13px;font-weight:500" title="Delete product">🗑️</button>
      </div>
    </div>
  `;
}

/**
 * Renders a category group wrapper.
 */
export function renderCategoryGroup(cat, count, cardsHtml) {
  return `
    <div class="card" style="margin-bottom:16px;padding:16px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border,#e7e5e4)">
        <h3 style="margin:0;font-size:15px;font-weight:750;text-transform:capitalize">${escapeHtml(cat)}</h3>
        <span class="tag" style="font-size:11px;font-weight:600;background:var(--surface2,#f5f5f4)">${count} products</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:12px">
        ${cardsHtml}
      </div>
    </div>
  `;
}
