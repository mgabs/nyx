import ConfigManager from '../../../src/background/config-manager';
import DevTools from '../../../src/background/devtools';
import {formatDynamicThemeFixes, parseDynamicThemeFixes} from '../../../src/generators/dynamic-theme';
import {getSitesFixesFor} from '../../../src/generators/utils/parse';

describe('DevTools layered overrides & startup restore', () => {
    const storeMap = new Map<string, string>();
    const originalChrome = (globalThis as any).chrome;

    beforeEach(() => {
        storeMap.clear();
        (globalThis as any).chrome = {
            runtime: {lastError: null},
            storage: {
                local: {
                    get: (key: string, cb: (res: Record<string, string | undefined>) => void) => {
                        cb({[key]: storeMap.get(key)});
                    },
                    set: (items: Record<string, string>, cb: () => void) => {
                        Object.entries(items).forEach(([k, v]) => storeMap.set(k, v));
                        cb();
                    },
                    remove: (key: string, cb: () => void) => {
                        storeMap.delete(key);
                        cb();
                    },
                },
            },
        };

        ConfigManager.raw.detectorHints = 'raw-detector.com\n\nTARGET\nhtml\n\nMATCH\n.dark\n';
        ConfigManager.raw.dynamicThemeFixes = '*\n\nCSS\nbody {\n    background: #000;\n}\n\n================================\n\nexample.com\n\nCSS\nh1 {\n    color: red;\n}\n';
        ConfigManager.raw.inversionFixes = 'example.com\n\nINVERT\nimg\n';
        ConfigManager.raw.staticThemes = 'example.com\n\nCSS\nbody {\n    color: #fff;\n}\n';
        ConfigManager.overrides.detectorHints = null;
        ConfigManager.overrides.dynamicThemeFixes = null;
        ConfigManager.overrides.inversionFixes = null;
        ConfigManager.overrides.staticThemes = null;
    });

    afterEach(() => {
        (globalThis as any).chrome = originalChrome;
    });

    test('DevTools.init restores all 4 DevFixTypes including detectorHints', async () => {
        storeMap.set('dev_detector_hints', 'custom-detector.com\n\nTARGET\nhtml\n\nMATCH\n.is-dark\n');
        storeMap.set('dev_dynamic_theme_fixes', 'custom.org\n\nCSS\nh1 {\n    color: green;\n}\n');
        storeMap.set('dev_inversion_fixes', 'custom.org\n\nINVERT\n.icon\n');
        storeMap.set('dev_static_themes', 'custom.org\n\nCSS\nbody {\n    color: #eee;\n}\n');

        await DevTools.init(() => {});

        expect(ConfigManager.overrides.detectorHints).toContain('custom-detector.com');
        expect(ConfigManager.overrides.dynamicThemeFixes).toContain('custom.org');
        expect(ConfigManager.overrides.inversionFixes).toContain('custom.org');
        expect(ConfigManager.overrides.staticThemes).toContain('custom.org');
    });

    test('applyFixes stores only overrides and ConfigManager merges without stacking', async () => {
        await DevTools.init(() => {});
        const err = DevTools.applyFixes('dynamic', 'example.com\n\nCSS\nh1 {\n    color: blue;\n}\n');
        expect(err).toBeNull();

        const stored = storeMap.get('dev_dynamic_theme_fixes') ?? '';
        expect(stored).toContain('example.com');
        expect(stored).not.toContain('background: #000;');

        const matches = getSitesFixesFor(
            'https://example.com',
            ConfigManager.DYNAMIC_THEME_FIXES_RAW!,
            ConfigManager.DYNAMIC_THEME_FIXES_INDEX!,
            parseDynamicThemeFixes,
        );
        const exampleMatches = matches.filter((m) => m.url.includes('example.com'));
        expect(exampleMatches).toHaveLength(1);
        expect(exampleMatches[0].css).toContain('color: blue;');

        // Formatting defaults stays intact
        expect(formatDynamicThemeFixes(parseDynamicThemeFixes(ConfigManager.raw.dynamicThemeFixes!))).toContain('color: red;');

        const defaults = await DevTools.getDefaults();
        expect(defaults.dynamic).toContain('color: red;');
        expect(defaults.detector).toContain('raw-detector.com');

        DevTools.resetFixes('dynamic');
        expect(storeMap.has('dev_dynamic_theme_fixes')).toBe(false);
        expect(ConfigManager.overrides.dynamicThemeFixes).toBeNull();
    });

    test('DevTools.init migrates legacy monolithic blob to overrides only', async () => {
        storeMap.set('dev_dynamic_theme_fixes', [
            '*',
            '',
            'CSS',
            'body {',
            '    background: #000;',
            '}',
            '',
            '================================',
            '',
            'example.com',
            '',
            'CSS',
            'h1 {',
            '    color: red;',
            '}',
            '',
            '================================',
            '',
            'migrated.org',
            '',
            'CSS',
            'p {',
            '    color: pink;',
            '}',
        ].join('\n'));

        await DevTools.init(() => {});

        const migrated = storeMap.get('dev_dynamic_theme_fixes') ?? '';
        expect(migrated).toContain('migrated.org');
        expect(migrated).not.toContain('example.com');
        expect(migrated).not.toContain('background: #000;');
    });
});
