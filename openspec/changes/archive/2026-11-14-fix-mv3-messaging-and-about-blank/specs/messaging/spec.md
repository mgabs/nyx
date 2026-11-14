# Spec Delta: messaging

## Purpose
Ensures cross-context extension messaging handles disconnected receivers without unhandled promise rejections and avoids injecting content scripts into `about:blank` frames.

## ADDED Requirements

### Requirement: REQ-MSG-1 Safe Fire-and-Forget Extension Messaging
Fire-and-forget `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage` calls in `Messenger.reportChanges`, `Connector`, `TabManager.sendDocumentMessage`, and `src/background/index.ts` MUST safely handle both rejected Promises (MV3/Firefox) and `undefined` return values (MV2/mocks) using optional `.catch?.()` without emitting unhandled promise rejections.

#### Scenario: Reporting changes when no UI listener is active
- **GIVEN** `Messenger.changeListenerCount > 0` and `chrome.runtime.sendMessage` returns a rejected Promise (`Receiving end does not exist`)
- **WHEN** `Messenger.reportChanges(data)` executes
- **THEN** the rejection is caught silently and no unhandled rejection occurs

#### Scenario: Sending fire-and-forget UI action while service worker is unavailable
- **GIVEN** `chrome.runtime.sendMessage` returns a rejected Promise or `undefined`
- **WHEN** `Connector` sends `changeSettings`, `setTheme`, `toggleActiveTab`, `subscribeToChanges`, or `disconnect`
- **THEN** no unhandled promise rejection is thrown

### Requirement: REQ-MSG-2 Clean bgFetch Rejection on Disconnected Runtime
`bgFetch` (`src/inject/dynamic-theme/network.ts`) MUST catch a rejected `chrome.runtime.sendMessage` Promise, delete the pending `id` entries from `resolvers` and `rejectors`, and reject the returned `bgFetch` Promise cleanly.

#### Scenario: Background receiver disconnects during bgFetch
- **GIVEN** `chrome.runtime.sendMessage` rejects with `Could not establish connection`
- **WHEN** `bgFetch(request)` runs
- **THEN** `bgFetch` rejects with that error rather than hanging or causing an unhandled rejection

### Requirement: REQ-MSG-3 Disable about:blank Content Script Injection
Extension manifests (`src/manifest.json`, `src/manifest-chrome-mv3.json`, `src/manifest-firefox.json`) MUST set `"match_about_blank": false` and `TabManager.updateContentScript` MUST set `matchAboutBlank: false` so Nyx does not attempt script injection into sandboxed `about:blank` frames.

#### Scenario: Inspecting content script manifest declarations
- **GIVEN** any manifest content script entry
- **WHEN** inspecting `"match_about_blank"`
- **THEN** it is `false`

### Requirement: NFR-MSG-1 Zero Overhead on Happy-Path Messaging
Guarding `sendMessage` with `?.catch?.(...)` MUST NOT introduce extra IPC round-trips or timers.

#### Scenario: Normal message delivery
- **GIVEN** an active receiver returning a resolved Promise
- **WHEN** `sendMessage` executes
- **THEN** it executes a single IPC call with zero added delay
