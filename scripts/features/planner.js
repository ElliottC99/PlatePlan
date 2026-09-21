import { deletePlan } from '../core/store.js?v=3.3.7';

export { deletePlan };

export default {
  render: async (context) => {
    if (typeof window.renderPlanner === 'function') await window.renderPlanner();
  }
};
