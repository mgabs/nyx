import TabManager from '../../../src/background/tab-manager';

describe('MV3 Declarative Pre-Paint Stylesheet Registration (REQ-FOUC-2)', () => {
    let originalChrome: any;

    afterEach(() => {
        (global as any).chrome = originalChrome;
    });

    it('registers nyx-zero-fouc-root script when running in MV3 and not already registered', async () => {
        originalChrome = (global as any).chrome;

        let getScriptsCalled = false;
        let registeredScripts: any[] = [];

        (global as any).chrome = {
            scripting: {
                getRegisteredContentScripts: async (filter: any) => {
                    getScriptsCalled = true;
                    expect(filter.ids).toEqual(['nyx-zero-fouc-root']);
                    return [];
                },
                registerContentScripts: async (scripts: any[]) => {
                    registeredScripts = scripts;
                },
            },
        };

        await TabManager.registerDeclarativePrePaint(true);

        expect(getScriptsCalled).toBe(true);
        expect(registeredScripts.length).toBe(1);
        expect(registeredScripts[0].id).toBe('nyx-zero-fouc-root');
        expect(registeredScripts[0].runAt).toBe('document_start');
        expect(registeredScripts[0].allFrames).toBe(true);
        expect(registeredScripts[0].persistAcrossSessions).toBe(true);
        expect(registeredScripts[0].matches).toEqual(['<all_urls>']);
        expect(registeredScripts[0].js).toEqual(['inject/fallback.js']);
    });

    it('does not re-register if nyx-zero-fouc-root is already registered', async () => {
        originalChrome = (global as any).chrome;

        let registerCalled = false;

        (global as any).chrome = {
            scripting: {
                getRegisteredContentScripts: async () => {
                    return [{id: 'nyx-zero-fouc-root'}];
                },
                registerContentScripts: async () => {
                    registerCalled = true;
                },
            },
        };

        await TabManager.registerDeclarativePrePaint(true);
        expect(registerCalled).toBe(false);
    });

    it('does nothing when isMV3 is false', async () => {
        originalChrome = (global as any).chrome;
        let getScriptsCalled = false;
        (global as any).chrome = {
            scripting: {
                getRegisteredContentScripts: async () => {
                    getScriptsCalled = true;
                    return [];
                },
            },
        };

        await TabManager.registerDeclarativePrePaint(false);
        expect(getScriptsCalled).toBe(false);
    });

    it('safely handles missing chrome.scripting API', async () => {
        originalChrome = (global as any).chrome;
        (global as any).chrome = {};

        await expect(TabManager.registerDeclarativePrePaint(true)).resolves.toBeUndefined();
    });

    it('safely catches error thrown by chrome.scripting API', async () => {
        originalChrome = (global as any).chrome;
        (global as any).chrome = {
            scripting: {
                getRegisteredContentScripts: async () => {
                    throw new Error('Scripting API error');
                },
            },
        };

        await expect(TabManager.registerDeclarativePrePaint(true)).resolves.toBeUndefined();
    });
});
