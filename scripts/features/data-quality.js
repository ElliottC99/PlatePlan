import { createLegacyView } from './create-legacy-view.js?v=3.3.7-mod';
import { renderTescoImportReviewModalHtml, readTescoImportReviewModalInputs } from './products.js?v=3.3.0';
 
export { renderTescoImportReviewModalHtml, readTescoImportReviewModalInputs };
 
export default createLegacyView({
  id: 'data',
  rootId: 'view-data',
  install(context, root) {
    if (!root) return;
    root.addEventListener('click', async (event) => {
      const button = event.target.closest('.dq-fix-btn');
      if (!button) return;
 
      const subtypeId = button.dataset.subtypeId || button.getAttribute('data-subtype-id');
      if (!subtypeId) return;
 
      event.preventDefault();
      event.stopPropagation();
 
      let modalOverlay = document.getElementById('dq-tesco-modal-overlay');
      if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'dq-tesco-modal-overlay';
        modalOverlay.style.position = 'fixed';
        modalOverlay.style.top = '0';
        modalOverlay.style.left = '0';
        modalOverlay.style.width = '100vw';
        modalOverlay.style.height = '100vh';
        modalOverlay.style.backgroundColor = 'transparent'; // Removes double-dark backdrop
        modalOverlay.style.zIndex = '1000';
        modalOverlay.style.display = 'flex';
        modalOverlay.style.alignItems = 'center';
        modalOverlay.style.justifyContent = 'center';
        document.body.appendChild(modalOverlay);
      }
 
      const group = window.state?.ingredients?.find(g => g.id === subtypeId) || 
                    (typeof window.getIngredientGroup === 'function' ? window.getIngredientGroup(subtypeId) : null);
      const subTypeName = group ? (group.name || group.id) : subtypeId;
 
      modalOverlay.innerHTML = `
        <div style="width: 100%; max-width: 600px; padding: 24px; border-radius: 14px; background: var(--surface, #1e1e1e); border: 1px solid var(--border); box-shadow: 0 12px 36px rgba(0,0,0,0.5); max-height: 85vh; overflow-y: auto; min-height: 0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h2 style="font-size:18px; font-weight:700; margin:0; color:var(--text)">Review Extracted Product</h2>
            <button class="btn sm ghost" id="dq-tesco-close-btn" style="padding:4px 8px; font-size:16px; line-height:1">✕</button>
          </div>
          ${renderTescoImportReviewModalHtml()}
        </div>
      `;
      modalOverlay.style.display = 'flex';
 
      // Pre-populate values
      if (document.getElementById('tp-name')) document.getElementById('tp-name').value = subTypeName;
      if (group?.cat && document.getElementById('import-category')) document.getElementById('import-category').value = group.cat;
      if (group?.storage && document.getElementById('import-storage')) document.getElementById('import-storage').value = group.storage;
 
      const saveBtn = modalOverlay.querySelector('#tesco-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          const extraInputs = readTescoImportReviewModalInputs();
          
          const name = document.getElementById('tp-name')?.value || subTypeName;
          const brand = document.getElementById('tp-brand')?.value || '';
          const price = parseFloat(document.getElementById('tp-price')?.value) || 0;
          const packSize = parseFloat(document.getElementById('tp-pack')?.value) || 100;
          const packUnit = document.getElementById('tp-pack-unit')?.value || 'g';
          
          const cal = parseFloat(document.getElementById('tp-cal')?.value) || 0;
          const prot = parseFloat(document.getElementById('tp-prot')?.value) || 0;
          const fat = parseFloat(document.getElementById('tp-fat')?.value) || 0;
          const carb = document.getElementById('tp-carb')?.value ? parseFloat(document.getElementById('tp-carb').value) : 0;
          const fibre = parseFloat(document.getElementById('tp-fibre')?.value || extraInputs.fibre) || 0;
          const notes = document.getElementById('import-notes')?.value || extraInputs.notes || '';
          const category = extraInputs.category;
          const storage = extraInputs.storage;
 
          const newProduct = {
            id: 'ing' + Date.now(),
            name,
            brand: brand || 'Tesco',
            cat: category.toLowerCase(),
            groupId: subtypeId,
            cal,
            prot,
            fat,
            carb,
            fibre,
            price,
            packSize,
            packUnit,
            storage: storage.toLowerCase(),
            notes,
            updatedAt: Date.now()
          };
 
          if (!window.state.products) {
            window.state.products = [];
          }
          window.state.products.push(newProduct);
          
          if (!window.state.ingredients) {
            window.state.ingredients = [];
          }
          window.state.ingredients.push(newProduct);
 
          if (context && context.store && typeof context.store.save === 'function') {
            await context.store.save({ reason: 'data-quality-tesco-fix' });
          } else {
            localStorage.setItem('plateplan_v2', JSON.stringify(window.state));
            if (typeof window.renderAll === 'function') {
              window.renderAll();
            }
          }
 
          if (typeof window.showPlatePlanToast === 'function') {
            window.showPlatePlanToast('Product saved successfully to Product Bank! ✓');
          }
 
          modalOverlay.style.display = 'none';
        });
      }
 
      const closeBtn = modalOverlay.querySelector('#dq-tesco-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          modalOverlay.style.display = 'none';
        });
      }
 
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          modalOverlay.style.display = 'none';
        }
      });
    }, true);
  }
});
