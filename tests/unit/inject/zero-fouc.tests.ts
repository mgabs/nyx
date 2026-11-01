import {injectEarlyRootStyle, removeEarlyRootStyle} from '../../../src/inject/dynamic-theme/injection';

describe('Zero-FOUC Instant Paint (REQ-FOUC-1, NFR-FOUC-1)', () => {
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

    it('injectEarlyRootStyle synchronously attaches root dark style to documentElement before body exists', () => {
        expect(mockDoc.body).toBeNull();
        const style = injectEarlyRootStyle(mockDoc);

        expect(style).not.toBeNull();
        expect(style!.classList.contains('darkreader')).toBe(true);
        expect(style!.classList.contains('darkreader--root')).toBe(true);
        expect(style!.textContent).toBe('html, body { background: #181a1b !important; color: #e8e6e3 !important; }');
        expect(appendedChildren).toContain(style);
    });

    it('injectEarlyRootStyle is idempotent and returns existing root style element', () => {
        const first = injectEarlyRootStyle(mockDoc);
        const second = injectEarlyRootStyle(mockDoc);

        expect(first).toBe(second);
        expect(appendedChildren.length).toBe(1);
    });

    it('injectEarlyRootStyle returns null if documentElement is missing', () => {
        const docWithoutDocElem = {...mockDoc, documentElement: null};
        const style = injectEarlyRootStyle(docWithoutDocElem as any);
        expect(style).toBeNull();
    });

    it('injectEarlyRootStyle returns null if doc is falsy', () => {
        expect(injectEarlyRootStyle(null as any)).toBeNull();
    });

    it('removeEarlyRootStyle removes .darkreader--root style', () => {
        const style = injectEarlyRootStyle(mockDoc);
        expect(mockDoc.querySelector('.darkreader--root')).toBe(style);

        let removed = false;
        style!.remove = () => {
            removed = true;
            const idx = appendedChildren.indexOf(style);
            if (idx >= 0) {
                appendedChildren.splice(idx, 1);
            }
        };

        removeEarlyRootStyle(mockDoc);
        expect(removed).toBe(true);
    });

    it('removeEarlyRootStyle handles missing doc safely', () => {
        expect(() => removeEarlyRootStyle(null as any)).not.toThrow();
    });

    it('removeEarlyRootStyle handles non-existing root style gracefully', () => {
        const docWithoutRoot = {
            ...mockDoc,
            querySelector: () => null,
        };
        expect(() => removeEarlyRootStyle(docWithoutRoot as any)).not.toThrow();
    });
});
