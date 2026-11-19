import { describe, expect, it } from 'vitest';
import { phoneKey } from '../src/utils/phone.js';
import { loginSchema, registerSchema, otpVerifySchema } from '../src/validators/auth.js';
import { createSmsProvider } from '../src/services/smsProvider.js';
describe('phone numbers', () => {
  it('normalizes Gambian numbers with or without the country code', () => {
    expect(phoneKey('7001234')).toBe('+2207001234');
    expect(phoneKey('+220 700 1234')).toBe('+2207001234');
    expect(phoneKey('00220 700-1234')).toBe('+2207001234');
    expect(phoneKey('220 7001234')).toBe('+2207001234');
  });
  it('rejects junk', () => {
    expect(phoneKey('12')).toBeUndefined();
    expect(phoneKey(undefined)).toBeUndefined();
  });
});
describe('auth validation', () => {
  it('registers donors with phone and an 8+ character password, email optional', () => {
    expect(registerSchema.safeParse({ name: 'Awa Jallow', phone: '7001234', password: 'abcd1234' }).success).toBe(true);
    expect(registerSchema.safeParse({ name: 'Awa Jallow', phone: '7001234', password: 'short' }).success).toBe(false);
  });
  it('signs in with exactly one of phone or email', () => {
    expect(loginSchema.safeParse({ phone: '7001234', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.gm', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ phone: '7001234', email: 'a@b.gm', password: 'x' }).success).toBe(false);
  });
  it('requires a 6-digit code', () => {
    expect(otpVerifySchema.safeParse({ phone: '7001234', code: '123456' }).success).toBe(true);
    expect(otpVerifySchema.safeParse({ phone: '7001234', code: '12345' }).success).toBe(false);
  });
});
describe('sms provider', () => {
  it('never uses the console provider in production', () => {
    expect(createSmsProvider({ SMS_PROVIDER: 'console', NODE_ENV: 'production' })).toBeNull();
    expect(createSmsProvider({ SMS_PROVIDER: 'console', NODE_ENV: 'development' })?.name).toBe('console');
    expect(createSmsProvider({ SMS_PROVIDER: 'twilio', NODE_ENV: 'production' })).toBeNull();
  });
});
