# Proposal

## Intent

Add a 5th `ThemeEngine` (`leanDynamicTheme`) implemented as an isolated injector in `src/inject/lean-theme/` that applies one consistent dark color palette across both light and already-dark websites on Chrome 119+ and Firefox 128+, while cutting SPA CPU, memory, and DOM churn.

## Problem Statement

`dynamicTheme` delivers a consistent dark palette across light and dark sites, but on heavy SPAs it causes startup lag, CPU spikes, and memory overhead due to per-stylesheet `<style class="nyx--sync">` DOM cloning, `<canvas>` pixel-by-pixel image analysis (`image.ts`), synchronous `MutationObserver` / `VariablesStore` graph re-matching, and per-instance rule caches lost on SPA route swaps.

## Capabilities

### New Capabilities
- `lean-dynamic-theme`: Isolated `src/inject/lean-theme/` engine (`ThemeEngine.leanDynamicTheme`) supporting consistent cross-site dark theming via `adoptedStyleSheets` (`replaceSync()`), decoupled pure CSS/color helpers (`modify-css.ts` without `image.ts`), shared rule cache across SPA route changes, coalesced DOM/`VariablesStore` updates, `EXPORT_CSS` (`collectCSS()`) serialization, UI/background wiring, and `README.md` + `docs/nyx-blueprint.md` documentation.

### Modified Capabilities
- None. Existing `dynamicTheme`, `staticTheme`, `cssFilter`, and `svgFilter` behavior and `openspec/specs/` requirements remain unchanged.

## Scope

### In-Scope
- Add `ThemeEngine.leanDynamicTheme` in `src/generators/theme-engines.ts` and wire it through `src/utils/validation.ts`, `src/background/extension.ts`, `src/inject/index.ts`, and UI engine selectors/devtools (`src/ui/popup/theme/controls/mode.tsx`, `src/ui/popup/theme/page/index.tsx`, `src/ui/devtools/components/body.tsx`).
- Decouple `image.ts` from `src/inject/dynamic-theme/modify-css.ts` behind an optional image-modifier hook so `lean-theme` reuses CSS color/gradient/shadow transforms without bundling or running `<canvas>` image analysis.
- Extract/share a bounded rule cache option in `src/inject/dynamic-theme/stylesheet-modifier.ts` so `lean-theme` preserves parsed rules across SPA route transitions.
- Implement `src/inject/lean-theme/` with `adoptedStyleSheets` output (including Firefox `wrappedJSObject` / `pageWindow.CSSStyleSheet()`), `replaceSync()` updates instead of `.nyx--sync` `<style>` DOM nodes, isolated `VariablesStore` with microtask/frame-coalesced `treeObserver` updates, full `dynamic-theme-fixes.config` + user slider support, and `collectCSS()` serialization for `EXPORT_CSS`.
- Update `README.md` and `docs/nyx-blueprint.md` to document `leanDynamicTheme`.

### Out-of-Scope (YAGNI)
- Modifying `dynamicTheme`'s runtime behavior, `staticTheme`, `cssFilter`, or `svgFilter`.
- Pixel-level `<canvas>` image analysis inside `leanDynamicTheme`.
- Supporting browsers older than Chrome 119 or Firefox 128 in `leanDynamicTheme`.
- Styling closed Shadow DOM internals where `adoptedStyleSheets` is inaccessible.
- Removing any existing UI controls, compile-time flags (`__PLUS__`, `__THUNDERBIRD__`), or `src/stubs/`.

## Assumptions
- **ASM-GEN-1**: Target browsers for `leanDynamicTheme` are Chrome 119+ and Firefox 128+, both supporting `Document.adoptedStyleSheets`, `ShadowRoot.adoptedStyleSheets`, and `CSSStyleSheet.prototype.replaceSync()`.
- **ASM-GEN-2**: `dynamicTheme` remains the default `ThemeEngine` in `src/defaults.ts`; `leanDynamicTheme` is opt-in.

## Success Metrics
- `leanDynamicTheme` produces 0 `.nyx--sync` `<style>` DOM elements and 0 `<canvas>` allocations (`image.ts` not imported in `src/inject/lean-theme/`).
- All 6 verification gates pass: `npm test`, `npm run test:browser`, `npm run test:inject`, `npm run lint`, `npm run build`, and `npm run api`.
- `EXPORT_CSS` (`collectCSS()`) returns non-empty serialized CSS rules when `leanDynamicTheme` is active.

## Review Gate
- [x] **Gate 1 Approval**: Proposal reviewed and approved by human before drafting specs.
