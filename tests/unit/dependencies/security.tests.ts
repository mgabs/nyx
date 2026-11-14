import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const requireDependency = createRequire(resolve(process.cwd(), 'package.json'));

describe('Development dependency security', () => {
    test('minimatch bounds globparts amplification at optimization level 2', () => {
        const {Minimatch} = requireDependency('minimatch');
        const pattern = Array(12).fill('**/../a/b').join('/');
        const matcher = new Minimatch(pattern, {optimizationLevel: 2, braceExpandMax: 64});
        expect(matcher.set.length).toBe(64);
        const simple = new Minimatch('**/../a/b/**/../c/d', {optimizationLevel: 2});
        expect(simple.match('../a/b/../c/d')).toBe(true);
        expect(simple.match('x/a/b/y/c/d')).toBe(true);
    });

    test.each(['jest-config', '@rollup/plugin-node-resolve'])('%s merges without poisoning the returned prototype', (consumer) => {
        const requireConsumer = createRequire(requireDependency.resolve(consumer));
        const merge = requireConsumer('deepmerge');
        const poisoned = JSON.parse('{"__proto__":{"poisoned":true},"safe":{"value":1}}');

        for (const result of [merge(poisoned, {}), merge(Object.create(null), poisoned)]) {
            expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
            expect(result.poisoned).toBeUndefined();
            expect(result.safe).toEqual({value: 1});
        }
        expect(merge.all([{nested: {left: true}, items: [1]}, {nested: {right: true}, items: [2]}])).toEqual({
            nested: {left: true, right: true},
            items: [1, 2],
        });
    });
});
