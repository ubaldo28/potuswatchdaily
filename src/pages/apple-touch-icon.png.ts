import type { APIRoute } from 'astro';
import { faviconResponse } from '../lib/favicon';

export const GET: APIRoute = () => faviconResponse('image/png');
