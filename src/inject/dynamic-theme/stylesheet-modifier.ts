import type {Theme} from '../../definitions';
import {isChromium} from '../../utils/platform';
import {createAsyncTasksQueue} from '../../utils/throttle';

import {iterateCSSRules, iterateCSSDeclarations, isMediaRule, isLayerRule, isContainerRule, isStyleRule} from './css-rules';
import {themeCacheKeys} from './modify-colors';
import type {ImageURLModifierFactory, ModifiableCSSDeclaration, ModifiableCSSRule} from './modify-css';
import {getModifiableCSSDeclaration} from './modify-css';
import {variablesStore as defaultVariablesStore} from './variables';
import type {CSSVariableModifier, VariablesStore} from './variables';

function getThemeKey(theme: Theme) {
    let resultKey = '';
    themeCacheKeys.forEach((key) => {
        resultKey += `${key}:${theme[key]};`;
    });
    return resultKey;
}

const asyncQueue = createAsyncTasksQueue();

interface ModifySheetOptions {
    sourceCSSRules: CSSRuleList | CSSRule[];
    theme: Theme;
    ignoreImageAnalysis: string[];
    force: boolean;
    prepareSheet: () => CSSBuilder;
    isAsyncCancelled: () => boolean;
}

interface StyleSheetModifier {
    modifySheet: (options: ModifySheetOptions) => void;
    shouldRebuildStyle: () => boolean;
}

export interface CSSBuilder {
    deleteRule(index: number): void;
    insertRule(rule: string, index?: number): number;
    cssRules: {
        readonly length: number;
        [index: number]: CSSBuilder | object;
    };
}

export interface SharedRuleCache {
    cssTextIds: Map<string, string>;
    rulesModCache: Map<string, ModifiableCSSRule | null>;
    maxEntries: number;
    cssTextCounter: number;
}

export interface StyleSheetModifierOptions {
    sharedCache?: SharedRuleCache;
    variablesStore?: VariablesStore;
    imageURLModifier?: ImageURLModifierFactory | null;
}

export function createSharedRuleCache(maxEntries = 4000): SharedRuleCache {
    return {
        cssTextIds: new Map<string, string>(),
        rulesModCache: new Map<string, ModifiableCSSRule | null>(),
        maxEntries,
        cssTextCounter: 0,
    };
}

function isSharedRuleCache(value: SharedRuleCache | StyleSheetModifierOptions | undefined): value is SharedRuleCache {
    return Boolean(value && 'rulesModCache' in value && 'cssTextIds' in value);
}

