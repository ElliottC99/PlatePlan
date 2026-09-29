/**
 * src/components/pantry/UseUpFinderModalUI.js (v3.9.4)
 * Presentation Component for Use-Up Recipe Finder & Assignment Modals
 */

function escapeHtml(str) {
  if (typeof window !== 'undefined' && window.ppEscapeHtml) {
    return window.ppEscapeHtml(str);
  }
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (typeof window !== 'undefined' && window.ppEscapeAttr) {
    return window.ppEscapeAttr(str);
  }
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function toTitle(str) {
  if (typeof window !== 'undefined' && window.toTitleCase) {
    return window.toTitleCase(str);
  }
  return String(str || '').charAt(0).toUpperCase() + String(str || '').slice(1);
}

export function renderFinderWrap() {
  return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="use-up-finder-title">
    <div class="workspace-appbar">
      <div>
        <h2 id="use-up-finder-title">Use up ingredients</h2>
        <p>Find eligible recipes that make the best use of your shared list.</p>
      </div>
      <button class="modal-close-btn" type="button" onclick="closeUseUpRecipeFinder()" aria-label="Close">&times;</button>
    </div>
    <div class="workspace-scroll">
      <div id="use-up-finder-controls"></div>
      <div id="use-up-finder-results"></div>
    </div>
  </div>`;
}

export function renderFinderControls(entries = [], activeMeal = 'dinner', activeWho = 'both', selectedProductIds = []) {
  const mealOptions = ['breakfast', 'lunch', 'dinner'].map(value =>
    `<option value="${value}"${activeMeal === value ? ' selected' : ''}>${toTitle(value)}</option>`
  ).join('');

  const whoOptions = [
    ['both', 'Both'],
    ['Elliott', 'Elliott'],
    ['Chloe', 'Chloe']
  ].map(([value, label]) =>
    `<option value="${value}"${activeWho === value ? ' selected' : ''}>${label}</option>`
  ).join('');

  const productChecks = entries.map(entry => {
    const checked = selectedProductIds.includes(entry.productId) ? 'checked' : '';
    const pAttr = escapeAttr(entry.productId);
    const pName = escapeHtml(entry.product.name);
    const qtyLabel = typeof window !== 'undefined' && window.useUpQuantityLabel ? window.useUpQuantityLabel(entry) : '';
    return `<label><input type="checkbox" ${checked} onchange="toggleUseUpFinderProduct('${pAttr}',this.checked)"> ${pName} <small>${escapeHtml(qtyLabel)}</small></label>`;
  }).join('');

  return `<div class="use-up-finder-filters">
    <label>Meal<select onchange="setUseUpFinderFilter('meal',this.value)">${mealOptions}</select></label>
    <label>For<select onchange="setUseUpFinderFilter('who',this.value)">${whoOptions}</select></label>
  </div>
  <fieldset class="use-up-product-filter">
    <legend>Products to match</legend>
    ${productChecks}
  </fieldset>`;
}

export function renderFinderResults(rows = [], entries = [], activeMeal = 'dinner', activeWho = 'both', selectedProductIds = []) {
  if (!rows.length) {
    return '<div class="empty">No eligible recipe uses the selected products with these meal, exclusion and traffic-light settings.</div>';
  }

  const cardsHtml = rows.slice(0, 48).map(row => {
    const coverage = row.useUpCoverage;
    const bundle = typeof window !== 'undefined' && window.calculateRecipeDisplayNutrition
      ? window.calculateRecipeDisplayNutrition({ recipe: row.recipe, variant: row.variant, mealType: activeMeal })
      : null;
    const portions = bundle?.portions || {};
    const round1 = typeof window !== 'undefined' && window.round1 ? window.round1 : (n => Math.round((n || 0) * 10) / 10);

    const people = activeWho === 'both'
      ? `E ${Math.round(portions.eCal || 0)} kcal / P${round1(portions.eProt)}g · C ${Math.round(portions.cCal || 0)} kcal / P${round1(portions.cProt)}g`
      : activeWho === 'Chloe'
      ? `${Math.round(portions.cCal || 0)} kcal / P${round1(portions.cProt)}g`
      : `${Math.round(portions.eCal || 0)} kcal / P${round1(portions.eProt)}g`;

    const formatBatch = typeof window !== 'undefined' && window.formatShoppingBatchAmount
      ? window.formatShoppingBatchAmount
      : (n => String(n));

    const matchText = coverage.matches.map(match =>
      `${match.product.name}: use about ${formatBatch(match.used)}${match.remainder == null ? '' : `, ${formatBatch(match.remainder)} left`}`
    ).join(' · ');

    const matchedIds = new Set(coverage.matches.map(match => match.productId));
    const unmatched = entries
      .filter(entry => selectedProductIds.includes(entry.productId) && !matchedIds.has(entry.productId))
      .map(entry => entry.product.name);

    const trafficPeople = activeWho === 'both' ? ['Elliott', 'Chloe'] : [activeWho];
    const traffic = trafficPeople.map(person => {
      const status = typeof window !== 'undefined' && window.getRecipeVariantTrafficStatus
        ? window.getRecipeVariantTrafficStatus(row, person, activeMeal)
        : '';
      return `${person} ${toTitle(status)}`;
    }).join(' · ');

    return `<article class="use-up-result">
      <div>
        <h3>${escapeHtml(row.label)}</h3>
        <p><strong>Uses:</strong> ${escapeHtml(matchText)}</p>
        ${unmatched.length ? `<p><strong>Not used:</strong> ${escapeHtml(unmatched.join(', '))}</p>` : ''}
        <p>${coverage.otherIngredients} other ingredient${coverage.otherIngredients === 1 ? '' : 's'} · ${escapeHtml(people)} · ${escapeHtml(traffic)}</p>
      </div>
      <div class="btn-row">
        <button class="btn primary" onclick="viewRecipe('${escapeAttr(row.id)}',null,'${row.variant}')">View recipe</button>
        <button class="btn ghost" onclick="openUseUpAssign('${escapeAttr(row.id)}','${row.variant}')">Assign to plan</button>
      </div>
    </article>`;
  }).join('');

  return `<div class="use-up-result-list">${cardsHtml}</div>`;
}

export function renderAssignModal(recipeName = '', planDays = 7, activeMeal = 'dinner', activeWho = 'both', planState = null) {
  const daysArr = Array.from({ length: +planDays || 0 }, (_, i) => i + 1);
  const dayOptions = daysArr.map(day => {
    const label = typeof window !== 'undefined' && window.formatPlanDayLabel
      ? window.formatPlanDayLabel(planState, day, { short: true })
      : `Day ${day}`;
    return `<option value="${day}">${escapeHtml(label)}</option>`;
  }).join('');

  return `<div class="modal">
    <div class="row-between" style="align-items:center;">
      <h3 style="margin:0">Assign ${escapeHtml(recipeName)}</h3>
      <button class="modal-close-btn" type="button" onclick="closeUseUpAssign()" aria-label="Close">&times;</button>
    </div>
    <div class="grid2" style="margin-top:14px">
      <label>Day<select id="use-up-assign-day">${dayOptions}</select></label>
      <label>For<select id="use-up-assign-person">
        <option value="both"${activeWho === 'both' ? ' selected' : ''}>Both (Shared)</option>
        <option value="E"${activeWho === 'Elliott' ? ' selected' : ''}>Elliott</option>
        <option value="C"${activeWho === 'Chloe' ? ' selected' : ''}>Chloe</option>
      </select></label>
      <label>Meal<select id="use-up-assign-meal">
        <option value="breakfast"${activeMeal === 'breakfast' ? ' selected' : ''}>Breakfast</option>
        <option value="lunch"${activeMeal === 'lunch' ? ' selected' : ''}>Lunch</option>
        <option value="dinner"${activeMeal === 'dinner' ? ' selected' : ''}>Dinner</option>
      </select></label>
    </div>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn primary" onclick="confirmUseUpAssign()">Continue</button>
    </div>
  </div>`;
}
