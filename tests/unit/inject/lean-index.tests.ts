import type {Theme, DynamicThemeFix} from '../../../src/definitions';

jest.mock('../../../src/generators/css-filter', () => ({getCSSFilterValue: jest.fn()}));
jest.mock('../../../src/generators/text-style', () => ({createTextStyle: jest.fn(() => 'font override')}));
jest.mock('../../../src/utils/color', () => ({
    clearColorCache: jest.fn(),
    getSRGBLightness: jest.fn((r: number) => r / 255),
    parseColorWithCache: jest.fn((value: string) => value === 'invalid' ? null : {r: value === '#ffffff' ? 255 : 0, g: 0, b: 0}),
}));
jest.mock('../../../src/utils/platform', () => ({isShadowDomSupported: true}));
jest.mock('../../../src/inject/utils/dom', () => ({
    iterateShadowHosts: jest.fn(), isDOMReady: jest.fn(), addDOMReadyListener: jest.fn(), removeDOMReadyListener: jest.fn(),
    addReadyStateCompleteListener: jest.fn(), cleanReadyStateCompleteListeners: jest.fn(),
}));
jest.mock('../../../src/inject/utils/log', () => ({logWarn: jest.fn()}));
jest.mock('../../../src/inject/dynamic-theme/modify-colors', () => ({
    clearColorModificationCache: jest.fn(), modifyBackgroundColor: jest.fn(() => 'dark-background'), modifyForegroundColor: jest.fn(() => 'light-text'),
}));
jest.mock('../../../src/inject/dynamic-theme/modify-css', () => ({
    getModifiedUserAgentStyle: jest.fn(() => 'user-agent'), getModifiedFallbackStyle: jest.fn(() => 'fallback'),
    getSelectionColor: jest.fn(() => ({backgroundColorSelection: 'selection-bg', foregroundColorSelection: 'selection-text'})),
}));
jest.mock('../../../src/inject/dynamic-theme/palette', () => ({
    clearColorPalette: jest.fn(), registerVariablesSheet: jest.fn(), releaseVariablesSheet: jest.fn(),
}));
jest.mock('../../../src/inject/dynamic-theme/style-manager', () => ({
    getManageableStyles: jest.fn(() => []), setIgnoredCSSURLs: jest.fn(), shouldManageStyle: jest.fn(() => false),
}));
jest.mock('../../../src/inject/dynamic-theme/stylesheet-proxy', () => ({injectProxy: jest.fn()}));
jest.mock('../../../src/inject/dynamic-theme/stylesheet-modifier', () => ({
    createSharedRuleCache: jest.fn(() => ({})), createStyleSheetModifier: jest.fn(() => ({modifySheet: jest.fn(), shouldRebuildStyle: jest.fn()})),
}));
jest.mock('../../../src/inject/dynamic-theme/variables', () => ({
    VariablesStore: jest.fn().mockImplementation(() => ({
        getRootVarsText: jest.fn(() => 'root vars'), addRulesForMatching: jest.fn(), matchVariablesAndDependents: jest.fn(),
        setOnRootVariableChange: jest.fn(), clear: jest.fn(),
    })),
}));
jest.mock('../../../src/inject/lean-theme/adopted-emitter', () => ({createAdoptedEmitter: jest.fn(), getAdoptedSheets: jest.fn(() => [])}));
jest.mock('../../../src/inject/lean-theme/adopted-sync', () => ({syncAdoptedSheets: jest.fn(() => [])}));
jest.mock('../../../src/inject/lean-theme/adopted-render', () => ({renderAdoptedOutput: jest.fn()}));
jest.mock('../../../src/inject/lean-theme/adopted-reorder', () => ({reorderAdoptedOutputs: jest.fn()}));
jest.mock('../../../src/inject/lean-theme/adopted-watch', () => ({watchAdoptedRoot: jest.fn()}));
jest.mock('../../../src/inject/lean-theme/inline-style', () => ({
    applyLeanInlineStyles: jest.fn(), clearLeanInlineOverrides: jest.fn(), getLeanInlineOverrideStyle: jest.fn(() => 'inline'),
    LEAN_INLINE_OVERRIDE_SELECTOR: '[data-nyx]', overrideLeanInlineStyle: jest.fn(),
}));
jest.mock('../../../src/inject/lean-theme/style-manager', () => ({cleanLeanLoadingLinks: jest.fn(), manageLeanStyle: jest.fn()}));

