import type {Theme} from '../../../src/definitions';
import type {AdoptedEmitter} from '../../../src/inject/lean-theme/adopted-emitter';
import type {AdoptedSheetEntry} from '../../../src/inject/lean-theme/adopted-sync';
import {renderAdoptedOutput} from '../../../src/inject/lean-theme/adopted-render';

const root = {} as Document;
const theme = {} as Theme;
const sheet = (...rules: string[]) => ({cssRules: rules.map((cssText) => ({cssText}))}) as unknown as CSSStyleSheet;

function setup(source = sheet('a {}')) {
    const output = {replaceSync: jest.fn()} as unknown as CSSStyleSheet;
    const emitter = {createDynamicSheet: jest.fn(() => output)} as unknown as AdoptedEmitter;
    const modifier = {modifySheet: jest.fn(), shouldRebuildStyle: jest.fn()};
    const entry: AdoptedSheetEntry = {root, outSheet: null, modifier, signature: ''};
    const managersByRoot = new Map([[root, new Map([[source, entry]])]]);
    const getEmitter = jest.fn(() => emitter);
    const isActive = jest.fn(() => true);
    const options = {theme, managersByRoot, getEmitter, ignoredImageSelectors: ['.image'], isActive};
    return {source, output, emitter, modifier, entry, managersByRoot, getEmitter, isActive, options};
}

describe('Lean adopted stylesheet rendering', () => {
    test('prepares and reuses a root-owned output sheet with current theme and rules', () => {
        const {source, output, emitter, modifier, entry, isActive, options} = setup();
        renderAdoptedOutput(root, source, options);
        expect(modifier.modifySheet).toHaveBeenCalledTimes(1);
        const args = modifier.modifySheet.mock.calls[0][0];
        expect(args.sourceCSSRules).toBe(source.cssRules);
        expect(args.theme).toBe(theme);
        expect(args.ignoreImageAnalysis).toEqual(['.image']);
        expect(args.force).toBe(true);
        expect(args.isAsyncCancelled()).toBe(false);
        expect(args.prepareSheet()).toBe(output);
        expect(emitter.createDynamicSheet).toHaveBeenCalledWith(root);
        expect(entry.outSheet).toBe(output);
        expect(args.prepareSheet()).toBe(output);
        expect(output.replaceSync).toHaveBeenCalledWith('');
        expect(emitter.createDynamicSheet).toHaveBeenCalledTimes(1);
        isActive.mockReturnValue(false);
        expect(args.isAsyncCancelled()).toBe(true);
    });

    test('does nothing without an active theme or a tracked sheet', () => {
        const {source, getEmitter, modifier, options} = setup();
        renderAdoptedOutput(root, source, {...options, theme: null});
        renderAdoptedOutput(root, sheet('other {}'), options);
        renderAdoptedOutput({} as Document, source, options);
        expect(getEmitter).not.toHaveBeenCalled();
        expect(modifier.modifySheet).not.toHaveBeenCalled();
    });

    test('does not render an inaccessible stylesheet', () => {
        const source = {} as CSSStyleSheet;
        Object.defineProperty(source, 'cssRules', {get: () => {
            throw new Error('inaccessible');
        }});
        const {getEmitter, modifier, options} = setup(source);
        expect(() => renderAdoptedOutput(root, source, options)).not.toThrow();
        expect(getEmitter).not.toHaveBeenCalled();
        expect(modifier.modifySheet).not.toHaveBeenCalled();
    });
});
