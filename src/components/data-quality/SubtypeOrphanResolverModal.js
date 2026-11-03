/**
 * src/components/data-quality/SubtypeOrphanResolverModal.js
 * Lists all store products affected by a missing/deleted sub-type or parent ingredient.
 * Uses PlatePlan's canonical autocomplete search (RecipeSearchDropdownHelper)
 * strictly enforcing that products are linked directly to valid Sub-Types.
 */

import { getState, setProducts, setIngredients } from '../../store/store.js';
import { batchResolveOrphansWithNewSubtypeInDb } from '../../services/RootItemRepository.js';
import { createTaxonomySearchInput } from '../pantry/RecipeSearchDropdownHelper.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

let activeSearchInstances = [];

export function openSubtypeOrphanResolverModal(orphanIssue = {}) {
  const state = getState();
  const products = state.products || [];
  const ingredients = state.ingredients || [];

  const targetSubtypeId = orphanIssue.subtypeId;
  const parentId = orphanIssue.parentId;
  const targetProductId = orphanIssue.productId;

  // Find all affected products
  let affectedProducts = [];
  if (targetProductId) {
    const direct = products.find(p => String(p.id) === String(targetProductId));
    if (direct) affectedProducts = [direct];
  }
  if (!affectedProducts.length && targetSubtypeId) {
    affectedProducts = products.filter(p => String(p.subtypeId) === String(targetSubtypeId));
  }
  if (!affectedProducts.length && parentId) {
    affectedProducts = products.filter(p => String(p.ingredientId) === String(parentId));
  }

  if (!affectedProducts.length) {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('No products are currently referencing this orphan issue.', 'info');
    }
    return;
  }

  // Cleanup prior search instances
  activeSearchInstances.forEach(inst => inst?.destroy?.());
  activeSearchInstances = [];

  // Track planned resolutions per product ID:
  // { action: 'reassign', ingredientId, subtypeId, label } | { action: 'delete' }
  const plannedResolutions = new Map();

  let modal = document.getElementById('subtype-orphan-resolver-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'subtype-orphan-resolver-modal';
    document.body.appendChild(modal);
  }
  modal.className = 'modal active';
  modal.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;padding:16px;';

  const productRowsHtml = affectedProducts.map(p => `
    <tr style="border-bottom: 1px solid var(--border,#e7e5e4); font-size:12.5px;" data-prod-id="${escapeAttr(p.id)}">
      <td style="padding:12px 10px; font-weight:700; text-align:left; vertical-align:top; width:45%;">
        <div style="font-size:13px; color:var(--text,#0f172a);">${escapeHtml(p.name)}</div>
        <div style="font-size:11px; font-weight:normal; color:var(--text2,#64748b); margin-top:2px;">
          ${escapeHtml(p.brand || 'No Brand')} ${p.packSize ? `&bull; ${escapeHtml(p.packSize)}` : ''}
        </div>
      </td>
      <td style="padding:12px 10px; text-align:left; vertical-align:top; width:55%;">
        <div style="display:flex; gap:8px; align-items:flex-start;">
          <div class="product-tax-mount" data-prod-id="${escapeAttr(p.id)}" style="flex:1; min-width:0;"></div>
          <button type="button" class="btn sm ghost orphan-delete-btn" data-prod-id="${escapeAttr(p.id)}" title="Delete Product from Catalog" style="padding:7px 10px; font-size:13px; color:#ef4444; border:1px solid #fecaca; border-radius:8px; flex-shrink:0; cursor:pointer;">
            🗑️
          </button>
        </div>
        <div class="product-res-status" data-prod-id="${escapeAttr(p.id)}" style="font-size:11px; margin-top:5px; color:var(--text2,#64748b);"></div>
      </td>
    </tr>
  `).join('');

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:680px; padding:24px; border-radius:14px; background:var(--surface,#fff); box-shadow:0 12px 36px rgba(0,0,0,0.25); display:flex; flex-direction:column; max-height:90vh; box-sizing:border-box;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px;">
        <div>
          <h2 style="font-size:17.5px; font-weight:750; margin:0; color:var(--text,#1c1917);">Resolve Broken Product Links</h2>
          <p style="font-size:12.5px; color:var(--text2,#64748b); margin:4px 0 0 0;">
            Products must belong directly to a <strong>Sub-type</strong>. Search a valid sub-type or remove the product.
          </p>
        </div>
        <button type="button" class="btn sm ghost" style="padding:4px 8px; font-size:16px; line-height:1; cursor:pointer;" onclick="window.closeSubtypeOrphanResolverModal()">✕</button>
      </div>

      ${affectedProducts.length > 1 ? `
        <!-- Batch Sub-Type Search Bar -->
        <div style="background:#eef2ff; border:1px solid #c7d2fe; border-radius:10px; padding:12px; margin-bottom:14px;">
          <div style="font-size:12px; font-weight:700; color:#3730a3; margin-bottom:8px;">⚡ Apply Batch Sub-Type to All (${affectedProducts.length} products):</div>
          <div style="display:flex; gap:8px; align-items:center;">
            <div id="batch-sub-type-mount" style="flex:1; min-width:0;"></div>
            <button type="button" id="batch-delete-all-btn" class="btn sm ghost" style="color:#ef4444; border:1px solid #fecaca; background:#fff; font-size:11.5px; padding:7px 12px; border-radius:8px; white-space:nowrap; cursor:pointer;">
              🗑️ Delete All (${affectedProducts.length})
            </button>
          </div>
        </div>
      ` : ''}

      <div style="flex:1; overflow-y:auto; border:1px solid var(--border,#e7e5e4); border-radius:10px; margin-bottom:18px; background:var(--surface2,#f8fafc);">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:#e7e5e4; font-size:11px; font-weight:800; color:var(--text2); text-transform:uppercase; border-bottom:2px solid #d6d3d1;">
              <th style="padding:10px 10px; text-align:left;">Affected Product</th>
              <th style="padding:10px 10px; text-align:left;">Assign Valid Sub-Type</th>
            </tr>
          </thead>
          <tbody>
            ${productRowsHtml}
          </tbody>
        </table>
      </div>

      <div style="display:flex; gap:10px; justify-content:flex-end; align-items:center;">
        <button type="button" class="btn sm ghost" onclick="window.closeSubtypeOrphanResolverModal()" style="font-weight:600; cursor:pointer;">Cancel</button>
        <button type="button" class="btn sm primary" id="resolve-orphans-confirm-btn" style="font-weight:700; background:var(--primary,#4f46e5); color:#fff; border-radius:8px; padding:8px 18px; cursor:pointer;">
          Commit Resolutions
        </button>
      </div>
    </div>
  `;

  // Function to create a new sub-type under an ingredient
  const handleCreateNewSubtype = (targetIngId, defaultSubName = '') => {
    const ing = ingredients.find(i => String(i.id) === String(targetIngId)) || ingredients[0];
    if (!ing) return null;
    const name = prompt(`Enter new Sub-Type name under "${ing.name}":`, defaultSubName);
    if (!name || !name.trim()) return null;

    const newSubId = 'sub_' + Math.random().toString(36).substr(2, 9);
    const newSub = { id: newSubId, name: name.trim(), notes: '', aliases: [] };
    if (!Array.isArray(ing.subtypes)) ing.subtypes = [];
    ing.subtypes.push(newSub);
    return { ingredientId: ing.id, subtypeId: newSub.id, name: newSub.name, ingredientName: ing.name };
  };

  // Mount autocomplete search for each product row
  modal.querySelectorAll('.product-tax-mount').forEach(mountEl => {
    const pId = mountEl.dataset.prodId;
    const prod = affectedProducts.find(p => String(p.id) === String(pId));
    if (!prod) return;

    const searchInst = createTaxonomySearchInput({
      container: mountEl,
      rootItems: ingredients,
      subtypesOnly: true,
      placeholder: 'Search sub-type (e.g. Protein Bagels)...',
      inputId: `tax-orphan-${pId}`,
      onSelect: (selected) => {
        if (selected && selected.val && selected.val.includes(':')) {
          const [ingId, subId] = selected.val.split(':');
          plannedResolutions.set(pId, { action: 'reassign', ingredientId: ingId, subtypeId: subId, label: selected.label });
          const statusEl = modal.querySelector(`.product-res-status[data-prod-id="${pId}"]`);
          if (statusEl) {
            statusEl.innerHTML = `<span style="color:#059669; font-weight:600;">✓ Target: ${escapeHtml(selected.label || 'Sub-type selected')}</span>`;
          }
        }
      },
      onNewClick: (rawVal) => {
        const created = handleCreateNewSubtype(prod.ingredientId || parentId, rawVal);
        if (created) {
          plannedResolutions.set(pId, { action: 'reassign', ingredientId: created.ingredientId, subtypeId: created.subtypeId, label: created.name });
          searchInst.inputEl.value = `🏷️ ${created.name} (${created.ingredientName})`;
          const statusEl = modal.querySelector(`.product-res-status[data-prod-id="${pId}"]`);
          if (statusEl) {
            statusEl.innerHTML = `<span style="color:#059669; font-weight:600;">✓ New Sub-Type: 🏷️ ${escapeHtml(created.name)} (${escapeHtml(created.ingredientName)})</span>`;
          }
        }
      }
    });

    if (searchInst) activeSearchInstances.push(searchInst);
  });

  // Mount batch search if multiple products
  const batchMount = modal.querySelector('#batch-sub-type-mount');
  if (batchMount) {
    const batchSearchInst = createTaxonomySearchInput({
      container: batchMount,
      rootItems: ingredients,
      subtypesOnly: true,
      placeholder: 'Search sub-type to apply to all products...',
      inputId: 'tax-orphan-batch',
      onSelect: (selected) => {
        if (selected && selected.val && selected.val.includes(':')) {
          const [ingId, subId] = selected.val.split(':');
          affectedProducts.forEach(p => {
            plannedResolutions.set(p.id, { action: 'reassign', ingredientId: ingId, subtypeId: subId, label: selected.label });
            const rowMount = modal.querySelector(`.product-tax-mount[data-prod-id="${p.id}"] input`);
            if (rowMount) rowMount.value = selected.label;
            const statusEl = modal.querySelector(`.product-res-status[data-prod-id="${p.id}"]`);
            if (statusEl) {
              statusEl.innerHTML = `<span style="color:#059669; font-weight:600;">✓ Target: ${escapeHtml(selected.label || 'Sub-type selected')}</span>`;
            }
          });
          if (typeof window.showPlatePlanToast === 'function') {
            window.showPlatePlanToast(`Applied "${selected.label}" to all ${affectedProducts.length} products.`, 'info');
          }
        }
      }
    });
    if (batchSearchInst) activeSearchInstances.push(batchSearchInst);
  }

  // Row Delete buttons
  modal.querySelectorAll('.orphan-delete-btn').forEach(btn => {
    btn.onclick = () => {
      const pId = btn.dataset.prodId;
      plannedResolutions.set(pId, { action: 'delete' });
      const statusEl = modal.querySelector(`.product-res-status[data-prod-id="${pId}"]`);
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:#ef4444; font-weight:700;">🗑️ Marked for deletion</span> <button type="button" class="btn xs ghost undo-delete-btn" data-prod-id="${escapeAttr(pId)}" style="font-size:10.5px; padding:2px 6px; text-decoration:underline;">Undo</button>`;
        const undoBtn = statusEl.querySelector('.undo-delete-btn');
        if (undoBtn) {
          undoBtn.onclick = () => {
            plannedResolutions.delete(pId);
            statusEl.innerHTML = '';
          };
        }
      }
    };
  });

  // Batch Delete button
  const batchDeleteBtn = modal.querySelector('#batch-delete-all-btn');
  if (batchDeleteBtn) {
    batchDeleteBtn.onclick = () => {
      affectedProducts.forEach(p => {
        plannedResolutions.set(p.id, { action: 'delete' });
        const statusEl = modal.querySelector(`.product-res-status[data-prod-id="${p.id}"]`);
        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#ef4444; font-weight:700;">🗑️ Marked for deletion</span>`;
        }
      });
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast(`Marked all ${affectedProducts.length} products for deletion.`, 'info');
      }
    };
  }

  // Commit Button Handler
  const confirmBtn = document.getElementById('resolve-orphans-confirm-btn');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      if (!plannedResolutions.size) {
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Please select a valid sub-type or mark products for deletion.', 'warning');
        }
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Saving...';

      const updates = [];
      let parentToSave = null;

      plannedResolutions.forEach((res, pId) => {
        const origProd = products.find(p => String(p.id) === String(pId));
        if (!origProd) return;
        const p = { ...origProd };

        if (res.action === 'delete') {
          p._delete = true;
          updates.push(p);
        } else if (res.action === 'reassign' && res.ingredientId && res.subtypeId) {
          p.ingredientId = res.ingredientId;
          p.subtypeId = res.subtypeId;
          p.isAutoDefault = false;
          p.updatedAt = new Date().toISOString();
          updates.push(p);

          const targetParent = ingredients.find(i => String(i.id) === String(res.ingredientId));
          if (targetParent) parentToSave = targetParent;
        }
      });

      window.closeSubtypeOrphanResolverModal();

      // 1. Optimistic local state update
      let currentProducts = [...products];
      updates.forEach(u => {
        if (u._delete === true) {
          currentProducts = currentProducts.filter(p => String(p.id) !== String(u.id));
        } else {
          const idx = currentProducts.findIndex(p => String(p.id) === String(u.id));
          if (idx >= 0) currentProducts[idx] = u;
        }
      });

      setProducts(currentProducts);
      setIngredients([...ingredients]);
      if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();

      // 2. Commit atomic write to database
      try {
        await batchResolveOrphansWithNewSubtypeInDb(parentToSave, updates);
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast(`Successfully resolved ${updates.length} product(s).`, 'success');
        }
      } catch (e) {
        console.error('[SubtypeOrphanResolverModal] Batch resolution write failed:', e);
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Database commit failed. Rolling back.', 'error');
        }
        setProducts(products);
        setIngredients([...ingredients]);
        if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
      }
    };
  }
}

export function closeSubtypeOrphanResolverModal() {
  activeSearchInstances.forEach(inst => inst?.destroy?.());
  activeSearchInstances = [];
  const modal = document.getElementById('subtype-orphan-resolver-modal');
  if (modal) {
    modal.className = 'modal';
    modal.style.display = 'none';
  }
}

if (typeof window !== 'undefined') {
  window.openSubtypeOrphanResolverModal = openSubtypeOrphanResolverModal;
  window.closeSubtypeOrphanResolverModal = closeSubtypeOrphanResolverModal;
}
