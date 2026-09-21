import { createLegacyView } from './create-legacy-view.js?v=3.3.4';
import { deletePlan } from '../core/store.js?v=3.3.4';

export { deletePlan };

export default createLegacyView({ id: 'planner', rootId: 'view-planner' });
