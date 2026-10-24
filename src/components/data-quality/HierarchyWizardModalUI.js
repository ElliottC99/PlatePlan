/**
 * src/components/data-quality/HierarchyWizardModalUI.js (v3.38.65)
 * Progressive Cascading Hierarchy Alignment Wizard with Title Case Normalisation & Auto-Default Sync.
 * Decomposed: HTML template rendering moved to HierarchyWizardRenderService.js.
 */
import { getState, setIngredients } from '../../store/store.js';
import { saveRootItem as saveIngredient } from '../../services/RootItemRepository.js';
import { saveProduct } from '../../services/ProductRepository.js';
import { safeGetProducts, commitProductUpdates } from './ResolveUnlinkedModalUI.js';
import { escapeAttr, toTitleCase } from '../../utils/stringUtils.js';
import { 
  renderSubtypeOptions, 
  renderIngredientOptions, 
  renderWizardStepTemplate, 
  renderWizardCompleteTemplate 
} from './HierarchyWizardRenderService.js';
import { showCustomAlert } from '../pantry/ReorganiseModalUI.js';


const MAX_DROPDOWN_ITEMS = 7;

let wizardQueue = [], currentIndex = 0, wizardStage = 1;
let selectedSubtypeId = null, selectedIngredientId = null, selectedCategory = '';
let newSubtypeName = '', newIngredientName = '';

export function getCategoryName(cat) {
  if (!cat) return '';
  return typeof cat === 'string' ? cat : (cat.name || cat.categoryName || cat.id || '');
}

export function syncIngredientAutoDefault(parentIng, linkedProduct) {
  if (!parentIng || !linkedProduct) return false;
  const state = window.Store?.getState?.() ;
  const products = state.products || safeGetProducts() || [];
  const currentDefaultId = parentIng.defaultProductId || parentIng.autoDefaultProductId || parentIng.autoDefaultProduct;
  const currentValid = currentDefaultId && products.some(p => String(p.id) === String(currentDefaultId));

  if (!currentValid) {
    const brand = String(linkedProduct.brand || '').trim();
    let pName = String(linkedProduct.name || linkedProduct.title || '').trim();
    if (brand && pName.toLowerCase().startsWith(brand.toLowerCase())) {
      pName = pName.slice(brand.length).replace(/^[\s\-–—:]+/, '').trim();
    }
    parentIng.defaultProductId = linkedProduct.id;
    parentIng.autoDefault = (brand && pName) ? `${brand} ${pName}` : (pName || brand);
    parentIng.autoDefaultProduct = linkedProduct.id;
    parentIng.updatedAt = new Date().toISOString();
    
    const ingredients = (state.ingredients || []).map(i => String(i.id) === String(parentIng.id) ? parentIng : i);
    if (typeof setIngredients === 'function') setIngredients(ingredients);
    if (window.Store?.setState) window.Store.setState({ ingredients });
    saveIngredient(parentIng);
    return true;
  }
  return false;
}

