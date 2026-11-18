<p align="center"><a href="https://github.com/mgabs/nyx" target="_blank" rel="noreferrer noopener"><img width="128" alt="Nyx Owl icon" src="src/icons/nyx_128.png"></a></p>
<p align="center">Nyx <strong>adapts</strong> web pages to a consistent dark palette with <strong>zero white flash</strong>.</p>
<!-- TODO: Add Nyx store links -->
<br/>

<h2 align="center">Nyx</h2>
<h3 align="center">Instant Dark Mode for the Web. Zero White Flash.</h3>
<p align="center"><a href="https://github.com/mgabs/nyx">https://github.com/mgabs/nyx</a></p>
<br/>
<p align="center">Nyx is an <strong>open-source</strong> MIT-licensed <strong>browser extension</strong> that applies a consistent, comfortable dark color theme across the web with zero white flash.</p>

## Color Theme (Nyx Owl)

- **Default Dark Background:** `#181a1b`
- **Default Dark Text:** `#e8e6e3`
- **Adjustable Sliders:** Brightness, Contrast, Sepia, Grayscale, and custom background/text colors per site or globally.
- **Theme Engines:** Supports `dynamicTheme`, `leanDynamicTheme` (consistent cross-site dark palette via `adoptedStyleSheets` with zero `<canvas>` image analysis), `staticTheme`, `cssFilter`, and `svgFilter`.

Lean Dynamic observes stylesheet changes through page-level hooks. Direct changes made through stylesheet declaration references saved before the hooks were installed, or changes made when those hooks cannot run, may not be detected.
Lean Dynamic CSS export includes document styles only; styles for shadow-root components are omitted.
<br/>
<br/>

## Questions

