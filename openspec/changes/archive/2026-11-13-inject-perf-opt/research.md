# Research & Technical Tradeoffs

## 1. Intent & Ground Truth
Audit `src/inject/` hot paths to select a single, high-impact vertical performance optimization slice for `inject-perf-opt` (preserving all runtime targets: Chrome MV2/MV3, Firefox, and standalone API).

Verified codebase facts in `src/inject/dynamic-theme/`:
1. **`src/inject/dynamic-theme/inline-style.ts` (`watchForInlineStyles`, lines 170–290)**:
   - `handleAttributeMutations` (lines 230–243) is wrapped in `throttle()` (`src/utils/throttle.ts:1-30`). `throttle()` executes the first call synchronously, then overwrites `lastArgs` on subsequent calls within the same animation frame—**dropping intermediate `MutationRecord[]` arrays** when multiple attribute mutation batches arrive before `requestAnimationFrame` fires.
   - `handleAttributeMutations` unconditionally calls `variablesStore.matchVariablesAndDependents()` (line 242) on every invocation, even when zero `INLINE_STYLE_ATTRS` (`style`, `fill`, `stroke`, `bgcolor`, `background`, `color`, `stop-color`) matched.
   - `treeObserver` (`inline-style.ts:210-219`) unconditionally calls `variablesStore.matchVariablesAndDependents()` on every `onMinorMutations` delivery, even when `additions` produces no newly discovered inline-style elements or shadow hosts.
   - `stopWatchingForInlineStyles()` (lines 279–290) does not cancel pending `handleAttributeMutations` rAF callbacks or clear `timeoutId` / `cache` from the attribute-storm rate limiter (`lines 222-270`), allowing stale callbacks to fire after teardown.
2. **`src/inject/dynamic-theme/adopted-style-manger.ts` (`createAdoptedStyleSheetOverride`, lines 51–229)**:
   - Already maintains `overridesBySource = new WeakMap<CSSStyleSheet, CSSStyleSheet>()` (line 13), but does not key by `Theme` or `ignoreImageAnalysis`, creates a new `createStyleSheetModifier()` per sheet on cache misses (line 157), and polls `getRulesChangeKey()` every `requestAnimationFrame` when `!canUseSheetProxy` (lines 192–202).
3. **`src/inject/utils/dom.ts` (`createOptimizedTreeObserver`, lines 335–383)**:
   - Already shares one `MutationObserver` per `Document | ShadowRoot` and partitions minor vs. huge (`> 1000`) mutations; shared across `style-manager.ts`, `inline-style.ts`, and `style-position.ts`.

## 2. Options Explored

### Option A: Inline Style Mutation Microtask Batching & Teardown Cleanup (`inline-style.ts`, Roadmap 4.1)
Replace `throttle(handleAttributeMutations)` with a microtask-queued (`queueMicrotask`) `MutationRecord` batcher that accumulates target elements across all deliveries in a microtask turn, deduplicates targets, skips `variablesStore.matchVariablesAndDependents()` when no inline-style or shadow-host work occurred, and cancels pending microtasks/timers on `stopWatchingForInlineStyles()`.
- **Pros**: Eliminates dropped `MutationRecord[]` batches under rapid SPA attribute mutations; avoids redundant `variablesStore.matchVariablesAndDependents()` scans on unrelated DOM/attribute mutations; fixes post-teardown timer/callback leaks; isolated to `inline-style.ts` (plus a pure batching helper).
- **Cons**: Microtask batching defers attribute-mutation handling from synchronous-first-call to end-of-microtask (still before paint, same frame).

### Option B: AdoptedStyleSheet Theme-Keyed Cache & Modifier Reuse (`adopted-style-manger.ts`, Roadmap 4.2)
Key `overridesBySource` by `(themeKey, ignoreImageAnalysis)` and reuse a single `StyleSheetModifier` per `AdoptedStyleSheetManager`.
- **Pros**: Reduces CSS rule re-processing on repeated Shadow DOM theme re-renders.
- **Cons**: Higher risk of stale overrides if `variablesStore` or `fixes` change independently of `themeKey`; `overridesBySource` already handles the primary same-theme Shadow DOM reuse case.

### Option C: Shared `createOptimizedTreeObserver` Refactor (`src/inject/utils/dom.ts`)
Add microtask batching and selector filtering inside `createOptimizedTreeObserver`.
- **Pros**: Benefits all observers (`style-manager.ts`, `inline-style.ts`, `style-position.ts`).
- **Cons**: Wide blast radius across style-element ordering and FOUC-sensitive `style-position.ts` observers.

## 3. Tradeoff Matrix

| Criteria | Option A (`inline-style.ts` Batching) | Option B (`adopted-style-manger.ts` Cache) | Option C (`dom.ts` TreeObserver) |
| :--- | :--- | :--- | :--- |
| **Complexity** | Low | Medium | High |
| **New Dependencies** | None | None | None |
| **Performance & Latency** | High (eliminates redundant `matchVariablesAndDependents()` + rAF churn; zero dropped batches) | Medium (helps Shadow DOM theme switches) | Medium |
| **Maintenance Burden** | Low (single module + pure batcher) | Medium (cache invalidation coupling) | High |
| **Blast Radius** | Narrow (`inline-style.ts` only) | Medium (Shadow DOM + document adopted sheets) | Wide (all DOM observers) |

## 4. Recommendation
Select **Option A** (Inline Style Mutation Microtask Batching & Teardown Cleanup in `src/inject/dynamic-theme/inline-style.ts`, Roadmap 4.1). It is a self-contained single vertical slice that removes redundant `variablesStore.matchVariablesAndDependents()` work, fixes `throttle()`'s dropped-`MutationRecord[]` bug, and prevents post-teardown timer leaks with minimal blast radius.

## 5. Breaking Changes & Deprecations
None. Existing `openspec/specs/core-perf/spec.md` (`REQ-PERF-1`, `REQ-PERF-2`, `NFR-PERF-1`) remains unchanged; new requirements will be appended as `REQ-PERF-3`, `REQ-PERF-4`, and `NFR-PERF-2`.

## Review Gate
- [ ] **Gate 0 Decision**: Human decides Go (name the option) or No-Go before the proposal is drafted.
