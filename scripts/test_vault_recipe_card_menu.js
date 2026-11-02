/**
 * scripts/test_vault_recipe_card_menu.js
 * Verification test for VaultRecipeCard action dropdown event delegation and variant safety.
 */

import assert from 'node:assert/strict';
import { renderRecipeActionsItems } from '../src/components/vault/VaultRecipeCardRenderService.js';
import { openRecipeActions, openEnhancedRecipeActions } from '../src/components/vault/VaultRecipeCard.js';

console.log('=== RUNNING VAULT RECIPE CARD MENU VERIFICATION SUITE ===\n');

// Track action dispatches
let viewRecipeCalledWith = null;
let enhanceModalCalledWith = null;
let recipeWizardCalledWith = null;
let toggleFavCalledWith = null;

// Mock Recipe & Store
const mockRecipe = {
  id: 'rec_pasta_carbonara',
  name: 'Creamy Pancetta Carbonara',
  title: 'Creamy Pancetta Carbonara',
  serves: 2,
  macros: { calories: 650, protein: 28, carbs: 65, fat: 30 },
  enhanced: {
    serves: 2,
    macros: { calories: 520, protein: 42, carbs: 55, fat: 14 }
  }
};

const storeState = {
  recipes: [mockRecipe],
  userPrefs: {
    variantFavourites: []
  }
};

// Simple lightweight mock DOM
function createMockElement(tag = 'div') {
  const listeners = {};
  const children = [];
  const el = {
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    dataset: {},
    parentNode: null,
    listeners,
    children,
    _innerHTML: '',
    get innerHTML() {
      return this._innerHTML;
    },
    set innerHTML(html) {
      this._innerHTML = html;
      this.children.length = 0;
      // Parse child buttons with data-action
      const btnRegex = /<button[^>]*data-action="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g;
      let match;
      while ((match = btnRegex.exec(html)) !== null) {
        const btn = createMockElement('button');
        btn.dataset.action = match[1];
        btn.parentNode = this;
        btn._innerHTML = match[2];
        this.children.push(btn);
      }
    },
    addEventListener(evt, fn) {
      if (!listeners[evt]) listeners[evt] = [];
      listeners[evt].push(fn);
    },
    removeEventListener(evt, fn) {
      if (!listeners[evt]) return;
      listeners[evt] = listeners[evt].filter(f => f !== fn);
    },
    dispatchEvent(evt) {
      const handlers = listeners[evt.type] || [];
      handlers.forEach(h => h(evt));
    },
    querySelector(sel) {
      if (sel.includes('data-action="')) {
        const actionMatch = sel.match(/data-action="([^"]+)"/);
        if (actionMatch) {
          const act = actionMatch[1];
          return this.children.find(c => c.dataset.action === act) || null;
        }
      }
      return null;
    },
    querySelectorAll(sel) {
      return this.children;
    },
    closest(sel) {
      if (sel === '[data-action]' && this.dataset.action) return this;
      return null;
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.children.indexOf(this);
        if (idx !== -1) this.parentNode.children.splice(idx, 1);
        this.parentNode = null;
      }
    },
    contains(target) {
      if (target === this) return true;
      return this.children.includes(target);
    },
    click() {
      const evt = {
        type: 'click',
        target: this,
        currentTarget: this,
        stopPropagation: () => {},
        preventDefault: () => {}
      };
      // Bubble to parent if listener is on parent
      let cur = this;
      while (cur) {
        const handlers = cur.listeners['click'] || [];
        handlers.forEach(h => h(evt));
        cur = cur.parentNode;
      }
    }
  };
  return el;
}

const mockBody = createMockElement('body');
const docListeners = {};

global.window = {
  Store: {
    getState: () => storeState
  },
  viewRecipe: (id, slot, variant) => {
    viewRecipeCalledWith = { id, slot, variant };
  },
  openEnhanceRecipeModalForCurrent: (id) => {
    enhanceModalCalledWith = id;
  },
  openRecipeWizard: (mode, id) => {
    recipeWizardCalledWith = { mode, id };
  },
  toggleRecipeFavourite: (id, evt, variant) => {
    toggleFavCalledWith = { id, variant };
  },
  innerWidth: 1024,
  innerHeight: 768
};

global.document = {
  body: mockBody,
  createElement: (tag) => createMockElement(tag),
  getElementById: (id) => null,
  querySelector: (sel) => {
    if (sel === '.recipe-actions-dropdown-menu') {
      return mockBody.children.find(c => c.className === 'recipe-actions-dropdown-menu') || null;
    }
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel === '.recipe-actions-dropdown-menu') {
      return mockBody.children.filter(c => c.className === 'recipe-actions-dropdown-menu');
    }
    return [];
  },
  addEventListener: (evt, fn, useCapture) => {
    if (!docListeners[evt]) docListeners[evt] = [];
    docListeners[evt].push(fn);
  },
  removeEventListener: (evt, fn, useCapture) => {
    if (!docListeners[evt]) return;
    docListeners[evt] = docListeners[evt].filter(f => f !== fn);
  }
};

