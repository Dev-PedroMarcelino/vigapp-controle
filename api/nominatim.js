// Vercel serverless function — proxies Nominatim geocoding. Runs server-side
// so we can send a descriptive User-Agent (required by Nominatim's usage
// policy) and avoid any browser CORS/rate concerns.
export default async function handler(req, res) {
  const q = req.query?.q;
  if (!q) {
    res.status(400).json({ error: 'missing q' });
    return;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'VigApp/1.0 (CRM lead capture)',
        'Accept': 'application/json',
      },
    });
    const text = await upstream.text();
    res.setHeader('Content-Type', 'application/json');
    res.status(upstream.status).send(text);
  } catch (err) {
    res.status(502).json({ error: 'nominatim proxy failed', detail: String(err) });
  }
}
