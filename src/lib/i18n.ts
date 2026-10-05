/**
 * The two editions of the site. Chinese is the default and keeps the unprefixed URLs (/posts/x/);
 * English lives under /en/ (/en/posts/x/). A page belongs to the edition its URL names, and every
 * internal link stays in the reader's edition.
 */
export const LOCALES = ['zh', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh';

/** BCP 47 tag: <html lang>, hreflang, and the `lang` of a post body. */
export const LANG: Record<Locale, string> = { zh: 'zh-CN', en: 'en' };
/** Open Graph locale. */
export const OG_LOCALE: Record<Locale, string> = { zh: 'zh_CN', en: 'en_US' };

export const otherLocale = (locale: Locale): Locale => (locale === 'zh' ? 'en' : 'zh');

/** The edition a post language belongs to: en, en-US ... are English, anything else Chinese. */
export const localeOfLang = (lang: string): Locale => (/^en\b/i.test(lang) ? 'en' : 'zh');

/** /en and /en/... are English pages; every other path is Chinese. */
export const localeOfPath = (pathname: string): Locale => (/^\/en(?:\/|$)/.test(pathname) ? 'en' : 'zh');

/** A path without its locale prefix: /en/archive/ -> /archive/, /en/ -> /. */
export const unlocalizedPath = (pathname: string): string => pathname.replace(/^\/en(?=\/|$)/, '') || '/';

/** A site path in the given edition: localePath('en', '/archive/') -> /en/archive/. */
export const localePath = (locale: Locale, path: string): string => (locale === DEFAULT_LOCALE ? path : `/${locale}${path}`);
