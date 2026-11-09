/**
 * src/components/pantry/CategoryMergeModalUI.js
 * Interactive Category Deduplication and Merge Component.
 * Detects near-identical category names (case-insensitive, whitespace, alphanumeric normalization)
 * and allows users to merge duplicate categories into a chosen canonical name.
 */

import { getState } from '../../store/store.js';
import { getUnifiedCategories } from '../../services/CategoryRepository.js';
import { mergeCategory } from '../../services/CategoryMergeRepository.js';
import { escapeHtml, escapeAttr } from '../../utils/stringUtils.js';

const slugCategory = (str) => String(str || '').toLowerCase().trim().replace(/[\s_]+/g, '').replace(/[^a-z0-9]/g, '');

export function findDuplicateCategoryClusters(state = null) {
  const st = state || getState() || {};
  const categories = getUnifiedCategories(st);
  const ingredients = Array.isArray(st.ingredients) ? st.ingredients : [];
  const products = Array.isArray(st.products) ? st.products : [];

  const allNames = new Set(categories);
  if (Array.isArray(st.categories)) {
    st.categories.forEach(c => {
      const name = typeof c === 'string' ? c : (c?.name || c?.categoryName || '');
      if (name) allNames.add(name);
    });
  }
  ingredients.forEach(i => {
    if (i?.category) allNames.add(i.category);
    if (Array.isArray(i?.subtypes)) {
      i.subtypes.forEach(s => { if (s?.category) allNames.add(s.category); });
    }
  });
  products.forEach(p => {
    if (p?.category) allNames.add(p.category);
  });

  const clusters = new Map();
  allNames.forEach(raw => {
    const clean = String(raw || '').trim();
    if (!clean) return;
    const slug = slugCategory(clean);
    if (!slug) return;
    if (!clusters.has(slug)) clusters.set(slug, new Set());
    clusters.get(slug).add(clean);
  });

  const result = [];
  clusters.forEach((namesSet, slug) => {
    const names = Array.from(namesSet);
    if (names.length > 1) {
      const variants = names.map(name => {
        const cleanName = String(name).trim();
        const rootCount = ingredients.filter(i => String(i?.category || '').trim() === cleanName).length;
        let subCount = 0;
        ingredients.forEach(i => {
          if (Array.isArray(i?.subtypes)) {
            subCount += i.subtypes.filter(s => String(s?.category || '').trim() === cleanName).length;
          }
        });
        const prodCount = products.filter(p => String(p?.category || '').trim() === cleanName).length;
        const total = rootCount + subCount + prodCount;
        return { name: cleanName, rootCount, subCount, prodCount, total };
      });
      // Sort variants by total items descending so the most-used is default canonical
      variants.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
      result.push({ slug, variants });
    }
  });

  return result;
}

export function closeCategoryMergeModal() {
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) {
    wrap.classList.remove('open');
    document.body.style.overflow = '';
  }
}

