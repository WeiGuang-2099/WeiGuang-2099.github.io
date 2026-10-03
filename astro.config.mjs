// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';

import remarkReadingTime from './src/plugins/remark-reading-time.ts';
import remarkFigure from './src/plugins/remark-figure.ts';
import { rehypeBlockquoteAttribution, rehypeTableWrap } from './src/plugins/rehype-prose.ts';
import { traceLight, traceDark, transformerCodeBlock } from './src/plugins/shiki-trace.ts';

// Fontsource lists a .woff fallback after every .woff2. Every browser the site supports takes the
// .woff2, so the fallback is dropped and the build no longer emits about 300 unused .woff files.
/** @type {import('postcss').Plugin} */
const woff2Only = {
  postcssPlugin: 'woff2-only',
  AtRule: {
    'font-face'(rule) {
      rule.walkDecls('src', (decl) => {
        decl.value = decl.value.replace(/,\s*url\([^)]*\.woff\)\s*format\(["']woff["']\)/g, '');
      });
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: 'https://weiguang-2099.github.io',
  integrations: [mdx(), sitemap()],
  vite: {
    css: { postcss: { plugins: [woff2Only] } },
    // Font slices stay files: a unicode-range slice must only load on a page that uses its characters,
    // never travel inside the stylesheet as a data: URI.
    build: { assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined) },
  },
  image: {
    // Images in posts get a srcset, so a phone downloads a version near its screen size
    // instead of the original photo (the reading column is at most about 720px wide).
    layout: 'constrained',
    breakpoints: [640, 750, 828, 1080, 1280, 1440],
  },
  markdown: {
    // remark/rehype pipeline (@astrojs/markdown-remark); .mdx files inherit it through the MDX integration.
    processor: unified({
      remarkPlugins: [remarkReadingTime, remarkFigure],
      rehypePlugins: [rehypeBlockquoteAttribution, rehypeTableWrap],
      remarkRehype: {
        // U+21A9 + VS15: the back-reference arrow in text presentation, never as an emoji
        footnoteBackContent: '↩︎',
        footnoteLabel: 'Footnotes',
      },
    }),
    shikiConfig: {
      themes: { light: traceLight, dark: traceDark },
      // Datalog has no grammar of its own; its syntax is a subset of Prolog's.
      langAlias: { datalog: 'prolog' },
      defaultColor: false,
      transformers: [transformerCodeBlock()],
    },
  },
});
