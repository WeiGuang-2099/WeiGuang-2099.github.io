/**
 * Shiki setup for the site's code blocks: two TextMate themes and a transformer for the code block chrome.
 *
 * Token roles (every text token is at least 4.5:1 on the code well, #ECEEEA light / #171D24 dark):
 *   plain        variables, parameters, functions, decorators, commands   (functions stay plain on purpose)
 *   keyword      marked by weight (IBM Plex Mono 600), not by hue
 *   literal      strings, regexes, numbers, language constants             rouge
 *   type         types and classes                                          muted violet
 *   comment      comments                                                   grey
 *   punctuation  punctuation and operators                                  darker grey
 * The hues are kept away from the topic lane pigments (malachite, ochre, azurite), so code never
 * "speaks" the topic language.
 *
 * Astro renders both themes at once (`defaultColor: false`), as --shiki-light / --shiki-dark custom
 * properties on every token; src/styles/global.css (the .astro-code span rules) picks one, so the manual
 * theme toggle switches code too. These palettes are the only source of the token colors.
 */
import { bundledLanguagesInfo, type ShikiTransformer, type ThemeRegistration } from 'shiki';
import type { Element, ElementContent, Root } from 'hast';

interface Palette {
  bg: string;
  plain: string;
  keyword: string;
  literal: string;
  type: string;
  comment: string;
  punct: string;
}

const LIGHT: Palette = {
  bg: '#ECEEEA',
  plain: '#1E252E',
  keyword: '#11161C',
  literal: '#A23547',
  type: '#5A4A86',
  comment: '#5F6874',
  punct: '#545E69',
};

const DARK: Palette = {
  bg: '#171D24',
  plain: '#D5DBE1',
  keyword: '#EEF2F5',
  literal: '#EE8C9B',
  type: '#B4A6E6',
  comment: '#808B97',
  punct: '#A2ABB5',
};

function theme(name: string, type: 'light' | 'dark', p: Palette): ThemeRegistration {
  return {
    name,
    type,
    colors: { 'editor.background': p.bg, 'editor.foreground': p.plain },
    settings: [
      { settings: { foreground: p.plain, background: p.bg } },
      // punctuation and operators
      {
        scope: [
          'punctuation',
          'meta.brace',
          'keyword.operator',
          'storage.type.function.arrow',
          'constant.other.option',
          'punctuation.definition.tag',
        ],
        settings: { foreground: p.punct, fontStyle: '' },
      },
      // keywords: weight, not hue
      {
        scope: [
          'keyword',
          'storage',
          'storage.type',
          'storage.modifier',
          'keyword.operator.new',
          'keyword.operator.expression',
          'keyword.operator.logical.python',
          'keyword.operator.word',
          'entity.name.tag',
        ],
        settings: { foreground: p.keyword, fontStyle: 'bold' },
      },
      // literals
      {
        scope: [
          'string',
          'string.regexp',
          'constant.numeric',
          'constant.language',
          'constant.character',
          'constant.other.date',
          'constant.other.timestamp',
          'punctuation.definition.string',
          'storage.type.string',
          'support.constant',
        ],
        settings: { foreground: p.literal, fontStyle: '' },
      },
      // types and classes
      {
        scope: [
          'entity.name.type',
          'entity.name.class',
          'entity.other.inherited-class',
          'support.type',
          'support.class',
          'storage.type.primitive',
        ],
        settings: { foreground: p.type, fontStyle: '' },
      },
      // comments (no italics)
      {
        scope: ['comment', 'punctuation.definition.comment'],
        settings: { foreground: p.comment, fontStyle: '' },
      },
      // stays plain: functions, variables, properties, YAML/JSON keys, attributes
      {
        scope: [
          'entity.name.function',
          'support.function',
          'variable',
          'variable.parameter',
          'meta.decorator',
          'entity.name.tag.yaml',
          'support.type.property-name',
          'entity.other.attribute-name',
          'entity.name.command',
          'string.unquoted.argument',
        ],
        settings: { foreground: p.plain, fontStyle: '' },
      },
      // template-string interpolation markers read as punctuation
      {
        scope: ['punctuation.definition.template-expression', 'punctuation.section.embedded'],
        settings: { foreground: p.punct, fontStyle: '' },
      },
    ],
  };
}

export const traceLight = theme('trace-light', 'light', LIGHT);
export const traceDark = theme('trace-dark', 'dark', DARK);

