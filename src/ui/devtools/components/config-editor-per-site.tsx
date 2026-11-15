import {m} from 'malevic';
import {getContext} from 'malevic/dom';

import {normalizeURLKey} from '../../../generators/utils/overrides';
import {Button, TextBox} from '../../controls';
import type {ConfigEditorProps, SiteFix} from '../types';

import {ConfigEditor} from './config-editor';
import {applyPerSiteEdit, buildPerSiteEntries, resetPerSiteOverride} from './per-site-helpers';
import type {PerSiteEntry} from './per-site-helpers';

export function PerSiteConfigEditor(props: ConfigEditorProps): Malevic.Child {
    const context = getContext();
    const store = context.getStore({
        entries: [] as PerSiteEntry[],
        overrides: [] as SiteFix[],
        overridesText: null as string | null,
        defaultsText: null as string | null,
        search: '',
        currentKey: null as string | null,
    });

    const overridesText = props.devtools[props.type] || '';
    const defaultsText = props.devtools.defaults?.[props.type] || '';
    const didFixesChange = store.overridesText !== overridesText || store.defaultsText !== defaultsText;
    if (didFixesChange) {
        store.overrides = overridesText ? props.parse(overridesText) : [];
        store.entries = buildPerSiteEntries(defaultsText, overridesText, props.parse);
        store.overridesText = overridesText;
        store.defaultsText = defaultsText;
    }

    const currentEntry = store.currentKey
        ? store.entries.find((e) => e.key === store.currentKey) ?? null
        : null;
    if (store.currentKey && !currentEntry) {
        store.currentKey = null;
    }

    function onSearchInput(e: Event) {
        const element = e.target as HTMLInputElement;
        store.search = element.value;
        store.currentKey = null;
        context.refresh();
    }

    async function apply(text: string) {
        const nextConfig = applyPerSiteEdit(
            store.overrides,
            store.currentKey!,
            text,
            props.parse,
            props.format,
        );
        const [updated] = props.parse(text);
        store.currentKey = normalizeURLKey(updated.url);
        await props.actions.applyDevFixes(props.type, nextConfig);
    }

    async function resetSelected() {
        if (!store.currentKey) {
            return;
        }
        const nextConfig = resetPerSiteOverride(store.overrides, store.currentKey, props.format);
        await props.actions.applyDevFixes(props.type, nextConfig);
    }

    async function deleteSelected() {
        if (!store.currentKey) {
            return;
        }
        const nextConfig = resetPerSiteOverride(store.overrides, store.currentKey, props.format);
        store.currentKey = null;
        await props.actions.applyDevFixes(props.type, nextConfig);
    }

    async function addNewFix() {
        const newFixURL = store.search.trim();
        if (!newFixURL) {
            ((context.node as Element).querySelector('.js-search') as HTMLInputElement).focus();
            return;
        }
        const newFix = props.create(newFixURL);
        const nextOverrides = store.overrides.concat(newFix);
        store.currentKey = normalizeURLKey(newFix.url);
        const config = props.format(nextOverrides);
        await props.actions.applyDevFixes(props.type, config);
        context.refresh();
    }

    const fixText = currentEntry ? props.format([currentEntry.fix]) : '';
    const filteredEntries = store.search
        ? store.entries.filter(({fix}) => fix.url.some((u) => u.includes(store.search)))
        : store.entries;

    return (
        <div class="config-editor-per-site">
            <div class="config-editor-per-site__search-wrapper">
                <TextBox class="config-editor-per-site__search-input js-search" type="text" oninput={onSearchInput} placeholder="Search by URL" />
            </div>
            <list class="config-editor-per-site__urls">
                {filteredEntries.map((entry) => {
                    const text = entry.fix.url.join(' ');
                    return <li>
                        <Button
                            class={{
                                'config-editor-per-site__url': true,
                                'config-editor-per-site__url--active': entry.key === store.currentKey,
                                [`config-editor-per-site__url--${entry.status}`]: true,
                            }}
                            onclick={() => {
                                store.currentKey = entry.key === store.currentKey ? null : entry.key;
                                context.refresh();
                            }}
                        >
                            {entry.status === 'default' ? text : `${text} [${entry.status}]`}
                        </Button>
                    </li>;
                })}
            </list>
            {currentEntry ? (
                <ConfigEditor
                    text={fixText}
                    apply={apply}
                    reset={currentEntry.status === 'overridden' ? resetSelected : undefined}
                    delete={currentEntry.status === 'custom' ? deleteSelected : undefined}
                />
            ) : (
                <div class="config-editor-per-site__add-fix">
                    <Button onclick={addNewFix} class="config-editor-per-site__add-fix__button">
                        Create new fix
                    </Button>
                    <p class="config-editor-per-site__add-fix__description">
                        Search for an <strong>existing fix</strong> or enter a <strong>domain name</strong><br />for a new fix and click <strong>Create</strong>
                    </p>
                </div>
            )}
        </div>
    );
}
