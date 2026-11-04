---
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

## Goal Capsule

- **Objective**: Redesign the PlatePlan user interface to conform strictly to Apple's Human Interface Guidelines (HIG) as an iOS-first progressive web application with adaptive desktop support, native Apple design tokens, and custom Apple UI dialogs, while preserving all existing persistence and routing state through `src/store/coreState.js`.
- **Means**: Implement an Apple HIG design system foundation (materials, colors, typography), an iOS Tab Bar / Navigation Bar shell, Inset Grouped lists, Fitness/Health-style cards, and Apple sheets/dialogs, rolled out across four distinct phases.
- **Product Authority**: Elliott & Chloe household meal planning. Scope covers UI styling, navigation layout, modal presentation, and interaction patterns; existing domain logic (macros, fit score, Tesco import, shopping scale) remains unchanged in its underlying calculations.

## Product Contract

### Summary
PlatePlan will be redesigned into an iOS-first Apple HIG experience. It replaces bespoke CSS and ad-hoc layouts with iOS system materials, dynamic colors with an emerald green accent (`#34C759` light / `#248A3D` dark), bottom tab navigation on mobile with an adaptive sidebar on desktop, collapsing Large Title navigation bars, Inset Grouped table views, and native-feeling Apple bottom sheets and alert dialogs without native browser pop-ups.

### Requirements

#### Visual Foundations & Design Tokens
- **R1**: Define Apple HIG semantic color tokens supporting dynamic light and dark modes, including system backgrounds (`systemGroupedBackground`, `secondarySystemGroupedBackground`, `tertiarySystemGroupedBackground`), labels (`label`, `secondaryLabel`, `tertiaryLabel`), separators (`separator`, `opaqueSeparator`), and PlatePlan emerald green accent (`#34C759` light / `#248A3D` dark).
- **R2**: Apply Apple system typography scale using SF Pro font stack (`-apple-system, BlinkMacSystemFont, sans-serif`), setting standard iOS weights, tracking, and line heights for Large Title (34pt), Title 1 (28pt), Title 2 (22pt), Title 3 (20pt), Headline (17pt semibold), Body (17pt regular), Callout (16pt), Subhead (15pt), Footnote (13pt), and Caption 1-2 (12pt/11pt).
- **R3**: Implement Apple system materials and vibrancy using CSS `backdrop-filter` for translucent navigation bars, tab bars, and modal sheets.
- **R4**: Standardize border radii (`10px` for controls, `14px` for grouped table corners, `20px` for modal sheets), control heights (minimum 44pt touch targets per Apple HIG), and focus rings.
- **R5**: State management and user interactions must route strictly through `src/store/coreState.js` and store setters, with zero direct mutations to `window.state`.

#### App Shell & Global Navigation
- **R6**: Implement an iOS bottom Tab Bar for mobile viewports (< 768px) housing primary destinations (Today, Planner, Vault, Pantry, Shopping) with active tint states, subtle top border separator, and translucent background blur.
- **R7**: Provide an adaptive split navigation sidebar for desktop/tablet viewports (≥ 768px) keeping the same primary destinations accessible.
- **R8**: Implement iOS Large Title navigation headers across top-level views that gracefully collapse into compact inline navigation bars with frosted glass blur on scroll.
- **R9**: Ban all native browser pop-ups (`window.alert`, `window.confirm`, `window.prompt`), routing all confirmations, prompts, and destructive actions through Apple HIG Action Sheets or System Alert dialogs.

#### Content Layout & Presentation
- **R10**: Present lists and form sections (Pantry taxonomy, Shopping List items, Recipe Wizard ingredient rows) using the Apple Inset Grouped Table style with rounded corners, inset margins, subtle dividers, and trailing accessories.
- **R11**: Present Today view meals and Vault recipes using Apple Fitness/Health-style cards with clean typographic hierarchy, elevated surfaces, and rounded corners.
- **R12**: Present complex multi-step workflows (Recipe Wizard, Tesco Import) as fullscreen modal takeovers with top navigation bars (Cancel leading, Done/Next trailing).
- **R13**: Present quick contextual actions (Swap meal, Quick edit) as iOS bottom sheets with grabber handles and swipe-to-dismiss behavior.
- **R14**: Maintain the repository UI standard of searchable autocomplete inputs with auto-fill over native `<select>` dropdowns for all taxonomy, root items, and entity selection.
- **R15**: Today View must render daily nutritional targets (Calories, Protein, Carbs, Fat) as Apple Health-style horizontal progress bars with target indicators and bold numeric metrics.
- **R16**: Today View meal slots (Breakfast, Lunch, Dinner, Snack) must render as elevated Apple Health summary cards with meal slot header, recipe title, macro badges, and quick-action buttons (Swap, Mark Eaten, View Recipe).
- **R17**: Weekly Planner on mobile viewports (< 768px) must provide swipeable full-page day cards (paged carousel) with date header showing the day's meals and macro summary, adapting to a full 7-day grid on desktop (≥ 768px).

