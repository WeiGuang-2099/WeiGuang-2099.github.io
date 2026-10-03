/**
 * remark-figure: standalone Markdown images become figures.
 *
 *   ![alt](./photo.png "Caption")   ->  <figure class="figure"><div class="figure-body"><img alt=…></div>
 *                                        <figcaption>Caption</figcaption></figure>
 *
 * - "Standalone" means the image is the only thing in its paragraph.
 * - The title becomes the figcaption and is removed from the <img>, so there is no duplicate tooltip.
 *   Without a title the image stays a plain image (no figure), unless it is an inlined SVG.
 * - Raster images keep their mdast `image` node, so Astro's image pipeline still optimizes them.
 * - Local SVG files (relative paths) drawn for this site are read and inlined as
 *   <svg role="img" aria-label="alt">, so they can use the site's CSS variables and fonts and follow
 *   the theme toggle. "Drawn for this site" means the file uses a CSS variable (`var(--`) and has no
 *   <style> element and no id: an inlined <style> would restyle the whole page, ids collide between
 *   figures, and exported charts hard-code colors for white paper. Any other SVG (Illustrator,
 *   draw.io, matplotlib exports) stays an <img> and goes through Astro's image pipeline.
 *
 * Built with `data.hName` / `data.hChildren`, which both the Markdown and the MDX pipelines honour.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Root, Paragraph, Image, RootContent, PhrasingContent } from 'mdast';
import type { Element, ElementContent, Nodes as HastNodes } from 'hast';
import { fromHtml } from 'hast-util-from-html';
import type { VFile } from 'vfile';

function standaloneImage(node: Paragraph): Image | undefined {
  const meaningful = node.children.filter(
    (child: PhrasingContent) => !(child.type === 'text' && child.value.trim() === ''),
  );
  return meaningful.length === 1 && meaningful[0].type === 'image' ? meaningful[0] : undefined;
}

function isLocalSvg(url: string): boolean {
  return /\.svg(?:[?#].*)?$/i.test(url) && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(url);
}

function stripPositions(node: HastNodes): void {
  delete (node as { position?: unknown }).position;
  if ('children' in node) for (const child of node.children) stripPositions(child as HastNodes);
}

/** An SVG that is safe to inline: themed with the site's variables, no global styles, no ids. */
const inlinable = (source: string) =>
  source.includes('var(--') && !/<style[\s>]/i.test(source) && !/\sid\s*=/i.test(source);

function loadSvg(path: string, alt: string): Element | undefined {
  const source = readFileSync(path, 'utf8');
  if (!inlinable(source)) return undefined;
  const tree = fromHtml(source, { fragment: true });
  const svg = tree.children.find(
    (child): child is Element => child.type === 'element' && child.tagName === 'svg',
  );
  if (!svg) return undefined;
  stripPositions(svg);
  const props = svg.properties;
  delete props.xmlns;
  delete props.xmlnsXLink;
  delete props.xLinkHref;
  if (alt) {
    props.role = 'img';
    props.ariaLabel = alt;
  } else {
    props.ariaHidden = 'true';
  }
  const existing = Array.isArray(props.className) ? props.className : [];
  props.className = [...existing.map(String), 'figure-svg'];
  // Comments (including the XML declaration that the HTML parser keeps as a comment) are dropped.
  svg.children = svg.children.filter((child) => child.type !== 'comment');
  return svg;
}

export default function remarkFigure() {
  return function (tree: Root, file: VFile) {
    const baseDir = file.path ? dirname(file.path) : undefined;

    tree.children = tree.children.map((node: RootContent): RootContent => {
      if (node.type !== 'paragraph') return node;
      const image = standaloneImage(node);
      if (!image) return node;

      const caption = image.title?.trim();
      let svg: Element | undefined;
      if (baseDir && isLocalSvg(image.url)) {
        const path = resolve(baseDir, decodeURI(image.url.replace(/[?#].*$/, '')));
        if (existsSync(path)) svg = loadSvg(path, image.alt ?? '');
        else file.message(`remark-figure: SVG "${image.url}" not found`, image);
      }
      if (!caption && !svg) return node;

      image.title = null;
      const body = {
        type: 'figureBody',
        data: {
          hName: 'div',
          hProperties: { className: svg ? ['figure-body', 'figure-body-svg'] : ['figure-body'] },
          ...(svg ? { hChildren: [svg as ElementContent] } : {}),
        },
        children: svg ? [] : [image],
      };
      const children: unknown[] = [body];
      if (caption) {
        children.push({
          type: 'figureCaption',
          data: { hName: 'figcaption' },
          children: [{ type: 'text', value: caption }],
        });
      }
      return {
        type: 'figure',
        data: { hName: 'figure', hProperties: { className: ['figure'] } },
        children,
      } as unknown as RootContent;
    });
  };
}
