/**
 * npm run translate: English versions of the Chinese posts, made with the DeepSeek API (README, "英文版").
 *
 *   npm run translate                  translate every published post that has no English version yet,
 *                                      bring the English figures up to date, and list the English
 *                                      versions that are out of date
 *   npm run translate -- ddia-03 ...   translate the named posts (again), drafts included
 *   npm run translate -- --dry-run     only list what would be translated, with a rough cost
 *   npm run translate -- --check       compare every English version with its original (after editing
 *                                      one by hand); no API calls
 *   npm run translate -- ddia-03 --from <file>
 *                                      use a translation from a file (a rejected reply fixed by hand)
 *                                      instead of the API; it is checked and written like any other
 *
 * Settings come from .env (git-ignored) or the environment:
 *   DEEPSEEK_API_KEY     required
 *   TRANSLATE_MODEL      default deepseek-v4-pro
 *   TRANSLATE_BASE_URL   default https://api.deepseek.com; any OpenAI-compatible chat completions API works
 *
 * posts/<slug>/index.md gets posts/<slug>/index.en.md beside it, and every local SVG figure of the post
 * that has Chinese labels gets an English copy, <name>.en.svg. An English version is never overwritten
 * unless its post is named on the command line, since it may have been edited by hand; an English figure
 * is written again whenever its Chinese figure changes. A translation that does not keep the structure of
 * the original (headings, code blocks, footnotes, links, table rows) is not written; it is saved in the
 * system temp folder for a look.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import OpenAI from 'openai';
import { sourceHash } from '../src/lib/source-hash.ts';

const ROOT = resolve(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'src/content');

try {
  process.loadEnvFile(join(ROOT, '.env'));
} catch {
  // no .env: the settings come from the environment
}

const MODEL = process.env.TRANSLATE_MODEL || 'deepseek-v4-pro';
const BASE_URL = process.env.TRANSLATE_BASE_URL || 'https://api.deepseek.com';

/**
 * CNY per million tokens in peak hours (api-docs.deepseek.com, 2026-10-05); half that off-peak, which is
 * all of the week except 9:00-12:00 and 14:00-18:00 Beijing time on weekdays. Only used for the cost
 * shown at the end; public holidays (also off-peak) are not known here, so it may come out high.
 */
const PRICES: Record<string, { hit: number; miss: number; out: number }> = {
  'deepseek-v4-pro': { hit: 0.3, miss: 9, out: 27 },
  'deepseek-flash': { hit: 0.04, miss: 2, out: 8 },
};

const HAN = /\p{Script=Han}/u;
const rel = (path: string) => relative(ROOT, path).replace(/\\/g, '/');
const hash = (text: string) => createHash('sha256').update(text.replace(/\r\n?/g, '\n')).digest('hex').slice(0, 16);

/* ---------------------------------------------------------------------------------------------
   Posts and figures on disk
   --------------------------------------------------------------------------------------------- */

interface Source {
  /** the folder or file name: posts/<slug>/index.md or posts/<slug>.md */
  slug: string;
  file: string;
  /** where the English version goes: index.en.md beside index.md */
  target: string;
  published: boolean;
  title: string;
  description: string;
  body: string;
  /** the original is already English (lang: en) */
  english: boolean;
  hash: string;
}

function readSources(): Source[] {
  const sources: Source[] = [];
  for (const folder of ['posts', 'drafts']) {
    const dir = join(CONTENT, folder);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir, { recursive: true, encoding: 'utf8' }).map((n) => n.replace(/\\/g, '/'))) {
      if (!/\.mdx?$/i.test(name) || /\.en\.mdx?$/i.test(name)) continue;
      const file = join(dir, name);
      const { frontmatter, content } = parseFrontmatter(readFileSync(file, 'utf8'));
      const data = frontmatter as Record<string, unknown>;
      const title = String(data.title ?? '');
      const description = String(data.description ?? '');
      sources.push({
        slug: name.replace(/\.mdx?$/i, '').replace(/\/index$/, ''),
        file,
        target: file.replace(/\.(mdx?)$/i, '.en.$1'),
        published: folder === 'posts' && data.draft !== true,
        title,
        description,
        body: content.trim(),
        english: /^en\b/i.test(String(data.lang ?? 'zh-CN')),
        hash: sourceHash({ title, description, body: content }),
      });
    }
  }
  return sources.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** The sourceHash an English version was made from, or null when there is none yet. */
