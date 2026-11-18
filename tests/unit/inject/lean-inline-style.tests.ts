import type {Theme} from '../../../src/definitions';
import type {VariablesStore} from '../../../src/inject/dynamic-theme/variables';

jest.mock('../../../src/utils/platform', () => ({isShadowDomSupported: true}));
jest.mock('../../../src/inject/utils/dom', () => ({
    iterateShadowHosts: (root: {shadowHosts?: unknown[]}, callback: (host: unknown) => void) => root.shadowHosts?.forEach(callback),
}));
jest.mock('../../../src/inject/utils/log', () => ({logWarn: jest.fn()}));
jest.mock('../../../src/inject/dynamic-theme/css-rules', () => ({
    iterateCSSDeclarations: (style: {declarations: Map<string, string>}, callback: (property: string, value: string) => void) => {
        for (const [property, value] of style.declarations) {
            callback(property, value);
        }
    },
}));
jest.mock('../../../src/inject/dynamic-theme/modify-css', () => ({getModifiableCSSDeclaration: jest.fn()}));

import {logWarn} from '../../../src/inject/utils/log';
import {getModifiableCSSDeclaration} from '../../../src/inject/dynamic-theme/modify-css';
import {
    applyLeanInlineStyles,
    clearLeanInlineOverrides,
    getLeanInlineOverrideStyle,
    LEAN_INLINE_OVERRIDE_SELECTOR,
    overrideLeanInlineStyle,
} from '../../../src/inject/lean-theme/inline-style';

class TestStyle {
    declarations = new Map<string, string>();
    custom = new Map<string, string>();
    get length() {
        return this.declarations.size;
    }
    setProperty(name: string, value: string) {
        this.custom.set(name, value);
    }
    removeProperty(name: string) {
        this.custom.delete(name);
    }
}

class TestElement {
    style = new TestStyle();
    attributes = new Set<string>();
    descendants: TestElement[] = [];
    shadowHosts: Array<{shadowRoot: TestShadowRoot | null}> = [];
    matches = jest.fn(() => false);
    hasAttribute(name: string) {
        return name === 'style' ? this.style.length > 0 : this.attributes.has(name);
    }
    setAttribute(name: string) {
        this.attributes.add(name);
    }
    removeAttribute(name: string) {
        this.attributes.delete(name);
    }
    querySelectorAll = jest.fn(() => this.descendants);
}
class TestHTMLElement extends TestElement {}
class TestSVGElement extends TestElement {}
class TestShadowRoot extends TestElement {}

const theme = {} as Theme;
const variables = {} as VariablesStore;

beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(globalThis, {Element: TestElement, HTMLElement: TestHTMLElement, SVGElement: TestSVGElement, ShadowRoot: TestShadowRoot});
});

function override(element: TestElement, ignored: string[] = [], ignoreImages: string[] = []) {
    overrideLeanInlineStyle(element as unknown as HTMLElement, theme, variables, ignored, ignoreImages);
}