// --- Test 1: Original Variant Markup & Action Items ---
console.log('--- Test 1: Original Variant Action Items Markup ---');
const origHtml = renderRecipeActionsItems('rec_pasta_carbonara', false, 'original');
assert.ok(origHtml.includes('data-action="menu-view"'), 'Original menu must include View Details');
assert.ok(origHtml.includes('data-action="menu-enhance"'), 'Original menu must include Auto-Enhance');
assert.ok(origHtml.includes('data-action="menu-edit"'), 'Original menu must include Edit Recipe');
assert.ok(origHtml.includes('data-action="menu-review"'), 'Original menu must include Review Recipe');
assert.ok(origHtml.includes('data-action="menu-duplicate"'), 'Original menu must include Duplicate Recipe');
assert.ok(origHtml.includes('data-action="menu-favorite"'), 'Original menu must include Favourite');
assert.ok(origHtml.includes('Delete Entire Recipe'), 'Original menu delete button must say "Delete Entire Recipe"');
console.log('✅ Test 1 Passed: Original variant renders complete standard action suite.\n');

// --- Test 2: Enhanced Variant Markup & Variant Context ---
console.log('--- Test 2: Enhanced Variant Action Items Markup ---');
const enhHtml = renderRecipeActionsItems('rec_pasta_carbonara', false, 'enhanced');
assert.ok(enhHtml.includes('data-action="menu-view"'), 'Enhanced menu must include View Details');
assert.ok(!enhHtml.includes('data-action="menu-enhance"'), 'Enhanced menu must NOT include Auto-Enhance');
assert.ok(!enhHtml.includes('data-action="menu-edit"'), 'Enhanced menu must NOT include Edit Recipe');
assert.ok(!enhHtml.includes('data-action="menu-review"'), 'Enhanced menu must NOT include Review Recipe');
assert.ok(enhHtml.includes('data-action="menu-duplicate"'), 'Enhanced menu must include Duplicate Recipe');
assert.ok(enhHtml.includes('data-action="menu-favorite"'), 'Enhanced menu must include Favourite');
assert.ok(enhHtml.includes('Remove Enhanced Variant'), 'Enhanced menu delete button must say "Remove Enhanced Variant"');
console.log('✅ Test 2 Passed: Enhanced variant correctly omits edit/enhance and displays contextual delete label.\n');

// --- Test 3: Enhanced Recipe Dropdown Open & Delegation (Zero TypeError Crash) ---
console.log('--- Test 3: Enhanced Recipe Dropdown Open & Delegation ---');

// Previously threw TypeError at line 132: Cannot set properties of null (setting 'onclick')
assert.doesNotThrow(() => {
  openEnhancedRecipeActions(null, 'rec_pasta_carbonara');
}, 'Opening action dropdown for enhanced recipe must NEVER throw TypeError');

const dropdownEl = document.querySelector('.recipe-actions-dropdown-menu');
assert.ok(dropdownEl, 'Dropdown DOM element must be mounted');

// Click "View Details" on the enhanced menu
const viewBtn = dropdownEl.querySelector('[data-action="menu-view"]');
assert.ok(viewBtn, 'View button must exist in dropdown');
viewBtn.click();

assert.deepStrictEqual(viewRecipeCalledWith, { id: 'rec_pasta_carbonara', slot: null, variant: 'enhanced' });
assert.strictEqual(document.querySelector('.recipe-actions-dropdown-menu'), null, 'Dropdown must be cleanly removed from DOM upon action click');
console.log('✅ Test 3 Passed: Enhanced recipe dropdown opens without crash, dispatches delegated action, and closes cleanly.\n');

// --- Test 4: Original Recipe Dropdown Delegation ---
console.log('--- Test 4: Original Recipe Dropdown Delegation ---');
openRecipeActions(null, 'rec_pasta_carbonara', 'original');
const origDropdownEl = document.querySelector('.recipe-actions-dropdown-menu');
assert.ok(origDropdownEl, 'Original dropdown must be mounted');

// Click "Edit Recipe"
const editBtn = origDropdownEl.querySelector('[data-action="menu-edit"]');
assert.ok(editBtn, 'Edit button must exist in original dropdown');
editBtn.click();

assert.deepStrictEqual(recipeWizardCalledWith, { mode: 'manual', id: 'rec_pasta_carbonara' });
assert.strictEqual(document.querySelector('.recipe-actions-dropdown-menu'), null, 'Dropdown must close on edit click');
console.log('✅ Test 4 Passed: Original dropdown dispatches edit action through delegation.\n');

console.log('=== ALL VAULT RECIPE CARD MENU TESTS PASSED SUCCESSFULLY! ===');
