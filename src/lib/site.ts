export const SITE = {
  name: 'Dawning',
  nameZh: '缉熙',
  url: 'https://weiguang-2099.github.io',
  github: 'https://github.com/WeiGuang-2099',
  repo: 'https://github.com/WeiGuang-2099/WeiGuang-2099.github.io',
  // the description and the image's alt text are per edition, in src/lib/ui.ts
  ogImage: { path: '/og.png', width: 1200, height: 630 },
} as const;

/**
 * Header navigation after the categories, which come first (src/components/SiteHeader.astro). Paths are
 * written without the edition prefix (src/lib/i18n.ts adds /en/), labels come from UI[locale].nav, and
 * `match` decides which section a path belongs to. A post belongs to its category; the tags and the
 * feed are linked from the footer.
 */
export const NAV = [
  { key: 'archive', href: '/archive/', match: (path: string) => path.startsWith('/archive') },
  { key: 'about', href: '/about/', match: (path: string) => path.startsWith('/about') },
] as const;