export function closeHierarchyWizardModal() {
  const overlay = document.getElementById('hierarchy-wizard-modal-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
  wizardQueue = []; currentIndex = 0; wizardStage = 1;
  selectedSubtypeId = null; selectedIngredientId = null; selectedCategory = '';
  newSubtypeName = ''; newIngredientName = '';
  if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
}

export function buildWizardQueue() {
  const products = safeGetProducts(), queue = [];
  products.forEach(p => {
    if (!p.ingredientId || !(p.subtypeId || p.subTypeId)) {
      queue.push({
        id: p.id, name: p.name, brand: p.brand || 'Generic', price: p.price || 0,
        pack: p.pack || 100, packUnit: p.packUnit || 'g', category: p.category || 'Uncategorised'
      });
    }
  });
  return queue;
}

export function handleWizardSubtypeSearch(query) {
  const q = String(query || '').toLowerCase().trim();
  const container = document.getElementById('wizard-subtype-search-results');
  if (!container) return;
  const state = window.Store?.getState?.() ;
  const options = [];
  (state.ingredients || []).forEach(ing => {
    const subTypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];
    if (!subTypes.length) options.push({ id: ing.id, name: `${ing.name} (Ingredient)`, ingredientId: ing.id, subtypeId: null, category: ing.category });
    subTypes.forEach(st => options.push({ id: st.id, name: `${ing.name} › ${st.name}`, ingredientId: ing.id, subtypeId: st.id, category: ing.category }));
  });
  const filtered = options.filter(o => !q || String(o.name).toLowerCase().includes(q) || String(o.category).toLowerCase().includes(q)).slice(0, MAX_DROPDOWN_ITEMS);
  
  const displayQuery = q || wizardQueue[currentIndex]?.name || 'Item';
  container.innerHTML = renderSubtypeOptions(filtered, displayQuery);
  container.style.display = 'block';

  container.querySelectorAll('.wizard-st-item').forEach(el => {
    el.onclick = () => {
      selectedIngredientId = el.dataset.ingId; selectedSubtypeId = el.dataset.subId || null; newSubtypeName = '';
      const input = document.getElementById('wizard-subtype-search-input');
      if (input) input.value = el.dataset.name;
      container.style.display = 'none';
      const btn = document.getElementById('wizard-link-subtype-btn');
      if (btn) btn.disabled = false;
    };
  });

  container.querySelectorAll('.wizard-st-create').forEach(el => {
    el.onclick = () => { newSubtypeName = toTitleCase(el.dataset.name); container.style.display = 'none'; wizardStage = 2; renderWizardStep(); };
  });
}

export async function handleWizardLinkSubtype() {
  const currentItem = wizardQueue[currentIndex];
  if (!currentItem || !selectedIngredientId) { 
    if (typeof showCustomAlert === 'function') showCustomAlert('Please select a sub-type first.'); 
    return; 
  }

  const state = window.Store?.getState?.() ;
  const parentIng = (state.ingredients || []).find(i => String(i.id) === String(selectedIngredientId));
  if (!parentIng) return;

  let subtypeId = selectedSubtypeId;
  if (!subtypeId) {
    if (!Array.isArray(parentIng.subtypes) || !parentIng.subtypes.length) {
      const newSub = { id: `sub_${Date.now()}`, name: parentIng.name, isDefault: true, createdAt: new Date().toISOString() };
      parentIng.subtypes = [newSub]; subtypeId = newSub.id; saveIngredient(parentIng);
    } else subtypeId = parentIng.subtypes[0].id;
  }

  const products = safeGetProducts().map(p => String(p.id) === String(currentItem.id) ? {
    ...p, ingredientId: selectedIngredientId, subtypeId, subTypeId: subtypeId, isAutoDefault: false, updatedAt: new Date().toISOString()
  } : p);
  commitProductUpdates(products);
  const updatedProd = products.find(p => String(p.id) === String(currentItem.id));
  try { await saveProduct(updatedProd); } catch (e) {}
  if (parentIng && updatedProd) syncIngredientAutoDefault(parentIng, updatedProd);
  advanceHierarchyWizardStep();
}

export function handleWizardIngredientSearch(query) {
  const q = String(query || '').toLowerCase().trim();
  const container = document.getElementById('wizard-ingredient-search-results');
  if (!container) return;
  const state = window.Store?.getState?.() ;
  const filtered = (state.ingredients || []).filter(i => !q || String(i.name).toLowerCase().includes(q)).slice(0, MAX_DROPDOWN_ITEMS);

  const displayQuery = q || newSubtypeName || 'Ingredient';
  container.innerHTML = renderIngredientOptions(filtered, displayQuery);
  container.style.display = 'block';

  container.querySelectorAll('.wizard-ing-item').forEach(el => {
    el.onclick = () => {
      selectedIngredientId = el.dataset.id; selectedSubtypeId = null; newIngredientName = '';
      const input = document.getElementById('wizard-ingredient-search-input');
      if (input) input.value = el.dataset.name;
      container.style.display = 'none';
      const btn = document.getElementById('wizard-create-link-btn');
      if (btn) btn.disabled = false;
    };
  });

  container.querySelectorAll('.wizard-ing-create').forEach(el => {
    el.onclick = () => { newIngredientName = toTitleCase(el.dataset.name); container.style.display = 'none'; wizardStage = 3; renderWizardStep(); };
  });
}

