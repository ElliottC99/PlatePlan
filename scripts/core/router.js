/**
 * scripts/core/router.js
 * PlatePlan Core Router & Action Delegation System (v3.3.7-mod)
 */

(() => {
  // Navigation & Router State
  let platePlanLastMobileFocus = null;
  let platePlanReturningFromUiClose = false;
  let platePlanHandlingHistoryPop = false;

  function isMobilePlatePlan() {
    return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width:839px)').matches : false;
  }

  function returnFromPlatePlanUiHistory() {
    platePlanReturningFromUiClose = true;
    if (typeof history !== 'undefined' && history.back) {
      history.back();
    }
  }

  function markMobileLayerForBack(wrap, kind) {
    if (!wrap || !isMobilePlatePlan() || wrap.dataset.historyEntry === '1') return;
    try {
      const activeMarked = document.querySelector('.modal-wrap.open[data-history-entry="1"],.mobile-more-wrap.open[data-history-entry="1"],.mobile-action-sheet-wrap.open[data-history-entry="1"]');
      const nextState = { ...(history.state || {}), platePlanLayer: kind };
      if (history.state?.platePlanLayer && !activeMarked) history.replaceState(nextState, '');
      else history.pushState(nextState, '');
      wrap.dataset.historyEntry = '1';
    } catch (_err) {}
  }

  function restoreMobileLayerFocus() {
    const target = platePlanLastMobileFocus;
    platePlanLastMobileFocus = null;
    if (target && document.contains(target)) setTimeout(() => target.focus?.(), 0);
  }

  function openMobileMore() {
    const wrap = document.getElementById('mobile-more-wrap');
    if (!wrap) return;
    platePlanLastMobileFocus = document.activeElement;
    wrap.classList.add('open');
    markMobileLayerForBack(wrap, 'more');
    setTimeout(() => wrap.querySelector('button')?.focus(), 0);
  }

  function closeMobileMore(fromHistory = false) {
    const wrap = document.getElementById('mobile-more-wrap');
    if (!wrap) return;
    const marked = wrap.dataset.historyEntry === '1';
    wrap.classList.remove('open');
    delete wrap.dataset.historyEntry;
    restoreMobileLayerFocus();
    if (marked && !fromHistory) returnFromPlatePlanUiHistory();
  }

  function mobileMoreView(id) {
    closeMobileMore();
    showView(id);
  }

  function syncMobileNavigation(id) {
    const primary = ['today', 'vault', 'planner', 'data', 'search'].includes(id) ? id : '';
    document.querySelectorAll('#mobile-nav button').forEach(button => button.classList.toggle('active', button.dataset.view === primary));
  }

  function closeMobileActionSheet(fromHistory = false) {
    const wrap = document.getElementById('mobile-action-sheet-wrap');
    if (!wrap) return;
    const marked = wrap.dataset.historyEntry === '1';
    wrap.classList.remove('open');
    delete wrap.dataset.historyEntry;
    restoreMobileLayerFocus();
    if (marked && !fromHistory) returnFromPlatePlanUiHistory();
  }

  function executeSheetAction(actionFnName, ...args) {
    const sheet = document.getElementById('mobile-action-sheet');
    const overlay = document.getElementById('mobile-action-sheet-overlay');
    const wrap = document.getElementById('mobile-action-sheet-wrap');
    if (sheet) sheet.classList.remove('open', 'active');
    if (overlay) overlay.classList.remove('open', 'active');
    if (wrap) wrap.classList.remove('open', 'active');

    setTimeout(() => {
      if (typeof window[actionFnName] === 'function') {
        window[actionFnName](...args);
      } else if (typeof actionFnName === 'function') {
        actionFnName(...args);
      } else if (typeof eval !== 'undefined') {
        try {
          const fn = eval(actionFnName);
          if (typeof fn === 'function') fn(...args);
        } catch (e) {
          console.error(`[executeSheetAction] Function '${actionFnName}' execution failed.`, e);
        }
      } else {
        console.error(`[executeSheetAction] Action '${actionFnName}' not found on window.`);
      }
    }, 50);
  }

  function installPlatePlanModalHistory() {
    if (!isMobilePlatePlan() || !document.body || document.body.dataset.modalHistoryReady === '1') return;
    document.body.dataset.modalHistoryReady = '1';
    new MutationObserver(records => records.forEach(record => {
      const wrap = record.target;
      if (!(wrap instanceof HTMLElement) || !wrap.classList.contains('modal-wrap')) return;
      if (wrap.classList.contains('open')) markMobileLayerForBack(wrap, 'modal');
      else if (wrap.dataset.historyEntry === '1') {
        delete wrap.dataset.historyEntry;
        if (!platePlanHandlingHistoryPop) returnFromPlatePlanUiHistory();
      }
    })).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  // Top bar & navigation bindings
  function bindTopBarActionListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = 'true';
      logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (typeof window.logout === 'function') window.logout();
      });
    }

    document.querySelectorAll('.sync-now-btn').forEach(btn => {
      if (!btn.dataset.bound) {
        btn.dataset.bound = 'true';
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          if (typeof window.syncNow === 'function') window.syncNow();
        });
      }
    });

    const syncBadge = document.getElementById('sync-status');
    if (syncBadge && !syncBadge.dataset.bound) {
      syncBadge.dataset.bound = 'true';
      syncBadge.addEventListener('click', function(e) {
        if (typeof window.openPlatePlanSyncPanel === 'function') {
          window.openPlatePlanSyncPanel();
        } else if (typeof window.syncNow === 'function') {
          window.syncNow();
        }
      });
    }
  }

  // View Routing & Renderers
  function renderPlatePlanLegacyView(id) {
    if (id === 'today') {
      (window.resetTodayDate || window.PlatePlanPlanner?.resetTodayDate || (typeof resetTodayDate !== 'undefined' ? resetTodayDate : () => {}))({ render: false });
      if (typeof renderToday === 'function') renderToday(); else window.PlatePlanPlanner?.renderToday?.();
    }
    if (id === 'vault') {
      if (typeof window.renderVault === 'function') window.renderVault();
      else if (typeof renderVault === 'function') renderVault();
    }
    if (id === 'add') {
      if (window.platePlanPendingRecipePreFill) {
        if (typeof applyPendingRecipePreFillToForm === 'function') applyPendingRecipePreFillToForm();
      } else if (!window.editId && !window.platePlanPreserveAddForm) {
        if (typeof clearForm === 'function') clearForm();
      }
      window.platePlanPreserveAddForm = false;
    }
    if (id === 'ingredients') {
      if (typeof renderIngredientBank === 'function') renderIngredientBank(); else window.PlatePlanIngredientBank?.renderIngredientBank?.();
    }
    if (id === 'bank') {
      if (typeof renderBank === 'function') renderBank(); else window.PlatePlanIngredientBank?.renderBank?.();
    }
    if (id === 'planner') {
      (window.ensurePlannerShell || window.PlatePlanPlanner?.ensurePlannerShell || (typeof ensurePlannerShell !== 'undefined' ? ensurePlannerShell : () => {}))();
      const daySel = document.getElementById('plan-days');
      if (daySel && window.state?.plan?.days) daySel.value = String(window.state.plan.days);
      if (typeof buildExclGrid === 'function') buildExclGrid();
      if (typeof renderPlan === 'function') renderPlan(); else window.PlatePlanPlanner?.renderPlan?.();
    }
    if (id === 'planlib') {
      (window.ensurePlannerShell || window.PlatePlanPlanner?.ensurePlannerShell || (typeof ensurePlannerShell !== 'undefined' ? ensurePlannerShell : () => {}))();
      if (typeof renderPlanHistoryPanel === 'function') renderPlanHistoryPanel(); else window.PlatePlanPlanner?.renderPlanHistoryPanel?.();
    }
    if (id === 'shopping') {
      if (typeof renderShopping === 'function') renderShopping(); else window.PlatePlanShoppingList?.renderShopping?.();
    }
    if (id === 'prefs') {
      if (typeof loadPrefs === 'function') loadPrefs();
    }
    if (id === 'data') {
      if (typeof renderDataQuality === 'function') renderDataQuality();
    }
  }

  const platePlanFeatureRenderers = Object.freeze({
    today() {
      (window.resetTodayDate || window.PlatePlanPlanner?.resetTodayDate || (typeof resetTodayDate !== 'undefined' ? resetTodayDate : () => {}))({ render: false });
      return typeof renderToday === 'function' ? renderToday() : window.PlatePlanPlanner?.renderToday?.();
    },
    vault() {
      if (typeof window !== 'undefined' && typeof window.renderVault === 'function') {
        return window.renderVault();
      }
      return typeof renderVault === 'function' ? renderVault() : null;
    },
    add() {
      if (window.platePlanPendingRecipePreFill) {
        if (typeof applyPendingRecipePreFillToForm === 'function') applyPendingRecipePreFillToForm();
      } else if (!window.editId && !window.platePlanPreserveAddForm) {
        if (typeof clearForm === 'function') clearForm();
      }
      window.platePlanPreserveAddForm = false;
    },
    ingredients() { return typeof renderIngredientBank === 'function' ? renderIngredientBank() : window.PlatePlanIngredientBank?.renderIngredientBank?.(); },
    bank() { return typeof renderBank === 'function' ? renderBank() : window.PlatePlanIngredientBank?.renderBank?.(); },
    planner() {
      (window.ensurePlannerShell || window.PlatePlanPlanner?.ensurePlannerShell || (typeof ensurePlannerShell !== 'undefined' ? ensurePlannerShell : () => {}))();
      const daySel = document.getElementById('plan-days');
      if (daySel && window.state?.plan?.days) daySel.value = String(window.state.plan.days);
      if (typeof buildExclGrid === 'function') buildExclGrid();
      return typeof renderPlan === 'function' ? renderPlan() : window.PlatePlanPlanner?.renderPlan?.();
    },
    planlib() {
      (window.ensurePlannerShell || window.PlatePlanPlanner?.ensurePlannerShell || (typeof ensurePlannerShell !== 'undefined' ? ensurePlannerShell : () => {}))();
      return typeof renderPlanHistoryPanel === 'function' ? renderPlanHistoryPanel() : window.PlatePlanPlanner?.renderPlanHistoryPanel?.();
    },
    shopping() { return typeof renderShopping === 'function' ? renderShopping() : window.PlatePlanShoppingList?.renderShopping?.(); },
    prefs() { return typeof loadPrefs === 'function' ? loadPrefs() : null; },
    data() { return typeof renderDataQuality === 'function' ? renderDataQuality() : null; }
  });

  function requestPlatePlanViewRender(id) {
    if (globalThis.PlatePlanModules?.renderView) {
      globalThis.PlatePlanModules.renderView(id);
      return;
    }
    renderPlatePlanLegacyView(id);
  }

  function showView(id) {
    document.querySelectorAll('.desktop-sidebar .ntab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === id));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById('view-' + id);
    if (view) view.classList.add('active');
    syncMobileNavigation(id);
    requestPlatePlanViewRender(id);
    if (window.platePlanDirtyViews) window.platePlanDirtyViews.delete(id);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function switchTab(id) {
    showView(id);
  }

  function openPlatePlanSearchResult(type, id, title = '') {
    if (type === 'recipe') {
      showView('vault');
      setTimeout(() => (typeof window.viewRecipe === 'function' ? window.viewRecipe(id) : window.PlatePlanRecipeEditor?.viewRecipe?.(id)), 0);
      return;
    }
    if (type === 'ingredient' || type === 'subtype') {
      showView('ingredients');
      setTimeout(() => {
        const input = document.getElementById('ingredient-group-search');
        if (input) input.value = title || '';
        if (typeof renderIngredientBank === 'function') renderIngredientBank(); else window.PlatePlanIngredientBank?.renderIngredientBank?.();
        input?.focus();
      }, 0);
      return;
    }
    if (type === 'product') {
      showView('bank');
      setTimeout(() => {
        const input = document.getElementById('bank-search');
        if (input) input.value = title || '';
        if (typeof renderBank === 'function') renderBank(); else window.PlatePlanIngredientBank?.renderBank?.();
        input?.focus();
      }, 0);
      return;
    }
    if (type === 'plan') showView('planlib');
  }

  // Delegated Action Router
  function runPlatePlanDelegatedAction(code, event, element) {
    if (!code || typeof code !== 'string') return undefined;
    const delegatedEvent = (event && typeof event === 'object') ? new Proxy(event, {
      get(target, prop) {
        if (prop === 'currentTarget') return element;
        const val = target[prop];
        return typeof val === 'function' ? val.bind(target) : val;
      }
    }) : event;
    return (function delegatedPlatePlanAction(event) {
      const targetElement = element || (event && (event.currentTarget || event.target));
      const isSubtypeFix = (targetElement?.dataset?.action === 'fix-subtype') ||
        targetElement?.hasAttribute?.('data-subtype-id') ||
        (code && (code.includes("beginDataQualityFix('subtype'") || code.includes('beginDataQualityFix("subtype"') || code.includes('fixSubtypeDataQuality')));

      if (isSubtypeFix) {
        let subTypeId = targetElement?.dataset?.subtypeId || targetElement?.getAttribute?.('data-subtype-id');
        if (!subTypeId && code) {
          const match = code.match(/beginDataQualityFix\(['"]subtype['"],\s*['"]([^'"]+)['"]/);
          if (match) subTypeId = match[1];
          else {
            const directMatch = code.match(/fixSubtypeDataQuality\(['"]([^'"]+)['"]/);
            if (directMatch) subTypeId = directMatch[1];
          }
        }
        if (subTypeId) {
          const fixFn = typeof window.fixSubtypeDataQuality === 'function' ? window.fixSubtypeDataQuality : (typeof fixSubtypeDataQuality === 'function' ? fixSubtypeDataQuality : null);
          if (typeof fixFn === 'function') return fixFn(subTypeId);
        }
      }

      const viewMatch = typeof code === 'string' && code.trim().match(/^viewRecipe\s*\(\s*(['"][^'"]+['"]|[^\s,]+)(?:\s*,\s*([^)]*))?\)\s*;?$/);
      if (viewMatch) {
        let recId = viewMatch[1];
        if ((recId.startsWith("'") && recId.endsWith("'")) || (recId.startsWith('"') && recId.endsWith('"'))) {
          recId = recId.slice(1, -1);
        }
        let secondArg = null;
        if (viewMatch[2]) {
          const rawSecond = viewMatch[2].trim();
          if (rawSecond === 'null' || rawSecond === 'undefined') {
            secondArg = null;
          } else if ((rawSecond.startsWith("'") && rawSecond.endsWith("'")) || (rawSecond.startsWith('"') && rawSecond.endsWith('"'))) {
            secondArg = rawSecond.slice(1, -1);
          } else {
            secondArg = rawSecond;
          }
        }
        if (typeof window.viewRecipe === 'function') {
          return window.viewRecipe(recId, secondArg);
        } else if (typeof viewRecipe === 'function') {
          return viewRecipe(recId, secondArg);
        } else if (window.PlatePlanRecipeEditor?.viewRecipe) {
          return window.PlatePlanRecipeEditor.viewRecipe(recId, secondArg);
        }
      }

      return eval(code);
    }).call(element, delegatedEvent);
  }

  function renderAll() {
    if (window.isHydrating || (!window.isPlatePlanHydrated && !window.PlatePlanState?.isReady)) {
      return;
    }
    if (typeof window.renderAll === 'function' && window.renderAll !== renderAll) {
      return window.renderAll();
    }
    if (typeof window.PlatePlanCloud?.renderAll === 'function') {
      return window.PlatePlanCloud.renderAll();
    }
    if (typeof refreshPlatePlanDerivedState === 'function') {
      refreshPlatePlanDerivedState({ persist: false, render: true, full: true });
    }
  }

  // Initialize event listeners when DOM is loaded
  if (typeof document !== 'undefined') {
    const onDomReady = () => {
      bindTopBarActionListeners();
      installPlatePlanModalHistory();

      window.addEventListener('popstate', () => {
        if (platePlanReturningFromUiClose) { platePlanReturningFromUiClose = false; return; }
        platePlanHandlingHistoryPop = true;
        const action = document.getElementById('mobile-action-sheet-wrap');
        if (action?.classList.contains('open')) { closeMobileActionSheet(true); setTimeout(() => platePlanHandlingHistoryPop = false, 0); return; }
        const more = document.getElementById('mobile-more-wrap');
        if (more?.classList.contains('open')) { closeMobileMore(true); setTimeout(() => platePlanHandlingHistoryPop = false, 0); return; }
        const modal = Array.from(document.querySelectorAll('.modal-wrap.open')).pop();
        const close = modal?.querySelector('button[onclick*="close" i]');
        if (close) close.click(); else modal?.classList.remove('open');
        setTimeout(() => platePlanHandlingHistoryPop = false, 0);
      });

      document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        const action = document.getElementById('mobile-action-sheet-wrap');
        if (action?.classList.contains('open')) { event.preventDefault(); closeMobileActionSheet(); return; }
        const more = document.getElementById('mobile-more-wrap');
        if (more?.classList.contains('open')) { event.preventDefault(); closeMobileMore(); return; }
        const modal = Array.from(document.querySelectorAll('.modal-wrap.open')).pop();
        const close = modal?.querySelector('button[onclick*="close" i]');
        if (close) { event.preventDefault(); close.click(); }
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onDomReady);
    } else {
      onDomReady();
    }
  }

  // Router Public Namespace
  const PlatePlanRouter = Object.freeze({
    bindTopBarActionListeners,
    isMobilePlatePlan,
    returnFromPlatePlanUiHistory,
    markMobileLayerForBack,
    restoreMobileLayerFocus,
    openMobileMore,
    closeMobileMore,
    mobileMoreView,
    syncMobileNavigation,
    closeMobileActionSheet,
    executeSheetAction,
    installPlatePlanModalHistory,
    renderPlatePlanLegacyView,
    renderLegacyView: renderPlatePlanLegacyView,
    platePlanFeatureRenderers,
    requestPlatePlanViewRender,
    showView,
    switchTab: showView,
    openPlatePlanSearchResult,
    runPlatePlanDelegatedAction,
    runDelegatedAction: runPlatePlanDelegatedAction,
    renderAll
  });

  if (typeof window !== 'undefined') {
    window.PlatePlanRouter = PlatePlanRouter;
    window.platePlanFeatureRenderers = platePlanFeatureRenderers;

    // Explicit backward-compatibility bindings on window
    window.bindTopBarActionListeners = bindTopBarActionListeners;
    window.isMobilePlatePlan = isMobilePlatePlan;
    window.markMobileLayerForBack = markMobileLayerForBack;
    window.restoreMobileLayerFocus = restoreMobileLayerFocus;
    window.openMobileMore = openMobileMore;
    window.closeMobileMore = closeMobileMore;
    window.mobileMoreView = mobileMoreView;
    window.syncMobileNavigation = syncMobileNavigation;
    window.closeMobileActionSheet = closeMobileActionSheet;
    window.executeSheetAction = executeSheetAction;
    window.installPlatePlanModalHistory = installPlatePlanModalHistory;
    window.renderPlatePlanLegacyView = renderPlatePlanLegacyView;
    window.renderLegacyView = renderPlatePlanLegacyView;
    window.requestPlatePlanViewRender = requestPlatePlanViewRender;
    window.showView = showView;
    window.switchTab = showView;
    window.openPlatePlanSearchResult = openPlatePlanSearchResult;
    window.runPlatePlanDelegatedAction = runPlatePlanDelegatedAction;
    window.runDelegatedAction = runPlatePlanDelegatedAction;
  }
})();
