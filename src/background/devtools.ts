import type {DevFixType} from '../definitions';
import {parseInversionFixes, formatInversionFixes} from '../generators/css-filter';
import {formatDetectorHints, parseDetectorHints} from '../generators/detector-hints';
import {parseDynamicThemeFixes, formatDynamicThemeFixes} from '../generators/dynamic-theme';
import {parseStaticThemes, formatStaticThemes} from '../generators/static-theme';
import {diffSiteFixes} from '../generators/utils/overrides';

import ConfigManager from './config-manager';
import {logInfo} from './utils/log';

// TODO(bershanskiy): Add support for reads/writes of multiple keys at once for performance.
// TODO(bershanskiy): Popup UI heeds only hasCustom*Fixes() and nothing else. Consider storing that data separately.
interface DevToolsStorage {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void> | void;
    remove(key: string): Promise<void> | void;
    has(key: string): Promise<boolean> | boolean;
}

class PersistentStorageWrapper implements DevToolsStorage {
    // Cache information within background context for future use without waiting.
    private cache: {[key: string]: string | null} = {};

    async get(key: string) {
        if (key in this.cache) {
            return this.cache[key];
        }
        return new Promise<string | null>((resolve) => {
            chrome.storage.local.get<Record<string, any>>(key, (result) => {
                // If cache received a new value (from call to set())
                // before we retrieved the old value from storage,
                // return the new value.
                if (key in this.cache) {
                    logInfo(`Key ${key} was written to during read operation.`);
                    resolve(this.cache[key]);
                    return;
                }

                if (chrome.runtime.lastError) {
                    console.error('Failed to query DevTools data', chrome.runtime.lastError);
                    resolve(null);
                    return;
                }

                this.cache[key] = result[key] ?? null;
                resolve(this.cache[key]);
            });
        });
    }

    async set(key: string, value: string) {
        this.cache[key] = value;
        return new Promise<void>((resolve) => chrome.storage.local.set({[key]: value}, () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to write DevTools data', chrome.runtime.lastError);
            }
            resolve();
        }));
    }

    async remove(key: string) {
        this.cache[key] = null;
        return new Promise<void>((resolve) => chrome.storage.local.remove(key, () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to delete DevTools data', chrome.runtime.lastError);
            }
            resolve();
        }));
    }

    async has(key: string) {
        return Boolean(await this.get(key));
    }
}

class TempStorage implements DevToolsStorage {
    private map = new Map<string, string>();

    async get(key: string) {
        return this.map.get(key) || null;
    }

    set(key: string, value: string) {
        this.map.set(key, value);
    }

    remove(key: string) {
        this.map.delete(key);
    }

    async has(key: string) {
        return this.map.has(key);
    }
}

interface FixTypeHandler<T extends {url: string[]}> {
    storageKey: string;
    parse: (text: string) => T[];
    format: (fixes: T[]) => string;
    getRaw: () => string;
    setOverride: (value: string | null) => void;
    handle: () => void;
}

const FIX_HANDLERS: Record<DevFixType, FixTypeHandler<any>> = {
    detector: {
        storageKey: 'dev_detector_hints',
        parse: parseDetectorHints,
        format: formatDetectorHints,
        getRaw: () => ConfigManager.raw.detectorHints || '',
        setOverride: (value) => {
            ConfigManager.overrides.detectorHints = value;
        },
        handle: () => ConfigManager.handleDetectorHints(),
    },
    dynamic: {
        storageKey: 'dev_dynamic_theme_fixes',
        parse: parseDynamicThemeFixes,
        format: formatDynamicThemeFixes,
        getRaw: () => ConfigManager.raw.dynamicThemeFixes || '',
        setOverride: (value) => {
            ConfigManager.overrides.dynamicThemeFixes = value;
        },
        handle: () => ConfigManager.handleDynamicThemeFixes(),
    },
    filter: {
        storageKey: 'dev_inversion_fixes',
        parse: parseInversionFixes,
        format: formatInversionFixes,
        getRaw: () => ConfigManager.raw.inversionFixes || '',
        setOverride: (value) => {
            ConfigManager.overrides.inversionFixes = value;
        },
        handle: () => ConfigManager.handleInversionFixes(),
    },
    static: {
        storageKey: 'dev_static_themes',
        parse: parseStaticThemes,
        format: formatStaticThemes,
        getRaw: () => ConfigManager.raw.staticThemes || '',
        setOverride: (value) => {
            ConfigManager.overrides.staticThemes = value;
        },
        handle: () => ConfigManager.handleStaticThemes(),
    },
};

