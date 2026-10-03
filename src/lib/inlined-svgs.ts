import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Loader, LoaderContext } from 'astro/loaders';

/** Files below `dir` whose path matches `pattern`, relative and sorted; none when `dir` is missing. */
function listFiles(dir: string, pattern: RegExp): string[] {
  try {
    return readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((file) => pattern.test(file))
      .sort();
  } catch {
    return [];
  }
}

/**
 * One hash over everything that shapes a post's HTML apart from its own Markdown (path and content of
 * each file): the SVG files under the content `dir`, the local Markdown plugins in src/plugins/,
 * astro.config.mjs and package-lock.json. Astro hashes the config with JSON.stringify, which drops the
 * plugin functions, so without this a plugin edit or a Shiki upgrade would leave the cached posts as
 * they were. A file that does not exist is skipped.
 */
function renderFingerprint(root: string, dir: string): string {
  const hash = createHash('sha1');
  const add = (base: string, files: string[]) => {
    for (const file of files) {
      const path = join(base, file);
      let content: Buffer;
      try {
        content = readFileSync(path);
      } catch {
        continue;
      }
      hash.update(relative(root, path).replace(/\\/g, '/'));
      hash.update(content);
    }
  };
  add(dir, listFiles(dir, /\.svg$/i));
  const plugins = join(root, 'src/plugins');
  add(plugins, listFiles(plugins, /\.[cm]?[jt]sx?$/i));
  add(root, ['astro.config.mjs', 'package-lock.json']);
  return hash.digest('hex');
}

const isInside = (dir: string, path: string) => {
  const rel = relative(dir, resolve(path));
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

/**
 * The content layer caches each post's rendered HTML (node_modules/.astro/data-store.json, which the
 * deploy action restores in CI) and re-renders a post only when its own Markdown changes. But a post
 * also inlines the SVG figures next to it (src/plugins/remark-figure.ts), and its HTML comes from the
 * local Markdown plugins and the Shiki version. This wrapper mixes renderFingerprint() into every
 * entry's digest, so editing a figure, a plugin, astro.config.mjs or the locked dependencies
 * re-renders the posts on the next build (a plugin is loaded once, so `astro dev` needs a restart to
 * use an edited one).
 *
 * In `astro dev` it re-syncs the posts when an SVG changes, and after a post file is moved or
 * deleted. Publishing a draft means moving drafts/x.md to posts/x.md, and the watcher reports the
 * new path before it reports the old one is gone: glob() first stores posts/x.md as id `x`, then
 * deletes id `x` for the vanished drafts/x.md, and the post would 404 until it is saved again. A
 * full sync puts it back.
 */
export function withInlinedSvgs(loader: Loader, base: string): Loader {
  return {
    ...loader,
    async load(context: LoaderContext) {
      const root = fileURLToPath(context.config.root);
      const dir = fileURLToPath(new URL(base.replace(/\/?$/, '/'), context.config.root));
      const run = (ctx: LoaderContext) => {
        const fingerprint = renderFingerprint(root, dir);
        return loader.load({
          ...ctx,
          generateDigest: (data) =>
            ctx.generateDigest(typeof data === 'string' ? `${data}\n<!-- render ${fingerprint} -->` : data),
        });
      };
      await run(context);

      const { watcher } = context;
      if (!watcher) return;
      const resync = async (path: string, what: string) => {
        const name = relative(dir, path).replace(/\\/g, '/');
        try {
          // Without a watcher the wrapped loader syncs once and does not register its listeners again.
          await run({ ...context, watcher: undefined });
          context.logger.info(`Re-synced posts after ${name} ${what}`);
        } catch (error) {
          // e.g. a half-written draft with invalid frontmatter: report it, keep the dev server running
          context.logger.error(`Could not re-sync posts after ${name} ${what}: ${(error as Error).message}`);
        }
      };
      const onSvg = (path: string) => {
        if (/\.svg$/i.test(path) && isInside(dir, path)) return resync(path, 'changed');
      };
      const onPostGone = (path: string) => {
        if (/\.mdx?$/i.test(path) && isInside(dir, path)) return resync(path, 'was moved or deleted');
      };
      watcher.on('change', onSvg);
      watcher.on('add', onSvg);
      watcher.on('unlink', onSvg);
      // registered after glob()'s own listeners, so it runs after glob() has dropped the old path
      watcher.on('unlink', onPostGone);
    },
  };
}
