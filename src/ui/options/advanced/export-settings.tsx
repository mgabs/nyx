import {m} from 'malevic';

import type {DevFixType, ExportedSettings, ViewProps} from '../../../definitions';
import {Button, ControlGroup} from '../../controls';
import {saveFile} from '../../utils';

const DEV_FIX_TYPES: DevFixType[] = ['detector', 'dynamic', 'filter', 'static'];

export function ExportSettings(props: ViewProps): Malevic.Child {
    async function exportSettings() {
        const devToolsData = await props.actions.getDevToolsData?.();
        const devTools: Partial<Record<DevFixType, string>> = {};
        if (devToolsData) {
            DEV_FIX_TYPES.forEach((type) => {
                if (devToolsData[type]) {
                    devTools[type] = devToolsData[type];
                }
            });
        }
        const payload: ExportedSettings = Object.keys(devTools).length > 0
            ? {...props.data.settings, devTools}
            : props.data.settings;
        saveFile('Nyx-Settings.json', JSON.stringify(payload, null, 4));
    }

    return (
        <ControlGroup>
            <ControlGroup.Control>
                <Button
                    onclick={exportSettings}
                    class="advanced__export-settings-button"
                >
                    Export Settings
                </Button>
            </ControlGroup.Control>
            <ControlGroup.Description>
                Save settings to a JSON file
            </ControlGroup.Description>
        </ControlGroup>
    );
}
