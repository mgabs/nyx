# Research & Technical Tradeoffs

## 1. Intent & Ground Truth

Establish reproducible engine measurements before optimizing or introducing profiles.

- `src/generators/theme-engines.ts` defines CSS Filter, SVG Filter (Filter+), Static, and Dynamic engines.
- `tests/browser/environment.js` already launches Chromium/Firefox through Puppeteer, installs test extensions, serves local pages, and changes settings through test WebSockets. It also enables Chromium JavaScript coverage, which must be disabled during performance measurement.
- `tests/unit/utils/color.tests.ts` contains parser timing checks, not end-to-end engine measurements.
- `src/inject/dynamic-theme/image.ts` already samples images at roughly 1,024 pixels and queues analysis; entropy would extend existing analysis.
- Current zero-FOUC requirements demand zero bright frames. Stylesheet-presence assertions cannot prove compositor paint behavior.
- Chromium tracing and Firefox measurements must be reported separately; unsupported metrics must be null with a reason, never zero.

Candidate fixtures: article, image gallery, dashboard, deterministic SPA mutations, Shadow DOM, formula markup, and native-dark page. Fix assets and workloads locally; real-site compatibility checks are supplementary and must not send customer data elsewhere.

Proposed matrix: no extension installed, extension installed but disabled, CSS Filter, SVG Filter, Dynamic, and Static. Keep theme settings identical and record site-specific fixes. Static quality depends on selector coverage; do not silently give it special fixtures.

Separate fresh-profile runs from repeated-navigation runs. Use five excluded warm-ups and twenty measured runs per supported case, preserve raw samples and failures, and report median/p95 plus sample count. A fresh profile alone does not guarantee cold OS or network caches; record precisely which caches are controlled.

Measure navigation-to-dark/stable checkpoints, frame evidence, main-thread CPU and long tasks, scripted interaction/frame timing, memory where supported, and screenshots. Define stable theme as fixture expectations satisfied with no relevant style mutation for a bounded settling interval; this is not proof that all async work finished.

Capture image-stage timings only in an explicitly instrumented diagnostic run, separate from uninstrumented baseline runs. Screenshot filmstrips can miss frames; zero-FOUC proof requires validated compositor/presentation coverage, otherwise report observed bright frames with an incomplete-coverage qualifier. Retain trace timestamps and measurement overhead metadata.

## 2. Options Explored

### Option A: Extend Jest correctness tests with timing assertions

Reuse existing fixtures and setup directly. Minimal scaffolding, but coverage instrumentation, test builds, asynchronous polling, and suite teardown contaminate timing; noisy shared CI makes hard thresholds misleading.

### Option B: Dedicated runner using existing Puppeteer and server helpers

Add a separate benchmark entry point and deterministic fixtures, reusing browser path resolution and settings mechanisms where appropriate. Keep performance collection out of ordinary tests, store structured raw results and optional traces/screenshots under an ignored output directory, and expose a Make target plus manually triggered CI smoke run.

Start with supported Chromium metrics and Firefox portable checkpoints/screenshots; mark unsupported browser metrics explicitly. Full benchmark runs remain opt-in until variance is measured. Record commit, browser, OS, CPU, theme, fixture hash, build mode, warm/cold definition, and collector availability. Compare only compatible environments.

### Option C: New performance framework and real-site crawl

A specialized runner could provide dashboards and device orchestration, but introduces dependencies, nondeterministic page content/network behavior, and maintenance unrelated to establishing the first baseline.

## 3. Tradeoff Matrix

| Criteria | Option A | Option B | Option C |
| :--- | :--- | :--- | :--- |
| Complexity | Low initial, high isolation effort | Moderate and bounded | High |
| New Dependencies | None | None initially | Framework/service dependencies |
| Performance & Latency | Coverage/polling distorts results | Isolated runs; explicit collector overhead | Broad metrics but network variance |
| Maintenance Burden | Coupled to correctness suites | Small runner and fixtures | Framework and live-site upkeep |
| Blast Radius | Existing tests and CI | Opt-in benchmark tooling | CI, external services, browser orchestration |

## 4. Recommendation

Choose Option B: an isolated local-fixture runner using existing Puppeteer infrastructure, with raw results and browser-specific capabilities. Establish observed variance before enforcing regression budgets; do not add engines, OCR, entropy classification, or production optimization in this change.

## 5. Breaking Changes & Deprecations

None proposed. Preserve `REQ-PERF-1`, `REQ-PERF-2`, `NFR-PERF-1`, `REQ-FOUC-1`, `REQ-FOUC-2`, and `NFR-FOUC-1`; add a separate measurement capability without weakening their targets or claiming measurements that the collector cannot verify.

## Review Gate

- [ ] **Gate 0 Decision**: Human decides Go (name the option) or No-Go before the proposal is drafted.
