# Research & Technical Tradeoffs

## 1. Intent & Ground Truth

- **Goal:** Provide a 5th `ThemeEngine` (`leanDynamicTheme`) for Chrome 119+ and Firefox 128+ that applies one consistent dark color palette (`darkSchemeBackgroundColor`, `darkSchemeTextColor`) across all websites (both light and already-dark) while cutting startup lag, CPU spikes, and memory overhead on heavy SPAs, and update `README.md` + `docs/nyx-blueprint.md` to document the new engine.
- **Verified Codebase Facts:**
  - `ThemeEngine` enum (`src/generators/theme-engines.ts:1-6`) defines `cssFilter`, `svgFilter`, `staticTheme`, `dynamicTheme`, wired through `src/background/extension.ts`, `src/inject/index.ts`, `src/utils/validation.ts`, `src/ui/popup/theme/controls/mode.tsx`, `src/ui/popup/theme/page/index.tsx`, and `src/ui/devtools/components/body.tsx`.
  - **DOM `<style>` churn (`src/inject/dynamic-theme/style-manager.ts:244-255`):** `StyleManager` creates one `<style class="nyx nyx--sync">` element per stylesheet plus 9 static `<style>` elements (`nyx--fallback`, `nyx--user-agent`, `nyx--text`, `nyx--invert`, `nyx--variables`, `nyx--root-vars`, `nyx--inline`, `nyx--override`), mutated rule-by-rule via `insertRule`/`deleteRule`. `adoptedStyleSheets` is currently used only for overriding page `adoptedStyleSheets` (`src/inject/dynamic-theme/adopted-style-manger.ts`), with Firefox requiring `wrappedJSObject` / `pageWindow.CSSStyleSheet()`.
  - **Canvas image analysis (`src/inject/dynamic-theme/image.ts:122-143`, `modify-css.ts:15, 546`):** `modify-css.ts` hard-imports `image.ts` (`getImageDetails`, `getFilteredImageURL`, `getSolidColorImageURL`). Every CSS `url(...)` and logo `<svg>` decodes onto a `1024x1024` `<canvas>`. `ignoreImageAnalysis` is only a per-selector array from `dynamic-theme-fixes.config`.
  - **Sync mutation & variable storms (`src/inject/dynamic-theme/inline-style.ts:216-233`, `variables.ts:640-648`):** `treeObserver` invokes `discoverNodes` and `variablesStore.matchVariablesAndDependents()` synchronously per DOM mutation, and `variablesStore` is a module-level singleton.
  - **Per-instance rule cache (`src/inject/dynamic-theme/stylesheet-modifier.ts:48-82`):** `cssTextIds`, `rulesTextCache`, and `rulesModCache` are created per `StyleSheetModifier` instance, so SPA route changes unmounting `<style>`/`<link>` tags lose parsed rules and re-parse from scratch.

## 2. Options Explored

- **Option A: `color-scheme: dark` + selective root `invert(1) hue-rotate(180deg)` fallback**
  - *Description:* Minimal CSS-only engine toggling root inversion on light sites and leaving dark sites on native `color-scheme: dark`.
  - *Pros:* Lowest CPU/RAM; zero CSS rule parsing.
  - *Cons:* Fails the core consistency requirement — native-dark sites keep their own varying palettes, and light sites get harsher/varied inverted colors.

- **Option B: Isolated `src/inject/lean-theme/` orchestrator + shared pure CSS/color helpers (`leanDynamicTheme`)**
  - *Description:* Separate `lean-theme/` injector alongside `dynamic-theme/` (zero changes to `dynamicTheme` runtime behavior). Extracts/reuses pure helpers (`modify-colors.ts`, `css-rules.ts`, `fixes.ts`, `palette.ts`, isolated `VariablesStore` instances) while refactoring `modify-css.ts` to decouple `image.ts` and `stylesheet-modifier.ts` to accept a shared rule cache. Emits CSS via `adoptedStyleSheets` (`replaceSync()`), skips `image.ts` canvas analysis, coalesces DOM/`variablesStore` mutations, and serializes `adoptedStyleSheets` in `collectCSS()`.
  - *Pros:* Consistent palette across light and dark sites; full `dynamic-theme-fixes.config` + slider parity; zero regression risk to `dynamicTheme`.
  - *Cons:* Requires clean interface extraction in `modify-css.ts` / `stylesheet-modifier.ts` and a new `ThemeEngine` UI/background wiring slice; un-fixed CSS background sprites are not pixel-analyzed.

- **Option C: Mode flag inside `src/inject/dynamic-theme/`**
  - *Description:* Parameterize existing `dynamic-theme/` modules (`skipImageAnalysis`, `useAdoptedSheets`, `sharedCache`, `debounceTreeObserver`).
  - *Pros:* Smallest initial diff; no new orchestrator directory.
  - *Cons:* Adds conditional branches across `dynamic-theme/` hot paths, risking regressions to `dynamicTheme` and still bundling `image.ts` in the same module graph.

## 3. Tradeoff Matrix

| Criteria | Option A (`color-scheme` + `invert`) | Option B (`lean-theme/` isolated) | Option C (`dynamic-theme/` flag) |
| :--- | :--- | :--- | :--- |
| **Complexity** | Low | Medium | Medium-Low |
| **New Dependencies** | None | None | None |
| **Performance & Latency** | Highest | High (SPA bottlenecks cut) | High (SPA bottlenecks cut) |
| **Maintenance Burden** | Low | Medium (shared pure helpers) | Medium-High (branching in hot paths) |
| **Blast Radius** | Low | Low (`dynamicTheme` untouched) | Medium (`dynamic-theme/` touched) |

## 4. Recommendation

Choose **Option B (`lean-theme/` isolated orchestrator + refactored pure helpers)** so `dynamicTheme` stays untouched while `leanDynamicTheme` achieves consistent cross-site dark theming without DOM `<style>` churn, `<canvas>` image analysis, sync SPA mutation storms, or lost rule caches.

## 5. Breaking Changes & Deprecations

None. Existing engines (`cssFilter`, `svgFilter`, `staticTheme`, `dynamicTheme`) and `openspec/specs/` requirements (including `openspec/specs/engine-measurement/spec.md`) remain unchanged.

## Review Gate
- [x] **Gate 0 Decision**: B
