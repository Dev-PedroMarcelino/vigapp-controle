// Vercel serverless function — proxies the Overpass API so the browser calls
// this same-origin endpoint instead of overpass-api.de directly (which does
// not reliably send CORS headers). Runs server-side, where CORS does not apply.
//
// A descriptive User-Agent is required: without it, Overpass's anti-bot layer
// returns 406 to datacenter IPs (like Vercel's). All mirrors are queried in
// parallel and the first successful JSON response wins, so a slow or
// blocking instance can't stall the request (and it stays within Vercel's
// function time limit).
export const config = { maxDuration: 30 };

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const PER_REQUEST_TIMEOUT = 25000;

export default async function handler(req, res) {
  const query =
    req.method === 'POST'
      ? (typeof req.body === 'string'
          ? new URLSearchParams(req.body).get('data')
          : req.body?.data)
      : req.query?.data;

  if (!query) {
    res.status(400).json({ error: 'missing Overpass query' });
    return;
  }

  const body = 'data=' + encodeURIComponent(query);
  const attempt = (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT);
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'VigApp/1.0 (CRM lead capture)',
        'Accept': 'application/json',
      },
      body,
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${url} -> ${r.status}`);
        return { text: await r.text(), ct: r.headers.get('content-type') };
      })
      .finally(() => clearTimeout(timer));
  };

  try {
    // First endpoint to return a successful response wins.
    const result = await Promise.any(ENDPOINTS.map(attempt));
    res.setHeader('Content-Type', result.ct || 'application/json');
    res.status(200).send(result.text);
  } catch (err) {
    res.status(502).json({ error: 'all Overpass endpoints failed' });
  }
}
