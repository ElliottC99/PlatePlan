/**
 * scripts/test_recipe_wizard_ui_space_efficiency.js
 * Verification test suite for Recipe Wizard UI Space-Efficiency, Sticky Footer,
 * Compact Method Steps, and Two-Tier Ingredient Row Layout.
 */

import assert from 'node:assert';

// 1. Setup minimal browser DOM stubs
global.window = global.window || {};
global.document = {
  getElementById: (id) => null,
  querySelector: () => null,
  querySelectorAll: () => []
};

// 2. Import components under test
import { wizardState, resetWizardState } from '../src/components/recipe/RecipeWizardState.js';
import { renderState2Mapping, renderStep2Footer } from '../src/components/recipe/RecipeWizardStep2View.js';
import { renderWizardModal, renderWizardFooter } from '../src/components/recipe/RecipeWizardModal.js';
import { renderMacroBreakdownCrossbar } from '../src/components/recipe/RecipeWizardStep3View.js';

console.log('--- Running Recipe Wizard UI Space-Efficiency & Sticky Footer Tests ---');

// Test 1: Sticky Action Footer Rendering and Initial State
{
  console.log('Testing renderStep2Footer()...');
  resetWizardState();
  wizardState.currentStep = 2;
  wizardState.activeRecipe = {
    title: 'Boeuf Bourguignon',
    servings: 4,
    ingredientSections: [
      {
        sectionTitle: 'Main Ingredients',
        ingredients: [
          { qty: 2, unit: 'qty', name: 'Onions', raw: '2 brown onions', ingredientId: 'ing-onions' },
          { qty: 227, unit: 'g', name: 'Plant-Based Steak Pieces', raw: '227g steak pieces', isNewTaxonomyItem: true }
        ]
      }
    ],
    methodSteps: ['Sauté onions until golden.', 'Add plant-based steak.']
  };

  const footerHtml = renderStep2Footer();
  assert.ok(footerHtml.includes('class="ios-fullscreen-footer"'), 'Footer must have ios-fullscreen-footer class');
  assert.ok(footerHtml.includes('id="wizard-back-btn"'), 'Footer must contain back button');
  assert.ok(footerHtml.includes('id="wiz-gate-pill"'), 'Footer must contain interactive gating pill');
  assert.ok(footerHtml.includes('id="btn-next-step2"'), 'Footer must contain Next button');
  assert.ok(footerHtml.includes('disabled'), 'Next button must be disabled when unmapped items exist');
  assert.ok(footerHtml.includes('wiz-gate-pill blocked'), 'Gating pill must have blocked class');
  assert.ok(footerHtml.includes('1</span> unmapped item(s)'), 'Gating pill must reflect 1 unmapped item');

  console.log('  ✓ renderStep2Footer renders sticky footer with blocked gating pill');
}

// Test 2: Gating Pill Transitions to Ready when All Items Mapped
{
  console.log('Testing renderStep2Footer() with all mapped items...');
  wizardState.activeRecipe.ingredientSections[0].ingredients[1] = {
    qty: 227,
    unit: 'g',
    name: 'Plant-Based Steak Pieces',
    raw: '227g steak pieces',
    ingredientId: 'ing-steak'
  };

  const readyFooterHtml = renderStep2Footer();
  assert.ok(readyFooterHtml.includes('wiz-gate-pill ready'), 'Gating pill must have ready class when all mapped');
  assert.ok(readyFooterHtml.includes('All items linked'), 'Gating pill must announce All items linked');
  assert.ok(!readyFooterHtml.includes('disabled style='), 'Next button must not be disabled when all mapped');

  console.log('  ✓ Gating pill transitions to ready status when all ingredients linked');
}

// Test 3: Consolidated Header Bar in Step 2
{
  console.log('Testing consolidated single-row header bar in renderState2Mapping()...');
  const step2Html = renderState2Mapping();

  assert.ok(step2Html.includes('class="wiz-step2-header-container"'), 'Step 2 must contain consolidated header container');
  assert.ok(step2Html.includes('Dish 1 of 1'), 'Header must contain dish queue counter');
  assert.ok(step2Html.includes('Boeuf Bourguignon'), 'Header must display recipe title');
  assert.ok(step2Html.includes('id="wiz-step2-fit-badge-container"'), 'Header must contain fit badge container');
  assert.ok(step2Html.includes('id="wiz-step2-macro-crossbar-container"'), 'Header must contain macro crossbar container');
  assert.ok(step2Html.includes('id="wiz-servings-input"'), 'Header must contain servings yield input');

  // Verify legacy 3-tier stacked banners were eliminated from Step 2
  assert.ok(!step2Html.includes('wiz-servings-banner'), 'Legacy bulky servings banner must be removed');
  assert.ok(!step2Html.includes('Canonical Author Quantities'), 'Legacy canonical author banner text removed');

  console.log('  ✓ Consolidated header bar contains dish info, fit score, macros, and yield input');
}

