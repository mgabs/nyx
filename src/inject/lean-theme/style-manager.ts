import type {Theme} from '../../definitions';
import {removeCSSComments} from '../../utils/css-text/css-text';
import {loadAsText} from '../../utils/network';
import {getAbsoluteURL} from '../../utils/url';
import {readCSSFetchCache, writeCSSFetchCache} from '../cache';
import {addReadyStateCompleteListener} from '../utils/dom';
import {logInfo, logWarn} from '../utils/log';

import {replaceCSSRelativeURLsWithAbsolute, replaceCSSFontFace, getCSSBaseBath, getCSSURLValue} from '../dynamic-theme/css-rules';
import {bgFetch} from '../dynamic-theme/network';
import type {StyleElement} from '../dynamic-theme/style-manager';
import {createStyleSheetModifier} from '../dynamic-theme/stylesheet-modifier';
import type {SharedRuleCache} from '../dynamic-theme/stylesheet-modifier';
import type {VariablesStore} from '../dynamic-theme/variables';
import {createSheetWatcher} from '../dynamic-theme/watch/sheet-changes';

import {createConstructableSheet} from './adopted-emitter';
import type {AdoptedEmitter} from './adopted-emitter';
import {wrapImportConditions} from './import-wrapping';
import {findCSSImports} from './import-scan';

export interface LeanStyleManager {
    details(options: {secondRound: boolean}): {rules: CSSRuleList} | null;
    render(theme: Theme, ignoreImageAnalysis: string[]): void;
    pause(): void;
    destroy(): void;
    watch(): void;
}

const loadingLinkCounter = new Map<HTMLLinkElement, symbol>();
let loadingLinks = 0;

export function cleanLeanLoadingLinks(): void {
    loadingLinkCounter.clear();
    loadingLinks = 0;
}

