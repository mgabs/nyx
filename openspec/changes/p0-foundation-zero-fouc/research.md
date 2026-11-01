# Research & Technical Tradeoffs: P0 Foundation & Zero-FOUC

## 1. Intent & Ground Truth

### Problems
1. **White Flash on Navigation / Tab Creation (FOUC)**: Dark Reader waits for content scripts to initialize and parse styles asynchronously. In `src/inject/dynamic-theme/injection.ts`, styles wait for `document.body` via a `MutationObserver`. During initial HTML parsing before DOMContentLoaded, the browser paints default white canvas.
2. **Cache Churn on Long Sessions**: `cachedFactory` in `src/utils/cache.ts` uses FIFO eviction (`cache.keys().next().value`). Hot keys accessed frequently are evicted when the cache reaches limit, forcing repeated color computations.
3. **Hot-Path Regex Overhead**: `parse()` in `src/utils/color.ts` executes multiple regex checks (`/^rgba?\([^\(\)]+\)$/`, `/^#[0-9a-f]+$/i`) on every single color parsed during stylesheet traversal.
4. **Branding & License**: Current manifest, package metadata, and headers still refer to Dark Reader rather than the **Nyx** fork.

### Verified Constraints
- Manifest V3 environment (`__CHROMIUM_MV3__`) enables `chrome.scripting.registerContentScripts` and `chrome.scripting.insertCSS` with `cssOrigin: 'USER'` and `runAt: 'document_start'`.
- `cachedFactory` operates synchronously in memory with small maximum sizes (typically 1024-4096 entries).
- Spec-Rails rules require $\ge 95\%$ line/branch coverage and zero direct edits to `main`.

---

## 2. Options Explored

### Option A: In-House Zero-Dependency Fast Engine (Recommended)
- **Zero-FOUC**: Inject early root dark background (`html, body { background: #181a1b !important; color: #e8e6e3 !important; }`) via synchronous `document_start` declarative CSS (`chrome.scripting.insertCSS` with `cssOrigin: 'USER'`) and early element injection before `document.body` exists (`document.documentElement.appendChild`).
- **Cache**: Update `cachedFactory` to delete-and-reinsert on hits (`cache.delete(key); cache.set(key, val);`), transforming FIFO into true $O(1)$ LRU with zero dependencies.
- **Color Parsing**: Implement fast-path character code inspection for `#hex` and `rgb()` strings in `src/utils/color.ts`, bypassing regular expressions on hot paths.
- **Rebrand**: Update `package.json`, `manifest.json`, bundle tasks, and maintain MIT attribution.

### Option B: External Libraries & Off-the-Shelf Packages
- Import `quick-lru` or `lru-cache` for caching.
- Import `colord` or `color-string` for fast color parsing.
- Use standard content script matches without declarative user origin CSS.
- **Cons**: Adds bundle bloat, increases attack surface in MV3 extension context, introduces third-party dependency vulnerabilities. Violates Ponytail / YAGNI rule.

### Option C: Inline Blocking Script Injection
- Inject inline `<script>` tags synchronously at the very top of HTML streams via `chrome.webRequest` or declarativeNetRequest response filtering.
- **Cons**: MV3 CSP strictly forbids injecting arbitrary inline code into pages without host permissions; declarativeNetRequest does not allow arbitrary body modification in Chrome extensions.

---

## 3. Tradeoff Matrix

| Criteria | Option A (In-House Minimal) | Option B (External Libraries) | Option C (Inline Scripting) |
| :--- | :--- | :--- | :--- |
| **Complexity** | Low (Small, targeted diffs) | Medium (API adaptation) | High (Violates MV3 CSP) |
| **New Dependencies** | **0** (Pure standard JS) | 2–3 npm packages | 0 |
| **Performance & Latency** | **Fastest** (Zero overhead) | Fast | Slow (CSP roundtrips) |
| **Maintenance Burden** | Minimal (Standard standard library) | Dependency updates / security audits | High |
| **Blast Radius** | Small (Scoped to cache, color, injection) | Moderate | Large |

---

## 4. Recommendation

Adopt **Option A**: zero external dependencies, minimal diff, strict YAGNI. Eliminates FOUC via early root declarative CSS, converts `cachedFactory` to true $O(1)$ LRU in 4 lines, and adds character-code fast-path parsing for `#hex` and `rgb()`.

---

## 5. Breaking Changes & Deprecations

- `openspec/specs/`: None (Initial spec baseline established by P0).

---

## Review Gate

- [x] **Gate 0 Decision**: Go (Option A)
