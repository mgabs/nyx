# Theme Engines

Nyx supports multiple theme engines depending on your browser and site complexity:

| Engine | Approach | Best For |
| :--- | :--- | :--- |
| **Dynamic (`dynamicTheme`)** | Full JS CSS parsing, `palette.ts` color mapping, and `<canvas>` image analysis | Maximum per-site visual tuning |
| **Lean Dynamic (`leanDynamicTheme`)** | Consistent cross-site palette via `adoptedStyleSheets` (`replaceSync()`), zero `<canvas>` image analysis, shared SPA rule cache, and coalesced DOM updates (Chrome 119+ / Firefox 128+) | Fast, low-CPU/RAM theming on heavy SPAs |
| **Filter (`cssFilter`)** | CSS `invert(1) hue-rotate(180deg)` filter | Simple lightweight inversion |
| **Filter+ (`svgFilter`)** | SVG `feColorMatrix` color filter | Tuned filter inversion |
| **Static (`staticTheme`)** | Fast global dark CSS stylesheet | Minimal overhead |