export function manageLeanStyle(
    element: StyleElement,
    options: {
        root: Document | ShadowRoot;
        emitter: AdoptedEmitter;
        sharedCache: SharedRuleCache;
        variablesStore: VariablesStore;
        update: () => void;
        loadingStart: () => void;
        loadingEnd: () => void;
    },
): LeanStyleManager {
    const {root, emitter, sharedCache, variablesStore, update, loadingStart, loadingEnd} = options;

    let isDestroyed = false;
    let isPaused = false;
    let cancelAsyncOperations = false;
    let overrideSheet: CSSStyleSheet | null = null;
    let corsSheet: CSSStyleSheet | null = null;
    let prevRulesCount = 0;

    const sheetModifier = createStyleSheetModifier({
        sharedCache,
        variablesStore,
        imageURLModifier: null,
    });

    const sheetWatcher = createSheetWatcher(
        element,
        getRulesSync,
        update,
        () => isDestroyed || isPaused,
    );

    function prepareSheet(): CSSStyleSheet {
        if (!overrideSheet) {
            overrideSheet = emitter.createDynamicSheet(root);
        } else {
            overrideSheet.replaceSync('');
        }
        return overrideSheet;
    }

    function getRulesSync(): CSSRuleList | null {
        if (corsSheet) {
            return corsSheet.cssRules;
        }
        try {
            if (element.sheet && element.sheet.cssRules) {
                return element.sheet.cssRules;
            }
        } catch {
            // Cross-origin stylesheet; handled via bgFetch
        }
        return null;
    }

    async function loadCSS(href: string): Promise<string | null> {
        if (!href) {
            return null;
        }
        const cached = readCSSFetchCache(href);
        if (cached) {
            return cached;
        }
        try {
            const response = await bgFetch({url: href, responseType: 'text', mimeType: 'text/css', origin: location.origin});
            writeCSSFetchCache(href, response);
            return response;
        } catch (err) {
            logWarn('LeanStyleManager bgFetch error', err);
            try {
                const text = await loadAsText(href, 'text/css');
                writeCSSFetchCache(href, text);
                return text;
            } catch (fallbackErr) {
                logWarn('LeanStyleManager fallback fetch error', fallbackErr);
                return null;
            }
        }
    }

    async function expandImports(css: string, baseURL: string, ancestors: Set<string>): Promise<string> {
        const source = removeCSSComments(css);
        let result = '';
        let offset = 0;
        for (const match of findCSSImports(source)) {
            result += source.slice(offset, match.index);
            offset = match.index + match[0].length;
            const url = getAbsoluteURL(baseURL, getCSSURLValue(match[1]));
            if (ancestors.has(url) || ancestors.size >= 32 || isDestroyed || cancelAsyncOperations) {
                continue;
            }
            const imported = await loadCSS(url);
            if (imported == null || isDestroyed || cancelAsyncOperations) {
                continue;
            }
            const nextAncestors = new Set(ancestors);
            nextAncestors.add(url);
            const expanded = await expandImports(imported, getCSSBaseBath(url), nextAncestors);
            const wrapped = wrapImportConditions(expanded, match[2]);
            if (wrapped != null) {
                result += wrapped;
            }
        }
        result += source.slice(offset);
        return replaceCSSRelativeURLsWithAbsolute(replaceCSSFontFace(result), baseURL);
    }

    async function loadCORSSheet(link: HTMLLinkElement) {
        if (loadingLinkCounter.get(link)) {
            return;
        }
        const loadToken = Symbol();
        loadingLinkCounter.set(link, loadToken);
        loadingLinks++;
        loadingStart();
        try {
            let cssText = await loadCSS(link.href);
            if (isDestroyed || cancelAsyncOperations || cssText == null) {
                return;
            }
            const baseURL = getCSSBaseBath(link.href);
            cssText = await expandImports(cssText, baseURL, new Set([link.href]));
            if (isDestroyed || cancelAsyncOperations) {
                return;
            }

            if (!corsSheet) {
                corsSheet = createConstructableSheet();
            }
            corsSheet.replaceSync(cssText);
            logInfo(`Loaded CORS stylesheet for ${link.href}`);
            update();
        } finally {
            if (loadingLinkCounter.get(link) === loadToken) {
                loadingLinkCounter.delete(link);
                loadingLinks = Math.max(0, loadingLinks - 1);
            }
            loadingEnd();
        }
    }

    function details(opts: {secondRound: boolean}): {rules: CSSRuleList} | null {
        if (isDestroyed) {
            return null;
        }
        const rules = getRulesSync();
        if (rules) {
            return {rules};
        }
        if (element instanceof HTMLLinkElement && element.href && !opts.secondRound) {
            if (document.readyState === 'complete') {
                loadCORSSheet(element);
            } else {
                addReadyStateCompleteListener(() => {
                    if (!isDestroyed && !getRulesSync()) {
                        loadCORSSheet(element);
                    }
                });
            }
        }
        return null;
    }

    function render(theme: Theme, ignoreImageAnalysis: string[]): void {
        if (isDestroyed) {
            return;
        }
        isPaused = false;
        const rules = getRulesSync();
        if (!rules) {
            return;
        }
        cancelAsyncOperations = false;
        const force = rules.length !== prevRulesCount;
        prevRulesCount = rules.length;

        sheetModifier.modifySheet({
            sourceCSSRules: rules,
            theme,
            ignoreImageAnalysis,
            force,
            prepareSheet,
            isAsyncCancelled: () => isDestroyed || cancelAsyncOperations,
        });
    }

    function pause(): void {
        isPaused = true;
        cancelAsyncOperations = true;
    }

    function watch(): void {
        sheetWatcher.start();
    }

    function destroy(): void {
        isDestroyed = true;
        cancelAsyncOperations = true;
        sheetWatcher.stop();
        if (overrideSheet) {
            emitter.removeDynamicSheet(root, overrideSheet);
            overrideSheet = null;
        }
        corsSheet = null;
    }

    return {
        details,
        render,
        pause,
        destroy,
        watch,
    };
}
