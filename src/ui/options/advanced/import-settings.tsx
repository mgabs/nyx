import {m} from 'malevic';
import {getContext} from 'malevic/dom';

import type {DevFixType, ExportedSettings, ViewProps} from '../../../definitions';
import {validateDevToolsOverrides, validateSettings} from '../../../utils/validation';
import {Button, ControlGroup, MessageBox} from '../../controls';
import {openFile} from '../../utils';

const DEV_FIX_TYPES: DevFixType[] = ['detector', 'dynamic', 'filter', 'static'];

export function ImportSettings(props: ViewProps): Malevic.Child {
    const context = getContext();

    function showDialog(caption: string) {
        context.store.caption = caption;
        context.store.isDialogVisible = true;
        context.refresh();
    }

    function hideDialog() {
        context.store.isDialogVisible = false;
        context.refresh();
    }

    const dialog = context && context.store.isDialogVisible ? (
        <MessageBox
            caption={context.store.caption}
            onOK={hideDialog}
            onCancel={hideDialog}
            hideCancel={true}
        />
    ) : null;

    function showWarningDialog() {
        context.store.isWarningDialogVisible = true;
        context.refresh();
    }

    function hideWarningDialog() {
        context.store.isWarningDialogVisible = false;
        context.refresh();
    }

    const warningDialog = context.store.isWarningDialogVisible ? (
        <MessageBox
            caption="Warning! Your current settings will be overwritten. Click OK to proceed."
            onOK={importSettings}
            onCancel={hideWarningDialog}
        />
    ) : null;

    function importSettings() {
        hideWarningDialog();
        openFile({extensions: ['json']}, async (result: string) => {
            try {
                const content: ExportedSettings = JSON.parse(result);
                const {settings, errors} = validateSettings(content);
                const devToolsResult = validateDevToolsOverrides(content.devTools);
                const allErrors = errors.concat(devToolsResult.errors);
                const count = allErrors.length;
                if (count) {
                    console.error('Could not validate imported settings', allErrors, result, content);
                    showDialog(`The given file has incorrect JSON: ${count > 1 ? `${count} errors, including ${allErrors[0]}` : allErrors[0]}`);
                    return;
                }
                props.actions.changeSettings(settings);
                if (content.devTools !== undefined) {
                    await Promise.all(
                        DEV_FIX_TYPES.map((type) => {
                            const text = devToolsResult.devTools[type];
                            if (text) {
                                return props.actions.applyDevFixes(type, text);
                            }
                            props.actions.resetDevFixes(type);
                            return Promise.resolve();
                        }),
                    );
                }
                showDialog('Settings imported');
            } catch (err) {
                console.error(err);
                showDialog('Failed to read file');
            }
        });
    }

    return (
        <ControlGroup>
            <ControlGroup.Control>
                <Button
                    onclick={showWarningDialog}
                    class="advanced__import-settings-button"
                >
                    Import Settings
                </Button>
                {dialog}
                {warningDialog}
            </ControlGroup.Control>
            <ControlGroup.Description>
                Open settings from a JSON file
            </ControlGroup.Description>
        </ControlGroup>
    );
}
