// Set NYX_STRYKER_JEST_PLUGIN when Stryker is installed outside this repository.
const plugin = process.env.NYX_STRYKER_JEST_PLUGIN || '@stryker-mutator/jest-runner';

export default {
    mutate: [
        'src/inject/lean-theme/adopted-apply.ts',
        'src/inject/lean-theme/adopted-emitter.ts',
        'src/inject/lean-theme/adopted-order.ts',
        'src/inject/lean-theme/adopted-reconciliation.ts',
        'src/inject/lean-theme/adopted-render.ts',
        'src/inject/lean-theme/adopted-reorder.ts',
        'src/inject/lean-theme/adopted-sync.ts',
        'src/inject/lean-theme/adopted-watch.ts',
        'src/inject/lean-theme/import-conditions.ts',
        'src/inject/lean-theme/import-scan.ts',
        'src/inject/lean-theme/import-wrapping.ts',
        'src/inject/lean-theme/inline-style.ts',
        'src/inject/lean-theme/style-manager.ts',
        'src/inject/dynamic-theme/stylesheet-proxy.ts:354-417',
    ],
    testRunner: 'jest',
    plugins: [plugin],
    jest: {projectType: 'custom', configFile: 'tests/unit/jest.config.mjs', enableFindRelatedTests: false},
    reporters: ['clear-text', 'progress'],
    coverageAnalysis: 'perTest',
    concurrency: 3,
    timeoutMS: 5000,
    cleanTempDir: 'always',
    ignorePatterns: ['.worktrees', 'build', 'tests/browser/coverage', 'tests/inject/coverage', 'tests/perf/results'],
};
