/**
 * scripts/features/planner-studio.js
 * PlatePlan Meal Plan Studio Drawer, Wizard & Auto-Generator Engine
 */
(function() {
  'use strict';
  window.PlatePlanPlanner = window.PlatePlanPlanner || {};
  window.PlatePlanPlanner.State = window.PlatePlanPlanner.State || {};
  const PlannerState = window.PlatePlanPlanner.State;
  const getState = () => (typeof window !== 'undefined' && window.state) || (typeof state !== 'undefined' ? state : {});

  function ensurePlannerOptionsUI() {
    const el = document.getElementById('planner-options-ui');
    if (el && !el.innerHTML.trim()) {
      el.innerHTML = '<div class="text-xs text-zinc-500">Studio Options Ready</div>';
    }
  }

  function generatePlanFromQuickSetup() {
    const state = getState();
    if (!state.plan) state.plan = { days: 7, slots: {}, dayDates: {} };
    const recipes = state.recipes || [];
    if (recipes.length === 0) {
      alert('Please add some recipes to your library first!');
      return;
    }
    
    // Auto populate slots
    const days = state.plan.days || 7;
    const slots = {};
    const mealTypes = ['breakfast', 'lunch', 'dinner'];
    
    for (let i = 1; i <= days; i++) {
      mealTypes.forEach(meal => {
        const matching = recipes.filter(r => r.type === meal || !r.type || r.type === 'any');
        const chosen = matching.length > 0 ? matching[Math.floor(Math.random() * matching.length)] : recipes[0];
        if (chosen) {
          slots[`day-${i}-${meal}`] = { recipeId: chosen.id, portions: 2 };
        }
      });
    }
    
    state.plan.slots = slots;
    closeMealPlanStudio();
    if (typeof window.renderPlan === 'function') window.renderPlan();
    if (typeof window.saveState === 'function') window.saveState();
    alert('Meal plan successfully auto-generated!');
  }

  function generatePlanFromOptions(options = {}) {
    generatePlanFromQuickSetup();
  }

  function openMealPlanStudio() {
    const drawer = document.getElementById('meal-plan-studio-drawer') || document.getElementById('studio-drawer');
    if (drawer) {
      drawer.classList.remove('hidden');
      drawer.style.display = 'block';
    } else {
      if (confirm('Open Meal Plan Studio Auto-Generator?')) {
        generatePlanFromQuickSetup();
      }
    }
  }

  function closeMealPlanStudio() {
    const drawer = document.getElementById('meal-plan-studio-drawer') || document.getElementById('studio-drawer');
    if (drawer) {
      drawer.classList.add('hidden');
      drawer.style.display = 'none';
    }
  }

  function resetStudioSession() {
    PlannerState.studioSession = null;
    PlannerState.studioUndoBuffer = null;
  }

  function updateWizardDaysCount() {
    const checkboxes = document.querySelectorAll('.wizard-day-cb:checked');
    const state = getState();
    if (!state.plan) state.plan = { days: 7, slots: {}, dayDates: {} };
    state.plan.days = Math.max(1, checkboxes.length || 7);
  }

  function renderMealPlannerWizard() {
    const hostEl = document.getElementById('planner-wizard-host');
    if (!hostEl) return;

    let html = `
   <div class="wizard-container">
     <!-- PROGRESS STEPPER -->
     <div class="wizard-stepper" style="display: flex; gap: 10px; align-items: center; margin-bottom: 20px;">
       <div class="step active" style="background: #2563eb; color: white; padding: 5px 15px; border-radius: 20px;">1 Configure Requests</div>
       <span>→</span>
       <div class="step inactive" style="color: #888;">2 Review Plan</div>
       <span>→</span>
       <div class="step inactive" style="color: #888;">3 Shopping & Substitutions</div>
       <span>→</span>
       <div class="step inactive" style="color: #888;">4 Commit Plan</div>
     </div>

     <!-- HEADER -->
     <h2>Step 1: Configure Plan Requests</h2>
     <p>Define days, meal repeat cadence, skips, and pinned recipes before generating.</p>

     <!-- CONFIG GRID -->
     <div class="config-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 20px;">
       <div class="form-group"><label>PLAN LENGTH</label><select><option>10 days</option></select></div>
       <div class="form-group"><label>START DATE</label><input type="date"></div>
       <div class="form-group"><label>BREAKFAST REPEAT</label><select><option>1 day</option></select></div>
       <div class="form-group"><label>LUNCH REPEAT</label><select><option>2 days</option></select></div>
     </div>
     <div class="form-group" style="margin-top: 15px;"><label>DINNER REPEAT</label><select><option>2 days</option></select></div>
     <div class="form-group" style="margin-top: 15px;"><label>MINIMUM RECIPE FIT SCORE</label><select><option>All Recipes (0-100)</option></select></div>

     <!-- ADVANCED PANELS -->
     <div class="advanced-panels" style="margin-top: 30px;">
       <div class="panel slot-exclusions" style="background: #1e1e1e; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
         <div style="display: flex; justify-content: space-between;">
           <h3>Slot Exclusions (0)</h3>
           <div><button>+ Skip All Dinners</button> <button>Clear Skips</button></div>
         </div>
         <p>Skip specific meal slots (eating out, travel, etc.).</p>
         <div style="display: flex; gap: 10px; margin-top: 10px;">
           <select><option>Day 1</option></select>
           <select><option>All meals</option></select>
           <select><option>Both (Elliott & Chloe)</option></select>
           <button style="background: #2563eb; color: white;">+ Skip Slot</button>
         </div>
       </div>

       <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
         <div class="panel pinned-recipes" style="background: #1e1e1e; padding: 15px; border-radius: 8px;">
           <h3>Pinned Recipes (0)</h3>
           <p>Lock specific recipes to calendar days.</p>
           <div style="display: flex; gap: 10px; margin-top: 10px;">
             <select><option>Day 1</option></select>
             <input type="text" placeholder="Search recipe to pin...">
           </div>
         </div>
         <div class="panel pantry-use-up" style="background: #1e1e1e; padding: 15px; border-radius: 8px;">
           <h3>Pantry Use-Up (0)</h3>
           <p>Prioritise recipes that use ingredients expiring in your pantry.</p>
           <input type="text" placeholder="Search product to use up..." style="margin-top: 10px; width: 100%;">
         </div>
       </div>
     </div>

     <div style="text-align: right; margin-top: 20px;">
       <button style="background: #2563eb; color: white; padding: 10px 20px; border-radius: 5px;" onclick="window.PlatePlanPlanner?.generatePlanFromQuickSetup && window.PlatePlanPlanner.generatePlanFromQuickSetup()">✨ Generate Meal Plan →</button>
     </div>
   </div>
    `;

    hostEl.innerHTML = html;
  }

  const moduleExports = {
    ensurePlannerOptionsUI,
    generatePlanFromQuickSetup,
    generatePlanFromOptions,
    openMealPlanStudio,
    closeMealPlanStudio,
    resetStudioSession,
    updateWizardDaysCount,
    renderMealPlannerWizard
  };

  window.PlatePlanPlanner = Object.assign(window.PlatePlanPlanner || {}, moduleExports);
  if (typeof window !== 'undefined') {
    for (const k of Object.keys(moduleExports)) {
      try { window[k] = moduleExports[k]; } catch(e) {}
    }
  }
})();
