/**
 * src/components/profile/ProfileMacroEditor.js (v3.8.3)
 * UI component for dual-profile macro target configuration,
 * 4-meal target ratio splitters, and calorie/protein delta calculators.
 */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Calculates default meal breakdown from daily totals if not explicitly set.
 */
export function calculateDefaultMealSplit(dailyCal, dailyProt, profile = 'elliott') {
  const isElliott = profile === 'elliott';
  const cal = Number(dailyCal) || (isElliott ? 2200 : 1800);
  const prot = Number(dailyProt) || (isElliott ? 140 : 110);

  return {
    breakfast: {
      kcal: Math.round(cal * (isElliott ? 0.25 : 0.25)),
      protein: Math.round(prot * (isElliott ? 0.25 : 0.23))
    },
    lunch: {
      kcal: Math.round(cal * (isElliott ? 0.30 : 0.28)),
      protein: Math.round(prot * (isElliott ? 0.29 : 0.27))
    },
    dinner: {
      kcal: Math.round(cal * (isElliott ? 0.34 : 0.36)),
      protein: Math.round(prot * (isElliott ? 0.32 : 0.36))
    },
    snacking: {
      kcal: Math.round(cal * (isElliott ? 0.11 : 0.11)),
      protein: Math.round(prot * (isElliott ? 0.14 : 0.14))
    }
  };
}

/**
 * Calculates total planned sum and delta difference from daily target.
 */
export function calculateMacroDeltas(dailyCal, dailyProt, meals = {}) {
  const mealKeys = ['breakfast', 'lunch', 'dinner', 'snacking'];
  let sumCal = 0;
  let sumProt = 0;

  mealKeys.forEach(k => {
    sumCal += Number(meals[k]?.kcal || 0);
    sumProt += Number(meals[k]?.protein || 0);
  });

  return {
    sumCal,
    sumProt,
    deltaCal: sumCal - (Number(dailyCal) || 0),
    deltaProt: sumProt - (Number(dailyProt) || 0),
    isCalBalanced: Math.abs(sumCal - (Number(dailyCal) || 0)) <= 5,
    isProtBalanced: Math.abs(sumProt - (Number(dailyProt) || 0)) <= 2
  };
}

/**
 * Renders individual member macro target card.
 */