#### Phased Delivery Strategy
- **R18**: Execute implementation in four sequential phases:
  - Phase 1: Tokens + App Shell (Tab Bar, Nav Bar, Apple Action Sheets/Dialogs, Inset Grouped list base styling).
  - Phase 2: Today view & Vault (Fitness/Health style hero cards, macro progress bars, Swap modal sheet).
  - Phase 3: Planner & Shopping List (Weekly paged carousel/grid, Inset Grouped shopping list with iOS interactive checks).
  - Phase 4: Pantry taxonomy & Recipe Wizard (fullscreen takeover flow, custom searchable autocompletes).

### Key Decisions
- **D1: Form Factor**: iOS-first PWA with bottom Tab Bar and desktop adaptive sidebar. Mobile ergonomics and iOS PWA feel are the primary priority.
- **D2: Visual Palette**: Apple System Palette with Emerald Green accent (`#34C759` / `#248A3D`) across iOS Light and Dark modes to retain PlatePlan's culinary identity while achieving Apple native polish.
- **D3: Navigation Headers**: Standard Apple Large Titles with scroll collapse to compact inline frosted-glass bars.
- **D4: Content Layout**: Inset Grouped Table style for lists/forms; Fitness/Health cards for Today & Vault.
- **D5: Modal Architecture**: Fullscreen takeover for multi-step flows; bottom sheets for quick actions; Apple Action Sheets & System Alerts for confirmations (no native dialogs).
- **D6: State & Data Flow**: All interactions dispatch through `src/store/coreState.js` and store setters.
- **D7: Today Macro Presentation**: Apple Health horizontal progress bars with target indicator lines and bold metrics.
- **D8: Planner Mobile Navigation**: Swipeable full-page day cards in a paged carousel with date headers.
- **D9: Today Meal Slot Structure**: Elevated Apple Health summary cards with inline quick actions (Swap, Mark Eaten, View).

### Key Flows
- **Flow 1: Bottom Tab Navigation**: Tapping a tab in the mobile bottom bar switches views, updates the active green tint, resets view scroll, and updates the URL/router state.
- **Flow 2: Large Title Collapse on Scroll**: Scrolling content shifts the 34pt Large Title upwards, transitioning into an inline title within the fixed translucent navigation bar.
- **Flow 3: Quick Action Bottom Sheet**: Tapping "Swap Meal" slides up an iOS bottom sheet with a grabber handle. User selects an alternative meal or swipes down to dismiss.
- **Flow 4: Fullscreen Wizard Takeover**: Launching Recipe Wizard presents a full-screen view with top navigation bar ("Cancel" on left, "Next/Save" on right), containing Inset Grouped form sections.
- **Flow 5: Apple Confirmation Action Sheet**: Triggering a deletion or reset displays an Apple HIG Action Sheet from the bottom (or centered alert on desktop) with a red destructive action button, without invoking native browser dialogs.

### Scope Boundaries
- **In Scope**:
  - CSS design system tokens in `styles/tokens.css` and `index.html`.
  - App shell markup and router integration for iOS Tab Bar and collapsing Navigation Bar.
  - Custom Apple HIG Action Sheet, System Alert, and Bottom Sheet components replacing legacy modals.
  - Refactoring view templates to use Inset Grouped lists and Fitness/Health card designs.
  - Ensuring all state dispatches route through `src/store/coreState.js`.
- **Out of Scope**:
  - Native Swift/SwiftUI app wrapping (PlatePlan remains a browser PWA).
  - Backend Firestore data migrations or security rule modifications.
  - Nutritional macro calculation formulas or fit-score algorithm changes.
