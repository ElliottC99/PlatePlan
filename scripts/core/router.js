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
      if (typeof window.PlatePlanViews?.renderToday === 'function') {
        window.PlatePlanViews.renderToday();
      } else if (typeof window.PlatePlanPlanner?.renderToday === 'function') {
        window.PlatePlanPlanner.renderToday();
      } else if (typeof window.renderToday === 'function') {
        window.renderToday();
      } else if (typeof renderToday === 'function') {
        renderToday();
      } else {
        console.warn('[Router] No renderer found for today view');
      }
    }
    if (id === 'vault') {
      if (typeof window.PlatePlanRecipes?.renderVault === 'function') {
        window.PlatePlanRecipes.renderVault();
      } else if (typeof window.PlatePlanViews?.renderVault === 'function') {
        window.PlatePlanViews.renderVault();
      } else if (typeof window.renderVault === 'function') {
        window.renderVault();
      } else if (typeof window.renderRecipes === 'function') {
        window.renderRecipes();
      } else if (typeof renderVault === 'function') {
        renderVault();
      } else {
        console.warn('[Router] No renderer found for recipes/vault view');
      }
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
      if (typeof window.PlatePlanIngredientBank?.renderIngredientBank === 'function') {
        window.PlatePlanIngredientBank.renderIngredientBank();
      } else if (typeof window.PlatePlanIngredientBank?.renderIngredients === 'function') {
        window.PlatePlanIngredientBank.renderIngredients();
      } else if (typeof window.renderIngredientBank === 'function') {
        window.renderIngredientBank();
      } else if (typeof renderIngredientBank === 'function') {
        renderIngredientBank();
      } else {
        console.warn('[Router] No renderer found for ingredient bank view');
      }
    }
    if (id === 'bank') {
      if (typeof window.PlatePlanIngredientBank?.renderProductBank === 'function') {
        window.PlatePlanIngredientBank.renderProductBank();
      } else if (typeof window.PlatePlanIngredientBank?.renderBank === 'function') {
        window.PlatePlanIngredientBank.renderBank();
      } else if (typeof window.renderProductBank === 'function') {
        window.renderProductBank();
      } else if (typeof window.renderBank === 'function') {
        window.renderBank();
      } else if (typeof renderBank === 'function') {
        renderBank();
      } else {
        console.warn('[Router] No renderer found for product bank view');
      }
    }
    if (id === 'planner') {
      (window.ensurePlannerShell || window.PlatePlanPlanner?.ensurePlannerShell || (typeof ensurePlannerShell !== 'undefined' ? ensurePlannerShell : () => {}))();
      const daySel = document.getElementById('plan-days');
      if (daySel && window.state?.plan?.days) daySel.value = String(window.state.plan.days);
      if (typeof buildExclGrid === 'function') buildExclGrid();
      if (typeof window.PlatePlanPlanner?.renderPlannerView === 'function') {
        window.PlatePlanPlanner.renderPlannerView();
      } else if (typeof window.PlatePlanPlanner?.renderPlan === 'function') {
        window.PlatePlanPlanner.renderPlan();
      } else if (typeof window.PlatePlanPlanner?.renderPlanner === 'function') {
        window.PlatePlanPlanner.renderPlanner();
      } else if (typeof window.renderPlan === 'function') {
        window.renderPlan();
      } else if (typeof renderPlan === 'function') {
        renderPlan();
      } else {
        console.warn('[Router] No renderer found for planner view');
      }
    }
    if (id === 'planlib') {
      (window.ensurePlannerShell || window.PlatePlanPlanner?.ensurePlannerShell || (typeof ensurePlannerShell !== 'undefined' ? ensurePlannerShell : () => {}))();
      if (typeof window.PlatePlanPlanner?.renderPlanHistoryPanel === 'function') {
        window.PlatePlanPlanner.renderPlanHistoryPanel();
      } else if (typeof window.PlatePlanPlanner?.renderLibrary === 'function') {
        window.PlatePlanPlanner.renderLibrary();
      } else if (typeof window.PlatePlanPlanner?.renderMealPlanLibrary === 'function') {
        window.PlatePlanPlanner.renderMealPlanLibrary();
      } else if (typeof window.renderPlanHistoryPanel === 'function') {
        window.renderPlanHistoryPanel();
      } else if (typeof renderPlanHistoryPanel === 'function') {
        renderPlanHistoryPanel();
      } else {
        console.warn('[Router] No renderer found for meal plan library view');
      }
    }
    if (id === 'shopping') {
      if (typeof window.PlatePlanShoppingList?.renderShopping === 'function') {
        window.PlatePlanShoppingList.renderShopping();
      } else if (typeof window.PlatePlanShopping?.renderShopping === 'function') {
        window.PlatePlanShopping.renderShopping();
      } else if (typeof window.renderShopping === 'function') {
        window.renderShopping();
      } else if (typeof renderShopping === 'function') {
        renderShopping();
      } else {
        console.warn('[Router] No renderer found for shopping view');
      }
    }
    if (id === 'prefs') {
      if (typeof window.PlatePlanSettings?.renderPreferences === 'function') {
        window.PlatePlanSettings.renderPreferences();
      } else if (typeof loadPrefs === 'function') {
        loadPrefs();
      } else if (typeof window.loadPrefs === 'function') {
        window.loadPrefs();
      } else {
        console.warn('[Router] No renderer found for prefs view');
      }
    }
    if (id === 'data') {
      if (typeof window.PlatePlanDataQuality?.renderDataQuality === 'function') {
        window.PlatePlanDataQuality.renderDataQuality();
      } else if (typeof renderDataQuality === 'function') {
        renderDataQuality();
      } else if (typeof window.renderDataQuality === 'function') {
        window.renderDataQuality();
      } else {
        console.warn('[Router] No renderer found for data quality view');
      }
    }
  }

  const platePlanFeatureRenderers = Object.freeze({
    today() {
      (window.resetTodayDate || window.PlatePlanPlanner?.resetTodayDate || (typeof resetTodayDate !== 'undefined' ? resetTodayDate : () => {}))({ render: false });
      if (typeof window.PlatePlanViews?.renderToday === 'function') return window.PlatePlanViews.renderToday();
      if (typeof window.PlatePlanPlanner?.renderToday === 'function') return window.PlatePlanPlanner.renderToday();
      return typeof renderToday === 'function' ? renderToday() : (typeof window.renderToday === 'function' ? window.renderToday() : null);
    },
    vault() {
      if (typeof window.PlatePlanRecipes?.renderVault === 'function') return window.PlatePlanRecipes.renderVault();
      if (typeof window.PlatePlanViews?.renderVault === 'function') return window.PlatePlanViews.renderVault();
      if (typeof window.renderVault === 'function') return window.renderVault();
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
    ingredients() {
      if (typeof window.PlatePlanIngredientBank?.renderIngredientBank === 'function') return window.PlatePlanIngredientBank.renderIngredientBank();
      if (typeof window.PlatePlanIngredientBank?.renderIngredients === 'function') return window.PlatePlanIngredientBank.renderIngredients();
      if (typeof window.renderIngredientBank === 'function') return window.renderIngredientBank();
      return typeof renderIngredientBank === 'function' ? renderIngredientBank() : null;
    },
    bank() {
      if (typeof window.PlatePlanIngredientBank?.renderProductBank === 'function') return window.PlatePlanIngredientBank.renderProductBank();
      if (typeof window.PlatePlanIngredientBank?.renderBank === 'function') return window.PlatePlanIngredientBank.renderBank();
      if (typeof window.renderProductBank === 'function') return window.renderProductBank();
      if (typeof window.renderBank === 'function') return window.renderBank();
      return typeof renderBank === 'function' ? renderBank() : null;
    },
    planner() {
      (window.ensurePlannerShell || window.PlatePlanPlanner?.ensurePlannerShell || (typeof ensurePlannerShell !== 'undefined' ? ensurePlannerShell : () => {}))();
      const daySel = document.getElementById('plan-days');
      if (daySel && window.state?.plan?.days) daySel.value = String(window.state.plan.days);
      if (typeof buildExclGrid === 'function') buildExclGrid();
      if (typeof window.PlatePlanPlanner?.renderPlannerView === 'function') return window.PlatePlanPlanner.renderPlannerView();
      if (typeof window.PlatePlanPlanner?.renderPlan === 'function') return window.PlatePlanPlanner.renderPlan();
      if (typeof window.renderPlan === 'function') return window.renderPlan();
      return typeof renderPlan === 'function' ? renderPlan() : null;
    },
    planlib() {
      (window.ensurePlannerShell || window.PlatePlanPlanner?.ensurePlannerShell || (typeof ensurePlannerShell !== 'undefined' ? ensurePlannerShell : () => {}))();
      if (typeof window.PlatePlanPlanner?.renderPlanHistoryPanel === 'function') return window.PlatePlanPlanner.renderPlanHistoryPanel();
      if (typeof window.PlatePlanPlanner?.renderLibrary === 'function') return window.PlatePlanPlanner.renderLibrary();
      if (typeof window.PlatePlanPlanner?.renderMealPlanLibrary === 'function') return window.PlatePlanPlanner.renderMealPlanLibrary();
      if (typeof window.renderPlanHistoryPanel === 'function') return window.renderPlanHistoryPanel();
      return typeof renderPlanHistoryPanel === 'function' ? renderPlanHistoryPanel() : null;
    },
    shopping() {
      if (typeof window.PlatePlanShoppingList?.renderShopping === 'function') return window.PlatePlanShoppingList.renderShopping();
      if (typeof window.PlatePlanShopping?.renderShopping === 'function') return window.PlatePlanShopping.renderShopping();
      if (typeof window.renderShopping === 'function') return window.renderShopping();
      return typeof renderShopping === 'function' ? renderShopping() : null;
    },
    prefs() {
      if (typeof window.PlatePlanSettings?.renderPreferences === 'function') return window.PlatePlanSettings.renderPreferences();
      if (typeof loadPrefs === 'function') return loadPrefs();
      if (typeof window.loadPrefs === 'function') return window.loadPrefs();
      return null;
    },
    data() {
      if (typeof window.PlatePlanDataQuality?.renderDataQuality === 'function') return window.PlatePlanDataQuality.renderDataQuality();
      if (typeof renderDataQuality === 'function') return renderDataQuality();
      if (typeof window.renderDataQuality === 'function') return window.renderDataQuality();
      return null;
    }
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
