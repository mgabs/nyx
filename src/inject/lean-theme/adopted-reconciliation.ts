export function getRemovedAdoptedSheets<T>(current: readonly T[], tracked: Iterable<T>): T[] {
    const removed: T[] = [];
    for (const sheet of tracked) {
        if (!current.includes(sheet)) {
            removed.push(sheet);
        }
    }
    return removed;
}

export function getUntrackedAdoptedSheets<T>(current: readonly T[], tracked: ReadonlyMap<T, unknown>, owns: (sheet: T) => boolean): T[] {
    const added: T[] = [];
    const seen = new Set<T>();
    for (const sheet of current) {
        if (!owns(sheet) && !tracked.has(sheet) && !seen.has(sheet)) {
            seen.add(sheet);
            added.push(sheet);
        }
    }
    return added;
}