- **Deferred**:
  - Native haptic feedback API integrations.
  - Drag-and-drop gesture reordering in the weekly planner grid.

### Acceptance Examples
- **AE1 (Tab Bar)**: On viewports < 768px, a persistent translucent bottom tab bar displays the 5 tabs. Tapping switches views without page reload.
- **AE2 (Navigation Bar)**: On Today view, scrolling down smoothly collapses the 34pt Large Title "Today" into the inline frosted-glass header with separator line.
- **AE3 (Bottom Sheet)**: Tapping Swap Meal opens an iOS bottom sheet with grabber handle, dismissible via swipe down or backdrop tap.
- **AE4 (No Native Dialogs)**: Attempting to delete an item opens an Apple-styled action sheet / alert with a red destructive button, without invoking `window.confirm`.
- **AE5 (State Routing)**: Interacting with controls dispatches updates via `src/store/coreState.js` without direct mutations to `window.state`.
- **AE6 (Autocomplete Compliance)**: All taxonomy and entity pickers use searchable autocompletes, never native `<select>` dropdowns.
- **AE7 (Today Macros & Cards)**: Today view renders daily nutritional targets as Apple Health horizontal progress bars with target markers, and meal slots as elevated summary cards with quick actions (Swap, Mark Eaten, View).
- **AE8 (Planner Carousel)**: On mobile viewports, Weekly Planner presents swipeable full-page day cards in a paged carousel with date headers.

### Outstanding Questions
- None blocking planning. All core architectural rules and user preferences are settled.

## Planning Contract

### Product Contract Preservation
Product Contract unchanged. Requirements (R1-R18), Key Decisions (D1-D9), Key Flows (Flow 1-5), and Acceptance Examples (AE1-AE8) are preserved verbatim.

### Key Technical Decisions
- **KTD1: Design Token System**: Enhance `styles/tokens.css` with standard Apple system tokens: `--system-bg`, `--system-grouped-bg`, `--secondary-system-grouped-bg`, `--tertiary-system-grouped-bg`, `--label`, `--secondary-label`, `--tertiary-label`, `--separator`, and accent color `--tint-color: #34C759` (light) / `#248A3D` (dark).
- **KTD2: CSS Material Vibrancy**: Implement translucent frosted-glass styling using `backdrop-filter: blur(20px) saturate(180%)` with fallbacks for browsers without support.
- **KTD3: Tab Bar & Large Title Navigation**:
  - Update `index.html` and `src/core/AppRouter.js` to establish an iOS bottom Tab Bar (`.ios-tab-bar`) with SVG glyphs, active green tint, and safe-area inset bottom padding.
  - Large Title headers use a passive scroll listener (`window.addEventListener('scroll', ..., { passive: true })`) to trigger the `.nav-bar-scrolled` class that reveals the compact inline title in the sticky navigation bar and hides the large title.
- **KTD4: Apple Dialogs & Sheets**:
  - Refactor `src/components/ui/DialogHelpers.js` to render Apple HIG-compliant Action Sheets and System Alert dialogs with smooth spring/cubic-bezier transitions (`cubic-bezier(0.32, 0.72, 0, 1)`).
  - Bottom sheets use CSS transform translateY transitions with touch event handlers for swipe-to-dismiss.
- **KTD5: State Discipline**:
  - Every interactive control across redesigned views emits standard `data-action` attributes routed through `src/services/ActionBridge.js` and mutating state via `src/store/coreState.js` or `src/store/store.js` setters; zero direct mutations to `window.state`.

### Assumptions
- Existing CSS classes that do not conflict will be preserved for backward compatibility while new Apple HIG classes take precedence.
- Modern Safari, Chrome, and Firefox supporting CSS custom properties, flexbox/grid, and `backdrop-filter`.

### Sequencing & Dependencies
- **Unit 1 (Tokens, Shell, Tab Bar, Dialogs)** must be completed and verified first as the design system foundation.
- **Unit 2 (Today & Vault)** depends on Unit 1 tokens and shell.
- **Unit 3 (Planner & Shopping)** depends on Unit 1 tokens and shell.
- **Unit 4 (Pantry & Recipe Wizard)** depends on Unit 1 and Unit 2/3 component patterns.

## Implementation Units

