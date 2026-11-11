/**
 * src/components/recipe/RecipeWizardModal.js (v3.32.6)
 * Controller Module for Multi-Step Ingestion & Recipe Creation Wizard Modal.
 * Integrates:
 * - State 0: Choice (Manual vs Bulk)
 * - State 1: Ingestion & Input (Timings, Meal Tags)
 * - State 1.5: Batch Queue Review (Pills, Trash Removal, Direct Bulk Import)
 * - State 2: Sections, Scaled Quantities & Searchable Taxonomy Autocomplete Mapping
 * - State 3: Final Inline Review with Macro Crossbar, Variant Switcher & Queue Navigation
 */

import { getState } from '../../state/AppState.js';
import { extractRecipeMacros } from '../../utils/fitScoreCalculator.js';
import { wizardState, resetWizardState, syncStep2InputsToState, stashActiveVariantSnapshot } from './RecipeWizardState.js';
import { renderStepBadge, renderState0Choice, renderState1AManual, renderState1BBulk, renderState3Review } from './RecipeWizardViews.js';
import { renderState2Mapping, renderStep2Footer } from './RecipeWizardStep2View.js';
import { renderStep1Point5 } from './RecipeWizardStep15View.js';
import { bindStep01Events } from './RecipeWizardStep1Handlers.js';
import { bindStep2Events } from './RecipeWizardStep2Handlers.js';
import { bindStep3Events } from './RecipeWizardStep3Handlers.js';

const TOAST_DURATION_MS = 4000;

function normalizeTime(t, defH = 0, defM = 0) {
  if (typeof t === 'number' && !isNaN(t)) {
    return { hours: Math.floor(t / 60), minutes: t % 60 };
  }
  if (typeof t === 'string' && t.trim() !== '') {
    const num = parseInt(t, 10);
    if (!isNaN(num)) return { hours: Math.floor(num / 60), minutes: num % 60 };
  }
  if (t && typeof t === 'object') {
    const h = parseInt(t.hours, 10);
    const m = parseInt(t.minutes, 10);
    return {
      hours: isNaN(h) ? defH : Math.max(0, h),
      minutes: isNaN(m) ? defM : Math.max(0, Math.min(59, m))
    };
  }
  return { hours: defH, minutes: defM };
}

function formatIngredientLine(i) {
  if (!i) return '';
  if (typeof i === 'string') return i.trim();
  if (i.raw && typeof i.raw === 'string' && i.raw.trim()) return i.raw.trim();
  const parts = [];
  if (i.qty !== undefined && i.qty !== null && i.qty !== '') parts.push(i.qty);
  if (i.unit && typeof i.unit === 'string' && i.unit.trim()) parts.push(i.unit.trim());
  const name = i.name || i.ingredientName || i.ingredient || '';
  if (name && typeof name === 'string' && name.trim()) parts.push(name.trim());
  let line = parts.join(' ').trim();
  const notes = i.notes || i.comment;
  if (notes && typeof notes === 'string' && notes.trim() && !line.includes(notes.trim())) {
    line = line ? `${line} (${notes.trim()})` : notes.trim();
  }
  return line;
}

function formatMethodLine(step, idx) {
  if (!step) return '';
  const text = typeof step === 'string' ? step.trim() : (step.text || step.instruction || step.step || String(step)).trim();
  if (!text) return '';
  if (/^\d+[\.\)]\s*/.test(text)) {
    return text;
  }
  return `${idx + 1}. ${text}`;
}