export function renderMemberMacroCard(memberKey, name, badgeLabel, colorTheme, dailyCal, dailyProt, meals = {}) {
  const isElliott = memberKey === 'e' || memberKey === 'elliott';
  const pKey = isElliott ? 'e' : 'c';
  const accentColor = colorTheme === 'pink' ? '#ec4899' : '#2563eb';
  const badgeBg = colorTheme === 'pink' ? '#fce7f3' : '#dbeafe';
  const badgeText = colorTheme === 'pink' ? '#be185d' : '#1e40af';

  const bfCal = meals.breakfast?.kcal ?? (isElliott ? 550 : 450);
  const bfProt = meals.breakfast?.protein ?? (isElliott ? 35 : 25);
  const luCal = meals.lunch?.kcal ?? (isElliott ? 650 : 500);
  const luProt = meals.lunch?.protein ?? (isElliott ? 40 : 30);
  const diCal = meals.dinner?.kcal ?? (isElliott ? 750 : 650);
  const diProt = meals.dinner?.protein ?? (isElliott ? 45 : 40);
  const snCal = meals.snacking?.kcal ?? (isElliott ? 250 : 200);
  const snProt = meals.snacking?.protein ?? (isElliott ? 20 : 15);

  const deltas = calculateMacroDeltas(dailyCal, dailyProt, {
    breakfast: { kcal: bfCal, protein: bfProt },
    lunch: { kcal: luCal, protein: luProt },
    dinner: { kcal: diCal, protein: diProt },
    snacking: { kcal: snCal, protein: snProt }
  });

  return `
    <div class="pp-macro-member-card" style="background:#f8fafc;border:1px solid #e2e8f0;padding:18px;border-radius:12px">
      <div style="font-weight:700;font-size:15px;color:${accentColor};margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
        <span>${escapeHtml(name)}'s Targets</span>
        <span style="font-size:11px;background:${badgeBg};color:${badgeText};padding:2px 8px;border-radius:10px;font-weight:600">${escapeHtml(badgeLabel)}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;background:#ffffff;padding:10px;border-radius:8px;border:1px solid #cbd5e1">
        <div class="pp-input-group" style="margin-bottom:0">
          <label for="pp-macro-${pKey}-cal" style="font-size:12px;font-weight:600;color:#475569">Daily Calories (kcal)</label>
          <input type="number" id="pp-macro-${pKey}-cal" name="ppMacro${pKey}Cal" aria-label="Daily Calories for ${pKey}" value="${dailyCal}" style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px">
        </div>
        <div class="pp-input-group" style="margin-bottom:0">
          <label for="pp-macro-${pKey}-prot" style="font-size:12px;font-weight:600;color:#475569">Daily Protein (g)</label>
          <input type="number" id="pp-macro-${pKey}-prot" name="ppMacro${pKey}Prot" aria-label="Daily Protein for ${pKey}" value="${dailyProt}" style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px">
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase">4-Meal Slot Breakdown</div>
        <span style="font-size:11px;color:${deltas.isCalBalanced ? '#16a34a' : '#d97706'}">
          ${deltas.isCalBalanced ? '✓ 100% Allocated' : `Sum: ${deltas.sumCal} kcal`}
        </span>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:8px;align-items:center;background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #e2e8f0">
          <span style="font-size:12px;font-weight:600;color:#334155">🍳 Breakfast</span>
          <input type="number" id="pp-macro-${pKey}-bf-cal" name="ppMacro${pKey}BfCal" aria-label="Breakfast Calories for ${pKey}" value="${bfCal}" placeholder="kcal" style="padding:4px 8px;font-size:12px;border:1px solid #cbd5e1;border-radius:6px">
          <input type="number" id="pp-macro-${pKey}-bf-prot" name="ppMacro${pKey}BfProt" aria-label="Breakfast Protein for ${pKey}" value="${bfProt}" placeholder="protein (g)" style="padding:4px 8px;font-size:12px;border:1px solid #cbd5e1;border-radius:6px">
        </div>

        <div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:8px;align-items:center;background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #e2e8f0">
          <span style="font-size:12px;font-weight:600;color:#334155">🥗 Lunch</span>
          <input type="number" id="pp-macro-${pKey}-lu-cal" name="ppMacro${pKey}LuCal" aria-label="Lunch Calories for ${pKey}" value="${luCal}" placeholder="kcal" style="padding:4px 8px;font-size:12px;border:1px solid #cbd5e1;border-radius:6px">
          <input type="number" id="pp-macro-${pKey}-lu-prot" name="ppMacro${pKey}LuProt" aria-label="Lunch Protein for ${pKey}" value="${luProt}" placeholder="protein (g)" style="padding:4px 8px;font-size:12px;border:1px solid #cbd5e1;border-radius:6px">
        </div>

        <div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:8px;align-items:center;background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #e2e8f0">
          <span style="font-size:12px;font-weight:600;color:#334155">🍲 Dinner</span>
          <input type="number" id="pp-macro-${pKey}-di-cal" name="ppMacro${pKey}DiCal" aria-label="Dinner Calories for ${pKey}" value="${diCal}" placeholder="kcal" style="padding:4px 8px;font-size:12px;border:1px solid #cbd5e1;border-radius:6px">
          <input type="number" id="pp-macro-${pKey}-di-prot" name="ppMacro${pKey}DiProt" aria-label="Dinner Protein for ${pKey}" value="${diProt}" placeholder="protein (g)" style="padding:4px 8px;font-size:12px;border:1px solid #cbd5e1;border-radius:6px">
        </div>

        <div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:8px;align-items:center;background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #e2e8f0">
          <span style="font-size:12px;font-weight:600;color:#334155">🥤 Snacking</span>
          <input type="number" id="pp-macro-${pKey}-sn-cal" name="ppMacro${pKey}SnCal" aria-label="Snack Calories for ${pKey}" value="${snCal}" placeholder="kcal" style="padding:4px 8px;font-size:12px;border:1px solid #cbd5e1;border-radius:6px">
          <input type="number" id="pp-macro-${pKey}-sn-prot" name="ppMacro${pKey}SnProt" aria-label="Snack Protein for ${pKey}" value="${snProt}" placeholder="protein (g)" style="padding:4px 8px;font-size:12px;border:1px solid #cbd5e1;border-radius:6px">
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders complete dual-profile macro editor section.
 */
export function renderMacroEditorSection(userPrefs = {}) {
  const targets = userPrefs.nutritionTargets || {};
  const eTargets = targets.elliott || {};
  const eMeals = eTargets.meals || {};
  const cTargets = targets.chloe || {};
  const cMeals = cTargets.meals || {};

  const elliottDailyCal = userPrefs.elliottCal || eTargets.dailyKcal || 2200;
  const elliottDailyProt = userPrefs.elliottProt || eTargets.dailyProtein || 140;
  const chloeDailyCal = userPrefs.chloeCal || cTargets.dailyKcal || 1800;
  const chloeDailyProt = userPrefs.chloeProt || cTargets.dailyProtein || 110;

  const elliottCard = renderMemberMacroCard('elliott', 'Elliott', 'Member 1', 'blue', elliottDailyCal, elliottDailyProt, eMeals);
  const chloeCard = renderMemberMacroCard('chloe', 'Chloe', 'Member 2', 'pink', chloeDailyCal, chloeDailyProt, cMeals);

  return `
    <div class="pp-settings-card" id="pp-macro-editor-section">
      <div class="pp-settings-title" style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 12px 0;display:flex;align-items:center;gap:8px">
        ⚡ Daily Nutritional Targets & 4-Meal Breakdown
      </div>
      <p style="font-size:12px;color:#64748b;margin:-4px 0 16px 0">
        Individual calorie and protein targets across Breakfast, Lunch, Dinner, and Snacking/Drinking for Elliott & Chloe.
      </p>

      <div class="pp-settings-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px">
        ${elliottCard}
        ${chloeCard}
      </div>
    </div>
  `;
}
