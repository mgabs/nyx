# rebrand Specification

## Purpose
Establishes the Nyx fork identity across manifests and metadata while strictly preserving upstream MIT license attribution and copyright notices.

## Requirements

### Requirement: REQ-BRAND-1 Manifest & Extension Metadata Rebrand
The extension name, description, repository, and bundle configuration MUST identify as **Nyx** (*Instant Dark Mode for the Web. Zero White Flash.*).

#### Scenario: Manifest metadata inspection
- **WHEN** building production manifests via `tasks/bundle-manifest.js`
- **THEN** the extension `name` is output as `Nyx` and descriptions reflect zero-FOUC instant dark mode.

### Requirement: REQ-BRAND-2 MIT License Attribution Preservation
The project LICENSE MUST retain full upstream copyright notice (`Copyright (c) 2026 Dark Reader Ltd.`) alongside the Nyx contributors copyright notice.

#### Scenario: License compliance verification
- **WHEN** reviewing `LICENSE`
- **THEN** both original copyright and Nyx contributor notices are present and intact.

### Requirement: REQ-BRAND-3 Settings and Developer Tools Identity
The popup and Settings page titles MUST identify as Nyx settings, and the Developer Tools page title MUST identify as Nyx developer tools. Settings and Developer Tools headers and settings news descriptions MUST use the Nyx name without renaming internal CSS variables or removing upstream attribution.

#### Scenario: Opening extension settings or developer tools
- **WHEN** a user opens the popup, Settings, or Developer Tools
- **THEN** the page title identifies Nyx, and Settings and Developer Tools display the Nyx wordmark.
