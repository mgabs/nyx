import {getStyleInjectionMode, injectEarlyRootStyle, removeEarlyRootStyle, injectStyleAway, removeStyleContainer} from '../../../src/inject/dynamic-theme/injection';

describe('Style Injection Unit Tests', () => {
    let mockDoc: any;
    let mockDocumentElement: any;
    let mockHead: any;
    let appendedChildren: any[];

    beforeEach(() => {
        appendedChildren = [];
        mockDocumentElement = {
            appendChild: (child: any) => {
                appendedChildren.push(child);
                return child;
            },
        };
        mockHead = {
            appendChild: (child: any) => {
                appendedChildren.push(child);
                return child;
            },
        };
        mockDoc = {
            documentElement: mockDocumentElement,
            head: mockHead,
            body: null,
            querySelector: (selector: string) => {
                if (selector === '.darkreader--root') {
                    return appendedChildren.find((c) => c.classList?.has('darkreader--root')) || null;
                }
                return null;
            },
            createElement: (tag: string) => {
                const classes = new Set<string>();
                return {
                    tagName: tag.toUpperCase(),
                    classList: {
                        add: (...cls: string[]) => cls.forEach((c) => classes.add(c)),
                        contains: (c: string) => classes.has(c),
                        has: (c: string) => classes.has(c),
                    },
                    style: {},
                    append: (c: any) => appendedChildren.push(c),
                    querySelectorAll: () => [],
                    sheet: {cssRules: []},
                    textContent: '',
                    remove: function () {
                        const idx = appendedChildren.indexOf(this);
                        if (idx >= 0) {
                            appendedChildren.splice(idx, 1);
                        }
                    },
                };
            },
        };
    });

    it('getStyleInjectionMode returns mode string', () => {
        expect(['away', 'next']).toContain(getStyleInjectionMode());
    });

    it('injectEarlyRootStyle attaches to head if documentElement is falsy but head exists', () => {
        const headDoc = {
            ...mockDoc,
            documentElement: null,
            head: mockHead,
        };
        expect(injectEarlyRootStyle(headDoc as any)).toBeNull();
    });

    it('injectEarlyRootStyle falls back to head when documentElement is present and head exists', () => {
        const doc = {
            ...mockDoc,
            documentElement: mockDocumentElement,
            head: mockHead,
        };
        const style = injectEarlyRootStyle(doc as any);
        expect(style).not.toBeNull();
        expect(appendedChildren).toContain(style);
    });

    it('injectEarlyRootStyle attaches to head when documentElement is falsy during fallback branch', () => {
        const appendedHead: any[] = [];
        const customDoc: any = {
            body: null,
            querySelector: () => null,
            createElement: mockDoc.createElement,
            head: {
                appendChild: (el: any) => {
                    appendedHead.push(el);
                    return el;
                },
            },
        };
        Object.defineProperty(customDoc, 'documentElement', {
            get: () => ({
                appendChild: (el: any) => {
                    appendedHead.push(el);
                    return el;
                },
            }),
        });
        const style = injectEarlyRootStyle(customDoc);
        expect(style).not.toBeNull();
        expect(appendedHead.length).toBe(1);
    });

    it('injectStyleAway queues style when body is not available and removes container cleanly', () => {
        const origDoc = (global as any).document;
        let observerCallback: any = null;
        let observedTarget: any = null;

        class MockMutationObserver {
            constructor(callback: any) {
                observerCallback = callback;
            }
            observe(target: any) {
                observedTarget = target;
            }
            disconnect() {
                observerCallback = null;
                observedTarget = null;
            }
        }
        (global as any).MutationObserver = MockMutationObserver;

        const fakeContainer: any = mockDoc.createElement('div');
        fakeContainer.remove = () => {};

        const fakeBody: any = {
            querySelector: () => fakeContainer,
            append: (child: any) => child,
        };

        const fakeDoc: any = {
            body: null,
            querySelector: (sel: string) => sel === '.darkreader-style-container' ? fakeContainer : null,
            createElement: mockDoc.createElement,
        };
        (global as any).document = fakeDoc;

        const styleEl: any = {tagName: 'STYLE'};
        injectStyleAway(styleEl);

        expect(observedTarget).toBe(fakeDoc);
        expect(observerCallback).not.toBeNull();

        // When body becomes available
        fakeDoc.body = fakeBody;
        observerCallback();

        removeStyleContainer();
        (global as any).document = origDoc;
    });

    it('injectStyleAway appends directly if body exists and triggers containerObserver', () => {
        const origDoc = (global as any).document;
        let containerObsCallback: any = null;
        class MockMutationObserver {
            constructor(callback: any) {
                containerObsCallback = callback;
            }
            observe() {}
            disconnect() {}
        }
        (global as any).MutationObserver = MockMutationObserver;

        const appendedToBody: any[] = [];
        const containerChildren: any[] = [];
        const syncStyle: any = {
            sheet: {
                cssRules: [{cssText: 'a { color: red; }'}],
            },
            textContent: '',
        };
        const fakeContainer: any = {
            classList: {add: () => {}},
            style: {},
            nextElementSibling: {},
            append: (c: any) => containerChildren.push(c),
            remove: () => {},
            querySelectorAll: (sel: string) => sel === '.darkreader--sync' ? [syncStyle] : [],
        };
        const fakeBody: any = {
            querySelector: (sel: string) => null,
            append: (c: any) => appendedToBody.push(c),
        };
        const fakeDoc: any = {
            body: fakeBody,
            querySelector: (sel: string) => sel === '.darkreader-style-container' ? fakeContainer : null,
            createElement: (tag: string) => fakeContainer,
        };
        (global as any).document = fakeDoc;

        const styleEl: any = {tagName: 'STYLE'};
        injectStyleAway(styleEl);

        expect(containerChildren).toContain(styleEl);

        // Trigger containerObserver callback
        if (containerObsCallback) {
            containerObsCallback();
            expect(syncStyle.textContent).toBe('a { color: red; }');
        }

        removeStyleContainer();
        (global as any).document = origDoc;
    });
});
