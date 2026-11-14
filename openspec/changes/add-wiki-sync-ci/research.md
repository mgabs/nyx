# Research & Technical Tradeoffs

## 1. Intent & Ground Truth

- **Goal:** Keep `README.md` (including replacing the legacy Dark Reader mascot with the new Nyx icon and documenting the updated Nyx color theme), `docs/`, and the GitHub Nyx Wiki synchronized automatically via a CI/CD workflow step on merge/push to `main`.
- **Verified Codebase Facts:**
  - `README.md:1` still points to `darkreader-mascot.svg` and Dark Reader copy/links despite the Nyx rebrand and Nyx Owl icon/theme (`src/icons/`).
  - `.github/workflows/` currently contains `auto-pr-develop-main.yml`, `spec-rails-ci.yml`, `tagged-release.yml`, `test-browser.yml`, `test-code.yml`, and `test.yml`.
  - `.github/workflows/tagged-release.yml` only triggers on `push: tags: ["v*"]` (for store packages), not on merges to `main`.
  - `docs/` contains `docs/nyx-blueprint.md`, `docs/color-schemes-drconf.spec`, and `docs/news.json`.
  - GitHub Wikis are backed by a separate git repository (`https://github.com/<owner>/<repo>.wiki.git`), which requires the repository's GitHub Wiki feature to be enabled (with at least an initial page created once) and `permissions: contents: write` on `GITHUB_TOKEN` (or a PAT if branch/wiki protection applies).

## 2. Options Explored

- **Option A: Dedicated `.github/workflows/wiki-sync.yml` on `push: branches: [main]`**
  - *Description:* Add a standalone workflow triggered on `push` to `main` (optionally path-filtered to `README.md`, `docs/**`, `docs/wiki/**`) that checks out `*.wiki.git`, syncs markdown pages from `docs/wiki/` (and/or `README.md` / `docs/nyx-blueprint.md`), and commits/pushes changes if diff is non-empty.
  - *Pros:* Runs on every merge to `main` without waiting for `v*` tags; cleanly separated from release packaging (`tagged-release.yml`).
  - *Cons:* Requires GitHub Wiki to be initialized once on the repo before the first CI push succeeds.

- **Option B: Add wiki-sync job to `.github/workflows/tagged-release.yml`**
  - *Description:* Run wiki sync only when a `v*` tag is pushed.
  - *Pros:* Reuses existing release workflow file.
  - *Cons:* Does not trigger on merge to `main` (misses non-tagged doc/feature merges).

- **Option C: Third-party GitHub Action (`SwiftDoc-Org/github-wiki-publish-action` / `Decathlon/wiki-page-creator-action`)**
  - *Description:* Use a marketplace action instead of ~15 lines of `git clone` + `cp` + `git commit` + `git push`.
  - *Pros:* Less bash in workflow YAML.
  - *Cons:* Adds external supply-chain dependency for a trivial git push.

## 3. Tradeoff Matrix

| Criteria | Option A (`wiki-sync.yml` + native git) | Option B (`tagged-release.yml`) | Option C (3rd-party Action) |
| :--- | :--- | :--- | :--- |
| **Complexity** | Low | Low | Low |
| **New Dependencies** | None | None | External Action |
| **Performance & Latency** | Fast (~10s on `main` merge) | Only runs on tags | Fast |
| **Maintenance Burden** | Low | Low | Medium (pin/update action) |
| **Blast Radius** | Isolated workflow | Release workflow | Isolated workflow |

## 4. Recommendation

Choose **Option A**: a dedicated `.github/workflows/wiki-sync.yml` triggered on `push` to `main` using `actions/checkout` + native `git` sync to `*.wiki.git`, paired with `docs/wiki/` + `README.md` + `docs/nyx-blueprint.md` updates.

## 5. Breaking Changes & Deprecations

None.

## Review Gate
- [x] **Gate 0 Decision**: Human decides Go (name the option) or No-Go before the proposal is drafted. — Go: Option A (`wiki-sync.yml` + `README.md` icon/theme + `docs/wiki/`).
