/**
 * src/components/pantry/AddItemWizardUI.js
 * Universal Guided Hierarchy Creation Wizard:
 * Supports starting at: Category, Root Item, Sub-Type, or Product.
 * Subtype-only filtering for Product step with full hierarchy links.
 * Full Product Form integration for Manual and Tesco review pathways.
 * Strictly under 380 lines.
 */

import { getState } from '../../store/store.js';
import { getUnifiedCategories } from '../../services/CategoryRepository.js';
import { createTaxonomySearchInput } from './RecipeSearchDropdownHelper.js';
import { commitAtomicChain } from '../../services/PantryTaxonomyService.js';
import { openTescoImportModal } from './SubtypeProductLinkerModalUI.js';
import { attachDuplicateDetector } from './WizardDuplicateHelper.js';
import { showCustomAlert } from '../ui/DialogHelpers.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const breadcrumbs = (cat, item, sub) => `
  <div class="lineage-breadcrumbs" style="display:inline-flex; align-items:center; gap:6px; padding:5px 8px; background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:8px; font-size:11.5px; font-weight:650; color:var(--text2,#64748b); margin-bottom:12px;">
    <span>📂 ${escapeHtml(cat || 'General')}</span>
    ${item ? `<span style="opacity:0.5;">›</span><span style="color:var(--text,#1c1917); font-weight:750;">📦 ${escapeHtml(item)}</span>` : ''}
    ${sub ? `<span style="opacity:0.5;">›</span><span style="color:var(--text,#1c1917); font-weight:750;">🏷️ ${escapeHtml(sub)}</span>` : ''}
  </div>
