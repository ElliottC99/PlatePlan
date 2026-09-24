/**
 * PlatePlan Settings Backup Audit Collectors (Diff/Analysis Engine)
 */
(function() {
  window.PlatePlanSettingsBackup = window.PlatePlanSettingsBackup || {};

  /**
   * Compute a scannable summary of differences between two PlatePlan states.
   */
  function renderBakedStateDifferenceSummary(browserState, fileState) {
    const renderDiffFn = window.PlatePlanSettingsBackup?.renderBakedStateDifferenceSummary || window.renderBakedStateDifferenceSummary;
    if (typeof renderDiffFn === 'function' && renderDiffFn !== renderBakedStateDifferenceSummary) {
      return renderDiffFn(browserState, fileState);
    }

    const rows = [];
    const diff = (label, browser, file) => {
      const bLen = Array.isArray(browser) ? browser.length : 0;
      const fLen = Array.isArray(file) ? file.length : 0;
      if (bLen !== fLen) {
        rows.push(`<div class="diff-row"><strong>${label}:</strong> browser has ${bLen}, file has ${fLen}</div>`);
      }
    };

    diff('Recipes', browserState?.recipes, fileState?.recipes);
    diff('Products', browserState?.ingredients, fileState?.ingredients);
    diff('Plan History', browserState?.planHistory, fileState?.planHistory);

    if (!rows.length) return '<div class="text-zinc-500">No structural differences detected.</div>';
    return rows.join('');
  }

  /**
   * Fingerprint a data object to detect changes without deep comparison.
   */
  function dataQualityFingerprint(value) {
    const stringify = window.safeJsonStringify || (v => JSON.stringify(v));
    const text = stringify(value) || '';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }

  const PlatePlanSettingsBackup = window.PlatePlanSettingsBackup;

  function collectDeterministicDataQualityIssues() {
    const issues = [];
    const currentState = window.state || {};
    const recipes = currentState.recipes || [];
    const products = currentState.ingredients || [];
    const createIssue = PlatePlanSettingsBackup.createDataQualityIssue || (() => ({}));

    // 1. Recipes with missing nutrition
    recipes.forEach(r => {
      if (!r.cal || !r.prot) {
        issues.push(createIssue({
          entityType: 'recipe',
          entityId: r.id,
          code: 'MISSING_NUTRITION',
          severity: 'critical',
          title: 'Missing nutrition data',
          message: `Recipe "${r.name}" has no calorie or protein information.`,
          source: r
        }));
      }
      
      // 2. Recipes with many ingredients but no oil
      const variants = (PlatePlanSettingsBackup.dataQualityRecipeVariants || (() => []))(r);
      variants.forEach(v => {
        const hasOil = (PlatePlanSettingsBackup.recipeVariantHasOilIngredient || (() => false))(v.ingredients);
        const suggestsOil = (PlatePlanSettingsBackup.recipeVariantMethodSuggestsOil || (() => false))(v.steps);
        if (!hasOil && suggestsOil && v.ingredients.length > 3) {
           issues.push(createIssue({
            entityType: 'recipe',
            entityId: r.id,
            code: 'POTENTIAL_MISSING_OIL',
            severity: 'advisory',
            title: `Potential missing oil (${v.label})`,
            message: `"${r.name}" (${v.label}) mentions frying/roasting but has no oil ingredient.`,
            source: r
          }));
        }
      });
    });

    // 3. Products with suspicious nutrition (e.g. 0 cal but high carbs)
    products.forEach(p => {
      const cal = parseFloat(p.cal) || 0;
      const prot = parseFloat(p.prot) || 0;
      const carb = parseFloat(p.carb) || 0;
      const fat = parseFloat(p.fat) || 0;
      
      if (cal < 10 && (prot > 5 || carb > 5 || fat > 2)) {
        issues.push(createIssue({
          entityType: 'product',
          entityId: p.id,
          code: 'SUSPICIOUS_MACROS',
          severity: 'warning',
          title: 'Suspicious macros',
          message: `Product "${p.name}" has very low calories (${cal}) but significant macros.`,
          source: p
        }));
      }
    });

    return issues;
  }

  function renderDataQualityIssue(issue) {
    const ppEscapeHtml = window.ppEscapeHtml || (s => s);
    const severityClass = issue.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-100' : 
                         issue.severity === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                         'bg-blue-50 text-blue-700 border-blue-100';
    
    return `
      <div class="dq-issue p-3 mb-2 rounded-lg border ${severityClass} text-xs shadow-sm">
        <div class="flex justify-between items-start mb-1">
          <strong class="font-bold uppercase tracking-tighter text-[10px]">${ppEscapeHtml(issue.severity)}</strong>
          <span class="text-[10px] opacity-60">#${ppEscapeHtml(issue.code)}</span>
        </div>
        <div class="font-bold text-sm mb-1">${ppEscapeHtml(issue.title)}</div>
        <div class="opacity-80 mb-2">${ppEscapeHtml(issue.message)}</div>
        ${issue.fixButtonHtml ? `<div class="mt-2 pt-2 border-t border-current opacity-20"></div>${issue.fixButtonHtml}` : ''}
      </div>
    `;
  }

  Object.assign(window.PlatePlanSettingsBackup, {
    collectDeterministicDataQualityIssues,
    renderDataQualityIssue,
    renderBakedStateDifferenceSummary,
    dataQualityFingerprint
  });
})();
