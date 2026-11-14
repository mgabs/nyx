import {getUILanguage} from './locales';
import {isEdge, isMobile} from './platform';

export const HOMEPAGE_URL = 'https://github.com/mgabs/nyx';
export const BLOG_URL = 'https://github.com/mgabs/nyx/wiki/';
export const NEWS_URL = 'https://raw.githubusercontent.com/mgabs/nyx/main/docs/news.json';
export const DEVTOOLS_DOCS_URL = 'https://github.com/mgabs/nyx/blob/main/CONTRIBUTING.md';
export const GITHUB_URL = 'https://github.com/mgabs/nyx';
export const MOBILE_URL = 'https://github.com/mgabs/nyx/wiki/Mobile';
export const PRIVACY_URL = 'https://github.com/mgabs/nyx/blob/main/PRIVACY.md';
export const HELP_URL = 'https://github.com/mgabs/nyx/wiki';
export const CONFIG_URL_BASE = 'https://raw.githubusercontent.com/mgabs/nyx/main/src/config';

const helpLocales = [
    'be',
    'cs',
    'de',
    'en',
    'es',
    'fr',
    'it',
    'ja',
    'nl',
    'pt',
    'ru',
    'sr',
    'tr',
    'zh-CN',
    'zh-TW',
];

export function getHelpURL(): string {
    if (isEdge && isMobile) {
        return `${HELP_URL}/mobile/`;
    }
    const locale = getUILanguage();
    const matchLocale = helpLocales.find((hl) => hl === locale) || helpLocales.find((hl) => locale.startsWith(hl)) || 'en';
    return `${HELP_URL}/${matchLocale}/`;
}

export function getBlogPostURL(postId: string): string {
    if (postId.startsWith('release:')) {
        return `${GITHUB_URL}/releases/tag/${postId.slice('release:'.length)}`;
    }
    return `${BLOG_URL}${postId}`;
}
