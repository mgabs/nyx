# Proposal

## Intent
Consolidate the non-Plus browser extension popup onto `NewBody`, remove the legacy Classic popup UI and `previewNewDesign` flag, and modernize `NewBody` with Material Design 3 styling.

## Problem Statement
The extension popup currently maintains two non-Plus UIs (`Classic` in `src/ui/popup/components/*` and `NewBody` in `src/ui/popup/body/*`) gated by `previewNewDesign`, forcing dual CSS scoping (`.preview` vs non-`.preview`) and leaving desktop users on the dated Classic UI while `NewBody` itself still looks boxy and unfinished (sharp `2px` borders, flat surfaces, unused `PageId` stubs, and fixed `.pages-section` height).

## Capabilities

### New Capabilities
- `popup-ui`: Consolidated `NewBody` popup routing, removal of `previewNewDesign`/Classic UI, Material Design 3 visual system scoped to `src/ui/popup/`, and updated popup e2e verification.

### Modified Capabilities
- None.

## Scope

### In-Scope
- Route all non-Plus popup renders (`!__PLUS__` or `__PLUS__` when not `PlusBody`/`initAltUI`) directly to `NewBody`, preserving `Loader` (or equivalent loading state) when `!data.isReady`.
- Remove Classic UI modules under `src/ui/popup/components/` (except relocating `Loader` if retained) and their `@import` entries in `src/ui/popup/style.less`, plus `.preview` class toggling in `src/ui/popup/index.tsx`.
- Remove `previewNewDesign` from `UserSettings` (`src/definitions.d.ts`), `DEFAULT_SETTINGS` (`src/defaults.ts`), `validateSettings` (`src/utils/validation.ts`), `src/ui/connect/mock.ts`, `src/ui/devtools/components/body.tsx` (`.preview-design-button`), and unit/inject test fixtures.
- Polish `NewBody` (`src/ui/popup/body/`, `main-page/`, `theme/`, `news-section/`, `page-viewer/`): remove unused `PageId` stubs (`settings`, `site-list`, `automation`, `manage-settings`), replace rigid `.pages-section` height clipping, and apply Material Design 3 styling (tonal surface containers over a modernized `#141e24` dark slate palette, rounded cards/pills, state layers, subtle elevation, and smooth `PageViewer` transitions) scoped to `src/ui/popup/`.
- Update `tests/browser/e2e/toggle.tests.ts` and `tests/browser/e2e/news.tests.ts` to target `NewBody` selectors and remove the `.preview-design-button` test.

### Out-of-Scope (YAGNI)
- Removing or refactoring `__PLUS__`, `PlusBody`, `previewNewestDesign`, `initAltUI`, `shouldUseAltUI`, or `src/stubs/`.
- Modifying `src/ui/theme.less`, `src/ui/controls/*` globally, `src/ui/options/*`, `src/ui/devtools/*` (beyond removing `.preview-design-button`), or `src/ui/stylesheet-editor/*`.
- Introducing external UI component/icon libraries or CSS frameworks.
- Changing manifest/page-title branding covered by `openspec/specs/rebrand/spec.md`.

## Assumptions
- **ASM-GEN-1**: Existing `UserStorage` profiles containing a persisted `previewNewDesign` boolean can safely ignore/drop the unknown property without requiring a migration script, because `validateSettings` only validates known `DEFAULT_SETTINGS` keys.
- **ASM-GEN-2**: `PlusBody` (`__PLUS__ && previewNewestDesign`) remains functional when rendered directly from the consolidated popup entrypoint without Classic UI dependencies.

## Success Metrics
- Non-Plus desktop and mobile popups render `NewBody` by default with zero Classic UI or `previewNewDesign` references in `src/`.
- All verification gates pass: `npm test`, `npm run lint`, `npm run build`, `npm run api`, `npm run test:browser`, and `npm run test:inject`.

## Review Gate
- [ ] **Gate 1 Approval**: Proposal reviewed and approved by human before drafting specs.
