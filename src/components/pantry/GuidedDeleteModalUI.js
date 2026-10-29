/**
 * src/components/pantry/GuidedDeleteModalUI.js
 * Guided delete for a pantry category, root item or sub-type
 * (plan docs/plans/2026-10-29-1810-feat-pantry-guided-delete-plan.md, U4).
 * Steps: what goes, products, recipe lines, summary. Every choice re-runs planGuidedDelete;
 * nothing is saved until Delete, which saves the whole plan in one batch.
 */

import { getState } from '../../store/store.js';
import { planGuidedDelete, applyGuidedDelete } from '../../services/PantryTaxonomyService.js';
import { invalidateHierarchyCache } from '../../models/PantryHierarchyModel.js';
import { escapeHtml, escapeAttr } from '../../utils/stringUtils.js';

const PICKER_ROW_LIMIT = 60;
let active = null;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function modalParts() {
  return { wrap: document.getElementById('view-modal-wrap'), content: document.getElementById('view-modal-content') };
}

function targetName(target, state) {
  if (target.kind === 'category') return target.name;
  const item = (state.ingredients || []).find(i => String(i.id) === String(target.itemId ?? target.id));
  if (target.kind === 'item') return item?.name || 'this item';
  const sub = (item?.subtypes || []).find(st => String(st.id) === String(target.subtypeId));
  return sub ? `${item.name} › ${sub.name}` : 'this sub-type';
}

function destinationLabel(dest, state) {
  if (!dest) return 'Not chosen yet';
  if (dest.kind === 'category') return `Category: ${dest.name}`;
  const item = (state.ingredients || []).find(i => String(i.id) === String(dest.itemId));
  if (dest.kind === 'item') return item?.name || 'Unknown item';
  const sub = (item?.subtypes || []).find(st => String(st.id) === String(dest.subtypeId));
  const pending = active?.choices.newSubtypes.find(ns => String(ns.id) === String(dest.subtypeId));
  return `${item?.name || 'Unknown item'} › ${sub?.name || pending?.name || 'Unknown sub-type'}${pending ? ' (new)' : ''}`;
}

function replan() {
  active.plan = planGuidedDelete(getState(), active.target, active.choices);
  const p = active.plan;
  active.steps = ['summary'];
  if (p.products.length) active.steps.push('products');
  if (p.lines.length) active.steps.push('recipes');
  if (active.steps.length > 1) active.steps.push('confirm');
  // A re-plan against newer state can drop a step; stay on a step that still exists.
  active.stepIndex = Math.min(active.stepIndex ?? 0, active.steps.length - 1);
}

export function openGuidedDelete(target, { onDone } = {}) {
  active = {
    target, onDone, stepIndex: 0, busy: false, message: '', picking: null, filter: '', newSubFor: null,
    mode: { products: 'all', lines: 'all' },
    choices: { newSubtypes: [], productsAll: null, products: {}, linesAll: null, lines: {} }
  };
  replan();
  const { wrap, content } = modalParts();
  if (!wrap || !content) return;
  if (!content.__guidedDeleteBound) {
    content.__guidedDeleteBound = true;
    content.addEventListener('click', onClick);
    content.addEventListener('input', onInput);
  }
  wrap.style.setProperty('z-index', '25005', 'important');
  content.style.setProperty('z-index', '25005', 'important');
  wrap.classList.add('open');
  document.body.style.overflow = 'hidden';
  render();
}

function close() {
  active = null;
  const { wrap } = modalParts();
  if (wrap) wrap.classList.remove('open');
  document.body.style.overflow = '';
}

// ---- rendering ----

