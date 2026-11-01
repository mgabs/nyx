import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const requireDependency = createRequire(resolve(process.cwd(), 'package.json'));

describe('Development dependency security', () => {
    test('minimatch bounds globparts amplification at optimization level 2', () => {
        const result = spawnSync(process.execPath, ['-e', `
            const assert = require('node:assert/strict');
            const {Minimatch} = require('minimatch');
            const pattern = Array(12).fill('**/../a/b').join('/');
            const matcher = new Minimatch(pattern, {optimizationLevel: 2, braceExpandMax: 64});
            assert.equal(matcher.set.length, 64);
            const simple = new Minimatch('**/../a/b/**/../c/d', {optimizationLevel: 2});
            assert(simple.match('../a/b/../c/d'));
            assert(simple.match('x/a/b/y/c/d'));
        `], {timeout: 5000, encoding: 'utf8'});

        expect(result.error).toBeUndefined();
        expect(result.status).toBe(0);
        expect(result.stderr).toBe('');
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
