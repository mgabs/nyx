# Research & Technical Tradeoffs

## 1. Intent & Ground Truth
- **Problem**: Under `leanDynamicTheme` in Chrome, YouTube images/overlays can be hidden or blacked out (observed live on `youtube.com/@YouTube/videos` in headless Chrome: channel avatar `yt-avatar-shape` rendered as a solid black circle and sidebar icons disappeared; `fallback` sheet getting stuck blacks out all video thumbnails).
- **Verified codebase facts (`src/inject/lean-theme/`)**:
  1. **`loadingCount` leak (`index.ts:59, 475-508`)**: `removeLeanTheme()` does not reset `loadingCount = 0`. If `loadCORSSheet()` is in-flight during an update, toggle, or SPA navigation, `loadingCount` remains `> 0`, preventing `cleanFallback()` from clearing `fallback` (`body :not(iframe) { background-color: #181a1b !important; }` in `src/inject/dynamic-theme/modify-css.ts:259`).
  2. **Stale `update()` callback (`index.ts:151, 211-283`)**: `manageLeanStyle()` receives `update: () => scheduleCoalescedFlush()`, called by `loadCORSSheet()` (`style-manager.ts:145`) and `sheetWatcher`. `flushCoalescedMutations()` only renders `newlyAddedManagers`, never re-rendering existing managers when a CORS `<link>` finishes loading or a `<style>` mutates.
  3. **Cascade order in `adoptedStyleSheets` (`index.ts:107-130`, `adopted-emitter.ts:127`)**: `override` (`dynamic-theme-fixes.config` for `youtube.com`) is attached with `'ending'` *before* `dynamicSheets` (also `'ending'`), so YouTube's converted `<style>` rules override site fixes. `inline` (`[data-nyx-inline-*]`) is attached with `'beginning'`, losing to `!important` rules in `override`/`dynamicSheets`.
  4. **Page-authored `adoptedStyleSheets` ignored**: Unlike `src/inject/dynamic-theme/index.ts:447` (`handleAdoptedStyleSheets(document)`), `lean-theme` never inspects or themes page-authored `document.adoptedStyleSheets` or `shadowRoot.adoptedStyleSheets` (used by YouTube's Lit/Polymer components).

## 2. Options Explored
- **Option A — Minimal `lean-theme` lifecycle & cascade fix (Recommended)**:
  Reset `loadingCount` in `removeLeanTheme()`, track `pendingUpdatedManagers` in `flushCoalescedMutations()` so `update()` re-renders dirty managers, and fix `adoptedStyleSheets` ordering (`fallback`/`user-agent`/`text`/`invert`/`variables`/`root-vars` -> `dynamicSheets` -> `override` -> `inline`).
  - *Pros*: Small, surgical, zero new dependencies, preserves `adoptedStyleSheets` zero-DOM-churn performance model.
  - *Cons*: Does not theme page-authored `adoptedStyleSheets` unless added separately.
- **Option B — Option A + Page-authored `adoptedStyleSheets` support**:
  Include Option A plus inspecting `document.adoptedStyleSheets` and `shadowRoot.adoptedStyleSheets` (excluding Nyx's own sheets) via `LeanStyleManager` / `StyleSheetModifier`.
  - *Pros*: Full parity with `dynamic-theme` for Lit/Polymer web components on YouTube (e.g. `yt-avatar-shape`, `yt-thumbnail-view-model`).
  - *Cons*: Slightly larger diff; needs careful exclusion of Nyx's own adopted sheets to avoid feedback loops.
- **Option C — Fall back to `dynamicTheme` on `youtube.com`**:
  Force `dynamicTheme` for YouTube via config/engine routing.
  - *Pros*: Immediate workaround.
  - *Cons*: Leaves `leanDynamicTheme` broken on SPAs and defeats the purpose of `leanDynamicTheme` on one of the heaviest SPAs.

## 3. Tradeoff Matrix

| Criteria | Option A (Lifecycle + Order) | Option B (Option A + Page Adopted Sheets) | Option C (Fallback to `dynamicTheme`) |
| :--- | :--- | :--- | :--- |
| **Complexity** | Low | Medium | Trivial |
| **New Dependencies** | None | None | None |
| **Performance & Latency** | Preserves `leanDynamicTheme` fast path | Minimal overhead (adopted sheets only) | Regresses YouTube to `dynamicTheme` |
| **Maintenance Burden** | Low | Low-Medium | High (per-site special case) |
| **Blast Radius** | `src/inject/lean-theme/` only | `src/inject/lean-theme/` only | Engine selection / config |

## 4. Recommendation
Adopt **Option B** (or **Option A** first if keeping the vertical slice minimal, then Option B): fixing `loadingCount` reset, `pendingUpdatedManagers` re-render, and `adoptedStyleSheets` cascade order resolves the core `lean-theme` bugs cleanly, and adding page-authored `adoptedStyleSheets` handling closes the Polymer/Lit component gap on YouTube without touching `dynamic-theme`.

## 5. Breaking Changes & Deprecations
None.

## Review Gate
- [x] **Gate 0 Decision**: Human decides Go (name the option) or No-Go before the proposal is drafted.
