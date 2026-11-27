import { CATEGORY_IDS, type CategoryId } from './categories';
import { tagSlug, type PostSummary } from './posts';

export interface TagGroup {
  slug: string;
  /** display name: the spelling used by the newest post */
  name: string;
  items: PostSummary[];
  minutes: number;
  /** reading time per category, for the stacked bar on /tags/ */
  categories: { category: CategoryId; minutes: number }[];
}

export function groupByTag(all: PostSummary[]): TagGroup[] {
  const groups = new Map<string, TagGroup>();
  for (const item of all) {
    const seen = new Set<string>();
    for (const tag of item.post.data.tags) {
      const slug = tagSlug(tag);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      let group = groups.get(slug);
      if (!group) {
        group = { slug, name: tag, items: [], minutes: 0, categories: [] };
        groups.set(slug, group);
      }
      group.items.push(item);
      group.minutes += item.minutes;
    }
  }
  for (const group of groups.values()) {
    group.categories = CATEGORY_IDS.map((category) => ({
      category,
      minutes: group.items.filter((i) => i.category === category).reduce((sum, i) => sum + i.minutes, 0),
    })).filter((entry) => entry.minutes > 0);
  }
  return [...groups.values()].sort(
    (a, b) => b.items.length - a.items.length || b.minutes - a.minutes || a.name.localeCompare(b.name),
  );
}
