/**
 * src/views/DataQualityView.js
 * Facade for Data Quality Centre View.
 */

import { getState } from '../store/store.js';
import { runAudit, scanDataQualitySummary, dismissDataQualityAdvisory } from '../services/DataQualityScanner.js';
import { showCustomConfirm, showCustomCopyModal } from '../components/ui/DialogHelpers.js';
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
  if (typeof document === 'undefined') return;
  const state = getState();
  const summary = scanDataQualitySummary(state);
  const total = summary.totalCount || 0;

  document.querySelectorAll('[data-view="data"]').forEach(el => {
    let badge = el.querySelector('.dq-nav-badge');
    if (total > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'dq-nav-badge';
        badge.style.cssText = 'margin-left:6px;font-size:11px;font-weight:700;padding:2px 6px;border-radius:10px;line-height:1;display:inline-block;background:var(--amber-bg, rgba(245,158,11,0.15));color:var(--amber,#d97706);';
        el.appendChild(badge);
      }
      badge.textContent = total > 99 ? '99+' : total;
    } else if (badge) {
      badge.remove();
    }
  });

  const badge = document.getElementById('dq-badge-count');
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  }
}

const DQ_STATE_EVENTS = [
  'plateplan:state:ingredients',
  'plateplan:state:products',
  'plateplan:state:recipes',
  'plateplan:state:plan',
  'plateplan:state:preferences'
];

let dqSubscriptionsActive = false;

function handleDataQualityStateChange() {
  if (typeof document === 'undefined') return;
  const viewEl = document.getElementById('view-data');
  if (!viewEl || !viewEl.classList.contains('active')) return;
  renderDataQualityView();
  updateDataQualityBadge();
}

function initDataQualitySubscriptions() {
  if (typeof document === 'undefined' || dqSubscriptionsActive) return;
  dqSubscriptionsActive = true;
  DQ_STATE_EVENTS.forEach(evt => document.addEventListener(evt, handleDataQualityStateChange));
}

export function unmount() {
  if (typeof document === 'undefined' || !dqSubscriptionsActive) return;
  dqSubscriptionsActive = false;
  DQ_STATE_EVENTS.forEach(evt => document.removeEventListener(evt, handleDataQualityStateChange));
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
