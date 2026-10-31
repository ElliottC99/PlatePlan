/**
 * src/views/ProductBankView.js (v3.38.61)
 * Modular ES6 View for Product Bank with real-time search filtering.
 * Decomposed: HTML template rendering moved to ProductBankRenderService.js.
 */

import { getState, setProducts, setIngredients } from '../store/store.js';
import { saveProduct, deleteProduct } from '../services/ProductRepository.js';
import { saveRootItem } from '../services/RootItemRepository.js';
import { commitAtomicChain } from '../services/PantryTaxonomyService.js';
import { reallocateProduct, setAutoDefaultProduct, getActiveCategories, addSubtypeToIngredient } from '../models/PantryHierarchyModel.js';
import { promptReallocateProduct as openReallocateModal } from '../components/pantry/ReallocateProductModalUI.js';
import { showCustomAlert, showCustomConfirm } from '../components/ui/DialogHelpers.js';
import { escapeHtml, escapeAttr } from '../utils/stringUtils.js';
import { parseTescoProduct, cleanProductName, toTitleCase } from '../services/TescoImportService.js';

import { 
  renderProductBankBase, 
  renderEmptyProductBank, 
  renderNoMatchingProducts, 
  renderProductCard, 
  renderCategoryGroup 
} from './ProductBankRenderService.js';

let activeEditingProductId = null;

export function cancelManualIng() {
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) wrap.classList.remove('open');
  document.body.style.overflow = '';
  activeEditingProductId = null;
  // A pre-link from Link Product must not carry over to the next, unrelated new product.
  window.__prefilledResolveBinding = null;
  window.__pendingHierarchyCommit = null;

  if (window.__modalContext && window.__modalContext.returnTo === 'data-quality') {
    const ctx = window.__modalContext;
    window.__modalContext = null;
    if (typeof window.showView === 'function') {
      window.showView('data');
    }
  }
}

