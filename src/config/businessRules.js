/**
 * src/config/businessRules.js
 * Centralized business logic thresholds and scoring rules.
 */

export const FIT_SCORE_TIERS = {
  IDEAL: { min: 85, tier: 'green', icon: '🟢', color: '#22c55e', label: 'Ideal Match', colors: 'background-color:#dcfce7;color:#14532d;border:1px solid #22c55e;' },
  ACCEPTABLE: { min: 70, tier: 'yellow', icon: '🟡', color: '#eab308', label: 'Needs Work', colors: 'background-color:#fef9c3;color:#713f12;border:1px solid #eab308;' },
  SUBOPTIMAL: { min: 50, tier: 'orange', icon: '🟠', color: '#f97316', label: 'Suboptimal', colors: 'background-color:#ffedd5;color:#7c2d12;border:1px solid #f97316;' },
  POOR: { min: 0, tier: 'red', icon: '🔴', color: '#ef4444', label: 'Poor Match', colors: 'background-color:#fee2e2;color:#7f1d1d;border:1px solid #ef4444;' }
};

export const DQ_CONFIDENCE_THRESHOLD = 0.85;
export const AUDIT_SUGGESTION_THRESHOLD = 0.7;
