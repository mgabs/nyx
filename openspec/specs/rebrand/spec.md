# rebrand Specification

## Purpose
Establishes the Nyx fork identity across manifests and metadata while strictly preserving upstream MIT license attribution and copyright notices.

## Requirements

### Requirement: REQ-BRAND-1 Manifest & Extension Metadata Rebrand
The extension name, description, repository, and bundle configuration MUST identify as **Nyx** (*Instant Dark Mode for the Web. Zero White Flash.*).

#### Scenario: Manifest metadata inspection
- **WHEN** building production manifests via `tasks/bundle-manifest.js`
- **THEN** the extension `name` is output as `Nyx` and descriptions reflect zero-FOUC instant dark mode.

### Requirement: REQ-BRAND-2 MIT License Attribution Preservation
The project LICENSE MUST retain full upstream copyright notice (`Copyright (c) 2026 Dark Reader Ltd.`) alongside the Nyx contributors copyright notice.

#### Scenario: License compliance verification
- **WHEN** reviewing `LICENSE`
- **THEN** both original copyright and Nyx contributor notices are present and intact.

### Requirement: REQ-BRAND-3 Settings and Developer Tools Identity
The popup, Settings, and Developer Tools pages MUST identify as **Nyx**, including the popup `m-logo` SVG wordmark and link, `Nyx-${url}.css` theme export filename, `Nyx-Settings.json` settings export filename, compatibility warning text, background console welcome banner, Settings page title/wordmark, and Developer Tools page title/wordmark, without exposing Dark Reader support addresses or branding or the legacy paid-license `Activation` tab (`ActivationTab`, `startActivation`, `resetActivation`) while preserving upstream MIT attribution.

#### Scenario: Opening extension settings or developer tools
- **GIVEN** the extension is loaded in Chrome or Firefox
- **WHEN** a user opens the popup, Settings, or Developer Tools
- **THEN** the popup displays the Nyx wordmark linking to `mgabs/nyx`, Settings and Developer Tools titles and wordmarks identify Nyx, no `Activation` tab is shown in Settings, and no Dark Reader support email or branding appears

#### Scenario: Exporting a theme stylesheet from popup
- **GIVEN** the user opens the Theme tab in the popup
- **WHEN** the user exports the generated CSS
- **THEN** the downloaded file is named `Nyx-${url}.css`

#### Scenario: Exporting settings from Settings Advanced tab
- **GIVEN** the user opens Settings -> Advanced
- **WHEN** the user clicks Export Settings
- **THEN** the downloaded file is named `Nyx-Settings.json`

### Requirement: REQ-BRAND-4 Independent Release Packages
Release builds MUST use a Nyx-specific Mozilla extension ID and generate named Chrome MV3, Edge, Firefox, Thunderbird, and experimental unsigned Safari macOS packages. GitHub release publication MUST have explicit write permission and fail if an expected package is missing. Store signing and submission are separate from package generation.

#### Scenario: Tagged or manually dispatched release build
- **WHEN** the release workflow runs
- **THEN** web extension packages and an unsigned Safari macOS app and Xcode project are uploaded as artifacts, and a tag run publishes them to GitHub only after both build jobs succeed.

#### Scenario: Mozilla fork identity
- **WHEN** Firefox or Thunderbird manifests are built
- **THEN** their extension ID is `nyx@mgabs.github.io`, not the upstream Dark Reader ID.

### Requirement: REQ-BRAND-5 Nyx News Feed, Release Logs, and External Links
`Newsmaker` MUST fetch news and release log entries from `mgabs/nyx` (`docs/news.json` on `main`) and resolve post links to `https://github.com/mgabs/nyx/wiki/` or release notes; `src/utils/links.ts` MUST point `HOMEPAGE_URL`, `HELP_URL`, `PRIVACY_URL`, `MOBILE_URL`, and `CONFIG_URL_BASE` to `mgabs/nyx`, and MUST remove `UNINSTALL_URL`, `TWITTER_URL`, and `DONATE_URL`.

