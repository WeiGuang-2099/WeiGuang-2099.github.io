import { slug } from 'github-slugger';

/** Git-ignored folder for unpublished posts. Only `astro dev` loads it (see src/content.config.ts). */
const DRAFTS_DIR = 'src/content/drafts/';

/**
 * True only under `astro dev`, the one place drafts are shown. Vite's DEV flag alone follows NODE_ENV,
 * so a build started with NODE_ENV=development would load and render the drafts too; MODE stays
 * 'production' in every build, and `astro build --mode development` has DEV off.
 */
export const SHOW_DRAFTS = import.meta.env.DEV && import.meta.env.MODE === 'development';

/** Whether an entry's file (`filePath`, relative to the project root) sits in the drafts folder. */
export const isDraftFile = (filePath: string | undefined) => filePath?.replace(/\\/g, '/').startsWith(DRAFTS_DIR) ?? false;

/**
 * An English translation sits next to its original (index.en.md beside index.md, x.en.md beside x.md),
 * and both share this key: the file path without `.en` and the extension. Translations are matched to
 * their original by it (src/lib/posts.ts).
 */
export const sourceKey = (filePath: string | undefined) =>
  (filePath ?? '').replace(/\\/g, '/').replace(/(?:\.en)?\.mdx?$/i, '');

/**
 * The id glob() would give the file inside its own folder, so posts/<slug>.md, posts/<slug>/index.md
 * and the same paths under drafts/ all become <slug> and are served at /posts/<slug>/. A translation
 * (index.en.md) gets the same id as its original in its own collection.
 * Like glob(), a `slug` in the frontmatter wins and every path segment is slugified.
 */
export function postId({ entry, data }: { entry: string; data: Record<string, unknown> }): string {
  if (data.slug) return String(data.slug);
  return entry
    .replace(/^(?:posts|drafts)\//, '')
    .replace(/(?:\.en)?\.[^./]+$/, '')
    .split('/')
    .map((segment) => slug(segment))
    .join('/')
    .replace(/\/index$/, '');
}