`;

let activeDropdownInstance = null;

function showModal(html) {
  const wrap = document.getElementById('view-modal-wrap'), content = document.getElementById('view-modal-content');
  if (wrap && content) {
    wrap.style.setProperty('z-index', '25005', 'important');
    content.style.setProperty('z-index', '25005', 'important');
    content.innerHTML = html;
    wrap.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

export function closeAddItemWizard() {
  if (activeDropdownInstance?.destroy) { activeDropdownInstance.destroy(); activeDropdownInstance = null; }
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) { wrap.classList.remove('open'); document.body.style.overflow = ''; }
}

export function openAddItemWizard(options = {}) {
  let startAt = options.startAt || 'item';
  let step = 1;
  const onComplete = options.onComplete || null;
  if (onComplete) window.__onHierarchyComplete = onComplete;

  let wizardData = {
    startAt,
    category: options.category || '',
    itemName: options.itemName || '',
    selectedParentItem: options.parentId ? (getState().ingredients || []).find(i => String(i.id) === String(options.parentId)) : null,
    subtypeName: options.subtypeName || 'Standard',
    subtypeId: null,
    productMode: 'manual',
    selectedExistingProduct: null
  };

  if (wizardData.selectedParentItem) {
    wizardData.itemName = wizardData.selectedParentItem.name || '';
    wizardData.category = wizardData.selectedParentItem.category || 'General';
  }

  const proceedToProduct = async (mode) => {
    closeAddItemWizard();
    // Atomic all-or-nothing guard: stage hierarchy until product is actually saved
    window.__pendingHierarchyCommit = {
      category: wizardData.category || 'General',
      rootItemName: wizardData.itemName,
      subtypeName: wizardData.subtypeName || 'Standard'
    };

    if (mode === 'tesco') {
      openTescoImportModal(wizardData.subtypeId || null, wizardData.selectedParentItem?.id || null);
    } else {
      window.__prefilledResolveBinding = {
        ingredientId: wizardData.selectedParentItem?.id || null,
        subtypeId: wizardData.subtypeId || null,
        parentCategory: wizardData.category || 'General',
        subtypeDraftName: wizardData.subtypeName || wizardData.itemName
      };
      const { openProductEditModal } = await import('../../views/ProductBankView.js');
      openProductEditModal(null);
    }
  };

  const renderStep = () => {
    if (activeDropdownInstance?.destroy) { activeDropdownInstance.destroy(); activeDropdownInstance = null; }

    const state = getState();
    const categories = getUnifiedCategories(state) || [];
    const rootItems = state.rootItems || state.ingredients || [];
    const products = Array.isArray(state.products) ? state.products : [];

    const isCat = startAt === 'category';
    const isSub = startAt === 'subtype';
    const isProd = startAt === 'product';
    const isFinalStep = (isCat && step === 4) || (!isCat && !isProd && step === 3) || (isProd && step === 2);

    let stepBodyHtml = '';

    if (isCat && step === 1) {
      stepBodyHtml = `
        <div style="font-size:12px; color:var(--text2,#78716c); margin-bottom:12px;">Step 1 of 4: Define Category</div>
        <div style="margin-bottom:18px;">
          <label style="display:block; font-size:12.5px; font-weight:750; margin-bottom:6px;">Category Name</label>
          <input type="text" id="wiz-cat-name-input" value="${escapeHtml(wizardData.category)}" placeholder="e.g. World Foods, Chilled, Breakfast..." style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12.5px;" />
          <div id="wiz-cat-dup-box" style="margin-top:6px;"></div>
        </div>
      `;
    } else if ((isCat && step === 2) || (!isCat && !isSub && !isProd && step === 1)) {
      const stepLabel = isCat ? 'Step 2 of 4: Add Root Item' : 'Step 1 of 3: Define Root Item & Category';
      stepBodyHtml = `
        <div style="font-size:12px; color:var(--text2,#78716c); margin-bottom:12px;">${stepLabel}</div>
        <div style="margin-bottom:18px; display:flex; flex-direction:column; gap:12px;">
          <div>
            <label style="display:block; font-size:12.5px; font-weight:750; margin-bottom:6px;">Root Item Name</label>
            <input type="text" id="wiz-item-name" value="${escapeHtml(wizardData.itemName)}" placeholder="e.g. Basmati Rice, Cheddar Cheese..." style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12.5px;" />
            <div id="wiz-item-dup-box" style="margin-top:6px;"></div>
          </div>
          ${!isCat ? `
            <div>
              <label style="display:block; font-size:12.5px; font-weight:750; margin-bottom:6px;">Category</label>
              <div id="wiz-cat-container"></div>
            </div>
          ` : breadcrumbs(wizardData.category)}
        </div>
      `;
    } else if (isSub && step === 1) {
      stepBodyHtml = `
        <div style="font-size:12px; color:var(--text2,#78716c); margin-bottom:12px;">Step 1 of 3: Select Parent Root Item</div>
        <div style="margin-bottom:18px;">
          <label style="display:block; font-size:12.5px; font-weight:750; margin-bottom:6px;">Parent Root Item</label>
          <div id="wiz-parent-item-container"></div>
          <div style="display:flex; gap:6px; margin-top:8px; font-size:11.5px; color:var(--text2,#78716c); align-items:center;">
            <span>Need a higher level?</span>
            <button type="button" class="btn xs ghost" id="btn-wiz-jump-item" style="font-weight:600;">+ New Root Item</button>
            <button type="button" class="btn xs ghost" id="btn-wiz-jump-cat" style="font-weight:600;">+ New Category</button>
          </div>
        </div>
      `;
    } else if (isProd && step === 1) {
      stepBodyHtml = `
        <div style="font-size:12px; color:var(--text2,#78716c); margin-bottom:12px;">Step 1 of 2: Select Target Sub-Type</div>
        <div style="margin-bottom:18px;">
          <label style="display:block; font-size:12.5px; font-weight:750; margin-bottom:6px;">Target Sub-type</label>
          <div id="wiz-target-subtype-container"></div>
          <div style="display:flex; gap:6px; margin-top:10px; font-size:11.5px; color:var(--text2,#78716c); align-items:center; flex-wrap:wrap;">
            <span>Need to add higher level?</span>
            <button type="button" class="btn xs ghost" id="btn-wiz-jump-sub" style="font-weight:600;">+ New Sub-Type</button>
            <button type="button" class="btn xs ghost" id="btn-wiz-jump-item" style="font-weight:600;">+ New Root Item</button>
            <button type="button" class="btn xs ghost" id="btn-wiz-jump-cat" style="font-weight:600;">+ New Category</button>
          </div>
        </div>
      `;
    } else if ((isCat && step === 3) || (!isCat && !isProd && step === 2)) {
      const stepLabel = isCat ? 'Step 3 of 4: Define Sub-type' : 'Step 2 of 3: Define Sub-type';
      stepBodyHtml = `
        <div style="font-size:12px; color:var(--text2,#78716c); margin-bottom:12px;">${stepLabel}</div>
        ${breadcrumbs(wizardData.category, wizardData.itemName)}
        <div style="margin-bottom:18px;">
          <label style="display:block; font-size:12.5px; font-weight:750; margin-bottom:4px;">Sub-type Name</label>
          <input type="text" id="wiz-subtype-name" value="${escapeHtml(wizardData.subtypeName)}" placeholder="e.g. Standard, Mature, Extra Virgin, Organic..." style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12.5px;" />
          <div id="wiz-subtype-dup-box" style="margin-top:6px;"></div>
        </div>
      `;
    } else {
      stepBodyHtml = `
        <div style="font-size:12px; color:var(--text2,#78716c); margin-bottom:12px;">Final Step: Store Product Association</div>
        ${breadcrumbs(wizardData.category, wizardData.itemName, wizardData.subtypeName)}

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:14px;">
          <button type="button" class="btn sm ${wizardData.productMode === 'manual' ? 'primary' : 'ghost'} btn-prod-path" data-path="manual" style="font-size:11px; font-weight:650; padding:6px 4px;">1. Add Manually</button>
          <button type="button" class="btn sm ${wizardData.productMode === 'existing' ? 'primary' : 'ghost'} btn-prod-path" data-path="existing" style="font-size:11px; font-weight:650; padding:6px 4px;">2. Link Existing</button>
          <button type="button" class="btn sm ${wizardData.productMode === 'tesco' ? 'primary' : 'ghost'} btn-prod-path" data-path="tesco" style="font-size:11px; font-weight:650; padding:6px 4px; color:var(--primary,#4f46e5);">3. Import Tesco</button>
        </div>

        ${wizardData.productMode === 'manual' ? `
          <div style="padding:16px; background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:10px; text-align:center;">
            <div style="font-weight:750; font-size:13px; margin-bottom:4px; color:var(--text,#1c1917);">Complete Product Details Form</div>
            <div style="font-size:12px; color:var(--text2,#64748b); margin-bottom:12px;">Specify full product details: macros, nutrients, pack sizes, storage, and price in the dedicated product form.</div>
            <button type="button" class="btn primary sm" id="btn-launch-full-prod">Open Full Product Form ➔</button>
          </div>
        ` : wizardData.productMode === 'tesco' ? `
          <div style="padding:16px; background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:10px; text-align:center;">
            <div style="font-weight:750; font-size:13px; margin-bottom:4px; color:var(--text,#1c1917);">Import from Tesco Bookmarklet</div>
            <div style="font-size:12px; color:var(--text2,#64748b); margin-bottom:12px;">Paste Tesco bookmarklet JSON and review all fields in the full product editor before saving.</div>
            <button type="button" class="btn primary sm" id="btn-launch-tesco-prod">Open Tesco Importer ➔</button>
          </div>
        ` : `
          <div>
            <label style="display:block; font-size:12px; font-weight:750; margin-bottom:4px;">Search Existing Product to Link</label>
            <div id="wiz-existing-prod-container"></div>
          </div>
        `}
      `;
    }

    const navHtml = `
      <div style="display:flex; justify-content:space-between; margin-top:20px; border-top:1px solid var(--border,#e7e5e4); padding-top:16px;">
        ${step === 1 ? `<button type="button" class="btn sm" id="btn-wiz-cancel">Cancel</button>` : `<button type="button" class="btn sm" id="btn-wiz-back">‹ Back</button>`}
        ${isFinalStep ? (wizardData.productMode === 'existing' ? `<button type="button" class="btn primary sm" id="btn-wiz-finish">Finish &amp; Link to Bank</button>` : `<div></div>`) : `<button type="button" class="btn primary sm" id="btn-wiz-next">Next ➔</button>`}
      </div>
    `;

    const modalHtml = `
      <div class="add-to-bank-hub-modal" style="padding: 24px; max-width: 520px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.1);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
          <h3 style="margin:0; font-size:1.15rem; font-weight:750; color:var(--text,#1c1917);">
            ${isCat ? '📂 Add Category' : (isSub ? '🏷️ Add Sub-Type' : (isProd ? '🛒 Add Product' : '📦 Add Root Item'))}
          </h3>
          <button type="button" class="btn xs ghost" id="btn-wiz-close" style="font-weight:700;">✕</button>
        </div>
        ${stepBodyHtml}
        ${navHtml}
      </div>
    `;

    showModal(modalHtml);

    document.getElementById('btn-wiz-close')?.addEventListener('click', closeAddItemWizard);
    document.getElementById('btn-wiz-cancel')?.addEventListener('click', closeAddItemWizard);
    document.getElementById('btn-wiz-jump-sub')?.addEventListener('click', () => { startAt = 'subtype'; step = 1; renderStep(); });
    document.getElementById('btn-wiz-jump-item')?.addEventListener('click', () => { startAt = 'item'; step = 1; renderStep(); });
    document.getElementById('btn-wiz-jump-cat')?.addEventListener('click', () => { startAt = 'category'; step = 1; renderStep(); });
    document.getElementById('btn-launch-full-prod')?.addEventListener('click', () => proceedToProduct('manual'));
    document.getElementById('btn-launch-tesco-prod')?.addEventListener('click', () => proceedToProduct('tesco'));

    attachDuplicateDetector({
      inputEl: document.getElementById('wiz-cat-name-input'), containerEl: document.getElementById('wiz-cat-dup-box'), items: categories, icon: '📂', onSelect: (cat) => { wizardData.category = cat; }
    });
    attachDuplicateDetector({
      inputEl: document.getElementById('wiz-item-name'), containerEl: document.getElementById('wiz-item-dup-box'), items: rootItems, icon: '📦', onSelect: (item) => { wizardData.itemName = item.name; if (item.category) wizardData.category = item.category; }
    });
    const activeItemSubtypes = wizardData.selectedParentItem ? (wizardData.selectedParentItem.subtypes || []) : [];
    attachDuplicateDetector({
      inputEl: document.getElementById('wiz-subtype-name'), containerEl: document.getElementById('wiz-subtype-dup-box'), items: activeItemSubtypes, icon: '🏷️', onSelect: (sub) => { wizardData.subtypeName = sub.name; }
    });

    const catContainer = document.getElementById('wiz-cat-container');
    if (catContainer) {
      activeDropdownInstance = createTaxonomySearchInput({
        container: catContainer, categories, rootItems: [], placeholder: 'Search or type category...', initialValue: wizardData.category,
        onSelect: ({ label, val }) => {
          let cat = label.replace(/^[📂📦🏷️✨\s\[Category\]]+/, '').trim();
          if (val && val.startsWith('cat:')) cat = val.replace('cat:', '');
          wizardData.category = cat;
        }
      });
    }

    const parentItemContainer = document.getElementById('wiz-parent-item-container');
    if (parentItemContainer) {
      const initVal = wizardData.selectedParentItem ? `📦 ${wizardData.selectedParentItem.name}` : '';
      activeDropdownInstance = createTaxonomySearchInput({
        container: parentItemContainer, categories: [], rootItems, placeholder: 'Search existing root item...', initialValue: initVal,
        onSelect: ({ val }) => {
          const found = rootItems.find(r => String(r.id) === String(val));
          if (found) { wizardData.selectedParentItem = found; wizardData.itemName = found.name; wizardData.category = found.category || 'General'; }
        }
      });
    }

    const targetSubtypeContainer = document.getElementById('wiz-target-subtype-container');
    if (targetSubtypeContainer) {
      activeDropdownInstance = createTaxonomySearchInput({
        container: targetSubtypeContainer,
        categories: [],
        rootItems,
        subtypesOnly: true,
        placeholder: 'Search target sub-type...',
        onNewClick: (typedSub) => {
          startAt = 'subtype';
          step = 1;
          wizardData.subtypeName = typedSub || 'Standard';
          renderStep();
        },
        onSelect: ({ val }) => {
          if (val && val.includes(':')) {
            const [pId, sId] = val.split(':');
            const parent = rootItems.find(r => String(r.id) === String(pId));
            if (parent) {
              wizardData.selectedParentItem = parent; wizardData.itemName = parent.name; wizardData.category = parent.category || 'General';
              const sub = (parent.subtypes || []).find(s => String(s.id) === String(sId) || s.name === sId);
              if (sub) { wizardData.subtypeName = sub.name; wizardData.subtypeId = sub.id || null; }
            }
          }
        }
      });
    }

    document.getElementById('btn-wiz-back')?.addEventListener('click', () => { step = Math.max(1, step - 1); renderStep(); });

    document.getElementById('btn-wiz-next')?.addEventListener('click', () => {
      if (isCat && step === 1) {
        const catVal = document.getElementById('wiz-cat-name-input')?.value.trim();
        if (!catVal) return showCustomAlert('Please enter a category name.', 'Missing Category');
        wizardData.category = catVal;
      } else if ((isCat && step === 2) || (!isCat && !isSub && !isProd && step === 1)) {
        const nameVal = document.getElementById('wiz-item-name')?.value.trim();
        const catVal = wizardData.category || (document.querySelector('#wiz-cat-container .wiz-ing-tax-search')?.value || '').trim();
        if (!nameVal) return showCustomAlert('Please enter an item name.', 'Missing Name');
        if (!catVal) return showCustomAlert('Please select or type a category.', 'Missing Category');
        wizardData.itemName = nameVal; wizardData.category = catVal;
      } else if (isSub && step === 1) {
        if (!wizardData.selectedParentItem) return showCustomAlert('Please select a parent root item.', 'Missing Selection');
      } else if (isProd && step === 1) {
        if (!wizardData.selectedParentItem || !wizardData.subtypeName) return showCustomAlert('Please select a target sub-type.', 'Missing Selection');
      }

      const subInput = document.getElementById('wiz-subtype-name');
      if (subInput) {
        const subVal = subInput.value.trim();
        if (!subVal) return showCustomAlert('Please enter a sub-type variant name (or "Standard").', 'Missing Sub-type');
        wizardData.subtypeName = subVal;
      }

      step++;
      renderStep();
    });

    document.querySelectorAll('.btn-prod-path').forEach(btn => {
      btn.onclick = () => {
        wizardData.productMode = btn.dataset.path;
        renderStep();
      };
    });

    const prodSearchContainer = document.getElementById('wiz-existing-prod-container');
    if (prodSearchContainer && wizardData.productMode === 'existing') {
      activeDropdownInstance = createTaxonomySearchInput({
        container: prodSearchContainer,
        categories: [],
        rootItems: products.map(p => ({ id: p.id, name: p.name, category: p.category || 'General', subtypes: [] })),
        placeholder: 'Search store products...',
        onSelect: ({ val }) => {
          wizardData.selectedExistingProduct = products.find(p => String(p.id) === String(val)) || null;
        }
      });
    }

    document.getElementById('btn-wiz-finish')?.addEventListener('click', async () => {
      const finishBtn = document.getElementById('btn-wiz-finish');
      if (!wizardData.selectedExistingProduct) return showCustomAlert('Please select an existing product.', 'Missing Product');

      if (finishBtn) { finishBtn.disabled = true; finishBtn.textContent = 'Saving...'; }

      try {
        const res = await commitAtomicChain({
          category: wizardData.category,
          rootItemName: wizardData.itemName,
          subtypeName: wizardData.subtypeName,
          productPayload: { ...wizardData.selectedExistingProduct, category: wizardData.category }
        });
        closeAddItemWizard();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        if (typeof window.renderProductBank === 'function') window.renderProductBank();
        const cb = onComplete || window.__onHierarchyComplete;
        if (typeof cb === 'function') {
          window.__onHierarchyComplete = null;
          cb(res || {
            ingredientId: res?.rootItem?.id || wizardData.itemName,
            subtypeId: res?.subtype?.id || wizardData.subtypeName,
            subtypeName: wizardData.subtypeName,
            parentName: wizardData.itemName,
            category: wizardData.category
          });
        }
      } catch (err) {
        console.error('[AddItemWizardUI] Commit error:', err);
        if (finishBtn) { finishBtn.disabled = false; finishBtn.textContent = 'Finish & Link to Bank'; }
      }
    });
  };

  renderStep();
}
