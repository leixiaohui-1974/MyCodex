import crypto from 'node:crypto';

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/** 内存 state 存储：state -> 过期时间戳（ms）。TTL 10 分钟。 */
const STATE_TTL_MS = 10 * 60 * 1000;
const pendingStates = new Map<string, number>();

/** 清理已过期的 state 条目（每次写入时顺带执行）。 */
function purgeExpiredStates(): void {
  const now = Date.now();
  for (const [key, expiry] of pendingStates) {
    if (now > expiry) pendingStates.delete(key);
  }
}

export async function getWechatQrUrl(): Promise<{ qrUrl: string; state: string }> {
  const appId = getEnv('WECHAT_APP_ID');
  const redirectUri = getEnv('WECHAT_REDIRECT_URI');
  const state = crypto.randomUUID();

  purgeExpiredStates();
  pendingStates.set(state, Date.now() + STATE_TTL_MS);

  const params = new URLSearchParams({
    appid: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'snsapi_login',
    state,
  });

  const qrUrl = `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`;
  return { qrUrl, state };
}

export async function handleWechatCallback(
  code: string,
  state: string
): Promise<{ userId: string; name: string; avatar: string }> {
  if (!code) throw new Error('Missing code');
  if (!state) throw new Error('Missing state');

  // state 校验：检查是否存在且未过期
  const expiry = pendingStates.get(state);
  if (expiry === undefined || Date.now() > expiry) {
    pendingStates.delete(state);
    throw Object.assign(new Error('Invalid or expired state'), { statusCode: 401 });
  }
  pendingStates.delete(state); // 一次性使用

  const appId = getEnv('WECHAT_APP_ID');
  const appSecret = getEnv('WECHAT_APP_SECRET');

  const tokenParams = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    code,
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch(
    `https://api.weixin.qq.com/sns/oauth2/access_token?${tokenParams.toString()}`
  );
  if (!tokenRes.ok) throw new Error(`Failed to get wechat access token: HTTP ${tokenRes.status}`);

  const tokenJson = await tokenRes.json() as {
    access_token: string; openid: string; unionid?: string;
    errcode?: number; errmsg?: string;
  };
  if (tokenJson.errcode) {
    throw new Error(`WeChat token error: [${tokenJson.errcode}] ${tokenJson.errmsg}`);
  }

  const userInfoParams = new URLSearchParams({
    access_token: tokenJson.access_token,
    openid: tokenJson.openid,
    lang: 'zh_CN',
  });

  const userRes = await fetch(
    `https://api.weixin.qq.com/sns/userinfo?${userInfoParams.toString()}`
  );
  if (!userRes.ok) throw new Error(`Failed to get wechat user info: HTTP ${userRes.status}`);

  const user = await userRes.json() as {
    openid: string; nickname: string; headimgurl: string;
    unionid?: string; errcode?: number; errmsg?: string;
  };
  if (user.errcode) {
    throw new Error(`WeChat userinfo error: [${user.errcode}] ${user.errmsg}`);
  }

  return {
    userId: user.unionid || user.openid,
    name: user.nickname,
    avatar: user.headimgurl,
  };
}