Most questions can be answered by reading the [wiki](https://github.com/mgabs/nyx/wiki).
If the wiki doesn't answer your question, open up a new [discussion](https://github.com/mgabs/nyx/discussions).

## How to contribute

Read more about contributing to Nyx in [CONTRIBUTING.md](https://github.com/mgabs/nyx/blob/main/CONTRIBUTING.md).

## Building for use

Nyx build script requires a JavaScript runtime, either Node.js or Deno. We recommend using Node.js, Deno support is experimental.

### Building with Node.js

You can install the extension from a file.
Install [Node.js](https://nodejs.org/) (we recommend LTS or higher, but any version at or above 15 will work). Download the source code (or check out from git).
Open the terminal in the root folder and run:

- `npm install`
- `npm run build` or `npm run build [-- flags]`

This will create a `build/release/nyx-chrome-mv3.zip` file for use in a Chromium-based browser and a `build/release/nyx-firefox-mv3.xpi` file for use in Firefox.

You can customize the build process by passing flags to build script. To see all flags, run `npm run build -- --help`.

### Building with Deno

You can build Nyx with an alternative runtime called [Deno](https://deno.land/). For this run `deno:bootstrap` script (e.g., via `npm run deno:bootstrap` or manually copy the command from `package.json`). Then run the same commands described above.

Please note that if you encounter the error `Too many open files (os error 24)`, then you should use the newer version of Deno (preferably built from source or canary).

### Bundling with official Firefox store signatures (experimental)

Before publication, extension stores provide digital signatures for extensions. These digital signatures certify the integrity of the archive (that the extension bundle did not get corrupted or bit-rotted) and that the extension store performed very basic extension validation.

This repository contains historical digital signatures and you can add them to the extension bundle. The following will build for Firefox version 4.9.63:
```
npm run build -- --firefox --version=4.9.63
```

Please note that only Firefox Add-ons store signatures are present in the repository right now. Also, due to NodeJS and TypeScript version compatibility, one might have to first check out the old revision (commit), then build the extension files, then check out the recent commit and create the bundle (by running only `signature` and `zip` steps).

## Using Nyx on a website

You can use Nyx's standalone API to enable dark mode on your website!

- Build from the source code (`npm run api`, producing `nyx.js` / `nyx.mjs`)
- Or install the upstream package from NPM (`npm install darkreader`) or via a CDN such as [unpkg](https://unpkg.com/darkreader/) or [jsDelivr](https://www.jsdelivr.com/package/npm/darkreader)

Then you can use the following code to control the API:
```javascript
DarkReader.enable({
    brightness: 100,
    contrast: 90,
    sepia: 10
});

DarkReader.disable();

// Enable when the system color scheme is dark.
DarkReader.auto({
    brightness: 100,
    contrast: 90,
    sepia: 10
});

// Stop watching for the system color scheme.
DarkReader.auto(false);

// Get the generated CSS of Dark Reader returned as a string.
const CSS = await DarkReader.exportGeneratedCSS();

// Check if Dark Reader is enabled.
const isEnabled = DarkReader.isEnabled();
```

... or if you are using ES modules:

```javascript
import {
    enable as enableDarkMode,
    disable as disableDarkMode,
    auto as followSystemColorScheme,
    exportGeneratedCSS as collectCSS,
    isEnabled as isDarkReaderEnabled
} from 'darkreader';

enableDarkMode({
    brightness: 100,
    contrast: 90,
    sepia: 10,
});

disableDarkMode();

followSystemColorScheme();

const CSS = await collectCSS();

const isEnabled = isDarkReaderEnabled();
```

Be aware that the standalone API will add the `chrome` object onto the `window` object. These are to stub certain functions that the code will use. They originate from the webextension-api.

## Site fixes

Automatically syncing the site fixes for every Nyx user was disabled because the GitHub team does not allow using GitHub as a content delivery network (CDN). The storage of these files would be expensive, and making requests to other resources would look suspicious. Each new release of Nyx will include the new changes.

However, this can be manually enabled with the following steps:

1. Click on the Nyx extension icon.
2. Click on the `Dev tools` button (in the bottom-right corner).
3. Go to `Advanced` and click on the `Preview new design` button.
4. Close the developer tools window and click on the Nyx extension icon again.
5. Go to `Settings` -> `Advanced` and enable the `Synchronize sites fixes` setting.

To force a synchronization of the sites fixes (when the corresponding setting is enabled), perform the following steps:

1. Click on the Nyx extension icon.
2. Go to `Settings` -> `Advanced` -> `Dev tools`.
3. For each "Editor" section, click on `Reset changes`, confirm with `OK`, and then click on `Apply`. Afterwards, close the developer tools window and reload the desired page(s).

## Enable Nyx on restricted pages on Mozilla Firefox

By default, Nyx does not work on some websites due to **security restrictions** enforced by Mozilla.

The following instructions will guide you on how to disable those restrictions.

**Proceed with caution. This exposes you to a security risk if you do not know what you are doing.**

**Be sure that you do not have any suspicious or malicious-looking extension installed before proceeding.**

**These settings will apply to all extensions, and not just Nyx.**

Step 1: change Nyx's settings.

1. Click on the Nyx extension icon.
2. Click on the `Dev tools` button (in the bottom-right corner).
3. Go to `Advanced` and click on the `Preview new design` button.
4. Close the developer tools window and click on the Nyx extension icon again.
5. Go to `Settings` -> `Advanced` and enable the `Enable on restricted pages` setting.

Step 2: change Firefox's settings.

- Type `about:config` in the address bar and press Enter.
  - A warning page may appear. Click `Accept the Risk and Continue` to proceed.
- Search for and set `extensions.webextensions.restrictedDomains` to an empty value (if the preference does not exist, create it with `String` as the type).
- Set `privacy.resistFingerprinting.block_mozAddonManager` to `true` (if the preference does not exist, create it with `Boolean` as the type).

After changing the necessary settings for both Nyx and Firefox, reload the desired page(s).

**If you had previously changed any of the following preferences, please reset them to their default values as they are only related to security and are not necessary for Nyx to work on restricted websites.**
To reset them, click on the reset (or delete icon, if present) icon at the most-right corner of the preference line in `about:config`.
- `extensions.webextensions.addons-restricted-domains@mozilla.com.disabled`
- `extensions.quarantinedDomains.enabled`
- `extensions.quarantinedDomains.list`

### Clarification about quarantined domains ("Run on sites with restrictions" option)
<details><summary>Quarantined domains and Nyx — an explanation</summary>

The option "Run on sites with restrictions", present for some extensions, is only related to quarantined domains and is not needed for Nyx to work on restricted websites. In the context of Firefox's source code, "restricted domains" and "quarantined domains" are two separate things.

**The "restricted domains" list** (controlled by the preference `extensions.webextensions.restrictedDomains`) is the same for all users. It will restrict *all* user-installed extensions (without exceptions) from running on the specified websites. The list is controlled by Mozilla, and, as of December 2024, the list only contains Mozilla-owned domains. Sites that are not on that list will not be affected by those restrictions (meaning that the extensions will be able to run normally).

**The "quarantined domains" list** (controlled by the preferences `extensions.quarantinedDomains.enabled` and `extensions.quarantinedDomains.list`) contains domains that will run extensions normally, but if Firefox detects suspicious activity from a particular extension it will block that extension on those specific websites. The list is controlled by Mozilla, and, as of December 2024, the list only contains domains related to Internet banking in Brazil. For more information about quarantined domains, see "[Why are some add-ons not allowed on sites restricted by Mozilla?](https://support.mozilla.org/en-US/kb/quarantined-domains)".

For extensions with a [Recommended](https://support.mozilla.org/en-US/kb/recommended-extensions-program) status by Mozilla, the option "Run on sites with restrictions" is not shown. (The "Recommended" status is only relevant for "quarantined domains", and does not affect "restricted domains".)

The fact that an extension is Recommended means that it meets the "highest standards of security, functionality, and user experience". The quarantined domains are only related to extension security, meaning **it will always run even on quarantined domains** (but will still obey the "restricted domains" list if it is not empty).

Regarding quarantined domains specifically, there is this [comment from Firefox's source code](https://searchfox.org/mozilla-central/rev/1838f847aa3bf909c3d34a94a8f0cd7e37fca086/toolkit/components/extensions/Extension.sys.mjs#3470-3471):

```
// Privileged extensions and any extensions with a recommendation state are
// exempt from the quarantined domains.
```

A simple way to recapitulate all this information is: "restricted domains" exist to protect Mozilla-owned sites (no user-installed extension will run on them, without exceptions), while "quarantined domains" are meant to protect users from malicious extensions.

</details>

<h2 align="center">Contributors</h2>
<br/>
<h3 align="center"><strong>Thank you to all our contributors! Nyx exists thanks to you.</strong></h3>
<br/>
<p align="center"><a rel="noreferrer noopener" href="https://github.com/mgabs/nyx/graphs/contributors/">View Contributors on GitHub</a></p>

<h2 align="center">Sponsor & Donate</h2>
<!-- TODO: Add Nyx donation link -->
<p align="center">TODO: <a href="TODO">Add Nyx donation link</a></p>

