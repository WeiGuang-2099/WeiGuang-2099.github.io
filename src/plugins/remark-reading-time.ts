/**
 * remark-reading-time: one build-time measurement feeds every duration on the site.
 *
 * It walks a post's Markdown tree (mdast) in document order and keeps a running clock in seconds:
 *
 *   prose   CJK characters (Han, kana, Hangul) at 350 per minute
 *           + Latin words (runs of letters/digits) at 220 per minute
 *   code    fenced code blocks: whitespace-separated tokens at 110 per minute (half the prose rate,
 *           because code is read slowly)
 *   images  10 seconds each for looking at the picture; a caption (the Markdown image title) is read
 *           as prose; alt text and the image path are not counted
 *   ignored frontmatter, link URLs (and link text that is only a URL), link definitions, MDX
 *           imports/exports/expressions, and HTML tags (the text inside raw HTML is counted)
 *   footnotes a footnote's text is counted where it is first referenced, since that is where a
 *           reader jumps to it; footnotes that are never referenced are not rendered and not counted
 *
 * Output, added to the post's frontmatter as `reading` (read it from `remarkPluginFrontmatter`):
 *   seconds   total reading time in seconds (a float; pages round it to whole minutes, minimum 1)
 *   sections  one entry per h2-h4: `start` is the clock when the heading begins, `span` is the time of
 *             the heading, its own text and every deeper section, up to the next heading of the same
 *             or a higher level. Spans therefore nest exactly like the outline.
 */
import type { Root, RootContent, Nodes, FootnoteDefinition, Heading, Link } from 'mdast';
import { toString } from 'mdast-util-to-string';
import type { VFile } from 'vfile';

export const CJK_PER_MINUTE = 350;
export const WORDS_PER_MINUTE = 220;
export const CODE_TOKENS_PER_MINUTE = 110;
export const SECONDS_PER_IMAGE = 10;

export interface ReadingSection {
  depth: number;
  text: string;
  /** seconds from the start of the post */
  start: number;
  /** seconds, including all deeper sections */
  span: number;
}

export interface ReadingData {
  seconds: number;
  sections: ReadingSection[];
}

const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
const WORD_RE = /[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu;
const URL_RE = /^(?:[a-z][a-z0-9+.-]*:\/\/|www\.|mailto:)\S+$/i;

/** Seconds needed to read a run of prose. */
export function proseSeconds(text: string): number {
  const cjk = text.match(CJK_RE)?.length ?? 0;
  const words = text.replace(CJK_RE, ' ').match(WORD_RE)?.length ?? 0;
  return (cjk / CJK_PER_MINUTE + words / WORDS_PER_MINUTE) * 60;
}

/** Seconds needed to read a code block. */
export function codeSeconds(code: string): number {
  const tokens = code.split(/\s+/).filter(Boolean).length;
  return (tokens / CODE_TOKENS_PER_MINUTE) * 60;
}

function isUrlOnlyLink(node: Link): boolean {
  const text = toString(node).trim();
  return text === node.url || URL_RE.test(text);
}

export function measure(tree: Root): ReadingData {
  const footnotes = new Map<string, FootnoteDefinition>();
  for (const node of tree.children) {
    if (node.type === 'footnoteDefinition') footnotes.set(node.identifier, node);
  }
  const counted = new Set<string>();
  const marks: { depth: number; text: string; start: number }[] = [];
  let clock = 0;

  const walkAll = (nodes: readonly (RootContent | Nodes)[]) => {
    for (const child of nodes) walk(child);
  };

  function walk(node: Nodes | RootContent): void {
    switch (node.type) {
      case 'heading': {
        const heading = node as Heading;
        marks.push({ depth: heading.depth, text: toString(heading).trim(), start: clock });
        walkAll(heading.children);
        return;
      }
      case 'text':
      case 'inlineCode':
        clock += proseSeconds(node.value);
        return;
      case 'code':
        clock += codeSeconds(node.value);
        return;
      case 'html':
        clock += proseSeconds(node.value.replace(/<[^>]*>/g, ' '));
        return;
      case 'image':
      case 'imageReference':
        clock += SECONDS_PER_IMAGE;
        if (node.type === 'image' && node.title) clock += proseSeconds(node.title);
        return;
      case 'link':
        if (isUrlOnlyLink(node)) return;
        walkAll(node.children);
        return;
      case 'footnoteReference': {
        const def = footnotes.get(node.identifier);
        if (def && !counted.has(node.identifier)) {
          counted.add(node.identifier);
          walkAll(def.children);
        }
        return;
      }
      case 'footnoteDefinition':
      case 'definition':
      case 'yaml':
      case 'break':
      case 'thematicBreak':
        return;
      default: {
        // MDX: skip ESM and expressions, read the children of JSX elements.
        const type = (node as { type: string }).type;
        if (type === 'mdxjsEsm' || type === 'mdxFlowExpression' || type === 'mdxTextExpression') return;
        if ('children' in node && Array.isArray(node.children)) walkAll(node.children as Nodes[]);
      }
    }
  }

  walk(tree);
  const seconds = clock;

  const sections: ReadingSection[] = [];
  marks.forEach((mark, i) => {
    if (mark.depth < 2 || mark.depth > 4) return;
    const next = marks.slice(i + 1).find((m) => m.depth <= mark.depth);
    const end = next ? next.start : seconds;
    sections.push({ depth: mark.depth, text: mark.text, start: mark.start, span: end - mark.start });
  });
  return { seconds, sections };
}

export default function remarkReadingTime() {
  return function (tree: Root, file: VFile) {
    const data = file.data as { astro?: { frontmatter?: Record<string, unknown> } };
    data.astro ??= {};
    data.astro.frontmatter ??= {};
    data.astro.frontmatter.reading = measure(tree);
  };
}
