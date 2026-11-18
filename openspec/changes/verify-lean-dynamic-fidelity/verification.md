# Verification notes

## Review guide and current scope

Lean tracks each page stylesheet separately for every document or accessible open shadow root. Page-level hooks notify Lean of supported CSSOM and adoption changes; a coalesced watcher updates the owned output sheets in page cascade order. Lean removes its sheets and inline markers on teardown, and generation checks prevent late stylesheet loads from reviving an old theme. The declaration wrapper is enabled only for Lean and restores native prototypes on cleanup. Writes through declarations retained before hooks were installed, and changes when hooks are unavailable, remain documented limitations.

The changed reconciliation components and injector wiring were measured together at 197/199 killed mutations, with no timeouts; a later whole-injector unit mutation run fell below target as recorded below; the Lean-only declaration block was measured separately at 64/67 killed. Before the latest review fixes, the stylesheet manager, inline styling, emitter, import scanners and condition wrapping each had scoped reports meeting the 95% line, branch and mutation targets; affected scopes require fresh reports. The whole injector file still has lower browser-instrumented coverage, and the full Helium suites retain the independently reproduced reload/navigation failure. The checklist must not imply that those broader checks passed. A human reviewer must inspect the implementation and evidence before the comprehension gate can be completed.


## Review findings and fixes

A review found that Lean reused Dynamic's animation-frame fallback when a stylesheet was unavailable. A focused Firefox test failed because it scheduled a frame; after introducing a Lean-only watcher for stylesheet and load events, it passed in Firefox and Helium. The watcher coalesces events and invalidates callbacks on stop. Dynamic keeps its original watcher. Raw red and green outputs: `/private/tmp/nyx-lean-no-poll-red.log`, `/private/tmp/nyx-lean-no-poll-green.log`, and `/private/tmp/nyx-lean-no-poll-helium.log`.

A second review test showed that changing a nested `@media` rule did not update the theme; the Firefox red result showed white rather than themed output. After Lean-only grouping-rule interception, insertion passed, but removal left a stale themed rule in Helium. A separate regular-stylesheet test reproduced the same stale removal in Firefox. Lean now rebuilds adopted output when explicitly rendered and marks regular managers dirty on a stylesheet event. Both insertion and removal pass for regular and adopted sheets in Firefox and Helium. Raw results: `/private/tmp/nyx-lean-group-red.log`, `/private/tmp/nyx-lean-group-helium.log`, `/private/tmp/nyx-lean-group-regular-red.log`, `/private/tmp/nyx-lean-group-both-firefox.log`, and `/private/tmp/nyx-lean-group-both-helium.log`. These review fixes postdate the performance measurement below; it does not measure their impact.

The full post-fix Firefox injection suite passed 193/193, the packaged Firefox suite passed 31/31 before the subsequent generation guard, and the unit suite passed 326/326 with lint, extension build and API build passing. Focused coverage for the Lean event watcher and adopted renderer was 100% lines and branches; the stylesheet manager was 100% lines and 98.5% branches. A post-fix mutation run killed all 26 watcher and all 23 renderer mutants, and 176 of 182 manager mutants (96.70%), without timeouts. The expanded Lean-specific proxy ranges initially killed 83 of 89 mutations (93.26%); after adding native receiver, cleanup and grouping availability tests, the expanded ranges killed 93 of 97 (95.88%) with no timeouts. Raw output: `/private/tmp/nyx-proxy-review-mutation2.log`. Raw reports: `/private/tmp/nyx-review-coverage.log`, `/private/tmp/nyx-review-mutation.log`, `/private/tmp/nyx-firefox-final-review.log`, and `/private/tmp/nyx-firefox-packaged-review.log`.

A lifecycle review also found that an adopted-sheet render callback could see a newly enabled theme as active after its original theme was removed. A focused test first failed because the old callback returned active after re-enabling Lean; the callback now captures the theme generation and the test passes. This demonstrates cancellation of the old callback, rather than a reproduced visible restoration of a stale sheet. The guard killed all seven scoped mutations without timeouts. Raw outputs: `/private/tmp/nyx-adopted-generation-red.log`, `/private/tmp/nyx-adopted-generation-green.log`, and `/private/tmp/nyx-generation-mutation.log`.

## Reload assumption

For this review, the user chose to assume a page reload and not require detection of writes through declaration objects retained before the hooks were installed. A reload alone does not guarantee that hooks run before every page script, so this assumption does not establish support for those writes; the runtime limitation remains documented. Pre-existing adopted stylesheets remain in scope.

## Latest verification and remaining gates

