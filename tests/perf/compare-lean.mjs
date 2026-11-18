// Compare explicitly selected engines on local fixtures.
// Build the Chrome release first and set CHROME_BIN; output is one JSON object per iteration.
// Iteration 0 is a warmup. Retries and failures are included in the output.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const {launch} = require('puppeteer-core');
const {createTestServer} = await import(pathToFileURL(path.join(root, 'tests/browser/server.js')).href);
const {getFixturePaths} = await import(pathToFileURL(path.join(root, 'tests/perf/fixtures.js')).href);
const server = await createTestServer(8899);
for (const fixture of ['article', 'spa-churn']) server.setPaths(getFixturePaths(fixture));
const extensionPath = path.join(root, 'build/release/chrome');
try {
    for (const engine of ['dynamicTheme', 'leanDynamicTheme']) {
        const browser = await launch({executablePath: process.env.CHROME_BIN, headless: 'new', enableExtensions: [extensionPath], args: ['--no-sandbox', '--disable-dev-shm-usage']});
        try {
            const target = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().includes('/background/'), {timeout: 15000});
            const extensionURL = new URL(target.url());
            const origin = `${extensionURL.protocol}//${extensionURL.host}`;
            const popup = await browser.newPage();
            await popup.goto(`${origin}/ui/popup/index.html`, {waitUntil: 'load'});
            await popup.evaluate(async (value) => { await chrome.runtime.sendMessage({type: 'ui-bg-set-theme', data: {engine: value}}).catch(() => {}); }, engine);
            await popup.waitForFunction(async (value) => {
                const response = await chrome.runtime.sendMessage({type: 'ui-bg-get-data'});
                return response?.data?.settings?.theme?.engine === value;
            }, {timeout: 15000, polling: 100}, engine);
            for (const fixture of ['article', 'spa-churn']) {
                for (let i = 0; i < Number(process.env.NYX_PERF_ITERATIONS || 11); i++) {
                    const page = await browser.newPage();
                    const cdp = await page.createCDPSession();
                    await cdp.send('Performance.enable');
                    const before = await cdp.send('Performance.getMetrics');
                    const start = performance.now();
                    let retries = 0;
                    try {
                        try {
                            await page.goto(`http://localhost:8899/${fixture}.html`, {waitUntil: 'load', timeout: 10000});
                        } catch (error) {
                            if (!String(error).includes('net::ERR_ABORTED')) throw error;
                            retries++;
                            await new Promise((resolve) => setTimeout(resolve, 200));
                            await page.goto(`http://localhost:8899/${fixture}.html`, {waitUntil: 'load', timeout: 10000});
                        }
                        await page.waitForFunction((expected) => {
                            const fallback = document.querySelector('style.nyx--fallback');
                            if (fallback?.textContent?.trim()) return false;
                            if (expected === 'dynamicTheme') return Boolean(document.querySelector('.nyx--sync'));
                            return document.adoptedStyleSheets.some((sheet) => {
                                try { return Array.from(sheet.cssRules).some((rule) => rule.cssText.includes('--nyx-')); } catch { return false; }
                            });
                        }, {timeout: 10000}, engine);
                        if (fixture === 'spa-churn') await page.evaluate(() => window.__runChurn());
                        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                        const elapsed = performance.now() - start;
                        const after = await cdp.send('Performance.getMetrics');
                        const get = (metrics, key) => metrics.metrics.find((entry) => entry.name === key)?.value ?? null;
                        console.log(JSON.stringify({engine, fixture, iteration: i, retries, elapsedMs: elapsed, taskDurationMs: (get(after, 'TaskDuration') - get(before, 'TaskDuration')) * 1000, heapBytes: get(after, 'JSHeapUsedSize')}));
                    } catch (error) { process.exitCode = 1; console.log(JSON.stringify({engine, fixture, iteration: i, error: String(error)})); }
                    await page.close();
                }
            }
        } finally { await browser.close(); }
    }
} finally { await server.close(); }
