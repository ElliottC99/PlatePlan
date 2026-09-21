import { safeStringify } from '../core/utils.js?v=3.3.7';

/**
 * Synchronous ingredient replacement with timestamping and try/catch rollback
 */
export async function replaceRecipeIngredient(recipeId, ingredientIndex, newProductId, variantKey = 'original') {
  if (!recipeId || ingredientIndex === undefined || ingredientIndex === null) return;
  
  if (!window.state) window.state = {};
  if (!Array.isArray(window.state.recipes)) window.state.recipes = [];

  const recipe = window.state.recipes.find(r => r && r.id === recipeId);
  if (!recipe) return;

  const variant = variantKey === 'enhanced' ? recipe.variants?.enhanced : (recipe.variants?.original || recipe);
  if (!variant || !Array.isArray(variant.ingredients) || !variant.ingredients[ingredientIndex]) return;

  const target = variant.ingredients[ingredientIndex];
  
  // Clone the state for potential rollback
  const previousStateStr = safeStringify(window.state);

  // 1. Ensure the link action assigns the product ID to the recipe ingredient (ingredient.id = productId)
  target.id = newProductId;
  target.productId = newProductId;
  target.bankId = newProductId;

  // 2. Generate an ISO-8601 string timestamp and set both ingredient.updatedAt and recipe.updatedAt
  const nowIso = new Date().toISOString();
  target.updatedAt = nowIso;
  recipe.updatedAt = nowIso;

  // 3. Save state locally (localStorage.setItem('plateplan_v2', ...))
  localStorage.setItem('plateplan_v2', safeStringify(window.state));

  // 4. Synchronously force a UI re-render
  if (typeof window.rehydrateActiveRecipeAndStateCache === 'function') {
    window.rehydrateActiveRecipeAndStateCache({ changedProductIds: [newProductId], recipeId: recipe.id });
  }
  if (typeof window.renderAll === 'function') window.renderAll();
  if (typeof window.renderVault === 'function') window.renderVault();

  // 5. Initiate the Firestore write asynchronously inside a try/catch
  try {
    const householdId = window.activeHouseholdId || window.state?.meta?.householdId || 'elliott-chloe';
    const db = window.platePlanDb || (window.firebase && window.firebase.firestore && window.firebase.firestore());
    if (db) {
      const docRef = db.collection('households').doc(householdId).collection('recipes').doc(recipeId);
      const cleanRecipe = typeof window.sanitizePayloadForFirestore === 'function' ? window.sanitizePayloadForFirestore(recipe) : recipe;
      await docRef.set(cleanRecipe, { merge: true });
    }
  } catch (err) {
    console.error('[INGREDIENT REPLACEMENT ERROR - ROLLING BACK]', err);
    // 6. Rollback: If Firestore write fails, restore state from local/in-memory backup and re-render
    window.state = JSON.parse(previousStateStr);
    if (typeof state !== 'undefined' && state) {
      Object.assign(state, window.state);
    }
    localStorage.setItem('plateplan_v2', previousStateStr);
    if (typeof window.rehydrateActiveRecipeAndStateCache === 'function') {
      window.rehydrateActiveRecipeAndStateCache({ changedProductIds: [newProductId], recipeId: recipe.id });
    }
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof window.renderVault === 'function') window.renderVault();
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Failed to link ingredient in cloud. Reverted change.', 'error');
    }
  }
}

const renderVault = async () => {
  const list = document.getElementById('vault-list');
  if (!list) return;

  if (!window.state || !Array.isArray(window.state.recipes)) {
    list.innerHTML = '<div class="msg info">No recipes found in state.</div>';
    return;
  }

  const recipes = window.state.recipes.filter(r => r && r.id);
  
  if (recipes.length === 0) {
    list.innerHTML = '<div class="msg info">Your recipe vault is empty.</div>';
    return;
  }

  // Basic search/sort/filter logic
  const search = document.getElementById('vault-search')?.value.toLowerCase() || '';
  const typeFilter = document.getElementById('filter-type')?.value || 'all';
  const whoFilter = document.getElementById('filter-who')?.value || 'all';
  const favFilter = document.getElementById('vault-filter-fav')?.getAttribute('aria-pressed') === 'true';

  const filtered = recipes.filter(r => {
    const name = (r.name || '').toLowerCase();
    const matchesSearch = !search || name.includes(search);
    const matchesType = typeFilter === 'all' || r.type === typeFilter || (Array.isArray(r.type) && r.type.includes(typeFilter));
    const matchesWho = whoFilter === 'all' || r.who === whoFilter || r.who === 'both';
    const matchesFav = !favFilter || r.favourite;
    return matchesSearch && matchesType && matchesWho && matchesFav;
  });

  list.innerHTML = filtered.map(r => {
    const timeLabel = r.time ? `<span>${r.time} mins</span>` : '';
    const whoLabel = r.who ? `<span class="badge sm">${r.who}</span>` : '';
    const typeLabel = r.type ? `<span style="text-transform: capitalize">${r.type}</span>` : '';
    
    return `
      <div class="card recipe-card" style="cursor:pointer; transition: transform 0.1s;" data-pp-click="openRecipe('${r.id}')">
        <div class="row-between" style="align-items: flex-start; margin-bottom: 8px;">
          <div style="font-weight: 700; font-size: 15px; color: var(--text1);">${r.name || 'Untitled Recipe'}</div>
          ${r.favourite ? '<span style="color: var(--red);">❤️</span>' : ''}
        </div>
        <div style="display:flex; gap:10px; font-size:12px; color:var(--text2); margin-bottom:12px; align-items:center;">
          ${typeLabel}
          ${timeLabel}
          ${whoLabel}
        </div>
        <div class="grid2" style="gap:8px; padding-top:10px; border-top: 1px solid var(--border);">
          <div style="font-size:12px;"><strong>${r.calories || 0}</strong> <span style="color:var(--text3)">kcal</span></div>
          <div style="font-size:12px;"><strong>${r.protein || 0}g</strong> <span style="color:var(--text3)">protein</span></div>
        </div>
      </div>
    `;
  }).join('');
};
window.renderVault = renderVault;

export { renderVault };

export default {
  render: async (context) => {
    await renderVault();
  }
};

