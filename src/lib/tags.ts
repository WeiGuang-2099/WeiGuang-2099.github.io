import { LANE_ORDER, tagSlug, TOPIC_LANES, type Lane, type PostSummary } from './posts';

export interface TagGroup {
  slug: string;
  /** display name: the spelling used by the newest post */
  name: string;
  items: PostSummary[];
  minutes: number;
  /** reading time per lane, for the stacked bar on /tags/ */
  lanes: { lane: Lane; minutes: number }[];
  /** set when the tag itself names a topic lane */
  lane?: Lane;
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
        const lane = (TOPIC_LANES as readonly string[]).includes(slug) ? (slug as Lane) : undefined;
        group = { slug, name: tag, items: [], minutes: 0, lanes: [], lane };
        groups.set(slug, group);
      }
      group.items.push(item);
      group.minutes += item.minutes;
    }
  }
  for (const group of groups.values()) {
    group.lanes = LANE_ORDER.map((lane) => ({
      lane,
      minutes: group.items.filter((i) => i.lane === lane).reduce((sum, i) => sum + i.minutes, 0),
    })).filter((entry) => entry.minutes > 0);
  }
  return [...groups.values()].sort(
    (a, b) => b.items.length - a.items.length || b.minutes - a.minutes || a.name.localeCompare(b.name),
  );
}
