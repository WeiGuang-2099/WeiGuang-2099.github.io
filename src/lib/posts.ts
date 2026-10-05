import { getCollection, render, type CollectionEntry } from 'astro:content';
import type { MarkdownHeading } from 'astro';
import type { ReadingData, ReadingSection } from '../plugins/remark-reading-time';
import { isDraftFile, SHOW_DRAFTS, sourceKey } from './post-files';
import { localeOfLang, localePath, otherLocale, LANG, LOCALES, type Locale } from './i18n';
import { sourceHash } from './source-hash';

type Original = CollectionEntry<'posts'>;
type Translation = CollectionEntry<'translations'>;

/**
 * One language edition of a post: the original as written, or its English translation (index.en.md).
 * Both editions share the slug, the date, the tags and the draft state of the original.
 */
export interface Post {
  /** the slug, the same in both editions: /posts/<id>/ and /en/posts/<id>/ */
  id: string;
  /** the edition this is, which decides its URL */
  locale: Locale;
  /** the editions the post exists in: its original's, plus English once it is translated */
  locales: Locale[];
  /** the original's frontmatter, with this edition's title, description and lang */
  data: Original['data'];
  /** what render() takes */
  entry: Original | Translation;
  original: Original;
}

const isDraftEntry = (entry: Original) => entry.data.draft || isDraftFile(entry.filePath);

/** A post marked `draft: true`, or any file in src/content/drafts/. */
export const isDraft = (post: Post) => isDraftEntry(post.original);

const warned = new Set<string>();
const warnOnce = (message: string) => {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
};

/**
 * Every post as its editions, newest first (same day: by the original's title). Drafts are visible in
 * `astro dev` only. A translation whose original has changed since it was made is still published,
 * with a warning in the terminal.
 */
async function getEditions(): Promise<Partial<Record<Locale, Post>>[]> {
  const families = new Map<string, { original: Original; editions: Partial<Record<Locale, Post>> }>();
  for (const original of await getCollection('posts')) {
    const locale = localeOfLang(original.data.lang);
    const post: Post = { id: original.id, locale, locales: [locale], data: original.data, entry: original, original };
    families.set(sourceKey(original.filePath), { original, editions: { [locale]: post } });
  }

  for (const translation of await getCollection('translations')) {
    const family = families.get(sourceKey(translation.filePath));
    if (!family) {
      warnOnce(`[translations] ${translation.filePath} has no original next to it and is not published.`);
      continue;
    }
    const { original, editions } = family;
    if (editions.en) {
      throw new Error(`${translation.filePath}: ${original.filePath} is already in English (lang: ${original.data.lang}).`);
    }
    const current = sourceHash({ title: original.data.title, description: original.data.description, body: original.body ?? '' });
    if (translation.data.sourceHash !== current) {
      warnOnce(
        `[translations] ${translation.filePath} is out of date: ${original.filePath} has changed since it was translated. ` +
          `Run \`npm run translate -- ${original.id}\` to translate it again.`,
      );
    }
    const data = { ...original.data, title: translation.data.title, description: translation.data.description, lang: LANG.en };
    editions.en = { id: original.id, locale: 'en', locales: [], data, entry: translation, original };
  }

  const all = [...families.values()].filter(({ original }) => SHOW_DRAFTS || !isDraftEntry(original));
  all.sort(
    (a, b) =>
      b.original.data.pubDate.valueOf() - a.original.data.pubDate.valueOf() ||
      a.original.data.title.localeCompare(b.original.data.title),
  );
  return all.map(({ editions }) => {
    const locales = LOCALES.filter((locale) => editions[locale]);
    for (const locale of locales) editions[locale]!.locales = locales;
    return editions;
  });
}

/**
 * The posts listed in an edition, newest first: every post, in that edition's language when it exists
 * in it, otherwise in its original language (a Chinese post that is not translated yet). The latter
 * keep their own URL in the other edition.
 */
export async function getPosts(locale: Locale): Promise<Post[]> {
  return (await getEditions()).map((editions) => (editions[locale] ?? editions[otherLocale(locale)])!);
}

export const postUrl = (post: Post) => localePath(post.locale, `/posts/${post.id}/`);

/** The URL of the post in the given edition, or null when the post does not exist in that language. */
export const editionUrl = (post: Post, locale: Locale) =>
  post.locales.includes(locale) ? localePath(locale, `/posts/${post.id}/`) : null;

/* ---------------------------------------------------------------------------------------------
   Tags and topic lanes
   --------------------------------------------------------------------------------------------- */