export function openProductEditModal(productIdOrDraft = null) {
  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (!wrap || !content) return;

  content.innerHTML = `
    <div id="mi-inner-wrap" style="background: var(--surface, #fff); border-radius: 14px; padding: 18px 24px; max-width: 680px; width: 100%; margin: 0 auto; max-height: 88vh; overflow-y: auto; box-sizing: border-box; box-shadow: 0 10px 25px rgba(0,0,0,0.12);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 12px; border-bottom: 1px solid var(--border, #e7e5e4); padding-bottom: 8px;">
        <h3 id="mi-title" style="margin: 0; font-size: 1.15rem; font-weight: 750; color: var(--text, #1c1917);">Add product</h3>
        <div id="mi-tesco-actions" style="display: flex; align-items: center; gap: 8px;">
          <div id="mi-tesco-updated" role="status" style="font-size: 11px; color: var(--text2, #78716c);"></div>
          <button type="button" class="btn xs ghost" data-action="tesco-update" aria-controls="mi-tesco-paste" style="font-size: 11.5px; padding: 3px 8px; font-weight: 650; border: 1px solid var(--border, #e7e5e4);">Paste/update from Tesco</button>
        </div>
      </div>
      <div id="mi-tesco-paste" hidden style="width: 100%; margin-bottom: 12px; background: var(--surface2, #f8fafc); border: 1px solid var(--border, #e2e8f0); border-radius: 8px; padding: 10px;">
        <label for="mi-tesco-json" style="font-size: 11.5px; font-weight: 600; display: block; margin-bottom: 4px;">Paste the Tesco bookmarklet output</label>
        <textarea id="mi-tesco-json" name="mi-tesco-json" rows="2" style="width: 100%; font-size: 12px; padding: 6px; box-sizing: border-box; border-radius: 6px; border: 1px solid var(--border);"></textarea>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
          <div id="mi-tesco-error" role="alert" style="font-size: 11.5px; color: var(--red, #dc2626);"></div>
          <button type="button" class="btn xs primary" data-action="tesco-update-apply" style="font-size: 11.5px; padding: 3px 10px;">Update fields</button>
        </div>
      </div>
      <div id="mi-linkage-container" style="margin-bottom: 10px;"></div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 8px;">
        <div>
          <label for="mi-name" style="display: block; font-size: 11.5px; font-weight: 700; margin-bottom: 3px;">Product name</label>
          <input type="text" id="mi-name" name="mi-name" placeholder="Product name" style="width: 100%; padding: 6px 10px; font-size: 12.5px; border-radius: 6px; border: 1px solid var(--border, #ccc); box-sizing: border-box;">
        </div>
        <div>
          <label for="mi-brand" style="display: block; font-size: 11.5px; font-weight: 700; margin-bottom: 3px;">Brand</label>
          <input type="text" id="mi-brand" name="mi-brand" placeholder="e.g. Tesco" style="width: 100%; padding: 6px 10px; font-size: 12.5px; border-radius: 6px; border: 1px solid var(--border, #ccc); box-sizing: border-box;">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 10px;">
        <div>
          <label for="mi-cat-search" style="display: block; font-size: 11.5px; font-weight: 700; margin-bottom: 3px;">Category</label>
          <input type="search" id="mi-cat-search" name="mi-cat-search" placeholder="Search category" list="mi-cat-category-options" style="width: 100%; padding: 6px 10px; font-size: 12.5px; border-radius: 6px; border: 1px solid var(--border, #ccc); box-sizing: border-box;">
          <datalist id="mi-cat-category-options"></datalist>
        </div>
        <div>
          <label for="mi-storage" style="display: block; font-size: 11.5px; font-weight: 700; margin-bottom: 3px;">Storage</label>
          <select id="mi-storage" name="mi-storage" style="width: 100%; padding: 6px 10px; font-size: 12.5px; border-radius: 6px; border: 1px solid var(--border, #ccc); box-sizing: border-box;">
            <option value="">-- Select --</option>
            <option value="cupboard">Cupboard</option>
            <option value="fridge">Fridge</option>
            <option value="freezer">Freezer</option>
          </select>
        </div>
      </div>

      <div style="font-size: 11px; font-weight: 750; color: var(--text2, #78716c); text-transform: uppercase; letter-spacing: 0.5px; margin: 8px 0 4px;">Per 100g</div>
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 10px;">
        <div>
          <label for="mi-cal" style="display: block; font-size: 11px; font-weight: 650; margin-bottom: 2px;">Calories</label>
          <input type="number" id="mi-cal" name="mi-cal" placeholder="132" style="width: 100%; padding: 5px 8px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border, #ccc); box-sizing: border-box;">
        </div>
        <div>
          <label for="mi-fat" style="display: block; font-size: 11px; font-weight: 650; margin-bottom: 2px;">Fat (g)</label>
          <input type="number" id="mi-fat" name="mi-fat" placeholder="5.9" style="width: 100%; padding: 5px 8px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border, #ccc); box-sizing: border-box;">
        </div>
        <div>
          <label for="mi-carb" style="display: block; font-size: 11px; font-weight: 650; margin-bottom: 2px;">Carbs (g)</label>
          <input type="number" id="mi-carb" name="mi-carb" placeholder="5.4" style="width: 100%; padding: 5px 8px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border, #ccc); box-sizing: border-box;">
        </div>
        <div>
          <label for="mi-fibre" style="display: block; font-size: 11px; font-weight: 650; margin-bottom: 2px;">Fibre (g)</label>
          <input type="number" id="mi-fibre" name="mi-fibre" placeholder="4.5" style="width: 100%; padding: 5px 8px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border, #ccc); box-sizing: border-box;">
        </div>
        <div>
          <label for="mi-prot" style="display: block; font-size: 11px; font-weight: 650; margin-bottom: 2px;">Protein (g)</label>
          <input type="number" id="mi-prot" name="mi-prot" placeholder="14.5" style="width: 100%; padding: 5px 8px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border, #ccc); box-sizing: border-box;">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1.25fr 1.35fr 1fr; gap: 8px; margin-bottom: 10px;">
        <div>
          <label for="mi-price" style="display: block; font-size: 11px; font-weight: 650; margin-bottom: 2px;">Price / pack (£)</label>
          <input type="number" id="mi-price" name="mi-price" placeholder="2.50" step="0.01" style="width: 100%; padding: 5px 8px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border, #ccc); box-sizing: border-box;">
        </div>
        <div>
          <label for="mi-pack" style="display: block; font-size: 11px; font-weight: 650; margin-bottom: 2px;">Total pack size</label>
          <div style="display: flex; gap: 4px;">
            <input type="number" id="mi-pack" name="mi-pack" placeholder="500" style="min-width: 0; flex: 1; padding: 5px 6px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border, #ccc); box-sizing: border-box;">
            <select id="mi-pack-unit" name="mi-pack-unit" aria-label="Pack unit" style="width: 52px; border: 1px solid var(--border, #ccc); border-radius: 6px; padding: 0 4px; font-size: 11.5px;">
              <option value="g">g</option>
              <option value="ml">ml</option>
            </select>
          </div>
        </div>
        <div>
          <label for="mi-item-weight" style="display: block; font-size: 11px; font-weight: 650; margin-bottom: 2px;">1 Usable item size</label>
          <div style="display: flex; gap: 4px;">
            <input type="number" id="mi-item-weight" name="mi-item-weight" placeholder="e.g. 75" style="min-width: 0; flex: 1; padding: 5px 6px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border, #ccc); box-sizing: border-box;">
            <select id="mi-item-weight-unit" name="mi-item-weight-unit" aria-label="Weight / volume of 1 usable item unit" style="width: 62px; border: 1px solid var(--border, #ccc); border-radius: 6px; padding: 0 4px; font-size: 11.5px;">
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="units">units</option>
            </select>
          </div>
        </div>
        <div>
          <label for="mi-drained-weight" style="display: block; font-size: 11px; font-weight: 650; margin-bottom: 2px;">Drained weight</label>
          <input type="number" id="mi-drained-weight" name="mi-drained-weight" placeholder="e.g. 235" style="width: 100%; padding: 5px 8px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border, #ccc); box-sizing: border-box;">
        </div>
      </div>

      <div style="margin-bottom: 12px;">
        <label for="mi-notes" style="display: block; font-size: 11px; font-weight: 650; margin-bottom: 2px;">Notes</label>
        <input type="text" id="mi-notes" name="mi-notes" placeholder="e.g. Great in bolognese, buy frozen" style="width: 100%; padding: 5px 10px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border, #ccc); box-sizing: border-box;">
      </div>

      <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; border-top: 1px solid var(--border, #e7e5e4); padding-top: 12px; margin-top: 6px;">
        <button type="button" class="btn sm ghost" data-action="cancel-manual-ing" style="font-weight: 600;">Cancel</button>
        <button type="button" class="btn sm primary" id="mi-save-btn" data-action="save-manual-ing" style="font-weight: 700;">Save Product</button>
      </div>
      <div id="mi-msg"></div>
    </div>
  `;

  const state = getState();
  const products = Array.isArray(state.products) ? state.products : [];

  let prod = null;
  let isDraft = false;

  if (productIdOrDraft && typeof productIdOrDraft === 'object') {
    prod = productIdOrDraft;
    isDraft = true;
    activeEditingProductId = prod.id && !prod.id.startsWith('draft_') && !prod.id.startsWith('prod_draft') ? prod.id : null;
  } else if (productIdOrDraft) {
    activeEditingProductId = productIdOrDraft;
    prod = products.find(p => String(p.id) === String(productIdOrDraft)) || null;
  } else {
    activeEditingProductId = null;
  }

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? val : '';
  };

  const titleEl = document.getElementById('mi-title');
  if (titleEl) {
    titleEl.textContent = (!isDraft && prod?.name) ? `Edit product: ${prod.name}` : (isDraft && prod?.name ? `Add product: ${prod.name}` : 'Add product');
  }

  const binding = window.__prefilledResolveBinding || {};
  const tescoData = binding.tescoImportData;

  if (prod) {
    setVal('mi-name', prod.name || binding.subtypeDraftName || '');
    setVal('mi-brand', prod.brand || '');
    setVal('mi-cat-search', prod.category || prod.cat || binding.parentCategory || 'General');
    setVal('mi-storage', prod.storage || 'cupboard');
    setVal('mi-cal', prod.cal ?? prod.calories ?? '');
    setVal('mi-fat', prod.fat ?? '');
    setVal('mi-carb', prod.carb ?? prod.carbs ?? '');
    setVal('mi-fibre', prod.fibre ?? '');
    setVal('mi-prot', prod.prot ?? prod.protein ?? '');
    setVal('mi-price', prod.price ?? '');
    setVal('mi-pack', prod.pack ?? prod.packSize ?? '');
    setVal('mi-pack-unit', prod.packUnit || prod.unit || 'g');
    setVal('mi-item-weight', prod.itemWeight ?? '');
    setVal('mi-item-weight-unit', prod.itemWeightUnit || prod.item_weight_unit || 'g');
    setVal('mi-drained-weight', prod.drainedWeight ?? '');
    setVal('mi-notes', prod.notes ?? '');
  } else if (tescoData) {
    const rawBrand = tescoData.brand || 'Tesco';
    const brand = toTitleCase(rawBrand);
    const rawName = tescoData.title || tescoData.name || binding.subtypeDraftName || '';
    const name = cleanProductName(rawName, brand);
    setVal('mi-name', name);
    setVal('mi-brand', brand);
    setVal('mi-cat-search', tescoData.category || binding.parentCategory || 'General');
    setVal('mi-storage', tescoData.storage || 'cupboard');
    setVal('mi-price', tescoData.price || '');
    setVal('mi-pack', tescoData.pack || tescoData.packSize || tescoData.size || '');
    setVal('mi-pack-unit', tescoData.packUnit || tescoData.unit || 'g');
    setVal('mi-cal', tescoData.cal ?? tescoData.calories ?? '');
    setVal('mi-fat', tescoData.fat ?? '');
    setVal('mi-carb', tescoData.carb ?? tescoData.carbs ?? '');
    setVal('mi-fibre', tescoData.fibre ?? '');
    setVal('mi-prot', tescoData.prot ?? tescoData.protein ?? '');
    setVal('mi-item-weight', tescoData.itemWeight ?? '');
    setVal('mi-item-weight-unit', tescoData.itemWeightUnit || 'g');
    setVal('mi-drained-weight', tescoData.drainedWeight ?? '');
    setVal('mi-notes', tescoData.notes || (tescoData.url || tescoData.tescoUrl ? `Tesco: ${tescoData.url || tescoData.tescoUrl}` : ''));
  } else {
    setVal('mi-name', binding.subtypeDraftName || '');
    setVal('mi-brand', '');
    setVal('mi-cat-search', binding.parentCategory || 'General');
    setVal('mi-storage', 'cupboard');
    setVal('mi-cal', '');
    setVal('mi-fat', '');
    setVal('mi-carb', '');
    setVal('mi-fibre', '');
    setVal('mi-prot', '');
    setVal('mi-price', '');
    setVal('mi-pack', '');
    setVal('mi-pack-unit', 'g');
    setVal('mi-item-weight', '');
    setVal('mi-item-weight-unit', 'g');
    setVal('mi-drained-weight', '');
    setVal('mi-notes', '');
  }

  const catOptsEl = document.getElementById('mi-cat-category-options');
  if (catOptsEl) {
    const categories = getActiveCategories(state);
    catOptsEl.innerHTML = categories.map(c => `<option value="${escapeAttr(c)}"></option>`).join('');
  }

  const pastePanel = document.getElementById('mi-tesco-paste');
  if (pastePanel) pastePanel.hidden = true;

  document.body.style.overflow = 'hidden';
  wrap.style.setProperty('z-index', '25005', 'important');
  wrap.classList.add('open');
}

