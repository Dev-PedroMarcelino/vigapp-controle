// Vercel serverless function — proxies the Overpass API so the browser calls
// this same-origin endpoint instead of overpass-api.de directly (which does
// not reliably send CORS headers). Runs server-side, where CORS does not apply.
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

  try {
    const upstream = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    });
    const text = await upstream.text();
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.status(upstream.status).send(text);
  } catch (err) {
    res.status(502).json({ error: 'overpass proxy failed', detail: String(err) });
  }
}
