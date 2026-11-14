# Proposal

## Intent
Eliminate `Uncaught (in promise) Error: Could not establish connection. Receiving end does not exist.` rejections in MV3/MV2/Firefox extension messaging and stop attempting script injection into `about:blank` frames.

## Problem Statement
1. Fire-and-forget `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage` calls in `Messenger.reportChanges`, `Connector`, `TabManager.sendDocumentMessage`, `bgFetch`, and debug reload handlers leave rejected Promises unhandled when the receiving context is closed or unavailable.
2. `"match_about_blank": true` in manifests and `TabManager.updateContentScript` causes Chrome to log `Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`

## Capabilities

### New Capabilities
- `messaging`: Safe cross-context extension messaging (`?.catch?.(...)` handling on fire-and-forget sends, clean `bgFetch` rejection on disconnected runtime, and `match_about_blank: false`).

### Modified Capabilities
- None.

## Scope

### In-Scope
- Guard `chrome.runtime.sendMessage` with `?.catch?.(() => { /* noop */ })` in `src/background/messenger.ts`, `src/ui/connect/connector.ts`, and `src/background/index.ts`.
- Guard `chrome.tabs.sendMessage` with `?.catch?.(() => { /* noop */ })` in `src/background/tab-manager.ts` (MV2 & Firefox branches) and `src/background/index.ts`.
- Guard `chrome.runtime.sendMessage` in `src/inject/dynamic-theme/network.ts:bgFetch` so a rejected Promise cleans up `resolvers`/`rejectors` maps and rejects `bgFetch` instead of hanging.
- Set `"match_about_blank": false` in `src/manifest-chrome-mv3.json`, `src/manifest.json`, `src/manifest-firefox.json`, and `matchAboutBlank: false` in `src/background/tab-manager.ts`.
- Unit tests covering disconnected `Messenger.reportChanges`, `Connector`, `bgFetch` rejection cleanup, and manifest `match_about_blank: false`.

### Out-of-Scope (YAGNI)
- Adding retry queues or persistent port connections for fire-and-forget UI/background broadcasts.
- Changing `src/inject/index.ts` or `src/inject/color-scheme-watcher.ts` (which already catch `sendMessage` promises).

## Assumptions
- **ASM-GEN-1**: `?.catch?.(...)` works identically whether `sendMessage` returns a `Promise` (MV3 / WebExtension polyfill) or `undefined` (MV2 / Jest mock).

## Success Metrics
- Disconnected `Messenger.reportChanges`, `Connector` methods, and `bgFetch` produce zero unhandled promise rejections in unit tests.
- All extension manifests declare `match_about_blank: false`.
- `npm test`, `npm run lint`, `npm run build`, and `npm run test:chrome-mv3` pass with zero errors.

## Review Gate
- [x] **Gate 1 Approval**: Proposal reviewed and approved by human before drafting specs.