The full Firefox injection suite passed 193/193 tests after the review fixes and seven earlier checks for theme options, dynamically inserted content, shadow styles, style removal and scheduling without animation frames. A direct lifecycle test suite also checks deferred initialization, teardown, coalesced updates, shadow roots and stale loading callbacks. Its focused injector coverage after the generation fix is 98.71% lines and 95.4% branches. A subsequent full-file Jest-driven mutation run on index.ts killed 419 of 617 mutants (67.91% outright), with no timeouts, 193 survivors and five not covered. This was measured before the review fixes below. This is below 95% and does not execute browser injection tests. The narrower reconciliation results below do not replace this full-file result. Raw output: `/private/tmp/nyx-index-mutation-full2.log`; reproduce with `tests/unit/stryker.lean-index.mjs` and the separately installed Stryker runner described below. After further static-output, boundary and warning assertions, a focused rerun of that section killed 92 of 98 mutations, with three survivors and three uncovered (93.88%); raw output: `/private/tmp/nyx-index-static-mutation3.log`. The remaining six all affect guards for an absent current theme.

A combined reusable unit mutation run across 14 Lean modules and the Lean-only proxy block killed 920 of 957 mutations (96.13%); nine timed out and 28 survived. Its Stryker score, which counts timeouts, was 97.07%. The stylesheet manager's earlier isolated run killed 170 of 175 mutations without timeouts. The combined reconciliation browser and unit run separately killed 197 of 199 mutations without timeouts. The combined unit configuration is `tests/unit/stryker.lean.mjs`; it requires Stryker and its Jest runner installed separately, with `NYX_STRYKER_JEST_PLUGIN` pointing to the runner's entry point. Raw combined output: `/private/tmp/nyx-all-lean-mutation-final.log`.

The human comprehension review and final integration remain open. Full Helium suites still encounter the independently reproduced browser navigation/reload issue described below; isolated representative checks pass, but this is not a full-suite pass.

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

## Performance after review fixes

The same Helium comparison was repeated after the event-driven and generation fixes, with no other test suites running: one warmup and ten measured iterations per engine and fixture. No measured iteration retried. Medians follow; the same measurement limitations described above apply, and the workload does not measure every kind of CSSOM churn.

| Fixture | Engine | Page ready (ms) | Renderer task time (ms) | Page JS heap (bytes) |
| --- | --- | ---: | ---: | ---: |
| Article | Dynamic | 57.01 | 23.56 | 2,841,420 |
| Article | Lean | 61.27 | 21.14 | 2,717,436 |
| SPA churn | Dynamic | 60.94 | 27.53 | 2,904,446 |
| SPA churn | Lean | 53.64 | 24.63 | 2,879,376 |

Raw output: `/private/tmp/nyx-perf-final-review.jsonl`.

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

A browser-driven Stryker run mutated only `syncPageAdoptedSheets` in `src/inject/lean-theme/index.ts` (lines 158–209), with the focused Firefox injection suite. A Karma setup bridged Stryker's active mutation into the browser and was verified to select active mutation IDs. The run killed 33 of 56 mutants and left 23 survivors: **58.93%**, below the 95% target. Survivors include sheet removal/re-adoption, variable processing, rule signatures and branches that require equivalence review. This is a partial slice, not a full-project mutation score. Raw report: `/private/tmp/nyx-index-mutation.log`. Reproduce using Stryker 10 with `NYX_KARMA_BIN` and `NYX_JEST_BIN` set to the absolute Karma and Jest executables, `FIREFOX_BIN` set to Firefox, and `stryker run tests/inject/stryker.lean-reconciliation.json`. Subsequent targeted runs confirmed that the new re-adoption test kills the `managers.delete` mutation and the adopted-image test kills the modifier-options mutation. The variable registration mutation still survived the new variable tests; those tests do not close that gap. The four new re-adoption, variable and no-image-analysis scenarios pass individually in Helium and as part of the 33-test focused Firefox suite.

## Reconciliation orchestration after extraction

The browser-driven mutation run was repeated after the pure selection extraction using `tests/inject/stryker.lean-reconciliation.json`. It killed 27 of 48 mutations, with 21 survivors and no timeouts: **56.25%** for the remaining `syncPageAdoptedSheets` orchestration. Survivors include inaccessible-sheet handling, variable matching, ordering guards and initial rule signatures. The extracted selection helpers separately scored 100%; neither figure proves the entire adopted-sheet slice meets 95%. Raw report: `/private/tmp/nyx-index-mutation-after-refactor.log`.

## Import depth mutation probe

