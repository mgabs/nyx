import {cachedFactory} from '../../../src/utils/cache';

describe('REQ-PERF-1 True LRU Cache Eviction', () => {
    test('cachedFactory evicts least recently accessed key on capacity overflow', () => {
        let factoryCalls = 0;
        const factory = (key: string) => {
            factoryCalls++;
            return key.toUpperCase();
        };

        const getCached = cachedFactory(factory, 2);

        expect(getCached('a')).toBe('A');
        expect(factoryCalls).toBe(1);

        expect(getCached('b')).toBe('B');
        expect(factoryCalls).toBe(2);

        // Access 'a' again - should hit cache and refresh 'a' to most recently used
        expect(getCached('a')).toBe('A');
        expect(factoryCalls).toBe(2);

        // Add 'c' - capacity 2 exceeded.
        // 'b' is least recently used, so 'b' MUST be evicted, NOT 'a'.
        expect(getCached('c')).toBe('C');
        expect(factoryCalls).toBe(3);

        // 'a' should still be cached (no factory call)
        expect(getCached('a')).toBe('A');
        expect(factoryCalls).toBe(3);

        // 'b' was evicted, so requesting 'b' calls factory again
        expect(getCached('b')).toBe('B');
        expect(factoryCalls).toBe(4);
    });

    test('cachedFactory preserves order across multiple accesses', () => {
        const calls: string[] = [];
        const factory = (k: number) => {
            calls.push(`compute:${k}`);
            return k * 10;
        };

        const cache = cachedFactory(factory, 3);
        cache(1); // [1]
        cache(2); // [1, 2]
        cache(3); // [1, 2, 3]

        // Access 1 and 2 to reorder
        cache(1); // [2, 3, 1]
        cache(2); // [3, 1, 2]

        // Add 4 -> 3 should be evicted
        cache(4); // [1, 2, 4]

        expect(calls).toEqual(['compute:1', 'compute:2', 'compute:3', 'compute:4']);

        // 1, 2, 4 are cached
        cache(1);
        cache(2);
        cache(4);
        expect(calls.length).toBe(4);

        // 3 was evicted and must recompute
        cache(3);
        expect(calls.length).toBe(5);
        expect(calls[4]).toBe('compute:3');
    });

    test('cachedFactory handles size 1 cache', () => {
        let calls = 0;
        const cache = cachedFactory((k: string) => {
            calls++;
            return `${k}!`;
        }, 1);

        expect(cache('x')).toBe('x!');
        expect(calls).toBe(1);

        // Re-access x
        expect(cache('x')).toBe('x!');
        expect(calls).toBe(1);

        // Add y -> evicts x
        expect(cache('y')).toBe('y!');
        expect(calls).toBe(2);

        // Re-access x -> recomputed
        expect(cache('x')).toBe('x!');
        expect(calls).toBe(3);
    });
});
