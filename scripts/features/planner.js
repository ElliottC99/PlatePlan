import { createLegacyView } from './create-legacy-view.js?v=3.3.6';
import { deletePlan } from '../core/store.js?v=3.3.6';

export { deletePlan };

export default createLegacyView({ id: 'planner', rootId: 'view-planner' });