The import-cycle and cancellation guard at `style-manager.ts:152` was probed with 10 browser-driven mutants: six were killed, two timed out, and two survived, for an 80% Stryker score. Both survivors changed the 32-level depth limit. A subsequent test builds a 40-level import chain and asserts that only the first 31 imports are fetched; it passes in Firefox and Helium. A focused rerun on the depth expression killed all three of its mutants, including the previous two survivors. This focused result does not establish the score for the rest of the lifecycle slice. Raw reports: `/private/tmp/nyx-cycle-mutation.log` and `/private/tmp/nyx-depth-mutation.log`.

## Quoted import conditions

Two new Firefox tests first failed with the preceding implementation: quoted semicolons caused the import condition to be truncated, and quoted closing parentheses ended `supports()` parsing early. The parser now preserves quoted strings in both cases. The focused Firefox suite passes 38/38, the full Firefox injection suite passes 180/180, and both cases pass individually in Helium. Red and green logs are in `/private/tmp/nyx-semicolon-red.log`, `/private/tmp/nyx-parenthesis-red.log`, and `/private/tmp/nyx-parenthesis-green.log`.

## Import-condition scanner coverage

The quote-aware closing-parenthesis scanner was extracted into Lean-only `import-conditions.ts`. Focused Jest tests report 100% lines and branches. A Stryker run scored 98.11%: 51 killed, one timeout, and one survivor out of 53 (96.23% killed without counting the timeout). The remaining loop-boundary mutant performs one extra out-of-range read, with the same result for ordinary strings. The full Firefox injection suite passed 180/180 after extraction, and four focused import tests passed in Helium. This covers the scanner only, not the rest of the lifecycle slice. Raw report: `/private/tmp/nyx-import-conditions-mutation.log`.

## CSS import scanner coverage

The top-level import scanner was extracted into Lean-only `import-scan.ts`. Focused Jest tests cover quoted and unquoted URLs, escaped text, quoted conditions, nested blocks, malformed input and offsets: 100% lines and branches. Stryker scored 98.77%: 77 killed, three timeouts and one survivor out of 81 (95.06% killed without counting timeouts). The survivor advances one extra character over `@`, which has no effect on the scanner's quote or brace state. After extraction, the full Firefox injection suite passed 180/180, all 205 unit tests passed, and five focused import checks passed in Helium. This result is scoped to the scanner; other lifecycle logic remains below or unmeasured against the target. Raw report: `/private/tmp/nyx-import-scan-mutation2.log`.

## Adopted-sheet selection coverage

The pure decisions for selecting removed and newly adopted page sheets were extracted into Lean-only `adopted-reconciliation.ts`. Focused Jest tests report 100% lines and branches, with identity, order, duplicate and owned-sheet cases. Stryker killed all 22 mutations (100%, no timeouts). After extraction, the full Firefox injection suite passed 180/180, all 207 unit tests passed, and five focused adopted-sheet tests passed in Helium. This covers sheet selection only; the browser orchestration still requires a fresh mutation and coverage assessment. The reusable Stryker configuration was updated to the new line range. Raw report: `/private/tmp/nyx-reconciliation-pure-mutation.log`.

## Import condition wrapping coverage

Layer, supports and media wrapping was extracted into Lean-only `import-wrapping.ts`. Focused Jest tests report 100% lines and branches; Stryker killed 53 of 55 mutants (96.36%) with no timeouts. The two survivors concern an equivalent layer-regex backtracking variation and comparing a closing-parenthesis index against zero rather than negative one; a valid closing index is always greater than zero. After extraction, Firefox injection passed 180/180, all 219 unit tests passed, and five focused import cases passed in Helium. This covers wrapping only, not the remaining asynchronous lifecycle boundaries. Raw report: `/private/tmp/nyx-import-wrapping-mutation2.log`.

## Stylesheet manager lifecycle coverage

Focused Jest tests exercise readable and inaccessible sheets, import expansion, failed and cached fetches, document readiness, pause, destruction, stale loading tokens and teardown. `style-manager.ts` has 100% line and 98.46% branch coverage. Stryker killed 170 of 175 mutations (97.14%), with five survivors and no timeouts. The tests bound intentionally recursive mocked requests, so mutations that remove cycle guards fail promptly rather than exhausting a worker. Firefox injection passed 180/180 and four focused lifecycle and engine-switch cases passed in Helium. These results cover the manager, not all other lifecycle modules. Raw reports: `/private/tmp/nyx-style-manager-unit5.log` and `/private/tmp/nyx-style-manager-mutation5.log`.

## Inline styling and cleanup coverage

