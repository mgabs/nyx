import type {Theme} from '../../../src/definitions';
import type {AdoptedEmitter} from '../../../src/inject/lean-theme/adopted-emitter';
import type {SharedRuleCache} from '../../../src/inject/dynamic-theme/stylesheet-modifier';
import type {VariablesStore} from '../../../src/inject/dynamic-theme/variables';

jest.mock('../../../src/utils/url', () => ({getAbsoluteURL: (base: string, url: string) => new URL(url, base).href}));
jest.mock('../../../src/inject/dynamic-theme/css-rules', () => ({
    replaceCSSRelativeURLsWithAbsolute: (css: string) => css,
    replaceCSSFontFace: (css: string) => css,
    getCSSBaseBath: (url: string) => new URL('.', url).href,
    getCSSURLValue: (value: string) => value.replace(/^url\(\s*|\s*\)$/g, '').replace(/^["']|["']$/g, ''),
}));
jest.mock('../../../src/inject/cache', () => ({readCSSFetchCache: jest.fn(), writeCSSFetchCache: jest.fn()}));
jest.mock('../../../src/inject/dynamic-theme/network', () => ({bgFetch: jest.fn()}));
jest.mock('../../../src/utils/network', () => ({loadAsText: jest.fn()}));
jest.mock('../../../src/inject/utils/dom', () => ({addReadyStateCompleteListener: jest.fn()}));
jest.mock('../../../src/inject/utils/log', () => ({logInfo: jest.fn(), logWarn: jest.fn()}));
jest.mock('../../../src/inject/dynamic-theme/watch/sheet-changes', () => ({createSheetWatcher: jest.fn()}));
jest.mock('../../../src/inject/dynamic-theme/stylesheet-modifier', () => ({createStyleSheetModifier: jest.fn()}));
jest.mock('../../../src/inject/lean-theme/adopted-emitter', () => ({createConstructableSheet: jest.fn()}));

import {readCSSFetchCache, writeCSSFetchCache} from '../../../src/inject/cache';
import {bgFetch} from '../../../src/inject/dynamic-theme/network';
import {loadAsText} from '../../../src/utils/network';
import {addReadyStateCompleteListener} from '../../../src/inject/utils/dom';
import {logInfo, logWarn} from '../../../src/inject/utils/log';
import {createSheetWatcher} from '../../../src/inject/dynamic-theme/watch/sheet-changes';
import {createStyleSheetModifier} from '../../../src/inject/dynamic-theme/stylesheet-modifier';
import {createConstructableSheet} from '../../../src/inject/lean-theme/adopted-emitter';
import {cleanLeanLoadingLinks, manageLeanStyle} from '../../../src/inject/lean-theme/style-manager';

class Link {
    href = 'https://example.test/main.css';
    sheet: CSSStyleSheet | null = null;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
const theme = {} as Theme;

beforeEach(() => {
    jest.resetAllMocks();
    cleanLeanLoadingLinks();
    Object.assign(globalThis, {
        HTMLLinkElement: Link,
        location: {origin: 'https://example.test'},
        document: {readyState: 'complete'},
    });
    jest.mocked(readCSSFetchCache).mockReturnValue(null);
    jest.mocked(createSheetWatcher).mockReturnValue({start: jest.fn(), stop: jest.fn()} as never);
    jest.mocked(createStyleSheetModifier).mockReturnValue({modifySheet: jest.fn()} as never);
});

function setup(link = new Link()) {
    const output = {replaceSync: jest.fn(), cssRules: [] as unknown as CSSRuleList};
    const emitter = {createDynamicSheet: jest.fn(() => output), removeDynamicSheet: jest.fn()} as unknown as AdoptedEmitter;
    const update = jest.fn();
    const loadingStart = jest.fn();
    const loadingEnd = jest.fn();
    const manager = manageLeanStyle(link as unknown as HTMLLinkElement, {
        root: {} as Document,
        emitter,
        sharedCache: {} as SharedRuleCache,
        variablesStore: {} as VariablesStore,
        update,
        loadingStart,
        loadingEnd,
    });
    return {manager, link, emitter, output, update, loadingStart, loadingEnd};
}

describe('Lean stylesheet loading lifecycle', () => {
    test('loads a cross-origin sheet and reports a balanced lifecycle', async () => {
        const corsSheet = {replaceSync: jest.fn(), cssRules: [] as unknown as CSSRuleList};
        jest.mocked(createConstructableSheet).mockReturnValue(corsSheet as unknown as CSSStyleSheet);
        jest.mocked(bgFetch).mockResolvedValue('.loaded { color: red; }');
        const {manager, loadingStart, loadingEnd, update} = setup();
        expect(manager.details({secondRound: false})).toBeNull();
        await flush();
        expect(loadingStart).toHaveBeenCalledTimes(1);
        expect(loadingEnd).toHaveBeenCalledTimes(1);
        expect(bgFetch).toHaveBeenCalledWith({url: 'https://example.test/main.css', responseType: 'text', mimeType: 'text/css', origin: 'https://example.test'});
        expect(corsSheet.replaceSync).toHaveBeenCalledWith('.loaded { color: red; }');
        expect(update).toHaveBeenCalledTimes(1);
        expect(logInfo).toHaveBeenCalledWith('Loaded CORS stylesheet for https://example.test/main.css');
        expect(manager.details({secondRound: true})).toEqual({rules: corsSheet.cssRules});
        expect(writeCSSFetchCache).toHaveBeenCalledWith('https://example.test/main.css', '.loaded { color: red; }');
    });

    test('loads nested imports once, preserving their conditions and accessible rules', async () => {
        const corsSheet = {replaceSync: jest.fn(), cssRules: [] as unknown as CSSRuleList};
        jest.mocked(createConstructableSheet).mockReturnValue(corsSheet as unknown as CSSStyleSheet);
        let requests = 0;
        jest.mocked(loadAsText).mockRejectedValue(new Error('unexpected recursive import'));
        jest.mocked(bgFetch).mockImplementation(async ({url}) => {
            if (++requests > 5) {
                throw new Error('unexpected recursive import');
            }
            if (url === 'https://example.test/main.css') {
                return '@import "child.css" layer(theme) supports(display: grid) screen; .parent { color: red; }';
            }
            if (url === 'https://example.test/child.css') {
                return '@import "main.css"; .child { color: blue; }';
            }
            throw new Error('Unexpected URL');
        });
        const {manager, update, loadingEnd} = setup();
        manager.details({secondRound: false});
        await flush();
        expect(bgFetch).toHaveBeenCalledTimes(2);
        expect(corsSheet.replaceSync).toHaveBeenCalledWith('@layer theme { @supports (display: grid) { @media screen {  .child { color: blue; } } } } .parent { color: red; }');
        expect(update).toHaveBeenCalledTimes(1);
        expect(loadingEnd).toHaveBeenCalledTimes(1);
    });

    test('keeps accessible parent rules when both import fetch methods fail', async () => {
        const corsSheet = {replaceSync: jest.fn(), cssRules: [] as unknown as CSSRuleList};
        jest.mocked(createConstructableSheet).mockReturnValue(corsSheet as unknown as CSSStyleSheet);
        jest.mocked(bgFetch).mockImplementation(async ({url}) => {
            if (url === 'https://example.test/main.css') {
                return '@import "missing.css"; .parent { color: red; }';
            }
            throw new Error('missing');
        });
        jest.mocked(loadAsText).mockRejectedValue(new Error('also missing'));
        const {manager, update, loadingEnd} = setup();
        manager.details({secondRound: false});
        await flush();
        expect(corsSheet.replaceSync).toHaveBeenCalledWith(' .parent { color: red; }');
        expect(update).toHaveBeenCalledTimes(1);
        expect(loadingEnd).toHaveBeenCalledTimes(1);
    });

    test('does not apply a partially loaded import after pause', async () => {
        let resolveImport!: (value: string) => void;
        jest.mocked(bgFetch).mockImplementation(({url}) => url === 'https://example.test/main.css'
            ? Promise.resolve('@import "child.css";')
            : new Promise<string>((resolve) => {
                resolveImport = resolve;
            }));
        const {manager, update, loadingEnd} = setup();
        manager.details({secondRound: false});
        await flush();
        manager.pause();
        resolveImport('.child { color: red; }');
        await flush();
        expect(createConstructableSheet).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(loadingEnd).toHaveBeenCalledTimes(1);
    });

    test('does not apply a top-level stylesheet after it is paused', async () => {
        let resolveFetch!: (value: string) => void;
        jest.mocked(bgFetch).mockReturnValue(new Promise<string>((resolve) => {
            resolveFetch = resolve;
        }));
        const {manager, update, loadingEnd} = setup();
        manager.details({secondRound: false});
        manager.pause();
        resolveFetch('.paused { color: red; }');
        await flush();
        expect(createConstructableSheet).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(loadingEnd).toHaveBeenCalledTimes(1);
    });

    test('does not fetch for a non-link style element with an href-like property', () => {
        const style = {href: 'https://example.test/not-a-link.css', sheet: null};
        const {manager} = setup(style as unknown as Link);
        expect(manager.details({secondRound: false})).toBeNull();
        expect(bgFetch).not.toHaveBeenCalled();
    });

    test('does not fetch if a deferred link loses its URL before document readiness', async () => {
        Object.assign(globalThis, {document: {readyState: 'loading'}});
        const link = new Link();
        const {manager, loadingStart, loadingEnd} = setup(link);
        manager.details({secondRound: false});
        link.href = '';
        jest.mocked(addReadyStateCompleteListener).mock.calls[0][0]();
        await flush();
        expect(bgFetch).not.toHaveBeenCalled();
        expect(loadAsText).not.toHaveBeenCalled();
        expect(loadingStart).toHaveBeenCalledTimes(1);
        expect(loadingEnd).toHaveBeenCalledTimes(1);
    });

    test('does not fetch during a second-round lookup or for an empty URL', () => {
        const link = new Link();
        const {manager} = setup(link);
        expect(manager.details({secondRound: true})).toBeNull();
        link.href = '';
        expect(manager.details({secondRound: false})).toBeNull();
        expect(bgFetch).not.toHaveBeenCalled();
    });

    test('starts a deferred fetch once the document is ready', async () => {
        Object.assign(globalThis, {document: {readyState: 'loading'}});
        const corsSheet = {replaceSync: jest.fn(), cssRules: [] as unknown as CSSRuleList};
        jest.mocked(createConstructableSheet).mockReturnValue(corsSheet as unknown as CSSStyleSheet);
        jest.mocked(bgFetch).mockResolvedValue('.ready { color: red; }');
        const {manager, update} = setup();
        manager.details({secondRound: false});
        expect(bgFetch).not.toHaveBeenCalled();
        jest.mocked(addReadyStateCompleteListener).mock.calls[0][0]();
        await flush();
        expect(corsSheet.replaceSync).toHaveBeenCalledWith('.ready { color: red; }');
        expect(update).toHaveBeenCalledTimes(1);
    });

    test('skips a malformed imported condition and retains following rules', async () => {
        const corsSheet = {replaceSync: jest.fn(), cssRules: [] as unknown as CSSRuleList};
        jest.mocked(createConstructableSheet).mockReturnValue(corsSheet as unknown as CSSStyleSheet);
        jest.mocked(bgFetch).mockImplementation(async ({url}) => url.endsWith('/main.css')
            ? '@import "child.css" supports((display: grid); .parent { color: red; }'
            : '.child { color: blue; }');
        const {manager} = setup();
        manager.details({secondRound: false});
        await flush();
        expect(corsSheet.replaceSync).toHaveBeenCalledWith(' .parent { color: red; }');
    });

    test('prevents duplicate fetches and an older load from clearing a newer load token', async () => {
        const pending: Array<(value: string) => void> = [];
        jest.mocked(bgFetch).mockImplementation(() => new Promise<string>((resolve) => pending.push(resolve)));
        const link = new Link();
        const first = setup(link);
        first.manager.details({secondRound: false});
        first.manager.details({secondRound: false});
        expect(pending).toHaveLength(1);
        first.manager.destroy();
        cleanLeanLoadingLinks();
        const second = setup(link);
        second.manager.details({secondRound: false});
        expect(pending).toHaveLength(2);
        pending[0]('.old { color: red; }');
        await flush();
        second.manager.details({secondRound: false});
        expect(pending).toHaveLength(2);
        second.manager.destroy();
        pending[1]('.new { color: blue; }');
        await flush();
        expect(first.loadingEnd).toHaveBeenCalledTimes(1);
        expect(second.loadingEnd).toHaveBeenCalledTimes(1);
    });

    test('releases its loading token so the same link can be loaded again', async () => {
        const corsSheet = {replaceSync: jest.fn(), cssRules: [] as unknown as CSSRuleList};
        jest.mocked(createConstructableSheet).mockReturnValue(corsSheet as unknown as CSSStyleSheet);
        jest.mocked(bgFetch).mockResolvedValue('.loaded { color: red; }');
        const link = new Link();
        const first = setup(link);
        first.manager.details({secondRound: false});
        await flush();
        first.manager.destroy();
        const second = setup(link);
        second.manager.details({secondRound: false});
        await flush();
        expect(bgFetch).toHaveBeenCalledTimes(2);
        expect(second.update).toHaveBeenCalledTimes(1);
    });

    test('finishes without applying a stylesheet when both fetch methods fail', async () => {
        jest.mocked(bgFetch).mockRejectedValue(new Error('background unavailable'));
        jest.mocked(loadAsText).mockRejectedValue(new Error('network unavailable'));
        const {manager, update, loadingEnd} = setup();
        manager.details({secondRound: false});
        await flush();
        expect(createConstructableSheet).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(loadingEnd).toHaveBeenCalledTimes(1);
        expect(logWarn).toHaveBeenCalledWith('LeanStyleManager bgFetch error', expect.any(Error));
        expect(logWarn).toHaveBeenCalledWith('LeanStyleManager fallback fetch error', expect.any(Error));
    });

    test('stops a self-importing child instead of fetching it again', async () => {
        const corsSheet = {replaceSync: jest.fn(), cssRules: [] as unknown as CSSRuleList};
        jest.mocked(createConstructableSheet).mockReturnValue(corsSheet as unknown as CSSStyleSheet);
        let childRequests = 0;
        jest.mocked(loadAsText).mockRejectedValue(new Error('recursive import'));
        jest.mocked(bgFetch).mockImplementation(async ({url}) => {
            if (url.endsWith('/main.css')) {
                return '@import "child.css"; .parent { color: red; }';
            }
            childRequests++;
            if (childRequests > 2) {
                throw new Error('recursive import');
            }
            return '@import "child.css"; .child { color: blue; }';
        });
        const {manager} = setup();
        manager.details({secondRound: false});
        await flush();
        expect(childRequests).toBe(1);
        expect(corsSheet.replaceSync).toHaveBeenCalledWith(' .child { color: blue; } .parent { color: red; }');
    });

    test('stops fetching imports at the depth limit', async () => {
        const corsSheet = {replaceSync: jest.fn(), cssRules: [] as unknown as CSSRuleList};
        jest.mocked(createConstructableSheet).mockReturnValue(corsSheet as unknown as CSSStyleSheet);
        const requests: string[] = [];
        jest.mocked(bgFetch).mockImplementation(async ({url}) => {
            requests.push(url);
            if (url.endsWith('/main.css')) {
                return '@import "depth-0.css";';
            }
            const index = Number(/depth-(\d+)\.css$/.exec(url)![1]);
            return index < 40 ? `@import "depth-${index + 1}.css";` : '';
        });
        const {manager, update} = setup();
        manager.details({secondRound: false});
        await flush();
        expect(requests).toHaveLength(32);
        expect(requests[31]).toBe('https://example.test/depth-30.css');
        expect(update).toHaveBeenCalledTimes(1);
    });

    test('does not restore a sheet when a pending load is destroyed', async () => {
        let resolveFetch!: (value: string) => void;
        jest.mocked(bgFetch).mockReturnValue(new Promise<string>((resolve) => {
            resolveFetch = resolve;
        }));
        const {manager, loadingStart, loadingEnd, update} = setup();
        manager.details({secondRound: false});
        manager.destroy();
        resolveFetch('.late { color: red; }');
        await flush();
        expect(loadingStart).toHaveBeenCalledTimes(1);
        expect(loadingEnd).toHaveBeenCalledTimes(1);
        expect(createConstructableSheet).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(manager.details({secondRound: false})).toBeNull();
        expect(bgFetch).toHaveBeenCalledTimes(1);
    });

    test('uses cached CSS and falls back to direct loading when background fetch fails', async () => {
        const corsSheet = {replaceSync: jest.fn(), cssRules: [] as unknown as CSSRuleList};
        jest.mocked(createConstructableSheet).mockReturnValue(corsSheet as unknown as CSSStyleSheet);
        jest.mocked(readCSSFetchCache).mockReturnValueOnce('.cached { color: red; }').mockReturnValue(null);
        const cached = setup();
        cached.manager.details({secondRound: false});
        await flush();
        expect(bgFetch).not.toHaveBeenCalled();
        expect(corsSheet.replaceSync).toHaveBeenCalledWith('.cached { color: red; }');
        cached.manager.destroy();
        jest.mocked(bgFetch).mockRejectedValueOnce(new Error('background unavailable'));
        jest.mocked(loadAsText).mockResolvedValueOnce('.fallback { color: blue; }');
        const fallback = setup();
        fallback.manager.details({secondRound: false});
        await flush();
        expect(loadAsText).toHaveBeenCalledWith('https://example.test/main.css', 'text/css');
        expect(corsSheet.replaceSync).toHaveBeenCalledWith('.fallback { color: blue; }');
        expect(writeCSSFetchCache).toHaveBeenCalledWith('https://example.test/main.css', '.fallback { color: blue; }');
        fallback.manager.destroy();
    });

    test('does not render when its stylesheet has no readable rules', () => {
        const {manager} = setup();
        const modifier = jest.mocked(createStyleSheetModifier).mock.results[0].value;
        manager.render(theme, []);
        expect(modifier.modifySheet).not.toHaveBeenCalled();
    });

    test('does not remove an output sheet that was never created', () => {
        const {manager, emitter} = setup();
        manager.destroy();
        expect(emitter.removeDynamicSheet).not.toHaveBeenCalled();
    });

    test('marks an in-flight render as cancelled when destroyed', () => {
        const link = new Link();
        link.sheet = {cssRules: [{}]} as unknown as CSSStyleSheet;
        const {manager} = setup(link);
        const modifier = jest.mocked(createStyleSheetModifier).mock.results[0].value;
        manager.render(theme, []);
        const args = modifier.modifySheet.mock.calls[0][0];
        expect(args.isAsyncCancelled()).toBe(false);
        manager.destroy();
        expect(args.isAsyncCancelled()).toBe(true);
    });

    test('defers loading until ready and ignores a destroyed manager', () => {
        Object.assign(globalThis, {document: {readyState: 'loading'}});
        const {manager} = setup();
        manager.details({secondRound: false});
        expect(addReadyStateCompleteListener).toHaveBeenCalledTimes(1);
        manager.destroy();
        jest.mocked(addReadyStateCompleteListener).mock.calls[0][0]();
        expect(bgFetch).not.toHaveBeenCalled();
    });

    test('renders readable rules, watches, pauses and removes its output on destroy', () => {
        const rules = [{}] as unknown as CSSRuleList;
        const link = new Link();
        link.sheet = {cssRules: rules} as CSSStyleSheet;
        const {manager, emitter, output} = setup(link);
        const modifier = jest.mocked(createStyleSheetModifier).mock.results[0].value;
        const watcher = jest.mocked(createSheetWatcher).mock.results[0].value;
        expect(manager.details({secondRound: false})).toEqual({rules});
        const shouldStop = jest.mocked(createSheetWatcher).mock.calls[0][3];
        expect(shouldStop()).toBe(false);
        manager.render(theme, []);
        expect(createStyleSheetModifier).toHaveBeenCalledWith({sharedCache: expect.anything(), variablesStore: expect.anything(), imageURLModifier: null});
        const args = modifier.modifySheet.mock.calls[0][0];
        expect(args.sourceCSSRules).toBe(rules);
        expect(args.force).toBe(true);
        expect(args.prepareSheet()).toBe(output);
        expect(args.prepareSheet()).toBe(output);
        expect(output.replaceSync).toHaveBeenCalledWith('');
        expect(args.isAsyncCancelled()).toBe(false);
        manager.watch();
        expect(watcher.start).toHaveBeenCalledTimes(1);
        manager.pause();
        expect(shouldStop()).toBe(true);
        expect(args.isAsyncCancelled()).toBe(true);
        manager.render(theme, []);
        expect(shouldStop()).toBe(false);
        expect(modifier.modifySheet.mock.calls[1][0].force).toBe(false);
        manager.destroy();
        expect(watcher.stop).toHaveBeenCalledTimes(1);
        expect(emitter.removeDynamicSheet).toHaveBeenCalledWith(expect.anything(), output);
        manager.render(theme, []);
        expect(modifier.modifySheet).toHaveBeenCalledTimes(2);
    });
});
