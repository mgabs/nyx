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
