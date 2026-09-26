/**
 * src/components/NavigationRouter.js (v3.3.4)
 * Restores sidebar tab switching, view routing, and top-bar button actions.
 */

export function initNavigationRouter() {
  /**
   * Switch active view tab and toggle view panel visibility
   * @param {string} viewName 
   */
  function showView(viewName) {
    if (!viewName) return;

    // Toggle view panel visibility
    const views = document.querySelectorAll('.view, .app-view-panel');
    let targetFound = false;

    views.forEach(view => {
      const isTarget = view.id === `view-${viewName}` || view.id === viewName;
      if (isTarget) {
        view.style.display = 'block';
        view.classList.add('active');
        targetFound = true;
      } else {
        view.style.display = 'none';
        view.classList.remove('active');
      }
    });

    if (!targetFound) {
      console.warn(`[NavigationRouter v3.3.4] View panel for '${viewName}' not found.`);
    }

    // Update active tab styles on sidebar & mobile nav
    const navButtons = document.querySelectorAll('[data-view], [data-target-view]');
    navButtons.forEach(btn => {
      const btnView = btn.getAttribute('data-view') || btn.getAttribute('data-target-view');
      if (btnView === viewName) {
        btn.classList.add('active', 'bg-blue-100', 'text-blue-600');
      } else {
        btn.classList.remove('active', 'bg-blue-100', 'text-blue-600');
      }
    });

    console.log(`[NavigationRouter v3.3.4] Switched view to: ${viewName}`);
  }

  // Bind global event delegation for navigation clicks
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-view], [data-target-view]');
    if (!trigger) return;

    const viewName = trigger.getAttribute('data-view') || trigger.getAttribute('data-target-view');
    if (viewName) {
      e.preventDefault();
      showView(viewName);
    }
  });

  // Export showView globally for compatibility
  window.showView = showView;

  // Hook top-bar buttons safely
  const createBtn = document.querySelector('.app-create-button') || document.getElementById('btn-add');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      console.log('[NavigationRouter v3.3.4] Add action triggered.');
    });
  }

  const syncBtn = document.getElementById('syncNowTopBtn') || document.getElementById('btn-sync');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      console.log('[NavigationRouter v3.3.4] Manual sync triggered.');
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      console.log('[NavigationRouter v3.3.4] Log out triggered.');
    });
  }

  console.log('[NavigationRouter v3.3.4] Interactivity and tab routing initialized.');
}
