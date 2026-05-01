// Vercel serverless function — receives email signups from the tool, posts directly to Beehiiv API
//
// REQUIRED ENV VARS (set in Vercel dashboard):
//   BEEHIIV_API_KEY         — generate at Beehiiv Settings → Integrations → API
//   BEEHIIV_PUBLICATION_ID  — found in Beehiiv URL (looks like "pub_abc123-...")

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID;

  if (!apiKey || !publicationId) {
    console.error('Missing BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { email, role, result_summary } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (email.length > 255) {
    return res.status(400).json({ error: 'Email too long' });
  }

  // Build the request to Beehiiv's API
  const beehiivBody = {
    email: email.trim().toLowerCase(),
    reactivate_existing: true,
    send_welcome_email: false, // we use our own welcome automation, don't send Beehiiv's default
    utm_source: 'manusatlas.com',
    utm_medium: 'tool',
    utm_campaign: 'agent_generator'
  };

  // If a role was captured at the tool, attach it as a custom field for later segmentation
  if (role && typeof role === 'string' && role.length > 0) {
    beehiivBody.custom_fields = [
      { name: 'role', value: role.substring(0, 255) }
    ];
  }

  try {
    const beehiivResponse = await fetch(
      `https://api.beehiiv.com/v2/publications/${publicationId}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(beehiivBody)
      }
    );

    if (!beehiivResponse.ok) {
      const errorBody = await beehiivResponse.text();
      console.error('Beehiiv API error:', beehiivResponse.status, errorBody);

      // 400/422 from Beehiiv usually means duplicate email or invalid format — treat as soft success
      // (the user already exists in our list, no need to alarm them)
      if (beehiivResponse.status === 400 || beehiivResponse.status === 422) {
        return res.status(200).json({ success: true, note: 'already_subscribed' });
      }

      return res.status(502).json({ error: 'Subscription failed. Please try again.' });
    }

    const data = await beehiivResponse.json();
    return res.status(200).json({ success: true, id: data?.data?.id });

  } catch (err) {
    console.error('Subscribe handler error:', err);
    return res.status(500).json({ error: 'Unexpected error. Please try again.' });
  }
}
