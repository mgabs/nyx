import {createLeanSheetWatcher} from '../../../src/inject/lean-theme/sheet-watch';

describe('Lean event-driven stylesheet watcher', () => {
    test('coalesces stylesheet and load events and stops on teardown', async () => {
        const element = new EventTarget();
        const update = jest.fn();
        const cancelled = jest.fn(() => false);
        const watcher = createLeanSheetWatcher(element as HTMLStyleElement, update, cancelled);
        watcher.start();
        element.dispatchEvent(new Event('__nyx__updateSheet'));
        element.dispatchEvent(new Event('load'));
        await Promise.resolve();
        expect(update).toHaveBeenCalledTimes(1);
        element.dispatchEvent(new Event('load'));
        watcher.stop();
        watcher.start();
        await Promise.resolve();
        expect(update).toHaveBeenCalledTimes(1);
        watcher.stop();
        element.dispatchEvent(new Event('__nyx__updateSheet'));
        await Promise.resolve();
        expect(update).toHaveBeenCalledTimes(1);
    });

    test('handles and detaches both event types independently', async () => {
        const element = new EventTarget();
        const remove = jest.spyOn(element, 'removeEventListener');
        const update = jest.fn();
        const watcher = createLeanSheetWatcher(element as HTMLStyleElement, update, () => false);
        watcher.start();
        element.dispatchEvent(new Event('__nyx__updateSheet'));
        await Promise.resolve();
        expect(update).toHaveBeenCalledTimes(1);
        element.dispatchEvent(new Event('load'));
        await Promise.resolve();
        expect(update).toHaveBeenCalledTimes(2);
        element.dispatchEvent(new Event('load'));
        watcher.stop();
        watcher.start();
        element.dispatchEvent(new Event('__nyx__updateSheet'));
        await Promise.resolve();
        expect(update).toHaveBeenCalledTimes(3);
        watcher.stop();
        expect(remove).toHaveBeenCalledWith('__nyx__updateSheet', expect.any(Function));
        expect(remove).toHaveBeenCalledWith('load', expect.any(Function));
    });

    test('ignores updates while cancelled and accepts later events', async () => {
        const element = new EventTarget();
        const update = jest.fn();
        const cancelled = jest.fn(() => true);
        const watcher = createLeanSheetWatcher(element as HTMLStyleElement, update, cancelled);
        watcher.start();
        element.dispatchEvent(new Event('__nyx__updateSheet'));
        await Promise.resolve();
        expect(update).not.toHaveBeenCalled();
        cancelled.mockReturnValue(false);
        element.dispatchEvent(new Event('load'));
        await Promise.resolve();
        expect(update).toHaveBeenCalledTimes(1);
        watcher.stop();
    });
});
