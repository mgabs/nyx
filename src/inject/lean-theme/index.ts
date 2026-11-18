import type {Theme, DynamicThemeFix} from '../../definitions';
import {getCSSFilterValue} from '../../generators/css-filter';
import {createTextStyle} from '../../generators/text-style';
import {forEach} from '../../utils/array';
import {clearColorCache, getSRGBLightness, parseColorWithCache} from '../../utils/color';
import {isShadowDomSupported} from '../../utils/platform';
import {
    iterateShadowHosts,
    isDOMReady,
    addDOMReadyListener,
    removeDOMReadyListener,
    addReadyStateCompleteListener,
    cleanReadyStateCompleteListeners,
} from '../utils/dom';
import {logWarn} from '../utils/log';

import {clearColorModificationCache, modifyBackgroundColor, modifyForegroundColor} from '../dynamic-theme/modify-colors';
import {getModifiedUserAgentStyle, getModifiedFallbackStyle, getSelectionColor} from '../dynamic-theme/modify-css';
import {clearColorPalette, registerVariablesSheet, releaseVariablesSheet} from '../dynamic-theme/palette';
import {getManageableStyles, setIgnoredCSSURLs, shouldManageStyle} from '../dynamic-theme/style-manager';
import type {StyleElement} from '../dynamic-theme/style-manager';
import {injectProxy} from '../dynamic-theme/stylesheet-proxy';

declare const __CHROMIUM_MV3__: boolean;
import {createSharedRuleCache, createStyleSheetModifier} from '../dynamic-theme/stylesheet-modifier';
import {VariablesStore} from '../dynamic-theme/variables';

import {createAdoptedEmitter, getAdoptedSheets} from './adopted-emitter';
import {syncAdoptedSheets} from './adopted-sync';
import {watchAdoptedRoot} from './adopted-watch';
import {renderAdoptedOutput} from './adopted-render';
import {reorderAdoptedOutputs as reorderAdopted} from './adopted-reorder';
import type {AdoptedSheetEntry} from './adopted-sync';
import type {AdoptedEmitter} from './adopted-emitter';
import {
    applyLeanInlineStyles,
    clearLeanInlineOverrides,
    getLeanInlineOverrideStyle,
    LEAN_INLINE_OVERRIDE_SELECTOR,
    overrideLeanInlineStyle,
} from './inline-style';
import {cleanLeanLoadingLinks, manageLeanStyle} from './style-manager';
import type {LeanStyleManager} from './style-manager';

const leanVariablesStore = new VariablesStore({imageURLModifier: null});
const sharedRuleCache = createSharedRuleCache(4000);

let emitter: AdoptedEmitter | null = null;
const styleManagers = new Map<StyleElement, LeanStyleManager>();
const adoptedSheetManagers = new Map<Document | ShadowRoot, Map<CSSStyleSheet, AdoptedSheetEntry>>();
const adoptedEventCleaners: Array<() => void> = [];
const pendingAdoptedRoots = new Set<Document | ShadowRoot>();
const shadowRootsObserved = new Set<ShadowRoot>();
const shadowObservers = new Map<ShadowRoot, MutationObserver>();

let currentTheme: Theme | null = null;
let currentFixes: DynamicThemeFix | null = null;
let currentIsIFrame = false;
let ignoredImageSelectors: string[] = [];
let ignoredInlineSelectors: string[] = [];

let domObserver: MutationObserver | null = null;
const pendingAddedStyles = new Set<StyleElement>();
const pendingRemovedStyles = new Set<StyleElement>();
const pendingUpdatedManagers = new Set<LeanStyleManager>();
const pendingInlineElements = new Set<HTMLElement | SVGElement>();
const pendingShadowHosts = new Set<Element>();
let pendingVariablesMatch = false;
let pendingRootVars = false;
let microtaskScheduled = false;
let rafId: number | null = null;
let loadingCount = 0;
let themeGeneration = 0;

function ensureEmitter(): AdoptedEmitter {
    if (!emitter) {
        emitter = createAdoptedEmitter();
    }
    return emitter;
}