function translatedFrom(source: Source): string | null {
  if (!existsSync(source.target)) return null;
  const { frontmatter } = parseFrontmatter(readFileSync(source.target, 'utf8'));
  return String((frontmatter as Record<string, unknown>).sourceHash ?? '');
}

/** Local SVG images in a Markdown body: ![alt](./name.svg "caption"). */
const FIGURE = /!\[([^\]]*)\]\(\s*<?((?![a-z][a-z0-9+.-]*:|\/)[^)\s>]+\.svg)>?(?:\s+"([^"]*)")?\s*\)/gi;
/** The text elements of an SVG; the labels are the ones with Chinese in them. */
const TEXT = /(<text\b[^>]*>)([\s\S]*?)(<\/text>)/g;

interface Figure {
  /** the Chinese figure, as the post links it */
  url: string;
  file: string;
  target: string;
  hash: string;
  labels: string[];
}

/** The figures of a post that have Chinese labels and so need an English copy. */
function figuresOf(source: Source): Figure[] {
  const figures = new Map<string, Figure>();
  for (const match of source.body.matchAll(FIGURE)) {
    const url = match[2].replace(/\.en\.svg$/i, '.svg');
    const file = resolve(dirname(source.file), decodeURI(url));
    if (figures.has(file) || !existsSync(file)) continue;
    const svg = readFileSync(file, 'utf8');
    const labels = [...svg.matchAll(TEXT)].map((m) => m[2]).filter((label) => HAN.test(label));
    if (labels.length) figures.set(file, { url, file, target: file.replace(/\.svg$/i, '.en.svg'), hash: hash(svg), labels });
  }
  return [...figures.values()];
}

/** The source hash written into an English figure, or null when there is none yet. */
function figureFrom(figure: Figure): string | null {
  if (!existsSync(figure.target)) return null;
  return /source ([0-9a-f]{16})/.exec(readFileSync(figure.target, 'utf8'))?.[1] ?? '';
}

/** Points the images of an English body at the English figures that exist, and back where none does. */
function linkFigures(body: string, dir: string): string {
  return body.replace(FIGURE, (all, _alt: string, url: string) => {
    const original = url.replace(/\.en\.svg$/i, '.svg');
    const english = original.replace(/\.svg$/i, '.en.svg');
    const wanted = existsSync(resolve(dir, decodeURI(english))) ? english : original;
    return wanted === url ? all : all.replace(url, wanted);
  });
}

/**
 * Points links to other posts at their English version where one exists (/posts/x/ -> /en/posts/x/),
 * and back at the Chinese post where none does.
 */
function linkPosts(body: string, translated: Set<string>): string {
  return body.replace(/\]\(\s*<?(\/(?:en\/)?)posts\/([^/)\s#?>]+)/g, (all, prefix: string, slug: string) => {
    const wanted = translated.has(slug) ? '/en/' : '/';
    return prefix === wanted ? all : all.replace(`${prefix}posts/`, `${wanted}posts/`);
  });
}

/** The posts that have an English version on disk. */
const translatedSlugs = (sources: Source[]) => new Set(sources.filter((s) => existsSync(s.target)).map((s) => s.slug));

/* ---------------------------------------------------------------------------------------------
   Checking a translation against its original
   --------------------------------------------------------------------------------------------- */

interface Shape {
  headings: string[];
  code: { lang: string; lines: string[] }[];
  footnotes: string[];
  references: string[];
  urls: string[];
  tableRows: number;
  /** paragraphs outside blockquotes, where a quoted poem may gain its English rendering */
  paragraphs: number;
  listItems: number;
}

