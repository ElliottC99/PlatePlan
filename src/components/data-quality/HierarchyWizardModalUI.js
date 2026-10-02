/**
 * src/components/data-quality/HierarchyWizardModalUI.js (v3.19.52)
 * Core Hierarchy Alignment Wizard with Auto Sub-Type Provisioning.
 * Step-by-step queue & single-batch bulk provisioning for orphan items.
 */

import { getState, setIngredients } from '../../store/store.js';
import { saveIngredient, saveProduct } from '../../services/HouseholdRepository.js';
import { safeGetProducts, commitProductUpdates } from './ResolveUnlinkedModalUI.js';
import { parseTescoProduct } from '../../services/TescoImportService.js';

let wizardQueue = [];
let currentIndex = 0;

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

export function closeHierarchyWizardModal() {
  const overlay = document.getElementById('hierarchy-wizard-modal-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
  wizardQueue = [];
  currentIndex = 0;
  if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
}

export function buildWizardQueue() {
  const state = (window.Store && typeof window.Store.getState === 'function') ? window.Store.getState() : (getState() || {});
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
  const products = safeGetProducts();
  const queue = [];

  ingredients.forEach(ing => {
    const ingProds = products.filter(p => String(p.ingredientId) === String(ing.id));
    const subtypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];
    if (ingProds.length === 0) {
      queue.push({ id: ing.id, name: ing.name, category: ing.category || 'General', entityType: 'ingredient', subtypesCount: subtypes.length });
    }
    subtypes.forEach(st => {
      if (!products.some(p => String(p.subtypeId) === String(st.id))) {
        queue.push({ id: st.id, name: st.name, category: ing.category || 'General', entityType: 'subtype', parentId: ing.id, parentName: ing.name });
      }
    });
  });
  return queue;
}

export async function ensureDefaultSubtype(ingredientId) {
  const state = (window.Store && typeof window.Store.getState === 'function') ? window.Store.getState() : (getState() || {});
  const ingredients = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  const idx = ingredients.findIndex(i => String(i.id) === String(ingredientId));
  if (idx === -1) return null;

  const ing = { ...ingredients[idx] };
  if (!Array.isArray(ing.subtypes)) ing.subtypes = [];
  if (ing.subtypes.length === 0) {
    const newSub = { id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, name: ing.name, isDefault: true, parentId: ing.id, aliases: [], createdAt: new Date().toISOString() };
    ing.subtypes = [newSub];
    ing.updatedAt = new Date().toISOString();
    ingredients[idx] = ing;
    if (typeof setIngredients === 'function') setIngredients(ingredients);
    if (window.Store?.setState) window.Store.setState({ ingredients });
    if (window.state) window.state.ingredients = ingredients;
    try { await saveIngredient(ing); } catch (e) {}
    document.dispatchEvent(new CustomEvent('plateplan:state:ingredients', { detail: ingredients }));
    return newSub;
  }
  return ing.subtypes[0];
}

async function resolveContext() {
  const currentItem = wizardQueue[currentIndex];
  if (!currentItem) return null;
  let parentId = currentItem.entityType === 'subtype' ? currentItem.parentId : currentItem.id;
  let subtypeId = currentItem.entityType === 'subtype' ? currentItem.id : null;
  if (currentItem.entityType === 'ingredient' && currentItem.subtypesCount === 0) {
    const sub = await ensureDefaultSubtype(currentItem.id);
    if (sub) subtypeId = sub.id;
  }
  return { currentItem, parentId, subtypeId };
}

export async function resolveStepWithExistingProduct(productId) {
  const ctx = await resolveContext();
  if (!ctx) return;
  const existingProds = safeGetProducts();
  const prodIndex = existingProds.findIndex(p => String(p.id) === String(productId));
  if (prodIndex >= 0) {
    const updatedProd = { ...existingProds[prodIndex], ingredientId: ctx.parentId, subtypeId: ctx.subtypeId, isAutoDefault: true, updatedAt: new Date().toISOString() };
    const updated = [...existingProds];
    updated[prodIndex] = updatedProd;
    commitProductUpdates(updated);
    try { await saveProduct(updatedProd); } catch (e) {}
  }
  advanceWizard();
}