### U1: Apple HIG Design Tokens, App Shell, Tab Bar & Dialogs (Phase 1)
- **Goal**: Establish the foundational Apple HIG styling, responsive layout (iOS Tab Bar on mobile, split sidebar on desktop), collapsing Large Title navigation bar, and Apple HIG Action Sheet / Alert dialogs.
- **Requirements Covered**: R1, R2, R3, R4, R5, R6, R7, R8, R9, R18 (Phase 1).
- **Files**:
  - `styles/tokens.css`
  - `styles/components.css`
  - `index.html`
  - `src/core/AppRouter.js`
  - `src/components/ui/DialogHelpers.js`
- **Approach**:
  - Define Apple HIG semantic color tokens, SF Pro font stack, and system radii in `styles/tokens.css`.
  - Update `index.html` app shell to add `.ios-tab-bar` with 5 primary destinations (Today, Planner, Vault, Pantry, Shopping) and viewport `viewport-fit=cover`.
  - Wire `src/core/AppRouter.js` to sync active tab tint on the iOS Tab Bar and desktop sidebar.
  - Implement Apple Action Sheets, Bottom Sheets, and System Alert dialogs in `src/components/ui/DialogHelpers.js`.
- **Test Scenarios**:
  - TS1.1: On viewports < 768px, bottom tab bar displays 5 items with translucent blur; clicking switches views and highlights tab with green tint.
  - TS1.2: On viewports ≥ 768px, desktop sidebar cleanly displays primary destinations.
  - TS1.3: Calling `DialogHelpers.showConfirm` or `DialogHelpers.showActionSheet` presents an Apple-styled sheet/alert with backdrop blur and escape key / backdrop tap dismissal.
  - TS1.4: Node syntax checks (`node --check`) pass on all touched JS files and `npm run build` succeeds.
- **Verification**: `node --check src/core/AppRouter.js && node --check src/components/ui/DialogHelpers.js && npm run build`

### U2: Today View Hero & Recipe Vault Redesign (Phase 2)
- **Goal**: Redesign the Today View with Apple Health horizontal progress bars, elevated meal summary cards, iOS bottom sheet for Meal Swap, and Apple card grid for Recipe Vault.
- **Requirements Covered**: R10, R11, R13, R15, R16, R18 (Phase 2).
- **Files**:
  - `src/views/TodayView.js`
  - `src/views/TodayRenderService.js`
  - `src/components/today/TodayMealSwapModal.js`
  - `src/views/RecipeVaultView.js`
- **Approach**:
  - Replace Today hero markup with Apple Health horizontal progress bars (Calories, Protein, Carbs, Fat) featuring target markers and bold metrics.
  - Render meal slot cards with clean typographic hierarchy and quick-action buttons (Swap, Mark Eaten, View Recipe).
  - Mount `TodayMealSwapModal` as an iOS bottom sheet with grabber handle and swipe-to-dismiss physics.
  - Present recipes in Recipe Vault as an Apple Photo/Card style grid with search and filter chips.
- **Test Scenarios**:
  - TS2.1: Today view displays 4 horizontal progress bars with target lines and bold numeric indicators.
  - TS2.2: Meal cards render with slot headers (Breakfast, Lunch, Dinner, Snack) and functional buttons ("Swap", "Mark Eaten", "View").
  - TS2.3: Clicking "Swap" opens `TodayMealSwapModal` as an iOS bottom sheet.
  - TS2.4: Recipe Vault displays recipes in a card grid with responsive column layout.
- **Verification**: `node --check src/views/TodayView.js && node --check src/views/TodayRenderService.js && node --check src/components/today/TodayMealSwapModal.js && node --check src/views/RecipeVaultView.js && npm run build`

### U3: Weekly Planner Carousel & Shopping List Redesign (Phase 3)
- **Goal**: Implement mobile swipeable full-page day cards in a paged carousel for the Weekly Planner (adapting to 7-day grid on desktop) and Inset Grouped Table shopping list with interactive checkbox animations.
- **Requirements Covered**: R10, R17, R18 (Phase 3).
- **Files**:
  - `src/views/PlannerView.js`
  - `src/views/ShoppingListView.js`
  - `src/store/shoppingSlice.js`
  - `src/store/planSlice.js`
