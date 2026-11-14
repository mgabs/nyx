import type {Theme} from '../../definitions';
import {clamp} from '../../utils/math';
import {getAbsoluteURL} from '../../utils/url';
import {readImageDetailsCache, writeImageDetailsCache} from '../cache';
import {logInfo, logWarn} from '../utils/log';

import {getCSSURLValue, getCSSBaseBath} from './css-rules';
import type {ImageDetails} from './image';
import {
    getImageDetails,
    getFilteredImageURL,
    getSolidColorImageURL,
    cleanImageProcessingCache,
    requestBlobURLCheck,
    isBlobURLCheckResultReady,
    tryConvertDataURLToBlobURL,
} from './image';
import {modifyBackgroundColor} from './modify-colors';
import type {CSSValueModifier, FilterType} from './modify-css';
import {queueImageSelectorCheck, registerImageURLModifier} from './modify-css';
import {getSheetScope} from './style-scope';

const imageDetailsCache = new Map<string, ImageDetails>();
const awaitingForImageLoading = new Map<string, Array<(imageDetails: ImageDetails | null) => void>>();
let didTryLoadCache = false;

function canFilterImage(url: string): boolean {
    if (url.startsWith('data:')) {
        return true;
    }
    try {
        return new URL(url).origin === location.origin;
    } catch {
        return false;
    }
}

function getBgImageValue(
    imageDetails: ImageDetails,
    theme: Theme,
    rule: CSSStyleRule,
    pushFilter: ((type: FilterType) => void) | null,
): string | null {
    const {isDark, isLight, isTransparent, isLarge, solidColor, width} = imageDetails;
    let result: string | null = null;
    const logSrc = imageDetails.src.startsWith('data:') ? 'data:' : imageDetails.src;

    const isSafeToInvert = () => {
        const repeat = (rule.style.backgroundRepeat || '').toLowerCase();
        const size = (rule.style.backgroundSize || '').toLowerCase();
        const isTiled = repeat.length > 0 && repeat !== 'no-repeat' && !repeat.includes('no-repeat');
        const isStretched = size.includes('cover') || size.includes('contain') || size.includes('100%');
        return !isTiled && !isStretched;
    };

    if (isLarge && isLight && !isTransparent && theme.mode === 1) {
        logInfo(`Hiding large light image ${logSrc}`);
        result = 'none';
    } else if (isDark && isTransparent && theme.mode === 1 && width > 2) {
        logInfo(`Inverting dark image ${logSrc}`);
        if (canFilterImage(imageDetails.src)) {
            const inverted = getFilteredImageURL(imageDetails, {...theme, sepia: clamp(theme.sepia + 10, 0, 100)});
            result = `url("${inverted}")`;
        } else if (isSafeToInvert()) {
            pushFilter?.('invert');
        }
    } else if (isLight && !isTransparent && theme.mode === 1) {
        if (solidColor) {
            logInfo(`Replacing image with a solid color ${logSrc}`);
            const darkColor = modifyBackgroundColor(solidColor, theme, false);
            const solid = getSolidColorImageURL(imageDetails, darkColor);
            result = `url("${solid}")`;
        } else if (canFilterImage(imageDetails.src)) {
            logInfo(`Inverting light image ${logSrc}`);
            const inverted = getFilteredImageURL(imageDetails, theme);
            result = `url("${inverted}")`;
        } else if (isSafeToInvert()) {
            pushFilter?.('invert');
        }
    } else if (theme.mode === 0 && isLight && imageDetails.dataURL) {
        logInfo(`Applying filter to image ${logSrc}`);
        if (canFilterImage(imageDetails.src)) {
            const filtered = getFilteredImageURL(imageDetails, {...theme, brightness: clamp(theme.brightness - 10, 5, 200), sepia: clamp(theme.sepia + 10, 0, 100)});
            result = `url("${filtered}")`;
        } else {
            pushFilter?.('dim');
        }
    } else {
        if (theme.mode === 1 && !canFilterImage(imageDetails.src)) {
            pushFilter?.('none');
        }
        logInfo(`Not modifying the image ${logSrc}`);
    }
    return result;
}

export function createImageURLModifier(
    urlValue: string,
    rule: CSSStyleRule,
    isCancelled: () => boolean,
    pushFilter: ((type: FilterType) => void) | null,
): CSSValueModifier {
    if (!didTryLoadCache) {
        didTryLoadCache = true;
        readImageDetailsCache(imageDetailsCache);
    }

    let url = getCSSURLValue(urlValue);
    const isURLEmpty = url.length === 0;
    const {parentStyleSheet} = rule;
    const ownerNode = parentStyleSheet?.ownerNode;
    const scope = (parentStyleSheet && getSheetScope(parentStyleSheet)) ?? document;
    const baseURL = (parentStyleSheet && parentStyleSheet.href) ?
        getCSSBaseBath(parentStyleSheet.href) :
        ownerNode?.baseURI || location.origin;
    url = getAbsoluteURL(baseURL, url);

    return async (theme: Theme): Promise<string | null> => {
        if (isURLEmpty) {
            return "url('')";
        }

        let selector = rule.selectorText;
        if (selector) {
            if (selector.includes('::before')) {
                selector = selector.replaceAll('::before', '');
            }
            if (selector.includes('::after')) {
                selector = selector.replaceAll('::after', '');
            }
            if (!scope.querySelector(selector)) {
                await queueImageSelectorCheck(selector);
            }
        }

        let imageDetails: ImageDetails | null = null;
        if (imageDetailsCache.has(url)) {
            imageDetails = imageDetailsCache.get(url)!;
        } else {
            try {
                if (!isBlobURLCheckResultReady()) {
                    await requestBlobURLCheck();
                }
                if (awaitingForImageLoading.has(url)) {
                    const awaiters = awaitingForImageLoading.get(url)!;
                    imageDetails = await new Promise<ImageDetails | null>((resolve) => awaiters.push(resolve));
                    if (!imageDetails) {
                        return null;
                    }
                } else {
                    awaitingForImageLoading.set(url, []);
                    imageDetails = await getImageDetails(url);
                    imageDetailsCache.set(url, imageDetails);
                    if (!url.startsWith('data:')) {
                        const parsedURL = new URL(url);
                        if (parsedURL.origin === location.origin) {
                            writeImageDetailsCache(url, imageDetails);
                        }
                    }
                    awaitingForImageLoading.get(url)!.forEach((resolve) => resolve(imageDetails));
                    awaitingForImageLoading.delete(url);
                }
                if (isCancelled()) {
                    return null;
                }
            } catch (err) {
                logWarn(err);
                if (awaitingForImageLoading.has(url)) {
                    awaitingForImageLoading.get(url)!.forEach((resolve) => resolve(null));
                    awaitingForImageLoading.delete(url);
                }
            }
        }
        if (imageDetails) {
            const bgImageValue = getBgImageValue(imageDetails, theme, rule, pushFilter);
            if (bgImageValue) {
                return bgImageValue;
            }
        }
        if (url.startsWith('data:')) {
            const blobURL = await tryConvertDataURLToBlobURL(url);
            if (blobURL) {
                return `url("${blobURL}")`;
            }
        }
        return `url("${url}")`;
    };
}

export function cleanImageURLModifierCache(): void {
    imageDetailsCache.clear();
    cleanImageProcessingCache();
    awaitingForImageLoading.clear();
}

registerImageURLModifier(createImageURLModifier, cleanImageURLModifierCache);
