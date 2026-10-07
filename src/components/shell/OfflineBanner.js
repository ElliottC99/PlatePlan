/**
 * src/components/shell/OfflineBanner.js (v3.27.0)
 * Subtle floating offline status banner when browser goes offline.
 */

export function initOfflineBanner() {
  if (typeof window === 'undefined' || document.getElementById('plateplan-offline-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'plateplan-offline-banner';
  banner.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    z-index: 99999;
    display: none;
    align-items: center;
    gap: 8px;
    background: #d97706;
    color: #ffffff;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: opacity 0.3s ease;
  `;
  banner.innerHTML = `
    <span style="width:8px;height:8px;background:#fff;border-radius:50%;display:inline-block;animation:pulse 1.5s infinite"></span>
    <span>Offline Mode — Reading from cached local storage</span>
  `;
  document.body.appendChild(banner);

  const updateStatus = () => {
    if (navigator.onLine) {
      banner.style.display = 'none';
    } else {
      banner.style.display = 'flex';
    }
  };

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') {
    initOfflineBanner();
  } else {
    window.addEventListener('DOMContentLoaded', initOfflineBanner);
  }
}
