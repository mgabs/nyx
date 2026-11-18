export function orderAdoptedOutputs<T>(sheets: readonly T[], managers: ReadonlyMap<T, {outSheet: T | null}>, anchor: T | null | undefined): T[] | null {
    const outputs = sheets.map((sheet) => managers.get(sheet)?.outSheet).filter((sheet): sheet is T => Boolean(sheet));
    if (outputs.length === 0) {
        return null;
    }
    const outputSet = new Set(outputs);
    const ordered = sheets.filter((sheet) => !outputSet.has(sheet));
    const index = anchor ? ordered.indexOf(anchor) : -1;
    ordered.splice(index < 0 ? ordered.length : index, 0, ...outputs);
    if (ordered.length === sheets.length && ordered.every((sheet, i) => sheet === sheets[i])) {
        return null;
    }
    return ordered;
}
