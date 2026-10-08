/**
 * src/components/shell/NavigationUI.js (v3.29.1)
 * Modular Presentation Component for Desktop Sidebar & Mobile Navigation
 */

export function renderDesktopSidebarUI(activeView = 'today') {
  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'vault', label: 'Recipes' },
    { id: 'planner', label: 'Meal Planner' },
    { id: 'search', label: 'Search' }
  ];

  const mainTabsHtml = tabs.map(t => `
    <button class="ntab ${t.id === activeView ? 'active' : ''}" data-view="${t.id}" data-action="navigate-view">${t.label}</button>
  `).join('');

  return `
    <nav class="desktop-sidebar" aria-label="Main navigation">
      <div class="nav-group-label">PlatePlan</div>
      ${mainTabsHtml}
      <details class="nav-group" data-sidebar-group="library" open>
        <summary>Library</summary>
        <button class="ntab ${activeView === 'planlib' ? 'active' : ''}" data-view="planlib" data-action="navigate-view">Meal Plan Library</button>
      </details>
      <details class="nav-group" data-sidebar-group="data" open>
        <summary>Data</summary>
        <button class="ntab ${(activeView === 'ingredients' || activeView === 'pantry') ? 'active' : ''}" data-view="ingredients" data-action="navigate-view">Pantry</button>
        <button class="ntab ${activeView === 'bank' ? 'active' : ''}" data-view="bank" data-action="navigate-view" onclick="clearProductGroupFilter()" style="padding-left:22px;font-size:12px;color:var(--text2)">↳ Product Bank</button>
        <button class="ntab ${activeView === 'data' ? 'active' : ''}" data-view="data" data-action="navigate-view">Data Quality</button>
      </details>
      <details class="nav-group" data-sidebar-group="settings" open>
        <summary>Settings</summary>
        <button class="ntab ${activeView === 'prefs' ? 'active' : ''}" data-view="prefs" data-action="navigate-view">Preferences</button>
      </details>
    </nav>
  `;
}

export function renderMobileNavUI(activeView = 'today') {
  return `
    <div class="mobile-nav" id="mobile-nav" aria-label="Main navigation">
      <button data-view="today" data-action="navigate-view" class="${activeView === 'today' ? 'active' : ''}">
        <svg aria-hidden="true" viewbox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5M6.5 10v9h11v-9M10 19v-5h4v5"></path></svg>Today
      </button>
      <button data-view="vault" data-action="navigate-view" class="${activeView === 'vault' ? 'active' : ''}">
        <svg aria-hidden="true" viewbox="0 0 24 24"><path d="M5 4v7M8 4v7M5 8h3M6.5 11v9M16 4c-2 3-2 7 0 9h2V4M18 13v7"></path></svg>Recipes
      </button>
      <button data-view="planner" data-action="navigate-view" class="${activeView === 'planner' ? 'active' : ''}">
        <svg aria-hidden="true" viewbox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2"></path></svg>Plan
      </button>
      <button data-view="shopping" data-action="navigate-view" class="${activeView === 'shopping' ? 'active' : ''}">
        <svg aria-hidden="true" viewbox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"></path></svg>Shopping
      </button>
      <button data-view="more" onclick="openMobileMore()">
        <svg aria-hidden="true" viewbox="0 0 24 24"><circle cx="12" cy="12" r="1.5"></circle><circle cx="6" cy="12" r="1.5"></circle><circle cx="18" cy="12" r="1.5"></circle></svg>More
      </button>
    </div>
  `;
}
