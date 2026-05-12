// Vercel serverless function — handles /atlas and /atlas/[slug] routes
// Fetches live data from Airtable and renders SEO-friendly HTML.
//
// REQUIRED ENV VARS (set in Vercel dashboard):
//   AIRTABLE_API_KEY     — read-only Personal Access Token scoped to the Manus Atlas base
//   AIRTABLE_BASE_ID     — your base ID (starts with "app...")
//   AIRTABLE_TABLE_NAME  — "Agents" (or whatever you named the table)

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Agents';

// ---------- Airtable fetching ----------

async function fetchLiveAgents() {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?filterByFormula=${encodeURIComponent('Status="Live"')}&pageSize=100`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.records.map(r => ({ id: r.id, ...r.fields }));
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pluralize(n, singular, plural) {
  return n === 1 ? singular : (plural || singular + 's');
}

// ---------- Shared styling (matches index.html) ----------

const SHARED_STYLES = `
  :root {
    --navy: #0B1F3A;
    --amber: #F4A340;
    --bg: #FAFAF7;
    --text: #1A1A1A;
    --gray: #6B6B6B;
    --light-gray: #E6E4DE;
    --white: #FFFFFF;
    --amber-tint: #FAF6EE;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.55;
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--navy); }
  .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
  header.site-header {
    padding: 24px 0;
    border-bottom: 1px solid var(--light-gray);
  }
  header.site-header .logo {
    font-family: 'Fraunces', serif;
    font-weight: 700;
    font-size: 22px;
    color: var(--navy);
    letter-spacing: -0.01em;
    text-decoration: none;
  }
  h1, h2, h3 { font-family: 'Fraunces', serif; color: var(--navy); }
  .breadcrumb {
    font-size: 14px;
    color: var(--gray);
    margin: 24px 0 16px;
  }
  .breadcrumb a { color: var(--gray); text-decoration: none; }
  .breadcrumb a:hover { color: var(--navy); }
  footer.site-footer {
    border-top: 1px solid var(--light-gray);
    padding: 40px 0 60px;
    margin-top: 64px;
    font-size: 14px;
    color: var(--gray);
  }
  .footer-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 32px;
    margin-bottom: 32px;
  }
  .footer-col h4 {
    color: var(--navy);
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    font-family: 'Inter', sans-serif;
  }
  .footer-col a {
    display: block;
    color: var(--gray);
    text-decoration: none;
    margin-bottom: 6px;
  }
  .footer-col a:hover { color: var(--navy); }
  .footer-bottom {
    border-top: 1px solid var(--light-gray);
    padding-top: 20px;
    font-size: 13px;
    color: var(--gray);
  }
  @media (max-width: 600px) {
    .footer-grid { grid-template-columns: 1fr; gap: 20px; }
  }
`;

function renderHeader() {
  return `
<header class="site-header">
  <div class="container">
    <a href="/" class="logo">manus atlas</a>
  </div>
</header>`;
}

function renderFooter() {
  return `
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-col">
        <h4>Manus Atlas</h4>
        <p style="color: var(--gray); font-size: 14px;">The map of what Manus AI can actually do for you.</p>
      </div>
      <div class="footer-col">
        <h4>Browse</h4>
        <a href="/atlas">Browse the Atlas</a>
        <a href="/weekly">The Atlas Weekly</a>
        <a href="/atlas/submit">Submit your agent</a>
      </div>
      <div class="footer-col">
        <h4>Contact</h4>
        <a href="mailto:hello@manusatlas.com">hello@manusatlas.com</a>
        <a href="https://x.com/manusatlas_" target="_blank" rel="noopener">@manusatlas_ on X</a>
        <a href="https://www.linkedin.com/company/manus-atlas" target="_blank" rel="noopener">Manus Atlas on LinkedIn</a>
      </div>
    </div>
    <div class="footer-bottom">
      © 2026 Manus Atlas. Independent project, not affiliated with Manus AI.
    </div>
  </div>
