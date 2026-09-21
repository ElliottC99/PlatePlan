/**
 * PlatePlan v3.3.4 - Reactive Today Feature View with Robust Selector, Dynamic Fallback, & Defensive Guard
 */
import { createLegacyView } from './create-legacy-view.js?v=3.3.4';
import { subscribeToStore } from '../core/store.js?v=3.3.4';

function getTodayContainer() {
  let el = document.getElementById('view-today') || 
           document.getElementById('today-view') || 
           document.getElementById('tab-today') || 
           document.querySelector('[data-view="today"]') || 
           document.querySelector('.today-container');
  
  if (!el && typeof document !== 'undefined') {
    console.warn('[Today View] Container not found in DOM. Dynamically creating fallback container element.');
    el = document.createElement('div');
    el.id = 'view-today';
    el.className = 'view active today-container';
    const mainShell = document.querySelector('main') || document.getElementById('main-content') || document.body;
    mainShell.appendChild(el);
  }
  return el;
}

const todayView = createLegacyView({
  id: 'today',
  rootId: 'view-today',
  install: (context, rootEl) => {
    try {
      const container = getTodayContainer();
      if (typeof window !== 'undefined' && container) {
        window.state = window.state || {};
        window.state.plans = Array.isArray(window.state.plans) ? window.state.plans : [];
        window.state.recipes = Array.isArray(window.state.recipes) ? window.state.recipes : [];
        
        if (container.classList.contains('active') || !container.classList.contains('hidden')) {
          todayView.render(context);
        }
      }
    } catch (err) {
      console.error('[Today View] Critical Error during install/render:', err);
    }
  }
});

if (typeof window !== 'undefined') {
  subscribeToStore((state) => {
    try {
      if (state) {
        state.plans = Array.isArray(state.plans) ? state.plans : [];
        state.recipes = Array.isArray(state.recipes) ? state.recipes : [];
      }
      const container = getTodayContainer();
      if (container && (container.classList.contains('active') || !container.classList.contains('hidden'))) {
        todayView.render();
      }
    } catch (err) {
      console.error('[Today View] Critical Error in store subscriber render:', err);
    }
  });

  const triggerInitialRender = () => {
    try {
      const container = getTodayContainer();
      if (container) {
        todayView.render();
      }
    } catch (err) {
      console.error('[Today View] Critical Error during initial render trigger:', err);
    }
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(triggerInitialRender, 50);
  } else {
    window.addEventListener('DOMContentLoaded', triggerInitialRender);
  }
}

export default todayView;
