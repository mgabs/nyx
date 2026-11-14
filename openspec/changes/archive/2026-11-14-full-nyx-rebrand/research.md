# Research & Technical Tradeoffs

## 1. Intent & Ground Truth
- **Goal:** Complete the Nyx rebrand everywhere in `src/`, `_locales/`, `tasks/`, `config/`, and `tests/`, removing remaining Dark Reader branding from popup UI, notifications/news, links, locales, assets, standalone API, and internal CSS/DOM tokens.
- **Verified codebase inventory (`rg -i "dark\s*reader" src/`):** 2,187 matches across 137 files:
  - **Popup & UI:** `src/ui/popup/body/index.tsx` renders `m-logo` (`darkreader-type.svg` + `"Dark Reader"` text) and `DonateGroup` (`uiHighlights.includes('anniversary')` -> `"Pay for using Dark Reader"` -> `darkreader.org/support-us/`). `src/ui/popup/theme/controls/export-theme.tsx` exports `DarkReader-${url}.css`. `src/ui/popup/compatibility.js` links to old Dark Reader. `src/ui/options/` and `src/ui/devtools/components/config-editor.tsx` retain `darkreader-version`, `darkreader-thumb-up.svg`, and `support@darkreader.org`.
  - **News & Notifications:** `src/background/newsmaker.ts` fetches `NEWS_URL` (`https://darkreader.org/blog/posts.json`) and builds links via `getBlogPostURL(id)` (`BLOG_URL`). `src/ui/popup/news-section/index.tsx` auto-expands unread news after 750 ms; `IconManager` displays unread badges.
  - **External Links (`src/utils/links.ts`):** `HOMEPAGE_URL`, `BLOG_URL`, `NEWS_URL`, `DONATE_URL`, `MOBILE_URL`, `PRIVACY_URL`, `TWITTER_URL`, `UNINSTALL_URL`, `HELP_URL`, and `CONFIG_URL_BASE` all point to `darkreader.org`, `@darkreaderapp`, or `darkreader/darkreader`.
  - **Locales & Assets:** 42 locale directories (`src/_locales/`) and 42 store descriptions (`src/_locales/store/`) contain Dark Reader strings; `src/ui/assets/images/` contains `darkreader-type.svg`, `darkreader-icon-256x256.png`, `darkreader-thumb-up.svg`.
  - **Internal CSS/DOM & API:** `src/inject/` and `src/config/` (1,427 matches across `dynamic-theme-fixes.config`, `inversion-fixes.config`, `static-themes.config`) and `tests/` (88 matches) use `--darkreader-*`, `.darkreader`, `data-darkreader-*`, and `meta[name="darkreader-lock"]`. Standalone API bundles `darkreader.js` / `darkreader.mjs`.
  - **Existing Specs (`openspec/specs/`):** `rebrand` (`REQ-BRAND-1..4`) previously scoped only manifests, Options/DevTools headers, and release IDs while keeping internal CSS vars; `popup-ui` (`REQ-POPUP-1..4`) governs `NewBody` structure.

## 2. Options Explored
- **Option A — Surface-only UI/Links Rebrand:** Rebrand popup logo, drop `DonateGroup`, point `NEWS_URL`/links to `mgabs/nyx`, update `_locales/`, keep `--darkreader-*` CSS tokens and `darkreader.js` API names.
  - *Pros:* Smallest diff; preserves upstream site-fix compatibility and `meta[name="darkreader-lock"]` on third-party sites.
  - *Cons:* Leaves `darkreader` in exported/inspected DOM attributes, CSS variables, and standalone API bundles.
- **Option B — Full Rebrand (UI, Links, Locales, API, and Internal CSS/DOM Tokens):** Execute Option A plus rename `darkreader.js`/`darkreader.mjs` -> `nyx.js`/`nyx.mjs` (global `Nyx`), rename `--darkreader-*`/`.darkreader`/`data-darkreader-*` -> `--nyx-*`/`.nyx`/`data-nyx-*`, and replace `darkreader-lock` with `nyx-lock` (no fallback) across `src/inject/`, `src/config/`, `tasks/`, and `tests/`.
  - *Pros:* Zero `darkreader` branding anywhere in runtime DOM, styles, API, UI, locales, or config.
  - *Cons:* Large mechanical diff across 3 config files (1,427 matches) and 88 test occurrences; third-party pages using `<meta name="darkreader-lock">` without `nyx-lock` will no longer auto-opt-out; upstream config merges require token translation.
- **Option C — Full Rebrand with `darkreader-lock` Dual Support:** Same as Option B, except `meta[name="darkreader-lock"]` remains recognized alongside `meta[name="nyx-lock"]`.
  - *Pros:* Full Nyx DOM/API identity without breaking opt-out on existing dark-mode websites.
  - *Cons:* Retains one `darkreader-lock` string in `src/inject/`.

## 3. Tradeoff Matrix

| Criteria | Option A (Surface Only) | Option B (Full, No Fallback) | Option C (Full + Lock Fallback) |
| :--- | :--- | :--- | :--- |
| **Complexity** | Low | Medium-High (137 `src/` files + configs + tests) | Medium-High |
| **New Dependencies** | None | None | None |
| **Performance & Latency** | Neutral | Neutral | Neutral |
| **Maintenance Burden** | Low | High on upstream config syncs | High on upstream config syncs |
| **Blast Radius** | UI, locales, links | Entire extension, configs, API, inject tests | Entire extension, configs, API, inject tests |

## 4. Recommendation
Proceed with **Option C** (Full Rebrand + Lock Dual Support): drop `DonateGroup`, host `docs/news.json` in `mgabs/nyx` linking to wiki/releases, point all active links to `mgabs/nyx` (removing `UNINSTALL_URL`, `@darkreaderapp`, `support@darkreader.org`), rebrand all 42 `_locales`, rename API bundles to `nyx.js`/`nyx.mjs`, and rename internal `--darkreader-*`/`data-darkreader-*`/`.darkreader` tokens to `nyx` equivalents while recognizing both `meta[name="nyx-lock"]` and `meta[name="darkreader-lock"]` and preserving upstream MIT license attribution in `LICENSE`.

## 5. Breaking Changes & Deprecations
- **Modifies `REQ-BRAND-3` (`openspec/specs/rebrand/spec.md`):** Expands rebrand from Settings/DevTools headers to Popup UI, `Newsmaker` feed/links, all 42 `_locales/`, standalone API, and internal CSS/DOM variables/tokens (removing the prior "without renaming internal CSS variables" constraint).
- **Modifies `REQ-POPUP-3` (`openspec/specs/popup-ui/spec.md`):** Removes `DonateGroup` (`uiHighlights: ['anniversary']`) from `NewBody`.
- **Deprecates / Removes:** `UNINSTALL_URL`, `TWITTER_URL` (`@darkreaderapp`), and `DONATE_URL`.
- **Lock Meta Dual Support:** Recognizes both `<meta name="nyx-lock">` and `<meta name="darkreader-lock">` for third-party dark-mode opt-out.

## Review Gate
- [x] **Gate 0 Decision**: Human decides Go (Option C: Full Rebrand + Lock Dual Support) before the proposal is drafted.