function replaceCSSTemplates(cssText: string, theme: Theme): string {
    return cssText.replace(/\${(.+?)}/g, (_, colorStr) => {
        const color = parseColorWithCache(colorStr);
        if (color) {
            const lightness = getSRGBLightness(color.r, color.g, color.b);
            if (lightness > 0.5) {
                return modifyBackgroundColor(color, theme);
            }
            return modifyForegroundColor(color, theme);
        }
        logWarn("Couldn't parse CSSTemplate's color.");
        return colorStr;
    });
}

function getInversionStyleValue(theme: Theme, fixes: DynamicThemeFix | null): string {
    if (!fixes?.invert || fixes.invert.length === 0) {
        return '';
    }
    const filter = getCSSFilterValue(theme);
    const invertRule = filter ? `filter: ${filter} !important;` : '';
    return invertRule ? `${fixes.invert.join(', ')} {\n  ${invertRule}\n}` : '';
}

function updateRootVars(): void {
    if (!currentTheme) {
        return;
    }
    const activeEmitter = ensureEmitter();
    const varsText = leanVariablesStore.getRootVarsText(currentTheme);
    activeEmitter.setNamedSheet(document, 'root-vars', varsText, 'beginning');
}

function createStaticStyleOverrides(): void {
    if (!currentTheme) {
        return;
    }
    const activeEmitter = ensureEmitter();

    activeEmitter.setNamedSheet(document, 'fallback', getModifiedFallbackStyle(currentTheme, {strict: true}), 'beginning');
    activeEmitter.setNamedSheet(document, 'user-agent', getModifiedUserAgentStyle(currentTheme, currentIsIFrame, currentTheme.styleSystemControls), 'beginning');
    activeEmitter.setNamedSheet(document, 'text', currentTheme.useFont || currentTheme.textStroke > 0 ? createTextStyle(currentTheme) : '', 'beginning');
    activeEmitter.setNamedSheet(document, 'invert', getInversionStyleValue(currentTheme, currentFixes), 'beginning');

    const selectionColors = currentTheme.selectionColor ? getSelectionColor(currentTheme) : null;
    const neutralBackgroundColor = modifyBackgroundColor(parseColorWithCache('#ffffff')!, currentTheme);
    const neutralTextColor = modifyForegroundColor(parseColorWithCache('#000000')!, currentTheme);
    const variableStyleContent = [
        ':root {',
        `  --nyx-neutral-background: ${neutralBackgroundColor};`,
        `  --nyx-neutral-text: ${neutralTextColor};`,
        `  --nyx-selection-background: ${selectionColors?.backgroundColorSelection ?? 'initial'};`,
        `  --nyx-selection-text: ${selectionColors?.foregroundColorSelection ?? 'initial'};`,
        '}',
    ].join('\n');

    const variableSheet = activeEmitter.setNamedSheet(document, 'variables', variableStyleContent, 'beginning');
    registerVariablesSheet(variableSheet);
    activeEmitter.setNamedSheet(document, 'root-vars', '', 'beginning');

    const overrideCSS = currentFixes?.css ? replaceCSSTemplates(currentFixes.css, currentTheme) : '';
    activeEmitter.setNamedSheet(document, 'override', overrideCSS, 'ending');
    activeEmitter.setNamedSheet(document, 'inline', getLeanInlineOverrideStyle(), 'ending');
}

function createShadowStaticStyleOverrides(root: ShadowRoot): void {
    if (!currentTheme) {
        return;
    }
    const activeEmitter = ensureEmitter();
    activeEmitter.setNamedSheet(root, 'invert', getInversionStyleValue(currentTheme, currentFixes), 'beginning');
    const overrideCSS = currentFixes?.css ? replaceCSSTemplates(currentFixes.css, currentTheme) : '';
    activeEmitter.setNamedSheet(root, 'override', overrideCSS, 'ending');
    activeEmitter.setNamedSheet(root, 'inline', getLeanInlineOverrideStyle(), 'ending');
}

