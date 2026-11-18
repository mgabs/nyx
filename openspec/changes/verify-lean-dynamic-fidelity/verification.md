# Verification notes

## Preliminary performance probe

An ad hoc Helium headless probe explicitly selected each engine through the extension and verified that it applied to the page. It used one warmup and three measured new-page iterations per fixture on one machine. The first article navigation for each engine was aborted by the known blank-page reload and retried; those warmups are excluded below. These are preliminary medians, not a performance claim.

| Fixture | Engine | Page ready (ms) | Renderer task time (ms) | Page JS heap (bytes) |
| --- | --- | ---: | ---: | ---: |
| Article | Dynamic | 47.99 | 20.75 | 2,837,976 |
| Article | Lean | 49.54 | 19.74 | 2,712,404 |
| SPA churn | Dynamic | 47.81 | 26.57 | 2,894,392 |
| SPA churn | Lean | 47.90 | 23.35 | 2,870,804 |

The page-ready timing includes navigation and two animation frames; the SPA fixture adds 200 nodes once. Renderer task time and page JS heap exclude extension background and other browser processes. Three samples, one browser, one device, and the short observation window are insufficient to establish startup, CPU, or memory improvement. The existing benchmark runner cannot perform this comparison correctly because it accepts engine names without selecting the requested engine.

## Repeatable Helium performance comparison

Run `npm run build`, then `CHROME_BIN="<Helium executable>" node tests/perf/compare-lean.mjs`. The script selects and verifies the engine in the installed extension, emits one JSON record per iteration, and defaults to one warmup plus ten measured new-page iterations per fixture. It records navigation retries and errors; errors set a failing process exit code. This run used Helium headless on one machine, with no competing test browsers. The first article warmup for each engine required one retry after a navigation abort; no measured iteration retried or failed.

| Fixture | Engine | Page ready median (ms) | Renderer task median (ms) | Page JS heap median (bytes) |
| --- | --- | ---: | ---: | ---: |
| Article | Dynamic | 47.73 | 20.21 | 2,838,208 |
| Article | Lean | 48.51 | 19.07 | 2,713,016 |
| SPA churn | Dynamic | 47.39 | 26.51 | 2,893,368 |
| SPA churn | Lean | 48.07 | 22.94 | 2,873,664 |

Page ready includes navigation, verification that the selected theme applied, and two animation frames. The SPA fixture adds 200 nodes once. Task duration is a renderer metric, not total CPU usage; JS heap is page heap, not total browser or extension memory. A single device, browser and short workload cannot establish a general performance advantage. Raw records: `/private/tmp/nyx-perf-final.jsonl`.

## Retrospective red-green baseline

An isolated `git archive HEAD` copy (scaffolding commit `9bf571af`) was run in Firefox against the current 26 focused Lean injection tests, with the same test sources and no production changes copied into that baseline. It produced 14 failures and 12 passes. Expected failures included nested cross-origin imports, document and shadow-root inline cleanup, shared adopted sheets, same-count declaration edits and document export. The failed-import, cycle, and late-switch cases already passed on the baseline; they are regression checks rather than reproduced defects. The current implementation passes all 26. Baseline output: `/private/tmp/nyx-baseline-red.log`.

## Palette and settings regression

A new Firefox regression test failed against commit `4b8ba29d`: changing Lean's palette and brightness left document colors unchanged. Clearing Lean's registered palette before regenerating styles made the test pass. The expanded test also verifies inline and shadow-root adopted styles, and a separate test checks ignored inline selectors. All 28 focused Firefox tests and the full 170-test Firefox injection suite passed; the two settings and ignored-selector checks also passed in an isolated Helium run. A separate isolated Helium run passed five checks covering site fixes, shadow roots, the no-sync/no-canvas constraint, and Dynamic proxy isolation. The full Helium focused suite again stopped on the pre-existing page reload.

## Current project checks

On 18 November, the default injection command initially attempted Chrome, Firefox and Safari and could not find Google Chrome; it was stopped and rerun with `--ci` and explicit browser binaries. Unit tests passed 187/187, Firefox injection passed 168/168, Firefox packaged-extension tests passed 31/31, and lint, TypeScript, release build and API build passed. The full Helium injection run stopped after 87 of 168 tests with an unexpected full-page reload. The same unmodified baseline suite stopped after 60 of 148 tests with the same reload (`/private/tmp/nyx-baseline-helium.log`). The full `npm run test:browser` run using Helium failed 9 of 31 tests with navigation aborts; it stopped before its Firefox stage, which was run separately. This limitation remains open and must not be presented as a passing full browser gate.

