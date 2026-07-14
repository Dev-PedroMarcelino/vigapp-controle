// Vercel serverless function — proxies the Overpass API so the browser calls
// this same-origin endpoint instead of overpass-api.de directly (which does
// not reliably send CORS headers). Runs server-side, where CORS does not apply.
//
// A descriptive User-Agent is required: without it, Overpass's anti-bot layer
// returns 406 to datacenter IPs (like Vercel's). Several mirrors are tried in
// order so a single instance blocking/rate-limiting the IP is not fatal.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

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

  let last = null;
  for (const url of ENDPOINTS) {
    try {
      const upstream = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'VigApp/1.0 (CRM lead capture)',
          'Accept': 'application/json',
        },
        body: 'data=' + encodeURIComponent(query),
      });
      if (upstream.ok) {
        const text = await upstream.text();
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
        res.status(200).send(text);
        return;
      }
      last = { url, status: upstream.status };
    } catch (err) {
      last = { url, error: String(err) };
    }
  }

  res.status(502).json({ error: 'all Overpass endpoints failed', last });
}
