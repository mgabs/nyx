# zero-fouc Specification

## Purpose
Guarantees instant dark mode rendering upon navigation and tab initialization, completely eliminating bright white flashes before DOMContentLoaded.

## Requirements

### Requirement: REQ-FOUC-1 Synchronous Root Dark Stylesheet Injection
The extension MUST inject a root canvas style (`html, body { background: #181a1b !important; color: #e8e6e3 !important; }`) synchronously before HTML parsing and layout commence.

#### Scenario: Document navigation before body exists
- **WHEN** a web page begins navigation and `document.body` is null
- **THEN** root style is appended immediately to `document.documentElement` without waiting for `document.body` or DOMContentLoaded.

### Requirement: REQ-FOUC-2 Declarative Pre-Paint Stylesheet Registration
In Manifest V3 environments, the background service worker MUST pre-register dynamic content styles using `chrome.scripting.registerContentScripts` with `runAt: 'document_start'` and `cssOrigin: 'USER'`.

#### Scenario: MV3 Tab Creation
- **WHEN** a new tab is created or a navigation request begins in Chromium MV3
- **THEN** declarative styles apply at `document_start` before content script message handshake resolves.

### Requirement: NFR-FOUC-1 Zero White Frames Budget
The rendering pipeline MUST ensure that zero white frames ($0\text{ ms}$) are painted during initial document paint lifecycle.

#### Scenario: Initial Paint Lifecycle
- **WHEN** the browser triggers its first layout and paint pass
- **THEN** the viewport background color is dark (`#181a1b`) and no white flash is observed.
