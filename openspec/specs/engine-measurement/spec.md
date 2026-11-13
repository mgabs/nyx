# engine-measurement Specification

## Purpose
Provide an isolated, deterministic Puppeteer-based performance benchmark capability (`engine-measurement`) that measures Nyx's theme engines, injection pipeline, and standalone API without instrumenting or modifying production runtime code.

## Requirements

### Requirement: REQ-BENCH-1 Isolated Benchmark Runner Entry Point
The system MUST provide a dedicated benchmark runner under `tests/perf/` invocable via `npm run bench` and `make bench` that executes independently of `npm test`, `npm run test:browser`, and `npm run test:inject`, with Chromium JavaScript coverage instrumentation disabled.

#### Scenario: Running benchmark with coverage disabled
- **GIVEN** a built extension target or standalone `darkreader.js` bundle
- **WHEN** a developer runs `npm run bench`
- **THEN** the runner executes against local HTTP fixtures without enabling Puppeteer JS coverage and without invoking Jest or Karma test suites.

### Requirement: REQ-BENCH-2 Deterministic Local Fixture Corpus
The benchmark runner MUST serve all test workloads from local deterministic assets without external network requests, covering article, image gallery, dashboard, SPA `MutationObserver` and inline-style churn, open/closed Shadow DOM with `adoptedStyleSheets`, formula markup, and native-dark pages.

#### Scenario: Offline fixture execution
- **GIVEN** the local benchmark HTTP server is started
- **WHEN** any benchmark case loads a fixture page
- **THEN** all HTML, CSS, script, and image assets are served locally with zero outbound network requests.

### Requirement: REQ-BENCH-3 Engine, Standalone API, and Browser Matrix
The benchmark runner MUST support measuring across baseline modes (no extension, extension disabled), all four theme engines (`cssFilter`, `svgFilter`, `dynamicTheme`, `staticTheme`), and the standalone API (`darkreader.js`), reporting Chromium and Firefox results separately and recording unsupported browser metrics as `null` with an explicit reason rather than `0`.

#### Scenario: Unsupported metric handling on Firefox
- **GIVEN** a benchmark run executing on Firefox where Chromium-specific tracing metrics are unavailable
- **WHEN** the runner writes the structured result record
- **THEN** unsupported metric fields are set to `null` with a non-empty reason string and Firefox results are reported separately from Chromium results.

### Requirement: REQ-BENCH-4 Warm-up, Sample Count, and Cold vs. Warm Separation
The benchmark runner MUST separate cold (fresh profile) runs from warm (`sessionStorage` / repeated navigation) runs, discard 5 warm-up iterations, execute 20 measured iterations per supported case by default (configurable for smoke runs), and preserve raw samples, failures, median, p95, sample count, and environment metadata.

#### Scenario: Cold vs. warm statistical output
- **GIVEN** a benchmark run completes for a fixture and engine mode
- **WHEN** the output JSON and summary table are generated
- **THEN** cold and warm runs appear as distinct series with `warmupCount`, `sampleCount`, `median`, `p95`, raw sample array, and environment metadata (commit, browser, OS, CPU, theme settings, fixture hash, build mode).

### Requirement: REQ-BENCH-5 Uninstrumented Baseline vs. Diagnostic Image-Stage Mode
The benchmark runner MUST run uninstrumented by default and MUST capture internal image-stage timings only when an explicit diagnostic mode flag is enabled, keeping diagnostic runs separate from baseline results.

#### Scenario: Diagnostic mode isolation
- **GIVEN** `npm run bench` is invoked without diagnostic flags
- **WHEN** baseline metrics are collected
- **THEN** no diagnostic image-stage hooks are injected and results are tagged as uninstrumented baseline.

### Requirement: NFR-BENCH-1 Zero Production Code or FOUC Budget Regression
Adding the `engine-measurement` capability MUST NOT modify production runtime behavior in `src/` or weaken existing `REQ-PERF-*`, `NFR-PERF-*`, `REQ-FOUC-*`, or `NFR-FOUC-*` requirements, and MUST keep `npm test`, `npm run lint`, `npm run build`, and `npm run api` passing.

#### Scenario: Production isolation check
- **GIVEN** the `engine-measurement` runner and fixtures are implemented
- **WHEN** `npm test`, `npm run lint`, `npm run build`, and `npm run api` are executed
- **THEN** all suites and builds pass with zero production source changes in `src/`.