</footer>`;
}

// ---------- Index page rendering ----------

function renderIndexPage(agents) {
  const total = agents.length;
  const allBestFor = [...new Set(agents.flatMap(a => a['Best for'] || []))].sort();
  const allIndustries = [...new Set(agents.flatMap(a => a['Industry tags'] || []))].sort();

  const agentCards = agents.map(a => {
    const bestFor = (a['Best for'] || []).slice(0, 3);
    const timeSaved = a['Time saved per week'];
    const slug = a.Slug || '';
    return `
      <a href="/atlas/${escapeHtml(slug)}" class="agent-card">
        <div class="agent-card-header">
          <h3>${escapeHtml(a['Agent Name'] || 'Untitled')}</h3>
          ${timeSaved ? `<span class="time-badge">${timeSaved} ${pluralize(timeSaved, 'hr')}/wk</span>` : ''}
        </div>
        <p class="agent-oneliner">${escapeHtml(a['One-liner'] || '')}</p>
        <div class="agent-tags">
          ${bestFor.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      </a>`;
  }).join('\n');

  const indexStyles = `
    .hero {
      padding: 64px 0 40px;
      max-width: 720px;
    }
    .hero h1 {
      font-weight: 700;
      font-size: clamp(36px, 6vw, 52px);
      line-height: 1.1;
      letter-spacing: -0.02em;
      margin-bottom: 20px;
    }
    .hero .subhead {
      font-size: 18px;
      color: var(--gray);
      margin-bottom: 12px;
    }
    .hero .count {
      font-size: 14px;
      color: var(--navy);
      font-weight: 600;
      margin-top: 16px;
    }
    .agent-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
      margin: 32px 0 64px;
    }
    .agent-card {
      background: var(--white);
      border: 1px solid var(--light-gray);
      border-radius: 12px;
      padding: 24px;
      text-decoration: none;
      color: var(--text);
      transition: border-color 0.15s, transform 0.15s;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .agent-card:hover {
      border-color: var(--navy);
      transform: translateY(-2px);
    }
    .agent-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .agent-card h3 {
      font-size: 20px;
      line-height: 1.25;
      flex: 1;
    }
    .time-badge {
      background: var(--amber-tint);
      color: var(--navy);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }
    .agent-oneliner {
      font-size: 14px;
      color: var(--gray);
      line-height: 1.5;
    }
    .agent-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .tag {
      font-size: 12px;
      color: var(--gray);
      background: var(--bg);
      padding: 3px 8px;
      border-radius: 4px;
    }
    .submit-cta {
      background: var(--navy);
      color: var(--white);
      padding: 40px 32px;
      border-radius: 16px;
      margin: 32px 0;
      text-align: center;
    }
    .submit-cta h2 {
      color: var(--white);
      font-size: 24px;
      margin-bottom: 8px;
    }
    .submit-cta p {
      color: var(--white);
      opacity: 0.9;
      margin-bottom: 20px;
    }
    .submit-cta a {
      background: var(--amber);
      color: var(--navy);
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      display: inline-block;
    }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Manus Atlas — directory of working Manus AI agents</title>
  <meta name="description" content="A directory of ${total} working Manus AI agents, sorted by role and industry. Each agent comes with a copy-pasteable prompt you can drop straight into Manus.">

  <meta property="og:title" content="The Manus Atlas — directory of working Manus AI agents">
  <meta property="og:description" content="A directory of working Manus AI agents, sorted by role and industry. Each comes with a copy-pasteable prompt.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://manusatlas.com/atlas">
  <meta name="twitter:card" content="summary_large_image">

  <link rel="canonical" href="https://manusatlas.com/atlas">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "The Manus Atlas",
    "description": "Directory of working Manus AI agents",
    "url": "https://manusatlas.com/atlas",
    "numberOfItems": ${total}
  }
  </script>

  <style>${SHARED_STYLES}${indexStyles}</style>
</head>
<body>
  ${renderHeader()}
  <main class="container">
    <section class="hero">
      <div class="breadcrumb"><a href="/">Manus Atlas</a> &rsaquo; The Atlas</div>
      <h1>The Atlas of Manus AI Agents</h1>
      <p class="subhead">The directory of working agents that real professionals across ${allBestFor.length} roles have built or vetted. Each one comes with a copy-pasteable prompt.</p>
      <p class="count">${total} agents · ${allBestFor.length} roles · ${allIndustries.length} industries</p>
    </section>

    <section class="agent-grid">
      ${agentCards}
    </section>

    <section class="submit-cta">
      <h2>Built something useful in Manus?</h2>
      <p>Submit it to the Atlas and help someone two industries away find it.</p>
      <a href="/atlas/submit">Submit your agent</a>
    </section>
  </main>
  ${renderFooter()}
