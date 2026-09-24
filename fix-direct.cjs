const fs = require("fs");
const acorn = require("acorn");

["planner-ui.js", "planner-swap.js", "planner-modals.js", "planner-studio.js"].forEach(filename => {
  const path = "./scripts/features/" + filename;
  let code = fs.readFileSync(path, "utf8");

  // Strip anything after the functions (strip previous IIFE wrappers or export blocks)
  // We can find the last function or strip everything after the last `}` or similar.
  // Or even simpler: let us keep only the function declarations and statements.
  // Let us remove leading IIFE header and trailing IIFE footer.
  code = code.replace(/^\/\*\*[\s\S]*?\*\/\s*/gm, "");
  code = code.replace(/^\s*\(function\s*\(\)\s*\{[\s\S]*?'use strict';/gm, "");
  code = code.replace(/window\.PlatePlanPlanner\.State\s*=[\s\S]*?getState[^\n]+\n/gm, "");
  code = code.replace(/if\s*\(typeof\s+[a-zA-Z0-9_$]+\s*!==\s*'undefined'\)[\s\S]*?\}/gm, "");
  code = code.replace(/\}\)\(\);\s*$/, "");

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
`;

  fnNames.forEach(name => {
    wrapped += `  if (typeof ${name} !== 'undefined') {
    window.PlatePlanPlanner.${name} = ${name};
    if (typeof window !== 'undefined') window.${name} = ${name};
  }
`;
  });

  if (filename === "planner-ui.js") {
    wrapped += `  if (typeof renderPlan !== 'undefined') {
    window.renderPlannerView = renderPlan;
    window.renderPlan = renderPlan;
  }
`;
  }
  if (filename === "planner-modals.js") {
    wrapped += `  if (typeof renderPlanHistoryPanel !== 'undefined') {
    window.renderLibrary = renderPlanHistoryPanel;
    window.renderMealPlanLibrary = renderPlanHistoryPanel;
    window.renderPlanlib = renderPlanHistoryPanel;
  }
`;
  }

  wrapped += `})();
`;

  try {
    acorn.parse(wrapped, { ecmaVersion: "latest", sourceType: "script" });
    fs.writeFileSync(path, wrapped, "utf8");
    console.log(filename, "clean direct fix applied successfully!");
  } catch (err) {
    console.error(filename, "PARSE ERROR:", err.message);
  }
});