const LANGUAGE_NAMES: Record<string, string> = {
  astro: 'Astro',
  avdl: 'Avro IDL',
  bash: 'Shell',
  c: 'C',
  cpp: 'C++',
  css: 'CSS',
  datalog: 'Datalog',
  diff: 'Diff',
  dockerfile: 'Dockerfile',
  go: 'Go',
  html: 'HTML',
  java: 'Java',
  javascript: 'JavaScript',
  js: 'JavaScript',
  json: 'JSON',
  jsonc: 'JSON',
  jsx: 'JSX',
  markdown: 'Markdown',
  md: 'Markdown',
  mdx: 'MDX',
  plaintext: 'Text',
  powershell: 'PowerShell',
  proto: 'Protocol Buffers',
  protobuf: 'Protocol Buffers',
  ps1: 'PowerShell',
  py: 'Python',
  python: 'Python',
  rs: 'Rust',
  rust: 'Rust',
  sh: 'Shell',
  shell: 'Shell',
  shellscript: 'Shell',
  sql: 'SQL',
  text: 'Text',
  thrift: 'Thrift',
  toml: 'TOML',
  ts: 'TypeScript',
  tsx: 'TSX',
  txt: 'Text',
  typescript: 'TypeScript',
  yaml: 'YAML',
  yml: 'YAML',
  zsh: 'Shell',
};

/** The label in the code block header: the names above first, then Shiki's own name for the language. */
export function languageName(lang: string | undefined): string {
  if (!lang) return 'Text';
  const id = lang.toLowerCase();
  const known = LANGUAGE_NAMES[id];
  if (known) return known;
  const info = bundledLanguagesInfo.find((l) => l.id === id || l.aliases?.includes(id));
  return info?.name ?? lang;
}

/** Reads `title="..."` (or 'title=...') from a code fence's meta string. */
export function metaTitle(meta: string | undefined): string | undefined {
  if (!meta) return undefined;
  const match = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(meta);
  const title = match?.[1] ?? match?.[2] ?? match?.[3];
  return title?.trim() || undefined;
}

const text = (value: string): ElementContent => ({ type: 'text', value });
const el = (tagName: string, properties: Element['properties'], children: ElementContent[]): Element => ({
  type: 'element',
  tagName,
  properties,
  children,
});

/**
 * Wraps each highlighted block in the code chrome from the design:
 *   <div class="code-block">
 *     <div class="code-head">[<span class="code-file">name</span>] <span class="code-lang">Lang</span>
 *       <button type="button" class="copy" data-copy data-what="name" aria-label="Copy name">Copy</button></div>
 *     <pre class="astro-code has-lines" data-language lang="en" tabindex="0"><code>…lines…</code></pre>
 *   </div>
 * Blocks longer than one line get line numbers (drawn by CSS counters, never copied); from 100 lines
 * on, `lines-3` widens the number column to three digits.
 */
export function transformerCodeBlock(): ShikiTransformer {
  return {
    name: 'trace:code-block',
    pre(node) {
      // Colors and scrolling come from the stylesheet; drop Shiki's and Astro's inline styles.
      delete node.properties.style;
      node.properties.lang = 'en';
    },
    root(root: Root) {
      const pre = root.children.find((child): child is Element => child.type === 'element' && child.tagName === 'pre');
      if (!pre) return;
      const code = pre.children.find((child): child is Element => child.type === 'element' && child.tagName === 'code');
      const lineCount = code
        ? code.children.filter((child) => child.type === 'element' && child.tagName === 'span').length
        : 0;

      const lang = this.options.lang;
      const raw = (this.options.meta as { __raw?: string } | undefined)?.__raw;
      const title = metaTitle(raw);
      const langLabel = languageName(typeof lang === 'string' ? lang : undefined);
      // what the copy button names: the file, or the snippet by its language (set in Chinese in a
      // Chinese post, by rehypeChromeLanguage in rehype-prose.ts)
      const what = title ?? `${langLabel} snippet`;

      const classes = String(pre.properties.class ?? 'astro-code').split(/\s+/).filter(Boolean);
      if (lineCount > 1) classes.push('has-lines');
      if (lineCount >= 100) classes.push('lines-3');
      pre.properties.class = classes.join(' ');

      const head: ElementContent[] = [];
      if (title) head.push(el('span', { className: ['code-file'] }, [text(title)]));
      head.push(el('span', { className: ['code-lang'] }, [text(langLabel)]));
      head.push(
        el(
          'button',
          {
            type: 'button',
            className: ['copy'],
            dataCopy: '',
            dataWhat: what,
            ariaLabel: `Copy ${what}`,
          },
          [text('Copy')],
        ),
      );

      return {
        type: 'root',
        children: [el('div', { className: ['code-block'] }, [el('div', { className: ['code-head'] }, head), pre])],
      };
    },
  };
}
