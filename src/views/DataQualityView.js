/**
 * src/views/DataQualityView.js (v3.20.04)
 * Modular ES6 View for Data Quality Centre, audit scanner results, macro quality sweep, and 3-path resolutions.
 */

import { getState, subscribe, setPreferences } from '../store/store.js';
import { savePreferences } from '../services/HouseholdRepository.js';
import { runDataQualityScan } from '../services/DataQualityScannerService.js';
import { sweepRecipeMacroQuality } from '../utils/fitScoreCalculator.js';
import { openResolveUnlinkedModal } from '../components/data-quality/ResolveUnlinkedModalUI.js';
import { openHierarchyWizardModal } from '../components/data-quality/HierarchyWizardModalUI.js';
import { openProductEditModal } from './ProductBankView.js';

export { sweepRecipeMacroQuality };

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

export async function dismissAdvisory(issueKey) {
  try {
    const state = (window.Store && typeof window.Store.getState === 'function') 
      ? window.Store.getState() 
      : (typeof getState === 'function' ? getState() : {});
    const currentPrefs = state.preferences || state.userPrefs || {};
    const currentDismissed = Array.isArray(currentPrefs.dismissedQualityAdvisories) 
      ? [...currentPrefs.dismissedQualityAdvisories] 
      : [];

    if (!currentDismissed.includes(issueKey)) {
      currentDismissed.push(issueKey);
    }

    const updatedPrefs = {
      ...currentPrefs,
      dismissedQualityAdvisories: currentDismissed
    };

    if (typeof setPreferences === 'function') {
      setPreferences(updatedPrefs);
    } else if (window.Store && typeof window.Store.setState === 'function') {
      window.Store.setState({ preferences: updatedPrefs });
    }

    renderDataQualityView();

    if (typeof savePreferences === 'function') {
      await savePreferences(updatedPrefs);
    } else if (window.PantryRepository && typeof window.PantryRepository.savePreferences === 'function') {
      await window.PantryRepository.savePreferences(updatedPrefs);
    }
  } catch (err) {
    console.error('[DataQualityView] dismissAdvisory caught error:', err);
  }
}

export async function runGlobalProductRelink() {
  try {
    const state = (window.Store && typeof window.Store.getState === 'function') 
      ? window.Store.getState() 
      : (typeof getState === 'function' ? getState() : {});

    if (typeof window.relinkOrphanedProducts === 'function') {
      await window.relinkOrphanedProducts();
    } else {
      const prods = Array.isArray(state.products) ? JSON.parse(JSON.stringify(state.products)) : [];
      const ings = Array.isArray(state.ingredients) ? state.ingredients : [];
      let modified = false;

      for (const prod of prods) {
        if (!prod.ingredientId) {
          const prodNameLower = String(prod.name || '').toLowerCase();
          const match = ings.find(i => {
            const ingName = String(i.name || '').toLowerCase();
            return prodNameLower.includes(ingName) || (Array.isArray(i.aliases) && i.aliases.some(a => prodNameLower.includes(String(a).toLowerCase())));
          });
          if (match) {
            prod.ingredientId = match.id;
            if (!prod.category && match.category) prod.category = match.category;
            prod.updatedAt = new Date().toISOString();
            modified = true;
          }
        }
      }

      if (modified) {
        if (window.Store && typeof window.Store.setState === 'function') {
          window.Store.setState({ products: prods });
        }
        if (window.PantryRepository && typeof window.PantryRepository.saveProduct === 'function') {
          await Promise.all(prods.filter(p => p.ingredientId).map(p => window.PantryRepository.saveProduct(p)));
        }
      }
    }

    if (typeof window.renderDataQualityView === 'function') {
      window.renderDataQualityView();
    } else if (window.DataQualityView && typeof window.DataQualityView.render === 'function') {
      window.DataQualityView.render();
    }
  } catch (err) {
    console.error('[DataQualityView] runGlobalProductRelink caught error:', err);
  }
}

