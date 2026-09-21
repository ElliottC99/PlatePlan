import { createLegacyView } from './create-legacy-view.js?v=3.0.9';
import { renderTescoImportReviewModalHtml, readTescoImportReviewModalInputs } from './products.js?v=3.0.9';
import { replaceRecipeIngredient } from './recipes.js?v=3.0.9';

export { renderTescoImportReviewModalHtml, readTescoImportReviewModalInputs, replaceRecipeIngredient };

export default createLegacyView({ id: 'data', rootId: 'view-data' });
