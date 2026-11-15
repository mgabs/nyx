# Proposal

## Intent
Replace Nyx's monolithic DevTools config overrides with a layered per-site override model (`ConfigManager.raw.*` + user overrides) so remote `syncSitesFixes` updates continue working, per-site edits and resets are isolated, and Settings Export/Import (`Nyx-Settings.json`) includes DevTools overrides while fixing existing DevTools and Settings UI/persistence bugs.

## Problem Statement
1. Editing any single site in Developer Tools currently copies and shadows the entire built-in config (`ConfigManager.overrides.<type> || ConfigManager.raw.<type>`), freezing remote `syncSitesFixes` updates, bloating `chrome.storage.local`, and making per-site reset impossible (`resetDevFixes` wipes all overrides).
2. `DevTools.loadConfigOverrides()` omits `detectorHints` on startup, losing saved detector overrides across background/service-worker restarts.
3. `PerSiteConfigEditor`, `ConfigEditor`, `Body`, `ImportSettings`, `ExportSettings`, and `ResetSettings` contain UI/state bugs: length-only diffing, unvalidated `[change]` destructuring, `keydown` listener leaks, stuck warning modal on cancelled file import, `<MessageBox>` nested inside `<Button>`, and the legacy `Dark-Reader-Settings.json` export filename.
4. Settings Export/Import does not include DevTools overrides.

## Capabilities

### New Capabilities
- `devtools-overrides`: Layered per-site DevTools override storage, URL-keyed merge over `ConfigManager.raw.*`, Per-Site Editor isolated apply/reset/delete, Overrides-only Full Editor + read-only View Defaults tab, and optional `devTools` payload in Settings Export/Import.

### Modified Capabilities
- `rebrand`: Clarify `REQ-BRAND-3` to explicitly require `Nyx-Settings.json` as the Settings export filename in `ExportSettings`.

## Scope

### In-Scope
- Layered override storage in `DevTools` (`src/background/devtools.ts`) for all 4 `DevFixType`s (`detector`, `dynamic`, `filter`, `static`), including `detectorHints` startup loading and safe handling of legacy monolithic `dev_*` storage entries.
- Merge helper in `ConfigManager` (`src/background/config-manager.ts`) that layers overrides over `ConfigManager.raw.*` by replacing matching `raw` URL blocks so `getSitesFixesFor()` does not stack overridden rules.
- `PerSiteConfigEditor` (`src/ui/devtools/components/config-editor-per-site.tsx`): content-based change detection, safe `parse()` validation (rejecting empty/zero-block or multi-block input in per-site mode), per-site `Reset` (drops only that site's override), `Delete` (removes custom sites), `addNewFix` await + refresh, and visual distinction of `default` / `overridden` / `custom` entries.
- `ConfigEditorTabs` & `Body` (`src/ui/devtools/components/config-editor-tabs.tsx`, `body.tsx`): Full Editor scoped to user overrides + read-only `View Defaults` tab; remove unused `store.errorText` and empty `Advanced` tab when `__PLUS__` is false.
- `ConfigEditor` (`src/ui/devtools/components/config-editor.tsx`): single `keydown` listener attachment without leak, replace `document.execCommand('insertText', ...)` with `setRangeText`/selection replacement, and clear dialog state on `delete`.
- Settings Export/Import & Dialog fixes (`src/ui/options/advanced/export-settings.tsx`, `import-settings.tsx`, `reset-settings.tsx`, `src/utils/validation.ts`):
  - Export `Nyx-Settings.json` containing `UserSettings` + optional `devTools` overrides.
  - Import accepts both new (`{...UserSettings, devTools}`) and legacy (`UserSettings`-only) JSON, validating `devTools` overrides before applying.
  - Close warning dialog before opening file picker; move `<MessageBox>` out of `<Button>` in `ImportSettings` and `ResetSettings`.

### Out-of-Scope (YAGNI)
- Tombstoning / disabling built-in `ConfigManager.raw.*` fixes (per-site `Reset` reverts an override to `raw`; `Delete` applies only to custom user-added entries).
- Full i18n/localization of hardcoded English strings across `src/ui/options/` and `src/ui/devtools/`.
- `ContextMenus` permission-declined fallback (`src/ui/options/advanced/context-menus.tsx`).
- Syncing DevTools overrides via `chrome.storage.sync` (`syncSettings` remains `UserSettings` only; DevTools overrides stay in `chrome.storage.local` and Export/Import JSON).
- Performance optimizations to `parse.ts` or theme engines unrelated to override merging.

## Assumptions
- **ASM-GEN-1**: Matching overrides to `ConfigManager.raw.*` entries by exact `url` list equality (normalized) is sufficient for replacing overridden built-in blocks without altering `getSitesFixesFor()` semantics.
- **ASM-GEN-2**: `chrome.storage.local` remains the persistence backend for DevTools overrides across Chrome MV2, Chrome MV3, and Firefox.
- **ASM-GEN-3**: Existing E2E tests (`tests/browser/e2e/devtools.tests.ts`) that paste into `.config-editor textarea.editor` in Full Editor continue to pass because Full Editor applies overrides directly on top of `raw`.

## Success Metrics
- `DevTools.loadConfigOverrides()` restores all 4 `DevFixType`s (`detector`, `dynamic`, `filter`, `static`) on startup: **4/4** types persisted and reloaded.
- Editing 1 site in Per-Site Editor stores only that site's override and leaves `ConfigManager.raw.*` unshadowed: **0** untouched `raw` entries copied into `chrome.storage.local`.
- Exporting Settings downloads `Nyx-Settings.json` (**0** occurrences of `Dark-Reader-Settings.json`), and re-importing restores both `UserSettings` and `devTools` overrides with **100%** round-trip fidelity; legacy `UserSettings`-only JSON imports with **0** regressions.
- All required gates pass: `npm test`, `npm run test:browser`, `npm run test:inject`, `npm run lint`, `npm run build`, and `npm run api`.

## Review Gate
- [x] **Gate 1 Approval**: Proposal reviewed and approved by human before drafting specs.
