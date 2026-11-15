# Proposal

## Intent
Fix `leanDynamicTheme` stylesheet lifecycle, cascade ordering, and page-authored `adoptedStyleSheets` handling in `src/inject/lean-theme/` so YouTube video thumbnails, channel avatars, and UI icons render reliably without being hidden or blacked out.

## Problem Statement
Under `leanDynamicTheme` in Chrome, YouTube images and icons can fail to display or render blacked out:
1. `removeLeanTheme()` leaks `loadingCount`, leaving the `fallback` sheet (`body :not(iframe) { background-color: #181a1b !important; }`) stuck over overlays and thumbnails across toggles or SPA navigations.
2. `update()` callbacks from `loadCORSSheet()` and `sheetWatcher` never re-render existing `LeanStyleManager` instances in `flushCoalescedMutations()`.
3. `adoptedStyleSheets` places `override` (`dynamic-theme-fixes.config`) before `dynamicSheets`, allowing page styles to override site fixes, and places `inline` at `'beginning'`.
4. Page-authored `adoptedStyleSheets` (used by YouTube's Lit/Polymer components) are not themed.

## Capabilities

### New Capabilities
- `lean-dynamic-theme`: Reliable stylesheet lifecycle, `fallback` cleanup, cascade ordering, and page-authored `adoptedStyleSheets` theming in `leanDynamicTheme`.

### Modified Capabilities
- None (no existing `lean-dynamic-theme` spec under `openspec/specs/`).

## Scope

### In-Scope
- Reset `loadingCount = 0` in `removeLeanTheme()` and ensure `cleanFallback()` runs whenever no CORS sheets are actively loading.
- Track dirty `LeanStyleManager` instances in `flushCoalescedMutations()` so `loadCORSSheet()` and `sheetWatcher` `update()` callbacks re-render their sheets.
- Fix `adoptedStyleSheets` ordering so `override` and `inline` sheets follow `dynamicSheets` in the cascade.
- Theme page-authored `adoptedStyleSheets` on `document` and `ShadowRoot` while excluding Nyx's own constructed sheets.
- Add unit/inject regression tests and verify on live YouTube pages in Chrome.

### Out-of-Scope (YAGNI)
- Modifying `dynamicTheme` (`src/inject/dynamic-theme/`), `staticTheme`, `cssFilter`, or `svgFilter`.
- Adding `<canvas>` image analysis to `leanDynamicTheme`.
- Changing `src/config/dynamic-theme-fixes.config` rules for `youtube.com` unless required after lifecycle/cascade fixes.
- UI, popup, or build-system changes.

## Assumptions
- **ASM-GEN-1**: Excluding Nyx's own `CSSStyleSheet` instances via a tracked `Set<CSSStyleSheet>` prevents re-theming loops on `adoptedStyleSheets`.
- **ASM-GEN-2**: Maintaining `adoptedStyleSheets` order as `[base/variables/user-agent/fallback, ...dynamicSheets, override, inline]` matches `dynamicTheme` cascade semantics without DOM `<style>` injection.

## Success Metrics
- `0` stuck `fallback` rules (`body :not(iframe)`) after `DOMContentLoaded` and `loadCORSSheet()` completion, including after `removeLeanTheme()` / `createOrUpdateLeanTheme()` cycles.
- `100%` of above-the-fold YouTube video thumbnails, channel avatars (`yt-avatar-shape`), and sidebar icons visible and unobstructed on `youtube.com` under `leanDynamicTheme` in Chrome.
- All required verification gates pass (`npm test`, `npm run test:inject`, `npm run lint`, `npm run build`, `npm run api`).

## Review Gate
- [x] **Gate 1 Approval**: Proposal reviewed and approved by human before drafting specs.
