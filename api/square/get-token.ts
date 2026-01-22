export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Extract token from secure HTTP-only cookie
    const cookies = req.headers.cookie?.split(';').reduce((acc: any, cookie: string) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {}) || {};

    const token = cookies.square_access_token;
    if (!token) {
      return res.status(401).json({ message: 'Square access token not found. Please authenticate with Square.' });
    }

    // Only return token to same-site requests (browser will send token via cookies)
    // This endpoint is called by the authenticated frontend to get the token
    return res.status(200).json({ access_token: token });
  } catch (e: any) {
    console.error('Token retrieval error:', e);
    return res.status(500).json({ message: e.message });
  }
}
