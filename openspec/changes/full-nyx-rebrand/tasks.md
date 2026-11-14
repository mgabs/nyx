# Tasks

## 1. Dependency DAG

```mermaid
flowchart TD
    S0["Slice 0: Contracts (links, news.json schema, dual-lock, API targets)"] --> S1["Slice 1: Links, News Feed & Standalone API"]
    S0 --> S2["Slice 2: Popup, Options, DevTools & Assets (drop DonateGroup)"]
    S0 --> S3["Slice 3: Locales & Store Descriptions (42 locales)"]
    S0 --> S4["Slice 4: Internal CSS/DOM Tokens (--nyx-*, data-nyx-*, .nyx) + Dual Lock"]
    S1 --> INT["Integration, Verification Gates & Archive"]
    S2 --> INT
    S3 --> INT
    S4 --> INT
```

## 2. Streams & Worktrees

| Stream | Worktree Path | Branch | Prerequisite |
| :--- | :--- | :--- | :--- |
| `links-news-api` | `.worktrees/full-nyx-rebrand-links-news-api` | `feat/rebrand-links-news-api` | Slice 0 |
| `ui-assets` | `.worktrees/full-nyx-rebrand-ui-assets` | `feat/rebrand-ui-assets` | Slice 0 |
| `locales` | `.worktrees/full-nyx-rebrand-locales` | `feat/rebrand-locales` | Slice 0 |
| `tokens-configs` | `.worktrees/full-nyx-rebrand-tokens-configs` | `feat/rebrand-tokens-configs` | Slice 0 |

## 3. Slice 0: Shared Contracts
- [ ] 3.0 Define `docs/news.json` schema/seed, `src/utils/links.ts` exported constants (`HOMEPAGE_URL`, `BLOG_URL`, `NEWS_URL`, `HELP_URL`, `PRIVACY_URL`, `MOBILE_URL`, `CONFIG_URL_BASE`), and `nyx.js`/`nyx.mjs` API contract (verify: `npm test`)

## 4. Slice 1: Links, News Feed & Standalone API (`links-news-api`)
- [ ] 4.1 Red unit tests for `links.ts` (`mgabs/nyx` URLs, removed `DONATE_URL`/`TWITTER_URL`/`UNINSTALL_URL`), `Newsmaker` feed URL/wiki+release linking, and `brand.tests.ts` assertions on `nyx.js`/`nyx.mjs` (verify: `npm test` fails on expected assertions)
- [ ] 4.2 Green implementation: update `src/utils/links.ts`, `src/background/newsmaker.ts`, `src/background/index.ts`, `docs/news.json`, `src/api/`, `tasks/bundle-api.js`, `tasks/code-style.js`, `tasks/dependencies.js`, `package.json`, `Makefile`, and `tests/perf/runner.js` (verify: `npm test && npm run api && npm run lint`)

## 5. Slice 2: Popup, Options, DevTools & Assets (`ui-assets`)
- [ ] 5.1 Red tests asserting `.m-donate-group` is absent from popup `NewBody`, `Nyx` wordmark is present, and export filename uses `Nyx-${url}.css` (verify: `npm test` / browser test fails before implementation)
- [ ] 5.2 Green implementation: remove `DonateGroup` and `uiHighlights` `'anniversary'` usage from `src/ui/popup/body/`, `src/background/ui-highlights.ts`, `src/background/extension.ts`; replace `darkreader-type.svg` with `nyx-type.svg`; rename `darkreader-*` image assets; update `src/ui/popup/theme/controls/export-theme.tsx`, `src/ui/popup/compatibility.js`, `src/ui/options/`, `src/ui/devtools/`, and `src/ui/stylesheet-editor/` (verify: `npm test && npm run lint`)

## 6. Slice 3: Locales & Store Descriptions (`locales`)
- [ ] 6.1 Red check verifying `src/_locales/` and `src/_locales/store/` contain zero `"Dark Reader"` brand strings (verify: `rg -i "dark\s*reader" src/_locales/` returns non-zero matches before edit)
- [ ] 6.2 Green implementation: replace Dark Reader brand references with Nyx across all 42 `src/_locales/*/messages.json` and 42 `src/_locales/store/*` files (verify: `rg -i "dark\s*reader" src/_locales/` returns 0 matches and `npm test` passes)

## 7. Slice 4: Internal CSS/DOM Tokens & Dual Lock (`tokens-configs`)
- [ ] 7.1 Red unit/inject tests asserting `--nyx-*`, `.nyx`, `data-nyx-*`, and both `meta[name="nyx-lock"]` and `meta[name="darkreader-lock"]` opt-out behavior (verify: `npm run test:inject` fails before token rename)
- [ ] 7.2 Green implementation: rename `--darkreader-*` -> `--nyx-*`, `.darkreader` -> `.nyx`, `data-darkreader-*` -> `data-nyx-*` across `src/inject/`, `src/config/*.config`, `src/ui/devtools/`, and `tests/`; add dual `nyx-lock` + `darkreader-lock` support (verify: `npm test && npm run test:inject && npm run lint`)

## 8. Integration & Rebase Plan
- [ ] 8.1 Human Comprehension Verification: verify diff audit (`rg -i "dark\s*reader" src/ _locales/` returns only intentional `darkreader-lock` check and `LICENSE` MIT attribution remains intact)
- [ ] 8.2 Merge streams, rebase on `main`, run full verification (`npm test`, `npm run lint`, `npm run test:inject`, `npm run test:browser`, `npm run build`, `npm run api`), and run `openspec archive full-nyx-rebrand`

## Review Gate
- [x] **Gate 3 Approval**: Tasks breakdown approved by human before writing test code.
