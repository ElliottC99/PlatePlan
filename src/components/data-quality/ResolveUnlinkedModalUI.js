/**
 * src/components/data-quality/ResolveUnlinkedModalUI.js (v3.19.48)
 * Clean 3-Path Resolution Modal UI component for unlinked ingredients/sub-types.
 * Supports linking existing products, parsing Tesco Bookmarklet JSON, and starting blank creations.
 */

import { getState, setProducts } from '../../store/store.js';
import { saveProduct } from '../../services/HouseholdRepository.js';
import { reallocateProduct } from '../../models/PantryHierarchyModel.js';
import { parseTescoProduct } from '../../services/TescoImportService.js';
import { openProductEditModal } from '../../views/ProductBankView.js';

let activeTargetId = null;
let activeTargetType = 'ingredient'; // 'ingredient' or 'subtype'
let activeParentIngredientId = null;

const safeEscapeHtml = (str) => {
  if (typeof escapeHtml === 'function') return escapeHtml(str);
  if (typeof window !== 'undefined' && window.escapeHtml) return window.escapeHtml(str);
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const safeEscapeAttr = (str) => {
  if (typeof escapeAttr === 'function') return escapeAttr(str);
  if (typeof window !== 'undefined' && window.escapeAttr) return window.escapeAttr(str);
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const safeGetState = () => {
  if (typeof getState === 'function') return getState() || {};
  if (typeof window !== 'undefined' && window.Store && typeof window.Store.getState === 'function') return window.Store.getState() || {};
  return {};
};

export function closeResolveUnlinkedModal() {
  try {
    const modal = document.getElementById('resolve-unlinked-modal-overlay');
    if (modal) {
      modal.style.display = 'none';
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }
    document.body.style.overflow = '';
    activeTargetId = null;
    activeParentIngredientId = null;
  } catch (err) {
    console.error('[ResolveUnlinkedModalUI] Error closing modal:', err);
  }
}

export function openResolveUnlinkedModal(target, targetType = 'ingredient', parentIngredientId = null) {
  try {
    let targetId = target;
    let type = targetType;
    let parentId = parentIngredientId;

    if (target && typeof target === 'object') {
      targetId = target.id || target.entityId || target.targetId;
      type = target.type || target.entityType || target.targetType || 'ingredient';
      parentId = target.parentId || target.parentIngredientId || null;
    }

    activeTargetId = targetId;
    activeTargetType = type;
    activeParentIngredientId = parentId;

    const state = safeGetState();
    let targetName = (target && typeof target === 'object' && target.name) ? target.name : 'Unnamed Item';
    let searchTerm = '';

    if (type === 'subtype') {
      const parent = (state.ingredients || []).find(i => String(i.id) === String(parentId));
      const sub = parent?.subtypes?.find(s => String(s.id) === String(targetId));
      targetName = sub ? `${parent ? parent.name : 'Ingredient'} ➔ ${sub.name}` : (target.name || targetId || 'Sub-type');
      searchTerm = sub ? sub.name : (parent ? parent.name : 'grocery');
    } else {
      const ing = (state.ingredients || []).find(i => String(i.id) === String(targetId));
      targetName = ing ? ing.name : (target.name || targetId || 'Ingredient');
      searchTerm = ing ? ing.name : (target.name || 'grocery');
    }

    const tescoSearchUrl = `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(searchTerm)}`;

    const portalRoot = document.getElementById('view-modal-wrap') || document.body;
    let modal = document.getElementById('resolve-unlinked-modal-overlay');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'resolve-unlinked-modal-overlay';
      portalRoot.appendChild(modal);
    } else if (modal.parentElement !== portalRoot) {
      portalRoot.appendChild(modal);
    }

    modal.className = 'modal active';
    document.body.style.overflow = 'hidden';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;inset:0;z-index:99999;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;overflow-y:auto;';

    modal.innerHTML = `
      <div style="width:100%;max-width:580px;max-height:80vh;overflow-y:auto;padding:20px 20px 28px 20px;box-sizing:border-box;background:var(--system-grouped-bg,#f2f2f7);border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,0.25);position:relative">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px">
          <div>
            <h2 style="font-size:18px;font-weight:750;margin:0;color:var(--text,#1c1917)">Resolve Unlinked Item</h2>
            <div style="font-size:13px;color:var(--text2,#78716c);margin-top:4px">
              Target Item: <strong style="color:var(--text,#1c1917)">${safeEscapeHtml(targetName)}</strong>
            </div>
          </div>
          <button type="button" class="btn sm ghost" style="padding:4px 8px;font-size:16px;line-height:1" onclick="closeResolveUnlinkedModal()" title="Close">&times;</button>
        </div>

        <p style="font-size:12.5px;color:var(--text2,#78716c);line-height:1.5;margin-bottom:16px">
          This catalog item has zero linked products in your Product Bank. Choose one of the resolution paths below to attach grocery items:
        </p>

        <div style="display:flex;flex-direction:column;gap:0">
          <!-- Path 1: Link Existing Product -->
          <div style="background:#ffffff;border-radius:14px;padding:16px;border:1px solid var(--border-color,#e5e7eb);box-shadow:0 1px 3px rgba(0,0,0,0.04);margin-bottom:16px">
            <div style="font-weight:750;font-size:13.5px;margin-bottom:4px;color:var(--text,#1c1917)">🔗 1. Link Existing Product</div>
            <div style="font-size:12px;color:var(--text2,#78716c);margin-bottom:10px">
              Search your Product Bank and re-bind an existing product to this item.
            </div>
            <input type="search" id="resolve-link-search" class="input" placeholder="Search product by name or brand..." style="font-size:12.5px;padding:8px 12px;width:100%;border-radius:8px;border:1px solid var(--border,#e7e5e4);box-sizing:border-box" oninput="filterResolveLinkProducts(this.value)">
            <div id="resolve-link-results" style="margin-top:8px;max-height:160px;overflow-y:auto;display:none;border:1px solid var(--border,#e7e5e4);border-radius:8px;background:var(--surface,#fff)"></div>
          </div>

          <!-- Path 2: Import from Tesco -->
          <div style="background:#ffffff;border-radius:14px;padding:16px;border:1px solid var(--border-color,#e5e7eb);box-shadow:0 1px 3px rgba(0,0,0,0.04);margin-bottom:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
              <div style="font-weight:750;font-size:13.5px;color:var(--text,#1c1917)">🛒 2. Import from Tesco</div>
            </div>
            
            <!-- Tesco Search Shortcut Button -->
            <div style="margin-bottom:10px">
              <a href="${safeEscapeAttr(tescoSearchUrl)}" target="_blank" rel="noopener noreferrer" class="btn sm ghost" style="display:inline-flex;align-items:center;gap:6px;color:var(--primary,#4f46e5);font-weight:600;font-size:12px;padding:5px 10px;border:1px solid rgba(79,70,229,0.2);background:rgba(79,70,229,0.05);border-radius:8px;text-decoration:none">
                🔍 Search Tesco for "${safeEscapeHtml(searchTerm)}" ↗
              </a>
            </div>

            <div style="font-size:12px;color:var(--text2,#78716c);margin-bottom:8px">
              Paste the JSON payload copied from the Tesco bookmarklet below to parse and link this product.
            </div>
            <textarea id="resolve-tesco-json" placeholder='{"name":"Tesco Bagels 4 Pack","price":1.50,"brand":"Tesco",...}' style="width:100%;height:85px;font-family:monospace;font-size:11.5px;padding:8px;border:1px solid var(--border,#e7e5e4);border-radius:8px;background:#fff;color:var(--text,#1c1917);box-sizing:border-box;resize:vertical"></textarea>
            <div id="resolve-tesco-error" style="display:none;color:var(--red,#ef4444);font-size:12px;margin-top:6px;font-weight:600"></div>
            <button type="button" class="btn sm primary" style="width:100%;margin-top:8px;font-weight:700" onclick="submitResolveTescoImport()">Parse &amp; Link Product</button>
          </div>

          <!-- Path 3: Create New Product -->
          <div style="background:#ffffff;border-radius:14px;padding:16px;border:1px solid var(--border-color,#e5e7eb);box-shadow:0 1px 3px rgba(0,0,0,0.04);margin-bottom:0;cursor:pointer;transition:border-color 0.15s ease" onclick="submitResolveNewProduct()" onmouseover="this.style.borderColor='var(--primary,#4f46e5)'" onmouseout="this.style.borderColor='var(--border-color,#e5e7eb)'">
            <div style="font-weight:750;font-size:13.5px;margin-bottom:4px;color:var(--text,#1c1917);display:flex;align-items:center;justify-content:space-between">
              <span>✨ 3. Create New Product</span>
              <span class="btn sm ghost" style="pointer-events:none;font-size:11.5px">Open Blank Form &rarr;</span>
            </div>
            <div style="font-size:12px;color:var(--text2,#78716c)">
              Open a clean, pre-populated blank form to manually insert and configure a custom product.
            </div>
          </div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  } catch (err) {
    console.error('[ResolveUnlinkedModalUI] Modal error:', err);
  }
}

export function filterResolveLinkProducts(query) {
  const container = document.getElementById('resolve-link-results');
  if (!container) return;

  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  const state = safeGetState();
  const products = Array.isArray(state.products) ? state.products : [];

  const matches = products.filter(p => {
    const name = String(p.name || '').toLowerCase();
    const brand = String(p.brand || '').toLowerCase();
    return name.includes(q) || brand.includes(q);
  }).slice(0, 10);

  if (!matches.length) {
    container.style.display = 'block';
    container.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--text3,#a8a29e);text-align:center">No matching products found.</div>';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = matches.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border,#e7e5e4);box-sizing:border-box">
      <div style="min-width:0">
        <div style="font-size:12.5px;font-weight:700;color:var(--text,#1c1917);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safeEscapeHtml(p.name)}</div>
        <div style="font-size:11px;color:var(--text2,#78716c)">${safeEscapeHtml(p.brand || 'No brand')} · £${Number(p.price || 0).toFixed(2)}</div>
      </div>
      <button type="button" class="btn sm primary" style="font-size:11px;padding:3px 8px" onclick="submitResolveLinkExisting('${safeEscapeAttr(p.id)}')">Link</button>
    </div>
  `).join('');
}

export async function submitResolveLinkExisting(productId) {
  const parentIngId = activeTargetType === 'subtype' ? activeParentIngredientId : activeTargetId;
  const subId = activeTargetType === 'subtype' ? activeTargetId : null;

  const success = await reallocateProduct(productId, parentIngId, subId);
  if (success) {
    closeResolveUnlinkedModal();
    document.dispatchEvent(new CustomEvent('plateplan:state:products'));
  }
}

export async function submitResolveTescoImport() {
  const txtArea = document.getElementById('resolve-tesco-json');
  const errDiv = document.getElementById('resolve-tesco-error');
  if (!txtArea || !errDiv) return;

  errDiv.style.display = 'none';
  const val = txtArea.value.trim();
  if (!val) {
    errDiv.textContent = 'Please paste Tesco bookmarklet JSON.';
    errDiv.style.display = 'block';
    return;
  }

  const res = parseTescoProduct(val);
  if (!res.success) {
    errDiv.textContent = res.error || 'Parsing error.';
    errDiv.style.display = 'block';
    return;
  }

  const state = safeGetState();
  const currentProds = Array.isArray(state.products) ? [...state.products] : [];
  const pData = res.data;
  const parentIngId = activeTargetType === 'subtype' ? activeParentIngredientId : activeTargetId;
  const subId = activeTargetType === 'subtype' ? activeTargetId : null;
  const targetIng = (state.ingredients || []).find(i => String(i.id) === String(parentIngId));

  const newProd = {
    id: `prod_${Date.now()}`,
    name: pData.name,
    brand: pData.brand || '',
    category: targetIng?.category || pData.cat || 'General',
    storage: pData.storage || 'cupboard',
    cal: pData.cal || 0,
    prot: pData.prot || 0,
    carb: pData.carb || 0,
    fat: pData.fat || 0,
    fibre: pData.fibre || 0,
    price: pData.price || 0,
    pack: pData.packSize || 0,
    packUnit: pData.packUnit || 'g',
    itemWeight: pData.itemWeight || null,
    drainedWeight: pData.drainedWeight || null,
    ingredientId: parentIngId,
    subtypeId: subId,
    isAutoDefault: true,
    updatedAt: new Date().toISOString()
  };

  currentProds.push(newProd);
  setProducts(currentProds);
  closeResolveUnlinkedModal();

  try {
    await saveProduct(newProd);
  } catch (e) {
    console.warn('[ResolveUnlinkedModalUI] Tesco Firestore sync warning:', e);
  }

  document.dispatchEvent(new CustomEvent('plateplan:state:products'));
}

export function submitResolveNewProduct() {
  const parentIngId = activeTargetType === 'subtype' ? activeParentIngredientId : activeTargetId;
  const subId = activeTargetType === 'subtype' ? activeTargetId : null;

  closeResolveUnlinkedModal();

  openProductEditModal(null);
  
  const targetIng = (safeGetState()?.ingredients || []).find(i => String(i.id) === String(parentIngId));
  const catSearchEl = document.getElementById('mi-cat-search') || document.getElementById('mi-cat');
  if (catSearchEl && targetIng?.category) {
    catSearchEl.value = targetIng.category;
  }

  setTimeout(() => {
    const nameEl = document.getElementById('mi-name');
    if (nameEl && targetIng) {
      nameEl.value = targetIng.name;
    }
  }, 100);

  window.__prefilledResolveBinding = {
    ingredientId: parentIngId,
    subtypeId: subId
  };
}

if (typeof window !== 'undefined') {
  window.openResolveUnlinkedModal = openResolveUnlinkedModal;
  window.closeResolveUnlinkedModal = closeResolveUnlinkedModal;
  window.filterResolveLinkProducts = filterResolveLinkProducts;
  window.submitResolveLinkExisting = submitResolveLinkExisting;
  window.submitResolveTescoImport = submitResolveTescoImport;
  window.submitResolveNewProduct = submitResolveNewProduct;
}
