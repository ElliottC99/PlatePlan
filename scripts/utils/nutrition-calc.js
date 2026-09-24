/**
 * scripts/utils/nutrition-calc.js
 * Pure Nutrition Parsing & Value Extraction Helpers
 */
(function() {
  window.PlatePlanNutrition = window.PlatePlanNutrition || {};

  /**
   * Extract all numeric values from a string as an array of numbers.
   */
  function numericNutritionValues(value) {
    if (value === null || value === undefined) return [];
    if (typeof value === 'number') return Number.isFinite(value) ? [value] : [];
    return String(value).match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  }

  /**
   * Parse a plain text nutrition label into a normalized payload.
   */
  async function parsePlainNutritionLabel(text) {
    const raw = String(text || '').replace(/\r/g, '\n');
    const lines = raw.split(/\n|;/).map(x => x.trim()).filter(Boolean);
    const joined = lines.join(' | ');
    const payload = {};
    
    const normalizeEnergy = window.PlatePlanNutrition.normalizeEnergyKcal || (v => +v || 0);
    const normalizePayload = window.PlatePlanNutrition.normalizeNutritionPayload || (v => v);
    
    payload.cal = normalizeEnergy(joined);

    function valueFor(labels) {
      const patterns = labels.flatMap(label => [
        new RegExp('(?:^|\\b)' + label + '\\b[^0-9]{0,30}(\\d+(?:\\.\\d+)?)', 'i'),
        new RegExp('(\\d+(?:\\.\\d+)?)\\s*g?\\s*(?:^|\\b)' + label + '\\b', 'i')
      ]);
      for (const line of lines) {
        const clean = line.toLowerCase();
        for (const pat of patterns) {
          const m = clean.match(pat);
          if (m) return +m[1] || 0;
        }
      }
      return 0;
    }

    payload.fat = valueFor(['fat', 'total fat']);
    payload.carb = valueFor(['carbohydrate', 'carbohydrates', 'carbs', 'total carbohydrate']);
    payload.fibre = valueFor(['fibre', 'fiber']);
    payload.prot = valueFor(['protein']);
    
    return normalizePayload(payload);
  }

  Object.assign(window.PlatePlanNutrition, {
    numericNutritionValues,
    parsePlainNutritionLabel
  });

  window.numericNutritionValues = numericNutritionValues;
  window.parsePlainNutritionLabel = parsePlainNutritionLabel;
})();
