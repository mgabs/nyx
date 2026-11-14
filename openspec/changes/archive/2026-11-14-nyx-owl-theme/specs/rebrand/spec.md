# Spec Delta: rebrand

## MODIFIED Requirements

### Requirement: REQ-BRAND-6 Full Locale, Asset, and Standalone API Rebrand
All 42 `src/_locales/*/messages.json` and `src/_locales/store/*` files MUST replace Dark Reader brand names with Nyx, UI and extension icon assets MUST use `nyx-*` / `nyx_*.png` filenames featuring Nyx's Obsidian/Silver/Amber Owl Badge (`nyx-type.svg` in `#f59e0b`, `nyx-icon-256x256.png`, `nyx-thumb-up.svg`, `src/icons/nyx_16.png`, `nyx_48.png`, `nyx_128.png`, `nyx_active_19.png`, `nyx_active_38.png`, `nyx_active_light_19.png`, `nyx_active_light_38.png`) with zero legacy `dr_*.png` references in manifests or `IconManager`, and the standalone API build (`npm run api`) MUST emit `nyx.js` and `nyx.mjs` exposing the `Nyx` global and `package.json` `main`/`module` entrypoints.

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
