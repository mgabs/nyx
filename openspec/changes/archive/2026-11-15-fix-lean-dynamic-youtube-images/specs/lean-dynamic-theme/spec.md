# Spec Delta: Lean Dynamic Theme

## Purpose
Ensure `leanDynamicTheme` reliably cleans up its fallback sheet, re-renders updated/CORS stylesheets, preserves cascade order for site fixes and inline overrides, and themes page-authored `adoptedStyleSheets` without hiding or blacking out images.

## ADDED Requirements

### Requirement: REQ-LEAN-1 Fallback Cleanup and Loading Counter Reset
The `leanDynamicTheme` engine MUST reset its in-flight CORS stylesheet counter (`loadingCount`) when `removeLeanTheme()` runs, and MUST clear the `fallback` sheet (`body :not(iframe)`) as soon as DOM is ready and no CORS stylesheets are actively loading.

#### Scenario: Cleanup during in-flight CORS stylesheet load
- **GIVEN** a page with `leanDynamicTheme` active and at least one `loadCORSSheet()` request in-flight (`loadingCount > 0`)
- **WHEN** `removeLeanTheme()` is called followed by `createOrUpdateLeanTheme()` on a page with no pending CORS loads
- **THEN** `loadingCount` starts at `0` and `cleanFallback()` clears the `fallback` sheet after `renderDynamicStyles()`

### Requirement: REQ-LEAN-2 Reactive Re-Render of Updated and CORS Stylesheets
The `leanDynamicTheme` engine MUST re-render any existing `LeanStyleManager` whose `update()` callback fires from `loadCORSSheet()` completion or `sheetWatcher` stylesheet mutations, and re-run variable matching when new rules arrive.

#### Scenario: Cross-origin stylesheet finishes loading
- **GIVEN** a page with a cross-origin `<link rel="stylesheet">` managed by `leanDynamicTheme`
- **WHEN** `loadCORSSheet()` finishes fetching and populates `corsSheet`, invoking `update()`
- **THEN** `flushCoalescedMutations()` re-renders that manager's dynamic `CSSStyleSheet` into `adoptedStyleSheets`

#### Scenario: Existing `<style>` element mutates via CSSOM
- **GIVEN** a `<style>` element already managed by `leanDynamicTheme`
- **WHEN** the page inserts or modifies rules via `sheet.insertRule()` and `sheetWatcher` invokes `update()`
- **THEN** `flushCoalescedMutations()` re-renders that manager's dynamic `CSSStyleSheet`

### Requirement: REQ-LEAN-3 Cascade Ordering of Override and Inline Sheets
The `leanDynamicTheme` engine MUST order `adoptedStyleSheets` on `document` and each `ShadowRoot` so that base/variable/user-agent sheets precede `dynamicSheets`, and `override` (`dynamic-theme-fixes.config`) and `inline` (`[data-nyx-inline-*]`) sheets follow `dynamicSheets`.

#### Scenario: Site fix override wins over page stylesheet
- **GIVEN** a site with rules in `dynamic-theme-fixes.config` (e.g., `youtube.com`) and page `<style>` rules targeting the same selector
- **WHEN** `leanDynamicTheme` attaches `adoptedStyleSheets`
- **THEN** the `override` sheet appears after all `dynamicSheets` in `adoptedStyleSheets`, and `inline` appears after `override`

### Requirement: REQ-LEAN-4 Page-Authored Adopted StyleSheets Theming
The `leanDynamicTheme` engine MUST inspect and theme page-authored `CSSStyleSheet` instances in `document.adoptedStyleSheets` and `ShadowRoot.adoptedStyleSheets`, while excluding Nyx's own constructed sheets to prevent feedback loops (`ASM-GEN-1`).

#### Scenario: Web component uses `shadowRoot.adoptedStyleSheets`
- **GIVEN** a custom element (e.g., YouTube's `yt-avatar-shape` or `yt-thumbnail-view-model`) with page-authored stylesheets in `shadowRoot.adoptedStyleSheets`
- **WHEN** `leanDynamicTheme` processes that `ShadowRoot`
- **THEN** Nyx themes the page-authored `adoptedStyleSheets` without re-processing its own emitted `CSSStyleSheet` instances

### Requirement: NFR-LEAN-1 Zero Image Analysis and Zero DOM Style Injection
All fixes in `lean-dynamic-theme` MUST preserve zero `<canvas>` image analysis (`imageURLModifier: null`) and MUST NOT inject `<style>` elements into the page DOM.

#### Scenario: YouTube video thumbnails and avatars remain visible
- **GIVEN** `youtube.com` loaded in Chrome with `leanDynamicTheme` enabled
- **WHEN** video thumbnails, channel avatars, and sidebar icons render
- **THEN** no `<style class="nyx">` elements are added to the DOM and above-the-fold thumbnails and avatars remain unobstructed
