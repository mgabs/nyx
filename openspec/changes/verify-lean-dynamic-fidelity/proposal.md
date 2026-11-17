# Proposal

## Intent

Make Lean Dynamic reliably apply and remove its theme across supported page styles while preserving its existing low-overhead design, using red-green verification of user-visible behavior.

## Problem Statement

Lean is already on main, but its active change's unchecked tasks and narrow tests do not demonstrate its intended behavior. Review identified possible gaps in adopted stylesheet tracking, cross-origin imports, inline cleanup, stylesheet mutation handling and CSS export. Shared helper changes also warrant regression checks for Dynamic.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `lean-dynamic-theme`: reliable stylesheet and lifecycle handling, document-scoped export, and observable regression coverage.

## Scope

### In-Scope
- Reproduce and resolve confirmed fidelity and cleanup failures in Lean, including shared and changing adopted sheets, CSSOM edits, cross-origin imports, inline styles, engine switching, and loading cancellation.
- Export document-root CSS in live cascade order; exclude shadow-root styles from the single-file export and document that limitation. Preserve live styling of accessible shadow roots.
- Verify palette, settings, site fixes, registration, existing constraints, browser compatibility, and shared Dynamic behavior through meaningful tests and the project verification gates.
- Measure performance against Dynamic on representative workloads and document results and test limitations; reconcile evidence with the existing change's status without claiming unverified work complete.

### Out-of-Scope (YAGNI)
- Multi-file or runtime-loader export for shadow roots; closed shadow-root support.
- New UI or platform removal, replacement of Dynamic, and canvas-based image analysis in Lean.
- Independent performance optimization unrelated to correcting confirmed fidelity or lifecycle defects.

## Assumptions
- **ASM-GEN-1**: The current supported Lean browser baseline remains Chrome 119+ and Firefox 128+; available test environments determine which targets can be directly verified.
- **ASM-GEN-2**: A single exported CSS file is document-scoped; shadow-root styling remains available during live extension operation.

## Success Metrics
- Each confirmed defect has at least one observable regression test shown failing before the fix and passing afterward; any unreproduced concern is recorded with evidence.
- All six project verification gates pass, or an explicit environment blocker and resulting verification gap is recorded.
- Zero Lean-injected sync style elements and zero canvas image analysis in representative tests; document export excludes shadow-root rules and preserves document cascade.
- Report comparison workload, measurements and limitations without claiming a speedup unsupported by data; assess the existing 95% coverage and mutation targets with reproducible reports or document blockers.

## Review Gate
- [x] **Gate 1 Approval**: Proposal reviewed and approved by human before drafting specs.
