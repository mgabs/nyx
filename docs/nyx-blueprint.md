# Nyx Blueprint

## System Overview
Nyx (Dark Reader) is a browser extension and standalone page-theming library that analyzes web pages and applies dark/dimmed themes via five engines (`dynamicTheme`, `leanDynamicTheme`, `cssFilter`, `svgFilter`, `staticTheme`) across Chromium MV2/MV3, Firefox, Safari, Edge, and Thunderbird targets.

## Global Invariants
- **Compile-time flags & Plus aliasing**: `tasks/bundle-js.js` injects `__PLUS__`, `__CHROMIUM_MV2__`, `__CHROMIUM_MV3__`, `__FIREFOX_MV2__`, `__THUNDERBIRD__`, `__PORT__`, `__DEBUG__`, `__WATCH__`, `__TEST__`, and `__LOG__`, and aliases `@plus/*` to `./plus/*` (Plus builds) or `./stubs/*` (non-Plus builds). `src/stubs/` must mirror all `@plus/*` exports.
- **ESLint import boundaries**: `eslint-plugin-local.js` (`no-restricted-paths`) enforces subsystem import boundaries across `src/`.
- **Background readiness**: `Extension.init` (`src/background/extension.ts`) is idempotent; callers await `Extension.waitUntilReady()`. UI/content-script mutations are gated by `UserStorage.loadSettings` (`PromiseBarrier`) and `Messenger` origin checks (`/ui/*/index.html` or `${HOMEPAGE_URL}/activate/`).
- **Content-script scoping**: `src/inject/index.ts` scopes background messages by generated `scriptId` (except `EXPORT_CSS`) and retries `DOCUMENT_CONNECT` up to 10 times (`1000ms`). `dynamic-theme` yields to pages declaring `meta[name="darkreader-lock"]`.
- **Release build guards**: `codeStyleTask`, `zipTask`, and `signatureTask` reject `debug` builds; `cli.js` requires a clean git tree before checking out release tags for signed builds.

## Global Side Effects
- **Extension runtime**: mutates `chrome.storage.{local,sync,session}`, `chrome.alarms`, `chrome.commands`, `chrome.contextMenus`, `chrome.scripting`/`chrome.tabs`, and browser action icons/badges; fetches remote configs/news over HTTP.
- **Page DOM/CSSOM**: mutates `#dark-reader-style`, `#dark-reader-svg`, `.darkreader--fallback`, `data-darkreader-mode`, adopted stylesheets, inline styles, and `sessionStorage` (`__darkreader__*`).
- **Standalone API (`src/api`)**: shims `window.chrome.runtime` for `FETCH` messaging and mutates page `<style>` nodes.
- **Build tasks (`tasks/`)**: writes `build/{debug,release}/<platform>/`, release `.zip`/`.xpi`, and root `darkreader.js`/`darkreader.mjs`; dev mode opens WebSockets on `PORT 8890` (`reload.js`) and `PORT 9000` (`log.js`).

## Verification
- Run: `npm test`

---

## Subsystem Map

### `src/` (Core Defaults & Types)
- `defaults.ts`: `DEFAULT_COLORS`, `DEFAULT_THEME`, `DEFAULT_COLORSCHEME`, `DEFAULT_SETTINGS`. Calls `extendThemeDefaults` from `@plus/defaults` when `__PLUS__` is true. `styleSystemControls` is `false` under `__CHROMIUM_MV3__` and `!isCSSColorSchemePropSupported` otherwise.
- `definitions.d.ts`: shared domain, messaging, theme, settings, and site-fix types (`Theme`, `UserSettings`, `ExtensionData`, `Message*`, `DynamicThemeFix`, `InversionFix`, `DetectorHint`, `StaticTheme`, etc.).
- `index.d.ts`: ambient `DarkReader` namespace for the standalone API.

### `src/api/` (Standalone Library)
- Browser-page bundle exposing `enable`, `disable`, `auto`, `isEnabled`, `setFetchMethod`, and `exportGeneratedCSS`.
- Shims `chrome.runtime` messaging to route fetch requests through a user-configured fetcher.

### `src/background/` (+ `utils/`)
- `extension.ts` (`Extension`): core orchestrator (`start()`, `collectData()`, `collectDevToolsData()`, `changeSettings()`).
- `config-manager.ts` (`ConfigManager`): loads, indexes, and queries `darkSites`, `detectorHints`, `dynamicThemeFixes`, `inversionFixes`, `staticThemes`, and `colorSchemes`.
- `tab-manager.ts` (`TabManager`): tracks frames by `(tabId, frameId)` (plus `documentId` for MV3 prerender), routes CS-to-BG messages/fetches (`FETCH` is state-independent), and broadcasts theme updates.
- `content-script-manager.ts`: MV3 dynamic content script registration.
- `user-storage.ts` (`UserStorage`): persists/migrates `UserSettings` in `chrome.storage.{local,sync}`.
- `messenger.ts` (`Messenger`, `ExtensionAdapter`): routes UI-to-BG messages and Firefox ports.
- `devtools.ts`, `icon-manager.ts`, `newsmaker.ts`, `ui-highlights.ts`, `window-theme.ts`, `make-{chromium,firefox}-happy.ts`: DevTools fix overrides, toolbar icon/badge, news polling, UI highlights, Firefox `browser.theme`, and browser messaging workarounds.
- `utils/`: storage, network, logging, tab, and script-injection helpers.

