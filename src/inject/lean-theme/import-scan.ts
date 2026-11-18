export function* findCSSImports(source: string): Generator<RegExpExecArray> {
    const importPattern = /@import\s+(url\(\s*(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^)]*)\s*\)|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')\s*((?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^;"'])*);/gi;
    let cursor = 0;
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (const match of source.matchAll(importPattern)) {
        while (cursor < match.index) {
            const character = source[cursor++];
            if (escaped) {
                escaped = false;
            } else if (character === '\\') {
                escaped = true;
            } else if (quote) {
                if (character === quote) {
                    quote = '';
                }
            } else if (character === '"' || character === "'") {
                quote = character;
            } else if (character === '{') {
                depth++;
            } else if (character === '}') {
                depth = Math.max(0, depth - 1);
            }
        }
        if (!quote && depth === 0) {
            yield match;
        }
    }
}
