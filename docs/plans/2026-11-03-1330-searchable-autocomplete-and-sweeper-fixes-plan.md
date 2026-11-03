---
title: Searchable Autocomplete Rule Codification, Recipe Audit Autocomplete, and Sweeper Fixes
type: feat
date: 2026-11-03
topic: searchable-autocomplete-and-sweeper-fixes
---

# Searchable Autocomplete Rule Codification, Recipe Audit Autocomplete, and Sweeper Fixes

> Created: 2026-11-03  
> Status: Implemented ✓  

## Summary
1. **Repository Preference Enforcement**: Codify in `AGENTS.md` the permanent architectural rule that native HTML `<select>` dropdowns must NEVER be used for catalog taxonomy or entity selection, mandating searchable autocomplete inputs with auto-fill across all current and future work.
2. **Recipe Mapping Audit Autocomplete**: Replace the native `<select>` in `RecipeAuditModalRenderService.js` and `RecipeAuditModal.js` with `createTaxonomySearchInput`, auto-filling confident suggestions by default and allowing instant search with keyboard navigation.
3. **Unlinked Sweeper `undefined` Bug**: Standardize `onComplete` in `AddItemWizardUI.js` and `UnlinkedSweeperUI.js` to reliably capture `ingredientId`, `subtypeId`, `parentName`, and `subtypeName`, eliminating the `🏷️ undefined (undefined)` bug.
4. **Unlinked Recipe Ingredients Detection**: Remove the faulty `(item.id && length > 3)` check in `UnlinkedSweeperUI.js` that caused recipe items with local row IDs to be mistakenly treated as linked.
5. **Ribbon Action Alignment**: Correctly wire the action ribbon button in `DataQualityTableRenderService.js` so button counts match the modal they trigger.

---

## Acceptance Criteria
- [ ] **Permanent AGENTS.md Rule**: `AGENTS.md` explicitly documents the repository standard: no native `<select>` dropdowns for catalog taxonomy or entity selection; always use searchable autocomplete inputs with auto-fill.
- [ ] **Recipe Audit Autocomplete**: Every issue card in Recipe Mapping Audit uses a searchable autocomplete input instead of a `<select>` dropdown, with pre-filled suggestions and instant filtering.
- [ ] **Clean New Item Linking in Sweeper**: Creating a new Root Item and Sub-Type in the Sweeper correctly populates `input.value = "🏷️ Sub-Type (Root Item)"` and assigns `selectedId` / `selectedSubId` without any `undefined`.
- [ ] **Accurate Recipe Linking Check**: `scanUnlinkedRecipeIngredients()` checks for valid Master Catalog links (`ingredientId`, `subtypeId`, `productId`) rather than arbitrary client line IDs (`item.id`).
- [ ] **Ribbon Count Alignment**: Action ribbon buttons accurately indicate the counts of the data they inspect.
- [ ] **Verification**: Tests pass (`node scripts/test_data_quality_wizards.js`) and build succeeds (`npm run build`).

---

## Implementation Steps

### Step 1: Codify Rule in `AGENTS.md`
Add the following rule under `## Architecture` / `Layers in src/`:
```markdown
- **UI Standard — Searchable Autocomplete Over `<select>` Dropdowns**: Never use native `<select>` dropdowns for catalog taxonomy (categories, root items, sub-types, or products) or entity selection. Always use searchable autocomplete inputs with auto-fill (`createTaxonomySearchInput` from `RecipeSearchDropdownHelper.js` or dedicated autocomplete search helpers) that provide instant substring filtering, keyboard navigation (Arrow keys + Enter), and pre-filled confident suggestions.
```

### Step 2: Replace `<select>` in Recipe Mapping Audit
- In `src/components/recipe/RecipeAuditModalRenderService.js`:
  - Replace `<select id="ram-select-${issue.id}">` with `<div class="ram-search-mount" data-issue-id="${escapeAttr(issue.id)}"></div>`.
  - Remove redundant `buildCatalogOptions()` function generating hundreds of `<option>` strings.
- In `src/components/recipe/RecipeAuditModal.js`:
  - After rendering modal HTML, mount `createTaxonomySearchInput` onto each `.ram-search-mount`.
  - Auto-fill `initialValue` with the suggested match if present (`🏷️ Subtype (Parent)` or `📦 Parent`).
  - Pre-populate `mount.dataset.selectedId` and `mount.dataset.selectedSubId`.
  - When saving, read `selectedId` and `selectedSubId` from the mount element.

### Step 3: Fix `🏷️ undefined (undefined)` in Sweeper & Wizard
- In `src/components/pantry/AddItemWizardUI.js` line 357:
  - Normalize `cb(res)` so `ingredientId: res.rootItem?.id`, `subtypeId: res.subtypeId || res.subtype?.id`, `parentName: res.rootItem?.name || wizardData.itemName`, `subtypeName: res.subtype?.name || wizardData.subtypeName` are always present.
- In `src/components/data-quality/UnlinkedSweeperUI.js` line 206:
  - Robustly extract `ingId`, `subId`, `parentName`, and `subName` from `created`.

### Step 4: Fix Recipe Ingredient Linking Logic
- In `src/components/data-quality/UnlinkedSweeperUI.js` line 39:
  - Update `check` to require a true Master Catalog link (`item.ingredientId || item.subtypeId || item.productId || item.bankId || item.pantryItemId`), discarding `(item.id && length > 3)`.

### Step 5: Fix Ribbon Button Alignment
- In `src/views/DataQualityTableRenderService.js`:
  - Calculate `unlinkedRecipeCount = scanUnlinkedRecipeIngredients().length;` for the `open-sweeper` button, or clearly label Unmapped Pantry Items.

### Step 6: Test & Build
- Run `node scripts/test_data_quality_wizards.js`.
- Run `npm run build`.
- Commit and push to `dev/recipe-bulk-parse-instruction-fix`.