### `src/generators/` (+ `utils/`)
Pure CSS/config generation and parsing (no DOM, storage, or network side effects; uses `WeakMap` cache in `utils/parse.ts`):
- `theme-engines.ts`: `ThemeEngine` enum (`cssFilter`, `svgFilter`, `staticTheme`, `dynamicTheme`, `leanDynamicTheme`).
- `css-filter.ts`, `svg-filter.ts`, `static-theme.ts`, `dynamic-theme.ts`, `detector-hints.ts`, `text-style.ts`: stylesheet generators and site-fix parsers/formatters. Merging always combines wildcard `*` common entries with the longest matching URL pattern.
- `utils/`: site-fix parsing/formatting/indexing and 5x5 color matrix math.

### `src/inject/` (+ `dynamic-theme/`, `lean-theme/`, `utils/`)
- `index.ts`: content-script entrypoint handling `DOCUMENT_CONNECT`, theme application, `EXPORT_CSS`, `CLEAN_UP`, and `pagehide`/`freeze`/`resume`.
- `fallback.ts`: pre-paint `.darkreader--fallback` injector when `prefers-color-scheme: dark` matches and `wasEnabledForHost() !== false`.
- `detector.ts`: heuristic + hint-based dark-theme detector (temporarily disables Dark Reader sheets while sampling computed colors).
- `color-scheme-watcher.ts`, `style.ts`, `svg-filter.ts`, `cache.ts`: system scheme watching, `#dark-reader-style` / `#dark-reader-svg` management, and `sessionStorage` caching.
- `dynamic-theme/` (+ `watch/`): real-time page analyzer/rewriter for stylesheets, `adoptedStyleSheets` (`adopted-style-manger.ts`), CSS custom properties (`variables.ts`, `palette.ts`), inline styles (`inline-style.ts`), SVG/images, `<meta name="theme-color">`, and color modification (`modify-colors.ts`, `modify-css.ts`).
- `lean-theme/`: low-overhead `leanDynamicTheme` engine (`adopted-emitter.ts`, `style-manager.ts`, `inline-style.ts`, `index.ts`) targeting Chrome 119+ and Firefox 128+. Emits styles solely via `Document.adoptedStyleSheets` and open `ShadowRoot.adoptedStyleSheets` (`replaceSync()`), uses an isolated `VariablesStore` with microtask/rAF-coalesced `MutationObserver` batching, shares a bounded `ModifiableCSSRule` cache across SPA navigations, and decouples `image.ts` (`<canvas>` image analysis skipped).
- `utils/`: DOM, shadow-root, and logging helpers.

### `src/stubs/` (+ `dynamic/`, `popup/`, `utils/`)
- No-op/fallback stubs for `@plus/*` aliases (`defaults.ts`, `dynamic/inject`, `popup/plus-body`, `utils/theme`) so non-Plus builds typecheck cleanly.

### `src/ui/`
Malevic-based extension UI pages and shared components (`utils.ts` handles `openExtensionPage`, `openFile`, `saveFile`, `getFontList`, `createSwipeHandler`):
- `connect/`: UI-to-background messaging bridge (`Connector`) and mock data.
- `controls/`: shared Malevic controls (`Button`, `CheckBox`, `CheckButton`, `ColorDropdown`, `ColorPicker`, `ControlGroup`, `DropDown`, `MessageBox`, `MultiSwitch`, `NavButton`, `Overlay`, `ResetButton`, `Select`, `Shortcut`, `Slider`, `TabPanel`, `TextList`, `TextBox`, `TimeRangePicker`, `Toggle`, `UpDown`, `VirtualScroll`).
- `icons/`: stateless SVG icon components (`SunMoonIcon`, `WatchIcon`, `SystemIcon`, etc.).
- `popup/`: browser action popup (`body/`, `components/` classic UI, `main-page/`, `news-section/`, `page-viewer/`, `theme/`, `utils/`, `compatibility.js`). Supports classic, new (`previewNewDesign`), and Plus (`initAltUI`) layouts.
- `options/`: tabbed settings page (`about/`, `activation/`, `advanced/`, `automation/`, `body/`, `general/`, `hotkeys/`, `site-list/`, `tab-panel/`).
- `devtools/`: DevTools config editor page (`components/`).
- `stylesheet-editor/`: standalone CSS/stylesheet editor page (`components/`).

### `src/utils/` (+ `css-text/`)
Cross-context utilities:
- `color.ts` (parsing, sRGB/HSL conversion, LRU cache), `colorscheme-parser.ts`, `url.ts` (`URLTrie`, `URLTemplateIndex`, `parsedURLCache`), `validation.ts`, `state-manager.ts`, `message.ts` (all `MessageType*` enums), `platform.ts`, `network.ts` (`shouldIgnoreCors`), `tabs.ts`, `time.ts` (solar/interval scheduling), `throttle.ts` / `async-queue.ts` / `debounce.ts` / `promise-barrier.ts`, `text.ts`, `array.ts`, `cache.ts`, `automation.ts`, `csp.ts`, `math.ts` / `math-eval.ts`, `media-query.ts`, `locales.ts`, `uid.ts`, `visibility.ts`, `links.ts`, and `css-text/` (CSS text parsing/formatting).

### `tasks/` (Build & Maintenance)
- `cli.js`, `build.js`, `task.js`: CLI orchestration (`chrome`, `chrome-mv3`, `chrome-plus`, `chrome-mv3-plus`, `firefox`, `thunderbird`, `api`).
- `bundle-{api,css,html,js,locales,manifest,signature}.js`, `copy.js`, `clean.js`, `code-style.js`, `zip.js`: Rollup/asset bundling, deterministic zipping (sorted paths, `0o644`, git commit mtime), and Firefox signing.
- `reload.js`, `log.js`, `watch.js`: dev WebSocket servers (`8890`, `9000`) and `chokidar` watchers.
- `check-exists.js`, `deno.js`, `dependencies.js`, `integrity.js`, `ping.js`, `translate.js`, `platform.js`, `paths.js`, `utils.js`: maintenance & config scripts.
