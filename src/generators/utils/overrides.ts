/**
 * Returns a deterministic key for a site fix's URL list.
 */
export function normalizeURLKey(urls: string[]): string {
    return urls.map((u) => u.trim()).filter(Boolean).sort().join('\n');
}

/**
 * Merges user overrides over raw site fixes, replacing any raw entry
 * whose normalized URL list matches an override entry.
 */
export function mergeSiteFixes<T extends {url: string[]}>(
    rawText: string,
    overrideText: string,
    parse: (text: string) => T[],
    format: (fixes: T[]) => string,
): string {
    const raw = rawText ? parse(rawText) : [];
    const overrides = overrideText ? parse(overrideText) : [];
    if (overrides.length === 0) {
        return raw.length > 0 ? format(raw) : '';
    }
    const overrideKeys = new Set(overrides.map((f) => normalizeURLKey(f.url)));
    const keptRaw = raw.filter((f) => !overrideKeys.has(normalizeURLKey(f.url)));
    return format(keptRaw.concat(overrides));
}

/**
 * Extracts only added or modified site fixes from a legacy monolithic config blob.
 */
export function diffSiteFixes<T extends {url: string[]}>(
    rawText: string,
    fullText: string,
    parse: (text: string) => T[],
    format: (fixes: T[]) => string,
): string {
    const raw = rawText ? parse(rawText) : [];
    const full = fullText ? parse(fullText) : [];
    if (full.length === 0) {
        return '';
    }
    const rawMap = new Map<string, string>();
    raw.forEach((f) => {
        rawMap.set(normalizeURLKey(f.url), format([f]));
    });
    const diff = full.filter((f) => {
        const key = normalizeURLKey(f.url);
        return !rawMap.has(key) || rawMap.get(key) !== format([f]);
    });
    return diff.length > 0 ? format(diff) : '';
}
