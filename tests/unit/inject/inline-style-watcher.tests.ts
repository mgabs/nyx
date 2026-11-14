const mockMatchVariablesAndDependents = jest.fn();
const mockTreeDisconnect = jest.fn();
let capturedTreeCallbacks: {
    onMinorMutations: (root: Node, ops: {additions: Node[]}) => void;
    onHugeMutations: (root: Node) => void;
} | null = null;

jest.mock('@plus/dynamic/inject', () => ({
    setInlineStyleValue: jest.fn(),
}), {virtual: true});

jest.mock('../../../src/inject/dynamic-theme/image', () => ({
    getImageDetails: jest.fn(),
}));

jest.mock('../../../src/inject/dynamic-theme/modify-css', () => ({
    getModifiableCSSDeclaration: jest.fn(),
}));

jest.mock('../../../src/inject/dynamic-theme/variables', () => ({
    variablesStore: {
        matchVariablesAndDependents: mockMatchVariablesAndDependents,
    },
}));

jest.mock('../../../src/inject/utils/dom', () => ({
    iterateShadowHosts: jest.fn(),
    createOptimizedTreeObserver: jest.fn((_root: Node, callbacks: any) => {
        capturedTreeCallbacks = callbacks;
        return {disconnect: mockTreeDisconnect};
    }),
    isReadyStateComplete: jest.fn(() => true),
    addReadyStateCompleteListener: jest.fn(),
    addDOMReadyListener: jest.fn(),
    isDOMReady: jest.fn(() => true),
}));

interface MockObserverInstance {
    callback: MutationCallback;
    observe: jest.Mock;
    disconnect: jest.Mock;
}

const mockObservers: MockObserverInstance[] = [];

class MockMutationObserver {
    callback: MutationCallback;
    observe = jest.fn();
    disconnect = jest.fn();

    constructor(callback: MutationCallback) {
        this.callback = callback;
        mockObservers.push(this);
    }
}

(global as any).MutationObserver = MockMutationObserver;
(global as any).Element = class MockElement {};
(global as any).Document = class MockDocument {};
(global as any).ShadowRoot = class MockShadowRoot {};
(global as any).document = {
    documentElement: {},
    querySelectorAll: () => [],
    addEventListener: jest.fn(),
};
(global as any).chrome = {
    runtime: {
        onMessage: {addListener: jest.fn()},
    },
};
(global as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0);
(global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

import {watchForInlineStyles, stopWatchingForInlineStyles} from '../../../src/inject/dynamic-theme/inline-style';

function flushMicrotasks(): Promise<void> {
    return Promise.resolve().then(() => Promise.resolve());
}

describe('watchForInlineStyles batching and teardown (REQ-PERF-3, REQ-PERF-4)', () => {
    beforeEach(() => {
        mockObservers.length = 0;
        mockMatchVariablesAndDependents.mockClear();
        mockTreeDisconnect.mockClear();
        capturedTreeCallbacks = null;
    });

    afterEach(() => {
        stopWatchingForInlineStyles();
    });

    it('batches multiple attribute MutationObserver deliveries in one microtask without dropping targets', async () => {
        const changed: any[] = [];
        watchForInlineStyles((el) => changed.push(el), jest.fn());

        const attrObserver = mockObservers[0];
        const elA = {id: 'A'} as any;
        const elB = {id: 'B'} as any;

        attrObserver.callback([{target: elA, attributeName: 'style'} as any], attrObserver as any);
        attrObserver.callback([
            {target: elB, attributeName: 'color'} as any,
            {target: elA, attributeName: 'style'} as any,
        ], attrObserver as any);

        await flushMicrotasks();

        expect(changed).toEqual([elA, elB]);
        expect(mockMatchVariablesAndDependents).toHaveBeenCalledTimes(1);
    });

    it('skips variablesStore.matchVariablesAndDependents when mutations have no inline style attrs or new elements', async () => {
        const changed: any[] = [];
        watchForInlineStyles((el) => changed.push(el), jest.fn());

        const attrObserver = mockObservers[0];
        const elA = {id: 'A'} as any;

        attrObserver.callback([{target: elA, attributeName: 'data-nyx-inline-color'} as any], attrObserver as any);
        await flushMicrotasks();

        expect(changed).toEqual([]);
        expect(mockMatchVariablesAndDependents).not.toHaveBeenCalled();

        capturedTreeCallbacks!.onMinorMutations((global as any).document, {additions: []});
        expect(mockMatchVariablesAndDependents).not.toHaveBeenCalled();
    });

    it('cancels pending microtask flushes on stopWatchingForInlineStyles', async () => {
        const changed: any[] = [];
        watchForInlineStyles((el) => changed.push(el), jest.fn());

        const attrObserver = mockObservers[0];
        const elA = {id: 'A'} as any;
        attrObserver.callback([{target: elA, attributeName: 'style'} as any], attrObserver as any);

        stopWatchingForInlineStyles();
        await flushMicrotasks();

        expect(changed).toEqual([]);
        expect(mockMatchVariablesAndDependents).not.toHaveBeenCalled();
    });
});
