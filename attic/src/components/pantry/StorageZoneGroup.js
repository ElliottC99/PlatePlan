/**
 * src/components/pantry/StorageZoneGroup.js (v3.9.4)
 * Modular ES6 component for Pantry Storage Zones.
 * - Renders Fridge, Freezer, and Pantry groupings
 * - Includes zone-specific item count badges
 * - Renders accordion collapse/expand toggles
 */

import { renderPantryItemRow } from './PantryItemRow.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Renders a storage zone group accordion.
 * @param {string} zoneName Fridge, Freezer, or Pantry
 * @param {Array} items List of pantry items
 * @param {boolean} isOpen Accordion expanded status
 * @returns {string} HTML template literal
 */
export function renderStorageZoneGroup(zoneName = 'Pantry', items = [], isOpen = true) {
  const safeZone = escapeHtml(zoneName);
  const totalCount = items.length;

  const rowsHtml = totalCount > 0 
    ? items.map(item => renderPantryItemRow(item)).join('')
    : `<div style="font-size:12.5px;color:var(--text3);padding:10px;text-align:center;background:var(--surface2);border-radius:8px">No items stored in this zone.</div>`;

  return `
    <div class="card storage-zone-group" style="margin-bottom:14px;padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface)">
      <!-- Accordion Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none" onclick="toggleStorageZoneCollapse('${safeZone}')">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:16px">${zoneName === 'Fridge' ? '❄️' : (zoneName === 'Freezer' ? '🧊' : '🥫')}</span>
          <span style="font-weight:700;font-size:14.5px;color:var(--text)">${safeZone} Storage</span>
          <span class="tag" style="background:var(--surface2);color:var(--text2);font-weight:700;font-size:11px">${totalCount} item${totalCount === 1 ? '' : 's'}</span>
        </div>
        <div style="font-size:12px;color:var(--text3);font-weight:bold">
          ${isOpen ? '▲ Collapse' : '▼ Expand'}
        </div>
      </div>

      <!-- Zone Content -->
      <div id="storage-zone-content-${safeZone.toLowerCase()}" style="margin-top:10px;display:${isOpen ? 'block' : 'none'}">
        ${rowsHtml}
      </div>
    </div>
  `;
}
