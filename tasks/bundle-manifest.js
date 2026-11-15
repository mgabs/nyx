// @ts-check
import {getDestDir, absolutePath} from './paths.js';
import {PLATFORM} from './platform.js';
import * as reload from './reload.js';
import {createTask} from './task.js';
import {readJSON, writeJSON} from './utils.js';

export async function patchManifest(platform, debug, watch, test) {
    const isChromiumMV3 = platform === PLATFORM.CHROMIUM_MV3 || platform === PLATFORM.CHROMIUM_MV3_PLUS;
    const isFirefoxMV3 = platform === PLATFORM.FIREFOX_MV3;
    const isMV3 = isChromiumMV3 || isFirefoxMV3;
    const isPlus = platform === PLATFORM.CHROMIUM_MV3_PLUS;

    const manifest = await readJSON(absolutePath('src/manifest.json'));
    const manifestPatch = isChromiumMV3 ? {} : await readJSON(absolutePath(`src/manifest-${platform.replace('-plus', '')}.json`));
    const manifestExtras = isPlus ? await readJSON(absolutePath(`src/plus/manifest.json`)) : {};
    const patched = {...manifest, ...manifestPatch, ...manifestExtras};
    patched.name = 'Nyx';
    patched.description = 'Instant Dark Mode for the Web. Zero White Flash.';
    if (!isChromiumMV3) {
        patched.minimum_chrome_version = undefined;
    }
    if (!isMV3) {
        patched.action = undefined;
        patched.options_ui = undefined;
        patched.content_security_policy = undefined;
        patched.host_permissions = undefined;
    }
    if (debug) {
        patched.version = '1';
        patched.description = `Debug build, platform: ${platform}, watch: ${watch ? 'yes' : 'no'}.`;
    }
    if (debug && !test && isMV3) {
        patched.permissions.push('tabs');
    }
    if (debug && isChromiumMV3) {
        patched.version_name = isPlus ? 'Debug Plus' : 'Debug';
    }
    // Needed to test settings export and CSS theme export via a download
    if (test || debug) {
        patched.permissions.push('downloads');
    }
    return patched;
}

async function manifests({platforms, debug, watch, test}) {
    const enabledPlatforms = Object.values(PLATFORM).filter((platform) => platform !== PLATFORM.API && platforms[platform]);
    for (const platform of enabledPlatforms) {
        const manifest = await patchManifest(platform, debug, watch, test);
        const destDir = getDestDir({debug, platform});
        await writeJSON(`${destDir}/manifest.json`, manifest);
    }
}

const bundleManifestTask = createTask(
    'bundle-manifest',
    manifests,
).addWatcher(
    ['src/manifest*.json'],
    async (changedFiles, _, buildPlatforms) => {
        const chrome = changedFiles.some((file) => file.endsWith('manifest.json'));
        const platforms = {};
        for (const platform of Object.values(PLATFORM)) {
            const changed = chrome || changedFiles.some((file) => file.endsWith(`manifest-${platform.replace('-plus', '')}.json`));
            platforms[platform] = changed && buildPlatforms[platform];
        }
        await manifests({platforms, debug: true, watch: true, test: false});
        reload.reload({type: reload.FULL});
    },
);

export default bundleManifestTask;
