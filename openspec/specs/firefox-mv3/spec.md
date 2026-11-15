# firefox-mv3 Specification

## Purpose
Migrates the Firefox extension target from Manifest V2 to Manifest V3 with non-persistent event pages, `action`, `host_permissions`, and `chrome.scripting` support while keeping Thunderbird on Manifest V2.

## Requirements

### Requirement: REQ-FFMV3-1 Firefox Manifest V3 Target
The build system MUST produce the `firefox` target (`build/release/firefox` and `nyx-firefox.xpi`) as Manifest V3 (`manifest_version: 3`) with `strict_min_version: "128.0"`, `background.scripts: ["background/index.js"]`, `action`, `host_permissions: ["<all_urls>"]`, and `scripting` permission, while keeping `thunderbird` on Manifest V2 (`manifest_version: 2`).

#### Scenario: Release build emits MV3 for Firefox and MV2 for Thunderbird
- **GIVEN** the repository build configuration
- **WHEN** `npm run build` completes
- **THEN** `build/release/firefox/manifest.json` has `manifest_version: 3` with `background.scripts: ["background/index.js"]` and `action`, and `build/release/thunderbird/manifest.json` has `manifest_version: 2` with `background.page` and `browser_action`

### Requirement: REQ-FFMV3-2 Firefox Non-Persistent Event Page Lifecycle
In Firefox MV3 builds, the runtime MUST treat the background context as non-persistent (`isNonPersistent === true`), register `keepListeningToEvents()`, and preserve `Extension.isFirstLoad` and session state across event-page suspension without requiring `background/index.html`.

#### Scenario: Firefox MV3 background wakes up after event-page suspension
- **GIVEN** a Firefox MV3 installation where the background event page has suspended
- **WHEN** a tab event or UI message wakes the background script
- **THEN** `keepListeningToEvents()` and session/storage state restore active settings without throwing on missing `background/index.html`

### Requirement: REQ-FFMV3-3 Firefox MV3 Action & Scripting API Compatibility
The Firefox MV3 bundle MUST target `chrome.action` instead of `chrome.browserAction` and enable `ContentScriptManager` (`chrome.scripting.registerContentScripts`) while preserving Gecko-specific `isFirefox` behaviors (`cloneInto`, `unwrap`, `firefoxPortListener`, and `makeFirefoxHappy`).

#### Scenario: Firefox MV3 updates icon and registers scripting content scripts
- **GIVEN** a Firefox MV3 runtime
- **WHEN** the extension initializes and updates the toolbar icon
- **THEN** icon updates invoke `chrome.action.setIcon` without calling `chrome.browserAction`, and `ContentScriptManager` registers `MAIN`/`ISOLATED` scripts via `chrome.scripting`

### Requirement: REQ-FFMV3-4 Firefox MV3 about:blank & CSP Safety
`src/manifest-firefox.json` MUST set `match_about_blank: false` on every `content_scripts` entry and MUST NOT include Chrome-only `navigate-to` directives in `content_security_policy.extension_pages`.

#### Scenario: Manifest validation checks Firefox MV3 CSP and content scripts
- **GIVEN** `src/manifest-firefox.json`
- **WHEN** unit tests inspect `content_scripts` and `content_security_policy`
- **THEN** every `content_scripts` entry has `match_about_blank: false` and `extension_pages` contains no `navigate-to` directive

### Requirement: NFR-FFMV3-1 Zero Thunderbird or Standalone API Regression
Migrating Firefox to MV3 MUST NOT alter `thunderbird` MV2 manifest/runtime behavior or break the standalone API build (`npm run api`).

#### Scenario: Full verification gates pass after migration
- **GIVEN** the migrated Firefox MV3 build and source changes
- **WHEN** `npm test`, `npm run lint`, `npm run build`, and `npm run api` execute
- **THEN** all unit test suites, linter checks, release bundles, and API bundles succeed with 0 errors
