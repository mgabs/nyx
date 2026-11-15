# Research & Technical Tradeoffs

## 1. Intent & Ground Truth

### Problem
Nyx's Developer Tools (`src/background/devtools.ts`, `src/ui/devtools/`) and Settings (`src/ui/options/advanced/`) currently suffer from architectural and correctness gaps:
1. **Monolithic Shadowing**: `ConfigManager.handle*()` (`src/background/config-manager.ts#L209-L231`) uses `ConfigManager.overrides.<type> || ConfigManager.raw.<type>`. Any DevTools edit copies and replaces the entire built-in config blob in `chrome.storage.local`, freezing remote `syncSitesFixes` updates for that engine and making per-site reset impossible (`resetDevFixes` wipes all edits).
2. **Startup Loss & UI Bugs**:
   - `DevTools.loadConfigOverrides()` (`src/background/devtools.ts#L114-L127`) loads `dynamicThemeFixes`, `inversionFixes`, and `staticThemes`, but skips `detectorHints` (`KEY_DETECTOR`).
   - `PerSiteConfigEditor` (`src/ui/devtools/components/config-editor-per-site.tsx`) checks `store.fixesLength !== fixesText.length` (misses same-length edits), destructures `const [change] = props.parse(text)` (corrupts `store.fixes` on empty input, drops extra blocks on multi-block input), does not `await`/`refresh` in `addNewFix`, and wires per-site `Reset changes` to `resetDevFixes(props.type)` (wipes all fixes).
   - `ConfigEditor` (`src/ui/devtools/components/config-editor.tsx`) attaches a `keydown` listener on every `onrender`, uses deprecated `document.execCommand('insertText', ...)`, and leaves `store.dialogMessage`/`store.dialogAction` populated after `props.delete!()`.
   - `Body` (`src/ui/devtools/components/body.tsx`) has unused `store.errorText` and renders an empty `Advanced` tab when `__PLUS__` is false.
3. **Settings & Export/Import Gaps**:
   - `ExportSettings` (`src/ui/options/advanced/export-settings.tsx#L9`) still writes `Dark-Reader-Settings.json`, violating `REQ-BRAND-3` in `openspec/specs/rebrand/spec.md`.
   - `ExportSettings` / `ImportSettings` only cover `UserSettings` (`props.data.settings`), ignoring DevTools overrides.
   - `ImportSettings` (`src/ui/options/advanced/import-settings.tsx`) leaves `isWarningDialogVisible` stuck open if the file picker is cancelled, and both `ImportSettings` and `ResetSettings` (`src/ui/options/advanced/reset-settings.tsx`) nest `<MessageBox>` inside `<Button>`.

### Verified Codebase Constraints
- `getSitesFixesFor()` (`src/generators/utils/parse.ts#L132-L157`) returns **all** matching blocks (`Array<Readonly<T>>`) for a URL (moving `*` to index 0). Simply concatenating `raw` + `overrides` would stack rules instead of overriding them; merging must exclude/replace `raw` blocks whose `url` patterns are overridden.
- `DevFixType` is `'detector' | 'dynamic' | 'filter' | 'static'` (`src/definitions.d.ts#L22`).
- Existing E2E tests (`tests/browser/e2e/devtools.tests.ts`) paste config blocks into `.config-editor textarea.editor` and expect them to apply and reset cleanly.

## 2. Options Explored

### Option A1 (Layered Per-Site Overrides + Overrides-Only Full Editor + Defaults Viewer)
- Store only user-modified/added overrides per `DevFixType` in `chrome.storage.local` (migrating or treating legacy monolithic `dev_*` keys cleanly).
- Merge `overrides` over `ConfigManager.raw.*` in `ConfigManager.handle*()` by replacing matching `raw` entries.
- **Per-Site Editor**: browses/searches all effective sites (`raw` + `overrides`) with status indicators, pre-fills the effective fix when clicked, saves only that site's override on `Apply`, reverts only that site on `Reset`, and removes custom sites on `Delete`.
- **Full Editor**: edits only the user's override layer, paired with a read-only **View Defaults** tab/viewer for inspecting `ConfigManager.raw.*`.
- **Settings Export/Import**: exports `Nyx-Settings.json` with `UserSettings` plus an optional `devTools` overrides payload (backward-compatible with `UserSettings`-only JSON on import).
- **Pros**: Preserves `syncSitesFixes` remote updates; true per-site reset; tiny storage footprint; clean export/import; no fragile 10,000-line text diffing.
- **Cons**: Requires URL-keyed merge logic and one-time handling of legacy monolithic `dev_*` storage if present.

### Option B (Layered Per-Site Overrides + Merged Full Editor with Diff-on-Apply)
- Same layered storage and merge as A1, but Full Editor displays the full merged text (`raw` + `overrides`) and diffs the edited text against `ConfigManager.raw.*` on `Apply`.
- **Pros**: Single-box Full Editor shows defaults inline.
- **Cons**: Fragile text diffing if users reorder blocks, change whitespace/comments, or delete built-in entries; high edge-case surface.

### Option C (Keep Monolithic Blob, Fix UI/Startup Bugs Only)
- Keep `ConfigManager.overrides.<type> || ConfigManager.raw.<type>` and fix `detectorHints` startup load, `PerSiteConfigEditor` bugs, `ExportSettings` filename, and `<MessageBox>` nesting.
- **Pros**: Minimal code churn.
- **Cons**: Leaves `syncSitesFixes` frozen after any DevTools edit, cannot cleanly reset a single site without copying/diffing `raw`, and bloats storage/exports with full built-in configs.

## 3. Tradeoff Matrix

| Criteria | Option A1 (Layered + Overrides-Only Full Editor) | Option B (Layered + Merged Diff) | Option C (Monolithic + Bugfixes) |
| :--- | :--- | :--- | :--- |
| **Complexity** | Medium (merge helper + UI split) | High (text diffing + ambiguity) | Low |
| **New Dependencies** | None | None | None |
| **Performance & Latency** | Fast (small override storage, cached merge) | Slower (full-text diff on Apply) | Slow (parses/serializes full blob) |
| **Maintenance Burden** | Low (clear separation of raw vs overrides) | High (diff edge cases) | Medium (monolithic coupling) |
| **Blast Radius** | Scoped (`devtools`, `config-manager`, `options/advanced`, `validation`) | Scoped + parser/formatter edge cases | Minimal |

## 4. Recommendation
Adopt **Option A1**: store layered per-site DevTools overrides merged over `ConfigManager.raw.*` (replacing matched `raw` entries), keep Full Editor scoped to overrides alongside a read-only Defaults viewer, and extend `Nyx-Settings.json` Export/Import to carry optional `devTools` overrides while fixing the identified UI and `detectorHints` bugs.

## 5. Breaking Changes & Deprecations
- **`openspec/specs/rebrand/spec.md` (`REQ-BRAND-3`)**: Enforced — `ExportSettings` filename changes from `Dark-Reader-Settings.json` to `Nyx-Settings.json`.
- **Legacy `chrome.storage.local` `dev_*` blobs**: Existing monolithic `dev_*` entries must be handled safely (migrated/diffed or scoped) so upgrades do not break existing users; E2E `devtools.tests.ts` behavior remains compatible.

## Review Gate
- [x] **Gate 0 Decision**: Human decides Go (Option A1) or No-Go before the proposal is drafted.
