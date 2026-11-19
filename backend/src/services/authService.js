import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { User, publicUser } from '../models/User.js';
import { OtpCode } from '../models/OtpCode.js';
import { AppError } from '../utils/errors.js';
import { phoneKey } from '../utils/phone.js';
import { createSmsProvider } from './smsProvider.js';
const tokenOptions = { algorithm: 'HS256', issuer: 'lifelink', audience: 'lifelink-api' };
const signupOptions = { algorithm: 'HS256', issuer: 'lifelink', audience: 'lifelink-signup' };
const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
export function verifyToken(token, config) {
  const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'], issuer: tokenOptions.issuer, audience: tokenOptions.audience });
  if (typeof payload !== 'object' || !Number.isInteger(payload.exp) || !Number.isInteger(payload.iat) || payload.exp <= payload.iat || payload.exp - payload.iat > 86400 || payload.iat > Math.floor(Date.now() / 1000) + 30) throw new Error('Invalid token claims');
  return payload;
}
function session(user, config) {
  return { user: publicUser(user), accessToken: jwt.sign({ tokenVersion: user.tokenVersion ?? 0 }, config.JWT_SECRET, { ...tokenOptions, subject: user._id.toString(), expiresIn: config.JWT_EXPIRES_IN }), tokenType: 'Bearer' };
}
const hashCode = (config, key, code) => crypto.createHmac('sha256', config.JWT_SECRET).update(`${key}:${code}`).digest('hex');
export function createAuthService(config) {
  // Equal-cost comparison for unknown accounts reduces account timing differences.
  const dummyHash = bcrypt.hash('unused dummy credential', 12);
  const sms = createSmsProvider(config);
  async function consumeCode(phone, code, purpose) {
    const key = phoneKey(phone);
    const record = await OtpCode.findOne({ phoneKey: key, purpose, usedAt: null }).sort({ createdAt: -1 });
    if (!record || record.expiresAt <= new Date() || record.attempts >= MAX_ATTEMPTS) throw new AppError(400, 'CODE_INVALID', 'This code has expired. Request a new one.');
    const expected = Buffer.from(record.codeHash, 'hex');
    const actual = Buffer.from(hashCode(config, key, code), 'hex');
    if (!crypto.timingSafeEqual(expected, actual)) {
      await OtpCode.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
      throw new AppError(400, 'CODE_INVALID', 'That code is not correct. Check the SMS and try again.');
    }
    const used = await OtpCode.findOneAndUpdate({ _id: record._id, usedAt: null }, { $set: { usedAt: new Date() } });
    if (!used) throw new AppError(400, 'CODE_INVALID', 'This code was already used. Request a new one.');
    return key;
  }
  const activeUserByPhone = key => User.findOne({ phoneKey: key, isActive: true }).sort({ createdAt: 1 });
  return {
    options() { return { smsCodes: !!sms, passwordSignIn: true }; },
    async register(input) {
      const key = phoneKey(input.phone);
      if (await User.exists({ phoneKey: key })) throw new AppError(409, 'PHONE_IN_USE', 'An account with this phone number already exists. Sign in instead.');
      if (input.email && await User.exists({ email: input.email })) throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists');
      const password = await bcrypt.hash(input.password, 12);
      const user = await User.create({ name: input.name, email: input.email, phone: input.phone, password, role: 'DONOR' });
      return session(user, config);
    },
    async login(input) {
      const candidates = input.email
        ? await User.find({ email: input.email }).select('+password').limit(1)
        : await User.find({ phoneKey: phoneKey(input.phone) }).select('+password').sort({ createdAt: 1 }).limit(5);
      let match = null;
      for (const user of candidates) {
        if (user.password && await bcrypt.compare(input.password, user.password)) { match = user; break; }
      }
      if (!candidates.length) await bcrypt.compare(input.password, await dummyHash);
      if (!match || !match.isActive) throw new AppError(401, 'INVALID_CREDENTIALS', input.email ? 'Invalid email or password' : 'Wrong phone number or password');
      return session(match, config);
    },
    async requestCode(input) {
      if (!sms) throw new AppError(503, 'SMS_UNAVAILABLE', 'SMS codes are not available yet. Sign in with your password.');
      const key = phoneKey(input.phone);
      const now = Date.now();
      const recent = await OtpCode.find({ phoneKey: key, createdAt: { $gt: new Date(now - 3600000) } }).sort({ createdAt: -1 }).limit(MAX_SENDS_PER_HOUR);
      if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) throw new AppError(429, 'CODE_COOLDOWN', 'Please wait 30 seconds before requesting another code.');
      if (recent.length >= MAX_SENDS_PER_HOUR) throw new AppError(429, 'CODE_LIMIT', 'Too many codes requested. Try again in an hour.');
      // A reset only makes sense for an existing account; we still answer the same way to avoid revealing who is registered.
      if (input.purpose === 'RESET' && !await activeUserByPhone(key)) return { sent: true, expiresInSeconds: CODE_TTL_MS / 1000 };
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      await OtpCode.create({ phoneKey: key, purpose: input.purpose, codeHash: hashCode(config, key, code), expiresAt: new Date(now + CODE_TTL_MS) });
      try { await sms.send(key, `${code} is your LifeLink code. It expires in 5 minutes. Never share it.`); }
      catch { throw new AppError(502, 'SMS_FAILED', 'We could not send the SMS. Please try again.'); }
      return { sent: true, expiresInSeconds: CODE_TTL_MS / 1000 };
    },
    async verifyCode(input) {
      const key = await consumeCode(input.phone, input.code, 'SIGN_IN');
      const user = await activeUserByPhone(key);
      if (user) return { status: 'SIGNED_IN', session: session(user, config) };
      const signupToken = jwt.sign({ phoneKey: key, phone: input.phone }, config.JWT_SECRET, { ...signupOptions, expiresIn: '15m' });
      return { status: 'NEEDS_PROFILE', signupToken };
    },
    async completeSignup(input) {
      let claims;
      try { claims = jwt.verify(input.signupToken, config.JWT_SECRET, { algorithms: ['HS256'], issuer: signupOptions.issuer, audience: signupOptions.audience }); }
      catch { throw new AppError(400, 'SIGNUP_EXPIRED', 'Your sign-up session expired. Request a new code.'); }
      const existing = await activeUserByPhone(claims.phoneKey);
      if (existing) return session(existing, config);
      const user = await User.create({ name: input.name, phone: claims.phone, role: 'DONOR' });
      return session(user, config);
    },
    async resetPassword(input) {
      const key = await consumeCode(input.phone, input.code, 'RESET');
      const user = await activeUserByPhone(key);
      if (!user) throw new AppError(400, 'CODE_INVALID', 'This code has expired. Request a new one.');
      user.password = await bcrypt.hash(input.password, 12);
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      await user.save();
      return session(user, config);
    },
  };
}
