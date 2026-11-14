# Proposal

## Intent
Complete the Nyx rebrand across all user-facing UI, notifications/news feeds, external links, locales, assets, standalone API bundles, and internal CSS/DOM tokens so zero Dark Reader branding remains in the shipped extension, API, or tests.

## Problem Statement
Prior rebrand work (`rebrand` spec) only updated manifests, Settings/DevTools headers, and release package IDs. Popup UI still renders the `Dark Reader` wordmark and a `"Pay for using Dark Reader"` donation banner, `Newsmaker` still polls `darkreader.org/blog/posts.json`, external links/support email still point to `darkreader.org`, all 42 `_locales/` still reference Dark Reader, and internal CSS/DOM/API tokens (`--darkreader-*`, `data-darkreader-*`, `darkreader-lock`, `darkreader.js`) expose upstream branding.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `rebrand`: Expand `REQ-BRAND-3` to cover popup UI (`m-logo` wordmark, export filename, `compatibility.js`), `Newsmaker` feed/wiki links, external links (`src/utils/links.ts`), all 42 `_locales/`, background banner, standalone API (`nyx.js`/`nyx.mjs`), and internal CSS/DOM tokens (`--nyx-*`, `.nyx`, `data-nyx-*`, plus `nyx-lock` alongside `darkreader-lock`) while preserving MIT license attribution in `LICENSE`.
- `popup-ui`: Update `REQ-POPUP-3` to remove `DonateGroup` (`uiHighlights: ['anniversary']`) from `NewBody`.

## Scope

### In-Scope
- **Popup & UI:** Remove `DonateGroup` and `uiHighlights` `'anniversary'` banner from `src/ui/popup/body/index.tsx` and related styles/background state; replace `darkreader-type.svg` / `m-logo` text with a Nyx SVG wordmark; rename `darkreader-*` image assets (`nyx-type.svg`, `nyx-icon-256x256.png`, `nyx-thumb-up.svg`); rename theme export filename to `Nyx-${url}.css`; rebrand `src/ui/popup/compatibility.js`, `src/background/index.ts` welcome banner, and `src/ui/options/` / `src/ui/devtools/` remaining strings.
- **News & Release Logs:** Replace `NEWS_URL` and `BLOG_URL` with `mgabs/nyx` (`docs/news.json` tracked in repo + `https://github.com/mgabs/nyx/wiki/` / releases links) so `Newsmaker` delivers Nyx news and release logs.
- **External Links:** Point `HOMEPAGE_URL`, `HELP_URL`, `PRIVACY_URL`, `MOBILE_URL`, and `CONFIG_URL_BASE` in `src/utils/links.ts` to `https://github.com/mgabs/nyx` (wiki/README/raw config); remove `UNINSTALL_URL`, `TWITTER_URL` (`@darkreaderapp`), `DONATE_URL`, and `support@darkreader.org`.
- **Locales:** Rebrand all 42 `src/_locales/*/messages.json` and 42 `src/_locales/store/*` files from Dark Reader to Nyx.
- **API & Internal Tokens:** Rename standalone API build targets and exports (`darkreader.js`/`darkreader.mjs` -> `nyx.js`/`nyx.mjs`, global `DarkReader` -> `Nyx`, `package.json` `main`/`module`/`api` references); rename internal `--darkreader-*`, `.darkreader`, and `data-darkreader-*` -> `--nyx-*`, `.nyx`, and `data-nyx-*` across `src/inject/`, `src/config/`, `tasks/`, and `tests/`; support both `meta[name="nyx-lock"]` and `meta[name="darkreader-lock"]`.

### Out-of-Scope (YAGNI)
- Altering upstream copyright notices in `LICENSE` (`Copyright (c) 2026 Dark Reader Ltd.` stays intact).
- Removing `__PLUS__` or `__THUNDERBIRD__` compile-time flags or `src/stubs/`.
- Changing dynamic theme inversion algorithms, CSS engine logic, or zero-FOUC behavior unrelated to token/brand renaming.
- Modifying historical archived OpenSpec specs/changes or `git` commit history.

## Assumptions
- **ASM-GEN-1**: Recognizing both `<meta name="nyx-lock">` and `<meta name="darkreader-lock">` preserves dark-mode opt-out compatibility for existing websites while introducing the `nyx-lock` meta tag.
- **ASM-GEN-2**: `docs/news.json` in `mgabs/nyx` `main` will be maintained with `Newsmaker`'s expected JSON schema (`[{id, date, headline, badge?}]`) pointing to `github.com/mgabs/nyx/wiki/` or release entries.
- **ASM-GEN-3**: Updating `--darkreader-*` / `.darkreader` tokens mechanically across `src/config/*.config` and `src/inject/` keeps built-in site fixes aligned with the renamed engine tokens.

## Success Metrics
- `rg -i "dark\s*reader" src/ _locales/` returns 0 matches outside `LICENSE`/`author` attribution and the intentional `darkreader-lock` meta tag check.
- `npm test`, `npm run lint`, `npm run test:inject`, `npm run test:browser` (MV2, MV3, Firefox), `npm run build`, and `npm run api` all pass with 0 errors.
- `nyx.js` and `nyx.mjs` are emitted cleanly by `npm run api`, and popup renders without `DonateGroup` and with the Nyx wordmark.

## Review Gate
- [x] **Gate 1 Approval**: Proposal reviewed and approved by human before drafting specs.
