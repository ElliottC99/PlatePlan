/**
 * src/services/RecipeImporter.js
 * Bulk text parser service for recipe ingestion.
 */

export function parseBulkRecipeText(rawText) {
  // 1. Split text into chunks separated by 2+ newlines
  const chunks = rawText.split(/\n\s*\n/);
  const parsedRecipes = [];

  chunks.forEach(chunk => {
    const lines = chunk.trim().split('\n');
    if (lines.length < 2) return; // Skip invalid chunks

    const title = lines[0].trim();
    const ingredients = lines.slice(1).map(line => {
      // Basic extraction: grab leading numbers/measurements and remainder as name
      const match = line.match(/^([\d\.\/]+(?:g|ml|tbsp|tsp|cup|clove|cloves)?)\s+(.*)/i);
      if (match) {
        return { quantityText: match[1], rawName: match[2].trim() };
      }
      return { quantityText: '', rawName: line.trim() };
    });

    parsedRecipes.push({ title, rawIngredients: ingredients });
  });

  return parsedRecipes;
}
