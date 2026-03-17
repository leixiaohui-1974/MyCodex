const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getGoogleAuthUrl(): string {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const redirectUri = requireEnv('GOOGLE_REDIRECT_URI');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
  });

  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

export async function handleGoogleCallback(
  code: string
): Promise<{ userId: string; name: string; email: string; avatar: string }> {
  if (!code) throw new Error('Missing authorization code');

  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
  const redirectUri = requireEnv('GOOGLE_REDIRECT_URI');

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Failed to exchange code for token: ${tokenRes.status} ${text}`);
  }

  const tokenJson = await tokenRes.json() as { access_token?: string; error?: string };
  if (!tokenJson.access_token) {
    throw new Error(`Google token response missing access_token${tokenJson.error ? `: ${tokenJson.error}` : ''}`);
  }

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });

  if (!userRes.ok) {
    const text = await userRes.text();
    throw new Error(`Failed to fetch Google user info: ${userRes.status} ${text}`);
  }

  const user = await userRes.json() as {
    id?: string; name?: string; email?: string; picture?: string;
  };

  if (!user.id || !user.email) {
    throw new Error('Google user info missing required fields: id/email');
  }

  return {
    userId: user.id,
    name: user.name ?? '',
    email: user.email,
    avatar: user.picture ?? '',
  };
}
