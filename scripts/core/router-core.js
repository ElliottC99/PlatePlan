/**
 * scripts/core/router-core.js
 * PlatePlan Core Router Engine & Navigation
 */
(function() {
  window.PlatePlanRouter = window.PlatePlanRouter || {};
  
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
    const wrap = document.getElementById('mobile-action-sheet-wrap');
    if (wrap) wrap.classList.remove('open', 'active');

    setTimeout(() => {
      const fn = typeof actionFnName === 'function' ? actionFnName : window[actionFnName];
      if (typeof fn === 'function') {
        fn(...args);
      } else {
        console.error(`[Router] Action '${actionFnName}' not found.`);
      }
    }, 50);
  }

  function showView(id) {
    document.querySelectorAll('.desktop-sidebar .ntab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === id));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById('view-' + id);
    if (view) view.classList.add('active');
    syncMobileNavigation(id);
    
    if (window.PlatePlanRouter.requestPlatePlanViewRender) {
      window.PlatePlanRouter.requestPlatePlanViewRender(id);
    }
    
    if (window.platePlanDirtyViews) window.platePlanDirtyViews.delete(id);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  Object.assign(window.PlatePlanRouter, {
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
    showView
  });

  window.showView = showView;
  window.switchTab = showView;
})();