// Test 4: Two-Tier Dense Ingredient Rows Layout
{
  console.log('Testing dense two-tier ingredient row layout...');
  const step2Html = renderState2Mapping();

  assert.ok(step2Html.includes('class="wiz-raw-subtext"'), 'Row must contain wiz-raw-subtext under parsed name');
  assert.ok(step2Html.includes('Raw: &quot;2 brown onions&quot;'), 'Subtext must display escaped raw string');
  assert.ok(step2Html.includes('class="wiz-ing-qty"'), 'Row must include qty input');
  assert.ok(step2Html.includes('class="wiz-ing-unit"'), 'Row must include unit select');

  // Check that raw is not a separate <td> column
  assert.ok(!step2Html.includes('<div style="font-size: 11px; color: var(--text2, #666); font-style: italic;">Raw:'), 'Raw must not be rendered as a standalone table cell');

  console.log('  ✓ Two-tier ingredient rows render raw text as muted subtext under parsed name');
}

// Test 5: Compact Auto-Fitting Method Steps
{
  console.log('Testing compact method step textarea attributes...');
  const step2Html = renderState2Mapping();

  assert.ok(step2Html.includes('class="wiz-step-input"'), 'Must render wiz-step-input');
  assert.ok(step2Html.includes('rows="1"'), 'Step input textarea must default to rows="1"');
  assert.ok(step2Html.includes('min-height: 32px'), 'Step input textarea must have compact min-height: 32px');
  assert.ok(step2Html.includes('height: 32px'), 'Step input textarea must have compact height: 32px');

  console.log('  ✓ Method step textareas rendered with compact single-line height');
}

// Test 6: Slim Section Headers with Count Badge
{
  console.log('Testing section header count badge...');
  const step2Html = renderState2Mapping();

  assert.ok(step2Html.includes('class="wiz-section-card"'), 'Must render section card container');
  assert.ok(step2Html.includes('2 items'), 'Section header must display ingredient count badge');
  assert.ok(step2Html.includes('wiz-add-line-btn'), 'Must include add line button');
  assert.ok(step2Html.includes('wiz-del-section-btn'), 'Must include remove section button');

  console.log('  ✓ Section header rendered with item count badge and clean controls');
}

// Test 7: Compact Dual-Profile Macro Crossbar
{
  console.log('Testing renderMacroBreakdownCrossbar options.compact...');
  const recipe = wizardState.activeRecipe;
  const compactCrossbar = renderMacroBreakdownCrossbar(recipe, 'original', { compact: true });
  assert.ok(compactCrossbar.includes('recipe-modal-crossbar-compact'), 'Must render compact class');
  assert.ok(compactCrossbar.includes('👤 E ('), 'Must render Elliott compact pill');
  assert.ok(compactCrossbar.includes('👤 C ('), 'Must render Chloe compact pill');

  const fullCrossbar = renderMacroBreakdownCrossbar(recipe, 'original');
  assert.ok(fullCrossbar.includes('recipe-modal-crossbar'), 'Must render full class when not compact');
  assert.ok(fullCrossbar.includes('Dual-Profile Per-Portion Split'), 'Full crossbar includes title');

  console.log('  ✓ renderMacroBreakdownCrossbar supports compact inline rendering');
}

// Test 8: Full Modal Shell Integration with Persistent Footer
{
  console.log('Testing full modal shell with renderWizardFooter()...');
  wizardState.currentStep = 2;
  const footerFromModal = renderWizardFooter();
  assert.ok(footerFromModal.includes('class="ios-fullscreen-footer"'), 'Modal footer helper returns Step 2 footer');

  wizardState.currentStep = 0;
  const footerStep0 = renderWizardFooter();
  assert.strictEqual(footerStep0, '', 'Step 0 does not render persistent footer');

  console.log('  ✓ Modal controller integrates persistent footer for Step 2');
}

console.log('All Recipe Wizard UI Space-Efficiency & Sticky Footer tests passed! ✅');
