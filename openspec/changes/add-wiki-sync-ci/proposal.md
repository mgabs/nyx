# Proposal

## Intent

Update `README.md` with the new Nyx icon and updated Nyx Owl color theme documentation, structure `docs/wiki/` documentation pages, and add a CI/CD workflow on merge/push to `main` to keep the GitHub Nyx Wiki synchronized automatically.

## Problem Statement

`README.md:1` still displays the legacy Dark Reader mascot SVG and outdated Dark Reader copy/links despite the Nyx rebrand and Nyx Owl icon/theme, and `.github/workflows/` has no automation to publish updated documentation to the GitHub Nyx Wiki when changes merge to `main`.

## Capabilities

### New Capabilities
- `wiki-sync-ci`: Automated `.github/workflows/wiki-sync.yml` triggered on `push` to `main` that syncs `docs/wiki/` (and linked docs) to `https://github.com/<owner>/<repo>.wiki.git`, paired with updated `README.md` (Nyx icon + color theme section) and `docs/wiki/` pages.

### Modified Capabilities
- None. Existing build, test, and tag-release workflows (`.github/workflows/tagged-release.yml`, etc.) remain unchanged.

## Scope

### In-Scope
- Update `README.md` to replace `darkreader-mascot.svg` with the Nyx icon from `src/icons/`, document the updated Nyx Owl color theme (`#181a1b` / `#e8e6e3` and palette options), and align links/copy with Nyx.
- Create/update `docs/wiki/` markdown pages (e.g., `Home.md`, architecture/theme-engine overview referencing `docs/nyx-blueprint.md`).
- Add `.github/workflows/wiki-sync.yml` running on `push` to `main` with `permissions: contents: write`, cloning `<repo>.wiki.git`, copying `docs/wiki/*.md`, and committing/pushing only when changes exist.

### Out-of-Scope (YAGNI)
- Modifying extension runtime TypeScript/CSS code or `ThemeEngine` behavior.
- Modifying `.github/workflows/tagged-release.yml` or store packaging steps.
- Adding third-party GitHub Marketplace wiki-publish actions.

## Assumptions
- **ASM-GEN-1**: The GitHub repository's Wiki feature is enabled and initialized with at least one page so `*.wiki.git` accepts `GITHUB_TOKEN` pushes.
- **ASM-GEN-2**: `README.md` can reference a repo-committed Nyx icon asset path (e.g., `src/icons/...`) that renders cleanly on GitHub.

## Success Metrics
- `README.md` contains zero references to `darkreader-mascot.svg` and renders the Nyx icon + updated color theme summary.
- `.github/workflows/wiki-sync.yml` validates cleanly (valid YAML, triggers on `push: branches: [main]`, uses `permissions: contents: write`, skips commit/push when wiki diff is empty).
- Required repo gates (`npm test`, `npm run lint`, `npm run build`) remain green.

## Review Gate
- [x] **Gate 1 Approval**: Proposal reviewed and approved by human before drafting specs.
