/**
 * src/views/DataQualityView.js (v3.20.13)
 * Modular ES6 View for Data Quality Centre, audit scanner results, macro quality sweep, and dynamic macro recalibration.
 */

import { getState, subscribe, setPreferences } from '../store/store.js';
import { savePreferences, saveRecipe } from '../services/HouseholdRepository.js';
import { runDataQualityScan, calculateRecipeDynamicMacros } from '../services/DataQualityScannerService.js';
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

    if (typeof window.renderDataQualityView === 'function') {
      window.renderDataQualityView();
    }
  } catch (err) {
    console.error('[DataQualityView] runGlobalProductRelink caught error:', err);
  }
}

export async function autoRecalibrateRecipeMacros(recipeId) {
  try {
    const state = (window.Store && typeof window.Store.getState === 'function') 
      ? window.Store.getState() 
      : (typeof getState === 'function' ? getState() : {});
    const recipes = Array.isArray(state.recipes) ? [...state.recipes] : (window.state?.recipes ? [...window.state.recipes] : []);
    const rIndex = recipes.findIndex(rec => String(rec.id) === String(recipeId));
    if (rIndex < 0) return;

    const r = { ...recipes[rIndex] };
    const dynamic = calculateRecipeDynamicMacros(r, state.ingredients || [], state.products || []);
    if (!dynamic) return;

    r.macros = {
      calories: dynamic.perServing.cal,
      protein: dynamic.perServing.prot,
      carbs: dynamic.perServing.carb,
      fat: dynamic.perServing.fat,
      price: dynamic.perServing.cost
    };
    r.cal = dynamic.perServing.cal;
    r.calories = dynamic.perServing.cal;
    r.prot = dynamic.perServing.prot;
    r.protein = dynamic.perServing.prot;
    r.carb = dynamic.perServing.carb;
    r.carbs = dynamic.perServing.carb;
    r.fat = dynamic.perServing.fat;
    r.updatedAt = new Date().toISOString();

    recipes[rIndex] = r;
    if (window.Store?.setState) window.Store.setState({ recipes });
    if (window.state) window.state.recipes = recipes;
    if (typeof window.recipes !== 'undefined') window.recipes = recipes;

    try {
      await saveRecipe(r);
    } catch (e) {
      console.warn('[DataQualityView] Failed to save recalibrated recipe to cloud:', e);
    }

    document.dispatchEvent(new CustomEvent('plateplan:state:recipes', { detail: recipes }));
    document.dispatchEvent(new CustomEvent('plateplan:recipes-updated', { detail: recipes }));
    renderDataQualityView();
  } catch (err) {
    console.error('[DataQualityView] autoRecalibrateRecipeMacros error:', err);
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
      if (issueKey.includes('macro-sync')) {
        autoRecalibrateRecipeMacros(entityId);
        return;
      }
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
          ${dismissible ? `<button type="button" class="btn sm btn-ghost ghost" data-action="dismiss-advisory" data-issue-key="${escapeAttr(issue.key)}">Looks right</button>` : ''}
          ${issue.isMacroSyncError ? `<button type="button" class="btn sm primary" style="background:var(--primary,#4f46e5);color:#fff" data-action="auto-recalibrate" data-recipe-id="${escapeAttr(issue.entityId)}">Auto-Recalibrate Macros from Ingredients</button>` : ''}
          <button type="button" class="btn sm btn-primary primary dq-fix-btn" 
            data-entity-type="${escapeAttr(issue.entityType)}" 
            data-entity-id="${escapeAttr(issue.entityId)}" 
            data-issue-key="${escapeAttr(issue.key)}" 
            data-parent-id="${escapeAttr(issue.parentIngredientId || '')}" 
            data-action="fix-issue">Fix</button>
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
              <div style="display:flex;gap:6px">
                <button type="button" class="btn xs primary" style="background:var(--primary,#4f46e5);color:#fff" onclick="autoRecalibrateRecipeMacros('${escapeAttr(r.id)}')">Auto-Recalibrate</button>
                <button type="button" class="btn xs ghost" onclick="handleFixIssue(event, 'recipe', '${escapeAttr(r.id)}')">View</button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  container.innerHTML = `
    <div style="max-width:900px;margin:0 auto;padding:20px;box-sizing:border-box">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <h2 style="font-size:22px;font-weight:750;margin:0;color:var(--text,#1c1917)">Data Quality Centre</h2>
          <p style="margin:4px 0 0 0;font-size:13px;color:var(--text2,#78716c)">Catalogue audit scanner, recipe macro validation, and structural health advisory.</p>
        </div>
        <div style="display:flex;gap:8px">
          <button type="button" class="btn sm secondary" data-action="auto-relink">⚡ Auto-Relink Catalog</button>
          <button type="button" class="btn sm ghost" data-action="refresh-audit">🔄 Refresh Audit</button>
        </div>
      </div>

      ${macroSweepCardHtml}

      <div style="display:grid;grid-template-columns:1fr;gap:16px">
        <div class="card" style="background:var(--surface,#fff);border-radius:14px;padding:18px;border:1px solid var(--border,#e7e5e4)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 style="margin:0;font-size:15px;font-weight:750;color:var(--text,#1c1917)">🚨 Calculation Blockers (${scan.blockers.length})</h3>
            <span style="font-size:12px;color:var(--text2,#78716c)">Must be resolved for accurate meal planning calculations</span>
          </div>
          ${scan.blockers.length === 0 ? '<div style="font-size:13px;color:var(--text2,#78716c);padding:10px 0">No calculation blockers detected. Excellent!</div>' : scan.blockers.map(b => renderIssueRow(b)).join('')}
        </div>

        <div class="card" style="background:var(--surface,#fff);border-radius:14px;padding:18px;border:1px solid var(--border,#e7e5e4)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 style="margin:0;font-size:15px;font-weight:750;color:var(--text,#1c1917)">⚠️ Data Gaps (${scan.gaps.length})</h3>
            <span style="font-size:12px;color:var(--text2,#78716c)">Ingredients lacking linked grocery products</span>
          </div>
          ${scan.gaps.length === 0 ? '<div style="font-size:13px;color:var(--text2,#78716c);padding:10px 0">No data gaps detected.</div>' : scan.gaps.map(g => renderIssueRow(g)).join('')}
        </div>

        <div class="card" style="background:var(--surface,#fff);border-radius:14px;padding:18px;border:1px solid var(--border,#e7e5e4)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 style="margin:0;font-size:15px;font-weight:750;color:var(--text,#1c1917)">💡 Advisories &amp; Outliers (${scan.advisories.length})</h3>
            <span style="font-size:12px;color:var(--text2,#78716c)">Recommendations &amp; macro synchronisation checks</span>
          </div>
          ${scan.advisories.length === 0 ? '<div style="font-size:13px;color:var(--text2,#78716c);padding:10px 0">No active advisories.</div>' : scan.advisories.map(a => renderIssueRow(a, true)).join('')}
        </div>
      </div>
    </div>
  `;

  container.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const key = btn.dataset.issueKey;
    const id = btn.dataset.recipeId;
    if (action === 'dismiss-advisory') {
      dismissAdvisory(key);
    } else if (action === 'auto-recalibrate') {
      autoRecalibrateRecipeMacros(id);
    } else if (action === 'auto-relink') {
      runGlobalProductRelink();
    } else if (action === 'refresh-audit') {
      renderDataQualityView();
    } else if (action === 'fix-issue' || action === 'fix-recipe') {
      handleFixIssue(e, btn.dataset.entityType, btn.dataset.entityId || id, btn.dataset.issueKey, btn.dataset.parentId);
    }
  };
}

