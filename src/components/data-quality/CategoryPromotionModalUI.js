/**
 * src/components/data-quality/CategoryPromotionModalUI.js
 * Interactive modal for retrospective recipe taxonomy level elevation.
 * Provides a two-stage elevation wizard:
 * Stage 1: Grouped checklist for batch Root Item elevations with live progress & error handling.
 * Stage 2: Candidate-by-candidate review card for Category promotions with live macro delta previews.
 */

import { getState } from '../../store/store.js';
import {
  scanRecipeTaxonomyElevations,
  applyRootElevationsToRecipe,
  applyCategoryElevationToRecipe,
  commitRecipeElevations
} from '../../services/RecipeTaxonomyElevationService.js';
import { calculateMealFitScore } from '../../utils/fitScoreCalculator.js';
import { resolveDynamicProductForIngredient } from '../../services/PantryTaxonomyService.js';
import { calculateItemNutrition } from '../../services/NutritionService.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

export function openCategoryPromotionModal() {
  const existing = document.getElementById('category-promotion-modal');
  if (existing) existing.remove();

  const state = getState() || {};
  let currentRecipes = Array.isArray(state.recipes) ? [...state.recipes] : [];
  const ingredients = state.rootItems || state.ingredients || [];
  const products = state.products || [];
  const preferences = state.preferences || state.settings || {};

  // Run initial reverse-engineering scan with candidate partitioning
  let scanResult = scanRecipeTaxonomyElevations(currentRecipes, ingredients, products, { preferences });
  let rootElevations = scanResult.rootElevations || [];
  let categoryCandidates = scanResult.categoryCandidates || [];

  // Active state
  let currentStage = rootElevations.length > 0 ? 1 : 2;
  let selectedRootKeys = new Set(rootElevations.map(e => e.key));
  let isRootAccordionOpen = false;
  let isProcessing = false;
  let statusMessage = '';
  let errorMessage = '';

  // Stage 2 state
  let currentCardIndex = 0;
  const stage2Stats = { categoryCount: 0, rootCount: 0, keptCount: 0, skippedCount: 0 };
  const resolvedKeys = new Set();
  let liveDelta = null;

  function advanceToNextUnresolved() {
    currentCardIndex++;
    while (currentCardIndex < categoryCandidates.length && resolvedKeys.has(categoryCandidates[currentCardIndex].key)) {
      currentCardIndex++;
    }
  }

  const modal = document.createElement('div');
  modal.id = 'category-promotion-modal';
  modal.className = 'modal-backdrop active';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;backdrop-filter:blur(6px);';

  // Helper to project macros when elevating an ingredient to Category
  function projectCategoryElevationMacros(candidate) {
    if (!candidate) return null;
    const recipe = currentRecipes.find(r => String(r.id) === String(candidate.recipeId));
    if (!recipe) return null;

    const testRecipe = JSON.parse(JSON.stringify(recipe));
    const targetNode = (candidate.variant === 'enhanced' && testRecipe.enhanced) ? testRecipe.enhanced : testRecipe;

    const mutate = (item) => {
      delete item.ingredientId;
      delete item.subtypeId;
      delete item.productId;
      delete item.bankId;
      item.categoryId = candidate.category;
      item.category = candidate.category;
    };

    if (targetNode.ingredientSections?.[candidate.sectionIndex]?.ingredients?.[candidate.ingredientIndex]) {
      mutate(targetNode.ingredientSections[candidate.sectionIndex].ingredients[candidate.ingredientIndex]);
      targetNode.ingredients = targetNode.ingredientSections.flatMap(s => s.ingredients || []);
    } else if (targetNode.ingredients?.[candidate.ingredientIndex]) {
      mutate(targetNode.ingredients[candidate.ingredientIndex]);
    }

    const serves = Number(targetNode.servings || targetNode.serves || 4) || 4;
    let totalCal = 0, totalProt = 0;
    const allIngs = targetNode.ingredients || [];

    allIngs.forEach(item => {
      if (!item || item.excludeNutrition) return;
      const matchedProd = resolveDynamicProductForIngredient(item, { products, ingredients, preferences });
      if (matchedProd) {
        const qty = Number(item.qty ?? item.amount ?? 1) || 1;
        const unit = item.unit || 'g';
        const nut = calculateItemNutrition(matchedProd, qty, unit);
        totalCal += (nut.kcal ?? nut.cal ?? 0);
        totalProt += (nut.protein ?? nut.prot ?? 0);
      }
    });

    const projCal = Math.round(totalCal / serves);
    const projProt = Math.round((totalProt / serves) * 10) / 10;
    const targetMeal = testRecipe.mealSuitability?.[0] || testRecipe.types?.[0] || testRecipe.type || 'dinner';
    const fitRes = calculateMealFitScore({ ...testRecipe, calories: projCal, protein: projProt }, targetMeal, {
      activeProfile: 'everyone',
      portionScaled: true,
      variant: candidate.variant
    });

    const currCal = Number(recipe.calories ?? recipe.nutrition?.perServing?.cal ?? 0);
    const currProt = Number(recipe.protein ?? recipe.nutrition?.perServing?.prot ?? 0);
    const currFit = Number(recipe.fitScore ?? recipe._computedFitScore ?? 0);

    return {
      currCal,
      currProt,
      currFit,
      projCal,
      projProt,
      projFit: Math.round(Number(fitRes?.score) || 0)
    };
  }

  function renderModal() {
    const rootCount = rootElevations.length;
    const catTotal = categoryCandidates.length;

    // Group Stage 1 root candidates by recipe title
    const groupedRootByRecipe = new Map();
    rootElevations.forEach(item => {
      if (!groupedRootByRecipe.has(item.recipeTitle)) groupedRootByRecipe.set(item.recipeTitle, []);
      groupedRootByRecipe.get(item.recipeTitle).push(item);
    });

    // Advance to next unresolved candidate if needed
    while (currentCardIndex < catTotal && resolvedKeys.has(categoryCandidates[currentCardIndex].key)) {
      currentCardIndex++;
    }

    // Compute live delta for active Stage 2 candidate
    if (currentStage === 2 && currentCardIndex < catTotal) {
      liveDelta = projectCategoryElevationMacros(categoryCandidates[currentCardIndex]);
    }

    modal.innerHTML = `
      <div class="modal-card" style="background:var(--surface,#fff);border-radius:16px;max-width:640px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 16px 40px rgba(0,0,0,0.22);overflow:hidden;border:1px solid var(--border,#e5e7eb);">
        <!-- Header -->
        <div style="padding:16px 20px;border-bottom:1px solid var(--border,#e5e7eb);display:flex;justify-content:space-between;align-items:center;background:var(--surface,#fff);">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:18px;">📈</span>
              <h3 style="margin:0;font-size:16px;font-weight:750;color:var(--text,#111827);">
                Retrospective Taxonomy Elevation
              </h3>
            </div>
            <div style="font-size:12px;color:var(--text2,#6b7280);margin-top:2px;">
              Restore recipe ingredients auto-collapsed to sub-types back to Root Items & Categories
            </div>
          </div>
          <button type="button" class="btn ghost btn-close-modal" aria-label="Close" style="min-width:44px;min-height:44px;font-size:16px;border-radius:999px;">✕</button>
        </div>

        <!-- Stage Switcher Tabs -->
        <div style="display:flex;border-bottom:1px solid var(--border,#e5e7eb);background:var(--surface2,#f9fafb);padding:0 16px;">
          <button type="button" class="tab-btn ${currentStage === 1 ? 'active' : ''}" id="tab-stage-1" style="flex:1;padding:12px 8px;font-size:12.5px;font-weight:700;border:none;background:none;cursor:pointer;border-bottom:2px solid ${currentStage === 1 ? 'var(--primary,#4f46e5)' : 'transparent'};color:${currentStage === 1 ? 'var(--primary,#4f46e5)' : 'var(--text2,#6b7280)'};display:flex;align-items:center;justify-content:center;gap:6px;">
            <span>1. Root Items</span>
            <span style="background:${currentStage === 1 ? 'var(--primary,#4f46e5)' : 'var(--border,#e5e7eb)'};color:${currentStage === 1 ? '#fff' : 'var(--text2,#6b7280)'};font-size:10.5px;padding:2px 7px;border-radius:999px;">${rootCount}</span>
          </button>
          <button type="button" class="tab-btn ${currentStage === 2 ? 'active' : ''}" id="tab-stage-2" style="flex:1;padding:12px 8px;font-size:12.5px;font-weight:700;border:none;background:none;cursor:pointer;border-bottom:2px solid ${currentStage === 2 ? 'var(--primary,#4f46e5)' : 'transparent'};color:${currentStage === 2 ? 'var(--primary,#4f46e5)' : 'var(--text2,#6b7280)'};display:flex;align-items:center;justify-content:center;gap:6px;">
            <span>2. Categories</span>
            <span style="background:${currentStage === 2 ? 'var(--primary,#4f46e5)' : 'var(--border,#e5e7eb)'};color:${currentStage === 2 ? '#fff' : 'var(--text2,#6b7280)'};font-size:10.5px;padding:2px 7px;border-radius:999px;">${catTotal}</span>
          </button>
        </div>

        <!-- Body Content -->
        <div style="padding:20px;overflow-y:auto;flex:1;">
          <!-- Status & Error Alerts -->
          ${statusMessage ? `
            <div style="background:var(--badge-green-bg,#eaf4ef);border:1px solid var(--system-green,#16a34a);border-radius:10px;padding:12px 14px;font-size:12.5px;color:var(--badge-green-text,#166534);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
              <span>✅</span> <div>${escapeHtml(statusMessage)}</div>
            </div>
          ` : ''}

          ${errorMessage ? `
            <div style="background:var(--badge-red-bg,#fdeaea);border:1px solid var(--system-red,#dc2626);border-radius:10px;padding:12px 14px;font-size:12.5px;color:var(--badge-red-text,#991b1b);margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span>⚠️</span> <div>${escapeHtml(errorMessage)}</div>
              </div>
              <button type="button" class="btn sm secondary" id="btn-retry-commit" style="font-size:11px;padding:4px 8px;">Retry</button>
            </div>
          ` : ''}

          <!-- Processing Overlay Spinner -->
          ${isProcessing ? `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;gap:12px;">
              <div style="width:36px;height:36px;border:3px solid var(--border,#e5e7eb);border-top-color:var(--primary,#4f46e5);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
              <div style="font-size:13px;font-weight:600;color:var(--text,#111827);">Recalculating macros & saving to database...</div>
              <div style="font-size:11.5px;color:var(--text2,#6b7280);">Dynamic pantry resolution is matching best available products</div>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
          ` : ''}

          <!-- STAGE 1 VIEW -->
          ${!isProcessing && currentStage === 1 ? `
            ${rootCount === 0 ? `
              <div style="text-align:center;padding:36px 16px;">
                <div style="font-size:32px;margin-bottom:10px;">🎉</div>
                <div style="font-size:15px;font-weight:700;color:var(--text,#111827);">All Root Items Up to Date</div>
                <div style="font-size:12.5px;color:var(--text2,#6b7280);margin-top:4px;max-width:380px;margin-left:auto;margin-right:auto;">
                  No recipe ingredients were found locked to standard or auto-default sub-types.
                </div>
                <div style="margin-top:20px;">
                  <button type="button" class="btn primary" id="btn-goto-stage-2" style="font-size:13px;padding:8px 18px;font-weight:700;">
                    Review Categories (${catTotal}) →
                  </button>
                </div>
              </div>
            ` : `
              <!-- Stage 1 Active Card -->
              <div style="background:var(--surface2,#f9fafb);border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:16px;margin-bottom:18px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                  <div>
                    <div style="font-size:14px;font-weight:750;color:var(--text,#111827);">Batch Root Item Restorations</div>
                    <div style="font-size:12px;color:var(--text2,#6b7280);margin-top:3px;">
                      ${rootCount} ingredients across ${groupedRootByRecipe.size} recipes were auto-collapsed to sub-types matching their Root Item's auto-default.
                    </div>
                  </div>
                  <button type="button" class="btn primary" id="btn-elevate-selected-root" style="background:var(--system-green,#16a34a);color:#fff;font-weight:700;padding:8px 16px;font-size:12.5px;min-height:44px;border-radius:10px;cursor:pointer;">
                    ⚡ Elevate Selected (${selectedRootKeys.size})
                  </button>
                </div>
              </div>

              <!-- Accordion Toggle Header -->
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <button type="button" id="btn-toggle-accordion" style="background:none;border:none;padding:0;font-size:13px;font-weight:700;color:var(--text,#111827);display:flex;align-items:center;gap:6px;cursor:pointer;">
                  <span>${isRootAccordionOpen ? '▼' : '▶'}</span>
                  <span>Review Ingredients & Exclude (${rootCount})</span>
                </button>
                ${isRootAccordionOpen ? `
                  <div style="display:flex;gap:8px;">
                    <button type="button" class="btn sm ghost" id="btn-select-all" style="font-size:11px;padding:2px 8px;">Select All</button>
                    <button type="button" class="btn sm ghost" id="btn-deselect-all" style="font-size:11px;padding:2px 8px;">Deselect All</button>
                  </div>
                ` : ''}
              </div>

              <!-- Accordion Checklist Content -->
              ${isRootAccordionOpen ? `
                <div style="border:1px solid var(--border,#e5e7eb);border-radius:12px;overflow:hidden;margin-bottom:16px;">
                  ${Array.from(groupedRootByRecipe.entries()).map(([rTitle, items]) => `
                    <div style="background:var(--surface2,#f9fafb);border-bottom:1px solid var(--border,#e5e7eb);padding:8px 12px;font-size:12.5px;font-weight:750;color:var(--text,#111827);">
                      📖 ${escapeHtml(rTitle)}
                    </div>
                    ${items.map(item => `
                      <label style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border,#f3f4f6);background:var(--surface,#fff);cursor:pointer;">
                        <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
                          <input type="checkbox" class="chk-root-item" data-key="${escapeAttr(item.key)}" ${selectedRootKeys.has(item.key) ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;">
                          <div style="min-width:0;">
                            <div style="font-size:13px;font-weight:600;color:var(--text,#111827);">${escapeHtml(item.ingredientName)}</div>
                            <div style="font-size:11.5px;color:var(--text2,#6b7280);">
                              Current Sub-type: <strong>${escapeHtml(item.currentSubtypeName)}</strong> ➔ Root: <strong>${escapeHtml(item.rootName)}</strong>
                            </div>
                          </div>
                        </div>
                        <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;background:${item.matchType === 'explicit_default' ? 'var(--badge-green-bg,#eaf4ef)' : 'var(--badge-blue-bg,#eaf0f4)'};color:${item.matchType === 'explicit_default' ? 'var(--badge-green-text,#166534)' : 'var(--badge-blue-text,#1e40af)'};border:1px solid ${item.matchType === 'explicit_default' ? 'var(--badge-green-border,#bbf7d0)' : 'var(--badge-blue-border,#bfdbfe)'};flex-shrink:0;">
                          ${item.matchType === 'explicit_default' ? 'Explicit Default' : 'Strategy Rank'}
                        </span>
                      </label>
                    `).join('')}
                  `).join('')}
                </div>
              ` : ''}
            `}
          ` : ''}

          <!-- STAGE 2 VIEW (Category Review Cards) -->
          ${!isProcessing && currentStage === 2 ? `
            ${catTotal === 0 ? `
              <div style="text-align:center;padding:36px 16px;">
                <div style="font-size:32px;margin-bottom:10px;">✨</div>
                <div style="font-size:15px;font-weight:700;color:var(--text,#111827);">No Category Candidates Pending</div>
                <div style="font-size:12.5px;color:var(--text2,#6b7280);margin-top:4px;">
                  All recipe ingredients have been reviewed or are mapped to appropriate levels.
                </div>
                <div style="margin-top:20px;">
                  <button type="button" class="btn primary btn-close-modal" style="font-size:13px;padding:8px 18px;font-weight:700;">Done</button>
                </div>
              </div>
            ` : currentCardIndex >= catTotal ? `
              <!-- Completion Summary Screen -->
              <div style="text-align:center;padding:30px 16px;">
                <div style="font-size:36px;margin-bottom:12px;">🎉</div>
                <div style="font-size:16px;font-weight:750;color:var(--text,#111827);">All Category Candidates Reviewed!</div>
                <div style="font-size:12.5px;color:var(--text2,#6b7280);margin-top:6px;max-width:400px;margin-left:auto;margin-right:auto;">
                  Summary of actions taken in this session:
                </div>
                <div style="display:flex;justify-content:center;gap:12px;margin:18px 0;flex-wrap:wrap;">
                  <div style="background:var(--surface2,#f9fafb);border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:10px 16px;">
                    <div style="font-size:18px;font-weight:800;color:var(--primary,#4f46e5);">${stage2Stats.categoryCount}</div>
                    <div style="font-size:11px;color:var(--text2,#6b7280);">Elevated to Category</div>
                  </div>
                  <div style="background:var(--surface2,#f9fafb);border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:10px 16px;">
                    <div style="font-size:18px;font-weight:800;color:var(--system-green,#16a34a);">${stage2Stats.rootCount}</div>
                    <div style="font-size:11px;color:var(--text2,#6b7280);">Elevated to Root</div>
                  </div>
                  <div style="background:var(--surface2,#f9fafb);border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:10px 16px;">
                    <div style="font-size:18px;font-weight:800;color:var(--text2,#6b7280);">${stage2Stats.keptCount}</div>
                    <div style="font-size:11px;color:var(--text2,#6b7280);">Kept as Sub-type</div>
                  </div>
                  <div style="background:var(--surface2,#f9fafb);border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:10px 16px;">
                    <div style="font-size:18px;font-weight:800;color:var(--amber,#d97706);">${stage2Stats.skippedCount}</div>
                    <div style="font-size:11px;color:var(--text2,#6b7280);">Skipped</div>
                  </div>
                </div>
                <button type="button" class="btn primary btn-close-modal" style="font-size:13px;padding:8px 20px;font-weight:700;">Finish & View Vault</button>
              </div>
            ` : `
              <!-- Single Interactive Card -->
              ${(() => {
                const item = categoryCandidates[currentCardIndex];
                const remainingCandidates = categoryCandidates.slice(currentCardIndex).filter(c => !resolvedKeys.has(c.key));
                const matchingRemaining = remainingCandidates.filter(c =>
                  (c.rootId && item.rootId && String(c.rootId) === String(item.rootId)) ||
                  (c.ingredientName && item.ingredientName && c.ingredientName.trim().toLowerCase() === item.ingredientName.trim().toLowerCase())
                );
                const matchingCount = matchingRemaining.length;

                return `
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <span style="font-size:12px;font-weight:700;color:var(--text2,#6b7280);text-transform:uppercase;letter-spacing:0.04em;">
                      Candidate ${currentCardIndex + 1} of ${catTotal}
                    </span>
                    <button type="button" class="btn sm ghost" id="btn-card-skip" style="font-size:12px;padding:4px 10px;">Skip / Review Later ➔</button>
                  </div>

                  <div style="background:var(--surface,#fff);border:1.5px solid var(--border,#e5e7eb);border-radius:14px;padding:18px;box-shadow:0 4px 12px rgba(0,0,0,0.04);margin-bottom:16px;">
                    <div style="font-size:16px;font-weight:750;color:var(--text,#111827);margin-bottom:8px;">
                      📖 ${escapeHtml(item.recipeTitle)}
                    </div>

                    <div style="background:var(--surface2,#f9fafb);border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:12px;margin-bottom:14px;">
                      <div style="font-size:13px;font-weight:700;color:var(--text,#111827);">Ingredient: ${escapeHtml(item.ingredientName)}</div>
                      <div style="font-size:12px;color:var(--text2,#6b7280);margin-top:4px;">
                        Currently locked to: <strong style="color:var(--text,#111827);">${escapeHtml(item.currentSubtypeName)}</strong>
                      </div>
                      <div style="font-size:12px;color:var(--text2,#6b7280);margin-top:2px;">
                        Parent Root Item: <strong style="color:var(--text,#111827);">${escapeHtml(item.rootName)}</strong> ➔ Category: <strong style="color:var(--primary,#4f46e5);">${escapeHtml(item.category)}</strong>
                      </div>
                      <div style="margin-top:6px;">
                        <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;background:${item.matchType === 'explicit_default' ? 'var(--badge-green-bg,#eaf4ef)' : 'var(--badge-blue-bg,#eaf0f4)'};color:${item.matchType === 'explicit_default' ? 'var(--badge-green-text,#166534)' : 'var(--badge-blue-text,#1e40af)'};border:1px solid ${item.matchType === 'explicit_default' ? 'var(--badge-green-border,#bbf7d0)' : 'var(--badge-blue-border,#bfdbfe)'};">
                          ${item.matchType === 'explicit_default' ? 'Explicit Category Default' : 'Strategy Rank Category Default'}
                        </span>
                      </div>
                    </div>

                    <!-- Live Nutritional & Fit Score Delta Preview -->
                    ${liveDelta ? `
                      <div style="background:var(--surface2,#f9fafb);border:1px dashed var(--primary,#6366f1);border-radius:10px;padding:12px;margin-bottom:16px;">
                        <div style="font-size:11.5px;font-weight:700;color:var(--primary,#4f46e5);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">
                          Projected Category Elevation Delta
                        </div>
                        <div style="display:flex;align-items:center;justify-content:space-between;font-size:12.5px;flex-wrap:wrap;gap:8px;">
                          <div>
                            <span style="color:var(--text2,#6b7280);">Current:</span>
                            <strong>🔥 ${liveDelta.currCal} kcal</strong> · <strong>💪 ${liveDelta.currProt}g P</strong>
                            <span style="font-size:11px;font-weight:700;margin-left:4px;">(${liveDelta.currFit}%)</span>
                          </div>
                          <span style="font-size:14px;color:var(--primary,#4f46e5);">➔</span>
                          <div>
                            <span style="color:var(--text2,#6b7280);">Projected:</span>
                            <strong style="color:var(--system-green,#16a34a);">🔥 ${liveDelta.projCal} kcal</strong> · <strong style="color:var(--system-green,#16a34a);">💪 ${liveDelta.projProt}g P</strong>
                            <span style="font-size:11px;font-weight:700;color:var(--system-green,#16a34a);margin-left:4px;">(${liveDelta.projFit}%)</span>
                          </div>
                        </div>
                      </div>
                    ` : ''}

                    <!-- Batch Checkbox for Remaining Matching Instances -->
                    ${matchingCount > 1 ? `
                      <label style="display:flex;align-items:center;gap:9px;margin-bottom:14px;padding:9px 12px;background:var(--surface2,#f9fafb);border:1.5px solid var(--primary-border,rgba(99,102,241,0.25));border-radius:10px;cursor:pointer;font-size:12.5px;color:var(--text,#111827);user-select:none;">
                        <input type="checkbox" id="chk-apply-all-matching" style="width:16px;height:16px;accent-color:var(--primary,#4f46e5);cursor:pointer;" />
                        <span>Apply decision to all <strong>${matchingCount}</strong> remaining recipes using <strong>${escapeHtml(item.rootName || item.ingredientName)}</strong></span>
                      </label>
                    ` : ''}

                    <!-- 3 Action Decision Buttons -->
                    <div style="display:flex;flex-direction:column;gap:8px;">
                      <button type="button" class="btn primary" id="btn-card-promote-cat" style="min-height:44px;font-size:12.5px;font-weight:700;background:var(--primary,#4f46e5);color:#fff;border-radius:10px;justify-content:center;">
                        Elevate to Category ("${escapeHtml(item.category)}")
                      </button>
                      <button type="button" class="btn secondary" id="btn-card-promote-root" style="min-height:44px;font-size:12.5px;font-weight:700;border-radius:10px;justify-content:center;">
                        Elevate to Root Item ("${escapeHtml(item.rootName)}")
                      </button>
                      <button type="button" class="btn ghost" id="btn-card-keep-subtype" style="min-height:44px;font-size:12px;font-weight:600;color:var(--text2,#6b7280);justify-content:center;">
                        Keep as Sub-type ("${escapeHtml(item.currentSubtypeName)}")
                      </button>
                    </div>
                  </div>
                `;
              })()}
            `}
          ` : ''}
        </div>

        <!-- Footer -->
        <div style="padding:14px 20px;border-top:1px solid var(--border,#e5e7eb);background:var(--surface2,#f9fafb);display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:12px;color:var(--text2,#6b7280);">
            ${currentStage === 1 ? `Stage 1 of 2: Root Items` : `Stage 2 of 2: Category Review`}
          </div>
          <button type="button" class="btn secondary btn-close-modal" style="font-size:12.5px;padding:6px 16px;font-weight:600;">Close</button>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    modal.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.onclick = () => {
        modal.remove();
        if (typeof window.renderDataQuality === 'function') window.renderDataQuality();
      };
    });

    const tabStage1 = modal.querySelector('#tab-stage-1');
    if (tabStage1) {
      tabStage1.onclick = () => {
        currentStage = 1;
        errorMessage = '';
        renderModal();
      };
    }

    const tabStage2 = modal.querySelector('#tab-stage-2');
    if (tabStage2) {
      tabStage2.onclick = () => {
        currentStage = 2;
        errorMessage = '';
        renderModal();
      };
    }

    const btnGotoStage2 = modal.querySelector('#btn-goto-stage-2');
    if (btnGotoStage2) {
      btnGotoStage2.onclick = () => {
        currentStage = 2;
        errorMessage = '';
        renderModal();
      };
    }

    const btnToggleAccordion = modal.querySelector('#btn-toggle-accordion');
    if (btnToggleAccordion) {
      btnToggleAccordion.onclick = () => {
        isRootAccordionOpen = !isRootAccordionOpen;
        renderModal();
      };
    }

    const btnSelectAll = modal.querySelector('#btn-select-all');
    if (btnSelectAll) {
      btnSelectAll.onclick = () => {
        selectedRootKeys = new Set(rootElevations.map(e => e.key));
        renderModal();
      };
    }

    const btnDeselectAll = modal.querySelector('#btn-deselect-all');
    if (btnDeselectAll) {
      btnDeselectAll.onclick = () => {
        selectedRootKeys.clear();
        renderModal();
      };
    }

    modal.querySelectorAll('.chk-root-item').forEach(chk => {
      chk.onchange = (e) => {
        const key = e.target.dataset.key;
        if (e.target.checked) selectedRootKeys.add(key);
        else selectedRootKeys.delete(key);
        const countSpan = modal.querySelector('#btn-elevate-selected-root');
        if (countSpan) countSpan.textContent = `⚡ Elevate Selected (${selectedRootKeys.size})`;
      };
    });

    // Stage 1 Batch Execution
    const btnElevateSelected = modal.querySelector('#btn-elevate-selected-root');
    if (btnElevateSelected) {
      btnElevateSelected.onclick = async () => {
        if (selectedRootKeys.size === 0) return;
        isProcessing = true;
        errorMessage = '';
        renderModal();

        try {
          const preSnapshot = JSON.parse(JSON.stringify(currentRecipes));
          const affectedRecipeIds = new Set();
          rootElevations.forEach(e => {
            if (selectedRootKeys.has(e.key)) affectedRecipeIds.add(String(e.recipeId));
          });

          const updatedRecipes = [];
          for (let r of currentRecipes) {
            if (affectedRecipeIds.has(String(r.id))) {
              const updated = applyRootElevationsToRecipe(r, selectedRootKeys, { products, ingredients, preferences });
              updatedRecipes.push(updated);
            }
          }

          await commitRecipeElevations(updatedRecipes);

          // Update local state copy
          updatedRecipes.forEach(up => {
            const idx = currentRecipes.findIndex(r => String(r.id) === String(up.id));
            if (idx !== -1) currentRecipes[idx] = up;
          });

          // Re-scan
          scanResult = scanRecipeTaxonomyElevations(currentRecipes, ingredients, products, { preferences });
          rootElevations = scanResult.rootElevations || [];
          selectedRootKeys = new Set(rootElevations.map(e => e.key));
          statusMessage = `Successfully elevated ${updatedRecipes.length} recipes to Root Items!`;
        } catch (err) {
          console.error('[CategoryPromotionModalUI] Stage 1 Batch commit failed:', err);
          errorMessage = 'Failed to commit batch elevation to database. Please check your network and retry.';
        } finally {
          isProcessing = false;
          renderModal();
        }
      };
    }

    // Stage 2 Review Card Action Handlers
    const activeCandidate = categoryCandidates[currentCardIndex];
    if (activeCandidate) {
      const remainingCandidates = categoryCandidates.slice(currentCardIndex).filter(c => !resolvedKeys.has(c.key));
      const matchingRemaining = remainingCandidates.filter(c =>
        (c.rootId && activeCandidate.rootId && String(c.rootId) === String(activeCandidate.rootId)) ||
        (c.ingredientName && activeCandidate.ingredientName && c.ingredientName.trim().toLowerCase() === activeCandidate.ingredientName.trim().toLowerCase())
      );
      const matchingCount = matchingRemaining.length;

      const chkApplyAll = modal.querySelector('#chk-apply-all-matching');
      const btnPromoteCat = modal.querySelector('#btn-card-promote-cat');
      const btnPromoteRoot = modal.querySelector('#btn-card-promote-root');
      const btnKeepSubtype = modal.querySelector('#btn-card-keep-subtype');
      const btnCardSkip = modal.querySelector('#btn-card-skip');

      if (chkApplyAll) {
        chkApplyAll.onchange = () => {
          const isAll = chkApplyAll.checked;
          if (btnPromoteCat) {
            btnPromoteCat.textContent = isAll
              ? `Elevate all ${matchingCount} to Category ("${activeCandidate.category}")`
              : `Elevate to Category ("${activeCandidate.category}")`;
          }
          if (btnPromoteRoot) {
            btnPromoteRoot.textContent = isAll
              ? `Elevate all ${matchingCount} to Root Item ("${activeCandidate.rootName}")`
              : `Elevate to Root Item ("${activeCandidate.rootName}")`;
          }
          if (btnKeepSubtype) {
            btnKeepSubtype.textContent = isAll
              ? `Keep all ${matchingCount} as Sub-types`
              : `Keep as Sub-type ("${activeCandidate.currentSubtypeName}")`;
          }
        };
      }

      const executeStage2Decision = async (action) => {
        isProcessing = true;
        errorMessage = '';
        renderModal();
        try {
          const isApplyAll = Boolean(chkApplyAll?.checked);
          const targets = (isApplyAll && matchingCount > 1) ? matchingRemaining : [activeCandidate];

          if (action === 'subtype') {
            targets.forEach(t => {
              resolvedKeys.add(t.key);
              stage2Stats.keptCount++;
            });
            advanceToNextUnresolved();
          } else {
            // Group targets by recipeId to apply sequentially per recipe
            const targetsByRecipe = new Map();
            targets.forEach(t => {
              if (!targetsByRecipe.has(t.recipeId)) targetsByRecipe.set(t.recipeId, []);
              targetsByRecipe.get(t.recipeId).push(t);
            });

            const modifiedRecipes = [];
            for (const [recipeId, tList] of targetsByRecipe.entries()) {
              const recipe = currentRecipes.find(r => String(r.id) === String(recipeId));
              if (!recipe) continue;

              let updated = recipe;
              for (const t of tList) {
                updated = applyCategoryElevationToRecipe(updated, {
                  action,
                  variant: t.variant,
                  sectionIndex: t.sectionIndex,
                  ingredientIndex: t.ingredientIndex,
                  targetCategory: t.category,
                  rootId: t.rootId
                }, { products, ingredients, preferences });
              }
              modifiedRecipes.push(updated);
            }

            if (modifiedRecipes.length > 0) {
              await commitRecipeElevations(modifiedRecipes);
              const modMap = new Map(modifiedRecipes.map(r => [String(r.id), r]));
              currentRecipes = currentRecipes.map(r => modMap.get(String(r.id)) || r);
            }

            targets.forEach(t => {
              resolvedKeys.add(t.key);
              if (action === 'category') {
                stage2Stats.categoryCount++;
              } else if (action === 'root') {
                stage2Stats.rootCount++;
              }
            });

            advanceToNextUnresolved();
          }
        } catch (err) {
          console.error('[CategoryPromotionModalUI] Stage 2 decision failed:', err);
          errorMessage = 'Failed to apply decision. Please retry.';
        } finally {
          isProcessing = false;
          renderModal();
        }
      };

      if (btnPromoteCat) btnPromoteCat.onclick = () => executeStage2Decision('category');
      if (btnPromoteRoot) btnPromoteRoot.onclick = () => executeStage2Decision('root');
      if (btnKeepSubtype) btnKeepSubtype.onclick = () => executeStage2Decision('subtype');

      if (btnCardSkip) {
        btnCardSkip.onclick = () => {
          const isApplyAll = Boolean(chkApplyAll?.checked);
          const targets = (isApplyAll && matchingCount > 1) ? matchingRemaining : [activeCandidate];
          targets.forEach(t => {
            resolvedKeys.add(t.key);
            stage2Stats.skippedCount++;
          });
          advanceToNextUnresolved();
          renderModal();
        };
      }
    }
  }

  renderModal();
  document.body.appendChild(modal);
}
