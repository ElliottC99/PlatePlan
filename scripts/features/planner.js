/**
 * scripts/features/planner.js
 * PlatePlan Feature Module: Meal Planner View Wrapper
 */
import { createLegacyView } from './create-legacy-view.js?v=3.3.7-mod';

export default createLegacyView({
  id: 'planner',
  rootId: 'view-planner',
  afterRender: () => {
    if (typeof window.renderPlannerView === 'function') {
      window.renderPlannerView();
    } else if (typeof window.renderPlan === 'function') {
      window.renderPlan();
    }
  }
});
