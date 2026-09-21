import { deletePlan } from '../core/store.js?v=3.3.7';

export { deletePlan };

const renderPlanner = async () => {
  // Logic to render the planner
  console.log('Rendering planner');
};
window.renderPlanner = renderPlanner;

export default {
  render: async (context) => {
    await renderPlanner();
  }
};
