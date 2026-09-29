/**
 * src/components/settings/ProfileAllocationCard.js (v3.16.0)
 * Redesigned Profile Allocation Cards for independent daily targets & decoupled splits.
 * Dedicated preference cards for Elliott and Chloe with independent
 * Calorie Meal Splits (%) and Protein Meal Splits (%).
 * Zero hardcoded default numbers in source code.
 */

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Renders a single profile's decoupled target & split card.
 *
 * @param {string} profileId
 * @param {Object} profile
 * @returns {string} HTML string
 */
function renderSingleProfileCard(profileId, profile = {}) {
  const pId = String(profileId || '').toLowerCase();
  const name = profile.name || (pId.charAt(0).toUpperCase() + pId.slice(1));
  const dailyKcal = profile.dailyKcal !== undefined ? Number(profile.dailyKcal) : 0;
  const dailyProtein = profile.dailyProtein !== undefined ? Number(profile.dailyProtein) : 0;

  const calSplits = profile.calorieSplits || {};
  const protSplits = profile.proteinSplits || {};

  const calBf = calSplits.breakfast !== undefined ? Number(calSplits.breakfast) : 0;
  const calLu = calSplits.lunch !== undefined ? Number(calSplits.lunch) : 0;
  const calSn = calSplits.snack !== undefined ? Number(calSplits.snack) : (calSplits.snacking !== undefined ? Number(calSplits.snacking) : 0);
  const calDi = calSplits.dinner !== undefined ? Number(calSplits.dinner) : Math.max(0, 100 - (calBf + calLu + calSn));

  const protBf = protSplits.breakfast !== undefined ? Number(protSplits.breakfast) : 0;
  const protLu = protSplits.lunch !== undefined ? Number(protSplits.lunch) : 0;
  const protSn = protSplits.snack !== undefined ? Number(protSplits.snack) : (protSplits.snacking !== undefined ? Number(protSplits.snacking) : 0);
  const protDi = protSplits.dinner !== undefined ? Number(protSplits.dinner) : Math.max(0, 100 - (protBf + protLu + protSn));

  // Legacy ID aliases for backwards compatibility
  const legacyPrefix = pId === 'elliott' ? 'e' : 'c';

  return `
    <div class="profile-card" data-profile="${escapeHtml(pId)}" style="background:var(--surface2);border:1px solid var(--border);padding:16px;border-radius:12px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:8px">
        <strong style="font-size:14px;color:var(--text);display:flex;align-items:center;gap:6px">
          👤 ${escapeHtml(name)}'s Profile
        </strong>
        <span style="font-size:11px;font-weight:600;color:var(--text3);background:var(--surface);padding:2px 8px;border-radius:999px;border:1px solid var(--border)">
          Decoupled Splits
        </span>
      </div>

      <!-- Daily Targets -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">Daily Calories (kcal)</label>
          <input type="number" id="pp-profile-${pId}-cal" class="pp-profile-cal-input" data-profile="${pId}" value="${dailyKcal}" style="width:100%" oninput="calcBudgets()">
          <input type="hidden" id="pp-macro-${legacyPrefix}-cal" value="${dailyKcal}">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">Daily Protein (g)</label>
          <input type="number" id="pp-profile-${pId}-prot" class="pp-profile-prot-input" data-profile="${pId}" value="${dailyProtein}" style="width:100%" oninput="calcBudgets()">
          <input type="hidden" id="pp-macro-${legacyPrefix}-prot" value="${dailyProtein}">
        </div>
      </div>

      <!-- Calorie Meal Splits -->
      <div style="background:var(--surface);border:1px solid var(--border);padding:10px 12px;border-radius:8px">
        <div style="font-size:11px;font-weight:700;color:var(--text);display:flex;justify-content:space-between;margin-bottom:6px">
          <span>🔥 CALORIE MEAL SPLITS (%)</span>
          <span id="pp-profile-${pId}-cal-sum" style="font-size:10px;color:var(--text3)">Sum: 100%</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:6px">
          <div>
            <label style="font-size:10px;color:var(--text2)">Breakfast</label>
            <input type="number" id="pp-profile-${pId}-cal-bf" value="${calBf}" min="0" max="100" style="width:100%;font-size:11px" oninput="calcBudgets()">
            <input type="hidden" id="pp-macro-${legacyPrefix}-bf-cal" value="${calBf}">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text2)">Lunch</label>
            <input type="number" id="pp-profile-${pId}-cal-lu" value="${calLu}" min="0" max="100" style="width:100%;font-size:11px" oninput="calcBudgets()">
            <input type="hidden" id="pp-macro-${legacyPrefix}-lu-cal" value="${calLu}">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text2)">Snack</label>
            <input type="number" id="pp-profile-${pId}-cal-sn" value="${calSn}" min="0" max="100" style="width:100%;font-size:11px" oninput="calcBudgets()">
            <input type="hidden" id="pp-macro-${legacyPrefix}-sn-cal" value="${calSn}">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text2)">Dinner (Remainder)</label>
            <input type="number" id="pp-profile-${pId}-cal-di" value="${calDi}" readonly style="width:100%;font-size:11px;background:rgba(0,0,0,0.04);font-weight:700;color:var(--primary, #2563eb)">
            <input type="hidden" id="pp-macro-${legacyPrefix}-di-cal" value="${calDi}">
          </div>
        </div>
      </div>

      <!-- Protein Meal Splits -->
      <div style="background:var(--surface);border:1px solid var(--border);padding:10px 12px;border-radius:8px">
        <div style="font-size:11px;font-weight:700;color:var(--text);display:flex;justify-content:space-between;margin-bottom:6px">
          <span>💪 PROTEIN MEAL SPLITS (%)</span>
          <span id="pp-profile-${pId}-prot-sum" style="font-size:10px;color:var(--text3)">Sum: 100%</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:6px">
          <div>
            <label style="font-size:10px;color:var(--text2)">Breakfast</label>
            <input type="number" id="pp-profile-${pId}-prot-bf" value="${protBf}" min="0" max="100" style="width:100%;font-size:11px" oninput="calcBudgets()">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text2)">Lunch</label>
            <input type="number" id="pp-profile-${pId}-prot-lu" value="${protLu}" min="0" max="100" style="width:100%;font-size:11px" oninput="calcBudgets()">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text2)">Snack</label>
            <input type="number" id="pp-profile-${pId}-prot-sn" value="${protSn}" min="0" max="100" style="width:100%;font-size:11px" oninput="calcBudgets()">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text2)">Dinner (Remainder)</label>
            <input type="number" id="pp-profile-${pId}-prot-di" value="${protDi}" readonly style="width:100%;font-size:11px;background:rgba(0,0,0,0.04);font-weight:700;color:var(--primary, #2563eb)">
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the Profile Allocation & Dual Macro split section.
 *
 * @param {Object} prefs Target user preferences
 * @returns {string} HTML template literal
 */
export function renderProfileAllocationCard(prefs = {}) {
  const profiles = prefs.profiles ||
    window.state?.preferences?.profiles ||
    window.state?.userPrefs?.profiles || {};

  const elliottProf = profiles.elliott || {
    name: 'Elliott',
    dailyKcal: prefs.nutritionTargets?.elliott?.dailyKcal ?? prefs.elliottCal,
    dailyProtein: prefs.nutritionTargets?.elliott?.dailyProtein ?? prefs.elliottProt
  };

  const chloeProf = profiles.chloe || {
    name: 'Chloe',
    dailyKcal: prefs.nutritionTargets?.chloe?.dailyKcal ?? prefs.chloeCal,
    dailyProtein: prefs.nutritionTargets?.chloe?.dailyProtein ?? prefs.chloeProt
  };

  return `
    <div class="card profile-allocation-card" style="margin-bottom:16px;padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--surface)">
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;gap:8px">
        👥 Household Profile Preferences & Decoupled Splits
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(310px, 1fr));gap:16px">
        ${renderSingleProfileCard('elliott', elliottProf)}
        ${renderSingleProfileCard('chloe', chloeProf)}
      </div>

      <div style="margin-top:14px;background:rgba(37,99,235,0.04);border:1px solid rgba(37,99,235,0.15);padding:10px 12px;border-radius:8px;font-size:12px;color:var(--text2)">
        <span style="font-weight:700;color:var(--primary, #2563eb)">⚡ Decoupled Splits & Zero-Drift Engine:</span>
        Each profile configures independent calorie and protein percentages per meal. Dinner dynamically calculates as the exact remainder to eliminate rounding drift against daily targets.
      </div>
    </div>
  `;
}
