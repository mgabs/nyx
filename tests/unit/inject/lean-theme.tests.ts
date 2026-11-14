import fs from 'node:fs';
import path from 'node:path';

(globalThis as unknown as {location: {hostname: string; origin: string}}).location = {
    hostname: 'example.com',
    origin: 'https://example.com',
};
(globalThis as unknown as {document: {createElement: () => {href: string}}}).document = {
    createElement: () => ({href: ''}),
};

jest.mock('@plus/utils/theme', () => ({
    extendThemeCacheKeys: jest.fn(),
    modifyColorWithScheme: jest.fn(),
}));

import {DEFAULT_SETTINGS, DEFAULT_THEME} from '../../../src/defaults';
import {ThemeEngine} from '../../../src/generators/theme-engines';
import {collectCSS} from '../../../src/inject/dynamic-theme/css-collection';
import type * as ModifyCSSType from '../../../src/inject/dynamic-theme/modify-css';
import type * as StylesheetModifierType from '../../../src/inject/dynamic-theme/stylesheet-modifier';
import type * as VariablesType from '../../../src/inject/dynamic-theme/variables';
import {MessageTypeBGtoCS} from '../../../src/utils/message';
import {validateSettings} from '../../../src/utils/validation';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const modifyCSS = require('../../../src/inject/dynamic-theme/modify-css') as typeof ModifyCSSType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {createSharedRuleCache, createStyleSheetModifier} = require('../../../src/inject/dynamic-theme/stylesheet-modifier') as typeof StylesheetModifierType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {VariablesStore} = require('../../../src/inject/dynamic-theme/variables') as typeof VariablesType;

describe('lean-dynamic-theme unit tests', () => {
    test('registers ThemeEngine.leanDynamicTheme and validates settings', () => {
        expect(ThemeEngine.leanDynamicTheme).toBe('leanDynamicTheme');
        expect(MessageTypeBGtoCS.ADD_LEAN_THEME).toBe('bg-cs-add-lean-theme');
        expect(DEFAULT_THEME.engine).toBe(ThemeEngine.dynamicTheme);

        const validated = validateSettings({
            ...DEFAULT_SETTINGS,
            theme: {
                ...DEFAULT_THEME,
                engine: ThemeEngine.leanDynamicTheme,
            },
        });
        expect(validated.settings.theme?.engine).toBe(ThemeEngine.leanDynamicTheme);
        expect(validated.errors).toEqual([]);
    });

    test('src/inject/lean-theme/ has zero imports of image.ts or dynamic-theme/inline-style', () => {
        const leanDir = path.resolve(process.cwd(), 'src/inject/lean-theme');
        const files = fs.readdirSync(leanDir).filter((f) => f.endsWith('.ts'));
        expect(files.length).toBeGreaterThanOrEqual(4);
        for (const file of files) {
            const content = fs.readFileSync(path.join(leanDir, file), 'utf8');
            expect(content).not.toMatch(/['"].*\/image['"]/);
            expect(content).not.toMatch(/dynamic-theme\/inline-style/);
        }
    });

    test('getModifiableCSSDeclaration skips image analysis when imageURLModifier is null', () => {
        const store = new VariablesStore({imageURLModifier: null});
        const fakeRule = {
            selectorText: '.hero',
            style: {
                getPropertyPriority: () => '',
            },
            parentStyleSheet: {
                href: 'https://example.com/styles/main.css',
                ownerNode: null,
            },
            parentRule: null,
        } as unknown as CSSStyleRule;

        const decl = modifyCSS.getModifiableCSSDeclaration(
            'background-image',
            'url("bg.png")',
            fakeRule,
            store,
            [],
            () => false,
            null,
        );
        expect(decl).not.toBeNull();
        expect(typeof decl!.value).toBe('function');
        const result = (decl!.value as ModifyCSSType.CSSValueModifier)(DEFAULT_THEME);
        expect(result).toBe('url("https://example.com/styles/bg.png")');
    });

    test('createStyleSheetModifier shares bounded rule cache across SPA instances', () => {
        const sharedCache = createSharedRuleCache(2);
        const store = new VariablesStore({imageURLModifier: null});

        const makeRule = (selectorText: string, cssText: string, color: string) => ({
            type: 1,
            selectorText,
            cssText,
            parentRule: null,
            parentStyleSheet: null,
            style: {
                length: 1,
                0: 'color',
                cssText: `color: ${color};`,
                all: '',
                getPropertyValue: (p: string) => (p === 'color' ? color : ''),
                getPropertyPriority: () => '',
            },
        }) as unknown as CSSStyleRule;

        const makeSheet = () => {
            const rules: Array<{cssText: string}> = [];
            return {
                cssRules: rules,
                insertRule(rule: string, index = rules.length) {
                    rules.splice(index, 0, {cssText: rule});
                    return index;
                },
                deleteRule(index: number) {
                    rules.splice(index, 1);
                },
            };
        };

        const spy = jest.spyOn(modifyCSS, 'getModifiableCSSDeclaration');

        const ruleA = makeRule('.a', '.a { color: black; }', 'black');
        const modifier1 = createStyleSheetModifier({sharedCache, variablesStore: store, imageURLModifier: null});
        const out1 = makeSheet();
        modifier1.modifySheet({
            sourceCSSRules: [ruleA],
            theme: DEFAULT_THEME,
            ignoreImageAnalysis: [],
            force: false,
            prepareSheet: () => out1,
            isAsyncCancelled: () => false,
        });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(out1.cssRules.length).toBe(1);

        // Second modifier (simulating SPA route swap) reuses ruleA from sharedCache without calling getModifiableCSSDeclaration
        const modifier2 = createStyleSheetModifier({sharedCache, variablesStore: store, imageURLModifier: null});
        const out2 = makeSheet();
        modifier2.modifySheet({
            sourceCSSRules: [ruleA],
            theme: DEFAULT_THEME,
            ignoreImageAnalysis: [],
            force: false,
            prepareSheet: () => out2,
            isAsyncCancelled: () => false,
        });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(out2.cssRules).toEqual(out1.cssRules);

        // Exceed maxEntries=2 to verify bounded LRU eviction
        const ruleB = makeRule('.b', '.b { color: red; }', 'red');
        const ruleC = makeRule('.c', '.c { color: blue; }', 'blue');
        modifier2.modifySheet({
            sourceCSSRules: [ruleB, ruleC],
            theme: DEFAULT_THEME,
            ignoreImageAnalysis: [],
            force: false,
            prepareSheet: () => makeSheet(),
            isAsyncCancelled: () => false,
        });
        expect(sharedCache.rulesModCache.size).toBe(2);

        spy.mockRestore();
    });

    test('collectCSS returns formatted lean CSS when leanCSS is provided', async () => {
        const result = await collectCSS('body { background-color: rgb(24, 26, 27); }');
        expect(result).toContain('Lean Dynamic Theme CSS');
        expect(result).toContain('background-color: rgb(24, 26, 27)');
    });
});
