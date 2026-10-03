import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { withInlinedSvgs } from './lib/inlined-svgs';
import { postId, SHOW_DRAFTS } from './lib/post-files';

const base = './src/content';
// Published posts live in posts/. drafts/ is git-ignored and only `astro dev` loads it.
const pattern = SHOW_DRAFTS ? '{posts,drafts}/**/*.{md,mdx}' : 'posts/**/*.{md,mdx}';

const posts = defineCollection({
  // posts/<slug>.md(x) and posts/<slug>/index.md(x) both get the id <slug> (drafts/ works the same),
  // so either layout is published at /posts/<slug>/. SVG figures next to a post are inlined into it,
  // so editing one re-renders the posts as well.
  loader: withInlinedSvgs(glob({ pattern, base, generateId: postId }), base),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    // Drafts render in `astro dev` and are left out of production builds.
    draft: z.boolean().default(false),
    // Language of the post body; the site chrome stays English.
    lang: z.string().default('zh-CN'),
  }),
});

export const collections = { posts };