</body>
</html>`;
}

// ---------- Detail page rendering ----------

function renderAgentPage(agent, allAgents) {
  const name = agent['Agent Name'] || 'Untitled Agent';
  const oneLiner = agent['One-liner'] || '';
  const whatItDoes = agent['What it does'] || '';
  const timeSaved = agent['Time saved per week'];
  const manusPrompt = agent['Manus prompt'] || '';
  const bestFor = agent['Best for'] || [];
  const industries = agent['Industry tags'] || [];
  const tools = agent['Tools required'] || [];
  const submittedBy = agent['Submitted by'] || '';
  const demoUrl = agent['Demo video URL'] || '';

  const related = allAgents
    .filter(a => a.Slug !== agent.Slug)
    .filter(a => {
      const aBestFor = a['Best for'] || [];
      const aIndustries = a['Industry tags'] || [];
      return aBestFor.some(t => bestFor.includes(t)) || aIndustries.some(t => industries.includes(t));
    })
    .slice(0, 3);

  const relatedCards = related.map(a => {
    const aTimeSaved = a['Time saved per week'];
    return `
      <a href="/atlas/${escapeHtml(a.Slug)}" class="related-card">
        <h4>${escapeHtml(a['Agent Name'])}</h4>
        <p>${escapeHtml(a['One-liner'] || '')}</p>
        ${aTimeSaved ? `<span class="time-badge-small">${aTimeSaved} ${pluralize(aTimeSaved, 'hr')}/wk</span>` : ''}
      </a>`;
  }).join('\n');

  const detailStyles = `
    .agent-detail {
      max-width: 760px;
      margin: 32px auto 0;
    }
    .agent-header {
      margin-bottom: 32px;
    }
    .agent-header h1 {
      font-size: clamp(32px, 5vw, 44px);
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.01em;
      margin-bottom: 12px;
    }
    .agent-header .oneliner {
      font-size: 19px;
      color: var(--gray);
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .header-meta {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    .time-badge-large {
      background: var(--amber);
      color: var(--navy);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
    }
    .submitter {
      font-size: 14px;
      color: var(--gray);
    }
    .section {
      background: var(--white);
      border: 1px solid var(--light-gray);
      border-radius: 12px;
      padding: 32px;
      margin-bottom: 20px;
    }
    .section h2 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .section p {
      line-height: 1.7;
      color: var(--text);
    }
    .prompt-box {
      position: relative;
      background: var(--amber-tint);
      border-left: 3px solid var(--amber);
      padding: 24px 28px;
      border-radius: 0 8px 8px 0;
      font-family: 'Inter', monospace;
      font-size: 15px;
      line-height: 1.65;
      color: var(--text);
      white-space: pre-wrap;
      margin-top: 12px;
    }
    .copy-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      background: var(--navy);
      color: var(--white);
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .copy-btn:hover { opacity: 0.9; }
    .copy-btn.copied { background: var(--amber); color: var(--navy); }
    .tag-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .pill {
      background: var(--bg);
      color: var(--gray);
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 13px;
      font-weight: 500;
    }
    .related-section {
      margin: 48px 0;
    }
    .related-section h2 {
      font-family: 'Fraunces', serif;
      font-size: 24px;
      color: var(--navy);
      margin-bottom: 16px;
    }
    .related-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .related-card {
      background: var(--white);
      border: 1px solid var(--light-gray);
      border-radius: 12px;
      padding: 20px;
      text-decoration: none;
      color: var(--text);
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: border-color 0.15s;
    }
    .related-card:hover { border-color: var(--navy); }
    .related-card h4 {
      font-family: 'Inter', sans-serif;
      font-size: 16px;
      font-weight: 600;
      color: var(--navy);
    }
    .related-card p {
      font-size: 13px;
      color: var(--gray);
      line-height: 1.5;
    }
    .time-badge-small {
      background: var(--amber-tint);
      color: var(--navy);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      align-self: flex-start;
    }
    @media (max-width: 600px) {
      .section { padding: 24px 20px; }
      .prompt-box { padding: 20px; padding-top: 48px; }
    }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(name)} — Manus Atlas</title>
  <meta name="description" content="${escapeHtml(oneLiner)}">

  <meta property="og:title" content="${escapeHtml(name)} — a Manus AI agent">
  <meta property="og:description" content="${escapeHtml(oneLiner)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://manusatlas.com/atlas/${escapeHtml(agent.Slug)}">
  <meta name="twitter:card" content="summary">

  <link rel="canonical" href="https://manusatlas.com/atlas/${escapeHtml(agent.Slug)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": ${JSON.stringify(name)},
    "description": ${JSON.stringify(oneLiner)},
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "url": "https://manusatlas.com/atlas/${escapeHtml(agent.Slug)}"
  }
  </script>

  <style>${SHARED_STYLES}${detailStyles}</style>
