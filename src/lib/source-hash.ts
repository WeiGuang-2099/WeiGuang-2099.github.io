import { createHash } from 'node:crypto';

/**
 * Fingerprint of what an English translation is made from: the original's title, description and body.
 * scripts/translate.ts writes it into the translation as `sourceHash`, and the site compares it with the
 * original's current text to tell an out-of-date translation. Line endings and surrounding whitespace do
 * not count; date, tags and every other frontmatter field are not translated, so they do not count either.
 */
export function sourceHash({ title, description, body }: { title: string; description: string; body: string }): string {
  const text = [title, description, body].map((part) => part.replace(/\r\n?/g, '\n').trim()).join('\n\0\n');
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}
