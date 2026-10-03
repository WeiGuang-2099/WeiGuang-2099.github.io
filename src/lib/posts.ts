import { getCollection, render, type CollectionEntry } from 'astro:content';
import type { MarkdownHeading } from 'astro';
import type { ReadingData, ReadingSection } from '../plugins/remark-reading-time';
import { isDraftFile, SHOW_DRAFTS } from './post-files';

export type Post = CollectionEntry<'posts'>;

/** A post marked `draft: true`, or any file in src/content/drafts/. */
export const isDraft = (post: Post) => post.data.draft || isDraftFile(post.filePath);

/** Published posts, newest first (same day: by title). Drafts are visible in `astro dev` only. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', (post) => SHOW_DRAFTS || !isDraft(post));
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf() || a.data.title.localeCompare(b.data.title),
  );
}

export const postUrl = (post: Post) => `/posts/${post.id}/`;

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

export const tagUrl = (tag: string) => `/tags/${tagSlug(tag)}/`;

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
  let cached = readingCache.get(post.id);
  if (!cached) {
    cached = render(post).then(({ headings, remarkPluginFrontmatter }) => {
      const data = (remarkPluginFrontmatter as { reading?: ReadingData }).reading ?? { seconds: 0, sections: [] };
      return {
        seconds: data.seconds,
        minutes: Math.max(1, Math.round(data.seconds / 60)),
        sections: matchSections(data.sections, headings),
      };
    });
    readingCache.set(post.id, cached);
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
