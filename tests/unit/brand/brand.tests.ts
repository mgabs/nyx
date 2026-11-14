import fs from 'node:fs/promises';
import path from 'node:path';

describe('Brand Identity & MIT Attribution Specification', () => {
    const rootPath = (...parts: string[]) => path.resolve(__dirname, '../../../', ...parts);

    describe('REQ-BRAND-1: Manifest & Extension Metadata Rebrand', () => {
        test('package.json must identify name as Nyx, correct tagline, and repository as github.com/mgabs/nyx', async () => {
            const packageJsonRaw = await fs.readFile(rootPath('package.json'), 'utf8');
            const pkg = JSON.parse(packageJsonRaw);

            expect(pkg.name).toBe('Nyx');
            expect(pkg.description).toBe('Instant Dark Mode for the Web. Zero White Flash.');
            expect(pkg.repository.url).toBe('https://github.com/mgabs/nyx');
        });

        test('src/manifest.json must identify name as Nyx and tagline as Instant Dark Mode for the Web. Zero White Flash.', async () => {
            const manifestRaw = await fs.readFile(rootPath('src/manifest.json'), 'utf8');
            const manifest = JSON.parse(manifestRaw);

            expect(manifest.name).toBe('Nyx');
            expect(manifest.description).toBe('Instant Dark Mode for the Web. Zero White Flash.');
            expect(manifest.browser_action.default_title).toBe('Nyx');
        });

        test('src/manifest-chrome-mv3.json must have action default_title as Nyx', async () => {
            const manifestRaw = await fs.readFile(rootPath('src/manifest-chrome-mv3.json'), 'utf8');
            const manifest = JSON.parse(manifestRaw);

            expect(manifest.action.default_title).toBe('Nyx');
        });

        test.each(['firefox', 'thunderbird'])('%s must use an independent Nyx extension ID', async (platform) => {
            const manifest = JSON.parse(await fs.readFile(rootPath(`src/manifest-${platform}.json`), 'utf8'));
            const settings = manifest.browser_specific_settings || manifest.applications;

            expect(settings.gecko.id).toBe('nyx@mgabs.github.io');
        });

        test('tasks/bundle-manifest.js source contains Nyx branding', async () => {
            const bundleManifestRaw = await fs.readFile(rootPath('tasks/bundle-manifest.js'), 'utf8');

            expect(bundleManifestRaw).toContain("'Nyx'");
            expect(bundleManifestRaw).toContain('Instant Dark Mode for the Web. Zero White Flash.');
            expect(bundleManifestRaw).not.toContain("'Dark Reader MV3 Plus' : 'Dark Reader MV3'");
            expect(bundleManifestRaw).toContain("'Nyx MV3 Plus' : 'Nyx MV3'");
        });

        test('src/utils/links.ts links point to github.com/mgabs/nyx', async () => {
            const linksRaw = await fs.readFile(rootPath('src/utils/links.ts'), 'utf8');

            expect(linksRaw).toContain("export const HOMEPAGE_URL = 'https://github.com/mgabs/nyx';");
            expect(linksRaw).toContain("export const GITHUB_URL = 'https://github.com/mgabs/nyx';");
            expect(linksRaw).toContain("export const DEVTOOLS_DOCS_URL = 'https://github.com/mgabs/nyx/blob/main/CONTRIBUTING.md';");
            expect(linksRaw).toContain("export const NEWS_URL = 'https://raw.githubusercontent.com/mgabs/nyx/main/docs/news.json';");
            expect(linksRaw).not.toContain('darkreader.org');
            expect(linksRaw).not.toContain('DONATE_URL');
            expect(linksRaw).not.toContain('TWITTER_URL');
            expect(linksRaw).not.toContain('UNINSTALL_URL');
        });

        test('docs/news.json contains valid Nyx news items', async () => {
            const newsRaw = await fs.readFile(rootPath('docs/news.json'), 'utf8');
            const news = JSON.parse(newsRaw);

            expect(Array.isArray(news)).toBe(true);
            expect(news.length).toBeGreaterThan(0);
            expect(news[0]).toEqual(expect.objectContaining({
                id: expect.any(String),
                date: expect.any(String),
                url: expect.stringContaining('https://github.com/mgabs/nyx'),
                headline: expect.any(String),
            }));
        });

        test('package.json exports standalone API as nyx.js and nyx.mjs', async () => {
            const packageJsonRaw = await fs.readFile(rootPath('package.json'), 'utf8');
            const pkg = JSON.parse(packageJsonRaw);

            expect(pkg.main).toBe('nyx.js');
            expect(pkg.module).toBe('nyx.mjs');
        });

        test('popup body omits DonateGroup, uses Nyx wordmark, and exports Nyx-${url}.css', async () => {
            const bodyRaw = await fs.readFile(rootPath('src/ui/popup/body/index.tsx'), 'utf8');
            const exportRaw = await fs.readFile(rootPath('src/ui/popup/theme/controls/export-theme.tsx'), 'utf8');

            expect(bodyRaw).not.toContain('DonateGroup');
            expect(bodyRaw).not.toContain('Dark Reader');
            expect(bodyRaw).toContain('Nyx');
            expect(exportRaw).toContain('`Nyx-${url}.css`');
        });

        test('README.md header identifies as Nyx with repository link to github.com/mgabs/nyx', async () => {
            const readmeRaw = await fs.readFile(rootPath('README.md'), 'utf8');

            expect(readmeRaw).toContain('<h2 align="center">Nyx</h2>');
            expect(readmeRaw).toContain('<h3 align="center">Instant Dark Mode for the Web. Zero White Flash.</h3>');
            expect(readmeRaw).toContain('https://github.com/mgabs/nyx');
        });
    });

    describe('REQ-BRAND-2: MIT License Attribution Preservation', () => {
        test('LICENSE must preserve original 2026 Dark Reader Ltd. copyright intact', async () => {
            const licenseRaw = await fs.readFile(rootPath('LICENSE'), 'utf8');

            expect(licenseRaw).toContain('Copyright (c) 2026 Dark Reader Ltd.');
        });

        test('LICENSE must append Nyx contributors copyright notice', async () => {
            const licenseRaw = await fs.readFile(rootPath('LICENSE'), 'utf8');

            expect(licenseRaw).toContain('Copyright (c) 2026 Nyx Contributors.');
        });

        test('LICENSE must retain complete MIT license terms and disclaimer unchanged', async () => {
            const licenseRaw = await fs.readFile(rootPath('LICENSE'), 'utf8');

            expect(licenseRaw).toContain('Permission is hereby granted, free of charge, to any person obtaining a copy');
            expect(licenseRaw).toContain('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND');
        });
    });

    describe('REQ-BRAND-6: Nyx Owl Icon Assets & Manifest Wiring', () => {
        const readPngSize = async (relPath: string) => {
            const buf = await fs.readFile(rootPath(relPath));
            // PNG signature + IHDR width/height at bytes 16..24
            expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
            return {
                width: buf.readUInt32BE(16),
                height: buf.readUInt32BE(20),
            };
        };

        test.each([
            ['src/icons/nyx_16.png', 16],
            ['src/icons/nyx_48.png', 48],
            ['src/icons/nyx_128.png', 128],
            ['src/icons/nyx_active_19.png', 19],
            ['src/icons/nyx_active_38.png', 38],
            ['src/icons/nyx_active_light_19.png', 19],
            ['src/icons/nyx_active_light_38.png', 38],
            ['src/ui/assets/images/nyx-icon-256x256.png', 256],
        ])('%s must exist as a %ix%i PNG', async (relPath, size) => {
            const dims = await readPngSize(relPath);
            expect(dims).toEqual({width: size, height: size});
        });

        test('src/icons/ must contain zero legacy dr_*.png files and manifests/IconManager must reference nyx_*.png', async () => {
            const iconFiles = await fs.readdir(rootPath('src/icons'));
            expect(iconFiles.filter((f) => f.startsWith('dr_'))).toEqual([]);

            const manifestRaw = await fs.readFile(rootPath('src/manifest.json'), 'utf8');
            const mv3Raw = await fs.readFile(rootPath('src/manifest-chrome-mv3.json'), 'utf8');
            const iconManagerRaw = await fs.readFile(rootPath('src/background/icon-manager.ts'), 'utf8');

            for (const raw of [manifestRaw, mv3Raw, iconManagerRaw]) {
                expect(raw).not.toContain('dr_');
                expect(raw).toContain('nyx_');
            }
        });
    });

    describe('REQ-POPUP-3: Obsidian + Silver + Amber UI Palette', () => {
        test('theme.less, md3-tokens.less, compatibility.js, and nyx-type.svg use Obsidian/Silver/Amber and drop legacy slate/coral', async () => {
            const themeRaw = await fs.readFile(rootPath('src/ui/theme.less'), 'utf8');
            const md3Raw = await fs.readFile(rootPath('src/ui/popup/md3-tokens.less'), 'utf8');
            const compatRaw = await fs.readFile(rootPath('src/ui/popup/compatibility.js'), 'utf8');
            const typeSvgRaw = await fs.readFile(rootPath('src/ui/assets/images/nyx-type.svg'), 'utf8');

            expect(themeRaw).toContain('#111114');
            expect(themeRaw).toContain('#c4c4cc');
            expect(themeRaw).toContain('#f59e0b');
            expect(md3Raw).toContain('#111114');
            expect(md3Raw).toContain('#c4c4cc');
            expect(md3Raw).toContain('#f59e0b');
            expect(compatRaw).toContain('#f59e0b');
            expect(typeSvgRaw.toLowerCase()).toContain('#f59e0b');

            for (const raw of [themeRaw, md3Raw, compatRaw, typeSvgRaw]) {
                expect(raw.toLowerCase()).not.toContain('#141e24');
                expect(raw.toLowerCase()).not.toContain('#e96c4c');
                expect(raw.toLowerCase()).not.toContain('#53a1b3');
            }
        });
    });
});
