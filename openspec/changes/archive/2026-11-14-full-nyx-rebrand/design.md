# Architecture & Technical Design

## 1. Overview & Invariants
This design implements `REQ-BRAND-3`, `REQ-BRAND-5`, `REQ-BRAND-6`, `REQ-BRAND-7`, and the updated `REQ-POPUP-3` across 5 coordinated layers:
1. **Links & News Feed (`src/utils/links.ts`, `src/background/newsmaker.ts`, `docs/news.json`)**: Point all active URLs to `https://github.com/mgabs/nyx`, remove `UNINSTALL_URL`/`TWITTER_URL`/`DONATE_URL`, and serve Nyx news & release logs from `docs/news.json`.
2. **Popup & UI (`src/ui/popup/`, `src/ui/options/`, `src/ui/devtools/`, `src/ui/assets/images/`, `src/background/index.ts`)**: Remove `DonateGroup` and `uiHighlights` `'anniversary'` usage from `NewBody`, replace `darkreader-type.svg` with `nyx-type.svg`, rename `darkreader-*` assets, update export filename to `Nyx-${url}.css`, update DevTools/compatibility/welcome text, and keep `LICENSE` MIT copyright intact.
3. **Locales (`src/_locales/`, `src/_locales/store/`)**: Replace Dark Reader brand strings with Nyx across all 42 locales and store descriptions.
4. **Standalone API (`src/api/`, `tasks/bundle-api.js`, `tasks/code-style.js`, `tasks/dependencies.js`, `package.json`, `Makefile`, `tests/perf/runner.js`)**: Emit `nyx.js` (UMD global `Nyx`) and `nyx.mjs` (ESM), updating `package.json` `main`/`module`/`lint:bundle` and perf benchmark loader.
5. **Internal CSS/DOM Tokens (`src/inject/`, `src/config/`, `tests/`)**: Mechanically rename `--darkreader-*` -> `--nyx-*`, `.darkreader` -> `.nyx`, `data-darkreader-*` -> `data-nyx-*`, while matching **both** `meta[name="nyx-lock"]` and `meta[name="darkreader-lock"]`.

**Key Invariants:**
- Every `--darkreader-*` / `.darkreader` reference in `src/config/*.config` and `src/inject/` MUST be renamed in lockstep so built-in site fixes keep matching injected CSS variables.
- `<meta name="nyx-lock">` and `<meta name="darkreader-lock">` MUST both disable page theming.
- `LICENSE` retains `Copyright (c) 2026 Dark Reader Ltd.` alongside `Copyright (c) 2026 Nyx Contributors.`.

## 2. Domain Models, State & Interface Contracts
- **`src/utils/links.ts`**:
  - `HOMEPAGE_URL = 'https://github.com/mgabs/nyx'`
  - `BLOG_URL = 'https://github.com/mgabs/nyx/wiki/'`
  - `NEWS_URL = 'https://raw.githubusercontent.com/mgabs/nyx/main/docs/news.json'`
  - `DEVTOOLS_DOCS_URL = 'https://github.com/mgabs/nyx/blob/main/CONTRIBUTING.md'`
  - `GITHUB_URL = 'https://github.com/mgabs/nyx'`
  - `HELP_URL = 'https://github.com/mgabs/nyx/wiki'`
  - `PRIVACY_URL = 'https://github.com/mgabs/nyx/blob/main/PRIVACY.md'` (or wiki/README anchor)
  - `MOBILE_URL = 'https://github.com/mgabs/nyx/wiki/Mobile'`
  - `CONFIG_URL_BASE = 'https://raw.githubusercontent.com/mgabs/nyx/main/src/config'`
  - `getBlogPostURL(postId: string)`: supports `release:<tag>` -> `https://github.com/mgabs/nyx/releases/tag/<tag>` or defaults to `${BLOG_URL}${postId}` (and `Newsmaker.getNews()` honors explicit `n.url` if provided in `docs/news.json`, falling back to `getBlogPostURL(n.id)`).
  - Removed exports: `DONATE_URL`, `TWITTER_URL`, `UNINSTALL_URL` (plus `chrome.runtime.setUninstallURL` call if present in `src/background/index.ts`).
- **Dual Lock Selector (`src/inject/`)**:
  - `meta[name="nyx-lock"], meta[name="darkreader-lock"]` checked wherever lock meta is queried/observed.
- **Standalone API**:
  - `tasks/bundle-api.js`: `bundleAPIModule(..., 'umd', 'nyx.js')`, `bundleAPIModule(..., 'esm', 'nyx.mjs')` with UMD name `Nyx`.
  - `package.json`: `"main": "nyx.js"`, `"module": "nyx.mjs"`.

## 3. Architecture Diagram & Data Flow

```mermaid
flowchart LR
    Feed["docs/news.json (mgabs/nyx main)"] -->|fetch NEWS_URL| NM["Newsmaker (background)"]
    NM -->|News[] + wiki/release URLs| Popup["Popup NewBody (nyx-type.svg, no DonateGroup)"]
    Popup -->|Export CSS| File["Nyx-host.css"]
    Inject["Dynamic Theme Engine (--nyx-*, data-nyx-*, .nyx)"] -->|reads| Config["src/config/*.config (--nyx-*)"]
    Inject -->|checks| Lock["meta[name='nyx-lock'] OR meta[name='darkreader-lock']"]
```

## 4. Boundary Rules & Budgets
- **Pure Core vs. I/O Shell**:
  - Pure core (`src/generators/`, `src/utils/links.ts` URL builders, CSS token generation) performs no network/storage I/O.
  - I/O shell (`Newsmaker.getNews()` `fetch`, `chrome.storage`, `chrome.tabs`) isolates network/browser calls.
- **Concurrency, Latency & Resource Budgets**:
  - Popup render and `PageViewer` transitions remain within the existing `<= 16ms` frame budget (`NFR-POPUP-1`), aided by removing `DonateGroup`.
  - `Newsmaker.updateNews()` remains non-blocking on extension startup (`StateManager.loadState()` before `saveState()`).

## 5. Testing Strategy
1. **BDD Scenarios**:
   - Popup renders `m-logo` without `.m-donate-group`; `tests/browser/e2e/news.tests.ts` and `tests/browser/e2e/export.tests.ts` pass on MV2, MV3, and Firefox.
   - `tests/inject/` dynamic theme and `tests/inject/dynamic/fixes.tests.ts` verify `--nyx-*`, `data-nyx-*`, `.nyx`, and both `nyx-lock` + `darkreader-lock` opt-out.
2. **Unit Tests (`>= 95%` on modified modules)**:
   - Update `tests/unit/brand/brand.tests.ts` (and add unit coverage for `links.ts` / `getBlogPostURL` / `Newsmaker` feed parsing).
   - Run `npm test`, `npm run lint`, `npm run test:inject`, `npm run test:browser`, `npm run build`, `npm run api`.
3. **Verification Audit**:
   - Confirm `rg -i "dark\s*reader" src/ _locales/` returns zero unintended matches (only `darkreader-lock` dual support and MIT attribution).

## Review Gate
- [x] **Gate 2 Approval**: Architecture & design reviewed and approved by human before task breakdown.