function render() {
  const { content } = modalParts();
  if (!active || !content) return;
  const state = getState();
  const step = active.steps[active.stepIndex];
  const title = `Delete ${escapeHtml(targetName(active.target, state))}`;
  const body = active.picking ? renderPicker(state) : ({ summary: renderSummary, products: renderProducts, recipes: renderRecipes, confirm: renderConfirm }[step])(state);
  content.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="gd-title" style="padding:18px; max-width:520px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:12px; max-height:85vh; display:flex; flex-direction:column; gap:12px;">
      <h3 id="gd-title" style="margin:0; font-size:1.05rem; font-weight:750;">${title}</h3>
      <div style="overflow-y:auto; flex:1; min-height:0;">${body}</div>
      <p aria-live="polite" style="margin:0; font-size:12.5px; color:var(--red,#b91c1c); min-height:1em;">${escapeHtml(active.message || blockerText())}</p>
      ${active.picking ? '' : renderFooter(step)}
    </div>`;
}

function blockerText() {
  const p = active.plan;
  if (p.errors.length) return p.errors[0];
  const step = active.steps[active.stepIndex];
  if (step === 'products') {
    const n = p.products.filter(e => e.needsHome).length;
    return n ? `${plural(n, 'product')} still need${n === 1 ? 's' : ''} a home.` : '';
  }
  if (step === 'recipes') {
    const n = p.lines.filter(e => e.needsHome).length;
    return n ? `${plural(n, 'recipe line')} still need${n === 1 ? 's' : ''} a new mapping.` : '';
  }
  return '';
}

function stepReady(step) {
  const p = active.plan;
  if (p.errors.length) return false;
  if (step === 'products') return !p.products.some(e => e.needsHome);
  if (step === 'recipes') return !p.lines.some(e => e.needsHome);
  return true;
}

const button = (gd, label, { primary = false, danger = false, disabled = false, extra = '' } = {}) =>
  `<button type="button" class="btn sm${primary ? ' primary' : ''}" data-gd="${gd}" ${extra} ${disabled ? 'disabled aria-disabled="true"' : ''} style="min-height:44px;${danger ? 'background:var(--red,#dc2626);color:#fff;' : ''}">${label}</button>`;

function renderFooter(step) {
  const last = active.stepIndex === active.steps.length - 1;
  const back = active.stepIndex > 0 ? button('back', 'Back') : '';
  const tooBig = active.plan.errors.some(e => /too many/i.test(e));
  if (tooBig && step === 'summary') return `<div style="display:flex; justify-content:flex-end; gap:8px;">${button('cancel', 'Close')}</div>`;
  const forward = last
    ? button('delete', active.busy ? 'Deleting…' : 'Delete', { danger: true, disabled: active.busy || !stepReady(step) })
    : button('next', 'Next', { primary: true, disabled: !stepReady(step) });
  return `<div style="display:flex; justify-content:space-between; gap:8px;"><div>${back}</div><div style="display:flex; gap:8px;">${button('cancel', 'Cancel', { disabled: active.busy })}${forward}</div></div>`;
}

function removedText() {
  const r = active.plan.removed;
  const goes = [
    r.categories.length && `the category <strong>${escapeHtml(r.categories[0])}</strong>`,
    r.items.length && plural(r.items.length, 'item'),
    r.subtypes.length && plural(r.subtypes.length, 'sub-type')
  ].filter(Boolean).join(', ');
  const names = [...r.items.map(i => i.name), ...r.subtypes.map(st => st.name)].slice(0, 12).map(n => `<li>${escapeHtml(n)}</li>`).join('');
  return `<p style="font-size:13px;">This deletes ${goes || 'it'}.</p>${names ? `<ul style="font-size:12.5px; margin:0 0 8px 18px;">${names}</ul>` : ''}`;
}

function renderSummary() {
  const p = active.plan;
  if (p.errors.some(e => /too many/i.test(e))) return `<p style="font-size:13px;">Too big to delete in one go. Delete a smaller piece first.</p>`;
  const recipes = new Set(p.lines.map(l => String(l.recipeId))).size;
  const affects = p.products.length || p.lines.length
    ? `<p style="font-size:13px;">Before it can go, ${[p.products.length && `${plural(p.products.length, 'product')} need a new sub-type`, p.lines.length && `${plural(p.lines.length, 'line')} in ${plural(recipes, 'recipe')} need a new mapping`].filter(Boolean).join(' and ')}.</p>`
    : `<p style="font-size:13px;">Nothing else uses it. This can't be undone.</p>`;
  return `${removedText()}${affects}`;
}

function modeSwitch(kind) {
  const all = active.mode[kind] === 'all';
  return `<div role="radiogroup" style="display:flex; gap:6px; margin-bottom:8px;">
    ${button(`mode-${kind}-all`, 'All to one place', { primary: all, extra: `role="radio" aria-checked="${all}"` })}
    ${button(`mode-${kind}-each`, 'One by one', { primary: !all, extra: `role="radio" aria-checked="${!all}"` })}
  </div>`;
}

function renderProducts(state) {
  const p = active.plan;
  if (active.mode.products === 'all') {
    return `${modeSwitch('products')}<p style="font-size:13px;">Move all ${plural(p.products.length, 'product')} to:</p>
      <p style="font-weight:600;">${escapeHtml(destinationLabel(active.choices.productsAll, state))}</p>${button('pick-productsAll', 'Choose sub-type')}`;
  }
  const rows = p.products.map(e => `<li style="display:flex; justify-content:space-between; gap:8px; align-items:center; padding:6px 0; border-bottom:1px solid var(--border,#e7e5e4);">
      <span style="font-size:13px;">${escapeHtml(e.product.name || e.product.id)}<br><small>${escapeHtml(destinationLabel(active.choices.products[e.product.id] || active.choices.productsAll, state))}</small></span>
      ${button('pick-product', 'Choose', { extra: `data-id="${escapeAttr(e.product.id)}"` })}</li>`).join('');
  return `${modeSwitch('products')}<ul style="list-style:none; margin:0; padding:0;">${rows}</ul>`;
}