// Edit product › Paste/update from Tesco: show or hide the paste box inside the open form.
export function toggleTescoUpdate() {
  const panel = document.getElementById('mi-tesco-paste');
  if (!panel) return;
  panel.hidden = !panel.hidden;
  if (!panel.hidden) document.getElementById('mi-tesco-json')?.focus();
}

// Form field, label, the parsed value, and whether the pasted bookmarklet JSON actually carried it.
// parseTescoProduct fills every field with a default, so "carried" is read from the raw paste.
const TESCO_UPDATE_FIELDS = [
  ['mi-name', 'name', d => d.name, r => !!(r.name || r.title)],
  ['mi-brand', 'brand', d => d.brand, r => !!r.brand],
  ['mi-price', 'price', d => d.price, r => r.price !== undefined && r.price !== null && r.price !== ''],
  ['mi-pack', 'pack size', d => d.packSize, r => r.packSize !== undefined && r.packSize !== null && r.packSize !== ''],
  ['mi-pack-unit', 'pack unit', d => d.packUnit, r => !!r.packUnit],
  ['mi-item-weight', 'item weight', d => d.itemWeight, r => !!r.itemWeight],
  ['mi-item-weight-unit', 'item weight unit', d => d.itemWeightUnit || 'g', r => !!(r.itemWeightUnit || r.itemWeight)],
  ['mi-drained-weight', 'drained weight', d => d.drainedWeight, r => !!r.drainedWeight],
  ['mi-storage', 'storage', d => d.storage, r => !!(r.diagnostics?.breadcrumbs || r.diagnostics?.storageText)],
  ...[['cal', 'calories'], ['prot', 'protein'], ['carb', 'carbs'], ['fat', 'fat'], ['fibre', 'fibre']].map(([key, label]) =>
    [`mi-${key}`, label, d => d[key], r => (r.diagnostics ? r.diagnostics.sourceValues?.[key] != null : r[key] !== undefined && r[key] !== null)])
];

