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

        test('tasks/bundle-manifest.js source contains Nyx branding', async () => {
            const bundleManifestRaw = await fs.readFile(rootPath('tasks/bundle-manifest.js'), 'utf8');

            expect(bundleManifestRaw).toContain("'Nyx'");
            expect(bundleManifestRaw).toContain('Instant Dark Mode for the Web. Zero White Flash.');
            expect(bundleManifestRaw).not.toContain("'Dark Reader MV3 Plus' : 'Dark Reader MV3'");
            expect(bundleManifestRaw).toContain("'Nyx MV3 Plus' : 'Nyx MV3'");
        });

        test('src/utils/links.ts links point to github.com/mgabs/nyx', async () => {
            const linksRaw = await fs.readFile(rootPath('src/utils/links.ts'), 'utf8');

            expect(linksRaw).toContain("export const GITHUB_URL = 'https://github.com/mgabs/nyx';");
            expect(linksRaw).toContain("export const DEVTOOLS_DOCS_URL = 'https://github.com/mgabs/nyx/blob/main/CONTRIBUTING.md';");
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
});