export function handleFixIssue(e, entityType, entityId, issueKey = '', parentId = null) {
  try {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();

    let item = (window.PantryHierarchyModel && typeof window.PantryHierarchyModel.getItemById === 'function')
      ? window.PantryHierarchyModel.getItemById(entityId)
      : null;

    if (!item && window.Store && typeof window.Store.getState === 'function') {
      const state = window.Store.getState() || {};
      const ingredients = state.ingredients || state.pantry?.ingredients || [];
      const directIng = ingredients.find(i => String(i.id) === String(entityId));
      if (directIng) {
        item = { ...directIng, type: 'ingredient' };
      } else if (entityType === 'subtype' || parentId) {
        for (const ing of ingredients) {
          const sub = (ing.subtypes || []).find(s => String(s.id) === String(entityId));
          if (sub) {
            item = { ...sub, parentId: ing.id, parentIngredientId: ing.id, parentName: ing.name, category: ing.category, type: 'subtype' };
            break;
          }
        }
      }
    }

    if (!item) {
      const rowEl = e?.target?.closest ? e.target.closest('.dq-issue-row, tr, .card') : null;
      const nameEl = rowEl ? rowEl.querySelector('strong, h4, .item-name, td') : null;
      item = {
        id: entityId,
        name: nameEl ? nameEl.textContent.trim() : 'Unlinked Catalog Item',
        type: entityType,
        parentId: parentId || null
      };
    }

    item.gapKey = issueKey;

    if (entityType === 'product') {
      if (typeof window.openProductEditModal === 'function') {
        window.openProductEditModal(entityId);
      } else if (typeof openProductEditModal === 'function') {
        openProductEditModal(entityId);
      }
    } else if (entityType === 'recipe') {
      if (typeof window.viewRecipe === 'function') {
        window.viewRecipe(entityId);
      }
    } else {
      if (typeof window.openResolveUnlinkedModal === 'function') {
        window.openResolveUnlinkedModal(item, entityType, parentId || item.parentId);
      } else if (typeof openResolveUnlinkedModal === 'function') {
        openResolveUnlinkedModal(item, entityType, parentId || item.parentId);
      }
    }
  } catch (err) {
    console.error('[DataQualityView] handleFixIssue caught error:', err);
  }
}

