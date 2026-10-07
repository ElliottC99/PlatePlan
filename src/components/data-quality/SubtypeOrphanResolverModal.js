/**
 * src/components/data-quality/SubtypeOrphanResolverModal.js
 * Lists all store products affected by a missing/deleted sub-type.
 * Displays batch dropdown interface to reassign, convert, create new sub-type, or delete them in a single write batch.
 */

import { getState, setProducts, setIngredients } from '../../store/store.js';
import { batchResolveOrphansWithNewSubtypeInDb } from '../../services/HouseholdRepository.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function openSubtypeOrphanResolverModal(orphanIssue = {}) {
  const state = getState() || {};
  const products = state.products || [];
  const ingredients = state.ingredients || [];

  const targetSubtypeId = orphanIssue.subtypeId;
  const parentId = orphanIssue.parentId;

  // Find all products referencing this missing/deleted subtypeId
  const affectedProducts = products.filter(p => String(p.subtypeId) === String(targetSubtypeId));

  if (!affectedProducts.length) {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('No products are currently referencing this orphaned sub-type.', 'info');
    }
    return;
  }

  // Find parent ingredient
  const parent = ingredients.find(ing => String(ing.id) === String(parentId));
  const availableSubtypes = parent && Array.isArray(parent.subtypes) ? parent.subtypes : [];

  let modal = document.getElementById('subtype-orphan-resolver-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'subtype-orphan-resolver-modal';
    document.body.appendChild(modal);
  }
  modal.className = 'modal active';
  modal.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;padding:16px;';

  const productRows = affectedProducts.map((p, idx) => {
    const subtypeOptions = availableSubtypes.map(st => `
      <option value="reassign:${st.id}">${escapeHtml(st.name)} (Sub-type)</option>
    `).join('');

    return `
      <tr style="border-bottom: 1px solid var(--border,#e7e5e4); font-size:12.5px;">
        <td style="padding:10px 8px; font-weight:700; text-align:left;">
          ${escapeHtml(p.name)} <br /><span style="font-size:10.5px; font-weight:normal; color:var(--text2);">${escapeHtml(p.brand || 'No Brand')}</span>
        </td>
        <td style="padding:10px 8px; text-align:center;">
          <select class="orphan-action-select" data-index="${idx}" data-prod-id="${escapeHtml(p.id)}" style="padding:6px; font-size:11.5px; border-radius:6px; border:1px solid var(--border); background:#fff; width:100%; max-width:200px; margin-bottom:4px;">
            <option value="convert" selected>Convert to Parent-level (${escapeHtml(parent?.name || 'Ingredient')})</option>
            ${subtypeOptions}
            <option value="NEW_SUBTYPE">+ Create New Sub-Type...</option>
            <option value="delete">🗑️ Delete Product from Catalog</option>
          </select>
          <div class="new-subtype-container" style="display:none; margin-top:4px;">
            <input type="text" class="new-subtype-name-input" placeholder="New sub-type name..." style="width:100%; padding:4px 6px; font-size:11px; border:1px solid var(--border); border-radius:4px;" />
          </div>
        </td>
      </tr>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:600px; padding:24px; border-radius:14px; background:var(--surface,#fff); box-shadow:0 12px 36px rgba(0,0,0,0.25); display:flex; flex-direction:column; max-height:90vh; box-sizing:border-box;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px;">
        <div>
          <h2 style="font-size:17.5px; font-weight:750; margin:0; color:var(--text,#1c1917);">Resolve Orphaned Products</h2>
          <p style="font-size:12.5px; color:var(--text2,#78716c); margin:4px 0 0 0;">
            Products are referencing sub-type ID <strong>"${escapeHtml(targetSubtypeId)}"</strong> which is deleted. Assign resolutions below.
          </p>
        </div>
        <button type="button" class="btn sm ghost" style="padding:4px 8px; font-size:16px; line-height:1;" onclick="window.closeSubtypeOrphanResolverModal()">✕</button>
      </div>

      <!-- Batch Dropdown interface -->
      <div style="background:#eef2ff; border:1px solid #c7d2fe; border-radius:8px; padding:10px; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <span style="font-size:11.5px; font-weight:700; color:#3730a3;">⚡ Apply Batch Resolution:</span>
        <div style="display:flex; gap:6px;">
          <select id="batch-resolution-select" style="padding:5px; font-size:11.5px; border-radius:6px; border:1px solid #a5b4fc; background:#fff;">
            <option value="convert">Convert all to Parent-level</option>
            ${availableSubtypes.map(st => `<option value="reassign:${st.id}">Reassign all to: ${escapeHtml(st.name)}</option>`).join('')}
            <option value="NEW_SUBTYPE">+ Create New Sub-Type...</option>
            <option value="delete">Delete all affected products</option>
          </select>
          <button type="button" id="batch-apply-btn" class="btn primary sm" style="font-size:11px; padding:4px 10px; background:#4f46e5; color:#fff; border-radius:6px;">Apply</button>
        </div>
      </div>

      <div style="flex:1; overflow-y:auto; border:1px solid var(--border,#e7e5e4); border-radius:10px; margin-bottom:18px; background:var(--surface2,#f5f5f4);">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:#e7e5e4; font-size:11px; font-weight:800; color:var(--text2); text-transform:uppercase; border-bottom:2px solid #d6d3d1;">
              <th style="padding:10px 8px; text-align:left;">Affected Product</th>
              <th style="padding:10px 8px; text-align:center; width:240px;">Resolution Action</th>
            </tr>
          </thead>
          <tbody>
            ${productRows}
          </tbody>
        </table>
      </div>

      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button type="button" class="btn sm ghost" onclick="window.closeSubtypeOrphanResolverModal()">Cancel</button>
        <button type="button" class="btn sm primary" id="resolve-orphans-confirm-btn" style="font-weight:700; background:var(--primary,#4f46e5); color:#fff; border-radius:8px; padding:8px 16px;">Commit Resolutions Batch</button>
      </div>
    </div>
  `;

  // Toggle dynamic input visibility when NEW_SUBTYPE is selected
  modal.querySelectorAll('.orphan-action-select').forEach(sel => {
    sel.onchange = () => {
      const container = sel.closest('td').querySelector('.new-subtype-container');
      if (container) {
        container.style.display = sel.value === 'NEW_SUBTYPE' ? 'block' : 'none';
      }
    };
  });

  // Apply batch resolution handler
  document.getElementById('batch-apply-btn').onclick = () => {
    const val = document.getElementById('batch-resolution-select').value;
    const selects = modal.querySelectorAll('.orphan-action-select');
    selects.forEach(sel => {
      sel.value = val;
      const container = sel.closest('td').querySelector('.new-subtype-container');
      if (container) {
        container.style.display = val === 'NEW_SUBTYPE' ? 'block' : 'none';
      }
    });
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Batch resolution action prepared for commit.', 'info');
    }
  };

  // Commit handler
  document.getElementById('resolve-orphans-confirm-btn').onclick = async () => {
    const selects = modal.querySelectorAll('.orphan-action-select');
    const updates = [];
    let createdSubtype = null;

    selects.forEach(sel => {
      const pId = sel.dataset.prodId;
      const val = sel.value;
      const origProd = products.find(p => String(p.id) === String(pId));
      if (!origProd) return;

      const p = { ...origProd };
      if (val === 'convert') {
        p.subtypeId = null;
        p.isAutoDefault = false;
        p.updatedAt = new Date().toISOString();
        updates.push(p);
      } else if (val.startsWith('reassign:')) {
        const newSubId = val.split(':')[1];
        p.subtypeId = newSubId;
        p.updatedAt = new Date().toISOString();
        updates.push(p);
      } else if (val === 'NEW_SUBTYPE') {
        const rowTd = sel.closest('td');
        const nameInput = rowTd.querySelector('.new-subtype-name-input');
        const subName = nameInput ? nameInput.value.trim() : '';
        if (subName && parent) {
          if (!createdSubtype) {
            const newSubId = 'sub_' + Math.random().toString(36).substr(2, 9);
            createdSubtype = { id: newSubId, name: subName, notes: '', aliases: [] };
            if (!Array.isArray(parent.subtypes)) parent.subtypes = [];
            parent.subtypes.push(createdSubtype);
          }
          p.subtypeId = createdSubtype.id;
          p.updatedAt = new Date().toISOString();
          updates.push(p);
        } else {
          p.subtypeId = null;
          p.isAutoDefault = false;
          p.updatedAt = new Date().toISOString();
          updates.push(p);
        }
      } else if (val === 'delete') {
        p._delete = true; // Mark for batch deletion
        updates.push(p);
      }
    });

    window.closeSubtypeOrphanResolverModal();

    // 1. Optimistic Local State Update
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
    if (parent) {
      setIngredients([...ingredients]);
    }
    if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();

    // 2. Commit Atomic DB Batch Write
    try {
      await batchResolveOrphansWithNewSubtypeInDb(parent, updates);
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast(`Successfully resolved ${updates.length} orphaned products atomically.`, 'success');
      }
    } catch (e) {
      console.error('[SubtypeOrphanResolverModal] Batch resolution write failed:', e);
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Database commit failed. Rolling back.', 'error');
      }
      // Revert store state
      setProducts(products);
      if (parent) setIngredients([...ingredients]);
      if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
    }
  };
}

export function closeSubtypeOrphanResolverModal() {
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
