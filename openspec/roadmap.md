# Nyx Engineering Roadmap: Prioritized Execution Plan

> **Brand**: **Nyx** (*Greek goddess of night*)  
> **Tagline**: *Instant Dark Mode for the Web. Zero White Flash.*  
> **Core Value**: Next-gen dark mode engine with zero-FOUC instant paint, automated WCAG contrast, and OLED support.

---

## 📊 Priority Matrix & Weights (Impact 1-5 / Effort 1-5)

```
+-----------------------------------------------------------------------+
| NYX ROADMAP: WEIGHTS & PRIORITY (IMPACT 1-5 / EFFORT 1-5)             |
+-----------------------------------------------------------------------+
| ID   | Item                          | Imp | Eff | Ratio | Priority   |
+------+-------------------------------+-----+-----+-------+------------+
| B.1  | Manifest & Name Rebrand       |  4  |  1  |  4.0  | P0 (Must)  |
| B.2  | MIT Attribution               |  5  |  1  |  5.0  | P0 (Must)  |
| 0.1  | User Origin Root Stylesheet   |  5  |  2  |  2.5  | P0 (Core)  |
| 0.2  | MV3 Pre-Paint CSS Register    |  5  |  2  |  2.5  | P0 (Core)  |
| 1.1  | True LRU Cache Factory        |  4  |  1  |  4.0  | P0 (Quick) |
| 1.2  | Fast-Path Color Parser (char) |  4  |  1  |  4.0  | P0 (Quick) |
+------+-------------------------------+-----+-----+-------+------------+
| 3.1  | Precompile 820KB Fixes Config |  5  |  3  |  1.67 | P1 (Perf)  |
| 3.2  | Config Fast-Load in SW        |  4  |  2  |  2.0  | P1 (Perf)  |
| 2.1  | Luminance & Contrast Math     |  4  |  2  |  2.0  | P1 (Diff)  |
| 2.2  | Min Contrast Floor (WCAG)     |  4  |  3  |  1.33 | P1 (Diff)  |
| 4.1  | DOM Mutation Batching         |  4  |  3  |  1.33 | P1 (Perf)  |
+------+-------------------------------+-----+-----+-------+------------+
| B.3  | App Icons & Assets            |  3  |  2  |  1.5  | P2         |
| 6.1  | OLED Pitch Black Mode         |  3  |  2  |  1.5  | P2         |
| 5.1  | Auto-Contrast UI Toggle       |  3  |  2  |  1.5  | P2         |
| 4.2  | AdoptedStyleSheet Cache       |  3  |  3  |  1.0  | P2         |
| 3.3  | Config Prune (ping dead domains)| 2  |  2  |  1.0  | P2         |
+------+-------------------------------+-----+-----+-------+------------+
| 6.2  | Colorway Presets (Catppuccin) |  2  |  3  |  0.67 | P3 (Fluff) |
| 7.1  | Canvas Entropy Image Inversion|  2  |  4  |  0.50 | Cut (Heavy)|
| 7.2  | LaTeX / Math Formula Detect   |  2  |  4  |  0.50 | Cut (Niche)|
| 8.1  | Ambient / Battery API Sync    |  1  |  4  |  0.25 | Cut (YAGNI)|
| 9.1  | Custom CSS In-App Editor      |  2  |  4  |  0.50 | Backlog    |
| 9.2  | Gist / Profile Sync           |  2  |  4  |  0.50 | Backlog    |
+-----------------------------------------------------------------------+
```

---

## 🎯 Tier Breakdown

### 1. P0: Foundation & Zero-FOUC (Must-Have MVP)
- **Fork Compliance**: B.1, B.2.
- **Flagship Zero-FOUC**: 0.1, 0.2. Eliminate initial white flash.
- **Hot-Path Quick Wins**: 1.1, 1.2. Replace FIFO with LRU cache, char-code color parser.

### 2. P1: Engine Speed & Readability (Core Differentiator)
- **Startup Latency**: 3.1, 3.2. Precompile 820KB regex config to binary/JSON trie.
- **Readability Engine**: 2.1, 2.2. Dynamic WCAG AA contrast enforcement.
- **DOM Stability**: 4.1. Mutation microtask batching for SPAs.

### 3. P2: User Features & Polish
- **Branding Assets**: B.3 (Icons), B.4 (Sponsor link).
- **Themes**: 6.1 (OLED black canvas), 5.1 (UI toggle for auto-contrast).
- **DOM/Fix Optimization**: 4.2 (AdoptedStyleSheet caching), 3.3 (Config dead domain pruning).

### 4. Cut / Backlog (YAGNI)
- **Cut**: 7.1 (OffscreenCanvas entropy sampling - heavy CPU overhead), 7.2 (Niche formula rules), 8.1 (Battery/Ambient API - deprecated/unreliable).
- **Backlog**: 6.2 (Presets), 9.1 (Custom CSS editor), 9.2 (Cloud/Gist profile sync).

---

## 🛠️ Detailed Work Packages

### Phase 1: P0 Foundation & Zero-FOUC

