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

- [ ] 3.1 BDD scenarios for manifest & attribution (verify: tests committed)
- [ ] 3.2 Gate 5.1 human sign-off on Stream A scenarios
- [ ] 3.3 Red tests fail for manifest name 'Nyx' and license header (verify: test failure output)
- [ ] 3.4 Green implementation: update `tasks/bundle-manifest.js`, `src/manifest.json`, `package.json`, `LICENSE` (verify: tests pass)
- [ ] 3.5 Verification: manifest outputs 'Nyx', upstream Dark Reader Ltd. copyright intact

---

## 4. Slice 2: Core Engine Performance (Stream C)

- [ ] 4.1 BDD scenarios for LRU eviction & fast-path color parsing (verify: unit tests committed)
- [ ] 4.2 Gate 5.2 human sign-off on Stream C scenarios
- [ ] 4.3 Red unit tests: verify LRU access re-ordering in `cachedFactory` and char-code parsing in `color.ts` fail on current code
- [ ] 4.4 Green implementation: update `src/utils/cache.ts` and `src/utils/color.ts` (verify: tests pass)
- [ ] 4.5 Coverage $\ge 95\%$ and mutation 100% kill on modified modules (verify: `npm test`)

---

## 5. Slice 3: Zero-FOUC Instant Dark Paint (Stream B)

- [ ] 5.1 BDD scenarios for synchronous root canvas style attachment & MV3 pre-paint registration
- [ ] 5.2 Gate 5.3 human sign-off on Stream B scenarios
- [ ] 5.3 Red integration test: verify document canvas without body paints dark `#181a1b`
- [ ] 5.4 Green implementation: update `src/inject/dynamic-theme/injection.ts` and `src/background/tab-manager.ts`
- [ ] 5.5 Browser verification: 0 white frames during tab creation and page navigation

---

## 6. Integration & Rebase Plan

- [ ] 6.1 Rebase and merge Stream A, Stream B, Stream C into `feat/p0-foundation-zero-fouc`
- [ ] 6.2 Remove isolated worktrees (`.worktrees/p0-*`) and clean branch references
- [ ] 6.3 Execute full test suite (`npm run test:unit`) and spec-rails check
- [ ] 6.4 Gate 6: Open PR from `feat/p0-foundation-zero-fouc` to `develop` / `main` and archive change

---

## Review Gate

- [x] **Gate 4 Approval**: Tasks breakdown approved by human before writing test code.