Focused Jest tests cover every override-to-property mapping, marked and unmarked cleanup, ignored selectors, missing styles, gradients, functional results, HTML, SVG and nested shadow roots. `inline-style.ts` has 100% line and branch coverage; Stryker killed 159 of 166 mutations (95.78%) with no timeouts. The unused element-root traversal branches were removed; production callers pass only documents or shadow roots. Firefox injection passed 180/180 after the change and six focused inline/engine-switch cases passed in Helium. Raw reports: `/private/tmp/nyx-inline-unit3.log` and `/private/tmp/nyx-inline-mutation2.log`.

## Adopted-sheet synchronization coverage

The remaining sheet synchronization was extracted into Lean-only `adopted-sync.ts`. Focused Jest tests cover inaccessible roots and sheets, per-root tracking, additions, removals, owned outputs, rule signatures and ordering around the override anchor. The module has 100% line and branch coverage; Stryker killed 44 of 45 mutants (97.78%) with no timeouts. The survivor changes `sourceIndex > anchorIndex` to `>=`; equality cannot occur for a page sheet because the anchor is an owned sheet excluded from candidates. Firefox injection passed 180/180, all 261 unit tests passed, and five focused adopted-sheet tests passed in Helium. The reusable browser mutation configuration now covers the extracted module and the remaining injector wrapper. Raw report: `/private/tmp/nyx-adopted-sync-mutation2.log`.

## Injector reconciliation wrapper

The browser wrapper that connects adopted-sheet synchronization to the variable store had three surviving mutations in its initial scoped probe. A new regression asserts both themed output and the queue/match of newly adopted rules. A rerun killed all seven wrapper mutations with no timeouts. Additional late-shadow and removed-style browser cases pass in Firefox and Helium. This is a scoped wrapper result; it does not establish 95% coverage for the entire injector module. Raw report: `/private/tmp/nyx-wrapper-mutation2.log`.

## Adopted output ordering coverage

The pure output-order calculation is now isolated in Lean-only `adopted-order.ts`. Tests verify source order, the override anchor, missing anchors, duplicate outputs and the no-change fast path. It has 100% line and branch coverage, and Stryker killed all 28 mutants with no timeouts. Firefox injection passed 183/183 and four focused cascade/export cases passed in Helium. The browser reconciliation mutation configuration now includes ordering and its direct unit tests. Raw report: `/private/tmp/nyx-adopted-order-mutation2.log`.

## Adopted event watcher, renderer and declaration proxy

`adopted-watch.ts` covers event registration, cleanup-before-dispatch, coalescing, changed and inaccessible sheets, cancellation and variable scheduling. It has 100% line and branch coverage and killed all 42 mutations. `adopted-render.ts` covers theme and root selection, inaccessible rules, output reuse and cancellation: 100% line and branch coverage and all 23 mutations killed. The Lean-only declaration block in `stylesheet-proxy.ts:354–417` has 43/43 covered lines and 28/28 covered branches; Stryker killed 64 of 67 mutations (95.52%) with no timeouts. Its tests include native receiver behavior, pre-existing adopted roots, shared roots, cleanup and the unchanged Dynamic default. After the refactor, Firefox injection passed 183/183, all 284 unit tests passed, and five focused adopted-sheet cases passed in Helium. These scoped figures do not establish coverage for the rest of the shared proxy or entire injector. Raw reports: `/private/tmp/nyx-adopted-watch-mutation3.log`, `/private/tmp/nyx-adopted-render-mutation.log`, and `/private/tmp/nyx-proxy-mutation2.log`.

## Platform-specific adopted-sheet updates

`adopted-apply.ts` tests the Firefox in-place page-array update and Chromium replacement assignment: 100% line and branch coverage, with all six mutations killed. `adopted-reorder.ts` tests missing roots/emitters, override-anchor selection and the no-change case: 100% line and branch coverage, with all 13 mutations killed. Firefox injection passed 183/183, all 289 unit tests passed, and five focused adopted-sheet cases passed in Helium. Raw reports: `/private/tmp/nyx-adopted-apply-mutation.log` and `/private/tmp/nyx-adopted-reorder-mutation.log`.

## Final scoped reconciliation measurement

The combined Stryker run for the seven extracted reconciliation modules and their four injector wiring ranges killed 197 of 199 mutations (98.99%), with no timeouts. The injector ranges individually killed 19 of 20 (95%). Firefox coverage reports all 14 instrumented lines in those wiring ranges covered; there are no branch sites in those ranges. The extracted components each meet at least 97.78% mutation kill and 100% line/branch coverage, and the separately scoped Lean declaration block meets 95.52% mutation kill and 100% line/branch coverage. This does not establish 95% for all of `index.ts`: the focused Firefox coverage run reports 88.77% lines and 81.28% branches for that entire file. Raw reports: `/private/tmp/nyx-reconciliation-combined-final.log` and `/private/tmp/nyx-reconciliation-final-coverage/`.

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
