/**
 * Interface text for both editions. Short labels live here; the longer prose of the home and About
 * pages is written out in src/views/ for each language. Measured values keep the same notation in
 * both editions: ISO dates, `min` and `s`.
 */
import type { Locale } from './i18n';
import { plural } from './format';

const en = {
  siteName: 'Dawning',
  siteDescription:
    'Notes by Dawning (缉熙), an AI engineer, on RAG systems, multi-agent orchestration and LLM application engineering.',
  ogImageAlt: 'Dawning (缉熙): notes on RAG systems, multi-agent orchestration and LLM application engineering',
  skipLink: 'Skip to content',
  homeLink: 'Dawning, home',
  mainNav: 'Main',
  nav: { archive: 'Archive', tags: 'Tags', about: 'About', rss: 'RSS' },
  theme: { toggle: 'Switch color theme', toDark: 'Switch to dark theme', toLight: 'Switch to light theme' },
  /** the header link to the same page in the other edition; it names the language it leads to */
  switchTo: { label: '中', name: '中文' },
  noTranslation: 'This post has no Chinese version yet',
  /** marks a list entry whose post exists only in the other language */
  otherLanguage: { mark: '中文', prefix: 'In Chinese: ' },
  draft: 'Draft',
  empty: 'Nothing published yet.',
  readingTimeOf: 'Reading time: ',
  tagsLabel: 'Tags',
  listDek: (posts: number, minutes: number, max: number) =>
    `${plural(posts, 'post')}, ${minutes} min of reading. Spans show reading time on a 0 to ${max} min scale.`,
  home: {
    gloss: { ji: 'to continue', xi: 'bright' },
    mix: 'Reading time by topic, all posts',
    writing: 'Writing',
    legend: (max: number) => `Reading time, on a 0 to ${max} min scale`,
    allPosts: (total: number, shown: number) => (total > shown ? `All ${total} posts` : 'All posts'),
  },
  archive: {
    title: 'Archive',
    description: 'Every post on Dawning, newest first, with its reading time.',
    year: (n: number) => plural(n, 'post'),
  },
  tags: {
    title: 'Tags',
    description: 'Posts on Dawning by tag, with the total reading time behind each tag.',
    dek: (tags: number, posts: number) =>
      `${plural(tags, 'tag')} across ${plural(posts, 'post')}. Spans show the total reading time behind each tag, colored by topic.`,
    count: (n: number) => plural(n, 'post'),
    totalOf: 'Total reading time: ',
    empty: 'No tags yet.',
  },
  tag: {
    title: (name: string) => `Posts tagged ${name}`,
    description: (name: string) => `Posts on Dawning tagged “${name}”, newest first.`,
  },
  about: {
    title: 'About',
    description:
      'About Dawning (缉熙), an AI engineer writing about RAG systems, multi-agent orchestration and LLM application engineering.',
  },
  post: {
    status: 'Status',
    date: 'Date',
    published: 'Published',
    updated: 'Updated',
    readingTime: 'Reading time',
    /** read after the minutes by screen readers ("12 min read"); empty where nothing is added */
    readSuffix: ' read',
    tags: 'Tags',
    /** on a translation: where the original is */
    translatedFrom: 'Translated from',
    original: 'the Chinese original',
    contents: 'Contents',
    sections: (n: number) => plural(n, 'section'),
    tocNote: 'Each span shows where a section starts in the post and how long it takes to read.',
    more: 'More posts',
    previous: 'Previous post',
    next: 'Next post',
  },
  /**
   * What the copy buttons in code blocks say once clicked; {what} is the button's data-what (the file
   * name, or "Python snippet"). The button's own label is set when the post is rendered
   * (src/plugins/rehype-prose.ts).
   */
  copy: {
    copied: 'Copied',
    selected: 'Text selected',
    announceCopied: 'Copied {what}',
    announceFailed: 'Could not copy {what}. The code is selected.',
  },
};

export type UIStrings = typeof en;

const zh: UIStrings = {
  siteName: '缉熙',
  siteDescription: 'AI 工程师缉熙（Dawning）的笔记，关于 RAG 系统、多智能体编排和 LLM 应用工程。',
  ogImageAlt: '缉熙（Dawning）：关于 RAG 系统、多智能体编排和 LLM 应用工程的笔记',
  skipLink: '跳到正文',
  homeLink: '缉熙，首页',
  mainNav: '主导航',
  nav: { archive: '归档', tags: '标签', about: '关于', rss: 'RSS' },
  theme: { toggle: '切换配色', toDark: '切换到深色主题', toLight: '切换到浅色主题' },
  switchTo: { label: 'EN', name: 'English' },
  noTranslation: '这篇文章还没有英文版',
  otherLanguage: { mark: 'English', prefix: '英文：' },
  draft: '草稿',
  empty: '还没有发布文章。',
  readingTimeOf: '阅读时长：',
  tagsLabel: '标签',
  listDek: (posts, minutes, max) => `${posts} 篇，读完约需 ${minutes} min。线段表示阅读时长，刻度 0 到 ${max} min。`,
  home: {
    gloss: { ji: '接续', xi: '光明' },
    mix: '各主题的阅读时长（全部文章）',
    writing: '文章',
    legend: (max) => `阅读时长，刻度 0 到 ${max} min`,
    allPosts: (total, shown) => (total > shown ? `全部 ${total} 篇` : '全部文章'),
  },
  archive: {
    title: '归档',
    description: '缉熙的全部文章，按时间倒序排列，附阅读时长。',
    year: (n) => `${n} 篇`,
  },
  tags: {
    title: '标签',
    description: '缉熙的文章按标签归类，附每个标签下的总阅读时长。',
    dek: (tags, posts) => `${tags} 个标签，${posts} 篇文章。线段表示每个标签下文章的总阅读时长，颜色表示主题。`,
    count: (n) => `${n} 篇`,
    totalOf: '总阅读时长：',
    empty: '还没有标签。',
  },
  tag: {
    title: (name) => `标签：${name}`,
    description: (name) => `缉熙带有“${name}”标签的文章，按时间倒序排列。`,
  },
  about: {
    title: '关于',
    description: '关于缉熙（Dawning）：一名 AI 工程师，写 RAG 系统、多智能体编排和 LLM 应用工程。',
  },
  post: {
    status: '状态',
    date: '日期',
    published: '发布',
    updated: '更新',
    readingTime: '阅读时长',
    readSuffix: '',
    tags: '标签',
    translatedFrom: '译自',
    original: '英文原文',
    contents: '目录',
    sections: (n) => `${n} 节`,
    tocNote: '每条线段表示一节从文章的哪里开始、读完要多久。',
    more: '更多文章',
    previous: '上一篇',
    next: '下一篇',
  },
  copy: {
    copied: '已复制',
    selected: '已选中',
    announceCopied: '已复制 {what}',
    announceFailed: '无法复制 {what}，代码已选中，可以手动复制。',
  },
};

export const UI: Record<Locale, UIStrings> = { zh, en };