export default class DevTools {
    private static onChange: () => void;
    private static store: DevToolsStorage;

    static async init(onChange: () => void): Promise<void> {
        if (typeof chrome.storage.local !== 'undefined' && chrome.storage.local !== null) {
            DevTools.store = new PersistentStorageWrapper();
        } else {
            DevTools.store = new TempStorage();
        }
        DevTools.onChange = onChange;
        await DevTools.loadConfigOverrides();
    }

    private static async normalizeStoredOverride(type: DevFixType, stored: string | null): Promise<string | null> {
        if (!stored) {
            return null;
        }
        const handler = FIX_HANDLERS[type];
        const raw = handler.getRaw();
        if (!raw) {
            return stored;
        }
        const rawCount = handler.parse(raw).length;
        const storedCount = handler.parse(stored).length;
        // Migrate legacy monolithic blobs that duplicated the built-in config.
        if (rawCount > 0 && storedCount >= rawCount) {
            const diff = diffSiteFixes(raw, stored, handler.parse, handler.format);
            if (!diff) {
                await DevTools.store.remove(handler.storageKey);
                return null;
            }
            if (diff !== stored) {
                await DevTools.store.set(handler.storageKey, diff);
            }
            return diff;
        }
        return stored;
    }

    private static async loadConfigOverrides(): Promise<void> {
        const types: DevFixType[] = ['detector', 'dynamic', 'filter', 'static'];
        const values = await Promise.all(
            types.map(async (type) => {
                const rawStored = await DevTools.store.get(FIX_HANDLERS[type].storageKey);
                return DevTools.normalizeStoredOverride(type, rawStored);
            }),
        );
        types.forEach((type, i) => {
            FIX_HANDLERS[type].setOverride(values[i] || null);
        });
    }

    static applyFixes(type: DevFixType, text: string): Error | null {
        try {
            const handler = FIX_HANDLERS[type];
            const trimmed = text.trim();
            if (!trimmed) {
                DevTools.resetFixes(type);
                return null;
            }
            const parsed = handler.parse(text);
            const formatted = parsed.length > 0 ? handler.format(parsed) : '';
            if (!formatted) {
                DevTools.resetFixes(type);
                return null;
            }
            handler.setOverride(formatted);
            handler.handle();
            DevTools.store.set(handler.storageKey, formatted);
            DevTools.onChange();
            return null;
        } catch (err: any) {
            return err as Error;
        }
    }

    static resetFixes(type: DevFixType): void {
        const handler = FIX_HANDLERS[type];
        DevTools.store.remove(handler.storageKey);
        handler.setOverride(null);
        handler.handle();
        DevTools.onChange();
    }

    private static async getOverrideText(type: DevFixType): Promise<string> {
        const handler = FIX_HANDLERS[type];
        const saved = await DevTools.store.get(handler.storageKey);
        if (!saved) {
            return '';
        }
        return handler.format(handler.parse(saved));
    }

    static async getDefaults(): Promise<Record<DevFixType, string>> {
        if (!ConfigManager.raw.dynamicThemeFixes && !ConfigManager.raw.inversionFixes && !ConfigManager.raw.staticThemes && !ConfigManager.raw.detectorHints) {
            await ConfigManager.load();
        }
        return {
            detector: FIX_HANDLERS.detector.format(FIX_HANDLERS.detector.parse(FIX_HANDLERS.detector.getRaw())),
            dynamic: FIX_HANDLERS.dynamic.format(FIX_HANDLERS.dynamic.parse(FIX_HANDLERS.dynamic.getRaw())),
            filter: FIX_HANDLERS.filter.format(FIX_HANDLERS.filter.parse(FIX_HANDLERS.filter.getRaw())),
            static: FIX_HANDLERS.static.format(FIX_HANDLERS.static.parse(FIX_HANDLERS.static.getRaw())),
        };
    }

    static async getDetectorHintsText(): Promise<string> {
        return DevTools.getOverrideText('detector');
    }

    static async getDynamicThemeFixesText(): Promise<string> {
        return DevTools.getOverrideText('dynamic');
    }

    static async getInversionFixesText(): Promise<string> {
        return DevTools.getOverrideText('filter');
    }

    static async getStaticThemesText(): Promise<string> {
        return DevTools.getOverrideText('static');
    }
}
