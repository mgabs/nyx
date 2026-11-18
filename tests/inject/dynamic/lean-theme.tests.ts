import '../support/polyfills';
import {DEFAULT_THEME} from '../../../src/defaults';
import {createOrUpdateLeanTheme, removeLeanTheme, serializeLeanCSS} from '../../../src/inject/lean-theme';
import {injectProxy} from '../../../src/inject/dynamic-theme/stylesheet-proxy';
import {createOrUpdateDynamicTheme, removeDynamicTheme} from '../../../src/inject/dynamic-theme';
import {VariablesStore} from '../../../src/inject/dynamic-theme/variables';
import {resetChromeRuntimeMessageStub, stubBackgroundFetchResponse, stubChromeRuntimeMessage} from '../support/background-stub';
import {getCSSEchoURL} from '../support/echo-client';
import {multiline, timeout} from '../support/test-utils';

const theme = {
    ...DEFAULT_THEME,
    darkSchemeBackgroundColor: '#111111',
    darkSchemeTextColor: '#eeeeee',
};

let container: HTMLElement;

beforeEach(() => {
    container = document.body;
    container.innerHTML = '';
});

afterEach(() => {
    removeLeanTheme();
    container.innerHTML = '';
});

describe('LEAN DYNAMIC THEME', () => {
    it('updates themed colors when the palette and brightness change', () => {
        const style = document.createElement('style');
        style.textContent = '.settings-target { background-color: white; color: black; }';
        const target = document.createElement('div');
        target.className = 'settings-target';
        const inline = document.createElement('div');
        inline.style.backgroundColor = 'white';
        const host = document.createElement('div');
        const shadow = host.attachShadow({mode: 'open'});
        const sheet = new CSSStyleSheet();
        sheet.replaceSync('.settings-shadow { background-color: white; }');
        shadow.adoptedStyleSheets = [sheet];
        const shadowTarget = document.createElement('span');
        shadowTarget.className = 'settings-shadow';
        shadow.append(shadowTarget);
        container.append(style, target, inline, host);
        createOrUpdateLeanTheme(theme, null, false);
        expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
        expect(getComputedStyle(inline).backgroundColor).toBe('rgb(17, 17, 17)');
        expect(getComputedStyle(shadowTarget).backgroundColor).toBe('rgb(17, 17, 17)');
        const beforeText = getComputedStyle(target).color;

        createOrUpdateLeanTheme({...theme, darkSchemeBackgroundColor: '#333333', brightness: 80}, null, false);
        expect(getComputedStyle(target).backgroundColor).not.toBe('rgb(17, 17, 17)');
        expect(getComputedStyle(inline).backgroundColor).not.toBe('rgb(17, 17, 17)');
        expect(getComputedStyle(shadowTarget).backgroundColor).not.toBe('rgb(17, 17, 17)');
        expect(getComputedStyle(target).color).not.toBe(beforeText);
        const afterBrightness = getComputedStyle(target).color;
        createOrUpdateLeanTheme({...theme, contrast: 70, sepia: 50}, null, false);
        expect(getComputedStyle(target).color).not.toBe(afterBrightness);
    });

    it('does not emit inversion or selection colors when both are disabled', () => {
        createOrUpdateLeanTheme({...theme, mode: 0, brightness: 100, contrast: 100, sepia: 0, grayscale: 0, selectionColor: ''}, {
            url: ['*'], invert: ['.no-filter'], css: '', ignoreInlineStyle: [], ignoreImageAnalysis: [],
            ignoreCSSUrl: [], disableStyleSheetsProxy: false, disableCustomElementRegistryProxy: false,
        }, false);
        const css = serializeLeanCSS();
        expect(css).not.toContain('.no-filter');
        expect(css).toContain('--nyx-selection-background: initial');
        expect(css).toContain('--nyx-selection-text: initial');
    });

    it('applies font, text stroke and selection settings', () => {
        createOrUpdateLeanTheme({...theme, useFont: true, fontFamily: 'Arial', textStroke: 1, selectionColor: '#ff0000'}, null, false);
        const css = serializeLeanCSS();
        expect(css).toContain('font-family: Arial');
        expect(css).toContain('text-stroke');
        expect(css).toContain('--nyx-selection-background:');
        expect(css).not.toContain('--nyx-selection-background: initial');
    });

    it('keeps an invalid color template without preventing valid fixes from applying', () => {
        const target = document.createElement('div');
        target.className = 'template-target';
        container.append(target);
        createOrUpdateLeanTheme(theme, {
            url: ['*'], invert: [], css: '.template-target { color: ${not-a-color}; background-color: red; }',
            ignoreInlineStyle: [], ignoreImageAnalysis: [], ignoreCSSUrl: [], disableStyleSheetsProxy: false,
            disableCustomElementRegistryProxy: false,
        }, false);
        expect(getComputedStyle(target).backgroundColor).toBe('rgb(255, 0, 0)');
        expect(serializeLeanCSS()).toContain('.template-target');
    });

    it('themes newly inserted inline HTML and SVG descendants', async () => {
        createOrUpdateLeanTheme(theme, null, false);
        const holder = document.createElement('section');
        holder.style.backgroundColor = 'white';
        holder.innerHTML = '<span style="color: black">Text</span><svg><path style="fill: black"></path></svg>';
        container.append(holder);
        await timeout(150);
        expect(getComputedStyle(holder).backgroundColor).toBe('rgb(17, 17, 17)');
        expect(getComputedStyle(holder.querySelector('span')!).color).toBe('rgb(238, 238, 238)');
        expect(getComputedStyle(holder.querySelector('path')!).fill).toBe('rgb(238, 238, 238)');
        removeLeanTheme();
        expect(holder.hasAttribute('data-nyx-inline-bgcolor')).toBe(false);
        expect(holder.querySelector('path')!.hasAttribute('data-nyx-inline-fill')).toBe(false);
    });

    it('leaves ignored inline styles unchanged while theming other elements', () => {
        const ignored = document.createElement('div');
        ignored.className = 'ignored-inline';
        ignored.style.backgroundColor = 'white';
        const themed = document.createElement('div');
        themed.style.backgroundColor = 'white';
        container.append(ignored, themed);
        createOrUpdateLeanTheme(theme, {
            url: ['*'], invert: [], css: '', ignoreInlineStyle: ['.ignored-inline'],
            ignoreImageAnalysis: [], ignoreCSSUrl: [], disableStyleSheetsProxy: false,
            disableCustomElementRegistryProxy: false,
        }, false);
        expect(getComputedStyle(ignored).backgroundColor).toBe('rgb(255, 255, 255)');
        expect(ignored.hasAttribute('data-nyx-inline-bgcolor')).toBe(false);
        expect(getComputedStyle(themed).backgroundColor).toBe('rgb(17, 17, 17)');
    });

    it('updates an existing SVG inline color when the page changes it', async () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.style.fill = 'black';
        svg.append(path);
        container.append(svg);
        createOrUpdateLeanTheme(theme, null, false);
        const before = getComputedStyle(path).fill;
        path.style.fill = 'red';
        await timeout(100);
        expect(getComputedStyle(path).fill).not.toBe(before);
    });
    it('keeps Dynamic active when a Lean stylesheet request finishes after switching', async () => {
        const css = '.late-switch-target { background-color: red; }';
        const page = window as any;
        const previousNyx = page.Nyx;
        let resolveFetch: ((value: string) => void) | null = null;
        page.Nyx = {Plugins: {fetch: () => new Promise<string>((resolve) => {
            resolveFetch = resolve;
        })}};
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = getCSSEchoURL(css);
        const style = document.createElement('style');
        style.textContent = '.late-switch-target { background-color: white; }';
        const target = document.createElement('div');
        target.className = 'late-switch-target';
        container.append(style, link, target);
        try {
            createOrUpdateLeanTheme(theme, null, false);
            await timeout(50);
            expect(resolveFetch).not.toBeNull();
            removeLeanTheme();
            link.remove();
            createOrUpdateDynamicTheme(theme, null, false);
            (resolveFetch as unknown as (value: string) => void)(css);
            await timeout(100);
            expect(serializeLeanCSS()).toBe('');
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
            expect(document.querySelectorAll('style.nyx--sync').length).toBeGreaterThan(0);
        } finally {
            removeLeanTheme();
            removeDynamicTheme();
            page.Nyx = previousNyx;
        }
    });
    it('removes Lean inline overrides from SVG elements when disabled', () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.style.fill = 'black';
        svg.append(path);
        container.append(svg);
        createOrUpdateLeanTheme(theme, null, false);
        expect(path.hasAttribute('data-nyx-inline-fill')).toBe(true);
        removeLeanTheme();
        expect(path.hasAttribute('data-nyx-inline-fill')).toBe(false);
        expect(path.style.getPropertyValue('--nyx-inline-fill')).toBe('');
    });
    it('removes the early fallback after the Lean theme is ready', () => {
        const fallback = document.createElement('style');
        fallback.className = 'nyx nyx--fallback';
        fallback.textContent = 'body :not(iframe) { background: black !important; }';
        document.head.append(fallback);
        try {
            createOrUpdateLeanTheme(theme, null, false);
            expect(document.querySelector('.nyx--fallback')).toBeNull();
        } finally {
            fallback.remove();
        }
    });
    it('preserves cascade when the page reorders adopted stylesheets', async () => {
        const white = new CSSStyleSheet();
        const red = new CSSStyleSheet();
        white.replaceSync('.adopted-order { background-color: white; }');
        red.replaceSync('.adopted-order { background-color: red; }');
        document.adoptedStyleSheets = [white, red];
        const target = document.createElement('div');
        target.className = 'adopted-order';
        container.append(target);
        try {
            createOrUpdateLeanTheme(theme, null, false);
            expect(getComputedStyle(target).backgroundColor).not.toBe('rgb(17, 17, 17)');
            const owned = document.adoptedStyleSheets.filter((sheet) => sheet !== white && sheet !== red);
            document.adoptedStyleSheets = [red, white, ...owned];
            await timeout(100);
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
        } finally {
            removeLeanTheme();
            document.adoptedStyleSheets = [];
        }
    });
    it('restores browser declarations before switching to Dynamic', async () => {
        const getter = Object.getOwnPropertyDescriptor(CSSStyleRule.prototype, 'style')!.get;
        const nativeGetProperty = CSSStyleDeclaration.prototype.getPropertyValue;
        const style = document.createElement('style');
        style.textContent = '.switch-target { background-color: white; }';
        const target = document.createElement('div');
        target.className = 'switch-target';
        container.append(style, target);
        try {
            createOrUpdateLeanTheme(theme, null, false);
            expect(Object.getOwnPropertyDescriptor(CSSStyleRule.prototype, 'style')!.get).not.toBe(getter);
            removeLeanTheme();
            createOrUpdateDynamicTheme(theme, null, false);
            await timeout(100);
            expect(Object.getOwnPropertyDescriptor(CSSStyleRule.prototype, 'style')!.get).toBe(getter);
            expect(CSSStyleDeclaration.prototype.getPropertyValue).toBe(nativeGetProperty);
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
        } finally {
            removeDynamicTheme();
        }
    });
    it('does not fetch import-like text inside a CSS declaration', async () => {
        const css = `.literal::before { content: '@import "https://example.invalid/not-a-stylesheet.css";'; } .literal-target { background-color: white; }`;
        const url = getCSSEchoURL(css);
        const fetched: string[] = [];
        const page = window as any;
        const previousNyx = page.Nyx;
        page.Nyx = {Plugins: {fetch: async ({url: requestURL}: {url: string}) => {
            fetched.push(requestURL);
            return requestURL === url ? css : '.unexpected { color: red; }';
        }}};
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        const target = document.createElement('div');
        target.className = 'literal-target';
        container.append(link, target);
        try {
            createOrUpdateLeanTheme(theme, null, false);
            await timeout(300);
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
            expect(fetched).toEqual([url]);
        } finally {
            removeLeanTheme();
            page.Nyx = previousNyx;
        }
    });
    it('keeps a new theme fallback while an earlier load finishes', async () => {
        const css = '.generation-target { background-color: white; }';
        const page = window as any;
        const previousNyx = page.Nyx;
        const pending: Array<(value: string) => void> = [];
        page.Nyx = {Plugins: {fetch: () => new Promise<string>((resolve) => pending.push(resolve))}};
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = getCSSEchoURL(css);
        container.append(link);
        try {
            createOrUpdateLeanTheme(theme, null, false);
            await timeout(50);
            expect(pending.length).toBe(1);
            removeLeanTheme();
            createOrUpdateLeanTheme(theme, null, false);
            await timeout(50);
            expect(pending.length).toBe(2);
            expect(serializeLeanCSS()).toContain('body :not(iframe)');
            pending[0](css);
            await timeout(50);
            expect(serializeLeanCSS()).toContain('body :not(iframe)');
        } finally {
            removeLeanTheme();
            pending[1]?.(css);
            page.Nyx = previousNyx;
        }
    });
    it('keeps accessible rules when an imported stylesheet cannot be fetched', async () => {
        const missingURL = 'http://localhost:9966/missing';
        const mainCSS = `@import "${missingURL}"; .import-failure-target { background-color: white; }`;
        const mainURL = getCSSEchoURL(mainCSS);
        const page = window as any;
        const previousNyx = page.Nyx;
        page.Nyx = {Plugins: {fetch: async ({url}: {url: string}) => {
            if (url === mainURL) {
                return mainCSS;
            }
            throw new Error('unavailable');
        }}};
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = mainURL;
        const target = document.createElement('div');
        target.className = 'import-failure-target';
        container.append(link, target);
        try {
            createOrUpdateLeanTheme(theme, null, false);
            await timeout(300);
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
        } finally {
            removeLeanTheme();
            page.Nyx = previousNyx;
        }
    });

    it('does not restore a removed theme when a stylesheet fetch completes late', async () => {
        const css = '.late-fetch-target { background-color: white; }';
        const url = getCSSEchoURL(css);
        const page = window as any;
        const previousNyx = page.Nyx;
        let resolveFetch: ((value: string) => void) | null = null;
        page.Nyx = {Plugins: {fetch: () => new Promise<string>((resolve) => {
            resolveFetch = resolve;
        })}};
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        container.append(link);
        try {
            createOrUpdateLeanTheme(theme, null, false);
            await timeout(50);
            expect(resolveFetch).not.toBeNull();
            removeLeanTheme();
            (resolveFetch as unknown as (value: string) => void)(css);
            await timeout(100);
            expect(serializeLeanCSS()).toBe('');
            expect(document.adoptedStyleSheets.length).toBe(0);
        } finally {
            removeLeanTheme();
            page.Nyx = previousNyx;
        }
    });
    it('terminates cyclic imports while keeping accessible rules', async () => {
        const firstURL = 'https://example.invalid/lean-first.css';
        const secondURL = 'https://example.invalid/lean-second.css';
        const mainCSS = `@import "${firstURL}"; .cycle-target { background-color: white; }`;
        const mainURL = getCSSEchoURL(mainCSS);
        const sources = new Map([
            [mainURL, mainCSS],
            [firstURL, `@import "${secondURL}"; .cycle-first { color: black; }`],
            [secondURL, `@import "${firstURL}"; .cycle-second { color: black; }`],
        ]);
        const page = window as any;
        const previousNyx = page.Nyx;
        page.Nyx = {Plugins: {fetch: async ({url}: {url: string}) => sources.get(url) ?? Promise.reject(new Error('missing'))}};
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = mainURL;
        const target = document.createElement('div');
        target.className = 'cycle-target';
        container.append(link, target);
        try {
            createOrUpdateLeanTheme(theme, null, false);
            await timeout(300);
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
            const exported = serializeLeanCSS();
            expect(exported.split('.cycle-first').length - 1).toBe(1);
            expect(exported.split('.cycle-second').length - 1).toBe(1);
        } finally {
            removeLeanTheme();
            page.Nyx = previousNyx;
        }
    });
    it('stops expanding an import chain at the depth limit', async () => {
        const urlFor = (index: number) => `https://example.invalid/lean-depth-${index}.css`;
        const mainCSS = `@import "${urlFor(0)}"; .depth-target { background-color: white; }`;
        const mainURL = getCSSEchoURL(mainCSS);
        const fetched: string[] = [];
        const page = window as any;
        const previousNyx = page.Nyx;
        page.Nyx = {Plugins: {fetch: async ({url}: {url: string}) => {
            fetched.push(url);
            if (url === mainURL) {
                return mainCSS;
            }
            const match = /lean-depth-(\d+)\.css$/.exec(url);
            if (!match) {
                throw new Error('Unexpected stylesheet URL');
            }
            const index = Number(match[1]);
            return index < 40 ? `@import "${urlFor(index + 1)}";` : '';
        }}};
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = mainURL;
        const target = document.createElement('div');
        target.className = 'depth-target';
        container.append(link, target);
        try {
            createOrUpdateLeanTheme(theme, null, false);
            await timeout(300);
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
            expect(fetched.length).toBe(32);
            expect(fetched[fetched.length - 1]).toBe(urlFor(30));
            expect(fetched).not.toContain(urlFor(31));
        } finally {
            removeLeanTheme();
            page.Nyx = previousNyx;
        }
    });

    it('preserves an import condition containing a quoted parenthesis', async () => {
        const importedURL = 'https://example.invalid/quoted-parenthesis.css';
        const mainCSS = `@import "${importedURL}" supports(content: ")") screen;`;
        const mainURL = getCSSEchoURL(mainCSS);
        const page = window as any;
        const previousNyx = page.Nyx;
        page.Nyx = {Plugins: {fetch: async ({url}: {url: string}) => {
            if (url === mainURL) {
                return mainCSS;
            }
            if (url === importedURL) {
                return '.quoted-parenthesis-target { background-color: white; }';
            }
            throw new Error('Unexpected stylesheet URL');
        }}};
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = mainURL;
        const target = document.createElement('div');
        target.className = 'quoted-parenthesis-target';
        container.append(link, target);
        try {
            createOrUpdateLeanTheme(theme, null, false);
            await timeout(300);
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
        } finally {
            removeLeanTheme();
            page.Nyx = previousNyx;
        }
    });

    it('preserves an import condition containing a quoted semicolon', async () => {
        const importedURL = 'https://example.invalid/quoted-condition.css';
        const mainCSS = `@import "${importedURL}" supports(content: ";") screen;`;
        const mainURL = getCSSEchoURL(mainCSS);
        const page = window as any;
        const previousNyx = page.Nyx;
        page.Nyx = {Plugins: {fetch: async ({url}: {url: string}) => {
            if (url === mainURL) {
                return mainCSS;
            }
            if (url === importedURL) {
                return '.quoted-condition-target { background-color: white; }';
            }
            throw new Error('Unexpected stylesheet URL');
        }}};
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = mainURL;
        const target = document.createElement('div');
        target.className = 'quoted-condition-target';
        container.append(link, target);
        try {
            createOrUpdateLeanTheme(theme, null, false);
            await timeout(300);
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
        } finally {
            removeLeanTheme();
            page.Nyx = previousNyx;
        }
    });

    it('themes nested imported cross-origin styles under their media condition', async () => {
        stubChromeRuntimeMessage();
        const nestedCSS = '.import-target { background-color: white; }';
        const nestedURL = getCSSEchoURL(nestedCSS);
        const outerCSS = `@import url("${nestedURL}") screen;`;
        const outerURL = getCSSEchoURL(outerCSS);
        const excludedCSS = '.import-excluded { background-color: white; }';
        const excludedURL = getCSSEchoURL(excludedCSS);
        const mainCSS = `@import url("${outerURL}") layer(lean-test) supports(display: grid) screen; @import url("${excludedURL}") print;`;
        const mainURL = getCSSEchoURL(mainCSS);
        stubBackgroundFetchResponse(nestedURL, nestedCSS);
        stubBackgroundFetchResponse(outerURL, outerCSS);
        stubBackgroundFetchResponse(mainURL, mainCSS);
        stubBackgroundFetchResponse(excludedURL, excludedCSS);
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = mainURL;
        const target = document.createElement('div');
        target.className = 'import-target';
        const excluded = document.createElement('div');
        excluded.className = 'import-excluded';
        container.append(link, target, excluded);
        try {
            createOrUpdateLeanTheme(theme, null, false);
            await timeout(300);
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
            expect(getComputedStyle(excluded).backgroundColor).toBe('rgba(0, 0, 0, 0)');
        } finally {
            removeLeanTheme();
            resetChromeRuntimeMessageStub();
        }
    });
    it('removes all inline overrides from the document and open shadow roots', () => {
        const target = document.createElement('div');
        target.style.outlineColor = 'black';
        const host = document.createElement('div');
        const shadow = host.attachShadow({mode: 'open'});
        const shadowTarget = document.createElement('div');
        shadowTarget.style.backgroundColor = 'white';
        shadow.append(shadowTarget);
        container.append(target, host);

        createOrUpdateLeanTheme(theme, null, false);
        expect(target.hasAttribute('data-nyx-inline-outline')).toBe(true);
        expect(shadowTarget.hasAttribute('data-nyx-inline-bgcolor')).toBe(true);
        removeLeanTheme();
        expect(target.hasAttribute('data-nyx-inline-outline')).toBe(false);
        expect(target.style.getPropertyValue('--nyx-inline-outline')).toBe('');
        expect(shadowTarget.hasAttribute('data-nyx-inline-bgcolor')).toBe(false);
        expect(shadowTarget.style.getPropertyValue('--nyx-inline-bgcolor')).toBe('');
    });

    it('cleans every supported inline override on a live element', () => {
        const properties = [
            ['background-color', 'bgcolor'], ['background-image', 'bgimage'],
            ['border-top-color', 'border-top'], ['border-bottom-color', 'border-bottom'],
            ['border-left-color', 'border-left'], ['border-right-color', 'border-right'],
            ['box-shadow', 'boxshadow'], ['color', 'color'], ['fill', 'fill'], ['stroke', 'stroke'],
            ['outline-color', 'outline'], ['stop-color', 'stopcolor'],
        ];
        const elements = properties.map(([property]) => {
            const element = document.createElement('div');
            const value = property === 'background-image' ? 'linear-gradient(white, black)' : property === 'box-shadow' ? '0 0 1px black' : 'black';
            element.style.setProperty(property, value);
            container.append(element);
            return element;
        });
        createOrUpdateLeanTheme(theme, null, false);
        properties.forEach(([, suffix], index) => {
            expect(elements[index].hasAttribute(`data-nyx-inline-${suffix}`)).withContext(suffix).toBe(true);
        });
        // Browsers may expand border-color into four longhands before the injector reads it.
        elements[0].setAttribute('data-nyx-inline-border', '');
        elements[0].style.setProperty('--nyx-inline-border', 'red');
        removeLeanTheme();
        properties.forEach(([, suffix], index) => {
            expect(elements[index].hasAttribute(`data-nyx-inline-${suffix}`)).toBe(false);
            expect(elements[index].style.getPropertyValue(`--nyx-inline-${suffix}`)).toBe('');
        });
        expect(elements[0].hasAttribute('data-nyx-inline-border')).toBe(false);
        expect(elements[0].style.getPropertyValue('--nyx-inline-border')).toBe('');
    });
    it('exports document rules in cascade order without shadow-root rules', () => {
        const style = document.createElement('style');
        style.textContent = '.export-target { background-color: white; }';
        const host = document.createElement('div');
        const shadow = host.attachShadow({mode: 'open'});
        shadow.innerHTML = '<style>.shadow-export-only { color: black; }</style><span class="shadow-export-only">Shadow</span>';
        container.append(style, host);
        createOrUpdateLeanTheme(theme, {
            url: ['*'], invert: [], css: '.export-target { background-color: rgb(255, 0, 0); }',
            ignoreInlineStyle: [], ignoreImageAnalysis: [], ignoreCSSUrl: [],
            disableStyleSheetsProxy: false, disableCustomElementRegistryProxy: false,
        }, false);

        const css = serializeLeanCSS();
        expect(css).not.toContain('.shadow-export-only');
        expect(css.indexOf('rgb(255, 0, 0)')).toBeGreaterThan(css.indexOf('.export-target'));
        const exportSheet = new CSSStyleSheet();
        exportSheet.replaceSync(css);
        const rules = Array.from(exportSheet.cssRules).filter((rule) => rule.cssText.includes('.export-target'));
        expect(rules.length).toBeGreaterThan(1);
        expect(rules[rules.length - 1].cssText).toContain('rgb(255, 0, 0)');
    });
    it('does not enable declaration wrapping for the Dynamic proxy', () => {
        const originalGetter = Object.getOwnPropertyDescriptor(CSSStyleRule.prototype, 'style')!.get;
        const originalMethod = CSSStyleDeclaration.prototype.getPropertyValue;
        injectProxy(true, true);
        expect(Object.getOwnPropertyDescriptor(CSSStyleRule.prototype, 'style')!.get).toBe(originalGetter);
        expect(CSSStyleDeclaration.prototype.getPropertyValue).toBe(originalMethod);
        document.dispatchEvent(new CustomEvent('__nyx__cleanUp'));
        expect(Object.getOwnPropertyDescriptor(CSSStyleRule.prototype, 'style')!.get).toBe(originalGetter);
        expect(CSSStyleDeclaration.prototype.getPropertyValue).toBe(originalMethod);
    });
    it('themes a page sheet shared by two shadow roots', () => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync('.shared { background-color: white; }');
        const roots = [document.createElement('div'), document.createElement('div')].map((host) => {
            const root = host.attachShadow({mode: 'open'});
            root.adoptedStyleSheets = [sheet];
            root.innerHTML = '<div class="shared"></div>';
            container.append(host);
            return root;
        });
        createOrUpdateLeanTheme(theme, null, false);
        for (const root of roots) {
            expect(getComputedStyle(root.querySelector('.shared')!).backgroundColor).toBe('rgb(17, 17, 17)');
        }
        removeLeanTheme();
        for (const root of roots) {
            expect(root.adoptedStyleSheets).toEqual([sheet]);
        }
    });

    it('tracks page adopted sheet additions, replacements and removals', async () => {
        const target = document.createElement('div');
        target.className = 'changing-adopted';
        container.append(target);
        const first = new CSSStyleSheet();
        first.replaceSync('.changing-adopted { background-color: white; }');
        const second = new CSSStyleSheet();
        second.replaceSync('.changing-adopted { color: black; }');
        createOrUpdateLeanTheme(theme, null, false);
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, first];
        await timeout(150);
        expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => sheet !== first).concat(second);
        await timeout(150);
        expect(getComputedStyle(target).color).toBe('rgb(238, 238, 238)');
        expect(getComputedStyle(target).backgroundColor).not.toBe('rgb(17, 17, 17)');
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => sheet !== second);
    });

    it('does not analyze images from adopted styles in document or shadow roots', async () => {
        const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=';
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(`.adopted-image { background-image: url("${image}"); }`);
        const host = document.createElement('div');
        const shadow = host.attachShadow({mode: 'open'});
        const child = document.createElement('span');
        child.className = 'adopted-image';
        shadow.append(child);
        shadow.adoptedStyleSheets = [sheet];
        const target = document.createElement('div');
        target.className = 'adopted-image';
        container.append(target, host);
        document.adoptedStyleSheets = [sheet];
        const createElement = spyOn(document, 'createElement').and.callThrough();
        try {
            createOrUpdateLeanTheme(theme, null, false);
            await timeout(300);
            expect(createElement.calls.allArgs().some(([tag]) => tag.toLowerCase() === 'canvas')).toBe(false);
        } finally {
            removeLeanTheme();
            document.adoptedStyleSheets = [];
        }
    });

    it('themes an adopted sheet again after the page removes and re-adds it', async () => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync('.readopted-target { background-color: white; }');
        const target = document.createElement('div');
        target.className = 'readopted-target';
        container.append(target);
        document.adoptedStyleSheets = [sheet];
        try {
            createOrUpdateLeanTheme(theme, null, false);
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
            document.adoptedStyleSheets = document.adoptedStyleSheets.filter((entry) => entry !== sheet);
            await timeout(150);
            expect(getComputedStyle(target).backgroundColor).toBe('rgba(0, 0, 0, 0)');
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
            await timeout(150);
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
        } finally {
            removeLeanTheme();
            document.adoptedStyleSheets = [];
        }
    });

    it('queues and matches variables when a page adopts a new stylesheet', async () => {
        const addRules = spyOn(VariablesStore.prototype, 'addRulesForMatching').and.callThrough();
        const matchVariables = spyOn(VariablesStore.prototype, 'matchVariablesAndDependents').and.callThrough();
        createOrUpdateLeanTheme(theme, null, false);
        await timeout(100);
        addRules.calls.reset();
        matchVariables.calls.reset();
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(':root { --late-adopted: white; } .late-adopted { background-color: var(--late-adopted); }');
        const target = document.createElement('div');
        target.className = 'late-adopted';
        container.append(target);
        try {
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
            await timeout(150);
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
            expect(addRules).toHaveBeenCalledWith(sheet.cssRules);
            expect(matchVariables).toHaveBeenCalled();
        } finally {
            removeLeanTheme();
            document.adoptedStyleSheets = [];
        }
    });

    it('themes chained variables when an adopted sheet appears after activation', async () => {
        const style = document.createElement('style');
        style.textContent = '.late-variable { background-color: var(--late-alias); } .late-reference { background-color: white; }';
        const variable = document.createElement('div');
        variable.className = 'late-variable';
        const reference = document.createElement('div');
        reference.className = 'late-reference';
        container.append(style, variable, reference);
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(':root { --late-alias: var(--late-source); --late-source: white; }');
        try {
            createOrUpdateLeanTheme(theme, null, false);
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
            await timeout(150);
            expect(getComputedStyle(reference).backgroundColor).toBe('rgb(17, 17, 17)');
            expect(getComputedStyle(variable).backgroundColor).toBe(getComputedStyle(reference).backgroundColor);
        } finally {
            removeLeanTheme();
            document.adoptedStyleSheets = [];
        }
    });

    it('themes chained variables declared in an adopted sheet', () => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(':root { --adopted-alias: var(--adopted-source); --adopted-source: white; }');
        const style = document.createElement('style');
        style.textContent = '.chained-variable { background-color: var(--adopted-alias); } .chained-reference { background-color: white; }';
        const variable = document.createElement('div');
        variable.className = 'chained-variable';
        const reference = document.createElement('div');
        reference.className = 'chained-reference';
        container.append(style, variable, reference);
        document.adoptedStyleSheets = [sheet];
        try {
            createOrUpdateLeanTheme(theme, null, false);
            expect(getComputedStyle(reference).backgroundColor).toBe('rgb(17, 17, 17)');
            expect(getComputedStyle(variable).backgroundColor).toBe(getComputedStyle(reference).backgroundColor);
        } finally {
            removeLeanTheme();
            document.adoptedStyleSheets = [];
        }
    });

    it('themes a regular rule that uses a variable declared in an adopted sheet', () => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(':root { --shared-adopted-color: white; }');
        const style = document.createElement('style');
        style.textContent = '.shared-variable { background-color: var(--shared-adopted-color); } .shared-reference { background-color: white; }';
        const variable = document.createElement('div');
        variable.className = 'shared-variable';
        const reference = document.createElement('div');
        reference.className = 'shared-reference';
        container.append(style, variable, reference);
        document.adoptedStyleSheets = [sheet];
        try {
            createOrUpdateLeanTheme(theme, null, false);
            expect(getComputedStyle(reference).backgroundColor).toBe('rgb(17, 17, 17)');
            expect(getComputedStyle(variable).backgroundColor).toBe(getComputedStyle(reference).backgroundColor);
        } finally {
            removeLeanTheme();
            document.adoptedStyleSheets = [];
        }
    });

    it('updates adopted CSS variable colors after a same-count declaration edit', async () => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(':root { --adopted-color: white; } .adopted-variable { background-color: var(--adopted-color); }');
        const target = document.createElement('div');
        target.className = 'adopted-variable';
        container.append(target);
        document.adoptedStyleSheets = [sheet];
        try {
            createOrUpdateLeanTheme(theme, null, false);
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
            (sheet.cssRules[0] as CSSStyleRule).style.setProperty('--adopted-color', 'red');
            await timeout(150);
            expect(getComputedStyle(target).backgroundColor).not.toBe('rgb(17, 17, 17)');
        } finally {
            removeLeanTheme();
            document.adoptedStyleSheets = [];
        }
    });

    it('updates an adopted sheet when its rules change and restores native declarations on cleanup', async () => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync('.adopted-edit { background-color: white; }');
        const target = document.createElement('div');
        target.className = 'adopted-edit';
        container.append(target);
        document.adoptedStyleSheets = [sheet];
        const originalGetter = Object.getOwnPropertyDescriptor(CSSStyleRule.prototype, 'style')!.get;
        createOrUpdateLeanTheme(theme, null, false);
        expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
        sheet.replaceSync('.adopted-edit { background-color: red; }');
        await timeout(150);
        expect(getComputedStyle(target).backgroundColor).not.toBe('rgb(17, 17, 17)');
        removeLeanTheme();
        expect(Object.getOwnPropertyDescriptor(CSSStyleRule.prototype, 'style')!.get).toBe(originalGetter);
        expect(document.adoptedStyleSheets).toEqual([sheet]);
        document.adoptedStyleSheets = [];
    });

    it('reflects a CSSOM declaration change without a notification', async () => {
        const style = document.createElement('style');
        style.textContent = '.cssom-change { background-color: white; }';
        const target = document.createElement('div');
        target.className = 'cssom-change';
        container.append(style, target);
        createOrUpdateLeanTheme(theme, null, false);
        const rule = style.sheet!.cssRules[0] as CSSStyleRule;
        const declaration = rule.style;
        expect(rule.style).toBe(declaration);
        expect(declaration instanceof CSSStyleDeclaration).toBe(true);
        expect(declaration.getPropertyValue('background-color')).toBe('white');
        expect(CSSStyleDeclaration.prototype.getPropertyValue.call(declaration, 'background-color')).toBe('white');
        rule.style.backgroundColor = 'red';
        await timeout(150);
        expect(getComputedStyle(target).backgroundColor).not.toBe('rgb(17, 17, 17)');
    });

    it('preserves native declaration methods while detecting CSSOM edits', async () => {
        const style = document.createElement('style');
        style.textContent = '.cssom-methods { background-color: white; color: black; }';
        const target = document.createElement('div');
        target.className = 'cssom-methods';
        container.append(style, target);
        createOrUpdateLeanTheme(theme, null, false);
        const declaration = (style.sheet!.cssRules[0] as CSSStyleRule).style;
        expect(CSSStyleDeclaration.prototype.item.call(declaration, 0)).toBe('background-color');
        declaration.setProperty('background-color', 'red', 'important');
        expect(declaration.getPropertyPriority('background-color')).toBe('important');
        await timeout(150);
        expect(getComputedStyle(target).backgroundColor).not.toBe('rgb(17, 17, 17)');
        expect(declaration.removeProperty('background-color')).toBe('red');
        await timeout(150);
        expect(getComputedStyle(target).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    });

    it('styles page via adoptedStyleSheets with zero .nyx--sync or canvas elements', () => {
        const style = document.createElement('style');
        style.textContent = multiline(
            'body { background-color: #ffffff; color: #000000; }',
            '.card { background-image: url("https://example.com/hero.png"); color: #222222; }',
        );
        container.append(style);

        const canvasSpy = spyOn(document, 'createElement').and.callThrough();

        createOrUpdateLeanTheme(theme, null, false);

        expect(document.querySelectorAll('style.nyx--sync').length).toBe(0);
        expect(document.adoptedStyleSheets.length).toBeGreaterThan(0);

        const createdCanvas = canvasSpy.calls.allArgs().some(([tag]) => tag.toLowerCase() === 'canvas');
        expect(createdCanvas).toBe(false);

        expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(17, 17, 17)');
        expect(getComputedStyle(document.body).color).toBe('rgb(238, 238, 238)');

        const exported = serializeLeanCSS();
        expect(exported.length).toBeGreaterThan(0);
        expect(exported).toContain('.card');
    });

    it('applies dynamic-theme fixes, --nyx-* variables, and ${...} templates', () => {
        container.innerHTML = '<div class="banner">Hello</div><img class="logo" src="about:blank">';

        createOrUpdateLeanTheme(theme, {
            url: ['*'],
            invert: ['.logo'],
            css: '.banner { background-color: var(--nyx-neutral-background); color: ${#000000}; }',
            ignoreInlineStyle: [],
            ignoreImageAnalysis: [],
            ignoreCSSUrl: [],
            disableStyleSheetsProxy: false,
            disableCustomElementRegistryProxy: false,
        }, false);

        expect(document.querySelectorAll('style.nyx--sync').length).toBe(0);
        const banner = container.querySelector('.banner')!;
        const logo = container.querySelector('.logo')!;
        expect(getComputedStyle(banner).backgroundColor).toBe('rgb(17, 17, 17)');
        expect(getComputedStyle(banner).color).toBe('rgb(238, 238, 238)');
        expect(getComputedStyle(logo).filter).toContain('invert');
    });

    it('themes an open shadow root added after activation and cleans it on removal', async () => {
        createOrUpdateLeanTheme(theme, null, false);
        const host = document.createElement('div');
        const shadow = host.attachShadow({mode: 'open'});
        shadow.innerHTML = '<style>.late-shadow { background-color: white; }</style><span class="late-shadow">Late</span>';
        container.append(host);
        await timeout(150);
        const target = shadow.querySelector('.late-shadow')!;
        expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
        removeLeanTheme();
        expect(shadow.adoptedStyleSheets.length).toBe(0);
        expect(getComputedStyle(target).backgroundColor).toBe('rgb(255, 255, 255)');
    });

    it('removes overrides when a style element is directly removed', async () => {
        const target = document.createElement('div');
        target.className = 'direct-removal';
        const style = document.createElement('style');
        style.textContent = '.direct-removal { background-color: white; }';
        container.append(style, target);
        createOrUpdateLeanTheme(theme, null, false);
        expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
        style.remove();
        await timeout(150);
        expect(getComputedStyle(target).backgroundColor).toBe('rgba(0, 0, 0, 0)');
        expect(serializeLeanCSS()).not.toContain('.direct-removal');
    });

    it('updates styles when animation-frame scheduling is unavailable', async () => {
        const original = window.requestAnimationFrame;
        Object.defineProperty(window, 'requestAnimationFrame', {value: undefined, configurable: true, writable: true});
        try {
            const target = document.createElement('div');
            target.className = 'no-frame-target';
            container.append(target);
            createOrUpdateLeanTheme(theme, null, false);
            const style = document.createElement('style');
            style.textContent = '.no-frame-target { background-color: white; }';
            container.append(style);
            await timeout(150);
            expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
        } finally {
            removeLeanTheme();
            Object.defineProperty(window, 'requestAnimationFrame', {value: original, configurable: true, writable: true});
        }
    });

    it('updates and removes dynamic styles inside an active shadow root', async () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({mode: 'open'});
        const target = document.createElement('span');
        target.className = 'shadow-dynamic';
        shadow.append(target);
        container.append(host);
        createOrUpdateLeanTheme(theme, null, false);
        const style = document.createElement('style');
        style.textContent = '.shadow-dynamic { background-color: white; }';
        shadow.append(style);
        await timeout(150);
        expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
        style.remove();
        await timeout(150);
        expect(getComputedStyle(target).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    });

    it('removes overrides when a dynamically inserted style container is removed', async () => {
        const target = document.createElement('div');
        target.className = 'dynamic-removal';
        container.append(target);
        createOrUpdateLeanTheme(theme, null, false);
        const holder = document.createElement('section');
        const style = document.createElement('style');
        style.textContent = '.dynamic-removal { background-color: white; }';
        holder.append(style);
        container.append(holder);
        await timeout(150);
        expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
        holder.remove();
        await timeout(150);
        expect(getComputedStyle(target).backgroundColor).toBe('rgba(0, 0, 0, 0)');
        expect(serializeLeanCSS()).not.toContain('.dynamic-removal');
    });

    it('supports open ShadowRoot adoptedStyleSheets and coalesced DOM updates', async () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({mode: 'open'});
        const shadowStyle = document.createElement('style');
        shadowStyle.textContent = '.inner { background-color: #ffffff; color: #000000; }';
        const inner = document.createElement('span');
        inner.className = 'inner';
        inner.textContent = 'Shadow';
        shadow.append(shadowStyle, inner);
        container.append(host);

        createOrUpdateLeanTheme(theme, null, false);

        expect(shadow.adoptedStyleSheets.length).toBeGreaterThan(0);
        expect(shadow.querySelectorAll('style.nyx--sync').length).toBe(0);
        expect(getComputedStyle(inner).backgroundColor).toBe('rgb(17, 17, 17)');

        // Append dynamic style and verify coalesced flush picks it up
        const lateStyle = document.createElement('style');
        lateStyle.textContent = '.late { color: #111111; }';
        container.append(lateStyle);
        await timeout(50);

        expect(serializeLeanCSS()).toContain('.late');

        removeLeanTheme();
        expect(shadow.adoptedStyleSheets.length).toBe(0);
        expect(document.adoptedStyleSheets.length).toBe(0);
    });

    it('orders override and inline sheets after dynamicSheets so site fixes win (REQ-LEAN-3)', () => {
        const style = document.createElement('style');
        style.textContent = '.box { background-color: #ffffff; }';
        const box = document.createElement('div');
        box.className = 'box';
        container.append(style, box);

        createOrUpdateLeanTheme(theme, {
            url: ['*'],
            invert: [],
            css: '.box { background-color: rgb(255, 0, 0); }',
            ignoreInlineStyle: [],
            ignoreImageAnalysis: [],
            ignoreCSSUrl: [],
            disableStyleSheetsProxy: false,
            disableCustomElementRegistryProxy: false,
        }, false);

        expect(getComputedStyle(box).backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('re-renders existing style sheets when rules are inserted via CSSOM (REQ-LEAN-2)', async () => {
        const style = document.createElement('style');
        style.textContent = '.initial { color: #000000; }';
        const target = document.createElement('div');
        target.className = 'mutated';
        container.append(style, target);

        createOrUpdateLeanTheme(theme, null, false);
        style.sheet!.insertRule('.mutated { background-color: #ffffff; }', style.sheet!.cssRules.length);
        style.dispatchEvent(new CustomEvent('__nyx__updateSheet'));
        await timeout(80);

        expect(serializeLeanCSS()).toContain('.mutated');
        expect(getComputedStyle(target).backgroundColor).toBe('rgb(17, 17, 17)');
    });

    it('themes page-authored adoptedStyleSheets on document and ShadowRoot without removing them on cleanup (REQ-LEAN-4)', () => {
        const pageDocSheet = new CSSStyleSheet();
        pageDocSheet.replaceSync('.doc-adopted { background-color: #ffffff; color: #000000; }');
        document.adoptedStyleSheets = [pageDocSheet];

        const host = document.createElement('div');
        const shadow = host.attachShadow({mode: 'open'});
        const pageShadowSheet = new CSSStyleSheet();
        pageShadowSheet.replaceSync('.shadow-adopted { background-color: #ffffff; color: #000000; }');
        shadow.adoptedStyleSheets = [pageShadowSheet];

        const docEl = document.createElement('div');
        docEl.className = 'doc-adopted';
        const shadowEl = document.createElement('div');
        shadowEl.className = 'shadow-adopted';
        shadow.append(shadowEl);
        container.append(docEl, host);

        createOrUpdateLeanTheme(theme, null, false);

        expect(getComputedStyle(docEl).backgroundColor).toBe('rgb(17, 17, 17)');
        expect(getComputedStyle(shadowEl).backgroundColor).toBe('rgb(17, 17, 17)');

        removeLeanTheme();
        expect(document.adoptedStyleSheets).toEqual([pageDocSheet]);
        expect(shadow.adoptedStyleSheets).toEqual([pageShadowSheet]);
        document.adoptedStyleSheets = [];
    });
});
