# Architecture & Technical Design: P0 Foundation & Zero-FOUC

## 1. Overview & Invariants

This design details the technical implementation of P0: eliminating white flash (Zero-FOUC) during initial page load, optimizing core caching and color parsing hot-paths, and rebranding manifests and attribution to Nyx.

### Key Invariants
1. **Zero-Flash Invariant**: The browser canvas MUST render dark (`#181a1b`) on frame 0 before the DOM tree or stylesheets finish parsing.
2. **Pure Core Invariant**: `src/utils/cache.ts` and `src/utils/color.ts` are pure functions with zero browser DOM, Extension API, or third-party dependencies.
3. **Attribution Invariant**: The original `Copyright (c) 2026 Dark Reader Ltd.` is retained verbatim in `LICENSE` alongside the Nyx contributors notice.

---

## 2. Domain Models, State & Interface Contracts

### 2.1 True LRU Cache (`src/utils/cache.ts`)
```typescript
export function cachedFactory<K, V>(factory: (key: K) => V, size: number): (key: K) => V {
    const cache = new Map<K, V>();
    return (key: K): V => {
        if (cache.has(key)) {
            const val = cache.get(key)!;
            cache.delete(key);
            cache.set(key, val); // Refresh access order
            return val;
        }
        const value = factory(key);
        cache.set(key, value);
        if (cache.size > size) {
            const oldest = cache.keys().next().value!;
            cache.delete(oldest);
        }
        return value;
    };
}
```

### 2.2 Fast-Path Character Code Color Parser (`src/utils/color.ts`)
```typescript
// Fast-path parsing without RegExp allocation
function parseHexFast(c: string): RGBA | null;
function parseRgbFast(c: string): RGBA | null;
```
- Inspect character codes for `#` (0x23), `r` (0x72), `g` (0x67), `b` (0x62), `(` (0x28).
- Directly compute numbers via character code offsets (`c.charCodeAt(i) - 48`).
- Bypasses `c.match(hexMatch)` and `c.match(rgbMatch)` RegExp evaluations.

### 2.3 Synchronous Root Canvas Injection (`src/inject/dynamic-theme/injection.ts`)
```typescript
export function injectEarlyRootStyle(): void {
    const rootStyle = document.createElement('style');
    rootStyle.classList.add('darkreader', 'darkreader--root');
    rootStyle.textContent = 'html, body { background: #181a1b !important; color: #e8e6e3 !important; }';
    (document.documentElement || document.head).appendChild(rootStyle);
}
```
Executed immediately upon content script execution without waiting for `document.body` or `MutationObserver`.

### 2.4 Pre-Paint MV3 Registration (`src/background/tab-manager.ts`)
- Calls `chrome.scripting.registerContentScripts` on extension startup for all URLs (`<all_urls>`).
- Sets `runAt: 'document_start'` and `cssOrigin: 'USER'`.

---

## 3. Architecture Diagram & Data Flow

```
+-------------------------------------------------------------------+
|                        PAGE NAVIGATION EVENT                      |
+-------------------------------------------------------------------+
                                  |
                                  v
              +---------------------------------------+
              |   MV3 Declarative User Style Active   |
              |   (chrome.scripting.registerScripts)  |
              +---------------------------------------+
                                  |
                                  v
              +---------------------------------------+
              |     Initial HTML Byte Stream Arrives   |
              +---------------------------------------+
                                  |
                   +--------------+--------------+
                   |                             |
                   v                             v
      [Standard Engine (FOUC)]          [Nyx Zero-FOUC Engine]
                   |                             |
      Waits for body via observer       Immediate synchronous root style
                   |                    attached to documentElement
                   v                             |
         White Frame Painted!                    v
                   |                    First Paint: #181a1b (Dark!)
                   v                             |
        Content Script Parses CSS       Full Dynamic Theme Applies
                   |                             |
          Canvas Flashes Dark!                  Zero White Flash!
```

---

## 4. Boundary Rules & Budgets

- **Pure Core vs. I/O Shell**:
  - `src/utils/cache.ts` and `src/utils/color.ts` form the pure functional core.
  - `src/inject/dynamic-theme/injection.ts` and `src/background/tab-manager.ts` form the browser/DOM I/O shell.
- **Latency & Resource Budgets**:
  - **NFR-FOUC-1**: 0 white frames ($0\text{ ms}$) during page paint.
  - **NFR-PERF-1**: $\ge 3\times$ speedup on `#hex` and `rgb()` color parsing compared to RegExp.
  - **Memory**: $O(N)$ bounded memory for `cachedFactory` with strict maximum entries.

---

## 5. Testing Strategy

1. **BDD Scenarios**:
   - `test/unit/cache.spec.ts`: Test cache hit re-insertion, LRU order preservation under capacity overflow.
   - `test/unit/color.spec.ts`: Verify identical output between `parseHexFast` / `parseRgbFast` and legacy RegExp parser for all valid 3-digit, 6-digit hex and rgb strings.
   - `test/browser/zero-fouc.spec.ts`: Verify root stylesheet attachment to `documentElement` when `document.body` is null.
2. **Unit Tests ($\ge 95\%$ Coverage)**:
   - Target 100% line and branch coverage in `src/utils/cache.ts` and new parsing paths in `src/utils/color.ts`.
3. **Mutation Testing (100% Kill)**:
   - Stryker mutation tests on `cache.ts` (kill any mutations to eviction logic or cache deletion).
   - Stryker mutation tests on fast-path parsing offsets and conditions.

---

## Review Gate

- [x] **Gate 3 Approval**: Architecture & design reviewed and approved by human before task breakdown.
