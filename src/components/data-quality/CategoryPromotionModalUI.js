/**
 * src/components/data-quality/CategoryPromotionModalUI.js
 * Interactive modal for retrospective recipe taxonomy level elevation.
 * Allows meal planners to promote sub-type locked ingredients to Root Items or Categories.
 */

import { getState } from '../../store/store.js';
import { scanRecipeTaxonomyElevations, applyRootElevationsToRecipe, applyCategoryPromotionToRecipe } from '../../../scripts/migrate_recipe_taxonomy_levels.js';
import { saveRecipe } from '../../services/RecipeFirestoreRepository.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

export function openCategoryPromotionModal() {
  const existing = document.getElementById('category-promotion-modal');
  if (existing) existing.remove();

  const state = getState() || {};
  const recipes = state.recipes || [];
  const ingredients = state.rootItems || state.ingredients || [];
  const products = state.products || [];

  const { rootElevations, categoryCandidates } = scanRecipeTaxonomyElevations(recipes, ingredients, products);

  const modal = document.createElement('div');
  modal.id = 'category-promotion-modal';
  modal.className = 'modal-backdrop active';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;backdrop-filter:blur(4px);';

  const renderContent = () => {
    const rootCount = rootElevations.length;
    const catCount = categoryCandidates.length;

    const catRowsHtml = categoryCandidates.map((item, idx) => `
      <div style="background:var(--surface2,#f9f8f6);border:1px solid var(--border,#e7e5e4);border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap;">
        <div style="min-width:0;flex:1;">
          <div style="font-weight:700;font-size:13.5px;color:var(--text,#1c1917);">${escapeHtml(item.recipeTitle)}</div>
          <div style="font-size:12px;color:var(--text2,#78716c);margin-top:2px;">
            Current: <strong>${escapeHtml(item.currentSubtypeName)}</strong> → Root: <strong>${escapeHtml(item.rootName)}</strong> → Category: <strong>${escapeHtml(item.category)}</strong>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
          <button type="button" class="btn sm primary promote-cat-btn" data-idx="${idx}" style="font-size:11.5px;padding:4px 10px;font-weight:600;background:var(--primary,#4f46e5);color:#fff;">
            Promote to Category
          </button>
          <button type="button" class="btn sm secondary promote-root-btn" data-idx="${idx}" style="font-size:11.5px;padding:4px 10px;font-weight:600;">
            Root Only
          </button>
        </div>
      </div>
    `).join('');

    return `
      <div class="modal-card" style="background:var(--surface,#fff);border-radius:14px;max-width:680px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 12px 30px rgba(0,0,0,0.2);overflow:hidden;">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border,#e7e5e4);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h3 style="margin:0;font-size:16px;font-weight:750;color:var(--text,#1c1917);display:flex;align-items:center;gap:8px;">
              <span>📈</span> Retrospective Taxonomy Elevation
            </h3>
            <div style="font-size:12px;color:var(--text2,#78716c);margin-top:2px;">
              Promote sub-type locked ingredients to Root Items or Categories for dynamic flexibility
            </div>
          </div>
          <button type="button" class="btn sm ghost close-modal-btn" style="font-size:16px;padding:4px 8px;">✕</button>
        </div>

        <div style="padding:16px 20px;overflow-y:auto;flex:1;">
          <!-- Top Root Elevation Banner -->
          <div style="background:var(--secondary-system-grouped-bg,#f3f4f6);border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--label,#1f2937);">Root Item Auto-Elevations</div>
              <div style="font-size:12px;color:var(--secondary-label,#6b7280);margin-top:2px;">
                ${rootCount} ingredients currently locked to standard/default sub-types can be elevated to Root Items.
              </div>
            </div>
            ${rootCount > 0 ? `
              <button type="button" class="btn sm primary" id="btn-elevate-all-root" style="background:var(--system-green,#10b981);color:#fff;font-weight:700;padding:6px 14px;font-size:12px;">
                ⚡ Elevate All (${rootCount})
              </button>
            ` : `<span style="font-size:12px;font-weight:600;color:var(--system-green,#10b981);">✓ Up to date</span>`}
          </div>

          <!-- Category Elevation Candidates List -->
          <h4 style="margin:0 0 8px 0;font-size:13.5px;font-weight:700;color:var(--label,#1f2937);">
            Category Elevation Candidates (${catCount})
          </h4>
          <p style="font-size:12px;color:var(--secondary-label,#6b7280);margin:0 0 12px 0;">
            Confirm ingredients you want to elevate all the way to generic Category level (e.g. any Maple Syrup or Oil):
          </p>

          ${catRowsHtml || '<div style="font-size:12.5px;color:var(--text2,#78716c);padding:12px 0;text-align:center;">No category candidates pending review.</div>'}
        </div>

        <div style="padding:12px 20px;border-top:1px solid var(--border,#e7e5e4);background:var(--surface2,#faf9f6);display:flex;justify-content:flex-end;">
          <button type="button" class="btn secondary close-modal-btn" style="font-size:12.5px;padding:6px 14px;font-weight:600;">Done</button>
        </div>
      </div>
    `;
  };

  modal.innerHTML = renderContent();
  document.body.appendChild(modal);

  const bindEvents = () => {
    modal.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.onclick = () => modal.remove();
    });

    const btnElevateAllRoot = modal.querySelector('#btn-elevate-all-root');
    if (btnElevateAllRoot) {
      btnElevateAllRoot.onclick = async () => {
        btnElevateAllRoot.disabled = true;
        btnElevateAllRoot.textContent = 'Elevating...';

        try {
          const keys = new Set(rootElevations.map(e => e.key));
          const recipesToUpdate = new Map();

          rootElevations.forEach(e => {
            const r = recipes.find(rec => String(rec.id) === String(e.recipeId));
            if (r) recipesToUpdate.set(r.id, r);
          });

          for (const [rId, r] of recipesToUpdate.entries()) {
            const updated = applyRootElevationsToRecipe(r, keys);
            await saveRecipe(updated);
          }

          if (typeof window.showPlatePlanToast === 'function') {
            window.showPlatePlanToast(`Elevated ${rootElevations.length} ingredients to Root Items!`, 'success');
          }
          modal.remove();
        } catch (err) {
          console.error('[CategoryPromotionModalUI] Error elevating to root:', err);
          btnElevateAllRoot.disabled = false;
          btnElevateAllRoot.textContent = 'Retry';
        }
      };
    }

    modal.querySelectorAll('.promote-cat-btn').forEach(btn => {
      btn.onclick = async () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const item = categoryCandidates[idx];
        if (!item) return;

        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
          const r = recipes.find(rec => String(rec.id) === String(item.recipeId));
          if (r) {
            const updated = applyCategoryPromotionToRecipe(r, {
              variant: item.variant,
              sectionIndex: item.sectionIndex,
              ingredientIndex: item.ingredientIndex,
              targetCategory: item.category
            });
            await saveRecipe(updated);
            categoryCandidates.splice(idx, 1);
            modal.innerHTML = renderContent();
            bindEvents();
            if (typeof window.showPlatePlanToast === 'function') {
              window.showPlatePlanToast(`Promoted "${item.ingredientName}" to Category "${item.category}"!`, 'success');
            }
          }
        } catch (err) {
          console.error('[CategoryPromotionModalUI] Error promoting to category:', err);
          btn.disabled = false;
          btn.textContent = 'Retry';
        }
      };
    });

    modal.querySelectorAll('.promote-root-btn').forEach(btn => {
      btn.onclick = async () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const item = categoryCandidates[idx];
        if (!item) return;

        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
          const r = recipes.find(rec => String(rec.id) === String(item.recipeId));
          if (r) {
            const updated = applyRootElevationsToRecipe(r, [item.key]);
            await saveRecipe(updated);
            categoryCandidates.splice(idx, 1);
            modal.innerHTML = renderContent();
            bindEvents();
            if (typeof window.showPlatePlanToast === 'function') {
              window.showPlatePlanToast(`Elevated "${item.ingredientName}" to Root Item "${item.rootName}"!`, 'success');
            }
          }
        } catch (err) {
          console.error('[CategoryPromotionModalUI] Error elevating to root:', err);
          btn.disabled = false;
          btn.textContent = 'Retry';
        }
      };
    });
  };

  bindEvents();
}
