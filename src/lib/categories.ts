/**
 * Categories (栏目). Every post belongs to exactly one, named by `category` in its frontmatter (required:
 * `category: reading-notes`). The order here is the order of the header navigation and of the home page.
 * Each category has a page at /<id>/ (/en/<id>/) and its own pigment, --lane-<id> in global.css.
 *
 * This file is plain data: src/content.config.ts imports it for the schema, so it must not import
 * astro:content (posts.ts does), except as types.
 */
import { localePath, type Locale } from './i18n';
import type { PostSummary } from './posts';

export const CATEGORY_IDS = ['projects', 'reading-notes', 'software-design', 'essays', 'retrospectives'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface Category {
  name: Record<Locale, string>;
  /**
   * Announced before anything in it is published: while the category has no posts, the home page keeps
   * a placeholder for it, the name and this status ("在读", "整理中"), with no link, no count and no titles.
   */
  upcoming?: Record<Locale, string>;
}

export const CATEGORIES: Record<CategoryId, Category> = {
  projects: { name: { zh: '作品', en: 'Projects' } },
  'reading-notes': { name: { zh: '读书笔记', en: 'Reading notes' } },
  // notes on A Philosophy of Software Design first, and other books on software design later
  'software-design': { name: { zh: '软件设计', en: 'Software design' }, upcoming: { zh: '在读', en: 'Now reading' } },
  essays: { name: { zh: '随笔', en: 'Essays' } },
  retrospectives: { name: { zh: '复盘', en: 'Retrospectives' }, upcoming: { zh: '整理中', en: 'In progress' } },
};

export const categoryUrl = (id: CategoryId, locale: Locale) => localePath(locale, `/${id}/`);

/** The category's pigment, for the spans and swatches of its posts. */
export const laneVar = (id: CategoryId) => `var(--lane-${id})`;

export interface CategoryGroup {
  id: CategoryId;
  /** newest first, like the list they come from */
  items: PostSummary[];
  minutes: number;
}

/** The categories that have posts in the list, in the order above. */
export function groupByCategory(all: PostSummary[]): CategoryGroup[] {
  return CATEGORY_IDS.map((id) => {
    const items = all.filter((item) => item.category === id);
    return { id, items, minutes: items.reduce((sum, item) => sum + item.minutes, 0) };
  }).filter((group) => group.items.length > 0);
}
