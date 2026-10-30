import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, publicUser } from '../models/User.js';
import { AppError } from '../utils/errors.js';
const tokenOptions = { algorithm: 'HS256', issuer: 'lifelink', audience: 'lifelink-api' };
export function verifyToken(token, config) {
  const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'], issuer: tokenOptions.issuer, audience: tokenOptions.audience });
  if (typeof payload !== 'object' || !Number.isInteger(payload.exp) || !Number.isInteger(payload.iat) || payload.exp <= payload.iat || payload.exp - payload.iat > 86400 || payload.iat > Math.floor(Date.now() / 1000) + 30) throw new Error('Invalid token claims');
  return payload;
}
function session(user, config) {
  return { user: publicUser(user), accessToken: jwt.sign({ tokenVersion: user.tokenVersion ?? 0 }, config.JWT_SECRET, { ...tokenOptions, subject: user._id.toString(), expiresIn: config.JWT_EXPIRES_IN }), tokenType: 'Bearer' };
}
export function createAuthService(config) {
  // Equal-cost comparison for unknown accounts reduces account timing differences.
  const dummyHash = bcrypt.hash('unused dummy credential', 12);
  return {
    async register(input) {
      if (await User.exists({ email: input.email })) throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists');
      const password = await bcrypt.hash(input.password, 12);
      const user = await User.create({ name: input.name, email: input.email, phone: input.phone, password, role: 'DONOR' });
      return session(user, config);
    },
    async login(input) {
      const user = await User.findOne({ email: input.email }).select('+password');
      const matches = await bcrypt.compare(input.password, user?.password ?? await dummyHash);
      if (!user || !matches || !user.isActive) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      return session(user, config);
    },
  };
}
