import type {AdoptedEmitter} from '../../../src/inject/lean-theme/adopted-emitter';
import type {AdoptedSheetEntry} from '../../../src/inject/lean-theme/adopted-sync';
import {reorderAdoptedOutputs} from '../../../src/inject/lean-theme/adopted-reorder';

jest.mock('../../../src/utils/platform', () => ({isFirefox: false}));

const root = {adoptedStyleSheets: [] as CSSStyleSheet[]} as unknown as Document;
const modifier = {modifySheet: jest.fn(), shouldRebuildStyle: jest.fn()};

function setup() {
    const source = {} as CSSStyleSheet;
    const output = {} as CSSStyleSheet;
    const anchor = {} as CSSStyleSheet;
    const managers = new Map<CSSStyleSheet, AdoptedSheetEntry>([[source, {root, outSheet: output, modifier, signature: ''}]]);
    const managersByRoot = new Map<Document | ShadowRoot, Map<CSSStyleSheet, AdoptedSheetEntry>>([[root, managers]]);
    const emitter = {getNamedSheet: jest.fn(() => anchor)} as unknown as AdoptedEmitter;
    const pageSheets = [output, source, anchor];
    const getSheets = jest.fn(() => pageSheets);
    return {source, output, anchor, managersByRoot, emitter, pageSheets, getSheets};
}

describe('Lean adopted output reordering', () => {
    test('does nothing when the root is untracked or the emitter is absent', () => {
        const {managersByRoot, emitter, getSheets} = setup();
        reorderAdoptedOutputs(root, {managersByRoot: new Map(), emitter, getSheets});
        reorderAdoptedOutputs(root, {managersByRoot, emitter: null, getSheets});
        expect(getSheets).not.toHaveBeenCalled();
        expect(emitter.getNamedSheet).not.toHaveBeenCalled();
    });

    test('orders outputs before the named override and assigns the changed list', () => {
        const {source, output, anchor, managersByRoot, emitter, getSheets, pageSheets} = setup();
        root.adoptedStyleSheets = pageSheets;
        reorderAdoptedOutputs(root, {managersByRoot, emitter, getSheets});
        expect(getSheets).toHaveBeenCalledWith(root);
        expect(emitter.getNamedSheet).toHaveBeenCalledWith(root, 'override');
        expect(root.adoptedStyleSheets[0]).toBe(source);
        expect(root.adoptedStyleSheets[1]).toBe(output);
        expect(root.adoptedStyleSheets[2]).toBe(anchor);
        expect(root.adoptedStyleSheets).not.toBe(pageSheets);
    });

    test('does not assign a replacement list when order is already correct', () => {
        const {source, output, anchor, managersByRoot, emitter, getSheets} = setup();
        const alreadyOrdered = [source, output, anchor];
        getSheets.mockReturnValue(alreadyOrdered);
        root.adoptedStyleSheets = alreadyOrdered;
        reorderAdoptedOutputs(root, {managersByRoot, emitter, getSheets});
        expect(root.adoptedStyleSheets).toBe(alreadyOrdered);
    });
});
