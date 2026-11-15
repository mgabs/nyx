# Proposal

## Intent
Replace the Firefox Manifest V2 target with a Manifest V3 (`firefox`) target using non-persistent event pages, `action`, `host_permissions`, and `chrome.scripting`, bringing Firefox to parity with Chrome MV3 while keeping `thunderbird` on MV2.

## Problem Statement
Chrome has already been consolidated to MV3-only, leaving Firefox as the last browser target on MV2 (`PLATFORM.FIREFOX_MV2`, `background/index.html`, `browser_action`, `<all_urls>` in `permissions`). `PLATFORM.FIREFOX_MV3` in `tasks/platform.js` is currently disabled in `tasks/build.js`, and MV3 lifecycle/scripting guards in `src/` are hardcoded to `__CHROMIUM_MV3__`.

## Capabilities

### New Capabilities
- `firefox-mv3`: Firefox Manifest V3 manifest, build target consolidation, and non-persistent event-page / `scripting` runtime parity.

### Modified Capabilities
- `zero-fouc`: Extend declarative pre-paint / `chrome.scripting` registration from Chromium MV3 to Firefox MV3.

## Scope

### In-Scope
- Replace `PLATFORM.FIREFOX_MV2` with `PLATFORM.FIREFOX_MV3` mapped to `'firefox'` (`build/release/firefox`, `nyx-firefox.xpi`).
- Convert `src/manifest-firefox.json` to Manifest V3 (`manifest_version: 3`, `strict_min_version: "128.0"`, `background.scripts: ["background/index.js"]`, `action`, `host_permissions`, `scripting` permission, Firefox-compatible CSP).
- Update `tasks/` (`build.js`, `cli.js`, `bundle-html.js`, `bundle-js.js`, `bundle-manifest.js`) to emit MV3 JS/HTML/manifest for `firefox` while keeping `thunderbird` on MV2.
- Generalize MV3 non-persistent and `chrome.scripting` guards in `src/` (`isNonPersistent`, `ContentScriptManager`, `TabManager.registerDeclarativePrePaint`, `keepListeningToEvents`, `Extension.isFirstLoad`, and `__FIREFOX_MV2__`/`__FIREFOX_MV3__` injection/export checks) while preserving Gecko `isFirefox` (`cloneInto`, `unwrap`, `firefoxPortListener`).
- Update unit/browser test configs and brand/CSP/messaging unit tests for Firefox MV3.

### Out-of-Scope (YAGNI)
- Migrating `thunderbird` to MV3 (stays on MV2).
- Supporting Firefox < 128 (`world: "MAIN"` polyfills or legacy MV2 fallback builds).
- Refactoring Chrome MV3 or standalone API (`npm run api`) behavior.
- Adding new UI features or changing theme engine algorithms.

## Assumptions
- **ASM-GEN-1**: Firefox 128+ is the minimum supported version, providing native `world: "MAIN"` in `manifest.content_scripts` and `scripting.registerContentScripts`.
- **ASM-GEN-2**: Firefox MV3 event pages (`background.scripts`) support `chrome.storage.session` and `chrome.runtime.onInstalled` wakeup semantics compatible with `isNonPersistent`.

## Success Metrics
- `npm run build` produces `build/release/firefox/manifest.json` with `manifest_version: 3` and `nyx-firefox.xpi`, while `thunderbird` remains `manifest_version: 2`.
- `npm test`, `npm run lint`, and `npm run api` pass with 0 errors.
- `tests/unit/utils/messaging.tests.ts` and `tests/unit/brand/brand.tests.ts` pass against the updated `src/manifest-firefox.json`.

## Review Gate
- [x] **Gate 1 Approval**: Proposal reviewed and approved by human before drafting specs.
