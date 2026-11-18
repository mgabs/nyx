import {watchAdoptedRoot} from '../../../src/inject/lean-theme/adopted-watch';
import type {AdoptedSheetEntry} from '../../../src/inject/lean-theme/adopted-sync';

const sheet = (...rules: string[]) => ({cssRules: rules.map((cssText) => ({cssText}))}) as unknown as CSSStyleSheet;
const modifier = {modifySheet: jest.fn(), shouldRebuildStyle: jest.fn()};
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

function setup() {
    const root = new EventTarget() as unknown as Document;
    const pendingRoots = new Set<Document | ShadowRoot>();
    const entries = new Map<CSSStyleSheet, AdoptedSheetEntry>();
    const isActive = jest.fn(() => true);
    const sync = jest.fn((): CSSStyleSheet[] => []);
    const render = jest.fn();
    const getManagers = jest.fn(() => entries);
    const addRules = jest.fn();
    const reorder = jest.fn();
    const needsFlush = jest.fn(() => false);
    const scheduleFlush = jest.fn();
    const cleanups: Array<() => void> = [];
    const addCleanup = jest.fn((cleanup: () => void) => cleanups.push(cleanup));
    const registeredBeforeEvent = jest.fn(() => addCleanup.mock.calls.length);
    const register = jest.fn((_event: Event) => registeredBeforeEvent());
    root.addEventListener('__nyx__registerAdoptedRoot', register);
    watchAdoptedRoot(root, {pendingRoots, isActive, sync, render, getManagers, addRules, reorder, needsFlush, scheduleFlush, addCleanup});
    const cleanup = () => cleanups.forEach((callback) => callback());
    return {root, pendingRoots, entries, isActive, sync, render, getManagers, addRules, reorder, needsFlush, scheduleFlush, register, registeredBeforeEvent, cleanup};
}

describe('Lean adopted stylesheet events', () => {
    test('registers the root, coalesces events and renders newly tracked sheets', async () => {
        const {root, sync, render, reorder, register, registeredBeforeEvent, cleanup} = setup();
        const added = sheet('a {}');
        sync.mockReturnValue([added]);
        expect(register).toHaveBeenCalledTimes(1);
        expect(registeredBeforeEvent).toHaveReturnedWith(1);
        const registration = register.mock.calls[0][0] as Event;
        expect(registration.bubbles).toBe(true);
        expect(registration.composed).toBe(true);
        const queue = jest.spyOn(globalThis, 'queueMicrotask');
        root.dispatchEvent(new Event('__nyx__adoptedStyleSheetsChange'));
        root.dispatchEvent(new Event('__nyx__adoptedStyleSheetChange'));
        root.dispatchEvent(new Event('__nyx__adoptedStyleDeclarationChange'));
        expect(queue).toHaveBeenCalledTimes(1);
        await flush();
        queue.mockRestore();
        expect(sync).toHaveBeenCalledTimes(1);
        expect(sync).toHaveBeenCalledWith(root);
        expect(render).toHaveBeenCalledWith(root, added);
        expect(reorder).toHaveBeenCalledWith(root);
        cleanup();
        root.dispatchEvent(new Event('__nyx__adoptedStyleSheetsChange'));
        await flush();
        expect(sync).toHaveBeenCalledTimes(1);
    });

    test.each([
        '__nyx__adoptedStyleSheetsChange',
        '__nyx__adoptedStyleSheetChange',
        '__nyx__adoptedStyleDeclarationChange',
    ])('responds to %s independently', async (eventName) => {
        const {root, sync, cleanup} = setup();
        root.dispatchEvent(new Event(eventName));
        await flush();
        expect(sync).toHaveBeenCalledTimes(1);
        cleanup();
    });

    test('matches and renders changed rules, and schedules pending variable work', async () => {
        const {root, entries, addRules, render, needsFlush, scheduleFlush, cleanup} = setup();
        const changed = sheet('new {}', 'other {}');
        const unchanged = sheet('same {}');
        entries.set(changed, {root, outSheet: null, modifier, signature: 'old {}'});
        entries.set(unchanged, {root, outSheet: null, modifier, signature: 'same {}'});
        needsFlush.mockReturnValue(true);
        root.dispatchEvent(new Event('__nyx__adoptedStyleSheetChange'));
        await flush();
        expect(entries.get(changed)!.signature).toBe('new {}\nother {}');
        expect(addRules).toHaveBeenCalledTimes(1);
        expect(addRules).toHaveBeenCalledWith(changed.cssRules);
        expect(render).toHaveBeenCalledTimes(1);
        expect(render).toHaveBeenCalledWith(root, changed);
        expect(scheduleFlush).toHaveBeenCalledTimes(1);
        cleanup();
    });

    test('ignores an inaccessible sheet and continues processing other sheets', async () => {
        const {root, entries, addRules, render, cleanup} = setup();
        const inaccessible = {} as CSSStyleSheet;
        Object.defineProperty(inaccessible, 'cssRules', {get: () => {
            throw new Error('inaccessible');
        }});
        const changed = sheet('new {}');
        entries.set(inaccessible, {root, outSheet: null, modifier, signature: 'old'});
        entries.set(changed, {root, outSheet: null, modifier, signature: 'old'});
        root.dispatchEvent(new Event('__nyx__adoptedStyleSheetChange'));
        await flush();
        expect(addRules).toHaveBeenCalledTimes(1);
        expect(render).toHaveBeenCalledWith(root, changed);
        cleanup();
    });

    test('does not process queued events after deactivation or cancellation', async () => {
        const {root, pendingRoots, isActive, sync, cleanup} = setup();
        root.dispatchEvent(new Event('__nyx__adoptedStyleSheetChange'));
        isActive.mockReturnValue(false);
        await flush();
        expect(sync).not.toHaveBeenCalled();
        isActive.mockReturnValue(true);
        root.dispatchEvent(new Event('__nyx__adoptedStyleSheetChange'));
        pendingRoots.clear();
        await flush();
        expect(sync).not.toHaveBeenCalled();
        cleanup();
    });

    test('handles a root without tracked managers and does not schedule an empty flush', async () => {
        const {root, getManagers, reorder, scheduleFlush, cleanup} = setup();
        getManagers.mockReturnValue(undefined as never);
        root.dispatchEvent(new Event('__nyx__adoptedStyleSheetChange'));
        await flush();
        expect(reorder).toHaveBeenCalledWith(root);
        expect(scheduleFlush).not.toHaveBeenCalled();
        cleanup();
    });
});
