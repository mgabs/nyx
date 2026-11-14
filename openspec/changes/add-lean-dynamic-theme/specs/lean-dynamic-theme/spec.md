# Spec Delta: lean-dynamic-theme

## Purpose
Provide an isolated, low-overhead `leanDynamicTheme` engine (`src/inject/lean-theme/`) for Chrome 119+ and Firefox 128+ that applies one consistent dark color palette across both light and already-dark websites without DOM `<style>` cloning or `<canvas>` image analysis.

## ADDED Requirements

### Requirement: REQ-LEAN-1 Engine Registration & Wiring
The extension MUST register `ThemeEngine.leanDynamicTheme` in `src/generators/theme-engines.ts`, validate it in `src/utils/validation.ts`, dispatch it from `src/background/extension.ts` / `src/inject/index.ts`, and expose it in the popup mode selector and devtools editor without altering `DEFAULT_THEME.engine` (`ThemeEngine.dynamicTheme`).

#### Scenario: Selecting leanDynamicTheme in UI
- **GIVEN** a user selects `leanDynamicTheme` in popup theme mode controls
- **WHEN** settings update and background dispatches theme application to an active tab
- **THEN** the content script invokes the `src/inject/lean-theme/` entrypoint rather than `src/inject/dynamic-theme/`

#### Scenario: Existing engines unchanged
- **GIVEN** a profile configured with `dynamicTheme`, `staticTheme`, `cssFilter`, or `svgFilter`
- **WHEN** the extension applies the theme
- **THEN** existing engine code paths execute with zero behavioral change

### Requirement: REQ-LEAN-2 Consistent Cross-Site Palette & Fix Compatibility
`leanDynamicTheme` MUST apply the configured `darkSchemeBackgroundColor`, `darkSchemeTextColor`, and adjustment sliders (`brightness`, `contrast`, `sepia`, `grayscale`) consistently to both light-mode and native-dark-mode websites, and MUST honor matched site rules (`CSS`, `INVERT`, `IGNORE INLINE STYLE`, `IGNORE CSS URL`) and `--nyx-*` / `${...}` templates from `dynamic-theme-fixes.config`.

#### Scenario: Consistent palette on light and native-dark pages
- **GIVEN** `leanDynamicTheme` is active with custom `darkSchemeBackgroundColor` and `darkSchemeTextColor`
- **WHEN** applied to a hardcoded-light page and a `prefers-color-scheme: dark` page
- **THEN** both pages receive semantic background and foreground mapping toward the same configured dark palette

#### Scenario: Site fix rules and templates applied
- **GIVEN** a domain matching a `dynamic-theme-fixes.config` entry using `--nyx-neutral-*`, `--nyx-bg--*`, or `${#hex}` templates
- **WHEN** `leanDynamicTheme` renders styles for that domain
- **THEN** the matched `fix.css` variables and `${...}` color templates resolve to themed CSS values

### Requirement: REQ-LEAN-3 Decoupled CSS Transform & AdoptedStyleSheets Output
`leanDynamicTheme` MUST reuse pure CSS color/rule helpers (`modify-css.ts` decoupled from `image.ts`) and emit its generated stylesheets via `Document.adoptedStyleSheets` and open `ShadowRoot.adoptedStyleSheets` using `CSSStyleSheet.prototype.replaceSync()` (with Firefox `wrappedJSObject` / `pageWindow.CSSStyleSheet()` support), creating zero `.nyx--sync` `<style>` DOM elements.

#### Scenario: Zero .nyx--sync DOM elements
- **GIVEN** `leanDynamicTheme` styles a page with multiple `<link>` and `<style>` stylesheets
- **WHEN** styling completes
- **THEN** `document.querySelectorAll('style.nyx--sync').length` equals `0` and rules reside in `adoptedStyleSheets`

#### Scenario: Firefox Xray adoptedStyleSheets compatibility
- **GIVEN** `leanDynamicTheme` runs in Firefox 128+ content script context
- **WHEN** creating and attaching `adoptedStyleSheets`
- **THEN** sheets are constructed via `wrappedJSObject` / `pageWindow.CSSStyleSheet()` without throwing Xray security errors

### Requirement: REQ-LEAN-4 Isolated VariablesStore, Shared Rule Cache & Coalesced Observers
`leanDynamicTheme` MUST use an isolated `VariablesStore` instance (not the `dynamic-theme` singleton), share a bounded rule-modification cache across SPA route transitions, coalesce DOM tree / `VariablesStore` updates via microtask/frame batching, and serialize active `adoptedStyleSheets` in `collectCSS()` for `EXPORT_CSS`.

#### Scenario: SPA route swap reuses cached rules
- **GIVEN** an SPA removes and re-mounts a `<style>` or `<link>` with unchanged rules during client navigation
- **WHEN** `leanDynamicTheme` processes the remounted sheet
- **THEN** previously parsed `ModifiableCSSRule` entries are served from the shared cache

#### Scenario: EXPORT_CSS returns leanDynamicTheme output
- **GIVEN** `leanDynamicTheme` is active on a page
- **WHEN** `EXPORT_CSS` invokes `collectCSS()`
- **THEN** serialized CSS rules from active `leanDynamicTheme` `adoptedStyleSheets` are returned

### Requirement: NFR-LEAN-1 Zero Canvas Image Analysis & Documentation Parity
`src/inject/lean-theme/` MUST NOT import `src/inject/dynamic-theme/image.ts` or allocate `<canvas>` elements for pixel analysis, and `README.md` + `docs/nyx-blueprint.md` MUST document `leanDynamicTheme`.

#### Scenario: No image.ts dependency in lean-theme
- **GIVEN** `src/inject/lean-theme/` module graph
- **WHEN** inspected or executed on image-heavy pages
- **THEN** `image.ts` is not imported and zero `<canvas>` elements are created by `lean-theme`
