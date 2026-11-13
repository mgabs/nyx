# core-perf Specification

## Purpose
Provides high-throughput LRU caching and regex-free character-code color parsing to eliminate performance bottlenecks in hot execution paths.

## Requirements

### Requirement: REQ-PERF-1 True LRU Cache Eviction
The `cachedFactory` utility MUST maintain true Least Recently Used (LRU) order by refreshing the access position of a cached key upon every cache hit.

#### Scenario: Cache hit key refresh
- **WHEN** an existing key is accessed in `cachedFactory`
- **THEN** that key is moved to the most recent position and is NOT evicted when cache size exceeds the limit until all older keys have been evicted.

### Requirement: REQ-PERF-2 Fast-Path Character Code Color Parsing
The `parse()` color utility MUST inspect standard `#hex` (3-digit and 6-digit) and integer `rgb(...)` color strings directly via character-code inspection, completely bypassing regular expressions on these paths.

#### Scenario: Standard 6-digit hex color parsing
- **WHEN** a valid 6-digit hex string (e.g., `#ffffff`, `#181a1b`) is passed to `parse()`
- **THEN** it is parsed via character code offsets without invoking RegExp matching.

#### Scenario: Standard rgb string parsing
- **WHEN** a valid `rgb(r, g, b)` string with integer components is passed to `parse()`
- **THEN** it is parsed via character code scanning without invoking RegExp matching.

### Requirement: NFR-PERF-1 Color Parser Latency Budget
Standard `#hex` and `rgb()` color parsing MUST achieve at least a $3\times$ reduction in CPU execution time compared to RegExp matching.

#### Scenario: Benchmark execution
- **WHEN** parsing 10,000 standard hex and rgb color strings
- **THEN** the execution time is $\le 33\%$ of the baseline RegExp parser time.

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
