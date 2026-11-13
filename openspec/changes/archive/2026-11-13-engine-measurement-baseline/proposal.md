# Proposal

## Intent
Establish a reproducible, isolated performance benchmark runner (`npm run bench` in `tests/perf/`) and local fixture corpus (Option B) to measure Nyx's page-injection and dynamic-theming baseline across Chrome (MV2/MV3), Firefox, and the standalone API (`darkreader.js`) before any optimization work begins.

## Problem Statement
Nyx currently lacks end-to-end runtime performance measurements for its theme engines (`cssFilter`, `svgFilter`, `staticTheme`, `dynamicTheme`) and standalone API. Existing unit timing checks (`tests/unit/utils/color.tests.ts`) do not capture browser CSSOM, Shadow DOM, `MutationObserver`, or MV3 service-worker `DOCUMENT_CONNECT` overhead, and `tests/browser/environment.js` enables Chromium JS coverage which distorts timing. Without a deterministic baseline, optimization work risks guessing bottlenecks or introducing unverified FOUC regressions.

## Capabilities

### New Capabilities
- `engine-measurement`: Isolated Puppeteer-based local benchmark runner (`tests/perf/`), deterministic fixture corpus, structured raw/summary JSON + markdown output, and `npm run bench` / `Makefile` entry points.

### Modified Capabilities
- None (existing `core-perf` and `zero-fouc` specs remain unmodified and their requirements preserved).

## Scope

### In-Scope
- Isolated benchmark runner in `tests/perf/` reusing `puppeteer-core`, browser path resolution (`tests/browser/paths.js`), and local HTTP server helpers (`tests/browser/server.js`) without Chromium JS coverage instrumentation.
- Deterministic local fixtures covering: article, image gallery, dashboard, SPA `MutationObserver` + inline-style churn, open/closed Shadow DOM + `adoptedStyleSheets`, formula markup, and native-dark page.
- Engine/mode matrix: no extension installed, extension installed but disabled, CSS Filter, SVG Filter, Dynamic, Static, and standalone API (`darkreader.js`).
- Protocol: separate cold (fresh profile) vs. warm (`sessionStorage` / repeated navigation) runs, 5 excluded warm-up runs + 20 measured runs, reporting median, p95, sample count, variance, and explicit `null` with reason for unsupported browser metrics (e.g., Firefox vs. Chromium tracing).
- Optional diagnostic image-stage timing mode, separate from uninstrumented baseline runs.
- `npm run bench` in `package.json` and a `Makefile` `bench` target; raw results stored under an ignored output directory.

### Out-of-Scope (YAGNI)
- Modifying production runtime code in `src/` (no optimizations, no new engines, no entropy/OCR classification).
- Removing `__PLUS__`, `__THUNDERBIRD__`, `src/stubs/`, or `src/ui/popup/components/`.
- Adding Playwright or external benchmarking frameworks.
- Crawling live external websites or enforcing hard CI pass/fail timing thresholds before variance is measured.

## Assumptions
- **ASM-GEN-1**: Local Chrome and Firefox binaries are resolvable via `tests/browser/paths.js` (`getChromePath`, `getFirefoxPath`) on developer machines.
- **ASM-GEN-2**: Reusing `tests/browser/server.js` and `tests/browser/paths.js` (with JS coverage disabled) introduces zero regression to `npm run test:browser`.

## Success Metrics
- `npm run bench` completes deterministically across all configured local fixtures and emits structured JSON + console summary table (median, p95, sample count, environment metadata) with zero production code changes.
- All existing verification gates (`npm test`, `npm run test:browser`, `npm run test:inject`, `npm run lint`, `npm run build`, `npm run api`) continue to pass.

## Review Gate
- [ ] **Gate 1 Approval**: Proposal reviewed and approved by human before drafting specs.
