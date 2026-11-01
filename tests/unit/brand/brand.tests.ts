import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {rootPath} from '../../support/test-utils';

describe('Brand Identity & MIT Attribution Specification', () => {
    describe('REQ-BRAND-1: Manifest & Extension Metadata Rebrand', () => {
        test('package.json must identify name as Nyx and tagline as Instant Dark Mode for the Web. Zero White Flash.', async () => {
            const pkgRaw = await fs.readFile(rootPath('package.json'), 'utf8');
            const pkg = JSON.parse(pkgRaw);

            expect(pkg.name).toBe('Nyx');
            expect(pkg.description).toBe('Instant Dark Mode for the Web. Zero White Flash.');
        });

        test('src/manifest.json must identify name as Nyx and tagline as Instant Dark Mode for the Web. Zero White Flash.', async () => {
            const manifestRaw = await fs.readFile(rootPath('src/manifest.json'), 'utf8');
            const manifest = JSON.parse(manifestRaw);

            expect(manifest.name).toBe('Nyx');
            expect(manifest.description).toBe('Instant Dark Mode for the Web. Zero White Flash.');
            if (manifest.browser_action && manifest.browser_action.default_title) {
                expect(manifest.browser_action.default_title).toBe('Nyx');
            }
        });

        test('src/manifest-chrome-mv3.json must have action default_title as Nyx', async () => {
            const manifestRaw = await fs.readFile(rootPath('src/manifest-chrome-mv3.json'), 'utf8');
            const manifest = JSON.parse(manifestRaw);

            expect(manifest.action.default_title).toBe('Nyx');
        });

        test('tasks/bundle-manifest.js source contains Nyx branding', async () => {
            const bundleManifestRaw = await fs.readFile(rootPath('tasks/bundle-manifest.js'), 'utf8');

            expect(bundleManifestRaw).toContain("'Nyx'");
            expect(bundleManifestRaw).toContain('Instant Dark Mode for the Web. Zero White Flash.');
            expect(bundleManifestRaw).not.toContain("'Dark Reader MV3 Plus' : 'Dark Reader MV3'");
            expect(bundleManifestRaw).toContain("'Nyx MV3 Plus' : 'Nyx MV3'");
        });

        test('tasks/bundle-manifest.js patchManifest generates valid Nyx manifests across platforms and branches', async () => {
            const bundleModule = await (eval("import('../../../tasks/bundle-manifest.js')") as Promise<any>);
            const platformModule = await (eval("import('../../../tasks/platform.js')") as Promise<any>);
            const {patchManifest} = bundleModule;
            const {PLATFORM} = platformModule;

            // Production builds for all supported platforms with manifests
            const prodPlatforms = [
                PLATFORM.CHROMIUM_MV2,
                PLATFORM.CHROMIUM_MV3,
                PLATFORM.FIREFOX_MV2,
                PLATFORM.THUNDERBIRD,
            ];

            for (const platform of prodPlatforms) {
                const manifest = await patchManifest(platform, false, false, false);
                expect(manifest.name).toBe('Nyx');
                expect(manifest.description).toBe('Instant Dark Mode for the Web. Zero White Flash.');
                expect(manifest.permissions).not.toContain('downloads');
            }

            // MV3 debug builds with watch = true
            const debugMV3Watch = await patchManifest(PLATFORM.CHROMIUM_MV3, true, true, false);
            expect(debugMV3Watch.name).toBe('Nyx MV3');
            expect(debugMV3Watch.version).toBe('1');
            expect(debugMV3Watch.description).toContain('watch: yes');
            expect(debugMV3Watch.permissions).toContain('tabs');
            expect(debugMV3Watch.permissions).toContain('downloads');
            expect(debugMV3Watch.browser_action).toBeUndefined();

            // MV3 debug builds with test = true (tabs not added)
            const debugMV3Test = await patchManifest(PLATFORM.CHROMIUM_MV3, true, false, true);
            expect(debugMV3Test.description).toContain('watch: no');

            // MV2 debug builds
            const debugMV2 = await patchManifest(PLATFORM.CHROMIUM_MV2, true, false, false);
            expect(debugMV2.name).toBe('Nyx');
            expect(debugMV2.version_name).toBe('Debug');

            // Production with test = true gets downloads permission
            const testManifest = await patchManifest(PLATFORM.CHROMIUM_MV2, false, false, true);
            expect(testManifest.permissions).toContain('downloads');

            // Plus debug builds if plus folder exists
            if (existsSync(rootPath('src/plus/manifest.json'))) {
                const debugMV3Plus = await patchManifest(PLATFORM.CHROMIUM_MV3_PLUS, true, false, false);
                expect(debugMV3Plus.name).toBe('Nyx MV3 Plus');
                expect(debugMV3Plus.version_name).toBe('Debug Plus');
            }
        });
    });

    describe('REQ-BRAND-2: MIT License Attribution Preservation', () => {
        test('LICENSE must preserve original 2026 Dark Reader Ltd. copyright intact', async () => {
            const license = await fs.readFile(rootPath('LICENSE'), 'utf8');

            expect(license).toContain('Copyright (c) 2026 Dark Reader Ltd.');
        });

        test('LICENSE must append Nyx contributors copyright notice', async () => {
            const license = await fs.readFile(rootPath('LICENSE'), 'utf8');

            expect(license).toMatch(/Copyright \(c\) 2026 (?:Nyx [Cc]ontributors|Nyx Contributors\.)/);
        });

        test('LICENSE must retain complete MIT license terms and disclaimer unchanged', async () => {
            const license = await fs.readFile(rootPath('LICENSE'), 'utf8');

            expect(license).toContain('Permission is hereby granted, free of charge, to any person obtaining a copy');
            expect(license).toContain('The above copyright notice and this permission notice shall be included in all');
            expect(license).toContain('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND');
        });
    });
});
