/**
 * PlatePlan v3.3.7 - Native Today Feature View
 */
import { subscribeToStore } from '../core/store.js?v=3.3.7';

let selectedDate = new Date();

function formatDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(d) {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

window.moveTodayDate = function(direction) {
  selectedDate.setDate(selectedDate.getDate() + Number(direction));
  renderTodayContent();
};

window.resetTodayDate = function() {
  selectedDate = new Date();
  renderTodayContent();
};

function getTodayContainer() {
  return document.getElementById('view-today') || 
         document.getElementById('today-view') || 
         document.getElementById('tab-today') || 
         document.querySelector('[data-view="today"]') || 
         document.querySelector('.today-container');
}

function renderTodayContent() {
  try {
    const container = getTodayContainer();
    if (!container) return;

    const dateLabelEl = container.querySelector('#today-date-label') || document.getElementById('today-date-label');
    if (dateLabelEl) {
      dateLabelEl.textContent = formatDisplayDate(selectedDate);
    }

    const contentEl = container.querySelector('#today-content') || document.getElementById('today-content');
    if (!contentEl) return;

    window.state = window.state || {};
    const plans = Array.isArray(window.state.plans) ? window.state.plans : [];
    const recipes = Array.isArray(window.state.recipes) ? window.state.recipes : [];
    const targetDateStr = formatDateKey(selectedDate);

    // Filter plans for selectedDate (checking p.date, p.day, or p.startDate)
    const matchingPlans = plans.filter(p => {
      if (!p) return false;
      const pDate = p.date || p.day || p.startDate || '';
      return String(pDate).startsWith(targetDateStr) || String(pDate) === targetDateStr;
    });

    if (matchingPlans.length === 0) {
      contentEl.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--text2,#666);">
          <h3 style="margin-bottom:8px;font-size:18px;color:var(--text1,#111);">No meals planned for ${formatDisplayDate(selectedDate)}</h3>
          <p style="margin-bottom:20px;font-size:14px;">Use the Meal Planner or add recipes to populate your schedule.</p>
          <button class="btn primary" onclick="showView('planner')">Open Meal Planner</button>
        </div>
      `;
      return;
    }

    let html = '<div class="today-plans-grid" style="display:grid;gap:16px;margin-top:16px;">';
    matchingPlans.forEach((plan, idx) => {
      const recipeId = plan.recipeId || plan.id;
      const recipe = recipes.find(r => r && (r.id === recipeId || r.recipeId === recipeId)) || {};
      const recipeName = plan.title || recipe.name || plan.name || `Meal ${idx + 1}`;
      const mealType = plan.mealType || plan.slot || 'Dinner';
      const prepTime = recipe.prepTime || recipe.time || '20 mins';

      html += `
        <div class="today-plan-card" style="background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <span style="background:var(--surface2,#edf2f7);color:var(--text1,#2d3748);font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:0.05em;">${mealType}</span>
            <span style="font-size:12px;color:var(--text3,#718096);">${prepTime}</span>
          </div>
          <h4 style="font-size:18px;font-weight:600;color:var(--text1,#1a202c);margin:0 0 8px 0;">${recipeName}</h4>
          ${recipe.description ? `<p style="font-size:14px;color:var(--text2,#4a5568);margin:0 0 16px 0;">${recipe.description}</p>` : ''}
          <div style="display:flex;gap:8px;">
            <button class="btn sm primary" onclick="showView('vault')">View Recipe</button>
          </div>
        </div>
      `;
    });
    html += '</div>';
    contentEl.innerHTML = html;
  } catch (err) {
    console.error('[Today View] Render error:', err);
  }
}

export default {
  render: async (context) => renderTodayContent(),
  install: (context) => {
    window.renderToday = renderTodayContent;
    subscribeToStore(renderTodayContent);
  }
};
