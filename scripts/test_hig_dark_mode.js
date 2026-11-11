/**
 * scripts/test_hig_dark_mode.js
 * Regression test for Apple HIG Light & Dark Mode unification, semantic status badges,
 * theme persistence synchronization, and bottom navigation bar Data Quality tab routing.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const read = rel => fs.readFileSync(path.join(rootDir, rel), 'utf8');

console.log('=== RUNNING APPLE HIG LIGHT/DARK MODE & NAV REGRESSION TEST ===');

// 1. Token single-source-of-truth checks
const tokensCss = read('styles/tokens.css');
const responsiveCss = read('styles/responsive.css');
const componentsCss = read('styles/components.css');
const indexHtml = read('index.html');

const requiredTokens = [
  '--system-bg',
  '--secondary-system-grouped-bg',
  '--tertiary-system-grouped-bg',
  '--label',
  '--secondary-label',
  '--tertiary-label',
  '--separator',
  '--tint-color',
  '--system-blue',
  '--system-red',
  '--danger',
  '--card',
  '--badge-green-bg',
  '--badge-green-text',
  '--badge-green-border',
  '--badge-yellow-bg',
  '--badge-yellow-text',
  '--badge-yellow-border',
  '--badge-orange-bg',
  '--badge-orange-text',
  '--badge-orange-border',
  '--badge-red-bg',
  '--badge-red-text',
  '--badge-red-border',
  '--badge-blue-bg',
  '--badge-blue-text',
  '--badge-blue-border',
  '--badge-neutral-bg',
  '--badge-neutral-text',
  '--badge-neutral-border'
];

for (const token of requiredTokens) {
  assert.ok(tokensCss.includes(`${token}:`), `styles/tokens.css must define ${token}`);
}

assert.ok(
  tokensCss.includes('html[data-theme="light"]') && tokensCss.includes('html.theme-light'),
  'styles/tokens.css must include explicit light mode selectors (html[data-theme="light"], html.theme-light)'
);
assert.ok(
  tokensCss.includes('html[data-theme="dark"]') && tokensCss.includes('html.theme-dark'),
  'styles/tokens.css must include explicit dark mode selectors (html[data-theme="dark"], html.theme-dark)'
);

assert.ok(
  !responsiveCss.includes('--bg:#111214') && !responsiveCss.includes('--surface:#1b1c1f'),
  'styles/responsive.css must not re-declare legacy dark mode --bg/#111214 or --surface/#1b1c1f'
);
assert.ok(
  !responsiveCss.includes('#0969da'),
  'styles/responsive.css must not override primary actions with GitHub blue #0969da'
);
assert.ok(
  !/\.btn\.primary[^{]*\{[^}]*background:\s*var\(--text/.test(componentsCss) &&
  !/\.btn\.primary[^{]*\{[^}]*background:\s*var\(--text/.test(indexHtml),
  '.btn.primary must not use background: var(--text) which turns white-on-white in Dark Mode'
);

// 2. Theme persistence synchronization (index.html & SettingsView.js)
const settingsViewSrc = read('src/views/SettingsView.js');
assert.ok(
  indexHtml.includes('plateplan-appearance') && indexHtml.includes('plateplan_appearance'),
  'index.html boot script must check both plateplan-appearance and plateplan_appearance'
);
assert.ok(
  settingsViewSrc.includes('plateplan-appearance') && settingsViewSrc.includes('plateplan_appearance'),
  'SettingsView.applyTheme must persist both plateplan-appearance and plateplan_appearance'
);

// Test applyTheme behavior with mocked DOM/localStorage
const storageMap = new Map();
globalThis.localStorage = {
  getItem: k => storageMap.get(k) ?? null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: k => storageMap.delete(k)
};

const classSet = new Set();
globalThis.document = {
  documentElement: {
    dataset: {},
    style: {},
    classList: {
      add: (...cls) => cls.forEach(c => classSet.add(c)),
      remove: (...cls) => cls.forEach(c => classSet.delete(c)),
      contains: c => classSet.has(c)
    }
  },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};
globalThis.window = {
  localStorage: globalThis.localStorage,
  document: globalThis.document,
  addEventListener: () => {}
};

const { applyTheme } = await import('../src/views/SettingsView.js');
applyTheme('dark');
assert.equal(globalThis.document.documentElement.dataset.theme, 'dark');
assert.ok(classSet.has('theme-dark') && !classSet.has('theme-light'));
assert.equal(globalThis.document.documentElement.style.colorScheme, 'dark');
assert.equal(storageMap.get('plateplan-appearance'), 'dark');
assert.equal(storageMap.get('plateplan_appearance'), 'dark');

applyTheme('light');
assert.equal(globalThis.document.documentElement.dataset.theme, 'light');
assert.ok(classSet.has('theme-light') && !classSet.has('theme-dark'));
assert.equal(globalThis.document.documentElement.style.colorScheme, 'light');
assert.equal(storageMap.get('plateplan-appearance'), 'light');
assert.equal(storageMap.get('plateplan_appearance'), 'light');

applyTheme('system');
assert.equal(globalThis.document.documentElement.dataset.theme, undefined);
assert.ok(!classSet.has('theme-light') && !classSet.has('theme-dark'));
assert.equal(globalThis.document.documentElement.style.colorScheme, 'light dark');

// 3. Bottom navigation bar Data Quality tab check
const mobileNavMatch = indexHtml.match(/<nav[^>]*id="mobile-nav"[^>]*>([\s\S]*?)<\/nav>/);
assert.ok(mobileNavMatch, 'index.html must contain #mobile-nav');
const mobileNavHtml = mobileNavMatch[1];
assert.ok(
  !mobileNavHtml.includes('data-view="shopping"'),
  '#mobile-nav must not contain the Shopping shortcut tab'
);
assert.ok(
  mobileNavHtml.includes('data-view="data"') &&
  mobileNavHtml.includes("showView('data')") &&
  mobileNavHtml.includes('Data Quality'),
  '#mobile-nav must contain the Data Quality tab routing to showView(\'data\')'
);

const { syncMobileNavigation } = await import('../src/core/AppRouter.js');
const mockTabs = ['today', 'planner', 'vault', 'ingredients', 'data'].map(view => ({
  dataset: { view },
  active: false,
  ariaSelected: 'false',
  classList: {
    toggle(cls, force) {
      if (cls === 'active') this.active = Boolean(force);
    }
  },
  setAttribute(attr, val) {
    if (attr === 'aria-selected') this.ariaSelected = val;
  }
}));
globalThis.document.getElementById = id => (id === 'mobile-nav' ? {
  querySelectorAll: () => mockTabs
} : null);

syncMobileNavigation('data');
assert.equal(mockTabs.find(t => t.dataset.view === 'data').ariaSelected, 'true', 'syncMobileNavigation("data") must select data tab');
syncMobileNavigation('quality');
assert.equal(mockTabs.find(t => t.dataset.view === 'data').ariaSelected, 'true', 'syncMobileNavigation("quality") must select data tab');

// 4. FitScoreBadge adaptive token checks
const { renderFitScoreBadge } = await import('../src/components/FitScoreBadge.js');
for (const score of [92, 76, 58, 35]) {
  const badge = renderFitScoreBadge(score, 'dinner', { showLabel: true });
  assert.ok(badge.includes('var(--badge-'), `FitScoreBadge for score ${score} must use var(--badge-*) tokens`);
  assert.ok(
    !badge.includes('#dcfce7') && !badge.includes('#fef9c3') && !badge.includes('#ffedd5') && !badge.includes('#fee2e2'),
    `FitScoreBadge for score ${score} must not use hardcoded pastel hex fills`
  );
}
const neutralBadge = renderFitScoreBadge(null);
assert.ok(neutralBadge.includes('var(--badge-neutral-'), 'Missing fit score badge must use var(--badge-neutral-*) tokens');

// 5. Static scan across targeted modules for raw light surfaces / dark slate text outside var(...)
const targetModules = [
  'src/utils/fitScoreWeights.js',
  'src/config/businessRules.js',
  'src/components/FitScoreBadge.js',
  'src/components/planner/PlannerGridRenderService.js',
  'src/components/profile/ProfileMacroEditor.js',
  'src/components/profile/ProfilePreferencesForm.js',
  'src/components/profile/ProfileSettingsModal.js',
  'src/components/settings/ProfileAllocationCard.js',
  'src/components/settings/FitScoreTaperingCard.js',
  'src/components/settings/DietaryExclusionManager.js',
  'src/services/RecipeDetailModalService.js',
  'src/components/recipe/RecipeEnhancementModalUI.js',
  'src/components/recipe/RecipeAuditModal.js',
  'src/components/recipe/RecipeAuditModalRenderService.js',
  'src/components/recipe/RecipeWizardViews.js',
  'src/components/recipe/RecipeWizardStep2View.js',
  'src/components/recipe/RecipeWizardStep3View.js',
  'src/components/recipe/RecipeWizardTaxonomySearch.js',
  'src/components/ProductSwapModal.js',
  'src/views/DataQualityTableRenderService.js',
  'src/components/data-quality/UnlinkedSweeperUI.js',
  'src/components/data-quality/MealPlanSyncWarningModal.js',
  'src/components/data-quality/SubtypeOrphanResolverModal.js',
  'src/components/data-quality/MergeIngredientsModal.js',
  'src/components/data-quality/ResolveUnlinkedModalRenderService.js',
  'src/components/data-quality/MacroDriftPreviewModal.js',
  'src/components/pantry/ReallocateProductModalRenderService.js',
  'src/components/pantry/RecipeSearchDropdownHelper.js',
  'src/components/pantry/SubtypeProductLinkerModalUI.js',
  'src/components/pantry/CategoryManagerModalUI.js',
  'src/components/pantry/ReorganiseModalUI.js',
  'src/components/navigation/ActionSheetUI.js',
  'src/services/AuthService.js'
];

const forbiddenRawPattern = /(background(?:-color)?\s*:\s*#(fff|ffffff|f8fafc|f1f5f9|fafaf9|fbfbf9|eff6ff|f0fdf4|fef2f2|dcfce7|fef9c3|ffedd5|fee2e2)\b|(?<!-)color\s*:\s*#(0f172a|1e293b|1c1917|334155|475569|64748b)\b|style\.background\s*=\s*['"]#(fff|ffffff|f8fafc|f1f5f9)['"])/i;

const violations = [];
for (const mod of targetModules) {
  const lines = read(mod).split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    const withoutVars = line.replace(/var\([^)]*\)/g, '');
    const m = withoutVars.match(forbiddenRawPattern);
    if (m) {
      violations.push(`${mod}:${i + 1}: ${m[0]} -> ${trimmed.slice(0, 100)}`);
    }
  });
}

assert.equal(
  violations.length,
  0,
  `Found ${violations.length} hardcoded light/dark contrast violations:\n${violations.slice(0, 25).join('\n')}`
);

console.log('✅ All Apple HIG Light/Dark Mode & Navigation assertions passed!');
