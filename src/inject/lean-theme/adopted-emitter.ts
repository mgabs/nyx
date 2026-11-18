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
    position?: 'beginning' | 'ending',
    beforeSheets?: CSSStyleSheet[],
): void {
    const findAnchorIndex = (sheets: CSSStyleSheet[]): number => {
        if (!beforeSheets) {
            return -1;
        }
        let earliest = -1;
        for (const anchor of beforeSheets) {
            const idx = sheets.indexOf(anchor);
            if (idx !== -1 && (earliest === -1 || idx < earliest)) {
                earliest = idx;
            }
        }
        return earliest;
    };

    if (isFirefox) {
        const sheets = getAdoptedSheets(node);
        if (!sheets.includes(sheet)) {
            const anchorIndex = findAnchorIndex(sheets);
            if (anchorIndex !== -1) {
                sheets.splice(anchorIndex, 0, sheet);
            } else if (position === 'beginning') {
                sheets.unshift(sheet);
            } else {
                sheets.push(sheet);
            }
        }
        return;
    }
    const current = node.adoptedStyleSheets;
    if (!current.includes(sheet)) {
        const anchorIndex = findAnchorIndex(current);
        if (anchorIndex !== -1) {
            const next = [...current];
            next.splice(anchorIndex, 0, sheet);
            node.adoptedStyleSheets = next;
        } else {
            node.adoptedStyleSheets = position === 'beginning'
                ? [sheet, ...current]
                : [...current, sheet];
        }
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
    ownsSheet(sheet: CSSStyleSheet): boolean;
    serializeLeanCSS(): string;
    destroy(): void;
}

export function createAdoptedEmitter(): AdoptedEmitter {
    const namedSheets = new Map<Document | ShadowRoot, Map<string, CSSStyleSheet>>();
    const dynamicSheets = new Map<Document | ShadowRoot, Set<CSSStyleSheet>>();
    const trackedRoots = new Set<Document | ShadowRoot>();
    const ownedSheets = new WeakSet<CSSStyleSheet>();

    function trackRoot(root: Document | ShadowRoot) {
        trackedRoots.add(root);
    }

    function setNamedSheet(
        root: Document | ShadowRoot,
        id: string,
        cssText: string,
        position?: 'beginning' | 'ending',
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
            ownedSheets.add(sheet);
            rootNamed.set(id, sheet);
            const anchors: CSSStyleSheet[] = [];
            if (id === 'override') {
                const inlineSheet = rootNamed.get('inline');
                if (inlineSheet) {
                    anchors.push(inlineSheet);
                }
            }
            attachAdoptedSheet(root, sheet, position, anchors);
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
        ownedSheets.add(sheet);
        let rootDynamic = dynamicSheets.get(root);
        if (!rootDynamic) {
            rootDynamic = new Set();
            dynamicSheets.set(root, rootDynamic);
        }
        rootDynamic.add(sheet);
        const rootNamed = namedSheets.get(root);
        const anchors = [rootNamed?.get('override'), rootNamed?.get('inline')].filter(Boolean) as CSSStyleSheet[];
        attachAdoptedSheet(root, sheet, undefined, anchors);
        return sheet;
    }

    function ownsSheet(sheet: CSSStyleSheet): boolean {
        return ownedSheets.has(sheet);
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
        for (const sheet of getAdoptedSheets(document)) {
            if (!ownedSheets.has(sheet)) {
                continue;
            }
            const text = serializeSheet(sheet);
            if (text) {
                chunks.push(text);
            }
        }
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
        ownsSheet,
        serializeLeanCSS,
        destroy,
    };
}
