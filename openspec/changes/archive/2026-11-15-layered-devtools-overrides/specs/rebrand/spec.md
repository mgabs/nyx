# Spec Delta: rebrand

## MODIFIED Requirements

### Requirement: REQ-BRAND-3 Settings and Developer Tools Identity
The popup, Settings, and Developer Tools pages MUST identify as **Nyx**, including the popup `m-logo` SVG wordmark and link, `Nyx-${url}.css` theme export filename, `Nyx-Settings.json` settings export filename, compatibility warning text, background console welcome banner, Settings page title/wordmark, and Developer Tools page title/wordmark, without exposing Dark Reader support addresses or branding or the legacy paid-license `Activation` tab (`ActivationTab`, `startActivation`, `resetActivation`) while preserving upstream MIT attribution.

#### Scenario: Opening extension settings or developer tools
- **GIVEN** the extension is loaded in Chrome or Firefox
- **WHEN** a user opens the popup, Settings, or Developer Tools
- **THEN** the popup displays the Nyx wordmark linking to `mgabs/nyx`, Settings and Developer Tools titles and wordmarks identify Nyx, no `Activation` tab is shown in Settings, and no Dark Reader support email or branding appears

#### Scenario: Exporting a theme stylesheet from popup
- **GIVEN** the user opens the Theme tab in the popup
- **WHEN** the user exports the generated CSS
- **THEN** the downloaded file is named `Nyx-${url}.css`

#### Scenario: Exporting settings from Settings Advanced tab
- **GIVEN** the user opens Settings -> Advanced
- **WHEN** the user clicks Export Settings
- **THEN** the downloaded file is named `Nyx-Settings.json`
