/**
 * src/views/DataQualityView.js
 * Facade for Data Quality Centre View.
 */

import { dismissDataQualityAdvisory } from '../services/DataQualityService.js';
import { getState } from '../store/store.js';
import { runAudit, scanDataQualitySummary } from '../services/DataQualityScanner.js';
import { showCustomConfirm, showCustomCopyModal } from '../components/pantry/IngredientActionModalsUI.js';
import {
  renderDataQualityView as _render,
  handleVerifyZeroCal,
  handleIgnoreStoreMapping,
  handleCleanHistoryCache
} from './DataQualityTableRenderService.js';

export { handleVerifyZeroCal, handleIgnoreStoreMapping, handleCleanHistoryCache };

export async function dismissAdvisory(issueKey) {
  await dismissDataQualityAdvisory(issueKey, () => {
    renderDataQualityView();
    updateDataQualityBadge();
  });
}

export function renderDataQualityView() {
  _render();
}

export function updateDataQualityBadge() {
  const badge = document.getElementById('dq-badge-count');
  if (!badge) return;
  const state = getState();
  const summary = scanDataQualitySummary(state);
  const total = summary.totalCount;
  badge.textContent = total;
  badge.style.display = total > 0 ? 'inline-flex' : 'none';
}

function initDataQualitySubscriptions() {
  if (typeof document === 'undefined') return;
  document.addEventListener('plateplan:state:ingredients', () => { renderDataQualityView(); updateDataQualityBadge(); });
  document.addEventListener('plateplan:state:products', () => { renderDataQualityView(); updateDataQualityBadge(); });
  document.addEventListener('plateplan:state:recipes', () => { renderDataQualityView(); updateDataQualityBadge(); });
  document.addEventListener('plateplan:state:plan', () => { renderDataQualityView(); updateDataQualityBadge(); });
  document.addEventListener('plateplan:state:preferences', () => { renderDataQualityView(); updateDataQualityBadge(); });
}

export function mount(container) {
  initDataQualitySubscriptions();
  renderDataQualityView();
  updateDataQualityBadge();
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    renderDataQualityView,
    renderDataQuality: renderDataQualityView,
    updateDataQualityBadge,
    handleVerifyZeroCal,
    handleIgnoreStoreMapping,
    handleCleanHistoryCache
  });
}
