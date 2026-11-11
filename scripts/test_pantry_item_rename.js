#!/usr/bin/env node
import assert from 'node:assert/strict';

// Setup minimal browser DOM stubs
global.localStorage = { removeItem: () => {}, getItem: () => null, setItem: () => {} };
global.window = {
  localStorage: global.localStorage,
  dispatchEvent: () => true
};
global.CustomEvent = class CustomEvent {
  constructor(type, params) {
    this.type = type;
    this.detail = params?.detail;
  }
};

global.document = {
  body: { style: {} },
  getElementById: () => null,
  dispatchEvent: () => true
};

const { getState, setIngredients } = await import('../src/store/store.js');
const { renameRootItem, renameSubtype } = await import('../src/services/PantryTaxonomyService.js');

console.log('Testing Pantry Root Item and Sub-Type Renaming...');

// 1. Initial State
setIngredients([
  {
    id: 'item-tomatoes',
    name: 'Tomatoes',
    category: 'Fresh Produce',
    aliases: ['tomato'],
    subtypes: [
      { id: 'sub-cherry', name: 'Cherry Tomatoes', aliases: ['baby tomatoes'] }
    ]
  }
]);

// 2. Test Root Item Renaming
console.log('Renaming root item...');
const resRoot = await renameRootItem('item-tomatoes', 'Plum Tomatoes', {
  newCategory: 'Fresh Produce',
  aliases: ['roma tomatoes', 'plum tomato']
});

assert.ok(resRoot.success, 'renameRootItem must succeed');
const updatedItem = getState().ingredients.find(i => i.id === 'item-tomatoes');
assert.equal(updatedItem.name, 'Plum Tomatoes', 'Root item name must be updated');
assert.deepEqual(updatedItem.aliases, ['roma tomatoes', 'plum tomato'], 'Aliases must be updated');

// 3. Test Empty Name Rejection on Root Item
await assert.rejects(
  async () => renameRootItem('item-tomatoes', '   '),
  /name cannot be empty/i,
  'Empty name must be rejected'
);

// 4. Test Sub-Type Renaming
console.log('Renaming sub-type...');
const resSub = await renameSubtype('item-tomatoes', 'sub-cherry', 'Piccolo Cherry Tomatoes', {
  aliases: ['sweet cherry tomatoes']
});

assert.ok(resSub.success, 'renameSubtype must succeed');
const parentItem = getState().ingredients.find(i => i.id === 'item-tomatoes');
const updatedSub = parentItem.subtypes.find(s => s.id === 'sub-cherry');
assert.equal(updatedSub.name, 'Piccolo Cherry Tomatoes', 'Sub-type name must be updated');
assert.deepEqual(updatedSub.aliases, ['sweet cherry tomatoes'], 'Sub-type aliases must be updated');

// 5. Test Empty Name Rejection on Sub-type
await assert.rejects(
  async () => renameSubtype('item-tomatoes', 'sub-cherry', ''),
  /name cannot be empty/i,
  'Empty sub-type name must be rejected'
);

console.log('✅ Pantry Root Item and Sub-Type Renaming tests passed!');
