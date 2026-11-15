import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

import {prepareCSPMV3} from '../../../src/utils/csp';

describe('Check that CSP matches expected one', () => {
    it('CSP should match', async () => {
        const file = join(__dirname, '../../../src/manifest.json');
        const manifest: chrome.runtime.Manifest = JSON.parse(await readFile(file, {encoding: 'utf-8'}));
        expect(manifest.content_security_policy).toEqual(prepareCSPMV3());
    });

    it('Firefox manifest should be MV3 with event page, action, host_permissions, and no navigate-to CSP', async () => {
        const file = join(__dirname, '../../../src/manifest-firefox.json');
        const manifest = JSON.parse(await readFile(file, {encoding: 'utf-8'}));
        expect(manifest.manifest_version).toBe(3);
        expect(manifest.browser_specific_settings?.gecko?.strict_min_version).toBe('128.0');
        expect(manifest.background).toEqual({scripts: ['background/index.js']});
        expect(manifest.action?.default_title).toBe('Nyx');
        expect(manifest.browser_action).toBeUndefined();
        expect(manifest.host_permissions).toEqual(['<all_urls>']);
        expect(manifest.permissions).toContain('scripting');
        expect(manifest.permissions).not.toContain('<all_urls>');
        expect(manifest.content_security_policy?.extension_pages).toBeDefined();
        expect(manifest.content_security_policy?.extension_pages).not.toContain('navigate-to');
    });
});
