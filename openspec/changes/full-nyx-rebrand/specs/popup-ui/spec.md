# Spec Delta

## MODIFIED Requirements

### Requirement: REQ-POPUP-3 Material Design 3 Popup Visual System & Layout Polish
`NewBody` (`src/ui/popup/body/`, `main-page/`, `theme/`, `news-section/`, `page-viewer/`) MUST use Material Design 3 visual styling—tonal surface containers over the `#141e24` dark slate base, rounded cards and pill controls, hover/focus-visible state layers, and smooth `PageViewer` transitions—scoped exclusively to `src/ui/popup/` without altering `src/ui/theme.less`, `options/`, or `devtools/`, MUST remove dead `PageId` stubs (`settings`, `site-list`, `automation`, `manage-settings`) and fixed-height `.pages-section` clipping, and MUST NOT render `DonateGroup` (`uiHighlights: ['anniversary']`).

#### Scenario: Navigating between Main and Theme pages
- **GIVEN** `NewBody` is open on the `main` page
- **WHEN** the user activates the Theme navigation control
- **THEN** `PageViewer` transitions smoothly to the `theme` page without clipping controls, and clicking Back returns to `main`

#### Scenario: Shared extension pages remain visually unchanged
- **GIVEN** the popup MD3 styles are built
- **WHEN** the user opens `options` or `devtools`
- **THEN** `options` and `devtools` retain their existing `src/ui/theme.less` styling and layout

#### Scenario: Popup renders without DonateGroup
- **GIVEN** `NewBody` renders in a non-Plus build
- **WHEN** inspecting the popup DOM
- **THEN** `.m-donate-group` is absent and no donation prompt is shown
