/**
 * src/components/sync/SyncPanelUI.js (v3.19.23)
 * Enriched Cloud Sync Diagnostic Telemetry Modal.
 */

import { getState } from '../../store/store.js';
import { HOUSEHOLD_ID } from '../../config/firebase.js';
import { hydrateHouseholdData } from '../../services/HydrationService.js';
import { getCounts } from '../../services/SyncService.js';
import { showCustomConfirm, showCustomCopyModal } from '../ui/DialogHelpers.js';

let lastSyncTime = new Date();

export function updateLastSyncTime() {
  lastSyncTime = new Date();
}

function formatSyncTime(date) {
  if (!date) return 'Just now';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} mins ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function closeSyncPanelModal() {
  const modal = document.getElementById('sync-panel-modal');
  if (modal) {
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    modal.classList.remove('open');
  }
}

export function renderSyncPanelModal() {
  let modal = document.getElementById('sync-panel-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'sync-panel-modal';
    modal.className = 'modal-wrap';
    modal.style = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;pointer-events:none;transition:opacity 0.2s ease;';
    document.body.appendChild(modal);
  }

  const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
  const counts = getCounts();

  const currentUser = (typeof window !== 'undefined' && window.firebase?.auth) ? window.firebase.auth().currentUser : null;
  const isAuth = !!currentUser;
  const userEmail = currentUser?.email || (isAuth ? 'Authenticated' : 'Local Only (Not Signed In)');

  const statusLabel = isAuth ? (isOnline ? 'Connected (Live)' : 'Offline') : 'Local Mode';
  const statusColor = isAuth ? (isOnline ? 'var(--green,#10b981)' : 'var(--red,#ef4444)') : 'var(--system-blue,#2563eb)';
  const statusBg = isAuth ? (isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)') : 'rgba(37,99,235,0.1)';

  modal.innerHTML = `
    <div class="card" style="width:100%;max-width:380px;background:var(--surface,#fff);padding:20px;border-radius:14px;box-shadow:0 12px 30px rgba(0,0,0,0.15)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border,#e7e5e4)">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:18px">☁️</span>
          <h3 style="margin:0;font-size:16px;font-weight:750">Cloud Sync Diagnostics</h3>
        </div>
        <button type="button" class="btn sm ghost" data-action="close-sync-panel" style="padding:2px 6px;font-size:18px">&times;</button>
      </div>

      ${!isAuth ? `
        <div style="background:var(--badge-blue-bg); border:1px solid var(--badge-blue-border); color:var(--badge-blue-text); padding:10px 12px; border-radius:8px; font-size:12px; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div>
            <div style="font-weight:700;">Local Mode Active</div>
            <div style="font-size:11px;opacity:0.85;">Sign in with Google to sync household data.</div>
          </div>
          <button type="button" class="btn primary sm" data-action="google-login" style="white-space:nowrap; padding:6px 12px; font-size:12px; font-weight:700;">Sign in</button>
        </div>
      ` : ''}

      <!-- Status & Timestamp -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:10px 12px;background:var(--surface2,#f5f5f4);border-radius:8px;border:1px solid var(--border,#e7e5e4)">
        <span style="font-size:12px;font-weight:600;color:var(--text2,#78716c)">Status</span>
        <span class="tag" style="font-size:11.5px;font-weight:700;background:${statusBg};color:${statusColor};padding:3px 8px;border-radius:999px">
          ● ${statusLabel}
        </span>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;font-size:12.5px">
        <div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid var(--border,#e7e5e4)">
          <span style="color:var(--text2,#78716c)">Account</span>
          <span style="font-weight:600;font-size:11.5px;color:var(--text,#1c1917)">${userEmail}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid var(--border,#e7e5e4)">
          <span style="color:var(--text2,#78716c)">Last Synced</span>
          <span style="font-weight:600;color:var(--text,#1c1917)">${formatSyncTime(lastSyncTime)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid var(--border,#e7e5e4)">
          <span style="color:var(--text2,#78716c)">Routing Path</span>
          <span style="font-weight:600;font-family:monospace;font-size:11px">households/${HOUSEHOLD_ID}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid var(--border,#e7e5e4)">
          <span style="color:var(--text2,#78716c)">Ingredients</span>
          <span style="font-weight:650">${counts.ingredientsCount} items</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid var(--border,#e7e5e4)">
          <span style="color:var(--text2,#78716c)">Sub-types</span>
          <span style="font-weight:650">${counts.subtypesCount} items</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid var(--border,#e7e5e4)">
          <span style="color:var(--text2,#78716c)">Products</span>
          <span style="font-weight:650">${counts.productsCount} items</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid var(--border,#e7e5e4)">
          <span style="color:var(--text2,#78716c)">Recipes & Meal Plans</span>
          <span style="font-weight:650">${counts.recipesCount} recipes (${counts.planSlotsCount} plan slots)</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid var(--border,#e7e5e4)">
          <span style="color:var(--text2,#78716c)">Mutation Queue</span>
          <span style="font-weight:650;color:var(--green,#10b981)">Pending Offline Writes: 0</span>
        </div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn ghost sm" data-action="rehydrate-catalog" style="padding:6px 10px;font-size:12px">Re-hydrate Catalog</button>
      </div>
    </div>
  `;
  
  if (!modal.hasAttribute('data-delegated')) {
    modal.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      
      if (action === 'close-sync-panel') {
        closeSyncPanelModal();
      } else if (action === 'google-login') {
        closeSyncPanelModal();
        if (typeof window.openPlatePlanLogin === 'function') {
          window.openPlatePlanLogin();
        } else if (typeof window.signInWithGoogle === 'function') {
          window.signInWithGoogle().catch(err => console.error(err));
        }
      } else if (action === 'rehydrate-catalog') {
        handleRehydrateCatalog();
      } else if (action === 'sync-now') {
        closeSyncPanelModal();
        if (typeof window.syncNow === 'function') window.syncNow();
      }
    });
    modal.setAttribute('data-delegated', 'true');
  }

  modal.style.opacity = '1';
  modal.style.pointerEvents = 'all';
  modal.classList.add('open');
}

export async function handleRehydrateCatalog() {
  if (typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast('Re-hydrating catalog from Cloud...', 'info');
  }
  try {
    await hydrateHouseholdData();
    updateLastSyncTime();
    renderSyncPanelModal();
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Catalog re-hydrated successfully!', 'success');
    }
  } catch (e) {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Catalog re-hydration failed.', 'error');
    }
  }
}