## Preliminary mutation run

Stryker 10.1.1 was installed outside the repository. The latest scoped run mutating `src/inject/lean-theme/adopted-emitter.ts` with the Jest unit suite scored 95.58%: 172 mutants were killed, one timed out, and eight survived, out of 181. Killed mutants alone account for 95.03%. This run does not execute the browser injection tests and does not establish the score for other changed files. The raw console report was saved to `/private/tmp/nyx-emitter-mutants-95.log`.

Focused Jest unit coverage for `adopted-emitter.ts` reached 100% lines and 100% branches. This does not establish coverage for the other changed files or the excluded page proxy.

The full Firefox injection run passed 168 tests. Its browser instrumentation reported line/branch coverage of 85.32%/76.47% for `adopted-emitter.ts`, 82.31%/75.84% for `index.ts`, 71.87%/57.14% for `inline-style.ts`, and 88.88%/77.21% for `style-manager.ts`. These are separate from the focused Jest figures and below the required 95% thresholds. The browser instrumentation excludes `stylesheet-proxy.ts`.

## Latest Firefox injection coverage

After the settings fix, `FIREFOX_TEST=1 npm run test:inject -- --ci --coverage` passed 170 tests. Browser instrumentation reports line/branch coverage: emitter 84.40%/76.56%, index 82.35%/75.84%, inline styles 78.12%/59.52%, and style manager 88.88%/77.21%. These figures include browser integration coverage and remain below 95%; they are distinct from the emitter's 100% focused Jest coverage. The page proxy is excluded by the instrumentation configuration. Mutation scores for the other slices remain unmeasured.

## Packaged extension check

The packaged extension integration test passed individually in Firefox and Helium, including a direct CSSOM declaration update, one constructed stylesheet shared by two shadow roots, and page-authored adopted-sheet reordering. It exposed and then verified a Firefox page-realm array fix that the standalone injection tests did not detect. The full Helium extension suite still has the separately reproduced blank-page reload problem.

## Existing requirement identifier collision

The active `add-lean-dynamic-theme` change and the durable `lean-dynamic-theme` specification use the same identifiers for different requirements. They cannot be reconciled by key alone.

| Key | Active change delta | Durable specification |
| --- | --- | --- |
| REQ-LEAN-1 | Engine registration and wiring | Fallback cleanup and loading counter |
| REQ-LEAN-2 | Palette and site fixes | Re-render of updated and cross-origin sheets |
| REQ-LEAN-3 | Shared transforms and constructed output | Override and inline cascade order |
| REQ-LEAN-4 | Variables, cache, observers and export | Page-authored adopted sheets |
| NFR-LEAN-1 | No canvas and documentation | No canvas or injected DOM styles |

The original change's unchecked tasks remain unchecked: existing code or passing individual tests do not prove its red-green, coverage, mutation, or full verification gates. The new change uses distinct `REQ-LEAN-FIDELITY-*` keys; any durable-spec reconciliation or archive must preserve requirements by their complete text and scenarios, not assume that identical old keys mean identical requirements.

### Earlier checklist reconciliation

| Earlier tasks | Evidence and disposition |
| --- | --- |
| 3.0–3.2 | Shared helper implementation exists, and current unit and Firefox injection suites pass. Original pre-implementation red evidence and slice-specific verification have not been established; leave unchecked. |
| 3.3 | No 95% coverage and mutation report for the shared helper paths has been established; leave unchecked. |
| 4.0–4.2 | Lean implementation and representative browser tests exist; the current fidelity baseline provides red evidence for the defects listed above, but does not prove all original red scenarios or all original gates. Leave unchecked. |
| 4.3 | Emitter alone meets the focused 95% thresholds; the broader Lean logic does not have a passing complete report. Leave unchecked. |
| 5.0–5.2 | Registration and wiring are present, and Firefox packaged tests pass. Original wiring red evidence and a passing full Helium browser gate are not established. Leave unchecked. |
| 6.1–6.2 | Human comprehension review, integration and archive of that change have not occurred. Leave unchecked. |

The durable `openspec/specs` tree has no changes in this worktree. Identifier collisions remain documented above; no requirement has been renamed or assumed equivalent solely from its key.