/**
 * What a translation has to keep: the outline, the code, the footnotes, the link targets, the tables,
 * and as many paragraphs and list items, so that nothing is left out.
 */
function shape(markdown: string): Shape {
  const headings: string[] = [];
  const code: Shape['code'] = [];
  const prose: string[] = [];
  let tableRows = 0;
  let paragraphs = 0;
  let listItems = 0;
  let inParagraph = false;
  let fence: { marker: string; lang: string; lines: string[] } | null = null;
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    if (fence) {
      const close = /^\s*(`{3,}|~{3,})\s*$/.exec(line);
      if (close && close[1][0] === fence.marker[0] && close[1].length >= fence.marker.length) {
        code.push({ lang: fence.lang, lines: fence.lines });
        fence = null;
      } else {
        fence.lines.push(line.trimEnd());
      }
      continue;
    }
    const open = /^\s*(`{3,}|~{3,})\s*([^\s`]*)/.exec(line);
    if (open) {
      fence = { marker: open[1], lang: open[2], lines: [] };
      inParagraph = false;
      continue;
    }
    prose.push(line);
    const heading = /^(#{1,6})\s/.exec(line);
    if (heading) headings.push(heading[1]);
    if (/^\s*\|/.test(line)) tableRows++;
    const listItem = /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
    if (listItem) listItems++;
    // a paragraph starts at a line of plain text after a blank line, a heading, a list or a fence
    const plain = line.trim() !== '' && !heading && !listItem && !/^\s*(?:>|\||\[\^[^\]]+\]:)/.test(line);
    if (plain && !inParagraph && !/^\s{2,}/.test(line)) paragraphs++;
    inParagraph = plain || (inParagraph && line.trim() !== '' && !heading && !listItem);
  }
  // inline code may hold brackets: blank it out before looking for links and footnotes
  const text = prose.join('\n').replace(/`[^`\n]*`/g, '``');
  const sorted = (regex: RegExp, within = text) => [...within.matchAll(regex)].map((m) => m[1]).sort();
  // a footnote is defined at the start of a line; "[^id]:" inside a sentence is a reference before a colon
  const definition = /^\[\^([^\]]+)\]:/gm;
  return {
    headings,
    code,
    footnotes: sorted(definition),
    references: sorted(/\[\^([^\]]+)\]/g, text.replace(definition, '')),
    // the English figures and posts a translation links to count as the Chinese ones
    urls: sorted(/\]\(\s*<?([^)\s>]+)/g).map((url) => url.replace(/\.en\.svg$/i, '.svg').replace(/^\/en\/posts\//, '/posts/')),
    tableRows,
    paragraphs,
    listItems,
  };
}

function compare(original: string, translation: string): string[] {
  const a = shape(original);
  const b = shape(translation);
  const problems: string[] = [];
  const list = (items: string[]) => items.join(' ') || '(none)';
  if (list(a.headings) !== list(b.headings)) problems.push(`headings: ${list(a.headings)} became ${list(b.headings)}`);
  if (a.code.length !== b.code.length) {
    problems.push(`code blocks: ${a.code.length} became ${b.code.length}`);
  } else {
    a.code.forEach((block, i) => {
      const other = b.code[i];
      if (block.lang !== other.lang) problems.push(`code block ${i + 1}: language ${block.lang} became ${other.lang}`);
      else if (block.lines.length !== other.lines.length) problems.push(`code block ${i + 1}: ${block.lines.length} lines became ${other.lines.length}`);
      else {
        // only lines with Chinese in them (comments, strings) may change
        const changed = block.lines.findIndex((line, j) => !HAN.test(line) && line !== other.lines[j]);
        if (changed >= 0) problems.push(`code block ${i + 1}, line ${changed + 1} changed: ${block.lines[changed].trim()}`);
      }
    });
  }
  if (list(a.footnotes) !== list(b.footnotes)) problems.push(`footnotes: ${list(a.footnotes)} became ${list(b.footnotes)}`);
  if (list(a.references) !== list(b.references)) problems.push(`footnote references: ${list(a.references)} became ${list(b.references)}`);
  if (list(a.urls) !== list(b.urls)) {
    const missing = a.urls.filter((url) => !b.urls.includes(url));
    const added = b.urls.filter((url) => !a.urls.includes(url));
    problems.push(`links: missing ${list(missing)}; added ${list(added)}`);
  }
  if (a.tableRows !== b.tableRows) problems.push(`table rows: ${a.tableRows} became ${b.tableRows}`);
  if (a.paragraphs !== b.paragraphs) problems.push(`paragraphs: ${a.paragraphs} became ${b.paragraphs}`);
  if (a.listItems !== b.listItems) problems.push(`list items: ${a.listItems} became ${b.listItems}`);
  return problems;
}

/** Lines of prose that still contain Chinese (a quoted poem may stay; anything else is worth a look). */
function chineseLeft(markdown: string): string[] {
  let inCode = false;
  return markdown.split('\n').filter((line) => {
    if (/^\s*(`{3,}|~{3,})/.test(line)) inCode = !inCode;
    return !inCode && HAN.test(line);
  });
}

/* ---------------------------------------------------------------------------------------------
   The API
   --------------------------------------------------------------------------------------------- */

const GLOSSARY = readFileSync(join(ROOT, 'scripts/glossary.md'), 'utf8');

const POST_PROMPT = `You translate posts of a Chinese technical blog into English. The author is an AI engineer, and the posts are the author's own notes, for example reading notes on the book Designing Data-Intensive Applications (DDIA). The English version should read as the same author writing in English: plain, precise, natural technical prose, in the first person where the original uses it.

Translate the whole post faithfully. Do not summarize, shorten, expand, explain or comment, and do not add or drop sentences, examples or caveats.

The input is a Markdown file: a frontmatter block with title and description, then the body. Reply with the translated file in the same form, frontmatter block first, and nothing else: no code fence around the reply and no notes before or after it. Write the two frontmatter values as double-quoted strings of plain text, without Markdown (no asterisks for a book title there).

Keep the Markdown structure exactly as it is:
- The same headings, at the same levels and in the same order. Never number a heading. Write headings in sentence case: capitalize the first word and names only.
- The same paragraphs, lists, tables (same rows and columns, alignment row unchanged), blockquotes, horizontal rules, HTML tags and hard line breaks (a backslash at the end of a line).
- Footnote references [^id] and footnote definitions [^id]: with the same ids, in the same places.
- Link and image targets, the part in parentheses, unchanged. Translate link text, image alt text and image titles (the quoted caption after the image path).
- Code blocks: copy the code exactly, character for character. Translate only Chinese comments and Chinese text inside strings. Keep the fence line as it is, except that a Chinese title="..." on it is translated.
- Inline code unchanged.
- Bold and italic on the words that correspond to the original.

Wording:
- When the Chinese gives the English term in parentheses, as in 预写日志（write-ahead log）, write that English term once and drop the parentheses.
- Quotations that are already in English, for example from a book, stay exactly as they are.
- A Chinese book title in 《》 becomes the English title in italics, e.g. 《数据密集型应用系统设计》 becomes *Designing Data-Intensive Applications*. Do not repeat a title the sentence already gives in English.
- Classical Chinese (poetry, lines from ancient texts) stays in Chinese, and the reader gets its meaning in English as well. A poem quoted in a blockquote keeps its Chinese lines and gets an English rendering of the whole poem as one more paragraph of the same blockquote, after the Chinese lines and before the attribution line (keep the backslash line breaks). A short quotation, or a word taken from such a text, in running prose is followed by its English meaning in parentheses, as in 日就 (a day's gain).
- "图 1：" in a caption becomes "Figure 1: ".
- English punctuation, straight quotes (" and '), an em dash (—) for dashes, American spelling.
- Follow the glossary below for names and recurring terms.

${GLOSSARY}`;

const FIGURE_PROMPT = `You translate the Chinese labels of an SVG figure in a technical blog post into English. The labels are short, a word or a phrase, and the English has to fit where the Chinese was: keep it as short as the meaning allows. They are labels, not sentences: no final period. Match the English words the figure already has, which are lowercase except for names and acronyms (SSTable, JSON).

The input is JSON: the post title, the figure's caption, and "labels", the inner markup of each <text> element that has Chinese in it. Some labels contain <tspan> elements. Reply with JSON of the form {"labels": [...]}, one translated string per input label, in the same order. Keep every tag exactly as it is (the same <tspan> elements with the same attributes, in the same order) and translate only the Chinese text around and inside them. Leave numbers, code, units and English words as they are.

When a label pairs a Chinese term with its English name in a <tspan>, as in 响应时间<tspan dx="8" style="...">response time</tspan> or 排队<tspan dx="8" style="...">queueing delay</tspan>, the English is already there: use that English name as the whole label and leave the <tspan> empty, so the term is not written twice (response time<tspan dx="8" style="..."></tspan>, queueing delay<tspan dx="8" style="..."></tspan>). Do this even where your own translation of the Chinese would be a different word. A <tspan> that adds something else (a number, a note in Chinese) is kept and translated.

Use the glossary below for names and recurring terms.

${GLOSSARY}`;

interface Usage {
  hit: number;
  miss: number;
  out: number;
}
const spent: Usage = { hit: 0, miss: 0, out: 0 };

let client: OpenAI | undefined;
function api(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('DEEPSEEK_API_KEY is not set. Put it in .env (see README, "英文版").');
    process.exit(1);
  }
  // A whole post comes back in one streamed reply, which can take several minutes.
  client ??= new OpenAI({ apiKey, baseURL: BASE_URL, timeout: 30 * 60 * 1000, maxRetries: 3 });
  return client;
}

/** One chat completion, streamed; a broken stream is tried again from the start. */
async function complete(label: string, system: string, user: string, options: { json?: boolean; maxTokens: number }): Promise<string> {
  const request = {
    model: MODEL,
    messages: [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: user },
    ],
    stream: true as const,
    stream_options: { include_usage: true },
    max_tokens: options.maxTokens,
    // Low on purpose. At 1.3, DeepSeek's documented setting for translation, deepseek-v4-pro drifted
    // halfway through Hello World into notes to itself (2026-10-05).
    temperature: 0.3,
    ...(options.json ? { response_format: { type: 'json_object' as const } } : {}),
    // DeepSeek models think by default; a translation does not need it, and thinking is billed as output
    thinking: { type: 'disabled' },
  };
  for (let attempt = 1; ; attempt++) {
    try {
      const stream = await api().chat.completions.create(request);
      let text = '';
      let finish: string | null = null;
      let heartbeat = Date.now();
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.delta?.content) text += choice.delta.content;
        if (choice?.finish_reason) finish = choice.finish_reason;
        if (chunk.usage) {
          const usage = chunk.usage as typeof chunk.usage & { prompt_cache_hit_tokens?: number };
          const hit = usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? 0;
          spent.hit += hit;
          spent.miss += usage.prompt_tokens - hit;
          spent.out += usage.completion_tokens;
        }
        if (Date.now() - heartbeat > 30_000) {
          heartbeat = Date.now();
          console.log(`  ${label}: ${text.length} characters so far`);
        }
      }
      if (finish === 'length') throw new Error(`the reply was cut off at ${options.maxTokens} tokens`);
      return text;
    } catch (error) {
      const status = error instanceof OpenAI.APIError ? error.status : undefined;
      // a wrong key or a bad request will not get better by trying again
      if (attempt >= 3 || (status !== undefined && status >= 400 && status < 500 && status !== 429)) throw error;
      console.log(`  ${label}: ${(error as Error).message}; trying again`);
      await new Promise((done) => setTimeout(done, attempt * 10_000));
    }
  }
}

function cost(usage: Usage): string {
  const price = PRICES[MODEL];
  if (!price) return `${usage.miss + usage.hit} tokens in, ${usage.out} out`;
  const beijing = new Date(Date.now() + 8 * 3600_000);
  const hour = beijing.getUTCHours();
  const peak = beijing.getUTCDay() % 6 !== 0 && ((hour >= 9 && hour < 12) || (hour >= 14 && hour < 18));
  const yuan = ((usage.hit * price.hit + usage.miss * price.miss + usage.out * price.out) / 1e6) * (peak ? 1 : 0.5);
  return `${usage.miss + usage.hit} tokens in, ${usage.out} out, about ¥${yuan.toFixed(2)} (${peak ? 'peak' : 'off-peak'} price)`;
}

/* ---------------------------------------------------------------------------------------------
   Translating
   --------------------------------------------------------------------------------------------- */

function reject(source: Source, text: string, problems: string[]) {
  const dir = join(tmpdir(), 'dawning-translate');
  mkdirSync(dir, { recursive: true });
  const saved = join(dir, `${source.slug.replace(/\//g, '-')}.en.md`);
  writeFileSync(saved, text);
  console.log(`  ${source.slug}: not written, the translation does not keep the structure of the original:`);
  for (const problem of problems) console.log(`    - ${problem}`);
  console.log(`    The reply is saved in ${saved}`);
  console.log(`    Fix it there and use it with: npm run translate -- ${source.slug} --from "${saved}"`);
}

/** Translates a post, or with `reply` takes the translation from that file instead of the API. */
async function translatePost(source: Source, reply?: string): Promise<boolean> {
  console.log(`${source.slug}: ${reply ? `checking the translation in ${reply}` : `translating ${rel(source.file)}`}`);
  const input = `---\ntitle: ${JSON.stringify(source.title)}\ndescription: ${JSON.stringify(source.description)}\n---\n\n${source.body}\n`;
  let text = reply ? readFileSync(reply, 'utf8') : await complete(source.slug, POST_PROMPT, input, { maxTokens: 65536 });
  // a reply wrapped in a code fence after all
  text = text.trim().replace(/^```(?:markdown|md)?\n([\s\S]*)\n```$/, '$1');

  let title = '';
  let description = '';
  let body = '';
  try {
    const { frontmatter, content } = parseFrontmatter(text);
    const data = frontmatter as Record<string, unknown>;
    // the title and description are shown as plain text (lists, meta tags): no emphasis or code marks
    const plain = (value: unknown) =>
      typeof value === 'string' ? value.replace(/(\*{1,2}|`)([^*`]+)\1/g, '$2').trim() : '';
    title = plain(data.title);
    description = plain(data.description);
    body = content.trim();
  } catch (error) {
    reject(source, text, [`the frontmatter does not parse: ${(error as Error).message}`]);
    return false;
  }
  const problems = compare(source.body, body);
  if (!title || !description) problems.unshift('the frontmatter has no title or description');
  if (problems.length) {
    reject(source, text, problems);
    return false;
  }

  const frontmatter = ['---', `title: ${JSON.stringify(title)}`, `description: ${JSON.stringify(description)}`, `sourceHash: ${JSON.stringify(source.hash)}`, '---'];
  const linked = linkPosts(linkFigures(body, dirname(source.target)), translatedSlugs(sources).add(source.slug));
  writeFileSync(source.target, `${frontmatter.join('\n')}\n\n${linked}\n`);
  console.log(`  wrote ${rel(source.target)}`);
  const left = chineseLeft(body);
  if (left.length) {
    console.log(`  ${left.length} line(s) still have Chinese in them; check that they should:`);
    for (const line of left.slice(0, 8)) console.log(`    ${line.length > 100 ? `${line.slice(0, 100)}...` : line}`);
  }
  return true;
}

/** The tags of a label, which a translation has to keep as they are. */
const tagsOf = (label: string) => (label.match(/<[^>]+>/g) ?? []).join('');

async function translateFigure(source: Source, figure: Figure): Promise<boolean> {
  console.log(`${source.slug}: translating ${figure.labels.length} label(s) in ${rel(figure.file)}`);
  // the English title and caption give the labels their context
  const { frontmatter, content } = parseFrontmatter(readFileSync(source.target, 'utf8'));
  const image = [...content.matchAll(FIGURE)].find((m) => m[2].replace(/\.en\.svg$/i, '.svg') === figure.url);
  const title = String((frontmatter as Record<string, unknown>).title ?? '');
  const request = { post: title, caption: image?.[3] || image?.[1] || '', labels: figure.labels };
  const text = await complete(basename(figure.file), FIGURE_PROMPT, JSON.stringify(request, null, 2), { json: true, maxTokens: 8192 });

  let labels: unknown;
  try {
    labels = (JSON.parse(text) as { labels?: unknown }).labels;
  } catch {
    labels = undefined;
  }
  const valid =
    Array.isArray(labels) &&
    labels.length === figure.labels.length &&
    labels.every((label, i) => typeof label === 'string' && tagsOf(label) === tagsOf(figure.labels[i]));
  if (!valid) {
    console.log(`  ${basename(figure.file)}: not written, the reply does not match the labels:\n    ${text.slice(0, 600)}`);
    return false;
  }

  const translated = (labels as string[]).map((label) => label.replace(/&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;'));
  let i = 0;
  const svg = readFileSync(figure.file, 'utf8').replace(TEXT, (all, open: string, inner: string, close: string) =>
    HAN.test(inner) ? `${open}${translated[i++]}${close}` : all,
  );
  const note =
    `<!-- English version of ${basename(figure.file)}, written by npm run translate from source ${figure.hash}. ` +
    `Adjust the layout here if a label does not fit; the file is only written again when ${basename(figure.file)} changes. -->\n`;
  writeFileSync(figure.target, note + svg);
  console.log(`  wrote ${rel(figure.target)}; check that every label fits`);
  return true;
}

/* ---------------------------------------------------------------------------------------------
   Main
   --------------------------------------------------------------------------------------------- */

const args = process.argv.slice(2);
// --from <file>: a saved reply (see reject()) or a hand-made translation, used instead of the API
const fromAt = args.indexOf('--from');
const reply = fromAt >= 0 ? args.splice(fromAt, 2)[1] : undefined;
const dryRun = args.includes('--dry-run');
const check = args.includes('--check');
const unknown = args.filter((arg) => arg.startsWith('-') && arg !== '--dry-run' && arg !== '--check');
if (unknown.length) {
  console.error(`Unknown option ${unknown.join(' ')}. Usage: npm run translate [-- [--dry-run | --check] [slug ...]]`);
  process.exit(1);
}
const named = args.filter((arg) => !arg.startsWith('-'));
if (reply !== undefined && (named.length !== 1 || !existsSync(reply))) {
  console.error('Usage: npm run translate -- <slug> --from <file>, with one post and a file that exists.');
  process.exit(1);
}

const sources = readSources();
const bySlug = new Map(sources.map((source) => [source.slug, source]));
const missingNames = named.filter((slug) => !bySlug.has(slug));
if (missingNames.length) {
  console.error(`No post named ${missingNames.join(', ')}. Posts: ${sources.map((s) => s.slug).join(', ')}`);
  process.exit(1);
}

const chinese = sources.filter((source) => !source.english);
const posts = named.length
  ? named.map((slug) => bySlug.get(slug)!).filter((source) => !source.english)
  : chinese.filter((source) => source.published && translatedFrom(source) === null);
const stale = chinese.filter((source) => {
  const from = translatedFrom(source);
  return from !== null && from !== source.hash && !posts.includes(source);
});
/** The figures of a post with no English copy yet, or with a copy made from an older version of the figure. */
const figuresToDo = (source: Source) => figuresOf(source).filter((figure) => figureFrom(figure) !== figure.hash);
// the figures of every post that has, or is about to have, an English version
const figures = chinese
  .filter((source) => posts.includes(source) || translatedFrom(source) !== null)
  .flatMap((source) => figuresToDo(source).map((figure) => ({ source, figure })));

for (const slug of named) if (bySlug.get(slug)!.english) console.log(`${slug}: already in English, nothing to translate`);

if (check) {
  let differ = 0;
  for (const source of named.length ? named.map((slug) => bySlug.get(slug)!) : chinese) {
    if (source.english || !existsSync(source.target)) continue;
    const problems = compare(source.body, parseFrontmatter(readFileSync(source.target, 'utf8')).content.trim());
    if (problems.length) differ++;
    console.log(`${source.slug}: ${problems.length ? 'differs from the original:' : 'same structure as the original'}`);
    for (const problem of problems) console.log(`  - ${problem}`);
  }
  if (differ) process.exitCode = 1;
} else if (dryRun) {
  // DeepSeek counts about 0.6 tokens per Chinese character and 0.3 per other character
  const tokens = (text: string) => {
    const han = text.match(/\p{Script=Han}/gu)?.length ?? 0;
    return han * 0.6 + (text.length - han) * 0.3;
  };
  const estimate: Usage = { hit: 0, miss: 0, out: 0 };
  for (const source of posts) {
    const text = `${source.title}\n${source.description}\n${source.body}`;
    estimate.miss += tokens(POST_PROMPT) + tokens(text);
    estimate.out += tokens(text) * 1.4;
  }
  for (const { figure } of figures) {
    estimate.miss += tokens(FIGURE_PROMPT) + tokens(figure.labels.join('\n'));
    estimate.out += tokens(figure.labels.join('\n')) * 2;
  }
  console.log(`Model ${MODEL} at ${BASE_URL}`);
  console.log(`Posts to translate: ${posts.map((s) => s.slug).join(', ') || 'none'}`);
  console.log(`Figures to translate: ${figures.map(({ figure }) => rel(figure.file)).join(', ') || 'none'}`);
  if (posts.length || figures.length) {
    console.log(`Rough cost: ${cost({ hit: 0, miss: Math.round(estimate.miss), out: Math.round(estimate.out) })}`);
  }
} else {
  let failed = 0;
  const run = async (what: string, task: () => Promise<boolean>) => {
    try {
      if (await task()) return true;
    } catch (error) {
      console.log(`  ${what}: ${(error as Error).message}`);
    }
    failed++;
    return false;
  };
  // the figures of posts translated earlier, then each new post followed by its figures, which take
  // their context from the English post (a post that fails keeps its figures for the next run)
  for (const { source, figure } of figures) {
    if (!posts.includes(source)) await run(basename(figure.file), () => translateFigure(source, figure));
  }
  for (const source of posts) {
    if (!(await run(source.slug, () => translatePost(source, reply)))) continue;
    for (const figure of figuresToDo(source)) await run(basename(figure.file), () => translateFigure(source, figure));
  }
  // every English version links the English figures and posts that exist now
  const translated = translatedSlugs(sources);
  for (const source of chinese) {
    if (!existsSync(source.target)) continue;
    const text = readFileSync(source.target, 'utf8');
    const linked = linkPosts(linkFigures(text, dirname(source.target)), translated);
    if (linked !== text) {
      writeFileSync(source.target, linked);
      console.log(`${source.slug}: pointed ${rel(source.target)} at the English figures and posts`);
    }
  }
  if (posts.length || figures.length) console.log(`\nUsed ${cost(spent)}.`);
  else console.log('Every published post has an English version.');
  if (failed) {
    console.log(`${failed} translation(s) failed; see above.`);
    process.exitCode = 1;
  }
}

if (stale.length) {
  console.log('\nOut of date (the Chinese has changed since the English was made; not overwritten):');
  for (const source of stale) console.log(`  ${source.slug}: npm run translate -- ${source.slug}`);
}
