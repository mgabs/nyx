# Research & Technical Tradeoffs

## 1. Intent & Ground Truth

Verify and improve the Lean Dynamic engine already on main using observable red-green tests, including its effect on the shared Dynamic engine. The existing `add-lean-dynamic-theme` change has unchecked implementation tasks even though its implementation landed; this change must not treat those checkboxes as evidence of verification.

Lean tracks adopted sheets by sheet identity, and scans them when a root is processed. Its cross-origin loader passes imports to a constructed sheet, and export joins sheets from different roots. Inline cleanup selects only a subset of override attributes in the document. These are code-review findings requiring reproduction in supported browsers. Existing tests cover basic theming, site fixes, initial adopted sheets, and a synthetic stylesheet update notification; they do not establish all lifecycle and browser cases. Unit tests and lint passed during exploration; other gates and performance goals remain unverified.

The user chose document-only CSS export; live theming should continue to cover accessible shadow roots. The existing durable `lean-dynamic-theme` spec uses REQ-LEAN identifiers that differ from the active change's identifiers, so requirements must be reconciled by text and capability, not identifier alone.

## 2. Options Explored

- **A: Targeted red-green fidelity work:** reproduce page, lifecycle, export and compatibility cases, then fix confirmed failures while preserving Lean's constraints. Pros: observable outcomes and bounded scope. Cons: browser testing and careful lifecycle handling are required.
- **B: Reuse the complete Dynamic engine:** replace Lean's separate orchestration with the existing engine. Pros: reuse mature behavior. Cons: undermines the no-style-injection and no-image-analysis goals and changes the product's performance tradeoff.
- **C: Tests only:** record gaps without fixing them. Pros: minimal implementation risk. Cons: leaves known user-visible defects unresolved and cannot meet the intended behavior.

## 3. Tradeoff Matrix

| Criteria | Option A | Option B | Option C |
| :--- | :--- | :--- | :--- |
| **Complexity** | Moderate | High migration | Low |
| **New Dependencies** | None anticipated | None anticipated | None anticipated |
| **Performance & Latency** | Measure and preserve constraints | Likely changes Lean's profile | Existing behavior unchanged |
| **Maintenance Burden** | Focused fixes and regressions | Reduced duplication but changed contract | Known gaps remain |
| **Blast Radius** | Lean plus shared-helper regression checks | Both engines | Tests only |

## 4. Recommendation

Choose A: verify behavior with failing browser-level tests before implementing focused fixes. Measure performance rather than assuming the architecture achieves a particular improvement.

## 5. Breaking Changes & Deprecations

No existing durable requirement is proposed for deprecation. The current durable `REQ-LEAN-2`, `REQ-LEAN-3`, and `REQ-LEAN-4` may need clarification or extension for real CSSOM changes, cascade, and shared or changing adopted sheets. Document-only export changes the existing combined output behavior and requires an explicit delta; the active change's export requirement is not a durable requirement and uses a conflicting identifier.

## Review Gate
- [x] **Gate 0 Decision**: A