- [ ] **B.1. Metadata & Manifest Rebranding**
  - **Files**: `tasks/bundle-manifest.js`, `src/manifest.json`, `package.json`
  - **Action**: Update extension name to **Nyx**, short description, homepage URL, repository references.
- [ ] **B.2. MIT License Compliance & Attribution**
  - **File**: `LICENSE`
  - **Action**: Preserve original copyright notice (`Copyright (c) 2026 Dark Reader Ltd.`) and add Nyx contributors notice.
- [ ] **0.1. Declarative User Origin Root Stylesheet**
  - **File**: `src/inject/dynamic-theme/injection.ts`
  - **Action**: Enforce root baseline dark canvas synchronously (`html, body { background: #181a1b !important; }`) before HTML parsing starts.
- [ ] **0.2. Service Worker Pre-Paint CSS Registration (MV3)**
  - **File**: `src/background/tab-manager.ts`
  - **Action**: Pre-register dynamic content scripts/styles using `chrome.scripting.registerContentScripts` so styles apply before content script handshake completes.
- [ ] **1.1. Convert `cachedFactory` to True LRU**
  - **File**: `src/utils/cache.ts`
  - **Action**: Change FIFO eviction to delete-and-reinsert on cache hits. Prevent cache churn on long browsing sessions.
- [ ] **1.2. Fast-Path CSS Color Parser**
  - **File**: `src/utils/color.ts`
  - **Action**: Bypass regex for standard 3/6-digit hex (`#fff`, `#ffffff`) and integer `rgb(r, g, b)`. Use char code inspection.
- [ ] **1.3. Unit Test & Benchmark Baseline**
  - **Action**: Establish benchmark for `parseColor` and `modifyColorWithCache` under heavy load.

---

### Phase 2: P1 Engine Speed & Contrast

- [ ] **3.1. Build-Time Serialization for Site Fixes**
  - **Files**: `tasks/bundle-manifest.js`, `tasks/build.js`, `src/generators/utils/parse.ts`
  - **Action**: Compile `src/config/dynamic-theme-fixes.config` (~820KB) into indexed JSON or flat trie at build time.
- [ ] **3.2. Background Config Manager Fast-Load**
  - **File**: `src/background/config-manager.ts`
  - **Action**: Load pre-indexed structures directly. Bypass `indexSitesFixesConfig()` regex splitting on extension boot.
- [ ] **2.1. Relative Luminance & Contrast Math Utilities**
  - **File**: `src/utils/color.ts`
  - **Action**: Add sRGB relative luminance ($L = 0.2126R + 0.7152G + 0.0722B$) and contrast ratio formula $\frac{L_1 + 0.05}{L_2 + 0.05}$.
- [ ] **2.2. Pole-Relative Minimum Contrast Floor**
  - **File**: `src/inject/dynamic-theme/modify-colors.ts`
  - **Action**: In `modifyFgHSL()`, evaluate contrast against background pole. Dynamically scale text lightness $L$ until contrast $\ge 4.5:1$ is met.
- [ ] **2.3. Paired CSS Rule Contrast Enforcement**
  - **File**: `src/inject/dynamic-theme/modify-css.ts`
  - **Action**: When a single CSS declaration defines both `color` and `background-color`, inspect both generated colors. If contrast $< 4.5:1$, shift text color towards high-contrast pole.
- [ ] **4.1. Inline Style Batching**
  - **File**: `src/inject/dynamic-theme/inline-style.ts`
  - **Action**: Batch DOM mutation records into single microtask queue before triggering inline style recoloring.

---

### Phase 3: P2 Controls & Theme Features

- [ ] **B.3. Icon & Visual Assets**
  - **Files**: `src/ui/assets/icons/`
  - **Action**: Generate sleek minimalist logo for Nyx (crescent/veil motif) across 16x16, 32x32, 48x48, 128x128.
- [ ] **B.4. Custom Donation / Sponsor Link**
  - **File**: `src/utils/links.ts`
  - **Action**: Route `DONATE_URL` to Nyx sponsor/donation page.
- [ ] **5.1. Theme Definition Extension & Popup Toggle**
  - **Files**: `src/definitions.d.ts`, `src/defaults.ts`, `src/ui/popup/components/filter-settings/`
  - **Action**: Add `autoContrast: boolean` to theme schema and toggle switch in popup UI.
- [ ] **6.1. OLED Pitch Black Mode**
  - **Files**: `src/defaults.ts`, `src/inject/dynamic-theme/modify-colors.ts`
  - **Action**: Add `oled: boolean` setting clamping background to `#000000` with black point curve adjustment.
- [ ] **4.2. Adopted Style Manager Optimization**
  - **File**: `src/inject/dynamic-theme/adopted-style-manger.ts`
  - **Action**: Cache converted `CSSStyleSheet` objects to eliminate redundant style sheet construction in Shadow DOM roots.
- [ ] **3.3. Config Pruning via Automated Ping**
  - **File**: `tasks/ping.js`
  - **Action**: Prune dead domains to reduce selector payload.
