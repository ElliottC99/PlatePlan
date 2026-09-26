/**
 * src/components/NavigationRouter.js (v3.3.4)
 * Restores sidebar tab switching, view routing, and top-bar button actions.
 */

/**
 * Switch active view container and update navigation highlight states.
 * @param {string} viewId ID of the view to activate (e.g., 'today', 'vault', 'planner', 'search')
 */
export function showView(viewId) {
  if (!viewId) return;

  // Toggle active class and display state on view containers
  const views = document.querySelectorAll('.view');
  views.forEach(view => {
    const isTarget = view.id === `view-${viewId}` || view.id === viewId;
    if (isTarget) {
      view.classList.add('active');
      view.style.display = 'block';
    } else {
      view.classList.remove('active');
      view.style.display = 'none';
    }
  });

  // Update active state on navigation elements
  const navItems = document.querySelectorAll('[data-view]');
  navItems.forEach(item => {
    if (item.getAttribute('data-view') === viewId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  console.log(`[NavigationRouter v3.3.4] Navigated to view: ${viewId}`);
}

/**
 * Initialize event listeners for navigation tabs and top-bar action buttons.
 */
export function initNavigationRouter() {
  // Global event delegation for navigation and action clicks
  document.addEventListener('click', (e) => {
    // 1. Sidebar and mobile navigation tab clicks
    const navTrigger = e.target.closest('[data-view]');
    if (navTrigger) {
      const viewId = navTrigger.getAttribute('data-view');
      showView(viewId);
      return;
    }

    // 2. Support for explicit data-target-view triggers
    const targetTrigger = e.target.closest('[data-target-view]');
    if (targetTrigger) {
      const viewId = targetTrigger.getAttribute('data-target-view');
      showView(viewId);
      return;
    }

    // 3. Top-bar Add button
    const addBtn = e.target.closest('.app-create-button, #btn-add');
    if (addBtn) {
      console.log('[NavigationRouter v3.3.4] Add action triggered.');
      showView('add');
      return;
    }

    // 4. Top-bar Sync button
    const syncBtn = e.target.closest('#syncNowTopBtn, #btn-sync');
    if (syncBtn) {
      console.log('[NavigationRouter v3.3.4] Manual sync triggered.');
      if (typeof window.syncNow === 'function') {
        window.syncNow();
      } else {
        console.log('[NavigationRouter v3.3.4] Fallback reload for sync.');
        window.location.reload();
      }
      return;
    }

    // 5. Top-bar Logout button
    const logoutBtn = e.target.closest('#logoutBtn');
    if (logoutBtn) {
      console.log('[NavigationRouter v3.3.4] Logout action triggered.');
      if (typeof window.logout === 'function') {
        window.logout();
      } else if (typeof window !== 'undefined' && window.firebase?.auth) {
        window.firebase.auth().signOut().then(() => {
          window.location.reload();
        });
      }
      return;
    }
  });

  // Set default view on initialization
  showView('today');

  console.log('[NavigationRouter v3.3.4] Interactivity and tab routing initialized.');
}
