# Research & Technical Tradeoffs

## 1. Intent & Ground Truth
Following `full-nyx-rebrand`, Nyx still uses Dark Reader's original visual identity:
- **Toolbar & extension icons (`src/icons/`)**: `dr_16.png`, `dr_48.png`, `dr_128.png`, `dr_active_19.png`, `dr_active_38.png`, `dr_active_light_19.png`, `dr_active_light_38.png` remain Dark Reader's legacy mask artwork and `dr_` filenames across [manifest.json](file:///Users/mmetawea/Workbench/nyx/src/manifest.json), [manifest-chrome-mv3.json](file:///Users/mmetawea/Workbench/nyx/src/manifest-chrome-mv3.json), and [icon-manager.ts](file:///Users/mmetawea/Workbench/nyx/src/background/icon-manager.ts).
- **UI icon & wordmark (`src/ui/assets/images/`)**: `nyx-icon-256x256.png` still contains the legacy mask icon; `nyx-type.svg` uses Dark Reader coral `#e96c4c`.
- **UI color palette**:
  - [src/ui/theme.less](file:///Users/mmetawea/Workbench/nyx/src/ui/theme.less) defines Dark Reader's slate-teal/coral palette (`@color-back: #141e24`, `@color-fore: #53a1b3`, `@color-control-active: #316e7d`, `@color-heading: #e96c4c`).
  - [src/ui/popup/md3-tokens.less](file:///Users/mmetawea/Workbench/nyx/src/ui/popup/md3-tokens.less) defines MD3 tonal surfaces over `#141e24` with `#53a1b3` primary and `#e96c4c` accent.
  - [src/ui/popup/compatibility.js](file:///Users/mmetawea/Workbench/nyx/src/ui/popup/compatibility.js) hardcodes `#e96c4c` for warning text/links.

User-chosen direction (from `/openspec-explore` + preview):
- **Icon**: Circular badge geometric owl (`nyx` master SVG rendered into `nyx_16.png`, `nyx_48.png`, `nyx_128.png`, `nyx_active_19.png`, `nyx_active_38.png`, `nyx_active_light_19.png`, `nyx_active_light_38.png`, and `nyx-icon-256x256.png`), with simplified high-contrast geometry at `16px`/`19px`/`38px` so ear tufts and amber eyes stay sharp.
- **Color Scheme**: Obsidian (`#111114`), Silver (`#c4c4cc`), and Amber (`#f59e0b`).

## 2. Options Explored
1. **Option A — Popup-only color override (`md3-tokens.less` only)**: Leaves `src/ui/theme.less` (`options`, `devtools`, `stylesheet-editor`) on Dark Reader slate-teal/coral while only updating popup and icons. Low blast radius, but leaves visual identity split across extension pages.
2. **Option B — Unified Obsidian + Silver + Amber across `theme.less`, `md3-tokens.less`, wordmark, and `nyx_*` Owl PNG icons generated from an SVG master**: Zero new runtime dependencies; PNG generation at build/prep time via existing tooling/Node script or SVG rasterization (`resvg`/`sharp`/headless canvas dev-only or committed crisp PNGs), single cohesive brand across popup, options, devtools, toolbar, and store icons.
3. **Option C — Runtime SVG toolbar icons / CSS custom property theme switcher**: Adds user-selectable themes and dynamic `<canvas>` icon rendering in `IconManager`. Over-engineered (YAGNI) and adds MV3 service-worker complexity.

## 3. Tradeoff Matrix

| Criteria | Option A (Popup-only) | Option B (Unified Palette + Owl PNGs) | Option C (Runtime Theme Switcher) |
| :--- | :--- | :--- | :--- |
| **Complexity** | Low | Low-Medium | High |
| **New Dependencies** | None | None (committed PNGs + SVG master) | Canvas / theme storage schema |
| **Performance & Latency** | Neutral | Neutral | Slight startup overhead |
| **Maintenance Burden** | Split palette maintenance | Single cohesive palette | High (multiple themes) |
| **Blast Radius** | `src/ui/popup/`, `src/icons/` | `src/ui/theme.less`, `src/ui/popup/`, `src/icons/`, manifests | `src/ui/`, `src/background/`, settings |

## 4. Recommendation
Adopt **Option B**: unify `src/ui/theme.less`, `src/ui/popup/md3-tokens.less`, `src/ui/popup/compatibility.js`, and `src/ui/assets/images/nyx-type.svg` on the Obsidian + Silver + Amber palette, and replace all `dr_*.png` / `nyx-icon-256x256.png` assets with crisp rasterized `nyx_*.png` owl badge icons from a committed SVG master.

## 5. Breaking Changes & Deprecations
- Modifies **`REQ-POPUP-3`** (`openspec/specs/popup-ui/spec.md`): replaces `#141e24` dark slate base and coral `#e96c4c` accents with Obsidian `#111114`, Silver `#c4c4cc`, and Amber `#f59e0b` across both `src/ui/popup/md3-tokens.less` and `src/ui/theme.less`.
- Extends **`REQ-BRAND-6`** (`openspec/specs/rebrand/spec.md`): adds `src/icons/nyx_*.png` owl icon filenames replacing legacy `src/icons/dr_*.png` files in manifests and `IconManager`.

## Review Gate
- [x] **Gate 0 Decision**: Human decides Go (Option B) before the proposal is drafted.