export function renderDataQualityView() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('view-data');
  if (!container) return;

  const state = (window.Store && typeof window.Store.getState === 'function') 
    ? window.Store.getState() 
    : (typeof getState === 'function' ? getState() : {});
  const scan = runDataQualityScan(state);
  const flaggedMacroRecipes = sweepRecipeMacroQuality(state.recipes || window.state?.recipes || []);

  const renderIssueRow = (issue, dismissible = false) => {
    const parentIdAttr = issue.parentIngredientId ? `'${escapeAttr(issue.parentIngredientId)}'` : 'null';
    const fixAction = `handleFixIssue(event, '${escapeAttr(issue.entityType)}', '${escapeAttr(issue.entityId)}', '${escapeAttr(issue.key)}', ${parentIdAttr})`;
    
    return `
      <div class="dq-issue-row" style="padding:10px 12px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px">
        <div style="min-width:0">
          <div style="font-weight:700;font-size:13px;color:var(--text,#1c1917)">${escapeHtml(issue.title)}</div>
          <div style="font-size:11.5px;color:var(--text2,#78716c);margin-top:2px">${escapeHtml(issue.message)}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          ${dismissible ? `<button type="button" class="btn sm btn-ghost ghost" onclick="dismissAdvisory('${escapeAttr(issue.key)}')">Looks right</button>` : ''}
          <button type="button" class="btn sm btn-primary primary dq-fix-btn" 
            data-entity-type="${escapeAttr(issue.entityType)}" 
            data-entity-id="${escapeAttr(issue.entityId)}" 
            data-issue-key="${escapeAttr(issue.key)}" 
            data-parent-id="${escapeAttr(issue.parentIngredientId || '')}" 
            onclick="${fixAction}">Fix</button>
        </div>
      </div>
    `;
  };

  const macroSweepCardHtml = `
    <div class="dq-macro-sweep-card" style="margin-bottom:14px;background:${flaggedMacroRecipes.length > 0 ? '#fef2f2' : '#f0fdf4'};border:1px solid ${flaggedMacroRecipes.length > 0 ? '#fecaca' : '#bbf7d0'};border-radius:12px;padding:12px 14px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:16px">${flaggedMacroRecipes.length > 0 ? '🔴' : '🟢'}</span>
          <strong style="font-size:13.5px;color:${flaggedMacroRecipes.length > 0 ? '#991b1b' : '#166534'}">
            ${flaggedMacroRecipes.length} recipes missing calorie/protein data required for Fit Score calculation.
          </strong>
        </div>
        <span class="badge" style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:${flaggedMacroRecipes.length > 0 ? '#fee2e2' : '#dcfce7'};color:${flaggedMacroRecipes.length > 0 ? '#b91c1c' : '#15803d'}">
          ${flaggedMacroRecipes.length > 0 ? `${flaggedMacroRecipes.length} Action Required` : 'All Recipes Validated'}
        </span>
      </div>
      ${flaggedMacroRecipes.length > 0 ? `
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto">
          ${flaggedMacroRecipes.map(r => `
            <div class="dq-issue-row" style="padding:8px 10px;background:#ffffff;border:1px solid #fecaca;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:10px">
              <div style="min-width:0">
                <div style="font-weight:700;font-size:12.5px;color:#1c1917">${escapeHtml(r.name)}</div>
                <div style="font-size:11px;color:#78716c">Calories: ${r.calories !== null ? `${r.calories} kcal` : 'missing'} · Protein: ${r.protein !== null ? `${r.protein}g` : 'missing'}</div>
              </div>
              <button type="button" class="btn sm btn-primary primary dq-fix-btn" data-entity-type="recipe" data-entity-id="${escapeAttr(r.id)}" onclick="handleFixIssue(event, 'recipe', '${escapeAttr(r.id)}', 'macro:recipe:${escapeAttr(r.id)}')">Inspect Recipe</button>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  container.innerHTML = `
    <div class="view-toolbar" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:20px">🛡️</span>
        <h1 class="view-title" style="margin:0">Data Quality Centre</h1>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn sm btn-primary primary" type="button" onclick="window.openHierarchyWizardModal?.()">🪄 Run Hierarchy Wizard</button>
        <button class="btn sm btn-ghost ghost" type="button" onclick="window.runGlobalProductRelink?.()">Batch Relink Products</button>
        <button class="btn sm btn-ghost ghost" type="button" onclick="renderDataQualityView()">Refresh Scans</button>
      </div>
    </div>

    ${macroSweepCardHtml}

    <!-- 1. Calculation Blockers Section -->
    <details open style="margin-bottom:14px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:12px;padding:12px">
      <summary style="cursor:pointer;font-weight:750;font-size:14px;color:var(--red,#ef4444);display:flex;align-items:center;justify-content:space-between">
        <span>❌ Calculation Blockers (${scan.blockers.length})</span>
      </summary>
      <div style="margin-top:10px">
        ${scan.blockers.length ? scan.blockers.map(issue => renderIssueRow(issue, false)).join('') : `
          <div class="msg success" style="margin:0;font-size:12.5px">No calculation blockers detected. Beautiful data!</div>
        `}
      </div>
    </details>

    <!-- 2. Other Data Gaps Section -->
    <details open style="margin-bottom:14px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:12px;padding:12px">
      <summary style="cursor:pointer;font-weight:750;font-size:14px;color:var(--amber,#f59e0b);display:flex;align-items:center;justify-content:space-between">
        <span>⚠️ Other Data Gaps (${scan.gaps.length})</span>
      </summary>
      <div style="margin-top:10px">
        ${scan.gaps.length ? scan.gaps.map(issue => renderIssueRow(issue, false)).join('') : `
          <div class="msg success" style="margin:0;font-size:12.5px">No other data gaps detected. Products are fully mapped!</div>
        `}
      </div>
    </details>

    <!-- 3. Heuristic Advisories Section -->
    <details style="margin-bottom:14px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:12px;padding:12px">
      <summary style="cursor:pointer;font-weight:750;font-size:14px;color:var(--primary,#4f46e5);display:flex;align-items:center;justify-content:space-between">
        <span>💡 Heuristic Advisories (${scan.advisories.length})</span>
      </summary>
      <div style="margin-top:10px">
        ${scan.advisories.length ? scan.advisories.map(issue => renderIssueRow(issue, true)).join('') : `
          <div class="msg success" style="margin:0;font-size:12.5px">No active advisories. Everything looks highly realistic.</div>
        `}
      </div>
    </details>
  `;

  // Update dynamic sidebar navigation counters & badges
  updateDataQualityBadge(scan.totalCount + flaggedMacroRecipes.length, scan.blockers.length + flaggedMacroRecipes.length, scan.gaps.length);
}

export function updateDataQualityBadge(count = 0, blockers = 0, gaps = 0) {
  document.querySelectorAll('[data-view="data"], [data-view="quality"]').forEach(el => {
    let badge = el.querySelector('.dq-nav-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'dq-nav-badge nav-badge';
        badge.style.cssText = 'margin-left:6px;font-size:11px;font-weight:700;padding:2px 6px;border-radius:10px;line-height:1;display:inline-block;';
        el.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : count;
      badge.title = `${blockers} blockers, ${gaps} gaps, ${count} total issues`;
      if (blockers > 0) {
        badge.style.background = 'var(--red-bg, rgba(239,68,68,0.15))';
        badge.style.color = 'var(--red, #dc2626)';
      } else {
        badge.style.background = 'var(--amber-bg, rgba(245,158,11,0.15))';
        badge.style.color = 'var(--amber, #d97706)';
      }
    } else if (badge) {
      badge.remove();
    }
  });
}

let isSubscribed = false;
export function initDataQualitySubscriptions() {
  if (isSubscribed) return;
  isSubscribed = true;

  subscribe('ingredients', () => renderDataQualityView());
  subscribe('products', () => renderDataQualityView());
  subscribe('recipes', () => renderDataQualityView());

  if (typeof document !== 'undefined') {
    document.addEventListener('plateplan:state:ingredients', () => renderDataQualityView());
    document.addEventListener('plateplan:state:products', () => renderDataQualityView());
    document.addEventListener('plateplan:state:recipes', () => renderDataQualityView());
  }
}

export function mount(container) {
  initDataQualitySubscriptions();
  renderDataQualityView();
}

// Global window registration and event delegation fallback
if (typeof window !== 'undefined') {
  window.renderDataQualityView = renderDataQualityView;
  window.renderDataQuality = renderDataQualityView;
  window.openHierarchyWizardModal = openHierarchyWizardModal;
  window.dismissAdvisory = dismissAdvisory;
  window.handleFixIssue = handleFixIssue;
  window.runGlobalProductRelink = runGlobalProductRelink;
  window.batchRelinkProducts = runGlobalProductRelink;
  window.updateDataQualityBadge = updateDataQualityBadge;

  // Event Delegation Fallback
  if (typeof document !== 'undefined' && !window.__dq_fix_delegation_bound) {
    window.__dq_fix_delegation_bound = true;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.dq-fix-btn');
      if (btn && typeof window.handleFixIssue === 'function') {
        const entityType = btn.getAttribute('data-entity-type');
        const entityId = btn.getAttribute('data-entity-id');
        const issueKey = btn.getAttribute('data-issue-key') || '';
        const parentId = btn.getAttribute('data-parent-id') || null;
        if (entityType && entityId) {
          window.handleFixIssue(e, entityType, entityId, issueKey, parentId);
        }
      }
    });
  }
}
