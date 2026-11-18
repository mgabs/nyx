import {findClosingParenthesis} from '../../../src/inject/lean-theme/import-conditions';

describe('Lean import condition parentheses', () => {
    test.each([
        ['supports(display: grid) screen', 8],
        ['supports((display: grid) and (color: red)) print', 8],
        ['supports(content: ")") screen', 8],
        ["supports(content: ')') screen", 8],
        ['supports(content: "\\\")") screen', 8],
        ['supports(content: "\\\\") screen', 8],
    ])('finds the closing parenthesis in %s', (condition, start) => {
        expect(findClosingParenthesis(condition, start)).toBe(condition.lastIndexOf(')'));
    });

    test.each([
        'supports((display: grid)',
        'supports(content: ")',
        'supports(content: "escaped\\',
    ])('returns -1 for an unfinished condition %s', (condition) => {
        expect(findClosingParenthesis(condition, 8)).toBe(-1);
    });
});
