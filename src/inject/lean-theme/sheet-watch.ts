export function createLeanSheetWatcher(
    element: HTMLLinkElement | HTMLStyleElement,
    callback: () => void,
    isCancelled: () => boolean,
): {start: () => void; stop: () => void} {
    let pending = false;
    let generation = Symbol();
    const onChange = () => {
        if (pending) {
            return;
        }
        pending = true;
        const scheduledGeneration = generation;
        queueMicrotask(() => {
            if (scheduledGeneration !== generation) {
                return;
            }
            pending = false;
            if (!isCancelled()) {
                callback();
            }
        });
    };
    return {
        start: () => {
            element.addEventListener('__nyx__updateSheet', onChange);
            element.addEventListener('load', onChange);
        },
        stop: () => {
            generation = Symbol();
            pending = false;
            element.removeEventListener('__nyx__updateSheet', onChange);
            element.removeEventListener('load', onChange);
        },
    };
}
