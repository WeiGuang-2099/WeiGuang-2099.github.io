export const SITE = {
  name: 'Dawning',
  nameZh: '缉熙',
  url: 'https://weiguang-2099.github.io',
  description:
    'Notes by Dawning (缉熙), an AI engineer, on RAG systems, multi-agent orchestration and LLM application engineering.',
  github: 'https://github.com/WeiGuang-2099',
  repo: 'https://github.com/WeiGuang-2099/WeiGuang-2099.github.io',
  ogImage: {
    path: '/og.png',
    width: 1200,
    height: 630,
    alt: 'Dawning (缉熙): notes on RAG systems, multi-agent orchestration and LLM application engineering',
  },
} as const;

/** Header navigation. `match` decides which section a path belongs to. */
export const NAV = [
  { label: 'Archive', href: '/archive/', match: (path: string) => path.startsWith('/archive') || path.startsWith('/posts/') },
  { label: 'Tags', href: '/tags/', match: (path: string) => path.startsWith('/tags') },
  { label: 'About', href: '/about/', match: (path: string) => path.startsWith('/about') },
  { label: 'RSS', href: '/rss.xml', match: () => false },
] as const;
