/**
 * src/components/shell/ScrollToTopButton.js
 * Accessible floating "Scroll to Top" button for long workspace views.
 * Uses capture + passive scroll listeners with requestAnimationFrame throttling
 * and delegates click handling via data-action="scroll-to-top" in ActionBridge.js.
 */

const SCROLL_VISIBILITY_THRESHOLD_PX = 220;
let lastScrolledContainer = null;

function getActiveScrollTop(eventTarget) {
  const winTop =
    window.scrollY ||
    window.pageYOffset ||
    document.scrollingElement?.scrollTop ||
    document.documentElement?.scrollTop ||
    document.body?.scrollTop ||
    0;

  if (
    eventTarget &&
    eventTarget !== document &&
    eventTarget !== window &&
    typeof eventTarget.scrollTop === 'number' &&
    !eventTarget.closest?.('.modal-wrap, .category-suggestions, .recipe-search-drop')
  ) {
    if (eventTarget.scrollTop > winTop) {
      lastScrolledContainer = eventTarget;
      return eventTarget.scrollTop;
    }
  }
  return Math.max(winTop, lastScrolledContainer?.scrollTop || 0);
}

export function scrollToTop() {
  if (typeof window === 'undefined') return;
  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = prefersReducedMotion ? 'instant' : 'smooth';

  window.scrollTo({ top: 0, behavior });
  if (document.scrollingElement) {
    document.scrollingElement.scrollTo?.({ top: 0, behavior });
  }
  if (lastScrolledContainer && typeof lastScrolledContainer.scrollTo === 'function') {
    lastScrolledContainer.scrollTo({ top: 0, behavior });
  }
}

export function initScrollToTopButton() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (document.getElementById('plateplan-scroll-top-btn')) return;

  if (!document.getElementById('plateplan-scroll-top-styles')) {
    const style = document.createElement('style');
    style.id = 'plateplan-scroll-top-styles';
    style.textContent = `
      .scroll-top-btn {
        position: fixed;
        right: 20px;
        bottom: 24px;
        z-index: 9000;
        min-height: 44px;
        padding: 0 14px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        background: var(--action, #2563eb);
        color: #ffffff;
        font-family: var(--font, system-ui, sans-serif);
        font-size: 13px;
        font-weight: 700;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transform: translateY(12px);
        transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease, background 0.15s ease;
      }
      .scroll-top-btn.visible {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: translateY(0);
      }
      .scroll-top-btn:hover {
        filter: brightness(1.08);
      }
      @media (max-width: 839px) {
        .scroll-top-btn {
          right: 14px;
          bottom: calc(78px + env(safe-area-inset-bottom));
        }
      }
    `;
    document.head.appendChild(style);
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'plateplan-scroll-top-btn';
  btn.className = 'scroll-top-btn';
  btn.setAttribute('data-action', 'scroll-to-top');
  btn.setAttribute('aria-label', 'Scroll to top');
  btn.setAttribute('title', 'Scroll to top');
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 15l-6-6-6 6"/>
    </svg>
    <span>Top</span>
  `;
  document.body.appendChild(btn);

  let ticking = false;
  const updateVisibility = (target) => {
    const shouldShow = getActiveScrollTop(target) > SCROLL_VISIBILITY_THRESHOLD_PX;
    btn.classList.toggle('visible', shouldShow);
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    (e) => {
      const target = e?.target;
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(() => updateVisibility(target));
      }
    },
    { capture: true, passive: true }
  );

  updateVisibility(null);
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initScrollToTopButton();
  } else {
    window.addEventListener('DOMContentLoaded', initScrollToTopButton);
  }
}
