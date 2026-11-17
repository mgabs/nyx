import type {Theme} from '../../definitions';

export type LeanStyleRoot = Document | ShadowRoot;

export interface AdoptedSheetReconciler {
    reconcile(root: LeanStyleRoot, theme: Theme): void;
    destroy(): void;
}

export interface LeanCancellation {
    isCancelled(): boolean;
    cancel(): void;
}

export interface LeanDocumentExporter {
    serializeDocumentCSS(): string;
}
