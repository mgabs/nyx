jest.mock('../../../src/utils/platform', () => ({isFirefox: true}));

import {attachAdoptedSheet, createConstructableSheet, detachAdoptedSheets, getAdoptedSheets} from '../../../src/inject/lean-theme/adopted-emitter';

describe('Lean emitter Firefox page objects', () => {
    const originalWindow = (globalThis as unknown as {window?: unknown}).window;
    class PageSheet {}

    beforeEach(() => {
        (globalThis as unknown as {window: unknown}).window = {wrappedJSObject: {CSSStyleSheet: PageSheet}};
    });

    afterEach(() => {
        (globalThis as unknown as {window?: unknown}).window = originalWindow;
    });

    test('constructs in the page realm and mutates the unwrapped adopted sheet list', () => {
        const native: CSSStyleSheet[] = [];
        const wrapper = Object.assign([], {wrappedJSObject: native});
        const root = {adoptedStyleSheets: wrapper} as unknown as Document;
        const first = new PageSheet() as unknown as CSSStyleSheet;
        const second = new PageSheet() as unknown as CSSStyleSheet;
        const third = new PageSheet() as unknown as CSSStyleSheet;
        expect(createConstructableSheet()).toBeInstanceOf(PageSheet);
        expect(getAdoptedSheets(root)).toBe(native);
        attachAdoptedSheet(root, first, 'ending');
        attachAdoptedSheet(root, second, 'beginning');
        attachAdoptedSheet(root, third, 'ending', [first, second]);
        expect(native).toEqual([third, second, first]);
        expect(native[0]).toBe(third);
        expect(native[1]).toBe(second);
        expect(native[2]).toBe(first);
        detachAdoptedSheets(root, new Set([third, first]));
        expect(native).toEqual([second]);
        expect(native[0]).toBe(second);
    });

    test('falls back to ordinary Firefox objects when wrappers are absent', () => {
        (globalThis as unknown as {window: unknown}).window = {CSSStyleSheet: PageSheet};
        const root = {adoptedStyleSheets: []} as unknown as Document;
        const sheet = new PageSheet() as unknown as CSSStyleSheet;
        expect(createConstructableSheet()).toBeInstanceOf(PageSheet);
        attachAdoptedSheet(root, sheet, 'beginning');
        expect(getAdoptedSheets(root)).toEqual([sheet]);
        detachAdoptedSheets(root, new Set([sheet]));
        expect(root.adoptedStyleSheets).toEqual([]);
    });

    test('respects beginning and ending positions with multiple existing sheets', () => {
        const a = new PageSheet() as unknown as CSSStyleSheet;
        const b = new PageSheet() as unknown as CSSStyleSheet;
        const first = new PageSheet() as unknown as CSSStyleSheet;
        const last = new PageSheet() as unknown as CSSStyleSheet;
        const middle = new PageSheet() as unknown as CSSStyleSheet;
        const native = [a, b];
        const root = {adoptedStyleSheets: Object.assign([], {wrappedJSObject: native})} as unknown as Document;
        attachAdoptedSheet(root, first, 'beginning');
        attachAdoptedSheet(root, last, 'ending');
        expect(native[0]).toBe(first);
        expect(native[1]).toBe(a);
        expect(native[2]).toBe(b);
        expect(native[3]).toBe(last);
        attachAdoptedSheet(root, middle, 'ending', [a]);
        expect(native[0]).toBe(first);
        expect(native[1]).toBe(middle);
        expect(native[2]).toBe(a);
    });
});
