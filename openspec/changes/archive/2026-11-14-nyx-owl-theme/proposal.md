# Proposal

## Intent
Replace Dark Reader's remaining visual assets and color palette with Nyx's own **Owl Badge** iconography and **Obsidian + Silver + Amber** UI theme across all extension surfaces (toolbar, manifests, popup, options, devtools, and stylesheet editor).

## Problem Statement
Even after text/API/token rebranding in `full-nyx-rebrand`, Nyx still displays Dark Reader's slate-teal/coral (`#141e24` / `#53a1b3` / `#e96c4c`) palette and legacy `dr_*.png` mask icons in the browser toolbar, extension manifests, and favicon/About page.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `popup-ui`: Update `REQ-POPUP-3` base/surface/accent color system from Dark Reader's `#141e24` slate-teal/coral to Nyx's Obsidian (`#111114`), Silver (`#c4c4cc`), and Amber (`#f59e0b`) across `src/ui/popup/md3-tokens.less`, `src/ui/theme.less`, and `src/ui/popup/compatibility.js`.
- `rebrand`: Extend `REQ-BRAND-6` to replace `src/icons/dr_*.png` and `src/ui/assets/images/nyx-icon-256x256.png` with Nyx Owl Badge PNG assets (`nyx_16.png`, `nyx_48.png`, `nyx_128.png`, `nyx_active_19.png`, `nyx_active_38.png`, `nyx_active_light_19.png`, `nyx_active_light_38.png`, `nyx-icon-256x256.png`) and update `src/ui/assets/images/nyx-type.svg` wordmark fill to `#f59e0b`.

## Scope

### In-Scope
- Master SVG owl badge asset(s) (detailed rimmed badge for `48/128/256px`; high-contrast simplified owl badge for `16/19/38px` dark & light browser toolbars) rendered into crisp transparent PNGs under `src/icons/` and `src/ui/assets/images/nyx-icon-256x256.png`.
- Update `src/manifest.json`, `src/manifest-chrome-mv3.json`, `src/background/icon-manager.ts`, and `tasks/bundle-html.js` (if needed) to reference `nyx_*.png` instead of `dr_*.png`.
- Update `src/ui/theme.less`, `src/ui/popup/md3-tokens.less`, `src/ui/popup/compatibility.js`, and `src/ui/assets/images/nyx-type.svg` to the Obsidian (`#111114`) + Silver (`#c4c4cc`) + Amber (`#f59e0b`) palette.
- Unit tests in `tests/unit/brand/brand.tests.ts` verifying `nyx_*.png` icon presence, zero `dr_*.png` references in manifests/`icon-manager.ts`, and updated palette tokens.

### Out-of-Scope (YAGNI)
- Runtime user-selectable UI theme switcher or settings schema changes.
- Changing injected webpage dark-mode default presets (`src/defaults.ts`).
- Animated SVG or canvas-drawn dynamic toolbar icons at runtime.
- Re-enabling `IconManager` commented-out `inactiveDark`/`inactiveLight` gray icons.

## Assumptions
- **ASM-GEN-1**: Chrome (MV2/MV3) and Firefox accept standard RGBA PNGs at `16x16`, `19x19`, `38x38`, `48x48`, `128x128` via `src/icons/nyx_*.png`.
- **ASM-GEN-2**: Updating `src/ui/theme.less` and `src/ui/popup/md3-tokens.less` updates all popup, options, devtools, and stylesheet-editor surfaces without structural layout changes.

## Success Metrics
- Zero `dr_*.png` files remain in `src/icons/` or referenced in `src/manifest*.json` and `src/background/icon-manager.ts`.
- All icon dimensions match their manifest/toolbar declarations (`16`, `19`, `38`, `48`, `128`, `256`).
- `npm test`, `npm run lint`, `npm run build`, and `npm run test:chrome-mv3` pass with zero errors.

## Review Gate
- [x] **Gate 1 Approval**: Proposal reviewed and approved by human before drafting specs.
