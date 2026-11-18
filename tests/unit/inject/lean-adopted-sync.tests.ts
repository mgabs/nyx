import type {AdoptedEmitter} from '../../../src/inject/lean-theme/adopted-emitter';
import {syncAdoptedSheets} from '../../../src/inject/lean-theme/adopted-sync';
import type {AdoptedSheetEntry} from '../../../src/inject/lean-theme/adopted-sync';

const root = {} as Document;
const sheet = (...rules: string[]) => ({cssRules: rules.map((cssText) => ({cssText}))}) as unknown as CSSStyleSheet;
const modifier = {modifySheet: jest.fn(), shouldRebuildStyle: jest.fn()};

function setup(current: CSSStyleSheet[] = []) {
    const managersByRoot = new Map<Document | ShadowRoot, Map<CSSStyleSheet, AdoptedSheetEntry>>();
    const emitter = {
        ownsSheet: jest.fn(() => false),
        getNamedSheet: jest.fn(() => undefined),
        removeDynamicSheet: jest.fn(),
    } as unknown as AdoptedEmitter;
    const getSheets = jest.fn(() => current);
    const addRules = jest.fn();
    const createModifier = jest.fn(() => modifier);
    const options = {emitter, getSheets, managersByRoot, addRules, createModifier};
    return {options, emitter, getSheets, addRules, createModifier, managersByRoot};
}

describe('Lean adopted stylesheet synchronization', () => {
    test('skips an inaccessible root without changing state', () => {
        const {options, getSheets, managersByRoot, addRules} = setup();
        getSheets.mockImplementation(() => {
            throw new Error('inaccessible');
        });
        expect(syncAdoptedSheets(root, options)).toEqual([]);
        expect(managersByRoot.size).toBe(0);
        expect(addRules).not.toHaveBeenCalled();
    });

    test('removes missing source sheets and only detaches their owned outputs', () => {
        const removed = sheet('a {}');
        const removedWithoutOutput = sheet('b {}');
        const retained = sheet('c {}');
        const output = sheet('dark {}');
        const {options, emitter, managersByRoot} = setup([retained]);
        const managers = new Map<CSSStyleSheet, AdoptedSheetEntry>([
            [removed, {root, outSheet: output, modifier, signature: 'a {}'}],
            [removedWithoutOutput, {root, outSheet: null, modifier, signature: 'b {}'}],
            [retained, {root, outSheet: null, modifier, signature: 'c {}'}],
        ]);
        managersByRoot.set(root, managers);
        expect(syncAdoptedSheets(root, options)).toEqual([]);
        expect(emitter.removeDynamicSheet).toHaveBeenCalledTimes(1);
        expect(emitter.removeDynamicSheet).toHaveBeenCalledWith(root, output);
        expect(managers.has(removed)).toBe(false);
        expect(managers.has(removedWithoutOutput)).toBe(false);
        expect(managers.has(retained)).toBe(true);
    });

    test('tracks new page sheets, ignores owned sheets and records rule signatures', () => {
        const page = sheet('a {}', 'b {}');
        const empty = sheet();
        const owned = sheet('own {}');
        const {options, emitter, addRules, createModifier, managersByRoot} = setup([owned, page, empty, page]);
        jest.mocked(emitter.ownsSheet).mockImplementation((entry) => entry === owned);
        const added = syncAdoptedSheets(root, options);
        expect(added).toHaveLength(2);
        expect(added[0]).toBe(page);
        expect(added[1]).toBe(empty);
        expect(addRules).toHaveBeenCalledTimes(1);
        expect(addRules).toHaveBeenCalledWith(page.cssRules);
        expect(createModifier).toHaveBeenCalledTimes(2);
        expect(managersByRoot.get(root)!.get(page)).toEqual({root, outSheet: null, modifier, signature: 'a {}\nb {}'});
        expect(managersByRoot.get(root)!.get(empty)!.signature).toBe('');
        expect(syncAdoptedSheets(root, options)).toEqual([]);
    });

    test('skips an inaccessible page sheet and still processes later sheets', () => {
        const inaccessible = {} as CSSStyleSheet;
        Object.defineProperty(inaccessible, 'cssRules', {get: () => {
            throw new Error('inaccessible');
        }});
        const page = sheet('a {}');
        const {options, managersByRoot, addRules} = setup([inaccessible, page]);
        const added = syncAdoptedSheets(root, options);
        expect(added).toHaveLength(1);
        expect(added[0]).toBe(page);
        expect(managersByRoot.get(root)!.has(inaccessible)).toBe(false);
        expect(addRules).toHaveBeenCalledTimes(1);
    });

    test('places page sheets before the existing override anchor', () => {
        const before = sheet('a {}');
        const anchor = sheet('override {}');
        const after = sheet('b {}');
        const current = [before, anchor, after];
        const {options, emitter} = setup(current);
        jest.mocked(emitter.ownsSheet).mockImplementation((entry) => entry === anchor);
        jest.mocked(emitter.getNamedSheet).mockReturnValue(anchor);
        syncAdoptedSheets(root, options);
        expect(current).toHaveLength(3);
        expect(current[0]).toBe(before);
        expect(current[1]).toBe(after);
        expect(current[2]).toBe(anchor);
        expect(emitter.getNamedSheet).toHaveBeenCalledWith(root, 'override');
    });

    test('places page sheets before an override anchor at the beginning', () => {
        const anchor = sheet('override {}');
        const page = sheet('a {}');
        const current = [anchor, page];
        const {options, emitter} = setup(current);
        jest.mocked(emitter.ownsSheet).mockImplementation((entry) => entry === anchor);
        jest.mocked(emitter.getNamedSheet).mockReturnValue(anchor);
        syncAdoptedSheets(root, options);
        expect(current[0]).toBe(page);
        expect(current[1]).toBe(anchor);
    });

    test('preserves page order when there is no override anchor', () => {
        const first = sheet('a {}');
        const second = sheet('b {}');
        const third = sheet('c {}');
        const current = [first, second, third];
        const {options} = setup(current);
        syncAdoptedSheets(root, options);
        expect(current[0]).toBe(first);
        expect(current[1]).toBe(second);
        expect(current[2]).toBe(third);
    });

    test('keeps order when an override anchor is not present in the root', () => {
        const page = sheet('a {}');
        const current = [page];
        const {options, emitter} = setup(current);
        jest.mocked(emitter.getNamedSheet).mockReturnValue(sheet('other {}'));
        syncAdoptedSheets(root, options);
        expect(current).toHaveLength(1);
        expect(current[0]).toBe(page);
    });
});
