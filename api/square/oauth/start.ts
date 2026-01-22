export default function handler(req: any, res: any) {
  const squareAppId = process.env.VITE_SQUARE_APPLICATION_ID || process.env.VITE_SQUARE_CLIENT_ID;
  const squareRedirectUri = process.env.VITE_SQUARE_REDIRECT_URI;
  const squareEnv = (process.env.VITE_SQUARE_ENV || 'production').toLowerCase();
  const oauthScopes =
    process.env.VITE_SQUARE_OAUTH_SCOPES ||
    'MERCHANT_PROFILE_READ EMPLOYEES_READ ITEMS_READ CUSTOMERS_READ CUSTOMERS_WRITE APPOINTMENTS_READ APPOINTMENTS_ALL_READ APPOINTMENTS_WRITE SUBSCRIPTIONS_READ SUBSCRIPTIONS_WRITE';

  if (!squareAppId || !squareRedirectUri) {
    return res.status(500).json({ message: 'Square OAuth environment variables are not configured on the server.' });
  }

  const authorizeBase =
    squareEnv === 'sandbox'
      ? 'https://connect.squareupsandbox.com/oauth2/authorize'
      : 'https://connect.squareup.com/oauth2/authorize';

  const state = crypto.randomUUID();

  // Store state in secure HTTP-only cookie for CSRF validation
  res.setHeader('Set-Cookie', `square_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);

  const oauthUrl =
    `${authorizeBase}` +
    `?client_id=${encodeURIComponent(squareAppId)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(oauthScopes)}` +
    `&redirect_uri=${encodeURIComponent(squareRedirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&session=false`;

  res.redirect(302, oauthUrl);
}
