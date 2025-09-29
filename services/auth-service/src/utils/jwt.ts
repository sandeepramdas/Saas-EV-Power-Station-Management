import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'ev-platform',
  });
}

export function verifyJWT(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export function refreshToken(oldToken: string): string {
  try {
    const decoded = verifyJWT(oldToken);
    return signJWT({
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      role: decoded.role,
    });
  } catch (error) {
    throw new Error('Invalid token for refresh');
  }
}