describe('Lean inline styles', () => {
    test('generates rules and a cleanup selector for every supported override', () => {
        const css = getLeanInlineOverrideStyle();
        const entries = [
            ['bgcolor', 'background-color'], ['bgimage', 'background-image'], ['border', 'border-color'],
            ['border-bottom', 'border-bottom-color'], ['border-left', 'border-left-color'],
            ['border-right', 'border-right-color'], ['border-top', 'border-top-color'],
            ['boxshadow', 'box-shadow'], ['color', 'color'], ['fill', 'fill'], ['stroke', 'stroke'],
            ['outline', 'outline-color'], ['stopcolor', 'stop-color'],
        ];
        const selectors: string[] = [];
        for (const [suffix, property] of entries) {
            const selector = `[data-nyx-inline-${suffix}]`;
            selectors.push(selector);
            expect(css).toContain(`${selector} {\n  ${property}: var(--nyx-inline-${suffix}) !important;\n}`);
        }
        expect(LEAN_INLINE_OVERRIDE_SELECTOR).toBe(selectors.join(', '));
    });

    test('clears all marked inline properties while retaining page styles', () => {
        const element = new TestElement();
        element.style.declarations.set('color', 'red');
        element.style.custom.set('--nyx-inline-page-owned', 'keep');
        for (const suffix of ['bgcolor', 'bgimage', 'border', 'border-bottom', 'border-left', 'border-right', 'border-top', 'boxshadow', 'color', 'fill', 'stroke', 'outline', 'stopcolor']) {
            element.attributes.add(`data-nyx-inline-${suffix}`);
            element.style.custom.set(`--nyx-inline-${suffix}`, 'dark');
        }
        clearLeanInlineOverrides(element as unknown as HTMLElement);
        expect(element.attributes.size).toBe(0);
        expect(element.style.custom.size).toBe(1);
        expect(element.style.custom.get('--nyx-inline-page-owned')).toBe('keep');
        expect(element.style.declarations.get('color')).toBe('red');
    });

    test('does not remove unmarked page-owned custom properties', () => {
        const element = new TestElement();
        element.style.custom.set('--nyx-inline-color', 'page value');
        clearLeanInlineOverrides(element as unknown as HTMLElement);
        expect(element.style.custom.get('--nyx-inline-color')).toBe('page value');
    });

    test('cleans marked attributes safely when the style object is unavailable', () => {
        const element = new TestElement();
        element.attributes.add('data-nyx-inline-color');
        Object.defineProperty(element, 'style', {value: undefined});
        expect(() => override(element)).not.toThrow();
        expect(element.attributes.size).toBe(0);
    });

    test('ignores a non-gradient background shorthand', () => {
        const element = new TestElement();
        element.style.declarations.set('background', 'red');
        override(element);
        expect(getModifiableCSSDeclaration).not.toHaveBeenCalled();
        expect(element.attributes.size).toBe(0);
    });

    test('applies a modified declaration and removes an obsolete override', () => {
        const element = new TestElement();
        element.style.declarations.set('color', 'red');
        element.attributes.add('data-nyx-inline-bgcolor');
        element.style.custom.set('--nyx-inline-bgcolor', 'old');
        jest.mocked(getModifiableCSSDeclaration).mockReturnValue({value: 'dark-red'} as never);
        override(element, ['.not-ignored'], ['.ignored-image']);
        expect(element.style.custom.get('--nyx-inline-color')).toBe('dark-red');
        expect(element.hasAttribute('data-nyx-inline-color')).toBe(true);
        expect(element.hasAttribute('data-nyx-inline-bgcolor')).toBe(false);
        expect(element.style.custom.has('--nyx-inline-bgcolor')).toBe(false);
        expect(getModifiableCSSDeclaration).toHaveBeenCalledWith('color', 'red', expect.anything(), variables, ['.ignored-image'], expect.any(Function), null);
    });

    test('cleans overrides for empty and ignored inline styles', () => {
        const element = new TestElement();
        element.attributes.add('data-nyx-inline-color');
        element.style.custom.set('--nyx-inline-color', 'old');
        override(element);
        expect(element.attributes.size).toBe(0);
        element.style.declarations.set('color', 'red');
        element.attributes.add('data-nyx-inline-color');
        element.style.custom.set('--nyx-inline-color', 'old');
        element.matches.mockReturnValue(true);
        override(element, ['.ignore']);
        expect(element.attributes.size).toBe(0);
        expect(getModifiableCSSDeclaration).not.toHaveBeenCalled();
    });

    test('continues past invalid ignored selectors and unsupported properties', () => {
        const element = new TestElement();
        element.style.declarations.set('width', '1px');
        element.style.declarations.set('color', 'red');
        element.matches.mockImplementationOnce(() => {
            throw new Error('invalid selector');
        });
        jest.mocked(getModifiableCSSDeclaration).mockReturnValue({value: 'dark-red'} as never);
        override(element, ['[invalid']);
        expect(getModifiableCSSDeclaration).toHaveBeenCalledTimes(1);
        expect(element.style.custom.get('--nyx-inline-color')).toBe('dark-red');
    });

    test('handles gradients and functional declaration results', () => {
        const element = new TestElement();
        element.style.declarations.set('background', 'linear-gradient(white, black)');
        element.style.declarations.set('color', 'red');
        jest.mocked(getModifiableCSSDeclaration)
            .mockReturnValueOnce({value: () => 'dark-gradient'} as never)
            .mockReturnValueOnce({value: () => ({declarations: [{value: 'dark-red'}]})} as never);
        override(element);
        expect(getModifiableCSSDeclaration).toHaveBeenNthCalledWith(1, 'background-image', expect.any(String), expect.anything(), variables, [], expect.any(Function), null);
        expect(element.style.custom.get('--nyx-inline-bgimage')).toBe('dark-gradient');
        expect(element.style.custom.get('--nyx-inline-color')).toBe('dark-red');
    });

    test('ignores missing, asynchronous and failing modifiers', () => {
        const element = new TestElement();
        element.style.declarations.set('color', 'red');
        element.style.declarations.set('fill', 'black');
        element.style.declarations.set('stroke', 'black');
        jest.mocked(getModifiableCSSDeclaration)
            .mockReturnValueOnce(null)
            .mockReturnValueOnce({value: () => Promise.resolve('later')} as never)
            .mockImplementationOnce(() => {
                throw new Error('bad declaration');
            });
        override(element);
        expect(element.attributes.size).toBe(0);
        expect(logWarn).toHaveBeenCalledTimes(1);
        expect(logWarn).toHaveBeenCalledWith('Lean inline style override error', expect.any(Error));
    });

    test('ignores empty or non-string functional declarations', () => {
        const element = new TestElement();
        element.style.declarations.set('color', 'red');
        element.style.declarations.set('fill', 'black');
        jest.mocked(getModifiableCSSDeclaration)
            .mockReturnValueOnce({value: () => ({declarations: []})} as never)
            .mockReturnValueOnce({value: () => ({declarations: [{value: 42}]})} as never);
        override(element);
        expect(element.attributes.size).toBe(0);
        const isCancelled = jest.mocked(getModifiableCSSDeclaration).mock.calls[0][5];
        expect(isCancelled()).toBe(false);
    });

    test('applies styles to document, SVG and nested shadow roots', () => {
        const documentRoot = new TestElement();
        const html = new TestHTMLElement();
        const svg = new TestSVGElement();
        const shadow = new TestShadowRoot();
        const nested = new TestHTMLElement();
        html.style.declarations.set('color', 'red');
        svg.style.declarations.set('fill', 'black');
        nested.style.declarations.set('stroke', 'black');
        const unrelated = new TestElement();
        unrelated.style.declarations.set('color', 'red');
        documentRoot.descendants = [html, svg, unrelated];
        documentRoot.shadowHosts = [{shadowRoot: shadow}, {shadowRoot: null}];
        shadow.descendants = [nested];
        Object.assign(globalThis, {document: documentRoot});
        jest.mocked(getModifiableCSSDeclaration).mockReturnValue({value: 'dark'} as never);
        applyLeanInlineStyles(documentRoot as unknown as Document, theme, variables, [], []);
        expect(html.style.custom.get('--nyx-inline-color')).toBe('dark');
        expect(svg.style.custom.get('--nyx-inline-fill')).toBe('dark');
        expect(nested.style.custom.get('--nyx-inline-stroke')).toBe('dark');
        expect(documentRoot.querySelectorAll).toHaveBeenCalledWith('[style]');
        expect(shadow.querySelectorAll).toHaveBeenCalledWith('[style]');
        expect(getModifiableCSSDeclaration).toHaveBeenCalledTimes(3);
        expect(unrelated.style.custom.size).toBe(0);
    });
});
