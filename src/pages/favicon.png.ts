import type { APIRoute } from 'astro';

// 32x32 PNG: dark background, red crosshair icon
const FAVICON_B64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA4UlEQVR4nO2XwQ6EMAhEdbMnPsqP96N63T2ZNAQoM9R0TXaOWuGVTijuIvLZFuq1MvkUgLO17WxtHUBVO+OBaMeHyH0ASKmzICkAnbgPfr27nkVrLQ090Ac8RIYB9ZpR1UIAnRxRFsIFqCRHIIZHwCbPfm+aUBtrhryYv9eIkN2jPrFi0xXQpmLvAwrAS8ZAvL2PrWCIKSOY/iiea0KmQlNNqJOxPePfiEwA7263lJkJo4pC8wAjeh5AhopMcs9PYQUqENl7ApoHsueNXFLPmIoRkFv/CyIYtmktb0TlClT1BSKomwMYD+foAAAAAElFTkSuQmCC';

export const GET: APIRoute = () => {
  const binary = Buffer.from(FAVICON_B64, 'base64');
  return new Response(binary, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=604800',
    }
  });
};