function renderRecipes(state) {
  const p = active.plan;
  if (active.mode.lines === 'all') {
    return `${modeSwitch('lines')}<p style="font-size:13px;">Remap all ${plural(p.lines.length, 'line')} to:</p>
      <p style="font-weight:600;">${escapeHtml(destinationLabel(active.choices.linesAll, state))}</p>${button('pick-linesAll', 'Choose')}`;
  }
  const byRecipe = new Map();
  p.lines.forEach(l => { if (!byRecipe.has(l.recipeId)) byRecipe.set(l.recipeId, []); byRecipe.get(l.recipeId).push(l); });
  const groups = [...byRecipe.values()].map(ls => `<li style="padding:6px 0; border-bottom:1px solid var(--border,#e7e5e4);"><strong style="font-size:13px;">${escapeHtml(ls[0].recipeName || 'Recipe')}</strong>
    ${ls.map(l => `<div style="display:flex; justify-content:space-between; gap:8px; align-items:center; margin-top:4px;">
      <span style="font-size:12.5px;">${escapeHtml(l.line.raw || l.line.name || 'Ingredient')}${/^enhanced/.test(l.where) ? ' <em>(enhanced)</em>' : ''}<br><small>${escapeHtml(destinationLabel(active.choices.lines[l.key] || active.choices.linesAll, state))}</small></span>
      ${button('pick-line', 'Choose', { extra: `data-id="${escapeAttr(l.key)}"` })}</div>`).join('')}</li>`).join('');
  return `${modeSwitch('lines')}<ul style="list-style:none; margin:0; padding:0;">${groups}</ul>`;
}

function renderConfirm(state) {
  const p = active.plan;
  const productDests = new Map();
  p.products.forEach(e => { const label = destinationLabel(e.destination, state); productDests.set(label, (productDests.get(label) || 0) + 1); });
  const lineDests = new Map();
  p.lines.forEach(e => { const label = destinationLabel(e.destination, state); lineDests.set(label, (lineDests.get(label) || 0) + 1); });
  const list = m => [...m].map(([label, n]) => `<li>${n} → ${escapeHtml(label)}</li>`).join('');
  return `${removedText()}
    ${productDests.size ? `<p style="font-size:13px; margin-bottom:2px;">Products</p><ul style="font-size:12.5px; margin:0 0 8px 18px;">${list(productDests)}</ul>` : ''}
    ${lineDests.size ? `<p style="font-size:13px; margin-bottom:2px;">Recipe lines</p><ul style="font-size:12.5px; margin:0 0 8px 18px;">${list(lineDests)}</ul>` : ''}
    <p style="font-size:13px;">This can't be undone.</p>`;
}

// One picker for every destination: type to filter category › item › sub-type rows (U4 step 8).
function pickerRows(state) {
  const removedItems = new Set(active.plan.removed.items.map(i => String(i.id)));
  const removedSubs = new Set(active.plan.removed.subtypes.map(st => String(st.id)));
  if (active.target.kind === 'subtype') removedSubs.add(String(active.target.subtypeId));
  const forProducts = active.picking.startsWith('product');
  const rows = [];
  if (!forProducts) {
    (state.categories || []).filter(c => !active.plan.removed.categories.includes(c)).forEach(c => rows.push({ label: `Category: ${c}`, dest: { kind: 'category', name: c } }));
  }
  for (const item of state.ingredients || []) {
    if (removedItems.has(String(item.id))) continue;
    if (!forProducts) rows.push({ label: `${item.category || item.cat || ''} › ${item.name}`, dest: { kind: 'item', itemId: String(item.id) } });
    const pending = active.choices.newSubtypes.filter(ns => String(ns.itemId) === String(item.id));
    for (const sub of [...(item.subtypes || []), ...pending]) {
      if (removedSubs.has(String(sub.id))) continue;
      rows.push({ label: `${item.name} › ${sub.name}`, dest: { kind: 'subtype', itemId: String(item.id), subtypeId: String(sub.id) } });
    }
    if (forProducts) rows.push({ label: `New sub-type under ${item.name}…`, newUnder: String(item.id) });
  }
  const q = active.filter.trim().toLowerCase();
  return q ? rows.filter(r => r.label.toLowerCase().includes(q)) : rows;
}

