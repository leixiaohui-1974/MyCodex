import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  provider: string;
  role: string;
  iat?: number;
  exp?: number;
}

const DEFAULT_EXPIRES_IN = '7d';

function getJwtSecret(): string {
  const secret = process.env.MYCODEX_JWT_SECRET;
  if (!secret) {
    console.error('FATAL: MYCODEX_JWT_SECRET environment variable is not set');
    process.exit(1);
  }
  return secret;
}

export function generateToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresIn: string = DEFAULT_EXPIRES_IN
): string {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded as JwtPayload;
}

export function refreshToken(token: string): string {
  const payload = verifyToken(token);
  return generateToken(
    {
      sub: payload.sub,
      provider: payload.provider,
      role: payload.role,
    },
    DEFAULT_EXPIRES_IN
  );
}
