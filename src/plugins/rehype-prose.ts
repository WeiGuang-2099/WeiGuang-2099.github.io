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
 */
import type { Root, Element, ElementContent } from 'hast';
import { toString } from 'hast-util-to-string';
import { visit, SKIP } from 'unist-util-visit';

const isElement = (node: ElementContent, tag?: string): node is Element =>
  node.type === 'element' && (tag === undefined || node.tagName === tag);

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
