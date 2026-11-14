# Research & Technical Tradeoffs

## 1. Intent & Ground Truth
In Nyx Settings (`src/ui/options/body/body.tsx`), there is still an `Activation` tab (`src/ui/options/activation/activation-tab.tsx`), inherited from Dark Reader's paid license / anniversary activation flow:
- Because `full-nyx-rebrand` emptied `proposedHighlights` (`[]`), `!props.data.uiHighlights.includes('anniversary')` is always `true`, so the Activation tab always renders a stub `"Activation was successful"` message, a `Reset` button, and `src/ui/assets/images/nyx-thumb-up.svg`.
- When `'anniversary'` was active, it prompted for an email and a 25-char key starting with `'dr'` (`Extension.startActivation` in `src/background/extension.ts:667-690`).
- `startActivation` and `resetActivation` have **zero other callers** anywhere in `src/` or `tests/` once `ActivationTab` is removed:
  - `src/definitions.d.ts:41-42` (`ExtensionActions`)
  - `src/ui/connect/connector.ts:131-137`
  - `src/background/messenger.ts:22-23, 149-152`
  - `src/background/extension.ts:297-298, 667-690`
  - `src/ui/icons/key-icon.tsx` & `src/ui/icons/index.tsx` (`KeyIcon` has zero other callers)
  - `src/ui/options/style.less` (`.activation__error`, `.activation-tab--checking`)
  - `src/ui/assets/images/nyx-thumb-up.svg` (only used in `activation-tab.tsx`)

## 2. Options Explored
1. **Option A — UI-only removal**: Remove `<TabPanel.Tab id="activation">`, `src/ui/options/activation/activation-tab.tsx`, `KeyIcon`, `nyx-thumb-up.svg`, and `.activation*` CSS, leaving `startActivation`/`resetActivation` dead code in `definitions.d.ts`, `connector.ts`, `messenger.ts`, and `extension.ts`.
2. **Option B — Full removal (UI + Messaging + Background)**: Remove `ActivationTab` and its UI assets/icons/CSS **plus** dead `startActivation`/`resetActivation` actions, message handlers, and `Extension` methods.

## 3. Tradeoff Matrix

| Criteria | Option A (UI-only) | Option B (Full Removal) |
| :--- | :--- | :--- |
| **Complexity** | Low | Low |
| **New Dependencies** | None | None |
| **Performance & Latency** | Neutral | Slightly smaller background & UI bundles |
| **Maintenance Burden** | Leaves dead `startActivation` / `resetActivation` | Zero dead activation code |
| **Blast Radius** | `src/ui/options/`, `src/ui/icons/`, `nyx-thumb-up.svg` | UI + `definitions.d.ts`, `connector.ts`, `messenger.ts`, `extension.ts` |

## 4. Recommendation
Adopt **Option B**: drop the `Activation` tab and cleanly delete all dead `startActivation`/`resetActivation` plumbing across UI, messaging, and background.

## 5. Breaking Changes & Deprecations
- Modifies **`REQ-BRAND-3`** (`openspec/specs/rebrand/spec.md`): specifies that Settings omits the legacy license `Activation` tab and activation actions.
- Modifies **`REQ-BRAND-6`** (`openspec/specs/rebrand/spec.md`): removes `nyx-thumb-up.svg` from the active UI asset list after `ActivationTab` removal.

## Review Gate
- [x] **Gate 0 Decision**: Human decides Go (Option B) before the proposal is drafted.
