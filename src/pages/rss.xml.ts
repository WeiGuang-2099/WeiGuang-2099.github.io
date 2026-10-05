import type { APIContext } from 'astro';
import { feed } from '../lib/routes';

export const GET = (context: APIContext) => feed(context, 'zh');
