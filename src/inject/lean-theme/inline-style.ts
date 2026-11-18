import type {Theme} from '../../definitions';
import {forEach} from '../../utils/array';
import {isShadowDomSupported} from '../../utils/platform';
import {iterateShadowHosts} from '../utils/dom';
import {logWarn} from '../utils/log';

import {iterateCSSDeclarations} from '../dynamic-theme/css-rules';
import {getModifiableCSSDeclaration} from '../dynamic-theme/modify-css';
import type {VariablesStore} from '../dynamic-theme/variables';

interface OverrideEntry {
    customProp: string;
    cssProp: string;
    dataAttr: string;
}

const overrides: Record<string, OverrideEntry> = {
    'background-color': {
        customProp: '--nyx-inline-bgcolor',
        cssProp: 'background-color',
        dataAttr: 'data-nyx-inline-bgcolor',
    },
    'background-image': {
        customProp: '--nyx-inline-bgimage',
        cssProp: 'background-image',
        dataAttr: 'data-nyx-inline-bgimage',
    },
    'border-color': {
        customProp: '--nyx-inline-border',
        cssProp: 'border-color',
        dataAttr: 'data-nyx-inline-border',
    },
    'border-bottom-color': {
        customProp: '--nyx-inline-border-bottom',
        cssProp: 'border-bottom-color',
        dataAttr: 'data-nyx-inline-border-bottom',
    },
    'border-left-color': {
        customProp: '--nyx-inline-border-left',
        cssProp: 'border-left-color',
        dataAttr: 'data-nyx-inline-border-left',
    },
    'border-right-color': {
        customProp: '--nyx-inline-border-right',
        cssProp: 'border-right-color',
        dataAttr: 'data-nyx-inline-border-right',
    },
    'border-top-color': {
        customProp: '--nyx-inline-border-top',
        cssProp: 'border-top-color',
        dataAttr: 'data-nyx-inline-border-top',
    },
    'box-shadow': {
        customProp: '--nyx-inline-boxshadow',
        cssProp: 'box-shadow',
        dataAttr: 'data-nyx-inline-boxshadow',
    },
    'color': {
        customProp: '--nyx-inline-color',
        cssProp: 'color',
        dataAttr: 'data-nyx-inline-color',
    },
    'fill': {
        customProp: '--nyx-inline-fill',
        cssProp: 'fill',
        dataAttr: 'data-nyx-inline-fill',
    },
    'stroke': {
        customProp: '--nyx-inline-stroke',
        cssProp: 'stroke',
        dataAttr: 'data-nyx-inline-stroke',
    },
    'outline-color': {
        customProp: '--nyx-inline-outline',
        cssProp: 'outline-color',
        dataAttr: 'data-nyx-inline-outline',
    },
    'stop-color': {
        customProp: '--nyx-inline-stopcolor',
        cssProp: 'stop-color',
        dataAttr: 'data-nyx-inline-stopcolor',
    },
};

export const LEAN_INLINE_STYLE_SELECTOR = '[style]';

const overrideEntries = Object.values(overrides);
export const LEAN_INLINE_OVERRIDE_SELECTOR = overrideEntries.map(({dataAttr}) => `[${dataAttr}]`).join(', ');

export function getLeanInlineOverrideStyle(): string {
    return overrideEntries.map(({customProp, cssProp, dataAttr}) => {
        return `[${dataAttr}] {\n  ${cssProp}: var(${customProp}) !important;\n}`;
    }).join('\n');
}

function getInlineStyleElements(root: Node): Array<HTMLElement | SVGElement> {
    const results: Array<HTMLElement | SVGElement> = [];
    if ((root instanceof HTMLElement || root instanceof SVGElement) && root.hasAttribute('style')) {
        results.push(root);
    }
    if (root instanceof Element || root === document || (isShadowDomSupported && root instanceof ShadowRoot)) {
        forEach((root as ParentNode).querySelectorAll(LEAN_INLINE_STYLE_SELECTOR), (el) => {
            if (el instanceof HTMLElement || el instanceof SVGElement) {
                results.push(el);
            }
        });
        iterateShadowHosts(root, (host) => {
            if (host.shadowRoot) {
                results.push(...getInlineStyleElements(host.shadowRoot));
            }
        });
    }
    return results;
}

export function overrideLeanInlineStyle(
    element: HTMLElement | SVGElement,
    theme: Theme,
    variablesStore: VariablesStore,
    ignoreInlineSelectors: string[],
    ignoreImageSelectors: string[],
): void {
    if (!element.style || element.style.length === 0) {
        clearLeanInlineOverrides(element);
        return;
    }

    for (const selector of ignoreInlineSelectors) {
        try {
            if (element.matches(selector)) {
                clearLeanInlineOverrides(element);
                return;
            }
        } catch {
            // Ignore invalid selector
        }
    }

    const fakeRule = {
        selectorText: '',
        style: element.style,
        parentStyleSheet: null,
        parentRule: null,
    } as unknown as CSSStyleRule;

    const appliedProps = new Set<string>();

    iterateCSSDeclarations(element.style, (property, value) => {
        if (property === 'background' && value.includes('gradient')) {
            property = 'background-image';
        }
        const entry = overrides[property];
        if (!entry) {
            return;
        }
        try {
            const mod = getModifiableCSSDeclaration(
                property,
                value,
                fakeRule,
                variablesStore,
                ignoreImageSelectors,
                () => false,
                null,
            );
            if (!mod) {
                return;
            }
            let modifiedValue: string | null = null;
            if (typeof mod.value === 'function') {
                const res = mod.value(theme);
                if (typeof res === 'string') {
                    modifiedValue = res;
                } else if (res && typeof res === 'object' && 'declarations' in res) {
                    const first = res.declarations[0];
                    if (first && typeof first.value === 'string') {
                        modifiedValue = first.value;
                    }
                }
            } else {
                modifiedValue = mod.value;
            }
            if (modifiedValue != null) {
                element.style.setProperty(entry.customProp, modifiedValue);
                element.setAttribute(entry.dataAttr, '');
                appliedProps.add(entry.dataAttr);
            }
        } catch (err) {
            logWarn('Lean inline style override error', err);
        }
    });

    for (const entry of overrideEntries) {
        if (!appliedProps.has(entry.dataAttr) && element.hasAttribute(entry.dataAttr)) {
            element.removeAttribute(entry.dataAttr);
            element.style.removeProperty(entry.customProp);
        }
    }
}

export function clearLeanInlineOverrides(element: HTMLElement | SVGElement): void {
    for (const entry of overrideEntries) {
        if (element.hasAttribute(entry.dataAttr)) {
            element.removeAttribute(entry.dataAttr);
            element.style?.removeProperty(entry.customProp);
        }
    }
}

export function applyLeanInlineStyles(
    root: Document | ShadowRoot,
    theme: Theme,
    variablesStore: VariablesStore,
    ignoreInlineSelectors: string[],
    ignoreImageSelectors: string[],
): void {
    const elements = getInlineStyleElements(root);
    for (const el of elements) {
        overrideLeanInlineStyle(el, theme, variablesStore, ignoreInlineSelectors, ignoreImageSelectors);
    }
}
