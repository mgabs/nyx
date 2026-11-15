# Research & Technical Tradeoffs

## 1. Intent & Ground Truth
- **Goal**: Replace the Firefox MV2 build (`firefox`) with Firefox MV3 (keeping `thunderbird` on MV2), matching the Chrome MV3-only consolidation.
- **Verified codebase state**:
  - `tasks/platform.js` defines `PLATFORM.FIREFOX_MV2 = 'firefox'` and `PLATFORM.FIREFOX_MV3 = 'firefox-mv3'`, while `tasks/build.js` explicitly disables `PLATFORM.FIREFOX_MV3` (`Firefox MV3 build is not supported yet`).
  - `src/manifest-firefox.json` currently sets `manifest_version: 2`, `browser_action`, `background.page: "background/index.html"`, `permissions` containing `<all_urls>` and `tabs`, `strict_min_version: "78.0"`, and `content_scripts` with `world: "MAIN"` (`inject/fallback.js`) and `world: "ISOLATED"` (`inject/index.js`).
  - `tasks/bundle-js.js` rewrites `chrome.browserAction.*` -> `chrome.action.*` only for `CHROMIUM_MV3` / `CHROMIUM_MV3_PLUS`, and `tasks/bundle-html.js` emits `background/index.html` for `FIREFOX_MV2` and `THUNDERBIRD`.
  - `src/utils/platform.ts` sets `isNonPersistent = !__FIREFOX_MV2__ && !__THUNDERBIRD__ && (__CHROMIUM_MV3__ || isSafari)`.
  - `src/background/content-script-manager.ts`, `src/background/tab-manager.ts` (`registerDeclarativePrePaint`), `src/background/index.ts` (`keepListeningToEvents`), and `src/background/extension.ts` gate MV3 lifecycle/scripting behavior on `__CHROMIUM_MV3__`.
  - Gecko-specific runtime behavior (`cloneInto()` in `src/inject/index.ts`, `unwrap()` / `adoptedStyleSheets` handling in `src/inject/dynamic-theme/`, `firefoxPortListener` + `makeFirefoxHappy` in `src/background/messenger.ts`) is gated on `isFirefox` or `__FIREFOX_MV2__`.
- **Firefox MV3 platform facts**:
  - Firefox MV3 uses non-persistent Event Pages (`"background": {"scripts": ["background/index.js"]}`), not Chrome's `"service_worker"`.
  - `world: "MAIN"` in `manifest.content_scripts` and `scripting.registerContentScripts` requires Firefox 128+.
  - `browser.action` / `chrome.action` replaces `browser_action`; `<all_urls>` moves to `host_permissions`; `scripting` permission is required for `chrome.scripting`.
  - Chrome's `navigate-to` CSP directive is not supported in Firefox MV3 `content_security_policy.extension_pages`.

## 2. Options Explored
- **Option A — Replace `firefox` MV2 directly with Firefox MV3 (`strict_min_version: "128.0"`, event page `background.scripts`)**:
  - Rename/fold `PLATFORM.FIREFOX_MV3` -> `'firefox'`, drop `FIREFOX_MV2`, keep `THUNDERBIRD` on MV2.
  - Add `__FIREFOX_MV3__` (or unify Firefox flag + `isNonPersistent = !__THUNDERBIRD__`), generalize MV3 `scripting`/event-page guards (`isMV3` = `__CHROMIUM_MV3__ || __FIREFOX_MV3__`), and keep Gecko `isFirefox` (`cloneInto`, `unwrap`, `firefoxPortListener`) intact.
  - *Pros*: Single `firefox` artifact (`nyx-firefox.xpi`), matches Chrome MV3-only simplification, zero legacy MV2 Firefox maintenance.
  - *Cons*: Drops Firefox < 128; requires verifying event-page wakeup + Gecko Xray behavior in `test:firefox`.
- **Option B — Parallel `firefox` (MV2) + `firefox-mv3` targets**:
  - Keep `FIREFOX_MV2` as `'firefox'` and enable `FIREFOX_MV3` as `'firefox-mv3'` (`nyx-firefox-mv3.xpi`).
  - *Pros*: Reversible fallback on AMO if Firefox MV3 hits regressions.
  - *Cons*: Doubles Firefox build/test/release matrix; contradicts user's explicit choice to replace Firefox MV2.
- **Option C — Firefox MV3 with `strict_min_version: "109.0"` without `world: "MAIN"`**:
  - Support Firefox 109–127 by avoiding `world: "MAIN"` in `manifest-firefox.json` and `ContentScriptManager`.
  - *Pros*: Broader legacy Firefox compatibility.
  - *Cons*: Breaks `REQ-FOUC-1`/`REQ-FOUC-2` declarative `MAIN` world pre-paint/proxy parity and adds Firefox-specific injection divergence.

## 3. Tradeoff Matrix

| Criteria | Option A (Replace w/ MV3, 128+) | Option B (Parallel MV2 + MV3) | Option C (MV3 109+, no MAIN world) |
| :--- | :--- | :--- | :--- |
| **Complexity** | Low-Medium | Medium-High | Medium-High |
| **New Dependencies** | None | None | None |
| **Performance & Latency** | Preserves `MAIN` world pre-paint | Preserves on MV3 only | Regresses pre-paint parity |
| **Maintenance Burden** | Low (single Firefox target) | High (dual Firefox targets) | Medium (custom injection path) |
| **Blast Radius** | `src/manifest-firefox.json`, `tasks/`, MV3 guards in `src/`, `tests/browser/` | `tasks/`, CI, `tests/` | `src/inject/`, `ContentScriptManager`, `manifest-firefox.json` |

## 4. Recommendation
Adopt **Option A**: replace `firefox` (MV2) with Firefox MV3 (`strict_min_version: "128.0"`, `background.scripts`, `action`, `host_permissions`, `scripting`) while keeping `thunderbird` on MV2, and generalize `__CHROMIUM_MV3__` lifecycle/scripting gates to cover Firefox MV3 without altering Gecko `isFirefox` DOM/messaging workarounds.

## 5. Breaking Changes & Deprecations
- **Minimum Firefox version**: Bumps `strict_min_version` in `src/manifest-firefox.json` from `78.0` to `128.0`.
- **Spec impacts in `openspec/specs/`**:
  - `REQ-MSG-3` (`openspec/specs/messaging/spec.md`): `src/manifest-firefox.json` retains `match_about_blank: false` across all MV3 `content_scripts` entries (compatible, no deprecation).
  - `REQ-FOUC-2` (`openspec/specs/zero-fouc/spec.md`): extends declarative pre-paint / `chrome.scripting` registration to Firefox MV3 (additive/compatible).
  - `REQ-BRAND-1` / `REQ-BRAND-4` (`openspec/specs/rebrand/spec.md`): `src/manifest-firefox.json` switches from `browser_action` to `action` and outputs MV3 `nyx-firefox.xpi` (compatible).

## Review Gate
- [x] **Gate 0 Decision**: Human decides Go (name the option) or No-Go before the proposal is drafted. (Option A selected)
