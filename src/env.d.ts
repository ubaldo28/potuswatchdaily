/// <reference types="astro/client" />

interface CloudflareEnv {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  RESEND_API_KEY: string;
  RESEND_AUDIENCE_ID: string;
  RESEND_FROM_EMAIL?: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<CloudflareEnv>;

declare namespace App {
  interface Locals extends Runtime {}
}
