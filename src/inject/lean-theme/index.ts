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
import {createSharedRuleCache} from '../dynamic-theme/stylesheet-modifier';
import {VariablesStore} from '../dynamic-theme/variables';

import {createAdoptedEmitter} from './adopted-emitter';
import type {AdoptedEmitter} from './adopted-emitter';
import {
    applyLeanInlineStyles,
    clearLeanInlineOverrides,
    getLeanInlineOverrideStyle,
    overrideLeanInlineStyle,
} from './inline-style';
import {cleanLeanLoadingLinks, manageLeanStyle} from './style-manager';
import type {LeanStyleManager} from './style-manager';

const leanVariablesStore = new VariablesStore({imageURLModifier: null});
const sharedRuleCache = createSharedRuleCache(4000);

let emitter: AdoptedEmitter | null = null;
const styleManagers = new Map<StyleElement, LeanStyleManager>();
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
const pendingInlineElements = new Set<HTMLElement>();
const pendingShadowHosts = new Set<Element>();
let pendingVariablesMatch = false;
let pendingRootVars = false;
let microtaskScheduled = false;
let rafId: number | null = null;
let loadingCount = 0;

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
    activeEmitter.setNamedSheet(document, 'inline', getLeanInlineOverrideStyle(), 'beginning');

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
}

function createShadowStaticStyleOverrides(root: ShadowRoot): void {
    if (!currentTheme) {
        return;
    }
    const activeEmitter = ensureEmitter();
    activeEmitter.setNamedSheet(root, 'inline', getLeanInlineOverrideStyle(), 'beginning');
    activeEmitter.setNamedSheet(root, 'invert', getInversionStyleValue(currentTheme, currentFixes), 'beginning');
    const overrideCSS = currentFixes?.css ? replaceCSSTemplates(currentFixes.css, currentTheme) : '';
    activeEmitter.setNamedSheet(root, 'override', overrideCSS, 'ending');
}

function createManager(element: StyleElement, root: Document | ShadowRoot): LeanStyleManager {
    const activeEmitter = ensureEmitter();
    const manager = manageLeanStyle(element, {
        root,
        emitter: activeEmitter,
        sharedCache: sharedRuleCache,
        variablesStore: leanVariablesStore,
        update: () => scheduleCoalescedFlush(),
        loadingStart: () => {
            loadingCount++;
        },
        loadingEnd: () => {
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

    if (pendingVariablesMatch) {
        pendingVariablesMatch = false;
        leanVariablesStore.matchVariablesAndDependents();
        pendingRootVars = true;
    }

    if (pendingRootVars) {
        pendingRootVars = false;
        updateRootVars();
    }

    for (const manager of newlyAddedManagers) {
        manager.render(currentTheme, ignoredImageSelectors);
        manager.watch();
    }

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
            if (mutation.target instanceof HTMLElement) {
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
                    if (node.hasAttribute('style')) {
                        pendingInlineElements.add(node as HTMLElement);
                        hasRelevantMutation = true;
                    }
                    forEach(node.querySelectorAll('[style]'), (el) => {
                        pendingInlineElements.add(el as HTMLElement);
                        hasRelevantMutation = true;
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
    for (const style of styles) {
        if (!styleManagers.has(style)) {
            const manager = createManager(style, shadowRoot);
            const detail = manager.details({secondRound: false});
            if (detail && detail.rules.length > 0) {
                leanVariablesStore.addRulesForMatching(detail.rules);
                pendingVariablesMatch = true;
            }
            if (currentTheme) {
                manager.render(currentTheme, ignoredImageSelectors);
                manager.watch();
            }
        }
    }

    if (currentTheme) {
        applyLeanInlineStyles(shadowRoot, currentTheme, leanVariablesStore, ignoredInlineSelectors, ignoredImageSelectors);
    }

    const observer = new MutationObserver((mutations) => collectMutationsFromRoot(mutations));
    observer.observe(shadowRoot, {childList: true, subtree: true, attributes: true, attributeFilter: ['style']});
    shadowObservers.set(shadowRoot, observer);
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
}

function stopWatching(): void {
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

    clearColorModificationCache();
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
    removeDOMReadyListener(onDOMReady);
    cleanReadyStateCompleteListeners();
    stopWatching();

    styleManagers.forEach((manager) => manager.destroy());
    styleManagers.clear();
    cleanLeanLoadingLinks();

    if (emitter) {
        emitter.destroy();
        emitter = null;
    }

    forEach(document.querySelectorAll('[data-nyx-inline-bgcolor], [data-nyx-inline-color], [data-nyx-inline-border], [data-nyx-inline-bgimage], [data-nyx-inline-boxshadow]'), (el) => {
        if (el instanceof HTMLElement) {
            clearLeanInlineOverrides(el);
        }
    });

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
