import fs from 'node:fs/promises';
import path from 'node:path';

describe('MV3 Messaging & about:blank Safety', () => {
    const rootPath = (...parts: string[]) => path.resolve(__dirname, '../../../', ...parts);

    afterEach(() => {
        jest.resetModules();
        delete (globalThis as any).chrome;
        delete (globalThis as any).window;
    });

    test('Messenger.reportChanges catches rejected chrome.runtime.sendMessage promise', async () => {
        const sendMessage = jest.fn(() => Promise.reject(new Error('Could not establish connection. Receiving end does not exist.')));
        (globalThis as any).chrome = {
            runtime: {
                sendMessage,
                onMessage: {addListener: jest.fn()},
            },
        };

        const {default: Messenger} = await import('../../../src/background/messenger');
        (Messenger as any).changeListenerCount = 1;
        Messenger.reportChanges({} as any);

        await Promise.resolve();
        await Promise.resolve();
        expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    test('Connector fire-and-forget actions catch rejected chrome.runtime.sendMessage promise', async () => {
        const sendMessage = jest.fn(() => Promise.reject(new Error('Receiving end does not exist.')));
        (globalThis as any).chrome = {
            runtime: {
                sendMessage,
                onMessage: {addListener: jest.fn(), removeListener: jest.fn()},
            },
        };

        const {default: Connector} = await import('../../../src/ui/connect/connector');
        const connector = new Connector();
        const cb = jest.fn();
        connector.subscribeToChanges(cb);
        connector.changeSettings({enabled: false});
        connector.setTheme({brightness: 90});
        connector.toggleActiveTab();
        connector.disconnect();

        await Promise.resolve();
        await Promise.resolve();
        expect(sendMessage).toHaveBeenCalledTimes(5);
    });

    test('bgFetch rejects cleanly when chrome.runtime.sendMessage rejects', async () => {
        const sendMessage = jest.fn(() => Promise.reject(new Error('Could not establish connection. Receiving end does not exist.')));
        (globalThis as any).window = {};
        (globalThis as any).chrome = {
            runtime: {
                sendMessage,
                onMessage: {addListener: jest.fn()},
            },
        };

        const {bgFetch} = await import('../../../src/inject/dynamic-theme/network');
        await expect(bgFetch({
            url: 'https://example.com/test.css',
            origin: 'https://example.com',
            responseType: 'text',
        })).rejects.toThrow('Receiving end does not exist');
    });

    test('manifests and TabManager disable about:blank content script injection', async () => {
        for (const rel of ['src/manifest.json', 'src/manifest-firefox.json', 'src/manifest-thunderbird.json']) {
            const manifest = JSON.parse(await fs.readFile(rootPath(rel), 'utf8'));
            for (const entry of manifest.content_scripts) {
                expect(entry.match_about_blank).toBe(false);
            }
        }
        const tabManagerRaw = await fs.readFile(rootPath('src/background/tab-manager.ts'), 'utf8');
        expect(tabManagerRaw).not.toContain('matchAboutBlank: true');
    });
});