import {getCSSFilterValue} from '../../../src/generators/css-filter';
import {isDOMReady, addDOMReadyListener, addReadyStateCompleteListener, iterateShadowHosts} from '../../../src/inject/utils/dom';
import {logWarn} from '../../../src/inject/utils/log';
import {getManageableStyles, shouldManageStyle} from '../../../src/inject/dynamic-theme/style-manager';
import {createAdoptedEmitter} from '../../../src/inject/lean-theme/adopted-emitter';
import {syncAdoptedSheets} from '../../../src/inject/lean-theme/adopted-sync';
import {watchAdoptedRoot} from '../../../src/inject/lean-theme/adopted-watch';
import {applyLeanInlineStyles, overrideLeanInlineStyle, clearLeanInlineOverrides} from '../../../src/inject/lean-theme/inline-style';
import {manageLeanStyle} from '../../../src/inject/lean-theme/style-manager';
import {createOrUpdateLeanTheme, removeLeanTheme, serializeLeanCSS} from '../../../src/inject/lean-theme';

class TestElement extends EventTarget {
    isConnected = true;
    shadowRoot: TestShadowRoot | null = null;
    inline = false;
    nested: TestElement[] = [];
    parentRoot: unknown = null;
    append = jest.fn();
    remove = jest.fn();
    getRootNode() {
        return this.parentRoot;
    }
    hasAttribute(name: string) {
        return name === 'style' && this.inline;
    }
    querySelectorAll() {
        return this.nested;
    }
    contains(element: TestElement) {
        return this.nested.includes(element);
    }
}
class TestHTMLElement extends TestElement {}
class TestSVGElement extends TestElement {}
class TestShadowRoot extends EventTarget {
    querySelectorAll = jest.fn(() => []);
}
class TestDocument extends EventTarget {
    documentElement = new TestHTMLElement();
    head = new TestHTMLElement();
    fallback: TestElement | null = null;
    createElement = jest.fn(() => new TestHTMLElement());
    querySelector = jest.fn(() => this.fallback);
    querySelectorAll = jest.fn(() => []);
}
class TestObserver {
    static instances: TestObserver[] = [];
    observe = jest.fn();
    disconnect = jest.fn();
    constructor(public callback: (records: MutationRecord[]) => void) {
        TestObserver.instances.push(this);
    }
}

const theme = {
    mode: 1, brightness: 100, contrast: 100, grayscale: 0, sepia: 0,
    useFont: false, textStroke: 0, selectionColor: '', styleSystemControls: false,
} as Theme;
const fixes = (extra: Partial<DynamicThemeFix> = {}): DynamicThemeFix => ({
    url: ['*'], invert: [], css: '', ignoreInlineStyle: [], ignoreImageAnalysis: [], ignoreCSSUrl: [],
    disableStyleSheetsProxy: false, disableCustomElementRegistryProxy: false, ...extra,
});
let doc: TestDocument;
let emitter: {setNamedSheet: jest.Mock; getNamedSheet: jest.Mock; destroy: jest.Mock; serializeLeanCSS: jest.Mock};
let frame: (() => void) | null;

beforeEach(() => {
    jest.clearAllMocks();
    TestObserver.instances = [];
    frame = null;
    doc = new TestDocument();
    emitter = {setNamedSheet: jest.fn(() => ({})), getNamedSheet: jest.fn(() => null), destroy: jest.fn(), serializeLeanCSS: jest.fn(() => 'exported')};
    jest.mocked(createAdoptedEmitter).mockReturnValue(emitter as never);
    jest.mocked(isDOMReady).mockReturnValue(true);
    jest.mocked(getManageableStyles).mockReturnValue([]);
    jest.mocked(shouldManageStyle).mockReturnValue(false);
    jest.mocked(syncAdoptedSheets).mockReturnValue([]);
    jest.mocked(watchAdoptedRoot).mockImplementation((_root, options) => options.addCleanup(jest.fn()));
    Object.assign(globalThis, {
        document: doc, Element: TestElement, HTMLElement: TestHTMLElement, SVGElement: TestSVGElement, ShadowRoot: TestShadowRoot,
        MutationObserver: TestObserver,
        requestAnimationFrame: (callback: () => void) => {
            frame = callback; return 1;
        },
        cancelAnimationFrame: jest.fn(),
        __CHROMIUM_MV3__: false,
    });
});

afterEach(() => {
    removeLeanTheme();
});

async function flushFrame() {
    await Promise.resolve();
    const callback = frame as (() => void) | null;
    frame = null;
    callback?.();
}

