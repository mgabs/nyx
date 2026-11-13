// @ts-check

/**
 * Computes a percentile (0-100) from a numeric array using linear interpolation.
 * @param {number[]} samples
 * @param {number} p
 * @returns {number | null}
 */
function percentile(samples, p) {
    if (p < 0 || p > 100 || Number.isNaN(p)) {
        throw new RangeError(`Percentile must be between 0 and 100, got ${p}`);
    }
    if (samples.length === 0) {
        return null;
    }
    const sorted = samples.slice().sort((a, b) => a - b);
    if (sorted.length === 1) {
        return sorted[0];
    }
    const rank = (p / 100) * (sorted.length - 1);
    const low = Math.floor(rank);
    const high = Math.ceil(rank);
    const weight = rank - low;
    return sorted[low] * (1 - weight) + sorted[high] * weight;
}

/**
 * Computes sample count, median, p95, mean, and coefficient of variation (%).
 * @param {number[]} samples
 * @returns {{sampleCount: number; medianMs: number | null; p95Ms: number | null; meanMs: number | null; cvPercent: number | null}}
 */
function summarizeSamples(samples) {
    const sampleCount = samples.length;
    if (sampleCount === 0) {
        return {
            sampleCount: 0,
            medianMs: null,
            p95Ms: null,
            meanMs: null,
            cvPercent: null,
        };
    }

    const sum = samples.reduce((acc, v) => acc + v, 0);
    const meanMs = sum / sampleCount;
    const medianMs = percentile(samples, 50);
    const p95Ms = percentile(samples, 95);

    if (meanMs === 0) {
        return {sampleCount, medianMs, p95Ms, meanMs: 0, cvPercent: 0};
    }

    const variance = samples.reduce((acc, v) => acc + ((v - meanMs) ** 2), 0) / sampleCount;
    const stdDev = Math.sqrt(variance);
    const cvPercent = (stdDev / meanMs) * 100;

    return {sampleCount, medianMs, p95Ms, meanMs, cvPercent};
}

/**
 * Builds a structured benchmark series record.
 * @param {{
 *   browser: 'chrome-mv3' | 'firefox';
 *   engine: string;
 *   fixture: string;
 *   cacheMode: 'cold' | 'warm';
 *   warmupCount: number;
 *   samplesMs: number[];
 *   failures: number;
 *   longTasksCount: {value: number | null; reason?: string};
 *   observedBrightFrames: {value: number | null; reason?: string};
 * }} input
 */
function createSeriesRecord(input) {
    const stats = summarizeSamples(input.samplesMs);
    return {
        ...input,
        ...stats,
    };
}

/**
 * Formats an array of series records into a plain-text summary table.
 * @param {Array<ReturnType<typeof createSeriesRecord>>} seriesList
 * @returns {string}
 */
function formatSummaryTable(seriesList) {
    const header = 'Browser     | Engine          | Fixture     | Cache | N  | Fail | Median (ms) | p95 (ms) | CV (%)';
    const sep =    '------------|-----------------|-------------|-------|----|------|-------------|----------|-------';
    const rows = seriesList.map((s) => {
        const med = s.medianMs === null ? 'n/a' : s.medianMs.toFixed(2);
        const p95 = s.p95Ms === null ? 'n/a' : s.p95Ms.toFixed(2);
        const cv = s.cvPercent === null ? 'n/a' : s.cvPercent.toFixed(1);
        return [
            s.browser.padEnd(11),
            s.engine.padEnd(15),
            s.fixture.padEnd(11),
            s.cacheMode.padEnd(5),
            String(s.sampleCount).padEnd(2),
            String(s.failures).padEnd(4),
            med.padEnd(11),
            p95.padEnd(8),
            cv,
        ].join(' | ');
    });
    return [header, sep, ...rows].join('\n');
}

module.exports = {
    percentile,
    summarizeSamples,
    createSeriesRecord,
    formatSummaryTable,
};
