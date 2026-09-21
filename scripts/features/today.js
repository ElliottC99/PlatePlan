/**
 * PlatePlan v3.3.3 - Reactive Today Feature View
 */
import { createLegacyView } from './create-legacy-view.js?v=3.3.3';
import { subscribeToStore } from '../core/store.js?v=3.3.3';

const todayView = createLegacyView({
  id: 'today',
  rootId: 'view-today',
  install: (context, rootEl) => {
    if (typeof window !== 'undefined' && rootEl && rootEl.classList.contains('active')) {
      todayView.render(context);
    }
  }
});

if (typeof window !== 'undefined') {
  subscribeStore => {
    // subscriber bus registration handled below
  };
  subscribeToStore((state) => {
    const rootEl = document.getElementById('view-today');
    if (rootEl && rootEl.classList.contains('active')) {
      todayView.render();
    }
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
      const rootEl = document.getElementById('view-today');
      if (rootEl && rootEl.classList.contains('active')) {
        todayView.render();
      }
    }, 50);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      const rootEl = document.getElementById('view-today');
      if (rootEl && rootEl.classList.contains('active')) {
        todayView.render();
      }
    });
  }
}

export default todayView;
