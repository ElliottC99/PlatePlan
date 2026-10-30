/**
 * src/components/settings/FitScoreTaperingCard.js
 * Fine-grained Fit Score Tapering & Weighting Controls with Live Interactive Preview.
 */

import {
  DEFAULT_FIT_SCORE_PARAMS,
  resolveFitScoreParams,
  getFitScoreTierMeta,
  calculateCalorieScore,
  calculateProteinScore
} from '../../utils/fitScoreCalculator.js';

const PREVIEW_RATIOS = [60, 75, 88, 98, 105, 118, 140];

function renderPreviewRowsHtml(params) {
  const resolved = resolveFitScoreParams(params);
  return PREVIEW_RATIOS.map(pct => {
    const calScore = Math.round(calculateCalorieScore(pct, 100, resolved));
    const protScore = Math.round(calculateProteinScore(pct, 100, resolved));
    const combined = Math.round((calScore * resolved.calorieWeight) + (protScore * resolved.proteinWeight));
    const meta = getFitScoreTierMeta(combined);
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 6px;background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:8px;text-align:center">
        <span style="font-size:11px;font-weight:800;color:var(--text,#0f172a)">${pct}% of Target</span>
        <div style="font-size:10px;color:var(--text2,#64748b);display:flex;gap:6px">
          <span>🔥 ${calScore}%</span>
          <span>💪 ${protScore}%</span>
        </div>
        <span style="display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:700;padding:2px 6px;border-radius:6px;background:${meta.bg};color:${meta.text};border:1px solid ${meta.color}">
          ${meta.icon} ${combined}%
        </span>
      </div>
    `;
  }).join('');
}

export function readFitScoreParamsFromDOM(root = document) {
  if (!root) return { ...DEFAULT_FIT_SCORE_PARAMS };
  const val = (id, fallback) => {
    const el = root.querySelector(`#${id}`);
    if (!el || el.value === '') return fallback;
    const n = Number(el.value);
    return Number.isFinite(n) ? n : fallback;
  };
  return resolveFitScoreParams({
    calorieWeightPct: val('pp-fit-cal-weight', DEFAULT_FIT_SCORE_PARAMS.calorieWeightPct),
    proteinWeightPct: val('pp-fit-prot-weight', DEFAULT_FIT_SCORE_PARAMS.proteinWeightPct),
    calLowFloorPct: val('pp-fit-cal-low-floor', DEFAULT_FIT_SCORE_PARAMS.calLowFloorPct),
    calMinGracePct: val('pp-fit-cal-min-grace', DEFAULT_FIT_SCORE_PARAMS.calMinGracePct),
    calMinOptPct: val('pp-fit-cal-min-opt', DEFAULT_FIT_SCORE_PARAMS.calMinOptPct),
    calMaxOptPct: val('pp-fit-cal-max-opt', DEFAULT_FIT_SCORE_PARAMS.calMaxOptPct),
    calMaxGracePct: val('pp-fit-cal-max-grace', DEFAULT_FIT_SCORE_PARAMS.calMaxGracePct),
    calHighCeilPct: val('pp-fit-cal-high-ceil', DEFAULT_FIT_SCORE_PARAMS.calHighCeilPct),
    protLowFloorPct: val('pp-fit-prot-low-floor', DEFAULT_FIT_SCORE_PARAMS.protLowFloorPct),
    protMinGracePct: val('pp-fit-prot-min-grace', DEFAULT_FIT_SCORE_PARAMS.protMinGracePct),
    protMinOptPct: val('pp-fit-prot-min-opt', DEFAULT_FIT_SCORE_PARAMS.protMinOptPct),
    protMaxOptPct: val('pp-fit-prot-max-opt', DEFAULT_FIT_SCORE_PARAMS.protMaxOptPct),
    protMaxGracePct: val('pp-fit-prot-max-grace', DEFAULT_FIT_SCORE_PARAMS.protMaxGracePct),
    protHighCeilPct: val('pp-fit-prot-high-ceil', DEFAULT_FIT_SCORE_PARAMS.protHighCeilPct)
  });
}

export function bindFitScoreTaperingListeners(container) {
  if (!container) return;
  const card = container.querySelector('#pp-fit-tapering-card');
  if (!card) return;

  const updatePreview = (changedId = '') => {
    const calWEl = card.querySelector('#pp-fit-cal-weight');
    const protWEl = card.querySelector('#pp-fit-prot-weight');
    if (changedId === 'pp-fit-cal-weight' && calWEl && protWEl) {
      const c = Math.max(0, Math.min(100, Number(calWEl.value) || 0));
      protWEl.value = 100 - c;
    } else if (changedId === 'pp-fit-prot-weight' && calWEl && protWEl) {
      const p = Math.max(0, Math.min(100, Number(protWEl.value) || 0));
      calWEl.value = 100 - p;
    }
    const currentParams = readFitScoreParamsFromDOM(card);
    const previewGrid = card.querySelector('#pp-fit-tapering-preview-grid');
    if (previewGrid) {
      previewGrid.innerHTML = renderPreviewRowsHtml(currentParams);
    }
  };

  card.querySelectorAll('.pp-fit-taper-input').forEach(input => {
    input.addEventListener('input', (e) => updatePreview(e.target.id));
  });

  const resetBtn = card.querySelector('#pp-reset-fit-tapering-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const d = DEFAULT_FIT_SCORE_PARAMS;
      const map = {
        'pp-fit-cal-weight': d.calorieWeightPct,
        'pp-fit-prot-weight': d.proteinWeightPct,
        'pp-fit-cal-low-floor': d.calLowFloorPct,
        'pp-fit-cal-min-grace': d.calMinGracePct,
        'pp-fit-cal-min-opt': d.calMinOptPct,
        'pp-fit-cal-max-opt': d.calMaxOptPct,
        'pp-fit-cal-max-grace': d.calMaxGracePct,
        'pp-fit-cal-high-ceil': d.calHighCeilPct,
        'pp-fit-prot-low-floor': d.protLowFloorPct,
        'pp-fit-prot-min-grace': d.protMinGracePct,
        'pp-fit-prot-min-opt': d.protMinOptPct,
        'pp-fit-prot-max-opt': d.protMaxOptPct,
        'pp-fit-prot-max-grace': d.protMaxGracePct,
        'pp-fit-prot-high-ceil': d.protHighCeilPct
      };
      Object.entries(map).forEach(([id, v]) => {
        const el = card.querySelector(`#${id}`);
        if (el) el.value = v;
      });
      updatePreview();
    });
  }
}