/** URL segment for a tag: lowercased, whitespace to "-", CJK kept. */
export function tagSlug(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[\s/\\?#%]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const tagUrl = (tag: string, locale: Locale) => localePath(locale, `/tags/${tagSlug(tag)}/`);

/** The colored topic lanes. Everything else falls into the neutral `other` lane. */
export const TOPIC_LANES = ['rag', 'agents', 'llm-apps'] as const;
export type Lane = (typeof TOPIC_LANES)[number] | 'other';
export const LANE_ORDER: Lane[] = [...TOPIC_LANES, 'other'];

/** The first tag that names a topic lane, if any. Its tag gets the lane swatch. */
export function laneTag(tags: readonly string[]): string | undefined {
  return tags.find((tag) => (TOPIC_LANES as readonly string[]).includes(tagSlug(tag)));
}

export function laneOf(tags: readonly string[]): Lane {
  const tag = laneTag(tags);
  return tag ? (tagSlug(tag) as Lane) : 'other';
}

export const laneVar = (lane: Lane) => `var(--lane-${lane})`;

/* ---------------------------------------------------------------------------------------------
   Reading time and the contents waterfall
   --------------------------------------------------------------------------------------------- */

export interface TocSection extends ReadingSection {
  slug: string;
}

export interface PostReading {
  /** exact measurement in seconds */
  seconds: number;
  /** what the site shows: whole minutes, at least 1 */
  minutes: number;
  /** h2-h4 sections matched to their rendered heading ids */
  sections: TocSection[];
}

const normalize = (text: string) => text.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu, '').toLowerCase();

/**
 * Pairs the sections measured from Markdown with the headings Astro rendered (which carry the ids).
 * Matching walks both lists in order and compares depth and text, so a skipped or extra heading
 * cannot shift every later link. The GFM footnotes heading is not a section.
 */
export function matchSections(sections: ReadingSection[], headings: MarkdownHeading[]): TocSection[] {
  const pool = headings.filter((h) => h.slug !== 'footnote-label' && h.depth >= 2 && h.depth <= 4);
  const matched: TocSection[] = [];
  let cursor = 0;
  for (const section of sections) {
    const key = normalize(section.text);
    let index = pool.findIndex((h, i) => i >= cursor && h.depth === section.depth && normalize(h.text) === key);
    if (index === -1 && pool[cursor]?.depth === section.depth) index = cursor;
    if (index === -1) continue;
    matched.push({ ...section, slug: pool[index].slug });
    cursor = index + 1;
  }
  return matched;
}

const readingCache = new Map<string, Promise<PostReading>>();

export function getReading(post: Post): Promise<PostReading> {
  // the two editions of a post share its id, but not their text
  const key = `${post.entry.collection}/${post.id}`;
  let cached = readingCache.get(key);
  if (!cached) {
    cached = render(post.entry).then(({ headings, remarkPluginFrontmatter }) => {
      const data = (remarkPluginFrontmatter as { reading?: ReadingData }).reading ?? { seconds: 0, sections: [] };
      return {
        seconds: data.seconds,
        minutes: Math.max(1, Math.round(data.seconds / 60)),
        sections: matchSections(data.sections, headings),
      };
    });
    readingCache.set(key, cached);
  }
  return cached;
}

export interface PostSummary {
  post: Post;
  url: string;
  lane: Lane;
  laneTag?: string;
  minutes: number;
  /** only ever true in `astro dev` */
  draft: boolean;
}

export async function summarize(posts: Post[]): Promise<PostSummary[]> {
  return Promise.all(
    posts.map(async (post) => ({
      post,
      url: postUrl(post),
      lane: laneOf(post.data.tags),
      laneTag: laneTag(post.data.tags),
      minutes: (await getReading(post)).minutes,
      draft: isDraft(post),
    })),
  );
}

/* ---------------------------------------------------------------------------------------------
   Axes
   --------------------------------------------------------------------------------------------- */

export interface Axis {
  max: number;
  ticks: number[];
}

const NICE_STEPS = [1, 2, 5, 10, 15, 20, 25, 30, 50, 60, 100];

/**
 * The shared axis of the post lists: max(20, longest post rounded up to 5 min), split into
 * 3 to 8 equal intervals of a round size (0 / 5 / 10 / 15 / 20 for the default scale). When no
 * round size fits (55, 65, 85 ...), 5 intervals: max is a multiple of 5, so the ticks stay whole.
 */
export function listAxis(minutes: number[]): Axis {
  const longest = Math.max(0, ...minutes);
  const max = Math.max(20, Math.ceil(longest / 5) * 5);
  const k = [4, 5, 3, 6, 7, 8].find((n) => NICE_STEPS.includes(max / n)) ?? 5;
  return { max, ticks: Array.from({ length: k + 1 }, (_, i) => (max / k) * i) };
}

/**
 * The contents axis runs from 0 to the post's displayed reading time, so the root bar is the whole
 * post. It is split into 3, 4, 2 or 5 equal intervals (first choice that gives whole minutes, then
 * half minutes): 0 / 2 / 4 / 6 min, 0 / 1 / 2 / 3 / 4 / 5 min, 0 / 3.5 / 7 min.
 */
export function contentsAxis(total: number): Axis {
  for (const unit of [1, 0.5]) {
    for (const k of [3, 4, 2, 5]) {
      const step = total / k;
      if (Number.isInteger(step / unit)) {
        return { max: total, ticks: Array.from({ length: k + 1 }, (_, i) => step * i) };
      }
    }
  }
  return { max: total, ticks: [0, total] };
}