// Writes only the fields the paste carried into the open form; nothing is saved until Save (R7-R9).
export function applyTescoUpdate() {
  const input = document.getElementById('mi-tesco-json');
  const errorEl = document.getElementById('mi-tesco-error');
  const result = parseTescoProduct(String(input?.value || '').trim());
  if (!result.success) {
    if (errorEl) errorEl.textContent = result.error;
    return;
  }
  if (errorEl) errorEl.textContent = '';
  const changed = [];
  for (const [id, label, value, carried] of TESCO_UPDATE_FIELDS) {
    const field = document.getElementById(id);
    const next = value(result.data);
    if (!field || !carried(result.data.raw) || next === undefined || next === null || next === '') continue;
    if (String(field.value) !== String(next)) {
      field.value = next;
      changed.push(label);
    }
  }
  if (input) input.value = '';
  const panel = document.getElementById('mi-tesco-paste');
  if (panel) panel.hidden = true;
  const summary = document.getElementById('mi-tesco-updated');
  if (summary) summary.textContent = changed.length ? `Updated: ${changed.join(', ')}` : 'Nothing to update';
}

export async function saveManualIng() {
  const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
  const getNum = (id) => {
    const v = document.getElementById(id)?.value;
    return v !== undefined && v !== '' ? Number(v) : null;
  };

  const name = getVal('mi-name');
  if (!name) return;

  const state = getState();
  const currentProds = Array.isArray(state.products) ? [...state.products] : [];

  let draftSubtypeId = null;
  if (window.__draftSubtypePayload) {
    try {
      const draft = window.__draftSubtypePayload;
      const newSub = await addSubtypeToIngredient(draft.parentId, draft.name, draft.notes);
      if (newSub && newSub.id) {
        draftSubtypeId = newSub.id;
      }
    } catch (e) {
      console.error('[ProductBankView] Error saving draft subtype:', e);
    }
  }

  const binding = window.__prefilledResolveBinding || {};
  const ingredientId = window.__draftSubtypePayload?.parentId || binding.ingredientId || null;
  const subtypeId = draftSubtypeId || binding.subtypeId || null;
  const isAutoDefault = !!ingredientId;

  window.__draftSubtypePayload = null;

  const finalIngId = activeEditingProductId ? (currentProds.find(p => String(p.id) === String(activeEditingProductId))?.ingredientId || null) : ingredientId;
  const parentIng = finalIngId ? (state.ingredients || []).find(i => String(i.id) === String(finalIngId)) : null;
  const inheritedCategory = parentIng?.category || getVal('mi-cat-search') || 'General';

  const updatedProd = {
    ...(activeEditingProductId ? currentProds.find(p => String(p.id) === String(activeEditingProductId)) : {}),
    id: activeEditingProductId || `prod_${Date.now()}`,
    name,
    brand: getVal('mi-brand'),
    category: inheritedCategory,
    storage: getVal('mi-storage') || 'cupboard',
    cal: getNum('mi-cal') || 0,
    fat: getNum('mi-fat') || 0,
    carb: getNum('mi-carb') || 0,
    fibre: getNum('mi-fibre') || 0,
    prot: getNum('mi-prot') || 0,
    price: getNum('mi-price') || 0,
    pack: getNum('mi-pack') || 0,
    packUnit: getVal('mi-pack-unit') || 'g',
    itemWeight: getNum('mi-item-weight'),
    itemWeightUnit: getVal('mi-item-weight-unit') || 'g',
    drainedWeight: getNum('mi-drained-weight'),
    notes: getVal('mi-notes'),
    ingredientId: activeEditingProductId ? (currentProds.find(p => String(p.id) === String(activeEditingProductId))?.ingredientId || null) : ingredientId,
    subtypeId: activeEditingProductId ? (currentProds.find(p => String(p.id) === String(activeEditingProductId))?.subtypeId || null) : subtypeId,
    isAutoDefault: activeEditingProductId ? (currentProds.find(p => String(p.id) === String(activeEditingProductId))?.isAutoDefault || false) : isAutoDefault,
    updatedAt: new Date().toISOString()
  };

  if (window.__pendingHierarchyCommit) {
    const pending = window.__pendingHierarchyCommit;
    window.__pendingHierarchyCommit = null;
    window.__prefilledResolveBinding = null;
    try {
      const res = await commitAtomicChain({
        category: pending.category || inheritedCategory || 'General',
        rootItemName: pending.rootItemName,
        subtypeName: pending.subtypeName || 'Standard',
        productPayload: updatedProd
      });
      cancelManualIng();
      renderProductBank();
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      if (typeof window.__onHierarchyComplete === 'function') {
        const cb = window.__onHierarchyComplete;
        window.__onHierarchyComplete = null;
        cb(res || { ingredientId: res?.rootItem?.id || pending.rootItemName, subtypeId: res?.subtype?.id || pending.subtypeName, subtypeName: pending.subtypeName, parentName: pending.rootItemName, category: pending.category });
      }
      return;
    } catch (e) {
      console.error('[ProductBankView] Atomic commit failed:', e);
    }
  }

  if (window.__prefilledResolveBinding) {
    window.__prefilledResolveBinding = null;
  }

  const existingIdx = currentProds.findIndex(p => String(p.id) === String(updatedProd.id));
  if (existingIdx >= 0) {
    currentProds[existingIdx] = updatedProd;
  } else {
    currentProds.push(updatedProd);
  }

  setProducts(currentProds);
  cancelManualIng();
  renderProductBank();

  try {
    await saveProduct(updatedProd);
  } catch (e) {
    console.warn('[ProductBankView] Cloud sync fallback for product:', e);
  }
}

