# Research & Technical Tradeoffs

## 1. Intent & Ground Truth
- **Current popup routing (`src/ui/popup/index.tsx`, `src/ui/popup/components/body.tsx`)**:
  - `__PLUS__ && shouldUseAltUI()` delegates to `initAltUI()` (`@plus/popup/plus-body`).
  - `__PLUS__ && (previewNewestDesign || (isMobile && version >= 4.9.93))` renders `<PlusBody />`.
  - `isMobile || data.settings.previewNewDesign` renders `<NewBody />` (`src/ui/popup/body/index.tsx`) and toggles `html.preview` in `src/ui/popup/index.tsx`.
  - Desktop default (`previewNewDesign: false`) renders Classic UI (`src/ui/popup/components/body.tsx` + `header/`, `filter-settings/`, `site-list-settings/`, `more-settings/`, `news/`, `engine-switch/`, `font-settings/`, `custom-settings-toggle/`, `site-toggle/`).
- **Settings & DevTools**:
  - `previewNewDesign` lives in `src/defaults.ts` (`false`), `src/definitions.d.ts`, `src/utils/validation.ts`, `src/ui/connect/mock.ts`, `src/ui/devtools/components/body.tsx` (`.preview-design-button`), `tests/unit/utils/validation.tests.ts`, and `tests/inject/utils/url.tests.ts`.
- **Styling**:
  - `src/ui/theme.less` (`#141e24` background, `#316e7d` border, `#53a1b3` foreground, `#e96c4c` heading/selection) is shared with `src/ui/options/`, `src/ui/devtools/`, `src/ui/stylesheet-editor/`, and `src/ui/controls/`.
  - `NewBody` styles (`src/ui/popup/body/style.less`, `main-page/style.less`, `theme/*/style.less`, `news-section/style.less`, `page-viewer/style.less`) currently rely on `html.preview` / `html.mobile`, flat `2px` borders, sharp corners, and a fixed `height: 24.4375rem` on `.pages-section`.
- **E2E tests**:
  - `tests/browser/e2e/toggle.tests.ts` and `tests/browser/e2e/news.tests.ts` assert Classic UI selectors (`.toggle__off`, `.toggle__on`, `.header__more-settings-button`, `.news-button`, `div.news.news--expanded`, `.preview-design-button`).

## 2. Options Explored
- **Option A — Remove Classic UI & `previewNewDesign`, promote `NewBody` as sole non-Plus popup UI, and scope MD3 polish to `src/ui/popup/`**:
  - Pros: Eliminates dual-UI maintenance and `.preview` CSS branching; keeps `options/` and `devtools/` unaffected; keeps `__PLUS__` (`PlusBody`, `previewNewestDesign`, `initAltUI`) and `src/stubs/` intact; removes dead `PageId` stubs in `NewBody`.
  - Cons: Requires migrating `tests/browser/e2e/toggle.tests.ts` and `news.tests.ts` to `NewBody` selectors and removing `previewNewDesign` from settings/validation/DevTools.
- **Option B — Flip `previewNewDesign: true` in `src/defaults.ts` and keep Classic UI behind the toggle**:
  - Pros: Zero e2e selector migration if tests override `previewNewDesign: false`.
  - Cons: Retains dead Classic UI code, dual CSS scoping (`.preview` vs non-`.preview`), and DevTools toggle clutter.
- **Option C — Global MD3 overhaul in `src/ui/theme.less` and `src/ui/controls/`**:
  - Pros: Uniform MD3 across popup, options, and devtools.
  - Cons: High blast radius across `options/`, `devtools/`, and `stylesheet-editor/`, violating single-slice scope.

## 3. Tradeoff Matrix

| Criteria | Option A (Remove Classic + Scoped MD3) | Option B (Flip Default Only) | Option C (Global Theme Overhaul) |
| :--- | :--- | :--- | :--- |
| **Complexity** | Medium (cleanup + popup CSS + e2e migration) | Low | High |
| **New Dependencies** | None | None | None |
| **Performance & Latency** | Smaller popup CSS/JS bundle | Unchanged | Unchanged |
| **Maintenance Burden** | Low (single non-Plus UI) | High (dual UIs) | Medium |
| **Blast Radius** | Contained to `src/ui/popup/`, `previewNewDesign` refs, popup e2e | Low | High (`options/`, `devtools/`, `controls/`) |

## 4. Recommendation
Choose **Option A**: remove Classic UI (`src/ui/popup/components/*` except shared loading state) and `previewNewDesign`, make `NewBody` the single non-Plus popup UI, and apply Material Design 3 styling scoped strictly to `src/ui/popup/` without adding dependencies.

## 5. Breaking Changes & Deprecations
- None in `openspec/specs/` (`core-perf`, `rebrand`, `zero-fouc` remain unchanged).
- Internal breaking removal of `UserSettings.previewNewDesign`, Classic UI popup DOM selectors, and DevTools `.preview-design-button`.

## Review Gate
- [ ] **Gate 0 Decision**: Human decides Go (name the option) or No-Go before the proposal is drafted.
