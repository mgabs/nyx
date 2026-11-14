# Research & Technical Tradeoffs

## 1. Intent & Ground Truth
Two noisy extension runtime errors appear in Chrome MV3:
1. **`Uncaught (in promise) Error: Could not establish connection. Receiving end does not exist.`**:
   In Chrome MV3, `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage` return a Promise that rejects whenever no listener is active (e.g., popup/options closed, service worker unloaded, tab/frame navigated or closed). Four call paths lack `.catch(...)`:
   - [src/background/messenger.ts:156](file:///Users/mmetawea/Workbench/nyx/src/background/messenger.ts#L156): `Messenger.reportChanges` sends `CHANGES` to UI when `changeListenerCount > 0` without `.catch`.
   - [src/ui/connect/connector.ts:71-139](file:///Users/mmetawea/Workbench/nyx/src/ui/connect/connector.ts#L71-L139): 10 fire-and-forget `chrome.runtime.sendMessage` calls without `.catch`.
   - [src/background/tab-manager.ts:328-331](file:///Users/mmetawea/Workbench/nyx/src/background/tab-manager.ts#L328-L331): MV2/Firefox `chrome.tabs.sendMessage` paths lack `.catch` (MV3 lines 320–324 already catch).
   - [src/inject/dynamic-theme/network.ts:28](file:///Users/mmetawea/Workbench/nyx/src/inject/dynamic-theme/network.ts#L28) (`bgFetch` hangs forever + unhandled rejection if `sendMessage` rejects) and [src/background/index.ts:98-114](file:///Users/mmetawea/Workbench/nyx/src/background/index.ts#L98-L114) (debug reload broadcasts).
2. **`Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`**:
   Triggered when content scripts with `"match_about_blank": true` ([manifest-chrome-mv3.json:31,44](file:///Users/mmetawea/Workbench/nyx/src/manifest-chrome-mv3.json#L31-L44), [manifest.json:36](file:///Users/mmetawea/Workbench/nyx/src/manifest.json#L36), [manifest-firefox.json:22,34](file:///Users/mmetawea/Workbench/nyx/src/manifest-firefox.json#L22-L34), [tab-manager.ts:460](file:///Users/mmetawea/Workbench/nyx/src/background/tab-manager.ts#L460)) attempt injection into sandboxed `about:blank` iframes.

Note: In MV2 and Jest unit mocks, `chrome.runtime.sendMessage` may return `undefined` instead of a `Promise`, so optional chaining (`?.catch?.(...)`) is required.

## 2. Options Explored
1. **Option A — Messaging `.catch()` only**: Fix all 4 uncaught `sendMessage` paths while keeping `match_about_blank: true`.
2. **Option B — Safe messaging `.catch()` + disable `match_about_blank` across manifests and `TabManager`**: Eliminate both the unhandled Promise rejections and Chrome's sandboxed `about:blank` injection attempts.
3. **Option C — Global `unhandledrejection` listener**: Suppresses symptoms rather than fixing call sites and breaks `bgFetch` error propagation.

## 3. Tradeoff Matrix

| Criteria | Option A (Messaging only) | Option B (Messaging + `about:blank` off) | Option C (Global handler) |
| :--- | :--- | :--- | :--- |
| **Complexity** | Low | Low | Low |
| **New Dependencies** | None | None | None |
| **Performance & Latency** | Neutral | Slightly less work on `about:blank` frames | Neutral |
| **Maintenance Burden** | Low | Low | Masks real bugs |
| **Blast Radius** | 5 TS files | 5 TS files + 3 manifests | Global |

## 4. Recommendation
Adopt **Option B**: guard all fire-and-forget `sendMessage` calls with `?.catch?.(...)` (and reject cleanly in `network.ts:bgFetch`), and set `match_about_blank: false` / `matchAboutBlank: false` so Nyx does not attempt injection into `about:blank` frames.

## 5. Breaking Changes & Deprecations
None (new `messaging` spec capability).

## Review Gate
- [x] **Gate 0 Decision**: Human decides Go (Option B) before the proposal is drafted.
