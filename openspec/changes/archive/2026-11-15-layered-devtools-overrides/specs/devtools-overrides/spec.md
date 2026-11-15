# Spec Delta: devtools-overrides

## Purpose
Establishes layered per-site Developer Tools overrides merged over built-in/remote configs, isolated per-site and overrides-only editing, and Settings Export/Import integration with UI dialog safety.

## ADDED Requirements

### Requirement: REQ-DEVTOOLS-1 Layered Per-Site Override Storage & Startup Restore
`DevTools` MUST persist only user-defined overrides per `DevFixType` (`detector`, `dynamic`, `filter`, `static`) in `chrome.storage.local`, and `DevTools.loadConfigOverrides()` MUST restore all four `DevFixType`s—including `detectorHints`—on startup, migrating any legacy monolithic `dev_*` blobs to overrides-only storage.

#### Scenario: Startup restores detector hints and theme overrides
- **GIVEN** `chrome.storage.local` contains saved overrides for `detector`, `dynamic`, `filter`, and `static`
- **WHEN** `DevTools.init()` runs on background startup
- **THEN** `ConfigManager.overrides` is populated for all four `DevFixType`s and `DETECTOR_HINTS_INDEX` reflects the saved detector hints

#### Scenario: Single-site edit does not duplicate built-in config
- **GIVEN** the user edits or adds a single site fix in Developer Tools
- **WHEN** `DevTools` persists the override to `chrome.storage.local`
- **THEN** only the user's override entries are stored, and `ConfigManager.raw.*` remains intact for remote `syncSitesFixes` updates

### Requirement: REQ-DEVTOOLS-2 URL-Keyed Merge Over Built-In Config
`ConfigManager.handle*()` MUST merge `ConfigManager.overrides.<type>` over `ConfigManager.raw.<type>` before calling `indexSitesFixesConfig()`, replacing any `raw` block whose `url` list matches an override entry so `getSitesFixesFor()` applies the override without stacking the overridden `raw` rule.

#### Scenario: Overriding an existing built-in site rule
- **GIVEN** `ConfigManager.raw.dynamicThemeFixes` contains a rule for `example.com`
- **WHEN** the user applies an override for `example.com`
- **THEN** `getSitesFixesFor('https://example.com', ...)` returns the user's override rule and does NOT also return the overridden `raw` rule

#### Scenario: Remote config sync preserves user overrides
- **GIVEN** the user has a dynamic override for `example.com`
- **WHEN** `syncSitesFixes` updates `ConfigManager.raw.dynamicThemeFixes` for `other.com`
- **THEN** `other.com` receives the remote update and `example.com` retains the user's override

### Requirement: REQ-DEVTOOLS-3 Per-Site Editor Isolated Apply, Reset, and Delete
`PerSiteConfigEditor` MUST list all effective sites (`raw` merged with overrides) with `default`, `overridden`, or `custom` state, detect changes by content rather than string length, validate per-site `parse(text)` output (rejecting empty or multi-block input with an error message instead of corrupting state), `Reset` only the selected site's override back to `raw`, `Delete` custom (non-`raw`) entries, and `await`/refresh after `addNewFix`.

#### Scenario: Resetting a single overridden site
- **GIVEN** `example.com` and `another.com` both have user overrides in `PerSiteConfigEditor`
- **WHEN** the user clicks `Reset changes` while editing `example.com`
- **THEN** only `example.com` reverts to its `ConfigManager.raw` default and `another.com` keeps its override

#### Scenario: Empty or multi-block input rejected in Per-Site Editor
- **GIVEN** the user is editing a single site in `PerSiteConfigEditor`
- **WHEN** the user clears the textarea (or enters multiple site blocks) and clicks `Apply`
- **THEN** an error message is displayed, `store.fixes` is not corrupted, and no partial override is persisted

### Requirement: REQ-DEVTOOLS-4 Overrides-Only Full Editor and Read-Only Defaults Viewer
`ConfigEditorTabs` MUST scope the `Full Editor` tab to the user's override layer (empty when no overrides exist) and provide a read-only `View Defaults` tab displaying `ConfigManager.raw.*`. `ConfigEditor` MUST attach at most one `keydown` Tab-indentation listener per textarea (using `setRangeText` / selection replacement instead of `document.execCommand`) and clear dialog state on `delete`. `Body` MUST NOT render an empty `Advanced` tab when `__PLUS__` is false.

#### Scenario: Inspecting defaults while Full Editor shows overrides
- **GIVEN** no DevTools overrides exist
- **WHEN** the user opens Developer Tools
- **THEN** `Full Editor` is empty, `View Defaults` displays the read-only built-in/remote config, and pasting a new override into `Full Editor` applies it over `raw`

### Requirement: REQ-DEVTOOLS-5 Settings Export/Import with DevTools Overrides and Safe Dialogs
`ExportSettings` MUST download `Nyx-Settings.json` containing `UserSettings` and an optional `devTools` object of non-empty overrides across the four `DevFixType`s. `ImportSettings` MUST accept both `{...UserSettings, devTools}` and legacy `UserSettings`-only JSON, validate `devTools` entries before applying, close the warning dialog before opening the file picker (and on cancel), and render `<MessageBox>` outside `<Button>` in both `ImportSettings` and `ResetSettings`.

#### Scenario: Round-trip Export and Import with DevTools overrides
- **GIVEN** the user has customized settings and a dynamic DevTools override for `example.com`
- **WHEN** the user exports settings to `Nyx-Settings.json` and imports that file after resetting
- **THEN** both `UserSettings` and the `example.com` DevTools override are restored

#### Scenario: Cancelling file picker after import warning
- **GIVEN** the user clicks `Import Settings` and confirms the warning dialog
- **WHEN** the user cancels the OS file picker
- **THEN** the warning dialog is already closed and does not remain stuck on screen

### Requirement: NFR-DEVTOOLS-1 Override Storage Footprint & Merge Latency
Override persistence MUST store only user-modified/added entries (not untouched `ConfigManager.raw.*` rules), and `ConfigManager` merge + index rebuild on override change MUST complete synchronously in memory without network I/O.

#### Scenario: Storage footprint after single-site override
- **GIVEN** `ConfigManager.raw.dynamicThemeFixes` contains hundreds of built-in site rules
- **WHEN** a user overrides one site
- **THEN** the persisted `dev_dynamic_theme_fixes` value contains only that single site's rule block
