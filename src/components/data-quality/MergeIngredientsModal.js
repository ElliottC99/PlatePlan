/**
 * src/components/data-quality/MergeIngredientsModal.js
 * Side-by-side comparison and merge resolution for duplicate ingredients.
 * Re-links all associated recipes, products, and plan references atomically.
 */

import { getState, setIngredients, setProducts, setRecipes, setCurrentPlan } from '../../store/store.js';
import { batchMergeIngredientsInDb } from '../../services/HouseholdRepository.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function openMergeIngredientsModal(issue = {}) {
  const state = getState() || {};
  const ingredients = state.ingredients || [];
  const products = state.products || [];
  const recipes = state.recipes || [];
  const currentPlan = state.currentPlan || null;

  const ing1 = ingredients.find(i => String(i.id) === String(issue.ing1Id));
  const ing2 = ingredients.find(i => String(i.id) === String(issue.ing2Id));

  if (!ing1 || !ing2) {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Duplicate ingredients not found in local store.', 'warning');
    }
    return;
  }

  let modal = document.getElementById('merge-ingredients-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'merge-ingredients-modal';
    document.body.appendChild(modal);
  }
  modal.className = 'modal active';
  modal.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;padding:16px;';

  // Find linked product counts
  const ing1Prods = products.filter(p => String(p.ingredientId) === String(ing1.id));
  const ing2Prods = products.filter(p => String(p.ingredientId) === String(ing2.id));

  // Find recipe counts
  const getRecipeCount = (ingId) => {
    return recipes.filter(r => {
      const ings = r.ingredients || r.recipe?.ingredients || r.parsedIngredients || [];
      const items = Array.isArray(ings) ? ings : Object.values(ings);
      return items.some(item => String(item.ingredientId) === String(ingId));
    }).length;
  };

  const ing1RecipesCount = getRecipeCount(ing1.id);
  const ing2RecipesCount = getRecipeCount(ing2.id);

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:640px; padding:24px; border-radius:14px; background:var(--surface,#fff); box-shadow:0 12px 36px rgba(0,0,0,0.25); display:flex; flex-direction:column; max-height:90vh; box-sizing:border-box;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px;">
        <div>
          <h2 style="font-size:18px; font-weight:750; margin:0; color:var(--text,#1c1917);">Review &amp; Merge Duplicate Ingredients</h2>
          <p style="font-size:12.5px; color:var(--text2,#78716c); margin:4px 0 0 0;">Compare candidate duplicates and select the canonical entry to keep.</p>
        </div>
        <button type="button" class="btn sm ghost" style="padding:4px 8px; font-size:16px; line-height:1;" onclick="window.closeMergeIngredientsModal()">✕</button>
      </div>

      <!-- Side-by-side comparison table -->
      <div style="flex:1; overflow-y:auto; border:1px solid var(--border,#e7e5e4); border-radius:10px; margin-bottom:18px; background:var(--surface2,#f5f5f4); padding:10px;">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:14px;">
          <!-- Card 1 -->
          <label class="card" style="cursor:pointer; padding:14px; border:2px solid var(--primary,#4f46e5); border-radius:10px; background:#fff; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="radio" name="canonical-selection" value="ing1" checked style="width:18px; height:18px; accent-color:var(--primary,#4f46e5);" />
              <strong style="font-size:14px; color:var(--primary,#4f46e5);">Keep Option A (Canonical)</strong>
            </div>
            <div style="font-size:15px; font-weight:750; color:#111827; margin-top:4px;">${escapeHtml(ing1.name)}</div>
            <div style="font-size:11.5px; color:var(--text2);">Category: ${escapeHtml(ing1.category || 'other')}</div>
            <div style="font-size:11.5px; color:var(--text2);">Macros: ${ing1.cal} kcal · ${ing1.prot}g protein</div>
            <div style="font-size:11.5px; color:var(--text2); font-weight:600;">Linked products: ${ing1Prods.length}</div>
            <div style="font-size:11.5px; color:var(--text2); font-weight:600;">Linked recipes: ${ing1RecipesCount}</div>
          </label>

          <!-- Card 2 -->
          <label class="card" style="cursor:pointer; padding:14px; border:2px solid var(--border); border-radius:10px; background:#fff; display:flex; flex-direction:column; gap:6px;" onclick="this.style.borderColor='var(--primary)'" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="radio" name="canonical-selection" value="ing2" style="width:18px; height:18px; accent-color:var(--primary,#4f46e5);" />
              <strong style="font-size:14px; color:var(--text3,#78716c);">Keep Option B (Canonical)</strong>
            </div>
            <div style="font-size:15px; font-weight:750; color:#111827; margin-top:4px;">${escapeHtml(ing2.name)}</div>
            <div style="font-size:11.5px; color:var(--text2);">Category: ${escapeHtml(ing2.category || 'other')}</div>
            <div style="font-size:11.5px; color:var(--text2);">Macros: ${ing2.cal} kcal · ${ing2.prot}g protein</div>
            <div style="font-size:11.5px; color:var(--text2); font-weight:600;">Linked products: ${ing2Prods.length}</div>
            <div style="font-size:11.5px; color:var(--text2); font-weight:600;">Linked recipes: ${ing2RecipesCount}</div>
          </label>
        </div>

        <div style="font-size:12px; color:var(--text2); line-height:1.5; padding:8px; border-radius:6px; background:#fef3c7; border:1px solid #fde68a; display:flex; gap:6px;">
          <span>💡</span>
          <div>
            <strong>Atomic Merge Actions Prepared:</strong><br />
            1. All recipes using the duplicate will be updated to point to the canonical entry.<br />
            2. Grocery items in your Product Bank will be re-assigned automatically.<br />
            3. Embedded sub-types and aliases will be consolidated to preserve history.<br />
            4. The duplicate ingredient entry will be permanently deleted.
          </div>
        </div>
      </div>

      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button type="button" class="btn sm ghost" onclick="window.closeMergeIngredientsModal()">Cancel</button>
        <button type="button" class="btn sm primary" id="confirm-merge-btn" style="font-weight:700; background:var(--primary,#4f46e5); color:#fff; border-radius:8px; padding:8px 16px;">Approve &amp; Merge Atoms</button>
      </div>
    </div>
  `;

  // Apply visual focus border behavior
  const radios = modal.querySelectorAll('input[name="canonical-selection"]');
  radios.forEach(radio => {
    radio.onchange = () => {
      radios.forEach(r => {
        const c = r.closest('.card');
        if (r.checked) {
          c.style.borderColor = 'var(--primary,#4f46e5)';
          c.querySelector('strong').style.color = 'var(--primary,#4f46e5)';
        } else {
          c.style.borderColor = 'var(--border)';
          c.querySelector('strong').style.color = 'var(--text3,#78716c)';
        }
      });
    };
  });

  // Action Button Binding
  document.getElementById('confirm-merge-btn').onclick = async () => {
    const selectedRadio = modal.querySelector('input[name="canonical-selection"]:checked').value;
    
    // canonical is the one KEPT, duplicate is the one DELETED
    const canonical = selectedRadio === 'ing1' ? ing1 : ing2;
    const duplicate = selectedRadio === 'ing1' ? ing2 : ing1;

    window.closeMergeIngredientsModal();

    // 1. Prepare consolidations: sub-types merge
    const finalSubtypes = [...(canonical.subtypes || [])];
    const dupSubtypes = duplicate.subtypes || [];
    
    dupSubtypes.forEach(dupSub => {
      const exists = finalSubtypes.some(s => String(s.id) === String(dupSub.id) || s.name.toLowerCase().trim() === dupSub.name.toLowerCase().trim());
      if (!exists) {
        finalSubtypes.push(dupSub);
      }
    });

    const mergedCanonical = {
      ...canonical,
      subtypes: finalSubtypes,
      aliases: Array.from(new Set([
        ...(canonical.aliases || []),
        duplicate.name,
        ...(duplicate.aliases || [])
      ])).filter(Boolean),
      notes: `${canonical.notes || ''} (Merged duplicate "${duplicate.name}").`.trim()
    };

    // 2. Prepare associated products updates
    const updatedProducts = products.filter(p => String(p.ingredientId) === String(duplicate.id)).map(p => ({
      ...p,
      ingredientId: mergedCanonical.id,
      updatedAt: new Date().toISOString()
    }));

    // 3. Prepare associated recipes updates
    const updatedRecipes = recipes.filter(r => {
      const rawIngs = r.ingredients || r.recipe?.ingredients || r.parsedIngredients || [];
      const items = Array.isArray(rawIngs) ? rawIngs : Object.values(rawIngs);
      return items.some(item => String(item.ingredientId) === String(duplicate.id));
    }).map(r => {
      const cloned = { ...r };
      const rawIngs = cloned.ingredients || cloned.recipe?.ingredients || cloned.parsedIngredients || [];
      const items = Array.isArray(rawIngs) ? [...rawIngs] : Object.values(rawIngs);
      
      const updatedItems = items.map(item => {
        if (String(item.ingredientId) === String(duplicate.id)) {
          return { ...item, ingredientId: mergedCanonical.id };
        }
        return item;
      });

      if (cloned.ingredients) cloned.ingredients = updatedItems;
      if (cloned.recipe?.ingredients) cloned.recipe.ingredients = updatedItems;
      if (cloned.parsedIngredients) cloned.parsedIngredients = updatedItems;
      
      cloned.updatedAt = new Date().toISOString();
      return cloned;
    });

    // 4. Prepare active plan updates if applicable
    let updatedPlan = null;
    if (currentPlan && currentPlan.slots) {
      let planModified = false;
      const plan = JSON.parse(JSON.stringify(currentPlan));
      
      Object.keys(plan.slots).forEach(dayKey => {
        const dayObj = plan.slots[dayKey];
        if (!dayObj) return;
        Object.keys(dayObj).forEach(mealKey => {
          const node = dayObj[mealKey];
          if (node && String(node.ingredientId) === String(duplicate.id)) {
            node.ingredientId = mergedCanonical.id;
            planModified = true;
          }
        });
      });

      if (planModified) {
        updatedPlan = plan;
      }
    }

    // 5. Commit Optimistically to Local Store
    const oldIngredients = [...ingredients];
    const oldProducts = [...products];
    const oldRecipes = [...recipes];
    const oldPlan = currentPlan;

    // Remove duplicate from local store ingredients, update canonical
    const finalIngs = ingredients.filter(i => String(i.id) !== String(duplicate.id)).map(i => {
      if (String(i.id) === String(mergedCanonical.id)) return mergedCanonical;
      return i;
    });

    // Update products local store
    const finalProds = products.map(p => {
      const match = updatedProducts.find(up => String(up.id) === String(p.id));
      return match || p;
    });

    // Update recipes local store
    const finalRecipes = recipes.map(r => {
      const match = updatedRecipes.find(ur => String(ur.id) === String(r.id));
      return match || r;
    });

    setIngredients(finalIngs);
    setProducts(finalProds);
    setRecipes(finalRecipes);
    if (updatedPlan) setCurrentPlan(updatedPlan);

    if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();

    // 6. Commit Atomically to Firestore using batchMergeIngredientsInDb
    try {
      await batchMergeIngredientsInDb(mergedCanonical, duplicate.id, updatedRecipes, updatedProducts, updatedPlan);
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Successfully merged duplicate ingredients atomically!', 'success');
      }
    } catch (e) {
      console.error('[MergeIngredientsModal] Atomic merge failed:', e);
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Merge transaction failed. Reverting store.', 'error');
      }
      // Revert store state on database failure
      setIngredients(oldIngredients);
      setProducts(oldProducts);
      setRecipes(oldRecipes);
      setCurrentPlan(oldPlan);
      if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
    }
  };
}

export function closeMergeIngredientsModal() {
  const modal = document.getElementById('merge-ingredients-modal');
  if (modal) {
    modal.className = 'modal';
    modal.style.display = 'none';
  }
}

if (typeof window !== 'undefined') {
  window.openMergeIngredientsModal = openMergeIngredientsModal;
  window.closeMergeIngredientsModal = closeMergeIngredientsModal;
}
