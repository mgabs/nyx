import {formatDynamicThemeFixes, parseDynamicThemeFixes} from '../../../src/generators/dynamic-theme';
import {
    applyPerSiteEdit,
    buildPerSiteEntries,
    resetPerSiteOverride,
} from '../../../src/ui/devtools/components/per-site-helpers';

describe('PerSiteConfigEditor helpers', () => {
    const defaultsText = [
        'example.com',
        '',
        'CSS',
        'h1 {',
        '    color: red;',
        '}',
        '',
        '================================',
        '',
        'other.com',
        '',
        'CSS',
        'h1 {',
        '    color: green;',
        '}',
    ].join('\n');

    const overridesText = [
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
        '    color: white;',
        '}',
    ].join('\n');

    test('buildPerSiteEntries marks default, overridden, and custom sites accurately', () => {
        const entries = buildPerSiteEntries(defaultsText, overridesText, parseDynamicThemeFixes);
        expect(entries.map((e) => ({url: e.fix.url, status: e.status}))).toEqual([
            {url: ['example.com'], status: 'overridden'},
            {url: ['other.com'], status: 'default'},
            {url: ['custom.org'], status: 'custom'},
        ]);
    });

    test('applyPerSiteEdit rejects empty or multi-block input', () => {
        const overrides = parseDynamicThemeFixes(overridesText);
        expect(() => applyPerSiteEdit(overrides, 'example.com', '   \n', parseDynamicThemeFixes, formatDynamicThemeFixes)).toThrow();
        expect(() => applyPerSiteEdit(overrides, 'example.com', defaultsText, parseDynamicThemeFixes, formatDynamicThemeFixes)).toThrow();
    });

    test('resetPerSiteOverride removes only the targeted site override', () => {
        const overrides = parseDynamicThemeFixes(overridesText);
        const next = resetPerSiteOverride(overrides, 'example.com', formatDynamicThemeFixes);
        const remaining = parseDynamicThemeFixes(next);
        expect(remaining.map((f) => f.url)).toEqual([['custom.org']]);
    });
});
