# Spec Delta

## MODIFIED Requirements

### Requirement: REQ-FOUC-2 Declarative Pre-Paint Stylesheet Registration
In Manifest V3 environments (Chromium MV3 and Firefox MV3), the background script MUST pre-register dynamic content styles using `chrome.scripting.registerContentScripts` with `runAt: 'document_start'` and `cssOrigin: 'USER'`.

#### Scenario: MV3 Tab Creation
- **GIVEN** a Chromium MV3 or Firefox MV3 extension environment
- **WHEN** a new tab is created or a navigation request begins
- **THEN** declarative styles apply at `document_start` before content script message handshake resolves
