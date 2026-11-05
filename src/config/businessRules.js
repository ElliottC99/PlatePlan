/**
 * src/config/businessRules.js
 * Centralized business logic thresholds and scoring rules.
 */

export const FIT_SCORE_TIERS = {
  IDEAL: { min: 85, tier: 'green', icon: '🟢', color: 'var(--system-green)', label: 'Ideal Match', colors: 'background-color:var(--badge-green-bg);color:var(--badge-green-text);border:1px solid var(--badge-green-border);' },
  ACCEPTABLE: { min: 70, tier: 'yellow', icon: '🟡', color: 'var(--system-yellow)', label: 'Needs Work', colors: 'background-color:var(--badge-yellow-bg);color:var(--badge-yellow-text);border:1px solid var(--badge-yellow-border);' },
  SUBOPTIMAL: { min: 50, tier: 'orange', icon: '🟠', color: 'var(--system-orange)', label: 'Suboptimal', colors: 'background-color:var(--badge-orange-bg);color:var(--badge-orange-text);border:1px solid var(--badge-orange-border);' },
  POOR: { min: 0, tier: 'red', icon: '🔴', color: 'var(--system-red)', label: 'Poor Match', colors: 'background-color:var(--badge-red-bg);color:var(--badge-red-text);border:1px solid var(--badge-red-border);' }
};

export const DQ_CONFIDENCE_THRESHOLD = 0.85;
export const AUDIT_SUGGESTION_THRESHOLD = 0.7;