export async function promptReallocateProduct(productId) {
  const openModal = typeof openReallocateModal === 'function' ? openReallocateModal : window.promptReallocateProduct;
  if (typeof openModal === 'function') openModal(productId);
}

export const openProductReallocateModal = promptReallocateProduct;

// Refuses while a recipe still points at the product. A default is recalculated from the preference
// metric when its product goes, so it never blocks a delete (R14).
export async function handleDeleteProduct(productId, prodName = null) {
  const state = getState();
  const product = (state.products || []).find(p => String(p.id) === String(productId));
  const name = prodName || product?.name || 'this product';
  const recipeCount = (state.recipes || []).filter(r => [...(r.ingredients || []), ...(r.enhanced?.ingredients || [])]
    .some(line => line && line.productId != null && String(line.productId) === String(productId))).length;
  if (recipeCount) {
    showCustomAlert(`"${name}" is used in ${recipeCount} recipe${recipeCount === 1 ? '' : 's'}. Swap it out first.`, 'Cannot delete yet');
    return;
  }

  showCustomConfirm(`Delete "${name}"? This can't be undone.`, 'Delete product', async () => {
    const result = await deleteProduct(productId);
    if (!result?.success) {
      showCustomAlert(`"${name}" was not deleted. Check your connection and try again.`, 'Delete failed');
      return;
    }
    setProducts((getState().products || []).filter(p => String(p.id) !== String(productId)));
    await clearDefaultsPointingAt(productId);
    renderProductBank();
  });
}

