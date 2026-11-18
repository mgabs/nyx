import {isFirefox} from '../../utils/platform';

export function applyAdoptedOrder(root: Document | ShadowRoot, pageSheets: CSSStyleSheet[], ordered: CSSStyleSheet[]): void {
    if (isFirefox) {
        pageSheets.splice(0, pageSheets.length, ...ordered);
    } else {
        root.adoptedStyleSheets = ordered;
    }
}
