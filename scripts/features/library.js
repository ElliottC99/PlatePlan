export default {
  render: async (context) => {
    if (typeof window.renderPlanlib === 'function') await window.renderPlanlib();
  }
};