function renderPicker(state) {
  if (active.newSubFor) {
    const item = (state.ingredients || []).find(i => String(i.id) === active.newSubFor);
    return `<label for="gd-new-name" style="font-size:13px;">New sub-type under ${escapeHtml(item?.name || '')}</label>
      <input id="gd-new-name" data-gd-input="newname" type="text" style="width:100%; min-height:44px; margin:6px 0 10px;" autocomplete="off">
      <div style="display:flex; gap:8px; justify-content:flex-end;">${button('picker-cancel', 'Cancel')}${button('new-add', 'Add', { primary: true })}</div>`;
  }
  const rows = pickerRows(state);
  active.pickerRows = rows.slice(0, PICKER_ROW_LIMIT);
  const list = active.pickerRows.map((r, n) => `<li>${button('pick-row', escapeHtml(r.label), { extra: `data-row="${n}" style="width:100%; text-align:left; min-height:44px;"` })}</li>`).join('');
  return `<label for="gd-filter" style="font-size:13px;">Search</label>
    <input id="gd-filter" data-gd-input="filter" type="search" value="${escapeAttr(active.filter)}" style="width:100%; min-height:44px; margin:6px 0 8px;" autocomplete="off">
    <ul style="list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px;">${list || '<li style="font-size:13px;">No matches.</li>'}</ul>
    ${rows.length > PICKER_ROW_LIMIT ? `<p style="font-size:12px;">Showing ${PICKER_ROW_LIMIT} of ${rows.length}. Type to narrow it down.</p>` : ''}
    <div style="display:flex; justify-content:flex-end; margin-top:8px;">${button('picker-cancel', 'Back')}</div>`;
}

// ---- events ----

function setDestination(dest) {
  const scope = active.picking;
  const c = active.choices;
  if (scope === 'productsAll') c.productsAll = dest;
  else if (scope === 'linesAll') c.linesAll = dest;
  else if (scope.startsWith('product:')) c.products[scope.slice(8)] = dest;
  else if (scope.startsWith('line:')) c.lines[scope.slice(5)] = dest;
  active.picking = null;
  active.filter = '';
  active.newSubFor = null;
  replan();
}

async function onClick(event) {
  const el = event.target?.closest?.('[data-gd]');
  if (!el || !active || el.disabled) return;
  const gd = el.dataset.gd;
  active.message = '';
  if (gd === 'cancel') return close();
  if (gd === 'back') active.stepIndex = Math.max(0, active.stepIndex - 1);
  else if (gd === 'next') { replan(); if (stepReady(active.steps[active.stepIndex])) active.stepIndex += 1; }
  else if (gd === 'mode-products-all' || gd === 'mode-products-each') active.mode.products = gd.endsWith('all') ? 'all' : 'each';
  else if (gd === 'mode-lines-all' || gd === 'mode-lines-each') active.mode.lines = gd.endsWith('all') ? 'all' : 'each';
  else if (gd === 'pick-productsAll' || gd === 'pick-linesAll') active.picking = gd.slice(5);
  else if (gd === 'pick-product') active.picking = `product:${el.dataset.id}`;
  else if (gd === 'pick-line') active.picking = `line:${el.dataset.id}`;
  else if (gd === 'picker-cancel') { active.picking = active.newSubFor ? active.picking : null; active.newSubFor = null; active.filter = ''; }
  else if (gd === 'pick-row') {
    const row = active.pickerRows?.[Number(el.dataset.row)];
    if (row?.newUnder) active.newSubFor = row.newUnder;
    else if (row) setDestination(row.dest);
  } else if (gd === 'new-add') {
    const name = String(document.getElementById('gd-new-name')?.value || '').trim();
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    active.choices.newSubtypes.push({ id, itemId: active.newSubFor, name });
    setDestination({ kind: 'subtype', itemId: active.newSubFor, subtypeId: id });
  } else if (gd === 'delete') return confirmDelete();
  render();
}

function onInput(event) {
  if (!active || event.target?.dataset?.gdInput !== 'filter') return;
  active.filter = event.target.value || '';
  const { content } = modalParts();
  render();
  const input = content && content.querySelector ? content.querySelector('#gd-filter') : null;
  if (input && typeof input.focus === 'function') { input.focus(); input.setSelectionRange?.(active.filter.length, active.filter.length); }
}

async function confirmDelete() {
  if (active.busy) return;
  replan();
  if (active.plan.errors.length || active.plan.needsHome) { render(); return; }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    active.message = "You're offline. Nothing was deleted.";
    render();
    return;
  }
  active.busy = true;
  render();
  const result = await applyGuidedDelete(active.plan);
  if (!active) return;
  active.busy = false;
  if (result.success) {
    const { onDone } = active;
    close();
    invalidateHierarchyCache();
    if (typeof onDone === 'function') onDone();
    return;
  }
  active.message = result.offline ? "You're offline. Nothing was deleted." : 'Nothing was deleted. Try again.';
  render();
}
