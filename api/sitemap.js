// Vercel serverless function — generates sitemap.xml dynamically from Airtable Atlas entries
// Tells Google (and other search engines) which pages to index

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Agents';
const SITE_URL = 'https://manusatlas.com';

async function fetchLiveAgents() {
  const fields = ['Slug', 'Date submitted'];
  const fieldParams = fields.map(f => `fields%5B%5D=${encodeURIComponent(f)}`).join('&');
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?filterByFormula=${encodeURIComponent('Status="Live"')}&${fieldParams}&pageSize=100`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.records
    .map(r => ({
      slug: r.fields.Slug,
      lastmod: r.fields['Date submitted']
    }))
    .filter(a => a.slug);
}

function escapeXml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID');
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Config error</error>');
  }

  try {
    const agents = await fetchLiveAgents();
    const today = todayIso();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Homepage
    xml += '  <url>\n';
    xml += `    <loc>${SITE_URL}/</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += '    <priority>1.0</priority>\n';
    xml += '  </url>\n';

    // Atlas index
    xml += '  <url>\n';
    xml += `    <loc>${SITE_URL}/atlas</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>0.9</priority>\n';
    xml += '  </url>\n';

    // Each Atlas entry
    for (const a of agents) {
      const lastmod = a.lastmod || today;
      xml += '  <url>\n';
      xml += `    <loc>${SITE_URL}/atlas/${escapeXml(a.slug)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>';
    return res.status(200).send(xml);
  } catch (err) {
    console.error('Sitemap error:', err);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Sitemap generation failed</error>');
  }
}
