import {wrapImportConditions} from '../../../src/inject/lean-theme/import-wrapping';

describe('Lean CSS import condition wrapping', () => {
    const css = '.target { color: red; }';

    test('leaves imports without conditions unchanged', () => {
        expect(wrapImportConditions(css, '  ')).toBe(css);
    });

    test('wraps nested layer, supports and media in the correct order', () => {
        expect(wrapImportConditions(css, 'layer(theme) supports(display: grid) screen')).toBe(
            `@layer theme { @supports (display: grid) { @media screen { ${css} } } }`,
        );
    });

    test('preserves anonymous layers and already grouped supports conditions', () => {
        expect(wrapImportConditions(css, 'layer supports((display: grid) and (color: red))')).toBe(
            `@layer { @supports (display: grid) and (color: red) { ${css} } }`,
        );
    });

    test.each(['not (display: grid)', 'selector(:has(*))', 'font-tech(color-COLRv1)', 'font-format(woff2)'])(
        'preserves a supports function or negation: %s', (query) => {
            expect(wrapImportConditions(css, `supports(${query})`)).toBe(`@supports ${query} { ${css} }`);
        },
    );

    test('handles quoted parentheses and semicolons in supports', () => {
        expect(wrapImportConditions(css, 'supports(content: ");") print')).toBe(
            `@supports (content: ");") { @media print { ${css} } }`,
        );
    });

    test('only treats leading layer and supports tokens as import conditions', () => {
        expect(wrapImportConditions(css, 'screen and (layer: theme)')).toBe(`@media screen and (layer: theme) { ${css} }`);
        expect(wrapImportConditions(css, 'screen and (supports(display: grid))')).toBe(`@media screen and (supports(display: grid)) { ${css} }`);
    });

    test('handles named layers without following whitespace and trims their names', () => {
        expect(wrapImportConditions(css, 'layer(theme)')).toBe(`@layer theme { ${css} }`);
        expect(wrapImportConditions(css, 'layer( theme  )')).toBe(`@layer theme { ${css} }`);
    });

    test('trims supports whitespace and wraps declarations containing function names', () => {
        expect(wrapImportConditions(css, 'supports(  (display: grid)  )')).toBe(`@supports (display: grid) { ${css} }`);
        expect(wrapImportConditions(css, 'supports(content: selector(foo))')).toBe(`@supports (content: selector(foo)) { ${css} }`);
    });

    test('rejects unfinished supports syntax', () => {
        expect(wrapImportConditions(css, 'supports((display: grid)')).toBeNull();
    });
});
