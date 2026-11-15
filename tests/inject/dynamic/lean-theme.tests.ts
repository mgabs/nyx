import '../support/polyfills';
import {DEFAULT_THEME} from '../../../src/defaults';
import {createOrUpdateLeanTheme, removeLeanTheme, serializeLeanCSS} from '../../../src/inject/lean-theme';
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
