# Proposal

## Intent
Remove Dark Reader's legacy paid-license `Activation` tab from Nyx Settings and delete all dead `startActivation` / `resetActivation` plumbing across UI, messaging, and background.

## Problem Statement
Nyx is free and open-source with no paid activation keys (`dr...`). Currently, opening **Settings -> Activation** displays a dead `"Activation was successful"` placeholder with a `Reset` button and `nyx-thumb-up.svg`.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `rebrand`: Update `REQ-BRAND-3` to require Settings to omit the `Activation` tab and activation flows; update `REQ-BRAND-6` to remove the now-unused `nyx-thumb-up.svg` asset.

## Scope

### In-Scope
- Remove `<TabPanel.Tab id="activation">` and `ActivationTab` import from `src/ui/options/body/body.tsx`.
- Delete `src/ui/options/activation/activation-tab.tsx`, `src/ui/icons/key-icon.tsx` (and export in `src/ui/icons/index.tsx`), `src/ui/assets/images/nyx-thumb-up.svg`, and `.activation__error` / `.activation-tab--checking` CSS in `src/ui/options/style.less`.
- Remove `startActivation` and `resetActivation` from `src/definitions.d.ts`, `src/ui/connect/connector.ts`, `src/background/messenger.ts`, and `src/background/extension.ts`.
- Add unit assertions in `tests/unit/brand/brand.tests.ts` verifying `ActivationTab`, `KeyIcon`, `nyx-thumb-up.svg`, `startActivation`, and `resetActivation` are absent.

### Out-of-Scope (YAGNI)
- Changing `time.activation` / `time.deactivation` schedule settings in `AutomationTab` or settings validation.
- Removing `UIHighlights` infrastructure (`src/background/ui-highlights.ts`) used for general UI highlight state.

## Assumptions
- **ASM-GEN-1**: Neither `__PLUS__` nor non-Plus builds require `ActivationTab` or `startActivation`/`resetActivation`.

## Success Metrics
- Zero references to `ActivationTab`, `KeyIcon`, `nyx-thumb-up.svg`, `startActivation`, or `resetActivation` remain in `src/`.
- `npm test`, `npm run lint`, `npm run build`, and `npm run test:chrome-mv3` pass with zero errors.

## Review Gate
- [x] **Gate 1 Approval**: Proposal reviewed and approved by human before drafting specs.