function syncPageAdoptedSheets(root: Document | ShadowRoot): CSSStyleSheet[] {
    return syncAdoptedSheets(root, {
        emitter: ensureEmitter(),
        getSheets: getAdoptedSheets,
        managersByRoot: adoptedSheetManagers,
        addRules: (rules) => {
            leanVariablesStore.addRulesForMatching(rules);
            pendingVariablesMatch = true;
        },
        createModifier: () => createStyleSheetModifier({
            sharedCache: sharedRuleCache,
            variablesStore: leanVariablesStore,
            imageURLModifier: null,
        }),
    });
}

function renderAdoptedSheet(root: Document | ShadowRoot, sheet: CSSStyleSheet): void {
    renderAdoptedOutput(root, sheet, {
        theme: currentTheme,
        managersByRoot: adoptedSheetManagers,
        getEmitter: ensureEmitter,
        ignoredImageSelectors,
        isActive: () => Boolean(currentTheme),
    });
}

function reorderAdoptedOutputs(root: Document | ShadowRoot): void {
    reorderAdopted(root, {managersByRoot: adoptedSheetManagers, emitter, getSheets: getAdoptedSheets});
}

function createManager(element: StyleElement, root: Document | ShadowRoot): LeanStyleManager {
    const activeEmitter = ensureEmitter();
    const generation = themeGeneration;
    const manager = manageLeanStyle(element, {
        root,
        emitter: activeEmitter,
        sharedCache: sharedRuleCache,
        variablesStore: leanVariablesStore,
        update: () => {
            pendingUpdatedManagers.add(manager);
            scheduleCoalescedFlush();
        },
        loadingStart: () => {
            if (generation === themeGeneration) {
                loadingCount++;
            }
        },
        loadingEnd: () => {
            if (generation !== themeGeneration) {
                return;
            }
            loadingCount = Math.max(0, loadingCount - 1);
            if (loadingCount === 0) {
                cleanFallback();
            }
        },
    });
    styleManagers.set(element, manager);
    return manager;
}

function cleanFallback(): void {
    if (emitter) {
        emitter.setNamedSheet(document, 'fallback', '', 'beginning');
    }
    document.querySelector('.nyx.nyx--fallback')?.remove();
}

function renderDynamicStyles(): void {
    if (!currentTheme) {
        return;
    }
    const allStyles = getManageableStyles(document);
    const newManagers: LeanStyleManager[] = [];

    for (const style of allStyles) {
        if (!styleManagers.has(style)) {
            const rootNode = style.getRootNode();
            const root: Document | ShadowRoot = (isShadowDomSupported && rootNode instanceof ShadowRoot) ? rootNode : document;
            newManagers.push(createManager(style, root));
        }
    }

    for (const manager of newManagers) {
        const detail = manager.details({secondRound: false});
        if (detail && detail.rules.length > 0) {
            leanVariablesStore.addRulesForMatching(detail.rules);
        }
    }
    syncPageAdoptedSheets(document);

    leanVariablesStore.matchVariablesAndDependents();
    leanVariablesStore.setOnRootVariableChange(() => {
        pendingRootVars = true;
        scheduleCoalescedFlush();
    });
    updateRootVars();

    styleManagers.forEach((manager) => {
        manager.render(currentTheme!, ignoredImageSelectors);
        manager.watch();
    });
    adoptedSheetManagers.forEach((managers, root) => {
        managers.forEach((_entry, sheet) => renderAdoptedSheet(root, sheet));
        reorderAdoptedOutputs(root);
    });

    if (loadingCount === 0) {
        cleanFallback();
    }
}