export function openRecipeWizard(initialMode = 'manual', editRecipeId = null, variant = 'original') {
  let mode = initialMode;
  let recipeId = editRecipeId;
  let targetVariant = variant;

  if (typeof initialMode === 'object' && initialMode !== null) {
    mode = initialMode.initialMode || initialMode.mode || 'manual';
    recipeId = initialMode.editRecipeId || initialMode.recipeId || null;
    targetVariant = initialMode.variant || initialMode.activeVariant || 'original';
  }

  resetWizardState();
  const activeVariant = targetVariant === 'enhanced' ? 'enhanced' : 'original';
  wizardState.activeVariant = activeVariant;

  if (recipeId) {
    let allRecipes = [];
    if (typeof getState === 'function') {
      const st = getState();
      if (Array.isArray(st?.recipes)) allRecipes = st.recipes;
    }
    if (!allRecipes.length && typeof window !== 'undefined') {
      if (Array.isArray(window.Store?.getState?.()?.recipes)) {
        allRecipes = window.Store.getState().recipes;
      } else if (Array.isArray(window.allRecipes)) {
        allRecipes = window.allRecipes;
      } else if (Array.isArray(window.recipes)) {
        allRecipes = window.recipes;
      }
    }
    const found = allRecipes.find(r => r && (String(r.id) === String(recipeId) || String(r._id) === String(recipeId)));
    if (found) {
      wizardState.baseOriginalRecipe = JSON.parse(JSON.stringify(found));
      wizardState.activeVariant = activeVariant || 'original';
      const isEnhVariant = activeVariant === 'enhanced' && Boolean(found.enhanced);
      let targetSource = isEnhVariant ? { ...found, ...found.enhanced } : found;

      // When reviewing enhanced variant, if enhanced has ingredients,
      // prevent found.ingredientSections from shadowing enhanced.ingredients!
      if (isEnhVariant && Array.isArray(found.enhanced?.ingredients) && found.enhanced.ingredients.length > 0) {
        if (!Array.isArray(found.enhanced.ingredientSections) || found.enhanced.ingredientSections.length === 0) {
          delete targetSource.ingredientSections;
        }
      }

      let rawTags = targetSource.mealSuitability;
      if (!rawTags || !rawTags.length) {
        if (Array.isArray(targetSource.types)) rawTags = targetSource.types;
        else if (targetSource.type) rawTags = [targetSource.type];
        else if (targetSource.category) rawTags = [targetSource.category];
        else if (targetSource.mealType) rawTags = [targetSource.mealType];
      }
      const mealSuitability = Array.isArray(rawTags) && rawTags.length > 0
        ? rawTags.map(t => String(t).charAt(0).toUpperCase() + String(t).slice(1).toLowerCase())
        : ['Dinner'];

      const prepTime = targetSource.prepTime !== undefined && targetSource.prepTime !== null
        ? normalizeTime(targetSource.prepTime, 0, 15)
        : (targetSource.time ? normalizeTime(targetSource.time, 0, 15) : { hours: 0, minutes: 15 });
      const cookTime = targetSource.cookTime !== undefined && targetSource.cookTime !== null
        ? normalizeTime(targetSource.cookTime, 0, 30)
        : { hours: 0, minutes: 30 };

      let ingredientSections = [];
      if (Array.isArray(targetSource.ingredientSections) && targetSource.ingredientSections.length > 0) {
        ingredientSections = targetSource.ingredientSections.map(sec => ({
          sectionTitle: sec.sectionTitle || 'Main Ingredients',
          ingredients: Array.isArray(sec.ingredients) ? sec.ingredients.map(i => ({
            ...i,
            name: i.name || i.ingredientName || i.ingredient || (typeof i === 'string' ? i : ''),
            qty: i.qty !== undefined && i.qty !== null ? i.qty : 1,
            scaledQty: i.scaledQty !== undefined && i.scaledQty !== null ? i.scaledQty : (i.qty !== undefined && i.qty !== null ? i.qty : 1),
            unit: i.unit || '',
            raw: formatIngredientLine(i)
          })) : []
        }));
      } else if (Array.isArray(targetSource.ingredients) && targetSource.ingredients.length > 0) {
        ingredientSections = [{
          sectionTitle: 'Main Ingredients',
          ingredients: targetSource.ingredients.map(i => ({
            ...(typeof i === 'object' ? i : {}),
            name: typeof i === 'string' ? i : (i.name || i.ingredientName || i.ingredient || ''),
            qty: i.qty !== undefined && i.qty !== null ? i.qty : 1,
            scaledQty: i.scaledQty !== undefined && i.scaledQty !== null ? i.scaledQty : (i.qty !== undefined && i.qty !== null ? i.qty : 1),
            unit: i.unit || '',
            raw: formatIngredientLine(i)
          }))
        }];
      } else {
        ingredientSections = [{ sectionTitle: 'Main Ingredients', ingredients: [] }];
      }

      const ingRawText = ingredientSections.map(sec => {
        const header = sec.sectionTitle && sec.sectionTitle !== 'Main Ingredients' ? `${sec.sectionTitle}:\n` : '';
        const items = (sec.ingredients || []).map(formatIngredientLine).filter(Boolean).join('\n');
        return `${header}${items}`.trim();
      }).filter(Boolean).join('\n\n');

      const extractRawSteps = (src) => {
        if (!src) return [];
        if (Array.isArray(src.methodSteps) && src.methodSteps.length > 0) return src.methodSteps;
        if (Array.isArray(src.steps) && src.steps.length > 0) return src.steps;
        if (Array.isArray(src.method) && src.method.length > 0) return src.method;
        if (Array.isArray(src.instructions) && src.instructions.length > 0) return src.instructions;
        if (typeof src.method === 'string' && src.method.trim()) {
          return src.method.split('\n').map(s => s.trim()).filter(Boolean);
        }
        if (typeof src.instructions === 'string' && src.instructions.trim()) {
          return src.instructions.split('\n').map(s => s.trim()).filter(Boolean);
        }
        if (typeof src.steps === 'string' && src.steps.trim()) {
          return src.steps.split('\n').map(s => s.trim()).filter(Boolean);
        }
        return [];
      };

      let rawStepsList = extractRawSteps(targetSource);
      if ((!rawStepsList || rawStepsList.length === 0) && isEnhVariant && found) {
        rawStepsList = extractRawSteps(found);
      }

      const methodStepsArray = rawStepsList.map(s => typeof s === 'string' ? s.trim() : (s?.text || s?.instruction || s?.step || String(s || '')).trim()).filter(Boolean);
      const methodRawText = methodStepsArray.map(formatMethodLine).filter(Boolean).join('\n');

      const safeServes = Number(targetSource.servings || targetSource.serves || 4) || 4;
      const rawExtracted = extractRecipeMacros(targetSource, isEnhVariant ? 'enhanced' : 'original');
      const safeMacros = {
        calories: Number(rawExtracted.calories ?? rawExtracted.cal ?? targetSource.macros?.calories ?? 450),
        protein: Number(rawExtracted.protein ?? rawExtracted.prot ?? targetSource.macros?.protein ?? 28),
        carbs: Number(targetSource.macros?.carbs ?? targetSource.nutrition?.perServing?.carb ?? targetSource.carb ?? 40),
        fat: Number(targetSource.macros?.fat ?? targetSource.nutrition?.perServing?.fat ?? targetSource.fat ?? 16)
      };

      const buildSectionsFromSource = (srcObj) => {
        if (!srcObj) return [{ sectionTitle: 'Main Ingredients', ingredients: [] }];
        if (Array.isArray(srcObj.ingredientSections) && srcObj.ingredientSections.length > 0) {
          return srcObj.ingredientSections.map(sec => ({
            sectionTitle: sec.sectionTitle || 'Main Ingredients',
            ingredients: Array.isArray(sec.ingredients) ? sec.ingredients.map(i => ({
              ...i,
              name: i.name || i.ingredientName || i.ingredient || (typeof i === 'string' ? i : ''),
              qty: i.qty !== undefined && i.qty !== null ? i.qty : 1,
              scaledQty: i.scaledQty !== undefined && i.scaledQty !== null ? i.scaledQty : (i.qty !== undefined && i.qty !== null ? i.qty : 1),
              unit: i.unit || '',
              raw: formatIngredientLine(i)
            })) : []
          }));
        }
        if (Array.isArray(srcObj.ingredients) && srcObj.ingredients.length > 0) {
          return [{
            sectionTitle: 'Main Ingredients',
            ingredients: srcObj.ingredients.map(i => ({
              ...(typeof i === 'object' ? i : {}),
              name: typeof i === 'string' ? i : (i.name || i.ingredientName || i.ingredient || ''),
              qty: i.qty !== undefined && i.qty !== null ? i.qty : 1,
              scaledQty: i.scaledQty !== undefined && i.scaledQty !== null ? i.scaledQty : (i.qty !== undefined && i.qty !== null ? i.qty : 1),
              unit: i.unit || '',
              raw: formatIngredientLine(i)
            }))
          }];
        }
        return [{ sectionTitle: 'Main Ingredients', ingredients: [] }];
      };

      const origSectionsSnapshot = buildSectionsFromSource(found);
      const origStepsSnapshot = extractRawSteps(found).map(s => typeof s === 'string' ? s.trim() : (s?.text || s?.instruction || s?.step || String(s || '')).trim()).filter(Boolean);
      const origExtracted = extractRecipeMacros(found, 'original');
      wizardState.variantSnapshots = {
        original: {
          ingredientSections: JSON.parse(JSON.stringify(origSectionsSnapshot)),
          ingredients: JSON.parse(JSON.stringify(origSectionsSnapshot.flatMap(s => s.ingredients || []))),
          methodSteps: [...origStepsSnapshot],
          servings: Number(found.servings || found.serves || 4) || 4,
          macros: {
            calories: Number(origExtracted.calories ?? origExtracted.cal ?? found.macros?.calories ?? 450),
            protein: Number(origExtracted.protein ?? origExtracted.prot ?? found.macros?.protein ?? 28),
            carbs: Number(found.macros?.carbs ?? 40),
            fat: Number(found.macros?.fat ?? 16)
          }
        },
        enhanced: found.enhanced ? (() => {
          const enhSecs = buildSectionsFromSource(found.enhanced);
          const enhStepsRaw = extractRawSteps(found.enhanced);
          const enhSteps = (enhStepsRaw.length ? enhStepsRaw : origStepsSnapshot).map(s => typeof s === 'string' ? s.trim() : (s?.text || s?.instruction || s?.step || String(s || '')).trim()).filter(Boolean);
          const enhExt = extractRecipeMacros(found, 'enhanced');
          return {
            ingredientSections: JSON.parse(JSON.stringify(enhSecs)),
            ingredients: JSON.parse(JSON.stringify(enhSecs.flatMap(s => s.ingredients || []))),
            methodSteps: [...enhSteps],
            servings: Number(found.enhanced.servings || found.enhanced.serves || found.servings || found.serves || 4) || 4,
            macros: {
              calories: Number(enhExt.calories ?? enhExt.cal ?? found.enhanced.macros?.calories ?? 450),
              protein: Number(enhExt.protein ?? enhExt.prot ?? found.enhanced.macros?.protein ?? 28),
              carbs: Number(found.enhanced.macros?.carbs ?? 40),
              fat: Number(found.enhanced.macros?.fat ?? 16)
            }
          };
        })() : null
      };

      const rawSourceStr = String(found.source || found.url || '').trim();
      const inferredSourceType = found.sourceType || (found.sourceUrl || /^https?:\/\//i.test(rawSourceStr) ? 'online' : (found.sourceBook ? 'book' : ''));
      const inferredSourceUrl = found.sourceUrl || (/^https?:\/\//i.test(rawSourceStr) ? rawSourceStr : '');
      const inferredSourceBook = found.sourceBook || (inferredSourceType === 'book' ? rawSourceStr : '');
      const inferredSourcePage = found.sourcePage || '';

      wizardState.activeRecipe = {
        id: found.id || found._id,
        title: targetSource.title || targetSource.name || found.title || found.name || '',
        servings: safeServes,
        serves: safeServes,
        prepTime,
        cookTime,
        mealSuitability,
        sourceType: inferredSourceType,
        sourceUrl: inferredSourceUrl,
        sourceBook: inferredSourceBook,
        sourcePage: inferredSourcePage,
        ingredientsRaw: ingRawText,
        methodRaw: methodRawText,
        ingredientSections,
        ingredients: ingredientSections.flatMap(s => s.ingredients || []),
        methodSteps: methodStepsArray,
        macros: safeMacros,
        enhanced: found.enhanced || null
      };
      stashActiveVariantSnapshot();
    }
  }

  if (mode === 'bulk' || mode === 'parse') {
    wizardState.choice = 'bulk';
    wizardState.currentStep = 1;
  } else if (mode === 'review') {
    wizardState.choice = 'manual';
    wizardState.currentStep = 2;
  } else if (mode === 'manual') {
    wizardState.choice = 'manual';
    wizardState.currentStep = 1;
  } else {
    wizardState.currentStep = 0;
  }

  ensureModalDOM();
  renderWizardModal();
}

export function closeRecipeWizard() {
  const modalWrap = document.getElementById('recipe-wizard-modal-wrap');
  if (modalWrap) {
    modalWrap.classList.remove('open');
  }
}

function ensureModalDOM() {
  let modalWrap = document.getElementById('recipe-wizard-modal-wrap');
  if (!modalWrap) {
    modalWrap = document.createElement('div');
    modalWrap.id = 'recipe-wizard-modal-wrap';
    modalWrap.className = 'modal-wrap';
    modalWrap.style.zIndex = '500';
    document.body.appendChild(modalWrap);
  }
  modalWrap.classList.add('open');
}

export function showWizardNotice(msg, type = 'error') {
  if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast(msg, type);
    return;
  }
  const modalWrap = document.getElementById('recipe-wizard-modal-wrap');
  if (modalWrap) {
    let banner = modalWrap.querySelector('.wiz-notice-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'wiz-notice-banner';
      banner.style.cssText = 'background:#fee2e2;color:#991b1b;padding:10px 14px;border-radius:8px;margin:12px 16px 0;font-size:14px;font-weight:500;border:1px solid #fca5a5;';
      const container = modalWrap.querySelector('.modal-card') || modalWrap;
      container.prepend(banner);
    }
    banner.textContent = msg;
    setTimeout(() => { if (banner && banner.parentNode) banner.remove(); }, TOAST_DURATION_MS);
  }
}

export function loadNextRecipeFromQueue() {
  if (!wizardState.processingQueue.length) return;
  wizardState.currentQueueIndex++;
  const next = wizardState.processingQueue.shift();

  const ingRawText = (next.ingredientSections || []).map(sec => {
    const header = sec.sectionTitle && sec.sectionTitle !== 'Main Ingredients' ? `${sec.sectionTitle}:\n` : '';
    const items = (sec.ingredients || []).map(formatIngredientLine).filter(Boolean).join('\n');
    return `${header}${items}`.trim();
  }).filter(Boolean).join('\n\n');

  const rawSteps = Array.isArray(next.methodSteps) && next.methodSteps.length ? next.methodSteps
    : (Array.isArray(next.steps) && next.steps.length ? next.steps
    : (Array.isArray(next.method) && next.method.length ? next.method
    : (Array.isArray(next.instructions) && next.instructions.length ? next.instructions
    : (typeof next.method === 'string' ? next.method.split('\n').filter(Boolean)
    : (typeof next.instructions === 'string' ? next.instructions.split('\n').filter(Boolean) : [])))));
  const parsedSteps = rawSteps.map(s => typeof s === 'string' ? s.trim() : (s?.text || s?.instruction || s?.step || String(s || '')).trim()).filter(Boolean);
  const methodRawText = parsedSteps.map(formatMethodLine).filter(Boolean).join('\n');
  const safeServes = Number(next.servings || next.serves || 4) || 4;

  const isDefinedTimeVal = (val) => val !== '' && val !== undefined && val !== null;
  const hasPrep = Boolean(next.prepTime && (isDefinedTimeVal(next.prepTime.hours) || isDefinedTimeVal(next.prepTime.minutes)));
  const hasCook = Boolean(next.cookTime && (isDefinedTimeVal(next.cookTime.hours) || isDefinedTimeVal(next.cookTime.minutes)));
  const rawNextTags = Array.isArray(next.mealSuitability) ? next.mealSuitability : [];

  wizardState.variantSnapshots = { original: null, enhanced: null };
  wizardState.activeVariant = 'original';
  wizardState.activeRecipe = {
    title: next.title || 'Imported Recipe',
    servings: safeServes,
    serves: safeServes,
    prepTime: hasPrep ? next.prepTime : { hours: '', minutes: '' },
    cookTime: hasCook ? next.cookTime : { hours: '', minutes: '' },
    mealSuitability: rawNextTags,
    sourceType: next.sourceType || (next.sourceUrl ? 'online' : (next.sourceBook ? 'book' : '')),
    sourceUrl: next.sourceUrl || '',
    sourceBook: next.sourceBook || '',
    sourcePage: next.sourcePage || '',
    ingredientsRaw: ingRawText,
    methodRaw: methodRawText,
    ingredientSections: next.ingredientSections || [{ sectionTitle: 'Main Ingredients', ingredients: next.ingredients || [] }],
    methodSteps: parsedSteps,
    macros: next.macros || { calories: 450, protein: 28, carbs: 40, fat: 16 },
    enhanced: next.enhanced || null
  };
  stashActiveVariantSnapshot();
}

export function renderWizardFooter() {
  if (wizardState.currentStep === 2) {
    return renderStep2Footer();
  }
  return '';
}

export function renderWizardModal() {
  const modalWrap = document.getElementById('recipe-wizard-modal-wrap');
  if (!modalWrap) return;

  let bodyContent = '';

  if (wizardState.currentStep === 0) {
    bodyContent = renderState0Choice();
  } else if (wizardState.currentStep === 1) {
    bodyContent = wizardState.choice === 'bulk' ? renderState1BBulk() : renderState1AManual();
  } else if (wizardState.currentStep === 1.5) {
    bodyContent = renderStep1Point5();
  } else if (wizardState.currentStep === 2) {
    bodyContent = renderState2Mapping();
  } else if (wizardState.currentStep === 3) {
    bodyContent = renderState3Review();
  }

  modalWrap.innerHTML = `
    <div class="ios-fullscreen-modal open">
      <div class="ios-fullscreen-nav">
        <button type="button" class="ios-nav-btn" onclick="closeRecipeWizard()">Cancel</button>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:17px; font-weight:600; color:var(--label); letter-spacing:-0.024em;">Recipe Wizard</span>
          ${renderStepBadge()}
        </div>
        <button type="button" class="ios-nav-btn bold" onclick="closeRecipeWizard()">Done</button>
      </div>
      <div class="ios-fullscreen-body" id="wizard-modal-body">
        <div style="max-width: 860px; margin: 0 auto; width: 100%;">
          ${bodyContent}
        </div>
      </div>
      ${renderWizardFooter()}
    </div>
  `;

  bindWizardEvents();
}

function bindWizardEvents() {
  const modalWrap = document.getElementById('recipe-wizard-modal-wrap');
  if (!modalWrap) return;

  const handlersContext = {
    renderWizardModal,
    showWizardNotice,
    loadNextRecipeFromQueue,
    closeRecipeWizard
  };

  bindStep01Events(modalWrap, handlersContext);
  bindStep2Events(modalWrap, handlersContext);
  bindStep3Events(modalWrap, handlersContext);
}

if (typeof window !== 'undefined') {
  window.openRecipeWizard = openRecipeWizard;
  window.closeRecipeWizard = closeRecipeWizard;
  window.goToWizardStep = function(step) {
    const modalWrap = document.getElementById('recipe-wizard-modal-wrap');
    if (modalWrap && wizardState.currentStep === 2) {
      syncStep2InputsToState(modalWrap);
    }
    wizardState.currentStep = step;
    renderWizardModal();
  };
  window.openBulkRecipeImporterModal = () => openRecipeWizard('bulk');
  window.openRecipeEditor = () => openRecipeWizard('manual');
}
