import type {AdoptedSheetEntry} from './adopted-sync';

export function watchAdoptedRoot(root: Document | ShadowRoot, options: {
    pendingRoots: Set<Document | ShadowRoot>;
    isActive: () => boolean;
    sync: (root: Document | ShadowRoot) => CSSStyleSheet[];
    render: (root: Document | ShadowRoot, sheet: CSSStyleSheet) => void;
    getManagers: (root: Document | ShadowRoot) => Map<CSSStyleSheet, AdoptedSheetEntry> | undefined;
    addRules: (rules: CSSRuleList) => void;
    reorder: (root: Document | ShadowRoot) => void;
    needsFlush: () => boolean;
    scheduleFlush: () => void;
    addCleanup: (cleanup: () => void) => void;
}): void {
    const {pendingRoots, isActive, sync, render, getManagers, addRules, reorder, needsFlush, scheduleFlush, addCleanup} = options;
    const onChange = () => {
        if (pendingRoots.has(root)) {
            return;
        }
        pendingRoots.add(root);
        queueMicrotask(() => {
            if (!pendingRoots.delete(root) || !isActive()) {
                return;
            }
            const added = sync(root);
            for (const sheet of added) {
                render(root, sheet);
            }
            getManagers(root)?.forEach((entry, sheet) => {
                try {
                    const signature = Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n');
                    if (signature !== entry.signature) {
                        entry.signature = signature;
                        addRules(sheet.cssRules);
                        render(root, sheet);
                    }
                } catch {
                    // Inaccessible page stylesheet.
                }
            });
            reorder(root);
            if (needsFlush()) {
                scheduleFlush();
            }
        });
    };
    const events = ['__nyx__adoptedStyleSheetsChange', '__nyx__adoptedStyleSheetChange', '__nyx__adoptedStyleDeclarationChange'];
    events.forEach((type) => root.addEventListener(type, onChange));
    addCleanup(() => events.forEach((type) => root.removeEventListener(type, onChange)));
    root.dispatchEvent(new CustomEvent('__nyx__registerAdoptedRoot', {bubbles: true, composed: true}));
}