export function handleWizardCategorySearch(query) {
  const cleanQuery = String(query || '').toLowerCase().trim();
  const container = document.getElementById('wizard-category-search-results');
  if (!container) return;
  const state = window.Store?.getState?.() ;
  const activeCategories = Array.isArray(state.categories) ? state.categories : [];
  const matches = activeCategories.filter(cat => getCategoryName(cat).toLowerCase().includes(cleanQuery));

  container.innerHTML = '';
  if (!matches.length) { 
    container.innerHTML = `<div style="font-size:11.5px;color:var(--text2,#78716c);padding:8px;text-align:center;">No matching category in Category Bank. Please manage categories in Category Manager.</div>`; 
    container.style.display = 'block';
    const btn = document.getElementById('wizard-create-link-btn');
    if (btn) btn.disabled = true;
    return; 
  }

  matches.forEach(cat => {
    const catName = getCategoryName(cat);
    const div = document.createElement('div');
    div.className = 'wizard-category-option';
    div.style.cssText = 'padding:6px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border,#e7e5e4);display:flex;justify-content:space-between;align-items:center;';
    const span = document.createElement('span');
    span.style.fontWeight = '600';
    span.textContent = catName;
    div.appendChild(span);
    div.onclick = () => window.selectWizardCategory(catName);
    container.appendChild(div);
  });
  container.style.display = 'block';
}

export function selectWizardCategory(catName) {
  selectedCategory = catName;
  const input = document.getElementById('wizard-category-search-input');
  if (input) input.value = catName;
  const container = document.getElementById('wizard-category-search-results');
  if (container) container.style.display = 'none';
  const btn = document.getElementById('wizard-create-link-btn');
  if (btn) btn.disabled = false;
}