describe('Lean injector lifecycle', () => {
    test('applies theme settings and cleans up owned state', () => {
        jest.mocked(getCSSFilterValue).mockReturnValue('invert(100%)');
        createOrUpdateLeanTheme({...theme, useFont: true, selectionColor: 'auto'}, fixes({invert: ['.logo'], css: '.x { color: ${invalid}; }'}), false);
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'text', 'font override', 'beginning');
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'invert', expect.stringContaining('.logo'), 'beginning');
        expect(logWarn).toHaveBeenCalled();
        expect(serializeLeanCSS()).toBe('exported');
        expect(applyLeanInlineStyles).toHaveBeenCalled();
        removeLeanTheme();
        expect(emitter.destroy).toHaveBeenCalledTimes(1);
        expect(serializeLeanCSS()).toBe('');
    });

    test('defers initial rendering until ready and ignores ready callbacks after removal', () => {
        jest.mocked(isDOMReady).mockReturnValue(false);
        createOrUpdateLeanTheme(theme, null, false);
        expect(addDOMReadyListener).toHaveBeenCalled();
        const ready = jest.mocked(addDOMReadyListener).mock.calls[0][0];
        const complete = jest.mocked(addReadyStateCompleteListener).mock.calls[0][0];
        expect(applyLeanInlineStyles).not.toHaveBeenCalled();
        ready();
        expect(applyLeanInlineStyles).toHaveBeenCalledTimes(1);
        removeLeanTheme();
        ready();
        complete();
        expect(applyLeanInlineStyles).toHaveBeenCalledTimes(1);
    });

    test('coalesces inserted and removed styles with inline changes', async () => {
        const style = new TestHTMLElement();
        style.parentRoot = doc;
        const inline = new TestHTMLElement();
        inline.inline = true;
        const nested = new TestSVGElement();
        const holder = new TestHTMLElement();
        holder.inline = true;
        holder.nested = [style, inline, nested];
        const manager = {details: jest.fn(() => ({rules: [{}]})), render: jest.fn(), watch: jest.fn(), destroy: jest.fn()};
        jest.mocked(manageLeanStyle).mockReturnValue(manager as never);
        jest.mocked(shouldManageStyle).mockImplementation((node) => node === style as unknown as Node);
        jest.mocked(getManageableStyles).mockImplementation((node) => node === holder as unknown as Node ? [style as never] : []);
        createOrUpdateLeanTheme(theme, null, false);
        const observer = TestObserver.instances[0];
        observer.callback([{type: 'childList', addedNodes: [holder], removedNodes: []} as unknown as MutationRecord]);
        await flushFrame();
        expect(manager.render).toHaveBeenCalledTimes(1);
        expect(overrideLeanInlineStyle).toHaveBeenCalled();
        observer.callback([{type: 'childList', addedNodes: [], removedNodes: [holder]} as unknown as MutationRecord]);
        await flushFrame();
        expect(manager.destroy).toHaveBeenCalledTimes(1);
    });

    test('updates managed styles and ignores stale loading callbacks after a theme switch', async () => {
        const style = new TestHTMLElement();
        style.parentRoot = doc;
        const manager = {details: jest.fn(() => ({rules: [{}]})), render: jest.fn(), watch: jest.fn(), destroy: jest.fn()};
        jest.mocked(manageLeanStyle).mockReturnValue(manager as never);
        jest.mocked(getManageableStyles).mockReturnValue([style as never]);
        createOrUpdateLeanTheme(theme, null, false);
        const options = jest.mocked(manageLeanStyle).mock.calls[0][1];
        options.update();
        await flushFrame();
        expect(manager.render).toHaveBeenCalledTimes(2);
        options.loadingStart();
        options.loadingEnd();
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'fallback', '', 'beginning');
        removeLeanTheme();
        createOrUpdateLeanTheme(theme, null, false);
        emitter.setNamedSheet.mockClear();
        options.loadingStart();
        options.loadingEnd();
        expect(emitter.setNamedSheet).not.toHaveBeenCalled();
    });

    test('uses immediate scheduling when animation frames are unavailable', async () => {
        Object.assign(globalThis, {requestAnimationFrame: undefined});
        const inline = new TestHTMLElement();
        createOrUpdateLeanTheme(theme, null, false);
        TestObserver.instances[0].callback([{type: 'attributes', attributeName: 'style', target: inline} as unknown as MutationRecord]);
        await Promise.resolve();
        expect(overrideLeanInlineStyle).toHaveBeenCalled();
    });

    test('cleans inline attributes from observed document and shadow roots', () => {
        const inline = new TestHTMLElement();
        const svg = new TestSVGElement();
        const shadow = new TestShadowRoot();
        doc.querySelectorAll.mockReturnValue([inline] as never);
        shadow.querySelectorAll.mockReturnValue([svg] as never);
        const host = new TestHTMLElement();
        host.shadowRoot = shadow;
        jest.mocked(iterateShadowHosts).mockImplementation((_root, callback) => callback(host as never));
        createOrUpdateLeanTheme(theme, null, false);
        removeLeanTheme();
        expect(clearLeanInlineOverrides).toHaveBeenCalledWith(inline);
        expect(clearLeanInlineOverrides).toHaveBeenCalledWith(svg);
    });
});
