import {ThemeEngine} from '../../../src/generators/theme-engines';

describe('Lean Dynamic extension integration', () => {
    it('themes a page and reacts to a stylesheet declaration change', async () => {
        const original = await backgroundUtils.collectData();
        try {
            await backgroundUtils.changeSettings({theme: {...original.settings.theme, engine: ThemeEngine.leanDynamicTheme}});
            expect((await backgroundUtils.collectData()).settings.theme.engine).toBe(ThemeEngine.leanDynamicTheme);
            await loadTestPage({
                '/': '<!doctype html><html><head><style>.lean-target { background-color: white; }</style></head><body><div class="lean-target">Text</div></body></html>',
            });
            await expectPageStyles(expect, ['.lean-target', 'background-color', 'rgb(24, 26, 27)']);
            const initial = await pageUtils.evaluateScript(() => {
                const target = document.querySelector('.lean-target')!;
                const source = document.querySelector('style:not(.nyx)') as HTMLStyleElement;
                const rule = source.sheet!.cssRules[0] as CSSStyleRule;
                const before = getComputedStyle(target).backgroundColor;
                rule.style.backgroundColor = 'red';
                return {before, syncStyles: document.querySelectorAll('style.nyx--sync').length};
            });
            expect(initial.syncStyles).toBe(0);
            await new Promise((resolve) => setTimeout(resolve, 250));
            const after = await pageUtils.evaluateScript(() => getComputedStyle(document.querySelector('.lean-target')!).backgroundColor);
            expect(after).not.toBe(initial.before);

            const shadowColors = await pageUtils.evaluateScript(async () => {
                const sheet = new CSSStyleSheet();
                sheet.replaceSync('.shared-target { background-color: white; }');
                const roots = [document.createElement('div'), document.createElement('div')].map((host) => {
                    const root = host.attachShadow({mode: 'open'});
                    root.adoptedStyleSheets = [sheet];
                    root.innerHTML = '<div class="shared-target">Shadow</div>';
                    document.body.append(host);
                    return root;
                });
                await new Promise((resolve) => setTimeout(resolve, 300));
                return roots.map((root) => getComputedStyle(root.querySelector('.shared-target')!).backgroundColor);
            });
            expect(shadowColors).toEqual(['rgb(24, 26, 27)', 'rgb(24, 26, 27)']);

            const reorderedColor = await pageUtils.evaluateScript(async () => {
                const white = new CSSStyleSheet();
                const red = new CSSStyleSheet();
                white.replaceSync('.reordered-target { background-color: white; }');
                red.replaceSync('.reordered-target { background-color: red; }');
                const target = document.createElement('div');
                target.className = 'reordered-target';
                document.body.append(target);
                document.adoptedStyleSheets = [...document.adoptedStyleSheets, white, red];
                await new Promise((resolve) => setTimeout(resolve, 200));
                const remaining = document.adoptedStyleSheets.filter((sheet) => sheet !== white && sheet !== red);
                document.adoptedStyleSheets = [red, white, ...remaining];
                await new Promise((resolve) => setTimeout(resolve, 200));
                return getComputedStyle(target).backgroundColor;
            });
            expect(reorderedColor).toBe('rgb(24, 26, 27)');
        } finally {
            await backgroundUtils.changeSettings({theme: original.settings.theme});
        }
    });
});
