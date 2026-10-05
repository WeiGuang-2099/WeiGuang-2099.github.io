/**
 * getStaticPaths for the dynamic routes, shared by the Chinese pages (src/pages/) and the English ones
 * (src/pages/en/). Each route file only names its edition.
 */
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, listAxis, postUrl, summarize } from './posts';
import { groupByTag } from './tags';
import { LANG, localePath, type Locale } from './i18n';
import { SITE } from './site';
import { UI } from './ui';

/**
 * One page per post that exists in the edition. Previous and next follow the edition's list, which
 * also holds the posts that are only in the other language.
 */
export async function postPaths(locale: Locale) {
  const posts = await getPosts(locale);
  const axisMax = listAxis((await summarize(posts)).map((s) => s.minutes)).max;
  return posts.flatMap((post, i) =>
    post.locale === locale
      ? [{ params: { slug: post.id }, props: { locale, post, newer: posts[i - 1], older: posts[i + 1], axisMax } }]
      : [],
  );
}

/** One page per tag, on the same scale as the home page and the archive, so a bar means the same everywhere. */
export async function tagPaths(locale: Locale) {
  const all = await summarize(await getPosts(locale));
  const axis = listAxis(all.map((s) => s.minutes));
  return groupByTag(all).map((group) => ({ params: { tag: group.slug }, props: { locale, group, axis } }));
}

/** The edition's feed: /rss.xml in Chinese, /en/rss.xml in English. */
export async function feed(context: APIContext, locale: Locale) {
  const site = context.site ?? SITE.url;
  const self = new URL(localePath(locale, '/rss.xml'), site).href;
  return rss({
    title: UI[locale].siteName,
    description: UI[locale].siteDescription,
    site,
    items: (await getPosts(locale)).map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: postUrl(post),
      categories: post.data.tags,
    })),
    // atom:link gives the feed's own address
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: `<language>${LANG[locale]}</language><atom:link href="${self}" rel="self" type="application/rss+xml"/>`,
    trailingSlash: true,
  });
}
