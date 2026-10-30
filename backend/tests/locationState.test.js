import { describe, it, expect, vi, afterEach } from 'vitest';
import { isLocationFresh, isLocationReady } from '../src/utils/locationState.js';
import { geoPointSchema } from '../src/validators/location.js';
import { parseEnv } from '../src/config/env.js';
const now = new Date('2026-10-30T12:00:00.000Z');
const point = { type: 'Point', coordinates: [-16.6769, 13.4549] };
const ready = { role: 'DONOR', isActive: true, availabilityStatus: 'AVAILABLE', locationSharingEnabled: true, currentLocation: point, locationUpdatedAt: now, donorVerification: { status: 'UNVERIFIED' } };
afterEach(() => vi.useRealTimers());
describe('location freshness', () => {
  it.each([
    [0, true], [1, true], [60 * 60000 - 1, true], [60 * 60000, true],
    [60 * 60000 + 1, false], [2 * 60 * 60000, false], [-1, false],
  ])('handles age %d milliseconds with result %s', (age, expected) => {
    expect(isLocationFresh({ ...ready, locationUpdatedAt: new Date(now.getTime() - age) }, 60, now)).toBe(expected);
  });
  it.each([
    { locationUpdatedAt: undefined }, { locationUpdatedAt: null }, { locationUpdatedAt: new Date('invalid') },
    { locationUpdatedAt: '2026-10-30T12:00:00Z' }, { currentLocation: undefined },
    { currentLocation: { type: 'Point', coordinates: [181, 0] } },
    { currentLocation: { type: 'Point', coordinates: [0, '1'] } },
  ])('rejects missing/corrupt location state %#', patch => {
    expect(isLocationFresh({ ...ready, ...patch }, 60, now)).toBe(false);
  });
  it.each([0, -1, 1.5, NaN, Infinity, '60', undefined])('fails closed for invalid max age: %s', age => {
    expect(isLocationFresh(ready, age, now)).toBe(false);
  });
  it('uses current time without persisting a freshness boolean', () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    expect(isLocationFresh(ready, 60)).toBe(true);
    vi.setSystemTime(new Date(now.getTime() + 3600001));
    expect(isLocationFresh(ready, 60)).toBe(false);
  });
  it('fails closed for invalid current time or absent donor', () => {
    expect(isLocationFresh(ready, 60, new Date('bad'))).toBe(false);
    expect(isLocationFresh(undefined, 60, now)).toBe(false);
  });
});
describe('location readiness is separate from full matching eligibility', () => {
  it('allows location readiness for an unverified donor', () => {
    expect(isLocationReady(ready, 60, now)).toBe(true);
  });
  it.each([
    { availabilityStatus: 'UNAVAILABLE' }, { locationSharingEnabled: false },
    { currentLocation: undefined }, { locationUpdatedAt: undefined },
    { locationUpdatedAt: new Date(now.getTime() - 3600001) },
    { isActive: false }, { role: 'FACILITY_USER' }, { role: 'ADMIN' },
    { availabilityStatus: undefined }, { isActive: 'true' }, { locationSharingEnabled: 'true' },
  ])('rejects non-ready state %#', patch => { expect(isLocationReady({ ...ready, ...patch }, 60, now)).toBe(false); });
  it('fails closed for an absent donor', () => { expect(isLocationReady(undefined, 60, now)).toBe(false); });
});
describe('strict coordinate and environment validation', () => {
  it.each([NaN, Infinity, -Infinity, '13.4', null])('rejects non-finite/non-numeric coordinates: %s', value => {
    expect(geoPointSchema.safeParse({ type: 'Point', coordinates: [value, 13] }).success).toBe(false);
    expect(geoPointSchema.safeParse({ type: 'Point', coordinates: [-16, value] }).success).toBe(false);
  });
  const env = { MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_SECRET: 'test-only-configuration-secret-at-least-32-characters' };
  it('uses the documented 60-minute development default', () => { expect(parseEnv(env).DONOR_LOCATION_MAX_AGE_MINUTES).toBe(60); });
  it('accepts a configurable positive integer freshness window', () => { expect(parseEnv({ ...env, DONOR_LOCATION_MAX_AGE_MINUTES: '15' }).DONOR_LOCATION_MAX_AGE_MINUTES).toBe(15); });
  it.each(['0', '-1', '1.5', 'Infinity', 'NaN', 'bad', '', '10081'])('rejects invalid freshness configuration: %s', value => {
    expect(() => parseEnv({ ...env, DONOR_LOCATION_MAX_AGE_MINUTES: value })).toThrow('Invalid environment configuration');
  });
});
