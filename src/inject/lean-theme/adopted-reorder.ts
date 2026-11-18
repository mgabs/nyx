import {toArray} from '../../utils/array';
import type {AdoptedEmitter} from './adopted-emitter';
import type {AdoptedSheetEntry} from './adopted-sync';
import {orderAdoptedOutputs} from './adopted-order';
import {applyAdoptedOrder} from './adopted-apply';

export function reorderAdoptedOutputs(root: Document | ShadowRoot, options: {
    managersByRoot: Map<Document | ShadowRoot, Map<CSSStyleSheet, AdoptedSheetEntry>>;
    emitter: AdoptedEmitter | null;
    getSheets: (root: Document | ShadowRoot) => CSSStyleSheet[];
}): void {
    const {managersByRoot, emitter, getSheets} = options;
    const managers = managersByRoot.get(root);
    if (!managers || !emitter) {
        return;
    }
    const pageSheets = getSheets(root);
    const sheets = toArray(pageSheets);
    const ordered = orderAdoptedOutputs<CSSStyleSheet>(sheets, managers, emitter.getNamedSheet(root, 'override'));
    if (!ordered) {
        return;
    }
    applyAdoptedOrder(root, pageSheets, ordered);
}
