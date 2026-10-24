/**
 * src/components/pantry/AddToBankWizardUI.js (v3.43.3)
 * Gated 4-Step Add to Bank Wizard: Category ➔ Root Item ➔ Sub-type ➔ Product.
 * Consumes RecipeSearchDropdownHelper and PantryTaxonomyService.
 * Strictly under 350 lines.
 */

import { getState } from '../../store/store.js';
import { getUnifiedCategories } from '../../services/CategoryRepository.js';
import { createTaxonomySearchInput } from './RecipeSearchDropdownHelper.js';
import { commitAtomicChain } from '../../services/PantryTaxonomyService.js';
import { openTescoImportModal, openSubtypeExistingProductPickerModal } from './TescoImportModalUI.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

let activeWizardState = {
  step: 1,
  category: '',
  rootItemName: '',
  subtypeName: '',
  productPayload: null
};

let activeDropdownInstance = null;

function showWizardModal(html) {
  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (wrap && content) {
    wrap.style.setProperty('z-index', '25005', 'important');
    content.style.setProperty('z-index', '25005', 'important');
    content.innerHTML = html;
    wrap.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

export function closeAddToBankWizardModal() {
  if (activeDropdownInstance && typeof activeDropdownInstance.destroy === 'function') {
    activeDropdownInstance.destroy();
    activeDropdownInstance = null;
  }
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) {
    wrap.classList.remove('open');
    document.body.style.overflow = '';
  }
}

export function openAddToBankWizardModal() {
  activeWizardState = {
    step: 1,
    category: '',
    rootItemName: '',
    subtypeName: '',
    productPayload: null
  };
  renderWizardStep();
}

function renderWizardStep() {
  const state = getState();
  const categories = getUnifiedCategories(state) || [];
  const rootItems = state.rootItems || state.ingredients || [];

  const { step, category, rootItemName, subtypeName, productPayload } = activeWizardState;

  const html = `
    <div id="add-to-bank-wizard-modal" style="padding: 24px; max-width: 520px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; position:relative;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:750; color:var(--text,#1c1917);">🏛️ Add to Pantry Catalog</h3>
        <span style="font-size:12px; font-weight:700; background:var(--surface2,#f5f4ee); color:var(--primary,#4f46e5); padding:3px 8px; border-radius:12px;">Step ${step} of 4</span>
      </div>

      <!-- Step Indicator Bar -->
      <div style="display:flex; gap:6px; margin-bottom:20px;">
        <div style="flex:1; height:4px; border-radius:2px; background:${step >= 1 ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'};"></div>
        <div style="flex:1; height:4px; border-radius:2px; background:${step >= 2 ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'};"></div>
        <div style="flex:1; height:4px; border-radius:2px; background:${step >= 3 ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'};"></div>
        <div style="flex:1; height:4px; border-radius:2px; background:${step >= 4 ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'};"></div>
      </div>

      ${step === 1 ? `
        <div style="margin-bottom:18px;">
          <label style="display:block; font-size:12.5px; font-weight:700; margin-bottom:6px;">1. Select or Type Category</label>
          <div id="wizard-taxonomy-search-container"></div>
          <p style="font-size:11.5px; color:var(--text2,#78716c); margin:6px 0 0 0;">Pick an existing aisle or type a new category name.</p>
        </div>
      ` : ''}

      ${step === 2 ? `
        <div style="margin-bottom:18px;">
          <div style="font-size:12px; color:var(--purple,#4f46e5); font-weight:600; margin-bottom:4px;">Category: 📂 ${escapeHtml(category)}</div>
          <label style="display:block; font-size:12.5px; font-weight:700; margin-bottom:6px;">2. Root Item Name</label>
          <input type="text" id="wizard-root-item-input" value="${escapeAttr(rootItemName)}" placeholder="e.g. Cheddar Cheese, Flour, Milk..." style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12.5px;" />
        </div>
      ` : ''}

      ${step === 3 ? `
        <div style="margin-bottom:18px;">
          <div style="font-size:12px; color:var(--text2,#78716c); font-weight:600; margin-bottom:4px;">📂 ${escapeHtml(category)} ➔ 📦 ${escapeHtml(rootItemName)}</div>
          <label style="display:block; font-size:12.5px; font-weight:700; margin-bottom:6px;">3. Sub-type (Optional)</label>
          <input type="text" id="wizard-subtype-input" value="${escapeAttr(subtypeName)}" placeholder="e.g. Mature Cheddar, Extra Virgin, Plain..." style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12.5px;" />
          <p style="font-size:11.5px; color:var(--text2,#78716c); margin:6px 0 0 0;">Leave blank if not applicable, or enter specific variant.</p>
        </div>
      ` : ''}

      ${step === 4 ? `
        <div style="margin-bottom:18px;">
          <div style="font-size:12px; color:var(--text2,#78716c); font-weight:600; margin-bottom:8px;">
            📂 ${escapeHtml(category)} ➔ 📦 ${escapeHtml(rootItemName)} ${subtypeName ? `➔ 🏷️ ${escapeHtml(subtypeName)}` : ''}
          </div>
          <label style="display:block; font-size:12.5px; font-weight:700; margin-bottom:8px;">4. Attach Product (Optional)</label>
          
          <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
            <button type="button" class="btn ghost sm" id="btn-wizard-tesco-import" style="justify-content:flex-start; font-weight:600;">🛒 Import Product via Tesco Bookmarklet</button>
            <button type="button" class="btn ghost sm" id="btn-wizard-existing-picker" style="justify-content:flex-start; font-weight:600;">🔗 Attach Existing Product from Product Bank</button>
          </div>

          ${productPayload ? `
            <div style="padding:10px 12px; background:var(--surface2,#f5f4ee); border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12px;">
              <span style="font-weight:700; color:var(--green,#059669);">✅ Product Ready:</span> ${escapeHtml(productPayload.name || productPayload.title || 'Product attached')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; border-top:1px solid var(--border,#e7e5e4); padding-top:16px;">
        <button type="button" class="btn" id="btn-wizard-prev" ${step === 1 ? 'disabled style="opacity:0.5;"' : ''}>Back</button>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn" id="btn-wizard-cancel">Cancel</button>
          <button type="button" class="btn primary" id="btn-wizard-next">
            ${step === 4 ? 'Save & Commit' : 'Next ➔'}
          </button>
        </div>
      </div>
    </div>
  `;

  showWizardModal(html);

  // Bind step 1 search helper
  if (step === 1) {
    const container = document.getElementById('wizard-taxonomy-search-container');
    activeDropdownInstance = createTaxonomySearchInput({
      container,
      categories,
      rootItems,
      placeholder: 'Type or pick category...',
      initialValue: category,
      onSelect: ({ label, val }) => {
        let selectedCat = label.replace(/^[📂📦🏷️✨\s\[Category\]]+/, '').trim();
        if (val && val.startsWith('cat:')) selectedCat = val.replace('cat:', '');
        activeWizardState.category = selectedCat;
      }
    });
  }

  // Event Listeners
  const cancelBtn = document.getElementById('btn-wizard-cancel');
  if (cancelBtn) cancelBtn.onclick = closeAddToBankWizardModal;

  const prevBtn = document.getElementById('btn-wizard-prev');
  if (prevBtn && step > 1) {
    prevBtn.onclick = () => {
      activeWizardState.step--;
      renderWizardStep();
    };
  }

  const nextBtn = document.getElementById('btn-wizard-next');
  if (nextBtn) {
    nextBtn.onclick = async () => {
      if (step === 1) {
        const inputEl = document.querySelector('.wiz-ing-tax-search');
        if (inputEl && inputEl.value.trim()) {
          activeWizardState.category = inputEl.value.replace(/^[📂📦🏷️✨\s\[Category\]]+/, '').trim();
        }
        if (!activeWizardState.category) return;
        activeWizardState.step = 2;
        renderWizardStep();
        return;
      }

      if (step === 2) {
        const rootInput = document.getElementById('wizard-root-item-input');
        if (rootInput) activeWizardState.rootItemName = rootInput.value.trim();
        if (!activeWizardState.rootItemName) return;
        activeWizardState.step = 3;
        renderWizardStep();
        return;
      }

      if (step === 3) {
        const subInput = document.getElementById('wizard-subtype-input');
        if (subInput) activeWizardState.subtypeName = subInput.value.trim();
        activeWizardState.step = 4;
        renderWizardStep();
        return;
      }

      if (step === 4) {
        nextBtn.disabled = true;
        nextBtn.textContent = 'Saving...';
        await commitAtomicChain({
          category: activeWizardState.category,
          rootItemName: activeWizardState.rootItemName,
          subtypeName: activeWizardState.subtypeName,
          productPayload: activeWizardState.productPayload
        });
        closeAddToBankWizardModal();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        if (typeof window.renderProductBank === 'function') window.renderProductBank();
      }
    };
  }

  // Step 4 Product Attach Buttons
  if (step === 4) {
    const tescoBtn = document.getElementById('btn-wizard-tesco-import');
    if (tescoBtn) {
      tescoBtn.onclick = () => {
        openTescoImportModal(null, null, (importedPayload) => {
          activeWizardState.productPayload = importedPayload;
          renderWizardStep();
        });
      };
    }

    const pickerBtn = document.getElementById('btn-wizard-existing-picker');
    if (pickerBtn) {
      pickerBtn.onclick = () => {
        openSubtypeExistingProductPickerModal(null, null, (selectedProduct) => {
          activeWizardState.productPayload = selectedProduct;
          renderWizardStep();
        });
      };
    }
  }
}
