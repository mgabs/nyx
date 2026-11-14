# Spec Delta: wiki-sync-ci

## Purpose
Synchronize `README.md` (with the Nyx icon and Nyx Owl color theme), `docs/wiki/` markdown pages, and the GitHub Nyx Wiki repository automatically on merge/push to `main`.

## ADDED Requirements

### Requirement: REQ-WIKI-1 README Icon & Color Theme Update
`README.md` MUST replace the legacy `darkreader-mascot.svg` image with the Nyx icon asset committed in the repository and MUST document the updated Nyx Owl color theme (`#181a1b` / `#e8e6e3`) and Nyx project links.

#### Scenario: README displays Nyx branding
- **GIVEN** `README.md` at repository root
- **WHEN** inspected
- **THEN** it references the local Nyx icon asset (`src/icons/...`), contains zero references to `darkreader-mascot.svg`, and describes the Nyx Owl color theme

### Requirement: REQ-WIKI-2 Wiki Source Documentation
The repository MUST maintain wiki source markdown pages under `docs/wiki/` (including `Home.md` and architecture/theme documentation aligned with `docs/nyx-blueprint.md`).

#### Scenario: Wiki source pages present
- **GIVEN** `docs/wiki/`
- **WHEN** listed
- **THEN** `Home.md` and supporting documentation markdown files exist with valid relative links

### Requirement: REQ-WIKI-3 Automated Wiki Sync on Merge to Main
`.github/workflows/wiki-sync.yml` MUST trigger on `push` to `main`, run with `permissions: contents: write`, clone `<repo>.wiki.git`, copy `docs/wiki/*.md`, and commit/push changes only when the wiki working tree has diffs.

#### Scenario: Docs change merged to main
- **GIVEN** a commit pushed to `main` modifying `docs/wiki/**`, `docs/**`, or `README.md`
- **WHEN** `.github/workflows/wiki-sync.yml` runs
- **THEN** it syncs `docs/wiki/*.md` to `<repo>.wiki.git` and pushes only if `git status --porcelain` is non-empty

#### Scenario: No-op when wiki is already up to date
- **GIVEN** `docs/wiki/*.md` matches the remote wiki repository
- **WHEN** `.github/workflows/wiki-sync.yml` runs
- **THEN** it exits cleanly with zero empty commits or errors
