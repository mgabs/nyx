import {getRemovedAdoptedSheets, getUntrackedAdoptedSheets} from '../../../src/inject/lean-theme/adopted-reconciliation';

describe('Lean adopted stylesheet reconciliation', () => {
    test('finds removed sheets by identity and preserves tracked order', () => {
        const a = {};
        const b = {};
        const c = {};
        const removed = getRemovedAdoptedSheets([b], [a, b, c]);
        expect(removed).toHaveLength(2);
        expect(removed[0]).toBe(a);
        expect(removed[1]).toBe(c);
        expect(getRemovedAdoptedSheets([a, b, c], [a, b, c])).toEqual([]);
        const allRemoved = getRemovedAdoptedSheets([], [a, b]);
        expect(allRemoved).toHaveLength(2);
        expect(allRemoved[0]).toBe(a);
        expect(allRemoved[1]).toBe(b);
    });

    test('returns only new page sheets, in order and without duplicates', () => {
        const tracked = {};
        const owned = {};
        const first = {};
        const second = {};
        const sheetMap = new Map([[tracked, true]]);
        const actual = getUntrackedAdoptedSheets([owned, first, tracked, second, first], sheetMap, (sheet) => sheet === owned);
        expect(actual).toHaveLength(2);
        expect(actual[0]).toBe(first);
        expect(actual[1]).toBe(second);
        expect(getUntrackedAdoptedSheets([], sheetMap, () => false)).toEqual([]);
    });
});
