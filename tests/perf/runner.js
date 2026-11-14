// @ts-check

import {execSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launch} from 'puppeteer-core';
import {chromeExtensionDebugDir, chromeMV3ExtensionDebugDir, getChromePath, getFirefoxPath} from '../browser/paths.js';
import {createTestServer} from '../browser/server.js';
import {FIXTURE_NAMES, getCorpusHash, getFixturePaths} from './fixtures.js';
import {createSeriesRecord, formatSummaryTable} from './stats.cjs';

const BENCH_PORT = 8899;

function getGitCommit() {
    try {
        return execSync('git rev-parse --short HEAD', {encoding: 'utf8'}).trim();
    } catch {
        return 'unknown';
    }
}

/**
 * Launches Chrome or Firefox via Puppeteer WITHOUT JS coverage instrumentation.
 * @param {'chrome-mv3' | 'firefox'} browserName
 * @param {string} engine
 * @param {string} userDataDir
 */
async function launchPerfBrowser(browserName, engine, userDataDir) {
    if (browserName === 'firefox') {
        const executablePath = await getFirefoxPath();
        return await launch({
            browser: 'firefox',
            executablePath,
            headless: true,
            userDataDir,
        });
    }

    const executablePath = await getChromePath();
    const args = ['--no-sandbox', '--disable-setuid-sandbox'];
    if (engine !== 'none' && engine !== 'standalone-api') {
        const releaseMV3Dir = path.resolve(process.cwd(), 'build/release/chrome-mv3');
        const extDir = [chromeMV3ExtensionDebugDir, releaseMV3Dir, chromeExtensionDebugDir].find((d) => fs.existsSync(d));
        if (extDir) {
            args.push(`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`);
        }
    }

    return await launch({
        executablePath,
        headless: true,
        args,
        userDataDir,
    });
}

/**
 * Measures one iteration on a fixture page.
 * @param {import('puppeteer-core').Page} page
 * @param {string} url
 * @param {string} engine
 * @param {string} fixture
 * @param {string | null} apiScript
 * @param {boolean} diagnostic
 */
async function measureOnce(page, url, engine, fixture, apiScript, diagnostic) {
    if (engine === 'standalone-api' && apiScript) {
        await page.evaluateOnNewDocument((src) => {
            window.__darkreaderApiSrc = src;
        }, apiScript);
    }

    await page.evaluateOnNewDocument(() => {
        window.__longTasks = 0;
        if (typeof PerformanceObserver !== 'undefined') {
            try {
                const po = new PerformanceObserver((list) => {
                    window.__longTasks += list.getEntries().length;
                });
                po.observe({type: 'longtask', buffered: true});
            } catch {
                // Unsupported on this browser
            }
        }
    });

    const t0 = performance.now();
    await page.goto(url, {waitUntil: 'load'});

    if (engine === 'standalone-api' && apiScript) {
        await page.evaluate(() => {
            const script = document.createElement('script');
            script.textContent = window.__darkreaderApiSrc;
            document.head.appendChild(script);
            if (window.DarkReader) {
                window.DarkReader.enable({brightness: 100, contrast: 100, sepia: 0});
            }
        });
    }

    if (fixture === 'spa-churn') {
        await page.evaluate(() => {
            if (typeof window.__runChurn === 'function') {
                window.__runChurn();
            }
        });
    }

    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const elapsedMs = performance.now() - t0;

    const metrics = await page.evaluate((diag) => {
        const bg = getComputedStyle(document.documentElement).backgroundColor;
        return {
            longTasks: typeof window.__longTasks === 'number' ? window.__longTasks : null,
            bgColor: bg,
            diagnosticImageTiming: diag ? performance.getEntriesByType('measure').length : null,
        };
    }, diagnostic);

    return {elapsedMs, ...metrics};
}

/**
 * Runs the configured benchmark matrix and writes structured results.
 * @param {{
 *   smoke: boolean;
 *   diagnostic: boolean;
 *   browsers: string[];
 *   engines: string[];
 *   fixtures: string[];
 *   warmups: number;
 *   runs: number;
 *   outputDir: string;
 * }} config
 */