- **Approach**:
  - Implement mobile full-page day cards using CSS scroll-snap (`scroll-snap-type: x mandatory`) for performant swipeable carousel without external dependencies.
  - Render desktop planner as a structured 7-day calendar grid with Apple grouped styling.
  - Format Shopping List items in Apple Inset Grouped tables with interactive checkboxes and strike-through animation.
- **Test Scenarios**:
  - TS3.1: On mobile, Weekly Planner displays swipeable full-page day cards with date header and meal slots.
  - TS3.2: On desktop, Weekly Planner displays a clean 7-day calendar grid.
  - TS3.3: Shopping list renders items inside Apple Inset Grouped tables grouped by category.
  - TS3.4: Toggling a shopping checkbox triggers smooth check animation and updates `shoppingSlice` via `coreState.js`.
  - TS3.5: Run existing shopping list unit tests (`node scripts/test_shopping_list.js`).
- **Verification**: `node scripts/test_shopping_list.js && node --check src/views/PlannerView.js && npm run build`

### U4: Pantry Taxonomy & Recipe Wizard Fullscreen Redesign (Phase 4)
- **Goal**: Redesign Pantry Bank into Apple Inset Grouped lists with chevron accessories, and Recipe Wizard into a fullscreen modal takeover with top navigation bar and searchable autocompletes.
- **Requirements Covered**: R10, R12, R14, R18 (Phase 4).
- **Files**:
  - `src/views/PantryBankView.js`
  - `src/components/recipe/RecipeWizardModal.js`
  - `src/components/pantry/RecipeSearchDropdownHelper.js`
- **Approach**:
  - Replace windowed Recipe Wizard modal with `.ios-fullscreen-modal` featuring fixed top navigation bar (Cancel / Next / Save) and scrollable Inset Grouped form body.
  - Format Pantry taxonomy rows into Inset Grouped sections with disclosure chevrons.
  - Maintain searchable autocompletes for all taxonomy and entity selection, with zero native `<select>` dropdowns.
- **Test Scenarios**:
  - TS4.1: Launching Recipe Wizard opens a full-screen takeover view with Cancel and Save nav buttons.
  - TS4.2: Step 2 live macro recalculation, ingredient mapping, and method steps follow over seamlessly.
  - TS4.3: Pantry taxonomy displays categories, root items, and products in Inset Grouped tables with chevron indicators.
  - TS4.4: Searchable autocomplete dropdowns filter instantly on keyboard input without using native `<select>`.
- **Verification**: `node test_vault_fit_score.js && node --check src/views/PantryBankView.js && node --check src/components/recipe/RecipeWizardModal.js && npm run build`

## Verification Contract

### Automated Checks
- Syntax checks:
  ```bash
  node --check src/core/AppRouter.js
  node --check src/components/ui/DialogHelpers.js
  node --check src/views/TodayView.js
  node --check src/views/TodayRenderService.js
  node --check src/views/PlannerView.js
  node --check src/views/RecipeVaultView.js
  node --check src/views/PantryBankView.js
  node --check src/components/recipe/RecipeWizardModal.js
  ```
- Regression unit tests:
  ```bash
  node scripts/test_shopping_list.js
  node test_vault_fit_score.js
  ```
- App build verification:
  ```bash
  npm run build
  ```

### Manual Verification
- Mobile viewport (< 768px): Test bottom tab bar transitions, Large Title collapse on scroll, meal swap bottom sheet, and Weekly Planner swipeable day carousel.
- Desktop viewport (≥ 768px): Test split sidebar navigation and 7-day planner grid.
- Confirm zero native `window.alert`, `window.confirm`, or `window.prompt` calls exist in touched modules.

## Definition of Done
- All 18 Requirements (R1 - R18) and 8 Acceptance Examples (AE1 - AE8) are met.
- All 4 Implementation Units (U1 - U4) are implemented, verified, and syntax-checked.
- `npm run build` succeeds with zero errors and clean commit stamping.
- All relevant standalone node tests (`test_shopping_list.js`, `test_vault_fit_score.js`) pass.
- Zero native browser pop-ups (`alert`, `confirm`, `prompt`) remain in the codebase.
- State dispatches route strictly to `src/store/coreState.js` or store action setters.
- Searchable autocompletes are preserved for all taxonomy/entity selection per repository standard.
- Unused experimental or dead styling code is pruned before final completion.

