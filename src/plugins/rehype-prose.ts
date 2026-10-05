/**
 * Small build-time touches on the rendered post HTML (hast):
 *
 * rehypeBlockquoteAttribution
 *   Adds class="attribution" to a blockquote's LAST paragraph when its text starts with an em dash
 *   (— or ——) or "--". Nothing else is inferred, so multi-paragraph quotes stay intact.
 *
 * rehypeTableWrap
 *   Wraps every <table> in <div class="table-wrap"> so wide tables scroll inside the column
 *   instead of widening the page.
 *
 * rehypeLatinApostrophe
 *   In Chinese text the quote marks come from the full-width "SC Punct" face (BaseLayout.astro), which
 *   also covers U+2019, so the apostrophe in O’Neil or writer’s would be set full width. An apostrophe
 *   between two Latin letters is wrapped in <span lang="en">, an English island that resets the face.
 *   English posts are left alone.
 *
 * rehypeChromeLanguage
 *   The code block chrome (shiki-trace.ts) and the footnote labels (the remarkRehype options in
 *   astro.config.mjs) are written in English. In a Chinese post they are set in Chinese, like the rest of
 *   the Chinese edition: 复制 on the copy buttons, 脚注 for the footnotes heading (read by screen
 *   readers), 返回引用 N on the links back from a footnote.
 */
import type { Root, Element, ElementContent, Text } from 'hast';
import { toString } from 'hast-util-to-string';
import { visit, SKIP } from 'unist-util-visit';
import type { VFile } from 'vfile';

const isElement = (node: ElementContent, tag?: string): node is Element =>
  node.type === 'element' && (tag === undefined || node.tagName === tag);

const hasClass = (node: Element, name: string) =>
  Array.isArray(node.properties.className) && node.properties.className.includes(name);

/** A translation (index.en.md), or an original whose frontmatter says `lang: en`. */
function isEnglish(file: VFile): boolean {
  if (file.path && /.en.mdx?$/i.test(file.path)) return true;
  const lang = (file.data as { astro?: { frontmatter?: { lang?: unknown } } }).astro?.frontmatter?.lang;
  return typeof lang === 'string' && /^en/i.test(lang);
}

export function rehypeBlockquoteAttribution() {
  return function (tree: Root) {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'blockquote') return;
      const paragraphs = node.children.filter((child) => isElement(child, 'p')) as Element[];
      if (paragraphs.length < 2) return;
      const last = paragraphs[paragraphs.length - 1];
      if (!/^\s*(?:—|--)/.test(toString(last))) return;
      const existing = Array.isArray(last.properties.className) ? last.properties.className : [];
      last.properties.className = [...existing, 'attribution'];
    });
  };
}

const TABLE_PARTS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr']);

/** Whitespace between table rows is not allowed content there; the HTML re-parse would hoist it. */
function dropTableWhitespace(node: Element): void {
  if (!TABLE_PARTS.has(node.tagName)) return;
  node.children = node.children.filter((child) => !(child.type === 'text' && child.value.trim() === ''));
  for (const child of node.children) if (child.type === 'element') dropTableWhitespace(child);
}

export function rehypeTableWrap() {
  return function (tree: Root) {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'table' || !parent || index === undefined) return;
      dropTableWhitespace(node);
      if (parent.type === 'element' && (parent.properties.className as string[] | undefined)?.includes('table-wrap')) return;
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrap'] },
        children: [node],
      };
      return SKIP;
    });
  };
}

const APOSTROPHE = /(?<=[A-Za-z])’(?=[A-Za-z])/g;
/** Elements whose text is not prose: code keeps its own face, inlined figures their own type. */
const NOT_PROSE = new Set(['code', 'pre', 'svg', 'script', 'style']);

export function rehypeLatinApostrophe() {
  return function (tree: Root, file: VFile) {
    if (isEnglish(file)) return;
    visit(tree, (node, index, parent) => {
      if (node.type === 'element' && NOT_PROSE.has(node.tagName)) return SKIP;
      if (node.type !== 'text' || !parent || index === undefined || !APOSTROPHE.test(node.value)) return;
      APOSTROPHE.lastIndex = 0;
      const parts: ElementContent[] = [];
      for (const [i, piece] of node.value.split(APOSTROPHE).entries()) {
        if (i > 0) {
          parts.push({ type: 'element', tagName: 'span', properties: { lang: 'en' }, children: [{ type: 'text', value: '’' }] });
        }
        if (piece) parts.push({ type: 'text', value: piece } as Text);
      }
      (parent as Element).children.splice(index, 1, ...parts);
      return [SKIP, index + parts.length];
    });
  };
}

export function rehypeChromeLanguage() {
  return function (tree: Root, file: VFile) {
    if (isEnglish(file)) return;
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'div' && hasClass(node, 'code-head')) {
        const parts = node.children.filter((child): child is Element => isElement(child));
        const name = parts.find((part) => hasClass(part, 'code-file'));
        const lang = parts.find((part) => hasClass(part, 'code-lang'));
        const button = parts.find((part) => part.tagName === 'button' && 'dataCopy' in part.properties);
        if (!button) return;
        const what = name ? toString(name) : `${lang ? toString(lang) : ''} 代码`.trim();
        button.properties.dataWhat = what;
        button.properties.ariaLabel = `复制 ${what}`;
        button.children = [{ type: 'text', value: '复制' }];
      } else if (node.tagName === 'h2' && node.properties.id === 'footnote-label') {
        node.children = [{ type: 'text', value: '脚注' }];
      } else if (node.tagName === 'a' && 'dataFootnoteBackref' in node.properties) {
        node.properties.ariaLabel = String(node.properties.ariaLabel ?? '').replace(/^Back to reference /, '返回引用 ');
      }
    });
  };
}
