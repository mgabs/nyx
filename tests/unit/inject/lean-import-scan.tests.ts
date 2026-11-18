import {findCSSImports} from '../../../src/inject/lean-theme/import-scan';

function imports(source: string): Array<[number, string, string]> {
    return Array.from(findCSSImports(source), (match) => [match.index, match[1], match[2].trim()]);
}

describe('Lean CSS import scanning', () => {
    test('finds top-level URLs and preserves conditions and offsets', () => {
        const source = ' @import url("one.css") supports(content: ";") screen; @IMPORT \'two.css\' print;';
        expect(imports(source)).toEqual([
            [1, 'url("one.css")', 'supports(content: ";") screen'],
            [source.indexOf('@IMPORT'), "'two.css'", 'print'],
        ]);
    });

    test('ignores import-like text in strings and nested rule blocks', () => {
        const source = '.a::before { content: \'@import "fake.css";\'; } @media screen { @import "nested.css"; } @import "real.css";';
        expect(imports(source)).toEqual([[source.indexOf('@import "real'), '"real.css"', '']]);
    });

    test('handles escaped quotes and braces when scanning preceding text', () => {
        const source = '.a { content: "escaped \\\" } @import \'fake.css\';"; } @import \'real.css\';';
        expect(imports(source)).toEqual([[source.lastIndexOf('@import'), "'real.css'", '']]);
    });

    test('accepts multiple spaces and all URL forms with quoted parentheses', () => {
        const source = `@import   url("double)name.css"   ) screen; @import url('single)name.css' ) print; @import url(unquoted.css ) all;`;
        expect(imports(source)).toEqual([
            [0, 'url("double)name.css"   )', 'screen'],
            [source.indexOf('@import', 1), "url('single)name.css' )", 'print'],
            [source.lastIndexOf('@import'), 'url(unquoted.css )', 'all'],
        ]);
    });

    test('keeps semicolons inside either quote style in import conditions', () => {
        const source = `@import "a.css" supports(content: 'single;quoted') screen; @import 'b.css' supports(content: "double;quoted") print;`;
        expect(imports(source)).toEqual([
            [0, '"a.css"', "supports(content: 'single;quoted') screen"],
            [source.lastIndexOf('@import'), "'b.css'", 'supports(content: "double;quoted") print'],
        ]);
    });

    test('ignores import text in a top-level quoted string', () => {
        const source = `'@import "fake.css";' @import "real.css";`;
        expect(imports(source)).toEqual([[source.lastIndexOf('@import'), '"real.css"', '']]);
    });

    test('ignores imports at every depth in nested blocks', () => {
        const source = `{ { @import "inner.css"; } @import "outer.css"; } @import "real.css";`;
        expect(imports(source)).toEqual([[source.lastIndexOf('@import'), '"real.css"', '']]);
    });

    test('returns no import for malformed or unfinished input', () => {
        expect(imports('@import "unfinished.css" screen')).toEqual([]);
        expect(imports('.a { content: "unfinished @import \'fake.css\';')).toEqual([]);
    });

    test('handles a closing brace before a top-level import', () => {
        expect(imports('} @import "real.css";')).toEqual([[2, '"real.css"', '']]);
    });
});
