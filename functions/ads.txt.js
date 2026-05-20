export async function onRequest() {
  return new Response(
    'google.com, pub-7380718671497895, DIRECT, f08c47fec0942fa0',
    { headers: { 'Content-Type': 'text/plain' } }
  );
}