function flushCoalescedMutations(): void {
    microtaskScheduled = false;
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    if (!currentTheme) {
        return;
    }

    if (pendingRemovedStyles.size > 0) {
        pendingRemovedStyles.forEach((el) => {
            const manager = styleManagers.get(el);
            if (manager) {
                manager.destroy();
                styleManagers.delete(el);
            }
        });
        pendingRemovedStyles.clear();
    }

    const newlyAddedManagers: LeanStyleManager[] = [];
    if (pendingAddedStyles.size > 0) {
        pendingAddedStyles.forEach((el) => {
            if (el.isConnected && shouldManageStyle(el) && !styleManagers.has(el)) {
                const rootNode = el.getRootNode();
                const root: Document | ShadowRoot = (isShadowDomSupported && rootNode instanceof ShadowRoot) ? rootNode : document;
                const manager = createManager(el, root);
                newlyAddedManagers.push(manager);
                const detail = manager.details({secondRound: false});
                if (detail && detail.rules.length > 0) {
                    leanVariablesStore.addRulesForMatching(detail.rules);
                    pendingVariablesMatch = true;
                }
            }
        });
        pendingAddedStyles.clear();
    }

    if (pendingShadowHosts.size > 0) {
        pendingShadowHosts.forEach((host) => {
            if (host.shadowRoot) {
                setupShadowRoot(host.shadowRoot);
            }
        });
        pendingShadowHosts.clear();
    }

    const updatedManagers = new Set(pendingUpdatedManagers);
    pendingUpdatedManagers.clear();
    updatedManagers.forEach((manager) => {
        const detail = manager.details({secondRound: true});
        if (detail && detail.rules.length > 0) {
            leanVariablesStore.addRulesForMatching(detail.rules);
            pendingVariablesMatch = true;
        }
    });

    if (pendingVariablesMatch) {
        pendingVariablesMatch = false;
        leanVariablesStore.matchVariablesAndDependents();
        pendingRootVars = true;
    }

    if (pendingRootVars) {
        pendingRootVars = false;
        updateRootVars();
    }

    const rendered = new Set<LeanStyleManager>();
    for (const manager of newlyAddedManagers) {
        manager.render(currentTheme, ignoredImageSelectors);
        manager.watch();
        rendered.add(manager);
    }
    updatedManagers.forEach((manager) => {
        if (!rendered.has(manager)) {
            manager.render(currentTheme!, ignoredImageSelectors);
        }
    });

    if (pendingInlineElements.size > 0) {
        pendingInlineElements.forEach((el) => {
            if (el.isConnected) {
                overrideLeanInlineStyle(el, currentTheme!, leanVariablesStore, ignoredInlineSelectors, ignoredImageSelectors);
            }
        });
        pendingInlineElements.clear();
    }
}

function scheduleCoalescedFlush(): void {
    if (microtaskScheduled) {
        return;
    }
    microtaskScheduled = true;
    queueMicrotask(() => {
        if (rafId !== null) {
            return;
        }
        if (typeof requestAnimationFrame === 'function') {
            rafId = requestAnimationFrame(() => flushCoalescedMutations());
        } else {
            flushCoalescedMutations();
        }
    });
}

function collectMutationsFromRoot(mutations: MutationRecord[]): void {
    let hasRelevantMutation = false;

    for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            if (mutation.target instanceof HTMLElement || mutation.target instanceof SVGElement) {
                pendingInlineElements.add(mutation.target);
                hasRelevantMutation = true;
            }
        } else if (mutation.type === 'childList') {
            forEach(mutation.addedNodes, (node) => {
                if (shouldManageStyle(node)) {
                    pendingAddedStyles.add(node as StyleElement);
                    hasRelevantMutation = true;
                } else if (node instanceof Element) {
                    const nestedStyles = getManageableStyles(node);
                    for (const style of nestedStyles) {
                        pendingAddedStyles.add(style);
                        hasRelevantMutation = true;
                    }
                    if ((node instanceof HTMLElement || node instanceof SVGElement) && node.hasAttribute('style')) {
                        pendingInlineElements.add(node);
                        hasRelevantMutation = true;
                    }
                    forEach(node.querySelectorAll('[style]'), (el) => {
                        if (el instanceof HTMLElement || el instanceof SVGElement) {
                            pendingInlineElements.add(el);
                            hasRelevantMutation = true;
                        }
                    });
                    if (node.shadowRoot) {
                        pendingShadowHosts.add(node);
                        hasRelevantMutation = true;
                    }
                    iterateShadowHosts(node, (host) => {
                        pendingShadowHosts.add(host);
                        hasRelevantMutation = true;
                    });
                }
            });
            forEach(mutation.removedNodes, (node) => {
                if (styleManagers.has(node as StyleElement)) {
                    pendingRemovedStyles.add(node as StyleElement);
                    hasRelevantMutation = true;
                } else if (node instanceof Element) {
                    styleManagers.forEach((_manager, el) => {
                        if (node.contains(el)) {
                            pendingRemovedStyles.add(el);
                            hasRelevantMutation = true;
                        }
                    });
                }
            });
        }
    }

    if (hasRelevantMutation) {
        scheduleCoalescedFlush();
    }
}

