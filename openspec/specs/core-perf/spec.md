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
