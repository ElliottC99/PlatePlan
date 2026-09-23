import { createLegacyView } from './create-legacy-view.js?v=3.3.7-mod';
import { deletePlan } from '../core/store.js?v=3.3.0';

export { deletePlan };

export default createLegacyView({ id: 'planner', rootId: 'view-planner' });