function setupShadowRoot(shadowRoot: ShadowRoot): void {
    if (shadowRootsObserved.has(shadowRoot)) {
        createShadowStaticStyleOverrides(shadowRoot);
        return;
    }
    shadowRootsObserved.add(shadowRoot);
    createShadowStaticStyleOverrides(shadowRoot);

    const styles = getManageableStyles(shadowRoot, [], true);
    const newManagers: LeanStyleManager[] = [];
    for (const style of styles) {
        if (!styleManagers.has(style)) {
            const manager = createManager(style, shadowRoot);
            newManagers.push(manager);
            const detail = manager.details({secondRound: false});
            if (detail && detail.rules.length > 0) {
                leanVariablesStore.addRulesForMatching(detail.rules);
                pendingVariablesMatch = true;
            }
        }
    }
    const newAdopted = syncPageAdoptedSheets(shadowRoot);

    if (pendingVariablesMatch) {
        pendingVariablesMatch = false;
        leanVariablesStore.matchVariablesAndDependents();
        pendingRootVars = true;
    }
    if (pendingRootVars) {
        pendingRootVars = false;
        updateRootVars();
    }

    if (currentTheme) {
        for (const manager of newManagers) {
            manager.render(currentTheme, ignoredImageSelectors);
            manager.watch();
        }
        for (const sheet of newAdopted) {
            renderAdoptedSheet(shadowRoot, sheet);
        }
        reorderAdoptedOutputs(shadowRoot);
        applyLeanInlineStyles(shadowRoot, currentTheme, leanVariablesStore, ignoredInlineSelectors, ignoredImageSelectors);
    }

    const observer = new MutationObserver((mutations) => collectMutationsFromRoot(mutations));
    observer.observe(shadowRoot, {childList: true, subtree: true, attributes: true, attributeFilter: ['style']});
    shadowObservers.set(shadowRoot, observer);
    startWatchingAdoptedRoot(shadowRoot);
}

function startWatchingAdoptedRoot(root: Document | ShadowRoot): void {
    watchAdoptedRoot(root, {
        pendingRoots: pendingAdoptedRoots,
        isActive: () => Boolean(currentTheme),
        sync: syncPageAdoptedSheets,
        render: renderAdoptedSheet,
        getManagers: (target) => adoptedSheetManagers.get(target),
        addRules: (rules) => {
            leanVariablesStore.addRulesForMatching(rules);
            pendingVariablesMatch = true;
        },
        reorder: reorderAdoptedOutputs,
        needsFlush: () => pendingVariablesMatch,
        scheduleFlush: scheduleCoalescedFlush,
        addCleanup: (cleanup) => adoptedEventCleaners.push(cleanup),
    });
}

function startLeanProxy(fixes: DynamicThemeFix | null): void {
    document.dispatchEvent(new CustomEvent('__nyx__cleanUp'));
    const enableStyleSheetsProxy = !(fixes && fixes.disableStyleSheetsProxy);
    const enableCustomElementRegistryProxy = !(fixes && fixes.disableCustomElementRegistryProxy);
    if (__CHROMIUM_MV3__) {
        document.dispatchEvent(new CustomEvent('__nyx__stylesheetProxy__arg', {detail: {enableStyleSheetsProxy, enableCustomElementRegistryProxy, enableLeanDeclarations: true}}));
    } else {
        const script = document.createElement('script');
        script.textContent = `(${injectProxy})(${enableStyleSheetsProxy}, ${enableCustomElementRegistryProxy}, true)`;
        (document.head || document.documentElement).append(script);
        script.remove();
    }
}

