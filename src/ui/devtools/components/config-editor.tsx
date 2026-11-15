import {m} from 'malevic';
import {getContext} from 'malevic/dom';

import {DEVTOOLS_DOCS_URL} from '../../../utils/links';
import {Button, MessageBox} from '../../controls';

interface ConfigEditorProps {
    header?: string;
    text: string;
    apply?: (text: string) => Promise<void>;
    reset?: () => void;
    delete?: () => void;
}

const boundTabListeners = new WeakSet<HTMLTextAreaElement>();

export function ConfigEditor(props: ConfigEditorProps): Malevic.Child {
    const context = getContext();
    const store = context.getStore({
        dialogMessage: '',
        dialogAction: null as (() => void) | null,
        errorText: '',
    });

    let textNode: HTMLTextAreaElement;

    function onTextRender(node: HTMLTextAreaElement) {
        textNode = node;

        if (!store.errorText) {
            textNode.value = props.text;
        }

        if (boundTabListeners.has(node)) {
            return;
        }
        boundTabListeners.add(node);

        node.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const indent = ' '.repeat(4);
                const start = node.selectionStart;
                const end = node.selectionEnd;
                node.setRangeText(indent, start, end, 'end');
            }
        });
    }

    async function apply(): Promise<void> {
        const text = textNode.value;
        try {
            await props.apply!(text);
            store.errorText = '';
        } catch (err) {
            store.errorText = String(err);
        }
        context.refresh();
    }

    function showDialog(message: string, action: () => void): void {
        store.dialogMessage = message;
        store.dialogAction = action;
        context.refresh();
    }

    function hideDialog(): void {
        store.dialogMessage = '';
        store.dialogAction = null;
        context.refresh();
    }

    function reset(): void {
        store.dialogMessage = '';
        store.dialogAction = null;
        store.errorText = '';
        props.reset!();
        context.refresh();
    }

    function remove(): void {
        store.dialogMessage = '';
        store.dialogAction = null;
        store.errorText = '';
        props.delete!();
        context.refresh();
    }

    function showResetDialog() {
        showDialog(
            'Are you sure you want to remove the current changes? You cannot restore them later.',
            reset,
        );
    }

    function showDeleteDialog() {
        showDialog(
            'Are you sure you want to delete the fix?',
            remove,
        );
    }

    const dialog = store.dialogMessage && store.dialogAction ? (
        <MessageBox
            caption={store.dialogMessage}
            onOK={store.dialogAction}
            onCancel={hideDialog}
        />
    ) : null;

    return (
        <div class="config-editor">
            {props.header ? <h3 class="sub-title">{props.header}</h3> : null}
            <textarea
                class="editor"
                onrender={onTextRender}
                spellcheck="false"
                autocorrect="off"
                autocomplete="off"
                autocapitalize="off"
            />
            <label class="error-text">{store.errorText}</label>
            <div class="buttons">
                {props.delete ? <Button onclick={showDeleteDialog}>Delete</Button> : null}
                {props.reset ? <Button onclick={showResetDialog}>Reset changes</Button> : null}
                {props.apply ? <Button onclick={apply}>Apply</Button> : null}
            </div>
            <p class="description">
                Read about this tool <strong><a href={DEVTOOLS_DOCS_URL} target="_blank" rel="noopener noreferrer">here</a></strong>.
                If a <strong>popular</strong> website looks incorrect,
                open an issue in the <strong>Nyx</strong> repository.
            </p>
            {dialog}
        </div>
    );
}