if (typeof document !== 'undefined' && !window.__dq_action_listener_bound) {
  window.__dq_action_listener_bound = true;
  document.addEventListener('plateplan-action', (e) => {
    const { action, target, id } = e.detail || {};
    if (action === 'auto-recalibrate') {
      const recipeId = id || target?.dataset?.recipeId || target?.dataset?.entityId;
      if (recipeId && typeof autoRecalibrateRecipeMacros === 'function') {
        autoRecalibrateRecipeMacros(recipeId);
      }
    } else if (action === 'fix-recipe' || action === 'fix-issue') {
      const entityId = id || target?.dataset?.entityId;
      const entityType = target?.dataset?.entityType || 'recipe';
      const issueKey = target?.dataset?.issueKey;
      const parentId = target?.dataset?.parentId;
      if (typeof handleFixIssue === 'function') {
        handleFixIssue(e, entityType, entityId, issueKey, parentId);
      }
    }
  });
}

function updateDataQualityBadge() {
  const badge = document.getElementById('dq-badge-count');
  if (!badge) return;
  const state = (window.Store && typeof window.Store.getState === 'function') 
    ? window.Store.getState() 
    : (typeof getState === 'function' ? getState() : {});
  const scan = runDataQualityScan(state);
  const flaggedMacroRecipes = sweepRecipeMacroQuality(state.recipes || window.state?.recipes || []);
  const total = scan.totalCount + flaggedMacroRecipes.length;
  badge.textContent = total;
  badge.style.display = total > 0 ? 'inline-flex' : 'none';
}

function initDataQualitySubscriptions() {
  if (typeof document === 'undefined') return;
  document.addEventListener('plateplan:state:ingredients', () => renderDataQualityView());
  document.addEventListener('plateplan:state:products', () => renderDataQualityView());
  document.addEventListener('plateplan:state:recipes', () => renderDataQualityView());
}

export function mount(container) {
  initDataQualitySubscriptions();
  renderDataQualityView();
}

if (typeof window !== 'undefined') {
  window.renderDataQualityView = renderDataQualityView;
  window.renderDataQuality = renderDataQualityView;
  window.openHierarchyWizardModal = openHierarchyWizardModal;
  window.dismissAdvisory = dismissAdvisory;
  window.handleFixIssue = handleFixIssue;
  window.runGlobalProductRelink = runGlobalProductRelink;
  window.batchRelinkProducts = runGlobalProductRelink;
  window.updateDataQualityBadge = updateDataQualityBadge;
  window.autoRecalibrateRecipeMacros = autoRecalibrateRecipeMacros;

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
