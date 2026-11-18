import {orderAdoptedOutputs} from '../../../src/inject/lean-theme/adopted-order';

describe('Lean adopted output ordering', () => {
    test('keeps page sheet order and places generated sheets before the override', () => {
        const first = {};
        const second = {};
        const firstOutput = {};
        const secondOutput = {};
        const override = {};
        const input = [secondOutput, first, override, second, firstOutput];
        const managers = new Map([[first, {outSheet: firstOutput}], [second, {outSheet: secondOutput}]]);
        const result = orderAdoptedOutputs(input, managers, override)!;
        expect(result).toHaveLength(5);
        for (const [i, value] of [first, firstOutput, secondOutput, override, second].entries()) {
            expect(result[i]).toBe(value);
        }
        expect(input[0]).toBe(secondOutput);
    });

    test('orders generated sheets by their current page sheets and returns null when already ordered', () => {
        const first = {};
        const second = {};
        const firstOutput = {};
        const secondOutput = {};
        const override = {};
        const managers = new Map([[first, {outSheet: firstOutput}], [second, {outSheet: secondOutput}]]);
        const ordered = [second, first, secondOutput, firstOutput, override];
        expect(orderAdoptedOutputs(ordered, managers, override)).toBeNull();
        const reordered = orderAdoptedOutputs([first, second, secondOutput, firstOutput, override], managers, override)!;
        expect(reordered[2]).toBe(firstOutput);
        expect(reordered[3]).toBe(secondOutput);
    });

    test('places generated output before an anchor at index zero', () => {
        const page = {};
        const output = {};
        const anchor = {};
        const managers = new Map([[page, {outSheet: output}]]);
        const result = orderAdoptedOutputs([anchor, page, output], managers, anchor)!;
        expect(result[0]).toBe(output);
        expect(result[1]).toBe(anchor);
        expect(result[2]).toBe(page);
    });

    test('removes duplicate output sheets even when their prefix is already ordered', () => {
        const page = {};
        const output = {};
        const managers = new Map([[page, {outSheet: output}]]);
        const result = orderAdoptedOutputs([page, output, output], managers, undefined)!;
        expect(result).toHaveLength(2);
        expect(result[0]).toBe(page);
        expect(result[1]).toBe(output);
    });

    test('avoids rebuilding the order when no generated output exists', () => {
        const page = {};
        const input = [page];
        const filter = jest.spyOn(input, 'filter');
        expect(orderAdoptedOutputs(input, new Map(), undefined)).toBeNull();
        expect(filter).not.toHaveBeenCalled();
    });

    test('appends output when the anchor is absent and ignores missing outputs', () => {
        const page = {};
        const output = {};
        const unrelated = {};
        const managers = new Map([[page, {outSheet: output}], [unrelated, {outSheet: null}]]);
        const result = orderAdoptedOutputs([output, page, unrelated], managers, undefined)!;
        expect(result[0]).toBe(page);
        expect(result[1]).toBe(unrelated);
        expect(result[2]).toBe(output);
        const missingAnchor = {};
        expect(orderAdoptedOutputs([page, output], managers, missingAnchor)).toBeNull();
        expect(orderAdoptedOutputs([unrelated], managers, undefined)).toBeNull();
    });
});