export async function runBenchmark(config) {
    const server = await createTestServer(BENCH_PORT);
    for (const name of FIXTURE_NAMES) {
        server.setPaths(getFixturePaths(name));
    }

    const apiPath = path.resolve(process.cwd(), 'nyx.js');
    const apiScript = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, 'utf8') : null;

    /** @type {Array<ReturnType<typeof createSeriesRecord>>} */
    const seriesList = [];

    try {
        for (const browserName of config.browsers) {
            const typedBrowser = /** @type {'chrome-mv3' | 'firefox'} */ (browserName);
            for (const engine of config.engines) {
                if (engine === 'standalone-api' && !apiScript) {
                    continue;
                }
                for (const fixture of config.fixtures) {
                    const url = `http://localhost:${BENCH_PORT}/${fixture}.html`;
                    for (const cacheMode of /** @type {const} */ (['cold', 'warm'])) {
                        const samplesMs = [];
                        let failures = 0;
                        let totalLongTasks = 0;

                        const sharedProfile = cacheMode === 'warm' ? fs.mkdtempSync(path.join(os.tmpdir(), 'nyx-perf-warm-')) : null;
                        const sharedBrowser = sharedProfile ? await launchPerfBrowser(typedBrowser, engine, sharedProfile) : null;

                        try {
                            const total = config.warmups + config.runs;
                            for (let i = 0; i < total; i++) {
                                const coldProfile = cacheMode === 'cold' ? fs.mkdtempSync(path.join(os.tmpdir(), 'nyx-perf-cold-')) : null;
                                const browser = sharedBrowser || await launchPerfBrowser(typedBrowser, engine, /** @type {string} */ (coldProfile));
                                try {
                                    const page = await browser.newPage();
                                    const res = await measureOnce(page, url, engine, fixture, apiScript, config.diagnostic);
                                    await page.close();
                                    if (i >= config.warmups) {
                                        samplesMs.push(res.elapsedMs);
                                        if (typeof res.longTasks === 'number') {
                                            totalLongTasks += res.longTasks;
                                        }
                                    }
                                } catch {
                                    if (i >= config.warmups) {
                                        failures += 1;
                                    }
                                } finally {
                                    if (!sharedBrowser) {
                                        await browser.close();
                                    }
                                    if (coldProfile) {
                                        fs.rmSync(coldProfile, {recursive: true, force: true});
                                    }
                                }
                            }
                        } finally {
                            if (sharedBrowser) {
                                await sharedBrowser.close();
                            }
                            if (sharedProfile) {
                                fs.rmSync(sharedProfile, {recursive: true, force: true});
                            }
                        }

                        seriesList.push(createSeriesRecord({
                            browser: typedBrowser,
                            engine,
                            fixture,
                            cacheMode,
                            warmupCount: config.warmups,
                            samplesMs,
                            failures,
                            longTasksCount: typedBrowser === 'firefox'
                                ? {value: null, reason: 'Chromium longtask PerformanceObserver unavailable on Firefox'}
                                : {value: totalLongTasks},
                            observedBrightFrames: {
                                value: null,
                                reason: 'Compositor filmstrip capture disabled in baseline runner; use diagnostic trace for frame inspection',
                            },
                        }));
                    }
                }
            }
        }
    } finally {
        await server.close();
    }

    fs.mkdirSync(config.outputDir, {recursive: true});
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = path.join(config.outputDir, `bench-${timestamp}.json`);

    const payload = {
        metadata: {
            timestamp: new Date().toISOString(),
            commit: getGitCommit(),
            nodeVersion: process.version,
            platform: `${os.platform()}-${os.arch()}`,
            cpuModel: os.cpus()[0]?.model || 'unknown',
            cpuCount: os.cpus().length,
            corpusHash: getCorpusHash(),
            diagnostic: config.diagnostic,
            smoke: config.smoke,
            coverageDisabled: true,
        },
        series: seriesList,
    };

    fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(formatSummaryTable(seriesList));
    console.log(`\nSaved raw benchmark results to ${outFile}`);
    return payload;
}
