import {createInlineMutationBatcher} from '../../../src/inject/dynamic-theme/inline-mutation-batcher';

describe('createInlineMutationBatcher', () => {
    it('coalesces multiple enqueue calls into a single microtask and deduplicates targets', () => {
        const scheduled: Array<() => void> = [];
        const flushed: string[][] = [];
        const batcher = createInlineMutationBatcher<string>({
            scheduleMicrotask: (fn) => scheduled.push(fn),
            onFlush: (targets) => flushed.push(targets),
        });

        batcher.enqueue(['a', 'b']);
        batcher.enqueue(['b', 'c', 'a']);

        expect(scheduled.length).toBe(1);
        expect(batcher.pendingCount).toBe(3);
        expect(flushed).toEqual([]);

        scheduled[0]();

        expect(flushed).toEqual([['a', 'b', 'c']]);
        expect(batcher.pendingCount).toBe(0);
    });

    it('does not schedule a microtask for empty enqueue calls', () => {
        const scheduled: Array<() => void> = [];
        const flushed: string[][] = [];
        const batcher = createInlineMutationBatcher<string>({
            scheduleMicrotask: (fn) => scheduled.push(fn),
            onFlush: (targets) => flushed.push(targets),
        });

        batcher.enqueue([]);

        expect(scheduled.length).toBe(0);
        expect(batcher.pendingCount).toBe(0);
        expect(flushed).toEqual([]);
    });

    it('schedules a fresh microtask for a new burst after flush', () => {
        const scheduled: Array<() => void> = [];
        const flushed: string[][] = [];
        const batcher = createInlineMutationBatcher<string>({
            scheduleMicrotask: (fn) => scheduled.push(fn),
            onFlush: (targets) => flushed.push(targets),
        });

        batcher.enqueue(['x']);
        scheduled[0]();
        batcher.enqueue(['y']);
        scheduled[1]();

        expect(scheduled.length).toBe(2);
        expect(flushed).toEqual([['x'], ['y']]);
    });

    it('flushes immediately with flushNow and skips empty flushNow', () => {
        const scheduled: Array<() => void> = [];
        const flushed: string[][] = [];
        const batcher = createInlineMutationBatcher<string>({
            scheduleMicrotask: (fn) => scheduled.push(fn),
            onFlush: (targets) => flushed.push(targets),
        });

        batcher.flushNow();
        expect(flushed).toEqual([]);

        batcher.enqueue(['a', 'b', 'a']);
        batcher.flushNow();
        expect(flushed).toEqual([['a', 'b']]);
        expect(batcher.pendingCount).toBe(0);

        // Scheduled microtask after flushNow should not emit an empty flush.
        scheduled[0]();
        expect(flushed).toEqual([['a', 'b']]);
    });

    it('cancels pending flushes and ignores subsequent enqueue or flushNow calls', () => {
        const scheduled: Array<() => void> = [];
        const flushed: string[][] = [];
        const batcher = createInlineMutationBatcher<string>({
            scheduleMicrotask: (fn) => scheduled.push(fn),
            onFlush: (targets) => flushed.push(targets),
        });

        batcher.enqueue(['a', 'b']);
        expect(batcher.pendingCount).toBe(2);

        batcher.cancel();
        expect(batcher.pendingCount).toBe(0);

        scheduled[0]();
        batcher.enqueue(['c']);
        batcher.flushNow();

        expect(scheduled.length).toBe(1);
        expect(flushed).toEqual([]);
    });

    it('coalesces 100 enqueue calls into 1 microtask and flushes 1,000 items within 5ms', () => {
        const scheduled: Array<() => void> = [];
        let flushedCount = 0;
        const batcher = createInlineMutationBatcher<number>({
            scheduleMicrotask: (fn) => scheduled.push(fn),
            onFlush: (targets) => {
                flushedCount = targets.length;
            },
        });

        const start = performance.now();
        for (let i = 0; i < 100; i++) {
            const chunk: number[] = [];
            for (let j = 0; j < 10; j++) {
                chunk.push((i * 10 + j) % 500);
            }
            batcher.enqueue(chunk);
        }
        expect(scheduled.length).toBe(1);
        scheduled[0]();
        const elapsedMs = performance.now() - start;

        expect(flushedCount).toBe(500);
        expect(elapsedMs).toBeLessThanOrEqual(5);
    });
});
