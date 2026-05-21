globalThis.process ??= {}; globalThis.process.env ??= {};
import { c as createClient } from '../chunks/index_CqzAMo15.mjs';
export { renderers } from '../renderers.mjs';

const GET = async ({ request, locals }) => {
  const { env } = locals.runtime;
  const url = new URL(request.url);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    const { data, error } = await supabase.from("articles").select("id,title,slug,excerpt,region,date,time,image").order("id", { ascending: false }).range(offset, offset + 23);
    if (error) throw error;
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
