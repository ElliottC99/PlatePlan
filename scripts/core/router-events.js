/**
 * scripts/core/router-events.js
 * PlatePlan Router Event Listeners & Initialization
 */
(function() {
  window.PlatePlanRouter = window.PlatePlanRouter || {};

  function openPlatePlanSearchResult(type, id, title = '') {
    if (type === 'recipe') {
      window.showView('vault');
      setTimeout(() => (typeof window.viewRecipe === 'function' ? window.viewRecipe(id) : null), 0);
      return;
    }
    if (type === 'ingredient' || type === 'subtype') {
      window.showView('ingredients');
      setTimeout(() => {
        const input = document.getElementById('ingredient-group-search');
        if (input) {
          input.value = title || '';
          if (typeof renderIngredientBank === 'function') renderIngredientBank();
          input.focus();
        }
      }, 0);
      return;
    }
    if (type === 'product') {
      window.showView('bank');
      setTimeout(() => {
        const input = document.getElementById('bank-search');
        if (input) {
          input.value = title || '';
          if (typeof renderBank === 'function') renderBank();
          input.focus();
        }
      }, 0);
      return;
    }
    if (type === 'plan') window.showView('planlib');
  }

  function bindTopBarActionListeners() {
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.logout === 'function') window.logout();
    });

    document.querySelectorAll('.sync-now-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof window.syncNow === 'function') window.syncNow();
      });
    });

    document.getElementById('sync-status')?.addEventListener('click', () => {
      if (typeof window.openPlatePlanSyncPanel === 'function') {
        window.openPlatePlanSyncPanel();
      } else if (typeof window.syncNow === 'function') {
        window.syncNow();
      }
    });
  }

  function installPlatePlanModalHistory() {
    if (!window.PlatePlanRouter.isMobilePlatePlan?.() || !document.body || document.body.dataset.modalHistoryReady === '1') return;
    document.body.dataset.modalHistoryReady = '1';
    
    new MutationObserver(records => records.forEach(record => {
      const wrap = record.target;
      if (!(wrap instanceof HTMLElement) || !wrap.classList.contains('modal-wrap')) return;
      if (wrap.classList.contains('open')) window.PlatePlanRouter.markMobileLayerForBack?.(wrap, 'modal');
    })).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  // Global Event Listeners
  if (typeof document !== 'undefined') {
    const onDomReady = () => {
      bindTopBarActionListeners();
      installPlatePlanModalHistory();

      window.addEventListener('popstate', () => {
        const action = document.getElementById('mobile-action-sheet-wrap');
        if (action?.classList.contains('open')) {
          window.PlatePlanRouter.closeMobileActionSheet?.(true);
          return;
        }
        const more = document.getElementById('mobile-more-wrap');
        if (more?.classList.contains('open')) {
          window.PlatePlanRouter.closeMobileMore?.(true);
          return;
        }
        const modal = Array.from(document.querySelectorAll('.modal-wrap.open')).pop();
        if (modal) modal.classList.remove('open');
      });

      document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        const action = document.getElementById('mobile-action-sheet-wrap');
        if (action?.classList.contains('open')) {
          event.preventDefault();
          window.PlatePlanRouter.closeMobileActionSheet?.();
          return;
        }
        const modal = Array.from(document.querySelectorAll('.modal-wrap.open')).pop();
        if (modal) {
          event.preventDefault();
          modal.classList.remove('open');
        }
      });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onDomReady);
    else onDomReady();
  }

  Object.assign(window.PlatePlanRouter, {
    openPlatePlanSearchResult,
    bindTopBarActionListeners,
    installPlatePlanModalHistory
  });

  window.openPlatePlanSearchResult = openPlatePlanSearchResult;
})();
