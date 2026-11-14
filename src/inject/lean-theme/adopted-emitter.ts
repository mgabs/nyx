import {isFirefox} from '../../utils/platform';

declare global {
    interface Document {
        adoptedStyleSheets: CSSStyleSheet[];
    }
    interface ShadowRoot {
        adoptedStyleSheets: CSSStyleSheet[];
    }
}

export function createConstructableSheet(): CSSStyleSheet {
    if (isFirefox) {
        const pageWindow = (window as unknown as {wrappedJSObject?: typeof window}).wrappedJSObject ?? window;
        return new pageWindow.CSSStyleSheet();
    }
    return new CSSStyleSheet();
}

export function getAdoptedSheets(node: Document | ShadowRoot): CSSStyleSheet[] {
    if (isFirefox) {
        const sheets = node.adoptedStyleSheets as unknown as {wrappedJSObject?: CSSStyleSheet[]};
        return sheets.wrappedJSObject ?? node.adoptedStyleSheets;
    }
    return node.adoptedStyleSheets;
}

export function attachAdoptedSheet(
    node: Document | ShadowRoot,
    sheet: CSSStyleSheet,
    position: 'beginning' | 'ending' = 'ending',
): void {
    if (isFirefox) {
        const sheets = getAdoptedSheets(node);
        if (!sheets.includes(sheet)) {
            if (position === 'beginning') {
                sheets.unshift(sheet);
            } else {
                sheets.push(sheet);
            }
        }
        return;
    }
    const current = node.adoptedStyleSheets;
    if (!current.includes(sheet)) {
        node.adoptedStyleSheets = position === 'beginning'
            ? [sheet, ...current]
            : [...current, sheet];
    }
}

export function detachAdoptedSheets(
    node: Document | ShadowRoot,
    sheetsToRemove: Set<CSSStyleSheet>,
): void {
    if (sheetsToRemove.size === 0) {
        return;
    }
    if (isFirefox) {
        const sheets = getAdoptedSheets(node);
        for (let i = sheets.length - 1; i >= 0; i--) {
            if (sheetsToRemove.has(sheets[i])) {
                sheets.splice(i, 1);
            }
        }
        return;
    }
    const filtered = node.adoptedStyleSheets.filter((s) => !sheetsToRemove.has(s));
    if (filtered.length !== node.adoptedStyleSheets.length) {
        node.adoptedStyleSheets = filtered;
    }
}

export interface AdoptedEmitter {
    setNamedSheet(root: Document | ShadowRoot, id: string, cssText: string, position?: 'beginning' | 'ending'): CSSStyleSheet;
    getNamedSheet(root: Document | ShadowRoot, id: string): CSSStyleSheet | null;
    createDynamicSheet(root: Document | ShadowRoot): CSSStyleSheet;
    removeDynamicSheet(root: Document | ShadowRoot, sheet: CSSStyleSheet): void;
    serializeLeanCSS(): string;
    destroy(): void;
}

export function createAdoptedEmitter(): AdoptedEmitter {
    const namedSheets = new Map<Document | ShadowRoot, Map<string, CSSStyleSheet>>();
    const dynamicSheets = new Map<Document | ShadowRoot, Set<CSSStyleSheet>>();
    const trackedRoots = new Set<Document | ShadowRoot>();

    function trackRoot(root: Document | ShadowRoot) {
        trackedRoots.add(root);
    }

    function setNamedSheet(
        root: Document | ShadowRoot,
        id: string,
        cssText: string,
        position: 'beginning' | 'ending' = 'ending',
    ): CSSStyleSheet {
        trackRoot(root);
        let rootNamed = namedSheets.get(root);
        if (!rootNamed) {
            rootNamed = new Map();
            namedSheets.set(root, rootNamed);
        }
        let sheet = rootNamed.get(id);
        if (!sheet) {
            sheet = createConstructableSheet();
            rootNamed.set(id, sheet);
            attachAdoptedSheet(root, sheet, position);
        }
        sheet.replaceSync(cssText);
        return sheet;
    }

    function getNamedSheet(root: Document | ShadowRoot, id: string): CSSStyleSheet | null {
        return namedSheets.get(root)?.get(id) ?? null;
    }

    function createDynamicSheet(root: Document | ShadowRoot): CSSStyleSheet {
        trackRoot(root);
        const sheet = createConstructableSheet();
        let rootDynamic = dynamicSheets.get(root);
        if (!rootDynamic) {
            rootDynamic = new Set();
            dynamicSheets.set(root, rootDynamic);
        }
        rootDynamic.add(sheet);
        attachAdoptedSheet(root, sheet, 'ending');
        return sheet;
    }

    function removeDynamicSheet(root: Document | ShadowRoot, sheet: CSSStyleSheet): void {
        const rootDynamic = dynamicSheets.get(root);
        if (rootDynamic && rootDynamic.delete(sheet)) {
            detachAdoptedSheets(root, new Set([sheet]));
        }
    }

    function serializeSheet(sheet: CSSStyleSheet): string {
        const rules: string[] = [];
        try {
            const cssRules = sheet.cssRules;
            for (let i = 0; i < cssRules.length; i++) {
                rules.push(cssRules[i].cssText);
            }
        } catch {
            // Ignore inaccessible sheets
        }
        return rules.join('\n');
    }

    function serializeLeanCSS(): string {
        const chunks: string[] = [];
        trackedRoots.forEach((root) => {
            const rootNamed = namedSheets.get(root);
            if (rootNamed) {
                rootNamed.forEach((sheet) => {
                    const text = serializeSheet(sheet);
                    if (text) {
                        chunks.push(text);
                    }
                });
            }
            const rootDynamic = dynamicSheets.get(root);
            if (rootDynamic) {
                rootDynamic.forEach((sheet) => {
                    const text = serializeSheet(sheet);
                    if (text) {
                        chunks.push(text);
                    }
                });
            }
        });
        return chunks.join('\n');
    }

    function destroy(): void {
        trackedRoots.forEach((root) => {
            const toRemove = new Set<CSSStyleSheet>();
            namedSheets.get(root)?.forEach((sheet) => toRemove.add(sheet));
            dynamicSheets.get(root)?.forEach((sheet) => toRemove.add(sheet));
            detachAdoptedSheets(root, toRemove);
        });
        namedSheets.clear();
        dynamicSheets.clear();
        trackedRoots.clear();
    }

    return {
        setNamedSheet,
        getNamedSheet,
        createDynamicSheet,
        removeDynamicSheet,
        serializeLeanCSS,
        destroy,
    };
}
