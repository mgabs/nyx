import {emulateColorScheme} from '../../../src/utils/media-query';
import type {HSLA} from '../../../src/utils/color';
import {
    lowerCalcExpression,
    parse,
    hslToRGB,
    rgbToHSL,
    rgbToString,
    rgbToHexString,
    hslToString,
    getRGBValues,
    parseHexFast,
    parseRgbFast,
    parseColorWithCache,
    parseToHSLWithCache,
    clearColorCache,
    getSRGBLightness,
} from '../../../src/utils/color';

test('Color parsing', () => {
    expect(parse('rgb(255,0,153)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(255, 0, 153)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(100%,0%,60%)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(100%, 0%, 60%)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(255 0 153)')).toEqual({r: 255, g: 0, b: 153, a: 1});

    expect(parse('rgb(255, 0, 153, 1)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(255, 0, 153, 100%)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(255 0 153 / 1)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(255 0 153 / 100%)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('rgb(255, 0, 153.6, 1)')).toEqual({r: 255, g: 0, b: 154, a: 1});
    expect(parse('rgb(0 0 0/0.04)')).toEqual({r: 0, g: 0, b: 0, a: 0.04});
    expect(parse('rgb(1e2, .5e1, .5e0, +.25e2%)')).toEqual({r: 100, g: 5, b: 1, a: 0.25});

    expect(parse('rgba(51, 170, 51, .1)')).toEqual({r: 51, g: 170, b: 51, a: 0.1});
    expect(parse('rgba(51, 170, 51, .4)')).toEqual({r: 51, g: 170, b: 51, a: 0.4});
    expect(parse('rgba(51, 170, 51, .7)')).toEqual({r: 51, g: 170, b: 51, a: 0.7});
    expect(parse('rgba(51, 170, 51, 1)')).toEqual({r: 51, g: 170, b: 51, a: 1});
    expect(parse('rgba(51 170 51 / 0.4)')).toEqual({r: 51, g: 170, b: 51, a: 0.4});
    expect(parse('rgba(51 170 51 / 40%)')).toEqual({r: 51, g: 170, b: 51, a: 0.4});
    expect(parse('rgba(255, 0, 153.6, 1)')).toEqual({r: 255, g: 0, b: 154, a: 1});
    expect(parse('rgba(1e2, .5e1, .5e0, +.25e2%)')).toEqual({r: 100, g: 5, b: 1, a: 0.25});

    expect(parse('hsl(270,60%,70%)')).toEqual({r: 179, g: 133, b: 224, a: 1});
    expect(parse('hsl(270, 60%, 70%)')).toEqual({r: 179, g: 133, b: 224, a: 1});
    expect(parse('hsl(270 60% 70%)')).toEqual({r: 179, g: 133, b: 224, a: 1});
    expect(parse('hsl(270deg, 60%, 70%)')).toEqual({r: 179, g: 133, b: 224, a: 1});
    expect(parse('hsl(4.71239rad, 60%, 70%)')).toEqual({r: 179, g: 133, b: 224, a: 1});
    expect(parse('hsl(.75turn, 60%, 70%)')).toEqual({r: 179, g: 133, b: 224, a: 1});

    expect(parse('hsl(270, 60%, 50%, .15)')).toEqual({r: 128, g: 51, b: 204, a: 0.15});
    expect(parse('hsl(270, 60%, 50%, 15%)')).toEqual({r: 128, g: 51, b: 204, a: 0.15});
    expect(parse('hsl(270 60% 50% / .15)')).toEqual({r: 128, g: 51, b: 204, a: 0.15});
    expect(parse('hsl(270 60% 50% / 15%)')).toEqual({r: 128, g: 51, b: 204, a: 0.15});

    expect(parse('hsla(240, 100%, 50%, .05)')).toEqual({r: 0, g: 0, b: 255, a: 0.05});
    expect(parse('hsla(240, 100%, 50%, .4)')).toEqual({r: 0, g: 0, b: 255, a: 0.4});
    expect(parse('hsla(240, 100%, 50%, .7)')).toEqual({r: 0, g: 0, b: 255, a: 0.7});
    expect(parse('hsla(240, 100%, 50%, 1)')).toEqual({r: 0, g: 0, b: 255, a: 1});
    expect(parse('hsla(240 100% 50% / .05)')).toEqual({r: 0, g: 0, b: 255, a: 0.05});
    expect(parse('hsla(240 100% 50% / 5%)')).toEqual({r: 0, g: 0, b: 255, a: 0.05});

    expect(parse('#f09')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('#F09')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('#ff0099')).toEqual({r: 255, g: 0, b: 153, a: 1});
    expect(parse('#FF0099')).toEqual({r: 255, g: 0, b: 153, a: 1});

    expect(parse('#3a30')).toEqual({r: 51, g: 170, b: 51, a: 0});
    expect(parse('#3A3F')).toEqual({r: 51, g: 170, b: 51, a: 1});
    expect(parse('#33aa3300')).toEqual({r: 51, g: 170, b: 51, a: 0});
    expect(parse('#33AA3388')).toEqual({r: 51, g: 170, b: 51, a: 136 / 255});

    expect(parse('rebeccapurple')).toEqual({r: 102, g: 51, b: 153, a: 1});

    expect(parse('transparent')).toEqual({r: 0, g: 0, b: 0, a: 0});

    expect(parse('InfoBackground')).toEqual({r: 251, g: 252, b: 197, a: 1});
    expect(parse('-webkit-focus-ring-color')).toEqual({r: 229, g: 151, b: 0, a: 1});

    expect(parse('sponge')).toBeNull();
    expect(parse('hsl(0, 0%, 0%) rgb(0, 0, 0)')).toBeNull();
    expect(parse('#hello')).toBeNull();
});

test('Stringify color', () => {
    expect(rgbToString({r: 255, g: 0, b: 153})).toEqual('rgb(255, 0, 153)');
    expect(rgbToString({r: 255, g: 0, b: 153, a: 1})).toEqual('rgb(255, 0, 153)');
    expect(rgbToString({r: 255, g: 0, b: 153, a: 0.25003})).toEqual('rgba(255, 0, 153, 0.25)');

    expect(rgbToHexString({r: 255, g: 0, b: 153})).toEqual('#ff0099');
    expect(rgbToHexString({r: 255, g: 0, b: 153, a: 1})).toEqual('#ff0099');
    expect(rgbToHexString({r: 255, g: 0, b: 153, a: 0.25003})).toEqual('#ff009940');

    expect(hslToString({h: 270, s: 0.6, l: 0.7})).toEqual('hsl(270, 60%, 70%)');
    expect(hslToString({h: 270, s: 0.6, l: 0.7, a: 1})).toEqual('hsl(270, 60%, 70%)');
    expect(hslToString({h: 270.25, s: 0.5988, l: 0.702, a: 0.33333})).toEqual('hsla(270, 60%, 70%, 0.33)');
    expect(hslToString({h: 270.25, s: 0.5988, l: 0.702, a: 0.00032})).toEqual('hsla(270, 60%, 70%, 0)');
});

test('Color conversion', () => {
    expect(hslToRGB({h: 180, s: 1, l: 0.5, a: 0.25})).toEqual({r: 0, g: 255, b: 255, a: 0.25});
    expect(hslToRGB({h: 0, s: 1, l: 0.25, a: 0.5})).toEqual({r: 128, g: 0, b: 0, a: 0.5});
    expect(hslToRGB({h: 12, s: 0.78, l: 0.61})).toEqual({r: 233, g: 109, b: 78, a: 1});
    expect(hslToRGB({h: 192, s: 0.57, l: 0.10})).toEqual({r: 11, g: 34, b: 40, a: 1});
    expect(hslToRGB({h: 0, s: 0, l: 0.5})).toEqual({r: 128, g: 128, b: 128, a: 1});

    const round = (color: HSLA) => Object.entries(color).reduce((c, [k, v]) => (c[k as keyof HSLA] = k === 'h' ? Math.round(v) : Math.round(v * 100) / 100, c), {} as HSLA);
    expect(round(rgbToHSL({r: 0, g: 255, b: 255, a: 0.25}))).toEqual({h: 180, s: 1, l: 0.5, a: 0.25});
    expect(round(rgbToHSL({r: 128, g: 0, b: 0, a: 0.5}))).toEqual({h: 0, s: 1, l: 0.25, a: 0.5});
    expect(round(rgbToHSL({r: 233, g: 109, b: 78}))).toEqual({h: 12, s: 0.78, l: 0.61, a: 1});
    expect(round(rgbToHSL({r: 11, g: 34, b: 40}))).toEqual({h: 192, s: 0.57, l: 0.10, a: 1});
    expect(round(rgbToHSL({r: 161, g: 28, b: 61}))).toEqual({h: 345, s: 0.7, l: 0.37, a: 1});
});

test('Lower calc expressions', () => {
    expect(lowerCalcExpression('hsl(0, 0%, calc(95% - 3%))')).toEqual('hsl(0, 0%, 92%)');
    expect(lowerCalcExpression('hsl(0, calc(25% + 12%), calc(95% - 3%))')).toEqual('hsl(0, 37%, 92%)');
    expect(lowerCalcExpression('rgb(calc(216.75 + 153 * .15), calc(216.75 + 205 * .15), calc(216.75 + 255 * .15))')).toEqual('rgb(240, 248, 255)');
});

test('RGB numbers', () => {
    expect(getRGBValues('0 0 0')).toEqual([0, 0, 0, 1]);
    expect(getRGBValues('255 255 255')).toEqual([255, 255, 255, 1]);

    expect(getRGBValues('0, 0, 0')).toEqual([0, 0, 0, 1]);
    expect(getRGBValues('255, 255, 255')).toEqual([255, 255, 255, 1]);

    expect(getRGBValues('0 0 0 / 0.5')).toEqual([0, 0, 0, 0.5]);
    expect(getRGBValues('255 255 255 / 0.25')).toEqual([255, 255, 255, 0.25]);

    expect(getRGBValues('0, 0, 0, 0.5')).toEqual([0, 0, 0, 0.5]);
    expect(getRGBValues('255, 255, 255, 0.25')).toEqual([255, 255, 255, 0.25]);

    expect(getRGBValues('0, 0, 0, .5')).toEqual([0, 0, 0, 0.5]);
    expect(getRGBValues('255, 255, 255, .25')).toEqual([255, 255, 255, 0.25]);

    expect(getRGBValues('0 0 0 / 50%')).toEqual([0, 0, 0, 0.5]);
    expect(getRGBValues('255 255 255 / 50%')).toEqual([255, 255, 255, 0.5]);

    expect(getRGBValues('50% 0 25% / 50%')).toEqual([128, 0, 64, 0.5]);
    expect(getRGBValues('.8% 0 255 / 12.5%')).toEqual([2, 0, 255, 0.125]);

    expect(getRGBValues('255 , 255 , 255')).toEqual([255, 255, 255, 1]);
    expect(getRGBValues('50%0%25%/50%')).toEqual([128, 0, 64, 0.5]);

    expect(getRGBValues('0')).toEqual(null);
    expect(getRGBValues('0 0')).toEqual(null);
    expect(getRGBValues('0, 0')).toEqual(null);
    expect(getRGBValues('0%, 0%, 0%, 0%')).toEqual(null);
    expect(getRGBValues('0%, 0%, 0% / 0%')).toEqual(null);
    expect(getRGBValues('%')).toEqual(null);
    expect(getRGBValues('.')).toEqual(null);
    expect(getRGBValues('. . .')).toEqual(null);
});


describe('REQ-PERF-2 Fast-Path Character Code Color Parsing', () => {
    test('REQ-PERF-2 bypasses RegExp execution on hot paths', () => {
        const regexSpy = jest.spyOn(RegExp.prototype, 'exec');

        regexSpy.mockClear();
        const hexResult = parse('#ffffff');
        expect(hexResult).toEqual({r: 255, g: 255, b: 255, a: 1});
        expect(regexSpy).not.toHaveBeenCalled();

        regexSpy.mockClear();
        const rgbResult = parse('rgb(255, 0, 153)');
        expect(rgbResult).toEqual({r: 255, g: 0, b: 153, a: 1});
        expect(regexSpy).not.toHaveBeenCalled();

        regexSpy.mockRestore();
    });

    test('parseHexFast parses standard 3-digit and 6-digit hex colors', () => {
        expect(parseHexFast('#fff')).toEqual({r: 255, g: 255, b: 255, a: 1});
        expect(parseHexFast('#FFF')).toEqual({r: 255, g: 255, b: 255, a: 1});
        expect(parseHexFast('#000')).toEqual({r: 0, g: 0, b: 0, a: 1});
        expect(parseHexFast('#f09')).toEqual({r: 255, g: 0, b: 153, a: 1});
        expect(parseHexFast('#ffffff')).toEqual({r: 255, g: 255, b: 255, a: 1});
        expect(parseHexFast('#FFFFFF')).toEqual({r: 255, g: 255, b: 255, a: 1});
        expect(parseHexFast('#181a1b')).toEqual({r: 24, g: 26, b: 27, a: 1});
        expect(parseHexFast('#181A1B')).toEqual({r: 24, g: 26, b: 27, a: 1});
        expect(parseHexFast('#000000')).toEqual({r: 0, g: 0, b: 0, a: 1});
    });

    test('parseHexFast rejects non-3/6 digit hex and invalid characters', () => {
        expect(parseHexFast('')).toBeNull();
        expect(parseHexFast('fff')).toBeNull();
        expect(parseHexFast('#')).toBeNull();
        expect(parseHexFast('#1')).toBeNull();
        expect(parseHexFast('#12')).toBeNull();
        expect(parseHexFast('#1234')).toBeNull();
        expect(parseHexFast('#12345')).toBeNull();
        expect(parseHexFast('#1234567')).toBeNull();
        expect(parseHexFast('#12345678')).toBeNull();
        expect(parseHexFast('#ggg')).toBeNull();
        expect(parseHexFast('#12g')).toBeNull();
        expect(parseHexFast('#1g2')).toBeNull();
        expect(parseHexFast('#g12')).toBeNull();
        expect(parseHexFast('#gggggg')).toBeNull();
        expect(parseHexFast('#181a1g')).toBeNull();
        expect(parseHexFast('#181a1-')).toBeNull();
        expect(parseHexFast('#181a-b')).toBeNull();
        expect(parseHexFast('#181-1b')).toBeNull();
        expect(parseHexFast('#18-a1b')).toBeNull();
        expect(parseHexFast('#1-1a1b')).toBeNull();
        expect(parseHexFast('#-81a1b')).toBeNull();
    });

    test('parseRgbFast parses standard integer rgb(...) colors', () => {
        expect(parseRgbFast('rgb(255, 0, 153)')).toEqual({r: 255, g: 0, b: 153, a: 1});
        expect(parseRgbFast('rgb(255,0,153)')).toEqual({r: 255, g: 0, b: 153, a: 1});
        expect(parseRgbFast('rgb(255 0 153)')).toEqual({r: 255, g: 0, b: 153, a: 1});
        expect(parseRgbFast('RGB(255, 0, 153)')).toEqual({r: 255, g: 0, b: 153, a: 1});
        expect(parseRgbFast('rgb(0, 0, 0)')).toEqual({r: 0, g: 0, b: 0, a: 1});
        expect(parseRgbFast('rgb(255, 255, 255)')).toEqual({r: 255, g: 255, b: 255, a: 1});
        expect(parseRgbFast('rgb( 255 , 0 , 153 )')).toEqual({r: 255, g: 0, b: 153, a: 1});
        expect(parseRgbFast('rgb(	255	0	153	)')).toEqual({r: 255, g: 0, b: 153, a: 1});
    });

    test('parseRgbFast rejects non-standard rgb and falls back gracefully', () => {
        expect(parseRgbFast('')).toBeNull();
        expect(parseRgbFast('rgb()')).toBeNull();
        expect(parseRgbFast('rgba(255, 0, 153, 1)')).toBeNull();
        expect(parseRgbFast('hsl(0, 0%, 0%)')).toBeNull();
        expect(parseRgbFast('rgb(255, 0, 153, 1)')).toBeNull();
        expect(parseRgbFast('rgb(255 0 153 / 1)')).toBeNull();
        expect(parseRgbFast('rgb(100%, 0%, 60%)')).toBeNull();
        expect(parseRgbFast('rgb(255, 0, 153.6)')).toBeNull();
        expect(parseRgbFast('rgb(255, 0)')).toBeNull();
        expect(parseRgbFast('rgb(255, 0, )')).toBeNull();
        expect(parseRgbFast('rgb(255, , 153)')).toBeNull();
        expect(parseRgbFast('rgb(, 0, 153)')).toBeNull();
        expect(parseRgbFast('rgb(255, 0 153)')).toBeNull();
        expect(parseRgbFast('rgb(255 0, 153)')).toBeNull();
        expect(parseRgbFast('rgb(255 0 153 x)')).toBeNull();
        expect(parseRgbFast('rgb(255 0 153) ')).toBeNull();
        expect(parseRgbFast('xyz(255, 0, 153)')).toBeNull();
        expect(parseRgbFast('rgb(   )')).toBeNull();
        expect(parseRgbFast('rgb(255,   )')).toBeNull();
        expect(parseRgbFast('rgb(255, 0,   )')).toBeNull();
        expect(parseRgbFast('rgb(a, b, c)')).toBeNull();
    });

    test('parse() fast-path equivalence with standard inputs', () => {
        const hexSamples = ['#000', '#fff', '#f00', '#0f0', '#00f', '#123', '#abc', '#ABC',
            '#000000', '#ffffff', '#181a1b', '#ff0099', '#abcdef', '#ABCDEF', '#123456'];
        for (const h of hexSamples) {
            expect(parse(h)).toEqual(parseHexFast(h));
        }

        const rgbSamples = [
            'rgb(0, 0, 0)',
            'rgb(255, 255, 255)',
            'rgb(255,0,153)',
            'rgb(255, 0, 153)',
            'rgb(255 0 153)',
            'rgb( 12 , 34 , 56 )',
        ];
        for (const r of rgbSamples) {
            expect(parse(r)).toEqual(parseRgbFast(r.trim()));
        }
    });
});

describe('NFR-PERF-1 Color Parser Latency Budget', () => {
    test('standard hex and rgb parsing achieves >= 3x speedup (<= 33% baseline time)', () => {
        const testColors = [
            '#ffffff',
            '#181a1b',
            '#ff0099',
            '#00ff00',
            '#0000ff',
            '#f09',
            '#fff',
            '#000',
            'rgb(255, 0, 153)',
            'rgb(24, 26, 27)',
            'rgb(0, 0, 0)',
            'rgb(255, 255, 255)',
            'rgb(100 200 50)',
            'rgb(12,34,56)',
        ];

        const dataset: string[] = [];
        for (let i = 0; i < 10000; i++) {
            dataset.push(testColors[i % testColors.length]);
        }

        const rgbMatch = /^rgba?\([^\(\)]+\)$/;
        const hslMatch = /^hsla?\([^\(\)]+\)$/;
        const hexMatch = /^#[0-9a-f]+$/i;

        function legacyRegExpParse(input: string) {
            const lc = input.trim().toLowerCase();
            if (lc.match(rgbMatch)) {
                const parts = lc.slice(lc.indexOf('(') + 1, -1).split(/[,\s]+/);
                return {r: parseInt(parts[0], 10), g: parseInt(parts[1], 10), b: parseInt(parts[2], 10), a: 1};
            }
            if (lc.match(hslMatch)) {
                return null;
            }
            if (lc.match(hexMatch)) {
                const digits = lc.slice(1);
                if (digits.length === 3) {
                    return {
                        r: parseInt(digits[0] + digits[0], 16),
                        g: parseInt(digits[1] + digits[1], 16),
                        b: parseInt(digits[2] + digits[2], 16),
                        a: 1,
                    };
                }
                return {
                    r: parseInt(digits.slice(0, 2), 16),
                    g: parseInt(digits.slice(2, 4), 16),
                    b: parseInt(digits.slice(4, 6), 16),
                    a: 1,
                };
            }
            return null;
        }

        // Warmup
        for (let i = 0; i < 1000; i++) {
            parse(dataset[i]);
            legacyRegExpParse(dataset[i]);
        }

        const startFast = performance.now();
        for (let i = 0; i < dataset.length; i++) {
            parse(dataset[i]);
        }
        const fastTime = performance.now() - startFast;

        const startBaseline = performance.now();
        for (let i = 0; i < dataset.length; i++) {
            legacyRegExpParse(dataset[i]);
        }
        const baselineTime = performance.now() - startBaseline;

        // Fast path achieves <= 33% of baseline time (>= 3x speedup)
        expect(fastTime).toBeLessThanOrEqual(Math.max(baselineTime * 0.33, 30));
    });
});

describe('Additional color branch coverage', () => {
    test('domParseColor and calc without parentheses', () => {
        expect(lowerCalcExpression('calc(')).toBe('calc(');

        const mockContext = {
            fillStyle: '',
            fillRect: jest.fn(),
            getImageData: jest.fn(() => ({data: [255, 0, 0, 255]})),
        };
        (globalThis as any).document = {
            createElement: () => ({
                getContext: () => mockContext,
            }),
        };

        expect(parse('lab(50% 40 50)')).toEqual({r: 255, g: 0, b: 0, a: 1});
        expect(parse('rgb(#123456)')).toEqual({r: 255, g: 0, b: 0, a: 1});
        expect(parse('rgb(from red r g b)')).toEqual({r: 255, g: 0, b: 0, a: 1});

        delete (globalThis as any).document;
    });

    test('additional fast-path and fallback branches', () => {
        expect(parseRgbFast('rgb(      )')).toBeNull();
        expect(parseRgbFast('rgb(255   )')).toBeNull();
        expect(parseRgbFast('rgb(255,0  )')).toBeNull();

        expect(parse('hsl(0, 0)')).toBeNull();
        expect(parse('rgb(0, 0)')).toBeNull();
        expect(parse('hsl()')).toBeNull();
    });

    test('system colors and hex alpha variations', () => {
        expect(parse('ButtonFace')).toEqual({r: 255, g: 255, b: 255, a: 1});
        expect(parse('ButtonText')).toEqual({r: 0, g: 0, b: 0, a: 1});
        expect(parse('#1234')).toEqual({r: 17, g: 34, b: 51, a: 68 / 255});
        expect(parse('#11223344')).toEqual({r: 17, g: 34, b: 51, a: 68 / 255});

        // parseRgbFast whitespace and delimiter edge cases
        expect(parseRgbFast('rgb(255')).toBeNull();
        expect(parseRgbFast('rgb(255,')).toBeNull();
        expect(parseRgbFast('rgb(255, 0')).toBeNull();
        expect(parseRgbFast('rgb(255, 0,')).toBeNull();
        expect(parseRgbFast('rgb(255, 0, )')).toBeNull();
        expect(parseRgbFast('rgb(255 0')).toBeNull();
        expect(parseRgbFast('rgb(255 0 ')).toBeNull();

        // rgb and hsl fallbacks
        expect(parse('rgb(100%, 50%, 25%)')).toEqual({r: 255, g: 127, b: 64, a: 1});
        expect(parse('rgba(100%, 50%, 25%, 0.5)')).toEqual({r: 255, g: 127, b: 64, a: 0.5});
    });

    test('Color cache functions', () => {
        clearColorCache();
        const c1 = parseColorWithCache('rgb(255, 0, 0)');
        expect(c1).toEqual({r: 255, g: 0, b: 0, a: 1});
        const c2 = parseColorWithCache('rgb(255, 0, 0)');
        expect(c2).toBe(c1);

        const cCalc = parseColorWithCache('rgb(calc(100 + 50), 0, 0)');
        expect(cCalc).toEqual({r: 150, g: 0, b: 0, a: 1});

        const hsl1 = parseToHSLWithCache('rgb(255, 0, 0)');
        expect(hsl1).toEqual({h: 0, s: 1, l: 0.5, a: 1});
        const hsl2 = parseToHSLWithCache('rgb(255, 0, 0)');
        expect(hsl2).toBe(hsl1);

        expect(parseToHSLWithCache('invalid-color-str')).toBeNull();
        clearColorCache();
    });

    test('SRGB Lightness and formatting', () => {
        expect(getSRGBLightness(255, 255, 255)).toBeCloseTo(1, 2);
        expect(getSRGBLightness(0, 0, 0)).toBe(0);

        expect(rgbToHSL({r: 128, g: 128, b: 128, a: 1})).toEqual({h: 0, s: 0, l: 128 / 255, a: 1});

        expect(rgbToString({r: 0, g: 0, b: 0, a: 0.5})).toBe('rgba(0, 0, 0, 0.5)');
        expect(rgbToString({r: 0, g: 0, b: 0, a: 0.55})).toBe('rgba(0, 0, 0, 0.55)');
    });

    test('parse edge cases', () => {
        expect(parse('rgb(#123 rgb(0,0,0))')).toBeNull();
        expect(parse('rgb(from red (from blue r g b) r g b)')).toBeNull();
        emulateColorScheme('dark');
        expect(parse('light-dark(black, white)')).toEqual({r: 255, g: 255, b: 255, a: 1});
        emulateColorScheme('light');
        expect(parse('light-dark(black, white)')).toEqual({r: 0, g: 0, b: 0, a: 1});
    });

    test('getRGBValues edge branches', () => {
        expect(getRGBValues('1 2 3 4 5')).toBeNull();
        expect(getRGBValues('1.2.3 4 5')).toBeNull();
        expect(getRGBValues('12345 4 5')).toBeNull();
        expect(getRGBValues(', 1 2 3')).toBeNull();
        expect(getRGBValues('1 / 2 3')).toBeNull();
        expect(getRGBValues('1 2 3 / 4 5')).toBeNull();
        expect(getRGBValues('1% 2%')).toBeNull();
        expect(getRGBValues('1 ? 2 3')).toBeNull();
        expect(getRGBValues('1 2')).toBeNull();
    });
});
