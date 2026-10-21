import { renderVaultGridContainer } from '../components/vault/VaultRecipeCardRenderService.js';

export function renderRecipeGrid(recipesToRender, sort, selectedMealType, activeProfile, handleRecipeSearch, renderRecipeVault) {
  const list = document.getElementById('vault-list');
  if (!list) return;

  const ft = selectedMealType;
  const fw = activeProfile;
  const fwNorm = String(fw || 'all').toLowerCase();
  const profile = (fwNorm === 'elliott' || fwNorm === 'chloe') ? fwNorm : 'everyone';

  // I need helper functions here too, this might be complicated due to dependencies.
}
