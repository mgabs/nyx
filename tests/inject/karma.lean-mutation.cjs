const {rmSync, writeFileSync} = require('node:fs');

module.exports = async (config) => {
    const bridgePath = 'tests/inject/stryker-active-temp.js';
    const activeMutant = process.env.__STRYKER_ACTIVE_MUTANT__ || null;
    writeFileSync(bridgePath, `globalThis.__stryker__ = {activeMutant: ${JSON.stringify(activeMutant)}};\n`);
    process.on('exit', () => rmSync(bridgePath, {force: true}));

    const original = await import('./karma.conf.js');
    const options = original.configureKarma({...config, ci: true}, process.env);
    options.files = [bridgePath, 'tests/inject/support/customize.ts', 'tests/inject/support/polyfills.ts', 'tests/inject/dynamic/lean-theme.tests.ts'];
    config.set(options);
};
