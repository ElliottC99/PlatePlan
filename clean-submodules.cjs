const fs = require("fs");
const acorn = require("acorn");

["planner-ui.js", "planner-swap.js", "planner-modals.js", "planner-studio.js"].forEach(filename => {
  const path = "./scripts/features/" + filename;
  let code = fs.readFileSync(path, "utf8");

  code = code.replace(/\/\*\*[\s\S]*?\*\//g, "");
  code = code.replace(/\(function\s*\(\)\s*\{/g, "");
  code = code.replace(/\(\(\)\s*=>\s*\{/g, "");
  code = code.replace(/\}\)\(\);/g, "");
  code = code.replace(/window\.PlatePlanPlanner\s*=[\s\S]*?\n\s*\}/g, "");
  code = code.replace(/const moduleExports[\s\S]*?\n\s*\}/g, "");
  code = code.replace(/var moduleExports[\s\S]*?\n\s*\}/g, "");
  code = code.replace(/const exportsMap[\s\S]*?\n\s*\}/g, "");
  code = code.replace(/for\s*\(const\s+k\s+of[\s\S]*?\n\s*\}/g, "");
  code = code.replace(/if\s*\(typeof\s+renderPlan[\s\S]*?\n\s*\}/g, "");
  code = code.replace(/if\s*\(typeof\s+renderPlanHistoryPanel[\s\S]*?\n\s*\}/g, "");
  code = code.replace(/const PlannerState\s*=\s*[^;\n]+;/g, "");
  code = code.replace(/const getState\s*=\s*\([^)]*\)\s*=>\s*[^;]+;/g, "");

  const fnMatches = [...code.matchAll(/function\s+([a-zA-Z0-9_$]+)\s*\(/g)];
  const fnNames = [...new Set(fnMatches.map(m => m[1]))];

  let title = filename === "planner-ui.js" ? "Core Planner Grid & UI Rendering Engine" :
              filename === "planner-swap.js" ? "Recipe Swap & Pinned Picker Engine" :
              filename === "planner-modals.js" ? "Options, Dates & History Engine" :
              "Meal Plan Studio & Wizard Engine";

  let wrapped = `/**
 * scripts/features/${filename}
 * PlatePlan ${title}
 */
(function() {
  'use strict';
  window.PlatePlanPlanner = window.PlatePlanPlanner || {};
  window.PlatePlanPlanner.State = window.PlatePlanPlanner.State || {
    draftDayDates: {},
    isReconcilingSummaries: false,
    summaryObserver: null,
    useUpCoverageCache: new Map(),
    useUpSaveTimer: null,
    pinnedPickerFilter: 'all',
    pinnedPickerSearch: '',
    studioSession: null,
    studioUndoBuffer: null,
    searchableSwapContext: null,
    swapModalContext: null,
    swapModalFilter: 'all'
  };
  const PlannerState = window.PlatePlanPlanner.State;
  const getState = () => (typeof window !== 'undefined' && window.state) || (typeof state !== 'undefined' ? state : {});

  ${code.trim()}

  const moduleExports = {
    ${fnNames.join(",\n    ")}
  };

  window.PlatePlanPlanner = Object.assign(window.PlatePlanPlanner || {}, moduleExports);
  if (typeof window !== 'undefined') {
    for (const k of Object.keys(moduleExports)) {
      try { window[k] = moduleExports[k]; } catch(e) {}
    }
`;

  if (filename === "planner-ui.js") {
    wrapped += `    if (typeof renderPlan !== 'undefined') {
      window.renderPlannerView = renderPlan;
      window.renderPlan = renderPlan;
    }
`;
  }
  if (filename === "planner-modals.js") {
    wrapped += `    if (typeof renderPlanHistoryPanel !== 'undefined') {
      window.renderLibrary = renderPlanHistoryPanel;
      window.renderMealPlanLibrary = renderPlanHistoryPanel;
      window.renderPlanlib = renderPlanHistoryPanel;
    }
`;
  }

  wrapped += `  }
})();
`;

  try {
    acorn.parse(wrapped, { ecmaVersion: "latest", sourceType: "script" });
    fs.writeFileSync(path, wrapped, "utf8");
    console.log(filename, "cleaned and successfully built!");
  } catch (err) {
    console.error(filename, "PARSE ERROR:", err.message);
  }
});
