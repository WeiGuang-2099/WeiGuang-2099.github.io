import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { withInlinedSvgs } from './lib/inlined-svgs';
import { postId, SHOW_DRAFTS } from './lib/post-files';

const base = './src/content';
// Published posts live in posts/. drafts/ is git-ignored and only `astro dev` loads it.
const folders = SHOW_DRAFTS ? '{posts,drafts}' : 'posts';
// An English translation sits next to its original: index.en.md beside index.md.
const translationFiles = `${folders}/**/*.en.{md,mdx}`;

const posts = defineCollection({
  // posts/<slug>.md(x) and posts/<slug>/index.md(x) both get the id <slug> (drafts/ works the same),
  // so either layout is published at /posts/<slug>/. SVG figures next to a post are inlined into it,
  // so editing one re-renders the posts as well.
  loader: withInlinedSvgs(glob({ pattern: [`${folders}/**/*.{md,mdx}`, `!${translationFiles}`], base, generateId: postId }), base),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    // Drafts render in `astro dev` and are left out of production builds.
    draft: z.boolean().default(false),
    // Language of the post body: zh-CN posts belong to the Chinese edition, en posts to the English one.
    lang: z.string().default('zh-CN'),
  }),
});

const translations = defineCollection({
  // The English edition of a post, written by `npm run translate` and published at /en/posts/<slug>/.
  // Only the translated fields are here; date, tags and draft state come from the original.
  loader: withInlinedSvgs(glob({ pattern: translationFiles, base, generateId: postId }), base),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // Fingerprint of the original it was translated from (src/lib/source-hash.ts).
    sourceHash: z.string(),
  }),
});

export const collections = { posts, translations };
