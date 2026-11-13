export interface MetricValue {
    value: number | null;
    reason?: string;
}

export interface SeriesInput {
    browser: 'chrome-mv3' | 'firefox';
    engine: string;
    fixture: string;
    cacheMode: 'cold' | 'warm';
    warmupCount: number;
    samplesMs: number[];
    failures: number;
    longTasksCount: MetricValue;
    observedBrightFrames: MetricValue;
}

export interface SeriesRecord extends SeriesInput {
    sampleCount: number;
    medianMs: number | null;
    p95Ms: number | null;
    meanMs: number | null;
    cvPercent: number | null;
}

export function percentile(samples: number[], p: number): number | null;

export function summarizeSamples(samples: number[]): {
    sampleCount: number;
    medianMs: number | null;
    p95Ms: number | null;
    meanMs: number | null;
    cvPercent: number | null;
};

export function createSeriesRecord(input: SeriesInput): SeriesRecord;

export function formatSummaryTable(seriesList: SeriesRecord[]): string;