export function renderFitScoreTaperingCard(prefs = {}) {
  const raw = prefs?.fitScoreParams || prefs?.userPrefs?.fitScoreParams || {};
  const p = resolveFitScoreParams(raw);

  return `
    <div class="card" id="pp-fit-tapering-card" style="margin-bottom:16px;padding:16px 18px;border:1px solid var(--border,#e2e8f0);border-radius:12px;background:var(--surface,#fff)">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px">
        <div style="font-size:15px;font-weight:700;color:var(--text,#0f172a);display:flex;align-items:center;gap:8px">
          🎯 Universal Fit Score &amp; Tapering Rules
        </div>
        <button type="button" id="pp-reset-fit-tapering-btn" class="btn sm ghost" style="font-size:11.5px;padding:4px 10px">
          ↺ Reset Tapering to Defaults
        </button>
      </div>
      <p style="font-size:12px;color:var(--text2,#64748b);margin:0 0 14px 0;line-height:1.45">
        Controls the single universal Fit Score across Recipe Vault, Modals, Planner, and Today views. Percentages are relative to each meal's target Calories and Protein.
      </p>

      <!-- Macro Weight Balance -->
      <div style="background:var(--surface2,#f8fafc);border:1px solid var(--border,#e2e8f0);padding:10px 12px;border-radius:8px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:var(--text,#0f172a);margin-bottom:6px">⚖️ MACRO WEIGHTING BALANCE (SUM = 100%)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label for="pp-fit-cal-weight" style="font-size:11px;font-weight:600;color:var(--text2,#475569);display:block;margin-bottom:3px">🔥 Calorie Weight (%)</label>
            <input type="number" id="pp-fit-cal-weight" class="pp-fit-taper-input" min="0" max="100" value="${p.calorieWeightPct}" style="width:100%;font-size:12px">
          </div>
          <div>
            <label for="pp-fit-prot-weight" style="font-size:11px;font-weight:600;color:var(--text2,#475569);display:block;margin-bottom:3px">💪 Protein Weight (%)</label>
            <input type="number" id="pp-fit-prot-weight" class="pp-fit-taper-input" min="0" max="100" value="${p.proteinWeightPct}" style="width:100%;font-size:12px">
          </div>
        </div>
      </div>

      <!-- Calorie Tapering Curve -->
      <div style="background:var(--surface2,#f8fafc);border:1px solid var(--border,#e2e8f0);padding:10px 12px;border-radius:8px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:var(--text,#0f172a);margin-bottom:6px">🔥 CALORIE TAPERING CURVE (% OF MEAL TARGET)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(115px, 1fr));gap:8px">
          <div>
            <label for="pp-fit-cal-low-floor" style="font-size:10px;color:var(--text2,#475569);display:block">0% Floor (Under)</label>
            <input type="number" id="pp-fit-cal-low-floor" class="pp-fit-taper-input" min="0" max="100" value="${p.calLowFloorPct}" style="width:100%;font-size:11.5px">
          </div>
          <div>
            <label for="pp-fit-cal-min-grace" style="font-size:10px;color:var(--text2,#475569);display:block">🟢 Grace Min (86%)</label>
            <input type="number" id="pp-fit-cal-min-grace" class="pp-fit-taper-input" min="10" max="120" value="${p.calMinGracePct}" style="width:100%;font-size:11.5px">
          </div>
          <div>
            <label for="pp-fit-cal-min-opt" style="font-size:10px;color:var(--text2,#475569);display:block">🎯 100% Sweet Min</label>
            <input type="number" id="pp-fit-cal-min-opt" class="pp-fit-taper-input" min="20" max="150" value="${p.calMinOptPct}" style="width:100%;font-size:11.5px">
          </div>
          <div>
            <label for="pp-fit-cal-max-opt" style="font-size:10px;color:var(--text2,#475569);display:block">🎯 100% Sweet Max</label>
            <input type="number" id="pp-fit-cal-max-opt" class="pp-fit-taper-input" min="50" max="200" value="${p.calMaxOptPct}" style="width:100%;font-size:11.5px">
          </div>
          <div>
            <label for="pp-fit-cal-max-grace" style="font-size:10px;color:var(--text2,#475569);display:block">🟢 Grace Max (86%)</label>
            <input type="number" id="pp-fit-cal-max-grace" class="pp-fit-taper-input" min="60" max="250" value="${p.calMaxGracePct}" style="width:100%;font-size:11.5px">
          </div>
          <div>
            <label for="pp-fit-cal-high-ceil" style="font-size:10px;color:var(--text2,#475569);display:block">0% Ceiling (Over)</label>
            <input type="number" id="pp-fit-cal-high-ceil" class="pp-fit-taper-input" min="100" max="400" value="${p.calHighCeilPct}" style="width:100%;font-size:11.5px">
          </div>
        </div>
      </div>

      <!-- Protein Tapering Curve -->
      <div style="background:var(--surface2,#f8fafc);border:1px solid var(--border,#e2e8f0);padding:10px 12px;border-radius:8px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:var(--text,#0f172a);margin-bottom:6px">💪 PROTEIN TAPERING CURVE (% OF MEAL TARGET)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(115px, 1fr));gap:8px">
          <div>
            <label for="pp-fit-prot-low-floor" style="font-size:10px;color:var(--text2,#475569);display:block">0% Floor (Under)</label>
            <input type="number" id="pp-fit-prot-low-floor" class="pp-fit-taper-input" min="0" max="100" value="${p.protLowFloorPct}" style="width:100%;font-size:11.5px">
          </div>
          <div>
            <label for="pp-fit-prot-min-grace" style="font-size:10px;color:var(--text2,#475569);display:block">🟢 Grace Min (86%)</label>
            <input type="number" id="pp-fit-prot-min-grace" class="pp-fit-taper-input" min="10" max="150" value="${p.protMinGracePct}" style="width:100%;font-size:11.5px">
          </div>
          <div>
            <label for="pp-fit-prot-min-opt" style="font-size:10px;color:var(--text2,#475569);display:block">🎯 100% Sweet Min</label>
            <input type="number" id="pp-fit-prot-min-opt" class="pp-fit-taper-input" min="20" max="200" value="${p.protMinOptPct}" style="width:100%;font-size:11.5px">
          </div>
          <div>
            <label for="pp-fit-prot-max-opt" style="font-size:10px;color:var(--text2,#475569);display:block">🎯 100% Sweet Max</label>
            <input type="number" id="pp-fit-prot-max-opt" class="pp-fit-taper-input" min="50" max="250" value="${p.protMaxOptPct}" style="width:100%;font-size:11.5px">
          </div>
          <div>
            <label for="pp-fit-prot-max-grace" style="font-size:10px;color:var(--text2,#475569);display:block">🟢 Grace Max (86%)</label>
            <input type="number" id="pp-fit-prot-max-grace" class="pp-fit-taper-input" min="60" max="300" value="${p.protMaxGracePct}" style="width:100%;font-size:11.5px">
          </div>
          <div>
            <label for="pp-fit-prot-high-ceil" style="font-size:10px;color:var(--text2,#475569);display:block">0% Ceiling (Over)</label>
            <input type="number" id="pp-fit-prot-high-ceil" class="pp-fit-taper-input" min="100" max="500" value="${p.protHighCeilPct}" style="width:100%;font-size:11.5px">
          </div>
        </div>
      </div>

      <!-- Live Curve Preview -->
      <div style="background:rgba(37,99,235,0.04);border:1px solid rgba(37,99,235,0.15);padding:10px 12px;border-radius:8px">
        <div style="font-size:11px;font-weight:700;color:var(--primary,#2563eb);margin-bottom:8px">
          📈 LIVE TAPERING PREVIEW (IF BOTH CALORIES &amp; PROTEIN ARE AT % OF TARGET)
        </div>
        <div id="pp-fit-tapering-preview-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(95px, 1fr));gap:6px">
          ${renderPreviewRowsHtml(p)}
        </div>
      </div>
    </div>
  `;
}