</head>
<body>
  ${renderHeader()}
  <main class="container">
    <article class="agent-detail">
      <div class="breadcrumb">
        <a href="/">Manus Atlas</a> &rsaquo;
        <a href="/atlas">The Atlas</a> &rsaquo;
        ${escapeHtml(name)}
      </div>

      <header class="agent-header">
        <h1>${escapeHtml(name)}</h1>
        <p class="oneliner">${escapeHtml(oneLiner)}</p>
        <div class="header-meta">
          ${timeSaved ? `<span class="time-badge-large">Saves ${timeSaved} ${pluralize(timeSaved, 'hour')}/week</span>` : ''}
          ${submittedBy ? `<span class="submitter">Submitted by ${escapeHtml(submittedBy)}</span>` : ''}
        </div>
      </header>

      <section class="section">
        <h2>What it does</h2>
        <p>${escapeHtml(whatItDoes).replace(/\n/g, '<br>')}</p>
      </section>

      <section class="section">
        <h2>The Manus prompt</h2>
        <p style="font-size: 14px; color: var(--gray); margin-bottom: 8px;">Copy this prompt and paste it into Manus AI to run the agent.</p>
        <div class="prompt-box">
          <button class="copy-btn" onclick="copyPrompt(this)">Copy</button>
          <span id="prompt-text">${escapeHtml(manusPrompt)}</span>
        </div>
      </section>

      ${tools.length > 0 ? `
      <section class="section">
        <h2>Tools required</h2>
        <div class="tag-row">
          ${tools.map(t => `<span class="pill">${escapeHtml(t)}</span>`).join('')}
        </div>
      </section>` : ''}

      ${bestFor.length > 0 || industries.length > 0 ? `
      <section class="section">
        <h2>Best for</h2>
        <div class="tag-row">
          ${bestFor.map(t => `<span class="pill">${escapeHtml(t)}</span>`).join('')}
          ${industries.map(t => `<span class="pill" style="background: var(--amber-tint); color: var(--navy);">${escapeHtml(t)}</span>`).join('')}
        </div>
      </section>` : ''}

      ${related.length > 0 ? `
      <section class="related-section">
        <h2>More agents like this</h2>
        <div class="related-grid">
          ${relatedCards}
        </div>
      </section>` : ''}
    </article>
  </main>
  ${renderFooter()}

  <script>
    function copyPrompt(btn) {
      const text = document.getElementById('prompt-text').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied ✓';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 2000);
      });
    }
  </script>
</body>
</html>`;
}

// ---------- 404 ----------

function render404() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Not found — Manus Atlas</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@700&family=Inter:wght@400&display=swap" rel="stylesheet">
  <style>${SHARED_STYLES}
    .notfound { max-width: 600px; margin: 80px auto; text-align: center; padding: 0 24px; }
    .notfound h1 { font-size: 36px; margin-bottom: 16px; }
    .notfound p { color: var(--gray); margin-bottom: 24px; }
    .notfound a { color: var(--amber); font-weight: 600; text-decoration: none; }
  </style>
</head>
<body>
  ${renderHeader()}
  <div class="notfound">
    <h1>That agent didn't make the Atlas.</h1>
    <p>It may have been removed, or the URL is wrong.</p>
    <p><a href="/atlas">Browse the full Atlas</a></p>
  </div>
  ${renderFooter()}
</body>
</html>`;
}

// ---------- Main handler ----------

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID');
    return res.status(500).send('Atlas configuration error.');
  }

  const slug = (req.query?.slug || '').trim();

  try {
    const allAgents = await fetchLiveAgents();

    if (slug) {
      const agent = allAgents.find(a => a.Slug === slug);
      if (!agent) {
        return res.status(404).send(render404());
      }
      return res.status(200).send(renderAgentPage(agent, allAgents));
    } else {
      allAgents.sort((a, b) => {
        const aFeatured = a.Status === 'Featured' ? 1 : 0;
        const bFeatured = b.Status === 'Featured' ? 1 : 0;
        if (aFeatured !== bFeatured) return bFeatured - aFeatured;
        const aVotes = a.Upvotes || 0;
        const bVotes = b.Upvotes || 0;
        if (aVotes !== bVotes) return bVotes - aVotes;
        return (a['Agent Name'] || '').localeCompare(b['Agent Name'] || '');
      });
      return res.status(200).send(renderIndexPage(allAgents));
    }
  } catch (err) {
    console.error('Atlas handler error:', err);
    return res.status(500).send('Error loading the Atlas. Try again in a moment.');
  }
}
