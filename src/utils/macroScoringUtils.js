/**
 * src/utils/macroScoringUtils.js (v3.38.63)
 * Pure mathematical utilities for macro extraction and fit score curve interpolation.
 */

export function parsePositiveNumberOrNull(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  const num = Number(String(val).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : null;
}

export function pickFirstValidMacro(candidates = []) {
  for (const c of candidates) {
    const parsed = parsePositiveNumberOrNull(c);
    if (parsed !== null && parsed > 0) return parsed;
  }
  for (const c of candidates) {
    const parsed = parsePositiveNumberOrNull(c);
    if (parsed !== null) return parsed;
  }
  return null;
}

/**
 * Exhaustively extracts per-serving calories and protein across all supported schema keys.
 * Strictly returns `null` (not 0) when a macro is missing so missing data can be explicitly flagged.
 */
export function extractRecipeMacros(recipe, variant = 'original') {
  if (!recipe || typeof recipe !== 'object') {
    return { cal: null, prot: null, calories: null, protein: null };
  }
  const r = recipe.recipe || recipe;

  const extractFromNode = (node) => {
    if (!node || typeof node !== 'object') return { cal: null, prot: null };
    const cal = pickFirstValidMacro([
      node.nutrition?.perServing?.cal,
      node.nutrition?.perServing?.calories,
      node.perServing?.cal,
      node.perServing?.calories,
      node.macros?.cal,
      node.macros?.calories,
      node.cal,
      node.calories,
      node.kcal
    ]);
    const prot = pickFirstValidMacro([
      node.nutrition?.perServing?.prot,
      node.nutrition?.perServing?.protein,
      node.perServing?.prot,
      node.perServing?.protein,
      node.macros?.prot,
      node.macros?.protein,
      node.prot,
      node.protein
    ]);
    return { cal, prot };
  };

  if (variant === 'enhanced' && r.enhanced && typeof r.enhanced === 'object') {
    const enh = extractFromNode(r.enhanced);
    const base = extractFromNode(r);
    const cal = (enh.cal !== null && enh.cal > 0) ? enh.cal : base.cal;
    const prot = (enh.prot !== null && enh.prot > 0) ? enh.prot : base.prot;
    return { cal, prot, calories: cal, protein: prot };
  }

  const base = extractFromNode(r);
  return { cal: base.cal, prot: base.prot, calories: base.cal, protein: base.prot };
}

/**
 * Sweeps the active recipe database for missing or non-positive calorie/protein macros.
 */
export function sweepRecipeMacroQuality(recipes = []) {
  const list = Array.isArray(recipes) ? recipes : Object.values(recipes || {});
  const flagged = [];

  list.forEach(r => {
    if (!r || typeof r !== 'object') return;
    const { cal, prot } = extractRecipeMacros(r, 'original');
    const missingCal = cal === null || cal <= 0;
    const missingProt = prot === null || prot <= 0;
    if (missingCal || missingProt) {
      flagged.push({
        id: r.id || '',
        name: r.name || r.title || 'Untitled Recipe',
        calories: cal,
        protein: prot,
        missingCal,
        missingProt
      });
    }
  });

  return flagged;
}

/**
 * Universal Asymmetric Calorie Score Curve (50% Weight)
 */
export function calculateCalorieScore(actual, target) {
  if (!target || target <= 0 || actual === null || actual === undefined || actual <= 0) return 0;
  const r = actual / target;

  if (r >= 0.95 && r <= 1.00) return 100;
  if (r >= 0.85 && r < 0.95) return 86 + ((r - 0.85) / (0.95 - 0.85)) * (99 - 86);
  if (r > 1.00 && r <= 1.05) return 99 - ((r - 1.00) / (1.05 - 1.00)) * (99 - 86);
  if (r < 0.85) {
    if (r <= 0.50) return 0;
    return ((r - 0.50) / (0.85 - 0.50)) * 85;
  }
  if (r > 1.05) {
    if (r >= 1.40) return 0;
    return (1 - ((r - 1.05) / (1.40 - 1.05))) * 85;
  }
  return 0;
}

/**
 * Universal Asymmetric Protein Score Curve (50% Weight)
 */
export function calculateProteinScore(actual, target) {
  if (!target || target <= 0 || actual === null || actual === undefined || actual <= 0) return 0;
  const r = actual / target;

  if (r >= 1.00 && r <= 1.20) return 100;
  if (r >= 0.95 && r < 1.00) return 86 + ((r - 0.95) / (1.00 - 0.95)) * (99 - 86);
  if (r > 1.20 && r <= 1.30) return 99 - ((r - 1.20) / (1.30 - 1.20)) * (99 - 86);
  if (r < 0.95) {
    if (r <= 0.70) return 0;
    return ((r - 0.70) / (0.95 - 0.70)) * 85;
  }
  if (r > 1.30) {
    if (r >= 2.00) return 0;
    return (1 - ((r - 1.30) / (2.00 - 1.30))) * 85;
  }
  return 0;
}