// A saved default naming a deleted product is cleared, so every reader falls back to the metric (R13).
async function clearDefaultsPointingAt(productId) {
  const isIt = v => v != null && String(v) === String(productId);
  const changed = [];
  const ingredients = (getState().ingredients || []).map(item => {
    const subtypes = (item.subtypes || []).map(st => (isIt(st.defaultProductId) ? { ...st, defaultProductId: null } : st));
    const touched = isIt(item.defaultProductId) || subtypes.some((st, n) => st !== item.subtypes[n]);
    if (!touched) return item;
    const next = { ...item, subtypes, ...(isIt(item.defaultProductId) ? { defaultProductId: null } : {}) };
    changed.push(next);
    return next;
  });
  if (!changed.length) return;
  setIngredients(ingredients);
  await Promise.all(changed.map(item => saveRootItem(item)));
}

export async function handleMakeAutoDefault(productId, ingredientId) {
  if (!ingredientId) {
    if (typeof showCustomAlert === 'function') {
      showCustomAlert('Please reallocate this product to an ingredient before setting as auto-default.');
    }
    return;
  }

  await setAutoDefaultProduct(productId, ingredientId);
  renderProductBank();
}

function calculateProteinEfficiency(prod) {
  const price = Number(prod.price) || 0;
  const pack = Number(prod.pack) || 0;
  const protPer100 = Number(prod.prot) || 0;
  if (price <= 0 || pack <= 0 || protPer100 <= 0) return null;

  const totalProteinGrams = (pack / 100) * protPer100;
  const protPerPound = totalProteinGrams / price;
  return `${protPerPound.toFixed(1)}g P/£`;
}

