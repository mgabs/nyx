# Tasks: P0 Foundation & Zero-FOUC

## 1. Dependency DAG

```
+-------------------------------------------------------------+
|               Gate 4: Task Breakdown Sign-Off               |
+-------------------------------------------------------------+
             |                     |                     |
             v                     v                     v
+-----------------------+ +------------------+ +---------------------+
| Stream A: Brand       | | Stream B: FOUC   | | Stream C: Perf      |
| (.worktrees/p0-brand) | | (.worktrees/     | | (.worktrees/p0-perf)|
| (Agent: security-     | |  p0-fouc)        | | (Agent:             |
|  shield)              | | (Agent: system-  | |  deep-thinker)      |
|                       | |  architect)      | |                     |
| - Manifest metadata   | | - Early root     | | - True LRU cache    |
| - MIT attribution     | |   style inject   | | - Char-code color   |
|                       | | - MV3 register   | |   parser            |
+-----------------------+ +------------------+ +---------------------+
             \                     |                     /
              \                    v                    /
+-------------------------------------------------------------+
|                 Section 6: Integration & Rebase             |
| - Merge streams into feat/p0-foundation-zero-fouc           |
| - Re-verify full test rails & mutation suite                |
| - openspec archive & PR to main                             |
+-------------------------------------------------------------+
```

---

## 2. Streams & Worktrees

| Stream | Worktree Path | Branch | Agent Role | Prerequisite |
| :--- | :--- | :--- | :--- | :--- |
| **Stream A (`brand`)** | `.worktrees/p0-brand` | `feat/p0-brand` | `security-shield` | Gate 4 Approval |
| **Stream B (`fouc`)** | `.worktrees/p0-fouc` | `feat/p0-fouc` | `system-architect` | Gate 4 Approval |
| **Stream C (`perf`)** | `.worktrees/p0-perf` | `feat/p0-perf` | `deep-thinker` | Gate 4 Approval |

---

## 3. Slice 1: Rebrand & MIT Attribution (Stream A)

- [x] 3.1 BDD scenarios for manifest & attribution (verify: tests committed)
- [x] 3.2 Gate 5.1 human sign-off on Stream A scenarios
- [x] 3.3 Red tests fail for manifest name 'Nyx' and license header (verify: test failure output `Evidence: 4 failed, 2 passed on unpatched manifests`)
- [x] 3.4 Green implementation: update `tasks/bundle-manifest.js`, `src/manifest.json`, `package.json`, `LICENSE`, `README.md`, `src/utils/links.ts` (verify: tests pass `Evidence: 9/9 passed in brand.tests.ts`)
- [x] 3.5 Verification: manifest outputs 'Nyx', repo links to `github.com/mgabs/nyx`, upstream Dark Reader Ltd. copyright intact (`Evidence: commit 5a9b859`)

---

## 4. Slice 2: Core Engine Performance (Stream C)

- [x] 4.1 BDD scenarios for LRU eviction & fast-path color parsing (verify: unit tests committed)
- [x] 4.2 Gate 5.2 human sign-off on Stream C scenarios
- [x] 4.3 Red unit tests: verify LRU access re-ordering in `cachedFactory` and char-code parsing in `color.ts` fail on current code (`Evidence: test failure on FIFO cache and regex bypass`)
- [x] 4.4 Green implementation: update `src/utils/cache.ts` and `src/utils/color.ts` (verify: tests pass `Evidence: 22/22 tests passed in cache.tests.ts and color.tests.ts`)
- [x] 4.5 Coverage $\ge 95\%$ and mutation 100% kill on modified modules (verify: `npm test` `Evidence: cache.ts 100% lines/branches, color.ts 99.2% lines / 96.1% branches; 23/23 mutants killed`)

---

## 5. Slice 3: Zero-FOUC Instant Dark Paint (Stream B)

- [x] 5.1 BDD scenarios for synchronous root canvas style attachment & MV3 pre-paint registration
- [x] 5.2 Gate 5.3 human sign-off on Stream B scenarios
- [x] 5.3 Red integration test: verify document canvas without body paints dark `#181a1b` (`Evidence: zero-fouc red suite failure before implementation`)
- [x] 5.4 Green implementation: update `src/inject/dynamic-theme/injection.ts` and `src/background/tab-manager.ts` (`Evidence: commit 4bfb2ce4`)
- [x] 5.5 Browser verification: 0 white frames during tab creation and page navigation (`Evidence: 12/12 tests passed in zero-fouc.tests.ts and tab-manager-fouc.tests.ts`)

---

## 6. Integration & Rebase Plan

- [x] 6.1 Rebase and merge Stream A, Stream B, Stream C into `feat/p0-foundation-zero-fouc` (`Evidence: merges 5a9b859, 4bfb2ce4, 5d89f22e complete`)
- [x] 6.2 Remove isolated worktrees (`.worktrees/p0-*`) and clean branch references (`Evidence: git worktree list shows only main tree`)
- [x] 6.3 Execute full test suite (`npm run test:unit`) and spec-rails check (`Evidence: 21 suites passed, 117 tests passed; eslint clean; spec-rails-check passed`)
- [ ] 6.4 Gate 6: Open PR from `feat/p0-foundation-zero-fouc` to `develop` / `main` and archive change

---

## Review Gate

- [x] **Gate 4 Approval**: Tasks breakdown approved by human before writing test code.
