import type {Theme} from '../../definitions';
import type {AdoptedEmitter} from './adopted-emitter';
import type {AdoptedSheetEntry} from './adopted-sync';

export function renderAdoptedOutput(root: Document | ShadowRoot, sheet: CSSStyleSheet, options: {
    theme: Theme | null;
    managersByRoot: Map<Document | ShadowRoot, Map<CSSStyleSheet, AdoptedSheetEntry>>;
    getEmitter: () => AdoptedEmitter;
    ignoredImageSelectors: string[];
    isActive: () => boolean;
}): void {
    const {theme, managersByRoot, getEmitter, ignoredImageSelectors, isActive} = options;
    if (!theme) {
        return;
    }
    const entry = managersByRoot.get(root)?.get(sheet);
    if (!entry) {
        return;
    }
    let rules: CSSRuleList;
    try {
        rules = sheet.cssRules;
    } catch {
        return;
    }
    const emitter = getEmitter();
    entry.modifier.modifySheet({
        sourceCSSRules: rules,
        theme,
        ignoreImageAnalysis: ignoredImageSelectors,
        force: false,
        prepareSheet: () => {
            if (!entry.outSheet) {
                entry.outSheet = emitter.createDynamicSheet(entry.root);
            } else {
                entry.outSheet.replaceSync('');
            }
            return entry.outSheet;
        },
        isAsyncCancelled: () => !isActive(),
    });
}
