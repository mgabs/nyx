export function findClosingParenthesis(value: string, start: number): number {
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let i = start; i < value.length; i++) {
        const character = value[i];
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
        } else if (character === '(') {
            depth++;
        } else if (character === ')' && --depth === 0) {
            return i;
        }
    }
    return -1;
}
