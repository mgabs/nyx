// @ts-check

import {parseArgs} from 'node:util';
import {FIXTURE_NAMES} from './fixtures.js';
import {runBenchmark} from './runner.js';

/**
 * Parses CLI flags for `npm run bench`.
 * @param {string[]} argv
 */
export function parseBenchArgs(argv) {
    const {values} = parseArgs({
        args: argv,
        options: {
            smoke: {type: 'boolean', default: false},
            diagnostic: {type: 'boolean', default: false},
            browser: {type: 'string', multiple: true},
            engine: {type: 'string', multiple: true},
            fixture: {type: 'string', multiple: true},
            warmups: {type: 'string'},
            runs: {type: 'string'},
            output: {type: 'string'},
        },
        strict: true,
    });

    const smoke = Boolean(values.smoke);
    return {
        smoke,
        diagnostic: Boolean(values.diagnostic),
        browsers: values.browser || ['chrome-mv3'],
        engines: values.engine || (smoke ? ['none', 'dynamicTheme', 'standalone-api'] : ['none', 'disabled', 'cssFilter', 'svgFilter', 'dynamicTheme', 'staticTheme', 'standalone-api']),
        fixtures: values.fixture || (smoke ? ['article', 'shadow-dom', 'spa-churn'] : FIXTURE_NAMES),
        warmups: values.warmups ? Number(values.warmups) : (smoke ? 1 : 5),
        runs: values.runs ? Number(values.runs) : (smoke ? 3 : 20),
        outputDir: values.output || 'tests/perf/results',
    };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const config = parseBenchArgs(process.argv.slice(2));
    await runBenchmark(config);
}
