# Spec Delta

## ADDED Requirements

### Requirement: REQ-LEAN-FIDELITY-1 Shared and changing adopted stylesheets
Lean MUST theme accessible page-authored adopted stylesheets separately for each document or open shadow root that adopts them, and reflect additions, removals, replacements and rule changes while active without processing its own sheets.

#### Scenario: One stylesheet shared by components
- **GIVEN** two open shadow roots adopt the same page stylesheet containing light colors
- **WHEN** Lean is active
- **THEN** both roots receive the themed colors and the original stylesheet remains owned by the page

#### Scenario: Adopted styles change after activation
- **GIVEN** Lean is active on a document or open shadow root
- **WHEN** a page adds, removes, replaces or edits an adopted stylesheet
- **THEN** the themed output reflects the current sheets and rules without stale overrides

### Requirement: REQ-LEAN-FIDELITY-2 Stylesheet changes and imports
When page-level hooks are available, Lean MUST reflect page CSSOM declaration changes made through declarations obtained after hook installation, and MUST reflect accessible imported rules, including cross-origin stylesheet imports that the extension can fetch, while retaining stylesheet ordering and applicable import conditions. Direct property assignments through declarations saved before hook installation, and changes when page-level hooks are unavailable, are not guaranteed to be detected.

#### Scenario: Same-count CSSOM edit
- **GIVEN** Lean manages a page stylesheet
- **WHEN** the page changes a declaration without changing its rule count
- **THEN** the resulting themed style reflects the new declaration without a synthetic test notification

#### Scenario: Nested cross-origin imports
- **GIVEN** a fetchable cross-origin stylesheet imports another stylesheet with a color rule
- **WHEN** Lean themes the page
- **THEN** the imported rule is themed under its applicable conditions

#### Scenario: Import cannot be fetched
- **GIVEN** an imported stylesheet cannot be fetched
- **WHEN** Lean processes its parent stylesheet
- **THEN** accessible rules remain themed and processing terminates without blocking cleanup

### Requirement: REQ-LEAN-FIDELITY-3 Lifecycle cleanup
When Lean is disabled or replaced, it MUST remove its emitted sheets, inline attributes and custom properties from the document and accessible shadow roots, stop its observers, and prevent pending asynchronous work from restoring stale overrides.

#### Scenario: Disable during a pending load
- **GIVEN** Lean is active with inline overrides in a shadow root and a stylesheet fetch in flight
- **WHEN** the user switches engines before the fetch completes
- **THEN** Lean's overrides and observers are removed and the late response does not restore them

### Requirement: REQ-LEAN-FIDELITY-4 Document-scoped export
Lean CSS export MUST include only its active document-root sheets in their live cascade order and MUST exclude shadow-root sheets; the export limitation MUST be documented.

#### Scenario: Site fix and shadow component
- **GIVEN** a site fix overrides a generated document rule and an open shadow root has themed rules
- **WHEN** the user exports Lean CSS
- **THEN** the exported document rules preserve the site fix precedence and do not include shadow-root rules

### Requirement: NFR-LEAN-FIDELITY-1 Lean constraints and verification
Lean MUST continue to create zero Nyx sync style elements and allocate zero canvases for image analysis in representative document and open-shadow-root scenarios; changes to shared helpers MUST preserve Dynamic behavior.

#### Scenario: Representative themed page
- **GIVEN** a page with images, stylesheets and an open shadow root
- **WHEN** Lean applies and updates its theme
- **THEN** no Nyx sync style elements or image-analysis canvases are created

#### Scenario: Existing Dynamic engine
- **GIVEN** Dynamic is selected
- **WHEN** shared color and stylesheet functionality is exercised
- **THEN** Dynamic retains its expected behavior under regression tests