export async function handleWizardCreateAndLink() {
  const currentItem = wizardQueue[currentIndex];
  if (!currentItem) return;
  const state = window.Store?.getState?.() ;
  let parentIng = null;

  const normalizedSubName = toTitleCase(newSubtypeName || currentItem.name);
  const normalizedIngName = toTitleCase(newIngredientName);
  const activeCategories = Array.isArray(state.categories) ? state.categories : [];
  let categoryObj = activeCategories.find(c => getCategoryName(c).toLowerCase() === (selectedCategory || '').toLowerCase());

  if (!categoryObj && activeCategories.length > 0) categoryObj = activeCategories[0];
  const finalCatName = getCategoryName(categoryObj) || selectedCategory || 'Uncategorised';

  if (normalizedIngName) {
    const newSub = { id: `sub_${Date.now()}`, name: normalizedSubName, isDefault: false, createdAt: new Date().toISOString() };
    parentIng = { id: `ing_${Date.now()}`, name: normalizedIngName, category: finalCatName, subtypes: [newSub], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const updatedIngredients = [...(state.ingredients || []), parentIng];
    if (typeof setIngredients === 'function') setIngredients(updatedIngredients);
    if (window.Store?.setState) window.Store.setState({ ingredients: updatedIngredients });
    await saveIngredient(parentIng);
    selectedIngredientId = parentIng.id;
  } else if (selectedIngredientId) {
    parentIng = (state.ingredients || []).find(i => String(i.id) === String(selectedIngredientId));
    if (!parentIng) return;
    const newSub = { id: `sub_${Date.now()}`, name: normalizedSubName, isDefault: false, createdAt: new Date().toISOString() };
    parentIng.subtypes = [...(parentIng.subtypes || []), newSub];
    saveIngredient(parentIng);
  } else { 
    if (typeof showCustomAlert === 'function') showCustomAlert('Please select or create an ingredient.'); 
    return; 
  }


  const parentSub = parentIng.subtypes[parentIng.subtypes.length - 1];
  const products = safeGetProducts().map(p => String(p.id) === String(currentItem.id) ? {
    ...p, ingredientId: parentIng.id, subtypeId: parentSub.id, subTypeId: parentSub.id, isAutoDefault: false, updatedAt: new Date().toISOString()
  } : p);
  commitProductUpdates(products);
  const updatedProd = products.find(p => String(p.id) === String(currentItem.id));
  try { await saveProduct(updatedProd); } catch (e) {}
  if (parentIng && updatedProd) syncIngredientAutoDefault(parentIng, updatedProd);
  advanceHierarchyWizardStep();
}

export function skipWizardStep() {
  if (currentIndex < wizardQueue.length - 1) { wizardQueue.push(wizardQueue.splice(currentIndex, 1)[0]); renderWizardStep(); }
  else advanceHierarchyWizardStep();
}

export async function bulkProvisionAllDefaults() {
  const btn = document.getElementById('wizard-bulk-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Bulk Binding...'; }
  const state = window.Store?.getState?.() ;
  const ingredients = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  let products = safeGetProducts();
  products.forEach((p) => {
    if (!p.ingredientId || !p.subtypeId) {
      let matchIng = ingredients.find(i => String(i.name || '').toLowerCase() === String(p.name || '').toLowerCase()) || ingredients[0];
      if (matchIng) {
        if (!Array.isArray(matchIng.subtypes) || !matchIng.subtypes.length) matchIng.subtypes = [{ id: `sub_${Date.now()}`, name: matchIng.name, isDefault: true, createdAt: new Date().toISOString() }];
        p.ingredientId = matchIng.id; p.subtypeId = matchIng.subtypes[0].id; p.subTypeId = matchIng.subtypes[0].id; p.isAutoDefault = true;
      }
    }
  });
  if (typeof setIngredients === 'function') setIngredients(ingredients);
  if (window.Store?.setState) window.Store.setState({ ingredients });
  await commitProductUpdates(products);
  wizardQueue = []; renderWizardComplete();
}

export function advanceHierarchyWizardStep() {
  wizardStage = 1; selectedSubtypeId = null; selectedIngredientId = null; selectedCategory = '';
  newSubtypeName = ''; newIngredientName = '';
  if (++currentIndex >= wizardQueue.length) renderWizardComplete(); else renderWizardStep();
}

export const refreshHierarchyWizardStep = () => renderWizardStep();

export function renderWizardStep() {
  const card = document.getElementById('hierarchy-wizard-modal-card');
  if (!card) return;
  if (wizardQueue.length === 0 || currentIndex >= wizardQueue.length) { renderWizardComplete(); return; }
  const item = wizardQueue[currentIndex], total = wizardQueue.length, stepNum = currentIndex + 1, pct = Math.round((stepNum / total) * 100);

  if (wizardStage === 3 && !selectedCategory) {
    const activeCategories = window.Store?.getState?.()?.categories ?.categories || [];
    selectedCategory = activeCategories.length > 0 ? (getCategoryName(activeCategories[0]) || 'Uncategorised') : 'Uncategorised';
  }

  card.innerHTML = renderWizardStepTemplate({ 
    item, stepNum, total, pct, wizardStage, 
    newSubtypeName, newIngredientName, selectedCategory 
  });

  if (wizardStage === 1) handleWizardSubtypeSearch(''); 
  else if (wizardStage === 2) handleWizardIngredientSearch(''); 
  else if (wizardStage === 3) handleWizardCategorySearch('');
}

function renderWizardComplete() {
  const card = document.getElementById('hierarchy-wizard-modal-card');
  if (!card) return;
  card.innerHTML = renderWizardCompleteTemplate();
}

export function openHierarchyWizardModal() {
  wizardQueue = buildWizardQueue(); currentIndex = 0; wizardStage = 1;
  selectedSubtypeId = null; selectedIngredientId = null; selectedCategory = '';
  newSubtypeName = ''; newIngredientName = '';
  const existing = document.getElementById('hierarchy-wizard-modal-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'hierarchy-wizard-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:9999;background:rgba(15,23,42,0.45);backdrop-filter:blur(14px) saturate(160%);-webkit-backdrop-filter:blur(14px) saturate(160%);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
  const card = document.createElement('div');
  card.id = 'hierarchy-wizard-modal-card';
  card.style.cssText = 'background:#ffffff;border-radius:20px;width:100%;max-width:640px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;';
  overlay.appendChild(card);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);
  renderWizardStep();
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    openHierarchyWizardModal, closeHierarchyWizardModal, handleWizardSubtypeSearch, handleWizardLinkSubtype,
    handleWizardIngredientSearch, handleWizardCategorySearch, selectWizardCategory, handleWizardCreateAndLink,
    skipWizardStep, bulkProvisionAllDefaults, refreshHierarchyWizardStep, advanceHierarchyWizardStep, syncIngredientAutoDefault
  });
}