export function createStyleSheetModifier(optionsOrCache?: SharedRuleCache | StyleSheetModifierOptions): StyleSheetModifier {
    const options: StyleSheetModifierOptions = isSharedRuleCache(optionsOrCache)
        ? {sharedCache: optionsOrCache}
        : (optionsOrCache ?? {});
    const sharedCache = options.sharedCache;
    const activeVariablesStore = options.variablesStore ?? defaultVariablesStore;
    const imageURLModifier = options.imageURLModifier;

    let renderId = 0;

    let cssTextCounter = 0;
    const cssTextIds = sharedCache ? sharedCache.cssTextIds : new Map<string, string>();

    function getCSSTextKey(cssText: string) {
        const existing = cssTextIds.get(cssText);
        if (existing !== undefined) {
            return existing;
        }
        let n = sharedCache ? ++sharedCache.cssTextCounter : ++cssTextCounter;
        let key = '';
        do {
            key = String.fromCharCode(n & 0xFFFF) + key;
            n >>>= 16;
        } while (n > 0);
        if (sharedCache && cssTextIds.size >= sharedCache.maxEntries * 2) {
            const oldestKey = cssTextIds.keys().next().value;
            if (oldestKey !== undefined) {
                cssTextIds.delete(oldestKey);
            }
        }
        cssTextIds.set(cssText, key);
        return key;
    }

    function getStyleRuleKey(rule: CSSStyleRule) {
        let key = getCSSTextKey(rule.cssText);
        if (isMediaRule(rule.parentRule)) {
            key = `${getCSSTextKey(rule.parentRule.media.mediaText)}{${key}}`;
        }
        if (isLayerRule(rule.parentRule)) {
            key = `${getCSSTextKey(rule.parentRule.name)}{${key}}`;
        }
        if (isContainerRule(rule.parentRule)) {
            const {containerName, containerQuery} = rule.parentRule;
            key = `${getCSSTextKey(`${containerName} ${containerQuery}`)}{${key}}`;
        }
        return key;
    }

    const rulesTextCache = new Set<string>();
    const rulesModCache = sharedCache ? sharedCache.rulesModCache : new Map<string, ModifiableCSSRule | null>();
    const varTypeChangeCleaners = new Set<() => void>();
    let prevFilterKey: string | null = null;
    let hasNonLoadedLink = false;
    let wasRebuilt = false;
    function shouldRebuildStyle() {
        return hasNonLoadedLink && !wasRebuilt;
    }

    function setCachedRule(key: string, modRule: ModifiableCSSRule | null) {
        if (sharedCache) {
            if (rulesModCache.has(key)) {
                rulesModCache.delete(key);
            } else if (rulesModCache.size >= sharedCache.maxEntries) {
                const oldestKey = rulesModCache.keys().next().value;
                if (oldestKey !== undefined) {
                    rulesModCache.delete(oldestKey);
                }
            }
        }
        rulesModCache.set(key, modRule);
    }

    function modifySheet(options: ModifySheetOptions) {
        const rules = options.sourceCSSRules;
        const {theme, ignoreImageAnalysis, force, prepareSheet, isAsyncCancelled} = options;

        let rulesChanged = sharedCache ? (rulesTextCache.size === 0) : (rulesModCache.size === 0);
        const notFoundCacheKeys = new Set(sharedCache ? rulesTextCache : rulesModCache.keys());
        const themeKey = getThemeKey(theme);
        const themeChanged = (themeKey !== prevFilterKey);

        if (hasNonLoadedLink) {
            wasRebuilt = true;
        }

        const modRules: ModifiableCSSRule[] = [];
        iterateCSSRules(rules, (rule) => {
            const key = getStyleRuleKey(rule);
            let textDiffersFromPrev = false;

            notFoundCacheKeys.delete(key);
            if (!rulesTextCache.has(key)) {
                rulesTextCache.add(key);
                textDiffersFromPrev = true;
            }

            if (textDiffersFromPrev) {
                rulesChanged = true;
                if (sharedCache && rulesModCache.has(key)) {
                    const cachedRule = rulesModCache.get(key) ?? null;
                    setCachedRule(key, cachedRule);
                    if (cachedRule) {
                        modRules.push(cachedRule);
                    }
                    return;
                }
            } else {
                modRules.push(rulesModCache.get(key)!);
                return;
            }

            // A very specific case to skip. This causes a lot of calls to `getModifiableCSSDeclaration`
            // and currently contributes nothing in real-world case.
            // TODO: Allow `setRule` to throw a exception when we're modifying SVGs namespace styles.
            if (rule.style.all === 'revert') {
                return;
            }

            const modDecs: ModifiableCSSDeclaration[] = [];
            rule.style && iterateCSSDeclarations(rule.style, (property, value) => {
                const mod = getModifiableCSSDeclaration(property, value, rule, activeVariablesStore, ignoreImageAnalysis, isAsyncCancelled, imageURLModifier);
                if (mod) {
                    modDecs.push(mod);
                }
            });

            let modRule: ModifiableCSSRule | null = null;
            if (modDecs.length > 0) {
                const parentRule = rule.parentRule!;
                modRule = {selector: rule.selectorText, declarations: modDecs, parentRule};
                modRules.push(modRule);
            }
            setCachedRule(key, modRule);
        }, () => {
            hasNonLoadedLink = true;
        });

        notFoundCacheKeys.forEach((key) => {
            rulesTextCache.delete(key);
            if (!sharedCache) {
                rulesModCache.delete(key);
            }
        });
        prevFilterKey = themeKey;

        if (!force && !rulesChanged && !themeChanged) {
            return;
        }

        renderId++;

        interface ReadyGroup {
            isGroup: true;
            rule: CSSRule | null;
            rules: Array<ReadyGroup | ReadyStyleRule>;
        }

        interface ReadyStyleRule {
            isGroup: false;
            selector: string;
            declarations: ReadyDeclaration[];
        }

        interface ReadyDeclaration {
            property: string;
            value: string | Array<{property: string; value: string}> | null;
            important: boolean;
            sourceValue: string;
            asyncKey?: number;
            varKey?: number;
        }

        function setRule(target: CSSBuilder, index: number, rule: ReadyStyleRule) {
            const {selector, declarations} = rule;

            let selectorText = selector;
            // Empty :is() and :where() selectors or
            // selectors like :is(:where(:-unknown))
            // break Chrome 119 when calling deleteRule()
            const emptyIsWhereSelector = isChromium && selector.startsWith(':is(') && (
                selector.includes(':is()') ||
                selector.includes(':where()') ||
                (selector.includes(':where(') && selector.includes(':-moz'))
            );
            const viewTransitionSelector = selector.includes('::view-transition-');
            if (emptyIsWhereSelector || viewTransitionSelector) {
                selectorText = '.nyx-unsupported-selector';
            }
            // ::picker(select) becomes ::picker,
            // but cannot be parsed later (Chrome bug)
            if (isChromium && selectorText.endsWith('::picker')) {
                selectorText = selectorText.replaceAll('::picker', '::picker(select)');
            }

            let ruleText = `${selectorText} {`;
            for (const dec of declarations) {
                const {property, value, important} = dec;
                if (value) {
                    ruleText += ` ${property}: ${value}${important ? ' !important' : ''};`;
                }
            }
            ruleText += ' }';

            target.insertRule(ruleText, index);
        }

        interface RuleInfo {
            rule: ReadyStyleRule;
            target: CSSBuilder;
            index: number;
        }

        const asyncDeclarations = new Map<number, RuleInfo>();
        const varDeclarations = new Map<number, RuleInfo>();
        let asyncDeclarationCounter = 0;
        let varDeclarationCounter = 0;

        const rootReadyGroup: ReadyGroup = {rule: null, rules: [], isGroup: true};
        const groupRefs = new WeakMap<CSSRule, ReadyGroup>();

        function getGroup(rule: CSSRule): ReadyGroup {
            if (rule == null) {
                return rootReadyGroup;
            }

            if (groupRefs.has(rule)) {
                return groupRefs.get(rule)!;
            }

            const group: ReadyGroup = {rule, rules: [], isGroup: true};
            groupRefs.set(rule, group);

            const parentGroup = getGroup(rule.parentRule!);
            parentGroup.rules.push(group);

            return group;
        }

        varTypeChangeCleaners.forEach((clear) => clear());
        varTypeChangeCleaners.clear();

        modRules.filter((r) => r).forEach(({selector, declarations, parentRule}) => {
            const group = getGroup(parentRule);
            const readyStyleRule: ReadyStyleRule = {selector, declarations: [], isGroup: false};
            const readyDeclarations = readyStyleRule.declarations;
            group.rules.push(readyStyleRule);

            function handleAsyncDeclaration(property: string, modified: Promise<string | null>, important: boolean, sourceValue: string) {
                const asyncKey = ++asyncDeclarationCounter;
                const asyncDeclaration: ReadyDeclaration = {property, value: null, important, asyncKey, sourceValue};
                readyDeclarations.push(asyncDeclaration);
                const currentRenderId = renderId;
                modified.then((asyncValue) => {
                    if (!asyncValue || isAsyncCancelled() || currentRenderId !== renderId) {
                        return;
                    }
                    asyncDeclaration.value = asyncValue;
                    asyncQueue.add(() => {
                        if (isAsyncCancelled() || currentRenderId !== renderId) {
                            return;
                        }
                        rebuildAsyncRule(asyncKey);
                    });
                });
            }

            function handleVarDeclarations(property: string, modified: ReturnType<CSSVariableModifier>, important: boolean, sourceValue: string) {
                const {declarations: varDecs, onTypeChange} = modified;
                const varKey = ++varDeclarationCounter;
                const currentRenderId = renderId;
                const initialIndex = readyDeclarations.length;
                let oldDecs: ReadyDeclaration[] = [];
                if (varDecs.length === 0) {
                    const tempDec = {property: `--nyx-placeholder-${varKey}`, value: 'none', important: false, sourceValue, varKey};
                    readyDeclarations.push(tempDec);
                    oldDecs = [tempDec];
                }
                varDecs.forEach((mod) => {
                    if (mod.value instanceof Promise) {
                        handleAsyncDeclaration(mod.property, mod.value, important, sourceValue);
                    } else {
                        const readyDec = {property: mod.property, value: mod.value, important, sourceValue, varKey};
                        readyDeclarations.push(readyDec);
                        oldDecs.push(readyDec);
                    }
                });
                onTypeChange.addListener((newDecs) => {
                    if (isAsyncCancelled() || currentRenderId !== renderId) {
                        return;
                    }
                    const readyVarDecs = newDecs.map((mod) => {
                        return {property: mod.property, value: mod.value as string, important, sourceValue, varKey};
                    });
                    // TODO: Don't search for index, store some way or use Linked List.
                    const index = readyDeclarations.indexOf(oldDecs[0], initialIndex);
                    readyDeclarations.splice(index, oldDecs.length, ...readyVarDecs);
                    oldDecs = readyVarDecs;
                    rebuildVarRule(varKey);
                });
                varTypeChangeCleaners.add(() => onTypeChange.removeListeners());
            }

            declarations.forEach(({property, value, important, sourceValue}) => {
                if (typeof value === 'function') {
                    const modified = value(theme);
                    if (modified instanceof Promise) {
                        handleAsyncDeclaration(property, modified, important, sourceValue);
                    } else if (property.startsWith('--')) {
                        handleVarDeclarations(property, modified as any, important, sourceValue);
                    } else {
                        readyDeclarations.push({property, value: modified as string, important, sourceValue});
                    }
                } else {
                    readyDeclarations.push({property, value, important, sourceValue});
                }
            });
        });

        const sheet = prepareSheet();

        function buildStyleSheet() {
            function createTarget(group: ReadyGroup, parent: CSSBuilder): CSSBuilder {
                const {rule} = group;
                if (isStyleRule(rule)) {
                    const {selectorText} = rule;
                    const index = parent.cssRules.length;
                    parent.insertRule(`${selectorText} {}`, index);
                    return parent.cssRules[index] as CSSBuilder;
                }
                if (isMediaRule(rule)) {
                    const {media} = rule;
                    const index = parent.cssRules.length;
                    parent.insertRule(`@media ${media.mediaText} {}`, index);
                    return parent.cssRules[index] as CSSBuilder;
                }
                if (isLayerRule(rule)) {
                    const {name} = rule;
                    const index = parent.cssRules.length;
                    parent.insertRule(`@layer ${name} {}`, index);
                    return parent.cssRules[index] as CSSBuilder;
                }
                if (isContainerRule(rule)) {
                    const {containerName, containerQuery} = rule;
                    const index = parent.cssRules.length;
                    const query = containerName ? `${containerName} ${containerQuery}` : containerQuery;
                    parent.insertRule(`@container ${query} {}`, index);
                    return parent.cssRules[index] as CSSBuilder;
                }
                return parent;
            }

            function iterateReadyRules(
                group: ReadyGroup,
                target: CSSBuilder,
                styleIterator: (s: ReadyStyleRule, t: CSSBuilder) => void,
            ) {
                group.rules.forEach((r) => {
                    if (r.isGroup) {
                        const t = createTarget(r, target);
                        iterateReadyRules(r, t, styleIterator);
                    } else {
                        styleIterator(r as ReadyStyleRule, target);
                    }
                });
            }

            iterateReadyRules(rootReadyGroup, sheet, (rule, target) => {
                const index = target.cssRules.length;
                rule.declarations.forEach(({asyncKey, varKey}) => {
                    if (asyncKey != null) {
                        asyncDeclarations.set(asyncKey, {rule, target, index});
                    }
                    if (varKey != null) {
                        varDeclarations.set(varKey, {rule, target, index});
                    }
                });
                setRule(target, index, rule);
            });
        }

        function rebuildAsyncRule(key: number) {
            const {rule, target, index} = asyncDeclarations.get(key)!;
            target.deleteRule(index);
            setRule(target, index, rule);
            asyncDeclarations.delete(key);
        }

        function rebuildVarRule(key: number) {
            const {rule, target, index} = varDeclarations.get(key)!;
            target.deleteRule(index);
            setRule(target, index, rule);
        }

        buildStyleSheet();
    }

    return {modifySheet, shouldRebuildStyle};
}
