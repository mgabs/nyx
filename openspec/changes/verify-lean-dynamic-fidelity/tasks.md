# Tasks

## 1. Dependency DAG

```mermaid
flowchart LR
    C[Shared contracts] --> A[Adopted sheets and CSSOM]
    A --> B[Imports and lifecycle]
    B --> E[Document export]
    E --> V[Full verification and evidence]
```

## 2. Streams & Worktrees

| Stream | Worktree Path | Branch | Prerequisite |
| :--- | :--- | :--- | :--- |
| `fidelity` | `.worktrees/verify-lean-dynamic-fidelity-fidelity` | `codex/verify-lean-dynamic-fidelity` | Gate 3 approval; sequential slices share injector state |

## 3. Shared Contracts

- [x] 3.0 Define and commit minimal reconciliation, cancellation and export contracts without changing behavior; verify lint and contract compilation. Evidence: npm run lint and tsc -p src/tsconfig.json --noEmit passed; commit 9bf571af.

## 4. Adopted Sheets and CSSOM

- [x] 4.0 Red: add browser tests for one sheet shared across roots, additions/removals/replacements and real same-count CSSOM edits; capture expected failures. Evidence: isolated Helium Karma run, 3 expected failures and 6 passes.
- [x] 4.1 Green: reconcile each root and detect actual sheet changes without processing owned sheets; verify red tests pass and page-owned sheets survive teardown. Evidence: Firefox focused Karma 26/26 and packaged Firefox/Helium Lean test pass; code and tests committed in 4b8ba29d.
- [ ] 4.2 Measure changed pure logic line/branch coverage and mutation kill against 95% targets; verify reports and address meaningful gaps.

## 5. Imports and Lifecycle

- [x] 5.0 Red: test nested conditional cross-origin imports, failure/cycles, inline cleanup across all override types and shadow roots, and switching during pending loads; capture expected failures. Evidence: Firefox targeted Karma against an isolated `git archive HEAD` baseline: 14 failed and 12 passed; nested import and inline cleanup failed, while failure/cycle and late-switch cases already passed (see verification.md).
- [x] 5.1 Green: resolve imports with conditions and URL bases, cancel stale work and clean owned state; verify red tests and engine-switch regressions pass. Evidence: Firefox focused Karma 26/26 and full injection 168/168; code and tests committed in 4b8ba29d.
- [x] 5.2 Measure changed pure logic line/branch coverage and mutation kill against 95% targets; verify reports and address meaningful gaps. Evidence: manager 100% lines/98.46% branches, 170/175 killed; inline 100%/100%, 159/166 killed; import scanner, condition scanner and wrapping each >=95% lines/branches and killed mutants; see verification.md. Browser orchestration remains under 4.2.

## 6. Document Export

- [x] 6.0 Red: assert exported document rules preserve live cascade and omit shadow rules; capture expected failures. Evidence: targeted Helium Karma run failed on shadow-root leakage before the fix.
- [x] 6.1 Green: serialize document-owned sheets in live order and document the shadow-root limitation; verify exported CSS behavior and live shadow styling. Evidence: Firefox focused Karma 26/26 and packaged Firefox/Helium Lean test pass; code and tests committed in 4b8ba29d.
- [x] 6.2 Measure changed pure logic line/branch coverage and mutation kill against 95% targets; verify reports and address meaningful gaps. Evidence: focused Jest coverage for adopted-emitter.ts 100% lines and branches; Stryker 172/181 killed, 1 timeout, 8 survived, 95.58% score; see verification.md.

## 7. Integration & Rebase Plan

- [x] 7.0 Verify registration, palette and sliders, fixes, ignored selectors, no Lean sync style elements or image-analysis canvas, and Dynamic shared-helper regressions in representative Chrome and Firefox tests; record unavailable environments. Evidence: Firefox injection 170/170; isolated Helium settings 2/2 and fixes/isolation 5/5, packaged Lean test passes in both; full Helium suite reload limitation in verification.md.
- [x] 7.1 Run `npm test`, `npm run test:browser`, `npm run test:inject`, `npm run lint`, `npm run build`, and `npm run api`; record outcomes and any environment blockers. Evidence: command results and Helium navigation/reload blockers recorded in verification.md; Firefox suites and unit, lint, build, and API checks pass.
- [x] 7.2 Measure startup, CPU and memory for Lean and Dynamic on repeatable representative workloads; report methodology, results and limitations without assuming improvement. Evidence: `node tests/perf/compare-lean.mjs`, 10 measured iterations per fixture and engine; see verification.md for results and scope.
- [x] 7.3 Reconcile the earlier change's tasks and conflicting requirement identifiers against actual evidence; verify no unsupported completion claims or accidental spec changes. Evidence: task-by-task disposition and requirement mapping in verification.md; `git diff -- openspec/specs` is empty.
- [ ] 7.4 Human comprehension verification: review the implementation and red-green evidence; verify the reviewer can explain the changed logic.
- [ ] 7.5 Integrate and rebase the stream, rerun affected checks and strict OpenSpec validation; verify the final state before a separate archive decision.

## Review Gate
- [x] **Gate 3 Approval**: Tasks breakdown approved by human before writing test code.
