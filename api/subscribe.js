const { OAuth2Client } = require('google-auth-library');
const fetch = require('node-fetch');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

module.exports = async (req, res) => {
  // 1. CORS Headers (The Fix)
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. Handle Preflight Request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    // 4. Verify Google Token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { email, name } = ticket.getPayload();

    // 5. Send to Beehiiv
    const response = await fetch(
      `https://api.beehiiv.com/v2/publications/${process.env.BEEHIIV_PUB_ID}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.BEEHIIV_API_KEY}`
        },
        body: JSON.stringify({
          email: email,
          full_name: name || '',
          send_welcome_email: true,
          source: 'Blogger Google Sign-in'
        })
      }
    );

    if (response.status === 201 || response.status === 409) {
      return res.status(200).json({ success: true });
    } else {
      const err = await response.json();
      console.error('Beehiiv Error:', err);
      return res.status(500).json({ error: 'Subscription failed' });
    }

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
