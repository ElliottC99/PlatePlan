const GROUP_ORDER = ['Recipes', 'Ingredients', 'Sub-types', 'Products', 'Meal plans'];
let renderSearch = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function normalise(value) {
  return String(value ?? '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function valuesText(value) {
  if (Array.isArray(value)) return value.join(' ');
  if (value && typeof value === 'object') return Object.values(value).join(' ');
  return String(value ?? '');
}

function makeEntry(group, type, id, title, detail, searchable) {
  return {
    group,
    type,
    id: String(id ?? ''),
    title: String(title || 'Untitled'),
    detail: String(detail || ''),
    searchable: normalise(`${title} ${detail} ${searchable}`),
  };
}

let lastStateRef = null;
let cachedEntries = [];

function buildEntries(state) {
  if (!state) return [];
  if (state === lastStateRef && cachedEntries.length) return cachedEntries;
  const families = new Map((state.ingredientFamilies || []).map(item => [String(item.id), item]));
  const groups = new Map((state.ingredientGroups || []).map(item => [String(item.id), item]));
  const entries = [];

  for (const recipe of state.recipes || []) {
    entries.push(makeEntry(
      'Recipes',
      'recipe',
      recipe.id,
      recipe.name,
      [valuesText(recipe.mealTypes || recipe.type), recipe.who, recipe.enhanced ? 'Original and Enhanced' : 'Original'].filter(Boolean).join(' · '),
      `${valuesText(recipe.source)} ${valuesText(recipe.aliases)}`
    ));
  }

  for (const family of state.ingredientFamilies || []) {
    entries.push(makeEntry(
      'Ingredients',
      'ingredient',
      family.id,
      family.name,
      family.cat || family.category || 'Ingredient Bank',
      valuesText(family.aliases)
    ));
  }

  for (const group of state.ingredientGroups || []) {
    const family = families.get(String(group.familyId || group.ingredientId));
    entries.push(makeEntry(
      'Sub-types',
      'subtype',
      group.id,
      group.name,
      [family?.name, group.cat || family?.cat].filter(Boolean).join(' · '),
      valuesText(group.aliases)
    ));
  }

  for (const product of state.ingredients || []) {
    const group = groups.get(String(product.groupId));
    const family = families.get(String(group?.familyId || group?.ingredientId));
    entries.push(makeEntry(
      'Products',
      'product',
      product.id,
      product.name,
      [product.brand, family?.name, group?.name].filter(Boolean).join(' · '),
      `${product.cat || ''} ${valuesText(product.aliases)}`
    ));
  }

  (state.planHistory || []).forEach((plan, index) => {
    entries.push(makeEntry(
      'Meal plans',
      'plan',
      plan.id || index,
      plan.name || `Saved plan ${index + 1}`,
      [plan.dateRange, plan.savedAt || plan.createdAt].filter(Boolean).join(' · '),
      valuesText(plan.dayDates)
    ));
  });
  lastStateRef = state;
  cachedEntries = entries;
  return entries;
}

function renderResults(host, status, entries, query) {
  if (!query) {
    status.textContent = '';
    host.innerHTML = `
      <div class="search-empty">
        <div class="search-empty-icon" aria-hidden="true">⌕</div>
        <h2>Search all of PlatePlan</h2>
        <p>Results come from the local recipe, hierarchy, Product Bank and Meal Plan Library indexes.</p>
      </div>`;
    return;
  }

  const terms = normalise(query).split(' ').filter(Boolean);
  const matches = entries
    .filter(entry => terms.every(term => entry.searchable.includes(term)))
    .sort((a, b) => {
      const aStarts = normalise(a.title).startsWith(normalise(query)) ? 0 : 1;
      const bStarts = normalise(b.title).startsWith(normalise(query)) ? 0 : 1;
      return aStarts - bStarts || a.title.localeCompare(b.title);
    });

  status.textContent = `${matches.length} ${matches.length === 1 ? 'result' : 'results'}`;
  if (!matches.length) {
    host.innerHTML = `
      <div class="search-empty">
        <h2>No matches</h2>
        <p>Try a recipe name, product brand, ingredient, sub-type or saved plan date.</p>
      </div>`;
    return;
  }

  const grouped = new Map(GROUP_ORDER.map(group => [group, []]));
  matches.forEach(entry => grouped.get(entry.group)?.push(entry));
  host.innerHTML = [...grouped.entries()]
    .filter(([, items]) => items.length)
    .map(([group, items]) => `
      <section class="search-result-group">
        <h2>${escapeHtml(group)} <span>${items.length}</span></h2>
        <div class="search-result-list">
          ${items.slice(0, 20).map(entry => `
            <button class="search-result-row" type="button" data-search-type="${escapeHtml(entry.type)}" data-search-id="${escapeHtml(entry.id)}" data-search-title="${escapeHtml(entry.title)}">
              <span><strong>${escapeHtml(entry.title)}</strong>${entry.detail ? `<small>${escapeHtml(entry.detail)}</small>` : ''}</span>
              <span aria-hidden="true">›</span>
            </button>`).join('')}
        </div>
      </section>`).join('');
}

export default Object.freeze({
  id: 'search',
  install(context) {
    if (typeof document === 'undefined') return;
    const input = document.getElementById('global-search-input');
    const host = document.getElementById('global-search-results');
    const status = document.getElementById('global-search-status');
    if (!input || !host || !status || input.dataset.searchInstalled === '1') return;
    input.dataset.searchInstalled = '1';
    let timer = 0;
    const render = () => renderResults(host, status, buildEntries(context.store.getState()), input.value);
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(render, 120);
    });
    host.addEventListener('click', event => {
      const button = event.target.closest?.('[data-search-type]');
      if (!button) return;
      context.legacy.openSearchResult?.(
        button.dataset.searchType,
        button.dataset.searchId,
        button.dataset.searchTitle
      );
    });
    context.store.subscribe(() => {
      if (document.getElementById('view-search')?.classList.contains('active')) render();
    });
    renderSearch = render;
  },
  render() {
    if (typeof document === 'undefined') return;
    renderSearch?.();
    requestAnimationFrame(() => document.getElementById('global-search-input')?.focus());
  },
});