export async function resolveStepWithShellProduct() {
  const ctx = await resolveContext();
  if (!ctx) return;
  const shell = {
    id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: ctx.currentItem.name, brand: 'Standard', category: ctx.currentItem.category || 'General', storage: 'cupboard',
    cal: 100, prot: 5, carb: 10, fat: 2, fibre: 0, price: 1.00, pack: 100, packUnit: 'g',
    ingredientId: ctx.parentId, subtypeId: ctx.subtypeId, isAutoDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  const prods = [...safeGetProducts(), shell];
  commitProductUpdates(prods);
  try { await saveProduct(shell); } catch (e) {}
  advanceWizard();
}

export async function resolveStepWithTescoImport() {
  const txtArea = document.getElementById('wizard-tesco-json');
  const errDiv = document.getElementById('wizard-tesco-error');
  if (!txtArea || !errDiv) return;
  errDiv.style.display = 'none';
  const val = txtArea.value.trim();
  if (!val) { errDiv.textContent = 'Please paste Tesco bookmarklet JSON.'; errDiv.style.display = 'block'; return; }
  const res = parseTescoProduct(val);
  if (!res.success) { errDiv.textContent = res.error || 'Parsing error.'; errDiv.style.display = 'block'; return; }

  const ctx = await resolveContext();
  if (!ctx) return;
  const pData = res.data;
  const newProd = {
    id: `prod_${Date.now()}`, name: pData.name, brand: pData.brand || 'Tesco', category: ctx.currentItem.category || pData.cat || 'General',
    storage: pData.storage || 'cupboard', cal: pData.cal || 0, prot: pData.prot || 0, carb: pData.carb || 0, fat: pData.fat || 0, fibre: pData.fibre || 0,
    price: pData.price || 0, pack: pData.packSize || 0, packUnit: pData.packUnit || 'g', ingredientId: ctx.parentId, subtypeId: ctx.subtypeId, isAutoDefault: true, updatedAt: new Date().toISOString()
  };
  commitProductUpdates([...safeGetProducts(), newProd]);
  try { await saveProduct(newProd); } catch (e) {}
  advanceWizard();
}

export function skipWizardStep() {
  if (currentIndex < wizardQueue.length - 1) {
    wizardQueue.push(wizardQueue.splice(currentIndex, 1)[0]);
    renderWizardStep();
  } else advanceWizard();
}

export async function bulkProvisionAllDefaults() {
  const btn = document.getElementById('wizard-bulk-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Bulk Provisioning...'; }

  const state = (window.Store && typeof window.Store.getState === 'function') ? window.Store.getState() : (getState() || {});
  const ingredients = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  let products = safeGetProducts();
  const createdProducts = [], modifiedIngredients = [];

  for (let i = 0; i < ingredients.length; i++) {
    const ing = { ...ingredients[i] };
    let ingChanged = false;
    if (!Array.isArray(ing.subtypes) || ing.subtypes.length === 0) {
      ing.subtypes = [{ id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, name: ing.name, isDefault: true, parentId: ing.id, aliases: [], createdAt: new Date().toISOString() }];
      ing.updatedAt = new Date().toISOString();
      ingChanged = true;
    }
    if (!products.some(p => String(p.ingredientId) === String(ing.id))) {
      const shell = { id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, name: ing.name, brand: 'Standard', category: ing.category || 'General', storage: 'cupboard', cal: 100, prot: 5, carb: 10, fat: 2, price: 1.00, pack: 100, packUnit: 'g', ingredientId: ing.id, subtypeId: ing.subtypes[0]?.id || null, isAutoDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      products.push(shell);
      createdProducts.push(shell);
    }
    if (ingChanged) { ingredients[i] = ing; modifiedIngredients.push(ing); }
  }

  if (typeof setIngredients === 'function') setIngredients(ingredients);
  if (window.Store?.setState) window.Store.setState({ ingredients });
  commitProductUpdates(products);

  for (const ing of modifiedIngredients) { try { await saveIngredient(ing); } catch (e) {} }
  for (const prod of createdProducts) { try { await saveProduct(prod); } catch (e) {} }

  wizardQueue = [];
  renderWizardComplete();
}

function advanceWizard() {
  currentIndex++;
  if (currentIndex >= wizardQueue.length) renderWizardComplete();
  else renderWizardStep();
}

export function renderWizardStep() {
  const content = document.getElementById('hierarchy-wizard-modal-content');
  if (!content) return;
  if (wizardQueue.length === 0 || currentIndex >= wizardQueue.length) { renderWizardComplete(); return; }

  const item = wizardQueue[currentIndex];
  const total = wizardQueue.length, stepNum = currentIndex + 1;
  const pct = Math.round((stepNum / total) * 100);
  const unlinkedProds = safeGetProducts().filter(p => !p.ingredientId && !p.subtypeId);

  content.innerHTML = `
    <div style="padding:20px;max-width:540px;width:100%;margin:0 auto;background:var(--system-grouped-bg,#f2f2f7);border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,0.25);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div><h3 style="margin:0;font-size:17px;font-weight:750">🪄 Hierarchy Alignment Wizard</h3><div style="font-size:12px;color:var(--text2);margin-top:2px">Step ${stepNum} of ${total}</div></div>
        <button type="button" class="btn sm ghost" onclick="closeHierarchyWizardModal()">&times;</button>
      </div>
      <div style="width:100%;background:#e5e7eb;height:6px;border-radius:3px;overflow:hidden;margin-bottom:14px"><div style="width:${pct}%;background:var(--primary,#4f46e5);height:100%;transition:width 0.2s"></div></div>
      <div style="background:#fff;border-radius:12px;padding:14px;border:1px solid var(--border,#e7e5e4);margin-bottom:14px">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;font-weight:700">Unlinked ${item.entityType === 'subtype' ? 'Sub-type' : 'Core Ingredient'}</div>
        <div style="font-size:16px;font-weight:750;color:var(--text);margin-top:2px">${escapeHtml(item.name)}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">Category: <strong>${escapeHtml(item.category)}</strong>${item.parentName ? ` · Parent: <strong>${escapeHtml(item.parentName)}</strong>` : ''}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
        <div style="background:#fff;border-radius:10px;padding:12px;border:1px solid var(--border,#e7e5e4)">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px">🔗 1. Link Unallocated Product</div>
          ${unlinkedProds.length ? `
            <select id="wizard-link-select" style="width:100%;min-height:38px;padding:6px;border:1px solid var(--border);border-radius:6px;font-size:12.5px" onchange="resolveStepWithExistingProduct(this.value)">
              <option value="">-- Choose unlinked product (${unlinkedProds.length} available) --</option>
              ${unlinkedProds.map(p => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)} (£${Number(p.price||0).toFixed(2)})</option>`).join('')}
            </select>
          ` : `<div style="font-size:12px;color:var(--text3);font-style:italic">No unallocated products in Product Bank.</div>`}
        </div>
        <div style="background:#fff;border-radius:10px;padding:12px;border:1px solid var(--border,#e7e5e4);display:flex;align-items:center;justify-content:space-between">
          <div><div style="font-size:13px;font-weight:700">✨ 2. Auto-Generate Product Shell</div><div style="font-size:11.5px;color:var(--text2)">Creates a default baseline product with standard macros.</div></div>
          <button type="button" class="btn sm primary" onclick="resolveStepWithShellProduct()">Generate</button>
        </div>
        <div style="background:#fff;border-radius:10px;padding:12px;border:1px solid var(--border,#e7e5e4)">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px">🛒 3. Tesco Bookmarklet Import</div>
          <textarea id="wizard-tesco-json" placeholder='Paste JSON from bookmarklet...' style="width:100%;height:45px;font-family:monospace;font-size:11px;padding:6px;border:1px solid var(--border);border-radius:6px;box-sizing:border-box"></textarea>
          <div id="wizard-tesco-error" style="display:none;color:var(--red);font-size:11px;margin-top:4px"></div>
          <button type="button" class="btn sm ghost" style="width:100%;margin-top:6px" onclick="resolveStepWithTescoImport()">Parse &amp; Link Product</button>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border,#e7e5e4);padding-top:12px">
        <button type="button" class="btn sm" id="wizard-bulk-btn" style="background:rgba(16,185,129,0.1);color:var(--green,#10b981);font-weight:700" onclick="bulkProvisionAllDefaults()">⚡ Bulk Provision All Defaults</button>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn sm ghost" onclick="skipWizardStep()">Skip &rarr;</button>
          <button type="button" class="btn sm" onclick="closeHierarchyWizardModal()">Exit</button>
        </div>
      </div>
    </div>
  `;
}

function renderWizardComplete() {
  const content = document.getElementById('hierarchy-wizard-modal-content');
  if (!content) return;
  content.innerHTML = `
    <div style="padding:24px;max-width:440px;width:100%;margin:0 auto;background:#fff;border-radius:16px;text-align:center;box-shadow:0 16px 40px rgba(0,0,0,0.25)">
      <div style="font-size:42px;margin-bottom:12px">🎉</div>
      <h3 style="font-size:18px;font-weight:750;margin:0 0 8px 0">All Items Aligned!</h3>
      <p style="font-size:13px;color:var(--text2);margin:0 0 20px 0;line-height:1.5">All core ingredients and sub-types are now provisioned with mapped grocery products.</p>
      <button type="button" class="btn primary" style="min-height:44px;padding:0 24px;font-weight:700" onclick="closeHierarchyWizardModal()">Done</button>
    </div>
  `;
}

export function openHierarchyWizardModal() {
  wizardQueue = buildWizardQueue();
  currentIndex = 0;
  const existing = document.getElementById('hierarchy-wizard-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'hierarchy-wizard-modal-overlay';
  overlay.className = 'modal active';
  Object.assign(overlay.style, {
    position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
    width: '100vw', height: '100vh', zIndex: '999999',
    background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(8px)', webkitBackdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box'
  });

  const contentWrap = document.createElement('div');
  contentWrap.id = 'hierarchy-wizard-modal-content';
  contentWrap.style.width = '100%';
  overlay.appendChild(contentWrap);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);

  renderWizardStep();
}

if (typeof window !== 'undefined') {
  window.openHierarchyWizardModal = openHierarchyWizardModal;
  window.closeHierarchyWizardModal = closeHierarchyWizardModal;
  window.resolveStepWithExistingProduct = resolveStepWithExistingProduct;
  window.resolveStepWithShellProduct = resolveStepWithShellProduct;
  window.resolveStepWithTescoImport = resolveStepWithTescoImport;
  window.skipWizardStep = skipWizardStep;
  window.bulkProvisionAllDefaults = bulkProvisionAllDefaults;
}
