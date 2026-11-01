# Proposal: P0 Foundation, Zero-FOUC & Core Engine Quick Wins

## Intent
Establish the Nyx foundation by rebranding manifest and metadata, completely eliminating white screen flash during page load (Zero-FOUC), and optimizing core cache and color parsing hot paths with zero external dependencies.

## Problem Statement
Dark Reader users consistently suffer from blinding white flashes during tab creation and page navigation because content scripts apply styles asynchronously after DOM parsing begins. Furthermore, FIFO cache eviction in `cachedFactory` causes recalculation spikes during long sessions, regex-based color parsing slows down stylesheet processing, and the codebase retains upstream fork branding.

## Capabilities

### New Capabilities
- `zero-fouc`: Synchronous declarative user-origin root styles and MV3 pre-paint CSS injection to guarantee instant dark canvas.
- `core-perf`: True $O(1)$ LRU eviction in `cachedFactory` and char-code fast-path color parsing in `color.ts`.
- `rebrand`: Extension naming, manifest, package metadata, and MIT copyright attribution for Nyx.

### Modified Capabilities
- None.

## Scope

### In-Scope
- **B.1 / B.2**: Update package metadata, manifest references to Nyx, and preserve MIT license attribution.
- **0.1**: Declarative root dark styles (`html, body { background: #181a1b !important; }`) injected synchronously before HTML parsing in `src/inject/dynamic-theme/injection.ts`.
- **0.2**: Pre-paint dynamic CSS registration in MV3 service worker via `chrome.scripting.registerContentScripts` in `src/background/tab-manager.ts`.
- **1.1**: True LRU cache eviction (delete and re-insert on hit) in `src/utils/cache.ts`.
- **1.2**: Fast-path character code parsing for 3/6-digit hex (`#fff`, `#ffffff`) and standard integer `rgb(...)` in `src/utils/color.ts`.
- **1.3**: Unit tests verifying LRU cache behavior, color parser accuracy, and benchmarking baselines.

### Out-of-Scope (YAGNI)
- M2 WCAG AA relative luminance and dynamic contrast adjustments (P1).
- M3 Binary/JSON trie precompilation of the 820KB fixes file (P1).
- M6 OLED mode and custom preset palettes (P2).
- M7 OffscreenCanvas image and diagram entropy sampling (Cut).
- Third-party caching or color libraries (zero new dependencies).

## Assumptions
- **ASM-GEN-1**: Chromium MV3 `chrome.scripting` API supports `cssOrigin: 'USER'` and `runAt: 'document_start'`.
- **ASM-GEN-2**: In-memory `Map` order manipulation is synchronous and provides deterministic LRU ordering.
- **ASM-GEN-3**: Standard CSS colors on hot paths overwhelmingly consist of `#hex` and `rgb()` declarations.

## Success Metrics
- 0 white frames during new tab creation and cross-origin navigation.
- 100% cache retention for hot keys under capacity in `cachedFactory`.
- $\ge 3\times$ speedup in parsing standard hex and rgb colors over regex.
- $\ge 95\%$ test coverage across `src/utils/cache.ts`, `src/utils/color.ts`, and injection handlers.

## Review Gate
- [x] **Gate 1 Approval**: Proposal reviewed and approved by human before drafting specs.
