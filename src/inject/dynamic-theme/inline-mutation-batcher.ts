export interface InlineMutationBatcher<T> {
    enqueue(items: readonly T[]): void;
    flushNow(): void;
    cancel(): void;
    readonly pendingCount: number;
}

export interface BatcherOptions<T> {
    scheduleMicrotask: (fn: () => void) => void;
    onFlush: (targets: T[]) => void;
}

/** Creates a microtask-queued mutation batcher that deduplicates targets per flush. */
export function createInlineMutationBatcher<T>(options: BatcherOptions<T>): InlineMutationBatcher<T> {
    const {scheduleMicrotask, onFlush} = options;
    const pending = new Set<T>();
    let scheduled = false;
    let cancelled = false;

    function flushNow() {
        scheduled = false;
        if (cancelled || pending.size === 0) {
            return;
        }
        const targets = Array.from(pending);
        pending.clear();
        onFlush(targets);
    }

    function enqueue(items: readonly T[]) {
        if (cancelled || items.length === 0) {
            return;
        }
        for (let i = 0; i < items.length; i++) {
            pending.add(items[i]);
        }
        if (!scheduled) {
            scheduled = true;
            scheduleMicrotask(flushNow);
        }
    }

    function cancel() {
        cancelled = true;
        scheduled = false;
        pending.clear();
    }

    return {
        enqueue,
        flushNow,
        cancel,
        get pendingCount() {
            return pending.size;
        },
    };
}
