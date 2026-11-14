# popup-ui Specification

## Purpose
Consolidates the non-Plus browser extension popup onto the `NewBody` UI, removes the legacy Classic popup UI and `previewNewDesign` flag, and establishes a Material Design 3 visual system scoped to `src/ui/popup/`.

## Requirements

### Requirement: REQ-POPUP-1 Unified Non-Plus Popup Routing
The popup entrypoint MUST render `NewBody` for all non-Plus desktop and mobile sessions without requiring or reading `previewNewDesign`, while preserving `__PLUS__` routing (`initAltUI` and `PlusBody` gated by `previewNewestDesign` or mobile version `>= 4.9.93`) and displaying a loading state when `data.isReady` is `false`.

#### Scenario: Desktop popup opens in non-Plus build
- **GIVEN** a non-Plus desktop extension build where `data.isReady` is `true`
- **WHEN** the user opens the browser action popup
- **THEN** the popup renders `NewBody` directly and does not toggle an `html.preview` class

#### Scenario: Popup opens while extension data is not ready
- **GIVEN** `data.isReady` is `false`
- **WHEN** the popup mounts
- **THEN** the loading indicator is rendered until `data.isReady` becomes `true`

#### Scenario: Plus build preserves PlusBody routing
- **GIVEN** a `__PLUS__` build where `previewNewestDesign` is `true`
- **WHEN** the popup renders
- **THEN** `PlusBody` is rendered without any dependency on Classic UI components

### Requirement: REQ-POPUP-2 Removal of Classic UI and `previewNewDesign`
The codebase MUST remove the Classic popup UI (`src/ui/popup/components/*` excluding any retained loading indicator), `UserSettings.previewNewDesign`, its default/validation/mock entries, and the DevTools `.preview-design-button` control.

#### Scenario: Settings validation with legacy persisted `previewNewDesign`
- **GIVEN** persisted user settings from an older version containing `previewNewDesign: true`
- **WHEN** `validateSettings` runs on the loaded settings object
- **THEN** validation succeeds without errors and does not expose `previewNewDesign` on `DEFAULT_SETTINGS`

#### Scenario: DevTools opens without prototype toggle
- **GIVEN** the user opens the Developer Tools extension page
- **WHEN** the DevTools header/toolbar renders
- **THEN** `.preview-design-button` is absent while `previewNewestDesign` controls in `__PLUS__` builds remain unaffected

### Requirement: REQ-POPUP-3 Material Design 3 Popup Visual System & Layout Polish
`NewBody` (`src/ui/popup/body/`, `main-page/`, `theme/`, `news-section/`, `page-viewer/`) MUST use Material Design 3 visual styling—tonal surface containers over Nyx's `#111114` Obsidian base, `#c4c4cc` Silver foreground/primary tones, `#f59e0b` Amber accents/headings, rounded cards and pill controls, hover/focus-visible state layers, and smooth `PageViewer` transitions—aligned with `src/ui/theme.less` and `src/ui/popup/compatibility.js` across `popup`, `options`, `devtools`, and `stylesheet-editor`, MUST remove dead `PageId` stubs (`settings`, `site-list`, `automation`, `manage-settings`) and fixed-height `.pages-section` clipping, and MUST NOT render `DonateGroup` (`uiHighlights: ['anniversary']`).

#### Scenario: Navigating between Main and Theme pages
- **GIVEN** `NewBody` is open on the `main` page
- **WHEN** the user activates the Theme navigation control
- **THEN** `PageViewer` transitions smoothly to the `theme` page without clipping controls, and clicking Back returns to `main`

#### Scenario: Shared extension pages remain visually unchanged
- **GIVEN** the popup MD3 styles are built
- **WHEN** the user opens `options` or `devtools`
- **THEN** `options` and `devtools` retain their existing `src/ui/theme.less` layout and structure using the Obsidian `#111114`, Silver `#c4c4cc`, and Amber `#f59e0b` palette

#### Scenario: Extension UI pages use unified Obsidian, Silver, and Amber palette
- **GIVEN** the extension UI bundles are built
- **WHEN** the user opens the popup, `options`, or `devtools`
- **THEN** all pages render over the `#111114` Obsidian base with `#c4c4cc` Silver text and `#f59e0b` Amber accents

#### Scenario: Popup renders without DonateGroup
- **GIVEN** `NewBody` renders in a non-Plus build
- **WHEN** inspecting the popup DOM
- **THEN** `.m-donate-group` is absent and no donation prompt is shown

### Requirement: REQ-POPUP-4 Popup E2E Coverage on `NewBody`
Browser E2E tests (`tests/browser/e2e/toggle.tests.ts` and `tests/browser/e2e/news.tests.ts`) MUST verify site toggling, extension power switching, automation/theme controls, and news display against `NewBody` selectors.

#### Scenario: E2E toggle and news suites run against consolidated popup
- **GIVEN** a debug test build of the extension
- **WHEN** `npm run test:browser` executes `toggle.tests.ts` and `news.tests.ts`
- **THEN** all popup toggle and news assertions pass against `NewBody` DOM elements

### Requirement: NFR-POPUP-1 Popup Responsiveness & Bundle Budget
Popup initial render and `PageViewer` page transitions MUST complete within a 16ms frame budget (`<= 16ms` per transition frame), and removing Classic UI MUST not increase the compiled `popup/index.js` or `popup/style.css` bundle sizes.

#### Scenario: Frame-budget and bundle-size check
- **GIVEN** a release build via `npm run build`
- **WHEN** inspecting compiled popup assets and measuring page-switch interaction
- **THEN** `popup/index.js` and `popup/style.css` are smaller than or equal to pre-consolidation sizes and page transitions animate at 60fps (`<= 16ms` frame time)
