import {formatDynamicThemeFixes, parseDynamicThemeFixes} from '../../../../src/generators/dynamic-theme';
import {diffSiteFixes, mergeSiteFixes, normalizeURLKey} from '../../../../src/generators/utils/overrides';

describe('DevTools overrides helpers', () => {
    const raw = [
        '*',
        '',
        'CSS',
        'body {',
        '    background: #111;',
        '}',
        '',
        '================================',
        '',
        'example.com',
        'www.example.com',
        '',
        'CSS',
        'h1 {',
        '    color: red;',
        '}',
    ].join('\n');

    test('normalizeURLKey sorts and trims URL lists deterministically', () => {
        expect(normalizeURLKey([' www.example.com ', 'example.com'])).toBe('example.com\nwww.example.com');
        expect(normalizeURLKey(['example.com', 'www.example.com'])).toBe('example.com\nwww.example.com');
    });

    test('mergeSiteFixes returns formatted raw when overrideText is empty', () => {
        const merged = mergeSiteFixes(raw, '', parseDynamicThemeFixes, formatDynamicThemeFixes);
        const parsed = parseDynamicThemeFixes(merged);
        expect(parsed).toHaveLength(2);
        expect(parsed[1].css).toContain('color: red;');
    });

    test('mergeSiteFixes replaces matching raw block without stacking and appends custom blocks', () => {
        const override = [
            'www.example.com',
            'example.com',
            '',
            'CSS',
            'h1 {',
            '    color: blue;',
            '}',
            '',
            '================================',
            '',
            'custom.org',
            '',
            'CSS',
            'p {',
            '    color: green;',
            '}',
        ].join('\n');

        const merged = mergeSiteFixes(raw, override, parseDynamicThemeFixes, formatDynamicThemeFixes);
        const parsed = parseDynamicThemeFixes(merged);

        expect(parsed.map((f) => normalizeURLKey(f.url))).toEqual([
            '*',
            'custom.org',
            'example.com\nwww.example.com',
        ]);
        const exampleFixes = parsed.filter((f) => f.url.includes('example.com'));
        expect(exampleFixes).toHaveLength(1);
        expect(exampleFixes[0].css).toContain('color: blue;');
    });

    test('diffSiteFixes extracts only added and modified blocks from legacy monolithic blob', () => {
        const legacyFull = [
            '*',
            '',
            'CSS',
            'body {',
            '    background: #111;',
            '}',
            '',
            '================================',
            '',
            'example.com',
            'www.example.com',
            '',
            'CSS',
            'h1 {',
            '    color: yellow;',
            '}',
            '',
            '================================',
            '',
            'added.net',
            '',
            'CSS',
            'a {',
            '    color: cyan;',
            '}',
        ].join('\n');

        const diff = diffSiteFixes(raw, legacyFull, parseDynamicThemeFixes, formatDynamicThemeFixes);
        const parsedDiff = parseDynamicThemeFixes(diff);
        expect(parsedDiff).toHaveLength(2);
        expect(parsedDiff.map((f) => f.url)).toEqual([
            ['added.net'],
            ['example.com', 'www.example.com'],
        ]);

        const unchanged = diffSiteFixes(raw, raw, parseDynamicThemeFixes, formatDynamicThemeFixes);
        expect(unchanged).toBe('');

        expect(mergeSiteFixes('', '', parseDynamicThemeFixes, formatDynamicThemeFixes)).toBe('');
        expect(diffSiteFixes('', '', parseDynamicThemeFixes, formatDynamicThemeFixes)).toBe('');
        expect(diffSiteFixes('', 'custom.org\n\nCSS\na {\n    color: red;\n}', parseDynamicThemeFixes, formatDynamicThemeFixes)).toContain('custom.org');
    });
});
