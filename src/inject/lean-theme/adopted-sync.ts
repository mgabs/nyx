import type {createStyleSheetModifier} from '../dynamic-theme/stylesheet-modifier';

type StyleSheetModifier = ReturnType<typeof createStyleSheetModifier>;
import type {AdoptedEmitter} from './adopted-emitter';
import {getRemovedAdoptedSheets, getUntrackedAdoptedSheets} from './adopted-reconciliation';

export interface AdoptedSheetEntry {
    root: Document | ShadowRoot;
    outSheet: CSSStyleSheet | null;
    modifier: StyleSheetModifier;
    signature: string;
}

export function syncAdoptedSheets(root: Document | ShadowRoot, options: {
    emitter: AdoptedEmitter;
    getSheets: (root: Document | ShadowRoot) => CSSStyleSheet[];
    managersByRoot: Map<Document | ShadowRoot, Map<CSSStyleSheet, AdoptedSheetEntry>>;
    addRules: (rules: CSSRuleList) => void;
    createModifier: () => StyleSheetModifier;
}): CSSStyleSheet[] {
    const {emitter, getSheets, managersByRoot, addRules, createModifier} = options;
    const newlyTracked: CSSStyleSheet[] = [];
    let sheets: CSSStyleSheet[];
    try {
        sheets = getSheets(root);
    } catch {
        return newlyTracked;
    }
    let managers = managersByRoot.get(root);
    if (!managers) {
        managers = new Map();
        managersByRoot.set(root, managers);
    }
    for (const sheet of getRemovedAdoptedSheets(sheets, managers.keys())) {
        const entry = managers.get(sheet)!;
        if (entry.outSheet) {
            emitter.removeDynamicSheet(root, entry.outSheet);
        }
        managers.delete(sheet);
    }
    for (const sheet of getUntrackedAdoptedSheets([...sheets], managers, emitter.ownsSheet)) {
        try {
            if (sheet.cssRules && sheet.cssRules.length > 0) {
                addRules(sheet.cssRules);
            }
        } catch {
            continue;
        }
        const anchor = emitter.getNamedSheet(root, 'override');
        const sourceIndex = sheets.indexOf(sheet);
        const anchorIndex = anchor ? sheets.indexOf(anchor) : -1;
        if (anchorIndex >= 0 && sourceIndex > anchorIndex) {
            sheets.splice(sourceIndex, 1);
            sheets.splice(anchorIndex, 0, sheet);
        }
        const modifier = createModifier();
        managers.set(sheet, {root, outSheet: null, modifier, signature: Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n')});
        newlyTracked.push(sheet);
    }
    return newlyTracked;
}
