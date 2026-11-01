export function cachedFactory<K, V>(factory: (key: K) => V, size: number): (key: K) => V {
    const cache = new Map<K, V>();

    return (key: K) => {
        if (cache.has(key)) {
            const val = cache.get(key)!;
            cache.delete(key);
            cache.set(key, val);
            return val;
        }
        const value = factory(key);
        cache.set(key, value);
        if (cache.size > size) {
            const first = cache.keys().next().value!;
            cache.delete(first);
        }
        return value;
    };
}
