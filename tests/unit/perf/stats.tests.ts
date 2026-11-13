import {createSeriesRecord, formatSummaryTable, percentile, summarizeSamples} from '../../perf/stats.cjs';

describe('perf stats', () => {
    describe('percentile', () => {
        test('returns null for empty samples', () => {
            expect(percentile([], 50)).toBeNull();
            expect(percentile([], 95)).toBeNull();
        });

        test('returns exact value for single sample', () => {
            expect(percentile([42], 50)).toBe(42);
            expect(percentile([42], 95)).toBe(42);
        });

        test('computes linear-interpolated percentiles on unsorted samples', () => {
            expect(percentile([40, 10, 30, 20], 50)).toBe(25);
            expect(percentile([50, 10, 30, 20, 40], 50)).toBe(30);
            expect(percentile([10, 20, 30, 40, 50], 0)).toBe(10);
            expect(percentile([10, 20, 30, 40, 50], 100)).toBe(50);
            expect(percentile([10, 20, 30, 40, 50], 95)).toBeCloseTo(48, 6);
        });

        test('throws on out-of-range percentile', () => {
            expect(() => percentile([1, 2], -1)).toThrow();
            expect(() => percentile([1, 2], 101)).toThrow();
        });
    });

    describe('summarizeSamples', () => {
        test('returns null stats for empty samples', () => {
            expect(summarizeSamples([])).toEqual({
                sampleCount: 0,
                medianMs: null,
                p95Ms: null,
                meanMs: null,
                cvPercent: null,
            });
        });

        test('computes median, p95, mean, and CV% for valid samples', () => {
            const summary = summarizeSamples([10, 12, 14, 16, 18]);
            expect(summary.sampleCount).toBe(5);
            expect(summary.medianMs).toBe(14);
            expect(summary.p95Ms).toBeCloseTo(17.6, 6);
            expect(summary.meanMs).toBe(14);
            expect(summary.cvPercent).toBeGreaterThan(0);
        });

        test('handles zero-mean samples without NaN', () => {
            const summary = summarizeSamples([0, 0, 0]);
            expect(summary.meanMs).toBe(0);
            expect(summary.cvPercent).toBe(0);
        });
    });

    describe('createSeriesRecord', () => {
        test('preserves raw samples, failures, and null reason metrics', () => {
            const record = createSeriesRecord({
                browser: 'firefox',
                engine: 'dynamicTheme',
                fixture: 'article',
                cacheMode: 'cold',
                warmupCount: 5,
                samplesMs: [12.5, 15.5, 14.0],
                failures: 1,
                longTasksCount: {value: null, reason: 'Chromium CDP tracing unavailable on Firefox'},
                observedBrightFrames: {value: 0},
            });

            expect(record.browser).toBe('firefox');
            expect(record.sampleCount).toBe(3);
            expect(record.samplesMs).toEqual([12.5, 15.5, 14.0]);
            expect(record.failures).toBe(1);
            expect(record.medianMs).toBe(14.0);
            expect(record.longTasksCount).toEqual({value: null, reason: 'Chromium CDP tracing unavailable on Firefox'});
            expect(record.observedBrightFrames).toEqual({value: 0});
        });
    });

    describe('formatSummaryTable', () => {
        test('formats series rows including null metrics', () => {
            const table = formatSummaryTable([
                createSeriesRecord({
                    browser: 'chrome-mv3',
                    engine: 'dynamicTheme',
                    fixture: 'article',
                    cacheMode: 'cold',
                    warmupCount: 5,
                    samplesMs: [10, 20],
                    failures: 0,
                    longTasksCount: {value: 1},
                    observedBrightFrames: {value: 0},
                }),
                createSeriesRecord({
                    browser: 'firefox',
                    engine: 'dynamicTheme',
                    fixture: 'article',
                    cacheMode: 'warm',
                    warmupCount: 5,
                    samplesMs: [],
                    failures: 2,
                    longTasksCount: {value: null, reason: 'Unsupported'},
                    observedBrightFrames: {value: null, reason: 'Unsupported'},
                }),
            ]);

            expect(table).toContain('chrome-mv3');
            expect(table).toContain('firefox');
            expect(table).toContain('dynamicTheme');
            expect(table).toContain('n/a');
        });
    });
});
