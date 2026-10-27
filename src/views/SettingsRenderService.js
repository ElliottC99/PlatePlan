
export function renderMacroTargetsForm(macroTargets = { calories: 2000, protein: 125, carbs: 200, fat: 70 }) {
  return `
    <div class="settings-card">
      <h3>Macro Targets</h3>
      <div class="grid-form">
        <label>Calories: <input type="number" id="pp-macro-cal" value="${macroTargets.calories}"></label>
        <label>Protein (g): <input type="number" id="pp-macro-prot" value="${macroTargets.protein}"></label>
        <label>Carbs (g): <input type="number" id="pp-macro-carbs" value="${macroTargets.carbs}"></label>
        <label>Fat (g): <input type="number" id="pp-macro-fat" value="${macroTargets.fat}"></label>
      </div>
    </div>
  `;
}

export function renderFallbackProductsTable(fallbackProducts = []) {
  return `
    <div class="settings-card">
      <h3>Fallback Products</h3>
      <table id="pp-fallback-products-table">
        <thead>
          <tr>
            <th>Match</th>
            <th>Name</th>
            <th>Price</th>
            <th>Weight (g)</th>
          </tr>
        </thead>
        <tbody>
          ${fallbackProducts.map((p, idx) => `
            <tr>
              <td><input type="text" data-idx="${idx}" data-field="match" value="${p.match}"></td>
              <td><input type="text" data-idx="${idx}" data-field="name" value="${p.name}"></td>
              <td><input type="number" data-idx="${idx}" data-field="price" value="${p.price}"></td>
              <td><input type="number" data-idx="${idx}" data-field="packSize" value="${p.packSize}"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