export function renderProductBank() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('bank-groups-panel');
  if (!container) return;

  const state = getState();
  const allProducts = Array.isArray(state.products) ? state.products : [];
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];

  let searchInput = document.getElementById('product-bank-search');
  const query = (searchInput?.value || '').trim().toLowerCase();

  let products = allProducts;
  if (query.length > 0) {
    products = allProducts.filter(p => {
      const pName = (p.name || '').toLowerCase();
      const pBrand = (p.brand || '').toLowerCase();
      const pCat = (p.category || p.cat || '').toLowerCase();
      return pName.includes(query) || pBrand.includes(query) || pCat.includes(query);
    });
  }

  let cardsWrap = document.getElementById('product-bank-cards-wrap');
  if (!cardsWrap || !searchInput) {
    container.innerHTML = renderProductBankBase(query);
    cardsWrap = document.getElementById('product-bank-cards-wrap');
    searchInput = document.getElementById('product-bank-search');
    if (searchInput) searchInput.oninput = () => renderProductBank();
  }

  if (allProducts.length === 0) {
    cardsWrap.innerHTML = renderEmptyProductBank();
    return;
  }

  if (products.length === 0) {
    cardsWrap.innerHTML = renderNoMatchingProducts(query);
    return;
  }

  const groups = {};
  products.forEach(p => {
    const cat = p.category || p.cat || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  });

  cardsWrap.innerHTML = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => {
    const cardsHtml = items.map(p => {
      const efficiency = calculateProteinEfficiency(p);
      const mappedIng = ingredients.find(i => String(i.id) === String(p.ingredientId) || String(i.id) === String(p.groupId));
      const tescoSearchUrl = p.tescoUrl || `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(p.name)}`;
      return renderProductCard({ p, mappedIng, efficiency, tescoSearchUrl });
    }).join('');
    return renderCategoryGroup(cat, items.length, cardsHtml);
  }).join('');

  container.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, productId: pid, ingredientId: ingId } = btn.dataset;
    if (action === 'edit-product') openProductEditModal(pid);
    else if (action === 'reallocate-product') promptReallocateProduct(pid);
    else if (action === 'make-auto-default') handleMakeAutoDefault(pid, ingId);
    else if (action === 'delete-product') handleDeleteProduct(pid);
  };
}

export function clearProductGroupFilter() {
  const searchInput = document.getElementById('product-bank-search');
  if (searchInput) searchInput.value = '';
  renderProductBank();
}

// Imported directly: window.openTescoImportModal only exists once a Pantry dialog has loaded the module.
export async function showTescoImport() {
  const { openTescoImportModal } = await import('../components/pantry/SubtypeProductLinkerModalUI.js');
  openTescoImportModal(null, null);
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    renderProductBank, renderBank: renderProductBank,
    clearProductGroupFilter, openProductEditModal,
    showAddIng: () => openProductEditModal(null),
    showTescoImport, saveManualIng, cancelManualIng,
    promptReallocateProduct, handleDeleteProduct, handleMakeAutoDefault
  });
}
