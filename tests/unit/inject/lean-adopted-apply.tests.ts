let mockIsFirefox = false;
jest.mock('../../../src/utils/platform', () => ({get isFirefox() {
    return mockIsFirefox;
}}));

import {applyAdoptedOrder} from '../../../src/inject/lean-theme/adopted-apply';

describe('Lean adopted stylesheet platform updates', () => {
    test('updates the page array in place on Firefox', () => {
        mockIsFirefox = true;
        const first = {} as CSSStyleSheet;
        const second = {} as CSSStyleSheet;
        const pageSheets = [first, second];
        const root = {adoptedStyleSheets: pageSheets} as Document;
        const ordered = [second, first];
        applyAdoptedOrder(root, pageSheets, ordered);
        expect(root.adoptedStyleSheets).toBe(pageSheets);
        expect(pageSheets[0]).toBe(second);
        expect(pageSheets[1]).toBe(first);
    });

    test('assigns the new sheet list on Chromium', () => {
        mockIsFirefox = false;
        const first = {} as CSSStyleSheet;
        const second = {} as CSSStyleSheet;
        const pageSheets = [first, second];
        const root = {adoptedStyleSheets: pageSheets} as Document;
        const ordered = [second, first];
        applyAdoptedOrder(root, pageSheets, ordered);
        expect(root.adoptedStyleSheets).toBe(ordered);
        expect(pageSheets[0]).toBe(first);
        expect(pageSheets[1]).toBe(second);
    });
});
