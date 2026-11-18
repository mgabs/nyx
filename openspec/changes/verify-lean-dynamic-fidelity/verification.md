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
| Article | Dynamic | 47.65 | 20.14 | 2,838,208 |
| Article | Lean | 47.70 | 18.80 | 2,713,272 |
| SPA churn | Dynamic | 48.68 | 25.38 | 2,880,908 |
| SPA churn | Lean | 47.69 | 22.59 | 2,874,282 |

Page ready includes navigation, verification that the selected theme applied, and two animation frames. The SPA fixture adds 200 nodes once. Task duration is a renderer metric, not total CPU usage; JS heap is page heap, not total browser or extension memory. A single device, browser and short workload cannot establish a general performance advantage. This run was repeated after the settings fix. Raw records: `/private/tmp/nyx-perf-after-palette.jsonl`.

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

## Declaration compatibility

A focused browser test checks that a wrapped declaration supports native `item`, `setProperty`, `getPropertyPriority`, and `removeProperty` calls and that edits update themed output. It passed individually in both Firefox and Helium. It does not remove the documented limitation for declarations retained before hook installation.

## Adopted-sheet reconciliation mutation probe

A browser-driven Stryker run mutated only `syncPageAdoptedSheets` in `src/inject/lean-theme/index.ts` (lines 158–209), with the focused Firefox injection suite. A Karma setup bridged Stryker's active mutation into the browser and was verified to select active mutation IDs. The run killed 33 of 56 mutants and left 23 survivors: **58.93%**, below the 95% target. Survivors include sheet removal/re-adoption, variable processing, rule signatures and branches that require equivalence review. This is a partial slice, not a full-project mutation score. Raw report: `/private/tmp/nyx-index-mutation.log`. Reproduce using Stryker 10 with `NYX_KARMA_BIN` set to the absolute Karma executable, `FIREFOX_BIN` set to Firefox, and `stryker run tests/inject/stryker.lean-reconciliation.json`. Subsequent targeted runs confirmed that the new re-adoption test kills the `managers.delete` mutation and the adopted-image test kills the modifier-options mutation. The variable registration mutation still survived the new variable tests; those tests do not close that gap. The four new re-adoption, variable and no-image-analysis scenarios pass individually in Helium and as part of the 33-test focused Firefox suite.

## Import depth mutation probe

The import-cycle and cancellation guard at `style-manager.ts:152` was probed with 10 browser-driven mutants: six were killed, two timed out, and two survived, for an 80% Stryker score. Both survivors changed the 32-level depth limit. A subsequent test builds a 40-level import chain and asserts that only the first 31 imports are fetched; it passes in Firefox and Helium. A focused rerun on the depth expression killed all three of its mutants, including the previous two survivors. This focused result does not establish the score for the rest of the lifecycle slice. Raw reports: `/private/tmp/nyx-cycle-mutation.log` and `/private/tmp/nyx-depth-mutation.log`.

## Quoted import conditions

Two new Firefox tests first failed with the preceding implementation: quoted semicolons caused the import condition to be truncated, and quoted closing parentheses ended `supports()` parsing early. The parser now preserves quoted strings in both cases. The focused Firefox suite passes 38/38, the full Firefox injection suite passes 180/180, and both cases pass individually in Helium. Red and green logs are in `/private/tmp/nyx-semicolon-red.log`, `/private/tmp/nyx-parenthesis-red.log`, and `/private/tmp/nyx-parenthesis-green.log`.

## Import-condition scanner coverage

The quote-aware closing-parenthesis scanner was extracted into Lean-only `import-conditions.ts`. Focused Jest tests report 100% lines and branches. A Stryker run scored 98.11%: 51 killed, one timeout, and one survivor out of 53 (96.23% killed without counting the timeout). The remaining loop-boundary mutant performs one extra out-of-range read, with the same result for ordinary strings. The full Firefox injection suite passed 180/180 after extraction, and four focused import tests passed in Helium. This covers the scanner only, not the rest of the lifecycle slice. Raw report: `/private/tmp/nyx-import-conditions-mutation.log`.

## CSS import scanner coverage

The top-level import scanner was extracted into Lean-only `import-scan.ts`. Focused Jest tests cover quoted and unquoted URLs, escaped text, quoted conditions, nested blocks, malformed input and offsets: 100% lines and branches. Stryker scored 98.77%: 77 killed, three timeouts and one survivor out of 81 (95.06% killed without counting timeouts). The survivor advances one extra character over `@`, which has no effect on the scanner's quote or brace state. After extraction, the full Firefox injection suite passed 180/180, all 205 unit tests passed, and five focused import checks passed in Helium. This result is scoped to the scanner; other lifecycle logic remains below or unmeasured against the target. Raw report: `/private/tmp/nyx-import-scan-mutation2.log`.

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
