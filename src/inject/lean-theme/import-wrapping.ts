import {findClosingParenthesis} from './import-conditions';

export function wrapImportConditions(css: string, conditionText: string): string | null {
    let conditions = conditionText.trim();
    const layer = /^layer(?:\(\s*([^)]*)\s*\))?\s*/i.exec(conditions);
    if (layer) {
        conditions = conditions.slice(layer[0].length);
    }
    let supports = '';
    if (/^supports\(/i.test(conditions)) {
        const start = conditions.indexOf('(');
        const end = findClosingParenthesis(conditions, start);
        if (end < 0) {
            return null;
        }
        supports = conditions.slice(start + 1, end).trim();
        conditions = conditions.slice(end + 1).trim();
    }
    if (conditions) {
        css = `@media ${conditions} { ${css} }`;
    }
    if (supports) {
        const query = supports.startsWith('(') || /^(not|selector|font-tech|font-format)\b/i.test(supports) ? supports : `(${supports})`;
        css = `@supports ${query} { ${css} }`;
    }
    if (layer) {
        css = `@layer${layer[1] ? ` ${layer[1].trim()}` : ''} { ${css} }`;
    }
    return css;
}