export function openCategoryMergeModal() {
  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (!wrap || !content) return;

  const clusters = findDuplicateCategoryClusters();

  if (clusters.length === 0) {
    content.innerHTML = `
      <div style="padding:28px 24px; max-width:480px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:14px; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.15); text-align:center;">
        <div style="font-size:36px; margin-bottom:8px;">🎉</div>
        <h3 style="margin:0 0 8px 0; font-size:1.15rem; font-weight:750; color:var(--text,#1c1917);">All Categories Clean</h3>
        <p style="font-size:12.5px; color:var(--text2,#78716c); margin:0 0 20px 0;">No duplicate or near-identical category names detected across your pantry.</p>
        <button type="button" class="btn sm primary" id="btn-cat-merge-done" style="padding:6px 18px; font-weight:650;">Done</button>
      </div>
    `;
    wrap.style.setProperty('z-index', '25005', 'important');
    content.style.setProperty('z-index', '25005', 'important');
    wrap.classList.add('open');
    document.body.style.overflow = 'hidden';

    const doneBtn = content.querySelector('#btn-cat-merge-done');
    if (doneBtn) doneBtn.onclick = closeCategoryMergeModal;
    return;
  }

  content.innerHTML = `
    <div style="padding:24px; max-width:560px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:14px; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.15); max-height:85vh; display:flex; flex-direction:column;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid var(--border,#e7e5e4); padding-bottom:10px;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:750; color:var(--text,#1c1917); display:flex; align-items:center; gap:6px;">
          <span>🧹</span> Merge Duplicate Categories
        </h3>
        <button type="button" class="btn xs ghost" id="btn-cat-merge-close" style="font-weight:700;">✕</button>
      </div>

      <p style="font-size:12px; color:var(--text2,#78716c); margin:0 0 14px 0;">
        Found <strong>${clusters.length}</strong> duplicate category cluster${clusters.length === 1 ? '' : 's'}. Select the canonical name to keep for each cluster. All items, products, and recipe ingredients will be unified under that name.
      </p>

      <div id="cat-clusters-list" style="overflow-y:auto; flex:1; margin-bottom:16px; padding-right:4px;">
        ${clusters.map((cluster, cIdx) => `
          <div class="cat-cluster-card" data-cidx="${cIdx}" style="background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:10px; padding:12px 14px; margin-bottom:12px;">
            <div style="font-size:11px; font-weight:700; color:var(--text2,#64748b); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
              Cluster: "${escapeHtml(cluster.variants[0].name)}" (${cluster.variants.length} variations)
            </div>
            ${cluster.variants.map((v, vIdx) => `
              <label style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; background:var(--surface,#fff); border:1px solid var(--border,#eee); border-radius:8px; margin-bottom:6px; cursor:pointer;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <input type="radio" name="cluster_${cIdx}" value="${escapeAttr(v.name)}" ${vIdx === 0 ? 'checked' : ''} style="cursor:pointer;" />
                  <span style="font-size:13px; font-weight:700; color:var(--text,#1c1917);">📂 ${escapeHtml(v.name)}</span>
                </div>
                <span style="font-size:11.5px; color:var(--text2,#64748b); background:var(--surface2,#f1f5f9); padding:2px 8px; border-radius:6px;">
                  ${v.total} item${v.total === 1 ? '' : 's'} (${v.rootCount} root, ${v.prodCount} prod)
                </span>
              </label>
            `).join('')}
          </div>
        `).join('')}
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border,#e7e5e4); padding-top:12px;">
        <button type="button" class="btn sm ghost" id="btn-cat-merge-cancel">Cancel</button>
        <button type="button" class="btn sm primary" id="btn-cat-merge-apply" style="font-weight:650; background:#0284c7; color:#fff;">⚡ Merge Selected</button>
      </div>
    </div>
  `;

  wrap.style.setProperty('z-index', '25005', 'important');
  content.style.setProperty('z-index', '25005', 'important');
  wrap.classList.add('open');
  document.body.style.overflow = 'hidden';

  const closeBtn = content.querySelector('#btn-cat-merge-close');
  const cancelBtn = content.querySelector('#btn-cat-merge-cancel');
  const applyBtn = content.querySelector('#btn-cat-merge-apply');

  if (closeBtn) closeBtn.onclick = closeCategoryMergeModal;
  if (cancelBtn) cancelBtn.onclick = closeCategoryMergeModal;

  if (applyBtn) {
    applyBtn.onclick = async () => {
      applyBtn.disabled = true;
      applyBtn.textContent = 'Merging categories...';

      try {
        for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
          const cluster = clusters[cIdx];
          const checkedRadio = content.querySelector(`input[name="cluster_${cIdx}"]:checked`);
          const targetName = checkedRadio ? checkedRadio.value : cluster.variants[0].name;

          for (const variant of cluster.variants) {
            if (variant.name !== targetName) {
              await mergeCategory(variant.name, targetName);
            }
          }
        }

        closeCategoryMergeModal();
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Category merge complete! Duplicates unified.', 'success');
        }
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        if (typeof window.renderProductBank === 'function') window.renderProductBank();
        if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
      } catch (err) {
        console.error('[CategoryMergeModalUI] Error merging categories:', err);
        applyBtn.disabled = false;
        applyBtn.textContent = '⚡ Merge Selected';
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast(`Error merging categories: ${err.message}`, 'error');
        }
      }
    };
  }
}
