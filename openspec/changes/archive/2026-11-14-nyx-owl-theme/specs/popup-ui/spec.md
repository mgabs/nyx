# Spec Delta: popup-ui

## MODIFIED Requirements

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
