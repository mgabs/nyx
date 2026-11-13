# Proposal

## Intent
Batch inline-style attribute and tree-addition DOM mutations in `src/inject/dynamic-theme/inline-style.ts` via a microtask queue with target deduplication, conditional `variablesStore.matchVariablesAndDependents()` invocation, and deterministic teardown cleanup.

## Problem Statement
In `src/inject/dynamic-theme/inline-style.ts`, `watchForInlineStyles` currently wraps `handleAttributeMutations` in `throttle()` (`src/utils/throttle.ts`), which overwrites `lastArgs` when multiple `MutationObserver` batches arrive within a single animation frame—dropping intermediate `MutationRecord[]` batches. Furthermore, both `handleAttributeMutations` and `treeObserver.onMinorMutations` unconditionally invoke `variablesStore.matchVariablesAndDependents()` even when zero inline-style attributes or shadow hosts changed, and `stopWatchingForInlineStyles()` fails to cancel pending throttled frames or rate-limiter timers.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `core-perf`: Add inline-style mutation microtask batching, conditional variable matching, and teardown cancellation requirements (`REQ-PERF-3`, `REQ-PERF-4`, `NFR-PERF-2`).

## Scope

### In-Scope
- Microtask-queued (`queueMicrotask`) accumulation and target deduplication for `attrObserver` `MutationRecord[]` deliveries in `src/inject/dynamic-theme/inline-style.ts` (preserving the existing attribute-storm rate limiter).
- Conditional invocation of `variablesStore.matchVariablesAndDependents()` only when at least one `INLINE_STYLE_ATTRS` attribute changed or at least one new inline-style element / shadow host was discovered.
- Deterministic cancellation of pending microtask flushes, rAF/throttle callbacks, and rate-limiter `timeoutId` timers in `stopWatchingForInlineStyles()`.
- Pure batching/deduplication helper extracted for >= 95% unit line/branch coverage and >= 95% mutation kill score.

### Out-of-Scope (YAGNI)
- `adopted-style-manger.ts` theme-keyed caching (Roadmap 4.2 — separate change).
- `createOptimizedTreeObserver` changes in `src/inject/utils/dom.ts`.
- UI, popup, manifest, platform flag (`__PLUS__`, `__THUNDERBIRD__`), or `src/stubs/` modifications.
- New npm dependencies or changes to `src/utils/throttle.ts` behavior for other callers.

## Assumptions
- **ASM-GEN-1**: Deferring `attrObserver` processing to a single microtask turn (`queueMicrotask`) executes before browser paint in the same frame and introduces no FOUC regression across Chrome (MV2/MV3), Firefox, and standalone API (`darkreader.js`).
- **ASM-GEN-2**: `variablesStore.matchVariablesAndDependents()` is only needed from `inline-style.ts` when `elementStyleDidChange` or `shadowRootDiscovered` is actually triggered.

## Success Metrics
- **Zero dropped mutation batches**: 100% of distinct `HTMLElement` targets with `INLINE_STYLE_ATTRS` changes across multiple `MutationObserver` deliveries in the same microtask turn are processed once per flush.
- **Variable-matching reduction**: `variablesStore.matchVariablesAndDependents()` call count is `0` for mutation batches containing no `INLINE_STYLE_ATTRS` changes and no new inline-style/shadow-host additions (down from `1` per batch).
- **Clean teardown**: `0` `elementStyleDidChange` or `matchVariablesAndDependents` calls execute after `stopWatchingForInlineStyles()` is invoked.
- **Verification gates**: `npm test`, `npm run test:browser`, `npm run test:inject`, `npm run lint`, `npm run build`, and `npm run api` all pass; >= 95% line/branch coverage and >= 95% mutation kill score on the new/modified pure batcher module.

## Review Gate
- [ ] **Gate 1 Approval**: Proposal reviewed and approved by human before drafting specs.
