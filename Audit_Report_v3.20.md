# PlatePlan Technical Debt & Codebase Audit Report (v3.20.06)

*Generated via Strict Read-Only Static Analysis (Phase 4.0)*  
*Target Architecture: v3.20+ Modular ES6 / Single Source of Truth (SSOT) / Household-Scoped Firestore Repository Pattern*

---

## Executive Summary

Following the completion of Phase 3.11 (Recipe Macro Synchronisation & Recalibration), a comprehensive static analysis audit was performed across all 144 modules of the PlatePlan codebase. While the core application architecture has achieved robust modularity (all modules maintained strictly under the 400-line ceiling), adherence to Native ES6 Modules, and Household-scoped data segregation (`households/elliott-chloe`), several pockets of technical debt, schema drift, unescaped string interpolation risks, and UI anti-patterns remain.

This report details audit findings categorized by severity and proposes structured migration phases (Phase 4.1 to 4.3) to achieve absolute architectural hygiene.

---

## 1. 🔴 CRITICAL BLOCKERS (Data Loss / Syntax Risks)

1. **Inline Event String Interpolation (Apostrophe Breakage Risk)**
   - **Files:** `src/views/ProductBankView.js`, `src/components/pantry/PantryBankHTMLTemplate.js`, `src/components/pantry/SubtypeActionModalsUI.js`
   - **Line Numbers:** Various render templates (e.g. `onclick="handleDeleteProduct('${escapeAttr(p.id)}')"`)
   - **Issue:** While `escapeAttr()` is applied to IDs, several legacy action handlers still pass name or title attributes as inline parameters (e.g., `onclick="handleDeleteIngredient('${ing.id}', '${ing.name}')"`). If product or ingredient names contain single quotes (e.g., "Baker's Yeast" or "O'Malley's Cheddar"), inline JavaScript evaluation throws a syntax error, completely breaking UI interactivity.
   - **Mitigation:** Enforce dataset attribute binding (`data-id="${escapeAttr(ing.id)}"`) paired with event delegation or direct DOM event listeners instead of raw inline string arguments.

2. **Unsynchronized Local vs Global State Mutations in Secondary Views**
   - **File:** `src/views/DataQualityView.js`
   - **Line Numbers:** Lines 110–156 (`autoRecalibrateRecipeMacros`)
   - **Issue:** Manual updates to recipe arrays directly reassign `window.state.recipes` and `window.recipes` alongside `Store.setState()`. This dual-state write path risks race conditions during rapid background sync cycles with Firestore.
   - **Mitigation:** Route all state mutations exclusively through `Store.setState()` and centralised repository action bridges.

---

## 2. 🟠 STRUCTURAL DEBT (Legacy Data / Schema Drift)

1. **Redundant Top-Level Recipe Macro Fallbacks**
   - **Files:** `src/services/DataQualityScannerService.js`, `src/utils/nutritionCalculator.js`
   - **Issue:** Recipes retain legacy top-level shorthand properties (`recipe.cal`, `recipe.calories`, `recipe.prot`, `recipe.protein`) alongside the canonical `recipe.macros` object. Although scanners handle both, this creates unnecessary schema drift and potential discrepancies between stored records.
   - **Mitigation:** Standardise all recipe macro storage strictly on `recipe.macros = { calories, protein, carbs, fat, price }` during hydration and normalisation.

2. **Partial Category SSOT Enforcement in Legacy Product Drafts**
   - **Files:** `src/components/data-quality/ResolveUnlinkedModalUI.js`, `src/views/ProductBankView.js`
   - **Issue:** When importing Tesco JSON items or creating quick unlinked products, products occasionally initialize with independent `category` strings before `enforceCategorySSOT(state)` runs on save.
   - **Mitigation:** Guarantee that Category SSOT is enforced upon parser output creation before any modal mount occurs.

---

## 3. 🟡 UI ROT & ANTI-PATTERNS (DOM / CSS / UX)

1. **Inline HTML Event Handlers (`onclick="..."`)**
   - **Files:** `src/components/generator/GeneratorWizardModal.js`, `src/components/sync/SyncPanelUI.js`, `src/views/PlannerView.js`
   - **Issue:** Numerous modal components and toolbar templates rely on legacy `onclick="..."` attributes instead of clean `addEventListener` bindings attached during component lifecycle mounting.
   - **Mitigation:** Refactor components to attach event listeners dynamically upon mounting.

2. **Implicit Fallback Styling & Hardcoded Hex Codes**
   - **Files:** Various modal templates (`ResolveUnlinkedModalUI.js`, `CategoryManagerModalUI.js`)
   - **Issue:** Occasional fallback styles use hardcoded color values (e.g., `#4f46e5`, `#dc2626`) instead of standard CSS custom properties (`var(--primary)`, `var(--red)`).
   - **Mitigation:** Audit and replace all hardcoded hex color codes with CSS design token variables.

---

## 4. RECOMMENDED FIX PHASES

### **Phase 4.1: Dataset Binding & Event Delegation Hardening (Eliminate Inline String Risks)**
- **Goal:** Audit and refactor all inline action handlers (`onclick="...('${name}')"`) across `PantryBankView.js`, `ProductBankView.js`, and `SubtypeActionModalsUI.js` to use safe dataset attributes (`data-id`, `data-action`) and event delegation.
- **Estimated Effort:** 1 Session.

### **Phase 4.2: Schema Normalisation & Canonical Macro SSOT**
- **Goal:** Clean up legacy shorthand properties (`recipe.cal`, `recipe.prot`) across `src/models/` and `src/services/`, ensuring all recipes strictly adhere to the `recipe.macros` object structure.
- **Estimated Effort:** 1 Session.

### **Phase 4.3: Component Lifecycle Event Delegation & Token Cleanup**
- **Goal:** Remove remaining inline `onclick` attributes in wizard and sync modals, replacing them with programmatic `addEventListener` hooks, and scrub remaining hardcoded hex values in favour of design tokens.
- **Estimated Effort:** 1 Session.
