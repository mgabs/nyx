# Spec Delta

## ADDED Requirements

### Requirement: REQ-PERF-3 Microtask Batching and Deduplication for Inline Style Mutations
The inline-style watcher (`watchForInlineStyles`) MUST accumulate attribute `MutationRecord` deliveries across a microtask turn via `queueMicrotask`, deduplicate `HTMLElement` targets per flush, and invoke `elementStyleDidChange` at most once per distinct modified target without dropping intermediate mutation batches.

#### Scenario: Multiple attribute mutation batches in one microtask turn
- **GIVEN** `watchForInlineStyles` is active on a `Document` or `ShadowRoot`
- **WHEN** multiple attribute `MutationRecord` batches arrive within the same microtask turn for elements `A`, `B`, and `A` again on `INLINE_STYLE_ATTRS`
- **THEN** a single microtask flush executes and invokes `elementStyleDidChange` once for `A` and once for `B`, with zero dropped targets.

#### Scenario: Rate-limited attribute storm preserves queued targets
- **GIVEN** `attrObserver` hits `MAX_ATTEMPTS_COUNT` within `ATTEMPTS_INTERVAL` and enters `RETRY_TIMEOUT` deferral
- **WHEN** additional attribute mutations arrive before `RETRY_TIMEOUT` expires
- **THEN** all buffered `MutationRecord`s are flushed through the deduplicating batcher when the timer fires, without dropping intermediate records.

#### Scenario: Teardown cancels pending flushes and timers
- **GIVEN** a microtask flush or `RETRY_TIMEOUT` timer is pending in `watchForInlineStyles`
- **WHEN** `stopWatchingForInlineStyles()` is called
- **THEN** all pending microtask flushes and `RETRY_TIMEOUT` timers are cancelled and zero `elementStyleDidChange` or `variablesStore.matchVariablesAndDependents()` callbacks execute afterward.

### Requirement: REQ-PERF-4 Conditional Variable Matching on Inline Style Mutations
The inline-style watcher MUST invoke `variablesStore.matchVariablesAndDependents()` ONLY when at least one `INLINE_STYLE_ATTRS` attribute mutation or at least one newly discovered inline-style element or shadow host was processed in the current flush.

#### Scenario: Unrelated attribute or DOM additions skip variable matching
- **GIVEN** `watchForInlineStyles` is active
- **WHEN** a `MutationRecord` batch contains only override `dataAttr` mutations (no `INLINE_STYLE_ATTRS`) or DOM additions with no inline-style elements and no shadow hosts
- **THEN** `variablesStore.matchVariablesAndDependents()` is NOT called.

#### Scenario: Inline style change triggers single variable match per batch
- **GIVEN** `watchForInlineStyles` is active
- **WHEN** a batched flush processes one or more `INLINE_STYLE_ATTRS` changes or newly discovered inline-style elements
- **THEN** `variablesStore.matchVariablesAndDependents()` is called once at the end of the flush.

### Requirement: NFR-PERF-2 Inline Style Mutation Batching Overhead Budget
Deduplicating and flushing a batch of 1,000 attribute `MutationRecord`s MUST execute in $\le 5\text{ ms}$ in the pure batcher and MUST NOT schedule more than one `queueMicrotask` flush per microtask turn.

#### Scenario: Microtask coalescing under burst mutations
- **GIVEN** 100 consecutive `enqueue` calls are issued in a single synchronous turn
- **WHEN** the microtask queue drains
- **THEN** the flush callback executes exactly once (`1` time) and processes only the deduplicated targets.
