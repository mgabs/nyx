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
export function createInlineMutationBatcher<T>(_options: BatcherOptions<T>): InlineMutationBatcher<T> {
    throw new Error('Not implemented');
}