function startWatching(): void {
    stopWatching();

    if (document.documentElement) {
        domObserver = new MutationObserver((mutations) => collectMutationsFromRoot(mutations));
        domObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style'],
        });
    }

    if (isShadowDomSupported && document.documentElement) {
        iterateShadowHosts(document.documentElement, (host) => {
            if (host.shadowRoot) {
                setupShadowRoot(host.shadowRoot);
            }
        });
    }
    startWatchingAdoptedRoot(document);
}

function stopWatching(): void {
    adoptedEventCleaners.forEach((clean) => clean());
    adoptedEventCleaners.length = 0;
    pendingAdoptedRoots.clear();
    if (domObserver) {
        domObserver.disconnect();
        domObserver = null;
    }
    shadowObservers.forEach((observer) => observer.disconnect());
    shadowObservers.clear();
    shadowRootsObserved.clear();
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    microtaskScheduled = false;
    pendingAddedStyles.clear();
    pendingRemovedStyles.clear();
    pendingUpdatedManagers.clear();
    pendingInlineElements.clear();
    pendingShadowHosts.clear();
    pendingVariablesMatch = false;
    pendingRootVars = false;
}

const onDOMReady = () => {
    if (!currentTheme) {
        return;
    }
    renderDynamicStyles();
    applyLeanInlineStyles(document, currentTheme, leanVariablesStore, ignoredInlineSelectors, ignoredImageSelectors);
    startWatching();
};

export function createOrUpdateLeanTheme(
    theme: Theme,
    fixes: DynamicThemeFix | null,
    isIFrame: boolean,
): void {
    currentTheme = theme;
    currentFixes = fixes;
    currentIsIFrame = isIFrame;
    ignoredImageSelectors = fixes?.ignoreImageAnalysis ?? [];
    ignoredInlineSelectors = fixes?.ignoreInlineStyle ?? [];
    setIgnoredCSSURLs(fixes?.ignoreCSSUrl ?? []);

    clearColorPalette();
    clearColorModificationCache();
    startLeanProxy(fixes);
    createStaticStyleOverrides();

    if (isDOMReady()) {
        renderDynamicStyles();
        applyLeanInlineStyles(document, currentTheme, leanVariablesStore, ignoredInlineSelectors, ignoredImageSelectors);
        startWatching();
    } else {
        addDOMReadyListener(onDOMReady);
        addReadyStateCompleteListener(() => {
            if (currentTheme) {
                renderDynamicStyles();
            }
        });
    }
}

export function removeLeanTheme(): void {
    if (!currentTheme && !emitter) {
        return;
    }
    themeGeneration++;
    removeDOMReadyListener(onDOMReady);
    cleanReadyStateCompleteListeners();
    const inlineRoots = [document, ...shadowRootsObserved];
    stopWatching();
    document.dispatchEvent(new CustomEvent('__nyx__cleanUp'));
    document.querySelector('.nyx.nyx--fallback')?.remove();

    styleManagers.forEach((manager) => manager.destroy());
    styleManagers.clear();
    adoptedSheetManagers.clear();
    loadingCount = 0;
    cleanLeanLoadingLinks();

    if (emitter) {
        emitter.destroy();
        emitter = null;
    }

    for (const root of inlineRoots) {
        forEach(root.querySelectorAll(LEAN_INLINE_OVERRIDE_SELECTOR), (el) => {
            if (el instanceof HTMLElement || el instanceof SVGElement) {
                clearLeanInlineOverrides(el);
            }
        });
    }

    leanVariablesStore.clear();
    releaseVariablesSheet();
    clearColorPalette();
    clearColorModificationCache();
    clearColorCache();

    currentTheme = null;
    currentFixes = null;
    ignoredImageSelectors = [];
    ignoredInlineSelectors = [];
}

export function serializeLeanCSS(): string {
    return emitter ? emitter.serializeLeanCSS() : '';
}
