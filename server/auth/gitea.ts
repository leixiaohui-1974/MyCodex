function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function getGiteaAuthUrl(): string {
  const base = normalizeBaseUrl(process.env.GITEA_URL ?? 'http://gitea:3000');
  const clientId = requireEnv('GITEA_CLIENT_ID');
  const redirectUri = requireEnv('GITEA_REDIRECT_URI');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
  });

  return `${base}/login/oauth/authorize?${params.toString()}`;
}

export async function handleGiteaCallback(
  code: string
): Promise<{ userId: string; name: string; email: string; avatar: string }> {
  if (!code) throw new Error('Missing OAuth code');

  const base = normalizeBaseUrl(process.env.GITEA_URL ?? 'http://gitea:3000');
  const clientId = requireEnv('GITEA_CLIENT_ID');
  const clientSecret = requireEnv('GITEA_CLIENT_SECRET');
  const redirectUri = requireEnv('GITEA_REDIRECT_URI');

  const tokenRes = await fetch(`${base}/login/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => '');
    throw new Error(`Failed to fetch access token: ${tokenRes.status} ${text}`);
  }

  const tokenJson = await tokenRes.json() as { access_token?: string };
  if (!tokenJson.access_token) throw new Error('No access_token in token response');

  const userRes = await fetch(`${base}/api/v1/user`, {
    headers: {
      Authorization: `token ${tokenJson.access_token}`,
      Accept: 'application/json',
    },
  });

  if (!userRes.ok) {
    const text = await userRes.text().catch(() => '');
    throw new Error(`Failed to fetch user info: ${userRes.status} ${text}`);
  }

  const user = await userRes.json() as {
    id?: number | string; login?: string; full_name?: string;
    email?: string; avatar_url?: string;
  };

  const userId = String(user.id ?? user.login ?? '');
  if (!userId) throw new Error('Invalid user info: missing id/login');

  return {
    userId,
    name: user.full_name || user.login || '',
    email: user.email || '',
    avatar: user.avatar_url || '',
  };
}
