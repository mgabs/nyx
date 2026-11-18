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

    test('createAdoptedEmitter tracks owned sheets and places dynamic sheets before override and inline', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const {createAdoptedEmitter} = require('../../../src/inject/lean-theme/adopted-emitter');
        const origCSSStyleSheet = (globalThis as unknown as {CSSStyleSheet?: unknown}).CSSStyleSheet;
        class MockCSSStyleSheet {
            cssRules: unknown[] = [];
            replaceSync() {}
        }
        (globalThis as unknown as {CSSStyleSheet: unknown}).CSSStyleSheet = MockCSSStyleSheet;
        try {
            const fakeDoc = {adoptedStyleSheets: [] as unknown[]} as unknown as Document;
            const emitter = createAdoptedEmitter();
            const overrideSheet = emitter.setNamedSheet(fakeDoc, 'override', '.a{}', 'ending');
            const inlineSheet = emitter.setNamedSheet(fakeDoc, 'inline', '.b{}', 'ending');
            const dynSheet = emitter.createDynamicSheet(fakeDoc);
            const externalSheet = new MockCSSStyleSheet() as unknown as CSSStyleSheet;

            expect(emitter.ownsSheet(overrideSheet)).toBe(true);
            expect(emitter.ownsSheet(inlineSheet)).toBe(true);
            expect(emitter.ownsSheet(dynSheet)).toBe(true);
            expect(emitter.ownsSheet(externalSheet)).toBe(false);

            const sheets = (fakeDoc as unknown as {adoptedStyleSheets: unknown[]}).adoptedStyleSheets;
            expect(sheets.indexOf(dynSheet)).toBeLessThan(sheets.indexOf(overrideSheet));
            expect(sheets.indexOf(overrideSheet)).toBeLessThan(sheets.indexOf(inlineSheet));
        } finally {
            (globalThis as unknown as {CSSStyleSheet: unknown}).CSSStyleSheet = origCSSStyleSheet;
        }
    });

    test('exports only owned document sheets in the active cascade order', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const {createAdoptedEmitter} = require('../../../src/inject/lean-theme/adopted-emitter');
        const originalSheet = (globalThis as unknown as {CSSStyleSheet?: unknown}).CSSStyleSheet;
        const originalDocument = globalThis.document;
        class MockCSSStyleSheet {
            cssRules: Array<{cssText: string}> = [];
            replaceSync(css: string) {
                this.cssRules = css ? [{cssText: css}] : [];
            }
        }
        (globalThis as unknown as {CSSStyleSheet: unknown}).CSSStyleSheet = MockCSSStyleSheet;
        const fakeDocument = {adoptedStyleSheets: [] as CSSStyleSheet[]} as unknown as Document;
        const fakeShadow = {adoptedStyleSheets: [] as CSSStyleSheet[]} as unknown as ShadowRoot;
        (globalThis as unknown as {document: Document}).document = fakeDocument;
        try {
            const emitter = createAdoptedEmitter();
            const pageSheet = new MockCSSStyleSheet();
            pageSheet.replaceSync('.page {}');
            fakeDocument.adoptedStyleSheets.push(pageSheet as unknown as CSSStyleSheet);
            emitter.setNamedSheet(fakeDocument, 'override', '.rule { color: red; }', 'ending');
            const dynamic = emitter.createDynamicSheet(fakeDocument);
            (dynamic as unknown as MockCSSStyleSheet).cssRules = [
                {cssText: '.first { color: green; }'},
                {cssText: '.rule { color: blue; }'},
            ];
            emitter.setNamedSheet(fakeDocument, 'text', '', 'beginning');
            emitter.setNamedSheet(fakeShadow, 'override', '.shadow-only {}', 'ending');

            const css = emitter.serializeLeanCSS();
            expect(css).toBe('.first { color: green; }\n.rule { color: blue; }\n.rule { color: red; }');
            expect(css).not.toContain('.page');
            expect(css).not.toContain('.shadow-only');
            emitter.destroy();
            expect(fakeDocument.adoptedStyleSheets).toEqual([pageSheet]);
        } finally {
            (globalThis as unknown as {CSSStyleSheet: unknown}).CSSStyleSheet = originalSheet;
            (globalThis as unknown as {document: Document}).document = originalDocument;
        }
    });

    test('updates named sheets without duplicating them and removes only owned sheets', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const {createAdoptedEmitter} = require('../../../src/inject/lean-theme/adopted-emitter');
        const originalSheet = (globalThis as unknown as {CSSStyleSheet?: unknown}).CSSStyleSheet;
        class MockCSSStyleSheet {
            cssRules: Array<{cssText: string}> = [];
            replaceSync(css: string) {
                this.cssRules = css ? [{cssText: css}] : [];
            }
        }
        (globalThis as unknown as {CSSStyleSheet: unknown}).CSSStyleSheet = MockCSSStyleSheet;
        const pageSheet = new MockCSSStyleSheet() as unknown as CSSStyleSheet;
        const doc = {adoptedStyleSheets: [pageSheet]} as unknown as Document;
        const shadow = {adoptedStyleSheets: [pageSheet]} as unknown as ShadowRoot;
        try {
            const emitter = createAdoptedEmitter();
            expect(emitter.getNamedSheet(doc, 'override')).toBeNull();
            const inline = emitter.setNamedSheet(doc, 'inline', '.inline{}', 'ending');
            const override = emitter.setNamedSheet(doc, 'override', '.before{}', 'ending');
            expect(doc.adoptedStyleSheets).toEqual([pageSheet, override, inline]);
            expect(emitter.setNamedSheet(doc, 'override', '.after{}', 'ending')).toBe(override);
            expect(emitter.getNamedSheet(doc, 'override')).toBe(override);
            expect((override as unknown as MockCSSStyleSheet).cssRules[0].cssText).toBe('.after{}');
            expect(doc.adoptedStyleSheets).toEqual([pageSheet, override, inline]);

            const dynamic = emitter.createDynamicSheet(doc);
            const shadowSheet = emitter.setNamedSheet(shadow, 'inline', '.shadow{}', 'ending');
            expect(doc.adoptedStyleSheets).toEqual([pageSheet, dynamic, override, inline]);
            expect(shadow.adoptedStyleSheets).toEqual([pageSheet, shadowSheet]);
            shadow.adoptedStyleSheets.push(dynamic);
            emitter.removeDynamicSheet(shadow, dynamic);
            expect(shadow.adoptedStyleSheets.includes(dynamic)).toBe(true);
            shadow.adoptedStyleSheets.pop();
            emitter.removeDynamicSheet(doc, dynamic);
            emitter.removeDynamicSheet(doc, dynamic);
            emitter.removeDynamicSheet(shadow, dynamic);
            expect(doc.adoptedStyleSheets).toEqual([pageSheet, override, inline]);
            emitter.destroy();
            expect(doc.adoptedStyleSheets).toEqual([pageSheet]);
            expect(shadow.adoptedStyleSheets).toEqual([pageSheet]);
            expect(emitter.getNamedSheet(doc, 'override')).toBeNull();
        } finally {
            (globalThis as unknown as {CSSStyleSheet: unknown}).CSSStyleSheet = originalSheet;
        }
    });

    test('handles duplicate and missing anchors without changing page-owned sheets', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const {attachAdoptedSheet, createAdoptedEmitter, detachAdoptedSheets} = require('../../../src/inject/lean-theme/adopted-emitter');
        const originalSheet = (globalThis as unknown as {CSSStyleSheet?: unknown}).CSSStyleSheet;
        class MockCSSStyleSheet {
            cssRules: Array<{cssText: string}> = [];
            replaceSync(css: string) {
                this.cssRules = css ? [{cssText: css}] : [];
            }
        }
        (globalThis as unknown as {CSSStyleSheet: unknown}).CSSStyleSheet = MockCSSStyleSheet;
        const a = new MockCSSStyleSheet() as unknown as CSSStyleSheet;
        const b = new MockCSSStyleSheet() as unknown as CSSStyleSheet;
        const missing = new MockCSSStyleSheet() as unknown as CSSStyleSheet;
        const doc = {adoptedStyleSheets: [a]} as unknown as Document;
        try {
            attachAdoptedSheet(doc, a, 'ending');
            attachAdoptedSheet(doc, b, 'beginning', [missing]);
            expect(doc.adoptedStyleSheets).toEqual([b, a]);
            expect(doc.adoptedStyleSheets[0]).toBe(b);
            expect(doc.adoptedStyleSheets[1]).toBe(a);
            detachAdoptedSheets(doc, new Set([missing]));
            expect(doc.adoptedStyleSheets).toEqual([b, a]);

            const emitter = createAdoptedEmitter();
            const first = emitter.createDynamicSheet(doc);
            const second = emitter.createDynamicSheet(doc);
            expect(doc.adoptedStyleSheets).toEqual([b, a, first, second]);
            expect(doc.adoptedStyleSheets[2]).toBe(first);
            expect(doc.adoptedStyleSheets[3]).toBe(second);
            const empty = emitter.setNamedSheet(doc, 'text', '');
            expect(doc.adoptedStyleSheets).toEqual([b, a, first, second, empty]);
            emitter.destroy();
            expect(doc.adoptedStyleSheets).toEqual([b, a]);
        } finally {
            (globalThis as unknown as {CSSStyleSheet: unknown}).CSSStyleSheet = originalSheet;
        }
    });

    test('inserts before the earliest anchor and avoids writes when nothing changes', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const {attachAdoptedSheet, detachAdoptedSheets} = require('../../../src/inject/lean-theme/adopted-emitter');
        const a = {} as CSSStyleSheet;
        const b = {} as CSSStyleSheet;
        const c = {} as CSSStyleSheet;
        const added = {} as CSSStyleSheet;
        let sheets = [a, b, c];
        let writes = 0;
        const root = {
            get adoptedStyleSheets() {
                return sheets;
            },
            set adoptedStyleSheets(value: CSSStyleSheet[]) {
                writes++;
                sheets = value;
            },
        } as unknown as Document;
        attachAdoptedSheet(root, added, 'ending', [c, b]);
        expect(sheets).toEqual([a, added, b, c]);
        expect(sheets[0]).toBe(a);
        expect(sheets[1]).toBe(added);
        expect(sheets[2]).toBe(b);
        expect(sheets[3]).toBe(c);
        const otherRoot = {adoptedStyleSheets: [a, b, c]} as unknown as Document;
        attachAdoptedSheet(otherRoot, added, 'ending', [c, a]);
        expect(otherRoot.adoptedStyleSheets).toEqual([added, a, b, c]);
        expect(otherRoot.adoptedStyleSheets[0]).toBe(added);
        expect(otherRoot.adoptedStyleSheets[1]).toBe(a);
        const missingAnchor = {} as CSSStyleSheet;
        const thirdRoot = {adoptedStyleSheets: [a, b, c]} as unknown as Document;
        attachAdoptedSheet(thirdRoot, added, 'ending', [c, missingAnchor]);
        expect(thirdRoot.adoptedStyleSheets[2]).toBe(added);
        expect(thirdRoot.adoptedStyleSheets[3]).toBe(c);
        attachAdoptedSheet(root, added);
        detachAdoptedSheets(root, new Set([{} as CSSStyleSheet]));
        expect(writes).toBe(1);
        const previousArray = sheets;
        detachAdoptedSheets(root, new Set([added]));
        expect(writes).toBe(2);
        expect(sheets).not.toBe(previousArray);
        expect(sheets[0]).toBe(a);
        expect(sheets[1]).toBe(b);
        expect(sheets[2]).toBe(c);
        const inaccessible = {get adoptedStyleSheets(): CSSStyleSheet[] {
            throw new Error('unexpected access');
        }} as unknown as Document;
        expect(() => detachAdoptedSheets(inaccessible, new Set())).not.toThrow();
    });

    test('appends non-override named sheets after an existing inline sheet', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const {createAdoptedEmitter} = require('../../../src/inject/lean-theme/adopted-emitter');
        const originalSheet = (globalThis as unknown as {CSSStyleSheet?: unknown}).CSSStyleSheet;
        class MockCSSStyleSheet {
            replaceSync() {}
        }
        (globalThis as unknown as {CSSStyleSheet: unknown}).CSSStyleSheet = MockCSSStyleSheet;
        const root = {adoptedStyleSheets: []} as unknown as Document;
        try {
            const emitter = createAdoptedEmitter();
            const inline = emitter.setNamedSheet(root, 'inline', '', 'ending');
            const other = emitter.setNamedSheet(root, 'other', '', 'ending');
            expect(root.adoptedStyleSheets[0]).toBe(inline);
            expect(root.adoptedStyleSheets[1]).toBe(other);
            emitter.destroy();
        } finally {
            (globalThis as unknown as {CSSStyleSheet: unknown}).CSSStyleSheet = originalSheet;
        }
    });

    test('destroys dynamic-only roots without disturbing page sheets', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const {createAdoptedEmitter} = require('../../../src/inject/lean-theme/adopted-emitter');
        const originalSheet = (globalThis as unknown as {CSSStyleSheet?: unknown}).CSSStyleSheet;
        class MockCSSStyleSheet {}
        (globalThis as unknown as {CSSStyleSheet: unknown}).CSSStyleSheet = MockCSSStyleSheet;
        const page = new MockCSSStyleSheet() as unknown as CSSStyleSheet;
        const root = {adoptedStyleSheets: [page]} as unknown as Document;
        try {
            const emitter = createAdoptedEmitter();
            const dynamic = emitter.createDynamicSheet(root);
            expect(root.adoptedStyleSheets[1]).toBe(dynamic);
            emitter.destroy();
            expect(root.adoptedStyleSheets.length).toBe(1);
            expect(root.adoptedStyleSheets[0]).toBe(page);
        } finally {
            (globalThis as unknown as {CSSStyleSheet: unknown}).CSSStyleSheet = originalSheet;
        }
    });
    test('uses Firefox page objects when attaching and detaching sheets', () => {
        const previousWindow = (globalThis as unknown as {window?: unknown}).window;
        class PageSheet {}
        const sheets: unknown[] = [];
        const wrapped = Object.assign([], {wrappedJSObject: sheets});
        const root = {adoptedStyleSheets: wrapped} as unknown as Document;
        const first = new PageSheet() as unknown as CSSStyleSheet;
        const second = new PageSheet() as unknown as CSSStyleSheet;
        (globalThis as unknown as {window: unknown}).window = {wrappedJSObject: {CSSStyleSheet: PageSheet}};
        try {
            jest.isolateModules(() => {
                jest.doMock('../../../src/utils/platform', () => ({isFirefox: true}));
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const {attachAdoptedSheet, createConstructableSheet, detachAdoptedSheets, getAdoptedSheets} = require('../../../src/inject/lean-theme/adopted-emitter');
                expect(createConstructableSheet()).toBeInstanceOf(PageSheet);
                expect(getAdoptedSheets(root)).toBe(sheets);
                attachAdoptedSheet(root, first, 'ending');
                attachAdoptedSheet(root, first, 'ending');
                attachAdoptedSheet(root, second, 'ending', [first]);
                expect(sheets).toEqual([second, first]);
                detachAdoptedSheets(root, new Set([first]));
                expect(sheets).toEqual([second]);
                detachAdoptedSheets(root, new Set());
                expect(sheets).toEqual([second]);
                const plainRoot = {adoptedStyleSheets: []} as unknown as Document;
                (globalThis as unknown as {window: unknown}).window = {CSSStyleSheet: PageSheet};
                expect(createConstructableSheet()).toBeInstanceOf(PageSheet);
                attachAdoptedSheet(plainRoot, first, 'beginning');
                expect(getAdoptedSheets(plainRoot)).toEqual([first]);
            });
        } finally {
            jest.dontMock('../../../src/utils/platform');
            (globalThis as unknown as {window?: unknown}).window = previousWindow;
        }
    });
});
