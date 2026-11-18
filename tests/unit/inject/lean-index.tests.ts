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
import {getManageableStyles, setIgnoredCSSURLs, shouldManageStyle} from '../../../src/inject/dynamic-theme/style-manager';
import {getModifiedFallbackStyle, getModifiedUserAgentStyle} from '../../../src/inject/dynamic-theme/modify-css';
import {registerVariablesSheet} from '../../../src/inject/dynamic-theme/palette';
import {createStyleSheetModifier} from '../../../src/inject/dynamic-theme/stylesheet-modifier';
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
    jest.mocked(iterateShadowHosts).mockReset();
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

    test('creates ordered static output and respects font, selection, and site settings', () => {
        const options = {...theme, useFont: true, styleSystemControls: true, selectionColor: 'auto'};
        const settings = fixes({invert: ['.first', '.second'], ignoreCSSUrl: ['https://example.com/ignored.css']});
        jest.mocked(getCSSFilterValue).mockReturnValue('invert(100%)');
        createOrUpdateLeanTheme(options, settings, true);
        expect(createAdoptedEmitter).toHaveBeenCalledTimes(1);
        expect(setIgnoredCSSURLs).toHaveBeenCalledWith(['https://example.com/ignored.css']);
        expect(getModifiedFallbackStyle).toHaveBeenCalledWith(options, {strict: true});
        expect(getModifiedUserAgentStyle).toHaveBeenCalledWith(options, true, true);
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'fallback', 'fallback', 'beginning');
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'user-agent', 'user-agent', 'beginning');
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'text', 'font override', 'beginning');
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'invert', '.first, .second {\n  filter: invert(100%) !important;\n}', 'beginning');
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'variables', expect.stringContaining('--nyx-selection-background: selection-bg;'), 'beginning');
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'variables', expect.stringContaining('--nyx-selection-text: selection-text;'), 'beginning');
        expect(registerVariablesSheet).toHaveBeenCalledTimes(1);
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'inline', 'inline', 'ending');
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'override', '', 'ending');
    });

    test('omits optional styles and initializes selection colors when disabled', () => {
        createOrUpdateLeanTheme(theme, fixes(), false);
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'text', '', 'beginning');
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'invert', '', 'beginning');
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'variables', expect.stringContaining('--nyx-selection-background: initial;'), 'beginning');
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'variables', expect.stringContaining('--nyx-selection-text: initial;'), 'beginning');
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

    test('routes adopted-sheet events and cancels queued work on teardown', async () => {
        createOrUpdateLeanTheme(theme, null, false);
        const options = jest.mocked(watchAdoptedRoot).mock.calls[0][1];
        expect(options.isActive()).toBe(true);
        expect(options.getManagers(doc as never)).toBeUndefined();
        expect(options.needsFlush()).toBe(false);
        options.addRules([{}] as never);
        expect(options.needsFlush()).toBe(true);
        options.sync(doc as never);
        options.render(doc as never, {} as never);
        options.reorder(doc as never);
        options.scheduleFlush();
        await Promise.resolve();
        removeLeanTheme();
        expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
        expect(options.isActive()).toBe(false);
    });

    test('connects variable changes and adopted rules to the next flush', async () => {
        createOrUpdateLeanTheme(theme, null, false);
        const syncOptions = jest.mocked(syncAdoptedSheets).mock.calls[0][1];
        syncOptions.createModifier();
        syncOptions.addRules([{}] as never);
        const modifierOptions = jest.mocked(createStyleSheetModifier).mock.calls[0][0] as unknown as {variablesStore: {setOnRootVariableChange: jest.Mock; matchVariablesAndDependents: jest.Mock}};
        const variables = modifierOptions.variablesStore;
        const rootChanged = variables.setOnRootVariableChange.mock.calls[0][0];
        rootChanged();
        await flushFrame();
        expect(variables.matchVariablesAndDependents).toHaveBeenCalledTimes(2);
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'root-vars', 'root vars', 'beginning');
    });

    test('uses the Chromium proxy event and applies valid color templates', () => {
        Object.assign(globalThis, {__CHROMIUM_MV3__: true});
        const dispatch = jest.spyOn(doc, 'dispatchEvent');
        createOrUpdateLeanTheme(theme, fixes({css: '.x { color: ${#ffffff}; background: ${#000000}; }', disableStyleSheetsProxy: true}), false);
        const event = dispatch.mock.calls.map(([value]) => value).find((value) => value.type === '__nyx__stylesheetProxy__arg') as CustomEvent;
        expect(event.detail).toEqual({enableStyleSheetsProxy: false, enableCustomElementRegistryProxy: true, enableLeanDeclarations: true});
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'override', '.x { color: dark-background; background: light-text; }', 'ending');
    });

    test('tracks styles and adopted sheets in newly observed shadow roots', async () => {
        const shadow = new TestShadowRoot();
        const host = new TestHTMLElement();
        host.shadowRoot = shadow;
        const style = new TestHTMLElement();
        style.parentRoot = shadow;
        const manager = {details: jest.fn(() => ({rules: [{}]})), render: jest.fn(), watch: jest.fn(), destroy: jest.fn()};
        jest.mocked(manageLeanStyle).mockReturnValue(manager as never);
        jest.mocked(getManageableStyles).mockImplementation((node) => node === shadow as unknown as Node ? [style as never] : []);
        jest.mocked(syncAdoptedSheets).mockImplementation((root) => root === shadow as unknown as ShadowRoot ? [{} as CSSStyleSheet] : []);
        createOrUpdateLeanTheme(theme, null, false);
        TestObserver.instances[0].callback([{type: 'childList', addedNodes: [host], removedNodes: []} as unknown as MutationRecord]);
        await flushFrame();
        expect(manager.render).toHaveBeenCalledTimes(1);
        expect(manager.watch).toHaveBeenCalledTimes(1);
        expect(applyLeanInlineStyles).toHaveBeenCalledWith(shadow, theme, expect.anything(), [], []);
        expect(watchAdoptedRoot).toHaveBeenCalledWith(shadow, expect.anything());
        expect(TestObserver.instances).toHaveLength(2);
        TestObserver.instances[0].callback([{type: 'childList', addedNodes: [host], removedNodes: []} as unknown as MutationRecord]);
        await flushFrame();
        expect(TestObserver.instances).toHaveLength(2);
        expect(manager.render).toHaveBeenCalledTimes(1);
    });

    test('coalesces direct stylesheet additions and removals and skips disconnected nodes', async () => {
        const style = new TestHTMLElement();
        style.parentRoot = doc;
        const disconnected = new TestHTMLElement();
        disconnected.isConnected = false;
        const manager = {details: jest.fn(() => null), render: jest.fn(), watch: jest.fn(), destroy: jest.fn()};
        jest.mocked(shouldManageStyle).mockImplementation((node) => node === style as unknown as Node || node === disconnected as unknown as Node);
        jest.mocked(manageLeanStyle).mockReturnValue(manager as never);
        createOrUpdateLeanTheme(theme, null, false);
        const observer = TestObserver.instances[0];
        observer.callback([{type: 'childList', addedNodes: [style, disconnected, style], removedNodes: []} as unknown as MutationRecord]);
        await flushFrame();
        expect(manageLeanStyle).toHaveBeenCalledTimes(1);
        expect(manager.render).toHaveBeenCalledTimes(1);
        observer.callback([{type: 'childList', addedNodes: [], removedNodes: [style]} as unknown as MutationRecord]);
        await flushFrame();
        expect(manager.destroy).toHaveBeenCalledTimes(1);
    });

    test('ignores unrelated mutations and completes deferred rendering', async () => {
        jest.mocked(isDOMReady).mockReturnValue(false);
        const fallback = new TestHTMLElement();
        doc.fallback = fallback;
        createOrUpdateLeanTheme(theme, null, false);
        const ready = jest.mocked(addDOMReadyListener).mock.calls[0][0];
        const complete = jest.mocked(addReadyStateCompleteListener).mock.calls[0][0];
        complete();
        expect(fallback.remove).toHaveBeenCalled();
        ready();
        const initial = emitter.setNamedSheet.mock.calls.length;
        TestObserver.instances[0].callback([{type: 'attributes', attributeName: 'class', target: new TestElement()} as unknown as MutationRecord]);
        await flushFrame();
        expect(emitter.setNamedSheet).toHaveBeenCalledTimes(initial);
    });

    test('refreshes existing managers and adopted output when settings change', () => {
        const style = new TestHTMLElement();
        const shadow = new TestShadowRoot();
        style.parentRoot = shadow;
        const sheet = {} as CSSStyleSheet;
        const manager = {details: jest.fn(() => ({rules: []})), render: jest.fn(), watch: jest.fn(), destroy: jest.fn()};
        jest.mocked(manageLeanStyle).mockReturnValue(manager as never);
        jest.mocked(getManageableStyles).mockReturnValue([style as never]);
        jest.mocked(syncAdoptedSheets).mockImplementation((root, options) => {
            options.managersByRoot.set(root, new Map([[sheet, {} as never]]));
            return [];
        });
        jest.mocked(getCSSFilterValue).mockReturnValue('');
        const settings = fixes({invert: ['.logo']});
        createOrUpdateLeanTheme(theme, settings, false);
        createOrUpdateLeanTheme({...theme, brightness: 90}, settings, false);
        expect(manageLeanStyle).toHaveBeenCalledTimes(1);
        expect(manager.render).toHaveBeenCalledTimes(2);
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'invert', '', 'beginning');
        expect(manager.watch).toHaveBeenCalledTimes(2);
    });

    test('keeps the fallback until every pending stylesheet finishes loading', () => {
        const style = new TestHTMLElement();
        const manager = {details: jest.fn(() => null), render: jest.fn(), watch: jest.fn(), destroy: jest.fn()};
        jest.mocked(manageLeanStyle).mockReturnValue(manager as never);
        jest.mocked(getManageableStyles).mockReturnValue([style as never]);
        createOrUpdateLeanTheme(theme, null, false);
        const options = jest.mocked(manageLeanStyle).mock.calls[0][1];
        options.loadingStart();
        options.loadingStart();
        emitter.setNamedSheet.mockClear();
        options.loadingEnd();
        expect(emitter.setNamedSheet).not.toHaveBeenCalled();
        options.loadingEnd();
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(doc, 'fallback', '', 'beginning');
    });

    test('ignores detached inline nodes and coalesces repeated style updates', async () => {
        const style = new TestHTMLElement();
        const detached = new TestHTMLElement();
        detached.isConnected = false;
        const manager = {details: jest.fn(() => null), render: jest.fn(), watch: jest.fn(), destroy: jest.fn()};
        jest.mocked(manageLeanStyle).mockReturnValue(manager as never);
        jest.mocked(getManageableStyles).mockReturnValue([style as never]);
        createOrUpdateLeanTheme(theme, null, false);
        const options = jest.mocked(manageLeanStyle).mock.calls[0][1];
        options.update();
        options.update();
        TestObserver.instances[0].callback([{type: 'attributes', attributeName: 'style', target: detached} as unknown as MutationRecord]);
        await flushFrame();
        expect(manager.render).toHaveBeenCalledTimes(2);
        expect(overrideLeanInlineStyle).not.toHaveBeenCalled();
    });

    test('discovers nested shadow hosts and skips hosts removed before the flush', async () => {
        const parent = new TestHTMLElement();
        const host = new TestHTMLElement();
        host.shadowRoot = new TestShadowRoot();
        createOrUpdateLeanTheme(theme, null, false);
        jest.mocked(iterateShadowHosts).mockImplementation((_root, callback) => callback(host as never));
        TestObserver.instances[0].callback([{type: 'childList', addedNodes: [parent], removedNodes: []} as unknown as MutationRecord]);
        host.shadowRoot = null;
        await flushFrame();
        expect(TestObserver.instances).toHaveLength(1);
    });

    test('reuses a style manager already registered when its shadow root is discovered', () => {
        const shadow = new TestShadowRoot();
        const host = new TestHTMLElement();
        host.shadowRoot = shadow;
        const style = new TestHTMLElement();
        const manager = {details: jest.fn(() => null), render: jest.fn(), watch: jest.fn(), destroy: jest.fn()};
        jest.mocked(manageLeanStyle).mockReturnValue(manager as never);
        jest.mocked(getManageableStyles).mockReturnValue([style as never]);
        jest.mocked(iterateShadowHosts).mockImplementation((_root, callback) => callback(host as never));
        createOrUpdateLeanTheme(theme, fixes({css: '.x { color: ${#ffffff}; }'}), false);
        expect(manageLeanStyle).toHaveBeenCalledTimes(1);
        expect(emitter.setNamedSheet).toHaveBeenCalledWith(shadow, 'override', '.x { color: dark-background; }', 'ending');
    });

    test('handles non-HTML mutation targets and disconnected nested elements', async () => {
        const plain = new TestElement();
        const svg = new TestSVGElement();
        svg.inline = true;
        const disconnected = new TestSVGElement();
        disconnected.isConnected = false;
        plain.nested = [svg, disconnected, new TestElement()];
        createOrUpdateLeanTheme(theme, null, false);
        TestObserver.instances[0].callback([
            {type: 'attributes', attributeName: 'style', target: plain} as unknown as MutationRecord,
            {type: 'childList', addedNodes: [plain, svg, {}], removedNodes: [{}]} as unknown as MutationRecord,
        ]);
        await flushFrame();
        expect(overrideLeanInlineStyle).toHaveBeenCalledWith(svg, theme, expect.anything(), [], []);
        expect(overrideLeanInlineStyle).not.toHaveBeenCalledWith(disconnected, expect.anything(), expect.anything(), expect.anything(), expect.anything());
    });

    test('falls back to the document element when the page has no head', () => {
        Object.assign(doc, {head: null});
        createOrUpdateLeanTheme(theme, null, false);
        expect(doc.documentElement.append).toHaveBeenCalledTimes(1);
    });

    test('manages direct additions inside a shadow root and renders simultaneous updates once', async () => {
        const shadow = new TestShadowRoot();
        const host = new TestHTMLElement();
        host.shadowRoot = shadow;
        const style = new TestHTMLElement();
        style.parentRoot = shadow;
        let update = () => {};
        const manager = {details: jest.fn(() => {
            update(); return {rules: []};
        }), render: jest.fn(), watch: jest.fn(), destroy: jest.fn()};
        jest.mocked(manageLeanStyle).mockImplementation((_element, options) => {
            update = options.update; return manager as never;
        });
        jest.mocked(shouldManageStyle).mockImplementation((node) => node === style as unknown as Node);
        jest.mocked(iterateShadowHosts).mockImplementation((_root, callback) => callback(host as never));
        createOrUpdateLeanTheme(theme, null, false);
        TestObserver.instances[1].callback([{type: 'childList', addedNodes: [style], removedNodes: []} as unknown as MutationRecord]);
        await flushFrame();
        expect(jest.mocked(manageLeanStyle).mock.calls[0][1].root).toBe(shadow);
        expect(manager.render).toHaveBeenCalledTimes(1);
    });

    test('keeps fallback while an initial stylesheet reports loading', () => {
        const style = new TestHTMLElement();
        const manager = {details: jest.fn(() => null), render: jest.fn(), watch: jest.fn(), destroy: jest.fn()};
        jest.mocked(getManageableStyles).mockReturnValue([style as never]);
        jest.mocked(manageLeanStyle).mockImplementation((_element, options) => {
            options.loadingStart(); return manager as never;
        });
        createOrUpdateLeanTheme(theme, null, false);
        expect(emitter.setNamedSheet).not.toHaveBeenCalledWith(doc, 'fallback', '', 'beginning');
    });

    test('tolerates absent document roots and unrelated shadow hosts during startup', () => {
        Object.assign(doc, {documentElement: null});
        createOrUpdateLeanTheme(theme, null, false);
        expect(TestObserver.instances).toHaveLength(0);
        expect(watchAdoptedRoot).toHaveBeenCalledTimes(1);
    });

    test('ignores non-elements when clearing inline markers', () => {
        doc.querySelectorAll.mockReturnValue([new TestElement()] as never);
        createOrUpdateLeanTheme(theme, null, false);
        removeLeanTheme();
        expect(clearLeanInlineOverrides).not.toHaveBeenCalled();
    });

    test('ignores a frame callback that runs after teardown', async () => {
        const inline = new TestHTMLElement();
        createOrUpdateLeanTheme(theme, null, false);
        TestObserver.instances[0].callback([{type: 'attributes', attributeName: 'style', target: inline} as unknown as MutationRecord]);
        await Promise.resolve();
        const staleFrame = frame as (() => void) | null;
        removeLeanTheme();
        staleFrame?.();
        expect(overrideLeanInlineStyle).not.toHaveBeenCalled();
    });

    test('ignores removed containers that do not contain a managed style', async () => {
        const style = new TestHTMLElement();
        const manager = {details: jest.fn(() => null), render: jest.fn(), watch: jest.fn(), destroy: jest.fn()};
        jest.mocked(getManageableStyles).mockReturnValue([style as never]);
        jest.mocked(manageLeanStyle).mockReturnValue(manager as never);
        createOrUpdateLeanTheme(theme, null, false);
        TestObserver.instances[0].callback([{type: 'childList', addedNodes: [], removedNodes: [new TestHTMLElement()]} as unknown as MutationRecord]);
        await flushFrame();
        expect(manager.destroy).not.toHaveBeenCalled();
    });

    test('ignores an unmounted shadow host and handles unavailable shadow rules', () => {
        const host = new TestHTMLElement();
        const shadow = new TestShadowRoot();
        const liveHost = new TestHTMLElement();
        liveHost.shadowRoot = shadow;
        const style = new TestHTMLElement();
        const manager = {details: jest.fn(() => null), render: jest.fn(), watch: jest.fn(), destroy: jest.fn()};
        jest.mocked(manageLeanStyle).mockReturnValue(manager as never);
        jest.mocked(getManageableStyles).mockImplementation((node) => node === shadow as unknown as Node ? [style as never] : []);
        jest.mocked(iterateShadowHosts).mockImplementation((_root, callback) => {
            callback(host as never); callback(liveHost as never);
        });
        createOrUpdateLeanTheme(theme, null, false);
        expect(TestObserver.instances).toHaveLength(2);
        expect(manager.render).toHaveBeenCalledTimes(1);
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
