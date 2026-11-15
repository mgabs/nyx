import {normalizeURLKey} from '../../../generators/utils/overrides';
import type {SiteFix} from '../types';

export type PerSiteStatus = 'default' | 'overridden' | 'custom';

export interface PerSiteEntry<T extends SiteFix = SiteFix> {
    fix: T;
    key: string;
    status: PerSiteStatus;
}

/**
 * Merges default and override site lists into annotated entries.
 */
export function buildPerSiteEntries<T extends SiteFix>(
    defaultsText: string,
    overridesText: string,
    parse: (text: string) => T[],
): Array<PerSiteEntry<T>> {
    const defaults = defaultsText ? parse(defaultsText) : [];
    const overrides = overridesText ? parse(overridesText) : [];

    const defaultKeys = new Set(defaults.map((f) => normalizeURLKey(f.url)));
    const overrideByKey = new Map<string, T>();
    overrides.forEach((f) => {
        overrideByKey.set(normalizeURLKey(f.url), f);
    });

    const entries: Array<PerSiteEntry<T>> = [];
    defaults.forEach((f) => {
        const key = normalizeURLKey(f.url);
        const override = overrideByKey.get(key);
        if (override) {
            entries.push({fix: override, key, status: 'overridden'});
        } else {
            entries.push({fix: f, key, status: 'default'});
        }
    });

    overrides.forEach((f) => {
        const key = normalizeURLKey(f.url);
        if (!defaultKeys.has(key)) {
            entries.push({fix: f, key, status: 'custom'});
        }
    });

    return entries;
}

/**
 * Validates a single-site edit and returns the updated formatted overrides text.
 */
export function applyPerSiteEdit<T extends SiteFix>(
    overrides: T[],
    currentKey: string,
    editedText: string,
    parse: (text: string) => T[],
    format: (fixes: T[]) => string,
): string {
    const parsed = editedText.trim() ? parse(editedText) : [];
    if (parsed.length === 0) {
        throw new Error('Enter a valid site fix before applying.');
    }
    if (parsed.length > 1) {
        throw new Error('Per-Site Editor accepts one site block at a time.');
    }
    const [change] = parsed;
    const next = overrides.filter((f) => normalizeURLKey(f.url) !== currentKey);
    next.push(change);
    return format(next);
}

/**
 * Removes a single site from the overrides list and returns the updated formatted text.
 */
export function resetPerSiteOverride<T extends SiteFix>(
    overrides: T[],
    currentKey: string,
    format: (fixes: T[]) => string,
): string {
    const next = overrides.filter((f) => normalizeURLKey(f.url) !== currentKey);
    return next.length > 0 ? format(next) : '';
}