#### Scenario: Fetching Nyx news and release logs
- **GIVEN** `fetchNews` is enabled in user settings
- **WHEN** `Newsmaker.updateNews()` runs
- **THEN** it fetches `docs/news.json` from `mgabs/nyx` and builds post URLs pointing to `github.com/mgabs/nyx` wiki or release pages

#### Scenario: Fallback/error handling when news feed is unreachable
- **GIVEN** the remote `docs/news.json` endpoint fails or returns invalid JSON
- **WHEN** `Newsmaker.updateNews()` runs
- **THEN** it logs the error, returns `null`, and leaves existing extension functionality unaffected

### Requirement: REQ-BRAND-6 Full Locale, Asset, and Standalone API Rebrand
All 42 `src/_locales/*/messages.json` and `src/_locales/store/*` files MUST replace Dark Reader brand names with Nyx, UI and extension icon assets MUST use `nyx-*` / `nyx_*.png` filenames featuring Nyx's Obsidian/Silver/Amber Owl Badge (`nyx-type.svg` in `#f59e0b`, `nyx-icon-256x256.png`, `src/icons/nyx_16.png`, `nyx_48.png`, `nyx_128.png`, `nyx_active_19.png`, `nyx_active_38.png`, `nyx_active_light_19.png`, `nyx_active_light_38.png`) with zero legacy `dr_*.png` references in manifests or `IconManager`, and the standalone API build (`npm run api`) MUST emit `nyx.js` and `nyx.mjs` exposing the `Nyx` global and `package.json` `main`/`module` entrypoints.

#### Scenario: Building standalone API bundles
- **GIVEN** the repository build system
- **WHEN** `npm run api` executes
- **THEN** `nyx.js` (UMD exposing `Nyx`) and `nyx.mjs` (ESM) are generated cleanly and used by `tests/perf/runner.js`

#### Scenario: Inspecting localized UI and store descriptions
- **GIVEN** any of the 42 supported locales under `src/_locales/`
- **WHEN** searching localized messages and store descriptions for `"Dark Reader"`
- **THEN** zero user-facing `"Dark Reader"` brand strings remain

#### Scenario: Inspecting extension manifests and toolbar icons
- **GIVEN** `src/manifest.json`, `src/manifest-chrome-mv3.json`, `src/background/icon-manager.ts`, and `src/icons/`
- **WHEN** inspecting icon paths and files
- **THEN** all icons use `nyx_*.png` owl badge assets at matching pixel dimensions (`16`, `19`, `38`, `48`, `128`, `256`) and zero `dr_*.png` files or references exist

### Requirement: REQ-BRAND-7 Internal CSS/DOM Token Rebrand with Dual Lock Meta Support
The dynamic theme engine, injector, built-in configs (`src/config/`), and tests MUST use `--nyx-*` CSS custom properties, `.nyx` classes, and `data-nyx-*` DOM attributes instead of `--darkreader-*`, `.darkreader`, and `data-darkreader-*`, while recognizing BOTH `<meta name="nyx-lock">` and `<meta name="darkreader-lock">` as dark-mode opt-out signals.

#### Scenario: Inspecting injected theme DOM and CSS tokens
- **GIVEN** Nyx dynamic theme mode is active on a web page
- **WHEN** inspecting injected `<style>` elements, inline override attributes, and CSS custom properties
- **THEN** all injected classes, attributes, and CSS variables use `nyx` / `--nyx-*` / `data-nyx-*` prefixes

#### Scenario: Page declares nyx-lock or darkreader-lock meta tag
- **GIVEN** a page contains `<meta name="nyx-lock">` or `<meta name="darkreader-lock">`
- **WHEN** Nyx evaluates whether to theme the page
- **THEN** Nyx respects the lock signal in both cases and leaves the page un-inverted
